"""Access-control checks against the dev Supabase project.

Logs in as the seed accounts (see supabase/seed.sql) and as a logged-out
visitor, and checks what each can read and write. Safe to re-run: anything
it changes is restored.

    python3 -I supabase/tests/rls_check.py

Reads the project URL and publishable key from .env.local if present, else
.env. Refuses to run against anything but wya-dev: it signs in as the seed
accounts and edits seed data.
"""

import concurrent.futures
import datetime
import json
import pathlib
import re
import os
import sys
import urllib.error
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
SEED_EVENT = "33333333-3333-3333-3333-333333333333"
GUEST_ID = "22222222-2222-2222-2222-222222222222"
STRANGER_ID = "55555555-5555-5555-5555-555555555555"
HOST_ID = "11111111-1111-1111-1111-111111111111"
JOINER_ID = "66666666-6666-6666-6666-666666666666"


DEV_PROJECT_REF = "gvfcjxldokhodgnmmqar"
# Activity items from this run are cleared at the end (a little slack for clock drift)
RUN_STARTED = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=5)).isoformat()


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
PASSWORD = os.environ.get("WYA_TEST_PASSWORD") or sys.exit("Set WYA_TEST_PASSWORD (the shared @wya.test password, see .env.example) and re-run.")


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
    # events.address isn't selectable (address gating), so return the changed columns instead of `*`
    if table == "events" and "select=" not in query:
        query += "&select=" + ",".join(["id"] + [k for k in body if k != "address"])
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
# Posters (9.3): a logged-out invite draws the poster and explains the pledge, but never names guests
check("invite preview has the poster and pledge fields", status == 200 and rows and {"poster_line", "stickers", "venue_name", "going_count", "maybe_count", "deposit_mode", "deposit_cents", "cutoff_hours"} <= set(rows[0]), rows)
check("invite preview counts guests without naming them", status == 200 and rows and isinstance(rows[0]["going_count"], int) and not any(k in rows[0] for k in ("guests", "guest_names", "faces")), rows)
check("invite preview uses the new looks", status == 200 and rows and rows[0]["theme"] in ("sunset", "violet", "ocean", "lime", "peach", "tomato", "midnight"), rows)
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
status, rows = get("events", stranger, f"id=eq.{SEED_EVENT}&select=id")
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

# ---------------------------------------------------------------------------
print("Guest list")
status, rows = rpc("get_guest_list", {"p_event_id": SEED_EVENT}, host)
gary = next((r for r in rows if r["user_id"] == GUEST_ID), None) if status == 200 else None
check("host sees guests with their notes", gary is not None and gary["additional_details"] == "Vegetarian, +1", (status, rows))
check("host also sees guests who haven't answered", status == 200 and any(r["status"] == "invited" for r in rows), rows)
check("host sees each guest's track record", gary is not None and set(gary["reliability"] or {}) == {"attended", "counted", "open_debts"}, gary)
status, rows = rpc("get_guest_list", {"p_event_id": SEED_EVENT}, guest)
check("guest sees who's going", status == 200 and any(r["user_id"] == GUEST_ID for r in rows), (status, rows))
check("guest never sees anyone's notes", status == 200 and all(r["additional_details"] is None for r in rows), rows)
check("guest sees only Going/Maybe", status == 200 and all(r["status"] in ("yes", "maybe") for r in rows), rows)
check("guest never sees pledges or track records", status == 200 and all(r["pledge_cents"] is None and r["reliability"] is None for r in rows), rows)
status, rows = rpc("get_guest_list", {"p_event_id": SEED_EVENT}, stranger)
check("stranger gets an empty guest list", status == 200 and rows == [], (status, rows))
status, body = rpc("get_guest_list", {"p_event_id": SEED_EVENT})
check("logged-out visitor can't get the guest list", denied(status), (status, body))

# ---------------------------------------------------------------------------
print("Removing a guest (on a temporary event, deleted at the end)")
status, body = request("POST", "/rest/v1/events?select=id", host,
                       {"host_id": HOST_ID, "title": "RLS temp event", "date": "2030-01-01T19:00:00Z", "address": "Nowhere"},
                       {"Prefer": "return=representation"})
