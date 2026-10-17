# wya — Project Plan

_Last updated: 2026-10-12 (Phase 5 handoff; see docs/PHASE5.md, docs/FEATURES.md and CLAUDE.md)_

## The idea

Hosts over-prepare for guests who cancel at the last minute. Someone invites 30 people, buys food for 30, and 10 show up.

**wya makes an RSVP mean something.** Guests who say "Going" put down a small deposit that the host sets. If they show up, they pay nothing. If they no-show without an excuse the host accepts, the deposit goes to the host to cover the wasted prep.

The event page is also the single place for everything about the event: details, directions, guest list, chat and, later, a shared photo album.

## Decisions so far

> **2026-10-11: payments pivot.** Phase 3 now builds **pledges** (option B): no money goes through wya; flakes pay the host directly with **PayID** (Australia first). The Stripe rows below (charging model, host payouts, where money logic runs, platform cut) describe the **later, optional card-payment upgrade** and are not what Phase 3 builds. Product-level decisions, option A, and the business model live in **`docs/FEATURES.md`**.

| Topic | Decision |
|---|---|
| Charging model | Save the guest's card when they RSVP (Stripe SetupIntent). **Charge only no-shows**, after the event. Never charge-then-refund, because Stripe keeps its fee on refunds. |
| Host payouts | **Stripe Connect Express, onboarded only when needed.** Hosts create paid events with zero payment setup. Onboarding happens only once a host is actually owed money ("You've got $15 from 3 no-shows — claim it"). |
| Attendance | **Both:** guest self check-in (QR code at the door and/or location) **plus** host confirmation. A guest who checked in can never be charged. |
| Cancellation cutoff | **Set by the host per event.** Cancelling before the cutoff is free; after the cutoff, or not showing up, gets charged. |
| "Maybe" RSVPs | No deposit. Must become Yes or No by the cutoff; **unresolved maybes automatically become No.** Send push notifications nudging them before the cutoff. |
| Excuses | The guest submits a reason → the host accepts or rejects → the charge runs only after a review window. |
| Where money logic runs | Server-side only: Supabase Edge Functions + Stripe webhooks. Stripe secret keys never go in the app or in any tracked file. |
| Platform cut | ~~wya takes a cut of deposits~~ Not possible with pledges (wya never touches the money). **Stay free while proving pledges work**; revenue options are in `docs/FEATURES.md` → Business model. |

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
| **0. Foundation** | Save the current work safely, fix the chat bug, make dev match production, smoke-test | ✅ Merged (PR 2) |
| 1. Fixes and security | Lock down who can read data, fix photo uploads, sign-up race, back button, web alerts | ✅ Merged (PR 3) |
| 2. Host basics | Guest list, edit/delete events, create-form fixes, invite links anyone can open | ✅ Merged (PR 4), live on wya.expo.app |
| Design refresh | Light (Soft pop) and dark (After dark) themes, component kit, motion, event themes, website polish, link previews | ✅ Merged (PR 5) |
| R.9 Desktop + nav | Sidebar on desktop, desktop layouts, Chats tab, Activity tab | ✅ Merged (PR 6) |
| 3. Pledges | Going = a $5 pledge; flakes pay the host via PayID; excuses; reliability record; Maybes auto-resolve | ✅ Merged (PR 10) |
| 4. Shared album | Guests upload event photos into one gallery | ✅ Merged (PR 11) |
| 5. Native (iOS + Android) | SDK 57, generated native folders, run on simulators and real phones, fix what breaks | iOS simulator + real iPhone done; Android still to do (`docs/PHASE5.md`) |
| 6. Polish | Floating nav, Hosting/Invited, address gating, chat images | ✅ Merged (PRs 13, 14); `docs/PHASE6.md` |
| 7. Phone UI | Overlay tab bar, TabScreen, Photos tab, Activity behind a bell, Needs-you cards | ✅ Merged (PR 15); `docs/PHASE7.md` |
| **8. Smart coordination** | Polls, slash commands, invite limits, bill splitting, check-in, open events, the `@wya` assistant, push, widgets | **In progress on `phase8a-core`: 8.0–8.2 built and applied to wya-dev; 8.3–8.17 planned. Plan, contracts, secrets and status in `docs/PHASE8.md`** |
| **Glow redesign** | The design board's look across the app, and a dashboard Home | **On `phase8a-core`: web checked (desktop light/dark, phone light); phones and the marketing site still to do** |

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

## Phase 2 — Host basics (detailed)

