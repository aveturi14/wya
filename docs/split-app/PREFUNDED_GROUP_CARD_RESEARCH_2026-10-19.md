# WhereYouAt: prefunded group pots and spending cards

Research date: 19 October 2026. Market: Australia. Currency: AUD.

## Decision in one paragraph

The proposed flow is technically plausible using Australian payments partners: friends contribute, a provider holds the funds under an approved arrangement, and a nominated organiser spends through an issued card. The unresolved issue is whether a provider will approve **multiple contributors retaining defined rights over funds while one individual is authorised to spend**. Public card-issuing APIs do not establish that approval. Proceed to partner qualification and customer validation; do not commit to a public launch or describe the product as guaranteed, insured, escrow, or trust-free before the contractual structure is settled.

This is a research and product-design recommendation, not a provider offer or legal opinion. No provider has been contacted. Published capabilities are distinguished below from unconfirmed programme eligibility. No production payments or live deployment were tested.

## 1. The exact product

Eight friends want to book karting at $40 each. The organiser creates a $320 event pot, specifies a deadline and proposed purchase, and sends a link. Each participant sees the activity, contribution, service fee, nominated spender, cancellation rules and what their approval permits. Contributions are matched to individual participants. Once the money is genuinely available, a controlled card becomes spendable. The organiser books with the venue using its ordinary checkout. The group sees payment status and booking evidence. Unspent funds and later merchant refunds are allocated back according to agreed rules.

The venue does not need to integrate with wya. It receives an ordinary card payment. This removes merchant acquisition as a prerequisite for usefulness, although it also removes any automatic right to a venue commission or discount.

The product promise should be: **collect together, spend for the agreed plan, and track what happens to everyone's contribution**. A group card solves collection and purchasing coordination. It does not itself reserve inventory, guarantee attendance, or prove that the correct tickets were bought.

## 2. Ownership must be designed before the payment screens

There are three materially different arrangements:

| Arrangement | Meaning | Fit with the intended promise |
|---|---|---|
| Organiser-owned wallet | Friends transfer money to the organiser, who owns the resulting balance. | Simplifies the story operationally but does not deliver independent contributor control merely because wya displays the balance. |
| Contributor entitlements with delegated spending | A provider-approved structure records each person's entitlement and the organiser's limited spending authority. | Closest to the intended product; requires explicit contractual and operational support. |
| wya buys/resells the activity | wya contracts as purchaser or seller and uses its own payment arrangements. | Changes the business into a purchasing/reselling service with additional obligations; not achieved by calling wya “the shop.” |

Recommendation: seek approval for the second arrangement. Ask who owes each participant a refund, who can revoke authority, and what happens if either wya or its provider fails. A subwallet in a database is not evidence of legal segregation. Nor does placing funds at a bank automatically make each contributor a protected bank depositor.