temp_id = body[0]["id"] if status == 201 else None
check("host can create an event", temp_id is not None, (status, body))
if temp_id:
    _, invite = get("event_invites", host, f"event_id=eq.{temp_id}&select=code")
    code = invite[0]["code"]
    rpc("accept_invite", {"p_code": code}, joiner)
    rpc("accept_invite", {"p_code": code}, guest)
    status, rows = get("notifications", host, f"event_id=eq.{temp_id}&type=eq.joined&select=actor_id")
    check("host is notified when a guest joins", status == 200 and JOINER_ID in [r["actor_id"] for r in rows], (status, rows))
    status, body = patch("events", f"id=eq.{temp_id}", {"date": "2030-01-02T19:00:00Z"}, host)
    check("host can change the event's time", status == 200 and len(body) == 1, (status, body))
    status, body = patch("events", f"id=eq.{temp_id}", {"poster_line": "Jess turns", "stickers": ["bring a plus one"], "theme": "midnight"}, host)
    check("host can set the poster's serif line, a sticker and a new look", status == 200 and body and body[0]["stickers"] == ["bring a plus one"], (status, body))
    status, body = patch("events", f"id=eq.{temp_id}", {"stickers": ["one", "two", "three"]}, host)
    check("an event can't have more than two host stickers", denied(status), (status, body))
    status, body = patch("events", f"id=eq.{temp_id}", {"stickers": ["x" * 25]}, host)
    check("a sticker can't be longer than 24 characters", denied(status), (status, body))
    status, body = patch("events", f"id=eq.{temp_id}", {"poster_line": "x" * 41}, host)
    check("the serif line can't be longer than 40 characters", denied(status), (status, body))
    status, body = patch("events", f"id=eq.{temp_id}", {"theme": "bubblegum"}, host)
    check("the old look names are gone", denied(status), (status, body))
    status, rows = get("events", guest, f"id=eq.{temp_id}&select=poster_line,stickers")
    check("a guest can read the poster columns", status == 200 and rows and rows[0]["poster_line"] == "Jess turns", (status, rows))
    status, rows = get("events", stranger, f"id=eq.{temp_id}&select=poster_line,stickers")
    check("a stranger can't read the poster columns", status == 200 and rows == [], (status, rows))
    status, rows = get("notifications", joiner, f"event_id=eq.{temp_id}&type=eq.event_updated&select=data")
    check("guests are notified when the time changes", status == 200 and rows and "time" in rows[0]["data"]["changes"], (status, rows))
    status, body = rpc("remove_guest", {"p_event_id": temp_id, "p_user_id": JOINER_ID}, guest)
    check("a guest can't remove anyone", denied(status), (status, body))
    status, body = rpc("remove_guest", {"p_event_id": temp_id, "p_user_id": JOINER_ID}, host)
    check("host can remove a guest", status == 200 and body is True, (status, body))
    status, rows = get("events", joiner, f"id=eq.{temp_id}&select=id")
    check("removed guest loses access to the event", status == 200 and rows == [], rows)
    status, body = rpc("accept_invite", {"p_code": code}, joiner)
    check("removed guest can't rejoin with the invite link", denied(status), (status, body))
    status, body = request("DELETE", f"/rest/v1/events?id=eq.{temp_id}&select=id", guest, headers={"Prefer": "return=representation"})
    check("a guest can't delete the host's event", status == 200 and body == [] or denied(status), (status, body))
    status, body = request("DELETE", f"/rest/v1/events?id=eq.{temp_id}&select=id", host, headers={"Prefer": "return=representation"})
    check("host can delete their event", status == 200 and len(body) == 1, (status, body))
    status, rows = get("notifications", guest, "type=eq.event_cancelled&data->>title=eq.RLS%20temp%20event&select=id,event_id&order=created_at.desc&limit=1")
    check("guests are notified when an event is cancelled", status == 200 and len(rows) == 1 and rows[0]["event_id"] is None, (status, rows))

# ---------------------------------------------------------------------------
print("Chats")
status, rows = rpc("get_my_chats", {}, guest)
check("guest's chat list includes the seed event", status == 200 and SEED_EVENT in [r["event_id"] for r in rows], (status, rows))
status, rows = rpc("get_my_chats", {}, joiner)
check("an invited (unanswered) guest doesn't get the chat", status == 200 and SEED_EVENT not in [r["event_id"] for r in rows], (status, rows))
status, rows = rpc("get_my_chats", {}, stranger)
check("stranger's chat list has no one else's events", status == 200 and SEED_EVENT not in [r["event_id"] for r in rows], (status, rows))
status, body = rpc("get_my_chats", {})
check("logged-out visitor can't list chats", denied(status), (status, body))
rpc("mark_chat_read", {"p_event_id": SEED_EVENT}, guest)
status, rows = rpc("get_my_chats", {}, guest)
seed = next((r for r in rows if r["event_id"] == SEED_EVENT), None) if status == 200 else None
check("marking a chat read clears its unread count", seed is not None and seed["unread"] == 0, seed)
status, rows = get("chat_reads", host, f"user_id=eq.{GUEST_ID}")
check("nobody can see someone else's read receipts", status == 200 and rows == [], rows)

# ---------------------------------------------------------------------------
print("Activity")
status, rows = get("notifications", host, f"event_id=eq.{SEED_EVENT}&type=eq.rsvp&actor_id=eq.{GUEST_ID}&select=data")
check("host is notified when a guest changes their RSVP", status == 200 and len(rows) > 0, (status, rows))
status, rows = get("notifications", guest, f"user_id=eq.{HOST_ID}")
check("nobody can read someone else's notifications", status == 200 and rows == [], rows)
status, body = request("POST", "/rest/v1/notifications", guest, {"user_id": HOST_ID, "type": "joined", "data": {}})
check("nobody can create notifications directly", denied(status), (status, body))
status, rows = get("notifications", host, "select=id&limit=1")
if rows:
    status, body = patch("notifications", f"id=eq.{rows[0]['id']}", {"type": "event_cancelled"}, host)
    check("notifications can't be rewritten (only marked read)", denied(status), (status, body))
status, body = rpc("mark_notifications_read", {}, host)
status, rows = get("notifications", host, "read_at=is.null&select=id")
check("mark_notifications_read clears the unread count", status == 200 and rows == [], rows)

