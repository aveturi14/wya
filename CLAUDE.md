@AGENTS.md

# wya — context for Claude

You're picking up wya mid-flight. This file is the handoff: what the app is, how it's built, the rules we work by, where things stand, and what's next.

**Current scope (2026-11-25): the free web beta, epic [#105](https://github.com/aveturi14/wya/issues/105).** Verified email guests, OCR receipt splitting (payer reviews) and PayID with recipient confirmation, in the mobile browser. Read the "Direction update" at the top of `docs/PHASE8.md` and the README first; where this file disagrees, they win. The wallet, no-show pledge fines, the OpenAI receipt scan and Phase 8 tiers B–E (8.10–8.17) are **not launch work**: do not build them or extend them. "wya never touches the money" stays true for the beta.

**In progress: Phase 8 (smart coordination) on branches `phase8a-core` (8.0–8.2, pushed) and `phase8a-tier-a` (8.3–8.9, built on top of it). Read `docs/PHASE8.md` first: its Status table says what's written, applied and due.** Items 8.0–8.9 (tier A) are applied to wya-dev and pass (`phase8/run.py` 185/185). 8.10–8.17 aren't built. Build with **Claude Opus 5.5 at medium effort**, one item per session, to the §6 defaults.

**Phase 5 (native iOS + Android) is still open for Android: read `docs/PHASE5.md`.** It lists what changed, what's been tested, and the exact next steps.

Two more docs to read before planning anything big:
- **`docs/FEATURES.md`**: the product catalogue (live / in progress / planned / decided against), the payments reasoning, the business model, and a decision log.
- **`docs/PLAN.md`**: build history, technical plans and test results per phase.

_Last updated: 2026-10-21 on `claude/stage1-1-collect-7bbcd4`: **Stage 1.1, collect before you book** (split-app spin-off): an organiser collects a fixed amount each by PayID before booking; wya records consent, claims, confirmations, expiry and refunds, and moves no money. Collect debts are PayID only (never the wallet), never block RSVPs, never touch reliability. Migration `20261021000000_collections.sql` (applied to wya-dev). Tests: `run.py --only S1.1` (93/93). Plan and results: `docs/split-app/STAGE_1_1_PLAN.md`, `STAGE_1_1_RESULTS.md` (how to read `get_collect_stats()`). **Then 1.1b, collection links**: every collection has a link (`/c/<code>`, opens signed out); "I'm in" from the link is a request the organiser approves (no debt, no PayID before that); collections can stand alone (hidden event, `events.kind = 'collection'`, kept out of every event list); $200 per person; Report; funnel stats. Migration `20261022000000_collection_links.sql` (applied). Tests `--only S1.1b` (53/53). Plan: `docs/split-app/STAGE_1_1_LINKS.md` (also the email-code sign-in plan for later).
Earlier, 2026-10-19 on `feat/split-changes`: **wallet (test balance)**, bills for anyone on the event, album open from creation, photo viewer (keys, drag, sharper), full-window glow and fluid desktop widths, and wya's own error dialog on web. Migrations `20261019000000_bills_everyone_album_anytime.sql` and `20261019000100_wallet.sql` (apply both). Details: `docs/PHASE9.md` notes, 2026-10-19. **The "wya never touches the money" rule was going to change** (9.15: bills paid from the wallet). **Superseded 2026-11-25: the wallet is off in production and the rule stays (see the scope paragraph above).**
Earlier, 2026-10-17: **Glow redesign rolled back** on branch `revert-to-phase7-ui`: the Phase 7 look is back and every Phase 8 feature is kept, restyled to the Phase 7 kit. What changed and what could come back: `docs/PHASE8_CHANGES.md`.
**Done:** the plan (`docs/PHASE8.md`), its tests (`supabase/tests/phase8/`), the rebuild spec (`docs/REBUILD.md`), and item 8.0 written (typed chat messages, rate limits, Edge Function scaffold).
**Applied:** `20261017000000_phase8_foundations.sql` on wya-dev; 8.0 checks 13/13; `rls_check.py` still 190/190.
**Applied:** `…000100_invite_hardening.sql` (8.1, 27/27) and `…000200_polls.sql` (8.2, 19/19).
`rls_check.py` still 190/190 with 8.1 + 8.2 applied.
**Applied (branch `phase8a-tier-a`):** 8.3 splits + pay page, 8.4 check-in, 8.5 host record, 8.6 nudges, 8.7 open events, 8.8 invite-your-people / circles / switches, 8.9 plans; `phase8/run.py` 185/185; `rls_check.py` still 190/190. Web checked: `/plan`, `/split` + cancel, Find a time → lock in.
**8.18 receipt splits (applied 2026-10-17; `…000000_bills_tab.sql` and `…000100_dues.sql` due):** (wya Split brief: scan → tick what you had → confirm → lock into split debts). Migration `20261017001000_receipts.sql` (checked on a throwaway Postgres), Edge Function `scan-receipt` + `_shared/llm.ts` (needs `OPENAI_API_KEY`), `app/receipt/[id].tsx`, `ReceiptCard`. The in-app wallet is a separate, later plan. See `docs/PHASE8.md` §4 8.18.
**Due:** browser checks for the pay page, `/here`, `/remind` and the host record (need Gary's account); the manual rows; then tiers B–E (keys and accounts first, see `docs/PHASE8.md` §3; 8.16–8.17 need none).
Phase 7 (phone UI) is merged (PR 15); see `docs/PHASE7.md`._

---

## What wya is

An RSVP app built so **an RSVP means something**. Hosts over-prepare for guests who flake at the last minute (invite 30, cook for 30, 10 show up). The core idea, built in Phase 3: saying "I'm in" is a **pledge** ("if I don't show, I'll pay the host $5"). Show up and nothing happens. Flake without an excuse the host accepts, and you pay the host **directly with PayID**. **wya never touches the money**, which keeps friction (and payments licensing) out of it. Australia first. Everything else (invites, guest list, chat, the event page as "the one place for the event") supports that commitment.

The app has **no real users yet**. It's in development, so breaking schema changes are fine as long as the app and the migration ship together.

## Stack

- **Expo SDK 57** (React Native 0.86, React 19, Expo Router, TypeScript). **Read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before using any Expo API** (see `AGENTS.md`). Things have changed from older SDKs.
- **Supabase**: Postgres with row-level security, Auth (email + password), Storage, Realtime.
- **Web** is a first-class target: hosted at **https://wya.expo.app** (EAS Hosting, `web.output: "single"`). Most guests first meet wya through an invite link on the web.
- iOS has passed the simulator (iPhone 18 Pro, iOS 27) and a real iPhone (Phase 5). Android hasn't been run yet.

## Environments

- **One Supabase project: `wya-dev`** (ref `gvfcjxldokhodgnmmqar`, us-east-1). `.env` points at it. It's **git-ignored since 2026-10-17**: copy `.env.example` and fill in the anon key (publishable values only). The original production project (`nackffabsuzameyrpuks`) may have been deleted; nothing depends on it.
- **Production** gets created at launch in a Supabase organization **both** collaborators belong to, by applying `supabase/migrations/` in order. Then turn on Authentication → Leaked password protection.
- `wya-dev` Auth settings: email confirmation **off**; Site URL `https://wya.expo.app`, redirect `https://wya.expo.app/**`.
- `.env` also has `EXPO_PUBLIC_WEB_URL=https://wya.expo.app`, which is used to build invite links.

## Commands

```bash
npm run dev                       # everything: packages, new migrations, scan function + key, then the web app (scripts/dev.sh)
npm run db:status                 # which migrations wya-dev has / is missing (needs SUPABASE_DB_URL in .env)
npm run db:migrate                # apply the missing ones (scripts/db-migrate.sh; records them in private.wya_migrations)
npm run web                       # dev server (Expo web)
npm run typecheck                 # tsc --noEmit — keep it at zero errors
python3 -I supabase/tests/rls_check.py   # access-control tests against wya-dev (190 checks)
python3 -I supabase/tests/stress_pledges.py  # one event, 30 guests acting at once: pledges + album (needs supabase/seed_stress.sql)
python3 -I supabase/tests/phase8/run.py      # Phase 8 checks, one file per item (--only 8.3, --offline, --strict); lists open decisions
npm run deploy:web                # export → inject link-preview tags → eas deploy --prod
python3 -I scripts/make-brand-images.py  # regenerate og.png, apple-touch-icon.png and the app icon/splash in assets/

# Native (iOS needs Xcode 26.4+, Android needs Android Studio + SDK 36)
npx expo prebuild --clean -p ios     # regenerate ios/ from app.json (also -p android)
LANG=en_US.UTF-8 npx expo run:ios    # build + install + dev server (add --device for a phone, --configuration Release)
npx expo run:android                 # same for Android (--device, --variant release)
npx expo start --dev-client          # dev server only, for an already-installed dev build
```
CocoaPods crashes without a UTF-8 locale (hence `LANG=`). Install Watchman (`brew install watchman`), or Metro can silently stop noticing file changes.

`rls_check.py` logs in as the seed accounts and refuses to run against anything but `wya-dev`. It's safe to re-run: anything it changes, it restores or deletes. **Run it after every database change.**

---

## How we work (conventions to keep)

1. **Database changes = a new file in `supabase/migrations/`** (timestamp prefix, e.g. `20261011000000_name.sql`).
   - **Write migrations to be safe to re-run:** `if not exists`, `drop … if exists` before `create`, `on conflict do nothing`, `create or replace`.
   - Apply to `wya-dev` with the Supabase MCP `apply_migration` (its recorded versions don't match the file names, so `supabase db push` would try to re-run old files). Then add checks to `supabase/tests/rls_check.py` and run it.
   - **`lib/database.sql` is outdated**, kept for reference only. The migrations are the source of truth.
2. **Security model (don't loosen without a reason):**
   - Events are visible only to the **host** and people with an RSVP row (created by `accept_invite`). Logged-out visitors get only `get_invite_preview` (never the address).
   - Policies that need to refer to other tables go through `private.*` helper functions (`is_event_host`, `is_event_guest`, `can_chat`, `shares_event_with`). They're `security definer` with `search_path = ''`, which avoids RLS loops between `events` and `rsvps`. The `private` schema isn't exposed by the API.
   - Anything that has to hide *columns* per viewer goes through a function, because RLS can't do that: `get_guest_list` (notes only for the host), `get_invite_code` (host always; guests only if `allow_guest_invites`), `get_my_chats`, `get_event_addresses` (address: host, non-pledge guests, yes/maybe on pledge events).
   - **`events.address` isn't selectable** (column grants). `select('*')` on events fails: select `EVENT_COLUMNS` and merge addresses with `withAddresses()` (`lib/events.ts`). A new `events` column needs adding to the grant (new migration) and to `EVENT_COLUMNS`.
   - Guests may update **only** `rsvps.status` and `additional_details` (column-level grant). `notifications` rows are written only by triggers; users can only update `read_at`.
   - RSVP status `requested` (Phase 8.1) means "asked to join, waiting for the host": **not a guest** (`is_event_guest`, `shares_event_with`, `get_event_addresses` and event-change notifications all exclude it). Anything new that treats "has an RSVP row" as access must exclude it too.
   - `chat_messages` has a `kind` (Phase 8.0). Clients insert **only** `text` / `image`, and only the columns `event_id, user_id, content, image_path, kind` (column grant: no `data`, no `created_at`). Cards (`poll`, `split`, `plan`) are posted by security-definer functions through `private.post_message`; wya's replies (`bot`) only through `post_bot_message`, which only the service role can call.
   - Storage: users write, update and delete only in their own folder (`avatars/<uid>/…`, `event-images/covers|venues/<uid>/…`). Buckets are public-read by URL; listing is limited to your own folder.
3. **Design system, never raw hex values in screens:**
   - `constants/theme.ts` defines two palettes with the **same role names**:
     - **Light = "Soft pop":** cream `#FFF6EC`, violet primary, tangerine secondary, sunshine highlight, **2px ink outlines + hard offset shadows**.
     - **Dark = "After dark":** `#0B0B0F`, electric lime `#D4FF3F` primary, hot pink secondary, hairlines.
     - The "Glow" redesign (frosted cards, gradients, dashboard Home) was **rolled back on 2026-10-17**; Phase 8 features were restyled to this kit. What it was and what could come back: `docs/PHASE8_CHANGES.md`.
   - Fonts: **Bricolage Grotesque** (display), **DM Sans** (body), via `@expo-google-fonts`.
   - Styles: `const useStyles = makeStyles((t) => ({ … }))` from `hooks/useTheme.tsx`, then `const styles = useStyles()` in the component. Use `theme.type.*`, `Space`, `Radius`, `Fonts`.
   - Use the kit in `components/ui/`: `Button`, `Card`, `Sticker`, `Avatar`/`AvatarStack`, `TextField`, `Segmented`, `Screen` (centered column; pass `maxWidth={MAX_WIDE_CONTENT_WIDTH}` for desktop layouts), `TabScreen` (see 4), `IconButton` (round icon + badge), `CountToggle` (row of chips with counts), `EmptyState`, `EventCover` (photo, or generated art in the event theme), `PressableScale` (anything tappable: spring + haptic + web hover), `Confetti`, `Logo`.
   - **Home** (`app/(tabs)/home.tsx`): "Hey Hannah / Upcoming" header (the title toggles Past), Activity bell, Next up, Needs you, the Invited/Hosting toggle and the event list. Open events (8.7) show "Time TBD"; split debts (8.3) open the pay page.
   - **Event themes** (`constants/eventThemes.ts`: lime, bubblegum, violet, tangerine, ocean, sunset) color an event's cover, stickers and invite. The names must match the `events.theme` check constraint.
4. **Responsive:** `useLayout().isWide` (≥ 1024px) switches to the desktop layouts: sidebar navigation (`components/nav/AppTabBar.tsx`, also `StandaloneSidebar` on event pages), the home grid + side panel, and the two-column event page. Phones keep one column and the floating bottom bar (Events · Chats · + · Photos · You).
   - **Tab pages use `components/ui/TabScreen.tsx`** (not `Screen` + `ScrollView`): on phones it keeps the header clear of the notch with a status-bar strip sized by `useTopInset()` (Dynamic Island tucks 6pt in, notch uses the inset, home-button phones add 8pt; use it for any full-screen page) and pads the end with `useTabBarSpace()` so the last item clears the floating bar. Never hard-code bottom padding for the bar. Pages pushed on top (Activity, edit) pass `withTabBar={false}`. On desktop it adds nothing.
   - The bar is absolutely positioned (the navigator reserves no space for it); its height and offset live in `hooks/useTabBarSpace.ts`.
5. **Cross-platform helpers:** `lib/alert.ts` (`showAlert`, `confirmAction`; `Alert.alert` does nothing on web), `lib/upload.ts` (reads bytes with `expo-file-system` on native and `fetch` on web; the type comes from the picked asset), `lib/haptics.ts` (no-op on web), `hooks/usePageTitle.ts` (browser tab titles).
6. **Voice:** sentence case, plain and friendly copy ("Plans that actually happen.", "Are you coming?", "I'm in"). Comments explain *why*, briefly.
7. **Git:** Abhiram's preference was that **Claude does not run `git add` / `commit` / `push` or open PRs**. Claude prepares the changes, suggests commit groups and writes the PR description, and the human runs them. **Ask your human whether they want the same.** Work happens on feature branches from `main`; one PR per phase.
8. **Before saying something works:** typecheck, run `rls_check.py` if the database changed, and look at it in the browser at phone and desktop widths, in light **and** dark. For anything touching native APIs, layout or text, also check the iOS simulator (iPhone 18 Pro, iOS 27).
9. **Native config lives in `app.json`** (plugins, permissions, icons, splash). `ios/` and `android/` are generated (`npx expo prebuild --clean`) and git-ignored. Brand images come from `scripts/make-brand-images.py`, so don't hand-edit PNGs.
10. **Text styles:** use `theme.type.*` for text. It carries the iOS text-clipping workaround (`TEXT_FIX`, React Native #58970).

---

## Code map

```
app/_layout.tsx            ThemeProvider → AuthProvider → UnreadProvider; auth redirects (returnTo support); root Stack
app/(auth)/                welcome, login, register (AuthShell)
app/(tabs)/                home · chats · create · photos · account   (+ custom tab bar in _layout)
app/(tabs)/photos.tsx      Photos tab: every album you can see (get_my_albums), mosaics, tap → event's Photos tab
app/activity.tsx           Activity, pushed from the bell on Events (no tab bar; Today / Earlier; Mark all read)
app/event/[id].tsx         event page: hero, RSVP card (confetti on "I'm in"), details, guest list, chat (?tab=chat)
app/event/edit/[id].tsx    edit + delete (shares components/EventForm.tsx with create)
app/invite/[code].tsx      public invite preview → sign up / sign in → accept_invite → event
components/                EventForm, GuestList (+ Asking to join), AuthShell, NeedsYou (owe / excuse / Who came? / invite cards), InviteSettings (the form's "Who can get in"), nav/AppTabBar (phone bar + desktop sidebar), ui/*
components/chat/          PollCard, SplitCard (8.3), PlanCard (8.9), ReceiptCard (8.18), SplitPeople (shared share rows): cards in the event chat
app/receipt/[id].tsx       itemised bill (8.18): payer checks the scanned lines; everyone ticks what they had and confirms; payer locks. Listed in the event's Bills tab (components/receipts/BillsTab), not the chat
app/dues.tsx               Your dues (8.18): who you owe / who owes you and why, every event (get_my_dues → components/dues/DuesPanel; also on top of Bills)
lib/billText.ts            typed bills: /bill command + the editor's paste box share this parser
components/receipts/       DraftEditor, ClaimView (8.18); lib/receipts.ts (types, upload, scan call), lib/demoReceipt.ts
components/OpenEventSlots "Find a time" on open events (8.7); InvitePeople (8.8: past people, circles, WhatsApp/SMS); AssistantSwitches (You → wya assistant)
app/pay/[id].tsx           pay page for a debt (8.3): sign-in required; wallet for bills/pledges in dev only (off in the beta; PayID with recipient confirmation replaces it, #40), PayID only for collections
app/collect/[id].tsx       a collection (stage 1.1): progress, people and states; join/pay/leave; organiser confirms, refunds, books; requests (Let in / Decline) and the share link (1.1b)
app/c/[code].tsx           a collection's link (1.1b): the booking page, signed out too; I'm in = a request; Report
components/collect/        CollectForm (the Collect money sheet), CollectCard (+ CollectProgress; event page and chat), PayIdCard
lib/collections.ts         collection types, RPC wrappers, useCollection (live), useMyCollections (Needs you)
lib/links.ts               webUrl(), whatsappUrl(), smsUrl() for hand-offs
components/ui/TabScreen    the shared tab page: notch strip, safe-area + floating-bar padding, keyboard
constants/                 theme.ts, eventThemes.ts
hooks/                     useAuth, useTheme (+makeStyles), useLayout, useUnread, usePageTitle, useTabBarSpace (bar height/offset/padding)
lib/                       supabase client (SecureStore session storage, GET-only retry), types, upload, alert, …
lib/commands.ts            slash commands: the registry (only what works) and the parser (8.2)
lib/realtime.ts            freshChannel(name): a uniquely named Realtime channel (use it for every subscription)
supabase/functions/_shared Edge Function helpers (CORS, not_configured, caller-session client); no functions deployed yet
lib/pledges.ts             pledge types and helpers: Obligation, cutoff maths, money formatting, status styles
lib/payments/              one file per payment provider (payid.ts) behind a PaymentProvider interface (types.ts, index.ts)
components/pledges/        GetPaidCard, PledgeSettings, PledgeNote, PayCard, AttendanceCard, PledgesPanel, Reliability
hooks/useObligations.ts    my open and settled debts (get_my_obligations), reloads on focus
lib/album.ts               album types, shrink + upload (full 1600px + 400px thumb), signed links, delete
lib/savePhoto(.native).ts  Save: browser download on web, photo library on phones (expo-media-library)
components/album/          AlbumTab (Photos tab), PhotoGrid, PhotoViewer (full-screen, swipe)
hooks/useAlbum.ts          get_album + signed links; live inserts/deletes while the tab is open
components/ui/ListSection  collapsible list card that scrolls inside itself, with a full-screen mode (guest lists, Who came?, Pledges)
supabase/migrations/       schema source of truth (apply in order)
supabase/seed.sql          dev-only seed data + test accounts (password is in the file's header comment)
supabase/tests/rls_check.py access-control test suite
supabase/tests/stress_pledges.py  30-guest concurrent pledge + album test (seed: supabase/seed_stress.sql, stress01–30@wya.test)
scripts/                   inject-web-meta.mjs (link previews), make-brand-images.py (og.png, icon)
public/                    og.png, apple-touch-icon.png (copied into the web build)
docs/FEATURES.md           product catalogue, payments reasoning, business model, decision log
docs/PLAN.md               the plan, decisions and results for every phase
docs/PHASE5.md             Phase 5 (native) handoff: changes, test results, next steps
docs/PHASE6.md             Phase 6 (polish) handoff: floating nav, chat images, address gating, test results, follow-ups
docs/PHASE7.md             Phase 7 (phone UI) handoff: TabScreen, nav, Activity bell, Needs you, Photos tab, test clean-up
docs/PHASE8.md             Phase 8 (smart coordination) PLAN: priority order, contracts per item, secrets, open decisions
supabase/tests/phase8/     Phase 8 tests: run.py, one test_8_xx file per item, manual_checklist.md; test_s1_1_collections.py (--only S1.1)
lib/events.ts              EVENT_COLUMNS (every events column except address) + withAddresses()
components/ui/ImageLightbox full-screen swipeable images (venue photos, chat images)
ios/, android/             GENERATED by `npx expo prebuild` from app.json; git-ignored, never edit by hand
website/                   separate Next.js marketing site (waitlist, Vercel analytics). See website/README.md
```

**Seed accounts on wya-dev** (see `supabase/seed.sql`): `host@wya.test` (Hannah, hosts "Seed Dinner Party", invite code `seedinvite`), `guest@wya.test` (Gary, Going), `stranger@wya.test` (Sam, not invited), `joiner@wya.test` (Jo, accepts invites in tests). `newguest@` and `riley@` exist from manual testing.

---

## Where things stand

| Phase | What | Status |
|---|---|---|
| 0 Foundation | Repo tidy, migrations, chat + sign-up trigger fixes, seed | ✅ merged (PR 2) |
| 1 Security | RLS lockdown, invite flow (`invited` status), uploads, web alerts | ✅ merged (PR 3) |
| 2 Host basics | Guest list, remove guest, edit/delete, create-form fixes, web hosting + share links | ✅ merged (PR 4) |
| Design refresh | Soft pop / After dark themes, component kit, event themes, confetti, link previews | ✅ merged (PR 5) |
| R.9 Desktop + nav | Sidebar, desktop layouts, Chats tab, Activity tab (notifications + triggers) | ✅ merged (PR 6) |
| Marketing website | `website/`: landing page, waitlist (Google Form), Vercel analytics | ✅ merged (collaborator) |
| 3 Pledges | I'm in = $5 pledge; flakes pay the host via PayID; excuses; reliability record; Maybes auto-resolve | ✅ merged (PR 10) |
| 4 Shared album | Photos tab: Going guests add photos (private, capped), live grid, viewer, Activity | ✅ merged (PR 11) |
| **5 Native** | SDK 57, generated native folders, iOS + Android on simulators and real phones | **in progress on `phase5`: iOS simulator ✅, brand assets ✅, real iPhone ✅ (Aayush's device); Android next (`docs/PHASE5.md`)** |
| 6 Polish | Floating nav bar, Hosting/Invited sections, address gating, chat images, font consistency | ✅ merged (PRs 13, 14) |
| 7 Phone UI | Overlay tab bar, TabScreen (notch + bar spacing), Photos tab (`get_my_albums`), Activity behind a bell, Hosting/Invited toggle, Needs-you cards, test Activity clean-up | ✅ merged (PR 15); real iPhone + Android passes left (`docs/PHASE7.md`) |
| Glow redesign | Design-board look app-wide (theme + kit), Home dashboard, desktop rail | ↩️ rolled back on `revert-to-phase7-ui` (Phase 7 look, Phase 8 features kept); see `docs/PHASE8_CHANGES.md` |
| **8 Smart coordination** | Open events + availability, slash commands, polls, bill splitting, check-in, nudges, plans, `@wya` assistant, "Ask wya" agent, push, widgets, live location | **🚧 on `phase8a-core`: 8.0 applied (13/13); 8.1 (27/27) + 8.2 (19/19) applied; 8.3–8.9 applied on `phase8a-tier-a` (185/185 across 8.0–8.9; `rls_check.py` 190/190); 8.10–8.17 not started; 33 decisions open (`docs/PHASE8.md`)** |

## Phase 3, pledges: how it works (built 2026-10-11; plan and results in `docs/PLAN.md`, the why in `docs/FEATURES.md`)

- **No money through wya.** Going = a pledge. Only flakes owe, and they pay the host **directly with PayID**. Nobody pays up front. (Pay-up-front "option A" and Stripe card payments are documented for later; **don't build them now**.)
- **Host's PayID lives on their profile** (mobile, email or ABN). It's private: guests see it only through `get_payment_instructions`, and only while they owe that host.
- **Pledge amount:** host sets it per event, **default $5 AUD**. The **cutoff** is host-set (form default: 24 hours before the start). Cancelling before it is free; switching I'm in → Can't go after it is a **late cancellation**, which counts as a flake.
- **The host marks no-shows** ("Who came?") after the event starts. QR/location check-in comes later.
- **"I've paid" is trusted automatically**; the host can dispute it. **Excuses:** the guest submits one, the host accepts (waived) or declines.
- **Unsettled debts:** shown on a **reliability record** to hosts ("came to 9 of 10"), and they **block RSVPs** to that host's events until settled.
- **Maybes:** no pledge; reminded before the cutoff, and **auto-set to Can't go at the cutoff** (`pg_cron`).
- **Build it to extend:**
  - An event `deposit_mode` (`none | pledge`, later `upfront`).
  - One `obligations` table with a single status lifecycle (option A later adds statuses).
  - One file per payment method in `lib/payments/`.
  - All rules in database functions and triggers, covered by `rls_check.py`.
- **Where it lives:**
  - Database: `supabase/migrations/20261011000000_pledges.sql` (tables `payment_methods`, `obligations`; RPCs; triggers; the `wya-pledge-deadlines` pg_cron job, every 15 min).
  - Every rule (block, cutoff, late cancel, who may call what) is enforced there, not in the app.
  - The app calls RPCs only; `obligations` and `payment_methods` have no direct writes.
- **Big guest lists:** `get_guest_list` returns each guest's track record (`reliability`) in the same call. Don't fetch it per guest.
- **Run the stress test and `rls_check.py` one at a time:** both use Hannah's account and would interfere.
- **Payment references** are `WYA-` + 6 hex characters.
- **Clipboard:** `expo-clipboard` (copy PayID and reference).
- **Business model:** stay free while proving pledges work. wya can't take a cut of PayID transfers; the options are in `docs/FEATURES.md`.

## Phase 8, smart coordination: the rules (in progress; status and details in `docs/PHASE8.md`)

- **Applying migrations:** if your session has the Supabase MCP, use `apply_migration` as usual. Otherwise (as in the session that wrote 8.0), the human pastes the file into the wya-dev SQL Editor and runs it, then runs the checks and pastes the output back. Always confirm a migration is applied before trusting its checks: a missing column or function used to make "can't do X" checks pass by accident. Use `h.refused()` in the Phase 8 tests, not `h.denied()`.

- **Build order** is in `docs/PHASE8.md` §2. Tier A (8.0–8.9) needs no new accounts or keys; the assistant (B), lookups (C), push/widgets (D) and live location/calendar (E) come after.
- **The model proposes, people approve.** The assistant has no send or execute tools: invites, debts, event changes and anything sent outside wya need the person's tap (`agent_actions`: `proposed → approved → executed`). WhatsApp and SMS go through the share sheet / composer on the phone; wya can't read WhatsApp groups.
- **Still no money through wya.** Bill splits reuse `obligations` (`kind = 'split'`) and PayID; only **pledge** debts block RSVPs. There's no standard prefilled PayID link, so the pay page offers Copy all + bank-app shortcuts; PayTo isn't built.
- **Assistant context never includes an address or a PayID**, and chat text is untrusted input.
- **Secrets** (full table in `docs/PHASE8.md` §3): `OPENAI_API_KEY` (8.10, 8.11; the AI provider is **OpenAI**, models set by `OPENAI_MODEL` / `OPENAI_MODEL_FAST`, all calls through `supabase/functions/_shared/llm.ts`), `GOOGLE_PLACES_API_KEY` (8.12), a showtimes source (decision SHOW-1), `PUSH_WEBHOOK_SECRET` (+ optional `EXPO_ACCESS_TOKEN`) for push, an **Apple Developer account + APNs key** (iOS push, Live Activities) and a **Firebase project** (Android push). They go in **Supabase Edge Function secrets** (`npx supabase secrets set … --project-ref gvfcjxldokhodgnmmqar`) or EAS credentials. **Never** in `.env` (committed), `EXPO_PUBLIC_*` (bundled into the app), `app.json`, migrations or tests. Functions with a missing secret answer 503 `not_configured`, which the tests report as 🔒 BLOCKED.
- **Tests:** `supabase/tests/phase8/run.py` finds an item by its migration slug or function folder, so name files exactly as the plan says. The contracts in the plan are what the tests check; change both together. Open decisions are read from the table in `docs/PHASE8.md` §6: mark a row `decided` once agreed. Run it on its own, like the other test scripts.

## Other open items

- **Supabase advisor warnings** about `security definer` functions callable by signed-in users are expected: those are our RPCs, each checks the caller itself. `process_pledge_deadlines()` is callable on purpose (it only acts on what is already due; the tests use it).
- **`.claude/launch.json`** has two entries: `website` (the collaborator's Next.js site) and `wya-web` (the Expo app on port 8081).
- **Native:** iOS simulator ✅, brand assets ✅, real iPhone tested ✅ (Aayush's device, iOS 26.6.2). Two bugs found and fixed: venue photos now tappable (lightbox viewer), event page switched to `expo-image` for faster cached loading. Android is next; see `docs/PHASE5.md` §3.3.
- **Phase 6 (polish):** floating nav bar pill (+ button centered), Hosting/Invited home sections, address gated on pledge events (in the database), chat image sharing + full-screen viewer, `sectionHeading` type scale. Migrations `20261012000100_chat_images` and `20261012000200_address_gating` are applied to `wya-dev`. Left: real iPhone, Android, and follow-ups (shrink chat images, clean up chat images when an event is deleted). See `docs/PHASE6.md`.
- **Phase 7 (phone UI):** see `docs/PHASE7.md`. New migrations `20261013000000_my_albums` and `20261013000100_test_notification_cleanup` are applied to `wya-dev`. `clear_test_notifications(p_since)` only works for `@wya.test` accounts and only deletes the caller's own test items; the test scripts call it at the end. Opening Activity no longer marks everything read (tap an item, or Mark all read).
- **Universal links** (invite links opening the iOS app) need an Apple Developer account; deferred to the App Store launch.
- **Per-event link previews** ("Hannah invited you to Rooftop Night" with the cover) need `web.output: "server"`. Right now every link shows the same branded card.
- **`website/`** copies the app's palettes and fonts into `website/src/app/globals.css` and `website/src/lib/fx.ts`. If `constants/theme.ts` or `constants/eventThemes.ts` change, update the website too. It has its own `package.json` and no Supabase access.
- Known harmless console warnings on web: `shadow*` / `pointerEvents` deprecation, from navigation-library internals, not our code.

## Gotchas we hit (so you don't repeat them)

- Supabase auth triggers run with the auth service's `search_path`. **Always schema-qualify** (`public.profiles`) and set `search_path = ''` on `security definer` functions.
- In PL/pgSQL, `text[] || 'literal'` is a *malformed array literal*. Use `array_append`.
- Changing a function's `returns table (...)` columns needs `drop function` first (`create or replace` fails).
- PostgREST can only embed (`select('*, profile:profiles(*)')`) along a **foreign key to that table**. `chat_messages.user_id` and `rsvps.user_id` have extra FKs to `profiles` for this.
- The `single` web build ignores `app/+html.tsx`. Head tags are injected by `scripts/inject-web-meta.mjs` instead.
- On web, image-picker URIs are `blob:` URLs. Never take the file extension from the URI; `lib/upload.ts` uses the asset's `mimeType`.
- On web, a Reanimated `entering` animation goes invisible if the animated view's style changes mid-animation. Put layout styles (like a computed width) on a plain wrapper `View`.
- `.single()` returns a 406 error when there's no row. Use `.maybeSingle()` for "might not exist" reads.
- **Storage only deletes files you can also see** (the select policy applies to deletes). That's why the album's select policy always lets uploaders see their own files. Deleting rows from `storage.objects` in SQL is blocked (it would orphan the real files).
- Storage policies see every bucket's rows, so never cast a path segment straight to `uuid` in a policy. Use `private.album_event(name)`, which returns null instead of erroring.
- Realtime `DELETE` events can't be filtered by column, and only carry the primary key. `useAlbum` drops deleted photos by id.
- **Realtime channel names must be unique per subscription:** `supabase.channel(name)` hands back a still-registered channel with that name, and `removeChannel()` finishes later, so a quick re-subscribe threw "cannot add `postgres_changes` callbacks … after `subscribe()`". Always use `freshChannel()` from `lib/realtime.ts`.
- There's no SVG or text-masking library in the app. npm installs may be blocked in sandboxed sessions, so don't plan on adding one casually.
- **Testing in the browser pane:** while the pane reports `document.hidden`, CSS animations pause, so React Native Web `Modal`s never finish sliding/fading in or out, and screenshots can go stale. Use `zoom` captures (or nudge the viewport size) and check the DOM. On web the image picker opens its file input with a dispatched click event, which a test can intercept to supply files.
- **Fonts on phones:** text drawn before a font loads keeps the system font. `app/_layout.tsx` holds the splash until fonts load (phones only).
- **React Native #58970 (iOS):** a wrapped Text can have its last line clipped depending on where it sits in a long scroll. The workaround is `paddingBottom: 0.01` (`TEXT_FIX` in `constants/theme.ts`). Remove it once the upstream fix ships.
- **iOS 18.4 simulator + Xcode 27:** Supabase requests hang after a relaunch because of HTTP/3 (QUIC) caching. Test on the iOS 27 simulator; it's not an app bug.
- SDK 57 replaces the global `fetch` with `expo/fetch` on native (opt out with `EXPO_PUBLIC_USE_RN_FETCH=1`).
- Android dialogs (`Alert`) show at most 3 buttons; extra ones are silently dropped. Don't build 4-option alerts.
- The iOS date picker spinner fires `onValueChange` on every wheel move, so don't close it there. Close on Done (`components/EventForm.tsx`).
