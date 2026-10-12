# Phase 6: Polish and access rules (handoff)

_Last updated: 2026-10-12. Read `CLAUDE.md` and `docs/PHASE5.md` first for full context._

**Branch:** the first Phase 6 pass merged with `phase5` (PR 13); fixes and the items below are on `phase6-fixes`.

---

## Status (2026-10-12, `phase6-fixes`)

- **Database is up to date on `wya-dev`.** Both Phase 6 migrations are applied (via the Supabase MCP):
  `20261012000100_chat_images.sql` and `20261012000200_address_gating.sql`.
  The old `20261012000000_chat_images.sql` was deleted: it shared its version with the album migration and used
  `create policy if not exists`, which Postgres doesn't have.
- `rls_check.py`: **177 checks pass** (156 before + 9 chat images + 12 address gating). `stress_pledges.py` passes.
- Web (phone 375 + desktop 1280, light + dark) and the iOS simulator (iPhone 18 Pro, iOS 27) checked; results in §3.
- Remaining: real iPhone, Android (no SDK on this Mac yet), and the follow-ups in §4.

## 1. What changed this phase

### 1.1 Floating bottom nav bar (`components/nav/AppTabBar.tsx`)

The bottom tab bar now floats above screen content as a rounded pill:
- Wrapped in a transparent outer `View` (provides safe-area padding; `pointerEvents: 'box-none'` so touches in the gap behind the bar reach the scroll content).
- The bar itself: `borderRadius: Radius.xl`, `borderWidth` + `borderColor` ink outline, `t.shadow(4)` hard offset drop shadow.
- No flat `borderTopWidth` — replaced entirely by the outline + shadow.
- The **+ (create) button** is centered inside the bar — removed the old `marginTop: -22` that was popping it above the bar. Now a clean 48×48 circle sitting flush with the other tabs.
- Desktop sidebar: **unchanged**.

### 1.2 Home screen — Hosting / Invited sections (`app/(tabs)/home.tsx`)

The flat event list now splits into two labelled sections:
- **Hosting** — events the signed-in user created.
- **Invited** — events where they have any RSVP (any status, not host).
- "Hosting" always renders on Upcoming (even when empty, with a "Plan an event" call to action).
- "Invited" only shows if there are events to show.
- If both are empty: single combined empty state (unchanged behaviour).
- Past tab: same two-section layout, most-recent-first sort.
- Desktop `isWide` layout: sections appear in the main column; aside panel (Next up, Needs answer, etc.) unchanged.

### 1.3 Address gating on pledge events (`app/event/[id].tsx`, `app/(tabs)/home.tsx`)

**Rule:** full address only visible to guests who have committed (`yes` or `maybe`). Hosts always see it. Non-pledge events: unaffected.

For guests with status `invited` or `no` on a pledge event:
- Event page: InfoRow shows "Address hidden" / "RSVP to see the address", no Directions button.
- Home card: shows venue name if set, otherwise "Address hidden".

**Enforced by the database** (`20261012000200_address_gating.sql`), not just hidden in the UI:
- `select` on `events.address` is revoked: `authenticated` gets a column-level grant on every other column, `anon` gets nothing.
  So `select('*')` on events now fails; the app selects `EVENT_COLUMNS` from `lib/events.ts`.
- `get_event_addresses(p_event_ids uuid[])` (security definer) returns the address only to the host, any guest on a
  non-pledge event, and yes/maybe guests on a pledge event. `withAddresses()` in `lib/events.ts` merges it in;
  `event.address` is `null` when hidden, and the UI keys off that.
- Writes are unchanged (hosts insert/update `address` as before). Inserts that return rows must ask for specific
  columns (`create.tsx` uses `.select('id')`; the test scripts use `?select=id`).
- **A new `events` column must be added to the grant in that migration's pattern (a new migration) and to `EVENT_COLUMNS`**,
  or nobody can read it.

### 1.4 Chat image sharing (`app/event/[id].tsx` + migration)

