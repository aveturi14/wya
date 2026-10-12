# Native test checklist

Run against a **dev build** signed into `host@wya.test` (password: see `supabase/seed.sql`).
Simulators and real devices both use wya-dev.

---

## Phase 5 — iOS simulator (iPhone 18 Pro, iOS 27.0)

Completed 2026-10-12 on branch `phase5`. All items ✅.

| # | Area | Check |
|---|---|---|
| 1 | Launch | App launches on iOS 27 (scene lifecycle). Splash shows wya wordmark with tangerine dot (light) or lime+pink (dark). |
| 2 | Fonts | Brand fonts (Bricolage Grotesque, DM Sans) render on first launch, no system-font flash. |
| 3 | Auth | Sign in works. Session survives force-quit and relaunch (SecureStore chunking). |
| 4 | Deep links | `wya://event/<id>?tab=photos` and `wya://create` open the right screen. |
| 5 | Create event | Date and time wheels work; close on Done (not on every scroll). Cover photo picked and uploaded from library. |
| 6 | Pledges | Pledge settings save. PayID copy (expo-clipboard). PayCard shows balance. |
| 7 | Chat | Composer stays above keyboard. Scroll to latest on keyboard open. Drag to dismiss keyboard. |
| 8 | Album | Multi-select picker. Upload with progress. HEIC accepted. Live updates from another account. |
| 9 | Album — metadata | GPS and camera make/model stripped; only orientation + resolution tags remain. |
| 10 | Album — viewer | Swipe between photos. Save to Photos (add-only permission). Delete with confirmation. |
| 11 | Directions | Tapping Directions opens Apple Maps. Google Maps / Waze shown only if installed. |
| 12 | Share | Share sheet says "Hannah Host invited you to …". |
| 13 | Text clipping | No last-line clipping on wrapped text (TEXT_FIX paddingBottom:0.01 applied). |
| 14 | Who came? | Full-screen list respects notch and home bar. |

---

## Phase 5 — Real iPhone (Aayush's device, iOS 26.6.2)

Completed 2026-10-12 on branch `phase5`.

| # | Check | Result |
|---|---|---|
| 1 | Session survives force-quit + reopen | ✅ |
| 2 | Create event: date picker, cover photo, venue photos | ✅ (upload latency noted — see §Phase 6) |
| 3 | Chat keyboard — composer pushed up | ✅ |
| 4 | Directions — system chooser | ✅ Apple Maps / Google Maps etc. |
| 5 | Dark mode toggle (Settings → Display & Brightness) | ✅ app switches live |
| 6 | Haptics on "I'm in" | ✅ faint but present |
| 7 | Venue photos — tap to expand | ✅ (fixed: was broken, now opens full-screen lightbox) |

Remaining for Abhiram's device:
| # | Check |
|---|---|
| A | Session survives a full phone restart (not just force-quit). |
| B | Real camera roll: HEIC, Live Photos, very large images. |
| C | Album memory while scrolling 100+ photos (Xcode memory gauge). |
| D | Upload with Wi-Fi off mid-upload — error shown, no hang. |
| E | No QUIC hang after relaunch (iOS 18.4 simulator bug). |
| F | Release build: `npx expo run:ios --device --configuration Release` — no bundle errors. |

---

## Phase 6 — New features (TODO)

Test after the Phase 6 changes land on the `phase6` branch. Sign in as `host@wya.test` for host checks
and `guest@wya.test` for guest checks.

### Floating nav bar
| # | Check |
|---|---|
| 1 | Bottom nav bar floats above content with rounded pill shape and drop shadow. |
| 2 | Content scrolls behind the bar (visible through gap). |
| 3 | Bar doesn't overlap the home indicator / safe area on iPhone. |
| 4 | Tapping any tab works; haptic fires. Create button (+) still pops up above the bar. |
| 5 | Wide / desktop layout unaffected (sidebar should look unchanged). |

### Home — Hosting / Invited sections
| # | Check |
|---|---|
| 6 | Upcoming tab: "Hosting" section shows only events the signed-in user created. |
| 7 | Upcoming tab: "Invited" section shows events where the user has an RSVP (any status, not host). |
| 8 | If hosting section is empty, shows empty state with "Plan an event" button. |
| 9 | If invited section is empty, it is hidden (no empty state shown). |
| 10 | Past tab: same two-section split, reversed sort (most recent first). |
| 11 | Stickers and badges (Going / Hosting / Invited) correct in both sections. |

### Address hidden on pledge events
| # | Check |
|---|---|
| 12 | `guest@wya.test` (RSVP = "Going") on a pledge event → full address and Directions button visible. |
| 13 | `stranger@wya.test` (no RSVP / new invite on a pledge event) → address shown as "Address hidden", subtitle "RSVP to see the address", no Directions button. |
| 14 | Guest changes status to "Not going" → address disappears immediately (no page reload needed). |
| 15 | Guest changes back to "Going" → address reappears. |
| 16 | Host (`host@wya.test`) always sees the full address regardless of pledge mode. |
| 17 | Non-pledge event: address always visible to all guests regardless of RSVP status. |
| 18 | Home screen event card: pledge event, guest is "not going" → location shows venue name if set, otherwise "Address hidden". |

### Post-cutoff status lock
| # | Check |
|---|---|
| 19 | After the pledge cutoff, a "Going" guest who taps "Can't go" gets the late-cancellation warning. |
| 20 | Confirming late cancel → obligation created (status = owed). |
| 21 | After cutoff, a guest who is already "Not going" cannot change status (buttons should be disabled or DB rejects the change — confirm which). |
| 22 | "Maybe" is hidden from the RSVP buttons after cutoff on pledge events (only Yes / No shown). |

---

## Android emulator (TODO — requires Android Studio + SDK 36)

Steps in `docs/PHASE5.md` §3.3.

| # | Check |
|---|---|
| 1 | All items from the iOS simulator list above (adapt: Google Maps for directions). |
| 2 | Edge-to-edge status and navigation bars in light and dark. |
| 3 | Back button closes modals first (ListSection, PhotoViewer, venue lightbox, pickers), then navigates. |
| 4 | Keyboard resize in chat and forms. |
| 5 | Android 13+ photo picker (granular media permission). |
| 6 | Save to library: photo-only permission prompt shows wya wording. |
| 7 | Directions: system chooser (geo: intent). |
| 8 | Date picker: closes after one pick. |
| 9 | Alert dialogs show at most 3 buttons; no silent drop. |
| 10 | Font weights render (DM Sans 500, 600, 700 all distinct). |
| 11 | Floating nav bar: rounded shape and shadow render correctly on Android. |
| 12 | Home — Hosting / Invited sections display correctly. |
| 13 | Address hidden on pledge events (same checks as #12–18 above). |

---

## Health checks (run before any PR)

```bash
npm run typecheck                        # must be 0 errors
python3 -I supabase/tests/rls_check.py  # 156 checks, all pass
npx expo export -p web                  # web build must succeed
```