# ---------------------------------------------------------------------------
print("Pledges: PayID")
HOST_PAYID = "0412345678"
status, body = rpc("set_payid", {"p_value": HOST_PAYID}, host)
check("a mobile PayID is saved in +61 format", status == 200 and body == "+61412345678", (status, body))
status, body = rpc("set_payid", {"p_value": "51 824 753 556"}, stranger)
check("a valid ABN is accepted", status == 200 and body == "51824753556", (status, body))
status, body = rpc("set_payid", {"p_value": "12 345 678 901"}, stranger)
check("an ABN with a bad checksum is rejected", denied(status), (status, body))
status, body = rpc("set_payid", {"p_value": "not a payid"}, stranger)
check("nonsense is rejected", denied(status), (status, body))
rpc("remove_payid", {}, stranger)
status, rows = get("payment_methods", guest, f"user_id=eq.{HOST_ID}")
check("nobody can read someone else's PayID", status == 200 and rows == [], rows)
status, body = request("POST", "/rest/v1/payment_methods", stranger, {"user_id": STRANGER_ID, "provider": "payid", "value": "x"})
check("PayIDs can't be written without validation", denied(status), (status, body))
# Since the wallet (9.13) pledges are paid into the host's wya wallet: no PayID needed
status, body = request("POST", "/rest/v1/events?select=id", joiner,
                       {"host_id": JOINER_ID, "title": "RLS temp event: no PayID party", "date": "2030-01-01T19:00:00Z", "address": "Nowhere", "deposit_mode": "pledge"},
                       {"Prefer": "return=representation"})
check("a pledge event no longer needs the host to have a PayID", status == 201, (status, body))
if status == 201 and isinstance(body, list) and body:
    request("DELETE", f"/rest/v1/events?id=eq.{body[0]['id']}", joiner)

now = datetime.datetime.now(datetime.timezone.utc)
def iso(delta_hours):
    return (now + datetime.timedelta(hours=delta_hours)).isoformat()

def make_event(title, start_in_hours, cutoff_hours=24, mode="pledge", cents=500):
    status, body = request("POST", "/rest/v1/events?select=id", host,
                           {"host_id": HOST_ID, "title": title, "date": iso(start_in_hours), "address": "Test St",
                            "deposit_mode": mode, "deposit_cents": cents, "cutoff_hours": cutoff_hours},
                           {"Prefer": "return=representation"})
    if status != 201:
        return None, None
    event_id = body[0]["id"]
    _, inv = get("event_invites", host, f"event_id=eq.{event_id}&select=code")
    return event_id, inv[0]["code"]

def rsvp(event_id, user_id, token, status_value):
    return patch("rsvps", f"event_id=eq.{event_id}&user_id=eq.{user_id}", {"status": status_value}, token)

def pledge_of(event_id, user_id):
    _, rows = rpc("get_guest_list", {"p_event_id": event_id}, host)
    row = next((r for r in rows if r["user_id"] == user_id), None)
    return row["pledge_cents"] if row else "missing"

def debt(event_id, user_id, token):
    _, rows = get("obligations", token, f"event_id=eq.{event_id}&guest_id=eq.{user_id}")
    return rows[0] if rows else None

def notified(token, type_, event_id):
    _, rows = get("notifications", token, f"type=eq.{type_}&event_id=eq.{event_id}&select=id")
    return len(rows) if isinstance(rows, list) else 0

temp_events = []

# ---------------------------------------------------------------------------
print("Pledges: saying I'm in, before the cutoff")
e1, code1 = make_event("Pledge test: early", start_in_hours=72, cutoff_hours=24)
temp_events.append(e1)
check("host can create a pledge event", e1 is not None, e1)
if e1:
    rpc("accept_invite", {"p_code": code1}, guest)
    rpc("accept_invite", {"p_code": code1}, joiner)
    rsvp(e1, GUEST_ID, guest, "yes")
    check("I'm in on a pledge event saves the pledge", pledge_of(e1, GUEST_ID) == 500, pledge_of(e1, GUEST_ID))
    rsvp(e1, GUEST_ID, guest, "no")
    check("cancelling before the cutoff is free (no debt, pledge cleared)",
          debt(e1, GUEST_ID, guest) is None and pledge_of(e1, GUEST_ID) is None, (debt(e1, GUEST_ID, guest), pledge_of(e1, GUEST_ID)))
    rsvp(e1, GUEST_ID, guest, "yes")
    patch("events", f"id=eq.{e1}", {"deposit_cents": 1000}, host)
    rsvp(e1, JOINER_ID, joiner, "yes")
    check("a guest keeps the amount they agreed to when the host changes it",
          pledge_of(e1, GUEST_ID) == 500 and pledge_of(e1, JOINER_ID) == 1000, (pledge_of(e1, GUEST_ID), pledge_of(e1, JOINER_ID)))
    status, body = rsvp(e1, STRANGER_ID, stranger, "yes")
    check("someone not invited can't RSVP", status == 200 and body == [] or denied(status), (status, body))

