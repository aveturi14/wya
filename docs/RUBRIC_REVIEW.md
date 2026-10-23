# Rubric review: evidence, architecture and scalability

Written 2026-10-18 from a read of the repo on `main` (after Phase 9) plus web research. Scores are **my estimates** against the rubric, not facts. Market figures come from the sources listed; anything I couldn't verify is marked. Nothing here has been load tested beyond the existing 30-guest stress test.

## 1. Problem evidence (15 points: your weakest area)

### What the repo can honestly claim today
- **One observed frustration:** a founder's own birthday party (calls, a new WhatsApp group, Splitwise on the day, photos collected into a Google Drive). That is n = 1.
- **No user conversations, survey or interview notes exist in the repo.** The rubric asks for user conversations or research, so this is the gap to close before the pitch.
- Earlier feedback on the pledge idea (friction, discomfort with penalties) is reported by the founders but not recorded anywhere.

### Third-party figures that support the problem (all commissioned by payment companies, so treat as indicative)
| Figure | Source | Notes |
|---|---|---|
| 50% of Australians feel awkward asking friends to repay them; 44% don't chase money owed because it's embarrassing; they estimate they're owed about $1,350 on average; 46% pay shared costs knowing they won't be repaid in full; 22% avoid activities because they won't be reimbursed; 16% avoid picking up the bill | [PayPal Australia, 30 Jul 2024](https://newsroom.au.paypal-corp.com/Avoid_the_awkward_tax_this_World_Friendship_Day-_Aussies_uncomfortable_asking_friends_for_owed_money) | Best fit for your market. The page doesn't state the sample size or method. |
| 33% of UK adults are currently owed money by friends, family or colleagues; 46% feel too awkward to ask | [Starling Bank, UK, 2023](https://www.starlingbank.com/news/one-third-of-uk-adults-owed-money-by-friends-and-family/) | UK, not Australia. |
| 32% of US millennials feel awkward splitting the bill; 47% would rather cover it all | [Credit Karma](https://www.creditkarma.com/about/commentary/check-please-millennials-suffer-extreme-anxiety-when-picking-up-the-tab-for-friends) | US, millennials only. |

### Competitors: what I could and couldn't verify
**I found no user counts for Beem or for Splitwise, so a statistical market-share comparison isn't possible. Don't state one.** Compare capabilities and constraints instead.

| | Splitwise | Beem (Beem It) |
|---|---|---|
| What it is | Freemium expense-splitting app. [Preqin](https://www.preqin.com/data/profile/asset/splitwise-inc-/435503) lists a US$20M Series A in April 2021 (Insight Partners). | Joint venture of CBA, NAB and Westpac, for instant payments, requests and bill splits ([NAB](https://news.nab.com.au/news/nab-cba-and-westpac-build-next-generation-of-mobile-payments-and-wallets-in-australia)). |
| Money movement | Tracks debts; doesn't move money (per your own docs, unverified here) | Moves money, on Visa/Mastercard/Eftpos debit rails, not Osko ([American Banker](https://americanbanker.com/payments/news/australias-mobile-wallet-beem-it-eschews-new-fast-payments-platform-in-favor-of-debit-rails)) |
| Known constraints | Free tier reportedly capped (about three new expenses a day) with ad breaks, per user reviews around late 2023 ([Kimola](https://kimola.com/reports/splitwise-feedback-analysis-unlock-user-sentiments-google-play-154450)); Pro about US$5 a month per a design blog ([Yellow Slice](https://yellowslice.in/bed/splitwise-app-review-ux-ui-improvements/)). **Anecdotal and dated.** | A 2020 Canstar review lists A$2,000 a day and A$10,000 over 30 days ([Canstar](https://www.canstar.com.au/transaction-accounts/beem-it)). **May have changed.** |
| Tied to an event or attendance? | No (unverified) | No (unverified) |

**To verify before the pitch:** whether Splitwise or Beem now offer itemised receipt splitting, receipt scanning, or per-item claiming; current user counts from their own press pages; whether Splitwise's free-tier cap still applies.

PayID context: the Reserve Bank reported 4.1 million PayIDs and about 384 million fast payments between February 2018 and January 2020 ([RBA](https://www.rba.gov.au/publications/bulletin/2020/mar/two-years-of-fast-payments-in-australia.html)). A LinkedIn post claims 1.6 billion payments in 2024 and 25 million PayIDs; **unverified, check Australian Payments Plus before quoting it**.

### Honest limits to say out loud
- wya needs every guest to sign in, which is the same account friction as Splitwise. Your mitigation is a web link with no install.
- wya's wallet is a **test balance**, so wya can't yet move real money the way Beem does. Today real money moves only by the guest paying the host's PayID themselves.

### Cheapest way to raise this score (do before pitch)
1. Interview 8 to 10 people who organised a group dinner or trip in the last 3 months. Ask what they used, what went wrong, and what they paid or lost. Record dates, who, and one quote each.
2. Run a 5-question form (three-minute survey) to 30+ friends: "last time you split a bill, how long until everyone paid?", "did anyone never pay?", "which apps did you use?".
3. Put the counts on one slide, labelled "our research, n = X, not statistically representative", next to the PayPal figures. Calling your own small sample out as small scores better than hiding it.

## 2. What is implemented (architecture)

**Stack:** Expo SDK 57 / React Native (iOS, Android, web from one codebase); Supabase (Postgres with row-level security, Auth, Storage, Realtime, pg_cron, one Edge Function). Hosted web at wya.expo.app.

**Data model:** 33 tables across 31 migrations and about 177 database functions. Groups: identity (profiles), events and access (events, rsvps, invites, removals), conversation (chat, polls, plans), money (obligations, split bills, receipts and claims, wallets, ledger entries), media (photos), and background jobs (notifications, agent actions). Money is stored as integer cents.

**Strong points (defensible in Q&A):**
- **Rules live in the database.** Every state change goes through a `security definer` function with `search_path = ''`; tables aren't directly writable for money, pledges or notifications. The web, phone, tests and any future agent all hit the same rules.
- **Hidden columns per viewer** (address, PayID, notes) via functions, since row security can't hide columns.
- **Wallet ledger is double-entry** (two rows summing to zero), balance can't go below zero, one payment per debt (unique index), and no "send money to someone" function exists.
- **Concurrency is considered:** per-event advisory locks for photo and plan caps, a rate-limit table, partial unique indexes.
- **Tests:** about 200 access-control checks, about 230 feature checks, a 30-guest concurrent stress test. They run against the shared dev project.
- **Multi-user:** isolation is by row-level security and a role per row (host, guest, payer), not by app code.

## 3. What would break first at scale (ranked; my reasoning, not measured)

1. **The "unread" subscription.** `hooks/useUnread.tsx` subscribes every signed-in user to **every insert on `chat_messages`** and re-runs a database call each time one arrives. Supabase Realtime checks row security per subscriber per row, so cost grows as messages × subscribers. This is the first thing to fall over. *Fix:* subscribe only to the chat that is open, and drive unread badges from the `notifications` table (already per-user) or a broadcast channel.
2. **Missing indexes.** I found no index on `rsvps (user_id)`, `events (host_id)` or `events (date)`. The Home query filters by `user_id` and `host_id`, and the 15-minute cron jobs scan by date and status, so these become full table scans as data grows. *Fix:* SQL below.
3. **Chat loads the whole history.** `app/event/[id].tsx` selects every message for an event, with no limit. The `(event_id, created_at desc)` index already exists, so paging is cheap to add. *Fix:* load the latest 50, then page by `created_at`.
4. **Notifications are written inside the user's own transaction.** A time change or photo upload loops over guests (and updates the single "photos added" row per person per event) in the same transaction. Latency and lock contention grow with guest count; a 300-photo album is the stress case. *Fix:* an outbox table that a short job drains in batches.
5. **Background jobs scan and act in one pass** (`process_pledge_deadlines`, `process_nudges`, every 15 minutes). They need partial indexes on the deadline columns and `for update skip locked` so two runs never double-process.
6. **Row-security helper functions run per row** (several on the receipts tables). Fine at today's size; wrap them in `(select …)` so Postgres evaluates them once per query, and re-check query plans at 10k+ rows.
7. **Receipt scanning is a synchronous model call** with a database rate limit. At volume it needs a queue, an image-size cap, a timeout, and a cost ceiling per user. (The function isn't deployed yet and needs `OPENAI_API_KEY`.)
8. **Money.** The test-mode wallet is well built, but real balances require a licensed payments partner (and a reconciliation job and idempotency keys on top-ups and cash-outs). That's a business and legal dependency, not only a technical one.
9. **Operations.** No CI (no `.github`), tests run by hand against the single shared dev project, migrations are pasted into the SQL editor (recorded versions don't match the file names), and there's no staging or production split. `lib/database.sql` is out of date.
10. **Client structure.** `app/event/[id].tsx` is still about 800 lines, and data is fetched ad hoc with `useState`, so every screen refetches on focus with no cache.

**Load testing:** none beyond 30 guests on one event. State that plainly rather than quoting a number.

## 4. Proposed migration and rebuild plan

**Before the pitch (about a day; safe, additive):**
- Add the indexes migration below, then re-run `rls_check.py`.
- Page the chat query (client change only).
- Seed demo data, deploy `scan-receipt` (or remove it from the demo), and write the Scope Honesty Declaration: wallet is a test balance, Android isn't run, push and widgets aren't built.

**Within a week:**
- Replace the global chat subscription with the notification-driven unread counter.
- Add GitHub Actions: typecheck, then the Python tests against a local Supabase (`supabase start`), so tests stop touching the shared project.
- Move to the Supabase CLI for migrations; create a staging project.

**When there's traction:**
- Outbox plus worker for notifications; queue for receipt scans.
- A data-fetching layer on the client (cache, retries, offline).
- Real money through a licensed partner, with reconciliation.
- Partition `chat_messages` and `notifications` by month if volume warrants it.

### Draft indexes migration (not added to `supabase/migrations/`; review, then add as a new file)
```sql
-- Indexes for the Home query and the cron jobs (safe to re-run)
create index if not exists rsvps_user_idx on public.rsvps (user_id, status);
create index if not exists rsvps_event_status_idx on public.rsvps (event_id, status);
create index if not exists events_host_date_idx on public.events (host_id, date desc);
create index if not exists events_date_idx on public.events (date);
```

## 5. Estimated scores (my judgment; change after your research and demo rehearsal)

| Criterion | Max | Estimate | Why | Biggest lift |
|---|---|---|---|---|
| It actually works | 25 | 19–22 | Persistent data, real flows, tests. Risks: receipt scan not deployed, wallet is test mode, Android unrun, deployed web may be behind `main`. | Deploy web and the function; demo only what the declaration says works. |
| Scalability and architecture | 20 | 13–16 | Sound model and rules; known gaps listed above, none hidden. | Index migration; be ready to explain item 1 in section 3. |
| Usefulness and problem fit | 15 | 9–11 | Clear pain, but audience is broad and "why switch" isn't sharp. | Pick one audience (Australian friend groups sharing a dinner) and one reason (itemised receipt split tied to who actually came). |
| Problem evidence and pitch confidence | 15 | 5–8 | Only an anecdote plus third-party surveys. | The interviews and the form in section 1. |
| Innovation and differentiation | 10 | 6–7 | Event context, itemised claiming, commitment record. Competitor claims unverified. | Verify what Splitwise and Beem do today. |
| Pitch delivery | 10 | not assessable | | Rehearse to time, with one demo path. |
| Design and UX | 5 | 3–4 | Phase 9 redesign and accessibility work. | Check the demo path on a real phone. |
