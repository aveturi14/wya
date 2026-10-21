# [Name]: product brief

_Working name: **[Name]** (not chosen yet). Written 2026-10-18. Status: idea stage, nothing signed, no users._

**For an AI agent reading this:** this is the full context for a new product that the founders are planning. It's a standalone brand, spun out of a feature in their RSVP app **wya**. Everything below is the founders' current thinking, plus the evidence they have so far. Treat numbers marked _illustrative_ as made-up examples, not data. The "Decisions" and "Open questions" sections at the end say what is settled and what isn't. Don't treat open items as decided.

---

## 1. The idea in one sentence

**Everyone pays their own share of a group plan: before the booking, so businesses stop losing money to no-shows, and after the bill, so friends stop chasing each other.**

## 2. Where it came from

- **wya** is the founders' RSVP app (Australia first). Its core idea is that "I'm in" is a $5 pledge, and people who flake pay the host. It also has a receipt bill-split feature: scan a receipt, everyone ticks what they had, debts lock in and get paid.
- The founders saw a bigger market in the bill-split and in the "commit and pay before the event" mechanics than in RSVPs alone.
- **Decision:** [Name] is its **own brand, independent of wya** for now. It may tie back into wya later. It can reuse wya's code and ideas (receipt scanning, item claiming, pledges/obligations, reminders, reliability records).

## 3. The problem

Whenever a group does something together, **one person pays for everyone**, and that causes two problems.

**Before the event: the no-show problem (businesses lose money).**
> Alex books an escape room for 10 people at $40 each and pays the $400 deposit. On the day, 6 come. Either Alex is out of pocket and chases 4 people for weeks (and never organises again), or Alex asks the venue for a refund and the venue eats the loss of an empty room.

**After the event: the chasing problem (friends lose money and patience).**
> Six friends, a $300 dinner, and the restaurant won't split it. Alex pays the lot, then spends a week sending "you owe me $48" messages and arguing about who had the wine.

Businesses feel this too: big groups splitting at the counter take 4–15 minutes at peak, lose a table turn, and sometimes leave short ("I gave it to Ravi").

## 4. The product: two halves

### Half 1: "after the bill" (free, how people find us)

1. The bill comes. Alex pays the whole $300 on their own card.
2. Alex photographs the receipt in the app. AI reads every line item.
3. Alex shares a link to the group chat. Each friend opens it (no account needed to view) and ticks what they had, including fractions ("a sixth of the wine", "half the pizza").
4. When everyone has ticked, the bill **locks**. Each person sees exactly what they owe, with tax, tip and surcharges shared proportionally.
5. Everyone pays Alex back in a tap: free by PayID/bank, or by credit card for a fee. Alex is square in minutes.

Modes: **itemised** (tick what you had), **even split** (banquets, set menus) and **mixed** (even for the shared platters, items for the extras). Restaurants need to do nothing.

### Half 2: "before the booking" (businesses pay for this)

1. Alex picks the activity (escape room, bridal booking, group dinner) and sets the group size: 10.
2. Each of the 10 gets a link and pays **their own share** ($40) **straight to the business**, by a deadline.
3. The booking is **confirmed only when the group is paid** (or when the organiser chooses to confirm a smaller group).
4. Unpaid people are reminded automatically. Alex sees a who's-paid board and can **shrink the group** to 9 or **cover the gap**.
5. Shares follow the business's cancellation policy (for example, non-refundable inside 48 hours or 6 weeks).
6. On the night, any extra spending (food, drinks, add-ons) can be split with Half 1, or charged to each person's saved card.

The business gets paid by each person, gets fewer no-shows and fewer refund arguments, and organisers who aren't out of pocket book again.

## 5. Who it's for (examples)

| Business | Today | With [Name] | What they'd pay |
|---|---|---|---|
| Bridal hair and makeup | The bride pays the deposit. Bridesmaids pay in cash on the morning (or "forget"). | Each bridesmaid books and pays her own services. A who's-paid board. The balance comes off her saved card on the day. | ~$15–25 per wedding |
| Escape room / arcade / karaoke / bowling | One organiser books for 10, 6 show up, refund argument. | Each guest pays before the slot is confirmed. Food and drinks are split after. | 1–2% of the booking (~$4–8 on $400) |
| Restaurant (group booking) | The birthday person pays a $240 deposit for 12. | Each guest pays their own $20 deposit. After the meal, one card pays and the group splits in the app. | Probably $0 for the bill split; small fee on deposits |
| Other group bookings | Boat hire, holiday houses, golf days, tours, class blocks, catered team lunches | Same pattern: one person books, everyone pays and commits | Per booking or % (untested) |