**Goal:** give hosts what they need to run an event (who's coming, editing, cancelling), and make invite links work for **anyone**, including people without the app. This is the groundwork Phase 3's deposits depend on: a host needs an accurate guest list, and a guest needs to be able to RSVP from a link.

### 2.1 Guest list
- **Host view** (event screen, replacing today's three counters): everyone who opened the invite, grouped **Going / Maybe / Not going / Invited (no answer yet)**, with name, avatar and the notes they wrote ("Vegetarian, +1"). The counts stay at the top.
- **Guest view:** guests see *who's going*: names, avatars, Going/Maybe. **Never** other guests' notes or phone numbers.
- Database: a `get_guest_list(event_id)` function returns the full list to the host and the reduced list to guests. Security rules can't hide individual columns (notes) per viewer, so this goes through a function, like the invite code did. The access-control script gets new checks: guests never receive notes, strangers get nothing.
- **Host can remove a guest:** deletes their RSVP, so they lose access to the event and chat. Useful when a link spreads further than intended. Database: `remove_guest(event_id, user_id)`, host only.

### 2.2 Edit and delete events
- **Edit:** a new screen `app/event/edit/[id].tsx` (host only), reached from a pencil button on the event. It **reuses the create form**: one shared `components/EventForm.tsx` used by both screens, so the two can't drift apart. Everything is editable, including photos (add/remove) and the "Let guests share the invite link" switch.
- **Delete:** in the edit screen, behind a confirm ("Delete *Seed Dinner Party*? Guests will lose access. This can't be undone."). It deletes the event (RSVPs, chat and invite code go with it automatically) and its photos from storage.
- **Later (Phase 3):** once deposits exist, deleting an event with deposits held needs rules ("cancel" releases everyone's card holds). Delete stays a plain delete until then.

### 2.3 Create-form fixes
- Date defaults to **tomorrow at 7:00 PM** instead of "now" (which made new events land under "Past").
- Add an optional **end time**. The event screen already shows it if set; there was just no way to enter it.
- Reset the form after creating, so going back to Create starts fresh (today it keeps the old values, which invites accidental duplicates).

### 2.4 Invite links anyone can open
Today the share button produces `wya://invite/…` on a phone (only opens if the app is installed) or `localhost:…` in development. Neither works when texted to a friend.

- **Host the web app with EAS Hosting** (Expo's hosting; free plan; SDK 56 docs checked). Set `web.output: "single"` in `app.json`, then `npx expo export --platform web` and `eas deploy`. That gives a permanent address like **`https://wya.expo.app`** (if the name is free). A custom domain like `wya.app` needs a paid Expo plan, which can come later.
- **Invite links always use the web address:** `https://wya.expo.app/invite/<code>`, built from a new `EXPO_PUBLIC_WEB_URL` setting instead of `Linking.createURL`. A guest without the app taps it → the web app opens → preview, sign up, RSVP, chat, all in the browser.
- **Supabase auth settings:** set the Site URL and redirect URLs to the hosted address, so confirmation emails link back to the app instead of `localhost`.
- **Opening the link straight in the iPhone app** ("universal links") needs an **Apple Developer account** ($99/year), a file published at `/.well-known/apple-app-site-association`, and an EAS/dev build on a real iPhone, not the simulator. **Deferred to the App Store launch phase** (no Apple Developer account yet). Until then, links open in the browser for everyone, which already works without the app.
- **Who does what:** `eas login` and choosing the subdomain need *your* Expo account, so you run those two commands. I prepare everything else and the deploy script.

### 2.5 Small cleanups
- Drop the unused `events.is_private` column (every event has been private since Phase 1).
- Share text: "Hannah invited you to *Seed Dinner Party* on Sat, Oct 17: https://wya.expo.app/invite/…"

### 2.6 Testing
- Access-control script: new checks for `get_guest_list` (host sees notes; guests don't; strangers get nothing) and `remove_guest` (host only; the removed guest loses access).
- Web smoke test on `wya-dev`: guest list (host and guest views), edit every field, delete (event and photos gone), create-form defaults and reset.
- **On the deployed site:** open an invite link in a fresh browser session (logged out) → sign up → RSVP → chat. This is the real end-to-end test of "anyone can open it".
- iOS: still waiting on Xcode.

### Results so far (2026-10-10, local web against wya-dev)
- **Access-control script:** 57 checks pass (14 new: guest list visibility, removing guests, deleting events).
- **Removed guests can't rejoin** through the invite link: a new `event_removed_guests` table, checked by `accept_invite`. Without it, removal would have been pointless while the guest still had the link.

| Flow | Result |
|---|---|
| Host guest list: counts, grouped, notes, "No answer yet" | ✅ |
| Guest view: "Who's going", no notes, no edit button | ✅ |
| Remove guest → confirm → list and counts update | ✅ |
| Share link is `https://wya.expo.app/invite/<code>` with "Hannah invited you to …" | ✅ |
| Edit: pre-filled, change title + end time → event page shows the update | ✅ |
| Edit: remove a venue photo → file deleted from storage | ✅ |
| Delete event → confirm → event, invite code and photos gone; back to Home | ✅ |
| Create form defaults to tomorrow 7 PM, clears after creating | ✅ |
| `npx expo export --platform web` builds | ✅ |
| Deployed to **https://wya.expo.app** (user ran `eas login` + `npm run deploy:web`) | ✅ |
| Hosted: invite link opened directly while logged out → preview (no address) | ✅ |
| Hosted: Create Account keeps `returnTo=/invite/…`; `/event/<id>` logged out → Welcome; bad invite code → "Invalid Invite" | ✅ |
| Hosted: sign up → accept → RSVP → chat | ⏳ for the user to run (Claude may only enter credentials on localhost) |
| iOS | ⏸ needs Xcode |

**Found on the hosted site and fixed:** a logged-out visit to `/event/<id>` briefly ran the event queries before redirecting, logging two 401 errors. The event screen now waits for a logged-in user. Verified locally; **needs a redeploy** to reach wya.expo.app.

**Note for the App Store phase:** linking the EAS project added Android permissions to `app.json`, including `RECORD_AUDIO` (from the image picker's video support, which wya doesn't use). Remove it or set the image-picker plugin's `microphonePermission: false` before publishing.

### Phase 2 is done when
- The host sees a grouped guest list with notes; guests see only who's going (if approved).
- Hosts can edit and delete events; the create form has sane defaults and resets.
- An invite link texted to someone without the app works end to end on the hosted site.
- The access-control script passes with the new checks.

### Decisions (2026-10-10)
1. Guests **see who's going** (names and avatars only). ✅
2. Hosts **can remove a guest**. ✅
3. **No Apple Developer account** → universal links deferred to the App Store launch phase.
4. Web address: **`wya.expo.app`** (Expo account created by the user).

## Design refresh (planned 2026-10-10, before Phase 3)

**Goal:** wya should look like something people *want* to send to their friends. Planning an event is an aesthetic act now, and the invite is the first thing every guest sees. The current look (near-black, one purple accent, soft glows, a classic serif) is tidy but forgettable. Doing this before Phase 3 means the deposit screens get built in the new style instead of being restyled later.

**Direction (decided 2026-10-10): a mix of A and B.**
- **Dark theme = A · After dark:** near-black, electric lime (`#D4FF3F`), hot pink (`#FF3CAC`), hairline borders, huge bold type, tilted sticker badges.
- **Light theme = B · Soft pop:** cream (`#FFF6EC`), violet (`#8B5CFF`), tangerine (`#FF6A3D`), sunshine (`#FFE15C`), chunky 2px ink outlines.
- Same layout, shapes, type and motion in both; only the palette and outline weight change. Follows the phone or browser setting, with a **Light / Dark / System** choice in Account.
- Fonts (both themes): **Bricolage Grotesque** ExtraBold for display and headings, **DM Sans** for everything else.
- **Event themes are in scope** (R.6 is no longer a stretch), and **the website gets its own attention** (R.8).

**How it's built:**
- `constants/theme.ts` holds both palettes as the *same* set of named roles (background, surface, text, primary, onPrimary, highlight, outline, …), plus shared type, spacing and radius scales.
- A `ThemeProvider` (in `hooks/useTheme.tsx`) resolves system / light / dark, saves the user's choice, and exposes the current theme.
- Screens switch from fixed `StyleSheet.create` styles to a small `makeStyles((theme) => …)` hook, cached per theme, so every screen restyles itself when the theme changes.
- `app.json`: `userInterfaceStyle: "automatic"`; add `expo-system-ui` (needed for Android, per the SDK 56 docs).

### R.1 Design system
- Rewrite `constants/colors.ts`, `fonts.ts`, `typography.ts` around the chosen direction, plus new spacing, radius and shadow scales, so screens stop hard-coding numbers.
- New fonts through the `@expo-google-fonts/*` packages (check the SDK 56 font docs first). Replaces Cormorant Garamond / Raleway and their `.ttf` files.
- Light or dark per the direction (`userInterfaceStyle` in `app.json`, status bar).

### R.2 Component kit (`components/ui/`)
Button (primary / secondary / ghost), Card, Badge / "sticker", AvatarStack ("Gary, Jo + 6"), TextField, SegmentedControl (Details / Chat, Upcoming / Past), ScreenHeader, EmptyState. Every screen is rebuilt from these, so the look stays consistent and Phase 3 screens come out right automatically.

### R.3 Motion and feel
- Buttons shrink slightly when pressed; cards slide in one after another; smooth tab switches (`react-native-reanimated`, already installed).
- **Haptics** on RSVP and other key taps (`expo-haptics`).
- **A celebration moment when you RSVP Going**: a confetti or sticker burst. A small reward for committing, which fits wya's whole idea.
- **Cover art for events without a photo:** a bold generated pattern or color block per event instead of a blank calendar icon.

### R.4 Screens, in priority order
1. **Invite preview**, the first screen every guest sees and the one that sells wya. Big cover, who's hosting, who's going, one clear call to action.
2. **Event page**: full-width cover hero, avatar stack, an RSVP bar that stays on screen, restyled guest list and chat.
3. **Home**: big, colorful event cards, with Upcoming / Past as a segmented control.
4. **Welcome / sign-in / sign-up**: a strong first impression.
5. **Create / edit**: the form split into friendly sections (Basics, When and where, Details, Photos, Settings).
6. **Account** and the tab bar.

### R.5 Link previews
When an invite link is pasted into iMessage or WhatsApp, show a proper title, description and image (Open Graph tags in the web build's HTML) instead of a bare URL. With the current single-page web build, the preview is the same for every link (wya-branded). Per-event previews would need server rendering, which can come later.

### R.6 Event themes (in scope)
- Hosts pick a theme for each event (e.g. Lime, Bubblegum, Violet, Tangerine, Ocean, Sunset). It colors that event's cover art, accents, invite preview and home card, in both light and dark mode.
- Database: `events.theme` (a text column with a fixed list of allowed values, default chosen at random so new events vary). `get_invite_preview` also returns it, so the invite page is themed before login.
- Picker on the create/edit form: a row of colour swatches with a live preview of the cover.

### R.8 The website
wya.expo.app is where most guests first meet wya, often on a laptop.
- **Wide screens:** content in a centered column (around 480–560px) on a themed backdrop instead of stretching edge to edge; the event page can go two-column on desktop (cover left, details right).
- **Web polish:** hover states on buttons and cards, pointer cursors, a page title per screen ("Seed Dinner Party · wya"), a proper favicon and theme color.
- **Link previews (R.5):** branded Open Graph / Twitter tags and a preview image. To check: whether `app/+html.tsx` applies to the `single` web build. If not, inject the tags into `dist/index.html` during `npm run deploy:web`. Per-event previews ("Hannah invited you to Rooftop Night" with the cover) need server output; that's a later step.

### Results (2026-10-10, local web against wya-dev)
**Built:**
- Design system in `constants/theme.ts`: two palettes with the same role names, a shared type scale (Bricolage Grotesque and DM Sans via `@expo-google-fonts`), spacing and corner sizes. `hooks/useTheme.tsx` handles system / light / dark, saves the choice, and provides `makeStyles`. The old `constants/colors|fonts|typography.ts` and the Cormorant / Raleway font files are deleted.
- Component kit in `components/ui/`: PressableScale (spring on press, haptic, web hover), Button, Card, Sticker, Avatar / AvatarStack, TextField, Segmented, Screen (centered column, max 560px), EmptyState, Logo, EventCover (photo or generated theme art), Confetti.
- Every screen rebuilt: invite preview, event page (themed cover hero, "Are you coming?" card, info card, host note, venue gallery, guest list, chat), home (themed cards sliding in), welcome / sign-in / sign-up, create/edit form (sections + theme picker with live preview), account (with **Appearance: Auto / Light / Dark**), tab bar (raised round create button).
- **Event themes:** `events.theme` (migration `20261010000400`), picker on the form, used by covers, stickers, buttons and the invite preview.
- **Confetti + success haptic** when you RSVP "I'm in".
- **Web:** page title per screen, link-preview tags injected into the build (`scripts/inject-web-meta.mjs`, run by `npm run deploy:web`), `public/og.png` preview card and `public/apple-touch-icon.png` (made by `scripts/make-brand-images.py`), theme-color, and no white flash before the app loads.

**Checked:** light and dark screenshots of every screen at phone width; desktop width shows the centered column; confetti fires; no console errors (the only warnings left come from navigation-library internals); typecheck; access-control script (57/57); the web export includes the tags and images.

**Changed from the plan:** the RSVP buttons are a prominent card near the top of the event page instead of a bar that stays on screen (simpler with the keyboard on phones). The two-column event page on desktop wasn't built; the centered column already reads well.

**Still to do:** redeploy wya.expo.app (`npm run deploy:web`); per-event link previews (needs server output); iOS check once Xcode is installed (haptics only work on a phone).

### R.9 Desktop layout and navigation (planned 2026-10-10, from user feedback)
Feedback on the deployed site: the raised **+ button is cut off** in the bottom bar on desktop, the content sits in a narrow column with **lots of empty space**, and the **bottom bar** could hold more.

**Why:** on wide screens the navigation library puts tab labels beside the icons and shrinks each icon's box, which crops the 54px button. The 560px content cap was a phone-first shortcut.

**1. Fix the + button** (all sizes): give the create tab a properly sized icon box, so the raised button is never clipped.

**2. A real desktop layout** (window ≥ 1024px wide; phones and narrow windows keep today's single column):
- **Sidebar navigation** on the left instead of the bottom bar: logo, a "New event" button, Events / Chats / Activity, and You at the bottom. Built through the tab navigator's own options (left-side tab bar), so routing stays the same.
- **Home:** event cards in a **2-column grid** (3 on very wide screens), with a "Plan something" tile at the end.
- **A right-hand panel instead of empty space**, with useful information rather than decoration:
  - **Next up:** a countdown to your next event ("5 days").
  - **Needs your answer:** invites you haven't replied to, and your Maybes. That's exactly what wya wants people to resolve.
  - **Latest activity:** the newest few items from Activity (below).
- **Event page:** two columns, with the cover, title, host and who's going on the left (staying in place while you scroll) and RSVP, details, guests and chat on the right.
- Content widths are capped (about 1,200px overall) so nothing stretches across ultra-wide monitors.

**3. More in the navigation:** Events · **Chats** · (+) · **Activity** · You.
- **Chats:** every event chat you're in, in one list, with the latest message and an unread count. No more opening each event to check its chat. Needs a small `chat_reads` table (when each person last read each chat) for the unread count.
- **Activity:** an in-app feed with a badge for unread items. For hosts: "Gary is going", "Jo can't make it", "Sam joined from your invite". For guests: "Hannah updated the time", "Rooftop night was cancelled". Needs a `notifications` table filled automatically by database triggers when RSVPs change and events are edited or deleted, readable only by its owner. **This is also the groundwork for Phase 3's reminders** ("confirm your Maybe by tomorrow", deposit charges, excuse requests) and for push notifications later.
- Other ideas considered and **not** proposed: Explore/Discover (wya is invite-only, so there's nothing public to browse) and a Calendar tab (Events already covers it; maybe later as a view inside Events).

**Order:** 1 (quick fix) → 2 (desktop layout) → 3a Chats → 3b Activity (database + triggers + access tests) → screenshots at phone, tablet and desktop widths in both themes → redeploy.

**Results (2026-10-10, local web against wya-dev):**
- **Navigation:** one custom component (`components/nav/AppTabBar.tsx`) draws the phone bottom bar (Events · Chats · (+) · Activity · You, with the + raised and never clipped) and the desktop sidebar (≥ 1024px: logo, New event, Events / Chats / Activity, You). The sidebar also shows on event and edit pages (`StandaloneSidebar` in `app/event/_layout.tsx`), so desktop users never lose their navigation. Live unread badges come from `hooks/useUnread.tsx` (realtime).
- **Desktop home:** a card grid (as many ≥ 360px columns as fit), a "Plan something" tile, and a side panel that stays in place: **Next up** (countdown), **Needs your answer** (unanswered invites and Maybes), **Latest** (newest Activity items, "See all"). Phones also show "Needs your answer" above the list when there's something to answer.
- **Desktop event page:** two columns, with the cover, title, host and who's going on the left, and Details / Chat on the right.
- **Chats tab:** every chat you're in, with the latest message ("Hannah: Who's bringing dessert?"), the time, and an unread count; newest conversations first. Tapping a row opens that event straight on its chat (`?tab=chat`), which marks it read.
- **Activity tab:** "Gary is going to …", "Jo can't make it to …", "Sam opened your invite to …", "Hannah changed the time of …", "Hannah cancelled …". New items are highlighted for the visit, then marked read.
- **Database** (`supabase/migrations/20261010000500_chats_and_activity.sql`): `chat_reads`, `get_my_chats()`, `mark_chat_read()`, `notifications` (readable and markable only by the person it's for; rows are written only by triggers), `mark_notifications_read()`, triggers on RSVP insert/update and on event update/delete. The actor's name is saved in the notification, so it still shows after an event is deleted.
- **Bug caught by the new tests:** the event-change trigger used `text[] || 'time'`, which Postgres reads as a malformed array literal. That would have **blocked hosts from editing an event's time, place or name**. Fixed with `array_append`, and the test now also checks that the edit itself succeeds.
- **Checks:** access-control script **72/72** (15 new: chats, activity, the notification triggers), safe to re-run; typecheck; web export; screenshots at phone and desktop width; the live badge count for a new chat message and new notifications, clearing on read.


### R.7 Testing
- Before/after screenshots of every screen at phone width on web, plus a check for leftover hard-coded colors and fonts.
- Typecheck; the access-control script still passes (no database changes expected).
- Redeploy wya.expo.app and look at it on a real phone.
- iOS simulator once Xcode is installed (haptics and some animations only show there).

## Phase 3 — Pledges (full plan, 2026-10-11)

**Goal:** make "I'm in" a commitment with as little friction as possible. Going on a pledge event means *"if I don't show, I'll pay the host $5"*. Nobody pays up front, and **wya never touches the money**: anyone who flakes pays the host directly with **PayID**. This is "option B". The reasoning, option A and the business model are in `docs/FEATURES.md`.

Sections: 3.1 decisions · 3.2 flows · 3.3 rules and edge cases · 3.4 database · 3.5 app · 3.6 notifications · 3.7 designed for option A · 3.8 testing · 3.9 build order · 3.10 out of scope.

### 3.1 Decisions

**Agreed with the user (2026-10-11):**
| # | Decision |
|---|---|
| D1 | Host's PayID lives on their **profile** (set once) |
| D2 | Pledge amount set per event, **default $5 AUD** |
| D3 | "I've paid" is **trusted automatically**; the host can dispute |
| D4 | Unsettled debts → **reliability record** visible to hosts **and** an **RSVP block** for that host's events |
| D5 | Switching I'm in → Can't go **after the cutoff** = a flake (late cancellation), unless an excuse is accepted |
| D6 | **The host marks no-shows**; QR/location check-in later |
| D7 | Maybes carry no pledge; reminded before the cutoff, **auto-set to Can't go at the cutoff** |
| D8 | Australia only, PayID only |

**Edge-case decisions (2026-10-11), all agreed:**
| # | Question | Recommendation |
|---|---|---|
| R1 ✅ | Should the cutoff move if the host changes the event time? | **Yes.** Store it as "hours before the start" (12 / 24 / 48 / custom), not a fixed time |
| R2 ✅ | The host changes the amount after people said I'm in | **Each guest keeps the amount they agreed to.** The amount is saved on their RSVP when they say I'm in |
| R3 ✅ | The host turns pledges on after guests already said I'm in | **They aren't pledged** (they never agreed). They see "Hannah added a $5 pledge. Tap I'm in again to confirm", and confirming pledges them |
| R4 ✅ (changed by user) | The host turns pledges off | **The host chooses**: (a) **release everyone's pledges**, so nobody who already said I'm in is pledged anymore, and they're notified; or (b) **keep existing pledges**, so only new I'm-ins aren't pledged. Debts that already exist after the event are handled separately (waive one, or waive all) |
| R5 ✅ | When can the host mark who came? | **From the start time until 7 days after.** Then attendance locks. **Unmarked = assumed came** (no debt) |
| R6 ✅ | Can someone with an unsettled debt still open that host's invites? | **Yes**: they can open the event and see what they owe. They just **can't say I'm in or Maybe** until it's settled |
| R7 ✅ | Excuses | **One excuse per debt.** Declined means still owed; there's no second attempt |
| R8 ✅ | Pledge amount limits | **$1–$50**, with $5 / $10 / $20 presets. Keeps it a pledge, not a ticket price |
| R9 ✅ | Removing your PayID while people owe you | **You can change it, not remove it**, while you have open debts |
| R10 ✅ | Can guests see their own reliability record? | **Yes**, under You. It's fairer to see what hosts see |
| R11 ✅ | Maybe after the cutoff | **Not offered after the cutoff.** You're in or you're out. (Future idea for the founders to discuss: saying I'm in after the cutoff costs a 2× pledge; see `docs/FEATURES.md`) |
| R12 ✅ | The event is deleted after debts exist | **The debts go with it** (deleting = forgiving). Simple, and hosts rarely delete past events |
| R13 ✅ | Default pledge state for new events | **Off**, until the host has added a PayID; after that, **on by default**, using the host's last-used amount |

### 3.2 Flows

**Host:**
1. *Once:* You → **Get paid** → enter a PayID (mobile, email or ABN) → saved.
2. *Per event:* the event form → **Pledge** section → on/off, amount, cutoff. Without a PayID, the toggle asks you to add one first.
3. *During the RSVP period:* the guest list shows who's pledged and each guest's reliability ("came to 9 of 10").
4. *After the start:* a "**Who came?**" card on the event page with everyone who's going, ticked → untick no-shows → **Done**. Each no-show gets a debt.
5. *Afterwards:* a **Pledges** panel showing owed / paid / waived / excuse waiting / disputed. Review excuses (**Accept** / **Decline**) and dispute "I've paid" if the money never arrived.

**Guest:**
1. *Before saying yes:* the RSVP card reads "**I'm in means a $5 pledge** if you don't show. Free to cancel until Fri 7:00 PM."
2. *Says Maybe:* "Decide by Fri 7:00 PM" plus a reminder in Activity 24 hours before. At the cutoff, it becomes Can't go automatically.
3. *Cancels after the cutoff:* a confirmation: "It's past the cutoff, so this counts as a flake. You'll owe Hannah $5." → Confirm → a debt.
4. *Owes:* a "**You owe Hannah $5**" card (on the event page, at the top of home, and in Activity) showing the PayID with a copy button, the amount, the reference `WYA-4821`, and **I've paid** / **I have an excuse**.
5. *Taps I've paid:* settled. If the host disputes, it's back to owed, with a notification.
6. *Tries to RSVP to that host's next event while owing:* "You owe Hannah $5 from Seed Dinner Party. Settle up to RSVP," with the pay card right there.

### 3.3 Rules and edge cases
- **Who can be pledged:** only guests whose RSVP is I'm in on a pledge event (with a saved pledge amount, R2/R3). Never the host. Never "invited" (no answer) or Maybe.
- **A pledge belongs to the RSVP, not the event.** Late-cancel and no-show debts are created whenever the guest's RSVP has `pledge_cents`, whatever the event's current mode. That's what makes R4(b) work: the host turns pledges off, new I'm-ins aren't pledged, existing ones still are. R4(a) clears `pledge_cents` on every RSVP for the event and sends `pledge_released`.
- **No-show debt:** created when the host unticks someone in "Who came?" inside the window (R5). Re-ticking removes the debt, unless it's already paid (the host can waive instead).
- **Late-cancellation debt:** created by the database when an RSVP changes from I'm in → Can't go after the cutoff. Before the cutoff, nothing happens.
- **Only one debt per guest per event.** A late cancellation and a no-show can't both apply, because a late canceller isn't "going" anymore.
- **Removed guests:** removing a guest deletes their RSVP but **keeps any existing debt**.
- **The RSVP block** applies to I'm in and Maybe on *that host's* events only. Other hosts are unaffected.
- **Reliability ("came to X of Y"):** Y = past pledge-or-not events where the guest was I'm in and attendance was marked, plus late cancellations; X = attended. Only marked events count, and nothing shows until Y ≥ 1. Unsettled debts are shown separately.
- **Privacy:**
  - A PayID is visible only to its owner, and to a guest **while they owe that host**.
  - Debts are visible only to the guest and the host involved.
  - A reliability record is visible to the person, and to hosts of events they're invited to.
- **Time zones:** the cutoff is calculated from the event's start time and shown in the viewer's local time.
- **Money:** whole cents (integer), `AUD`, shown as "$5" or "$5.50".
- **PayID validation** (in the app and the database):
  - Australian mobile `04xxxxxxxx` or `+614xxxxxxxx`, stored as `+614xxxxxxxx`
  - email
  - ABN: 11 digits that pass the ABN checksum
- **Reference:** `WYA-` + 6 hex characters (changed from 4 while building, for fewer collisions), unique per debt, for the guest to put in the bank transfer description.

### 3.4 Database (one migration, safe to re-run)
**Tables and columns:**
- `payment_methods (user_id, provider, value, created_at, updated_at)`, one row per user per provider; `provider in ('payid')`. RLS: the owner can read and write their own rows. Nobody else reads it directly.
- `events` adds:
  - `deposit_mode text not null default 'none' check (deposit_mode in ('none','pledge'))`, extensible to `'upfront'`
  - `deposit_cents int not null default 500 check (between 100 and 5000)`
  - `cutoff_hours int not null default 24 check (between 0 and 336)`
- `rsvps` adds:
  - `pledge_cents int` (null = not pledged; set when I'm in is chosen on a pledge event)
  - `attended boolean` (null = unmarked)
  - `attendance_marked_at timestamptz`
  - `maybe_reminded_at timestamptz`
- `obligations`:
  - `id`, `event_id` → events (cascade, R12), `guest_id`, `host_id`
  - `amount_cents`, `currency default 'AUD'`
  - `reason` (`no_show | late_cancel`)
  - `status` (`owed | excuse_pending | paid | waived | disputed`)
  - `reference` (unique), `excuse`, `excuse_declined boolean`
  - `created_at`, `paid_at`, `resolved_at`
  - unique (event_id, guest_id)
  
  RLS: select for the guest or the host only. **No direct insert/update/delete**; all changes go through the functions below.

**Functions** (security definer, `search_path = ''`, each checks who's calling):
| Function | Who | Does |
|---|---|---|
| `set_payid(value)` / `remove_payid()` | anyone (own) | Validates and saves; remove is refused while you're owed money (R9) |
| `mark_attendance(event_id, user_id, attended)` | host, inside the window | Sets attended; creates or removes the no-show debt |
| `claim_paid(obligation_id)` | guest | owed / disputed → paid |
| `dispute_payment(obligation_id)` | host | paid → disputed |
| `submit_excuse(obligation_id, text)` | guest, once | owed → excuse_pending |
| `resolve_excuse(obligation_id, accept)` | host | → waived, or → owed (declined) |
| `waive_obligation(obligation_id)` | host | any open → waived (plus `waive_all(event_id)`) |
| `set_deposit_mode(event_id, mode, release_existing)` | host | Turns pledges on or off; `release_existing` = R4(a) |
| `get_payment_instructions(obligation_id)` | guest | host name, PayID, amount, reference |
| `get_reliability(user_id)` | self, or a host of an event they're invited to | attended, counted, open debts |
| `get_my_obligations()` | anyone | your debts (as guest) and the ones owed to you (as host), with event titles |

**Triggers:**
- **`rsvps` before update of status:**
  - Block I'm in / Maybe while you have an open debt to that host (R6).
  - Block Maybe after the cutoff (R11).
  - Save `pledge_cents` when I'm in is chosen on a pledge event.
  - Clear it when leaving I'm in before the cutoff.
- **`rsvps` after update of status:** I'm in → Can't go after the cutoff on a pledged RSVP → create a `late_cancel` debt.
- **`obligations` after insert/update:** Activity notifications (3.6).
- **`events` after update of deposit_mode** to pledge: notify Going guests who aren't pledged (R3).

**Scheduled job** (`pg_cron`, every 15 minutes, enabled by the migration): `private.process_pledge_deadlines()`. It sends each Maybe on a pledge event one reminder when the cutoff is 24 hours away or less, and at the cutoff sets remaining Maybes to Can't go with a `maybe_expired` notification. It's idempotent and can be called directly in tests.

**Notification types** (extends the check constraint): `pledge_added`, `pledge_released`, `pledge_owed`, `payment_claimed`, `payment_disputed`, `excuse_submitted`, `excuse_resolved`, `debt_waived`, `maybe_reminder`, `maybe_expired`.

### 3.5 App
**New files:**
- `lib/payments/index.ts`: a provider registry, `getProvider('payid')`.
- `lib/payments/payid.ts`:
  - `validate`, `normalize` (`04…` → `+614…`), `format` for display
  - `instructions({ amount, reference, hostName })`: the lines shown on the pay card
  - `deepLink`: none for PayID
- `lib/pledges.ts`:
  - `formatMoney`, `cutoffFor(event)`, `isPastCutoff(event)`
  - `obligationStatus` labels and colors in one map
  - a `DepositMode` type plus `owesWhen(mode)`, so option A is a one-line addition
- Components:
  - `components/pledges/PledgeSettings.tsx`: the form section
  - `components/pledges/PayCard.tsx`: "You owe…"
  - `components/pledges/AttendanceCard.tsx`: "Who came?"
  - `components/pledges/PledgesPanel.tsx`: the host's list
  - `components/pledges/ExcuseSheet.tsx`
  - `components/pledges/ReliabilityBadge.tsx`

**Screens touched:**
- **You:** a "Get paid" card (add / edit PayID, with format help) and "Your reliability".
- **Event form:** a Pledge section (toggle, amount chips, cutoff chips) between Details and Settings. Needs a PayID.
- **Event page, guest:**
  - pledge wording on the RSVP card
  - the late-cancel confirmation
  - Maybe hidden after the cutoff
  - "Decide by …" for Maybes
  - the PayCard when they owe
  - the blocked state with the PayCard
- **Event page, host:** the AttendanceCard (after the start, inside the window), the PledgesPanel, reliability on guest rows.
- **Home:** owed debts at the top ("You owe Hannah $5"); on desktop, inside the "Needs your answer" panel.
- **Activity:** wording for the new types (`lib/notifications.ts`).

Both themes, phone and desktop, as always.

### 3.6 Notifications
| Type | To | Text |
|---|---|---|
| `pledge_added` | going guests who aren't pledged | "Hannah added a $5 pledge to Rooftop Night. Confirm you're still in" |
| `pledge_released` | guests who were pledged | "Hannah removed the pledge from Rooftop Night. You no longer owe anything if you can't make it" |
| `pledge_owed` | guest | "You owe Hannah $5 for Rooftop Night" (with the reason) |
| `payment_claimed` | host | "Gary says he paid you $5 for Rooftop Night" |
| `payment_disputed` | guest | "Hannah hasn't received your $5 for Rooftop Night" |
| `excuse_submitted` | host | "Gary sent an excuse for Rooftop Night" |
| `excuse_resolved` | guest | "Hannah accepted / declined your excuse" |
| `debt_waived` | guest | "Hannah let you off the $5 for Rooftop Night" |
| `maybe_reminder` | guest | "Decide on Rooftop Night by Fri 7:00 PM" |
| `maybe_expired` | guest | "You didn't decide on Rooftop Night in time, so you're marked as not going" |

### 3.7 Designed for option A (pay up front) and other regions
- `deposit_mode` gains `'upfront'`. `owesWhen('upfront') = 'at_rsvp'` vs `owesWhen('pledge') = 'on_flake'`.
- `obligations.status` gains `due | refund_due | refunded`, and `reason` gains `upfront`. The same PayCard, references, excuses and notifications are reused.
- A new payment method is a new `lib/payments/<provider>.ts` plus one value in the `provider` check.
- Nothing in the screens checks for "PayID" directly; they ask the provider registry.

### 3.8 Testing
- **Access-control script** (`rls_check.py`), new checks:
  - Nobody else can read your PayID.
  - A guest sees a host's PayID only while owing them.
  - Debts are visible only to the two people involved.
  - Debts can't be inserted or edited directly.
  - Every function rejects the wrong caller.
  - The RSVP block works, and Maybe is refused after the cutoff.
  - A late cancellation creates exactly one debt; re-ticking attendance removes the debt.
  - Excuses work once only.
  - `process_pledge_deadlines()` reminds once and then expires.
  - Reliability counts are correct.
  - Every notification is created.
- **Web smoke test** at phone and desktop widths, light and dark: the host sets a PayID → creates a pledge event → a guest says I'm in → (time moved past the start in the dev database) the host marks a no-show → the guest sees the PayCard → I've paid → the host disputes → the guest sends an excuse... and the RSVP block on a second event.
- Typecheck; `expo export`.

### 3.9 Build order (each step ends with tests passing)
1. **Database:** migration, plus the access tests for everything in 3.4. *Biggest step; everything else sits on it.*
2. **Payments library + PayID on the profile** (You → Get paid).
3. **Pledge settings on the event form + RSVP wording** (pledge text, cutoff, Maybe hidden after the cutoff, the late-cancel confirmation).
4. **Who came? → debts → PayCard → I've paid / dispute / waive.**
5. **Excuses.**
6. **Reliability record + the blocked-RSVP state.**
7. **Maybe reminders and expiry (`pg_cron`) + all the Activity wording.**
8. **Home and desktop placements, a full smoke test, docs** (`FEATURES.md` → ✅, `CLAUDE.md`, this file).

### Results (2026-10-11, local web against wya-dev)
All eight build steps are done. Typecheck clean; **`rls_check.py`: 128 checks pass** (re-runnable; it creates and deletes its own temp events).

Smoke test at phone width (light and dark) and desktop, as Hannah (host), Gary and Jo (guests):
- ✅ Guest sees the pledge note and cutoff before RSVPing; past the cutoff, Maybe is hidden and "free to cancel" disappears.
- ✅ Late cancel asks for confirmation, then the PayCard appears (PayID, reference, bank steps).
- ✅ RSVP block on the host's other event ("Settle up first"); I've paid lifts it, and the guest sees "You've pledged $5".
- ✅ Who came?: unticking Jo makes the Pledges panel show Jo owes $5; Activity wording reads correctly.
- ✅ Create form defaults pledges on (host has a PayID); You → Get paid and Your reliability render in dark mode.
- ✅ Host guest list shows "Pledged $5", "Came to 1 of 2", "Owes money".

Fixes made along the way:
- `get_reliability` failed with "column reference attended is ambiguous"; fixed with table aliases.
- The PayCard didn't appear right after a late cancel; the event page now reloads debts after any RSVP change.
- The cutoff selector overflowed at phone width; labels shortened to 12h / 24h / 48h / Other.

**Stress test (2026-10-11):** `supabase/tests/stress_pledges.py` runs one pledge event with 30 guests (`supabase/seed_stress.sql`), every guest action fired at the same moment. 39 checks, passed 8 runs in a row:
- 30 open the invite and RSVP at once (20 in, 6 Maybe, 4 out); free cancels before the cutoff.
- Maybes reminded once, then expired at the cutoff.
- 4 late cancels (with a double tap): exactly 4 debts.
- Who came? saved twice at once: exactly 6 no-show debts; re-ticking drops one.
- 10 debtors pay, excuse or ignore it at once; the host resolves them.
- All 30 RSVP to the next party: exactly the 5 who still owe are blocked.
- Reliability is right for all 30; waive all unblocks them.
- Speed: most calls ~0.3 s (mostly the round trip to us-east-1); worst ~1.1 s with 30 invite opens at once.

What it found, and the fixes:
- The host's guest list made **one request per guest** for track records (30 guests = 30 requests). `get_guest_list` now returns `reliability` in the same call.
- **"I've paid" tapped twice at once** made the second tap fail ("Nothing to pay here"). It's now a no-op if already paid, and the update re-checks the status under the row lock.
- Display:
  - The Pledges panel lists what needs action first (excuses, disputes, owed), then paid, then let off.
  - References no longer wrap mid-code.
  - Late cancellers no longer show "Pledged $5" under Not going.
- **Long lists (from Abhiram's review at 30 guests):** every long list is a `ListSection` (`components/ui/ListSection.tsx`).
  - It collapses, scrolls inside its card once open (`ScrollBox`, max 380px), and has a full screen button that shows that list alone.
  - Guest groups (Going / Maybe / Not going / No answer yet) start collapsed. "Who came?" and Pledges start open, because they're the host's to-dos.
  - Summary lines: "10 of 16 came", "10 flaked · 3 paid".
  - The hero shows 4 faces, then "Ava, Ben, Chloe, Dan + 26 others".

Not yet tested: iOS (needs Xcode).

### 3.10 Out of scope for Phase 3
Option A, QR/location check-in, push notifications, SMS, card payments, other payment methods, plus-ones having their own pledge. All are tracked in `docs/FEATURES.md`.

## Phase 4 — Shared album (planned 2026-10-11)

### Context
The event page is meant to be the one place for an event: details, guest list, chat and pledges are built. The last piece is an album where guests drop their photos from the party, so nobody has to chase a group chat for them afterwards. It also gives guests a reason to open wya *after* the event, which is when pledges settle.

**Decided with Abhiram (2026-10-11):**
- **Who adds, and when:** the host and anyone **Going** can add photos from the event's start until **30 days after**. Once the host has marked Who came?, no-shows can't add.
- **Who views:** the host and everyone invited can view. Maybes, Can't-gos and people who haven't answered can view but not add.
- **Privacy:** only invited people can see the photos. They're kept in a **private** store and shown through short-lived links, so a forwarded link stops working.
- **Limits:**
  - Photos only (no video).
  - Each photo is shrunk on upload to 1600px JPEG, about 0.35 MB.
  - Caps: **30 per person, 300 per event**. The caps live in one place, so a paid "bigger album" can raise them later.
- **Moderation:** photos appear straight away. Anyone can delete their own photos, and the host can delete any photo in their album.

### How it works (user's view)
1. The event page gets a third tab: **Details · Chat · Photos (12)**.
2. **Before the start**, the tab says "The album opens when the party starts" (for those who'll be able to add).
3. **From the start**, Going guests and the host see **Add photos**:
   - It opens the multi-select picker, limited to what they have left of their 30.
   - Each photo is shrunk and uploaded, with progress ("Uploading 3 of 8"). Failures are listed with a retry.
4. **The grid:** 3 columns on phones, 5 on desktop, newest first. New photos appear live during the party.
5. **Tap a photo** for a full-screen viewer:
   - Swipe or use arrows to move through the album.
   - It shows who added it and when.
   - **Save**: to the phone's gallery on iOS/Android, a download on web.
   - **Delete**, if it's your photo or your album.
6. **Activity** shows "Gary and 3 others added 14 photos to Rooftop Night". It's **one notification per person per event** that updates while unread, so 30 uploaders don't flood anyone.
7. Viewers who can't add see the grid with "Only people going can add photos."

### Rules and edge cases
- **Upload window:** from `events.date` to `events.date + 30 days`.
  - Moving the event date moves the window.
  - After the window closes the album is read-only, but owners and the host can still delete.
- **Who can add:** RSVP status `yes`, and not `attended = false`; plus the host.
  - A guest who switches to Can't go keeps their earlier photos but can't add more.
- **Removed guests** lose access, because viewing checks they still have an RSVP row. Their photos stay; the host can delete them.
- **Caps** are enforced in the database, not just the app.
  - A per-event lock makes simultaneous uploads unable to go over 300.
  - The picker's `selectionLimit` shows each person how many they have left.
- **Location privacy:** re-saving the photo as a new JPEG drops the phone's metadata, including GPS. We'll verify this in testing.
- **Deleting an event:**
  - The photo rows are deleted automatically along with the event.
  - The files are removed by the app first (host deletes the event's folder), like covers today.
  - A clean-up job for leftovers is noted for later.
- **Grid speed:** each photo is uploaded twice, at full size and as a 400px thumbnail (~40 KB).
  - The grid loads only thumbnails.
  - Supabase's on-the-fly resizing is a paid feature, so we make our own thumbnails.
- **Short-lived links:**
  - One batch request signs the whole page of thumbnails, valid for an hour, and they're re-signed when the screen refocuses.
  - `expo-image` caches by photo id (`cacheKey`), so a re-signed link doesn't re-download the image.
- **Storage budget:**
  - Supabase's free tier holds 1 GB. Estimated at ~2,800 photos, but measured in Phase 5: real photos come out at 0.4–0.8 MB, so about **1,500**.
  - A full 300-photo album is about 115 MB with thumbnails.
  - That's enough to prove the feature; real usage will need the Pro plan (100 GB). I'll note it in FEATURES.md → Business model.

### Database (one migration, safe to re-run: `supabase/migrations/20261012000000_album.sql`)
- **Private bucket `album`:**
  - 5 MB file limit; only `image/jpeg` allowed.
  - Path: `<event_id>/<user_id>/<photo_id>.jpg` and `…/<photo_id>_thumb.jpg`.
- **Table `photos`:**
  - Columns: `id` (uuid), `event_id` (deleted with the event), `user_id`, `path`, `thumb_path`, `width`, `height`, `created_at`.
  - RLS: **select** for the host or an invited guest, using the existing `private.is_event_host` / `private.is_event_guest`.
  - No direct insert, update or delete. Everything goes through RPCs, the same pattern as `obligations`.
- **Helpers** (`private`, `security definer`, `search_path=''`):
  - `album_limits()` returns 30 per person and 300 per event: the one place to change for a paid tier.
  - `can_add_photos(event)` checks host or (Going and not a no-show), and inside the window.
  - `can_view_photos(event)` checks host or guest.
- **Storage policies on `album`:**
  - **insert:** only into your own `<event>/<you>/` folder, and only if `can_add_photos(event)`.
  - **select:** `can_view_photos(event)` (needed to sign links).
  - **delete:** your own files, or any file in your event if you're the host.
- **RPCs** (authenticated only):
  - `add_photo(event_id, photo_id, path, thumb_path, width, height)`:
    - checks `can_add_photos`, the caps (under a per-event lock), that the paths are in the caller's folder, and that the file really exists in `storage.objects`;
    - then inserts the row;
    - raises `ALBUM_FULL` / `YOUR_LIMIT` hints for friendly messages.
  - `delete_photo(id)` (owner or host) deletes the row and returns the paths, so the app removes the files.
  - `get_album(event_id)` returns photos with the uploader's name and avatar, plus `can_add`, `my_count`, `limits` and `window_closes_at`.
- **Notifications:**
  - New type `photos_added`, added to the `notifications_type_check` list (the pledges migration's list plus this one).
  - A trigger on `photos` insert notifies the host and everyone who was Going, except the uploader.
  - It **updates** the recipient's unread `photos_added` row for that event (count, latest uploader, the number of other uploaders) instead of adding a new one.
- **Realtime:** add `photos` to the `supabase_realtime` publication. RLS still decides who receives events.

### App
- **New dependencies** (install with `npx expo install` so the versions match SDK 56):
  - `expo-image-manipulator`: the context API (`ImageManipulator.manipulate(uri).resize({width:1600})` → `renderAsync()` → `saveAsync({format: SaveFormat.JPEG, compress: 0.75})`). The older `manipulateAsync` is deprecated.
  - `expo-image`: the grid and viewer, with `contentFit`, `cachePolicy`, `cacheKey` and `transition`.
  - `expo-media-library`: "Save to phone" (`requestPermissionsAsync(true, ['photo'])` → `Asset.create(fileUri)`). It doesn't work on web, so web downloads the file instead. Add the `app.json` plugin with permission text.
- **`lib/album.ts`:**
  - Types (`Photo`, `Album`) and `ALBUM_LIMITS` mirrored for the UI.
  - `prepare(asset)` shrinks a picked photo into a full-size JPEG and a thumbnail.
  - `uploadPhotos(eventId, assets, onProgress)`: for each photo, upload both files, then `add_photo`, and remove the files if `add_photo` fails. It reuses `readFileBytes` from `lib/readFile.ts`.
  - `signUrls(photos)` signs every link in one batch (`createSignedUrls`).
  - `savePhoto(photo)` saves to the phone, or downloads on web.
- **`lib/upload.ts`:** pull out the shared "picked asset → bytes → `storage.upload`" step, so the album and the existing cover/avatar uploads use one path.
- **`hooks/useAlbum.ts`:** `get_album` plus signed links, a live subscription to new and deleted photos for the event, reloading on focus, and `add` / `remove`.
- **`components/album/`:**
  - `AlbumTab.tsx`: header ("12 photos · you can add 18 more"), the Add photos button, upload progress, and the empty and closed states.
  - `PhotoGrid.tsx`: a `FlatList` with `numColumns` from `useLayout().isWide` (3 or 5), square `expo-image` thumbnails and `PressableScale`.
  - `PhotoViewer.tsx`: a full-screen `Modal` with a horizontal paged `FlatList`, arrows on wide screens, and the uploader, time, Save and Delete. It follows `ListSection`'s modal pattern: safe-area insets and `Screen`.
  - `UploadProgress.tsx`.
- **`app/event/[id].tsx`:**
  - Add `'photos'` to the tab state and the `Segmented` options, with the count.
  - Support `?tab=photos` (like `?tab=chat`), so an Activity notification opens the album.
- **`lib/notifications.ts`:** describe `photos_added` ("Gary and 3 others added 14 photos to X", with an `images` icon), and route it to `?tab=photos`.
- **`app/event/edit/[id].tsx`:** before deleting an event, remove its `album/<event_id>/` files (the same pattern as cover and venue photos).
- **Kit:** use the theme tokens, `Card`, `Button`, `EmptyState`, `Sticker`, `Avatar` and `PressableScale`; no hex values in screens.

### Testing
- **`rls_check.py`, new checks** (temp events, cleaned up):
  - **Uploads:**
    - Going guest: allowed in the window; refused before the start and after 30 days.
    - Maybe, invited-not-answered and stranger: refused.
    - No-show after Who came?: refused.
    - Upload into someone else's folder: refused.
    - `add_photo` for a file that doesn't exist, or that's in another person's folder: refused.
  - **Viewing:**
    - Invited guests can read rows and sign links.
    - A stranger or a logged-out visitor can't, and can't fetch a file by its plain URL (the bucket is private).
    - A removed guest loses access.
  - **Caps:** the 31st photo for a person is refused, and so is the 301st for an event (with a lowered limit for the test).
  - **Deleting:** you can delete your own photo; the host can delete anyone's; a guest can't delete someone else's.
  - **Notifications:** exactly one unread `photos_added` per recipient per event, whose count adds up.
- **`stress_pledges.py`, new step** (album at 30 guests):
  - 12 Going guests each upload 5 photos at once, using a tiny JPEG.
  - All 60 are in the album.
  - One guest firing 32 uploads at once ends with exactly 30.
  - The host can delete; notifications are aggregated.
  - Timings for `get_album` and the batch link signing.
- **Web smoke test** (phone and desktop widths, light and dark):
  - Add 8 photos → progress → grid → viewer (swipe, save/download, delete).
  - A second account sees them appear live.
  - Before-start and after-window states.
  - A Maybe can view but not add.
  - A big album scrolls smoothly.
  - Check that a downloaded photo has no GPS metadata.
- `npm run typecheck`, `npx expo export -p web`, plus the Supabase security advisor.
- **iOS** "Save to phone" can only be checked once Xcode is set up; noted as untested if it's still missing.

### Build order (each step ends with tests passing)
1. Write the plan into `docs/PLAN.md` → Phase 4 (decisions and these steps).
2. Database migration + `rls_check.py` album checks; apply to wya-dev.
3. Dependencies (`npx expo install expo-image expo-image-manipulator expo-media-library`), `lib/album.ts`, the `lib/upload.ts` refactor.
4. Photos tab + grid + upload flow + `useAlbum` live updates.
5. Viewer: swipe, save/download, delete.
6. Activity notification + `?tab=photos` + clearing album files when an event is deleted.
7. Stress-test step, web smoke test, docs (FEATURES → ✅, CLAUDE.md, PLAN results), commit groups + PR text for Abhiram to run.

### Results (2026-10-12, local web against wya-dev)
All seven build steps are done. Typecheck clean; `expo export` OK.

**Tests:**
- **`rls_check.py`: 156 checks pass** (26 new for the album).
- **`stress_pledges.py`** now ends with an album step (11 checks, passing):
  - 10 guests add 5 photos each at once: all 50 land.
  - One guest firing 30 more at once stops at exactly 30; the extras get `YOUR_LIMIT`.
  - 150 links sign in one request (~0.9 s).
  - Notifications bundle correctly: the host has one counting all 75, and each uploader has one counting the others' photos.
- **Event cap:** checked by temporarily lowering it to 2 on wya-dev. Four simultaneous uploads give exactly 2 accepted and 2 `ALBUM_FULL`. Then restored to 300.

**Web smoke test** (phone and desktop, light and dark; Hannah host, Ava going, Ben maybe):
- `?tab=photos` opens straight on the album.
- Add 8 photos:
  - Progress shows "Uploading 1 of 8 … 8 of 8"; it took about 14 s.
  - Stored as 1600×1200 (or 1200×1600 for portrait) plus a 400px thumbnail.
  - **No metadata (EXIF/GPS) in any stored file**, including a source photo that had it.
- **Grid and viewer:**
  - Grid: 3 columns on phones, 5 on desktop.
  - Viewer: uploader, time, "2 of 8"; swiping updates the counter.
  - Save gives a download on web; Delete removes the row and both files.
- **Live:** Ava's 3 photos appeared on Hannah's open album within ~2 s without a refresh.
- **Activity:** one item, "Ava added 3 photos to Album party", which opens the album.
- **Ben (Maybe):** can view all photos, sees "Only people going can add photos", has no Add button, and gets Save but no Delete.
- **Album states:** before the start, "Opens Tue 13 Oct…"; after 30 days, "Closed … You can still view and save photos".
- **Deleting the event** from the edit screen removed the event and all 20 of its album files.

**Fixes made along the way:**
- Uploaders can now always see their own files. Storage won't delete a file you can't see, so files of a deleted event or a removed guest were stuck.
- The stress test now cleans up refused uploads like the app does.
- Wording for an empty album that has closed.

**Not yet tested:** iOS (needs Xcode), including "Save to phone" and the photo-library permission prompt. A server clean-up job for any leftover files is still in Out of scope.

### Out of scope (tracked in FEATURES.md)
- Video
- Download the whole album as a zip
- Reporting a photo
- Host approval before photos appear
- "Set as cover" from the album
- A server clean-up job for files left behind after deletions
- Push notifications
- Paid bigger albums

### Workflow constraints
- Claude does **not** run git add, commit or push; Abhiram does.
- Test sign-ins only on localhost with the seed accounts.
- Run the stress test and `rls_check.py` one at a time.

---

## Phase 5 — Native iOS + Android (in progress, 2026-10-12)
The full plan, what changed, the test results and the next steps are in **`docs/PHASE5.md`** (kept separate as a handoff doc).

**Summary:**
- Upgraded to Expo SDK 57 (Hermes memory fix, iOS 27 scene lifecycle).
- `ios/` and `android/` are now generated and git-ignored.
- `app.json` permissions cleaned up; unused libraries removed.
- **iOS 27 simulator pass done**, with 8 fixes: fonts on phones, the RN #58970 text clipping, the date wheel, chat with the keyboard, viewer jumps, Android-safe Directions, read timeouts, session storage.

**Done on `phase5` branch (in addition to the simulator work above):**
- Brand assets updated: dark-mode app icon (black bg, lime "wya", hot pink dot), tangerine dot on light splash, lime + hot pink on dark splash. Matched to `components/ui/Logo.tsx`. `scripts/make-brand-images.py` is the source; regenerate with `python3 -I scripts/make-brand-images.py` then `npx expo prebuild --clean`.
- Native test checklist written: `supabase/tests/native_checklist.md`.
- Missing packages installed (`expo-secure-store`, `expo-haptics`, etc.); `npm run typecheck` passes at 0 errors.

**Next:**
- A real iPhone (steps in `docs/PHASE5.md` §3.2).
- Android emulator + real phone (steps in `docs/PHASE5.md` §3.3).
- Confirm the icon dot colour with Abhiram (hot pink was used; he mentioned orange or purple).

---

## Fee notes (for the later card-payment upgrade, not Phase 3)

Stripe's current pricing ([Connect pricing](https://stripe.com/connect/pricing)):
- Card charge: 2.9% + 30¢.
- Connect Express: **$2 per host in each month they receive a payout**, plus 0.25% + 25¢ per payout.

**Example:** 3 no-shows × $5 = $15. Card fees ≈ $1.34, payout ≈ $0.29, account fee $2.00 → **≈ $3.63 (24%)** goes to Stripe.

Ideas to consider:
- A minimum deposit of about $5; a $2 deposit loses 18% to the card fee alone.
- The no-show pays a service fee on top of the deposit, which is the platform's cut. The host receives the full deposit.
- Pay hosts in batches (monthly, or once their balance is over a threshold) so the fixed fees are paid less often.
- Open problem: hosts with only 1–2 no-shows a month make us lose money on the $2 account fee. Options are a payout threshold or a small fee when the host withdraws.
