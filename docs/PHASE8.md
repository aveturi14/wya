# Phase 8: Smart coordination

_Plan written 2026-10-17. 8.0–8.2 built on **`phase8a-core`** (pushed); 8.3–8.9 built on **`phase8a-tier-a`** (branched
from `phase8a-core`, not committed yet). Built to the §6 defaults; the decision rows stay `open` until the founders agree._

## Status (2026-10-17)

| Item | Code | Applied to wya-dev | Tested | Next |
|---|---|---|---|---|
| 8.0 Foundations | ✅ Written | ✅ Applied 2026-10-17 (SQL Editor) | ✅ `run.py --only 8.0`: 13/13; `rls_check.py`: 190/190 after applying; typecheck clean. ⏳ Manual rows 0.1–0.5 | Browser checks (optional: 8.0 has no new buttons) |
| 8.1 Invite hardening | ✅ Written (`20261017000100_invite_hardening.sql`, `InviteSettings` in the event form, "Asking to join" in the guest list, invite page states) | ✅ Applied 2026-10-17 | ✅ `run.py --only 8.1`: 27/27. ✅ Browser: "Who can get in" renders (375, light), saves and reloads (guest limit, approval). ✅ `rls_check.py`: 190/190 after 8.1 + 8.2. ⏳ manual rows 1.2–1.4 (full event, expired link page, approve flow with two accounts) | The two-account checks |
| 8.2 Slash commands + polls | ✅ Written (`20261017000200_polls.sql`, `lib/commands.ts`, `components/chat/PollCard.tsx`, live votes in the chat) | ✅ Applied 2026-10-17 | ✅ `run.py --only 8.2`: 19/19 (incl. 18 concurrent votes). ✅ Browser (375 light + dark, 1280): `/` suggestions, `/poll` creates the card, voting, `/pol` typo kept in the box. Fixed: card side padding, footer wrap. ✅ Live updates across two tabs (a new vote, and a vote switched to another option). Fixed: "cannot add `postgres_changes` callbacks … after `subscribe()`" (see below). ⏳ Close (2.3), a second real device | Close check |
| 8.3 Bill splitting | ✅ Written (`…000300_splits.sql`, `/split`, `SplitCard`, `app/pay/[id].tsx`) | ✅ Applied 2026-10-17 | ✅ `run.py --only 8.3`: 32/32; typecheck clean | Browser checks; manual rows |
| 8.4 "I'm here" | ✅ Written (`…000400_check_in.sql`, `/here`, button on the RSVP card, Who came? shows it) | ✅ Applied 2026-10-17 | ✅ `run.py --only 8.4`: 10/10; typecheck clean | Browser checks; manual rows |
| 8.5 Host record | ✅ Written (`…000500_track_records.sql`, line under the host's name) | ✅ Applied 2026-10-17 | ✅ `run.py --only 8.5`: 7/7; typecheck clean | Browser checks; manual rows |
| 8.6 Nudges | ✅ Written (`…000600_nudges.sql`, `/remind`, Activity wording) | ✅ Applied 2026-10-17 | ✅ `run.py --only 8.6`: 11/11; typecheck clean | Browser checks; manual rows |
| 8.7 Open events | ✅ Written (`…000700_open_events.sql`, "Find a time" in the create form, `OpenEventSlots` on the event page) | ✅ Applied 2026-10-17 | ✅ `run.py --only 8.7`: 17/17; typecheck clean | Browser checks; manual rows |
| 8.8 Home agent v1 | ✅ Written (`…000800_agent_actions.sql`, `InvitePeople`, mute link, You → wya assistant) | ✅ Applied 2026-10-17 | ✅ `run.py --only 8.8`: 36/36; typecheck clean | Browser checks; manual rows |
| 8.9 Flexible plans | ✅ Written (`…000900_plans.sql`, `/plan`, `PlanCard`, live updates) | ✅ Applied 2026-10-17 | ✅ `run.py --only 8.9`: 13/13; typecheck clean | Browser checks; manual rows |
| 8.18 Receipt splits | ✅ Written (`…001000_receipts.sql`, `…000000_bills_tab.sql`, Edge Function `scan-receipt` + `_shared/llm.ts`, `app/receipt/[id].tsx`, Bills tab, Needs you "bill" card, `/split` on its own) | ✅ `receipts` applied 2026-10-17; ⏳ `bills_tab` | ✅ `run.py --only 8.18`: 41/41 (scan 🔒 not deployed); `--only 8.3`: 32/32; `rls_check.py` 189/190 (the failure is an old $5 split owed to Hannah on the Seed Dinner Party, from earlier manual testing). ✅ Scan run locally against wya-dev with a real receipt. ✅ Screens checked headless at 390 wide | Apply `bills_tab`; deploy `scan-receipt` with the key; demo rehearsal |
| 8.10–8.17 (tiers B–E) | Not started | — | Tests written (PENDING) | Need the keys and accounts in §3 (8.16 and 8.17 need none) |

**Tier A applied 2026-10-17** (SQL Editor, in order). `run.py`: **185/185** across 8.0–8.9. Two fixes while applying:
the `split_bills` policy had to come after `obligations.split_id` was added, and `get_plan` can't name an output column
`position` (an SQL keyword), so it returns `item_order`. `rls_check.py` still **190/190**. Checked on web (phone width, dark):
`/plan` (add, +15m, remove), `/split` (card, cancel), Find a time (vote, lock in). Still due: browser checks for the pay
page, `/here`, `/remind` and the host record (they need Gary's account), and the manual rows.

**Built 8.3–8.9: what changed from the plan, and what's left**
- **8.3:**
  - `obligations` gains `kind`/`split_id`; the one-debt-per-guest rule is now a partial unique index for pledges, so
    the two pledge inserts name it (`on conflict … where kind = 'pledge'`).
  - Only pledge debts block RSVPs, count against reliability, or are waived by "Let everyone off".
  - `get_split` also returns `obligation_id` (your own row only), `description`, `total_cents`, `split_status`.
  - Activity `split_owed` opens the pay page; the pay page needs sign-in and comes back after it.
  - "Copy all" added to every PayCard. No bank-app shortcuts yet (SPLIT-4: none verified).
  - Itemised splits weren't built; custom shares exist in the RPC only (`/split` splits evenly).
- **8.4:** `check_in` raises hint `check_in_closed` outside the window; the RSVP card shows "I'm here" or "You
  checked in at …".
- **8.5:** shown to guests under "Hosted by"; hidden until the host has a past event or a late cancellation. The
  tests make Hannah's late-cancellation count grow on wya-dev (expected).
- **8.6:** new columns `rsvps.nudged_at` and `obligations.excuse_prompted_at`; cron job `wya-nudges` every 15 minutes.
  `/remind` is host-only.
- **8.7:**
  - Locking or adding times no longer sends "changed the time" (only "It's on").
  - Open events don't count on the Home dashboard (headline count, hero) until locked, and show "Time TBD".
  - **Not in the app yet:** adding more candidate times after creating (the RPC exists), and a slot label field.
- **8.8:**
  - Direct invites suppress the host's "opened your invite" notification (`wya.direct_invite`, set for the
    transaction).
  - `share_link` returns `url` as a path (`/invite/<code>`); the app adds its web address (`lib/links.ts`).
  - WhatsApp (`wa.me`) and SMS (`sms:`) hand-offs work without new packages.
  - **Not built:** phone contacts (`expo-contacts` isn't installed, and installs were blocked in this session), the
    Assistant activity screen, and the weekly suggestion card (AGT-4).
- **8.9:** `post_plan` posts the card (`/plan`); every card reads `get_plan` live (`plan_items` is in Realtime). Fixed
  times can be set through the RPC; the card's add form doesn't offer a fixed time yet.

**What 8.0 contains (applied to wya-dev)**
- `supabase/migrations/20261017000000_phase8_foundations.sql`:
  - `chat_messages.kind` and `data`, the sender, body and kind checks, and the image backfill;
  - the column insert grant, so clients can't set `data` or `created_at`;
  - the index on `(event_id, created_at desc)`;
  - `private.post_message`, `public.post_bot_message` (service role only), and `get_my_chats` previews for the new kinds;
  - `private.rate_limits` and `private.hit_rate_limit`, plus the daily `wya-rate-limit-cleanup` cron job.
- App:
  - `lib/types.ts`: `ChatMessageKind`; `ChatMessage` gains `kind` and `data`, and its `user_id` is nullable.
  - `app/event/[id].tsx`: sends set an explicit `kind`; wya replies get their own bubble; cards this version can't draw
    show "Update wya to see this message"; the messages state is typed.
- `supabase/functions/_shared/` (`http.ts`, `supabase.ts`): the Edge Function scaffold. It isn't deployed and isn't used
  by any function yet.
- `tsconfig.json` excludes `supabase/functions` (Deno code); `.gitignore` ignores `supabase/functions/.env`.
- Tests: `_harness.py` gained `refused()`, which doesn't count "column or function doesn't exist" as a denial. The 8.0
  checks use it. Before the fix, 11 checks passed only because the migration wasn't applied.

**Still due before 8.0 is done**
1. ~~Apply the migration~~: done 2026-10-17 in the SQL Editor. The session had no Supabase access, so a human applies
   migrations for now.
2. ~~`run.py --only 8.0`~~: 13/13. ~~`rls_check.py` after applying~~: 190/190.
3. Manual checklist rows 0.1–0.5 (`npm run web`; the SQL snippets for a test wya reply and a test poll are in the
   checklist). Check at 375 and 1280 wide, light and dark. 8.0 adds no new buttons: it only shows up through those test
   messages.
4. Then mark 8.0 done here.

**8.1 and 8.2: what's in them, and what was decided while building**
- **8.1 database:**
  - `events.max_guests` (granted; in `EVENT_COLUMNS`);
  - `event_invites.expires_at`, `max_uses`, `uses`, `requires_approval`;
  - a new RSVP status `requested`, plus the `event_personal_invites` table;
  - RPCs: `set_invite_limits`, `approve_join`, `decline_join`, `create_personal_invite`; `accept_invite` and
    `get_invite_preview` (now also returns `requires_approval` and `link_status`) are rewritten;
  - triggers `on_rsvp_capacity` (locks the event row, hint `event_full`) and `on_rsvp_join_guard` (hint
    `join_pending`);
  - notification types `join_requested` and `join_approved`.
- **8.1: where `requested` is excluded.** Someone asking to join isn't a guest anywhere: `is_event_guest`,
  `shares_event_with` (the host still sees the asker's profile, to decide), `get_event_addresses`, and event-change
  notifications all skip them.
- **8.1 link limits** apply only to people joining for the first time. Anyone already on the event can always reopen
  the link.
- **8.1 personal links** skip approval: they're single-use, so they can't spread. The RPC and its checks exist; the app
  button arrives with 8.8 (SMS hand-off).
- **8.1 app:**
  - the event form's "Who can get in" section: guest limit, link expiry (Never / At the start / In 7 days / keep saved),
    link uses, approve joins, and the existing re-share switch;
  - the event page: "N spots left" on the RSVP card, a clear message when full, and Let in / Decline in the guest list;
  - the invite page: expired or used-up states, "Ask to join", and an "Asked to join" waiting screen.
- **8.2 database:**
  - `poll_votes` (in Realtime, select for chat members, no direct writes);
  - `create_poll` (2–6 options, rate limit 10 per event per hour), `vote_poll` (replaces your votes; an empty list
    takes your vote back), `close_poll` (the poll's starter or the host), `get_poll_results` (also returns `closed`).
- **8.2 app:**
  - `/poll [question?] A / B / C` (a `:` also ends the question; commas work when there's no `/`), and `/help`;
  - suggestions appear when you type `/`; a mistyped command offers the closest one;
  - the poll card has bars, voter names, live updates over Realtime, and Close.
  - Only commands that work are offered: `/split`, `/here`, `/plan` and `/remind` join `COMMANDS` in `lib/commands.ts`
    when their items ship (CMD-1).

**Also on this branch (not Phase 8 items)**
- **Realtime fix:** every live subscription now gets a unique channel name (`freshChannel` in `lib/realtime.ts`; used
  by the chat, the album and the unread badges). Before, switching Details ↔ Chat quickly reused a channel that was
  still closing and threw "cannot add `postgres_changes` callbacks … after `subscribe()`". Checked: six quick switches,
  no errors; live votes still arrive.
- **Glow redesign** (from the design board): the whole app restyled through `constants/theme.ts` and the UI kit
  (gradient backdrop, frosted cards, hairlines, soft shadows, gradient headlines, a floating icon rail on desktop), and
  Home rebuilt as a dashboard (`components/home/`). No database change. Checked on web: desktop light and dark, phone
  light, the event page. **Not yet:** iOS / Android (gradients use `experimental_backgroundImage`), phone dark, every
  other screen one by one, and the marketing site in `website/` (still the old colours). Checklist:
  `supabase/tests/native_checklist.md` → "Glow redesign".
- **`docs/REBUILD.md`:** the from-scratch rebuild spec, updated for 8.0–8.2 and Glow.

**Not finished in Phase 8 overall**
- 8.1–8.17 aren't built.
- All 33 decisions in §6 are still `open`.
- No Phase 8 secrets or accounts exist yet (§3).
- Change the remaining test files (8.3 onwards) from `denied()` to `refused()` as each item is built (8.0–8.2 are done).
- When an item's checks first run against wya-dev, expect small fixes on both the contract and the test side.

**Conventions added while building:** Phase 8 error hints are lowercase codes the app branches on (`rate_limited`,
`event_full`, `invite_expired`, …); older hints stay uppercase (`OPEN_DEBT`).

> **Why "Phase 8":** `docs/PHASE7.md` is the merged phone-UI handoff (PR 15), and on macOS `phase7.md` and `PHASE7.md`
> are the same file, so writing this as `phase7.md` would have overwritten it. Rename if you prefer, but keep the old file.

Read `CLAUDE.md` first (conventions, security model), then §1–§3 here, then the item you're building.

---

## 0. How to build from this file

- **Model for the build:** Claude **Opus 5.5** (`claude-opus-5-5`) at **medium** effort. One item per session; start each
  session with "Read CLAUDE.md and docs/PHASE8.md, then build item 8.x".
- **Branches:** one branch and one PR per tier (`phase8a-core`, `phase8b-assistant`, …), or per item if a tier gets big.
  Ask your human whether Claude may run git (see `CLAUDE.md` §7).
- **An item is done when:**
  1. its migration is applied to `wya-dev` with the Supabase MCP `apply_migration`, and its file name ends in the slug
     given below (the test runner finds features by that slug);
  2. `python3 -I supabase/tests/phase8/run.py --only 8.x` shows no ❌ (⏸ PENDING turns into ✅);
  3. `python3 -I supabase/tests/rls_check.py` still passes (run it on its own, not alongside other test scripts);
  4. `npm run typecheck` is clean;
  5. the item's rows in `supabase/tests/phase8/manual_checklist.md` are ticked (web 375 + 1280, light + dark, iOS
     simulator; real devices where noted);
  6. its decisions in §6 are marked `decided`.
- **The contracts in §4 are what the tests check.** If one has to change while building, change this file and the test
  file in the same commit. The live checks were written against these contracts and **have not run yet** (there's
  nothing to run them against); the first session for each item will shake out mistakes on both sides.

---

## 1. Goal and guardrails

**Goal:** make wya better at getting a group from "we should do something" to "everyone turned up", using schedules,
polls, shared costs and a careful assistant, without turning it into a calendar, a group chat or a payments app.

**Guardrails (apply to every item):**
1. **Serve the core:** an RSVP means something. If a feature doesn't help plans happen or people show up, it waits.
2. **The model proposes, people approve.** No message to anyone outside wya, no invite, no debt, and no change to an
   event happens without the person tapping to confirm it. The assistant has **no send or execute tools**.
3. **wya never touches money.** Bill splitting reuses the PayID pattern: people pay each other directly.
4. **Rules live in the database** (functions, triggers, RLS), as with pledges, so the app, the assistant and the tests
   all hit the same checks.
5. **Deterministic first, model second.** Every feature works without a model (buttons, slash commands). The
   assistant only routes into the same RPCs. That keeps costs low and the tests meaningful.
6. **Least visibility:** anything the assistant writes into a chat is built from what *every* reader may see. It never
   includes an address or a PayID.
7. **No server secrets in the app.** Not in `.env` (its values are bundled into the app), not in any `EXPO_PUBLIC_*` variable (bundled into
   the app), not in `app.json`, migrations or tests. See §3.

---

## 2. Priority order

Ordered by dependency first, then value. Tier A needs **no new accounts or keys** and builds everything the assistant
later drives.

| # | Item | Tier | Needs | Depends on |
|---|---|---|---|---|
| 8.0 | Foundations: typed chat messages, rate limits, Edge Function scaffold, test harness | A | nothing | |
| 8.1 | Invite hardening: guest cap, link expiry and uses, approve-to-join, personal links | A | nothing | |
| 8.2 | Slash commands + polls (`/poll`, `/help`) | A | nothing | 8.0 |
| 8.3 | Bill splitting (`/split`) + pay page + copy flow | A | nothing | 8.0, 8.2 |
| 8.4 | "I'm here" check-in (`/here`) | A | nothing | 8.0 |
| 8.5 | Track records: host record (guest record already exists) | A | nothing | |
| 8.6 | Nudges in Activity: unanswered invites, excuse prompt | A | nothing | |
| 8.7 | Open events: candidate times, availability, best slot, lock in | A | nothing | 8.0 |
| 8.8 | Home agent v1, no model: recent people, circles, proposal cards, share to WhatsApp / SMS | A | nothing | 8.1 |
| 8.9 | Flexible plans (`/plan`) with re-flow | A | nothing | 8.0, 8.2 |
| 8.10 | `@wya` chat assistant: summaries, headcount, free text → commands | B | OpenAI key | 8.2–8.9 |
| 8.11 | "Ask wya" bar on Events | B | OpenAI key | 8.8, 8.10 |
| 8.12 | Venue and showtime lookups (`/find`, `/movies`) | C | Places key, showtimes provider | 8.10 |
| 8.13 | Push notifications | D | Apple Developer account, Firebase | |
| 8.14 | Android widget + ongoing notification | D | Firebase (push) | 8.4, 8.13 |
| 8.15 | iOS Live Activity + home-screen widget | D | Apple Developer account | 8.4, 8.13 |
| 8.16 | Live "on my way" (opt-in, ephemeral location) | E | nothing | 8.4 |
| 8.17 | Calendar free/busy to pre-fill availability (on device) | E | nothing | 8.7 |

**Suggested PRs:** A1 = 8.0–8.4, A2 = 8.5–8.9, B = 8.10–8.11, C = 8.12, D = 8.13–8.15, E = 8.16–8.17.
Tier D can start in parallel as soon as the Apple Developer account and Firebase project exist.

---

## 3. Secrets and accounts

### 3.1 What each item needs

| Secret or account | Items | Where it lives | How to get it |
|---|---|---|---|
| _(none)_ | 8.0–8.9, 8.16, 8.17 | | |
| **`OPENAI_API_KEY`** | 8.10, 8.11 (and 8.12 showtimes if decision SHOW-1 picks web search) | Supabase Edge Function secret | platform.openai.com → API keys. Use a project just for wya-dev with its own key, and set a monthly budget on that project |
| `OPENAI_MODEL`, `OPENAI_MODEL_FAST` | 8.10, 8.11 (optional) | Edge Function secrets | The model names to call (AI-1): `OPENAI_MODEL_FAST` for routing and short answers, `OPENAI_MODEL` for summaries and planning. Kept out of the code so a model change needs no deploy; the functions fall back to defaults chosen at build time |
| **`GOOGLE_PLACES_API_KEY`** | 8.12 venues | Edge Function secret | Google Cloud console: a project with billing → enable **Places API (New)** → create an API key → restrict it to Places API only. It's only used server-side, so don't add app restrictions |
| Showtimes provider | 8.12 showtimes | Edge Function secrets | Decision SHOW-1. Option 1: OpenAI's web search tool, called through the Responses API with `OPENAI_API_KEY` (no extra key; billed per search; check it's available to the project when building). Option 2: a showtimes API with Australian coverage, e.g. MovieGlu (`MOVIEGLU_CLIENT`, `MOVIEGLU_API_KEY`, `MOVIEGLU_AUTHORIZATION`; confirm the exact credentials at sign-up) |
| **`PUSH_WEBHOOK_SECRET`** | 8.13 | Edge Function secret **and** Supabase Vault (the database trigger reads it from Vault to call the function) | Generate one: `openssl rand -hex 32` |
| `EXPO_ACCESS_TOKEN` | 8.13 (only if "enhanced push security" is turned on for the Expo project, which is recommended) | Edge Function secret | expo.dev → account settings → access tokens (a robot token) |
| **Apple Developer Program** membership | 8.13 iOS push, 8.15, and universal links | Apple account (paid yearly) | developer.apple.com. Both collaborators should agree whose team owns it, since it ties to the bundle ID |
| **APNs key** (`.p8`) | 8.13, 8.15 | Uploaded to EAS: `eas credentials` | developer.apple.com → Certificates, IDs & Profiles → Keys → new key with APNs |
| `APNS_KEY_P8`, `APNS_KEY_ID`, `APPLE_TEAM_ID` | 8.15, only if Expo's push service can't send Live Activity updates (decision LA-1) | Edge Function secrets | The same `.p8` key's contents, its key ID, and the team ID |
| **Firebase project** + FCM V1 service-account key | 8.13 Android push, 8.14 | Key: uploaded to EAS (`eas credentials`). `google-services.json`: project file referenced from `app.json` (`android.googleServicesFile`) | console.firebase.google.com → add an Android app with package `com.wya.app` → download `google-services.json`; Project settings → Service accounts → generate a key |

**Built in, don't set them:** Supabase gives every Edge Function the project URL and keys automatically. Check the exact
variable names in the Supabase Edge Functions docs when writing `supabase/functions/_shared/`.
The assistant functions should **forward the caller's session** for reads (so RLS applies) and use elevated access only
through narrow `security definer` functions (e.g. `post_bot_message`), never for general queries.

### 3.2 Setting and checking them

```bash
npx supabase secrets set OPENAI_API_KEY=... --project-ref gvfcjxldokhodgnmmqar
npx supabase secrets list --project-ref gvfcjxldokhodgnmmqar
```
Or Dashboard → Edge Functions → Secrets. For local function runs, `supabase/functions/.env` (8.0 adds it to
`.gitignore`). Production gets its **own** keys at launch, set the same way on the production project.

### 3.3 How missing secrets show up

Every Edge Function checks its secrets first and, if one is missing, answers **503**
`{"error": "not_configured", "missing": ["OPENAI_API_KEY"]}`. The test runner reports that as **🔒 BLOCKED**, naming
the secret, rather than as a failure. Nothing else in the app should break when a secret is missing: the related button
or command shows "Not available yet".

---

## 4. Items

Each item lists the migration slug (the file must be `supabase/migrations/<timestamp>_<slug>.sql`), the contract the
tests check, and the decisions it depends on (§6). New `events` columns must also go into the column grant (new
migration, same pattern as `20261012000200_address_gating.sql`) and into `EVENT_COLUMNS` in `lib/events.ts`.

### 8.0 Foundations
**Slug:** `phase8_foundations` · **Test:** `test_8_00_foundations.py`

- **Typed chat messages:** `chat_messages.kind text not null default 'text'` with values
  `text | image | poll | split | plan | bot | system`, and `chat_messages.data jsonb`.
  `user_id` becomes nullable **only** for `bot` and `system` (check constraint). The client insert policy allows only
  `text` and `image` with `user_id = auth.uid()`: every other kind is written by `security definer` functions.
- `private.post_bot_message(p_event_id, p_text, p_data)`: the only way to write `bot` messages, executable by the
  service role only.
- **Rate limits:** `private.rate_limits (key, window_start, count)` and `private.hit_rate_limit(p_key, p_max, p_window)`
  that raises `rate_limited` (errcode `P0001`). Used by polls, splits, invites and every Edge Function.
- **Edge Function scaffold:** `supabase/functions/_shared/` (CORS, a client that forwards the caller's session, the
  `not_configured` check from §3.3, a JSON error helper). Add `supabase/functions/.env` to `.gitignore`.
- Clients get a column-level insert grant on `chat_messages` (`event_id, user_id, content, image_path, kind`), so they
  can't set `data`, `id` or `created_at` (messages couldn't be backdated). Index on `(event_id, created_at desc)`.
  Image messages are sent as `kind = 'image'`; older image-only rows are backfilled.
- `private.post_message(...)` is how later security-definer functions post cards. A daily cron job
  (`wya-rate-limit-cleanup`) clears old rate-limit rows.
- **App:** chat renders by `kind`; kinds this version can't draw yet (poll, split, plan until their items ship) show
  "Update wya to see this message". Replies from wya show the logo and "asked by …" (`data.asked_by_name`).
- `get_my_chats` previews: poll "📊 Poll", split "💸 Split", plan "🗓 Plan", bot "wya: …".
- **Tests:** clients can't insert `bot`/`system`/`poll`/`split`/`plan` messages directly; can't insert with another
  `user_id`; existing text and image messages still work; `kind` is readable.

### 8.1 Invite hardening
**Slug:** `invite_hardening` · **Test:** `test_8_01_invite_hardening.py` · **Decisions:** INV-1, INV-2, INV-3

Do this before anything that spreads links further (8.8): an invite forwarded into an 80-person group chat shouldn't be
able to flood a 12-person dinner, and on pledge events every Going guest is a pledge.

- `events.max_guests int null` (1–500). When the event has that many `yes` RSVPs, setting `yes` fails with
  `event_full`. `maybe` and `invited` aren't capped (INV-1: waitlist later).
- `event_invites`: `expires_at timestamptz null`, `max_uses int null`, `uses int not null default 0`,
  `requires_approval boolean not null default false`.
- `set_invite_limits(p_event_id, p_expires_at, p_max_uses, p_requires_approval)`: host only.
- `accept_invite` raises `invite_expired` / `invite_used_up`, and increments `uses`. With `requires_approval` it
  creates the RSVP as **`requested`** (new status). A `requested` person is **not** a guest: they can't read the event,
  the address, the guest list or the chat, only the invite preview (INV-2).
- `approve_join(p_event_id, p_user_id)` → `invited`; `decline_join(p_event_id, p_user_id)` → row removed, can't rejoin
  (same as `remove_guest`). Both host only. Activity: `join_requested` to the host, `join_approved` to the guest.
- **Personal links:** `create_personal_invite(p_event_id, p_label text) returns text` makes a single-use code (host, or
  a guest when `allow_guest_invites`). Used by 8.8 for SMS sends (INV-3).
- `private.is_event_guest` and every policy using RSVP rows must ignore `requested`.
- **App:** event form "Guest limit" and "Invite link" settings (expiry, uses, approve joins); host sees "Asking to join"
  in the guest list with Approve / Decline; the invite page says "Asked to join — Hannah will let you know".

### 8.2 Slash commands and polls
**Slug:** `polls` · **Test:** `test_8_02_polls.py` · **Decisions:** CMD-1

- **Slash commands are parsed on the client** (`lib/commands.ts`) into RPC calls. The server never parses free text for
  commands; each command is its own RPC with its own permission checks. Typing `/` in the chat shows the commands
  available to *you* in this event (`/help` lists them).
- Commands this phase: `/poll`, `/split` (8.3), `/here` (8.4), `/plan` (8.9), `/remind` (host: same as the 8.6 nudge,
  now), `/find` and `/movies` (8.12), `/help`.
- `create_poll(p_event_id uuid, p_question text, p_options text[], p_multi boolean default false) returns uuid`
  (the chat message id). Caller must be able to chat. 2–6 options, each 1–60 characters; question 1–120. Option ids are
  `'1'`…`'6'` in `data.options`. Rate limit: 10 polls per event per hour.
- `poll_votes (message_id, option_id, user_id)`: a table, not a jsonb counter, so concurrent votes can't overwrite each
  other. In the Realtime publication.
- `vote_poll(p_message_id uuid, p_option_ids text[])` replaces the caller's votes. One option unless `multi`. Refused
  when the poll is closed or the caller can't chat.
- `close_poll(p_message_id uuid)`: the poll's creator or the host.
- `get_poll_results(p_message_id uuid)` returns `(option_id text, label text, votes int, voter_ids uuid[])`.
  Voters are visible to everyone in the chat, as in WhatsApp polls.

### 8.3 Bill splitting and the pay page
**Slug:** `splits` · **Test:** `test_8_03_splits.py` · **Decisions:** SPLIT-1 … SPLIT-5

Covers the "Split costs" write-up in `docs/FEATURES.md` and answers its open questions (guests can add costs they paid;
non-attendees per SPLIT-2).

- **Reuse `obligations`**, extended:
  - `kind text not null default 'pledge'` (`pledge | split`); `reason` adds `shared_cost`.
  - The `unique (event_id, guest_id)` constraint becomes a **partial unique index** for `kind = 'pledge'`; splits use
    `split_id` + `unique (split_id, guest_id)`. So one guest can have a pledge debt and split debts on the same event.
  - `host_id` keeps its name but means "who is owed" (the payer, for splits). Document it in the migration.
  - **`private.has_open_debt` counts only `kind = 'pledge'`**: an unpaid pizza split must not block RSVPs (SPLIT-1).
- `split_bills (id, event_id, payer_id, description, total_cents, currency, message_id, status open|settled|cancelled, created_at)`.
- `create_split(p_event_id uuid, p_description text, p_total_cents int, p_participants uuid[] default null, p_shares jsonb default null) returns uuid`:
  - the caller is the payer (you split what you paid). They must be the host or a `yes` guest, and **must have a PayID**
    (`payid_required`).
  - default participants: the host and every `yes` guest (skipping anyone marked absent in "Who came?"), payer included.
  - **even split:** everyone else owes `floor(total / n)`; the payer absorbs the remainder (so $100 / 3 = $33.33 each
    from the others, the payer's share is $33.34).
  - **custom split:** `p_shares` is `{user_id: cents}` and must add up to the total, payer's own share included
    (`shares_mismatch`).
  - participants must be the host or have RSVP `yes` (SPLIT-2); description 1–80 characters; total $0.01–$10,000.
  - creates one `obligations` row per participant other than the payer (`kind split`, `reason shared_cost`, `owed`,
    the usual `WYA-` reference), a `split` chat message, and an Activity item `split_owed`.
- `get_split(p_split_id uuid)` returns `(user_id, name, share_cents, status, is_payer)` to the payer and participants
  only. Participants see who has paid, not anyone's PayID.
- `cancel_split(p_split_id uuid)`: payer only; open debts become `waived`.
- **Reused as-is:** `claim_paid` ("I've paid", trusted), `dispute_payment` (by the payer), `waive_obligation`,
  `get_payment_instructions` (the payer's PayID, only to someone who owes them, only while open), `get_my_obligations`
  (gains `kind`; drop and recreate since its columns change).
- **Pay page** `https://wya.expo.app/pay/<obligation id>`: needs sign-in as the person who owes (the existing returnTo
  flow), then shows the amount, description, payer, PayID and reference with copy buttons (SPLIT-3).
- **Getting to the bank app (be honest in the UI):** as far as we know there's **no standard PayID link that opens a
  bank app with the details filled in**. So the page offers:
  1. **Copy all**: PayID, amount and reference, then each one separately (bank apps ask for them one at a time);
  2. **Open your bank app**: shortcuts for installed banking apps that publish a URL scheme. This only opens the app
     (SPLIT-4: which banks; each scheme must be listed in `app.json` `ios.infoPlist.LSApplicationQueriesSchemes` to be
     detectable). Verify every scheme on a real phone before shipping it.
  3. PayTo ("request to pay", where the request appears inside the payer's bank app) is **not** built: it needs a
     licensed payment initiator and changes the "wya never touches money" position (SPLIT-5).
- **Chat card:** "Gary paid $240 for dinner · split 6 ways · $40 each", one row per person with Paid / Owes /
  Disputed, and "Pay Gary $40" for whoever is looking at it.
- **Later, not now:** itemised splits (everyone ticks what they ordered), receipt photos. (Built as 8.18.)

### 8.4 "I'm here" check-in
**Slug:** `check_in` · **Test:** `test_8_04_check_in.py` · **Decisions:** CHK-1, CHK-2

- `rsvps.checked_in_at timestamptz` (not in the guest's column grant: written only by the function).
- `check_in(p_event_id uuid) returns timestamptz`: caller has RSVP `yes`; allowed from **2 hours before the start**
  until the end (or **6 hours after the start** if there's no end time). Idempotent.
- `get_guest_list` gains `checked_in_at`, filled in **for the host only** (drop and recreate; its columns change).
- "Who came?" opens with checked-in guests ticked and marked "Checked in 7:42 PM".
- **A self check-in is a claim, not proof.** The host still decides (CHK-1): `record_attendance` can still mark a
  checked-in guest absent. `docs/FEATURES.md` describes a later *verified* check-in (QR at the door, or location) that
  would protect guests from being marked absent; that's a separate item.
- Entry points: `/here` in chat, a button on the event page during the window, the widget (8.14/8.15), a notification
  action (8.13).

### 8.5 Track records
**Slug:** `track_records` · **Test:** `test_8_05_track_records.py` · **Decisions:** REC-1, REC-2

- The guest record already exists (`get_reliability`, shown to hosts and on your own You tab). Copy only: positive
  framing for yourself ("You've made it to 9 of your last 10").
- **Host record (new):** cancelled events are deleted today, so nothing remembers them. Add
  `private.host_cancellations (host_id, event_date, cancelled_at, going_count)`, written by a trigger when an event
  that had at least one `yes` guest is deleted within **48 hours** of its start (or after it).
- `get_host_record(p_host_id uuid) returns (hosted int, happened int, cancelled_late int)`: past events hosted, how many
  had attendance marked or at least one Going guest, and late cancellations. Callable for yourself or a host you share
  an event with; nobody else (REC-1).
- Shown on the event page under the host's name: "Hannah's events: 8 happened, 0 called off late".
- **Known side effect:** the tests delete events with Going guests, so Hannah's late-cancellation count on `wya-dev`
  grows with every run. That's fine on dev; production never runs the tests.

### 8.6 Nudges in Activity
**Slug:** `nudges` · **Test:** `test_8_06_nudges.py` · **Decisions:** NUD-1, NUD-2

In Activity now; 8.13 turns the same rows into push notifications.
- `process_nudges() returns int`, scheduled with the existing `pg_cron` setup every 15 minutes (callable by signed-in
  users like `process_pledge_deadlines`, because it only acts on what's due):
  - **`rsvp_reminder`** to anyone still `invited`: on a pledge event within 24 hours of the cutoff; on other events
    within 24 hours of the start. **Once per guest per event.**
  - **`excuse_prompt`** to a guest with a `late_cancel` debt that's 24 hours old with no excuse: once (NUD-2).
- `/remind` (host) calls `remind_unanswered(p_event_id uuid) returns int`: sends `rsvp_reminder` now to everyone still
  `invited` or `maybe` (regardless of the once-only rule above), at most once every 12 hours per event
  (`rate_limited` otherwise).

### 8.7 Open events
**Slug:** `open_events` · **Test:** `test_8_07_open_events.py` · **Decisions:** OPEN-1 … OPEN-3

"Dinner sometime next week — when works?" The plan is the anchor; the time (and maybe the venue) is decided by the group.
- `events.kind text not null default 'fixed'` (`fixed | open`). An open event **must have `deposit_mode = 'none'`**:
  nobody pledges to a time that doesn't exist yet. `date` stays required and holds the earliest candidate (so sorting,
  cutoffs and the album window keep working); the app shows "Time TBD" while `kind = 'open'`.
  `process_pledge_deadlines`, Maybe expiry and the album window skip open events.
- `event_slots (id, event_id, starts_at, ends_at, label)`, `slot_votes (slot_id, user_id, answer yes|maybe|no)`.
- `add_slots(p_event_id uuid, p_slots jsonb) returns uuid[]`: host only, 2–12 slots in total, all in the future (OPEN-1).
- `set_availability(p_event_id uuid, p_answers jsonb)`: `{slot_id: 'yes'|'maybe'|'no'}` for slots of that event;
  anyone with an RSVP row (not `requested`); replaces earlier answers.
- `get_slot_summary(p_event_id uuid) returns (slot_id, starts_at, ends_at, label, yes int, maybe int, no int, rank int)`:
  rank 1 = most yes, then most maybe, then earliest. The host's own answers count like anyone's. Names of who
  answered what are visible to everyone on the event, as in a Doodle poll.
- `lock_event(p_event_id uuid, p_slot_id uuid)`: host only. Sets `date`/`end_date` from the slot and `kind = 'fixed'`;
  the slots become read-only; everyone gets `event_locked` ("It's on: Sat 7 PM. Are you in?"). **RSVPs don't change
  automatically** (OPEN-2): saying yes to a time isn't saying "I'm in", especially if the host then turns on a pledge.
- After locking, the host can turn on pledges like on any event.
- **App:** create flow gets "Fixed time / Find a time"; the event page shows a grid of slots with ✓ / ? / ✕ per person,
  the best slot highlighted, and "Lock it in" for the host. Venue can stay empty ("Venue TBD") and be filled later from
  a poll or 8.12.

### 8.8 Home agent v1 (no model)
**Slug:** `agent_actions` · **Test:** `test_8_08_agent_actions.py` · **Decisions:** AGT-1 … AGT-4

The proposal-and-approve machinery, usable from buttons today and driven by the assistant in 8.11.
- `get_recent_people(p_limit int default 30) returns (user_id, full_name, avatar_url, events_together int, last_together timestamptz)`:
  people who were at past events with you (host or `yes`). Never anyone you haven't shared an event with.
- `circles (id, owner_id, name)`, `circle_members (circle_id, user_id)`: owner-only (members can't see the labels
  they're filed under). `create_circle(p_name) returns uuid`, `delete_circle(p_circle_id)`,
  `add_circle_member(p_circle_id, p_user_id)` (refuses people you don't share an event with),
  `remove_circle_member(p_circle_id, p_user_id)`.
- `agent_actions (id, user_id, kind, event_id, payload, status, source, created_at, expires_at, decided_at, executed_at, result)`:
  - `kind`: `invite_people | send_reminder | share_link`; `status`: `proposed | approved | executed | cancelled | expired | failed`;
    `source`: `user | suggestion | assistant`.
  - Owner can read; **nobody writes directly**.
- `propose_action(p_kind text, p_event_id uuid, p_payload jsonb, p_ttl_seconds int default 86400) returns uuid`:
  validates the shape, never executes. TTL 1 s–24 h.
- `approve_action(p_action_id uuid) returns jsonb`: owner only, not expired. For `invite_people`
  (`payload.user_ids`) it re-checks everything at approval time and returns `{invited: [...], skipped: [{user_id, reason}]}`:
  - the caller must be the host, or a guest when `allow_guest_invites`;
  - each person must share an event with the caller (`not_connected`), mustn't have been removed from this event
    (`removed`), and mustn't have muted the caller (reported as `unavailable`, so the mute stays private);
  - invited people get an RSVP row `invited` and an Activity item `direct_invite` (AGT-1); the action becomes
    `executed`.
  - Rate limit: 50 people invited per user per day.
- For `share_link` (`payload.channel`: `whatsapp | sms | other`), approving returns `{text, url}` (the drafted
  message and the invite link) and leaves the action `approved`; the app opens the share sheet or composer, then calls
  `mark_action_executed(p_action_id)`. wya can't confirm the message was actually sent.
- `cancel_action(p_action_id)`; a cancelled or executed action can't be approved.
- `mute_host(p_host_id uuid)` / `unmute_host(p_host_id uuid)`: stop direct invites from someone (AGT-2).
- **Outside wya (client only, nothing on the server):**
  - **WhatsApp:** the share sheet, or WhatsApp's own "send text" link, with the message and link prefilled. **The person
    picks the group.** wya can't read WhatsApp groups or their activity and doesn't try.
  - **SMS:** `expo-sms` opens the composer with recipients and text; the person taps send.
  - **Contacts:** `expo-contacts`, asked when first used; the person picks people; nothing is uploaded (AGT-3).
  - Links sent outside wya use the event's invite link, or a personal link (8.1) for SMS.
- **Capability switches** in You → Assistant, all **off by default**: "Suggest people from my past events", "Use my
  contacts", "Let the assistant draft messages" (`agent_grants (user_id, capability, enabled)` with capabilities
  `suggest_people | use_contacts | draft_messages`; `set_agent_grant(p_capability, p_enabled)`; owner-only).
  8.11 checks them; a switched-off capability is removed from the assistant's tools.
- **Suggestions:** at most one card a week ("Invite last Friday's crew again?"), dismissable for good (AGT-4).
- **Assistant activity** screen: every proposal and what happened to it.

### 8.9 Flexible plans
**Slug:** `plans` · **Test:** `test_8_09_plans.py` · **Decisions:** PLAN-1

"Dinner, then maybe a movie, then drinks." A short itinerary inside the event, not a calendar.
- `plan_items (id, event_id, position, title, duration_minutes, fixed_start, created_by, created_at)`; at most 8 per
  event; durations 5 minutes–12 hours.
- `add_plan_item(p_event_id uuid, p_title text, p_duration_minutes int, p_fixed_start timestamptz default null) returns uuid`:
  anyone who can chat. Appended at the end.
- `delay_plan_item(p_item_id uuid, p_minutes int)`: anyone who can chat ("dinner's running 45 minutes over").
- `remove_plan_item(p_item_id uuid)`: the item's creator or the host.
- `get_plan(p_event_id uuid) returns (id, item_order, title, duration_minutes, fixed_start, starts_at, ends_at, conflict boolean, created_by)`,
  re-flowed every call: the first item starts at the event's start; each later item starts when the previous one ends,
  unless it has a `fixed_start` (a booking, a session time), which it keeps; `conflict` is true when the previous item
  ends after that fixed start.
- In chat, `/plan` shows the card; a conflict reads "Dinner now ends 9:45, the movie starts 9:30". 8.10 adds suggested
  fixes (a later session, swap the order).

### 8.10 `@wya` chat assistant
**Function:** `assistant-chat` · **Test:** `test_8_10_assistant_chat.py` · **Secrets:** `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`, `OPENAI_MODEL_FAST`) ·
**Decisions:** AI-1 … AI-3

- The client posts the person's message normally, then calls the function with `{event_id, message_id}`. The function
  checks (with the caller's session) that the message is theirs, in that event, starts with `@wya`, and that they can
  chat. Otherwise 403.
- **Deterministic before the model:** "headcount", "who's coming", "polls", "plan", "help" are answered from the
  database with no model call.
- **Model tools (read and post only):** recent messages (last 50), headcount, the poll and plan RPCs, and "suggest a
  command": a card that pre-fills `/split …` or `/poll …` for the person to tap. **It can't create debts, invites or
  event changes**, so the worst a prompt injection can do is post a message or a poll.
- Context never includes an address, a PayID, notes to the host, or anything from another event (AI-2). Every chat
  message is treated as untrusted data.
- Replies are written by `private.post_bot_message`, shown with the wya logo and "asked by Gary".
- Rate limits: 20 assistant calls per event per hour, 100 per person per day (`rate_limited` → 429).
- **Model (AI-1):** OpenAI, through the Chat Completions or Responses API with function calling (the tools above are
  declared as functions; the model only ever *asks* for a tool, and the Edge Function decides whether to run it). A
  small, fast model (`OPENAI_MODEL_FAST`) for routing and short answers; a stronger one (`OPENAI_MODEL`) for "what did we
  decide?" summaries. Pick the current models from OpenAI's list when building. Log token counts per call for cost
  tracking.
- **One provider file:** all OpenAI calls go through `supabase/functions/_shared/llm.ts` (one `complete()` with tools),
  like `lib/payments/` for PayID, so changing provider later touches one file.

### 8.11 "Ask wya" bar on Events
**Function:** `assistant-home` · **Test:** `test_8_11_assistant_home.py` · **Secrets:** `OPENAI_API_KEY` ·
**Decisions:** AI-1, AGT-1

- A bar at the top of Events: "Invite last Friday's people to Saturday", "Remind everyone who hasn't answered".
- `{text}` in, `{reply, action_ids}` out. Tools: `get_recent_people` (only with "Suggest people" on), circles, your
  upcoming hosted events, draft a message (only with "Draft messages" on), and `propose_action`. **No tool executes
  anything**; the reply shows proposal cards with the recipients listed and editable, and Approve / Cancel.
- Everything it reads goes through the caller's session, so it can never see or propose anyone the person couldn't.

### 8.12 Venue and showtime lookups
**Function:** `lookup` · **Test:** `test_8_12_lookups.py` · **Secrets:** `GOOGLE_PLACES_API_KEY`, showtimes per SHOW-1 ·
**Decisions:** SHOW-1, LOOK-1

- `/find thai near Fitzroy for 8 saturday` and `/movies hoyts melbourne central saturday` (or via `@wya`).
- `{event_id, type: 'places'|'showtimes', query}` (any other type → 400; logged out → 401) → up to 5 results `{name, address, rating, price_level, maps_url}` or
  `{film, cinema, starts_at, booking_url}`, posted as a bot message with **"Make it a poll"**.
- Location comes only from the words typed (a suburb), never the person's GPS (LOOK-1).
- Caller must be able to chat. Rate limit: 10 lookups per event per hour.
- **Picking a result:** the host taps "Use this venue" and the event's venue updates (the normal edit rules apply).

### 8.13 Push notifications
**Slug:** `push` · **Function:** `send-push` · **Test:** `test_8_13_push.py` · **Needs:** Apple Developer account,
Firebase, `PUSH_WEBHOOK_SECRET` (+ `EXPO_ACCESS_TOKEN`) · **Decisions:** PUSH-1

- `expo-notifications`; ask for permission at a useful moment (after the first "I'm in"), not at launch.
- `push_tokens (user_id, token, platform, updated_at)`; `register_push_token(p_token text, p_platform text)` (Expo token
  format, `ios | android`), `unregister_push_token(p_token text)`. Own rows only.
- A trigger on `notifications` insert calls `send-push` (`{notification_id}`) through `pg_net`, with
  `PUSH_WEBHOOK_SECRET` read from Vault. The function rejects any call without that secret with 401/403, even from
  signed-in users, so nobody can trigger pushes by hand. Tokens can't be written directly.
- `notification_prefs`: per type on/off (PUSH-1: which types default on).
- Notification actions: "I'm here" (8.4) and "I'm in / Can't go" on reminders.

### 8.14 Android widget and ongoing notification
**Slug:** `widget_snapshot` · **Test:** `test_8_14_widget_android.py` · **Decisions:** WID-1

- `get_widget_snapshot() returns (event_id, title, starts_at, ends_at, status, venue_name, address, owed_cents, owed_to, latest)`,
  up to 3 rows: events today (starting within 24 hours or in progress) and open debts. **`address` follows the same
  rule as `get_event_addresses`** (it's on a lock screen). Shared with 8.15.
- Home-screen widget (Jetpack Glance through a config plugin; check the SDK 57 docs for the current way, per
  `AGENTS.md`) reading a snapshot the app writes to shared storage; refreshes when the app opens and on push.
- On the event day, an **ongoing notification** (countdown, "I'm here" button) takes the place of a Live Activity.

### 8.15 iOS Live Activity and home-screen widget
**Slug:** `live_activity` · **Function:** `live-activity` · **Test:** `test_8_15_widget_ios.py` · **Needs:** Apple
Developer account, APNs key · **Decisions:** LA-1, WID-1

- **Live Activity** for the event day (lock screen + Dynamic Island): countdown → "Happening now" with the latest host
  announcement and **I'm here** → after, "You owe Gary $23 · Pay" until settled.
- Started when the app opens on the day (and by push-to-start where supported), updated by push from `live-activity`.
- `live_activity_tokens (user_id, event_id, token, kind push_to_start|update)`;
  `register_live_activity_token(p_event_id, p_token, p_kind)` for the host or a `yes` guest of that event; each person
  reads only their own tokens. `live-activity` takes `{event_id}` and, like `send-push`, only answers calls carrying
  the webhook secret.
- Small home-screen widget: next event and open debts, from the same snapshot (App Group shared storage).
- Widgets are SwiftUI targets added with a config plugin; ios/ stays generated.

### 8.16 Live "on my way" (opt-in)
**Slug:** `meetup_mode` · **Test:** `test_8_16_live_location.py` · **Decisions:** LOC-1

- The host turns on **meetup mode**: `set_meetup_mode(p_event_id uuid, p_on boolean)`, allowed from 2 hours before the
  start to 1 hour after the end; sets `events.meetup_until`.
- Guests who are Going can tap **"I'm on my way"**, which asks for location permission at that moment and shares a
  **distance bucket** ("5 min away", "15+ min", "not left yet", "arrived") over a **private Realtime channel**
  (`meetup:<event_id>`, Realtime Authorization so only the host and `yes` guests can join).
- **Location is never stored:** the phone works out the bucket against the venue's coordinates and sends only that.
  Sharing stops when they arrive, tap stop, or meetup mode ends.
- The venue can change mid-plan (dinner moved): the host updates the venue and everyone's bucket recalculates.

### 8.17 Calendar free/busy (on device)
**Test:** `test_8_17_calendar.py` · **Decisions:** CAL-1

- On an open event's availability grid, "Fill from my calendar" reads the phone's calendars with `expo-calendar`
  (Apple, and Google/Outlook accounts synced to the phone) and pre-ticks free slots. **Only the person's yes/maybe/no
  answers leave the phone**, never event titles or times.
- No server-side calendar integration and no OAuth this phase (CAL-1), so no secrets.

### 8.18 Receipt splits (scan, claim, confirm, lock)
**Slug:** `receipts` · **Function:** `scan-receipt` · **Test:** `test_8_18_receipts.py` · **Secrets:** `OPENAI_API_KEY`
(optional `OPENAI_MODEL_VISION`) · **Decisions:** RCPT-1 … RCPT-3, SPLIT-2

The person who paid snaps the bill, wya reads the lines, everyone going ticks what they had and confirms their share,
and locking turns the shares into ordinary 8.3 split debts (PayID, the pay page, "I've paid"). Brief: `wya Split`.
- **Status:** `draft` (payer only) → `claiming` → `locked`, or `cancelled`. Tables `receipts`, `receipt_items`
  (`kind` item | adjustment; `rate_bp` for "10%" surcharges; `flagged`), `receipt_claims`, `receipt_confirmations`. No
  direct writes; private bucket `receipts` (`<event>/<uid>/<id>.jpg`, JPEG, 5 MB).
- **Who:** the payer is anyone going (host, or `yes` and not marked absent, `private.is_going`), with a PayID. The same
  people claim (SPLIT-2). Drafts are the payer's alone.
- **The maths (`private.receipt_shares`):** each item splits evenly between the people who ticked it; adjustments
  (surcharges, tips, discounts) split by each person's share of the items; GST is never added. Exact amounts are
  floored to the cent for everyone but the payer, whose share is the rest, so the shares always equal the total.
- **The scan must add up:** `send_receipt` refuses (`receipt_unbalanced`) unless items = the printed subtotal (when
  there is one) and items + adjustments = the total. The scan flags unsure lines and lines whose quantity × price
  doesn't match.
- **Confirming:** a confirmation stores the share it agreed to and only counts while the share is unchanged
  (`share_changed` if it moved). Lock needs every item ticked and every claimer confirmed (RCPT-1); the payer hears
  `receipt_ready` once per round.
- **Lock** calls `private.create_split_core(..., post_card = false)` (the 8.3 logic, now shared with `create_split`), so
  the bill card shows the split; no second card. **Unlock** only while every debt is still `owed`: the split and its
  `split_owed` notifications are deleted, ticks stay. **Cancel** waives what's owed (`cancel_split`).
- **Editing after sending:** `edit_receipt_item` keeps ticks on other lines, recalculates percentage surcharges and the
  total, and marks the card "Edited". Corrections after someone has paid (extra requests, refunds) wait for the
  wallet.
- **`scan-receipt`:** caller's session only; `begin_receipt_scan` checks payer + draft + 10 scans an hour before any
  model call; one OpenAI Responses call with a strict JSON schema through `_shared/llm.ts`; the receipt text is
  treated as data. Without the key: 503 `not_configured`, and the app offers "Type the lines in" (and the demo receipt
  on dev builds / `@wya.test`, RCPT-3).
- **App:** a **Bills** tab on the event page (Details · Chat · Bills · Photos, for people going) with "Paid the bill?"
  and every bill with its live progress; `/split` on its own opens it. Bills are kept **out of the chat**
  (`…000000_bills_tab.sql`: `send_receipt` posts no card), so the chat stays for talking. `app/receipt/[id].tsx` for
  the bill itself; Needs you "What did you have?"; Activity `receipt_to_claim`, `receipt_ready`, `receipt_reopened`.
- **Checked with a real receipt (Uncle Ming's, $289.80):** `gpt-5-mini` read all 11 items and both surcharges exactly
  in ~20 s (3.2k tokens in, 1.5k out). Its "Service charge (10%)" was $24.15, not 10% of the subtotal, so a
  percentage is only kept when it really matches; otherwise the printed amount stands.

---

## 5. Tests

```
supabase/tests/phase8/
  run.py                    # runner: python3 -I supabase/tests/phase8/run.py [--only 8.3] [--offline] [--strict]
  _harness.py               # shared helpers (loaded by run.py; never run directly)
  test_8_00_foundations.py … test_8_17_calendar.py   # one per item
  manual_checklist.md       # what a script can't check: UI, share sheet, widgets, devices
```

**Statuses:**

| | Meaning | Fails the run? |
|---|---|---|
| ✅ PASS | Check passed | |
| ❌ FAIL | Check failed. When it depends on an open decision, the line names it ("assumes SPLIT-2") | **yes** |
| ⏸ PENDING | Not built yet (its migration or function isn't in the repo) | no |
| 🔒 BLOCKED | Built, but a secret or account is missing (the function returned `not_configured`) | no |
| ⏭ SKIPPED | Live checks couldn't run (`--offline`, or `.env` unreadable) | no |
| ❓ CLARIFY | Open decision from §6, printed under its item | only with `--strict` |

**How it works:**
- A feature counts as built when `supabase/migrations/*_<slug>.sql` (or `supabase/functions/<name>/index.ts`) exists.
- Live checks run against **wya-dev only** (same guard as `rls_check.py`), sign in as the seed accounts, create
  temporary events titled `RLS temp event: …` (so `clear_test_notifications` cleans their Activity), and delete what
  they create. Gary's PayID is set for the split tests only if he had none, and removed afterwards.
- Open decisions are read from the table in §6, so this file stays the single source; mark a row `decided` and the
  runner stops listing it.
- Run it **on its own**, not at the same time as `rls_check.py` or `stress_pledges.py` (they share accounts).
- Today, every item reports PENDING and the open decisions are listed. That's the expected starting state.

---

## 6. Decisions needed

The runner reads this table. The **default** is what the plan and the tests assume until someone changes it. Change the
last column to `decided` once agreed (and update the default if the answer differs).

| ID | Question | Default the plan and tests assume | Status |
|---|---|---|---|
| INV-1 | When an event is full, should there be a waitlist? | No waitlist this phase; `yes` is refused with `event_full` | open |
| INV-2 | Should approve-to-join be on by default for links shared outside wya? | Off by default; the host turns it on per event | open |
| INV-3 | Can guests (not just hosts) create personal invite links? | Yes, when `allow_guest_invites` is on | open |
| CMD-1 | Which slash commands ship in the first release? | `/poll`, `/split`, `/here`, `/plan`, `/remind`, `/help` (lookups come with 8.12) | open |
| SPLIT-1 | Should unpaid split debts block RSVPs like pledge debts? | No: only pledge debts block | open |
| SPLIT-2 | Can a split include people who weren't Going (e.g. paid for a ticket but didn't come)? | No: host and `yes` guests only | open |
| SPLIT-3 | Should the pay page work logged out (with a secret link) or require sign-in? | Require sign-in as the person who owes | open |
| SPLIT-4 | Which banks get an "Open your bank app" shortcut? | None until each scheme is verified on a real phone (CBA, Westpac, NAB, ANZ, ING, Up to check) | open |
| SPLIT-5 | Pursue PayTo "request to pay" later? | No; record in `docs/FEATURES.md` as decided against for now | open |
| RCPT-1 | Must every claimer confirm before the payer can lock a receipt split? | Yes: every ticked item, and every claimer confirmed at their current share | open |
| RCPT-2 | Can the payer tick items for someone who isn't using wya? | Not yet; they can only be left with the payer | open |
| RCPT-3 | Who gets the saved demo receipt when scanning fails? | Dev builds and `@wya.test` accounts only | open |
| CHK-1 | Does a self check-in protect a guest from being marked a no-show? | No: it pre-ticks "Who came?"; the host decides | open |
| CHK-2 | Check-in window | 2 h before the start until the end (or start + 6 h) | open |
| REC-1 | Who can see a host's record? | The host and people who share an event with them; not on the logged-out invite page | open |
| REC-2 | What counts as a late cancellation by a host? | Deleting an event with Going guests within 48 h of its start | open |
| NUD-1 | Reminder timing for unanswered invites | Pledge: within 24 h of the cutoff; others: within 24 h of the start; once | open |
| NUD-2 | Prompt guests with a late-cancel debt to add an excuse? | Yes, once, 24 h after the debt | open |
| OPEN-1 | Can guests propose candidate times on open events? | No: host only (guests can suggest in chat or a poll) | open |
| OPEN-2 | When the host locks a time, are "yes to this time" answers turned into "I'm in"? | No: everyone is asked again | open |
| OPEN-3 | Can an open event be created with a pledge, applied when locked? | No: pledges are switched on after locking | open |
| AGT-1 | Can wya invite existing users directly (no link), for people you've been to events with? | Yes, from approved proposals only, with mute and a 50/day limit | open |
| AGT-2 | Should people be able to mute a host's direct invites? | Yes; the host just sees "unavailable" | open |
| AGT-3 | Match phone contacts against wya accounts? | Not this phase: contacts only feed SMS / share sheet | open |
| AGT-4 | Proactive suggestion cards | At most one a week, dismissable for good | open |
| PLAN-1 | Who can edit a plan? | Anyone who can chat adds and delays items; the creator or host removes them | open |
| AI-1 | Which models at runtime? | OpenAI: a small, fast model for routing and a stronger one for summaries, named in `OPENAI_MODEL_FAST` / `OPENAI_MODEL` (the build itself uses Claude Opus 5.5) | open |
| AI-2 | Should the assistant ever mention the address? | Never | open |
| AI-3 | Monthly spend cap for the assistant on wya-dev | A monthly budget on the OpenAI project before the key is added (amount for the founders to pick) | open |
| SHOW-1 | Showtimes source | OpenAI's web search tool (no extra key) | open |
| LOOK-1 | May lookups use the phone's GPS? | No: only the suburb typed | open |
| PUSH-1 | Which notification types are on by default? | Reminders, debts, event changes, chat mentions; new chat messages off | open |
| WID-1 | Should the widget show the address when allowed? | Yes, when the person may see it (same rule as the event page) | open |
| LA-1 | Can Expo's push service send Live Activity updates, or do we call APNs directly? | Check the SDK 57 / Expo push docs; tests assume direct APNs (`APNS_*` secrets) | open |
| LOC-1 | Should live location be offered on non-open events too? | Yes, any event, only while meetup mode is on | open |
| CAL-1 | Server-side Google Calendar sync? | No: on-device only | open |

---

## 7. Not building (and why)

| Idea | Why not |
|---|---|
| Reading WhatsApp groups or their activity | Not possible for third-party apps, and it would be invasive. wya prepares the message; the person picks the group |
| Sending anything silently or on a schedule outside wya | Breaks "people approve"; spam rules |
| PayTo / wya-initiated payments | Needs licensing and puts wya in the money flow (SPLIT-5) |
| Paying from an in-app wallet | Planned separately (the wya Split brief): needs a licensed payments partner and changes "wya never touches money". Receipt splits (8.18) settle by PayID until then |
| A map view of where people are | Distance buckets do the job without coordinates leaving the phone |
| Assistant that changes events or guest lists by itself | Proposals only, by design |
| Public events or discovery | wya is invite-only (`docs/FEATURES.md`) |

## 8. Things to verify before building (not certain today)

- **Expo SDK 57 widgets / Live Activities:** what's first-party now versus a community config plugin. Read the v57 docs.
- **Live Activity pushes through Expo's push service** (LA-1).
- **Bank URL schemes** (SPLIT-4) and **WhatsApp's prefilled-text link** on current iOS and Android.
- **Spam Act 2003 (Australia):** personal invitations sent by the person from their own phone should be fine, but get
  a quick professional check before launch, along with the payments question already noted in `docs/FEATURES.md`.
- **Google Places pricing** and the showtimes provider's terms (attribution, caching rules).
- **Apple's Live Activity limits** (duration, update frequency) at the time of building.

## 9. Files this phase is expected to add

- `supabase/migrations/*_{phase8_foundations,invite_hardening,polls,splits,check_in,track_records,nudges,open_events,agent_actions,plans,push,widget_snapshot,live_activity,meetup_mode}.sql`
- `supabase/functions/{_shared,assistant-chat,assistant-home,lookup,send-push,live-activity}/`
- `lib/commands.ts`, `lib/payments/payid.ts` (copy-all text, bank shortcuts), `app/pay/[id].tsx`,
  chat cards in `components/chat/` (poll, split, plan, bot), `components/agent/` (proposal card, Ask bar),
  `app/assistant.tsx` (assistant activity), widget config plugin(s)
- `supabase/tests/phase8/*` (already added with this plan)
