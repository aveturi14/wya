# Architecture and scalability: panel questions from the code

Written 2026-10-18 from a read of `supabase/migrations/`, `supabase/functions/scan-receipt/`, `hooks/useUnread.tsx`, `lib/supabase.ts` and `app/event/[id].tsx` on `main`. Each question names where in the code it comes from. 🔴 hard · 🟡 medium · 🟢 easy. Nothing here has been load tested. Where a claim is my reading of the code and not something I ran, it says so.

## Structure and rules

**1 🟢 Walk me through the structure of the codebase.**
*Code:* `app/` (Expo Router screens), `components/` (UI by feature), `hooks/` and `lib/` (client logic), `supabase/migrations/` (31 files, the source of truth for the database), `supabase/functions/` (one Edge Function, `scan-receipt`), `supabase/tests/` (Python checks).
*Answer:* The phone and web client are thin. They call database functions and read tables the database lets them. The rules (who can see what, who owes what) live in Postgres, so web, phone and tests all hit the same logic.

**2 🟡 Why put the logic in the database instead of an API server?**
*Code:* about 177 functions, almost all `security definer` with `search_path = ''`.
*Answer:* Money and access rules need transactions and constraints, and putting them in one place means no client can bypass them. The trade-off is Postgres-specific code that's harder to unit test and move. We test by calling the functions as real users.

**3 🔴 `security definer` runs as the owner. How do you stop privilege escalation?**
*Code:* every function sets `search_path = ''`, uses fully qualified names, checks `auth.uid()` itself, and is revoked from `public` and `anon`; the `private` schema isn't exposed over the API.
*Answer:* Each function re-checks the caller, so being able to call it doesn't grant anything. The Supabase advisor's warnings about these functions are expected, and our access tests (about 200) cover who can and can't call what. We haven't had an external security review.

**4 🟡 How is the schema kept reproducible?**
*Code:* 31 migration files, written to be safe to re-run.
*Answer:* Honestly, partly. Migrations are applied by hand in the SQL editor, and recorded versions don't match file names. The fix is the Supabase CLI with a local stack in CI.

## Money correctness

**5 🔴 Walk me through a wallet payment. How do you stop a double pay?**
*Code:* `pay_from_wallet` in `20261019000100_wallet.sql`.
*Answer:* It locks the debt row (`for update`), so two taps or two devices queue. It checks the caller owns the debt and that the amount they were shown still matches, then locks both wallets in a fixed order so two payments can't deadlock. It writes a ledger transaction with two entries and updates both balances and the debt in one transaction. A second tap returns "already paid", and a unique index allows only one payment per debt.

**6 🟡 Can a wallet balance drift from the ledger?**
*Code:* `wallets.balance_cents` is stored alongside `wallet_entries`; I found no reconciliation job.
*Answer:* Both are written in the same transaction, and balances can't go below zero. But nothing checks that a balance equals the sum of its entries. Before any real money, we'd add a nightly reconciliation that alerts on a mismatch.

