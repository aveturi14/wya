"""Access-control checks against the dev Supabase project.

Logs in as the seed accounts (see supabase/seed.sql) and as a logged-out
visitor, and checks what each can read and write. Safe to re-run: anything
it changes is restored.

    python3 -I supabase/tests/rls_check.py

Reads the project URL and publishable key from .env.local if present, else
.env. Refuses to run against anything but wya-dev: it signs in as the seed
accounts and edits seed data.
"""

import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
SEED_EVENT = "33333333-3333-3333-3333-333333333333"
GUEST_ID = "22222222-2222-2222-2222-222222222222"
STRANGER_ID = "55555555-5555-5555-5555-555555555555"
HOST_ID = "11111111-1111-1111-1111-111111111111"


DEV_PROJECT_REF = "gvfcjxldokhodgnmmqar"


def load_env():
    env = {}
    env_file = ROOT / ".env.local" if (ROOT / ".env.local").exists() else ROOT / ".env"
    for line in env_file.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env["EXPO_PUBLIC_SUPABASE_URL"], env["EXPO_PUBLIC_SUPABASE_ANON_KEY"]


URL, KEY = load_env()
if DEV_PROJECT_REF not in URL:
    sys.exit(f"Refusing to run: {URL} is not the wya-dev project")
PASSWORD = re.search(r"password for all: (\S+)\)", (ROOT / "supabase/seed.sql").read_text()).group(1)


def request(method, path, token=None, body=None, headers=None):
    req = urllib.request.Request(URL + path, method=method)
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {token or KEY}")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw.decode()


def login(email):
    status, body = request("POST", "/auth/v1/token?grant_type=password", body={"email": email, "password": PASSWORD})
    if status != 200:
        sys.exit(f"Login failed for {email}: {body}")
    return body["access_token"]


def get(table, token=None, query="select=*"):
    return request("GET", f"/rest/v1/{table}?{query}", token)


def rpc(fn, args, token=None):
    return request("POST", f"/rest/v1/rpc/{fn}", token, args)


def patch(table, query, body, token):
    return request("PATCH", f"/rest/v1/{table}?{query}", token, body, {"Prefer": "return=representation"})


failures = []


def check(name, ok, detail=""):
    print(("  ✅ " if ok else "  ❌ ") + name + ("" if ok else f"  →  {detail}"))
    if not ok:
        failures.append(name)


def denied(status):
    return status >= 400


# ---------------------------------------------------------------------------
print("Logged-out visitor")
for table in ["events", "profiles", "rsvps", "event_invites", "chat_messages"]:
    status, rows = get(table)
    check(f"can't read {table}", status >= 400 or rows == [], (status, rows))
status, rows = rpc("get_invite_preview", {"p_code": "seedinvite"})
check("invite preview shows the event title", status == 200 and rows and rows[0]["title"] == "Seed Dinner Party", (status, rows))
check("invite preview hides the address", status == 200 and rows and "address" not in rows[0], rows)
status, rows = rpc("get_invite_preview", {"p_code": "not-a-code"})
check("invalid invite code previews nothing", status == 200 and rows == [], (status, rows))
status, body = rpc("accept_invite", {"p_code": "seedinvite"})
check("can't accept an invite", denied(status), (status, body))
status, body = rpc("get_invite_code", {"p_event_id": SEED_EVENT})
check("can't get an invite code", denied(status), (status, body))
for helper in ["is_event_host", "is_event_guest", "can_chat"]:
    status, body = rpc(helper, {"p_event_id": SEED_EVENT})
    check(f"can't call helper {helper} over the API", denied(status), (status, body))
status, body = request("POST", "/storage/v1/object/list/avatars", body={"prefix": ""})
check("can't list avatar files", denied(status) or body == [], (status, body))

# ---------------------------------------------------------------------------
print("Stranger (logged in, never invited)")
stranger = login("stranger@wya.test")
status, rows = get("events", stranger, "select=id,host_id")
own_events = [r["id"] for r in rows] if status == 200 else []
check("sees no one else's events", status == 200 and all(r["host_id"] == STRANGER_ID for r in rows), rows)
status, rows = get("events", stranger, f"id=eq.{SEED_EVENT}")
check("can't open the seed event by id", status == 200 and rows == [], rows)
status, rows = get("profiles", stranger, "select=id")
check("sees only their own profile", status == 200 and [r["id"] for r in rows] == [STRANGER_ID], rows)
status, rows = get("event_invites", stranger, "select=event_id")
check("sees no one else's invite codes", status == 200 and all(r["event_id"] in own_events for r in rows), rows)
status, body = rpc("get_invite_code", {"p_event_id": SEED_EVENT}, stranger)
check("gets no invite code for the seed event", status == 200 and body is None, (status, body))
status, body = request("POST", "/rest/v1/rsvps", stranger, {"event_id": SEED_EVENT, "user_id": STRANGER_ID, "status": "yes"})
check("can't insert an RSVP directly", denied(status), (status, body))
status, rows = get("chat_messages", stranger)
check("sees no chat messages", status == 200 and rows == [], rows)
status, body = request("POST", "/rest/v1/chat_messages", stranger, {"event_id": SEED_EVENT, "user_id": STRANGER_ID, "content": "hi"})
check("can't post in the seed event's chat", denied(status), (status, body))

