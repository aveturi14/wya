#!/usr/bin/env bash
# Applies the migrations in supabase/migrations that the database doesn't have yet,
# in order, each in one transaction, and records it in private.wya_migrations so it
# never runs twice. Uses SUPABASE_DB_URL from .env (a secret: .env is git-ignored).
#
#   bash scripts/db-migrate.sh            apply what's new
#   bash scripts/db-migrate.sh --status   list applied / pending, change nothing
#   bash scripts/db-migrate.sh --fresh    a brand-new database: apply everything
#
# First run on an existing database: everything up to WYA_MIGRATION_BASELINE (default:
# the last file applied by hand before this script existed) is recorded as already
# applied, after you confirm. Needs psql, or Docker (it then runs psql in a container).
set -euo pipefail
cd "$(dirname "$0")/.."

BASELINE="${WYA_MIGRATION_BASELINE:-20261018000200_posters.sql}"
MODE="${1:-apply}"

[ -f .env ] || { echo "No .env. Copy .env.example to .env first."; exit 1; }
# From the environment if set (handy for a throwaway test database), else from .env
DB_URL="${SUPABASE_DB_URL:-$(grep -E '^SUPABASE_DB_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")}"
if [ -z "$DB_URL" ]; then
  cat <<'EOF'
SUPABASE_DB_URL isn't in .env yet. To get it (once):
  1. supabase.com → the wya-dev project → "Connect" (top of the page)
  2. "Session pooler" → copy the URI. It looks like
     postgresql://postgres.gvfcjxldokhodgnmmqar:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
  3. Put your database password in place of [YOUR-PASSWORD]
     (forgot it? Project Settings → Database → Reset database password)
  4. Add a line to .env:  SUPABASE_DB_URL=postgresql://...
It's a secret: never commit it, never prefix it with EXPO_PUBLIC_.
EOF
  exit 1
fi
case "$DB_URL" in *gvfcjxldokhodgnmmqar*|*localhost*|*127.0.0.1*|*host.docker.internal*) ;; *)
  [ "${WYA_ALLOW_OTHER_DB:-}" = "1" ] || { echo "Refusing: SUPABASE_DB_URL isn't wya-dev. Set WYA_ALLOW_OTHER_DB=1 to target another database on purpose."; exit 1; } ;;
esac

# psql: installed, or from the official Postgres image
# run_psql: a command (-c); run_psql_file: SQL on stdin. Only the second reads stdin, so the
# "Continue? [y/N]" answer isn't swallowed. Postgres's notices ("already exists, skipping") are hidden.
export PGOPTIONS="-c client_min_messages=warning"
if command -v psql >/dev/null 2>&1; then
  run_psql() { psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 "$@" </dev/null; }
  run_psql_file() { psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -1 -f -; }
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  run_psql() { docker run --rm -e PGOPTIONS postgres:17-alpine psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 "$@" </dev/null; }
  run_psql_file() { docker run --rm -i -e PGOPTIONS postgres:17-alpine psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -1 -f -; }
else
  echo "Needs psql or a running Docker. Install psql with:  brew install libpq && brew link --force libpq"; exit 1
fi

run_psql -c "create schema if not exists private;
  create table if not exists private.wya_migrations (file text primary key, applied_at timestamptz not null default now());
  revoke all on private.wya_migrations from public, anon, authenticated;" >/dev/null

applied="$(run_psql -At -c "select file from private.wya_migrations order by file")"
files=()
while IFS= read -r f; do files+=("$f"); done < <(ls supabase/migrations | grep -E '^[0-9]+_.*\.sql$' | sort)

if [ -z "$applied" ] && [ "$MODE" != "--fresh" ] && [ "$MODE" != "--status" ]; then
  echo "First run on this database. Files up to and including $BASELINE will be recorded as already applied"
  echo "(they were pasted into the SQL Editor before this script existed). Files after it will run."
  read -r -p "Continue? [y/N] " ok
  [ "$ok" = "y" ] || [ "$ok" = "Y" ] || { echo "Stopped. Nothing changed."; exit 1; }
  values=""
  for f in "${files[@]}"; do
    if [[ "$f" > "$BASELINE" ]]; then break; fi
    values+="${values:+,}('$f')"
  done
  [ -n "$values" ] && run_psql -c "insert into private.wya_migrations (file) values $values on conflict do nothing" >/dev/null
  echo "Recorded $(grep -o "('" <<<"$values" | wc -l | tr -d ' ') migration(s) as already applied." 
  applied="$(run_psql -At -c "select file from private.wya_migrations order by file")"
fi

pending=()
for f in "${files[@]}"; do grep -qx "$f" <<<"$applied" || pending+=("$f"); done

if [ "$MODE" = "--status" ]; then
  echo "Applied: $(grep -c . <<<"$applied" || true)   Pending: ${#pending[@]}"
  for f in "${pending[@]+"${pending[@]}"}"; do echo "  pending: $f"; done
  exit 0
fi

if [ ${#pending[@]} -eq 0 ]; then echo "Database is up to date (${#files[@]} migrations)."; exit 0; fi
for f in "${pending[@]}"; do
  echo "Applying $f ..."
  # The file and its record go in together: if either fails, neither happens
  { cat "supabase/migrations/$f"; echo; echo "insert into private.wya_migrations (file) values ('$f') on conflict do nothing;"; } \
    | run_psql_file >/dev/null
  echo "  done"
done
echo "Applied ${#pending[@]} migration(s)."
