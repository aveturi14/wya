# Stage 1.1: Collect before you book (results)

_Built 2026-10-21 on branch `claude/stage1-1-collect-7bbcd4`, to the plan in `STAGE_1_1_PLAN.md`._

## What was built

**Database: `supabase/migrations/20261021000000_collections.sql`** (re-runnable; applied to wya-dev through the Supabase MCP `apply_migration`, name `collections`)

- `public.collections`: the table from plan §3.1. RLS lets the organiser and event guests select it. Nobody can insert, update or delete it directly. A partial unique index allows one live (`open`/`funded`) collection per event (C-4), so two creates can't race.
- `obligations`: new kind `collect`, reason `collection`, the column `collection_id` with a shape check, plus `confirmed_at`, `refund_requested_at` and `refunded_at`. There's also a unique index on `(collection_id, guest_id)`.
  - A share's states come from these columns: in = `owed`; says paid = `paid` without `confirmed_at`; confirmed = `paid` with `confirmed_at`; disputed = `disputed`; refund due = `refund_requested_at`; refunded = `refunded_at`.
- RPCs: `create_collection`, `get_collection`, `join_collection`, `leave_collection`, `confirm_received`, `mark_refunded`, `go_ahead_anyway`, `mark_booked`, `extend_deadline`, `cancel_collection`, `get_my_collections` and `process_collection_deadlines`. All are `security definer` with `search_path = ''` and check the caller.
  - Funding check (`private.check_collection_funding`): **confirmed** shares only (C-3). A dispute or a refund request before booking moves a collection from funded back to open.
- Existing functions redefined (each copied from its latest version):
  - `claim_paid`: accepts `collect` and keeps refusing `split`.
  - `dispute_payment`: also clears `confirmed_at` and re-checks funding.
  - `pay_from_wallet`: **refuses `collect`** with hint `payid_only`.
  - `submit_excuse` and `waive_obligation`: refuse `collect`.
  - `remove_payid`: refused while you're organising a live collection.
  - `notify_obligation_change`: a join creates no notification; "I've paid" on a collect share becomes `collect_paid`.
  - `get_my_obligations`: adds `collection_id`, `confirmed_at`, `refund_requested_at` and `refunded_at`.
  - `get_my_dues`: leaves collect shares out (see decisions).
  - `get_my_chats`: shows a "💰 Collecting: …" preview.
- `has_open_debt`, `get_reliability`, `waive_all` and `process_pledge_deadlines` already filter on `kind = 'pledge'`, so collect debts never block RSVPs or affect reliability. The tests confirm this.
- Chat card kind `collect`, posted only through `private.post_message`. Eleven notification types are added: the ten in the plan plus `collect_unfunded` (see decisions).
- Reminders are recorded in `private.collection_reminders`, so none repeats:
  - 24 hours and 2 hours before the deadline, to people who are in but haven't paid;
  - one per waiting share, to the organiser, when a payment has been "said paid" for 12 hours or more without being confirmed.
- Cron job `wya-collection-deadlines` runs every 15 minutes. It's unscheduled first, so the migration can be re-run.
- `get_collect_stats()`: only `service_role` can execute it, and it excludes `@wya.test` organisers.

**App**
- `lib/collections.ts`: types, RPC wrappers, `useCollection` (refreshes on focus and live through Realtime on `collections` and `obligations`) and `useMyCollections`.
- `app/collect/[id].tsx`: the full collection page.
  - Everyone sees progress, the deadline, the booking note and the people list with each person's state.
  - Participants get "I'm in, $60" → "Pay Hannah" → "Leave" or "Ask for a refund".
  - The organiser gets "Got it", "Not received" and "Refunded" for each person, plus "Mark as booked", "Go ahead anyway", "Extend deadline" (a sheet) and "Cancel".
  - Signed-out visitors sign in and come back (`returnTo` in `app/_layout.tsx`). People who aren't guests see "Ask the organiser for the invite link".
- `components/collect/CollectForm.tsx`: a sheet with what it's for, amount each, minimum (not counting you), optional maximum, deadline, and where you'll book.
  - Deadline input: `datetime-local` on web; date and time wheels on phones, closed on Done for iOS.
  - Without a PayID, it shows `GetPaidCard` first.
