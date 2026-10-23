# Payments research: how everyone pays their own share at the moment of purchase

_Written 2026-10-22 on branch `revised_plans`. Australia, AUD. Companion to [`problem.md`](problem.md). Builds on the collaborator's issuing research in [`docs/split-app/`](../split-app/) (`PREFUNDED_GROUP_CARD_RESEARCH_2026-10-19.md`, `VIRTUAL_CARD_PROCUREMENT_RESEARCH_2026-10-19.md`, `GROUP_CARD_PARTNER_BRIEF.md`) and does not repeat it._

**Status of this document:** desk research from public sources. No provider has been contacted, nothing has been tested with real money, and **none of this is legal advice**. Anything marked **(verify)** comes from a forum, a third-party blog or an older page and needs confirming with the provider. Prices are as published on the research date.

---

## 0. The answer in one page

**Goal:** when the bill comes, each person pays **their own share**, **at that moment**, with **Apple Pay / Google Pay or a saved card**, and nobody chases anyone afterwards. Move away from PayID.

There are only four ways to make this happen. The difference between them is **who the money goes to**:

| Route | Who gets each person's money | Plain-English flow | Licence burden | Works at any venue? | Recommended |
|---|---|---|---|---|---|
| **A. Pay the venue directly** | The venue (its own Square / Tyro account) | Each friend's share goes straight into the venue's bill | **Low**: the venue is the merchant, the processor holds the licences, we're software | Only venues on that processor | **Yes: pilot with Square venues** |
| **A0. Pay the venue at the counter (no integration)** | The venue's own terminal | We work out each person's exact amount; each taps their phone at the counter | **None** | Most venues that split by amount | **Yes: ship at launch** |
| **B. Pay the person who paid, instantly** | The friend who paid the bill | One person pays the venue; everyone else is charged their exact share on Apple Pay before they leave | **Medium–high**: money moves between consumers through us (needs a partner's explicit approval plus legal advice) | **Yes** | **Yes: second, once a partner approves the flow** |
| **C. Nobody fronts (group card, like Cino)** | A card issued to the group | One tap on a group card in the organiser's Apple Wallet; each friend's card is charged their share at that moment | **High**: card issuing plus stored value | **Yes** | **Later**, only if the data and a partner support it |
| **D. Pay before (deposits)** | The business, before the booking | Already designed as Stage 1.1 (PayID) → card via route A | Low if paid into the business's account | Businesses we sign up | **Yes** (the collaborator's product) |