**Key insight from the panel (section 11):** restaurants are a **distribution channel**, not the revenue. They like the free consumer split ("one card per table, split it in [Name]") but won't pay much. **Businesses that take group deposits** are where the money is.

## 6. Key product rules

- **Money goes straight to the business's own payment account** (for example its Square account) wherever possible. [Name] shouldn't sit in the middle of the funds. Owners named this as a dealbreaker, and it avoids licensing.
- **Last-share rule:** a table or booking can never look paid when it isn't. Anything unclaimed or unpaid falls to the organiser, whose card is held for the remainder. Every owner on the panel asked "who's short when the last person walks?"
- **Staff view** for venues: "Table 6: 11 of 12 paid" / "Booking #482: 8 of 10 paid, due Thursday".
- **Works with any bank.** No one has to switch banks or download a bank app to pay. This is the main difference from Revolut.
- **Under five minutes of staff training, no new hardware**, month to month, free pilot.
- **Venue branding** on guest screens where the venue wants it (fine dining asked for this).
- **Server-led mode** for fine dining: staff start the split, with no QR code on the table.
- Correct handling of deposits, comps, surcharges, corkage and shared bottles.

## 7. How we'd build it (outline)

**Reusable from wya:**
- Receipt scanning (an Edge Function calling an LLM to turn a photo into line items).
- Item claiming with fractions, lock, and the resulting debts.
- Obligations and pledges (a single debt lifecycle), cutoffs, reminders and reliability records.
- Stack: Expo (iOS, Android, web) + Supabase (Postgres with row-level security, Auth, Storage, Edge Functions).

**New pieces:**
- **Guest web flow without sign-up:** the link opens in a browser and you pay as a guest. Most people meet the product through a group-chat link.
- **Business side:** a booking page or link per business, a who's-paid dashboard, policies (deadline, refund window, minimum group).
- **Payments:**
  - Consumer pay-back: PayID instructions (free) and card payments through a payment provider (fee).
  - Business payments: each guest pays straight into the business's account through the business's own processor. Square first: Square's Checkout/Payment Links and Orders APIs, OAuth to the seller's account, and later the **Square App Marketplace** listing. Booking platforms after that.
- **Data pipeline** (section 9): normalise receipts, match venues, categorise items, de-identify, aggregate.

**Later or optional (needs licences or partners):**
- **Group virtual card** ("nobody fronts the bill"): everyone pays in, and the app issues a one-time card for the exact total. It needs a card-issuing partner and probably a licence. It's also the area closest to Revolut, so it's deprioritised.
- **Pay later / instalments:** buy-now-pay-later is regulated under Australian credit law since 2025, so it needs a credit licence or a partner.
- **Wallet balances** (holding user money): likely a stored-value / non-cash payment facility, needing an AFS licence or exemption. Get legal advice first.

## 8. How we make money

