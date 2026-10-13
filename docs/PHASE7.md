# Phase 7: Phone UI polish (handoff)

_Last updated: 2026-10-13. Read `CLAUDE.md` and `docs/PHASE6.md` first._

**Branch:** `phase7-ui` (from `main` after PR 14). Designs: the approved mockups (Events light/dark, scrolled,
Activity, Photos) from the 2026-10-13 design pass.

---

## Status

- **Database:** two new migrations, both applied to `wya-dev` with the Supabase MCP:
  `20261013000000_my_albums.sql` and `20261013000100_test_notification_cleanup.sql`.
- `rls_check.py`: **190 checks pass** (177 + 9 Photos tab + 4 test clean-up). `stress_pledges.py`: **52 checks pass**,
  and it now clears its own Activity items.
- Typecheck clean. Web (375 and 1280, light and dark) and the iOS simulator (iPhone 18 Pro, iOS 27) checked; see §3.
- Left: a real iPhone pass (the bar position over the home indicator was tuned on the simulator) and Android.

## 1. What changed

### 1.1 The bottom bar really floats (`components/nav/AppTabBar.tsx`, `hooks/useTabBarSpace.ts`)
- The custom tab bar was a normal flex child of the Tabs navigator, so the navigator gave it its own strip of the
  screen: pages were clipped at the bar's top edge and you saw a divider. Its root view is now
  `position: 'absolute'` (left/right `Space.lg`), so the navigator reserves nothing; pages scroll behind the bar and
  show around its rounded ends. `pointerEvents: 'box-none'` (in the style, not the deprecated prop) keeps the gaps
  tappable.
