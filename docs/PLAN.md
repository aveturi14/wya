# wya — Project Plan

_Last updated: 2026-10-10 (handoff; see also CLAUDE.md)_

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
| **0. Foundation** | Save the current work safely, fix the chat bug, make dev match production, smoke-test | ✅ Merged (PR 2) |
| 1. Fixes and security | Lock down who can read data, fix photo uploads, sign-up race, back button, web alerts | ✅ Merged (PR 3) |
| 2. Host basics | Guest list, edit/delete events, create-form fixes, invite links anyone can open | ✅ Merged (PR 4), live on wya.expo.app |
| Design refresh | Light (Soft pop) and dark (After dark) themes, component kit, motion, event themes, website polish, link previews | ✅ Merged (PR 5) |
| R.9 Desktop + nav | Sidebar on desktop, desktop layouts, Chats tab, Activity tab | ✅ Merged (PR 6) |
| **3. Deposits** | Stripe Connect, deposits, check-in, excuses, charging no-shows | **Next** (platform fee still to decide) |
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
