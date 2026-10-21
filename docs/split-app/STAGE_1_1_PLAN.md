# Stage 1.1: Collect before you book (build plan)

_Written 2026-10-21. Handoff for a coding agent. Read all of it before you write any code._

## 0. Read this first

**Where this fits.** The founders are building a group-payments product (`docs/split-app/PRODUCT_BRIEF.md` has the background; the Stage 1 order below **replaces** the stage order in that brief and in `strategy_report.tex`). Stage 1 ends with a virtual card that a group pays any business with. It's built in four steps:

| Step | Money goes | Status |
|---|---|---|
| **1.1 (this plan)** | Each friend pays the **organiser** directly by PayID. wya only records commitments and progress. | **Build now** |
| 1.2 | Card / Apple Pay through a licensed partner, confirmed automatically | Later |
| 1.3 | A locked pot held by a licensed partner (the wya wallet goes live) | Later |
| 1.4 | The full pot becomes a single-use virtual card | Later |

**What 1.1 must prove:** that groups will **commit and pay before the organiser books**. Nothing more. Keep it small.

**Project rules you must follow** (all in `CLAUDE.md`; read it):
- **Git:** don't run `git add`, `commit` or `push`, and don't open PRs. Prepare the changes, then suggest commit groups and a PR description. Ask the human to create a branch first (suggested: `stage1-1-collect` from `main`).
- **Expo SDK 57:** read https://docs.expo.dev/versions/v57.0.0/ before using any Expo API (`AGENTS.md`).
- **Database changes:** one new, re-runnable migration file in `supabase/migrations/`. Apply it to wya-dev (Supabase MCP `apply_migration`, or ask the human to paste it into the SQL editor). Then run `python3 -I supabase/tests/rls_check.py` (it must stay green) and your new tests.
- **Rules live in the database:** security-definer RPCs with `search_path = ''`, schema-qualified names, no direct client writes to the new tables.
- **UI:** the design kit in `components/ui/`, `makeStyles`, `theme.type.*`, no raw hex values, `TabScreen` / `Screen` rules, sentence-case friendly copy.
- **Before saying it works:** `npm run typecheck` (zero errors), `rls_check.py`, your new tests, and the browser at phone and desktop widths in light and dark. Check the iOS simulator for new screens if you can.

**No money moves through wya in 1.1.** No wallet, no Stripe, no top-ups. Collect debts are paid by PayID only, straight to the organiser. The wallet (`app/wallet.tsx`, `…_wallet.sql`) stays as it is, and collect debts must **not** be payable from it.

---

## 1. The feature in one example

> Alex wants to take 8 friends karting on Saturday: $60 each, $480 total. Alex doesn't want to pay $480 and chase people.
>
> 1. Alex creates a wya event "Karting" (or uses an existing one) and taps **Collect money**: "$60 each, for Karting at Kart World, pay by Thursday 6pm, need at least 6 people".
> 2. Alex shares the event link in the group chat. Friends open it (web or app), sign in, accept the invite and see the collection card.
> 3. Sam taps **I'm in, $60**. That's Sam's consent, and a $60 debt to Alex is created. Sam sees Alex's PayID and a reference, pays from their bank app, and taps **I've paid**.
> 4. Alex sees "Sam says they've paid $60" and taps **Got it** to confirm it arrived (or **Not received**).
> 5. The card shows progress: **6 of 8 in · 5 confirmed · $300 of $480**. Unpaid people get reminded.
> 6. When the target is met, everyone gets "Karting is funded". Alex books Kart World with the money already in their account, then taps **Mark as booked**.
> 7. If Thursday 6pm passes without reaching the minimum, the collection **expires**. Everyone is told, and Alex is asked to refund each person who paid. Alex taps **Refunded** per person, and each person can confirm.

## 2. Product rules (non-negotiable)