# ---------------------------------------------------------------------------
print("Pledges: after the cutoff")
e2, code2 = make_event("Pledge test: late", start_in_hours=2, cutoff_hours=24)
temp_events.append(e2)
if e2:
    rpc("accept_invite", {"p_code": code2}, guest)
    rpc("accept_invite", {"p_code": code2}, joiner)
    status, body = rsvp(e2, JOINER_ID, joiner, "maybe")
    check("Maybe isn't allowed after the cutoff", denied(status) and "PAST_CUTOFF" in json.dumps(body), (status, body))
    rsvp(e2, GUEST_ID, guest, "yes")
    rsvp(e2, GUEST_ID, guest, "no")
    d = debt(e2, GUEST_ID, guest)
    check("a late cancellation creates a debt", d is not None and d["reason"] == "late_cancel" and d["amount_cents"] == 500, d)
    check("the guest is told they owe", notified(guest, "pledge_owed", e2) == 1)
    check("the host sees the debt too", debt(e2, GUEST_ID, host) is not None)
    check("nobody else sees it", debt(e2, GUEST_ID, stranger) is None)
    status, body = request("POST", "/rest/v1/obligations", stranger, {"event_id": e2, "guest_id": STRANGER_ID, "host_id": HOST_ID, "amount_cents": 1, "reason": "no_show"})
    check("debts can't be created directly", denied(status), (status, body))
    if d:
        status, body = patch("obligations", f"id=eq.{d['id']}", {"status": "paid"}, guest)
        check("debts can't be edited directly", denied(status), (status, body))
        status, rows = rpc("get_payment_instructions", {"p_obligation_id": d["id"]}, guest)
        check("the guest who owes sees the host's PayID", status == 200 and rows and rows[0]["payid"] == "+61412345678", (status, rows))
        status, body = rpc("get_payment_instructions", {"p_obligation_id": d["id"]}, stranger)
        check("nobody else gets the PayID", denied(status), (status, body))

        print("Pledges: owing blocks RSVPs to that host")
        rsvp(e1, GUEST_ID, guest, "no")
        status, body = rsvp(e1, GUEST_ID, guest, "yes")
        check("can't say I'm in to the same host's event while owing", denied(status) and "OPEN_DEBT" in json.dumps(body), (status, body))
        status, body = rsvp(e1, GUEST_ID, guest, "maybe")
        check("can't say Maybe either", denied(status), (status, body))
        status, body = rpc("remove_payid", {}, host)
        check("a host can't remove their PayID while owed money", denied(status), (status, body))

        print("Pledges: paying, disputing, excuses, waiving")
        status, body = rpc("claim_paid", {"p_obligation_id": d["id"]}, stranger)
        check("only the guest can say they've paid", denied(status), (status, body))
        rpc("claim_paid", {"p_obligation_id": d["id"]}, guest)
        check("I've paid settles it straight away", debt(e2, GUEST_ID, guest)["status"] == "paid")
        check("the host is told", notified(host, "payment_claimed", e2) >= 1)
        status, body = rsvp(e1, GUEST_ID, guest, "yes")
        check("paying lifts the RSVP block", status == 200 and body and body[0]["status"] == "yes", (status, body))
        status, body = rpc("dispute_payment", {"p_obligation_id": d["id"]}, guest)
        check("only the host can dispute", denied(status), (status, body))
        rpc("dispute_payment", {"p_obligation_id": d["id"]}, host)
        check("a dispute reopens the debt and tells the guest",
              debt(e2, GUEST_ID, guest)["status"] == "disputed" and notified(guest, "payment_disputed", e2) == 1)
        rpc("submit_excuse", {"p_obligation_id": d["id"], "p_excuse": "My car broke down"}, guest)
        check("the guest can send an excuse", debt(e2, GUEST_ID, guest)["status"] == "excuse_pending")
        status, body = rpc("submit_excuse", {"p_obligation_id": d["id"], "p_excuse": "Again"}, guest)
        check("only one excuse per debt", denied(status), (status, body))
        status, body = rpc("resolve_excuse", {"p_obligation_id": d["id"], "p_accept": True}, guest)
        check("only the host decides on excuses", denied(status), (status, body))
        rpc("resolve_excuse", {"p_obligation_id": d["id"], "p_accept": False}, host)
        dd = debt(e2, GUEST_ID, guest)
        check("a declined excuse means still owed", dd["status"] == "owed" and dd["excuse_declined"] is True, dd)
        status, body = rpc("submit_excuse", {"p_obligation_id": d["id"], "p_excuse": "Please"}, guest)
        check("no second excuse after a decline", denied(status), (status, body))
        rpc("waive_obligation", {"p_obligation_id": d["id"]}, host)
        check("the host can let it go", debt(e2, GUEST_ID, guest)["status"] == "waived" and notified(guest, "debt_waived", e2) == 1)

