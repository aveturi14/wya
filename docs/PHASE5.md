# Phase 5: wya on iPhone and Android (handoff)

_Written 2026-10-12 by Abhiram's Claude session, for whoever picks this up next (human or agent). Read this first, then `CLAUDE.md`._

**Where it stands:**
- The **iOS simulator pass is done** on branch `feat/native`. It's being handed over mid-phase.
- **Still to do:**
  1. Run on a real iPhone.
  2. Android (emulator and a real phone).
  3. The brand-asset changes in the "To do" section below. Abhiram asked for them; they haven't been made yet.

Contents: 1. What changed this phase · 2. What was tested · 3. To do next (in order) · 4. How to run native · 5. Gotchas found · 6. Decisions.

---

## 1. What changed this phase

### Platform and config
- **Expo SDK 56 → 57.0.27** (React Native 0.86.3). Two reasons:
  - **The Hermes memory leak:** `npx expo-doctor` flagged a known leak in SDK 56 for apps using Reanimated, which wya does.
  - **iOS 27 launch:** apps built with Xcode 27 (the iOS 27 SDK) need the UIKit scene lifecycle or they may not launch on iOS 27. That's enabled through `expo-build-properties` → `ios.enableSceneSupport: true`, which needs 57.0.23+. Expo SDK 58 makes it the default; remove the setting then.
  - `AGENTS.md` and `CLAUDE.md` now point at the **v57** docs.
