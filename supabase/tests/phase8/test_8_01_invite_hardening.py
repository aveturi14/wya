"""8.1 Invite hardening: guest cap, link expiry and uses, approve-to-join, personal links."""

ID = "8.1"
TITLE = "Invite hardening: guest cap, link limits, approve-to-join, personal links"
MIGRATION = "invite_hardening"
FUNCTION = None
DECISIONS = ["INV-1", "INV-2", "INV-3"]
MANUAL = "manual_checklist.md §8.1"


def limits(event, expires_at=None, max_uses=None, approval=False):
    return {"p_event_id": event, "p_expires_at": expires_at, "p_max_uses": max_uses, "p_requires_approval": approval}


def run(h):
    host, guest, joiner, stranger = h.login(h.HOST), h.login(h.GUEST), h.login(h.JOINER), h.login(h.STRANGER)
    jo = h.id(h.JOINER)

    # Guest cap -----------------------------------------------------------------
    event, code = h.make_event("guest cap", 72, extra={"max_guests": 1})
    if not h.check("host can create an event with a guest limit", event, h.last_error):
        return
    status, rows = h.get("events", host, f"id=eq.{event}&select=id,max_guests")
    h.check("max_guests is readable (column grant + EVENT_COLUMNS)",
            status == 200 and rows and rows[0]["max_guests"] == 1, (status, rows))
    h.join(code, h.GUEST, h.JOINER)
    status, body = h.rsvp(event, h.GUEST, "yes")
    h.check("the first Going guest fits", status == 200, (status, body))
    status, body = h.rsvp(event, h.JOINER, "yes")
    h.check("a full event refuses another 'I'm in' with event_full",
            h.refused(status, body) and h.mentions(body, "event_full"), (status, body), assumes="INV-1")
    status, body = h.rsvp(event, h.JOINER, "maybe")
    h.check("Maybe isn't capped", status == 200, (status, body), assumes="INV-1")

    status, body = h.rpc("set_invite_limits", limits(event, max_uses=1), guest)
    h.check("guests can't change invite limits", h.refused(status, body), (status, body))
    status, body = h.rpc("set_invite_limits", limits(event, max_uses=1))
    h.check("logged-out visitors can't change invite limits", h.refused(status, body), (status, body))

    # Uses ----------------------------------------------------------------------
    e_uses, code_uses = h.make_event("invite uses", 72)
    status, body = h.rpc("set_invite_limits", limits(e_uses, max_uses=1), host)
    h.check("host can limit an invite link to one use", status in (200, 204), (status, body))
    status, body = h.rpc("accept_invite", {"p_code": code_uses}, joiner)
    h.check("the first person can use it", status == 200, (status, body))
    status, body = h.rpc("accept_invite", {"p_code": code_uses}, guest)
    h.check("the second is refused with invite_used_up", h.refused(status, body) and h.mentions(body, "invite_used_up"),
            (status, body))

    # Expiry --------------------------------------------------------------------
    e_exp, code_exp = h.make_event("invite expiry", 72)
    h.rpc("set_invite_limits", limits(e_exp, expires_at=h.iso(-1)), host)
    status, body = h.rpc("accept_invite", {"p_code": code_exp}, joiner)
    h.check("an expired link is refused with invite_expired", h.refused(status, body) and h.mentions(body, "invite_expired"),
            (status, body))

    # Approve to join -------------------------------------------------------------
    e_appr, code_appr = h.make_event("approve joins", 72)
    h.rpc("set_invite_limits", limits(e_appr, approval=True), host)
    status, body = h.rpc("accept_invite", {"p_code": code_appr}, joiner)
    h.check("with approval on, accepting still succeeds", status == 200, (status, body))
    _, rows = h.get("rsvps", joiner, f"event_id=eq.{e_appr}&user_id=eq.{jo}&select=status")
    h.check("…as 'requested'", rows and rows[0]["status"] == "requested", rows)
    _, rows = h.get("events", joiner, f"id=eq.{e_appr}&select=id")
    h.check("a requested person can't read the event", rows == [], rows, assumes="INV-2")
    _, rows = h.rpc("get_event_addresses", {"p_event_ids": [e_appr]}, joiner)
    h.check("…or its address", not rows, rows)
    status, body = h.insert("chat_messages", {"event_id": e_appr, "user_id": jo, "content": "let me in"}, joiner)
    h.check("…or post in its chat", h.refused(status, body), (status, body))
    h.check("the host is told someone asked to join", h.notifications(h.HOST, "join_requested", e_appr) >= 1)
    status, body = h.rpc("approve_join", {"p_event_id": e_appr, "p_user_id": jo}, stranger)
    h.check("only the host can approve", h.refused(status, body), (status, body))
    status, body = h.rpc("approve_join", {"p_event_id": e_appr, "p_user_id": jo}, host)
    h.check("host approves", status in (200, 204), (status, body))
    _, rows = h.get("rsvps", joiner, f"event_id=eq.{e_appr}&user_id=eq.{jo}&select=status")
    h.check("…and they become 'invited'", rows and rows[0]["status"] == "invited", rows)
    _, rows = h.get("events", joiner, f"id=eq.{e_appr}&select=id")
    h.check("…and can now read the event", rows and rows[0]["id"] == e_appr, rows)

    h.rpc("accept_invite", {"p_code": code_appr}, guest)
    status, body = h.rpc("decline_join", {"p_event_id": e_appr, "p_user_id": h.id(h.GUEST)}, host)
    h.check("host declines a request", status in (200, 204), (status, body))
    status, body = h.rpc("accept_invite", {"p_code": code_appr}, guest)
    h.check("a declined person can't ask again", h.refused(status, body), (status, body))

    # Personal links --------------------------------------------------------------
    e_pers, _ = h.make_event("personal link", 72)
    status, personal = h.rpc("create_personal_invite", {"p_event_id": e_pers, "p_label": "Jo"}, host)
    h.check("host makes a personal link", status == 200 and isinstance(personal, str), (status, personal))
    if isinstance(personal, str):
        status, body = h.rpc("accept_invite", {"p_code": personal}, joiner)
        h.check("the person it's for can use it", status == 200, (status, body))
        status, body = h.rpc("accept_invite", {"p_code": personal}, guest)
        h.check("a personal link works only once", h.refused(status, body), (status, body))
    status, body = h.rpc("create_personal_invite", {"p_event_id": e_pers, "p_label": "x"}, stranger)
    h.check("strangers can't make personal links", h.refused(status, body), (status, body))
