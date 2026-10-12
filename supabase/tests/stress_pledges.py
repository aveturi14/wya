"""Stress test for pledges: one event, 30 guests, everything at once.

Runs a whole pledge event against wya-dev with the 30 guests from
supabase/seed_stress.sql (apply that first), firing guest actions
concurrently, and checks every count along the way: RSVPs, free and late
cancels, Maybe reminders and expiry, Who came?, paying, disputes, excuses,
the RSVP block, reliability, notifications and the photo album. Prints
timings at the end.

    python3 -I supabase/tests/stress_pledges.py          # cleans up after itself
    python3 -I supabase/tests/stress_pledges.py --keep   # leaves the events to look at in the app

Refuses to run against anything but wya-dev.
"""

import concurrent.futures
import datetime
import json
import pathlib
import re
import statistics
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
DEV_PROJECT_REF = "gvfcjxldokhodgnmmqar"
HOST_ID = "11111111-1111-1111-1111-111111111111"
GUESTS = [f"aaaaaaaa-aaaa-4aaa-8aaa-{i:012d}" for i in range(1, 31)]
KEEP = "--keep" in sys.argv


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

timings = {}  # operation -> [seconds]


def request(method, path, token=None, body=None, headers=None, label=None):
    req = urllib.request.Request(URL + path, method=method)
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {token or KEY}")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, data, timeout=30) as resp:
            raw = resp.read()
            result = resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            result = e.code, json.loads(raw)
        except ValueError:
            result = e.code, raw.decode()
    timings.setdefault(label or path.split("?")[0], []).append(time.perf_counter() - started)
    return result


def rpc(fn, args, token):
    return request("POST", f"/rest/v1/rpc/{fn}", token, args, label=f"rpc {fn}")


def get(table, token, query):
    return request("GET", f"/rest/v1/{table}?{query}", token, label=f"read {table}")


def patch(table, query, body, token):
    # events.address isn't selectable (address gating), so return the changed columns instead of `*`
    if table == "events" and "select=" not in query:
        query += "&select=" + ",".join(["id"] + [k for k in body if k != "address"])
    return request("PATCH", f"/rest/v1/{table}?{query}", token, body, {"Prefer": "return=representation"}, label=f"update {table}")


# Sign-ins are rate limited per IP (about 30 per 5 minutes), so reuse tokens between runs
TOKEN_CACHE = pathlib.Path(tempfile.gettempdir()) / "wya_stress_tokens.json"


def login_all(emails):
    try:
        cache = json.loads(TOKEN_CACHE.read_text())
    except (OSError, ValueError):
        cache = {}
    tokens = {}
    for email in emails:
        hit = cache.get(email)
        if hit and hit["expires_at"] > time.time() + 600:
            tokens[email] = hit["token"]
            continue
        for attempt in range(6):
            status, body = request("POST", "/auth/v1/token?grant_type=password", body={"email": email, "password": PASSWORD}, label="sign in")
            if status == 200:
                break
            if status == 429:
                print(f"  (sign-in rate limit hit, waiting 60s: {email})")
                time.sleep(60)
                continue
            sys.exit(f"Login failed for {email}: {body}. Did you apply supabase/seed_stress.sql?")
        else:
            sys.exit("Sign-in kept hitting the rate limit; try again in 5 minutes.")
        tokens[email] = body["access_token"]
        cache[email] = {"token": body["access_token"], "expires_at": body["expires_at"]}
    TOKEN_CACHE.write_text(json.dumps(cache))
    return tokens


failures = []


def check(name, ok, detail=""):
    print(("  ✅ " if ok else "  ❌ ") + name + ("" if ok else f"  →  {detail}"))
    if not ok:
        failures.append(name)


