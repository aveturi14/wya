"""Issue #38: a database built from the migrations alone has wallet test mode OFF.

Static check (reads the migration text; no network). Also runnable alone:
    python3 -I supabase/tests/phase8/test_wallet_test_mode_off.py
Live behaviour (test_topup / pay_from_wallet refuse with test_mode false) is NOT run here, because
flipping the setting on the shared wya-dev is unsafe: run it on a fresh throwaway Postgres.
"""

import pathlib
import re

ID = "W.off"
TITLE = "Wallet test mode is off by default"
MIGRATION = "wallet_test_mode_off"
FUNCTION = None
DECISIONS = []
MANUAL = "fresh throwaway Postgres: apply migrations only, then test_topup and pay_from_wallet must be refused (hint topup_unavailable / wallet_off)"

ROOT = pathlib.Path(__file__).resolve().parents[3]


def static_checks():
    sql = next((ROOT / "supabase/migrations").glob(f"*_{MIGRATION}.sql")).read_text()
    seed = (ROOT / "supabase/seed.sql").read_text()
    return [
        ("default is false", re.search(r"alter column test_mode set default false", sql) is not None),
        ("existing row set to false", re.search(r"update private\.wallet_config set test_mode = false where id", sql) is not None),
        ("pay_from_wallet checks test_mode", re.search(r"test_mode from private\.wallet_config.*?hint = 'wallet_off'", sql, re.S) is not None),
        ("seed turns it on for wya-dev", re.search(r"update private\.wallet_config set test_mode = true where id", seed) is not None),
    ]


def run(h):
    for name, ok in static_checks():
        h.record("pass" if ok else "fail", name)
    h.record("skipped", "live refusal checks", "run on a fresh throwaway Postgres, not wya-dev")


if __name__ == "__main__":
    bad = [n for n, ok in static_checks() if not ok]
    print("FAIL: " + ", ".join(bad) if bad else "ok")
    raise SystemExit(1 if bad else 0)
