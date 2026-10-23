# Product audit: what the film may show

Written 2026-10-20 on branch `video/launch-reel` (from `main` at `7e3aed6`). Sources: the app's code (`app/`, `components/`, `lib/`, `supabase/migrations/`), the live site (wya.expo.app/welcome), and earlier browser checks of these flows on wya-dev. No accounts or credentials were used for this audit, and none appear in the film.

**Status key:** ✅ Implemented (works end to end in the app) · 🧪 Simulated (works, but with test money or mock providers) · 📋 Proposed (strategy only, not built) · ✖ Unsupported.

## Feature table

| Feature | Actual screen / route | Status | Exact interaction | Safe to show | Recommended scene |
|---|---|---|---|---|---|
| Discover events in-app | none | ✖ Unsupported | wya is invite-only; venue and showtime lookups (Phase 8.12) aren't built | No | — |
| Paste an external event URL / import | none | ✖ Unsupported | not built | No | — |
| Create an event (plan) | `app/(tabs)/create.tsx` → `components/EventForm.tsx` | ✅ | title, date and time, venue, address, poster look, serif line, stickers, guest limit, optional pledge | Yes | 2 (as the poster) |
| Price per person / ticket price field | none | ✖ | events have no price field; costs come in as bills or splits after someone pays | Only as a bill | 4 |
| Event poster (the event's visual identity) | `components/ui/Poster.tsx` | ✅ | gradient and grain, Archivo Expanded title, serif line, stickers | Yes | 2, 3, 7, cover |
| Shareable invite link | `app/invite/[code].tsx`, share on the event page | ✅ | `/invite/<code>`; preview for signed-out visitors; sign up or sign in, then join | Yes | 3 |
| Invite people you know, circles, WhatsApp or SMS hand-off | `components/InvitePeople.tsx` | ✅ | pick past people or a circle; share sheet | Yes (not used, to keep the film focused) | — |
| RSVP | `components/event/RsvpBar.tsx` | ✅ | **I'm in · Maybe · Can't go**; guest list groups Going / Maybe / Not going / No answer yet | Yes | 3 |
| Approve people who join | event settings (8.1) | ✅ | "Asking to join" until the host approves | Yes (not used) | — |
| Does an RSVP collect money? | — | ✅ No | Saying I'm in never moves money. An optional pledge only becomes a debt if the guest flakes | Must say so | 3 ("Saying yes isn't paying") |
| Equal or custom split | `/split` command, `components/chat/SplitCard.tsx` | ✅ | total split between people; rows show **Paid the bill** (payer) and **Owes** | Yes | 4 |
| Itemised receipt split | Bills tab → `app/receipt/[id].tsx`, `components/receipts/ClaimView.tsx` | ✅ (scan needs the `scan-receipt` function and an OpenAI key; typing it in always works) | upload or scan → payer checks lines → **What did you have?** → tick items, take units ("2") or **Shared** → **Confirm my share** → payer **Lock the split** | Yes | 4 (short insert) |
| Surcharges split by what each person ordered | receipts migration | ✅ | adjustments are split proportionally | Yes | 4 (one line) |
| Who owes what, everywhere | `app/dues.tsx` | ✅ | Your dues: owe / owed, with the why | Yes (not used) | — |
| Wallet balance | `app/wallet.tsx`, `components/wallet/WalletArt.tsx` | 🧪 Simulated | **test balance** sticker; top up with mock Apple Pay or a card (display only) | Yes, labelled | 5 |
| Pay a debt from the wallet | `components/wallet/PaySheet.tsx`, `pay_from_wallet` | 🧪 Simulated (real ledger, test money) | **Pay Alex $45** (lock icon) → Paid; each person approves their own payment; one payment per debt | Yes, labelled | 5 |
| Cash out | `CashOutPanel.tsx` | 🧪 Simulated | test only | Not needed | — |
| Shared collection pot (pay in before anyone buys) | none | 📋 Proposed (strategy "Stage 1") | not built | Only as a labelled concept | 6 |
| Virtual group card | none | 📋 Proposed; the founders' brief deprioritises it (card issuer, likely a licence) | not built | Only as a labelled concept | 6 |
| Card checkout at a merchant | none | 📋 Proposed | not built | Only as a labelled simulation | 7 |
| Booking confirmation / tickets issued | none | ✖ | wya never issues tickets | Must not be implied | 7 ("not a booking") |
| Chat, polls, plans, photos album, check-in, Activity, reminders | event page tabs, `app/activity.tsx` | ✅ | — | Yes (left out so the story stays on money) | — |

## Verified journey (what's real today)
1. A host creates the event; it becomes a poster.
2. The host shares one invite link; friends join and answer **I'm in / Maybe / Can't go**.
3. Someone pays for the thing (tickets, dinner) outside wya.
4. They split it in wya: evenly with `/split`, or itemised from the receipt, where everyone ticks what they had and confirms.
5. Each person pays them back from the wya wallet (**test balance**), approving their own payment; the split shows **Paid** row by row.

## Discrepancies between the brief and the code
- **The film brief's "Stage 1" (everyone contributes first, then a virtual card pays) is not built.** The app works the other way round: one person pays, then everyone pays them back. The film shows the real order (scenes 4–5) and the brief's order as a labelled concept (scenes 6–7).
- **"Payment requested → Funds available" states don't exist.** The app's states are **Owes** and **Paid** per person, plus **Paid the bill** for the payer. The concept scene shows Going ≠ Paid in ≠ Funds available ≠ Not booked as separate chips, as the strategy requires.
- **"$45 per person" isn't an event field.** It appears as the result of splitting a $180 bill four ways.
- **The attached strategy, "wya: From Group Plans to Paid Bookings", wasn't in the repo or on the Desktop.** The closest documents are `~/Desktop/payment scheme app/PRODUCT_BRIEF.md` and `Collective_Payments_Founder_Strategy_Memo.docx`. The memo says *no wallet early* and that the merchant panel was simulated. The app has since added a test-balance wallet (`20261019000100_wallet.sql`), so the code and the memo disagree; the film follows the code.
- **"Where You At" vs "wya":** the app's wordmark is `wya.`; the film shows the wordmark and spells out "Where You At" beside it.
- **Fees:** the wallet charges none today, but real payments would. Amounts in the film are labelled as excluding any applicable fees where money moves.

## Scene-by-scene status
| Scene | Shows | Status on screen |
|---|---|---|
| 1 Group chat | the problem (fictional chat) | — |
| 2 Meet Where You At | wordmark, slogan, the event poster | real |
| 3 Invite and RSVP | Share invite, invite link, I'm in / Maybe / Can't go, Hosting / Going | real; ends with "Saying yes isn't paying" |
| 4 Split | $180 split four ways, Paid the bill / Owes; itemised receipt insert | real |
| 5 Pay back | wya wallet, Pay Alex $45, Paid, 4 of 4 | real flow, **"Test balance: no real money moves yet"** tag |
| 6 Pot → card | fund filling, virtual group card | **"Concept demonstration · not live yet"** tag throughout |
| 7 Checkout | paying $180 with the group card | **"Simulated checkout"** tag, "Excludes any applicable fees", "This is a demo, not a booking" |
| 8 Close | Less chasing. More going. Where You At, wya.expo.app | — |