def together(fn, items):
    """Run fn(item) for every item at the same time, like 30 phones tapping at once."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(items) or 1) as pool:
        return list(pool.map(fn, items))


def iso(delta_hours):
    return (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=delta_hours)).isoformat()


# ---------------------------------------------------------------------------
print("Signing in the host and 30 guests")
emails = ["host@wya.test"] + [f"stress{i:02d}@wya.test" for i in range(1, 31)]
tokens = login_all(emails)
host = tokens["host@wya.test"]
tok = {uid: tokens[f"stress{i:02d}@wya.test"] for i, uid in enumerate(GUESTS, 1)}
G = GUESTS  # G[0] … G[29]
check("31 accounts signed in", len(tokens) == 31)
rpc("set_payid", {"p_value": "0412 345 678"}, host)

JPEG = (ROOT / "supabase/tests/fixtures/tiny.jpg").read_bytes()  # an 8×8 JPEG


def delete_event(event_id):
    # Album files outlive their rows, so remove them while the host still can
    _, photos = get("photos", host, f"event_id=eq.{event_id}&select=path,thumb_path")
    files = [f for ph in photos or [] for f in (ph["path"], ph["thumb_path"])]
    for i in range(0, len(files), 100):
        request("DELETE", "/storage/v1/object/album", host, {"prefixes": files[i:i + 100]}, label="delete files")
    request("DELETE", f"/rest/v1/events?id=eq.{event_id}", host, label="delete event")


# Leftovers from an earlier --keep run would skew the counts
_, old = get("events", host, "title=like.Stress%20test*&select=id")
for e in old or []:
    delete_event(e["id"])


def make_event(title, start_in_hours):
    status, body = request("POST", "/rest/v1/events?select=id", host,
                           {"host_id": HOST_ID, "title": title, "date": iso(start_in_hours), "address": "1 Party St",
                            "venue_name": "Hannah's rooftop", "deposit_mode": "pledge", "deposit_cents": 500, "cutoff_hours": 24},
                           {"Prefer": "return=representation"}, label="create event")
    if status != 201:
        sys.exit(f"Could not create event: {body}")
    event_id = body[0]["id"]
    _, inv = get("event_invites", host, f"event_id=eq.{event_id}&select=code")
    return event_id, inv[0]["code"]


def guest_list(event_id):
    _, rows = rpc("get_guest_list", {"p_event_id": event_id}, host)
    return {r["user_id"]: r for r in rows}


def set_status(event_id, uid, value):
    return patch("rsvps", f"event_id=eq.{event_id}&user_id=eq.{uid}", {"status": value}, tok[uid])


def obligations(event_id):
    _, rows = get("obligations", host, f"event_id=eq.{event_id}&select=*")
    return {r["guest_id"]: r for r in rows}


def count_notes(uid_or_host, type_, event_id):
    token = host if uid_or_host == "host" else tok[uid_or_host]
    _, rows = get("notifications", token, f"type=eq.{type_}&event_id=eq.{event_id}&select=id")
    return len(rows) if isinstance(rows, list) else -1


E, code = make_event("Stress test: 30 guests", start_in_hours=72)
F, code_f = make_event("Stress test: the next party", start_in_hours=96)

# ---------------------------------------------------------------------------
print("\n1. 30 guests open the invite at the same moment")
together(lambda u: rpc("accept_invite", {"p_code": code}, tok[u]), G)
gl = guest_list(E)
check("all 30 are on the guest list", len(gl) == 30, len(gl))
time.sleep(1)
check("host told about each one (30 'joined')", count_notes("host", "joined", E) == 30, count_notes("host", "joined", E))

# ---------------------------------------------------------------------------
print("\n2. Everyone RSVPs at once: 20 I'm in, 6 Maybe, 4 Can't go")
YES, MAYBE, NO = G[0:20], G[20:26], G[26:30]
plan = [(u, "yes") for u in YES] + [(u, "maybe") for u in MAYBE] + [(u, "no") for u in NO]
results = together(lambda p: set_status(E, *p), plan)
check("all 30 RSVPs accepted", all(s == 200 for s, _ in results), [b for s, b in results if s != 200][:2])
gl = guest_list(E)
check("20 going, each pledged $5", sum(1 for r in gl.values() if r["status"] == "yes" and r["pledge_cents"] == 500) == 20)
check("Maybes and Can't gos have no pledge", all(gl[u]["pledge_cents"] is None for u in MAYBE + NO))
check("host got 30 RSVP notifications", count_notes("host", "rsvp", E) == 30, count_notes("host", "rsvp", E))

# ---------------------------------------------------------------------------
print("\n3. Before the cutoff, 3 guests cancel and come back (free)")
together(lambda u: set_status(E, u, "no"), YES[:3])
check("no debts for cancelling early", len(obligations(E)) == 0, obligations(E))
check("their pledges are cleared", all(guest_list(E)[u]["pledge_cents"] is None for u in YES[:3]))
together(lambda u: set_status(E, u, "yes"), YES[:3])
check("pledged again after saying I'm in again", all(guest_list(E)[u]["pledge_cents"] == 500 for u in YES[:3]))

# ---------------------------------------------------------------------------
print("\n4. Maybes: reminder within a day of the cutoff, then expiry")
patch("events", f"id=eq.{E}", {"date": iso(40)}, host)  # cutoff in 16 hours
rpc("process_pledge_deadlines", {}, host)
rpc("process_pledge_deadlines", {}, host)  # the cron job runs every 15 minutes; must not double-remind
check("each Maybe reminded exactly once", all(count_notes(u, "maybe_reminder", E) == 1 for u in MAYBE),
      [count_notes(u, "maybe_reminder", E) for u in MAYBE])
check("nobody else reminded", all(count_notes(u, "maybe_reminder", E) == 0 for u in YES[:3] + NO[:1]))
patch("events", f"id=eq.{E}", {"date": iso(2)}, host)  # now past the cutoff
s, body = set_status(E, NO[0], "maybe")
check("Maybe refused after the cutoff", s >= 400, (s, body))
rpc("process_pledge_deadlines", {}, host)
gl = guest_list(E)
check("all 6 Maybes became Can't go", all(gl[u]["status"] == "no" for u in MAYBE), [gl[u]["status"] for u in MAYBE])
check("each told once (maybe_expired)", all(count_notes(u, "maybe_expired", E) == 1 for u in MAYBE))

# ---------------------------------------------------------------------------
print("\n5. Late cancels: 4 guests cancel after the cutoff, one double-taps")
LATE = YES[16:20]
results = together(lambda u: set_status(E, u, "no"), LATE + [LATE[-1], LATE[-1]])
debts = obligations(E)
check("exactly 4 late-cancel debts", len(debts) == 4 and all(d["reason"] == "late_cancel" for d in debts.values()),
      {k[-2:]: v["reason"] for k, v in debts.items()})
check("each late canceller told once", all(count_notes(u, "pledge_owed", E) == 1 for u in LATE),
      [count_notes(u, "pledge_owed", E) for u in LATE])
check("references are unique", len({d["reference"] for d in debts.values()}) == 4)

# ---------------------------------------------------------------------------
print("\n6. The party starts. The host marks 6 of the 16 no-shows (and taps Done twice)")
patch("events", f"id=eq.{E}", {"date": iso(-1)}, host)
CAME, NOSHOW = YES[0:10], YES[10:16]
results = together(lambda _: rpc("record_attendance", {"p_event_id": E, "p_absent": NOSHOW}, host), [1, 2])
check("both saves succeeded", all(s in (200, 204) for s, _ in results), results)
debts = obligations(E)
check("10 debts in total (4 late + 6 no-show)", len(debts) == 10, len(debts))
check("no-shows owe $5 each", all(debts[u]["reason"] == "no_show" and debts[u]["amount_cents"] == 500 for u in NOSHOW))
check("nobody who came owes anything", not any(u in debts for u in CAME))
rpc("record_attendance", {"p_event_id": E, "p_absent": NOSHOW[:-1]}, host)
check("re-ticking someone drops their debt", NOSHOW[-1] not in obligations(E))
rpc("record_attendance", {"p_event_id": E, "p_absent": NOSHOW}, host)
check("unticking them again brings it back (10 debts)", len(obligations(E)) == 10)

# ---------------------------------------------------------------------------
print("\n7. The 10 who owe all act at once")
debts = obligations(E)
DEBTORS = NOSHOW + LATE  # G[10:20]
PAYERS, EXCUSERS, SILENT = DEBTORS[0:4], DEBTORS[4:7], DEBTORS[7:10]


def act(u):
    oid = debts[u]["id"]
    if u in PAYERS:
        return rpc("claim_paid", {"p_obligation_id": oid}, tok[u])
    if u in EXCUSERS:
        return rpc("submit_excuse", {"p_obligation_id": oid, "p_excuse": "Sorry, I got sick"}, tok[u])
    return rpc("get_payment_instructions", {"p_obligation_id": oid}, tok[u])


results = together(act, DEBTORS + [PAYERS[0]])  # one payer double-taps I've paid
check("every action went through, double tap included", all(s in (200, 204) for s, _ in results), [r for r in results if r[0] >= 400][:2])
silent_view = [r for u, r in zip(DEBTORS, results) if u in SILENT]
check("debtors see the host's PayID and their reference",
      all(b and b[0]["payid"] and b[0]["reference"].startswith("WYA-") for _, b in silent_view), silent_view[:1])
s, _ = rpc("submit_excuse", {"p_obligation_id": debts[EXCUSERS[0]]["id"], "p_excuse": "again"}, tok[EXCUSERS[0]])
check("a second excuse is refused", s >= 400)
check("host told about 4 payments and 3 excuses",
      count_notes("host", "payment_claimed", E) == 4 and count_notes("host", "excuse_submitted", E) == 3,
      (count_notes("host", "payment_claimed", E), count_notes("host", "excuse_submitted", E)))

print("   The host accepts 2 excuses, declines 1 and disputes 1 payment")
together(lambda a: rpc(*a), [
    ("resolve_excuse", {"p_obligation_id": debts[EXCUSERS[0]]["id"], "p_accept": True}, host),
    ("resolve_excuse", {"p_obligation_id": debts[EXCUSERS[1]]["id"], "p_accept": True}, host),
    ("resolve_excuse", {"p_obligation_id": debts[EXCUSERS[2]]["id"], "p_accept": False}, host),
    ("dispute_payment", {"p_obligation_id": debts[PAYERS[3]]["id"]}, host),
])
debts = obligations(E)
expect = {**{u: "paid" for u in PAYERS[:3]}, PAYERS[3]: "disputed", EXCUSERS[0]: "waived", EXCUSERS[1]: "waived",
          EXCUSERS[2]: "owed", **{u: "owed" for u in SILENT}}
check("every debt has the right status", all(debts[u]["status"] == s for u, s in expect.items()),
      {u[-2:]: (debts[u]["status"], s) for u, s in expect.items() if debts[u]["status"] != s})
OPEN = [u for u, s in expect.items() if s in ("owed", "disputed")]

# ---------------------------------------------------------------------------
print("\n8. The host's next party: all 30 say I'm in at once")
together(lambda u: rpc("accept_invite", {"p_code": code_f}, tok[u]), G)
results = dict(zip(G, together(lambda u: set_status(F, u, "yes"), G)))
blocked = {u for u, (s, _) in results.items() if s >= 400}
check(f"exactly the {len(OPEN)} who still owe are blocked", blocked == set(OPEN),
      {"blocked": sorted(u[-2:] for u in blocked), "expected": sorted(u[-2:] for u in OPEN)})
check("the block says why (OPEN_DEBT)", all("OPEN_DEBT" in json.dumps(results[u][1]) for u in OPEN))
check("the other 25 pledged", sum(1 for r in guest_list(F).values() if r["pledge_cents"] == 500) == 30 - len(OPEN))

# ---------------------------------------------------------------------------
print("\n9. Reliability, as the host sees it in the guest list")
rel = dict(zip(G, together(lambda u: rpc("get_reliability", {"p_user_id": u}, host)[1][0], G)))
want = {}
for u in G:
    attended = 1 if u in CAME else 0
    counted = 1 if u in CAME + NOSHOW + LATE else 0
    want[u] = (attended, counted, 1 if u in OPEN else 0)
wrong = {u[-2:]: (tuple(rel[u].values()), want[u]) for u in G if tuple(rel[u].values()) != want[u]}
check("all 30 records are right", not wrong, wrong)
listed = guest_list(E)
check("the guest list carries the same records (one request)", all(listed[u]["reliability"] == dict(zip(("attended", "counted", "open_debts"), want[u])) for u in G))
_, mine = rpc("get_my_obligations", {}, host)
check("host's list shows the 10 debts for this party", sum(1 for o in mine if o["event_id"] == E) == 10)
owed_lists = dict(zip(G, together(lambda u: rpc("get_my_obligations", {}, tok[u])[1], G)))
check("each guest sees only their own debt", all(len(owed_lists[u]) == (1 if u in DEBTORS else 0) for u in G))

# ---------------------------------------------------------------------------
print("\n10. The host lets everyone off")
s, n = rpc("waive_all", {"p_event_id": E}, host)
check(f"{len(OPEN)} open debts waived", n == len(OPEN), (s, n))
results = together(lambda u: set_status(F, u, "yes"), OPEN)
check("they can now say I'm in to the next party", all(s == 200 for s, _ in results), results[:1])
check("each told they were let off", all(count_notes(u, "debt_waived", E) == 1 for u in OPEN))

# ---------------------------------------------------------------------------
print("\n11. The album: the 10 who came add 5 photos each, all at once")


def upload(path, token):
    req = urllib.request.Request(f"{URL}/storage/v1/object/album/{path}", data=JPEG, method="POST",
                                 headers={"apikey": KEY, "Authorization": f"Bearer {token}", "Content-Type": "image/jpeg"})
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
    timings.setdefault("upload file", []).append(time.perf_counter() - started)
    return status


def add_photo(uid):
    """Like the app: upload both files, register the photo, and remove the files if that's refused."""
    token = host if uid == HOST_ID else tok[uid]
    pid = str(uuid.uuid4())
    files = [f"{E}/{uid}/{pid}.jpg", f"{E}/{uid}/{pid}_thumb.jpg"]
    for f in files:
        upload(f, token)
    result = rpc("add_photo", {"p_event_id": E, "p_photo_id": pid, "p_width": 8, "p_height": 8}, token)
    if result[0] != 200:
        request("DELETE", "/storage/v1/object/album", token, {"prefixes": files}, label="delete files")
    return result