- Height 68 (`TAB_BAR_HEIGHT`), a pill radius, `+` button 52pt, as in the mockup.
- **Position:** `useTabBarOffset()` = `max(insets.bottom - 12, Space.sm)`: 22pt on a Dynamic Island iPhone (inside the
  home-indicator area, where iOS's own floating bars sit), 8pt on web.
- **`useTabBarSpace()`** = bar + offset + `Space.xl` (24pt gap). Every tab page pads its scroll content with it, which
  replaces the old hard-coded `paddingBottom: 120`. Desktop returns `Space.xxxl` (there's a sidebar, no bar).

### 1.2 Tab pages respect the notch (`components/ui/TabScreen.tsx`)
One wrapper for every tab page (and the pages that look like one). On phones it:
- draws a fixed strip the height of the top inset in the page colour, and starts the scroll view under it, so headers
  clear the Dynamic Island and scrolled content disappears under the strip instead of behind the clock;
- shows a hairline under the strip once you've scrolled (like the mockup);
- sizes the strip with `useTopInset()`, tuned per kind of iPhone after testing on a real iPhone 15:
  - **Dynamic Island** (inset ≥ 59pt): the inset minus 6pt, tucking in like Apple's own large titles (the status
    bar row is taller than the island);
  - **notch** (44–50pt): exactly the inset;
  - **home button** (20pt, and similar Android bars): the inset plus 8pt, so content stays off the clock;
- adds no top padding on phones (`Space.xl` in a browser, which has no inset), and pads the bottom with
  `useTabBarSpace()`, or `insets.bottom + Space.xl` with `withTabBar={false}`;
- takes `keyboardAvoiding` for forms, and passes every other `ScrollView` prop through.

On desktop (`isWide`) it adds nothing: each page's own content style applies, so desktop layouts are unchanged.
Used by Events, Chats, Photos, You, the create form and the edit form (`EventForm`), Activity, and the sign-in /
sign-up screens (`AuthShell`). The welcome screen uses `useTopInset()` directly. Checked on the iPhone 18 Pro
(Dynamic Island), iPhone 16e (notch) and iPhone SE (home button) simulators.

### 1.3 Nav: Events · Chats · + · Photos · You
- Activity is off the bar; Photos takes its place. The desktop sidebar lists Events, Chats, Photos.
- The bar's only badge is Chats; Activity's count moved to the bell.

### 1.4 Events header and the Activity page (`app/(tabs)/home.tsx`, `app/activity.tsx`, `components/ui/IconButton.tsx`)
- The "New event" button became a round **bell** (`IconButton`) with the unread Activity count. Desktop has the bell
  at the top right of the main column too.
- **Activity is a pushed page** at `app/activity.tsx` (URL `/activity`, as before), outside the tabs, with no bar:
  back button, "Mark all read", grouped **Today / Earlier**, round icons, the person and event in bold, unread dots.
  On desktop it keeps the sidebar (like event pages).
- **Read state changed:** opening Activity no longer marks everything read. An item is read when you open it, or
  with "Mark all read" (which the mockup asks for). So the bell keeps meaning "something you haven't looked at".
- **Root navigator is now a `Stack`** (was a bare `Slot`) in `app/_layout.tsx`, so Activity and event pages slide in
  on phones and can be swiped back. Checked on the simulator; auth redirects and the web are unaffected.

### 1.5 Events filters: the title is the Upcoming / Past switch, Invited / Hosting chips
Revised after the first real-iPhone pass (the two stacked toggles took too much room):
- The page title reads **Upcoming** or **Past**; tapping it switches (a small muted chevron hints it's tappable).
  This replaced the Upcoming / Past pill and the "What's next?" heading, on phone and desktop.
- **Invited / Hosting** are two compact chips with counts (`components/ui/CountToggle.tsx`), Invited first; the
  selected chip is filled in ink (light) / white (dark).
- The logo on Events grew from 30 to 40pt; the bell shrank from 46 to 42pt.
- Only the selected list shows. Until you pick, it opens on the list with the soonest event (the most recent one on
  Past). Your pick is saved with AsyncStorage (already used for the theme) under `wya.eventsList.<user id>`, so two
  accounts on one browser don't share it.
- Each list has its own empty state ("Nothing hosted yet" with Plan an event, "No invites yet"); both empty keeps the
  old combined one. Desktop keeps the grid and the "Plan something" tile on Hosting.

### 1.6 "Needs you" cards (`components/NeedsYou.tsx`)
Shown only when something needs doing, at most 3, most urgent first, built from data the screen already loads:

| Card | For | Source | Button |
|---|---|---|---|
| You owe Hannah $5 (highlight card) | guest | `get_my_obligations` (owed / disputed) | Pay |
| Jo sent an excuse | host | `get_my_obligations` (excuse_pending) | Review |
| Who came? · "Trivia Night started 2h ago" | host | hosted events within `canMarkAttendance`, plus one read of their Going RSVPs: shown while every `attendance_marked_at` is null | Mark |
| Are you coming? | guest | upcoming events with status `invited` | Answer |

Every button opens the event, where the existing PayCard / PledgesPanel / AttendanceCard / RSVP card do the work.
On desktop the cards sit at the top of the side panel (replacing "Settle up"); Next up, Needs your answer and Latest
stay.

### 1.7 Photos tab (`app/(tabs)/photos.tsx`, migration `20261013000000_my_albums.sql`)
- **`get_my_albums()`** (security definer, `search_path = ''`, revoked from anon): the caller's events (hosted or with
  an RSVP row), filtered by the album's own rule `private.can_view_photos`, so it never lists an album you couldn't
  open. An event is listed once it has photos, or while its album is open (start to 30 days after). Returns the count,
  the 6 newest thumbnail paths, and `is_open`. No `events.address` involved.
- The app signs thumbnails like the album does (`signPaths` in `lib/album.ts`, one request).
- Layout as in the mockup: the open album (one with photos first) as a big 3×2 mosaic card with "Open now", the rest in
  two columns of 2×2 mosaics (four on desktop), "+N" on the last tile, the photo count and date. Empty tiles use the
  event's theme colours; an album with no photos yet shows the event cover. Tap → the event's Photos tab.
- Empty state: "No albums yet".

### 1.8 Test junk in Activity (migration `20261013000100_test_notification_cleanup.sql`)
The test scripts used to leave hundreds of "Hannah cancelled Album test…" items in the seed accounts' Activity
(up to 250 per stress account). Users can't delete notifications, so there's one narrow way out,
**`clear_test_notifications(p_since)`**:
- deletes only **the caller's own** notifications;
- only for accounts on the reserved **`@wya.test`** domain (anyone else gets a permission error);
- only items about events with the scripts' title prefixes (`RLS temp event`, `Pledge test: `, `Album test: `,
  `Stress test: `, …), plus, when the script passes the time its run started, anything that arrived during the run
  (Gary flipping his answer on the seed event).

Why this over the alternatives: marking them read would still list them under "Earlier"; a service-role key in the
tests would mean a secret on the laptop; a broader "delete your notifications" would change the product rule. This
touches nobody else's data and nothing for real accounts. `rls_check.py` and `stress_pledges.py` call it at the end.

The existing junk on `wya-dev` was cleared with `execute_sql` (4,824 rows): for `@wya.test` accounts only, items about
deleted events, items with the test prefixes, and all but the latest of the ~50 "Gary is going to Seed Dinner Party"
items on Hannah's account. `abhi@test.wya.com` was left alone.

## 2. Files