# ---------------------------------------------------------------------------
print("Pledges: who came")
e3, code3 = make_event("Pledge test: started", start_in_hours=-1, cutoff_hours=24)
temp_events.append(e3)
if e3:
    rpc("accept_invite", {"p_code": code3}, guest)
    rpc("accept_invite", {"p_code": code3}, joiner)
    rsvp(e3, GUEST_ID, guest, "yes")
    rsvp(e3, JOINER_ID, joiner, "yes")
    status, body = rpc("record_attendance", {"p_event_id": e3, "p_absent": [JOINER_ID]}, guest)
    check("only the host marks attendance", denied(status), (status, body))
    rpc("record_attendance", {"p_event_id": e3, "p_absent": [JOINER_ID]}, host)
    d3 = debt(e3, JOINER_ID, joiner)
    check("a no-show with a pledge owes it", d3 is not None and d3["reason"] == "no_show", d3)
    check("someone who came owes nothing", debt(e3, GUEST_ID, guest) is None)
    rpc("record_attendance", {"p_event_id": e3, "p_absent": []}, host)
    check("re-ticking a guest removes their no-show debt", debt(e3, JOINER_ID, joiner) is None)
    rpc("record_attendance", {"p_event_id": e3, "p_absent": [JOINER_ID]}, host)
    status, rows = rpc("get_reliability", {"p_user_id": JOINER_ID}, host)
    check("hosts see a guest's reliability", status == 200 and rows and rows[0]["counted"] >= 1 and rows[0]["open_debts"] >= 1, rows)
    status, rows = rpc("get_reliability", {"p_user_id": JOINER_ID}, stranger)
    check("strangers don't", status == 200 and rows == [], rows)
    status, rows = rpc("get_reliability", {"p_user_id": JOINER_ID}, joiner)
    check("guests see their own record", status == 200 and len(rows) == 1, rows)
    status, rows = rpc("get_my_obligations", {}, joiner)
    check("the guest's list of what they owe includes it", status == 200 and any(r["event_id"] == e3 and r["role"] == "guest" for r in rows), rows)
    status, body = rpc("waive_all", {"p_event_id": e3}, host)
    check("the host can waive everything at once", status == 200 and body >= 1 and debt(e3, JOINER_ID, joiner)["status"] == "waived", (status, body))
    e_future, _ = (e1, None)
    status, body = rpc("record_attendance", {"p_event_id": e1, "p_absent": []}, host)
    check("attendance can't be marked before the event starts", denied(status), (status, body))

# ---------------------------------------------------------------------------
print("Pledges: turning pledges on and off")
e4, code4 = make_event("Pledge test: switching", start_in_hours=96, cutoff_hours=24, mode="none")
temp_events.append(e4)
if e4:
    rpc("accept_invite", {"p_code": code4}, guest)
    rsvp(e4, GUEST_ID, guest, "yes")
    check("no pledge on a non-pledge event", pledge_of(e4, GUEST_ID) is None)
    patch("events", f"id=eq.{e4}", {"deposit_mode": "pledge"}, host)
    check("turning pledges on doesn't pledge people who already said yes",
          pledge_of(e4, GUEST_ID) is None and notified(guest, "pledge_added", e4) == 1, pledge_of(e4, GUEST_ID))
    rsvp(e4, GUEST_ID, guest, "yes")
    check("confirming I'm in again pledges them", pledge_of(e4, GUEST_ID) == 500, pledge_of(e4, GUEST_ID))
    status, body = rpc("release_pledges", {"p_event_id": e4}, guest)
    check("only the host can release pledges", denied(status), (status, body))
    patch("events", f"id=eq.{e4}", {"deposit_mode": "none"}, host)
    check("turning pledges off keeps existing pledges (option b)", pledge_of(e4, GUEST_ID) == 500)
    rpc("release_pledges", {"p_event_id": e4}, host)
    check("releasing clears everyone's pledge and tells them (option a)",
          pledge_of(e4, GUEST_ID) is None and notified(guest, "pledge_released", e4) == 1, pledge_of(e4, GUEST_ID))

# ---------------------------------------------------------------------------
print("Pledges: Maybe reminders and expiry")
e5, code5 = make_event("Pledge test: maybes", start_in_hours=30, cutoff_hours=24)
temp_events.append(e5)
if e5:
    rpc("accept_invite", {"p_code": code5}, joiner)
    rsvp(e5, JOINER_ID, joiner, "maybe")
    rpc("process_pledge_deadlines", {}, joiner)
    rpc("process_pledge_deadlines", {}, joiner)
    check("a Maybe is reminded once when the cutoff is under 24 hours away", notified(joiner, "maybe_reminder", e5) == 1)
    patch("events", f"id=eq.{e5}", {"date": iso(2)}, host)
    rpc("process_pledge_deadlines", {}, joiner)
    _, rows = get("rsvps", joiner, f"event_id=eq.{e5}&user_id=eq.{JOINER_ID}&select=status")
    check("at the cutoff a Maybe becomes Can't go, and is told",
          rows and rows[0]["status"] == "no" and notified(joiner, "maybe_expired", e5) == 1, rows)

# ---------------------------------------------------------------------------
print("Album")
JPEG = (ROOT / "supabase/tests/fixtures/tiny.jpg").read_bytes()  # an 8×8 JPEG
album_files = []


def upload(path, token):
    req = urllib.request.Request(f"{URL}/storage/v1/object/album/{path}", data=JPEG, method="POST",
                                 headers={"apikey": KEY, "Authorization": f"Bearer {token}", "Content-Type": "image/jpeg"})
    try:
        with urllib.request.urlopen(req) as resp:
            album_files.append(path)
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code