A critical example: Airwallex documents Australian consumer debit/prepaid programmes subject to approval, but its standard consumer model associates wallet ownership with the onboarded individual. That is evidence of relevant infrastructure, not proof of a multi-contributor group pot. [Airwallex programme definitions](https://www.airwallex.com/docs/issuing/supported-card-programs)

## 3. Proposed end-to-end operation

1. **Create the plan.** Record amount, deadline, participants, spender, intended venue and cancellation policy. Make clear that collecting money does not reserve availability.
2. **Identify the necessary people.** Complete the provider's required identity checks and consent before accepting or releasing funds. Do not promise anonymous contributions or assume only the organiser needs checking.
3. **Collect and match money.** Use an approved bank-payment route initially. Track each contribution independently, including duplicate, excess, unmatched and failed payments.
4. **Declare the pot ready.** Provider-confirmed available funds, approved participants and accepted spending rules are required. A promise, bank screenshot or authorised payment agreement alone is insufficient.
5. **Enable the card.** Give one verified organiser a personalised card and constrained spending authority. Apply the approved amount, time, geography and merchant/category controls.
6. **Provision and purchase.** Add the eligible card to Apple Wallet, or use provider-hosted card details at an online checkout. The venue must accept the underlying card product; online Apple Pay also requires the relevant checkout support.
7. **Distinguish payment from booking.** Show an authorisation as pending, not a completed booking. Attach the actual booking confirmation and receipt to the event.
8. **Close and reconcile.** Resolve card holds and posted transactions, return eligible unused money and retain a route for subsequent merchant refunds and disputes.

Suggested lifecycle: draft → collecting → funded but unavailable → ready → payment pending → spent → closing → closed. Cancellation, contribution failure, disputes and merchant refunds are explicit branches, not simple deletion of an event.

## 4. Partners worth qualifying

| Provider | Public evidence | Specific unresolved question |
|---|---|---|
| **Airwallex** | Australian consumer card programmes and personalised consumer-card APIs. | Can its approved structure preserve several contributors' rights while one cardholder spends? Are third-party contributions accepted for this purpose? |
| **Kobble / Yondr Money** | Advertises consumer card issuing, Apple/Google wallet provisioning, bank-payment components and configurable controls. | Does it approve this exact consumer group-pot programme, and what legal structure and complete pricing apply? |
| **Vault Payment Solutions** | Australian reloadable prepaid Mastercard documentation and direct-to-wallet capability. | Can a custom programme support friends contributing, participant-level refunds and spending rules, rather than only its advertised reward/disbursement uses? |
| **Zepto** | Stored-value accounts and bank-payment movement. | Can its approved custody/collection arrangement feed the chosen card issuer with acceptable timing and ownership treatment? |
| **Zai** | Stored-value accounts and platform payment tools. | Will compliance approve this P2P-like flow, and how would it connect to an issuing partner? |

Airwallex's consumer-card documentation supports individual cardholders and configurable transaction limits. It does not constitute approval of our use case. [Consumer-card documentation](https://www.airwallex.com/docs/banking-as-a-service/cards/create-cards/create-consumer-cards)

Kobble advertises Mastercard cards, push/web provisioning, 3DS and authorisation controls. Its pricing page advertises a Launch tier and usage-based charging, but does not provide the numerical unit prices needed for our economics. Obtain a complete written quote; marketing claims about launch speed are not our delivery schedule. Its licence claims also require independent scope verification. [Cards](https://www.kobble.net/platform/cards) · [Pricing](https://www.kobble.net/pricing)

Vault's October 2026 PDS describes a reloadable Mastercard issued through its arrangement with Flexewallet, segregated funds held on trust for card customers, and no Financial Claims Scheme cover for card balances. These protections must not be assumed to extend identically to every group contributor. Its stated funding/activation timing needs clarification for an instant-spend experience. Published cardholder fees are not a wholesale programme quote. [Current PDS](https://www.vaultps.com.au/reloadableol_pds/) · [Direct to wallet](https://www.vaultps.com.au/direct-to-wallet/)

Zepto is a possible collection/stored-value component, not an issuing solution established by this research. Combining providers introduces a second balance, settlement timing and reconciliation responsibilities. Prefer a single approved programme if commercially viable. [Zepto Stored Value](https://zepto.com.au/solutions/stored-value)

Zai explicitly describes P2P platforms as requiring additional due diligence, with registration/licensing evidence or further compliance assessment. Its availability therefore cannot be inferred from a sandbox account. [Zai P2P policy](https://helpdesk.hellozai.com/support/solutions/articles/51000513076-peer-to-peer-p2p-payments) · [Stored-value documentation](https://developer.hellozai.com/docs/stored-value-accounts)

Marqeta and Cuscal are secondary infrastructure leads, especially if a tailored programme requires separate processing and sponsorship. Their presence does not establish startup pricing or acceptance of this model. [Marqeta Australia](https://www.marqeta.com/blog/marqeta-australia) · [Cuscal issuing](https://www.cuscal.com/payments-solutions/issuing-solutions/)

## 5. Apple Pay is the spending interface, not the account

Money resides in the approved funding arrangement. The issuer creates the card, and wallet provisioning creates the device payment credential. Apple Pay does not by itself hold the group's money or create contributor refund rights.

Two separate integrations are often confused: accepting someone's existing Apple Pay card as a contribution, and issuing a new card that they can add to Apple Wallet. Supporting one does not grant the other.

Airwallex distinguishes a lighter manual wallet-addition route from full branded in-app provisioning. It publishes a roughly three-to-four-month estimate for its full Apple Pay programme, with agreements and integration requirements outside North America. This is a provider estimate for that programme, not a forecast for wya or every issuer. A less branded approved route could be an appropriate pilot compromise. [Digital-wallet programmes](https://www.airwallex.com/docs/issuing/card-branding/whitelabel-digital-wallets)

Recommendation: test eligible online virtual-card spending first if wallet approval is the slowest dependency, while preserving the same ownership and refund design. Do not share card credentials across eight people's devices. Additional spenders require a provider-supported authorised-cardholder model.

## 6. Funding choices

**Bank funding is the first route to price and test.** PayTo supports one-off agreements authorised in participating customers' banking apps. Access requires a sponsoring provider and commercial terms. Approval of the agreement is separate from a successful payment, and security checks may delay funds. A PayID/virtual-account alternative requires reliable attribution and a procedure for unmatched transfers. Neither route should be called universally instant, free or irreversible. [Australian Payments Plus PayTo FAQ](https://www.auspayplus.com.au/solutions/payto-faqs)

**Card funding should be a separately approved later option.** It may improve conversion but introduces acquisition cost and chargeback exposure. A successful card contribution can be disputed after the organiser spends it. An ordinary retail checkout contract must not be assumed to permit wallet loading or P2P transfers. [Stripe restricted-business guidance](https://stripe.com/au/legal/restricted-businesses)

Do not spend incoming direct debits just because they have been initiated. With separate collection and issuing providers, determine whether customer money must move before card authorisation or whether the company supplies settlement liquidity. Company capital, customer entitlements and operating revenue must remain distinguishable.

## 7. Failure cases that define the real product

| Situation | Required behaviour |
|---|---|
| Seven of eight pay | At deadline, return eligible funds or seek explicit revised consent. Never silently increase others' shares. |
| Venue sells out or changes price | Reconfirm a different purchase or refund; the pot did not reserve the venue. |
| Organiser cancels during a card payment | Stop new spending, account for pending authorisations and return only genuinely available money. |
| Venue cancels after being paid | Seek merchant refund; track it back through the card programme and then to contributors. Do not promise immediate reimbursement from an empty pot. |
| Merchant refunds only part | Allocate using the agreed purchase/refund rules; show the calculation. |
| Organiser buys the wrong thing | Controls may block some transactions; transaction data does not prove the item, date or beneficiaries. Define dispute and accountability processes. |
| Contribution is disputed after spending | Allocate liability under the provider contract and fund required reserves from the appropriate party. |
| Card receives late clearing or an overcapture | Reconcile the actual liability and escalate. Freezing a card does not erase existing obligations. |
| Refund arrives after card closure | Preserve the provider refund route and contributor allocation records. |
| Provider outage or missed notification | Pause unsafe actions, reconcile from authoritative records and avoid duplicate debits/refunds. |

Card processing includes reversals, clearing and settlement beyond the initial approval. Treat authorisation controls as a risk control, not an absolute guarantee that no later liability can arise. [Marqeta transaction matching](https://www.marqeta.com/platform/transaction-matching) · [Airwallex transaction lifecycle](https://www.airwallex.com/docs/issuing/transactions/transaction-lifecycle)

The trust claim should be precise: we can reduce the organiser's control over cash and provide visibility, but a spender with a general-purpose card still has discretion. Merchant-category restrictions cannot verify eight karting tickets for a particular date. Tight merchant restrictions also require testing because venue descriptions and acquiring identities vary.

## 8. Regulatory work needed for a live pilot

An Australian payments lawyer and the intended provider should classify the actual money flow and document wya's role: issuer, distributor, representative, outsourced service provider or another applicable arrangement. The answer depends on responsibilities, not branding or a statement that the group is “closed.”

Non-cash payment facilities have an existing financial-services framework. ASIC's 2026 instrument extends certain relief, but applicability must be assessed rather than assumed from a small pot balance. Treasury's reform page describes draft reforms; proposals must be separated from commenced requirements at contracting. [ASIC instrument update](https://www.asic.gov.au/about-asic/news-centre/news-items/asic-remakes-non-cash-payment-facilities-instrument) · [Treasury reforms](https://treasury.gov.au/policy-topics/banking-and-finance/payments-licensing-reforms)

The written responsibility matrix should cover identity checks, sanctions and transaction monitoring, suspicious activity handling, disclosures, complaint ownership, unauthorised payments, insolvency treatment, privacy and record retention. Determine who performs any regulated designated services rather than assuming a provider's licence automatically covers wya. [AUSTRAC regulated-services guidance](https://www.austrac.gov.au/new-austrac/check-if-you-may-be-regulated)

A separate payments brand/entity may make sense commercially, but does not settle these responsibilities. A real-money pilot is still a real financial service; calling it a beta does not remove obligations.

## 9. Revenue and economic test

The clearest launch revenue hypothesis is a disclosed group-service fee. For example, test whether an eight-person group will pay **$4 total** for collection tracking, controlled spending and refund handling. That is an experimental price, not a recommendation backed by measured willingness to pay. The booking pot must still contain its full $320; show the $324 total if the fee is additional.

Illustrative sensitivity, excluding tax effects and using invented cost scenarios rather than supplier quotes:

| Service revenue per completed pot | Total variable cost | Contribution before fixed costs |
|---|---|---|
| $4 | $1 | $3 |
| $4 | $3 | $1 |
| $4 | $5 | -$1 |

Variable cost must include contributions, verification amortised over repeat use, issuing, wallet tokens, spending, refunds, support and expected losses. At a hypothetical $3,000 monthly fixed programme cost, $3 contribution needs 1,000 completed paid pots just to cover that cost; $1 needs 3,000. Salaries, acquisition and other overheads would require more. Failed/cancelled pots also incur costs and must enter the model.

Ask providers for setup, minimum monthly commitments, per-user/card/wallet fees, transaction fees, refunds, disputes, reserves, compliance charges and programme-exit costs. A cheap payment rail does not establish a cheap full programme.

Interchange may be negotiated revenue, but it belongs initially within the issuing economics and is not the merchant's entire processing fee. Australian debit/prepaid interchange is regulated. Model zero interchange revenue until a written revenue-share offer exists. [RBA debit-card framework](https://www.rba.gov.au/payments-and-infrastructure/debit-cards/regulatory-framework.html)

As of this research date, ACCC guidance says card surcharges on the named major networks ended on 1 October 2026. A genuine service fee unrelated to payment method is different; it cannot simply relabel a card surcharge. Confirm treatment for the approved funding product and display the total price. [ACCC guidance](https://www.accc.gov.au/business/pricing/card-surcharges)

Subscriptions could follow demonstrated repeat usage. Merchant commissions require merchant agreements. Selling analytics is not a credible base-case launch revenue stream: initially the dataset is small, and card transactions alone do not reveal receipt items or prove activity attendance. Start with internal funnel and reliability analytics, not commercial sale of individual group behaviour.

## 10. What wya already contributes, and what must be built

The prior repository review identified events, invitations/circles, receipt scanning, item allocation, pledges and a simulated wallet. These supply a useful coordination experience, but are not evidence of live payments readiness.

Relevant source locations: `lib/pledges.ts`; `components/InvitePeople.tsx`; `lib/wallet.ts`; `components/wallet/TopUpPanel.tsx`; `supabase/migrations/20261019000100_wallet.sql`; `supabase/migrations/20261019000300_wallet_cashout.sql`; `supabase/functions/scan-receipt/index.ts`. This was a source review, not confirmation of production deployment or customer use.

New work includes partner onboarding, provider-linked customer identities, contribution records, an auditable money ledger, provider event processing, card management, authorisation holds, refunds, daily reconciliation, support tooling and operational controls. A displayed wallet balance must not become the sole authority for spending.

Engineering requirements include duplicate-safe processing, verification of provider notifications, access controls, immutable monetary history, recovery from delayed/out-of-order events, and reconciliation to external statements. Keep sensitive card details in provider-hosted components where possible. These are proposed requirements, not implemented features.

Reuse wya's event and group experience while isolating the money service behind a clear interface. That allows an independent brand later without duplicating the core event experience now.

## 11. Differentiation and validation

The opportunity is the complete event workflow: friends commit to a plan, fund it, authorise a purchase and see the outcome. The card itself is supplied infrastructure and will not be a durable differentiator.

Cino already markets shared-payment experiences and QuickSplit, so a broad claim that nobody enables group card payments is unsound. Collection tools such as Collctiv also address part of the pain. Our prefunded, event-linked workflow is a positioning hypothesis to test, not proof of novelty or demand. [Cino](https://www.getcino.com/) · [QuickSplit](https://www.getcino.com/quicksplit) · [Collctiv](https://www.collctiv.com/)

The strongest initial use case is planned, fixed-price group bookings where one checkout is required. Restaurants with changing totals and immediate payment pressure are harder. Test with real organisers whether the benefit outweighs onboarding, bank-payment steps and a fee compared with ordinary transfers.

Recommended validation: interview 15–20 recent organisers using their actual last booking; then observe a non-money prototype with several groups. Measure abandoned invitations, contribution completion, organiser time, repeat intent and willingness to pay. These are proposed research sample sizes, not existing evidence. Simulated AI panels do not substitute for customer validation.

## 12. Sequence and investment gates

**Gate 1 — approve the structure.** Send the companion brief to issuing leads once outreach is authorised. Obtain a written money-flow assessment, contributor-rights design and programme eligibility. Stop if the only available structure contradicts the product promise.

**Gate 2 — prove economics and demand.** Obtain full costs and test the proposed fee. Include cancellations, inactive users and support. Do not proceed on interchange assumptions or total transaction volume alone.

**Gate 3 — prove a sandbox lifecycle.** Demonstrate collection, readiness, spending, cancellation races, partial refunds, late refunds, disputes and statement reconciliation. Define acceptance tests with the partner. A happy-path card payment is insufficient.

**Gate 4 — approved limited live pilot.** Start with Australian adults, AUD, low limits, bank funding, one nominated spender, short-lived event pots and fixed-price domestic activities. Exact limits require partner agreement. Provide operational support and review every discrepancy.

**Gate 5 — expand only after evidence.** Add more spending contexts, additional authorised spenders, card funding and merchant partnerships where observed demand justifies complexity. A public launch requires reliable completion/refund performance, acceptable losses and positive contribution economics.

No defensible total launch budget or date can be established from public APIs. Programme approval, legal structuring, wallet provisioning and supplier minimums are currently the critical unknowns. The next investment is a precise partner decision and measured customer test, not a full general-purpose wallet build.