**7 🔴 Can a bill be reopened while someone is paying it?** *(a gap I found while reading; I haven't reproduced it)*
*Code:* `unlock_receipt` checks `exists (… obligations where status <> 'owed')` and then deletes the split and its debts. It doesn't lock those debt rows. `wallet_txns.obligation_id` is `on delete set null`.
*Answer:* From reading it, there's a small race: if a friend's payment commits between that check and the delete, the debt is deleted while the money has moved, leaving a payment with no debt. It needs near-simultaneous actions in a test-money wallet, but it's real. The fix is one line: lock the split's debts (`for update`) before checking. We'd fix it before any real money.

**8 🟡 How do you stop two people claiming the same item?**
*Code:* `20261019000200_claim_units.sql`; `lock_receipt` calls `receipt_blockers` first.
*Answer:* Claims can't exceed the units left on a line, and a bill can't lock until every line is claimed and everyone's confirmed. `lock_receipt` creates the split and every debt in one transaction, so it's all or nothing.

**9 🟡 How do you rate-limit, and can it be gamed?**
*Code:* `private.hit_rate_limit`: a counter row per key per time window, upserted atomically, cleaned nightly.
*Answer:* It's a fixed-window counter, so someone can burst up to twice the limit across a window boundary. For expensive actions like receipt scans we'd move to a sliding window and a per-user daily cost cap.

## What breaks first

**10 🔴 What breaks first at scale?**
*Code:* `hooks/useUnread.tsx` subscribes every user to every insert on `chat_messages` and re-runs `get_my_chats` for each.
*Answer:* That. Realtime checks row security for each subscriber for each message, so cost grows as messages × users, and each message triggers a query per user. The fix: subscribe only to the open chat, and drive unread badges from the per-user `notifications` table.

**11 🟡 What does `get_my_chats` cost?**
*Code:* a correlated `count(*)` of unread messages per chat plus a lateral "latest message" lookup.
*Answer:* The `(event_id, created_at desc)` index keeps each lookup cheap, but cost grows with chats × unread messages, and it's called far more than needed (see 10). We'd store an unread counter per chat member and increment it in the insert.

**12 🟡 How does chat load?**
*Code:* `app/event/[id].tsx` selects all messages for the event with no limit.
*Answer:* Unbounded today, fine for a dinner chat, poor for a long-running group. We'd load the latest 50 and page back by `created_at`. The index already supports it.

**13 🔴 What happens when a host edits an event with 500 guests?**
*Code:* `private.notify_event_change` inserts one notification per RSVP in an AFTER trigger.
*Answer:* All of those inserts run inside the host's own update transaction, so latency grows with guest count. We'd write one outbox row and have a short job fan out in batches.

**14 🟡 Your background jobs: what's their cost?**
*Code:* `process_pledge_deadlines` (and `process_nudges`) run every 15 minutes, joining `rsvps` and `events` and calling `private.cutoff_at(e)` per row.
*Answer:* Because the cutoff is computed per row, an index on date can't be used, so each run scans all pledge events. Fine now, not at scale. We'd store the cutoff as a column with a partial index, and add `for update skip locked` so overlapping runs never double-process.

**15 🟡 Which indexes are missing?**
*Code:* I found none on `rsvps (user_id)`, `events (host_id)` or `events (date)`.
*Answer:* The Home query filters by those, so it scans as data grows. It's a four-line migration (drafted in `docs/RUBRIC_REVIEW.md`), safe to add.

**16 🟡 The host's guest list also fetches each guest's record. Cost?**
*Code:* `get_guest_list` calls `get_reliability(r.user_id)` per row for hosts.
*Answer:* It's one request from the client, but the database runs a lookup per guest. A 30-guest stress test passes; at several hundred we'd precompute those stats into a table.

## AI and the Edge Function

**17 🟡 What happens when scanning is slow or fails, and how do you control cost?**
*Code:* `supabase/functions/scan-receipt/index.ts`.
*Answer:* It runs server-side so the key never reaches the phone, checks a database rate limit first, and clamps and validates what the model returns (quantities, surcharge percentages), so a bad scan can't create an inconsistent bill. The payer can always type lines in. It's a synchronous call today. At volume we'd add a queue, image-size caps, a timeout, and a daily spend ceiling per user.

## Client

**18 🟡 How does the client talk to the data?**
*Code:* `lib/supabase.ts` (direct client, GET-only retry), calls from components and hooks; no shared cache or query layer.
*Answer:* Direct and simple. Reads retry on failure, but writes are never retried so a retry can't double-send a payment or message. The cost is refetching on every focus. We'd add a query cache for deduplication and offline reads.

**19 🟢 Why is `app/event/[id].tsx` so large?**
*Code:* about 800 lines, partly split into `components/event/`.
*Answer:* It grew with the features. State and data calls stay in the page, with UI split out. We'd move data fetching into hooks next.

## Operations and growth

**20 🔴 How do you test, deploy and monitor?**
*Code:* `supabase/tests/` (about 200 access checks, about 230 feature checks, a 30-guest stress test); no `.github/` folder; I found no monitoring or alerting configuration.
*Answer:* The tests are strong on rules and run against the one shared dev project. There's no CI, no staging, and no alerting. The first operational step is CI against a local Supabase stack and a staging project.

**21 🟡 What about cost at scale?**
*Answer:* We haven't modelled it, and I won't quote a number. The costs to watch are model calls per scan, photo storage, and Realtime connections.

**22 🔴 If usage grew 10×, then 100×, what would you change, in order?**
*Answer:* (1) The unread badge and the missing indexes: cheap, and the first things to break. (2) Chat paging and an outbox for notifications. (3) CI, staging and monitoring. (4) A queue for receipt scans. (5) Before any real money: the unlock race fix, wallet reconciliation, and a licensed payments partner. Measure at each step with a load test.

## Rehearse these five first
**10**, **7**, **5**, **20** and **22**. For each: say what it does, name the weakness in one sentence, then name the specific fix.
