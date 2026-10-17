# wya backend: everything you need to stand it up

_Written 2026-10-17. For anyone who has `docs/REBUILD.md` but not the repo or the Supabase project._

`REBUILD.md` describes the backend; it doesn't contain it. **The backend is the SQL in `supabase/migrations/`** (23 files, ~4,000 lines). There's no server code to run: Postgres functions, triggers, row-level security, Storage policies and pg_cron jobs are the backend. Phase 8 adds Edge Functions later, but none are deployed yet.

So you need one of two things:

| Option | You get | You need from Abhiram | When to pick it |
|---|---|---|---|
| **A. Use the shared dev project (`wya-dev`)** | The real backend, the seed accounts, the existing test data | Repo access, plus the publishable key (or Supabase org access) | You're working on the app with us. **Recommended.** |
| **B. Build your own Supabase project** | An identical backend that's yours | The `supabase/` folder (repo, or the zip kit below) | You want an isolated sandbox, or you're setting up production |

Either way, **get the repo**: it's the source of truth, and REBUILD.md says "when this file and the migrations disagree, the migrations win".

---

## 1. What makes up the backend

| Piece | Where | Notes |
|---|---|---|
| Schema, RLS, functions, triggers | `supabase/migrations/*.sql` | Apply **in filename order**. `20260610000000_baseline.sql` creates the original tables, and every later file builds on it |
| Storage buckets | created by migrations | `avatars`, `event-images` (public read by URL), `album` (private, size and type limits) |
| Realtime | added by migrations | `chat_messages`, `notifications`, `photos`, `poll_votes`, `plan_items` are in the `supabase_realtime` publication |
| Scheduled jobs (pg_cron) | created by migrations | `wya-pledge-deadlines` and `wya-nudges` (every 15 min), `wya-rate-limit-cleanup` (daily). The pledges migration runs `create extension if not exists pg_cron` |
| Private helpers | `private` schema | Not exposed by the API (it's not in the exposed schemas list, which is the default) |
| Seed data (dev only) | `supabase/seed.sql`, `supabase/seed_stress.sql` | Hannah (host), Gary (going), Sam (stranger), Jo (joiner), the "Seed Dinner Party" (invite code `seedinvite`), and 30 stress accounts. The shared password is in the seed file's header comment. **Never run these on production** |
| Edge Function helpers | `supabase/functions/_shared/` | CORS, the `not_configured` 503 response, a caller-session client. No functions to deploy yet (8.10+) |
| Tests | `supabase/tests/` | `rls_check.py` (190 access checks), `phase8/run.py` (185 checks for 8.0–8.9), `stress_pledges.py` (30 guests at once) |

**No repo yet?** Ask for `wya-backend-kit.zip`. It holds `supabase/` (migrations, seeds, tests, function helpers), this file, `REBUILD.md`, `PHASE8.md`, `CLAUDE.md` and `.env.example`, which is enough for Option B. Rebuild it from the repo root with:

```bash
zip -qr dist/wya-backend-kit.zip supabase docs/BACKEND_SETUP.md docs/REBUILD.md docs/PHASE8.md CLAUDE.md .env.example -x "*/__pycache__/*" "*.DS_Store"
```

## 2. Option A: connect to `wya-dev`

1. Get access to the GitHub repo and clone it.
2. `cp .env.example .env` and fill in:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://gvfcjxldokhodgnmmqar.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key: ask Abhiram, or Dashboard → Project Settings → API Keys>
   EXPO_PUBLIC_WEB_URL=https://wya.expo.app
   ```
   The publishable key is safe to share (it ships inside the app). **Never** use or share the `service_role` / secret key.
3. `npm install`, then `npm run web`. Sign in as `host@wya.test` (password: see `supabase/seed.sql`).
4. Optional: ask to be added to the Supabase organization so you can open the dashboard, read logs and apply migrations.

Nothing else is needed: the migrations are already applied there.

## 3. Option B: build your own Supabase project

### 3.1 Create the project

1. supabase.com → New project. Region: whatever's close (wya-dev is `us-east-1`; production should probably be Sydney, `ap-southeast-2`). Save the database password.
2. **Authentication → Sign In / Providers → Email:** enabled. For dev, turn **Confirm email off**.
3. **Authentication → URL Configuration:** Site URL `https://wya.expo.app`, redirect URL `https://wya.expo.app/**`. Add `http://localhost:8081/**` for local web.
4. For production only: **Authentication → Attack Protection → Leaked password protection** on.

### 3.2 Apply the migrations

Pick one way and apply **all 23 files, in order**:

```bash
# Supabase CLI (needs the repo; links to your project and runs everything in supabase/migrations)
npx supabase login
npx supabase link --project-ref <your-ref>
npx supabase db push
```

or with `psql` (connection string from Dashboard → Connect → Session pooler):

```bash
for f in supabase/migrations/*.sql; do echo "== $f"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break; done
```

or paste each file into the SQL Editor in order.

Then, **dev projects only**, load the seed: `psql "$DATABASE_URL" -f supabase/seed.sql` (and `seed_stress.sql` for the stress test).

> **Not verified yet:** these files have only ever been applied one by one to wya-dev as they were written. Nobody has run all 23 on a brand-new project. They're written to be re-runnable, but if one fails, fix it in a new migration (or in that file, if it's a fresh-install-only problem) and tell us. Watch for: `crypt()` / `gen_salt()` in the seed (pgcrypto lives in the `extensions` schema on Supabase), and pg_cron needing to be enabled before the pledges migration.