1. **Consent per person.** A debt exists only after that person taps "I'm in" for a specific amount, payee (the organiser) and deadline. Being invited to the event never creates a debt.
2. **The amount is fixed once anyone has joined.** The organiser can extend the deadline or cancel, but can't change the per-person amount after the first join. To change it, they cancel and start a new collection.
3. **Separate states.** "In" (committed), "says paid" (claimed by the payer), "confirmed" (the organiser got it) and "refunded" are different, and the UI never shows "paid" for a share that's only claimed.
4. **Funded means confirmed.** A collection is **funded** when confirmed shares ≥ `min_people` **and** confirmed money ≥ `target_cents` (if a target is set). Claims alone never fund it.
5. **Nobody is charged automatically.** wya never moves money. The organiser never covers a shortfall automatically. If they want to go ahead with fewer people, they tap **Go ahead anyway** (section 4).
6. **Collect debts never block RSVPs** and never count against anyone's reliability record (like `split` debts).
7. **The organiser must have a PayID** on their profile before creating a collection (`set_payid` already exists). Guests see it only through `get_payment_instructions`, and only while they owe the organiser.
8. **Leaving.** A person can leave before they've paid (their debt is removed). After they've paid, leaving means asking for a refund. The organiser marks it refunded.

## 3. Data model (one migration: `supabase/migrations/<timestamp>_collections.sql`)

Use the next timestamp after the latest file (currently `20261019000300_wallet_cashout.sql`), e.g. `20261021000000_collections.sql`. Make it safe to re-run.

### 3.1 `public.collections`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `event_id` | uuid not null → `events` on delete cascade | The group = the event's guests |
| `organiser_id` | uuid not null → `auth.users` | Who's collecting; debts are owed to them |
| `title` | text 1–80 | "Karting at Kart World" |
| `merchant_note` | text ≤ 200, nullable | What it's for / where they'll book (optional link) |
| `per_person_cents` | int 100–500000 | Fixed after the first join |
| `min_people` | int ≥ 1 | Funded threshold (people) |
| `target_cents` | int nullable | Optional money threshold; default `per_person_cents × min_people` if null |
| `max_people` | int nullable | Optional cap; joins refused once reached |
| `deadline` | timestamptz not null | Must be in the future when created; ≤ 60 days out |
| `status` | text | `open` → `funded` → `booked`; or `expired`, `cancelled` |
| `funded_at`, `booked_at`, `closed_at` | timestamptz nullable | |
| `go_ahead_short` | boolean default false | Organiser chose to go ahead below the minimum |
| `message_id` | uuid → `chat_messages` on delete set null | The chat card |
| `created_at` | timestamptz default now() | |

RLS on, with no insert, update or delete grants to `anon` / `authenticated`. Select for the organiser and event guests (`private.is_event_guest`, which already excludes `requested`). Reads go through `get_collection` anyway.

### 3.2 Reuse `public.obligations` for each person's share