| File | Change |
|---|---|
| `components/nav/AppTabBar.tsx` | Absolute floating bar, offset from `useTabBarOffset`, Photos replaces Activity |
| `hooks/useTabBarSpace.ts` | New: `TAB_BAR_HEIGHT`, `useTabBarOffset`, `useTabBarSpace` |
| `components/ui/TabScreen.tsx` | New: shared tab page (status strip, safe-area and bar padding, keyboard) |
| `components/ui/IconButton.tsx` | New: round outlined icon button with a count badge (bell, back) |
| `components/ui/CountToggle.tsx` | New: full-width toggle with counts |
| `components/NeedsYou.tsx` | New: the Needs-you cards |
| `app/(tabs)/home.tsx` | Bell header, Hosting/Invited toggle (remembered), Needs you, TabScreen; Settle up card removed |
| `app/(tabs)/photos.tsx` | New: Photos tab |
| `app/activity.tsx` | New location of Activity (was `app/(tabs)/activity.tsx`, deleted) |
| `app/(tabs)/_layout.tsx` | `photos` replaces `activity` |
| `app/(tabs)/chats.tsx`, `app/(tabs)/account.tsx`, `components/EventForm.tsx` | TabScreen instead of Screen + ScrollView |
| `app/_layout.tsx` | Root `Stack` instead of `Slot` |
| `lib/album.ts` | `signPaths`, `AlbumSummary` |
| `supabase/migrations/20261013000000_my_albums.sql` | `get_my_albums()` |
| `supabase/migrations/20261013000100_test_notification_cleanup.sql` | `clear_test_notifications(p_since)` |
| `supabase/tests/rls_check.py` | 9 Photos tab checks, 4 clean-up checks, clears its Activity items |
| `supabase/tests/stress_pledges.py` | Clears its Activity items for all 31 accounts (2 checks) |
| `docs/PHASE7.md`, `CLAUDE.md`, `docs/FEATURES.md` | Docs |

## 3. Testing

- `npm run typecheck`: 0 errors.
- `rls_check.py`: 190/190, run after each migration and at the end. Photos tab: Going guest, host and invited (Maybe)
  guest see the album with the right count (28) and ≤ 6 thumbnails from that album; unopened-and-empty and
  long-closed-and-empty albums aren't listed; a stranger sees none; logged-out is refused; a removed guest loses it.
  Clean-up: test items gone, items from before the run kept, logged-out refused.
- `stress_pledges.py`: all 52 checks pass (run alone, after `rls_check.py`).
- **Web** (reusing the running `wya-native` Metro on 8081), with demo data made for the purpose and removed afterwards:
  - 375 light (Gary): bell, toggles (Invited auto-selected, soonest event), "You owe Hannah $5" and "Are you coming?"
    cards, bar overlaying the cards with no divider, last card 24pt above the bar, Photos tab (big open album + grid,
    signed thumbnails, "+N"), tap → event Photos tab, bell → Activity (Today, bold names, dots) → Mark all read clears
    the badge → back.
  - 375 dark (Hannah): matches the dark mockup (excuse + Who came? cards, ink/white selected toggle); picking Invited
    survives a reload; Past shows the same toggle; Chats and You scroll to the end clear of the bar.
  - 1280 light/dark: sidebar Events · Chats · Photos, bell in the header, Needs you in the side panel, Activity with
    the sidebar, Photos four across. No console errors.
- **iOS simulator** (iPhone 18 Pro, iOS 27, existing dev build against the same Metro; no native changes, so no
  rebuild): header clear of the Dynamic Island; scrolled content goes under the strip with the hairline; bar ~22pt
  from the bottom over the home indicator; last card clears it; Activity slides in, no bar, swipe-back works; Photos
  thumbnails load; create form; dark mode.

### Bugs found and fixed along the way
- The big Photos card first picked an open album with no photos (the newest event); it now prefers an open album
  that has photos.
- The list choice was shared by every account on a device; now keyed by user.

## 4. Follow-ups

- **Real iPhone:** confirm the bar offset and the status strip on a device (Abhiram's and Aayush's phones).
- **Android:** not run (no SDK on this Mac). `useTabBarOffset` gives 8pt above gesture navigation; check it there.
- Activity rows use the type icon, not the person's avatar/initial the mockup shows; that needs the actor's avatar in
  `notifications.data` (or a join) and is a small follow-up.
- Hosting card meta could show "12 going · $5 pledge" like the dark mockup (needs counts per event; not built).
- "Who came?" is offered for every hosted event with Going guests (like the event page), not only pledge events.
  If that nags hosts of casual events, limit it to pledge events.
- Chats tab still uses its own badge style; could move to `IconButton`/`Badge`.
- The older follow-ups in `docs/PHASE6.md` §4 still stand.
