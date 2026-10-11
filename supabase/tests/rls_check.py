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
import datetime
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
JOINER_ID = "66666666-6666-6666-6666-666666666666"


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
status, body = request("POST", "/rest/v1/events", host,
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
    status, body = request("DELETE", f"/rest/v1/events?id=eq.{temp_id}", guest, headers={"Prefer": "return=representation"})
    check("a guest can't delete the host's event", status == 200 and body == [] or denied(status), (status, body))
    status, body = request("DELETE", f"/rest/v1/events?id=eq.{temp_id}", host, headers={"Prefer": "return=representation"})
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
status, body = request("POST", "/rest/v1/events", joiner,
                       {"host_id": JOINER_ID, "title": "No PayID party", "date": "2030-01-01T19:00:00Z", "address": "Nowhere", "deposit_mode": "pledge"})
check("a pledge event needs the host to have a PayID", denied(status), (status, body))

now = datetime.datetime.now(datetime.timezone.utc)
def iso(delta_hours):
    return (now + datetime.timedelta(hours=delta_hours)).isoformat()

def make_event(title, start_in_hours, cutoff_hours=24, mode="pledge", cents=500):
    status, body = request("POST", "/rest/v1/events", host,
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
for event_id in temp_events:
    if event_id:
        request("DELETE", f"/rest/v1/events?id=eq.{event_id}", host)
status, rows = get("obligations", guest, "select=id&event_id=in.(" + ",".join(e for e in temp_events if e) + ")")
check("deleting an event deletes its debts", status == 200 and rows == [], rows)
status, body = rpc("remove_payid", {}, host)
check("with nothing owed, a host can remove their PayID", status in (200, 204), (status, body))
rpc("set_payid", {"p_value": HOST_PAYID}, host)

print()
if failures:
    print(f"{len(failures)} check(s) failed")
    sys.exit(1)
print("All access-control checks passed")
