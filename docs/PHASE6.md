# Phase 6: Polish and access rules (handoff)

_Last updated: 2026-10-12. Read `CLAUDE.md` and `docs/PHASE5.md` first for full context._

**Branch:** `phase5` (all Phase 6 work is on this branch alongside Phase 5).

---

## ⚠️ Before you start — one pending action

**The chat images migration has NOT been applied to `wya-dev` yet.**
File: `supabase/migrations/20261012000000_chat_images.sql`

This must be applied before chat image sending will work. Everything else in this phase runs without it.

```bash
# Apply the migration (run from the repo root):
npx supabase db push
```

Then run the access-control tests to confirm nothing regressed:
```bash
python3 -I supabase/tests/rls_check.py
```

---

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
- Gate is UI-only (no DB change). See §3 follow-ups if DB-level gating is needed later.

### 1.4 Chat image sharing (`app/event/[id].tsx` + migration)

Guests who can chat can now share images, like any other messenger:
- Image attach button (📷 icon) to the left of the text input.
- Tapping opens the image picker (library only, single image).
- Image is uploaded to `event-images/chat/<uid>/<timestamp>` via the existing `uploadImage` util.
- Message is inserted with `content: null, image_url: <url>` (migration makes `content` nullable).
- Image messages render as a 200×200 `expo-image` bubble (cached, hardware-accelerated decode).
- While uploading the button shows a spinner; errors surface via `showAlert`.
- **Requires the migration to be applied** (see ⚠️ above).

Migration: `supabase/migrations/20261012000000_chat_images.sql`
- `chat_messages.content` made nullable.
- `chat_messages.image_url text` column added.
- Storage policies added for `event-images/chat/<uid>/` (insert + delete own files).

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
| `supabase/migrations/20261012000000_chat_images.sql` | **Pending** — adds `image_url`, makes `content` nullable, storage policies |
| `supabase/tests/native_checklist.md` | Phase 5 real-iPhone results; Phase 6 test cases |
| `docs/PHASE6.md` | This file |
| `docs/PHASE5.md` | §2b real-iPhone results; §3.2 marked done |
| `CLAUDE.md` | Status table, open items, last-updated line |

---

## 3. What still needs doing — in order

### Step 1: Apply the migration ⚠️
```bash
npx supabase db push
python3 -I supabase/tests/rls_check.py   # confirm all 156 checks pass
```

### Step 2: Test on web
```bash
npm run web
```
Use the Phase 6 checklist in `supabase/tests/native_checklist.md`. Check:
- Floating nav bar (pill shape, shadow, + button centered) at phone width.
- "Hosting" / "Invited" sections on the home screen.
- Address hidden on pledge events for non-committed guests.
- Chat images: pick, upload, display.
- Font consistency (section headings use Bricolage Grotesque, not all-caps caps).
- Both light and dark theme.
- Desktop layout unaffected.

### Step 3: Test on iOS simulator
```bash
npx expo prebuild --clean -p ios   # only needed if app.json / plugins changed
LANG=en_US.UTF-8 npx expo run:ios
```
Run the Phase 6 checklist items. Key things to confirm on native:
- Floating nav bar renders correctly (not clipped by home indicator).
- Image picker in chat works (library permission).
- Image upload + display in a chat message.

### Step 4: Test on real iPhone
Hotspot setup (university WiFi blocks device-to-device):
```bash
# Connect Mac to iPhone hotspot; find the hotspot IP with ipconfig getifaddr en0
REACT_NATIVE_PACKAGER_HOSTNAME=<hotspot-ip> LANG=en_US.UTF-8 npx expo run:ios --device
```
Full setup in `docs/PHASE5.md` §2b.

### Step 5: Close the post-cutoff loophole (check the DB)
In `supabase/migrations/20261011000000_pledges.sql`, find the RSVP update function/trigger.
**Verify:** does it block a `no → yes` status change after the cutoff? If not, a guest could flip back to "going" after the cutoff to see the address.
If the loophole is open, write a new migration to enforce it, add a test to `rls_check.py`, and apply.

### Step 6: Android (from Phase 5)
Full steps in `docs/PHASE5.md` §3.3. Also run Phase 6 checklist Android items.

---

## 4. Known follow-ups (not blockers)

- **Upload "Preparing…" state:** 1–2s gap before "Uploading…" shows on iOS while the asset is prepared. Consider showing "Preparing…" in `EventForm.tsx` immediately after the picker closes.
- **Address at DB level:** current gate is UI-only. If it needs to be enforced at the DB (e.g. to prevent API scraping), add a view or RPC that strips `address` from `events` rows for non-committed guests on pledge events.
- **Chat image full-screen viewer:** currently chat images are 200×200 in the bubble. A tap-to-expand lightbox (like the venue photo lightbox) would match the album viewer experience.
- **Per-event link previews:** still needs `web.output: "server"`. Currently every invite link shows the same branded card.
