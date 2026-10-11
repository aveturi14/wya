# wya — Features

The single list of what wya does today, what's being built, and what's planned, so both of us (and our Claudes) work from the same page. **`docs/PLAN.md`** has the build history and test results for each phase; this file is about the product.

_Last updated: 2026-10-11_

**Status key:** ✅ Live · 🚧 In progress · 📋 Planned (designed, not started) · 💡 Idea (not designed yet) · ❌ Decided against

---

## Contents
1. [What wya is](#what-wya-is)
2. [Live today](#live-today)
3. [In progress: pledges (Phase 3)](#in-progress-pledges-phase-3)
4. [Planned and ideas](#planned-and-ideas)
5. [Decided against](#decided-against)
6. [Business model](#business-model)
7. [Decision log](#decision-log)

---

## What wya is

An RSVP app that makes an RSVP mean something. Hosts over-prepare for guests who flake at the last minute: invite 30, cook for 30, 10 show up. With wya, saying "I'm in" comes with a small pledge. Show up and it costs nothing; flake without a good reason and you owe the host.

**Market:** Australia first (both founders are there), so payments start with **PayID**. Other regions later, with their own payment methods.

**Guiding principle: as little friction as possible for both host and guest.** No identity checks, no card forms, no waiting. That's why the first version of pledges keeps wya out of the money entirely (see [Phase 3](#in-progress-pledges-phase-3)).

---

## Live today

Everything below is merged into `main` (PRs 2–8) and running on **https://wya.expo.app** against the shared `wya-dev` Supabase project. iOS is supported in code but hasn't been tested on a device yet.

### Accounts
| Feature | Status | Notes |
|---|---|---|
| Sign up / sign in with email and password | ✅ | Profile (name, phone) created automatically by the database |
| Profile with avatar photo | ✅ | One avatar file per user, replaced in place |
| Light / dark appearance, or follow the device | ✅ | You → Appearance: Auto / Light / Dark |

### Events
| Feature | Status | Notes |
|---|---|---|
| Create an event | ✅ | Name, description, start + optional end time, venue, address, dress code, notes, contact numbers, cover photo, venue photos |
| **Event themes** | ✅ | Lime, Bubblegum, Violet, Tangerine, Ocean, Sunset. Colors the cover, stickers and invite page |
| Generated cover art | ✅ | Events without a photo get bold art in their theme instead of a blank space |
| Edit an event | ✅ | Same form as create; removed photos are deleted from storage |
| Delete an event | ✅ | With confirmation; chat, RSVPs, invite and photos go with it |
| Directions | ✅ | Opens Google Maps on web; Apple Maps / Google Maps / Waze on phones |

### Invites and guests
| Feature | Status | Notes |
|---|---|---|
| Shareable invite link | ✅ | `https://wya.expo.app/invite/<code>`, opens in any browser, no app needed |
| Invite preview before login | ✅ | Title, host, date and cover. **Never the address** |
| Sign up straight from an invite | ✅ | Comes back to the invite and joins the event automatically |
| Host controls re-sharing | ✅ | "Let guests share the invite link" on or off per event |
| RSVP: I'm in / Maybe / Can't go, plus a note for the host | ✅ | Confetti and a haptic tap when you say "I'm in" |
| Guest list | ✅ | Host sees everyone, grouped, with their notes; guests see only who's going, never notes |
| Remove a guest | ✅ | Host only; removed guests can't rejoin with the link |
| Branded link previews | ✅ | Pasting a wya link in iMessage, WhatsApp or Slack shows a wya card (same card for every link) |

### Staying in touch
| Feature | Status | Notes |
|---|---|---|
| Event group chat | ✅ | Live updates; for the host and anyone Going or Maybe |
| **Chats tab** | ✅ | Every chat you're in, latest message first, unread counts |
| **Activity tab** | ✅ | "Gary is going…", "Jo can't make it…", "Hannah changed the time…", "…cancelled". Unread badge |
| "Needs your answer" | ✅ | Invites you haven't answered and your Maybes, on the home screen |
| "Next up" countdown | ✅ | On the desktop home screen |

### Look and feel
| Feature | Status | Notes |
|---|---|---|
| Soft pop (light) and After dark (dark) themes | ✅ | One design system; see `constants/theme.ts` |
| Phone layout | ✅ | Five-tab bar: Events · Chats · (+) · Activity · You |
| Desktop layout | ✅ | Sidebar, event grid with a side panel, two-column event page |
| Motion and haptics | ✅ | Springy buttons, cards sliding in, haptics on phones |

### Privacy and security
| Feature | Status | Notes |
|---|---|---|
| Events visible only to the host and invited guests | ✅ | Enforced in the database, not just the app |
| Phone numbers and profiles visible only to people you share an event with | ✅ | |
| Access-control test suite | ✅ | `supabase/tests/rls_check.py`, 72 checks |

### Marketing website (`website/`)
| Feature | Status | Notes |
|---|---|---|
| Landing page | ✅ | Separate Next.js static site: the idea, how it works, a deposit simulator, FAQ. Same look as the app |
| Waitlist | ✅ | Every call to action opens the waitlist Google Form (`website/src/lib/site.ts`) |
| Visitor analytics | ✅ | Vercel Web Analytics, no cookies |

---

## In progress: pledges (Phase 3)

> 🚧 **Being built now.** This is "option B" from the payments discussion. It replaces the original Stripe-first plan for Phase 3.

### The idea in one paragraph
Saying "I'm in" to an event with a pledge means: *"If I don't show, I'll pay the host $5."* Nobody pays anything up front. If you come, nothing happens. If you flake without an excuse the host accepts, wya asks you to pay the host directly with **PayID**, and you tap "I've paid". The money never goes through wya.

### Why this version first
- **Zero friction:** no card details, no identity checks, no waiting for verification, for host or guest.
- **No fees:** PayID transfers between Australian banks are generally free.
- **No fund-holding:** wya never holds or moves anyone's money, which keeps it out of payments licensing. (Still worth confirming with a professional before launch.)
- **The cheapest real test** of whether pledges reduce flaking, before building heavier payment machinery.

### Decisions (2026-10-11)
| Topic | Decision |
|---|---|
| Where the host's PayID lives | **On their profile**, set once, used for every event |
| Pledge amount | **Host chooses per event; default $5 AUD** |
| After "I've paid" | **Trusted automatically.** The host does nothing unless they dispute it ("I didn't get this") |
| Consequences of not paying | **Both:** (1) a reliability record visible to hosts ("came to 9 of 10"); (2) you can't RSVP to that host's future events until you've settled up |
| Late cancellations | Switching from I'm in to Can't go **after the host's cutoff** counts as a flake, unless the host accepts an excuse |
| Before the cutoff | Cancelling is free |
| Maybes | No pledge. They must become I'm in or Can't go by the cutoff, and **unanswered Maybes automatically become Can't go**. Reminded in Activity before the cutoff |
| Who showed up | **The host marks no-shows** after the event starts. QR / location check-in comes later |
| Excuses | A guest who owes can send the host a reason; the host accepts (debt waived) or declines |
| Market | Australia only, PayID only, for now |

### How it works, step by step
1. **Host, once:** adds their PayID in You → Get paid. Accepted formats: mobile number, email address or ABN.
2. **Host, per event:** turns on "Pledge" in the event form (needs a PayID), picks the amount ($5 default) and the cutoff (e.g. 24 hours before).
3. **Guest:** sees "I'm in means a $5 pledge if you don't show. Free to cancel until Fri 7 PM."
4. **Before the cutoff:** Maybes get a reminder. At the cutoff, unanswered Maybes become Can't go.
5. **After the event starts:** the host opens "Who came?" and marks anyone who didn't show.
6. **Each flake** (no-show or late cancellation) creates a debt: the guest gets an Activity item and a "You owe Hannah $5" card with her PayID, the amount, and a reference like `WYA-4821`, plus buttons for **I've paid** and **I have an excuse**.
7. **"I've paid"** settles it straight away. The host can dispute it, which reopens the debt and notifies the guest.
8. **Excuse:** the host accepts (waived) or declines (still owed).
9. **Unsettled debts** show on the guest's reliability record and block RSVPs to that host's events until settled.

### Built to grow
The code is shaped so that **option A** (pay up front) and other payment methods drop in without rework:
- **Deposit mode per event:** `none` | `pledge` today, `upfront` (A) later. The modes differ only in *when* a guest starts owing.
- **One shared record of what each guest owes, with one lifecycle:** `owed` → `paid` (or `waived`), plus `excuse_pending` and `disputed`. Option A adds `refund_due` / `refunded`.
- **One file per payment method** (`lib/payments/payid.ts`): validation, formatting, and the "how to pay" instructions. Venmo or PayPal later is one more file.
- **All the rules live in the database** (functions + triggers), covered by the access-control tests.

---

## Planned and ideas

### Payments and commitment
| Feature | Status | Notes |
|---|---|---|
| **Option A: pay up front to the host** | 📋 | See write-up below |
| Card payments (Stripe), automatic collection | 📋 | Optional upgrade for hosts who want it. Earlier design: save card at RSVP (SetupIntent), charge only no-shows, Stripe Connect Express with "lazy" host onboarding. Brings back identity checks and fees, which is why it's not first. The fee notes in `docs/PLAN.md` still apply |
| QR / location check-in | 📋 | Guest checks in at the door; checked-in guests can never be marked as no-shows. Protects guests from mistakes |
| Other regions' payment methods | 💡 | Venmo / PayPal.me (US), others per country. One provider file each |
| Reminders by text message | 💡 | For guests without the app; costs a few cents per text (possible paid feature, see Business model) |
| Push notifications | 📋 | Activity items as phone notifications. Needs the iOS/Android builds |

#### Option A, pay up front to the host (write-up)
**What it is:** saying "I'm in" means sending the deposit to the host's PayID **at RSVP time**. Everyone who shows up gets their deposit back from the host; flakes forfeit it.

**Flow:**
1. The host turns on "Pay up front" instead of "Pledge" (same PayID, amount and cutoff settings).
2. A guest taps I'm in → wya shows "Send $5 to Hannah (PayID …, reference WYA-4821)" → the guest pays in their banking app and taps "I've paid".
3. The guest's spot shows as **paid** to the host. The host can mark "not received" if it never arrived.
4. Cancelling before the cutoff → the host refunds (wya shows them a "Refund Gary $5" to-do).
5. After the event, the host marks who came; wya lists refunds owed to attendees; the host sends them and ticks them off.

**Pros:** a real stake up front; the strongest deterrent; the host is holding the money already.
**Cons:** the guest has to make a payment just to RSVP (more friction); the host has to check their bank and send refunds (more work); wya can't confirm payments (PayID has no public API for this), so "paid" is still on trust.

**What changes in the code:** a new deposit mode `upfront`; the debt record is created at RSVP (status `due`) instead of at flake; two extra statuses (`refund_due`, `refunded`); a host "Refunds" list. Everything else (PayID, references, the "how to pay" card, excuses, notifications, reliability record) is shared with pledges.

**When:** if hosts tell us pledges alone don't stop flaking.

### Events and sharing
| Feature | Status | Notes |
|---|---|---|
| **Shared photo album** (Phase 4) | 📋 | Guests upload photos to the event; one gallery everyone can see |
| Per-event link previews | 📋 | "Hannah invited you to Rooftop Night" with the cover image. Needs server rendering (`web.output: "server"`) |
| Invite links open the iOS app (universal links) | 📋 | Needs a paid Apple Developer account; at App Store launch |
| Co-hosts | 💡 | Possible paid feature |
| Recurring events | 💡 | Possible paid feature (clubs, weekly games) |
| Custom invite links (`wya.app/hannahs30th`) | 💡 | Possible paid feature |
| Calendar view of events | 💡 | Inside Events, not a separate tab |

### Launch and platform
| Item | Status | Notes |
|---|---|---|
| Test on iOS | 📋 | Never run on a device or simulator yet. Needs full Xcode |
| App Store / Play Store release | 📋 | Remove the `RECORD_AUDIO` Android permission first (`app.json`) |
| Production Supabase project | 📋 | In an organization both founders belong to; apply `supabase/migrations/` in order; turn on leaked-password protection |
| Swap the website's waitlist buttons for store links | 📋 | At launch (`website/src/lib/site.ts`) |
| `.env` → `.env.example` | 💡 | Only publishable keys today; agree before untracking |

---

## Decided against

| Idea | Why not |
|---|---|
| ❌ **Square instead of Stripe** | Guests don't need an account with either. For paying hosts, Square makes every host connect their own Square account *before* any charge, which is more friction, not less. Possibly cheaper on small deposits (about 3.5% + 15¢ vs 2.9% + 30¢, unconfirmed), but no clear React Native path. Revisit only if card payments come back |
| ❌ **Splitwise** | Every guest would need a Splitwise account, and it only tracks debts. wya keeps its own small ledger instead |
| ❌ **Card deposits first** (original Phase 3) | Host identity checks and processor fees are the friction we want to avoid. Kept as a later upgrade |
| ❌ **Explore / Discover tab** | wya is invite-only; there's nothing public to browse |
| ❌ **Ads, selling data, charging on reliability records** | Would cheapen the brand; reliability records are people's social reputation |

---

## Business model

**Current decision (2026-10-11): stay free while proving pledges work.** Measure whether pledges reduce flaking and whether hosts come back. Decide on revenue once we have that evidence.

### Why wya can't take a cut of pledges
With PayID, guests pay hosts directly from their own banking apps. The money never passes through wya, so there's nothing to take a cut of, and asking guests to pay wya separately would add back the friction we removed. **That's intentional:** the anti-flake core should stay free, because every event a host creates brings their friends onto wya, and some of them become hosts. Charging there would slow down how wya spreads.

### Options for making money
| # | Option | How it works | Fit | When |
|---|---|---|---|---|
| 1 | **wya Plus (host subscription)** | Free core; paid extras like a bigger photo album, co-hosts, recurring events, custom invite links, attendance stats, extra themes | Good, but casual party hosts rarely pay monthly | After the album and a few extras exist |
| 2 | **Per-event upgrade** | One-off ~A$3–5 for a big event (birthday, engagement): premium theme, unlimited album, reminder texts | **Best fit for casual hosts.** Pay for the event that matters | Same time as 1; might replace it |
| 3 | **Text reminders** | Paid SMS nudges to guests without the app ("Confirm your Maybe by tonight") | Natural, since texts cost real money | With the reminder features |
| 4 | **Organisations tier** | Uni societies, sports clubs, community groups, small businesses: multiple organisers, recurring events, member lists, exports, fixed monthly price | **Strongest paying market.** Free events have high no-show rates, these groups run events constantly, and they have budgets | Once pledges are proven with friends |
| 5 | **Card payments with a service fee** | When automatic card collection exists (option A with cards, or Stripe), wya processes the money and can add a small fee | Real, but brings back friction and processor costs | Much later, only if hosts ask |
| 6 | **Referral partnerships** | wya knows the exact headcount: "Order food for 12" through catering or delivery partners, or venue bookings, earning a referral fee | Unique to wya, since accurate numbers are what wya is about. Needs partner deals | Later, once there's volume |

**Not doing:** ads, selling data, or charging around reliability records.

**Practical constraint:** digital upgrades sold *inside the iOS app* generally have to use Apple's in-app purchase system, and Apple takes 15–30%. Selling on the website avoids that for web users. Apple's rules on pointing users to web checkout keep changing; check the current rules for Australia before building any paid feature.

**Suggested next steps:**
1. Prove pledges work with real friend groups.
2. Talk to a handful of **uni societies and clubs** early. They feel the flaking problem most and are the likeliest to pay; their answers decide between option 4 and options 1–2.
3. The likely first paid features: per-event upgrades and SMS reminders, since they fit casual hosts and cover real costs.

---

## Decision log

| Date | Decision |
|---|---|
| 2026-10-10 | No-show deposits are wya's core idea. Original plan: Stripe card deposits, charge only no-shows, Connect Express with lazy host onboarding |
| 2026-10-10 | Guests see who's going (names only); hosts can remove guests; hosts control invite re-sharing |
| 2026-10-10 | Light theme "Soft pop" + dark theme "After dark"; per-event color themes; desktop sidebar layout; Chats and Activity tabs |
| 2026-10-10 | Single shared Supabase project (`wya-dev`) until launch |
| 2026-10-11 | **Payments pivot:** wya won't touch money in v1. Build pledges (option B) with PayID, Australia only. Option A and card payments documented for later |
| 2026-10-11 | Pledge details: PayID on profile, $5 default, "I've paid" trusted, reliability record + RSVP block for unpaid debts, host marks no-shows (check-in later) |
| 2026-10-11 | Business model: stay free while proving pledges; options documented above |
