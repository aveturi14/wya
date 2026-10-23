# Judging-panel Q&A: problem evidence, architecture and scalability

Written 2026-10-18. Answers use only what is in the repo, the sources below, and your stated first-hand experience. **Where a number is yours to supply it says [fill in]. Do not say a number you can't show.** Difficulty: 🔴 hard, 🟡 medium, 🟢 easy.

## Key statistics: Beem and Splitwise

| Fact | Source | Caveat |
|---|---|---|
| Beem has "more than 3 million downloads" and "millions of registered users"; launched 2018; pay, request, transfer and split. AP+ cites a 4.9 average app-store rating | [ChannelLife, 10 Apr 2026](https://channellife.com.au/story/bolt-group-buys-beem-app-from-australian-payments-plus) | Downloads, not active users; no time period; rating is AP+'s own figure |
| AP+ agreed to sell Beem to Bolt Group; Bolt wants to make it "a true everyday money app" (payments, accounts, multi-currency, investing); transition due to finish end of June 2026; no terms disclosed | same | Deal status may have changed since |
| Beem uses Visa/Mastercard/Eftpos debit rails, not Osko, and works from phone contacts without needing a PayID | [American Banker, 2019](https://americanbanker.com/payments/news/australias-mobile-wallet-beem-it-eschews-new-fast-payments-platform-in-favor-of-debit-rails) | Dated; may have changed |
| Splitwise: Apple's listing says "millions of people" use it; 36 million Google Play installs per AppBrain | [App Store](https://apps.apple.com/us/app/splitwise/id458023433), [AppBrain](https://www.appbrain.com/app/splitwise/com.Splitwise.SplitwiseMobile) | Installs ≠ active users; third-party estimates range widely; no official count found |
| Splitwise: US$20M Series A, April 2021 (Insight Partners) | [Preqin](https://www.preqin.com/data/profile/asset/splitwise-inc-/435503) | Paid database |
| Splitwise free tier reportedly capped at about 3–4 new expenses a day with a short cooldown; Pro about US$5 a month or $40 a year; receipt scanning and itemisation reported as Pro features, with users reporting it often misses items | [Yellow Slice](https://yellowslice.in/bed/splitwise-app-review-ux-ui-improvements/), [Kimola](https://kimola.com/reports/splitwise-feedback-analysis-unlock-user-sentiments-google-play-154450) | Blog and review analyses, not Splitwise; exact limits unpublished and may have changed |
| Splitwise users settle debts in other apps (PayPal, Venmo, Google Pay) | same reviews | Third-party |
| 50% of Australians feel awkward asking friends to repay them; 44% don't chase; 46% pay shared costs knowing they won't be repaid in full; 22% avoid activities because they won't be reimbursed | [PayPal Australia, 30 Jul 2024](https://newsroom.au.paypal-corp.com/Avoid_the_awkward_tax_this_World_Friendship_Day-_Aussies_uncomfortable_asking_friends_for_owed_money) | Commissioned by a payments company; sample size not stated |

**What these numbers prove, and don't:** the category is large and established (millions of installs, a venture round, a bank-backed app that just changed hands), and people already pay or tolerate paywalls for it. They do **not** prove wya's way works better, and they say nothing about market share. Never state a Beem-versus-Splitwise share.

## Your first-hand evidence (use it, keep it precise)
- **Three birthday events in three weeks**, each with a shared bill.
- **Two of you paid the large bill and are still waiting to be paid back.**
- Fill in: [amount each is owed], [days since the event], [how many people still owe], [which tool was tried, if any].
- This is your strongest honest line: *"We're not citing this problem. We're living it right now."* It is a small sample, so say so, then point to the PayPal Australia survey as the wider picture.

---

## Part A: Problem and validation

**A1 🟢 What evidence is there that this is a problem?**
Two layers. First-hand: three birthday events in three weeks, two of us paid the large bills and are still waiting. Wider: PayPal Australia's 2024 survey found half of Australians feel awkward asking friends to repay, and 44% don't chase at all. The sample sizes behind both are limited, and I'll say so.

**A2 🔴 That's three events. Why should I believe it generalises?**
It doesn't prove it on its own, and I won't claim it does. It's why we started, and it matches a published Australian survey. Next step is to run the next group event through wya and measure how long people take to pay, then compare with what we've just lived. That turns an anecdote into a measurement.

**A3 🔴 Your own bills are still unpaid. Doesn't that show tools don't fix it?**
It shows the gap isn't a lack of payment apps. Beem and PayID already exist. Our hypothesis is that the stall happens before payment: working out who owes what, and asking. wya shows each person exactly what they owe, itemised, and lets them pay without being chased. We haven't proven it raises repayment, and that's what we'll test.

**A4 🟡 What have you actually done to find out?**
Lived experience across three events, secondary research (the PayPal survey, review analyses of Splitwise, trade press on Beem), and a working product we can run on real bills. We haven't done structured interviews yet. [If you do some before the pitch, replace this with: "We spoke to N people and X said …".]

**A5 🟡 Why not just use Splitwise?**
Splitwise is an established tool with millions of installs, and we don't claim it's bad. Reports say its free tier is capped, itemised receipt scanning sits behind Pro, and people settle in other apps. wya's difference is that the event decides who can claim, so nobody argues about who was there. We haven't verified Splitwise's current feature set, and I'd check that before relying on it.

**A6 🔴 Why not Beem? It's Australian, bank-built, 3 million downloads.**
Beem is strong at moving money and has millions of registered users (AP+/Bolt, April 2026). Our difference is the event context and the itemised, per-person claim step before money moves. Beem is also changing hands: Bolt Group says it wants it to be "a true everyday money app", which broadens it. A broader app is less likely to focus on one friend-group dinner. That's an opening, not a guarantee.

**A7 🔴 Beem was just sold and Bolt is investing. Doesn't that make you a feature of a bigger player?**
It's a real risk. A larger Beem could add itemised splits. Our defence is focus and the event record: who was invited, who came, what was claimed, what was paid. That's data a payments wallet doesn't naturally hold. We'd need to move faster than a company in the middle of an acquisition.

**A8 🟡 Who exactly is the customer?**
Australian friend groups sharing dinners and trips, beginning with [one campus or friend network]. The person who paid is the buyer of the solution; everyone else adopts through a link, with no install.

**A9 🟡 Why would friends adopt another app?**
They don't install one. They open a link, claim their items and pay. The person who paid is the one with the pain, and they bring the group.

**A10 🔴 How do you make money?**
Honestly: not decided yet, and we're not taking a cut of payments. The realistic options are a paid tier for people who run many events (clubs, societies, organisers) and small extras like album or keepsake features. Splitwise's own history, a free tier with a Pro subscription, shows that model works in this category.

**A11 🟡 What if people still don't pay?**
wya doesn't force payment. It makes paying easy and visible, shows who has and hasn't, and keeps a record. It's a friend group, so visibility does most of the work, which is the same reason the pledge feature exists.

**A12 🟡 Is this a venture-scale business?**
Not proven, and I won't pretend. The category is big (millions of installs, a venture round), but we've no evidence yet of how big the share is. For tomorrow, the claim is a validated problem and a working product, not a market size.

**A13 🟢 What would make you stop?**
If real groups use it once and don't come back, or if people pay no faster than they do now. We'd measure time-to-paid on the next three events.

---

## Part B: Architecture and scalability

**B1 🟢 Describe your data model.**
Postgres with 33 tables. Core groups: people and events (profiles, events, rsvps); conversation (chat, polls, plans); bills (receipts, receipt lines, claims, confirmations); money (debts, wallets, a double-entry ledger of transactions and entries); and photos. Money is stored as whole cents.

**B2 🟢 How does multi-user work, and how do you keep people's data separate?**
Row-level security in the database. A guest can only read an event, its bills and its chat if they have a row on that event. Sensitive details (an address, a payment ID) only come out through functions that check who's asking. We have about 200 access-control checks and about 230 feature checks.

**B3 🔴 What breaks first at scale?**
Our live unread badge. Every signed-in user listens to every chat message insert, and the app re-queries each time, so cost grows as messages × users. Close behind: missing indexes on `rsvps (user_id)`, `events (host_id)` and `events (date)`, and chat loading the whole history. We know the fixes: per-chat updates, a notification-driven unread counter, those indexes, and paging.

**B4 🔴 How many users can it handle?**
I can't give you a number I haven't measured. We've stress tested one event with 30 guests acting at once. We haven't load tested thousands of events. That's the first thing we'd do after fixing the unread badge.

**B5 🟡 Why Supabase and Postgres?**
The data is relational and the money rules need transactions and constraints. Supabase gave us auth, storage, realtime and scheduled jobs without running servers, which suited a two-week build. The trade-off is that it ties us to Postgres features and one provider.

**B6 🔴 You've put your business logic in database functions. Isn't that lock-in and hard to test?**
It's a trade-off. The benefit is every rule is enforced in one place, so phone, web and tests can't disagree, and money rules run in one transaction. The cost is Postgres-specific code. We test it by calling the functions directly with real accounts.

**B7 🟡 How do you stop two people claiming the same item, or paying twice?**
The database enforces both. Claims can't exceed the units left on a line, and a unique index allows only one payment per debt. Per-event locks prevent two people racing past a cap.

**B8 🟡 Is the wallet safe?**
It's a test balance only, and I'll say that plainly. The design is double-entry: every movement is two rows that sum to zero, a balance can't go below zero, and there's no function to send money to an arbitrary person, only to pay a specific debt you owe. Real money needs a licensed payments partner and reconciliation, which we haven't built.

**B9 🟡 How do you handle AI cost and mistakes?**
The AI runs in a server function, so the key never reaches the phone, with a database rate limit per user. It proposes lines; our code clamps quantities, checks surcharges against their percentages, and the bill can't be sent unless lines add up. At volume we'd add a queue, image size caps and a cost ceiling per user.

**B10 🟡 What about privacy?**
Receipt photos go to private storage and are only visible to people on the event. Guests can't see addresses on pledge events until they commit, and nobody sees another person's payment details. We haven't had an external security review.

**B11 🔴 Environments, CI and backups?**
Honest answer: this is our weakest area. We have one shared Supabase project, no CI, and migrations are applied by hand. Tests run against the live dev project. The fix is the Supabase CLI with a local stack in CI, a separate staging project, and a documented backup plan.

**B12 🟡 What's the first thing you'd rebuild?**
The notification path. Today notifications are written inside the user's own transaction, which slows down as events get bigger. We'd move to an outbox table drained by a short job, and the unread badge would read from it.

**B13 🟢 How is the app built, and does it work on phones?**
One Expo / React Native codebase for iOS, Android and web. We've run it on iOS (simulator and a real iPhone) and the web. Android is untested.

**B14 🟡 What happens if the AI scan is down or slow?**
The payer can type the lines in, or use a saved sample receipt (for testing and demo only). The rest of the flow doesn't depend on it.

**B15 🟡 How do you know the rules work?**
About 200 access-control checks, about 230 feature checks, and a 30-guest concurrent stress test, all run against real accounts. They don't replace load testing or a security audit.

---

## Hardest five to rehearse
1. **A3**: your own bills are still unpaid.
2. **A2**: three events isn't proof.
3. **A7**: Beem is being sold and will grow.
4. **B3 / B4**: what breaks first, and "I haven't measured that".
5. **B11**: no CI or staging.

Each has the same winning shape: concede the weakness in one sentence, give the fact you do have, name the specific next step.
