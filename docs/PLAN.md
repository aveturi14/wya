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

_Updated 2026-10-10: the original production project (`nackffabsuzameyrpuks`, on the collaborator's account) may have been deleted or paused. Nothing is lost: the app had no real users, and the full schema lives in `supabase/migrations/`._

- **One Supabase project for now: `wya-dev`** (`gvfcjxldokhodgnmmqar`, the user's account, us-east-1). The shared `.env` points at it, so everyone who pulls gets a working app. It's already running every migration up to Phase 1.
- **Access:** the collaborator should be invited to the user's Supabase organization (Organization Settings → Team).
- **Production comes later:** close to launch, create a production project in an organization **both** of you belong to, apply `supabase/migrations/` in order, and point the release build at it. That way no single personal account can take the app down. (The free plan usually allows two active projects; the user already has two, so this may need an upgrade or pausing one.)
- **Schema changes** still go in `supabase/migrations/` and get applied to `wya-dev` as they're written.
- `supabase/seed.sql` and `supabase/tests/rls_check.py` are for `wya-dev` only. The test script refuses to run against any other project.

## Phases

| Phase | Goal | Status |
|---|---|---|
| **0. Foundation** | Save the current work safely, fix the chat bug, make dev match production, smoke-test | Done (iOS test pending Xcode) |
| 1. Fixes and security | Lock down who can read data, fix photo uploads, sign-up race, back button, web alerts | Done on web (iOS test pending Xcode) |
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

**Web results (2026-10-10, against wya-dev):**

| Flow | Result |
|---|---|
| Log in as host / guest | ✅ |
| Home lists hosted and RSVP'd events with the right badges | ✅ |
| Event details and RSVP counts | ✅ |
| Chat: send from the app, receive live with sender names | ✅ (after the 0.3 migration) |
| Create event (without photos) | ✅ |
| Guest RSVP Maybe → shows on their home screen | ✅ |
| Invite link while logged out → invite screen | ✅ |
| **Sign-up** | ❌ → **fixed.** The trigger failed with `relation "profiles" does not exist` because the auth service uses a different search_path. Fixed in migration `20261010000100`. Production must already differ here, or nobody could register there; the collaborator should confirm. |
| Back arrow on a page opened directly by URL | ❌ does nothing (`GO_BACK not handled`), as expected; Phase 1 |
| Sign-up through an invite link (after turning off "Confirm email" on wya-dev) | ✅ lands on the invited event; profile has name and phone |
| Avatar upload, changed twice | ⚠️ uploads and displays, but see the file-name bug below |
| Event cover + 2 venue photos | ⚠️ upload real PNGs and display, same file-name bug |
| iOS simulator | ⏸ blocked: this Mac has no full Xcode install (only the command-line tools) |

**File-name bug (web):** upload code takes the extension from `uri.split('.').pop()`. On web the URI is a `blob:http://localhost:8081/<uuid>` address, so files are stored as e.g. `avatars/<id>/avatar.blob:http:/localhost:8081/<uuid>`. Uploads still work, but every avatar change creates a new file (the old ones are never replaced), and the content type sent is `image/blob:…`. Fix in Phase 1: take the extension and content type from the picked asset's `mimeType`/`fileName`, not from the URI.

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
1. ~~Export of the production schema (0.5)~~. Moot if the old project is gone.
2. OK to untrack `.env` and switch to `.env.example`?
3. ~~Invite the user to the Supabase organization~~. Replaced by: the user invites the collaborator to theirs (see Environments).
4. Platform cut (see Fee notes).

---

## Phase 1 — Fixes and security (detailed)

**Goal:** before any money is involved, make sure people can only see and change what they should, and that the basic flows (sign-up, invites, uploads, navigation, errors) work properly on both web and iOS. **No new features**, except an "invited" RSVP state, which the security fix needs anyway (see 1.1).

### 1.1 Who can see what (database security)

Today: anyone, **even without logging in**, can list every event with its invite code, and every user's name and **phone number**. Any logged-in user can open any event by its URL and RSVP.

**New rule: you can see an event only if you host it, or you've opened its invite link.**

| Table | Read | Write |
|---|---|---|
| `events` | The host, and anyone with an RSVP row (including "invited") | The host only (unchanged) |
| `rsvps` | Your own RSVP; the host sees everyone's for their event | Update **your own** only. No direct inserts: you get a row by accepting an invite (below) |
| `chat_messages` | Unchanged: the host + Going/Maybe guests | Unchanged |
| `profiles` | Yourself, plus people you share an event with (host ↔ guests, guest ↔ guest). **No longer public** | Yourself only (unchanged) |

**How invites work after this:**
1. `get_invite_preview(code)`: works without logging in, and returns only what the invite screen needs: the event title, date, host name and cover photo. It never returns the address or the full event.
2. `accept_invite(code)`: for logged-in users. It creates an RSVP with the new status **`invited`** (or keeps an existing one) and returns the event ID. From then on the event is visible to that user.
3. The invite screen calls (1) to show "Hannah invited you to *Seed Dinner Party*". Once the user is logged in, it calls (2) and opens the event.

**Re-sharing invite links (decided 2026-10-10):** the host chooses per event whether guests may re-share the invite link (**"Let guests share the invite link"**, on by default).
- Security rules work per row, not per column, so a guest who can read the event could always read an `invite_code` column on it. So invite codes move to their own table, **`event_invites`**, which only the host can read. A new event gets its code automatically.
- `get_invite_code(event_id)` returns the code to the host always, to guests only when re-sharing is on, and otherwise nothing. The share button is hidden when there's no code.
- New column `events.allow_guest_invites` (default on). Set on the create screen. Changing it later comes with "edit event" in Phase 2.
- `events.invite_code` is dropped after its codes are copied over (the app isn't live yet, so nothing depends on it).

**Technical notes:**
- RSVP rows can't be moved: guests may update only `status` and `additional_details` (column-level permission). Otherwise a guest could change their row's `event_id` and gain access to another event.
- Storage "view" rules are narrowed to your own folder. Public photo links keep working without them, and this stops anyone from *listing* every uploaded file (today anyone can enumerate all photos, including private events').
- Add `invited` to the allowed RSVP statuses. It counts as neither Going nor Maybe, so no chat access, and it already shows as "Invited" on the home screen. This pulls part of Phase 2's "save invites when opened" into this phase.
- **Rule loops:** the new `events` rule checks `rsvps`, and the `rsvps` rule checks `events`. Postgres rejects that with *"infinite recursion detected in policy"*. To avoid it, the checks go through small helper functions (`is_event_host(event_id)`, `is_event_guest(event_id)`, `shares_event_with(user_id)`) that run with elevated rights and a fixed `search_path`.
- Logged-out visitors get no direct table access at all; only `get_invite_preview`.
- `is_private` is left alone (unused). After this change every event is effectively private, so the column can be dropped later.
- Every migration checks before changing anything, as in Phase 0.

### 1.2 Storage rules
- `event-images`: you can upload, replace or delete only inside your own folder (`covers/<your id>/…`, `venues/<your id>/…`). Today any logged-in user can write anywhere in the bucket.
- `avatars`: add **update** and **delete** rules for your own folder. Replacing an existing avatar needs the update rule, which is missing today, so on iPhone, where the file name is the same every time, changing your avatar fails silently.
- The buckets stay public to read (photos can be viewed by anyone with the exact link, and the links aren't guessable). Making them private would mean signed links everywhere; not worth it yet.

### 1.3 Photo uploads
A shared helper `lib/upload.ts` replaces the two copies of the upload code in `create.tsx` and `account.tsx`:
- **Reads the file correctly on each platform.** On iPhone/Android: `new File(uri).arrayBuffer()` from `expo-file-system` (SDK 56 API, confirmed in the docs; needs `npx expo install expo-file-system`). On web: `fetch(blobUri).arrayBuffer()`. This replaces `fetch(uri).blob()`, which can produce empty files on React Native.
- **The file type comes from the picked image**, not from its address. That fixes the `avatar.blob:http:/…` file names found in Phase 0 and the invalid `image/jpg` type.
- **The avatar is always stored at `<your id>/avatar`** and replaced each time, so no orphaned files pile up. A `?v=<timestamp>` is added to the saved link so phones show the new picture instead of a cached old one.
- **Errors are shown.** Today a failed upload is silently skipped and the event is created without its photos.
- One-off clean-up: delete the orphaned `blob:` test files on wya-dev.

### 1.4 Sign-up and login
- Remove the profile write from the register screen and the retry loop in `useAuth`. The database trigger (fixed in Phase 0) creates the profile with name and phone in the same step as the account, so the profile is always there when sign-up returns.
- If email confirmation is on (likely in production), sign-up returns no session. Today the screen just stops loading and nothing happens. Show "Check your email to confirm your account" instead.
- Keep the invite destination (`returnTo`) when switching between "Create account" and "Sign in". Today it's lost.
- After logging in from an invite, return to `/invite/<code>` instead of `/event/<id>`, so the invite gets accepted (1.1) before the event opens.

### 1.5 Navigation
- Back arrows (event, login, register): go back if there's a previous screen, otherwise go to Home (or to Welcome when logged out). Fixes the `GO_BACK was not handled` dead button.

### 1.6 Messages that work on web
- Add `lib/alert.ts` with `showAlert(title, message)` and `confirmAction(title, message)` (returns true/false). It uses `Alert.alert` on phones and `window.alert` / `window.confirm` on web.
- Use it everywhere `Alert.alert` is used today: create event (missing fields, errors), account (save errors, sign out), event (share errors). The directions picker already has its own web version.

### 1.7 Small fixes
- Event screen: fetch your own RSVP with `.maybeSingle()`, so there's no 406 error when you don't have one. Same for the invite lookup.
- Event screen: RSVPing always **updates** your existing row (created by `accept_invite`) instead of choosing between insert and update.
- Home screen: RSVP "No" shows **"Not going"** instead of "Invited".
- `lib/types.ts`: add `'invited'` to the RSVP status type.

### 1.8 Testing
- **Database rule tests:** a script `supabase/tests/rls_check.sh` that logs in as host, guest, a stranger, and logged-out, and checks what each can read and write: e.g. a stranger gets no events and can't RSVP; logged-out gets only the invite preview; the guest can't see other events' guests or edit the event. It can be re-run after any database change.
- **Web smoke test** again (Phase 0 list plus: invite → accept → event for a new user; stranger opening an event URL gets "Event not found"; avatar changed twice leaves exactly one file).
- **iOS:** run when Xcode is installed; Phase 0's iOS test is still owed too.
- `npm run typecheck` passes.

### 1.9 Shipping
- **The app and the migrations must ship together.** With the new rules, the current app breaks: it inserts RSVPs directly and reads events without an invite. Fine because wya isn't in real users' hands yet (confirmed 2026-10-10).
- Changes are left uncommitted for you, with suggested commit groups and a PR description, the same as Phase 0.

### Results (2026-10-10, web, against wya-dev)
- **Access-control script** (`python3 -I supabase/tests/rls_check.py`): 43 checks pass, and it's safe to re-run.
- **Supabase security advisor:** the only warnings left are the three invite functions (intended) and "leaked password protection" (a dashboard switch; turn it on in production).
- **Web smoke test:**

| Flow | Result |
|---|---|
| Logged-out invite preview shows title, host and date, not the address | ✅ |
| Sign up via invite → back to the invite → accepted → event page | ✅ |
| `returnTo` kept when switching between sign-up and sign-in | ✅ |
| Invited guest: chat locked → RSVP Going → chat unlocked with names | ✅ |
| Stranger opening an event by URL → "Event not found" with a Go Home button | ✅ |
| Back arrow on an event opened directly → Home | ✅ |
| Avatar changed twice → exactly one file (`<id>/avatar`), overwritten, `image/png` | ✅ |
| Event with cover + 2 venue photos → clean names (`covers/<id>/<ts>.png`) | ✅ |
| "Missing fields" alert shows on web | ✅ |
| Re-share switch off → saved; host still sees the share button | ✅ |
| iOS | ⏸ needs Xcode |

**Found and fixed along the way:**
- The "Event not found" screen had no way out → added a Go Home button.
- A blank description was saved as `''`, which made React Native Web log "Unexpected text node". Now saved as `null`, and the event screen guards its optional text fields.

**Noticed, not fixed (Phase 2):** the create form's date defaults to "now", so an event created without changing it immediately shows under "Past". The create form also keeps its old values after you create an event.

### Phase 1 is done when
- A stranger and a logged-out visitor can't see any event, RSVP or phone number, as proven by the rule-test script.
- Invite → sign up → accept → RSVP → chat works end to end on web (and on iOS once Xcode is installed).
- Uploads have proper file names and types, avatar changes replace the old file, and errors are shown.
- Back buttons never get stuck; alerts show on web.

## Phase 2 — Host basics (outline)
- A guest list for the host: names, RSVP status and guests' notes.
- Edit and delete events, plus an end-time field.
- ~~Save an "invited" record when someone opens an invite link~~ (moved into Phase 1.1).
- Create form: default the date to something in the future (e.g. tomorrow 7pm) and clear the form after creating.
- Shareable web links: host the web build, add iOS universal links, and let guests RSVP in the browser without installing the app.

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