def add_photo(event_id, user_id, token):
    """Upload both files, then register the photo. Returns (photo id, rpc status, rpc body)."""
    pid = str(uuid.uuid4())
    upload(f"{event_id}/{user_id}/{pid}.jpg", token)
    upload(f"{event_id}/{user_id}/{pid}_thumb.jpg", token)
    status, body = rpc("add_photo", {"p_event_id": event_id, "p_photo_id": pid, "p_width": 1600, "p_height": 1200}, token)
    return pid, status, body


def sign(path, token):
    return request("POST", f"/storage/v1/object/sign/album/{path}", token, {"expiresIn": 60})


def photos_in(event_id, token):
    status, rows = get("photos", token, f"event_id=eq.{event_id}&select=id")
    return rows if status == 200 else None


ea, code_a = make_event("Album test: started", start_in_hours=-1, mode="none")
eb, code_b = make_event("Album test: upcoming", start_in_hours=48, mode="none")
ec, code_c = make_event("Album test: long ago", start_in_hours=-24 * 31, mode="none")
temp_events.extend([ea, eb, ec])
if ea and eb and ec:
    for code in (code_a, code_b, code_c):
        rpc("accept_invite", {"p_code": code}, guest)
    for e in (ea, eb, ec):
        rsvp(e, GUEST_ID, guest, "yes")
    rpc("accept_invite", {"p_code": code_a}, joiner)  # invited, hasn't answered

    pid, status, body = add_photo(ea, GUEST_ID, guest)
    check("a Going guest can add a photo once the party has started", status == 200, (status, body))
    check("the host and invited guests can see it", len(photos_in(ea, host) or []) == 1 and len(photos_in(ea, joiner) or []) == 1)
    check("a stranger can't see it", photos_in(ea, stranger) == [])
    first_path = f"{ea}/{GUEST_ID}/{pid}.jpg"
    status, body = sign(first_path, joiner)
    check("an invited guest can get a short-lived link", status == 200 and "signedURL" in (body or {}), (status, body))
    status, body = sign(first_path, stranger)
    check("a stranger can't get a link", status >= 400, (status, body))
    status, _ = request("GET", f"/storage/v1/object/public/album/{first_path}")
    check("the photo isn't reachable at a public URL", status >= 400, status)
    status, _ = request("GET", f"/storage/v1/object/authenticated/album/{first_path}", stranger)
    check("a stranger can't download it directly", status >= 400, status)

    check("a guest who hasn't answered can't upload", upload(f"{ea}/{JOINER_ID}/{uuid.uuid4()}.jpg", joiner) >= 400)
    rsvp(ea, JOINER_ID, joiner, "maybe")
    check("a Maybe can't upload", upload(f"{ea}/{JOINER_ID}/{uuid.uuid4()}.jpg", joiner) >= 400)
    check("a stranger can't upload", upload(f"{ea}/{STRANGER_ID}/{uuid.uuid4()}.jpg", stranger) >= 400)
    check("nobody can upload into someone else's folder", upload(f"{ea}/{JOINER_ID}/{uuid.uuid4()}.jpg", guest) >= 400)
    status, body = rpc("add_photo", {"p_event_id": ea, "p_photo_id": str(uuid.uuid4()), "p_width": 10, "p_height": 10}, guest)
    check("a photo can't be registered without its files", status >= 400, (status, body))
    _, status, body = add_photo(eb, GUEST_ID, guest)
    check("a Going guest can add a photo before the party starts (albums open at creation)", status == 200, (status, body))
    _, status, body = add_photo(ec, GUEST_ID, guest)
    check("the album is closed 30 days after the start", status >= 400, (status, body))

    rpc("record_attendance", {"p_event_id": ea, "p_absent": [GUEST_ID]}, host)
    _, status, body = add_photo(ea, GUEST_ID, guest)
    check("a no-show can't add photos", status >= 400, (status, body))
    rpc("record_attendance", {"p_event_id": ea, "p_absent": []}, host)

    with concurrent.futures.ThreadPoolExecutor(10) as pool:
        added = list(pool.map(lambda _: add_photo(ea, GUEST_ID, guest), range(29)))
    check("a guest can add up to 30 photos", all(s == 200 for _, s, _ in added) and len(photos_in(ea, guest)) == 30,
          [b for _, s, b in added if s != 200][:1])
    _, status, body = add_photo(ea, GUEST_ID, guest)
    check("the 31st is refused (YOUR_LIMIT)", status >= 400 and "YOUR_LIMIT" in json.dumps(body), (status, body))

    _, rows = get("notifications", host, f"type=eq.photos_added&event_id=eq.{ea}&read_at=is.null&select=data")
    check("the host gets one bundled notification that counts all 30",
          isinstance(rows, list) and len(rows) == 1 and rows[0]["data"]["count"] == 30, rows)
    check("guests who aren't going aren't notified", notified(joiner, "photos_added", ea) == 0)
    check("you're not notified about your own photos", notified(guest, "photos_added", ea) == 0)

    victim = added[0][0]
    status, body = rpc("delete_photo", {"p_photo_id": victim}, joiner)
    check("a guest can't delete someone else's photo", status >= 400, (status, body))
    status, body = request("DELETE", "/storage/v1/object/album", joiner, {"prefixes": [f"{ea}/{GUEST_ID}/{victim}.jpg"]})
    check("…or remove its file", status == 200 and body == [], (status, body))
    status, body = rpc("delete_photo", {"p_photo_id": victim}, guest)
    check("you can delete your own photo", status == 200 and body and body[0]["path"].endswith(f"{victim}.jpg"), (status, body))
    status, body = rpc("delete_photo", {"p_photo_id": added[1][0]}, host)
    check("the host can delete anyone's photo", status == 200 and len(body or []) == 1, (status, body))
    status, body = request("DELETE", "/storage/v1/object/album", host, {"prefixes": [f"{ea}/{GUEST_ID}/{added[1][0]}.jpg"]})
    check("…and its files", status == 200 and len(body or []) == 1, (status, body))

    # Photos tab (get_my_albums): the same visibility as the album itself
    def albums(token):
        status, rows = rpc("get_my_albums", {}, token)
        return {r["event_id"]: r for r in rows} if status == 200 else ("error", status, rows)
    mine = albums(guest)
    row = mine.get(ea) if isinstance(mine, dict) else None
    check("Photos tab: a Going guest sees the album with the right count", row is not None and row["photo_count"] == 28, row)
    check("Photos tab: it's marked open and has up to 6 thumbnails from that album",
          row is not None and row["is_open"] and 0 < len(row["thumb_paths"]) <= 6
          and all(p.startswith(f"{ea}/") and p.endswith("_thumb.jpg") for p in row["thumb_paths"]), row)
    # An upcoming album is listed once it has a photo (added above), and not before
    check("Photos tab: an upcoming album with a photo is listed and open",
          isinstance(mine, dict) and eb in mine and mine[eb]["is_open"] and mine[eb]["photo_count"] == 1, mine)
    ed, _ = make_event("Album test: upcoming, empty", start_in_hours=72, mode="none")
    temp_events.append(ed)
    host_albums = albums(host)
    check("Photos tab: an upcoming album with no photos isn't listed",
          ed is not None and isinstance(host_albums, dict) and ed not in host_albums, host_albums)
    check("Photos tab: a long-closed album with no photos isn't listed", isinstance(mine, dict) and ec not in mine, mine)
    host_row = (albums(host) or {}).get(ea)
    check("Photos tab: the host sees it with the same count", host_row is not None and host_row["photo_count"] == 28, host_row)
    joiner_row = (albums(joiner) or {}).get(ea)
    check("Photos tab: an invited guest (Maybe) sees it too", joiner_row is not None and joiner_row["photo_count"] == 28, joiner_row)
    strange = albums(stranger)
    check("Photos tab: a stranger sees none of these albums",
          isinstance(strange, dict) and not ({ea, eb, ec, SEED_EVENT} & set(strange)), strange)
    status, body = rpc("get_my_albums", {})
    check("Photos tab: logged-out visitors can't call get_my_albums", denied(status), (status, body))

    rpc("remove_guest", {"p_event_id": ea, "p_user_id": JOINER_ID}, host)
    check("a removed guest loses access to the album", photos_in(ea, joiner) == [] and sign(first_path, joiner)[0] >= 400)
    after = albums(joiner)
    check("Photos tab: a removed guest no longer sees the album", isinstance(after, dict) and ea not in after, after)

    # The files outlive their rows, so clear them before the events go
    for i in range(0, len(album_files), 100):
        request("DELETE", "/storage/v1/object/album", host, {"prefixes": album_files[i:i + 100]})