Guests who can chat can now share images, like any other messenger:
- Image attach button (📷 icon) to the left of the text input.
- Tapping opens the image picker (library only, single image).
- Image is uploaded to `event-images/chat/<uid>/<timestamp>.<ext>` with `uploadImageToPath` (`lib/upload.ts`).
- Message is inserted with `content: null, image_path: <path>`; if the insert fails the uploaded file is removed.
- Image messages render as a 200×200 `expo-image` bubble (public URL built from the path).
- **Tapping an image opens a full-screen viewer** (`components/ui/ImageLightbox.tsx`, shared with the venue photos):
  swipe between every image in the chat; arrows on wide screens.
- While uploading the button shows a spinner; errors surface via `showAlert`.

Migration: `supabase/migrations/20261012000100_chat_images.sql`
- `chat_messages.content` nullable; `image_path text` added (the path, not a URL, so the database can check it).
- Checks: every message has non-blank text or an image; `image_path` must be in the sender's own `chat/<uid>/` folder.
- Storage insert policy for `event-images/chat/<uid>/`; the existing "delete own event images" policy covers deletes.
- `get_my_chats` previews an image-only last message as "📷 Photo".

### 1.5 Font / type-scale consistency (`constants/theme.ts` + screens)

- Added `sectionHeading` to the theme type scale: Bricolage Grotesque 16px, −0.3 letter-spacing. Use this for content section headers ("About", "Guests", "Hosting", "Invited").
- Swapped all within-screen content section headers from `theme.type.label` (all-caps 11px) to `theme.type.sectionHeading` — gives them the display-font character of the rest of the UI.
- Card-internal field labels ("Settle up", "Next up", "Latest") **kept as `label`** — appropriate at that scale inside a card.

### 1.6 Other visual fixes (also in this phase)

| Fix | File |
|---|---|
| Dark mode outline lightened `#2A2A36` → `#4A4A5E` (was nearly invisible) | `constants/theme.ts` |
| RSVP active button icon/text changed from dark ink (`c.onStatus`) to `#FFFFFF` — fixes orange-looking "Can't go" icon | `app/event/[id].tsx` |
| Venue photos now tappable — opens full-screen swipeable lightbox | `app/event/[id].tsx` |
| Event page switched from RN `Image` to `expo-image` (disk cache, faster decode) | `app/event/[id].tsx` |
| Light / dark theme mirrored — all `isDark ? {} : outline` patterns removed; both themes use the same border and shadow rules | multiple files |

---

## 2. Files changed this phase

