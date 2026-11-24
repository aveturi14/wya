# Contributing to wya

Thanks for helping. This page is the short version of how work gets into `main`.

## Setup

Follow the setup steps in the [README](README.md). Copy `.env.example` to `.env` and fill in the publishable values. Ask a maintainer for access to the shared dev project and test accounts. Never commit `.env` or any password.

## Start from an issue

Every change starts from an issue. If there isn't one, open it first using the Task or Bug form. Security problems are different: report them privately through [GitHub's private reporting](https://github.com/aveturi14/wya/security/advisories/new), not in a public issue.

## Branches

Branch from `main` as `type/issue-short-name`:

- `fix/44-duplicate-events`
- `feat/52-poll-reminders`
- `docs/31-templates-and-contributing`

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, in the imperative, 72 characters or fewer.

- `fix(rsvp): stop duplicate rows on double tap`
- `docs: add contributing guide`
- `feat(db): add collection expiry`

## Pull requests

- One issue per PR. Put `Closes #<issue>` in the description.
- Keep it under about 400 changed lines where you can. Split larger work.
- Fill in the PR template. It asks for a summary, the reason, what changed, a Mermaid diagram when the change touches a flow, structure or the schema, screenshots for anything visual (phone and desktop, light and dark), how to test, evidence, what you did not verify, and risk and rollback.
- Merges are squash merges, so the PR title should be a valid Conventional Commit message.
- Say plainly what you did not verify.

## Database changes

- Add a new file in `supabase/migrations/` with a timestamp prefix. Never edit an applied migration.
- Write it to be safe to re-run: `if not exists`, `drop ... if exists` before `create`, `on conflict do nothing`, `create or replace`.
- Schema-qualify names and set `search_path = ''` on `security definer` functions.
- Add checks to the test scripts and run `python3 -I supabase/tests/rls_check.py` before you open the PR. Paste the result in Evidence.
- If a new `events` column is added, add it to the column grant and to `EVENT_COLUMNS`.

## Tests and checks

```bash
npm run typecheck                          # keep at zero errors
npm run lint                               # ESLint via expo lint (warnings are the baseline, errors fail CI)
python3 -I supabase/tests/rls_check.py     # access control, after any database change
python3 -I supabase/tests/phase8/run.py    # Phase 8 checks (--only <item>)
```

Run the stress and RLS scripts one at a time, because they share a test account. For UI changes, also look at the web app at phone and desktop widths in light and dark, and on the iOS simulator when native APIs, layout or text are involved.

## Code conventions

- Use the kit in `components/ui/` and the tokens in `constants/theme.ts`. No raw hex values in screens.
- Read the versioned [Expo SDK 57 docs](https://docs.expo.dev/versions/v57.0.0/) before using an Expo API.
- Use `lib/alert.ts` (`showAlert`, `confirmAction`), not `Alert.alert`, which does nothing on web.
- Use `theme.type.*` for text styles.
- Write copy in plain, friendly sentence case.
- Never put secrets in `.env`, `EXPO_PUBLIC_*`, `app.json`, migrations or tests. See `CLAUDE.md` for the full list of conventions.

## Review

- Reviewers check the diff against the issue, the template sections and the conventions above.
- Authors respond to every comment, by changing the code or explaining why not.
- CI should be green before merge. Do not merge your own PR without a review unless the maintainers have agreed to it for that change.