### 3.3 Check it worked

```sql
select count(*) from pg_tables where schemaname = 'public';                    -- tables exist
select id, public from storage.buckets;                                         -- avatars, event-images, album
select jobname, schedule from cron.job;                                         -- 3 wya-* jobs
select tablename from pg_publication_tables where pubname = 'supabase_realtime'; -- 5 tables
```

### 3.4 Point the app and tests at it

- `.env`: your project's URL and publishable key.
- The test scripts **refuse to run on anything but wya-dev**. For your own dev project, change `DEV_PROJECT_REF` in `supabase/tests/rls_check.py`, `supabase/tests/stress_pledges.py` and `supabase/tests/phase8/_harness.py`. Never point them at production: they sign in as the seed accounts and write test data.
- Then run:
  ```bash
  python3 -I supabase/tests/rls_check.py      # expect 190/190
  python3 -I supabase/tests/phase8/run.py     # expect 8.0–8.9 to pass; 8.10+ PENDING / BLOCKED
  ```

## 4. Secrets (only for Phase 8 tier B and later)

Nothing in 8.0–8.9 needs a secret. Later items do. Full table: `docs/PHASE8.md` §3.

| Secret | For | Set with |
|---|---|---|
| `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`, `OPENAI_MODEL_FAST`) | 8.10 `@wya` assistant, 8.11 Ask wya | `npx supabase secrets set … --project-ref <ref>` |
| `GOOGLE_PLACES_API_KEY` | 8.12 venue lookups | same |
| `PUSH_WEBHOOK_SECRET` (+ in Vault), `EXPO_ACCESS_TOKEN` | 8.13 push | same |
| Apple Developer account + APNs key; Firebase project + FCM key | iOS / Android push, widgets | EAS credentials |

Secrets go in Edge Function secrets or EAS, **never** in `.env`, `EXPO_PUBLIC_*`, `app.json`, migrations or tests. A function with a missing secret answers 503 `not_configured`.

## 5. Rules for changing the backend

- Every change is a **new file** in `supabase/migrations/` with a timestamp prefix. Write it to be safe to re-run (`if not exists`, `drop … if exists`, `create or replace`, `on conflict do nothing`).
- `security definer` functions set `search_path = ''` and schema-qualify everything (`public.profiles`).
- Changing a function's returned columns needs `drop function` first.
- A new `events` column needs adding to the column grant (`events.address` is deliberately not selectable) and to `EVENT_COLUMNS` in `lib/events.ts`.
- Run `rls_check.py` after every database change.
- More: `CLAUDE.md` → "How we work" and "Gotchas".
