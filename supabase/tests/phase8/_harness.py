"""Shared helpers for the Phase 8 checks (docs/PHASE8.md §5).

Loaded by run.py; not meant to be run directly. Same rules as rls_check.py: only
wya-dev, seed accounts, temporary events titled "RLS temp event: …", and
everything created is deleted at the end.
"""

import datetime
import json
import pathlib
import re
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[3]
DEV_PROJECT_REF = "gvfcjxldokhodgnmmqar"

HOST = "host@wya.test"          # Hannah, hosts the seed event, has a PayID
GUEST = "guest@wya.test"        # Gary, Going to the seed event
STRANGER = "stranger@wya.test"  # Sam, never invited
JOINER = "joiner@wya.test"      # Jo, accepts invites in tests
IDS = {
    HOST: "11111111-1111-1111-1111-111111111111",
    GUEST: "22222222-2222-2222-2222-222222222222",
    STRANGER: "55555555-5555-5555-5555-555555555555",
    JOINER: "66666666-6666-6666-6666-666666666666",
}
# clear_test_notifications() recognises this prefix, so Activity items about these events are cleaned up
TEMP_PREFIX = "RLS temp event: "
TEMP_ADDRESS = "42 Secret Lane"

PASS, FAIL, PENDING, BLOCKED, SKIPPED, CLARIFY = "pass", "fail", "pending", "blocked", "skipped", "clarify"
ICONS = {PASS: "✅", FAIL: "❌", PENDING: "⏸ ", BLOCKED: "🔒", SKIPPED: "⏭ ", CLARIFY: "❓"}

DECISION_ROW = re.compile(r"^\|\s*([A-Z]+-\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(open|decided)\s*\|\s*$")


def load_decisions():
    """The decisions table in docs/PHASE8.md §6 is the single source of truth."""
    rows = {}
    for line in (ROOT / "docs/PHASE8.md").read_text().splitlines():
        m = DECISION_ROW.match(line)
        if m:
            rows[m.group(1)] = {"question": m.group(2), "default": m.group(3), "status": m.group(4)}
    return rows


class Blocked(Exception):
    """An Edge Function answered 503 not_configured: a secret or account is missing."""