- **Native folders are generated, not committed** (Expo's "CNG").
  - `/ios` and `/android` are now in `.gitignore`. The old `ios/` folder (tracked, from June) was stale.
  - Never edit `ios/` or `android/` by hand. Change `app.json`, then run `npx expo prebuild --clean`.
- **`app.json` cleanup:**
  - iPhone only for now: `ios.supportsTablet: false`.
  - `LSApplicationQueriesSchemes` for Google Maps and Waze.
  - Android adaptive icon with background, foreground and monochrome layers.
  - `permissions: []`, plus `blockedPermissions: RECORD_AUDIO`.
  - Image picker: library-only wording, with `cameraPermission` and `microphonePermission` off.
  - Splash screen config for light and dark.
  - Media library limited to `granularPermissions: ["photo"]`.
- **Removed unused libraries:**
  - `expo-location`, `expo-auth-session`, `expo-web-browser`, `@stripe/stripe-react-native`.
  - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env` is unused now and can go.
- **App icon and splash:** they were Expo's template placeholders. `scripts/make-brand-images.py` now generates `assets/icon.png`, the Android adaptive layers and `assets/splash-icon(-dark).png`. **They need redoing; see To do 3.1.**

### App fixes (found by running natively)
| Fix | File |
|---|---|
| Brand fonts didn't show on phones: text drawn before `useFonts` finished kept the system font. The splash is now held until fonts load (phones only; web unchanged) | `app/_layout.tsx` |
| **Text clipped mid-sentence on iOS.** React Native 0.86 bug [#58970](https://github.com/react/react-native/issues/58970): Yoga rounds a wrapped Text's height a hair short at certain screen positions, and TextKit clips the last line. Workaround: `paddingBottom: 0.01` on every `theme.type` style (iOS only, via `TEXT_FIX`). Remove when upstream PR #58974 ships | `constants/theme.ts` |
| Date/time wheel closed after one scroll on iOS. Now it updates live and closes on **Done**; Android's dialog closes after one pick. Moved off the deprecated `onChange` to `onValueChange` / `onDismiss` | `components/EventForm.tsx` |
| Chat: with the keyboard open the messages were hidden. Now it scrolls to the latest after layout, size and keyboard changes; dragging dismisses the keyboard | `app/event/[id].tsx` |
| Photo viewer jumped to another photo when someone uploaded live (new photos go to the front). It now stays on the photo being viewed | `components/album/PhotoViewer.tsx` |
| Directions: Android dialogs show at most 3 buttons (we had 4). Android now uses `geo:` (system chooser); iOS offers Apple Maps plus Google Maps / Waze only if installed; falls back to the Google Maps web link | `app/event/[id].tsx` |
| Reads (GET/HEAD) now time out after 15s and retry (3 tries), so a dropped connection can't spin a screen forever. Writes are still never retried | `lib/supabase.ts` |
| Session storage: the chunked SecureStore adapter leaves no stale chunks, and writes the chunk count last | `lib/supabase.ts` |

---

## 2. What was tested

### 2a. iOS simulator (2026-10-12)
**iPhone 18 Pro, iOS 27.0 simulator, Xcode 27.0** (dev build against wya-dev, signed in as `host@wya.test`):
- ✅ Launches on iOS 27 (scene lifecycle works). Splash and brand fonts show.
- ✅ Sign in; the session **survives force-quit and relaunch** (twice).
- ✅ `wya://event/<id>?tab=photos` and `wya://create` deep links.
- **Album:**
  - ✅ Multi-select picker ("Select up to 30", ordered).
  - ✅ Upload with progress, including a 12 MP HEIC with GPS.
  - ✅ Stored as 1600px JPEGs with 400px thumbnails.
  - ✅ **GPS and camera make/model are stripped**, checked per file. Only orientation and resolution tags remain.
  - ✅ Live updates from another account.
  - ✅ Viewer swipe.
  - ✅ **Save to Photos** (add-only permission prompt, with our wording).
  - ✅ Delete with confirmation.
- **Event page:**
  - ✅ Guest groups.
  - ✅ "Who came?" full screen, which respects the notch and home bar.
  - ✅ Directions opens Apple Maps.
  - ✅ Native share sheet ("Hannah Host invited you to …").
- ✅ **Create event:**
  - native date and time wheels;
  - cover photo picked and uploaded from the phone's file system (`lib/readFile.native.ts`);
  - pledge settings.
- ✅ Chat: send a message; the composer stays above the keyboard.
- **Health checks:**
  - ✅ `npm run typecheck`
  - ✅ `npx expo export -p web`, plus a quick web check after the SDK upgrade
  - ✅ `rls_check.py` (156 checks)
  - ✅ `npx expo-doctor`: 20/21. The last check clears once `ios/` is untracked.

**Not app bugs (don't chase these):**
- **iOS 18.4 simulator under Xcode 27:** after a relaunch, every Supabase request hangs or fails with `-1005 network connection lost`. iOS caches that Supabase supports HTTP/3 and switches to **QUIC**, which that simulator runtime handles badly. It **doesn't happen on the iOS 27 simulator**. Real phones should be fine; confirm on the iPhone.
- **Simulated typing** in the simulator tool returns before it finishes. Acting immediately afterwards cuts the text off. That caused a fake "Enter your email and password" error.

**Measured:**
- Real detailed photos are **0.4–0.8 MB** after shrinking, not the ~0.35 MB estimated in Phase 4.
- So Supabase's free 1 GB holds about **1,500 album photos**, not 2,800. (`FEATURES.md` is updated.)

### 2b. Real iPhone (2026-10-12)
**Aayush's iPhone, iOS 26.6.2** (dev build, bundle ID `com.aayushveturi.wya`, connected via USB + hotspot for Metro):

| Check | Result |
|---|---|
| Session survives force-quit + reopen | ✅ still logged in |
| Create event: date picker, cover photo, venue photos | ✅ works — latency on photo upload is noticeable (1–2s gap while iOS prepares assets; see below) |
| Chat keyboard — composer pushed up? | ✅ composer stays visible above keyboard |
| Directions — system chooser? | ✅ system sheet offers Apple Maps, Google Maps, etc. |
| Dark mode toggle (Settings → Display & Brightness) | ✅ app switches themes live |
| Haptics on "I'm in" | ✅ faint but present |

**Bugs found and fixed on real device:**
1. **Venue photos can't be tapped / expanded.** The gallery was a plain `<Image>` with no press handler. Fixed in `app/event/[id].tsx`: thumbnails are now `PressableScale` → opens a full-screen swipeable lightbox (`Modal` + `FlatList`, matching the album PhotoViewer style). Close button top-right.
2. **Venue photo rendering latency.** The event page was using React Native's built-in `Image`. Swapped to `expo-image` (used by the album already) which has a disk cache, Blurhash placeholder support and faster hardware-accelerated decode. `recyclingKey` set per image so the cache is used on re-render.

**Photo upload latency (not fully fixed yet):**
- The 1–2s gap *before* "Uploading 1 of N" appears is iOS preparing the raw HEIC asset from the picker (happening in `ImagePicker.launchImageLibraryAsync`). `EventForm.tsx` shows a loading state during upload but not during the prepare step. A "Preparing…" state before the upload loop would help UX. Not fixed yet — low priority, see §3 smaller follow-ups.

**Network setup note (for future on-device testing):**
- University WiFi uses **client isolation** — devices on the same SSID can't talk to each other. Metro (the JS dev server) runs on the Mac; the iPhone needs to reach it. Fix: use the iPhone's hotspot, connect the Mac to it.
- Force Metro to bind to the hotspot IP: `REACT_NATIVE_PACKAGER_HOSTNAME=172.20.10.2 LANG=en_US.UTF-8 npx expo run:ios --device`
- Bundle ID must match what's in `app.json` (`com.aayushveturi.wya`). The first build may need: Settings → General → VPN & Device Management → trust the developer certificate.

---

## 3. To do next (in order)

### 3.1 Brand assets ✅ (done on `phase5`)
`scripts/make-brand-images.py` was updated. Run `python3 -I scripts/make-brand-images.py` then `npx expo prebuild --clean` and rebuild to apply.

Changes made:
- **Light splash** (`splash-icon.png`): dot is now **tangerine `#FF6A3D`** — matches the in-app Logo.tsx in light mode.
- **Dark splash** (`splash-icon-dark.png`): text is lime, dot is **hot pink `#FF3CAC`** — matches the in-app Logo.tsx in dark mode.
- **App icon** (`assets/icon.png`): **black `#0B0B0F` background, lime `#D4FF3F` "wya", hot pink dot** — dark-mode style as Abhiram requested. The dot colour was chosen as hot pink to match the in-app logo; confirm with Abhiram if he prefers orange or a different colour.
- **Android adaptive icon**: background is now black, foreground uses lime + pink (matches iOS icon style), monochrome unchanged.
- **Web touch icon** (`public/apple-touch-icon.png`): updated to dark-mode style to match.
- **`public/og.png`**: unchanged (light/cream style with the full collage — still appropriate for link previews).

### 3.2 Real iPhone ✅ (done on `phase5`, Aayush's device)
See §2b above. Remaining: run on Abhiram's iPhone.

#### Original steps (for Abhiram's device)
1. **Abhiram's steps:**
   - Xcode → Settings → Accounts → add his Apple ID.
   - iPhone → Settings → Privacy & Security → **Developer Mode** on.
   - Connect by cable and tap **Trust**.
2. `npx expo prebuild --clean -p ios`, then `npx expo run:ios --device` (pick the phone).
   - If signing fails because `com.wya.app` is taken for a free team, use a separate development identifier. Add a small `app.config.ts` that sets `com.wya.app.dev` when `APP_VARIANT=development`, and keep `com.wya.app` for production.
3. On the phone: Settings → General → VPN & Device Management → trust the developer certificate.
4. Then a **Release** build, which carries its own JavaScript and shows real speed and memory: `npx expo run:ios --device --configuration Release`.
5. **Check on the real phone:**
   - Sign in on the first tap with real typing.
   - The session survives a phone restart.
   - Haptics.
   - The real camera roll: HEIC, Live Photos, huge images.
   - Album memory while scrolling 100+ photos (Xcode's memory gauge).
   - Turning Wi-Fi off mid-upload.
   - **No QUIC hangs after relaunch** (see section 2).
   - Light and dark mode.
   - The pledge flows: PayID copy, PayCard, Who came?.

### 3.3 Android (part B of the plan)
1. **Abhiram's steps:** install Android Studio, then in its setup wizard install SDK 36, platform-tools, the emulator and a system image, and accept the licences.
2. **Then:**
   - set `ANDROID_HOME=~/Library/Android/sdk` and add `$ANDROID_HOME/emulator` and `$ANDROID_HOME/platform-tools` to the PATH in `~/.zshrc`;
   - create a Pixel emulator on API 36;
   - run `npx expo prebuild --clean -p android` and `npx expo run:android`.
3. **Checks:**
   - Everything in section 2.
   - Edge-to-edge status and navigation bars in light and dark.
   - **The back button closes modals first** (ListSection full screen, PhotoViewer, pickers).
   - Keyboard resizing in chat and forms.
   - The Android 13+ photo picker.
   - Save asks for photo access only.
   - Directions opens the system chooser.
   - The date picker dialog: one pick, then it closes.
   - Font weights render.
4. **Real Android phone:** turn on USB debugging, check it with `adb devices`, run `npx expo run:android --device`, then a release build (`--variant release`).

### 3.4 Finish the phase
- `docs/PLAN.md` → Phase 5: add the device results and fixes.
- `CLAUDE.md`: update the status table.
- `docs/FEATURES.md`: iOS and Android ✅.
- `rls_check.py` if the database changed (it didn't this phase); typecheck; `expo export -p web`.

### Smaller follow-ups noticed
- **Lost alerts:** if a confirmation is requested while another iOS alert is still closing, iOS drops it, and the waiting `confirmAction` promise never resolves. Seen once: a photo-viewer delete button stayed busy. It's rare; a fix would add a timeout or retry in `lib/alert.ts`.
- **Upload feedback:** after picking photos there's a 1–2 s gap before "Uploading 1 of N" appears, while iOS prepares the assets. Consider showing "Preparing…" straight away. Confirmed on real iPhone.
- **Venue photo lightbox:** fixed (tappable thumbnails + full-screen swipe modal, `app/event/[id].tsx`). Was a bug found on real device — plain `<Image>` with no press handler.

---

## 4. How to run native (this Mac)
```bash
# iOS simulator (dev build with live reload)
npx expo prebuild --clean -p ios            # after any app.json / plugin / native dependency change
LANG=en_US.UTF-8 npx expo run:ios           # builds, installs, starts the dev server
npx expo start --dev-client                 # later sessions: just the dev server; open the installed app
```
- **CocoaPods needs a UTF-8 locale.** Without `LANG=en_US.UTF-8` it crashes with `Unicode Normalization not appropriate for ASCII-8BIT`. Consider adding `export LANG=en_US.UTF-8` to `~/.zshrc`.
- **Install Watchman** (`brew install watchman`). Without it, Metro sometimes stops noticing file changes, so edits silently don't reach the app; restarting `npx expo start` fixes that.
- **Simulators:**
  - The iOS 27.0 runtime is installed; use **iPhone 18 Pro**.
  - iOS 18.4 is there too but has the QUIC problem from section 2.
  - `xcrun simctl addmedia <device> <files>` puts photos into the simulator's library.
- **Test accounts:** the `seed.sql` ones (`host@` / `guest@` / `stranger@` / `joiner@wya.test`) and `stress01–30@wya.test`, all with the password from `seed.sql`. Use them only on dev builds against wya-dev.

---

## 5. Gotchas found this phase (also in `CLAUDE.md`)
- SDK 57 swaps the app's global `fetch` for `expo/fetch` on native (opt out with `EXPO_PUBLIC_USE_RN_FETCH=1`). It wasn't the cause of anything here, but know it's there.
- On phones, text drawn before its font loads keeps the system font. Fonts must be loaded before the first screen renders (which `app/_layout.tsx` now does).
- React Native #58970 text clipping: keep `TEXT_FIX` until the fix ships, and use `theme.type.*` for new text styles so they inherit it.
- iOS shows an "Open in 'wya'?" prompt when a `wya://` link is opened from outside the app (`simctl openurl`). It's normal.

---

## 6. Decisions (2026-10-12)
| Topic | Decision |
|---|---|
| Expo SDK | Upgrade to 57 first (memory leak + iOS 27 launch) |
| Native folders | Generated from `app.json`, ignored by git |
| Devices | Abhiram's iPhone (free Apple ID) and an Android phone, plus simulator and emulator |
| Order | iOS first, then Android |
| iPad | Off for now (`supportsTablet: false`); later |
| App icon | Dark-mode style: black, lime "wya", coloured dot (confirm the dot colour) |
| Splash | Match the in-app logo: tangerine dot in light, hot pink dot in dark |