# ---------------------------------------------------------------------------
print("Guest (RSVP'd Going to the seed event)")
guest = login("guest@wya.test")
status, rows = get("events", guest, "select=id")
ids = [r["id"] for r in rows] if status == 200 else []
check("sees the seed event", SEED_EVENT in ids, rows)
status, rows = get("rsvps", guest, "select=user_id")
check("sees only their own RSVPs", status == 200 and rows and all(r["user_id"] == GUEST_ID for r in rows), rows)
status, rows = get("profiles", guest, "select=id")
pids = [r["id"] for r in rows] if status == 200 else []
check("sees the host's profile", HOST_ID in pids, rows)
check("doesn't see the stranger's profile", STRANGER_ID not in pids, rows)
status, rows = get("event_invites", guest)
check("can't read invite codes directly", status == 200 and rows == [], rows)
status, body = rpc("get_invite_code", {"p_event_id": SEED_EVENT}, guest)
check("gets the invite code while re-sharing is allowed", status == 200 and body == "seedinvite", (status, body))
status, body = patch("rsvps", f"event_id=eq.{SEED_EVENT}&user_id=eq.{GUEST_ID}", {"event_id": "00000000-0000-0000-0000-000000000000"}, guest)
check("can't move their RSVP to another event", denied(status), (status, body))
status, body = patch("rsvps", f"event_id=eq.{SEED_EVENT}&user_id=eq.{GUEST_ID}", {"status": "invited"}, guest)
check("can't set their status back to 'invited'", denied(status), (status, body))
status, body = patch("rsvps", f"event_id=eq.{SEED_EVENT}&user_id=eq.{GUEST_ID}", {"status": "maybe"}, guest)
check("can change their answer", status == 200 and body and body[0]["status"] == "maybe", (status, body))
patch("rsvps", f"event_id=eq.{SEED_EVENT}&user_id=eq.{GUEST_ID}", {"status": "yes"}, guest)
status, body = patch("events", f"id=eq.{SEED_EVENT}", {"title": "Hacked"}, guest)
check("can't edit the host's event", status == 200 and body == [] or denied(status), (status, body))
status, rows = get("chat_messages", guest, f"event_id=eq.{SEED_EVENT}")
check("can read the event chat", status == 200 and len(rows) > 0, (status, rows))

# ---------------------------------------------------------------------------
print("Host")
host = login("host@wya.test")
status, rows = get("rsvps", host, f"event_id=eq.{SEED_EVENT}&select=user_id")
check("sees guests' RSVPs for their event", status == 200 and GUEST_ID in [r["user_id"] for r in rows], rows)
status, rows = get("event_invites", host, f"event_id=eq.{SEED_EVENT}")
check("can read their invite code", status == 200 and rows and rows[0]["code"] == "seedinvite", rows)
status, body = patch("events", f"id=eq.{SEED_EVENT}", {"allow_guest_invites": False}, host)
check("can turn off guest re-sharing", status == 200 and body and body[0]["allow_guest_invites"] is False, (status, body))
status, body = rpc("get_invite_code", {"p_event_id": SEED_EVENT}, guest)
check("guest gets no code once re-sharing is off", status == 200 and body is None, (status, body))
status, body = rpc("get_invite_code", {"p_event_id": SEED_EVENT}, host)
check("host still gets the code", status == 200 and body == "seedinvite", (status, body))
patch("events", f"id=eq.{SEED_EVENT}", {"allow_guest_invites": True}, host)

# ---------------------------------------------------------------------------
print("Joiner (accepts the seed invite)")
joiner = login("joiner@wya.test")
status, body = rpc("accept_invite", {"p_code": "seedinvite"}, joiner)
check("accepting the invite returns the event id", status == 200 and body == SEED_EVENT, (status, body))
status, body = rpc("accept_invite", {"p_code": "not-a-code"}, joiner)
check("an invalid code returns nothing", status == 200 and body is None, (status, body))
status, rows = get("events", joiner, f"id=eq.{SEED_EVENT}&select=id")
check("can now see the event", status == 200 and len(rows) == 1, rows)
status, rows = get("rsvps", joiner, f"event_id=eq.{SEED_EVENT}&select=status")
check("has an RSVP row (invited until they answer)", status == 200 and len(rows) == 1, rows)
if rows and rows[0]["status"] == "invited":
    status, msgs = get("chat_messages", joiner, f"event_id=eq.{SEED_EVENT}")
    check("can't read the chat before answering Going/Maybe", status == 200 and msgs == [], msgs)

print()
if failures:
    print(f"{len(failures)} check(s) failed")
    sys.exit(1)
print("All access-control checks passed")