| File | What changed |
|---|---|
| `components/nav/AppTabBar.tsx` | Floating pill bar; + button centered inside bar |
| `app/(tabs)/home.tsx` | Hosting / Invited sections; `canSeeAddress` for pledge events on home card |
| `app/event/[id].tsx` | `canSeeAddress` flag + hidden address copy; chat image pick/upload/render; venue lightbox; `expo-image`; `sectionHeading` for section headers |
| `constants/theme.ts` | `sectionHeading` type; dark outline `#4A4A5E`; `shadow()` helper; `outlineWidth: 2` both themes |
| `components/ui/Card.tsx` | `t.shadow(4)` on raised cards both themes |
| `components/ui/Button.tsx` | `t.shadow(3)` on filled buttons both themes |
| `app/(auth)/welcome.tsx` | `t.shadow(4)` on tile covers |
| `app/invite/[code].tsx` | `t.shadow(5)` on cover; date block border both themes |
| `supabase/migrations/20261012000100_chat_images.sql` | Applied. `image_path`, nullable `content`, body/ownership checks, storage policy, `get_my_chats` photo preview |
| `supabase/migrations/20261012000200_address_gating.sql` | Applied. Revokes `events.address` select; `get_event_addresses` RPC |
| `lib/events.ts` | New: `EVENT_COLUMNS` and `withAddresses()` |
| `lib/upload.ts` | `uploadImageToPath` (returns the storage path) |
| `lib/types.ts` | `Event.address` nullable (hidden); `ChatMessage.content` nullable + `image_path` |
| `components/ui/ImageLightbox.tsx` | New: full-screen swipeable viewer (venue photos + chat images) |
| `app/(tabs)/create.tsx`, `app/event/edit/[id].tsx` | Select explicit columns; edit loads the address through the RPC |
| `supabase/tests/rls_check.py` | Chat images (9) and address gating (12) checks; event writes return `select=id` |
| `supabase/tests/stress_pledges.py` | Event writes return `select=id` (address isn't selectable) |
| `supabase/tests/native_checklist.md` | Phase 5 real-iPhone results; Phase 6 test cases |
| `docs/PHASE6.md` | This file |
| `docs/PHASE5.md` | §2b real-iPhone results; §3.2 marked done |
| `CLAUDE.md` | Status table, open items, last-updated line |

---

## 3. Testing and what's left

### Done ✅
- **Database:** both migrations applied to `wya-dev`; `rls_check.py` 177/177; `stress_pledges.py` passes. Typecheck clean.
- **Web**, phone (375 wide) and desktop (1280), light and dark, as `host@`, `guest@` and with a pledge test event:
  - Floating pill nav bar with the + centered; content clears it at the bottom of the list. Desktop sidebar unchanged.
  - Home: Hosting (with the "Plan an event" empty state for Gary) and Invited sections; badges right.
  - Address: hidden for an invited guest on a pledge event (home card + event page), shown after Maybe, hidden again
    after Can't go, shown after I'm in, all without a reload. Host sees it; the edit form loads it.
  - Chat images: send (picker intercepted with a generated JPEG), display for sender and others, mixed with text;
    viewer opens on the tapped image, swipe/arrows between images. Chats tab shows "You: 📷 Photo".
  - Section headings ("Hosting", "Invited", "Who's going") in Bricolage Grotesque.
- **iOS simulator** (iPhone 18 Pro, iOS 27; dev build via `npx expo run:ios --no-bundler` against the running Metro):
  - Nav bar sits above the home indicator, not clipped.
  - Address hidden after Can't go, back with Directions after I'm in.
  - Chat: images from web visible; viewer opens and swipes; picked a library photo (system picker, no permission
    prompt needed) and it uploaded and displayed.

### Bugs found and fixed
- Own image messages: the time label used `onPrimary` (meant for the purple bubble) on a transparent image bubble,
  so it was nearly invisible on the cream background.
- Test helpers would have broken with address gating (`select=*` / `return=representation` on events); fixed.

### Still to do
1. **Real iPhone** (Abhiram's device): steps in `docs/PHASE5.md` §2b / §3.2, plus the Phase 6 checklist.
2. **Android**: Android Studio / SDK 36 / emulator aren't installed on this Mac. Steps in `docs/PHASE5.md` §3.3.
3. Post-cutoff checks 19–22 in `supabase/tests/native_checklist.md` weren't re-run by hand (the database rules are
   covered by `rls_check.py`). Not an issue: a late canceller has an open debt that blocks re-RSVP, and anyone else
   saying I'm in after the cutoff makes a real pledge.

## 4. Known follow-ups (not blockers)

- **Chat images aren't shrunk.** A simulator library photo uploaded at 1.5 MB. Reuse the album's resize
  (`lib/album.ts`, 1600px) before `uploadImageToPath`.
- **Chat images outlive their event.** Deleting an event deletes the messages, but the files in `chat/<uid>/` stay,
  and only the sender can delete them (storage policy). A cleanup needs a security-definer path or an Edge Function.
- **Raw `#FFFFFF`** in `RsvpChoice` (`app/event/[id].tsx`) for the active button's icon/text: add a theme role
  (e.g. `onStatusStrong`) instead.
- **Upload "Preparing…" state:** 1–2s gap before "Uploading…" shows on iOS while the asset is prepared.
- **Per-event link previews:** still needs `web.output: "server"`. Currently every invite link shows the same branded card.
- **Migration history:** migrations applied through the Supabase MCP are recorded under the time they were applied
  (e.g. `20261012081527 address_gating`), not the file's timestamp, so `supabase db push` against `wya-dev` would try
  to re-run files. Keep applying with the MCP `apply_migration` (or repair the history) until that's sorted.