- `components/collect/CollectCard.tsx`: the card on the event page and in the chat. A progress bar shows confirmed money solid and claimed money lighter, with the caller's next action.
- `components/collect/PayIdCard.tsx`: PayID, reference, Copy all and "I've paid". There's no wallet button. (`PayCard` is now wallet-only, so this brings back the old PayID layout for collections.)
- `app/pay/[id].tsx`: a `collect` branch that's PayID only. A share that's been claimed shows "Waiting for Hannah"; after that it shows "Confirmed" or "Refunded". It never says "Paid" for a share that's only claimed.
- Entry points:
  - Event page: the card near the top, and a "Collect money" row in Details for the host and Going guests while no collection is live.
  - Chat: the card for `kind = 'collect'`.
  - Home → Needs you: "Pay Hannah $60 for Karting", "N payments to confirm", "Refund N people", "X is funded" and "Hannah is collecting $60 each".
  - Activity: rows and links for every `collect_*` type.
- `lib/pledges.ts`: `isPledgeDebt` is now `kind === 'pledge'`. It used to be `kind !== 'split'`, which would have shown collect debts as pledges and let them block RSVPs.
- Tests: `supabase/tests/phase8/test_s1_1_collections.py` (`--only S1.1`). `run.py` now picks up `test_*.py`, not just `test_8_*.py`.

## Tests

```
python3 -I supabase/tests/phase8/run.py --only S1.1
✅ pass 93  ❌ fail 0  ⏸ pending 0  🔒 blocked 0  ⏭ skipped 0  ❓ clarify 0
```
This covers every bullet in plan §7.1. That includes a collection that closes 12 seconds after it's created, so expiry runs for real, and calling `process_collection_deadlines()` a second time to show it changes nothing.

`npm run typecheck`: 0 errors.

**Failures that were there before this work (not caused by collections):**
- `python3 -I supabase/tests/rls_check.py`: 3 failures.
  - "the album is closed before the party starts" and "Photos tab: an album that hasn't opened…": the checks expect the album to be closed until the party starts, but `20261019000000_bills_everyone_album_anytime.sql` opened it from creation.
  - "with nothing owed, a host can remove their PayID": Hannah has two unpaid **split** debts from manual testing (on "Aayushs bday bash" and "Seed Dinner Party"). `remove_payid` refuses for those under the old definition too.
- Full `run.py` (all items): 356 pass, 7 fail.
  - 5 in 8.3 and 1 in 8.18 call `claim_paid` on split debts. That's refused since the wallet migration (`wallet_only`), so those tests are out of date.
  - 1 in 8.18 is the receipt scanner answering `scan_failed`.

**Browser** (`wya-web`, seed accounts):
- Hannah opens Collect money on "Seed Dinner Party" and creates "Karting at Kart World", $60 each, minimum 1. She lands on the collect page.
- Gary, signed out, opens the link, signs in and comes back. He taps "I'm in, $60". The pay page shows Hannah's PayID and reference, with no wallet option. He taps "I've paid", and the page shows "Waiting for Hannah".
  - On the event page Gary sees "You've paid. Hannah hasn't confirmed it yet" and "1 in · 0 paid". The chat card renders.
- Hannah's Home shows "1 payment to confirm". The Activity row "Gary says they've paid you $60… Check it arrived" opens the collection.
  - She taps "Got it", and it goes to Funded. She taps "Mark as booked" in wya's confirm dialog, and it goes to Booked.
- Expiry: a second collection, "Escape room (expiry check)", with Gary paid and confirmed, was set up and then its deadline moved into the past with SQL.
  - The first `process_collection_deadlines()` call returned `{"expired": 1}`; the second returned `{"expired": 0}`.
  - Hannah sees "Didn't fill up", Home shows "Refund 1 person", and she taps Refunded.
  - Gary sees "Hannah refunded your $45" and the full Activity trail (started, confirmed, funded, booked, expired, refunded).
- Checked at phone width (375) in light and dark, and at desktop width (1280) in light. The page is a centred 620px column under the top bar.
- Both test collections, their chat card and their notifications were deleted afterwards.

