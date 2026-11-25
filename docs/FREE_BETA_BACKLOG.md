# Free beta: GitHub backlog drafts

Status: **published 2026-11-25** as epic #105 with sub-issues #96–#104. **GitHub is the live copy; edit there first** and treat this file as history. Rewritten on GitHub on 2026-11-25 (original audit fixes kept): #38, #40, #47, #54, #55, #26 and #58. Only #86 is still pending (below).

## Parent epic

**Title:** Epic: Launch the free web beta with verified guests, OCR bills and PayID

## Outcome

Launch a free, mobile-browser-first wya beta for people organising gatherings with existing friends. Guests can join through verified email without a password or app download, coordinate an event, contribute before booking through PayID, and split a receipt using OCR with human review. The organiser can see what still needs a response or payment.

Agreed product direction: 25 November 2026. This is a target specification, not a claim that these capabilities are deployed.

## Release scope

- Keep working event details, invitations, RSVP/date voting, chat, polls and photos, subject to the release checks.
- Verified guest participation, stable identity and recovery, with optional later full-account linking. Organisers have accounts; guest and account balances share the same obligation model.
- PayID transfers occur outside wya. A payment report is awaiting confirmation, never proof of receipt. Only the recipient confirms settlement.
- Keep collect-before-booking and post-event bill splitting, including a standalone bill entry point.
- Replace ChatGPT/OpenAI receipt extraction with OCR. Provider and browser-versus-server deployment remain to be evaluated. The payer reviews/corrects the extracted items and total before sharing; manual entry always works.
- Email reminders for responses, important event changes and outstanding payments. Pause debtor payment reminders while a claim awaits recipient confirmation; rejected claims become outstanding again.
- Disable wallet/card/top-up/cash-out flows and server-side simulated settlement for production. No arbitrary no-show fines.
- Costs must be agreed before commitment. Preserve recorded actual costs, payment history and manual refund tracking through cancellation.
- Preserve no-response separately from explicit decline, while excluding unanswered invitations from confirmed headcount after the deadline.
- Free for users initially. Hosting, email and OCR may still have operating costs; enforce limits and document the budget.

## Target architecture and roadmap

See the [README](../README.md#target-beta-architecture) (architecture) and [roadmap](../README.md#roadmap). They are kept in one place so they cannot drift.

## Work tracking

Implementation issues and existing foundation dependencies will be linked below. Work is ordered by dependency, not by a promised release date. The earlier coordination-only pilot is not the agreed release scope: verified guests, OCR and PayID are part of this beta.

## Release gate

The release gate is kept in one place, the [free beta epic (#105)](https://github.com/aveturi14/wya/issues/105). A short summary: no simulated money in production, verified-guest journeys on real phones, payment reports never count as funding until confirmed, release-path tests pass (skipped tests do not count), privacy and support are live.

## After beta

Use evidence before expanding: potluck contributions and organiser action lists; helping newcomers form repeat social circles through small gatherings; later college committees, organisations and larger groups. Public discovery needs a host/community supply and trust/moderation design. AI assistants, venue lookups, widgets, live location, calendar integrations, native-store expansion and payment processing are not launch dependencies.

## Documentation

README.md is the product overview. docs/PHASE8.md is the active delivery specification and decision register. Historical implementation notes must not override this scope.

## Draft work index

| Key | Work | Depends on |
|---|---|---|
| [#96](https://github.com/aveturi14/wya/issues/96) | Verified guests: email access, recovery and account linking | Production/auth configuration #54; access matrix from BETA-07 part A. |
| [#97](https://github.com/aveturi14/wya/issues/97) | OCR receipt extraction with mandatory payer review and manual fallback | BETA-01 for mixed guest acceptance; settlement #40; receipt consistency #93. |
| [#98](https://github.com/aveturi14/wya/issues/98) | Commitment deadlines, cancellation and actual-cost refund handling | Verified identities BETA-01; confirmed external settlement #40; safe create/edit #44. |
| [#99](https://github.com/aveturi14/wya/issues/99) | Mobile-browser beta journeys and reliable invite return paths | BETA-01, BETA-02, #40 and #44; production web/auth URLs #54. |
| [#100](https://github.com/aveturi14/wya/issues/100) | Email reminders for RSVP deadlines, event changes and unpaid shares | BETA-01; #40 payment states; BETA-03 deadlines; #54 email configuration. |
| [#101](https://github.com/aveturi14/wya/issues/101) | Launch acceptance, feedback and first real friend-group beta | All beta work plus #29/#30 release-path checks, #41/#42/#44, #54/#55/#56 and applicable security dependencies. |
| [#102](https://github.com/aveturi14/wya/issues/102) | Verify participant privacy and access boundaries for the free beta | Part A (matrix): #57, #88. Part B (verification): BETA-01 built. |
| [#103](https://github.com/aveturi14/wya/issues/103) | Publish beta privacy information, support and guest data controls | #55 deletion/export; #41 financial history; OCR processing choice BETA-02; #56 monitoring. |
| [#104](https://github.com/aveturi14/wya/issues/104) | Document the free beta architecture, roadmap and future product direction | Approved product scope; parent epic. |

Existing dependencies: #38 wallet isolation; #40 settlement; #41 financial history; #42 fresh migrations; #43 environment isolation; #44 atomic create/edit; #47 PayID setup; #54 production; #55 deletion/export; #56 monitoring; #57 access model; #29/#30/#80 release-path tests; #85/#87/#88/#89 applicable security hardening; #93 receipt consistency. Review #86/#95 as temporary protection for the old receipt endpoint until retired. Preserve existing parents and states; use cross-links rather than reparenting shared foundation issues.

## Issue bodies

The full bodies live on GitHub (the work index above lists each one): [#96](https://github.com/aveturi14/wya/issues/96), [#97](https://github.com/aveturi14/wya/issues/97), [#98](https://github.com/aveturi14/wya/issues/98), [#99](https://github.com/aveturi14/wya/issues/99), [#100](https://github.com/aveturi14/wya/issues/100), [#101](https://github.com/aveturi14/wya/issues/101), [#102](https://github.com/aveturi14/wya/issues/102), [#103](https://github.com/aveturi14/wya/issues/103), [#104](https://github.com/aveturi14/wya/issues/104). Edit them there, not here.

## Proposed revisions to existing issues

Applied 2026-11-25: #38, #40, #47, #54, #55, #26 and #58 (their live bodies are the source now). Still pending: #86, below.

### Applied

#38 and #40 keep their original audit fixes (test mode off by default; a debtor cannot mark their own debt paid). #47 is re-scoped to restore PayID setup. #54 owns the email sender and return URLs. #55 covers verified guests. #26 and #58 note that 8.10–8.17 are not launch work.

### Existing issue #86

Keep legacy receipt-spend protection until the old endpoint is retired. Add a link to the OCR replacement issue. Do not close merely because OCR is planned; verify production cannot call the legacy endpoint before deciding whether its remaining work is obsolete.