results = together(add_photo, [u for u in CAME for _ in range(5)])
check("all 50 photos were added", all(s == 200 for s, _ in results), [b for s, b in results if s != 200][:1])
_, album = rpc("get_album", {"p_event_id": E}, host)
check("the album shows 50", len(album["photos"]) == 50, len(album["photos"]))
results = together(add_photo, [CAME[0]] * 30)
_, rows = get("photos", host, f"event_id=eq.{E}&user_id=eq.{CAME[0]}&select=id")
check("one guest firing 30 more at once stops at exactly 30", len(rows) == 30 and sum(s == 200 for s, _ in results) == 25, len(rows))
check("the extras are refused with YOUR_LIMIT", all("YOUR_LIMIT" in json.dumps(b) for s, b in results if s != 200))
status, body = add_photo(NOSHOW[0])
check("a no-show can't add photos", status >= 400, (status, body))
_, album = rpc("get_album", {"p_event_id": E}, tok[MAYBE[0]])
check("a guest who isn't going can still view all 75", album and len(album["photos"]) == 75)

paths = [f for ph in album["photos"] for f in (ph["thumb_path"], ph["path"])]
status, signed = request("POST", "/storage/v1/object/sign/album", tok[MAYBE[0]], {"expiresIn": 3600, "paths": paths}, label="sign 150 links")
check("150 links are signed in one request", status == 200 and sum(1 for x in signed if x.get("signedURL")) == 150, status)

