@AGENTS.md

# wya — context for Claude

You're picking up wya mid-flight. This file is the handoff: what the app is, how it's built, the rules we work by, where things stand, and what's next. Two more docs to read before planning anything big:
- **`docs/FEATURES.md`**: the product catalogue (live / in progress / planned / decided against), the payments reasoning, the business model, and a decision log.
- **`docs/PLAN.md`**: build history, technical plans and test results per phase.

_Last updated: 2026-10-11, after the payments pivot (Phase 3 = pledges via PayID) and the marketing website (PRs 7–8)._

---

## What wya is

An RSVP app built so **an RSVP means something**. Hosts over-prepare for guests who flake at the last minute (invite 30, cook for 30, 10 show up). The core idea, being built in Phase 3: saying "I'm in" is a **pledge** ("if I don't show, I'll pay the host $5"). Show up and nothing happens. Flake without an excuse the host accepts, and you pay the host **directly with PayID**. **wya never touches the money**, which keeps friction (and payments licensing) out of it. Australia first. Everything else (invites, guest list, chat, the event page as "the one place for the event") supports that commitment.

The app has **no real users yet**. It's in development, so breaking schema changes are fine as long as the app and the migration ship together.

## Stack

- **Expo SDK 56** (React Native 0.85, React 19, Expo Router, TypeScript). **Read the versioned docs at https://docs.expo.dev/versions/v56.0.0/ before using any Expo API** (see `AGENTS.md`). Things have changed from older SDKs.
- **Supabase**: Postgres with row-level security, Auth (email + password), Storage, Realtime.
- **Web** is a first-class target: hosted at **https://wya.expo.app** (EAS Hosting, `web.output: "single"`). Most guests first meet wya through an invite link on the web.
- iOS is supported in code but **hasn't been tested yet** (the original dev machine had no full Xcode). Android isn't a focus yet.

## Environments

- **One Supabase project: `wya-dev`** (ref `gvfcjxldokhodgnmmqar`, us-east-1). The tracked `.env` points at it (publishable keys only, which is fine to commit). The original production project (`nackffabsuzameyrpuks`) may have been deleted; nothing depends on it.
- **Production** gets created at launch in a Supabase organization **both** collaborators belong to, by applying `supabase/migrations/` in order. Then turn on Authentication → Leaked password protection.
- `wya-dev` Auth settings: email confirmation **off**; Site URL `https://wya.expo.app`, redirect `https://wya.expo.app/**`.
- `.env` also has `EXPO_PUBLIC_WEB_URL=https://wya.expo.app`, which is used to build invite links.

## Commands

```bash
npm run web                       # dev server (Expo web)
npm run typecheck                 # tsc --noEmit — keep it at zero errors
python3 -I supabase/tests/rls_check.py   # access-control tests against wya-dev (72 checks)
npm run deploy:web                # export → inject link-preview tags → eas deploy --prod
python3 -I scripts/make-brand-images.py  # regenerate public/og.png + apple-touch-icon.png
```

`rls_check.py` logs in as the seed accounts and refuses to run against anything but `wya-dev`. It's safe to re-run: anything it changes, it restores or deletes. **Run it after every database change.**

---

## How we work (conventions to keep)

1. **Database changes = a new file in `supabase/migrations/`** (timestamp prefix, e.g. `20261011000000_name.sql`).
   - **Write migrations to be safe to re-run:** `if not exists`, `drop … if exists` before `create`, `on conflict do nothing`, `create or replace`.
   - Apply to `wya-dev` (the Supabase MCP `apply_migration`, or `supabase db push`). Then add checks to `supabase/tests/rls_check.py` and run it.
   - **`lib/database.sql` is outdated**, kept for reference only. The migrations are the source of truth.