Follow `20261017000300_splits.sql` exactly (it's the closest precedent):
- Add `collection_id uuid references public.collections on delete cascade`.
- Extend `obligations_kind_check` to `('pledge', 'split', 'collect')`, and add a shape constraint `(kind = 'collect') = (collection_id is not null)`.
- Extend `obligations_reason_check` with `'collection'`.
- Unique index: one collect debt per `(collection_id, guest_id)`.
- `host_id` = the organiser (it already means "who is owed"), `guest_id` = the participant.
- Add `confirmed_at timestamptz` (the organiser confirmed receipt), `refund_requested_at`, and `refunded_at`. Use columns, not new statuses, so existing code that switches on `status` keeps working. A collect debt goes `owed` → `paid` (claimed) → confirmed via `confirmed_at`; a dispute uses the existing `disputed` status.
- **Check every function that reads obligations** and make sure collect debts behave like splits where needed: `private.has_open_debt` (must ignore `collect`), `get_reliability` and track records (ignore `collect`), `get_my_obligations`, `get_my_dues`, the Needs-you queries, `notify_obligation_change`, `process_pledge_deadlines`, and `waive_all`. Grep for `kind = 'split'` and `kind <> 'pledge'` across `supabase/migrations/` and redefine (in this migration) any function whose behaviour must change. **Copy the latest definition of each function** (later migrations redefine earlier ones, e.g. `…_wallet.sql` redefines `claim_paid`, `notify_obligation_change` and `get_my_dues`).
- `claim_paid`: the latest version refuses `split` (wallet only). Allow `collect` (PayID) and set `paid_via = 'payid'`.
- `pay_from_wallet` must **refuse** `collect` debts (hint `payid_only`).

### 3.3 RPCs (all `security definer`, `search_path = ''`, caller checked inside)

| Function | Who | What |
|---|---|---|
| `create_collection(p_event_id, p_title, p_per_person_cents, p_min_people, p_deadline, p_max_people default null, p_target_cents default null, p_merchant_note default null)` | Event host **or** a going guest | Requires the caller to have a PayID (hint `needs_payid`). Validates ranges. One open collection per event at a time (hint `already_collecting`). Posts a `collect` chat card via `private.post_message`. Returns the id. |
| `get_collection(p_id)` | Organiser or event guest | Collection fields, counts (`joined`, `claimed`, `confirmed`, `confirmed_cents`), and a people list: name, avatar, state (`in` / `says_paid` / `confirmed` / `disputed` / `refund_requested` / `refunded`). The caller's own obligation id. Never return a PayID here. |
| `join_collection(p_id)` | An event guest (not `requested`) who isn't the organiser | Only while `open` and before the deadline, under `max_people`. Creates the `collect` obligation (`owed`). Idempotent. |
| `leave_collection(p_id)` | A participant | If unpaid: delete the obligation. If paid or confirmed: set `refund_requested_at` and notify the organiser. |
| `confirm_received(p_obligation_id)` | The organiser | Only for `collect` debts in `paid`. Sets `confirmed_at`, then re-checks funding (below). |
| `dispute_payment` (existing) | The organiser | Must work for collect ("Not received"). Clears `confirmed_at`. |
| `mark_refunded(p_obligation_id)` | The organiser | For collect debts that were paid, after expiry, cancel or a leave request. Sets `refunded_at` and notifies the payer. |
| `go_ahead_anyway(p_id)` | The organiser | Only while `open` with ≥ 1 confirmed share. Sets `go_ahead_short`, then `funded`. |
| `mark_booked(p_id)` | The organiser | `funded` → `booked`, notifies everyone. |
| `extend_deadline(p_id, p_deadline)` | The organiser | Only later than the current deadline, while `open`. |
| `cancel_collection(p_id)` | The organiser | `open` or `funded` → `cancelled`. Unpaid debts are deleted; paid ones are flagged for refund. |
| `get_my_collections()` | Signed-in user | What I'm organising and what I've joined, with status and progress (for Home / Needs you). |
| `process_collection_deadlines()` | Cron (and tests) | Every `open` collection past its deadline becomes `expired`. Unpaid debts are deleted, paid ones flagged for refund, everyone notified. Also sends reminders (section 5). Safe to call any time, like `process_pledge_deadlines()`. |

**Funding check** (a private helper, called after every confirm, dispute, leave and join): if `open`, confirmed count ≥ `min_people` and confirmed cents ≥ the target, then set `funded`, set `funded_at` and notify everyone. If a dispute drops it below the threshold while still `funded` (not yet `booked`), move it back to `open` and tell the organiser.

**Cron:** schedule `process_collection_deadlines()` every 15 minutes with `pg_cron`, like the existing `wya-pledge-deadlines` job (see `…_pledges.sql`). Name it `wya-collection-deadlines`, and unschedule it first so the migration can be re-run.

### 3.4 Chat and notifications
- Add `collect` to the `chat_messages.kind` check. **Grep for the latest definition** of that constraint; don't drop existing kinds. Clients still can't insert it, because only `private.post_message` posts cards.
- Add notification types to the `notifications.type` check (again, copy the latest full list): `collect_started` (to event guests), `collect_paid` (to the organiser: "Sam says they've paid $60"), `collect_confirmed` (to the payer), `collect_funded` (to everyone in), `collect_booked`, `collect_expired`, `collect_cancelled`, `collect_refund_requested` (to the organiser), `collect_refunded` (to the payer), `collect_reminder`.
- Write these from the RPCs or triggers, never from the client. Follow `notify_obligation_change`.

## 4. App (Expo Router)

**Reuse, don't rebuild:**

| Need | Reuse |
|---|---|
| Show the organiser's PayID + reference, Copy all, bank shortcuts | `components/pledges/PayCard.tsx`, `get_payment_instructions` |
| Pay page | `app/pay/[id].tsx`: add a `collect` branch with PayID only, "I've paid", no wallet |
| Organiser sets their PayID | `components/pledges/GetPaidCard.tsx` / `set_payid` |
| Chat card pattern | `components/chat/SplitCard.tsx` |
| Money formatting | `formatMoney` in `lib/pledges.ts` |
| Lists, avatars, buttons | `ListSection`, `AvatarStack`, `Button`, `Card`, `Sticker`, `CountToggle` |
| Realtime refresh | `freshChannel()` from `lib/realtime.ts` |
| Alerts / confirms on web | `lib/alert.ts` |

**New:**
1. `lib/collections.ts`: types and RPC wrappers.
2. `components/collect/CollectForm.tsx`: amount per person, minimum people, optional max, deadline (reuse the date picker approach in `components/EventForm.tsx`; on iOS close on Done), what it's for. If the organiser has no PayID, show `GetPaidCard` first.
3. `components/collect/CollectCard.tsx`: the chat and event-page card. Title, "$60 each · by Thu 6pm", a progress bar (confirmed vs target, with claimed shown lighter), "6 of 8 in", and the caller's action button.
4. `app/collect/[id].tsx`: the full page.
   - **Everyone:** the progress bar, the deadline, what it's for, and the people list with their states.
   - **Participant:** "I'm in, $60" → "Pay Alex" (opens `/pay/<obligation id>`) → "I've paid" → "Confirmed ✓". "Leave" / "Ask for a refund".
   - **Organiser:** per person "Got it" / "Not received" / "Refunded". Top actions: "Mark as booked" (when funded), "Go ahead anyway", "Extend deadline", "Cancel".
   - Signed-out visitors sign in and come back (`returnTo`, as `app/pay/[id].tsx` does). Non-guests see "Ask the organiser for the invite link".
5. **Entry points:**
   - The event page (`app/event/[id].tsx`): a **Collect money** action for the host and going guests, and the `CollectCard` near the top while a collection is open.
   - Home "Needs you" (`components/NeedsYou`): "Pay Alex $60 for Karting" and, for organisers, "3 payments to confirm".
   - Activity rows for the new notification types (`app/activity.tsx`).
   - `lib/commands.ts`: optional `/collect 60 karting by thu`. Only add it if the parser stays simple; it's not required for 1.1.
6. **Copy** (voice: plain, friendly, sentence case). Examples: "Collect money", "$60 each, paid to Alex before booking", "You're in for $60", "Alex hasn't confirmed it yet", "Funded! Alex can book now", "This one didn't fill up. Alex will refund you".

Layout: phone single column, desktop via `useLayout().isWide`. Use `TabScreen` / `Screen` rules for the new page, `withTabBar={false}` when pushed.

## 5. Reminders
In `process_collection_deadlines()`, send at most one `collect_reminder` per person per window:
- To people who are in but unpaid: 24 h before and 2 h before the deadline.
- To the organiser: when shares are waiting for confirmation for more than 12 h.

Store what was sent so reminders never repeat, either a small `collection_reminders` table or columns on the obligation.

## 6. Measuring whether 1.1 works
The point of 1.1 is evidence. Add a function `get_collect_stats()` that only the service role can execute (revoke it from `authenticated`) and that returns:
- collections created; % reaching `funded` before the deadline; % `booked`
- median hours from create to funded
- average people joined vs `min_people`; % of joined who paid; % of claims later confirmed
- organisers with 2+ collections (repeat use)
- expired and cancelled counts, and refunds owed vs done

Exclude `@wya.test` accounts. Document how to run it in the plan doc's results section (section 10).

**1.1 passes (the founders' gate) when:** 50+ collections by real groups, 60%+ funded by the deadline, most funded within 48 h, and organisers coming back for a second collection.

## 7. Tests

1. **Database tests:** add a test file next to the Phase 8 ones. Read `supabase/tests/phase8/run.py` and `_harness.py` for the file format and how items are found by migration slug, and match it (e.g. a `test_10_01_collections.py` with `MIGRATION = "collections"`). Use `h.refused()` for "can't do X" checks, as `CLAUDE.md` says, and confirm the migration is applied before trusting any check. Cover at least:
   - Hannah (host, has a PayID) creates; Sam (stranger) can't see it or join; Gary (guest) joins, claims and gets confirmed.
   - Creating without a PayID → `needs_payid`. A second open collection on the same event → refused.
   - A non-organiser can't confirm, mark refunded, extend, cancel or book. A participant can't confirm their own payment.
   - The amount can't change after a join. Joins are refused after the deadline, over `max_people` or when not `open`.
   - Claims alone don't fund it; confirmations do; a dispute un-funds it before it's booked.
   - `pay_from_wallet` refuses a collect debt; `claim_paid` accepts it.
   - Collect debts don't block RSVPs and don't change `get_reliability`.
   - `process_collection_deadlines()` expires, deletes unpaid debts, flags paid ones for refund, and is safe to run twice.
   - Leaving before paying removes the debt; leaving after paying flags a refund.
   - `get_collection` never contains a PayID; `get_payment_instructions` works for a collect debt only while it's owed.
   - The new notification and chat-card rows are written by the database, and clients can't insert them.
   - Clean up after itself (`clear_test_notifications`, delete created rows), like the other tests.
2. `python3 -I supabase/tests/rls_check.py` must still pass. Add a few collection checks there if they fit its style. Run the test scripts one at a time; they share accounts.
3. `npm run typecheck`: zero errors.
4. **Browser** (`preview_start` with `wya-web`): Hannah creates a collection on "Seed Dinner Party"; Gary (`guest@wya.test`) joins, pays (claims), and Hannah confirms; then expiry via `process_collection_deadlines()` with a past deadline. Check phone and desktop widths, light and dark. Account passwords are in the header of `supabase/seed.sql`; enter them only on the local dev server.
5. **iOS simulator** (iPhone 18 Pro, iOS 27) for the collect page and form, if available.

## 8. Build order (one step at a time; check each before the next)

1. Branch set up by the human. Read `CLAUDE.md`, `docs/PHASE8.md` §4 8.3 (splits), and `…_splits.sql`, `…_wallet.sql` and `…_wallet_cashout.sql`.
2. Migration: table, obligations changes, RPCs, cron, chat and notification types, stats function. Apply it to wya-dev.
3. Database tests green; `rls_check.py` green.
4. `lib/collections.ts` + `app/collect/[id].tsx` + `CollectForm` + `CollectCard`.
5. The pay page `collect` branch (PayID only).
6. Entry points: the event page, Needs you, Activity.
7. Reminders and expiry checked end to end in the browser.
8. Typecheck, browser at both widths and both themes, iOS if possible.
9. Write `docs/split-app/STAGE_1_1_RESULTS.md`: what was built, what was tested (with output), anything not checked, and how to read the stats. Update `CLAUDE.md`'s "Last updated" note and code map with the new files. Suggest commit groups and a PR description to the human.

## 9. Decisions (defaults to use; flag any you change)

| # | Question | Default for 1.1 |
|---|---|---|
| C-1 | Who can start a collection? | The event host or any going guest |
| C-2 | Do participants need a wya account? | Yes (same sign-in as the pay page). A no-account guest flow is 1.2+. |
| C-3 | What does "funded" count? | Organiser-confirmed shares only |
| C-4 | Collections per event | One open at a time |
| C-5 | Payment methods | PayID only, to the organiser. No wallet, no card. |
| C-6 | Fees | None in 1.1 |
| C-7 | Deadline limits | Future, ≤ 60 days |
| C-8 | Organiser goes ahead short | Explicit "Go ahead anyway", never automatic |
| C-9 | Refunds | Manual by the organiser, tracked with "Refunded" |

## 10. Out of scope (don't build)
Card or Apple Pay payments, the wallet pot, virtual cards, partner integrations, fees, venue accounts, group deals, the Square Terminal, and data products. Keep `paid_via` open to new values so 1.2 can add a partner method without reworking 1.1.