_, notes = get("notifications", host, f"type=eq.photos_added&event_id=eq.{E}&read_at=is.null&select=data")
check("the host has one notification counting all 75", len(notes) == 1 and notes[0]["data"]["count"] == 75
      and len(notes[0]["data"]["uploaders"]) == 10, notes and notes[0]["data"].get("count"))
counts = together(lambda u: get("notifications", tok[u], f"type=eq.photos_added&event_id=eq.{E}&select=data")[1], CAME)
expected = {u: 75 - (30 if u == CAME[0] else 5) for u in CAME}  # everyone else's photos
check("each uploader has one notification counting the others' photos",
      all(len(c) == 1 and c[0]["data"]["count"] == expected[u] for u, c in zip(CAME, counts)),
      [c[0]["data"]["count"] if c else None for c in counts])
check("guests who aren't going get none", count_notes(MAYBE[0], "photos_added", E) == 0)

status, gone = rpc("delete_photo", {"p_photo_id": album["photos"][0]["id"]}, host)
check("the host can delete a guest's photo", status == 200 and len(gone) == 1, (status, gone))
if status == 200:
    request("DELETE", "/storage/v1/object/album", host, {"prefixes": [gone[0]["path"], gone[0]["thumb_path"]]}, label="delete files")

# ---------------------------------------------------------------------------
print("\nTimings (seconds; includes the network round trip from here to us-east-1)")
print(f"  {'operation':34} {'calls':>5} {'median':>7} {'p95':>7} {'max':>7}")
for op, ts in sorted(timings.items(), key=lambda kv: -max(kv[1])):
    ts = sorted(ts)
    p95 = ts[min(len(ts) - 1, int(len(ts) * 0.95))]
    print(f"  {op:34} {len(ts):5} {statistics.median(ts):7.2f} {p95:7.2f} {max(ts):7.2f}")

if KEEP:
    print(f"\nKept the events for a look in the app (sign in as host@wya.test):\n  {E}\n  {F}")
else:
    for e in (E, F):
        delete_event(e)

print("\n" + ("All stress checks passed" if not failures else f"{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
