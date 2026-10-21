# Stage 1.1b: Collection links (build plan)

_Written 2026-10-21. Builds on stage 1.1 (`STAGE_1_1_PLAN.md`, `STAGE_1_1_RESULTS.md`) on the `collect-money` branch. **Approved and built 2026-10-21**; results in `STAGE_1_1_RESULTS.md` (Stage 1.1b section)._

## 1. What we're adding

Two things:
1. **Every collection gets a shareable link.** The organiser drops it in a group chat. Each person who taps it lands on the booking page and asks to be let in by tapping "I'm in, $60". The organiser approves each request.
2. **A collection doesn't need an event.** A user can still collect money for an event (as now), or just create a collection on its own and send the link.

Same rules as 1.1: no money moves through wya, PayID only, and people pay the organiser directly.

## 2. The flow

1. **Hannah creates a collection.** Either from an event (Details → Collect money), or on its own (the **+** tab → "Just collecting money"). Either way she gets a link like `wya.expo.app/c/k7x2p9` and a **Share link** button.
2. **She drops the link in the group chat.**
3. **Sam taps it** and sees the booking page, without being signed in yet:
   - **Hannah Host**, name and photo, prominently at the top ("Hannah is collecting");
   - what it's for, $60 each, the pay-by deadline, any booking note;
   - progress ("4 of 8 in"). No PayID, no names of who's in, and no event address.
4. **Sam taps "I'm in, $60".** If he isn't signed in, he signs up or signs in (name, email, password, as today) and comes straight back. The tap goes through automatically after sign-in, so he doesn't have to tap twice.
   - **That tap is his request.** He sees "Waiting for Hannah to let you in". He owes nothing yet and can't see the PayID.
5. **Hannah gets "Sam wants in on Karting"** in Activity and Needs you, and on the collection page, and taps **Approve** or **Decline**.
6. **Approved:** Sam's $60 commitment starts (the debt is created at this moment). He's told "You're in", the PayID appears with the bank-name reminder, and from here it's the 1.1 flow: I've paid → Got it → funded → booked.
   - **Declined:** Sam is told politely and can't ask again with that link.
   - **Cancelled by Sam:** he can withdraw a request before it's approved.

**Rules:**
- **The link only gives access to the collection, never the event.** Someone who joins through the link sees the collection page and pays. They don't become an event guest: no address, chat, guest list or photos.
- **People already on the event** (host and guests) can still tap "I'm in" in the app directly, without approval, as built in 1.1. Hannah already invited them to the event.
- **Maximum people** counts people who are in (approved). Approve is refused once it's full; requests can still come in, and the page shows "It's full".
- **Turn off link / new link:** the organiser can switch the link off, or replace it with a new code, so the old one stops working.

## 3. Scam protection

- **The organiser's name and photo**, prominently on the booking page, the pay page and the PayID card.
- **A Report option** on the booking page, for anyone signed in. Reports are stored for us to review: they're counted in the stats, and nothing is automatic in this version.
- **A bank-name reminder** next to the PayID: "Check your bank shows **Hannah Host** before you send. If it doesn't, don't pay."
- **A $200 cap per person**, for every collection, with or without an event. It limits each person's share, not the total: 8 people at $200 is $1,600, and the maximum-people setting limits the total if wanted. It isn't a legal limit, since wya never touches the money in 1.1. It's there to keep the worst case small while we learn. Bigger costs (a weekend house, festival tickets) are out of scope for now. The current $5,000 limit drops to $200 in the database and the form.

## 4. Standalone collections (no event)

**Approach:** a collection without an event is backed by a **hidden lightweight event** (`events.kind = 'collection'`) that users never see as an event.

- **Why:** debts (`obligations.event_id`), notifications, the chat card and every access rule from 1.1 hang off an event. A hidden event keeps all of that working without rebuilding it.
- **Hidden means:**
  - filtered out of Home's event lists, Chats, Photos (`get_my_albums`), "invite your people" suggestions and host track records (`get_host_record`);
  - nobody else is a guest of it: link joiners get access through their approved request (§5), not through the event.
