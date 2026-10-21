"""Stage 1.1 Collect before you book: consent per person, PayID only, confirmed-only funding, expiry and refunds.

Plan: docs/split-app/STAGE_1_1_PLAN.md (section 7). Run on its own:
    python3 -I supabase/tests/phase8/run.py --only S1.1
"""

import datetime
import time

ID = "S1.1"
TITLE = "Collect before you book (collections)"
MIGRATION = "collections"
FUNCTION = None
DECISIONS = []  # C-1 … C-9 live in docs/split-app/STAGE_1_1_PLAN.md §9 (defaults used)
MANUAL = "docs/split-app/STAGE_1_1_RESULTS.md (browser: Hannah collects, Gary joins and pays, expiry)"


def run(h):
    host, guest, joiner, stranger = h.login(h.HOST), h.login(h.GUEST), h.login(h.JOINER), h.login(h.STRANGER)
    hannah, gary, jo = h.id(h.HOST), h.id(h.GUEST), h.id(h.JOINER)

    def create(token, event, **kw):
        args = {"p_event_id": event, "p_title": "Karting at Kart World", "p_per_person_cents": 6000,
                "p_min_people": 2, "p_deadline": h.iso(48), "p_max_people": None, "p_target_cents": None,
                "p_merchant_note": "kartworld.com.au"}
        args.update({f"p_{k}": v for k, v in kw.items()})
        return h.rpc("create_collection", args, token)

    def coll(cid, token=host):
        _, body = h.rpc("get_collection", {"p_id": cid}, token)
        return body if isinstance(body, dict) else {}

    def debt(cid, email):
        _, rows = h.get("obligations", h.login(email), f"collection_id=eq.{cid}&guest_id=eq.{h.id(email)}"
                        "&select=id,kind,reason,status,amount_cents,host_id,confirmed_at,refund_requested_at,refunded_at")
        return rows[0] if isinstance(rows, list) and rows else None

    # Is the migration really applied? (A missing function would make every "refused" pass.)
    status, body = h.rpc("get_my_collections", {}, host)
    if not h.check("the collections migration is applied on wya-dev", status == 200 and isinstance(body, list), (status, body)):
        return

    _, rows = h.get("payment_methods", host, "select=value")
    hannah_payid = rows[0]["value"] if rows else None
    if not h.check("test setup: Hannah has a PayID (seed)", hannah_payid, rows):
        return

    event, code = h.make_event("collect", 72)
    if not h.check("host can create a temp event", event, h.last_error):
        return
    h.join(code, h.GUEST, h.JOINER)
    h.rsvp(event, h.GUEST, "yes")
    h.rsvp(event, h.JOINER, "yes")
    _, rel = h.rpc("get_reliability", {"p_user_id": gary}, host)
    gary_record = rel[0] if isinstance(rel, list) and rel else None

    # Who can start one -------------------------------------------------------------------------
    status, body = create(stranger, event)
    h.check("a stranger can't start a collection", h.refused(status, body), (status, body))
    _, rows = h.get("payment_methods", guest, "select=value")
    if not rows:
        status, body = create(guest, event)
        h.check("a going guest without a PayID is told to add one (needs_payid)",
                h.refused(status, body) and h.mentions(body, "needs_payid"), (status, body), assumes="C-1")
    status, body = create(host, event, deadline=h.iso(-1))
    h.check("a deadline in the past is refused", h.refused(status, body) and h.mentions(body, "deadline"), (status, body))
    status, body = create(host, event, deadline=h.iso(24 * 61))
    h.check("a deadline over 60 days out is refused", h.refused(status, body) and h.mentions(body, "deadline"), (status, body), assumes="C-7")
    status, body = create(host, event, per_person_cents=50)
    h.check("under $1 each is refused", h.refused(status, body), (status, body))
    status, body = create(host, event, min_people=3, max_people=2)
    h.check("a maximum below the minimum is refused", h.refused(status, body), (status, body))

    status, cid = create(host, event, max_people=2)
    if not h.check("Hannah starts collecting $60 each (min 2, max 2)", status == 200 and isinstance(cid, str), (status, cid)):
        return
    status, body = create(host, event)
    h.check("a second live collection on the same event is refused (already_collecting)",
            h.refused(status, body) and h.mentions(body, "already_collecting"), (status, body), assumes="C-4")

    _, msgs = h.get("chat_messages", host, f"event_id=eq.{event}&kind=eq.collect&select=id,data")
    h.check("a collect card is posted in the chat", isinstance(msgs, list) and len(msgs) == 1
            and msgs[0]["data"].get("collection_id") == cid, msgs)
    h.check("Gary is told a collection started", h.notifications(h.GUEST, "collect_started", event) >= 1)
    h.check("…and nobody owes anything yet (being invited isn't consent)", debt(cid, h.GUEST) is None)

    status, body = h.insert("chat_messages", {"event_id": event, "user_id": gary, "kind": "collect", "content": "x"}, guest)
    h.check("clients can't post a collect card", h.refused(status, body), (status, body))
    status, body = h.insert("notifications", {"user_id": gary, "type": "collect_confirmed", "event_id": event, "data": {}}, guest)
    h.check("clients can't write collect notifications", h.refused(status, body), (status, body))
    status, body = h.insert("collections", {"event_id": event, "organiser_id": gary, "title": "x", "per_person_cents": 100,
                                            "min_people": 1, "deadline": h.iso(5)}, guest)
    h.check("nobody inserts collections directly", h.refused(status, body), (status, body))
    status, body = h.patch("collections", f"id=eq.{cid}", {"per_person_cents": 100}, host, select="id")
    h.check("not even the organiser can change the amount directly", h.refused(status, body) or body == [], (status, body))

    # Strangers see nothing ---------------------------------------------------------------------
    status, body = h.rpc("get_collection", {"p_id": cid}, stranger)
    h.check("a stranger can't read it", h.refused(status, body), (status, body))
    _, rows = h.get("collections", stranger, f"id=eq.{cid}&select=id")
    h.check("…or select it", rows == [], rows)
    status, body = h.rpc("join_collection", {"p_id": cid}, stranger)
    h.check("…or join it", h.refused(status, body), (status, body))
    status, body = h.rpc("join_collection", {"p_id": cid}, host)
    h.check("the organiser can't join their own", h.refused(status, body), (status, body))

    # Gary joins: consent creates the debt --------------------------------------------------------
    status, gdebt = h.rpc("join_collection", {"p_id": cid}, guest)
    h.check("Gary taps I'm in", status == 200 and isinstance(gdebt, str), (status, gdebt))
    status, again = h.rpc("join_collection", {"p_id": cid}, guest)
    h.check("joining twice is the same share", status == 200 and again == gdebt, (status, again))
    d = debt(cid, h.GUEST) or {}
    h.check("…a $60 collect debt to Hannah", d.get("kind") == "collect" and d.get("reason") == "collection"
            and d.get("amount_cents") == 6000 and d.get("host_id") == hannah and d.get("status") == "owed", d)
    h.check("the amount is still $60 after a join", coll(cid).get("per_person_cents") == 6000)

    # Collect debts never block RSVPs or touch reliability ---------------------------------------
    event2, code2 = h.make_event("collect two", 96)
    h.join(code2, h.GUEST, h.JOINER)
    status, body = h.rsvp(event2, h.GUEST, "yes")
    h.check("an unpaid collect debt doesn't block RSVPs to Hannah", status == 200 and body and body[0]["status"] == "yes",
            (status, body), assumes="rule 6")
    _, rel = h.rpc("get_reliability", {"p_user_id": gary}, host)
    h.check("…and doesn't change Gary's reliability record", rel and rel[0] == gary_record, (rel, gary_record))

    # PayID only, never the wallet -----------------------------------------------------------------
    status, body = h.rpc("pay_from_wallet", {"p_obligation_id": gdebt, "p_expected_cents": 6000}, guest)
    h.check("pay_from_wallet refuses a collect debt (payid_only)",
            h.refused(status, body) and h.mentions(body, "payid_only"), (status, body), assumes="C-5")
    status, info = h.rpc("get_payment_instructions", {"p_obligation_id": gdebt}, guest)
    h.check("Gary gets Hannah's PayID while he owes", status == 200 and info and info[0].get("payid") == hannah_payid, (status, info))
    status, body = h.rpc("get_payment_instructions", {"p_obligation_id": gdebt}, joiner)
    h.check("Jo can't read Gary's payment instructions", h.refused(status, body), (status, body))
    _, raw = h.request("POST", "/rest/v1/rpc/get_collection", guest, {"p_id": cid})
    h.check("get_collection never contains a PayID", not h.mentions(raw, hannah_payid), raw)
    status, body = h.rpc("submit_excuse", {"p_obligation_id": gdebt, "p_excuse": "busy"}, guest)
    h.check("no excuses on a collect debt", h.refused(status, body), (status, body))
    status, body = h.rpc("waive_obligation", {"p_obligation_id": gdebt}, host)
    h.check("no 'let off' on a collect debt either", h.refused(status, body), (status, body))

    # Organiser-only actions --------------------------------------------------------------------------
    for fn, args in [("mark_booked", {"p_id": cid}), ("go_ahead_anyway", {"p_id": cid}), ("cancel_collection", {"p_id": cid}),
                     ("extend_deadline", {"p_id": cid, "p_deadline": h.iso(60)})]:
        status, body = h.rpc(fn, args, guest)
        h.check(f"a participant can't {fn.replace('_', ' ')}", h.refused(status, body), (status, body))

    # Claims don't fund; confirmations do ----------------------------------------------------------------
    status, body = h.rpc("confirm_received", {"p_obligation_id": gdebt}, host)
    h.check("can't confirm before they say they've paid", h.refused(status, body), (status, body))
    status, body = h.rpc("claim_paid", {"p_obligation_id": gdebt}, guest)
    h.check("claim_paid accepts a collect debt", status in (200, 204), (status, body))
    d = debt(cid, h.GUEST) or {}
    h.check("…marked paid by PayID, not confirmed", d.get("status") == "paid" and d.get("confirmed_at") is None, d)
    h.check("Hannah hears Gary says he's paid (collect_paid)", h.notifications(h.HOST, "collect_paid", event) >= 1)
    status, body = h.rpc("get_payment_instructions", {"p_obligation_id": gdebt}, guest)
    h.check("the PayID is gone once he's paid", status == 200 and body == [], (status, body))
    status, body = h.rpc("confirm_received", {"p_obligation_id": gdebt}, guest)
    h.check("Gary can't confirm his own payment", h.refused(status, body), (status, body))
    status, body = h.rpc("mark_refunded", {"p_obligation_id": gdebt}, guest)
    h.check("Gary can't mark himself refunded", h.refused(status, body), (status, body))

    h.rpc("join_collection", {"p_id": cid}, joiner)
    jdebt = (debt(cid, h.JOINER) or {}).get("id")
    h.rpc("claim_paid", {"p_obligation_id": jdebt}, joiner)
    c = coll(cid)
    h.check("two claims alone don't fund it", c.get("status") == "open" and c["counts"]["claimed"] == 2, c.get("counts"))
    people = {p["user_id"]: p["state"] for p in c.get("people", [])}
    h.check("claimed shares show as 'says paid', never 'confirmed'", people.get(gary) == "says_paid", people)

    status, body = h.rpc("confirm_received", {"p_obligation_id": gdebt}, host)
    h.check("Hannah confirms Gary's $60", status in (200, 204), (status, body))
    h.check("Gary hears it's confirmed", h.notifications(h.GUEST, "collect_confirmed", event) >= 1)
    h.check("one confirmed of a minimum of two: still open", coll(cid).get("status") == "open")
    h.rpc("confirm_received", {"p_obligation_id": jdebt}, host)
    c = coll(cid)
    h.check("two confirmed: funded", c.get("status") == "funded" and c["counts"]["confirmed_cents"] == 12000, c.get("counts"))
    h.check("everyone in hears it's funded", h.notifications(h.GUEST, "collect_funded", event) >= 1)

    status, body = h.rpc("dispute_payment", {"p_obligation_id": jdebt}, host)
    h.check("'Not received' works on a collect debt", status in (200, 204), (status, body))
    c = coll(cid)
    h.check("…and un-funds it before booking", c.get("status") == "open" and c["counts"]["confirmed"] == 1, (c.get("status"), c.get("counts")))
    h.check("…Hannah is told", h.notifications(h.HOST, "collect_unfunded", event) >= 1)
    h.rpc("claim_paid", {"p_obligation_id": jdebt}, joiner)
    h.rpc("confirm_received", {"p_obligation_id": jdebt}, host)
    h.check("Jo pays again, Hannah confirms: funded again", coll(cid).get("status") == "funded")

    # Full: Sam joins the event, but there's no room ------------------------------------------------
    h.join(code, h.STRANGER)
    status, body = h.rpc("join_collection", {"p_id": cid}, stranger)
    h.check("joins are refused once it isn't open (or is full)", h.refused(status, body), (status, body))

    status, body = h.rpc("mark_booked", {"p_id": cid}, host)
    h.check("Hannah marks it booked", status in (200, 204) and coll(cid).get("status") == "booked", (status, body))
    h.check("Gary hears it's booked", h.notifications(h.GUEST, "collect_booked", event) >= 1)
    status, body = h.rpc("cancel_collection", {"p_id": cid}, host)
    h.check("a booked collection can't be cancelled", h.refused(status, body), (status, body))

    # Leaving after paying = asking for a refund ---------------------------------------------------
    status, body = h.rpc("leave_collection", {"p_id": cid}, guest)
    h.check("Gary leaves after paying: a refund request", status == 200 and body == "refund_requested", (status, body))
    h.check("…Hannah is told", h.notifications(h.HOST, "collect_refund_requested", event) >= 1)
    status, body = h.rpc("mark_refunded", {"p_obligation_id": gdebt}, host)
    d = debt(cid, h.GUEST) or {}
    h.check("Hannah marks Gary refunded", status in (200, 204) and d.get("refunded_at"), (status, body, d))
    h.check("…and Gary hears", h.notifications(h.GUEST, "collect_refunded", event) >= 1)

    # Full check, with room: a fresh collection on event 2 (max 1) ------------------------------------
    status, c2 = create(host, event2, min_people=1, max_people=1)
    h.check("a collection on a second event", status == 200, (status, c2))
    h.rsvp(event2, h.JOINER, "yes")
    h.rpc("join_collection", {"p_id": c2}, guest)
    status, body = h.rpc("join_collection", {"p_id": c2}, joiner)
    h.check("over max_people is refused (full)", h.refused(status, body) and h.mentions(body, "full"), (status, body))
    # Leaving before paying removes the debt
    status, body = h.rpc("leave_collection", {"p_id": c2}, guest)
    h.check("Gary leaves before paying: his debt is removed", status == 200 and body == "left" and debt(c2, h.GUEST) is None,
            (status, body))
    # Go ahead anyway and extend
    status, body = h.rpc("go_ahead_anyway", {"p_id": c2}, host)
    h.check("'Go ahead anyway' needs a confirmed payment", h.refused(status, body), (status, body), assumes="C-8")
    status, body = h.rpc("extend_deadline", {"p_id": c2, "p_deadline": h.iso(24)}, host)
    h.check("the deadline can't move earlier", h.refused(status, body), (status, body))
    status, body = h.rpc("extend_deadline", {"p_id": c2, "p_deadline": h.iso(72)}, host)
    h.check("Hannah extends the deadline", status in (200, 204), (status, body))
    jd2 = h.rpc("join_collection", {"p_id": c2}, joiner)[1]
    h.rpc("claim_paid", {"p_obligation_id": jd2}, joiner)
    h.rpc("confirm_received", {"p_obligation_id": jd2}, host)
    # min 1 is met by Jo alone, so it's funded already; go-ahead is for below the minimum
    h.check("Jo pays and is confirmed: funded (min 1)", coll(c2).get("status") == "funded")
    status, body = h.rpc("cancel_collection", {"p_id": c2}, host)
    h.check("Hannah cancels a funded collection", status in (200, 204) and coll(c2).get("status") == "cancelled", (status, body))
    d = debt(c2, h.JOINER) or {}
    h.check("…Jo's paid share is flagged for a refund", d.get("refund_requested_at") and not d.get("refunded_at"), d)
    h.check("…and Jo is told", h.notifications(h.JOINER, "collect_cancelled", event2) >= 1)
    status, body = h.rpc("mark_refunded", {"p_obligation_id": jd2}, host)
    h.check("Hannah refunds Jo", status in (200, 204), (status, body))
    status, body = h.rpc("join_collection", {"p_id": c2}, guest)
    h.check("no joining a cancelled collection", h.refused(status, body) and h.mentions(body, "not_open"), (status, body))

    # Expiry: a short deadline, one paid share and one unpaid -----------------------------------------
    deadline = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=12)
    status, c3 = create(host, event2, min_people=3, deadline=deadline.isoformat())
    if not h.check("a collection that closes in 12 seconds", status == 200, (status, c3)):
        return
    gd3 = h.rpc("join_collection", {"p_id": c3}, guest)[1]
    h.rpc("claim_paid", {"p_obligation_id": gd3}, guest)
    h.rpc("confirm_received", {"p_obligation_id": gd3}, host)
    h.rpc("join_collection", {"p_id": c3}, joiner)
    status, body = h.rpc("mark_refunded", {"p_obligation_id": gd3}, host)
    h.check("nothing to refund while it's open and nobody asked", h.refused(status, body), (status, body))
    status, body = h.rpc("process_collection_deadlines", {}, host)
    h.check("before the deadline nothing expires", coll(c3).get("status") == "open", (status, body))
    h.check("…but people who haven't paid get a reminder", h.notifications(h.JOINER, "collect_reminder", event2) == 1)
    wait = (deadline - datetime.datetime.now(datetime.timezone.utc)).total_seconds() + 2
    if wait > 0:
        time.sleep(wait)
    status, body = h.rpc("join_collection", {"p_id": c3}, stranger)
    h.check("joins after the deadline are refused", h.refused(status, body), (status, body))
    status, body = h.rpc("process_collection_deadlines", {}, host)
    h.check("process_collection_deadlines runs", status == 200 and isinstance(body, dict), (status, body))
    h.check("…the collection expired", coll(c3).get("status") == "expired")
    h.check("…the unpaid share is removed", debt(c3, h.JOINER) is None)
    d = debt(c3, h.GUEST) or {}
    h.check("…the paid share is flagged for a refund", d.get("refund_requested_at") and not d.get("refunded_at"), d)
    expired_before = h.notifications(h.GUEST, "collect_expired", event2)
    h.check("…and everyone is told", expired_before == 1 and h.notifications(h.HOST, "collect_expired", event2) == 1)
    h.rpc("process_collection_deadlines", {}, host)
    h.check("running it again changes nothing", coll(c3).get("status") == "expired"
            and h.notifications(h.GUEST, "collect_expired", event2) == expired_before
            and h.notifications(h.JOINER, "collect_reminder", event2) == 1)
    status, body = h.rpc("mark_refunded", {"p_obligation_id": gd3}, host)
    h.check("Hannah refunds Gary after expiry", status in (200, 204), (status, body))

    # Going ahead short: below the minimum, only by the organiser's choice ---------------------------
    status, c4 = create(host, event2, min_people=3)
    gd4 = h.rpc("join_collection", {"p_id": c4}, guest)[1]
    h.rpc("claim_paid", {"p_obligation_id": gd4}, guest)
    h.rpc("confirm_received", {"p_obligation_id": gd4}, host)
    h.check("one of three confirmed: still open", coll(c4).get("status") == "open")
    status, body = h.rpc("go_ahead_anyway", {"p_id": c4}, host)
    c = coll(c4)
    h.check("Hannah goes ahead anyway: funded, marked short", status in (200, 204) and c.get("status") == "funded"
            and c.get("go_ahead_short") is True, (status, body, c.get("status")), assumes="C-8")
    h.rpc("cancel_collection", {"p_id": c4}, host)

    # Lists and stats ------------------------------------------------------------------------------------
    _, mine = h.rpc("get_my_collections", {}, guest)
    h.check("get_my_collections lists what Gary joined", isinstance(mine, list) and any(m["id"] == cid for m in mine), mine)
    _, dues = h.rpc("get_my_dues", {"p_event_id": event}, guest)
    h.check("collect shares stay out of the wallet's dues list", isinstance(dues, list) and not any(
        r.get("obligation_id") == gdebt for r in dues), dues)
    status, body = h.rpc("get_collect_stats", {}, host)
    h.check("only the service role can read the stats", h.refused(status, body), (status, body))
