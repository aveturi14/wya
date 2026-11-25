#!/usr/bin/env bash
# One command to get wya running (or restarted) on this Mac:  npm run dev
#
#   1. checks .env
#   2. installs packages if package-lock.json changed (into node_modules.nosync,
#      so iCloud's "Optimise storage" can't evict them from Documents)
#   3. applies new database migrations to wya-dev (scripts/db-migrate.sh)
#   4. puts the OpenAI key on Supabase and deploys the scan-receipt function
#      (needs `npx supabase login` once; skipped with a note otherwise)
#   5. stops any old app server and starts the web app on http://localhost:8081
#
# Flags: --no-db  --no-functions  --no-start
set -uo pipefail
cd "$(dirname "$0")/.."
PROJECT_REF=gvfcjxldokhodgnmmqar
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
warn() { printf '  \033[33m! %s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓ %s\033[0m\n' "$*"; }
FLAGS=" $* "

say "1. Settings (.env)"
if [ ! -f .env ]; then cp .env.example .env; warn "Created .env from .env.example: fill in EXPO_PUBLIC_SUPABASE_ANON_KEY, then run this again."; exit 1; fi
env_get() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"; }
[ -n "$(env_get EXPO_PUBLIC_SUPABASE_URL)" ] && [ -n "$(env_get EXPO_PUBLIC_SUPABASE_ANON_KEY)" ] && ok "Supabase URL and anon key" || { warn "EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY missing in .env"; exit 1; }
OPENAI_KEY="$(env_get OPENAI_API_KEY)"; [ -n "$OPENAI_KEY" ] || OPENAI_KEY="$(env_get OPEN_AI_KEY)"
for k in $(grep -oE '^EXPO_PUBLIC_[A-Z_]*(SECRET|SERVICE|OPENAI|PASSWORD)[A-Z_]*' .env || true); do warn "$k is bundled into the app: secrets must not start with EXPO_PUBLIC_"; done

