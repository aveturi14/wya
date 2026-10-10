# wya — Project Plan

_Last updated: 2026-10-10_

## The idea

Hosts over-prepare for guests who cancel at the last minute. Someone invites 30 people, buys food for 30, and 10 show up.

**wya makes an RSVP mean something.** Guests who say "Going" put down a small deposit that the host sets. If they show up, they pay nothing. If they no-show without an excuse the host accepts, the deposit goes to the host to cover the wasted prep.

The event page is also the single place for everything about the event: details, directions, guest list, chat and, later, a shared photo album.

## Decisions so far

| Topic | Decision |
|---|---|
| Charging model | Save the guest's card when they RSVP (Stripe SetupIntent). **Charge only no-shows**, after the event. Never charge-then-refund, because Stripe keeps its fee on refunds. |
| Host payouts | **Stripe Connect Express, onboarded only when needed.** Hosts create paid events with zero payment setup. Onboarding happens only once a host is actually owed money ("You've got $15 from 3 no-shows — claim it"). |
| Attendance | **Both:** guest self check-in (QR code at the door and/or location) **plus** host confirmation. A guest who checked in can never be charged. |
| Cancellation cutoff | **Set by the host per event.** Cancelling before the cutoff is free; after the cutoff, or not showing up, gets charged. |
| "Maybe" RSVPs | No deposit. Must become Yes or No by the cutoff; **unresolved maybes automatically become No.** Send push notifications nudging them before the cutoff. |
| Excuses | The guest submits a reason → the host accepts or rejects → the charge runs only after a review window. |
| Where money logic runs | Server-side only: Supabase Edge Functions + Stripe webhooks. Stripe secret keys never go in the app or in any tracked file. |
| Platform cut | wya takes a cut. **Amount and structure still to be decided with the collaborator.** See "Fee notes" below. |

## Environments

- **Production Supabase:** `nackffabsuzameyrpuks`, owned by the collaborator's account.
- **Dev Supabase:** `wya-dev` (`gvfcjxldokhodgnmmqar`), for building and testing. The local app points at it through `.env.local`, which git ignores and which takes priority over `.env`. Delete `.env.local` to point back at production.
- **Schema changes** live in `supabase/migrations/`. They're applied to dev first, then reviewed and applied to production with `supabase db push`.

## Phases

| Phase | Goal | Status |
|---|---|---|
| **0. Foundation** | Save the current work safely, fix the chat bug, make dev match production, smoke-test | **Planned (below)** |
| 1. Fixes and security | Lock down who can read data, fix photo uploads, sign-up race, back button, web alerts | Outlined |
| 2. Host basics | Guest list, edit/delete events, saving invites when opened, shareable web links | Outlined |
| 3. Deposits | Stripe Connect, deposits, check-in, excuses, charging no-shows | Outlined |
| 4. Shared album | Guests upload event photos into one gallery | Outlined |

---

## Phase 0 — Foundation (detailed)

**Goal:** get the code saved safely on a branch, working, and checked against a dev database that matches production, so Phases 1–4 can build on it. **No new features, and no production changes.**

### 0.1 Branch
- `main` is level with `origin/main` as of 2026-10-10.
- Create the branch `fix/foundation` from `main`. Everything in Phase 0 lands there and goes up as a PR for the collaborator to review.

### 0.2 Repo hygiene
- [ ] Commit the updated `.gitignore`, which already adds `.expo/`, `.env*.local` and `.DS_Store`.
- [ ] Stop tracking `.expo/` with `git rm -r --cached .expo`. Local files stay; Expo regenerates them anyway.
- [ ] **`.env` stays tracked for now.** It holds only publishable keys, so nothing secret is exposed. But if we untracked it, the file would be **deleted from the collaborator's machine on their next pull**. Plan: add `.env.example`, and untrack `.env` only after telling the collaborator.

### 0.3 Fix the chat bug in the uncommitted work
The new chat query `select('*, profile:profiles(*)')` fails, as confirmed on wya-dev:
`PGRST200: Could not find a relationship between 'chat_messages' and 'profiles'`.
The cause: `chat_messages.user_id` points at `auth.users`, not at `profiles`, so Supabase can't join the two.

- [ ] **Fix:** a migration that adds a second link from `chat_messages.user_id` and `rsvps.user_id` to `profiles(id)`. The existing links to `auth.users` stay. This also unlocks the Phase 2 guest list (RSVPs joined with names).
  - Before adding the links, the migration checks for chat messages or RSVPs whose user has no profile row; adding a link fails if any exist.
  - **Production impact:** chat in production stays broken until the collaborator applies this migration. So the migration and the app change must ship together.
- [ ] Turn on live updates for chat with `alter publication supabase_realtime add table chat_messages`. It's off on dev, and production probably has it switched on by hand (see 0.5).

### 0.4 Review the rest of the uncommitted work

| Change | Verdict |
|---|---|
| Sessions stored in SecureStore, split into chunks | Keep. Side effects: everyone currently logged in gets logged out once. It's a new native module, so the iOS build has to be rebuilt (`npx expo run:ios`). |
| `fetchWithRetry` | **Narrow it.** It currently retries every request, including inserts, which could send a chat message or RSVP twice, or a payment request twice once Phase 3 exists. Only retry `GET`/`HEAD` requests. |
| Profile fetch retry in `useAuth` | Keep for now as a stopgap. Phase 1 replaces it by fixing the sign-up trigger. |
| Sign out confirmation on web | Keep. |
| `react-native-worklets` 0.9.1 → 0.8.3 | Keep. `expo install --check` doesn't complain about it, so it's the version SDK 56 expects. |

- [ ] Update the outdated Expo packages with `npx expo install --fix`. About 15 are behind on patch versions, including `expo`, `expo-router` and `react-native-screens`.
- [ ] Add a `"typecheck": "tsc --noEmit"` script to `package.json`. Typecheck currently passes.