# ---------------------------------------------------------------------------
print("Chat images")


def upload_chat(path, token):
    req = urllib.request.Request(f"{URL}/storage/v1/object/event-images/{path}", data=JPEG, method="POST",
                                 headers={"apikey": KEY, "Authorization": f"Bearer {token}", "Content-Type": "image/jpeg"})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code


def post_message(event_id, user_id, token, content=None, image_path=None):
    return request("POST", "/rest/v1/chat_messages", token,
                   {"event_id": event_id, "user_id": user_id, "content": content, "image_path": image_path},
                   {"Prefer": "return=representation"})


ei, code_i = make_event("Chat image test", start_in_hours=48, mode="none")
temp_events.append(ei)
if ei:
    rpc("accept_invite", {"p_code": code_i}, guest)
    rsvp(ei, GUEST_ID, guest, "yes")
    mine = f"chat/{GUEST_ID}/{uuid.uuid4()}.jpg"
    check("a guest can upload into their own chat folder", upload_chat(mine, guest) == 200)
    check("nobody can upload into someone else's chat folder", upload_chat(f"chat/{HOST_ID}/{uuid.uuid4()}.jpg", guest) >= 400)
    status, body = post_message(ei, GUEST_ID, guest, image_path=mine)
    check("a Going guest can send an image-only message", status == 201, (status, body))
    status, body = post_message(ei, GUEST_ID, guest, image_path=f"chat/{HOST_ID}/x.jpg")
    check("a message can't point at someone else's image", denied(status), (status, body))
    status, body = post_message(ei, GUEST_ID, guest, image_path="https://example.com/pixel.gif")
    check("a message can't point at an outside URL", denied(status), (status, body))
    status, body = post_message(ei, GUEST_ID, guest, content="   ")
    check("an empty message is refused", denied(status), (status, body))
    _, rows = rpc("get_my_chats", {}, host)
    chat = next((r for r in rows or [] if r["event_id"] == ei), None)
    check("the chat list previews an image as 📷 Photo", chat is not None and chat["last_message"] == "📷 Photo", chat)
    status, body = request("DELETE", "/storage/v1/object/event-images", host, {"prefixes": [mine]})
    check("nobody can delete someone else's chat image", status == 200 and body == [], (status, body))
    status, body = request("DELETE", "/storage/v1/object/event-images", guest, {"prefixes": [mine]})
    check("you can delete your own chat image", status == 200 and len(body or []) == 1, (status, body))