# Expo needs Node 20.19.4+. With nvm, switch to 22 for this run (installing it if needed).
node_ok() { node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>20||(a===20&&b>=19)?0:1)' 2>/dev/null; }
if ! node_ok && [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm install 22 >/dev/null
fi
node_ok && ok "Node $(node -v)" || warn "Node $(node -v) is older than Expo wants (20.19.4+): install Node 22 (nodejs.org) or nvm"

# Stop a running app server first: reinstalling packages under it would crash it halfway
if [[ "$FLAGS" != *" --no-start "* ]]; then
  old="$(lsof -ti tcp:8081 2>/dev/null || true)"
  if [ -n "$old" ]; then kill $old 2>/dev/null; sleep 1; ok "Stopped the old app server (it restarts at the end)"; fi
fi

say "2. Packages"
stamp="node_modules.nosync/.lock-hash"
want="$(shasum package-lock.json | cut -d' ' -f1)"
if [ ! -d node_modules.nosync ] || [ "$(cat "$stamp" 2>/dev/null)" != "$want" ] || [ ! -L node_modules ]; then
  rm -rf node_modules node_modules.nosync
  npm ci --no-audit --no-fund || { warn "npm ci failed"; exit 1; }
  mv node_modules node_modules.nosync && ln -s node_modules.nosync node_modules && echo "$want" > "$stamp"
  grep -qx "node_modules.nosync" .git/info/exclude 2>/dev/null || echo "node_modules.nosync" >> .git/info/exclude
  ok "Installed (in node_modules.nosync)"
else
  # iCloud can still evict files elsewhere in Documents; a quick check catches it early
  if find node_modules.nosync -maxdepth 3 -flags +dataless 2>/dev/null | grep -q .; then
    warn "Some packages were moved to iCloud. Reinstalling."; rm -rf node_modules node_modules.nosync; exec bash "$0" "$@"
  fi
  ok "Up to date"
fi

if [[ "$FLAGS" != *" --no-db "* ]]; then
  say "3. Database (wya-dev)"
  if [ -n "$(env_get SUPABASE_DB_URL)" ]; then
    bash scripts/db-migrate.sh && ok "Migrations applied" || warn "Migrations failed: read the error above. The app will still start."
  else
    warn "SUPABASE_DB_URL isn't in .env, so new migrations can't be applied automatically."
    bash scripts/db-migrate.sh 2>/dev/null | sed 's/^/    /' || true
  fi
fi

if [[ "$FLAGS" != *" --no-functions "* ]]; then
  # Legacy OpenAI scan function, deployed for dev only; it goes away when OCR replaces it (#97).
  # Production must not run it (#54).
  say "4. Receipt scanning (OpenAI key + scan-receipt function)"
  if [ -z "$OPENAI_KEY" ]; then
    warn "No OPENAI_API_KEY (or OPEN_AI_KEY) in .env: scanning stays off; typing bills in still works."
  elif ! npx --yes supabase@2 projects list >/dev/null 2>&1; then
    warn "Not logged in to Supabase (npx supabase login), so scan-receipt can't be deployed from here."
    REMOTE_SCAN=no
  else
    fn_hash="$(cat supabase/functions/_shared/*.ts supabase/functions/scan-receipt/*.ts | shasum | cut -d' ' -f1)"
    key_hash="$(printf '%s' "$OPENAI_KEY" | shasum | cut -d' ' -f1)"
    state=".git/wya-functions.state"
    if [ "$(cat "$state" 2>/dev/null)" != "$fn_hash:$key_hash" ]; then
      # The key goes to Supabase's secret store (read by the function on the server), never into the app
      npx --yes supabase@2 secrets set "OPENAI_API_KEY=$OPENAI_KEY" --project-ref "$PROJECT_REF" >/dev/null && ok "OpenAI key saved as a Supabase secret" \
        && npx --yes supabase@2 functions deploy scan-receipt --project-ref "$PROJECT_REF" --use-api >/dev/null && ok "scan-receipt deployed" \
        && echo "$fn_hash:$key_hash" > "$state" || { warn "Couldn't put it on Supabase (only the project's Owner/Admin can set secrets and deploy)."; REMOTE_SCAN=no; }
    else
      ok "Already up to date"
    fi
  fi
fi

# If scan-receipt isn't on Supabase, run it on this Mac instead (Docker), with the key from .env.
# The key stays in the container; the app only learns the local address.
if [[ "$FLAGS" != *" --no-functions "* ]] && [ -n "$OPENAI_KEY" ]; then
  url="$(env_get EXPO_PUBLIC_SUPABASE_URL)"; anon="$(env_get EXPO_PUBLIC_SUPABASE_ANON_KEY)"
  remote_code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$url/functions/v1/scan-receipt" -H "apikey: $anon" -d '{}' || true)"
  if [ "$remote_code" = "404" ] || [ "${REMOTE_SCAN:-}" = "no" ]; then
    if docker info >/dev/null 2>&1; then
      docker rm -f wya-scan >/dev/null 2>&1
      envfile="$(mktemp)"; chmod 600 "$envfile"
      printf 'SUPABASE_URL=%s\nSUPABASE_ANON_KEY=%s\nOPENAI_API_KEY=%s\n' "$url" "$anon" "$OPENAI_KEY" > "$envfile"
      if docker run -d --name wya-scan --env-file "$envfile" -p 54399:8000 -v wya-deno-cache:/deno-dir \
           -v "$PWD/supabase/functions:/f:ro" denoland/deno:2.1.4 deno run --allow-net --allow-env /f/scan-receipt/index.ts >/dev/null; then
        export EXPO_PUBLIC_SCAN_RECEIPT_URL="http://localhost:54399"
        ok "Receipt scanning runs on this Mac (Docker container wya-scan, http://localhost:54399)"
      else
        warn "Couldn't start the local receipt reader"
      fi
      rm -f "$envfile"
    else
      warn "Docker isn't running, so receipt scanning stays off (typing bills in still works)."
    fi
  fi
fi

if [[ "$FLAGS" != *" --no-start "* ]]; then
  say "5. App"
  ok "Starting http://localhost:8081  (Ctrl+C to stop)"
  exec npx expo start --web --port 8081
fi