## Not verified
- **iOS simulator**: not run. The native date wheels in `CollectForm` and the "Extend deadline" sheet copy the `EventForm` approach (close on Done), but haven't been tested on a device.
- **Desktop in dark mode**: not checked. Phone dark was checked, and the components only use theme roles.
- **Reminders at real times** (24 h, 2 h, 12 h) haven't been watched end to end in the browser. The test covers the "in but unpaid" reminder going out once. The organiser's 12-hour confirm reminder isn't covered by an automated test, because it needs a claim that's 12 hours old.
- **Realtime on `obligations`**: `obligations` wasn't in the `supabase_realtime` publication. The migration now adds it (RLS still limits rows to the two people on a debt), and it's applied to wya-dev. I didn't watch a live update happen across two browsers.

## Decisions taken (plan §9 defaults, plus these)
- **`collect_unfunded`**: an 11th notification type. The plan says to "tell the organiser" when a dispute un-funds a collection, but none of the listed types fits.
- **Collect shares are left out of `get_my_dues`**: every dues row offers "Pay from your wallet", which collections must never use. They show up on the collect page, the pay page, Needs you and Activity instead.
- **PayID layout**: `PayCard` is wallet-only now (9.13), so the PayID card was rebuilt as `components/collect/PayIdCard.tsx` instead of reused.
- **"Go ahead anyway"** is offered only while the collection is open, below the minimum, with at least one confirmed share.
- **The organiser isn't a participant**: the minimum counts other people ("Not counting you" in the form).
- **No "refund received" confirm for payers**: the plan's RPC table has none. Payers are notified (`collect_refunded`) and can dispute with the organiser outside wya.
- **`refund_requested_at` means "refund due"**: it's set when a payer leaves after paying, and when a collection expires or is cancelled with paid shares.
- **The chat card follows the collection**: `/collect` in the composer wasn't added (optional in the plan).

## Reading the stats (is 1.1 working?)
In the Supabase SQL editor for the project, which runs as `postgres`:
```sql
select jsonb_pretty(public.get_collect_stats());
```
Or with the service-role key: `POST /rest/v1/rpc/get_collect_stats`. It's refused for signed-in users.

| Field | Meaning | 1.1 gate |
|---|---|---|
| `collections` | Collections by real organisers (not `@wya.test`) | **50+** |
| `funded_by_deadline_pct` | Of the collections that have closed or passed their deadline, % funded before the deadline | **60%+** |
| `funded_within_48h_pct`, `median_hours_to_funded` | Speed | most within 48 h |
| `repeat_organisers` / `organisers` | Organisers with 2+ collections | coming back |
| `booked_pct`, `go_ahead_short` | Did they actually book, and how often below the minimum | |
| `avg_joined` vs `avg_min_people` | Joins against the minimum | |
| `joined_who_paid_pct`, `claims_confirmed_pct` | Drop-off between consent, payment and confirmation | |
| `expired`, `cancelled`, `refunds_owed`, `refunds_done`, `by_status` | Failure paths and refunds still outstanding | |

## For the human
1. **Migration**: already applied to wya-dev. For production, apply `20261021000000_collections.sql` in order with the rest.
2. **Git**: suggested commits and PR text are below. Nothing was committed.
3. Optional follow-ups:
   - Update the out-of-date 8.3, 8.18 and `rls_check` album checks.
   - Clear Hannah's two leftover split debts.
   - Run the collect form on the iOS simulator.

### Suggested commits
1. `Collections (stage 1.1): migration, RPCs, cron and stats`: `supabase/migrations/20261021000000_collections.sql`
2. `Collections: database tests`: `supabase/tests/phase8/test_s1_1_collections.py`, `supabase/tests/phase8/run.py`
3. `Collections: collect page, form, card and PayID-only pay page`: `lib/collections.ts`, `app/collect/[id].tsx`, `components/collect/*`, `app/pay/[id].tsx`, `app/_layout.tsx`, `lib/pledges.ts`, `lib/types.ts`
4. `Collections: event page, chat, Needs you and Activity`: `app/event/[id].tsx`, `components/event/EventChat.tsx`, `components/NeedsYou.tsx`, `app/(tabs)/home.tsx`, `lib/notifications.ts`
5. `Docs: stage 1.1 plan and results`: `docs/split-app/*`, `CLAUDE.md`