### 0.5 Make dev match production
Our migrations assume `lib/database.sql` is exactly what production has. That's probably not quite true; live chat updates are one known gap.

The collaborator isn't available right now, so we don't wait for a production export:
- [x] **Every migration is defensive.** It checks before changing anything (`if not exists`, backfills before adding links), so it's safe to run on production whatever state it's in.
- [ ] The collaborator checks the assumptions when reviewing the PR, before applying anything to production. Later, a `supabase db dump --schema-only` of production would let us fold any differences into the baseline.
- [x] Add `supabase/seed.sql` with dev test accounts (`host@wya.test`, `guest@wya.test`), one sample event, an RSVP and a chat message. Already applied to wya-dev.
- [ ] Turn off email confirmation on wya-dev (Dashboard → Authentication → Sign In / Providers → Email), so test sign-ups through the app work immediately.

### 0.6 Smoke test (web + iOS simulator, against wya-dev)
Run the whole flow once and write down anything broken as new Phase 1 items:
1. Register a host → profile shows their name and phone.
2. Create an event with a cover photo and venue photos → the images actually display, and aren't 0-byte files.
3. Share the invite link → open it in a second browser while logged out → register as a guest → land on the event.
4. Guest RSVPs Going, with notes → the host sees the counts.
5. Chat both ways, and messages show up live without refreshing.
6. Change the avatar twice. The second time is expected to fail (missing storage rule).
7. Sign out and back in. The session survives an app restart.

### 0.7 Ship
- [ ] Small, logical commits: hygiene; dependency updates; chat fix + migration; review fixes; this plan.
- [ ] Push `fix/foundation` and open a PR for the collaborator. That needs `gh auth login` to be done first.
- [ ] In the PR description, list the **production steps**: apply the new migrations, confirm realtime is on, and tell the collaborator about `.env`.

### Phase 0 is done when
- `fix/foundation` is pushed, typecheck passes, and the PR is open.
- Chat works on wya-dev, including live updates.
- The smoke test has been run, and its findings are written into Phase 1.
- The collaborator has the production steps and has been asked for the production schema export.

### Questions for the collaborator
1. Export of the production schema (0.5).
2. OK to untrack `.env` and switch to `.env.example`?
3. Invite the user to the Supabase organization so they can deploy themselves.
4. Platform cut (see Fee notes).

---

## Phase 1 — Fixes and security (outline)
- **Data access:** events are currently readable by anyone, including people who aren't logged in, *along with their invite codes*. Change this so only the host and people who RSVP'd can read an event, and add a server-side lookup that turns an invite code into its event. Use the existing `is_private` column or drop it.
- **Storage:** limit `event-images` uploads to the uploader's own folder; add update/delete rules for avatars (re-uploading an avatar fails silently today).
- **Uploads:** upload photos as ArrayBuffers instead of `fetch(uri).blob()`, which can produce 0-byte files on React Native. Fix content types: `image/jpg` and `image/heic` aren't valid.
- **Sign-up:** the database trigger copies `phone`; remove the profile write from the register screen and the retry hack in `useAuth`. Handle the "check your email" state when email confirmation is on.
- **Navigation:** when there's no screen to go back to (e.g. after opening an invite link), the back button goes home instead of doing nothing.
- **Web:** add a cross-platform alert/confirm helper, because `Alert.alert` does nothing in a browser.
- Plus anything the Phase 0 smoke test turns up.

## Phase 2 — Host basics (outline)
- A guest list for the host: names, RSVP status and guests' notes.
- Edit and delete events, plus an end-time field.
- Save an "invited" record as soon as someone opens an invite link, so the event shows up on their home screen.
- Shareable web links: host the web build, add iOS universal links, and let guests RSVP in the browser without installing the app.
- Show RSVP "No" correctly on the home screen; it currently says "Invited".

## Phase 3 — Deposits (outline)
- Event settings: deposit amount (minimum TBD, probably $5) and the cancellation cutoff.
- RSVP Going → save a card (SetupIntent; Stripe Link for speed).
- Turning maybes into Yes or No: push notifications before the cutoff, and automatically setting them to No at the cutoff.
- Check-in: a QR code shown by the host and scanned by the guest, and/or location; the host confirms attendance afterwards.
- Excuses: the guest submits a reason → the host accepts or rejects.
- Settlement (Edge Function, scheduled): after the review window, charge no-shows into the platform's Stripe balance.
- Host claim: lazy Connect Express onboarding → transfer → payout. **Still to check in Stripe's docs: how long money can sit in the platform balance before it's transferred to the host.**
- Webhooks for payment failures, disputes and finished onboarding.

## Phase 4 — Shared album (outline)
- An event photo gallery that attendees can upload to, plus storage rules and moderation by the host.

---

## Fee notes (for discussion)

Stripe's current pricing ([Connect pricing](https://stripe.com/connect/pricing)):
- Card charge: 2.9% + 30¢.
- Connect Express: **$2 per host in each month they receive a payout**, plus 0.25% + 25¢ per payout.

**Example:** 3 no-shows × $5 = $15. Card fees ≈ $1.34, payout ≈ $0.29, account fee $2.00 → **≈ $3.63 (24%)** goes to Stripe.

Ideas to consider:
- A minimum deposit of about $5; a $2 deposit loses 18% to the card fee alone.
- The no-show pays a service fee on top of the deposit, which is the platform's cut. The host receives the full deposit.
- Pay hosts in batches (monthly, or once their balance is over a threshold) so the fixed fees are paid less often.
- Open problem: hosts with only 1–2 no-shows a month make us lose money on the $2 account fee. Options are a payout threshold or a small fee when the host withdraws.