**Recommendations:**
1. **App Store launch (now):** split only, plus **"pay at the counter" mode** (A0): the app tells each person their exact amount and ticks them off as they pay the venue. It needs no licence and no integration, gets the payer out of fronting at most venues, and starts collecting data.
2. **Retire the "wya wallet".** Holding balances is a stored-value product: it means licensing, a reason for Apple to reject the app (App Review guideline 3.2.1(viii)), and an extra top-up step that adds friction. Cino's model shows no balance is needed: pull each share from each person's own card at the moment. (This changes the collaborator's Stage 1.3 "locked pot". It needs a team decision; see §7.4.)
3. **Square is the first partner (route A).** It's the only big Australian processor with a public API that lets several payments pay one order **and** lets an app take a fee in Australia. It also has a gap: its Scan to Pay beta can't split a bill. The top question for the Square contact is whether the API can see and pay **open tables created on the POS** (§4.2).
4. **Stripe is the route-B partner, for non-Square venues**, but only after Stripe explicitly approves friend-to-friend reimbursement. "Peer-to-peer money transmission" is on Stripe's restricted list.
5. **Afterpay** as a payment option for **larger shares**, through Square (route A) or Stripe. It isn't a rail for this on its own. It's the strongest relationship angle (Block owns Square and Afterpay), but handle the optics of "pay later for drinks" carefully.
6. **Group card (route C):** keep the collaborator's partner brief, but don't build it until the data shows demand. In Australia it's the most expensive route to run: issuer interchange is capped at about 8c on debit and prepaid, so the US "earn on interchange" model doesn't work here.

---

## 1. The building blocks, briefly

| Term | What it means for us |
|---|---|
| **Apple Pay / Google Pay** | A **wallet**, not a payment system. They hand a secure token of a person's card to a **processor** (Stripe, Square, Adyen). To accept Apple Pay in our app we need a processor and an Apple Pay merchant ID. **Apple Cash (person-to-person) isn't available in Australia**, so Apple Pay can't be used to pay a friend directly (background knowledge, verify) |
| **Acquirer / processor** | Takes card payments for a **merchant** (Stripe, Square, Tyro, Adyen) |
| **Merchant of record** | The business legally selling the thing, who receives the money and the disputes. For a venue bill, that's the venue. If *we* collect the money, we're closer to being a payments business |
| **Card issuer** | Creates cards (route C). Separate from processing |
| **Customer-initiated vs merchant-initiated** | Customer-initiated: the friend approves with Face ID each time. Merchant-initiated: we charge a saved card later under a mandate, which carries more dispute risk |
| **Hold (pre-authorisation)** | Reserve an amount on a card and capture later. On Stripe, online holds last about **7 days** (5 for some Visa cases) |
| **Remote authorisation** | For an issued card: the issuer asks *our* server "approve this purchase?" and we must answer within about **2–2.5 seconds** (Stripe and Airwallex docs) |
| **NPP / Osko / PayID / PayTo** | Australia's real-time bank payments. PayID = pay to a phone number or email (manual). **PayTo** = a pre-approved agreement letting a business pull from your bank account (needs a provider) |
| **Surcharge ban** | Since **1 Oct 2026**, no card surcharges on eftpos, Mastercard or Visa. A fee that applies **whatever the payment method** isn't a surcharge (ACCC) |

---

## 2. The four routes in detail

Worked example everywhere: **six friends, $330 bill, shares of $55** (_illustrative_).

### Route A0: "Pay at the counter" (no integration, ship at launch)

**Flow:**
1. Bill arrives. One person snaps the receipt. Everyone ticks their items (already built).
2. The bill locks. The app shows a **counter view**: "Sam $47.20 · Jo $31.80 · Alex $62.10 …" with a big amount per person.
3. Each person walks up (or the server brings the terminal) and taps their phone for **their exact amount**. Staff key in an amount, which every terminal supports.
4. Each person ticks "Paid at the venue". The organiser sees who's done. Whoever's left over (the last-share rule) is obvious.

**Why it matters:** this gets most of the "pay at the moment" benefit **today**, with no licence, no partner and no PayID. The venue still has to accept split-by-amount. About 1 in 4 Australians have met a venue that refuses (Money.com.au), so it works at most venues but not all.

**Costs:** none to us. The venue pays its normal fee on each tap (Square card-present 1.6%; extra fixed fees on some plans), which is the venues' main complaint about splitting.

**Data we get:** bill size, group size, item shares, how many paid at the venue vs later, by venue. That's exactly what the 30 days need.

### Route A: each share pays the venue's bill through its processor (Square first)

**Flow (Square):**
1. The venue is on Square and has connected our app once (Square OAuth).
2. The organiser picks the venue's table in our app (or scans a QR on the bill). We read the venue's order (Square **Orders API**).
3. Friends claim items in our app. Each pays their share with **Apple Pay / Google Pay** through Square's in-app payments SDK. Each payment is created **against the venue's order**, approved but not yet completed (`autocomplete: false`).
4. When the payments add up to the order total, we call **`PayOrder` with all the payment IDs** and the order is paid. Any shortfall falls to the organiser (the last-share rule).
5. Optional: we take an **app fee** on each payment (`app_fee_money`), which Square supports in Australia under its PAAF disclosure.

**What Square documents (public):**
- `PayOrder` pays an order with **one or more approved payments**. The payments must reference the order, use delayed capture, and add up to exactly the order total. Any approved payment on that order that isn't listed is cancelled. The endpoint is labelled **Beta**.
- **App fees:** `app_fee_money` / `app_fee_allocations` on `CreatePayment`. Fees go to the developer's Square account. In Australia this runs under Square AU's **Payments API Application Fee (PAAF) PDS** (last updated July 2023).
- **In-App Payments SDK:** iOS, Android and Flutter, available in Australia, with Apple Pay and Google Pay. An early launch post said wallets were USD-only; the current Apple Pay docs say all Square regions **(verify AUD)**.
- **Mobile Payments SDK** (in-person) supports **partial authorisation** for splitting across cards, in the US, Canada, UK and Australia.

**The big unknown:** **can the API see and pay an open table created on the venue's POS?** Square community threads (some answered by Square staff, mostly older) say **open tickets aren't visible through the API**. Orders created through the API don't appear on the POS until paid, and paying an API order on the POS was a feature request. If that's still true, route A needs the venue to **send the bill to us** (or we create the order and the POS reflects it), which changes the venue's workflow. **This is question 1 for the Square contact (§8).**

**Where Square already is:** Square for Restaurants lets **staff** split by seat, item or portion (Plus/Premium). **Scan to Pay** (guests pay by QR on the printed bill) is in beta at 2.2%, **and the beta can't split a bill.** That's the opening: we're the guest-side split that Square's own QR flow doesn't have yet.

**Costs (Square AU published):** online and API payments **2.2%**; card-present 1.6%; Afterpay on Square **6% + 30c** (excl. GST). Splitting $330 into six online payments costs the venue ≈ **$7.26**, against ≈ **$5.28** for one 1.6% tap: about **$2 more per bill**. Who absorbs it is a commercial question: the venue, a small diner fee (me&u charges $0.20–$2.90 per order), or Square through a partner rate.

**Licence:** the venue is the merchant and Square is the licensed acquirer. We're a software partner taking a disclosed app fee under Square's PAAF. **This is the lightest regulatory route that delivers "pay at the moment".**

**Other venue processors for the same route:**
- **Tyro Pay@Table / SplitBills:** the terminal pulls the table's bill from the POS and guests pay an **amount**. It works only where the POS supports Tyro's integration. No public consumer-app API was found, so it would be a partnership.
- **me&u, payo, Sunday:** venue QR order-and-pay products (me&u and payo in Australia; no Australian presence found for Sunday). They're competitors at the venue, but could be partners. me&u already splits by item and charges diners a platform fee.
- **Adyen for Platforms:** splits one payment across up to 1,000 accounts and is strong at enterprise level. Overkill until we're processing at scale, and no public material covers several shoppers paying one order.

### Route B: one person pays the venue; everyone else pays them instantly by Apple Pay

**Flow:**
1. The organiser pays the venue with their own card (any venue in the world).
2. Friends claim items. When the bill locks, each friend sees **"Pay Alex $47.20"** with an **Apple Pay / Google Pay** button and approves with Face ID. That's customer-initiated, and the strongest kind of authentication.
3. The money arrives in the organiser's account (Stripe payout to their bank, normally next business day, or instant payout for a fee).
4. Optional **guarantee**: when someone taps "I'm in" before dinner, we place a **hold** on their card for an estimated amount (valid about 7 days online) and capture the exact share at lock. The organiser is protected from a friend who walks out.

**How it's built on Stripe (Australia):**
- **Connect, "separate charges and transfers"** (supported in Australia): we charge each friend on the platform, then transfer to the organiser's **connected account**. Alternatively, **destination charges**.
- The organiser must be **onboarded** as a connected account (identity check and bank details) before receiving money. Do it the first time they're owed, not at sign-up.
- Apple Pay / Google Pay come through Stripe's mobile SDK. Stripe announced **Apple Pay over the local eftpos network** (Q2 2026, generally available), which keeps debit cheaper.
- **Prices (stripe.com/au/pricing):** domestic cards **1.65% + 30c**; international 3.5% + 30c; **PayTo 1% + 30c, capped at $3.50**; instant payouts 1.5% (minimum 50c); disputes $25. Connect: a 0.25% fee if the platform sets its own pricing.

**The blocker: is this "peer-to-peer money transmission"?** Stripe's restricted-businesses list includes P2P money transmission, and some restricted categories can be approved explicitly. Friend-to-friend reimbursement through our platform looks like P2P. **We need Stripe's written approval for this exact flow, plus Australian legal advice** (non-cash payment facility rules, AUSTRAC designated services). Zai's public policy likewise treats P2P platforms as needing extra due diligence. Don't build route B before that answer.

**Costs:** five friends × (1.65% × $55 + 30c) = **≈ $6.04 per bill**. **PayTo** would be ≈ $4.25 (1% + 30c each), but it's less "tap and done" because it needs a bank agreement. **The tension:** PayID is free. Someone has to pay about $1.20 per share for the convenience: the friend (a small fee), the organiser ("get paid now"), us (subsidy), or a partner rate. The existing brief already decided not to charge for basic pay-back, so keep PayID as the free option and make card payment the **instant, guaranteed** option.

**Variant B2, the organiser's phone as a card reader:** Stripe Terminal's **Tap to Pay on iPhone** works in Australia (1.65% + 10c + 15c per authorisation). Friends tap their cards on the organiser's phone. It's slick in person, but it makes every organiser a merchant and is still P2P underneath. **Not recommended.**

**Other ways to pay a person instantly (for completeness):**

| Rail | How | Fit |
|---|---|---|
| **PayID / Osko** | Bank to bank, free, instant | Current approach; manual. You asked to move away from it |
| **PayTo** (via Stripe, Zepto, Monoova, Azupay, Zai…) | The friend approves a one-off agreement in their bank app; the provider pulls the money | Cheap and bank-native, but approval happens in the bank app, which adds friction. Good later for bigger "before the booking" amounts |
| **Push to card** (Visa Direct, Mastercard Move) | Pay out to a debit card in real time | How Beem settles on debit rails. Needs a licensed provider; useful only for instant payouts to the organiser |
| **PayPal friends & family** | Free from balance or bank; 2.6% + fixed fee by card | Everyone needs PayPal. Not a fit |
| **Revolut, Up, Beem** | In-app transfers | Only between their own customers |

### Route C: a group card so nobody fronts the bill (Cino model)

**How Cino does it (EU/UK):** a shared virtual card in Apple / Google Wallet. With **QuickSplit**, friends open a link and connect **Apple Pay or Google Pay, with no app or account**. When the organiser taps, the bill is **split immediately** and each share is charged to each friend's card. Splits are equal or by percentage, not by item. €0.20 per transaction, capped at €5 a month. €3.5M seed (Balderton). Cards must be from the EEA or UK.

**How it would work technically:**
1. Before the bill, friends join the plan's link and add a card through Apple Pay.
2. The organiser taps the **group card** at the terminal.
3. The issuer asks our server to approve, and we have about **2–2.5 seconds**. In that window we charge each friend's share (or capture holds placed earlier). We approve only if everything succeeds; otherwise we decline, or the organiser covers the gap.
4. **Item-level reconciliation afterwards:** at the tap we only know the total, not who had what. So charge an **even or estimated split at the tap**, then **adjust to the exact item shares** after claims (small refunds and charges). That keeps our fairness advantage, at the cost of a second, small money movement.

**Australian availability:**
- **Stripe:** **card issuing for connected accounts in Australia, private preview from Q4 2026** (Sessions 2026). That's for platforms' business users; **consumer** issuing in Australia isn't announced. Stripe's main Issuing docs don't list Australia.
- **Airwallex:** Australian **consumer** debit/prepaid programmes subject to approval; remote authorisation; Apple/Google Pay. Its standard model ties funds to one cardholder, so multi-contributor rights need explicit approval (collaborator's research). Full branded Apple Pay provisioning is published as about **3–4 months**.
- **Kobble / Yondr, Vault, Cuscal:** see the collaborator's procurement research.
- **Marqeta exited Australia** (it closed its Melbourne office; it served Afterpay's and Zip's card programmes from the US). That's a reminder that issuing partners come and go.

**Economics (why it's last):** we'd be the merchant charging six cards (≈ **$7.25** in acquiring fees at 1.65% + 30c), plus issuing fees (unknown; get a quote). Our only built-in income is interchange on the group card, and Australian caps from 1 Oct 2026 are **8c / 0.16% on debit and prepaid** (and 0.3% on consumer credit), so **at most ≈ $0.50 on a $330 bill**. **Every group-card bill loses money unless someone pays a fee.** Cino's low fees suggest it's subsidising growth with venture money in Europe, where debit interchange is similarly capped. Plus the licensing: stored value, non-cash payment facility, AUSTRAC. The collaborator's brief and gates already cover this well.

**Verdict:** it's the best possible experience, and the most expensive, slowest and most regulated route. Route A at Square venues plus route B elsewhere gets about 90% of the experience at a fraction of the cost.

### Route D: pay before the booking (deposits)

Already designed and built as **Stage 1.1** (collect by PayID; `docs/split-app/STAGE_1_1_PLAN.md`). To move from PayID to cards, **pay straight into the business's own account**:
- **Square businesses:** Payment Links / Checkout API into the seller's account through OAuth, with an app fee (route A mechanics, online 2.2%).
- **Others:** Stripe Connect with the **business** as the connected account. That's an ordinary marketplace flow, **not** P2P, so it's far easier for Stripe to approve than route B.
- Holds work well here: authorise each person's share at "I'm in" and capture when the group is complete. Online holds last about 7 days, so for bookings further out, charge and refund instead.

**Precedents:** Uber **Split Fare** splits at request time (each rider pays a 25c fee; if someone declines, the requester pays). Airbnb bought **Tilt** to let groups split a booking. Both work cleanly because **the platform is the merchant**. That's why "before the booking" is easier to build with payments than "after the bill".

---

## 3. Friction: what each route asks of the user

| Step | A0 counter | A Square venue | B pay the payer | C group card |
|---|---|---|---|---|
| Friend needs the app? | No (web link) | No (web plus Apple Pay) | No (web plus Apple Pay) | No (link plus Apple Pay) |
| One-time setup | None | Venue connects Square once | Organiser verifies identity once (first payout) | Organiser verifies identity; card into Apple Wallet |
| At the table | Each walks to the counter or the terminal comes round | Each taps Apple Pay in our page | Each taps Apple Pay in our page | Organiser taps once |
| Afterwards | Nothing | Nothing | Payout lands (next day, or instant for a fee) | Small item-level adjustments |
| Fails when | Venue refuses to split | Venue isn't on Square; POS tab not visible through the API | Partner won't approve P2P | Issuer won't approve; cost |

**Design rules from Cino:**
- **No balance.** Money comes straight from each person's own card at the moment. No top-ups, no cash-out.
- **No app for friends.** A link plus Apple Pay or Google Pay.
- **One action at the table.** The split has to finish in under a minute, or people fall back to "just tap your card".
- **Receipts for everyone:** who paid what, kept with the event.

---

## 4. Provider by provider

### 4.1 Stripe (Australia)

| Area | What's available | Notes |
|---|---|---|
| Card payments | 1.65% + 30c domestic; 3.5% + 30c international (lower from 1 Apr 2027) | Apple Pay / Google Pay included; Apple Pay via eftpos generally available Q2 2026 |
| PayTo / BECS | 1% + 30c, capped at $3.50 | A bank-account alternative to cards |
| Connect | Separate charges and transfers supported in AU; destination charges; "you handle pricing" (0.25%) or Stripe-collected fees; revenue share for qualifying platforms | Route B and D (business payee) |
| Holds | Manual capture; about 7 days online; extended holds on IC+ pricing | Guarantee and deposits |
| Terminal / Tap to Pay | 1.65% + 10c; Tap to Pay +15c per authorisation | Route B2 (not recommended) |
| Issuing | AU **connected-account** issuing private preview from Q4 2026; consumer issuing not announced for AU | Route C, later |
| Treasury / accounts | Coming to Australia by year-end 2026; AU platform financial accounts private preview Q4 | Not needed if we drop the wallet |
| Restrictions | P2P money transmission restricted; explicit approval possible | **The route B gate** |
| App | Official React Native SDK with Apple / Google Pay (verify SDK 57 / Expo config plugin) | We already use dev builds |

### 4.2 Square (Block)

| Area | What's available | Notes |
|---|---|---|
| Fees (AU) | Card-present 1.6% (Tap to Pay 1.6% for newer sellers); online / API / manual 2.2%; Afterpay 6% + 30c | Custom rates from $250k a year |
| Payments API + In-App SDK | Tokenise Apple Pay / Google Pay / cards in our app; charge **into a seller's account** using that seller's OAuth token | Route A and D |
| Orders API + `PayOrder` (beta) | Several delayed-capture payments pay one order; they must add up to the total | **The core of route A** |
| App fees | `app_fee_money`, or split with one more party via `app_fee_allocations`; AU under the PAAF PDS | Our revenue on venue payments |
| Open tickets (POS tabs) | Community answers: **not visible through the API**; unpaid API orders don't show on the POS (verify, may have changed) | **Biggest technical risk** |
| Square for Restaurants | Staff split by seat, item or portion; Scan to Pay (QR) beta at 2.2%, **no split in beta** | The gap we fill |
| Mobile Payments SDK | In-person partial authorisation for split tender; US, CA, UK, AU | If we ever run on venue devices |
| Distribution | App Marketplace listing; Solutions Partner programme | After a pilot proves value |
| Afterpay | Afterpay already works on Square's POS and online | A Block-wide conversation |

**What Square gains:** volume at the online rate (2.2%) instead of one 1.6% tap; a split feature its QR flow lacks; less staff time for its venues (the industry's main objection to splitting); and young customers who also use Afterpay.

### 4.3 Afterpay (Block)

- **What it is for us:** a **payment method** offered by whoever the merchant is: the venue (through Square, 6% + 30c) or us/the business (through Stripe or Afterpay directly). It isn't a way to move money between friends.
- **Rules:** buy-now-pay-later is regulated credit from **10 June 2025**: providers need an Australian credit licence, responsible-lending checks and complaints handling. Afterpay carries that; we'd only present it as an option.
- **Hospitality history:** Mr Yum (now me&u) piloted Afterpay; Australian Venue Co launched "dine now, pay later" in pubs in 2021 (gambling excluded), and consumer advocates objected. **Afterpay on Square POS** exists.
- **Fees:** 6% + 30c on Square. Other quotes range from 3.5–7% + 30c (third-party, verify). On a $55 share that's about **$3.60**, so it only makes sense for **larger shares**: birthday dinners, group trips, deposits.
- **Surcharge ban:** the 1 Oct 2026 ban covers eftpos, Mastercard and Visa. Buy-now-pay-later isn't covered and follows its own merchant agreements (third-party summaries, verify).
- **Partnership angle:** Block owns Square and Afterpay. "Pay your share in 4" inside a Square venue's split is one Block conversation, and the Afterpay contact can tell us whether Afterpay has any **group** or **split** product thinking and what its rules on alcohol and hospitality are now.

### 4.4 Other Australian infrastructure

| Provider | Relevant for | Notes |
|---|---|---|
| **Tyro** | Route A at Tyro venues | Pay@Table and SplitBills by amount through POS integrations; a partnership, not a public API |
| **Adyen** | Route A/B at scale | Split payments to up to 1,000 accounts; enterprise |
| **Airwallex** | Route C; payouts | AU consumer card programmes (approval); remote authorisation |
| **Kobble / Yondr, Vault, Cuscal** | Route C | See the collaborator's research |
| **Zepto, Monoova, Azupay, Zai** | PayTo / NPP (route B and D bank option) | Zai treats P2P as extra due diligence |
| **me&u, payo** | Venue QR (competitor or partner) | me&u splits by item and charges diners $0.20–$2.90 |
| **Revolut, Up, Beem (Bolt)** | Competitors | Bolt is turning Beem into an "everyday money app"; possible partner for P2P later |

---

## 5. Cost of one $330 bill, six people, by route (_illustrative_)

| Route | Who pays fees | Processing cost per bill | Our possible revenue per bill |
|---|---|---|---|
| Today (one person pays, PayID back) | Venue: one tap | ≈ $5.28 (1.6%) | $0 |
| **A0 counter** | Venue: six taps | ≈ $5.28 plus any per-tap fixed fees | $0 (data only) |
| **A Square in-app** | Venue (unless a diner fee) | ≈ $7.26 (6 × 2.2% online) | App fee, e.g. 30c × 6 = **$1.80**, or 0.5% = **$1.65** |
| **B Stripe card** | Friends, organiser or us | ≈ $6.04 (5 × [1.65% + 30c]) | Pricing spread, e.g. 1.9% vs 1.65% ≈ **$0.70**, or a 30–50c fee per share |
| **B PayTo** | Same | ≈ $4.25 (5 × [1% + 30c]) | Similar |
| **C group card** | Us (unless a fee) | ≈ $7.25 acquiring + issuing fees (unknown) | Interchange at most ≈ $0.50; **negative without a fee** |
| **Afterpay share** | Merchant | ≈ $3.60 per $55 share (6% + 30c) | Partner deal only |

**Partner revenue (why they'd care):** at 100,000 in-app split bills a month, routes A and B put about **$27.5M a month** through the partner, earning them roughly **$600k a month** gross. That's the number to put in front of the Square and Stripe contacts, rebuilt with the measured 30-day averages (`problem.md` §7).

---

## 6. Rules, licences and App Store

| Topic | Where it stands (Oct 2026) | What it means for us |
|---|---|---|
| **Payments licensing reform** | Treasury released the Tranche 1 draft bills on 12 Mar 2026 (submissions closed 9 Apr). They replace the stored-value regime with **AFS licensing for stored-value facilities**, with APRA oversight of larger ones. Bills were expected to be introduced later in 2026 (no confirmation found); they start **12 months after Royal Assent** | A wallet or pot would need a licence or a licensed partner. Route A/D (paying businesses through their processor) avoids that. Route B/C need legal advice now |
| **Non-cash payment facilities (current law)** | ASIC relief instrument remade in 2026 (see the collaborator's research) | Don't assume relief covers us; get advice before any money flow we control |
| **AUSTRAC** | AML/CTF obligations depend on whether we provide designated services | Route B/C: lawyer plus partner responsibility matrix (collaborator's partner brief) |
| **Buy now, pay later** | Credit licence required from 10 June 2025 | Offer Afterpay only as the merchant's payment method; never "our" credit |
| **Card surcharges** | Banned on eftpos, Mastercard and Visa from **1 Oct 2026**; consumer credit interchange 0.3%, debit 8c (0.16%); foreign card cap 1 Apr 2027 | A diner fee must apply **whatever the payment method** and be shown up front (ACCC guidance) |
| **App Store 3.1.3(e)** | Physical goods and services must be paid with Apple Pay or cards, **not** in-app purchase | Bill payments avoid Apple's commission. Good |
| **App Store 5.1.1(ix)** | Apps in "banking and financial services" must be submitted by a **legal entity**, not an individual | Enrol in the Apple Developer Program as an organisation (company, ABN, D-U-N-S) before payments ship |
| **App Store 3.2.1(viii)** | "Money management" apps must be submitted by the **financial institution** doing it, with licences | **A wallet with balances is exactly what this catches. Remove it from the App Store build** |
| **Privacy Act** | Receipts include venue, items, sometimes card digits and staff names | De-identify for analytics; redact card numbers; say plainly what we collect; complete the App Privacy labels |

---

## 7. What this means for the app

### 7.1 App Store build (now): split only

**Keep:** events, invites, chat, album, receipt scan and claims, bill lock, "you owe Alex $47.20", PayID details and "I've paid" (no money through us), pledges and Stage 1.1 collections (PayID only).

**Add (small):**
- **Pay at the counter** (route A0): a big per-person amount list plus "Paid at the venue" ticks. No money moves.
- **"Pay with Apple Pay (coming soon)"** button: measures demand and records taps, moves nothing.
- **Analytics** for the 30-day questions (`problem.md` §8), with consent and de-identified.

**Hide or remove before submission:**
- **The wallet, top-up and cash-out** (`app/wallet.tsx`, `lib/wallet.ts`, `components/wallet/*`, the `pay_from_wallet` paths). It's a test balance that looks like real money: Apple guideline 3.2.1(viii), misleading for users, and stored-value questions. Hide it behind a build flag; the database can stay.
- Anything else that suggests money moves through us.

### 7.2 Square pilot (next 4–8 weeks, in parallel)
1. Ask the Square contact the questions in §8.
2. Square sandbox: OAuth to a test seller → create an order → two Apple Pay payments with `autocomplete: false` → `PayOrder` → app fee. Prove it end to end.
3. Two or three friendly Square venues near the launch campus.

### 7.3 Stripe route B (after written approval)
Ask Stripe (§8). If approved: organiser onboarding on first payout, Apple Pay for friends, optional holds for the guarantee, PayID kept as the free option.

### 7.4 What to drop or change

| Current design | Recommendation | Why |
|---|---|---|
| **wya wallet** (test balance, top-up, cash-out) | **Retire.** Pass-through payments only | Licensing, App Store risk, extra steps; Cino shows it isn't needed |
| **Stage 1.3 "locked pot held by a partner"** | **Re-scope** to "pay straight to the business" (route D) where possible; keep a pot only if a group truly needs to buy from a business we can't integrate | Same reasons. **Team decision** |
| **Stage 1.4 group virtual card** | **Later.** Keep the partner brief; gate on 30-day data and quotes | Cost and licensing (§2, route C) |
| **PayID** | Keep as the **free** option; make Apple Pay the default once a partner is live | Free and familiar; you asked to move away from it as the main path |
| **Pledges ($5 no-show)** | Keep, optional and framed as fun (already done in the reel) | Unchanged |

---

## 8. Questions for the contacts

**Square** (priority order):
1. Can a third-party app **read and pay an open table** created on Square for Restaurants (Orders API, `SearchOrders` OPEN), or must orders come from the API? Is anything on the roadmap?
2. Is **`PayOrder` with several delayed-capture payments** production-ready for AUD, including Apple Pay / Google Pay from the In-App Payments SDK?
3. **App fees in Australia:** limits, reporting, and how a separate diner-fee line item interacts with the surcharge ban.
4. Is **Scan to Pay** getting bill splitting? Would Square partner with an app that does guest-side splitting?
5. App Marketplace or Solutions Partner requirements, and any **partner revenue share or referral** for bringing venues to Square for Restaurants.
6. Risk and dispute handling when one order is paid by six cards.

**Afterpay:**
1. Can Afterpay be offered for **one person's share** of a group bill (through Square or online), and what are the minimums?
2. Current policy on **hospitality and alcohol**.
3. Any group or "pay together" products or partner programmes (Block-wide, with Square)?
4. Marketing or referral arrangements for bringing young customers.

**Stripe:**
1. Will you approve **friend-to-friend reimbursement** of a venue bill (route B) on Connect in Australia? Under what structure (connected-account type, limits, KYC)?
2. Platform pricing and **revenue share** thresholds for Australian platforms.
3. Timeline for **AU issuing** (connected-account preview Q4 2026) and any consumer-card plans.
4. Apple Pay via eftpos: pricing for debit through our platform.

**A payments lawyer** (before route B or C): see the collaborator's partner brief, questions 1–6, plus whether a diner fee on venue payments is a surcharge.

---

## 9. What's unverified or unknown

- Whether Square's API can see open POS tabs today (forum evidence only).
- Square In-App Payments wallets in AUD (an old note said USD only).
- Stripe's position on route B (P2P).
- Issuing costs in Australia (no public prices; quotes needed).
- Afterpay fees for our case (third-party ranges; Square's 6% + 30c is official).
- Whether the payments reform bills have been introduced (no confirmation found after mid-2026).
- Splitwise's exact free limits and prices (third-party blogs disagree).
- Up Groups settling for non-Up users (not stated on Up's page).

---

## 10. Sources

**Stripe:** [AU pricing](https://stripe.com/au/pricing) · [Connect charges](https://docs.stripe.com/connect/charges) · [Separate charges and transfers](https://docs.stripe.com/connect/marketplace/tasks/accept-payment/separate-charges-and-transfers) · [Connect pricing](https://stripe.com/zh-cn-au/connect/pricing) · [Monetising payments](https://support.stripe.com/questions/monetizing-payments-with-stripe-connect) · [Place a hold](https://docs.stripe.com/payments/capture-later) · [Multicapture](https://docs.stripe.com/terminal/features/multicapture) · [Tap to Pay AU](https://stripe.com/au/terminal/tap-to-pay) · [Issuing](https://docs.stripe.com/issuing) · [Issuing global availability](https://docs.stripe.com/issuing/global) · [Sessions 2026 announcements](https://stripe.com/blog/everything-we-announced-at-sessions-2026) · [Treasury in Australia](https://stripe.com/en-lv/newsroom/news/tour-sydney-2026) · [Restricted businesses](https://stripe.com/en-gi/legal/restricted-businesses) · [Restricted list FAQ](https://support.stripe.com/embedded-connect/questions/restricted-business-list-faqs) · [PayTo guide](https://stripe.com/resources/more/payto-an-in-depth-guide)

**Square:** [AU fees](https://squareup.com/help/au/en/article/5068-what-are-square-s-fees) · [Split an online payment](https://developer.squareup.com/docs/commerce/scenarios/split-online-payment) · [PayOrder reference](https://developer.squareup.com/reference/square/orders-api/pay-order) · [Collect application fees](https://developer.squareup.com/docs/payments-api/take-payments-and-collect-fees) · [App fee considerations](https://developer.squareup.com/docs/payments-api/collect-fees/additional-considerations) · [App fee in AU (forum)](https://developer.squareup.com/forums/t/app-fee-money-in-au/24749) · [PAAF PDS](https://squareup.com/au/en/legal/general/pds-paaf) · [In-App Payments SDK](https://developer.squareup.com/docs/in-app-payments-sdk/what-it-does) · [Apple Pay](https://developer.squareup.com/docs/in-app-payments-sdk/add-digital-wallets/apple-pay) · [Mobile Payments SDK](https://developer.squareup.com/docs/mobile-payments-sdk) · [AU in-person APIs](https://developer.squareup.com/au/en/in-person-payments) · [Open tickets via API (forum)](https://community.squareup.com/t5/Archived-Discussions-Read-Only/Connect-API-get-open-tickets/m-p/175788) · [Unpaid orders (forum)](https://developer.squareup.com/forums/t/how-to-view-open-unpaid-orders-in-square-dashboard/27233) · [Split a check (AU)](https://squareup.com/help/au/en/article/8165-split-a-payment-and-check-with-square-for-restaurants) · [Scan to Pay beta (AU)](https://squareup.com/help/au/en/article/7949-pre-authorization-for-bar-tabs) · [AU product updates](https://community.squareup.com/t5/Product-Updates/Your-guide-to-what-s-new-from-Square-updates-for-Australian/m-p/822970) · [Tap to Pay AU](https://squareup.com/au/en/payments/tap-to-pay) · [App Marketplace requirements](https://developer.squareup.com/docs/app-marketplace/requirements/general)

**Afterpay and BNPL:** [Square POS integration (SmartCompany)](https://www.smartcompany.com.au/finance/economy/afterpay-square-pos-integration-bnpl-buy-now-pay-later/) · [Pubs (The New Daily, 2021)](https://thenewdaily.com.au/finance/finance-news/2021/11/09/afterpay-pubs-alcohol/) · [Mr Yum pilot](https://www.smartcompany.com.au/startupsmart/bnpl-dinner-mr-yum-afterpay-payment-restaurants/) · [Merchant fee ranges (third-party)](https://kcwebdesign.com.au/afterpay-merchant-fees/) · [BNPL rules (Stripe)](https://stripe.com/en-ca/resources/more/bnpl-regulations-in-australia-what-businesses-need-to-know) · [BNPL law (Mondaq)](https://www.mondaq.com/australia/dodd-frank-consumer-protection-act/1558794/bnpl-regulation-takes-the-final-step-in-australia)

**Cino and precedents:** [QuickSplit](https://www.getcino.com/quicksplit) · [How Cino works](https://www.getcino.com/post/how-to-use-cino-a-step-by-step-guide) · [Tech.eu](https://tech.eu/2024/10/31/cino-makes-bill-splitting-drama-a-thing-of-the-past/) · [Balderton](https://www.balderton.com/news/cino-raises-e3-5m-to-revolutionise-shared-payments-with-the-first-virtual-card-that-splits-and-pays-group-bills-instantly/) · [Uber Split Fare](https://www.uber.com/en-CA/ride/how-uber-works/split-fare) · [Airbnb / Tilt](https://venturebeat.com/business/airbnb-now-lets-groups-of-guests-split-the-cost-of-their-stay) · [Collctiv](https://www.collctiv.com/lp/collctiv-vs-collection-pot-why-choose-collctiv-over-collection-pot)

**Other infrastructure:** [Tyro Pay@Table](https://docs.integrated-eftpos.tyro.com/integrated-eftpos/paytable/introduction) · [Adyen platforms splits](https://help.adyen.com/knowledge/adyen-for-platforms/classic-integration/how-can-i-split-payments-between-different-accounts-classic) · [Airwallex issuing (AU)](https://www.airwallex.com/en-au/platform-api-and-embedded-finance/issuing) · [Airwallex cards API](https://www.airwallex.com/docs/api/issuing/cards) · [Marqeta exits Australia](https://www.bankingday.com/marqeta-exits-australia) · [Visa Direct](https://au.review.visa.com/products/visa-direct/capabilities.html) · [PayPal AU fees](https://www.paypal.com/au/webapps/mpp/paypal-fees) · [me&u Pay](https://meandu.com/serve/pay) · [me&u fee](https://help.meandu.com/hc/en-us/articles/17561701058703-Understanding-the-me-u-platform-fee) · [Revolut AU Group Bills terms](https://www.revolut.com/en-AU/legal/groupbills/) · [Up Slices](https://up.com.au/features/slices/)

**Regulation:** [RBA media release](https://rba.gov.au/media-releases/2026/mr-26-10.html) · [RBA implementation](https://www.rba.gov.au/payments-and-infrastructure/review-of-retail-payments-regulation/2026-03/conclusions-paper/impact-and-implementation.html?hl=en-AU) · [HSF Kramer summary](https://www.hsfkramer.com/insights/2026-04/rba-releases-conclusions-of-its-review-of-merchant-card-payment-costs) · [Interchange caps (Vixio)](https://www.vixio.com/regulatory-news/pc-unpacking-rbas-ban-card-surcharging-and-new-interchange-caps) · [Payments reform (Dentons, Mar 2026)](https://www.dentons.com/en/insights/alerts/2026/march/30/next-chapter-in-australias-regulation-of-payment-service-providers) · [Tranche 1 draft (Regulation Tomorrow)](https://www.regulationtomorrow.com/2026/03/regulation-of-payment-service-providers-tranche-1-draft-legislation/) · [Treasury reforms](https://treasury.gov.au/policy-topics/banking-and-finance/payments-licensing-reforms) · [ACCC card surcharges](https://www.accc.gov.au/business/pricing/card-surcharges) · [AUSTRAC](https://www.austrac.gov.au/new-austrac/check-if-you-may-be-regulated) · [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
