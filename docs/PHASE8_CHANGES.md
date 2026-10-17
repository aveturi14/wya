# Phase 7 → Phase 8: what changed, and what we kept

_Written 2026-10-17 on branch `revert-to-phase7-ui`._

Between the Phase 7 merge (`845d2c4`, PR 15) and `main` at `49b32d2` (PRs 16 and 17), two things landed together in the same commits:

1. **The "Glow" redesign:** a new look for the whole app plus a dashboard-style Home.
2. **Phase 8 tier A (8.0–8.9):** new features (polls, bill splits, check-in, open events and more), backed by ten migrations.

Neither of us liked the redesign. **This branch puts the Phase 7 look back and keeps every Phase 8 feature**, restyled with the Phase 7 kit. This file records what Glow did (so we can bring individual pieces back later) and what Phase 8 added (all still live).

---

## 1. The Glow redesign (rolled back on this branch)

### Theme (`constants/theme.ts`)

| | Phase 7 ("Soft pop" / "After dark"), restored | Glow (removed) |
|---|---|---|
| Light background | cream `#FFF6EC` | `#F7F3F6` with a pastel gradient mesh behind every page |
| Light primary / secondary | violet `#8B5CFF` / tangerine `#FF6A3D` | indigo-violet `#5B47F0` / `#F2662E` |
| Dark background / primary / secondary | `#0B0B0F` / lime `#D4FF3F` / hot pink `#FF3CAC` | `#08080C` / `#D7F74A` / `#FF4F9A`, plus a dark mesh |
| Outlines | 2px ink outlines (light), solid borders | 1px translucent hairlines |
| Shadows | hard offset "pop" shadow (`shadow(n)` = `n px n px 0`) | soft blurred shadows |
| Cards | solid surface + outline | frosted glass (`theme.glass`: translucent fill, blur on web) |
| New helpers | — | `theme.gradient(css)`, `theme.gradients` (headline, headlineWarm, accent, heroBase, mesh), `linear()`, `glass` / `glassBorder` colours |

### Component kit (`components/ui/`)

- **New, now deleted:** `Backdrop` (page gradient), `Eyebrow` (uppercase pill label with a dot), `GradientText` (gradient headline text), `DotRing` (progress ring made of dots).
- **Changed, now restored:** `Button` (new `contrast` variant; soft shadow), `Card` (glass), `IconButton`, `Avatar` (ring colour), `Sticker` (1px hairline instead of a 1.5px outline), `Screen` and `TabScreen` (draw the `Backdrop`; frosted status-bar strip on web).

### Navigation (`components/nav/AppTabBar.tsx`)

- Desktop: Glow swapped the 240px **sidebar** (logo + labels) for a floating **icon rail**. The sidebar is back.
- The Events tab icon changed from `sparkles` to `home`. It's `sparkles` again.

### Home (`app/(tabs)/home.tsx`, `components/home/*`)

Glow rebuilt Home as a dashboard. The **Phase 7 Home is back**: "Hey Hannah / Upcoming" header, Activity bell, Needs you, Invited/Hosting toggle, and the event list.

The dashboard widgets are deleted. They're all in git if we want one back:

| Widget | What it showed | Phase 8 data it relied on |
|---|---|---|
| `Headline` | "Evening, Hannah. 3 plans are actually happening." (gradient text) | — |
| `Ticker` | latest Activity as scrolling chips | — |
| `HeroEvent` | next plan as a big dark card with a live countdown | — |
| `Commitment` | Going / Maybe / Waiting ring for the next plan | — |
| `PledgesWidget` | money owed to you | pledges (Phase 3) |
| `PollWidget` | the newest open poll, with a link to the chat | 8.2 polls |
| `ActivityWidget` | Activity list on desktop | — |
| `AlbumWidget` | newest album photos | Phase 4 album |
| `WidgetCard` | shared card shell for the widgets | — |

**Candidates to bring back** (pick per item, restyled to Phase 7):
- The **next-plan countdown** (`HeroEvent`) as a plain Phase 7 card above the list.
- **`PollWidget`**: it's the only way Home surfaces open polls.
- The **"New plan" pill** on desktop (Phase 7 relies on the rail's + / the sidebar's New event).

### Restyled screens (back to Phase 7 styling, features kept)

`app/event/[id].tsx`, `app/invite/[code].tsx`, `app/pay/[id].tsx`, and the Phase 8 cards (`PollCard`, `SplitCard`, `PlanCard`, `OpenEventSlots`, `InvitePeople`) were written against Glow (`theme.glass`, gradients, `Eyebrow`, `Button variant="contrast"`). On this branch they use Phase 7 tokens: solid `surface` cards with the outline, `primary`/`secondary` instead of gradients, `Sticker` instead of `Eyebrow`.

### Small non-visual fixes that rode along with Glow (kept)

- **`lib/realtime.ts` → `freshChannel()`:** unique Realtime channel names. Fixes "cannot add `postgres_changes` callbacks … after `subscribe()`" on quick re-subscribes. `useAlbum`, `useUnread` and the event chat use it.
- **`useObligations` returns `loaded`** (tells "nothing owed" from "not loaded yet"); used by the pay page.
- **`tsconfig.json` excludes `supabase/functions`** (Deno code, not part of the app build).
- **`.gitignore` ignores `.env`** (it was committed in Phase 7). Copy `.env.example`.

