# The problem, the competition, and why we're different

_Written 2026-10-22 on branch `revised_plans`. Market: Australia. Companion to [`research.md`](research.md) (payment rails and partners). Builds on [`docs/split-app/PRODUCT_BRIEF.md`](../split-app/PRODUCT_BRIEF.md) and the advisor feedback (David, Harry)._

**How to read this:** every number has a source at the bottom. Numbers marked _illustrative_ are made up to show the shape of the maths. Replace them with the 30-day data. Where a claim about a competitor came from a third-party blog rather than the company, it says so.

---

## 1. The pitch in 30 seconds

> **On a night out the bill arrives as one number, but six people ate and drank it. Venues won't split it, so one friend pays the lot and spends the next week chasing everyone else.**
>
> Every app that exists today helps you track that debt **after** the money has gone. **[We] make sure everyone pays for what they actually had, before anyone leaves the table, from any bank, without anyone downloading an app.** The organiser never fronts the bill.

The short version, for a slide: **"Nobody fronts the bill."**

What we are **not** claiming: that bill-splitting is a new idea, that nobody else lets you split, or that this is a huge unmet need on its own. The category is crowded. What we claim is narrower and testable: **nobody in Australia closes the gap between "who had what" and "everyone has paid", at the table, at any venue.**

---

## 2. The problem, stated so it holds up to Harry

### 2.1 What actually happens

1. A group of 4–10 goes out (a birthday, a dinner, the pub after an exam).
2. The venue issues **one bill per table**. Many won't split it, or split it badly (evenly, or by amount, not by item).
3. **One person pays the whole thing** on their card. They're now owed $200–$500.
4. Someone posts "how much do I owe?" in the group chat. Arguments start: who had the wine, the person who only had tofu, the non-drinker.
5. People pay back late, round down, or never. The payer either chases (awkward) or eats the loss.

### 2.2 Why it happens (the root cause, not the symptom)

**One card can only make one payment, and venues issue one bill per table.** Splitting at the venue costs the venue money and staff time, so it pushes the split onto the customers:

- The Restaurant and Catering Association's CEO calls splitting "a privilege rather than a right". Venues that refuse cite complexity and speed. POS systems weren't built to bill per person. Every extra card transaction adds a fixed fee, and it's "an unrealistic expectation" for servers to calculate each person's share ([Yahoo Finance / Money.com.au, 2026](https://au.finance.yahoo.com/news/common-bill-splitting-payment-practice-defended-as-aussies-left-with-sour-taste-023007972.html)).
- One Brisbane cafe added a **7% surcharge for split bills** to cover the extra fees, then removed it after backlash (same source).
- **Even split is the default, and it's unfair.** In Tyro's 2026 survey, 47% are annoyed when someone orders expensive items and the group splits evenly, and 39% object to non-drinkers covering a drinks-heavy bill ([Beer & Brewer on Tyro's report](https://www.beerandbrewer.com/cost-pressures-are-changing-how-consumers-spend-at-the-bar/)).

So the problem has **two halves that nobody solves together**:
1. **Fairness:** working out who had what, item by item.
2. **Timing:** getting each person to pay their own share *before the moment passes* (before people leave the table).

Apps like Splitwise solve (1), usually behind a paywall. Venue QR systems solve (2), but only at venues that installed them. Cino solves (2) at any venue, but not (1), and not in Australia.

### 2.3 Evidence that people care (Australian data)

| Finding | Source | Sample / caveat |
|---|---|---|
| **50%** of Australians now prefer to pay only for their own order; **37%** use QR ordering to avoid awkward money conversations; 1 in 3 are dropping the "shout" | [Tyro, Eat Pay Love 2026](https://www.tyro.com/blog/eat-pay-love-2026/) | 2,018 consumers + 519 businesses. Tyro sells payments to venues |
| **47%** annoyed by an even split when others order expensive items; **39%** object to non-drinkers covering a drinks-heavy bill | Tyro 2026, via [Beer & Brewer](https://www.beerandbrewer.com/cost-pressures-are-changing-how-consumers-spend-at-the-bar/) | Secondary reporting of the same survey |
| **65%** think restaurants should be *required* to allow split bills; nearly **1 in 4** have been to a venue that won't split; **11%** say a no-split policy caused tension; **7%** were surcharged for paying separately; **3%** were left out of pocket | [Money.com.au via Yahoo Finance, Jan 2026](https://au.finance.yahoo.com/news/common-bill-splitting-payment-practice-defended-as-aussies-left-with-sour-taste-023007972.html) | 1,000 people; method not published |
| **72%** of 18–29-year-olds are more likely to skip shouting and split (54% overall, 32% of over-65s). About **37%** of groups have one person pay and get transferred money | [NAB research, Aug 2024](https://www.miragenews.com/aussie-shout-fades-youth-prefer-bill-splitting-1288270/) | Sample size not stated |
| **50%** feel awkward asking friends to repay; **44%** don't chase; **46%** pay shared costs knowing they won't be repaid in full; **22%** avoid activities because they won't be reimbursed | [PayPal Australia, Jul 2024](https://newsroom.au.paypal-corp.com/Avoid_the_awkward_tax_this_World_Friendship_Day-_Aussies_uncomfortable_asking_friends_for_owed_money) | Commissioned by a payments company |
| Average dining spend **$85 per person** in 2025; 41% prefer dining with others | [OpenTable AU 2026 trends](https://www.opentable.com.au/restaurant-solutions/2026-diner-trends/) | Per person, not per group bill |
| **Our own:** three birthday dinners in three weeks; two of us paid the big bill and are still waiting to be repaid | Founders | Anecdote, n = 3. Say so |

**What this proves:** the behaviour is common and getting more common among young people (they split rather than shout), even splitting is resented, and chasing money is awkward enough that people give up on it. **What it doesn't prove:** that people will change apps for it, or how much money is actually left unpaid. That's what the 30 days of data are for (section 8).

### 2.4 The one-sentence problem statement

> **When a group goes out, one person ends up paying for everyone, because venues issue one bill and every split tool works after the money has gone. Splits are unfair (even, not by item) and repayment depends on chasing friends.**

---

## 3. Who it's for

**Primary: 18–29-year-olds in Australian cities**, especially uni students and early-career friends, going out in groups of 4–10. Why them:
- They split the most (72% of 18–29s vs 32% of over-65s, NAB 2024).
- Their budgets are tight, so a $30 overpayment on an even split stings, and so does $200 they're owed.
- They meet tools through a link in a group chat, which is how wya already spreads (invite links, no account to view).
- They're dense on campuses and in a few suburbs, which matters for word of mouth and for any venue partnership.

**The moments:** birthday dinners, pre-drinks to dinner to bar, group holidays, sports-club and society nights, and anything one person books for a group (the collaborator's "before the booking" product).

**Secondary (later, paid):** the businesses that take group deposits (escape rooms, karaoke, bridal, function rooms). See `docs/split-app/PRODUCT_BRIEF.md` §5. Venues are a **distribution channel and a payments partner**, not the first revenue source.

**What we need to learn about them (30 days):** typical group size, bill size, how often they go out, how they settle today, and how long it takes. Section 8 lists exactly what to measure.

---

## 4. The competition

### 4.1 Everyone in one table

"When money moves" is the column that matters most. **After** = someone already paid the whole bill and the app helps them get repaid. **At the table** = each person pays their own share before leaving. **Before** = each person pays before the booking.

| Product | What it is | When money moves | Splits by item? | Works at any venue? | Friends need its app or bank? | In Australia? | Price |
|---|---|---|---|---|---|---|---|
| **Splitwise** | Debt ledger for groups | After (and only tracks; payment happens elsewhere) | Yes, **Pro only** (receipt scan + itemise) | Yes | Account needed | Yes | Free tier capped at about 3–4 new expenses a day with ads; Pro about US$5/mo or $40–50/yr (third-party figures, vary by region) |
| **Revolut Group Bills** | Shared-expense tracker inside the bank app | After | **No**, amounts/shares only | Yes | Non-Revolut users can join via web but **can't pay through it**; instant settle only Revolut-to-Revolut | Yes (Revolut Payments Australia) | Free. Revolut's own terms: "not a payment service", entries are tracking only |
| **Up (Slices, Groups)** | Bank app: slice any purchase; groups with chat and Settle Up | After | **No**, dollar, percentage or equal | Yes | Built for Up customers (non-Up settling unclear) | Yes (AU neobank) | Free with an Up account |
| **Beem** | AU P2P payments app: pay, request, split | After | No | Yes | Beem account | Yes; sold by AP+ to **Bolt Group** in 2026, moving to an "everyday money app" | Free |
| **Tricount / Settle Up / Splid** | Free or cheap group ledgers | After | Mostly no | Yes | App or web | Yes (global apps) | Free / one-off |
| **Tab** (US) | Snap receipt, everyone taps what they had | After | **Yes** | Yes | Link | US-focused | Free |
| **Cino** (EU/UK) | Shared virtual card in Apple/Google Pay; **QuickSplit**: friends join a link with Apple/Google Pay, no app, and the bill is split **at the tap** | **At the table** | **No**, equal or percentage | **Yes**, anywhere that takes Apple/Google Pay | No app for QuickSplit friends | **No**: cards must be EEA/UK | €0.20 per transaction, capped €5/month; €3.5M seed (Balderton) |
| **Collctiv** (UK) | Group "pot" by link; card/Apple Pay, no account | Before (collection) | No | n/a | No | UK/US | Optional tips; reported withdrawal fees |
| **me&u** | Venue QR order-and-pay; split evenly, by amount or **by item** | **At the table** | Yes | **Only venues that installed it** | No app (web) | Yes | Diner platform fee $0.20–$2.90 per order (capped) |
| **Square for Restaurants / Scan to Pay** | POS: staff split by seat, item or portion; guests pay by QR | At the table | Staff-driven | **Only Square venues on Restaurants Plus/Premium** | No | Yes | Seller fees; Scan to Pay 2.2% (beta). **Scan to Pay beta can't split a bill** |
| **Tyro Pay@Table / SplitBills** | Terminal pulls the table's bill; guest pays an amount | At the table | **No**, by amount | Only Tyro venues with a supported POS | No | Yes | Venue processing fees |
| **payo** | Venue QR checkout with splitting and pay-in-four | At the table | Yes (venue) | Partner venues only | No | Yes | Venue/diner fees |
| **PayPal (friends & family)** | P2P transfers | After | No | n/a | PayPal account | Yes | Free from bank or balance; 2.6% + fixed by card |
| **PayID / Osko** (any bank) | Instant bank transfer | After | No | n/a | Own bank | Yes | Free |

Sources for every row are in section 10. "Splits by item" means the people at the table can claim specific items, not just enter amounts.

### 4.2 The map

```
                         Splits by ITEM (fair)
                                  ▲
        Tab · Splitwise Pro       │      me&u · payo · Square (staff)
        (US / paywalled)          │      (only at venues that installed them)
                                  │
                                  │          ★  [We]: by item, at the table,
                                  │              ANY venue, any bank (target)
  AFTER the bill ─────────────────┼──────────────────────── AT the table
  (chasing)                       │                            (no one fronts)
        Revolut · Up · Beem       │      Cino QuickSplit (EU/UK only,
        Splitwise free            │      equal or % split)
        Tricount · PayID          │      Tyro SplitBills (amounts)
                                  │
                         Splits by AMOUNT (even)
```

**The top-right corner is empty for any venue in Australia.** Venue tools (me&u, Square, payo) get there only inside venues that bought them. Cino gets to "at the table, any venue" but splits evenly and isn't here.

### 4.3 What each big player would have to do to copy us, and why they mostly won't

| Competitor | Their position | Why they don't do what we do |
|---|---|---|
| **Revolut, Up, Beem** | Banks/wallets: they want you to hold money with them | Their split features are retention tools for their own customers. Revolut's says outright that it isn't a payment service. They have no reason to make it work equally well for people who bank elsewhere, and in a group of six, someone always banks elsewhere |
| **Splitwise** | Global ledger, monetised by a Pro paywall | Itemising is their paid upsell; settlement happens in other apps. Not Australia-focused. Payments have never been their business |
| **Square, me&u, Tyro, payo** | Sell to venues | They can only split bills at venues that pay for them. A night out crosses three venues; we follow the group, they follow the venue. **They're better partners than competitors** (section 7) |
| **Cino** | The model closest to our end goal | Europe-only for now; equal/percentage splits; needs card issuing and licensing. If Cino comes to Australia, our edge is item-level fairness, the event context (who's actually there) and being local first. **Watch closely** |

**Honest risk:** none of these is hard to copy one feature at a time. Our edge has to be **doing the whole flow better**: receipt to claims to everyone paid, in one link, in under two minutes. It also comes from the **data** we collect along the way (section 6). Speed and focus are the moat early; data and partner integrations later.

---

## 5. What we do differently

### 5.1 Today (the App Store launch: split only, no money through us)

| What we do | Why it's better for the user | Who doesn't |
|---|---|---|
| **Snap the receipt, friends tick what they had**, including shared items ("2 of the 3 wines", "a quarter of the platter"), with surcharges shared by what each person ordered | Fair by default: no paying for someone else's steak | Revolut, Up, Beem, Tricount (amounts only); Splitwise (paywalled) |
| **Friends join from a link, no app or account to view** | One link in the group chat, as with every other wya invite | Revolut / Up (need their app to pay), Splitwise (account) |
| **The bill can't lock until it adds up**, to the cent | No "hang on, that's $12 short" | Most ledgers let totals drift |
| **It lives with the plan** (the event, who came, the chat, the photos) | We know who was actually there, so nobody's left off or added by mistake | Bill apps don't know who came |
| **Free itemising**, Australian, any bank | Nothing to pay, nothing to switch | Splitwise Pro, Revolut |

Settlement at launch: each person sees exactly what they owe and to whom, then pays by their own bank (the PayID details we show) and taps "I've paid". **This is still "after the bill".** It's the same category as Splitwise, just fairer and faster. It's a sensible first release because it gets us the data (section 8) without a payments licence. It isn't the differentiated product yet.

### 5.2 Next (with a payments partner: the actual differentiation)

**Everyone pays their own share at the table, from Apple Pay or Google Pay, and nobody fronts the bill.** `research.md` sets out the four ways to build this and recommends an order. In short:

1. **At partner venues (Square first):** each friend's share goes straight into the venue's own Square order. The venue gets paid by six cards instead of one, and their staff do nothing. Square's own Scan to Pay can't split a bill in its current beta. We'd fill that gap.
2. **Anywhere else:** one person pays the venue. Everyone else is charged their exact share on their saved Apple Pay / Google Pay card **before they leave the table**, and it goes straight to the payer. The payer is never out of pocket for more than minutes.
3. **Later, if data and a partner support it:** a Cino-style group card so nobody fronts at all. It splits evenly at the tap, then is adjusted to exact item shares.

### 5.3 What the user feels

| Moment | Today (any app) | With us |
|---|---|---|
| Bill arrives | "Can you split it?" "No, one bill per table." | One person taps "split this" and snaps the receipt |
| Working it out | Calculator, arguments, even split | Everyone ticks their items on their own phone in about 30 seconds |
| Paying | One person pays $330 | Each person pays their own exact share, by phone, at the table (5.2) |
| Next day | "Hey, you still owe me $47" | Nothing. It's done |

---

## 6. Value proposition (investor version)

**For** groups of young Australians who go out together, **who** are stuck with one bill and one person paying for everyone, **[we are]** a split-and-pay app that **makes everyone pay for exactly what they had, at the table, at any venue, from any bank.** **Unlike** Splitwise, Revolut or Up, which record a debt after one friend has paid, **we** make sure the debt never exists.

**Three things that make it distinct (not huge, but distinct):**
1. **Item-level fairness**, free, from a photo of any receipt, for people who don't share a bank.
2. **Paid at the moment**, not chased later: the organiser is never the bank.
3. **The group context**: we know the plan, who came and what was ordered. That gives us data nobody else sees (what's *inside* a group bill), and it turns venues and payment companies into partners.

**Why now (Australia, 2026):**
- **Card surcharges were banned from 1 October 2026, and interchange caps were cut** (consumer credit 0.8% → 0.3%, debit 10c → 8c). Taking a card payment is cheaper and simpler for venues, so splitting into more card payments costs them less ([RBA, Mar 2026](https://rba.gov.au/media-releases/2026/mr-26-10.html)).
- **Young people split instead of shout**, and half of all Australians want to pay only for their own order (NAB 2024, Tyro 2026).
- **Incumbents are distracted:** Beem is changing owners and strategy (Bolt Group), Square's Scan to Pay doesn't split yet, and Cino has proven the "split at the tap" model in Europe (seed round led by Balderton) but isn't in Australia.

---

## 7. How we make money, even though the problem isn't revolutionary

Harry's challenge assumes a product needs to solve a huge new problem to make money. **Payments don't work like that.** A small, frequent, unglamorous moment that a lot of money passes through can be a real business. The money comes from the volume that flows through it, not from the novelty. Uber didn't invent taxis; Afterpay didn't invent credit. Each owned a moment where money changes hands.

### 7.1 Every split bill becomes several payments

When one friend pays a $330 bill, a payments company processes **one** transaction. When six friends each pay their own share, it processes **six**, and we decide where they're processed. **That's what we offer Stripe, Square or Afterpay: transaction volume they don't get today, plus the young customers who make those transactions.**

_Illustrative_ (replace with the measured average bill and group size from the 30 days):

| Per split bill: $330, 6 people, 5 friends paying in-app | Amount |
|---|---|
| Volume through the partner | $275 (5 shares × $55) |
| Partner's processing revenue at Stripe's 1.65% + 30c or Square's 2.2% online (gross, before their costs) | ≈ $6 |
| **Our revenue** at 0.5–1% of shares, or a ~$0.30–0.50 per-share fee (see 7.2) | ≈ $1.40–2.75 |

| Split bills paid in-app per month | Volume | Partner gross | Our revenue |
|---|---|---|---|
| 10,000 (a few campuses) | $2.75M | ≈ $60k | ≈ $14–28k |
| 100,000 (city-wide) | $27.5M | ≈ $600k | ≈ $140–275k |
| 500,000 (national) | $137.5M | ≈ $3.0M | ≈ $0.7–1.4M |

For scale: Beem reports more than 3 million downloads, and Splitwise 36 million Google Play installs (`docs/PANEL_QA.md`). Installs aren't active users, so treat these as the size of the category, not a forecast.

### 7.2 Where our share comes from (each needs a partner agreement; `research.md` has the mechanics)

| Model | How it works | Precedent / evidence |
|---|---|---|
| **App fee on venue payments (Square)** | When a share is paid into a Square venue's order through our app, Square lets the app take an `app_fee_money` cut, and that's supported in Australia | Square's Payments API "Collect application fees"; Square AU's PAAF disclosure |
| **Platform pricing (Stripe Connect)** | We set the price the payer sees (for example 1.9% + 30c) and pay Stripe's 1.65% + 30c; the difference is ours. At scale, Stripe offers platforms a revenue share | Stripe Connect pricing ("you handle pricing"), Stripe AU price list |
| **Small diner fee per share** | A flat fee shown clearly, the same whatever card is used, so it isn't a surcharge | **me&u already charges Australian diners $0.20–$2.90 per order** |
| **Partner bounties and distribution deals** | Square and Afterpay want venues and young customers; we bring both | To negotiate. Ask the contacts directly (research.md §8) |
| **Group deposits (the collaborator's "before the booking")** | Businesses pay 1–2% or a flat fee per group booking | `PRODUCT_BRIEF.md` §8; untested with real merchants |
| **Data, later** | Aggregated, de-identified insight from inside group bills | `PRODUCT_BRIEF.md` §9; needs density, year 2+ |

**What we won't do** (agreeing with the existing brief): charge for a basic friend-to-friend bank pay-back (PayID is free, so a fee would push people straight to their bank app), or take a percentage cut of a restaurant's bill on top of their processor.

### 7.3 Why a payments company would want this

- **Square:** venues hate splitting because it costs staff time and extra transaction fees, and its own Scan to Pay can't split in beta. We do the splitting on the guests' phones and put every share into the venue's existing Square order, earning Square **online-rate volume (2.2%) instead of one in-person tap (1.6%)**. It also keeps venues on Square instead of moving to me&u or Tyro for pay-at-table.
- **Stripe:** a new Australian platform with high-frequency, small consumer payments, at a time Stripe is investing in Australia (Treasury launching locally, card issuing for platforms in private preview from Q4 2026). We'd be an early local use case for those products.
- **Afterpay (Block):** reaching 18–29-year-olds at the moment they spend socially, alongside Square in the same group. **Care needed:** "pay later for drinks" drew consumer-advocate criticism in 2021, and buy-now-pay-later has required a credit licence since June 2025. Offer it for bigger shares (birthday dinners, group bookings), not every round of drinks.

**The honest version of this pitch:** the revenue only exists if the **volume** does. The 30 days of data turn "_illustrative_" into "measured": average bill, group size, how often, and how many people would pay in-app.

---

## 8. What the 30 days must prove

The App Store release is split-only, with no money moving through us. Measure these (with consent, de-identified; see research.md §9 for privacy):

| Question | Metric | Healthy signal (target to beat) |
|---|---|---|
| How big are the bills? | Median and mean bill; distribution by venue type and night | Gives the revenue model its real inputs |
| How big are the groups? | People per bill; claims per person | Shares per bill = transactions we could route |
| Do people itemise? | % of bills itemised vs even; % of items shared | If almost everyone splits evenly, item-level fairness matters less |
| Is it fast? | Time from receipt photo to locked bill | Under 3 minutes median |
| Do friends join from the link? | Invited → opened → claimed, per bill | 70%+ of a group claims |
| Does it get paid back faster? | Time from lock to everyone "paid"; % fully settled in 24h and 7 days | Compare with the founders' and testers' baseline (days to weeks) |
| Would they pay in-app? | A "Pay with Apple Pay (coming soon)" button: tap rate | Demand signal for partners, with no money moved |
| Does it repeat? | Groups with a second bill within 30 days | Repeat use is the business |
| Where? | Venue (from the receipt), suburb, night | Which venues to approach with Square |

**What would change the plan:** if groups rarely itemise, lead with "paid at the table" rather than "fair". If links don't convert, fix sign-up friction before anything else. If bills are small (say under $150), payments revenue per bill is thin and the "before the booking" deposits product matters more.

---

## 9. Harry's questions, answered directly

**"Why is this new?"** Splitting isn't new. **Paying your own exact share at the table, at any venue, without a shared bank, is**, at least in Australia. Every app he named records a debt after one person has paid. Venue tools only work in venues that bought them. Cino does it at the tap but not by item, and not here.

**"What problem are you solving?"** One person ends up fronting the group's bill, then chasing friends for unfair or forgotten repayments. It's frequent (every night out), common among young people (72% of 18–29s split), and awkward enough that people give up on money they're owed (44% don't chase).

**"Who is it for?"** 18–29-year-olds in Australian cities, in groups of 4–10, starting with students on one or two campuses. We'll have 30 days of real bill data before the next conversation.

**"How do you make money?"** By turning each group bill into several payments routed through a payments partner and taking a small fee per share (Square app fees, Stripe platform pricing, or a me&u-style diner fee), plus group deposits for businesses later. It's a volume business: the novelty doesn't matter, the frequency does.

**"Why won't Revolut / Square just do it?"** Revolut serves its own account holders and calls its feature "not a payment service". Square serves the seller, one venue at a time. We serve the group across every venue and every bank. That's why Square is a more natural partner than a competitor.

---

## 10. Sources

**Australian behaviour and market**
- Tyro, [Eat Pay Love Hospitality Report 2026](https://www.tyro.com/blog/eat-pay-love-2026/) and [press release](https://www.tyro.com/about-tyro/media/the-shout-is-fading-as-aussies-hit-their-spending-limits/); figures via [Beer & Brewer](https://www.beerandbrewer.com/cost-pressures-are-changing-how-consumers-spend-at-the-bar/)
- Money.com.au survey, reported by [Yahoo Finance AU](https://au.finance.yahoo.com/news/common-bill-splitting-payment-practice-defended-as-aussies-left-with-sour-taste-023007972.html)
- NAB research, reported by [Mirage News, 2 Aug 2024](https://www.miragenews.com/aussie-shout-fades-youth-prefer-bill-splitting-1288270/)
- [PayPal Australia, 30 Jul 2024](https://newsroom.au.paypal-corp.com/Avoid_the_awkward_tax_this_World_Friendship_Day-_Aussies_uncomfortable_asking_friends_for_owed_money)
- [OpenTable AU 2026 diner trends](https://www.opentable.com.au/restaurant-solutions/2026-diner-trends/)
- RBA, [Conclusions Paper media release, 31 Mar 2026](https://rba.gov.au/media-releases/2026/mr-26-10.html); caps summary via [Vixio](https://www.vixio.com/regulatory-news/pc-unpacking-rbas-ban-card-surcharging-and-new-interchange-caps) and [Mozo](https://www.mozo.com.au/credit-cards/guides/credit-card-interchange-fees-guide)

**Competitors**
- Revolut AU: [Group Bills help](https://help.revolut.com/en-AU/help/app-features/splitting-expenses-with-group-bills/), [Group Bills terms (AU)](https://www.revolut.com/en-AU/legal/groupbills/), [one-off split](https://help.revolut.com/en-AU/help/adding-money/with-money-from-friends-or-relatives/splitting-bill/)
- Splitwise pricing and limits (third-party, conflicting): [Splital](https://splital.com/blog/splitwise-pro-vs-free), [HippoSplit](https://hipposplit.com/blog/splitwise-review/), [FairSplit](https://usefairsplit.com/blog/splitwise-pricing/); business model: [TechCrunch 2021](https://techcrunch.com/2021/04/28/splitwise-raises-20m-series-a-to-help-everyone-in-the-world-divvy-expenses); installs: `docs/PANEL_QA.md`
- Up: [Slices and Groups](https://up.com.au/features/slices/)
- Beem: [AP+ announcement](https://www.auspayplus.com.au/ap-and-bolt-group-announce-the-next-chapter-for-popular-peer-to-peer-payments-app-beem), [ChannelLife](https://channellife.com.au/story/bolt-group-buys-beem-app-from-australian-payments-plus), [beem.ai](https://beem.ai/)
- Cino: [QuickSplit](https://www.getcino.com/quicksplit), [how it works](https://www.getcino.com/post/how-to-use-cino-a-step-by-step-guide), [Tech.eu](https://tech.eu/2024/10/31/cino-makes-bill-splitting-drama-a-thing-of-the-past/), [Balderton: €3.5M seed](https://www.balderton.com/news/cino-raises-e3-5m-to-revolutionise-shared-payments-with-the-first-virtual-card-that-splits-and-pays-group-bills-instantly/)
- Collctiv: [vs collection pot](https://www.collctiv.com/lp/collctiv-vs-collection-pot-why-choose-collctiv-over-collection-pot), [Trustpilot](https://www.trustpilot.com/review/collctiv.com?page=3)
- me&u: [Pay](https://meandu.com/serve/pay), [platform fee](https://help.meandu.com/hc/en-us/articles/17561701058703-Understanding-the-me-u-platform-fee), [AU terms](https://www.meandu.com/us/legal/meandu-terms-conditions-au)
- Square AU: [split a payment and check](https://squareup.com/help/au/en/article/8165-split-a-payment-and-check-with-square-for-restaurants), [Scan to Pay (beta)](https://squareup.com/help/au/en/article/7949-pre-authorization-for-bar-tabs), [AU product updates](https://community.squareup.com/t5/Product-Updates/Your-guide-to-what-s-new-from-Square-updates-for-Australian/m-p/822970)
- Tyro: [Pay@Table docs](https://docs.integrated-eftpos.tyro.com/integrated-eftpos/paytable/introduction), [hospitality](https://www.tyro.com/industries/hospitality)
- payo: [Technology Decisions](https://technologydecisions.com.au/content/it-management/news/payo-launches-qr-code-payments-for-hospitality-1619700581)
- Tab / Tricount / Settle Up / Splid (roundups, partly promotional): [Finder UK](https://www.finder.com/uk/bill-splitting-apps), [Money magazine AU](https://www.moneymag.com.au/best-bills-splitting-apps)
- PayPal AU: [consumer fees](https://www.paypal.com/au/webapps/mpp/paypal-fees)
- Afterpay in hospitality: [SmartCompany](https://www.smartcompany.com.au/finance/economy/afterpay-square-pos-integration-bnpl-buy-now-pay-later/), [The New Daily, 2021](https://thenewdaily.com.au/finance/finance-news/2021/11/09/afterpay-pubs-alcohol/)
- Uber [Split Fare](https://www.uber.com/en-CA/ride/how-uber-works/split-fare) and Airbnb split payments via Tilt ([VentureBeat](https://venturebeat.com/business/airbnb-now-lets-groups-of-guests-split-the-cost-of-their-stay)): precedents for splitting at the time of purchase when the platform is the merchant

**Revenue mechanics:** see `research.md` §10 (Square app fees, Stripe pricing and Connect).
