# Security policy

wya is a pre-launch project built by three people. It has no real users and moves no real money yet. We still want to hear about security problems early, and we will treat reports seriously.

## Supported versions

Only the `main` branch is supported. There are no released versions yet. Fixes land on `main`.

## How to report a vulnerability

Report it privately through GitHub:

**https://github.com/aveturi14/wya/security/advisories/new**

(Repository → Security tab → Report a vulnerability.) The report is visible only to you and the maintainers.

There is no security email address. Please do not guess one or send reports to personal addresses.

Do not open a public issue, pull request, discussion or comment for a vulnerability.

## What to include

- What is affected: the app (web, iOS, Android), a database policy or function, a storage rule, or the Edge Function.
- The impact: what someone could read, change or do that they should not be able to.
- Steps to reproduce, using your own test accounts and data where you can.
- The commit, branch or date you tested against.
- Any suggested fix, if you have one.

## What never to post publicly

Never put these in an issue, pull request, comment, commit message or screenshot:

- Passwords, API keys, tokens, service keys or database connection strings.
- Personal data about anyone (names, emails, payment details, PayIDs, addresses).
- Details of how to exploit a problem you have not yet reported privately.

## Scope

In scope:

- The wya app code in this repository (web, iOS and Android).
- Supabase row-level security policies, `security definer` functions, Auth settings, Storage rules and scheduled jobs defined in `supabase/migrations/`.
- The `scan-receipt` Edge Function in `supabase/functions/`.

Out of scope:

- Findings that need a rooted or jailbroken device, or physical access to someone's device.
- Denial of service, spam, or load testing.
- Social engineering of maintainers or users.
- Vulnerabilities in third-party services themselves (Supabase, GitHub, Expo, OpenAI). Report those to the vendor.
- The separate marketing site in `website/`, unless the issue also affects the app.
- Anything that needs access to accounts or data that are not yours.

Please test only with accounts you create. Do not access, change or delete other people's data, and stop once you have shown the problem.

## Secrets found in the repository

If you find a credential in the repo or its history, report it privately using the link above. Do not use it, and do not copy it into a public place. We will rotate it first, then clean up. Rotating matters more than removing it from history, because the public history may already have been copied.

## What to expect

This is a small, pre-launch project. There is no service level agreement and no guaranteed response time. We will try to:

- Acknowledge your report within about a week.
- Tell you whether we consider it valid.
- Fix real problems before launch, and keep you updated.
- Credit you in the advisory if you want, once a fix is out.

We ask that you give us reasonable time to fix a problem before you disclose it.

There is no bug bounty. We cannot offer payment.
