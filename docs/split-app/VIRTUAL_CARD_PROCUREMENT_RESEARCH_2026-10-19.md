# How wya can procure and issue an organiser spending card

Research date: 19 October 2026. Australia; AUD consumer group activities. This supplements the broader group-pot report and focuses on issuing. It records public evidence and a proposed implementation, not an approved programme or a tested integration. No provider was contacted and no card was issued.

## 1. What we are procuring

We need an **approved consumer card-issuing programme** through which our software can request a virtual payment card for a verified organiser. The issuer supplies the real payment credentials and network connectivity. Wya supplies the event, participant consent, allocation rules and customer experience. The organiser uses the issued card to purchase the activity through the venue's existing checkout.

The card is a credential for spending against an approved funding balance. Creating the card does not create money, and setting a $320 limit does not deposit $320. Apple Wallet provisioning is an additional capability that makes an eligible card usable through the device wallet.

A practical procurement route bundles an issuer/sponsor, processor and programme services. A more customised route contracts separately for those components. Cuscal explicitly offers scheme sponsorship, BIN management, settlement/dispute services and support for mobile-wallet registration; this establishes a possible infrastructure route, not an offer for our startup. [Cuscal card services](https://www.cuscal.com/payments/issuing/card-services/)

We should seek an integrated provider first. Direct scheme membership and a bespoke multi-party processing stack would add work before we have validated the product.

## 2. Provider qualification order

### Airwallex: strongest public documentation for a technical reference

Airwallex explicitly lists Australian consumer debit and prepaid programmes, subject to platform approval. Consumer cards are personalised and assigned to individual cardholders. Its standard ownership description ties wallet funds to the onboarded individual, so we cannot infer that a card for the organiser preserves other contributors' entitlements. That structure requires explicit approval. [Supported programmes](https://www.airwallex.com/docs/issuing/supported-card-programs)

The public documentation provides a concrete path for creating cardholders, creating cards, displaying details, imposing controls, receiving transaction events and testing. This makes it useful for estimating engineering work. It does not make Airwallex the selected supplier before eligibility and pricing are confirmed.

### Kobble / Yondr: parallel Australian programme inquiry

Kobble advertises prepaid/debit/virtual Mastercard issuing, real-time controls and consumer programmes. Its wallet page describes native and web-based provisioning, including a hosted widget flow. These could reduce the mobile integration burden. Public documentation access was unsuccessful during this review, so the API and sandbox capabilities were not independently exercised. [Card offering](https://www.kobble.net/platform/cards) · [Wallet provisioning](https://kobble.net/platform/wallets)

Its Launch tier advertises up to 1,000 active wallets, prepaid/virtual cards and bank-payment capabilities. The page makes usage-pricing and no-minimum claims but supplies no numerical unit-price schedule. Request a complete written quote and determine whether a custom group programme qualifies for that tier. [Pricing](https://www.kobble.net/pricing)

### Vault: programme-led alternative

Vault advertises digital card delivery through a portal or enterprise API. Its current October 2026 PDS describes an Australian reloadable prepaid Mastercard arrangement. Request a demonstration of third-party contribution funding, organiser identification, controlled spending and participant refunds; its public reward-card material alone does not prove that combination. [Enterprise offering](https://www.vaultps.com.au/) · [Current PDS](https://www.vaultps.com.au/reloadableol_pds/)

Recommendation: approach Airwallex and Kobble in parallel, with Vault as another programme option. Compare consumer eligibility and fund ownership before comparing card artwork or API convenience. A normal corporate-expense account is not evidence of permission to distribute cards to unrelated consumers for private leisure spending.

## 3. The two approvals and one runtime action

**Programme approval:** the provider assesses wya, the money flow, consumer use, risk allocation, permitted funding, terms, controls, operating processes and commercial agreement. Request the exact documents and appointments required. A developer account is not programme approval.

**Cardholder approval:** the organiser is enrolled and verified under that programme. Airwallex's documented individual workflow includes identity information and consent for verification; additional documents may be required. Contributors may separately require onboarding under the funding arrangement. [Create cardholders](https://www.airwallex.com/docs/issuing/get-started/create-cardholders)

**Runtime issuance:** after the preceding approvals, wya sends a server-side request for a virtual card associated with the organiser and approved funding account. The issuer returns an identifier/status and provides a supported way to access the card. This can be an automated action for each eligible event; it is not a new commercial application every time.

## 4. Worked issuing sequence: eight people, $320 booking

The following is our proposed workflow, conditional on approval, rather than a claim that a provider already supports every step together.

| Step | Wya action | Provider/network action |
|---|---|---|
| Establish event | Record contributors, budget, spender, deadline and agreed rules. | Onboard the necessary customers and establish approved funding arrangements. |
| Confirm funds | Match the eight contributions and show pending versus available amounts. | Confirm received, spendable money and any restrictions. |
| Create card | Request a personalised virtual card and associate its ID with this event. | Generate the real card credentials under the approved programme. |
| Enable spending | Set the authorised budget and activity window; release access only when eligible. | Enforce configured issuer controls and funding checks. |
| Deliver card | Show a secure card-details view or supported wallet-addition journey. | Supply sensitive details securely or provision a device token. |
| Purchase | Organiser enters card details or selects Apple Pay at the venue checkout. | Merchant sends the transaction through its acquiring provider and card network for issuer approval. |
| Reconcile | Show pending payment, completed payment and booking evidence separately. | Send authorisation, clearing, reversal and refund events. |
| Finish | Disable new spend and distribute eligible unused/refunded funds. | Preserve handling of outstanding transactions and later merchant credits. |

Airwallex documents a consumer card creation operation with virtual form, personalisation, cardholder association and transaction controls. Its examples span jurisdictions; our eventual request must use the specifically approved Australian programme rather than copy a foreign example verbatim. [Create consumer cards](https://www.airwallex.com/docs/issuing/get-started/create-cards/create-consumer-cards)

The organiser is paying the merchant, not making an unrestricted transfer to another person's card. Cash withdrawal, bank cashout and money-transfer spending should be outside this proposed pilot scope.

## 5. Where the card gets its money

**Preferred pilot design:** the approved provider funding arrangement holds confirmed money, and the event's card can access only the amount authorised for that event. The exact legal/account structure must be supported by the provider. We should not casually pool customer money in wya's normal operating account.

Airwallex describes wallet-funded issuing and a separate Platform Liquidity Program, which uses prefunded platform liquidity with associated customer accounting. The latter is not free credit or proof that our consumer group model is accepted. Ask which arrangement is available for the Australian programme and who must supply settlement liquidity. [Issuing funding sources](https://www.airwallex.com/docs/issuing/get-started/fund-your-issuing-balance)

Design invariant: no event may spend another event's entitlement. A card limit alone is not a complete ledger. If two cards or two pending transactions can access the same pot, the system must reserve funds consistently. Refunding a contribution must also reduce what remains available for spending.

If collection and issuing use separate suppliers, document the transfer between them, settlement delay, failed-transfer handling, funding ownership and reconciliation. Money visible at the collection supplier is not necessarily available at the issuing supplier.

## 6. Online card delivery versus Apple Pay

**Online first:** the organiser opens a secure card-details panel and uses its number, expiry and security code at the venue's ordinary card checkout. The venue does not need Apple Pay for this route. Airwallex offers hosted secure iframes for card display using short-lived access tokens. This avoids building a system that retrieves and stores raw credentials merely to display them. Wya still needs strong organiser authentication and access control. [Secure card display](https://www.airwallex.com/docs/issuing/manage-cards/retrieve-sensitive-card-details/secure-iframes)

Online purchases may require a verification challenge. Airwallex's issuing documentation describes 3DS and delivery of verification codes to the cardholder's registered contact details. Those details must belong to the actual organiser who is purchasing. [3DS](https://www.airwallex.com/docs/issuing/card-controls/3d-secure-authentication)

**Apple Pay:** ask for the exact Australian card programme's wallet eligibility. Airwallex documents a lighter manual-addition route and a full branded in-app route. The latter includes agreements, SDK integration and certification, with a published estimate of three to four months. This is a programme-specific estimate, not a guaranteed wya launch date. [Digital wallets](https://www.airwallex.com/docs/issuing/card-branding/whitelabel-digital-wallets)

Recommendation: choose a wallet-capable programme from the start, but allow the first approved purchase test to use card details if branded wallet provisioning is still pending. For in-person spending without a physical card, a supported device-wallet route is necessary. A visual card in wya alone cannot tap a terminal.

## 7. Event-specific cards versus a reusable organiser card

| Design | Advantages | Costs and complexity |
|---|---|---|
| One card per event | Clear transaction attribution; easy to disable one event; fewer decisions about which pot pays. | Repeated card issuance, possible repeated wallet setup and programme limits. |
| One reusable organiser card | Easier repeat spending and fewer cards to provision. | Must select and securely bind the active pot; simultaneous events and late transactions are harder. |

For an online pilot, prefer an event-specific card. For frequent Apple Pay use, evaluate a reusable card after proving allocation controls. The recommendation depends on actual issuer pricing and card/token limits.

An event-specific card need not be strictly single-use. A checkout may involve a verification, deposit and later balance payment. Decide the allowed transaction pattern after testing representative merchants, rather than assuming one successful authorisation always equals one completed booking.

## 8. Spending controls and technical acceptance criteria

Proposed controls are AUD-only, approved domestic use, an aggregate event budget, a short spending window, blocked cash access and appropriate merchant restrictions. Airwallex documents currency, category, time, amount and transaction-usage controls. Its transaction-count setting distinguishes single and multiple use and cannot later be changed. Confirm exact support with the chosen issuer. [Authorisation controls](https://www.airwallex.com/docs/issuing/card-controls/authorization-controls)

A category restriction is not a guarantee of the exact venue or tickets. If we need a participant vote, collect it before enabling spend. Do not expect eight friends to approve while the terminal is waiting: Airwallex's documented remote-authorisation response window is 2.5 seconds, after which a configured default applies. For a pilot, seek a decline-on-timeout policy where supported. [Remote-authorisation exceptions](https://www.airwallex.com/docs/issuing/card-controls/remote-authorization/handle-exceptions)

Required tests should include:

- Repeated card-creation requests do not accidentally create duplicate usable cards.
- Pending identity verification cannot produce a usable spending path.
- A $320 event cannot approve normal spending beyond its available allocation.
- Concurrent spending and refunds cannot allocate the same money twice.
- Cancellation stops new spend while preserving existing transaction obligations.
- Failed authentication, declined purchases, reversals and retries are understandable to the organiser.
- Partial and late merchant refunds remain linked to contributors after event closure.
- Missed or duplicate provider notifications can be reconciled against provider records.
- A second organiser cannot view or use another organiser's card.

Airwallex's checklist includes account configuration, simulated issuing transactions and notification testing; even sandbox cardholder readiness may require manual approval. This research did not create a sandbox account or run those tests. [Integration checklist](https://www.airwallex.com/docs/issuing/test-and-go-live/integration-checklist)

## 9. Procurement package and cost questions

Provide suppliers with the actual consumer flow, an ownership diagram, expected user countries/ages, funding methods, balance limits, expected holding time, merchant categories and proposed refund process. Label pilot volumes as forecasts, not existing traction. Include the previously prepared group-card partner brief.

Request separately priced offers for:

1. A small approved pilot with online virtual cards and provider branding.
2. The same programme with manual or hosted Apple Wallet provisioning.
3. Full wya-branded in-app Apple Pay provisioning.

For each, request setup and minimum fees, KYC, issued/active/inactive cards, wallet tokens, authorisations and declines, settled purchases, refunds, disputes, reserves, certification, support and exit costs. Quote several volumes so we can see where minimum fees dominate. Customer money that must be prefunded is separate from supplier fees and company loss reserves.

No reliable numerical total can be quoted from the public materials reviewed. Do not import corporate-account pricing or foreign issuing prices into this consumer programme budget.

## 10. Decision and next milestone

We do not need to invent a payment network. We need a supplier to approve and supply the correct programme, then implement its cardholder, issuance, funding, display, control and reconciliation interfaces.

The next milestone is a written answer from at least one provider confirming: Australian consumers; several contributors funding an event; one authorised spender; the agreed ownership/refund rights; an available virtual card; permitted funding; and the real cost. Only then is a live proof appropriate: fund a low-value approved test, issue the card, make a real merchant purchase, reconcile it and complete a refund.

A sandbox can prove our integration before production approval. It cannot prove real merchant acceptance, Apple Wallet eligibility, legal ownership or production economics. No application code has been changed as part of this research.