class Harness:
    # Test files are loaded by path (python -I can't import siblings), so they reach the constants through `h`
    HOST, GUEST, STRANGER, JOINER = HOST, GUEST, STRANGER, JOINER
    TEMP_ADDRESS = TEMP_ADDRESS
    ROOT = ROOT
    Blocked = Blocked

    def __init__(self, offline=False):
        self.results = []  # (feature id, status, name, detail)
        self.feature = None
        self.now = datetime.datetime.now(datetime.timezone.utc)
        # Activity items from this run are cleared at the end (a little slack for clock drift)
        self.run_started = (self.now - datetime.timedelta(seconds=5)).isoformat()
        self.temp_events = []  # (event id, host email)
        self.cleanups = []
        self.last_error = None
        self._tokens = {}
        self.url = self.key = self.password = None
        self.live_reason = "--offline" if offline else None
        if not offline:
            self._load_env()

    # -- setup ---------------------------------------------------------------
    def _load_env(self):
        try:
            env_file = ROOT / ".env.local" if (ROOT / ".env.local").exists() else ROOT / ".env"
            env = {}
            for line in env_file.read_text().splitlines():
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
            self.url, self.key = env["EXPO_PUBLIC_SUPABASE_URL"], env["EXPO_PUBLIC_SUPABASE_ANON_KEY"]
            self.password = re.search(r"password for all: (\S+)\)", (ROOT / "supabase/seed.sql").read_text()).group(1)
        except (OSError, KeyError, AttributeError) as e:
            self.live_reason = f"can't read the project settings ({type(e).__name__}: {e})"
            return
        if DEV_PROJECT_REF not in self.url:
            raise SystemExit(f"Refusing to run: {self.url} is not the wya-dev project")

    @property
    def live(self):
        return self.live_reason is None

    @staticmethod
    def migration_exists(slug):
        return any((ROOT / "supabase/migrations").glob(f"*_{slug}.sql"))

    @staticmethod
    def function_exists(name):
        return (ROOT / "supabase/functions" / name / "index.ts").exists()

    # -- reporting -----------------------------------------------------------
    def record(self, status, name, detail=""):
        self.results.append((self.feature, status, name, detail))
        line = f"  {ICONS[status]} {name}"
        if detail and status != PASS:
            line += f"  →  {detail}"
        print(line)

    def check(self, name, ok, detail="", assumes=None):
        """assumes: the §6 decision this check depends on, named in the failure so it's clear what to revisit."""
        if ok:
            self.record(PASS, name)
        else:
            text = str(detail)[:400]
            self.record(FAIL, name, f"(assumes {assumes}) {text}" if assumes else text)
        return bool(ok)

    # -- HTTP ----------------------------------------------------------------
    def request(self, method, path, token=None, body=None, headers=None):
        req = urllib.request.Request(self.url + path, method=method)
        req.add_header("apikey", self.key)
        req.add_header("Authorization", f"Bearer {token or self.key}")
        req.add_header("Content-Type", "application/json")
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        data = json.dumps(body).encode() if body is not None else None
        try:
            with urllib.request.urlopen(req, data, timeout=90) as resp:
                return resp.status, self._decode(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, self._decode(e.read())

    @staticmethod
    def _decode(raw):
        if not raw:
            return None
        try:
            return json.loads(raw)
        except ValueError:
            return raw.decode(errors="replace")

    def login(self, email):
        if email not in self._tokens:
            status, body = self.request("POST", "/auth/v1/token?grant_type=password",
                                        body={"email": email, "password": self.password})
            if status != 200:
                raise RuntimeError(f"login failed for {email}: {body}")
            self._tokens[email] = body["access_token"]
        return self._tokens[email]

    def get(self, table, token=None, query="select=*"):
        return self.request("GET", f"/rest/v1/{table}?{query}", token)

    def rpc(self, fn, args=None, token=None):
        return self.request("POST", f"/rest/v1/rpc/{fn}", token, args or {})

    def insert(self, table, row, token, select="id"):
        # events.address isn't selectable, so always ask for specific columns back
        return self.request("POST", f"/rest/v1/{table}?select={select}", token, row, {"Prefer": "return=representation"})

    def patch(self, table, query, body, token, select="id"):
        return self.request("PATCH", f"/rest/v1/{table}?{query}&select={select}", token, body,
                            {"Prefer": "return=representation"})

    def delete(self, table, query, token):
        return self.request("DELETE", f"/rest/v1/{table}?{query}", token)

    def fn_raw(self, name, body, token=None):
        return self.request("POST", f"/functions/v1/{name}", token, body)

    def fn(self, name, body, token=None):
        """Calls an Edge Function; raises Blocked when it reports a missing secret (docs/PHASE8.md §3.3)."""
        status, out = self.fn_raw(name, body, token)
        if status == 503 and isinstance(out, dict) and out.get("error") == "not_configured":
            raise Blocked(", ".join(out.get("missing") or ["unknown"]))
        return status, out

    # -- small helpers -------------------------------------------------------
    @staticmethod
    def denied(status):
        return status >= 400

    # Errors that mean "this doesn't exist yet" (migration not applied), not "you're not allowed"
    MISSING_CODES = {"42703", "42P01", "42883", "PGRST202", "PGRST204", "PGRST205"}

    @classmethod
    def refused(cls, status, body):
        """Denied for a real reason: a 4xx that isn't a missing column, table or function."""
        code = body.get("code") if isinstance(body, dict) else None
        return status >= 400 and code not in cls.MISSING_CODES

    @staticmethod
    def mentions(body, text):
        return text in (body if isinstance(body, str) else json.dumps(body))

    @staticmethod
    def parse_time(value):
        return datetime.datetime.fromisoformat(value)

    def iso(self, hours):
        return (self.now + datetime.timedelta(hours=hours)).isoformat()

    @staticmethod
    def id(email):
        return IDS[email]

    def make_event(self, title, start_in_hours, host=HOST, mode="none", cents=500, cutoff_hours=24, extra=None):
        """Creates a temporary event (deleted at the end). Returns (event id, invite code), or (None, None)."""
        row = {"host_id": IDS[host], "title": TEMP_PREFIX + title, "date": self.iso(start_in_hours),
               "address": TEMP_ADDRESS, "deposit_mode": mode, "deposit_cents": cents, "cutoff_hours": cutoff_hours,
               **(extra or {})}
        token = self.login(host)
        status, body = self.insert("events", row, token)
        if status != 201:
            self.last_error = (status, body)
            return None, None
        event_id = body[0]["id"]
        self.temp_events.append((event_id, host))
        _, invites = self.get("event_invites", token, f"event_id=eq.{event_id}&select=code")
        code = invites[0]["code"] if isinstance(invites, list) and invites else None
        return event_id, code

    def delete_event(self, event_id):
        for i, (eid, host) in enumerate(self.temp_events):
            if eid == event_id:
                del self.temp_events[i]
                return self.delete("events", f"id=eq.{event_id}", self.login(host))
        return None

    def join(self, code, *emails):
        for email in emails:
            self.rpc("accept_invite", {"p_code": code}, self.login(email))

    def rsvp(self, event_id, email, status):
        return self.patch("rsvps", f"event_id=eq.{event_id}&user_id=eq.{IDS[email]}", {"status": status},
                          self.login(email), select="status")

    def notifications(self, email, type_, event_id):
        _, rows = self.get("notifications", self.login(email), f"type=eq.{type_}&event_id=eq.{event_id}&select=id")
        return len(rows) if isinstance(rows, list) else 0

    def on_cleanup(self, fn):
        self.cleanups.append(fn)

    def cleanup(self):
        # Events first (their debts and RSVPs go with them), then whatever the tests registered
        for event_id, host in reversed(self.temp_events):
            self.delete("events", f"id=eq.{event_id}", self.login(host))
        self.temp_events.clear()
        for fn in reversed(self.cleanups):
            try:
                fn()
            except Exception as e:  # noqa: BLE001 — keep cleaning up whatever else we can
                print(f"  ⚠️  a clean-up step failed: {type(e).__name__}: {e}")
        self.cleanups.clear()
        for token in self._tokens.values():
            self.rpc("clear_test_notifications", {"p_since": self.run_started}, token)