| Stream | Who pays | How | When |
|---|---|---|---|
| Group deposits | Businesses | 1–2% of the booking, or a flat fee per booking (e.g. $15–25 per wedding) | Year 1 (main revenue) |
| Credit card fee on splits | Consumers | ~1.5–2.5% when paying a share by credit card. Bank/PayID stays free. | Year 1 |
| Pro tier | Heavy users | ~$4–6/month: unlimited scans, ongoing groups (housemates, trips), history, export | Year 1–2 |
| Travel / FX | Consumer groups abroad | A small margin converting shares to AUD | Year 2 |
| Venue subscription | Venues | ~$29/month (the panel's ceiling): staff dashboard, reminders, no-show tools, insights | Year 1–2 |
| Group insights and reports | Venues, landlords, councils, drinks/food brands | Venue reports $29–99/month, area reports $500–5,000, brand reports by deal | Year 2+ |
| Referrals ("where groups go next") | Venues | A fee when a group books from a suggestion ("Dinner nearby? Groups get 10% off") | Year 2+ |

**What we will NOT do:** charge for basic friend-to-friend pay-back. In Australia, PayID/Osko is already free and instant, so a fee would push people straight to their bank app. And no percentage cut on a restaurant's bill: 0 of 7 panel owners accepted that.

_Illustrative only:_ 10,000 split bills/month at $250 average gives roughly $5k/month from credit card fees (20% pay by card, we keep 1%) plus ~$3k/month from Pro (3% of 20,000 users at $5). That's around $8–12k/month from consumers. This is why business deposits are the main revenue and consumer revenue comes second.

## 9. Data and analytics

### What one split tells us (that nobody else sees)

| Data point | Source |
|---|---|
| Venue, location, day and time | Receipt (name, ABN, address) |
| Every item and its price | Receipt lines |
| Exact group size | Number of people who claimed |
| Who shared what (e.g. the wine shared by 4) | The claims |
| Non-drinkers, who ordered dessert, unclaimed items | The claims |
| Spend per person (not per table) | Our maths |
| Time to settle, payment method | Timestamps |
| What the same group did before and after (escape room, then dinner) | Linked splits and bookings |
| Commitment: invited vs paid, speed, flakes | The booking side |

Square and other point-of-sale systems see **"Table 6, $300"**. Banks and card networks (which already sell spending insights) see **"$300 at Luigi's"**. Nobody sees **inside the group bill**, or what happens **before** the booking. That is our unique data.

### Pipeline

1. **Read and tidy:** the receipt becomes structured lines ("MARG PIZ LG" → "Margherita pizza, large, $26").
2. **Match the venue:** name/ABN/address → one venue record.
3. **Categorise items:** pizza, wine, cocktails, desserts, sides and so on.
4. **De-identify:** remove names and accounts; keep "a group of 6".
5. **Aggregate with minimum thresholds:** never report a number built from fewer than ~20 groups.

### Data products

- **Venue "your group customers" report ($29–99/month).** Example (_illustrative_): "312 group bills in September, average 6.2 people; $46/head vs $58 at similar venues within 2 km; 1 in 3 group diners doesn't drink; garlic bread is ordered by 70% of groups but left unclaimed by 40%; groups who did an activity first spend 20% more."
- **Area reports ($500–5,000):** group dining in a suburb: busy nights, per-head spend by group size, what's shared, the price point where groups stop itemising. Buyers: new venues, landlords, councils, hospitality groups.
- **Brand reports:** for example, wine is shared and cocktails are individual. Buyers: drinks and food brands.
- **"Where groups go next":** for example, 68% of escape-room groups eat within 1 km afterwards. This feeds partnerships and referrals.
- **Sales hook:** venues appear in our data even if they've never signed up, because their customers scanned the receipts. "312 groups split your bills with us last month; here's a free taste" (the same idea as "claim your business" on Google/Yelp).

### Rules (non-negotiable)

- **Never sell individual-level data** ("Sam ordered three beers"). Only aggregated, de-identified patterns.
- **Consent** stated plainly at sign-up, in line with the Australian Privacy Act (which is tightening).
- **Venue fairness:** a venue sees its own detail. Competitors only see area averages, never a named venue's numbers.

### Timing

Data needs density. A useful single-venue report needs roughly 30+ group bills a month at that venue, and an area report needs thousands in the area. So we launch in **one dense area** and expect data revenue from **year 2**.

## 10. Competition

| | Square (Restaurants Plus, Scan to Pay) | Revolut Group Bills | Splitwise | me&u / payo (order and pay at table) | [Name] |
|---|---|---|---|---|---|
| Itemised split by receipt | Staff split by item/seat/portion (paid plan) | Amounts only | Amounts only | At the table, venue must install | Yes, by the guests, from any receipt |
| Works for any bank | Card at the venue | Settle in-app for Revolut users only | Tracking only | Card | Yes (PayID or card) |
| Needs the venue to sign up | Yes | No | No | Yes | No for splits; yes for deposits |
| Each person pays before the booking | No | No | No | No | **Yes (core product)** |
| Business gets fewer no-shows | No | No | No | No | **Yes** |
| Cross-venue group data | Own venue only | Own customers' spending | Limited | Own venues | Yes, inside the bill |

**"Why won't Square or Revolut just do this?"** Square serves the seller at the counter, and Revolut serves its own account holders. [Name] serves **the group and the business at once, whatever bank anyone uses**, and owns the **before-the-booking** moment, which none of them touch. Risk: Square could improve its own split flow, so the venue-side bill split is our weakest position and isn't the core.

## 11. Evidence so far: simulated merchant panel (2026-10-18)

Seven AI role-played Australian Square sellers heard the same pitch: the bill split as a Square add-on, with three price options. They were told that Square already splits bills.

| Panellist | Business | Likely in a year (as pitched) | Would pay |
|---|---|---|---|
| Daniel | 120-seat Korean BBQ, Sydney | 20% | Diner fee, or ≤$29/mo after trial |
| Tash | 90-capacity cocktail bar, Brisbane | 20% | Diner fee, or ≤$29/mo |
| Mia | 40-seat brunch cafe, Fitzroy | 15% | Diner fee ≤50c, or ≤$29/mo |
| Priya and Raj | Family Indian restaurant, Parramatta | 15% | Optional diner fee only |
| Marcus | Escape rooms + karaoke, Melbourne | 15% → **40–50% for split deposits** | **1–2% of the booking** |
| Julien | Fine dining, Sydney | 10% | ≤$29/mo after free pilot, no diner fee |
| Leila | Salon + bridal, Perth | 5% → **40% for bridal deposits** | **$15–25 per wedding** |

Findings:
- 0 of 7 accept a percentage cut on top of Square.
- 6 of 7 say the free consumer split helps them at no cost.
- Every owner asked "why not just Square?" and "who's short when someone walks?"
- Both non-restaurant owners jumped to 40–50% when the product became **split group deposits**. That's the pivot this brief is built on.

**Caveat:** these were simulations, not real merchants. Use them to shape real interviews, not as market evidence.

## 12. Go-to-market

1. **Launch the free consumer split in one dense area** (e.g. Melbourne inner north or Sydney inner west) so the data density comes quickly.
2. **Venues as a free channel:** "We don't split, use [Name]" signs at registers (offered unprompted by two panel owners).
3. **Pilot split deposits** with 5–10 activity venues and bridal stylists. A free 60-day pilot measuring refund requests, no-shows and time saved.
4. **Square App Marketplace** listing once the deposit flow is proven.
5. **Restaurants later,** with users already in hand.

## 13. Risks

- **Square ships a better split.** Mitigation: the core product is pre-booking commitment, which Square doesn't do.
- **Licensing:** holding money (wallets, group card, pay later) needs licences. Mitigation: money goes straight to businesses, use licensed partners, get legal advice before any wallet.
- **Data needs volume:** worthless until dense. Mitigation: a geographic focus, with data as a year-2 stream.
- **Consumer apathy:** PayID and Splitwise are "good enough". Mitigation: receipt claiming must be faster than typing amounts. Measure it.
- **Reliability at peak:** a failure at 10pm Saturday kills venue trust. We need late-night support.
- **Privacy backlash** if data is mishandled. Mitigation: the rules in section 9.

## 14. Next 90 days

- [ ] Choose a name.
- [ ] Interview 5–10 real owners (escape rooms, karaoke, function rooms, bridal), using the panel's questions.
- [ ] Check Square APIs: payment links into a seller's account via OAuth, Orders API on the free plan, App Marketplace requirements.
- [ ] Legal advice: what's possible without a licence; whether a wallet needs an AFS licence or exemption.
- [ ] Design the split-deposit flow on top of wya's pledge/obligation model.
- [ ] Prototype the guest web flow (open link → tick items or pay share → done, no sign-up).
- [ ] Decide the launch area.
- [ ] [Fundraising ask, if any: $__ for __ months to reach __ venues / __ users]

## 15. Decisions and open questions

**Decided**
- Its own brand, separate from wya for now (2026-10-18).
- The core paid product is split group deposits ("before the booking"). The bill split is free and brings people in.
- No percentage cut on restaurant bills. No fee on friend-to-friend bank pay-back.
- Never sell individual-level data.
- Don't compete as a bank (no Revolut-style wallet or card early).

**Open**
- Name.
- Audience for the first external pitch: investors or business owners.
- Launch area.
- Exact pricing (percentage vs per booking, by segment).
- Which booking platforms to integrate after Square.
- Whether and when to build the group virtual card.
- Team roles and the fundraising ask.

## Glossary

- **Split:** dividing a finished bill among the group (Half 1).
- **Split deposit / group commitment:** each person paying their share before a booking is confirmed (Half 2).
- **Organiser:** the person who starts the booking or uploads the receipt.
- **Last-share rule:** whatever stays unpaid falls to the organiser, so nothing looks paid when it isn't.
- **PayID/Osko:** Australia's free, instant bank-to-bank payments.
- **Interchange:** the slice of a card payment fee that goes to the card issuer.

## Sources

- [Square AU: split a payment and check](https://squareup.com/help/au/en/article/8165-split-a-payment-and-check-with-square-for-restaurants)
- [Square AU product updates: Scan to Pay, Item Splits](https://community.squareup.com/t5/Product-Updates/Your-guide-to-what-s-new-from-Square-updates-for-Australian/m-p/822970)
- [Square Terminal API: payments for orders](https://developer.squareup.com/docs/terminal-api/take-payments-for-orders)
- [Square App Marketplace requirements](https://developer.squareup.com/docs/app-marketplace/requirements/general)
- [Revolut AU: Group Bills](https://help.revolut.com/en-AU/help/app-features/splitting-expenses-with-group-bills/)
- [Revolut AU: Group Bills terms](https://www.revolut.com/en-AU/legal/groupbills/)
- [payo: QR checkout with bill splitting](https://technologydecisions.com.au/content/it-management/news/payo-launches-qr-code-payments-for-hospitality-1619700581)
- Merchant panel write-up: https://claude.ai/code/artifact/371cad6e-50d9-45a4-a4bc-690dff7fe552