2. **Security model (don't loosen without a reason):**
   - Events are visible only to the **host** and people with an RSVP row (created by `accept_invite`). Logged-out visitors get only `get_invite_preview` (never the address).
   - Policies that need to refer to other tables go through `private.*` helper functions (`is_event_host`, `is_event_guest`, `can_chat`, `shares_event_with`). They're `security definer` with `search_path = ''`, which avoids RLS loops between `events` and `rsvps`. The `private` schema isn't exposed by the API.
   - Anything that has to hide *columns* per viewer goes through a function, because RLS can't do that: `get_guest_list` (notes only for the host), `get_invite_code` (host always; guests only if `allow_guest_invites`), `get_my_chats`.
   - Guests may update **only** `rsvps.status` and `additional_details` (column-level grant). `notifications` rows are written only by triggers; users can only update `read_at`.
   - Storage: users write, update and delete only in their own folder (`avatars/<uid>/…`, `event-images/covers|venues/<uid>/…`). Buckets are public-read by URL; listing is limited to your own folder.
3. **Design system, never raw hex values in screens:**
   - `constants/theme.ts` defines two palettes with the **same role names**:
     - **Light = "Soft pop":** cream `#FFF6EC`, violet primary, tangerine secondary, sunshine highlight, **2px ink outlines + hard offset shadows**.
     - **Dark = "After dark":** `#0B0B0F`, electric lime `#D4FF3F` primary, hot pink secondary, hairlines.
   - Fonts: **Bricolage Grotesque** (display), **DM Sans** (body), via `@expo-google-fonts`.
   - Styles: `const useStyles = makeStyles((t) => ({ … }))` from `hooks/useTheme.tsx`, then `const styles = useStyles()` in the component. Use `theme.type.*`, `Space`, `Radius`, `Fonts`.
   - Use the kit in `components/ui/`: `Button`, `Card`, `Sticker`, `Avatar`/`AvatarStack`, `TextField`, `Segmented`, `Screen` (centered column; pass `maxWidth={MAX_WIDE_CONTENT_WIDTH}` for desktop layouts), `EmptyState`, `EventCover` (photo, or generated art in the event theme), `PressableScale` (anything tappable: spring + haptic + web hover), `Confetti`, `Logo`.
   - **Event themes** (`constants/eventThemes.ts`: lime, bubblegum, violet, tangerine, ocean, sunset) color an event's cover, stickers and invite. The names must match the `events.theme` check constraint.
4. **Responsive:** `useLayout().isWide` (≥ 1024px) switches to the desktop layouts: sidebar navigation (`components/nav/AppTabBar.tsx`, also `StandaloneSidebar` on event pages), the home grid + side panel, and the two-column event page. Phones keep one column and the five-tab bottom bar.
5. **Cross-platform helpers:** `lib/alert.ts` (`showAlert`, `confirmAction`; `Alert.alert` does nothing on web), `lib/upload.ts` (reads bytes with `expo-file-system` on native and `fetch` on web; the type comes from the picked asset), `lib/haptics.ts` (no-op on web), `hooks/usePageTitle.ts` (browser tab titles).
6. **Voice:** sentence case, plain and friendly copy ("Plans that actually happen.", "Are you coming?", "I'm in"). Comments explain *why*, briefly.
7. **Git:** Abhiram's preference was that **Claude does not run `git add` / `commit` / `push` or open PRs**. Claude prepares the changes, suggests commit groups and writes the PR description, and the human runs them. **Ask your human whether they want the same.** Work happens on feature branches from `main`; one PR per phase.
8. **Before saying something works:** typecheck, run `rls_check.py` if the database changed, and look at it in the browser at phone and desktop widths, in light **and** dark.

---

## Code map

```
app/_layout.tsx            ThemeProvider → AuthProvider → UnreadProvider; auth redirects (returnTo support)
app/(auth)/                welcome, login, register (AuthShell)
app/(tabs)/                home · chats · create · activity · account   (+ custom tab bar in _layout)
app/event/[id].tsx         event page: hero, RSVP card (confetti on "I'm in"), details, guest list, chat (?tab=chat)
app/event/edit/[id].tsx    edit + delete (shares components/EventForm.tsx with create)
app/invite/[code].tsx      public invite preview → sign up / sign in → accept_invite → event
components/                EventForm, GuestList, AuthShell, nav/AppTabBar, ui/*
constants/                 theme.ts, eventThemes.ts
hooks/                     useAuth, useTheme (+makeStyles), useLayout, useUnread, usePageTitle
lib/                       supabase client (SecureStore session storage, GET-only retry), types, upload, alert, …
supabase/migrations/       schema source of truth (apply in order)
supabase/seed.sql          dev-only seed data + test accounts (password is in the file's header comment)
supabase/tests/rls_check.py access-control test suite
scripts/                   inject-web-meta.mjs (link previews), make-brand-images.py (og.png, icon)
public/                    og.png, apple-touch-icon.png (copied into the web build)
docs/FEATURES.md           product catalogue, payments reasoning, business model, decision log
docs/PLAN.md               the plan, decisions and results for every phase
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
| **3 Pledges** | I'm in = $5 pledge; flakes pay the host via PayID; excuses; reliability record; Maybes auto-resolve | **next — planned in detail in `docs/PLAN.md`, not started** |
| 4 Shared album | Guests upload event photos into one gallery | outlined |

## What's next: Phase 3, pledges (decided 2026-10-11; full plan in `docs/PLAN.md`, the why in `docs/FEATURES.md`)

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
- **Business model:** stay free while proving pledges work. wya can't take a cut of PayID transfers; the options are in `docs/FEATURES.md`.

## Other open items

- **iOS:** never run on a simulator or device. Needs full Xcode (`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`), then `npx expo run:ios`. Check haptics, the SecureStore session, the image picker → upload, and the date pickers.
- **Universal links** (invite links opening the iOS app) need an Apple Developer account; deferred to the App Store launch.
- **Per-event link previews** ("Hannah invited you to Rooftop Night" with the cover) need `web.output: "server"`. Right now every link shows the same branded card.
- **Before store submission:** remove `android.permission.RECORD_AUDIO` from `app.json` (added by the image picker plugin; wya doesn't record video).
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