---

## 2. Phase 8 tier A (all kept)

Full plan, contracts and decisions: `docs/PHASE8.md`. Every migration below is **applied to wya-dev**, and `supabase/tests/phase8/run.py` covers them (185/185 at the time of writing).

| Item | What the user sees | Database (`supabase/migrations/`) | App files |
|---|---|---|---|
| **8.0 Foundations** | Nothing new. Chat messages get a type (`text`, `image`, `poll`, `split`, `plan`, `bot`, `system`), rate limits exist, Edge Function scaffold | `20261017000000_phase8_foundations.sql` | `lib/types.ts` (`ChatMessageKind`), `supabase/functions/_shared/*` |
| **8.1 Invite hardening** | Event form's **"Who can get in"**: guest limit, link expiry/uses, "ask me first" approval. Guest list gets an **Asking to join** section. Invite page shows expired / used up / full / waiting states | `…000100_invite_hardening.sql` (`max_guests`, rsvp status `requested`, `approve_join`, `decline_join`, `set_invite_limits`, new `get_invite_preview` columns) | `components/InviteSettings.tsx`, `EventForm`, `GuestList`, `app/invite/[code].tsx`, event page (event full alert) |
| **8.2 Slash commands + polls** | Type `/` in the event chat for suggestions. `/poll Where? Pizza, Thai` posts a live poll card. `/help` | `…000200_polls.sql` (`create_poll`, `vote_poll`, `close_poll`, `get_poll_results`) | `lib/commands.ts`, `components/chat/PollCard.tsx`, event page chat |
| **8.3 Bill splitting** | `/split 120 Dinner` posts a split card. Each person owes their share by PayID. A **pay page** (`/pay/<id>`) with Copy all. Splits never block RSVPs | `…000300_splits.sql` (`obligations.kind = 'split'`, `split_bills`, `create_split`, `get_split`, `cancel_split`) | `components/chat/SplitCard.tsx`, `app/pay/[id].tsx`, `PayCard`, `lib/pledges.ts` (`isPledgeDebt`), Home's Needs you |
| **8.4 "I'm here" check-in** | **I'm here** button on the RSVP card around the start time, or `/here`. Who came? shows "Checked in 7:42 PM" | `…000400_check_in.sql` (`rsvps.checked_in_at`, `check_in`) | event page, `AttendanceCard`, `lib/pledges.ts` (`canCheckIn`) |
| **8.5 Host record** | A line under the host's name for guests ("Hannah's events: 8 happened · 0 called off late") | `…000500_track_records.sql` (`get_host_record`) | event page (`HostRecord`) |
| **8.6 Nudges** | Host's `/remind` nudges people who haven't answered. Activity shows "X is waiting on your answer" and "Missed it? You can tell X why" | `…000600_nudges.sql` (`remind_unanswered`) | `lib/notifications.ts`, event page |
| **8.7 Open events** | Create form **"Find a time"**: offer candidate times, guests mark which work, host locks one in. Shows "Time TBD" until then | `…000700_open_events.sql` (`events.kind = 'open'`, `event_slots`, `slot_votes`, `add_slots`, `set_availability`, `lock_event`) | `components/OpenEventSlots.tsx`, `EventForm`, `create.tsx`, event page, Home (TBD dates) |
| **8.8 Invite your people** | Host invites people they've been to events with, or saved **circles**, straight from the event. WhatsApp / SMS share buttons. Guests can mute direct invites from a host. **You → wya assistant** switches | `…000800_agent_actions.sql` (`agent_actions`, `agent_grants`, `circles`, `get_recent_people`, `mute_host`) | `components/InvitePeople.tsx`, `components/AssistantSwitches.tsx`, `lib/links.ts`, `account.tsx`, event page |
| **8.9 Flexible plans** | `/plan` posts the event's plan (a running order) as a live card | `…000900_plans.sql` (`plan_items`, `post_plan`, `add_plan_item`, `delay_plan_item`) | `components/chat/PlanCard.tsx`, event page |
| **8.10–8.17** | Not built: `@wya` assistant, Ask wya, venue lookups, push, widgets, live location, calendar | — | Tests exist and report PENDING / BLOCKED |

Also from this period (docs, kept): `docs/PHASE8.md` (the plan), `docs/REBUILD.md` (rebuild spec), `supabase/tests/phase8/` (tests + `manual_checklist.md`).

---

## 3. How the rollback was done

- `constants/theme.ts`, `components/ui/{Avatar,Button,Card,IconButton,Screen,Sticker,TabScreen}.tsx` and `components/nav/AppTabBar.tsx` were restored from `845d2c4`.
- `components/ui/{Backdrop,Eyebrow,GradientText,DotRing}.tsx` and `components/home/` were deleted.
- `app/(tabs)/home.tsx` was restored from `845d2c4`, then given back its Phase 8 logic: split debts open the pay page, excuses ignore splits, and open events show "Time TBD" and don't count as the next plan.
- Phase 8 screens and cards kept their logic and lost the Glow-only styling (see §1).
- Database: **no change.** The Phase 8 migrations stay applied and stay in the repo.

To look at Glow again: `git checkout 49b32d2 -- <file>` (for example `components/home/HeroEvent.tsx`).