### PR description
> **Stage 1.1: Collect before you book**
>
> An organiser asks an event's people for a fixed amount each before booking ("$60 each for karting, by Thu 6pm, need 6"). Each person taps **I'm in** (their consent and their debt), pays the organiser **by PayID**, and taps **I've paid**. The organiser taps **Got it** for each payment. Once enough shares are *confirmed*, the collection is **funded**, and the organiser books and marks it **booked**. If the deadline passes first, it **expires**: unpaid shares are dropped and paid ones are flagged for the organiser to refund by hand.
>
> No money moves through wya. Collect debts are never payable from the wallet (`pay_from_wallet` refuses them), never block RSVPs and never touch reliability.
>
> - Migration `20261021000000_collections.sql`: the table, the `collect` kind on obligations, 12 RPCs, a 15-minute cron job, reminders, the chat card, 11 notification types, and `get_collect_stats()` (service role only). Applied to wya-dev.
> - App: `/collect/[id]`, the Collect money sheet, the collect card (event page and chat), a PayID-only branch on `/pay/[id]`, Needs you and Activity.
> - Tests: `run.py --only S1.1` passes 93/93; typecheck is clean. `rls_check.py` has 3 failures and the full `run.py` has 7, all from before this branch (details in `docs/split-app/STAGE_1_1_RESULTS.md`).
> - Checked in the browser with the seed accounts (create → join → pay → confirm → funded → booked; expiry → refund) at phone width in light and dark, and at desktop width.
>
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)


---

# Stage 1.1b: Collection links (results)

_Built 2026-10-21 to `STAGE_1_1_LINKS.md`, with the §9 defaults (L-1 to L-8)._

## What was built
**Database: `supabase/migrations/20261022000000_collection_links.sql`** (re-runnable; applied to wya-dev through the Supabase MCP, name `collection_links`)
- `collections`:
  - new columns `link_code` (unique, 10 characters), `link_enabled` and `standalone`;
  - the per-person limit is now **$1–$200**, both in the constraint and in `create_collection`'s message.
- `events.kind` gains `'collection'`: the hidden event behind a standalone collection.
- `collection_requests`: requested / approved / declined / withdrawn. Clients can only read it, and only their own rows or, for the organiser, every request on their collection. It's in the Realtime publication.
  - The two row-level security policies that refer to each other's tables go through `private.is_collection_organiser` and `private.has_collection_request`, so there's no policy loop.
- Private tables `collection_link_views` (link opens, for the funnel) and `collection_reports`.
- New functions:
  - `create_standalone_collection` (makes the hidden event, then the usual `create_collection` checks);
  - `get_collection_preview` (works signed out; it records a link view);
  - `request_to_join`, `withdraw_request`, `approve_request`, `decline_request`;
  - `set_collection_link` (turn off, back on, or new code);
  - `report_collection`.
- Changed functions:
  - `get_collection`: link, requests, `can_open_event`, `standalone`, `my_request`; anyone with a request or a share can open it;
  - `join_collection`: event guests only;
  - `get_my_collections`: requests, standalone collections, the organiser's count of people waiting;
  - `create_collection`: no chat card or "started" notification for a hidden event.
- Hidden events are kept out of `get_my_chats`, `get_my_albums` and `get_host_record`, and out of Home's event list in the app.
- Notification types added: `collect_requested`, `collect_approved`, `collect_declined`.
- `get_collect_stats()` adds `by_kind` (standalone vs with an event), `link_funnel` (opens → requests → approved → paid → confirmed, plus declined, withdrawn and waiting), `reports` and `collections_reported`.

**App**
- **`app/c/[code].tsx`:** the booking page, which works signed out.
  - It shows the organiser's photo and name first, then what it's for, the amount, deadline and "In so far", and two notes: you pay only once you're let in, and check your bank shows the organiser's name.
  - "I'm in, $60" (signed out) → sign up or sign in → back to `/c/<code>?go=1`, and the request is sent automatically.
  - States: waiting (with withdraw), in, declined, full, closed, link off, bad link. Includes Report.
- **`app/collect/[id].tsx`:**
  - "Asking to join" list with Let in / Decline;
  - a "Link for your group chat" card: Share link, New link, Turn off link / Turn it back on;
  - the requester's waiting, declined and withdrawn states;
  - "Open the event" only for people who can open it.
