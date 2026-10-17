# Phase 9: Poster + Spotlight redesign, and the wya wallet

_Plan written 2026-10-18. **Approved 2026-10-18 with the §7 defaults.**_

| Item | Status |
|---|---|
| 9.0 Accessibility | ✅ Written 2026-10-18 (not committed). Typecheck clean; web checked at 375, light and dark. Notes below |
| 9.0 git | Committed and pushed on `phase9-a11y`; its PR was closed without merging (Phase 9 ships as one PR, per the one-PR-per-phase rule) |
| 9.1 Foundations | ✅ Written 2026-10-18 on `phase9-redesign` (branched from `phase9-a11y`). Typecheck clean; web at 375 in light and dark; iOS simulator after a cold start. Notes below |
| 9.2 UI kit | ✅ Written 2026-10-18 (not committed). Typecheck clean; web at 375 and 1280, light and dark; iOS simulator (iPhone 18 Pro, cold start). Notes below |
| 9.3 Posters and glow | ✅ Written 2026-10-18. `20261018000200_posters.sql` **applied to wya-dev** (with the user's OK, together with the branch's `…000000_bills_tab.sql` and `…000100_dues.sql`, which hadn't been). `rls_check.py`: every check passes except one, see notes; `phase8/run.py` 230 pass, 0 fail after fixing a stale 8.18 check (1 blocked: `scan-receipt` not deployed). `rls_check.py` 199 pass, 1 fail from old test data (see notes). Gradients confirmed on iOS and web |
| 9.4 Navigation | ✅ Written 2026-10-18. Web at 375 and 1280, light and dark; iOS simulator |
| 9.5 Screens (and 9.6 bills) | ✅ Written 2026-10-18, every flow in the table. Web at 375 and 1280 (light and dark spot checks per flow); iOS simulator for Welcome, Sign in, Home, the event page and a sheet. Not done: see notes |

**9.2 as built (`components/ui/`):**
- Restyled: `Button` (variants primary · soft · line · danger · ghost, `color` for the event's colour; the old `secondary`
  and `outline` names map to soft and line; 44pt tall, `sm` 32 with hit slop), `Card` (no outline, soft shadow in light,
  `tone="alt"` for cards in sheets), `TextField` (hairline edge, focus ring, `secure` show/hide, `optional`, `hint`),
  `IconButton` (`tone` chip · glass · dark, `dot`), `Avatar` (expo-image, person colours with ink chosen by contrast,
  `ring` for stacks), `Segmented` (pill tabs, `stretch`), `Sticker` (shadow, optional wobble that stops for Reduce
  Motion), `EmptyState` (quiet icon or `art`), `Confetti` (`colors`: the event's).
- New: `Sheet` (Modal + Reanimated: grab handle, swipe down, scrim, fades with Reduce Motion, centred column on wide
  screens), `ListRow` + `ListGroup` + `IconSquare`, `Money`, `Chip` + `ChipRow`, `Switch`, `EventHeader`.
- `CountToggle` is gone (ChipRow replaces it). Theme gained `chipStrong`, `lineStrong`, `bar`, `barEdge`,
  `PERSON_FILLS` and `inkOn()`.

**9.3 as built:**
- `components/ui/Poster.tsx`: `Poster` (gradient + grain or photo + shade, serif line, foot with date and place,
  wya's and the host's stickers, `lift`), `PosterThumb` (44/34pt), `PosterGlow` (two radial pools, no blur pass
  needed; photos use expo-image `blurRadius`; breathes except on Android and with Reduce Motion; clipped to the page so
  it can't scroll the web page sideways), `PosterArt`, `fitTitle`, `posterDate`. `EventCover` is deleted.
- **Gradients:** RN 0.86 `experimental_backgroundImage` draws the layered radial + linear gradients on iOS (checked on
  the simulator); the web gets the same CSS as `backgroundImage` (`lib/gradient.ts`). No `expo-linear-gradient`.
  Android not run yet.
- **Title fit:** Archivo Expanded's glyph widths, measured from the TTF (`constants/posterMetrics.ts`), so the fit is
  plain maths and identical on every platform (1–3 balanced lines, biggest size that fits).
- **Grain:** `assets/grain.png`, from `python3 -I scripts/make-brand-images.py --grain`.
- **Looks:** seven in `constants/eventThemes.ts` (`a`, `b`, `posterInk`; `base`/`ink`/`shape` kept for older code).
  Old names still resolve in the app (bubblegum → violet, tangerine → sunset).
- **Migration** `20261018000200_posters.sql`: `poster_line` (≤ 40), `stickers` (≤ 2 × ≤ 24), the rename (guarded so a
  re-run can't turn sunset into peach twice), the new default and check, the column grant, and `get_invite_preview`
  with `poster_line`, `stickers`, `venue_name`, `kind`, going/maybe counts, the pledge settings, and
  `link_status = 'full'`. That covers the 9.5 invite reasons, so there's no `…_invite_reasons.sql`.
  **Exposes to signed-out visitors:** the venue name and the going/maybe counts (no names, faces or address). Say if
  either should stay hidden.
- `rls_check.py` gained 10 poster checks (preview fields, no names, new looks, host can set line/stickers/look,
  limits, old names refused, guest can read, stranger can't).
- **`rls_check.py` failure, not from this work:** "with nothing owed, a host can remove their PayID" fails because
  Hannah has two open debts left from 17 Oct testing (Gary owes $5 on "Pledge test: late" and $5 on a Seed Dinner
  split). Settle or delete those rows to get back to all green.
- **Phase 8 test fix:** 8.18's "…and sends it" expected `send_receipt` to return 200; since the Bills tab migration
  it returns nothing (204). The check now accepts both.

**9.4 as built:** the phone bar is translucent with a hairline (calendar icon for Events, pink Chats badge, 48pt
create button). Desktop has a floating top bar (`TopBar` in `components/nav/AppTabBar.tsx`): logo · Events, Chats,
Photos, Activity (with badges) · New event and your avatar. `WithTopBar` replaces `StandaloneSidebar` on event,
Activity, dues, pay and receipt pages; `TabScreen` and the event page leave `TOP_BAR_SPACE` for it.

**9.5 as built (mockups followed; where they differ from the plan, noted):**
- **Getting in:** Welcome as a fan of posters with glow; Sign in / Sign up with show/hide and phone marked optional;
  **forgot password**: `app/(auth)/forgot.tsx` sends `resetPasswordForEmail` with `redirectTo` `/reset-password`, and
  `app/reset-password.tsx` (outside `(auth)`, exempt from the signed-out redirect) reads the recovery tokens from the
  URL fragment, sets the session and saves the new password. **Not tested end to end:** the link goes to
  `EXPO_PUBLIC_WEB_URL` (wya.expo.app), so it needs a deploy, and email delivery on wya-dev.
- **Invite link:** poster, "Hannah invited you", counts, the pledge explained before sign-up, address note; expired,
  used up and full each say so; Asked to join keeps the poster with a "waiting" sticker. Faces aren't shown signed
  out (the mockup has them): showing who's going to anyone with a link felt like a privacy change to ask about first.
- **Home:** one time-ordered list with All / Hosting / Invited / Past chips (the title toggle and the saved
  Hosting/Invited choice are gone); Next up as a lifted poster with a live countdown and the glow; Needs you grouped by
  kind; first time shows a sample poster. Desktop: poster + small posters in a grid, Needs you and Latest beside it.
- **Activity:** poster thumbnails, pink unread dots.
- **Event page:** split into `components/event/` (`EventHero` / `EventPoster` / `EventTitle` / `QuietCounts` /
  `HostRecord`, `RsvpBar`, `HostTools`, `EventChat`); state, data calls and handlers stay in the page. Three-up RSVP
  row, pledge line under it, "I'm here" as its own state, address "Unlocked" moment, quiet counts, host tools row and
  one Going/Maybe/Waiting bar, guest list / invite people / Who came? as sheets, excuse as a sheet (PayCard), check-in
  times on Who came?, sticky tabs, slim `EventHeader` on Chat, Bills and Photos, chat bubbles and send in the event
  colour, the slash menu as a card of commands with icons. "Asked to join" shows a waiting card instead of RSVP
  buttons. Add to calendar (mockup) isn't built: there's no calendar integration yet (8.17).
- **Find a time:** times as cards with live bars; best one outlined. **Chats:** poster thumbnails; poll card in the
  event colour; plan times in mono. **Photos:** albums titled in the poster type, "open now" sticker; Add is a small
  header button on the event album.
- **Create and edit:** Create in three steps (poster → when and where → make it count) with a live poster, the seven
  looks as gradient chips, serif line and up to two stickers, extras under "More details", a plain-words pledge
  preview. Edit is the same form on one page, Delete apart at the bottom in red.
- **You:** record as a big stat (came to · hosted), rows for Your dues, Get paid (sheet), Profile (sheet), assistant
  (sheet), appearance, Sign out apart. No Wallet row until 9.13.
- **Bills (9.6):** Bills tab order dues → bills → "Paid the bill?"; bill cards with amount in mono and quiet status
  chips; receipt page header with the serif word; draft banner and flagged lines in amber; dues totals without the
  pink fill. PayID stays the pay method.
- **Not done in 9.5:** Bricolage and DM Sans packages are still installed, because `scripts/make-brand-images.py`
  draws the icons with them (they go when 9.15 redraws the brand art). Android wasn't run. iOS dark mode, the iOS
  chat keyboard and the iOS create date pickers weren't checked. `CLAUDE.md` still describes the Soft pop kit (9.15).

**9.1 as built:**
- **Fonts:** Geist (400–700), Geist Mono (400, 500) and Instrument Serif italic come from `@expo-google-fonts`; Archivo
  Expanded Black is bundled at `assets/fonts/ArchivoExpanded-Black.ttf` (static instance from Google Fonts, OFL licence
  alongside). Bricolage and DM Sans are no longer loaded; their packages are removed in 9.5.
- **`constants/theme.ts`:**
  - the Poster + Spotlight palettes, with the same role names plus `sheet`
  - `primary` is the text colour; `secondary` and `highlight` are the sticker pink with ink text
  - every text role at 4.5:1 or better on page, surface and surfaceAlt
  - Geist type scale with tight titles; new `accent`, `money`, `mono` and `poster` styles
  - `Radius` is now sm 10 · md 12 · lg 18 · xl 22; `TOUCH` = 44
  - `outlineWidth` is 1 (hairlines) and `shadow()` is a soft elevation in light, none in dark
  - `glowOpacity` added for 9.3
- **`constants/motion.ts`:** shared springs, durations, stagger and the poster effect timings. `PressableScale` uses them.
- **In between:** until the kit (9.2) and posters (9.3) land, screens mix the new type and colours with old shapes
  (icon tiles in pink, violet event covers). Expected; the branch doesn't ship until 9.5.
- **Gotcha:** after changing the fonts, cold-start the iOS app. A hot reload draws text in the old font's widths and
  clips words ("Upcomin").

**9.0 as built:**
- **Buttons and focus.** `PressableScale` announces as a button with its disabled, selected, checked and expanded
  states. On the web it passes `aria-*` (React Native Web ignores `accessibilityState`). Pressables nested inside
  another one drop the default role on the web, because role "button" renders a real `<button>` and they can't nest.
  Keyboard focus gets a 2px ring (`:focus-visible` only, so mouse clicks don't show it). `TextField` adds the same ring
  on the web.
- **Tab bar and sidebar** are a `tablist` of `tab`s with `selected`, and their labels include the unread count.
- **Reduce Motion.** Reanimated already skips springs, timings and entrances when it's on (its default is
  `ReduceMotion.System`), so the audit overstated this one. Added: no confetti at all, and the two slide-up sheets
  (`ListSection` full screen, `InvitePeople`) fade instead.
- **Contrast.**
  - Light: `textMuted` `#716783`, `primary` `#7347F5`, `onSecondary` ink, `danger` `#EC5A5F` (for fills).
  - Dark: `textMuted` `#8A8AA0`.
  - The Violet event look is now `#7A50FF`.
  - New roles `successText`, `warningText` and `dangerText` for status colours used as text, plus `thumb`.
  - `website/` updated to match. `scripts/make-brand-images.py` still uses the old violet: regenerate in 9.15.
- **Text floor.** `label` 12, `caption` 13, a new `micro` (12), stickers and tab labels 12. Count badges stay at 11.
- **Other.** The bell is 44pt; no raw hex left in screens; the web waits up to 3s for fonts before first paint.

Two pieces of work, planned together because they meet on the same screens:

- **Part A, the redesign.** The whole app moves to the "Poster, in the spotlight" direction: neutral app surfaces, event
  covers as gig posters, and each poster's colours glowing behind its pages. Every screen is drawn in
  `docs/design/wya-screens.html` (published at https://claude.ai/artifact/FvNeUVmYXVS4zwMV7zp3Jy). That page is the
  spec for this part: when the plan and the mockups disagree, ask.
- **Part B, the wallet.** From the wya Split brief (`wya-split-brief.pdf`): a wya wallet that pays **pledges and bills**
  with a tap and Face ID, topped up with Apple Pay or Google Pay. **PayID stays as the fallback** on every pay screen
  (decided 2026-10-18).

**Approve or change:** the order (§2), the database changes (§5) and the decisions in §7. The rest follows from them.

---

## 1. Ground rules

- **Start after `feat/receipt-split` merges.** That branch rewrites the event page, Home, Needs you and You (Bills
  tab, receipts, Dues). Restyling before it lands means doing those screens twice. Branch `phase9-redesign` from
  `main` once it has merged.
- **Restyle, don't rewrite logic.** Screens keep their data calls and RPCs. Where the mockups change behaviour (one
  list on Home, a three-step Create, sheets), the item says so.
- **One item per session**, in order, as in Phase 8. Each item ends with:
  - `npm run typecheck` (zero errors)
  - `rls_check.py`, plus the Phase 8 and Phase 9 tests when the database changed
  - the browser at 375px and 1280px, light and dark
  - the iOS simulator (iPhone 18 Pro) for anything touching layout, fonts or native APIs
- **Git:** Claude prepares changes and suggests commits; the human runs git (unchanged).
- **Accessibility fixes ship first** (item 9.0). They're needed whatever the look, and are small enough to merge on
  their own.

---

## 2. Order

| # | Item | Needs | Sessions |
|---|---|---|---|
| **Part A: redesign** | | | |
| 9.0 | Accessibility fixes from the audit | nothing | 1 |
| 9.1 | Foundations: fonts, theme, type, motion | nothing | 1 |
| 9.2 | UI kit | 9.1 | 1–2 |
| 9.3 | Posters and glow (+ migration) | 9.2 | 2 |
| 9.4 | Navigation: phone bar, desktop top pill | 9.2 | 1 |
| 9.5 | Screens, flow by flow | 9.3, 9.4 | 8–10 |
| 9.6 | Bills screens restyled | 9.5, `feat/receipt-split` merged | 1–2 |
| **Part B: wallet** | | | |
| 9.10 | Payments partner and compliance | founders, not code | — |
| 9.11 | Wallet ledger (database) | 9.10 for production; dev can start on a test balance | 2 |
| 9.12 | Top-up: Apple Pay / Google Pay | 9.11, Apple Developer account, partner account | 2 |
| 9.13 | Wallet screens: pay, paid, wallet, auto top-up, cash out | 9.11, 9.5 | 2 |
| 9.14 | Fixing a bill after people paid | 9.11, 9.6 | 1–2 |
| 9.15 | Docs and rule changes | all | 1 |

Part A and the dev side of Part B (9.11 on a test balance) can run in parallel once 9.2 is in, because they touch
different files. Production wallet payments wait for 9.10.

---

## 3. Part A: the redesign

### 9.0 Accessibility fixes (ship first)
From the audit (`docs/design/wya-restyle.html`, Part 1):
- `PressableScale` defaults to `accessibilityRole="button"` and passes `accessibilityState={{ disabled }}`; tab bar
  items get `tab` and `selected`.
- A visible focus ring on web for pressables and `TextField` (it removes the outline today).
- Reduce Motion: `useReducedMotion()` from Reanimated in `PressableScale`, `Confetti` and list entrances.
- Contrast: `textMuted` to at least 4.5:1 in both themes; fix white on violet and white on tangerine.
- Text floor: labels 12px, captions 13px. Add a `micro` style instead of the ten hand-set `fontSize` overrides.
- Bell to 44pt (or `hitSlop`). Raw `'#FFFFFF'` in `app/event/[id].tsx` and `PledgeSettings` to theme roles.
- Web: hold first paint until fonts load (it shows Times New Roman today).

### 9.1 Foundations
- **Fonts** (`@expo-google-fonts/*`, loaded in `app/_layout.tsx`): Geist (app text), Geist Mono (dates, money,
  references), Instrument Serif italic (one accent line), Archivo 900 for poster titles.
  - **Archivo's expanded width isn't in the Expo package** (`@expo-google-fonts/archivo` ships the normal width). Bundle
    the expanded static TTF in `assets/fonts/` with `expo-font` (OFL licence allows this), or fall back to Archivo
    Black. Decision DES-5.
  - Bricolage Grotesque and DM Sans are removed at the end of 9.5, once nothing uses them.
- **`constants/theme.ts`:** the two palettes from the mockups, keeping today's role names so screens don't break, plus
  new roles: `chip`, `chipStrong`, `sheet`, `sticker` (pink `#FF2E7A`), `lineStrong`, `glowOpacity`.
  - Dark: page `#0B0B0D`, card `#151518`, chip `#1F1F23`, text `#F5F5F7`, grey `#8A8A93`.
  - Light: page `#FAFAFA`, card `#FFFFFF`, chip `#F0F0F2`, text `#0B0B0D`, grey `#6E6E76`.
  - Primary button = text colour (white pill in dark, black in light). RSVP and pay buttons take the event colour.
  - `outlineWidth` and the hard-offset `shadow()` go; one soft `elevation` for light mode.
- **Type scale:** 27 / 20 / 15 / 13 / 11.5, weights 400–700, titles at −0.045em. `TEXT_FIX` stays.
- **Radius:** posters 22, cards 18, fields 12, pills round. Buttons are 44pt tall.
- **Motion tokens:** glow breathe (7s), sticker wobble, press spring, confetti. All honour Reduce Motion.
- **Website:** `website/src/app/globals.css` and `website/src/lib/fx.ts` copy the palettes. Update them in 9.15.

### 9.2 UI kit (`components/ui/`)
Restyle in place: `Button` (variants `primary`, `soft`, `line`, `danger`, plus `color` for event colour), `Card` (no
outline), `TextField`, `IconButton`, `Avatar`/`AvatarStack`, `Segmented` (pill tabs), `CountToggle` → chips, `Sticker`,
`EmptyState`, `ListSection`.

New:
- `Sheet`: a bottom sheet on `Modal` + Reanimated, with a grab handle, swipe down to close and a scrim.
- `ListRow`: leading thumb or icon, title, subtitle, trailing action.
- `Money`: mono amounts.
- `Chip`: filter chip with a count.
- `Switch` styling.
- `EventHeader`: back button and a 34pt poster thumbnail on one line, for chat, bills and photos.

### 9.3 Posters and glow
- **`components/ui/Poster.tsx`** replaces `EventCover`. It shows:
  - a two-colour gradient with grain, or the photo with a shade
  - the title in Archivo, shrunk to fit (`adjustsFontSizeToFit` on native, a measure on web)
  - an optional serif line
  - the date and place
  - stickers
  - a `thumb` size for lists and headers
- **Gradients:** RN 0.86's `experimental_backgroundImage` (linear and radial gradients). Confirm it on iOS, Android
  and web in the first session. Fallback: `expo-linear-gradient`. **Grain:** a tiled PNG made by
  `scripts/make-brand-images.py`.
- **Glow:** the poster's colours (or its photo, through `expo-image` `blurRadius`) blurred behind the top of the
  event page and the Next up card. About 50% opacity in dark, 28% in light. Check scroll performance on a low-end
  Android; drop the breathing animation there if needed.
- **Stickers:**
  - wya's own: "8 going", "you're in", "waiting", "time TBD", "open now"
  - plus up to two the host writes (≤ 24 characters each), or none
- **Event looks** (`constants/eventThemes.ts`): seven two-colour looks from the mockups: Sunset, Violet, Ocean, Lime,
  Peach, Tomato, Midnight (decision DES-1).
- **Migration `…_posters.sql`:**
  - `events.poster_line text` (≤ 40 characters, the serif line)
  - `events.stickers text[]` (≤ 2, each ≤ 24 characters)
  - a new `events.theme` check, with old names mapped:
    - lime → lime, violet → violet, ocean → ocean
    - bubblegum → violet, tangerine → sunset, sunset → peach
  - the column grant, `EVENT_COLUMNS` and `get_invite_preview` updated, so a logged-out invite still shows the poster
- `components/EventForm.tsx` gets the serif line and sticker inputs.

### 9.4 Navigation
- **Phone:** the floating bar keeps Events · Chats · + · Photos · You. The Events icon becomes a calendar, and the
  Chats badge uses the sticker pink.
- **Desktop (≥ 1024px):** the sidebar and `StandaloneSidebar` are replaced by a **floating pill top bar**:
  - the logo on the left
  - Events · Chats · Photos · Activity in the centre pill, with badges
  - New event and your avatar on the right

  Pages get the full width; the top padding clears the bar. `useLayout().isWide` stays the switch.

### 9.5 Screens, flow by flow
One session per row. Each matches its mockup and the "Change" note under it.

| Flow | Screens | Behaviour changes |
|---|---|---|
| Getting in | Welcome, Sign up, Sign in | Password show/hide; phone marked optional. **Forgot password:** Supabase reset email + a `reset-password` route (check the Site URL redirect) |
| Invite link | Signed-out invite, Asked to join, Unavailable | Pledge explained before sign-up; faces and counts shown. A separate reason for full / expired / used up (check `get_invite_preview` returns which; small migration if not) |
| Home | Home, first time, Activity | **One time-ordered list** with All / Hosting / Invited / Past chips (replaces the title toggle and the two lists). Next up as a poster with a live "in 2 days". Needs you grouped by kind ("Mark who came · 2") |
| Event, guest | Invited, You're in, Details, I'm here, You owe, Excuse | Three-up RSVP row; quiet counts ("14 going · 5 maybe") replace the colour tiles; the address unlock shown as a moment; "I'm here" as its own state in the check-in window; excuse as a sheet. Split `app/event/[id].tsx` (900+ lines) into components while restyling |
| Event, host | Host page, Guest list, Invite people, Who came?, Pledges | Host tools row (Invite · Remind · Who came · Edit); one Going/Maybe/Waiting bar; guest list and invite people as sheets; check-in times on Who came? |
| Find a time | Pick your times, Lock in | Times as cards with live bars |
| Chats | Chats, Event chat, Slash menu, Poll, Plan | `EventHeader`; your bubbles in the event colour; slash menu as a sheet; `/bill` in the menu |
| Photos | Photos tab, Event album, Viewer | Add photos as a small header button, not a floating one |
| Create and edit | Poster, When and where, Pledge and who gets in, Edit | **Create becomes three steps** (DES-2) with a live poster on top; extras folded under "More details"; a plain-words pledge preview; Delete apart at the bottom in red |
| You | You, Get paid, Assistant | Record as a big stat; Wallet and Your dues rows (Wallet arrives in 9.13); Sign out apart |
| Desktop | Home, Event | Poster + side panel; poster beside the details |

### 9.6 Bills screens
Restyle what `feat/receipt-split` built to match the "Bills and the wallet" mockups:
- the Bills tab (Details · Chat · Bills · Photos)
- reading the receipt, Check the lines, What did you have?, Lock the split
- Your dues

No logic changes; pay buttons keep PayID until 9.13.

---

## 4. Part B: the wallet

**The rule:** wya never moves money without the person tapping to approve it. Locking a split or marking a no-show only
creates a request. Money leaves a wallet only when its owner taps Pay and confirms with Face ID (or the device
passcode).

### 9.10 Payments partner and compliance (founders)
Holding people's money is a stored-value facility in Australia. wya shouldn't hold it: a **licensed payments partner
holds the funds**, and wya keeps the ledger and sends instructions.

Before production, decide:
- which partner (WAL-1)
- who pays top-up fees (WAL-4)
- balance and top-up limits (WAL-5)
- identity checks for cash out (WAL-6)

Until then, everything below runs on a **test balance** on wya-dev, and the screens say so.

### 9.11 Wallet ledger (`…_wallet.sql`)
- **Tables (no direct writes; RPCs only):**
  - `wallets`: `user_id` primary key, `balance_cents` with `check (balance_cents >= 0)`, `currency` (`AUD`).
  - `wallet_txns`: `id`, `kind` (`topup | payment | refund | correction | cashout`), `obligation_id`, `created_at`,
    `created_by`.
  - `wallet_entries`: the double entry. Every txn writes two or more signed rows that sum to zero, in one transaction.
    System wallets stand in for money coming in from top-ups and going out to bank cash-outs.
  - `wallet_settings`: auto top-up `enabled` (off by default), `below_cents`, `amount_cents`, `monthly_limit_cents`,
    `notify`.
- **`obligations`** gains `paid_via text check (paid_via in ('payid', 'wallet'))`. A wallet payment is verifiable, so
  it can't be disputed as "not received". `claim_paid` stays for PayID.
- **RPCs:**
  - `get_my_wallet()`: balance, settings and recent entries.
  - `pay_from_wallet(p_obligation_id)`. The caller must be the debtor and the status `owed` or `disputed`. It locks
    both wallets `for update`, checks the balance, writes the entries, marks the obligation `paid` with
    `paid_via = 'wallet'`, and notifies the creditor. It's idempotent (a double tap is a no-op), and works for pledges
    and bill splits alike.
  - `test_topup(p_cents)`: wya-dev and `@wya.test` accounts only, like `clear_test_notifications`.
  - `request_cashout(p_cents)`: records the request; the partner pays it out (9.12).
  - `set_wallet_settings(...)`.
- **Who sees what:** you see only your own wallet and entries. A creditor sees "paid from wallet" on the obligation,
  never the other person's balance. The assistant context gets no wallet data (same rule as addresses and PayIDs).
- **Unsettled pledge debts still block RSVPs** to that host's events. Paying from the wallet clears the block at once.

### 9.12 Top-up
- Apple Pay on iOS, Google Pay on Android, card on web, through the partner's SDK (or a Stripe-style "platform pay"
  sheet if the partner supports it).
- Edge Function `create-topup` starts the payment. The partner's webhook (`topup-webhook`, verified with a signing
  secret) is **the only thing that credits a wallet**. The app never credits itself.
- Needs: the Apple Developer account and an Apple Pay merchant ID (also needed for push), the partner account, and
  secrets in Supabase (`PAYMENTS_SECRET_KEY`, `PAYMENTS_WEBHOOK_SECRET`). Never in `.env`, `EXPO_PUBLIC_*` or
  `app.json`. Without them the functions answer 503 `not_configured`, as in Phase 8.
- **Auto top-up** only refills. It never pays a share. It runs off a saved partner payment method, after a payment
  attempt finds the balance short, within the monthly limit, and sends a notification every time.

### 9.13 Wallet screens
- **Pay** (pledge and bill): the amount and why, the wallet balance and any shortfall, then two separate steps:
  "Top up $20" and "Pay $39.60 from wallet". "Pay with PayID instead" is always there.
- **Paid:** a confirmation; the creditor's bill card or pledge row updates live.
- **Your wallet** on You: the balance, top up, cash out, auto top-up settings, and recent movements.
- **Face ID:** `expo-local-authentication` (install with `npx expo install` for SDK 57), checked before calling
  `pay_from_wallet` and before a top-up. On web: a confirm step (passkeys later, WAL-3).

### 9.14 Fixing a bill after people paid (brief §5)
The branch defers "corrections after someone has paid … for the wallet"; this item builds them:
- **Nobody paid yet:** unlock (already on the branch).
- **Someone paid:** the payer edits a line and sees a per-person preview before saving.
  - Owe more → a new small `correction` obligation, paid like any other.
  - Owe less → the payer gets a "Refund $X" request and taps to send it from their wallet.
  - Nothing reverses automatically.
- **Requests and limits:** a guest can ask for a change ("I didn't have the garlic bread"); the payer accepts or
  declines. Edits are allowed until everyone has paid, plus 7 days. A disagreement is marked `disputed`; wya doesn't
  decide who's right.
- Migration `…_bill_corrections.sql`; tests extend `test_8_18_receipts.py`.

### 9.15 Docs and rules
- **`CLAUDE.md`:** replace "Still no money through wya" / "wya never touches the money" with the wallet rule above:
  a licensed partner holds funds, every payment needs the person's tap, PayID is the fallback.
- **`docs/FEATURES.md`:** record it in the decision log, and update the payments reasoning and business model (a
  wallet makes a fee possible; WAL-4).
- **`website/`:** the new palette and fonts. Also update the link-preview art (`make-brand-images.py`: `og.png`, the
  app icon, the splash) to the new look.

---

## 5. Database changes

| Migration | Item | What |
|---|---|---|
| `…_posters.sql` | 9.3 | `events.poster_line`, `events.stickers`, new theme names + mapping, grant, `get_invite_preview` |
| `…_invite_reasons.sql` | 9.5 | only if `get_invite_preview` can't say full / expired / used up |
| `…_wallet.sql` | 9.11 | `wallets`, `wallet_txns`, `wallet_entries`, `wallet_settings`, `obligations.paid_via`, the RPCs |
| `…_topups.sql` | 9.12 | top-up and cash-out records the webhook writes |
| `…_bill_corrections.sql` | 9.14 | correction and refund obligations, change requests |

All are safe to re-run, applied with `apply_migration` to wya-dev, and checked by `rls_check.py` afterwards. A new
`events` column goes in the grant and in `EVENT_COLUMNS`.

---

## 6. Tests

- **`rls_check.py`:**
  - no direct reads of others' wallets
  - no direct writes to any wallet table
  - `test_topup` refused for non-test accounts
  - poster columns follow the event's visibility
- **`supabase/tests/phase9/`** (same runner style as Phase 8; one file per item):
  - **Ledger:** every txn sums to zero; balances equal the sum of entries; a balance never goes negative; you can't
    pay someone else's debt; paying twice is a no-op; paying a waived or paid debt is refused.
  - **Concurrency:** 30 guests paying the same host at once (reusing `seed_stress.sql`), plus one person tapping Pay
    on two devices.
  - **Webhook:** a bad signature is refused; a replayed event credits once.
  - **Corrections:** owe more and owe less, after a partial payment.
- **Manual:**
  - each screen against its mockup at 375 and 1280, light and dark
  - the iOS simulator and a real iPhone (Face ID, Apple Pay sandbox)
  - Android (Google Pay test cards)
  - VoiceOver on Home, the event page and Pay
  - Reduce Motion on

---

## 7. Decisions needed

| ID | Question | Default this plan assumes |
|---|---|---|
| DES-1 | Seven event looks (Sunset, Violet, Ocean, Lime, Peach, Tomato, Midnight), with old names mapped? | Yes |
| DES-2 | Create as three steps instead of one long form? | Yes |
| DES-3 | Dark-first for new users, or follow the system setting? | Follow the system; the designs are dark-first |
| DES-4 | Keep confetti on "I'm in"? | Yes, in the event's colours |
| DES-5 | Bundle Archivo Expanded, or use Archivo Black? | Bundle Expanded |
| DES-6 | Host-written stickers: free text, or picked from a list? | Free text, ≤ 24 characters, up to two |
| WAL-1 | Which licensed payments partner holds the funds? | Open: founders to shortlist and confirm licensing |
| WAL-2 | Do wallet payments settle pledges instantly, with no "not received" dispute? | Yes |
| WAL-3 | On web: card top-up and a confirm step instead of Face ID? | Yes; passkeys later |
| WAL-4 | Who pays top-up fees: wya, the person topping up, or nobody at first? | wya absorbs them while proving it out |
| WAL-5 | Limits: max balance, max top-up per month? | $500 balance, $1,000 a month, until the partner sets its own |
| WAL-6 | Identity check before cash out? | Whatever the partner requires; none for paying friends |
| BILL-1 | Edit window after everyone pays | 7 days, as in the brief |

---

## 8. Risks

- **Licensing (WAL-1)** gates production wallet payments. Part A and the test-balance wallet don't wait for it.
- **Gradients and blur** on RN 0.86 across iOS, Android and web are new to this codebase. Confirm them in 9.3 before
  building every screen on them.
- **Android performance** with the glow on long scrolling pages: keep a static fallback.
- **Archivo Expanded** isn't an Expo package (DES-5).
- **`feat/receipt-split` timing:** if it doesn't merge first, 9.6 and parts of 9.5 get redone.
- **The event page** (`app/event/[id].tsx`, 900+ lines) is where most regressions would hide. Split it into
  components as part of its restyle, with no behaviour changes in the same step.
