"""Stage 1.1b Collection links: a link per collection, "I'm in" as a request the organiser approves, standalone collections.

Plan: docs/split-app/STAGE_1_1_LINKS.md (section 8). Run on its own:
    python3 -I supabase/tests/phase8/run.py --only S1.1b
"""

ID = "S1.1b"
TITLE = "Collection links and standalone collections"
MIGRATION = "collection_links"
FUNCTION = None
DECISIONS = []  # L-1 … L-8 live in docs/split-app/STAGE_1_1_LINKS.md §9 (defaults used)
MANUAL = "docs/split-app/STAGE_1_1_RESULTS.md (browser: standalone link, Sam asks, Hannah approves)"

# The hidden event takes the collection's title; this prefix lets clear_test_notifications tidy its Activity rows
PREFIX = "RLS temp event: "


def run(h):
    host, guest, joiner, stranger = h.login(h.HOST), h.login(h.GUEST), h.login(h.JOINER), h.login(h.STRANGER)
    hannah, gary, jo, sam = h.id(h.HOST), h.id(h.GUEST), h.id(h.JOINER), h.id(h.STRANGER)

    def standalone(token=host, **kw):
        args = {"p_title": PREFIX + "Karting", "p_per_person_cents": 6000, "p_min_people": 2,
                "p_deadline": h.iso(48), "p_max_people": None, "p_target_cents": None, "p_merchant_note": None}
        args.update({f"p_{k}": v for k, v in kw.items()})
        status, cid = h.rpc("create_standalone_collection", args, token)
        if status == 200 and isinstance(cid, str):
            # The hidden event goes, and everything on it with it
            ev = coll(cid, token).get("event_id")
            if ev:
                h.on_cleanup(lambda ev=ev, token=token: h.delete("events", f"id=eq.{ev}", token))
        return status, cid

    def coll(cid, token=host):
        _, body = h.rpc("get_collection", {"p_id": cid}, token)
        return body if isinstance(body, dict) else {}

    def preview(code, token=None):
        status, body = h.request("POST", "/rest/v1/rpc/get_collection_preview", token, {"p_code": code})
        return status, body

    def debt(cid, email):
        _, rows = h.get("obligations", h.login(email), f"collection_id=eq.{cid}&guest_id=eq.{h.id(email)}&select=id,status")
        return rows[0] if isinstance(rows, list) and rows else None

    status, body = h.rpc("get_collection_preview", {"p_code": "nope"}, host)
    if not h.check("the collection_links migration is applied on wya-dev", status == 200, (status, body)):
        return
    _, rows = h.get("payment_methods", host, "select=value")
    hannah_payid = rows[0]["value"] if rows else None

    # Standalone: no event, a link, the $200 cap -----------------------------------------------
    status, body = standalone(per_person_cents=20100)
    h.check("over $200 a person is refused", h.refused(status, body) and h.mentions(body, "amount"), (status, body), assumes="L-4")
    _, rows = h.get("payment_methods", guest, "select=value")
    if not rows:
        status, body = standalone(guest)
        h.check("a standalone collection needs a PayID too", h.refused(status, body) and h.mentions(body, "needs_payid"), (status, body))
    status, cid = standalone(max_people=2)
    if not h.check("Hannah starts a standalone collection (no event)", status == 200 and isinstance(cid, str), (status, cid)):
        return
    c = coll(cid)
    code = c.get("link_code")
    h.check("…it's standalone and has a link", c.get("standalone") is True and code and c.get("can_open_event") is False, c)
    ev = c.get("event_id")

    # The hidden event stays hidden
    _, evs = h.get("events", host, f"id=eq.{ev}&select=kind")
    h.check("its event is hidden (kind 'collection')", evs == [{"kind": "collection"}], evs)
    _, chats = h.rpc("get_my_chats", {}, host)
    h.check("…not in Hannah's chats", isinstance(chats, list) and all(x["event_id"] != ev for x in chats))
    _, albums = h.rpc("get_my_albums", {}, host)
    h.check("…not in her albums", isinstance(albums, list) and all(x["event_id"] != ev for x in albums))
    _, msgs = h.get("chat_messages", host, f"event_id=eq.{ev}&select=id")
    h.check("…and no chat card is posted for it", msgs == [], msgs)

    # The booking page: signed out, never a PayID or names ----------------------------------------
    status, p = preview(code)
    h.check("the link works signed out", status == 200 and isinstance(p, dict) and p.get("id") == cid
            and p.get("organiser_name") == "Hannah Host" and p.get("per_person_cents") == 6000, (status, p))
    h.check("…without a PayID, names or an address", not h.mentions(p, hannah_payid or "@@") and not h.mentions(p, "Gary")
            and not h.mentions(p, h.TEMP_ADDRESS) and p.get("me") is None, p)
    status, body = h.rpc("request_to_join", {"p_code": code}, None)
    h.check("signed-out visitors can't ask to join", h.refused(status, body), (status, body))
    status, body = h.rpc("get_collection", {"p_id": cid}, stranger)
    h.check("Sam can't open the collection before asking", h.refused(status, body), (status, body))

    # Gary asks: owes nothing, sees no PayID, until approved ----------------------------------------
    status, r = h.rpc("request_to_join", {"p_code": code}, guest)
    h.check("Gary taps I'm in: a request", status == 200 and r.get("state") == "requested", (status, r), assumes="L-1")
    status, again = h.rpc("request_to_join", {"p_code": code}, guest)
    h.check("tapping again is the same request", status == 200 and again.get("state") == "requested", (status, again))
    h.check("…he owes nothing yet", debt(cid, h.GUEST) is None)
    g = coll(cid, guest)
    h.check("…he can see the collection, waiting", g.get("my_request") == "requested" and g.get("my_obligation_id") is None
            and g.get("link_code") is None and g.get("requests") == [], g.get("my_request"))
    h.check("Hannah is told Gary wants in", h.notifications(h.HOST, "collect_requested", ev) >= 1)
    h.check("…and sees his request", [x["user_id"] for x in coll(cid).get("requests", [])] == [gary])
    _, rows = h.get("collection_requests", stranger, f"collection_id=eq.{cid}&select=user_id")
    h.check("strangers can't read requests", rows == [], rows)
    status, body = h.insert("collection_requests", {"collection_id": cid, "user_id": sam}, stranger, select="user_id")
    h.check("nobody writes requests directly", h.refused(status, body), (status, body))

    # Only the organiser decides -------------------------------------------------------------------
    status, body = h.rpc("approve_request", {"p_collection_id": cid, "p_user_id": gary}, guest)
    h.check("Gary can't approve himself", h.refused(status, body), (status, body))
    status, gdebt = h.rpc("approve_request", {"p_collection_id": cid, "p_user_id": gary}, host)
    h.check("Hannah approves Gary", status == 200 and isinstance(gdebt, str), (status, gdebt))
    d = debt(cid, h.GUEST) or {}
    h.check("…now he owes $60", d.get("id") == gdebt and d.get("status") == "owed", d)
    h.check("…and is told", h.notifications(h.GUEST, "collect_approved", ev) >= 1)
    status, info = h.rpc("get_payment_instructions", {"p_obligation_id": gdebt}, guest)
    h.check("…and only now gets the PayID", status == 200 and info and info[0].get("payid") == hannah_payid, (status, info))

    # Link joiners see the collection, never the event --------------------------------------------
    _, rows = h.get("events", guest, f"id=eq.{ev}&select=id")
    h.check("Gary can't see the hidden event", rows == [], rows)

    # Jo asks then withdraws; asks again; Sam is declined; full -------------------------------------
    h.rpc("request_to_join", {"p_code": code}, joiner)
    status, body = h.rpc("withdraw_request", {"p_collection_id": cid}, joiner)
    h.check("Jo withdraws her request", status in (200, 204) and coll(cid, joiner).get("my_request") == "withdrawn", (status, body))
    status, r = h.rpc("request_to_join", {"p_code": code}, joiner)
    h.check("…and can ask again", status == 200 and r.get("state") == "requested", (status, r))
    h.rpc("request_to_join", {"p_code": code}, stranger)
    status, body = h.rpc("decline_request", {"p_collection_id": cid, "p_user_id": sam}, host)
    h.check("Hannah declines Sam", status in (200, 204), (status, body))
    h.check("…Sam is told", h.notifications(h.STRANGER, "collect_declined", ev) >= 1)
    status, body = h.rpc("request_to_join", {"p_code": code}, stranger)
    h.check("…and can't ask again with this link", h.refused(status, body) and h.mentions(body, "declined"), (status, body))
    h.rpc("approve_request", {"p_collection_id": cid, "p_user_id": jo}, host)
    # Max 2: Gary and Jo are in. A third request can't be approved.
    status, cid_full_probe = h.rpc("set_collection_link", {"p_collection_id": cid, "p_enabled": True, "p_new_code": False}, host)
    h.check("set_collection_link returns the code", status == 200 and cid_full_probe == code, (status, cid_full_probe))

    # Pay → confirm → funded (min 2) ----------------------------------------------------------------
    jdebt = (debt(cid, h.JOINER) or {}).get("id")
    for token, ob in ((guest, gdebt), (joiner, jdebt)):
        h.rpc("claim_paid", {"p_obligation_id": ob}, token)
        h.rpc("confirm_received", {"p_obligation_id": ob}, host)
    h.check("both pay, Hannah confirms: funded", coll(cid).get("status") == "funded")
    status, body = h.rpc("mark_booked", {"p_id": cid}, host)
    h.check("…and booked", status in (200, 204) and coll(cid).get("status") == "booked", (status, body))

    # Turning the link off, and a new link -----------------------------------------------------------
    status, cid2 = standalone(title=PREFIX + "Escape room", min_people=1)
    code2 = coll(cid2).get("link_code")
    status, body = h.rpc("set_collection_link", {"p_collection_id": cid2, "p_enabled": False, "p_new_code": False}, guest)
    h.check("only the organiser can change the link", h.refused(status, body), (status, body))
    h.rpc("set_collection_link", {"p_collection_id": cid2, "p_enabled": False, "p_new_code": False}, host)
    status, p = preview(code2)
    h.check("a link that's off shows as off", status == 200 and p.get("link_status") == "off" and "id" not in p, p)
    status, body = h.rpc("request_to_join", {"p_code": code2}, guest)
    h.check("…and refuses requests", h.refused(status, body) and h.mentions(body, "link_off"), (status, body))
    status, code3 = h.rpc("set_collection_link", {"p_collection_id": cid2, "p_enabled": True, "p_new_code": True}, host)
    h.check("a new link replaces the old one", status == 200 and isinstance(code3, str) and code3 != code2, (status, code3))
    status, p = preview(code2)
    h.check("…the old link is dead", status == 200 and p is None, (status, p))
    status, r = h.rpc("request_to_join", {"p_code": code3}, guest)
    h.check("…the new one works", status == 200 and r.get("state") == "requested", (status, r))

    # Reports ----------------------------------------------------------------------------------------
    status, body = h.rpc("report_collection", {"p_code": code3, "p_reason": "test report"}, stranger)
    h.check("anyone signed in with the link can report it", status in (200, 204), (status, body), assumes="L-6")
    status, body = h.rpc("report_collection", {"p_code": code3, "p_reason": "again"}, stranger)
    h.check("…reporting twice is fine (kept once)", status in (200, 204), (status, body))
    status, body = h.rpc("report_collection", {"p_code": code3}, None)
    h.check("…signed-out visitors can't report", h.refused(status, body), (status, body))

    # Event collections: the link never opens the event; event guests skip approval ------------------
    event, ecode = h.make_event("collect link", 72)
    h.join(ecode, h.GUEST)
    h.rsvp(event, h.GUEST, "yes")
    status, ecid = h.rpc("create_collection", {"p_event_id": event, "p_title": "Pizza", "p_per_person_cents": 2000,
                                               "p_min_people": 1, "p_deadline": h.iso(24)}, host)
    h.check("an event collection gets a link too", status == 200 and coll(ecid).get("link_code"), (status, ecid))
    lcode = coll(ecid).get("link_code")
    status, r = h.rpc("request_to_join", {"p_code": lcode}, guest)
    h.check("event guests join straight away through the link (no approval)", status == 200 and r.get("state") == "member",
            (status, r), assumes="L-3")
    status, r = h.rpc("request_to_join", {"p_code": lcode}, stranger)
    h.check("a stranger with the link asks instead", status == 200 and r.get("state") == "requested", (status, r))
    h.rpc("approve_request", {"p_collection_id": ecid, "p_user_id": sam}, host)
    h.check("…once approved, Sam is in the collection", debt(ecid, h.STRANGER) is not None)
    _, rows = h.get("events", stranger, f"id=eq.{event}&select=id")
    h.check("…but still can't see the event", rows == [], rows, assumes="L-2")
    _, rows = h.rpc("get_event_addresses", {"p_event_ids": [event]}, stranger)
    h.check("…or its address", not h.mentions(rows, h.TEMP_ADDRESS), rows)
    _, rows = h.get("chat_messages", stranger, f"event_id=eq.{event}&select=id")
    h.check("…or its chat", rows == [], rows)
    sc = coll(ecid, stranger)
    h.check("…and the collection page doesn't offer the event", sc.get("can_open_event") is False, sc.get("can_open_event"))

    # Stats ----------------------------------------------------------------------------------------
    status, body = h.rpc("get_collect_stats", {}, host)
    h.check("the stats are still service role only", h.refused(status, body), (status, body))