# ---------------------------------------------------------------------------
print("Address gating (the address is the reward for committing on pledge events)")


def addresses(event_id, token):
    status, rows = rpc("get_event_addresses", {"p_event_ids": [event_id]}, token)
    return [r["address"] for r in rows] if status == 200 else ("error", status, rows)


ea_, code_a = make_event("Address gating test", start_in_hours=72, cutoff_hours=24)
temp_events.append(ea_)
if ea_:
    rpc("accept_invite", {"p_code": code_a}, guest)
    status, body = get("events", guest, f"id=eq.{ea_}&select=address")
    check("an invited guest can't select the address column", denied(status), (status, body))
    status, body = get("events", guest, f"id=eq.{ea_}")
    check("select=* on events is refused (address isn't selectable)", denied(status), (status, body))
    status, rows = get("events", guest, f"id=eq.{ea_}&select=id,title,venue_name")
    check("an invited guest still reads the other columns", status == 200 and len(rows) == 1, (status, rows))
    status, body = get("events", host, f"id=eq.{ea_}&select=address")
    check("even the host can't select the address column directly", denied(status), (status, body))
    check("the host gets the address from get_event_addresses", addresses(ea_, host) == ["Test St"], addresses(ea_, host))
    check("an invited guest gets no address on a pledge event", addresses(ea_, guest) == [], addresses(ea_, guest))
    status, _ = rsvp(ea_, GUEST_ID, guest, "maybe")
    check("a Maybe guest gets the address", status == 200 and addresses(ea_, guest) == ["Test St"], (status, addresses(ea_, guest)))
    status, _ = rsvp(ea_, GUEST_ID, guest, "yes")
    check("a Going guest gets the address", status == 200 and addresses(ea_, guest) == ["Test St"], (status, addresses(ea_, guest)))
    status, _ = rsvp(ea_, GUEST_ID, guest, "no")
    check("a Can't go guest loses the address again", status == 200 and addresses(ea_, guest) == [], (status, addresses(ea_, guest)))
    check("a stranger gets no address", addresses(ea_, stranger) == [], addresses(ea_, stranger))
    status, body = rpc("get_event_addresses", {"p_event_ids": [ea_]})
    check("logged-out visitors can't call get_event_addresses", denied(status), (status, body))
if ei:
    rpc("accept_invite", {"p_code": code_i}, joiner)
    check("on a non-pledge event an invited guest gets the address", addresses(ei, joiner) == ["Test St"], addresses(ei, joiner))

# ---------------------------------------------------------------------------
for event_id in temp_events:
    if event_id:
        request("DELETE", f"/rest/v1/events?id=eq.{event_id}", host)
status, rows = get("obligations", guest, "select=id&event_id=in.(" + ",".join(e for e in temp_events if e) + ")")
check("deleting an event deletes its debts", status == 200 and rows == [], rows)
# Uses Sam, who is owed nothing: the seed host can carry leftover debts from manual testing on the shared project
rpc("set_payid", {"p_value": HOST_PAYID}, stranger)
status, body = rpc("remove_payid", {}, stranger)
check("with nothing owed, a PayID can be removed", status in (200, 204), (status, body))

# ---------------------------------------------------------------------------
print("Test clean-up (the Activity items these tests caused)")
TEST_TITLE = re.compile(r"^(RLS temp event|No PayID party|Pledge test: |Album test: |Chat image test|Address gating test)")


def notes(token):
    _, rows = get("notifications", token, "select=id,data,created_at")
    return rows if isinstance(rows, list) else []


def from_tests(n):
    return bool(TEST_TITLE.match(n["data"].get("title") or "")) or n["created_at"] >= RUN_STARTED


def kept(token):
    return sorted(n["id"] for n in notes(token) if not from_tests(n))


check("the tests left Activity items for the seed accounts", any(from_tests(n) for n in notes(guest)))
before = {who: kept(token) for who, token in (("host", host), ("guest", guest))}
for token in (host, guest, joiner, stranger):
    status, body = rpc("clear_test_notifications", {"p_since": RUN_STARTED}, token)
    if status != 200:
        check("a test account can clear its test Activity items", False, (status, body))
check("no test Activity items are left", not any(from_tests(n) for t in (host, guest, joiner, stranger) for n in notes(t)))
check("Activity items from before the run are kept", before == {"host": kept(host), "guest": kept(guest)})
status, body = rpc("clear_test_notifications", {"p_since": RUN_STARTED})
check("logged-out visitors can't call clear_test_notifications", denied(status), (status, body))

print()
if failures:
    print(f"{len(failures)} check(s) failed")
    sys.exit(1)
print("All access-control checks passed")