- **`components/collect/CollectForm.tsx`:** standalone when there's no `eventId`; $200 limit.
- **`app/(tabs)/create.tsx`:** "Just collecting money?" at the top of the + tab (through a new `aside` prop on `EventForm`).
- **`lib/collections.ts`:** the preview type, `collectionLink`, `shareCollection` (share sheet, or clipboard on web), and request and link actions.
- **Home:**
  - a "Collecting" section (organiser, member, requested);
  - Needs you: "N people want in";
  - hidden events are filtered out of the event list.
- **Activity:** rows for the three new types.
- **`PayIdCard`:** "Check your bank shows **Hannah Host** before you send. If it doesn't, don't pay."
- **`CollectCard`:** "N people want in" as the organiser's action.
- **`app/_layout.tsx`:** `/c/...` opens signed out, like `/invite/...`.

## Tests
```
python3 -I supabase/tests/phase8/run.py --only S1.1b
✅ pass 53  ❌ fail 0  ⏸ pending 0  🔒 blocked 0  ⏭ skipped 0  ❓ clarify 0
python3 -I supabase/tests/phase8/run.py --only S1.1     → 93 pass, 0 fail (still green)
python3 -I supabase/tests/rls_check.py                  → the same 3 failures as before (album ×2, Hannah's leftover split debts); nothing new
```
`npm run typecheck`: 0 errors.

**Browser** (the `wya-web` dev server, seed accounts):
- Hannah: the + tab → "Just collecting money?" → $60, minimum 1, maximum 4 → lands on the collection with its link.
- Sam, signed out, opens `localhost:8081/c/<code>` and sees the booking page with no PayID. He taps "I already have an account", signs in, and comes back with the request sent: "Waiting for Hannah to let you in".
  - Report → confirm → "Thanks". His Home lists the collection under Collecting.
- Hannah's Home shows "1 person wants in", and the hidden event is not in her event list. Review → Let in.
- Sam's Activity shows "Hannah let you in on Karting…". Pay Hannah → the PayID card with the bank-name check → I've paid → "Waiting for Hannah".
- Checked at phone width (375) in dark (the seed account's app theme) and light, and the booking page at desktop width (1280) in light.
- Test data was deleted afterwards.

**Fixed after the browser check:**
- "Karting at Kart World for Karting at Kart World" on the pay card for standalone collections;
- the "Collecting" label repeating the status chip;
- the request row's subtitle getting cut off;
- the link card now sits above the organiser's other tools.

## Not verified
- Signing up as a **brand-new account** from the link. Tested with an existing account; sign-up uses the same `returnTo`.
- **Share link** on a phone (native share sheet), and on a desktop browser without `navigator.share`, where it copies to the clipboard. On the hosted site the link points at `EXPO_PUBLIC_WEB_URL` (wya.expo.app), which doesn't have this code until it's deployed.
- The **iOS simulator**.
- Desktop in dark mode for the new pages.

## Reading the new stats
`select jsonb_pretty(public.get_collect_stats());` now also gives:
- `by_kind`: is standalone or with-an-event used more, and which gets funded;
- `link_funnel`: where people drop off. A big gap between `opens` and `requests` is the case for email-code sign-in (`STAGE_1_1_LINKS.md` §10);
- `reports` and `collections_reported`.

### Suggested commit for this part
`Collection links (1.1b): share links with approval, standalone collections, $200 cap, reports, funnel stats`, covering:
- `supabase/migrations/20261022000000_collection_links.sql` and `supabase/tests/phase8/test_s1_1b_collection_links.py`;
- `app/c/[code].tsx`, `app/collect/[id].tsx`, `app/(tabs)/create.tsx`, `app/(tabs)/home.tsx`, `app/_layout.tsx`, `app/pay/[id].tsx`;
- `components/collect/*`, `components/EventForm.tsx`;
- `lib/collections.ts`, `lib/notifications.ts`, `lib/types.ts`;
- `docs/split-app/STAGE_1_1_LINKS.md`, `docs/split-app/STAGE_1_1_RESULTS.md`, `CLAUDE.md`.