- **What the organiser sees instead:** standalone collections appear on Home under a small **"Collecting"** section (from `get_my_collections`), and in Needs you and Activity as now.
- **Later:** if collections become a separate app, they can be detached from events entirely. That's a bigger change, kept out of 1.1.

## 5. Data model (one new re-runnable migration: `<timestamp>_collection_links.sql`)

- **`collections`:**
  - new columns: `link_code` (unique, random, like invite codes), `link_enabled` (default true) and `standalone` (true when it's backed by a hidden event);
  - `per_person_cents` limit lowered to 100–20000 ($200).
- **`events.kind`:** add `'collection'`.
- **New table `collection_requests`:** (collection_id, user_id, status `requested`/`approved`/`declined`/`withdrawn`, created_at, decided_at). Clients can't write it directly; it's only changed through the functions below.
- **Access:** a person can see a collection if they're the organiser, a guest of its event (not a hidden one), or have a request on it. The PayID rule doesn't change: `get_payment_instructions` still answers only someone who owes.
- **New functions** (security definer, checks inside):

| Function | Who | What |
|---|---|---|
| `create_standalone_collection(...)` | Signed-in user with a PayID | Creates the hidden event and the collection, and returns the collection id and link |
| `get_collection_preview(p_code)` | Anyone, signed out too | Organiser name and photo, title, amount, deadline, note, status, counts. No PayID, names or event details. Records a link view (for the stats) |
| `request_to_join(p_code)` | Signed-in user | "I'm in": creates or returns their request. Refused if the link is off or the collection isn't open or is past its deadline |
| `withdraw_request(p_collection_id)` | The requester | Before approval |
| `approve_request(p_collection_id, p_user_id)` | Organiser | Under the maximum, while open: creates the collect debt and notifies them |
| `decline_request(p_collection_id, p_user_id)` | Organiser | Notifies them; they can't ask again with this link |
| `set_collection_link(p_collection_id, p_enabled, p_new_code)` | Organiser | Turn off, back on, or replace the code |
| `report_collection(p_collection_id, p_reason)` | Signed-in user who can see it | Stored privately, at most once per person |

- **Existing functions updated:**
  - `get_collection` returns pending requests (organiser only), the link, and the caller's request state.
  - `get_my_collections` includes requests and standalone collections.
  - `join_collection` stays for event guests.
  - `create_collection` takes the $200 cap.
  - the "hidden event" filters from §4.
- **Notifications:** `collect_requested` (to the organiser), `collect_approved` and `collect_declined` (to the requester).
- **Link views:** a private table of preview opens, so the funnel can be counted (§7).

## 6. App

- **`app/c/[code].tsx`:** the public booking page.
  - Works signed out: preview, then "I'm in, $60" → sign up or sign in → back, with the request sent automatically.
  - After that it shows the person's state (waiting / in / declined) and links to `/collect/<id>`. Includes Report.
- **`app/collect/[id].tsx`:**
  - organiser: a **Requests** section with Approve / Decline, plus **Share link**, **Turn off link** and **New link**;
  - requester: a waiting state.
- **`app/collect/new.tsx`** (or a sheet): the standalone form. It reuses `CollectForm`, with the $200 limit and the PayID-first step. The **+** tab gets a "Just collecting money?" entry.
- **Share link button:** the system share sheet on phones, copy on web. Text: "Hannah is collecting $60 each for Karting by Thu 6pm: <link>".
- **`PayIdCard`:** the bank-name reminder, and the organiser's name prominent.
- **Home:** a "Collecting" section; Needs you gets "N people want in".
- **Activity:** rows for the three new types.
- **Sign-in:** unchanged (email + password). Both sign-up and sign-in return to `/c/<code>`.

## 7. Measuring it

`get_collect_stats()` gains:
- **Standalone vs with an event:** counts, and % funded for each.
- **The link funnel:**
  - link opens (all, and by signed-in people);
  - requests;
  - approved;
  - paid (says paid);
  - confirmed;
  - plus % drop at each step, and requests declined or withdrawn.
- **Reports:** count, and collections with any report.

Test accounts are still excluded.

## 8. Tests

New file `supabase/tests/phase8/test_s1_1b_collection_links.py` (`--only S1.1b`), covering at least:
- the preview works signed out and never contains a PayID, names or an address;
- requests: Gary's request owes nothing and gets no PayID until approved; a second tap is the same request; withdraw works;
- only the organiser can approve or decline; approve is refused over the maximum or when it isn't open; declined people can't re-request;
- a link that's turned off or replaced refuses new requests;
- link joiners can see the collection but not the event (event row, address, chat, guest list);
- standalone:
  - created without an event;
  - hidden from the organiser's event lists, chats, albums and host record;
  - the full join → pay → confirm → funded → booked flow, and expiry;
- the $200 cap applies to both kinds;
- reports: stored once per person, and not readable by clients;
- the stats include the funnel and the standalone split, and are still service role only.

Plus `rls_check.py`, the S1.1 tests (still green, with amounts adjusted to the new cap), typecheck, and the browser at phone and desktop widths in light and dark:
- Hannah creates a standalone collection and shares the link;
- Sam (`stranger@`) opens it signed out, signs in, taps I'm in and waits;
- Hannah approves; Sam pays, Hannah confirms.

## 9. Decisions (defaults used unless you change them)

| # | Question | Default |
|---|---|---|
| L-1 | Who can join through the link | Anyone with it, after the organiser approves; "I'm in" is the request |
| L-2 | Does the link let people into the event? | No, only the collection |
| L-3 | Do event guests need approval? | No, they join directly in the app (as in 1.1) |
| L-4 | Per-person cap | $200, every collection |
| L-5 | Standalone backing | Hidden event (`kind = 'collection'`) |
| L-6 | Report | Stored for manual review; nothing automatic |
| L-7 | Sign-in | Email + password for now (see §10) |
| L-8 | Who can organise a link collection on an event | The host or a going guest (same as 1.1); the link never gives event access, so a guest organiser can share it too |

## 10. Later: email-code sign-in (not built now)

**What:** instead of a password, people type their name and email and get a 6-digit code by email. It creates a normal, permanent wya account: next time they use the same email (and a new code) and land in the same account with the same history. One email is one account, so there's nothing to clash with later. They can add a password whenever they like.

**Why:** the link is opened from a group chat by people who mostly don't have wya. Making up a password is where that kind of link loses people. A code is one step fewer and nothing to remember, and it still gives each debt a real, reachable person, which the PayID privacy, reminders and refunds all depend on. The link funnel (§7) shows how many people stop at sign-in, which tells us when to switch.

**What it takes:**
1. **App:** a "Continue with email" screen (name, email → code) using Supabase `signInWithOtp` and `verifyOtp`, passing the name so the profile is filled in. Keep the password option for people who have one.
2. **Supabase dashboard:**
   - turn on the Email OTP sign-in;
   - change the "Magic link" email template to show the code (`{{ .Token }}`);
   - set the code expiry (e.g. 10 minutes).
3. **Email sending:** set up a real email sender (e.g. Resend) as custom SMTP. Supabase's built-in sender only allows a few emails an hour, which a group chat of 15 people would exhaust in seconds.
4. **Existing accounts:** the normal sign-up form, given an email that already exists, should point people to "Continue with email" or "Forgot password" instead of failing.
5. **Abuse:** use Supabase's rate limits on code requests, plus a CAPTCHA (hCaptcha or Turnstile, both supported by Supabase) if codes get abused.
6. **Tests:** the funnel numbers before and after, and a browser check of first-time and returning sign-in.

## 11. Build order

1. Migration (§5), applied to wya-dev; tests from §8 green; `rls_check.py` and the S1.1 tests still green.
2. The booking page `app/c/[code].tsx` with sign-in return, and requests on the collection page.
3. Standalone creation and hiding the hidden events.
4. Share, turn off and new link; Report; bank-name reminder; $200 limit in the form.
5. Home "Collecting" section, Needs you, Activity.
6. Stats.
7. Typecheck; browser at both widths and both themes; iOS if possible.
8. Update `STAGE_1_1_RESULTS.md` (or a new results file) and `CLAUDE.md`.

## 12. Out of scope
Email-code sign-in (§10), joining without an account, card or wallet payments, automatic action on reports, detaching collections from events completely, and per-person one-time links.
