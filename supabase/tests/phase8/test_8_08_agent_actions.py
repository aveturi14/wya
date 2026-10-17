"""8.8 Home agent v1: recent people, circles, proposals that only run when approved."""

import time

ID = "8.8"
TITLE = "Home agent v1: recent people, circles, proposal cards"
MIGRATION = "agent_actions"
FUNCTION = None
DECISIONS = ["AGT-1", "AGT-2", "AGT-3", "AGT-4"]
MANUAL = "manual_checklist.md §8.8 (proposal card, WhatsApp / SMS hand-off, contacts picker, capability switches)"


def invite(event, people, ttl=None):
    args = {"p_kind": "invite_people", "p_event_id": event, "p_payload": {"user_ids": people}}
    if ttl is not None:
        args["p_ttl_seconds"] = ttl
    return args


def status_of(h, token, action):
    _, rows = h.get("agent_actions", token, f"id=eq.{action}&select=status")
    return rows[0]["status"] if isinstance(rows, list) and rows else None


def run(h):
    host, guest, joiner, stranger = h.login(h.HOST), h.login(h.GUEST), h.login(h.JOINER), h.login(h.STRANGER)
    hannah, gary, jo, sam = h.id(h.HOST), h.id(h.GUEST), h.id(h.JOINER), h.id(h.STRANGER)

    # A past event Gary and Jo went to with Hannah
    past, code = h.make_event("agent past", -48)
    if not h.check("host can create a past event", past, h.last_error):
        return
    h.join(code, h.GUEST, h.JOINER)
    h.rsvp(past, h.GUEST, "yes")
    h.rsvp(past, h.JOINER, "yes")

    _, people = h.rpc("get_recent_people", {"p_limit": 50}, host)
    ids = {p["user_id"] for p in people} if isinstance(people, list) else set()
    h.check("recent people include who you've been to events with", gary in ids and jo in ids, people)
    h.check("…and never anyone you haven't", sam not in ids and hannah not in ids, people)
    _, people = h.rpc("get_recent_people", {"p_limit": 50}, stranger)
    h.check("a stranger's list doesn't include Hannah", isinstance(people, list) and hannah not in {p["user_id"] for p in people}, people)

    # Circles ---------------------------------------------------------------------
    status, circle = h.rpc("create_circle", {"p_name": "Dinner crew"}, host)
    if h.check("host makes a circle", status == 200 and isinstance(circle, str), (status, circle)):
        h.on_cleanup(lambda: h.rpc("delete_circle", {"p_circle_id": circle}, host))
        status, body = h.rpc("add_circle_member", {"p_circle_id": circle, "p_user_id": gary}, host)
        h.check("…adds Gary", status in (200, 204), (status, body))
        status, body = h.rpc("add_circle_member", {"p_circle_id": circle, "p_user_id": sam}, host)
        h.check("…but not a stranger", h.refused(status, body), (status, body))
        _, rows = h.get("circles", guest, f"id=eq.{circle}&select=id")
        h.check("members can't see the circles they're in", rows == [], rows)
        _, rows = h.get("circle_members", guest, f"circle_id=eq.{circle}&select=user_id")
        h.check("…or who else is in them", rows == [], rows)

    # Capability switches ----------------------------------------------------------
    status, body = h.rpc("set_agent_grant", {"p_capability": "suggest_people", "p_enabled": True}, host)
    h.check("switching on a capability works", status in (200, 204), (status, body))
    h.on_cleanup(lambda: h.rpc("set_agent_grant", {"p_capability": "suggest_people", "p_enabled": False}, host))
    status, body = h.rpc("set_agent_grant", {"p_capability": "send_without_asking", "p_enabled": True}, host)
    h.check("unknown capabilities are refused", h.refused(status, body), (status, body))
    _, rows = h.get("agent_grants", guest, f"user_id=eq.{hannah}&select=capability")
    h.check("nobody sees anyone else's switches", rows == [], rows)

    # Proposals -------------------------------------------------------------------
    target, _ = h.make_event("agent target", 72)
    status, action = h.rpc("propose_action", invite(target, [gary, sam]), host)
    if not h.check("proposing an invite works", status == 200 and isinstance(action, str), (status, action)):
        return
    h.check("…and only proposes", status_of(h, host, action) == "proposed")
    _, rows = h.get("rsvps", guest, f"event_id=eq.{target}&user_id=eq.{gary}&select=status")
    h.check("nobody is invited before approval", rows == [], rows)
    h.check("other people can't see your proposals", status_of(h, guest, action) is None)
    status, body = h.patch("agent_actions", f"id=eq.{action}", {"status": "executed"}, host)
    h.check("proposals can't be edited directly", h.refused(status, body) or body == [], (status, body))
    status, body = h.rpc("approve_action", {"p_action_id": action}, guest)
    h.check("only the owner can approve", h.refused(status, body), (status, body))

    status, result = h.rpc("approve_action", {"p_action_id": action}, host)
    invited = (result or {}).get("invited", []) if isinstance(result, dict) else []
    skipped = {s["user_id"]: s["reason"] for s in (result or {}).get("skipped", [])} if isinstance(result, dict) else {}
    h.check("approving invites the people you know", status == 200 and gary in invited, (status, result), assumes="AGT-1")
    h.check("…and skips people you don't (not_connected)", skipped.get(sam) == "not_connected", result)
    _, rows = h.get("rsvps", guest, f"event_id=eq.{target}&user_id=eq.{gary}&select=status")
    h.check("Gary now has an invite", rows and rows[0]["status"] == "invited", rows)
    h.check("…and an Activity item", h.notifications(h.GUEST, "direct_invite", target) >= 1)
    h.check("the proposal is marked executed", status_of(h, host, action) == "executed")
    status, body = h.rpc("approve_action", {"p_action_id": action}, host)
    h.check("it can't run twice", h.refused(status, body), (status, body))

    _, short = h.rpc("propose_action", invite(target, [jo], ttl=1), host)
    time.sleep(2)
    status, body = h.rpc("approve_action", {"p_action_id": short}, host)
    h.check("an expired proposal can't be approved", h.refused(status, body), (status, body))
    for label, args in [("an unknown kind", {"p_kind": "delete_event", "p_event_id": target, "p_payload": {}}),
                        ("a zero lifetime", invite(target, [jo], ttl=0))]:
        status, body = h.rpc("propose_action", args, host)
        h.check(f"{label} is refused", h.refused(status, body), (status, body))
    status, body = h.rpc("propose_action", invite(target, [jo]))
    h.check("logged-out visitors can't propose", h.refused(status, body), (status, body))

    _, cancelled = h.rpc("propose_action", invite(target, [jo]), host)
    h.rpc("cancel_action", {"p_action_id": cancelled}, host)
    status, body = h.rpc("approve_action", {"p_action_id": cancelled}, host)
    h.check("a cancelled proposal can't be approved", h.refused(status, body) and status_of(h, host, cancelled) == "cancelled",
            (status, body))

    # Removed and muted people ------------------------------------------------------
    h.rpc("remove_guest", {"p_event_id": target, "p_user_id": gary}, host)
    _, again = h.rpc("propose_action", invite(target, [gary]), host)
    _, result = h.rpc("approve_action", {"p_action_id": again}, host)
    skipped = {s["user_id"]: s["reason"] for s in (result or {}).get("skipped", [])} if isinstance(result, dict) else {}
    h.check("someone removed from the event isn't invited back", skipped.get(gary) == "removed", result)

    status, body = h.rpc("mute_host", {"p_host_id": hannah}, joiner)
    h.check("Jo mutes Hannah's direct invites", status in (200, 204), (status, body), assumes="AGT-2")
    h.on_cleanup(lambda: h.rpc("unmute_host", {"p_host_id": hannah}, joiner))
    _, muted = h.rpc("propose_action", invite(target, [jo]), host)
    _, result = h.rpc("approve_action", {"p_action_id": muted}, host)
    skipped = {s["user_id"]: s["reason"] for s in (result or {}).get("skipped", [])} if isinstance(result, dict) else {}
    h.check("a muted invite is skipped as 'unavailable' (the mute stays private)", skipped.get(jo) == "unavailable",
            result, assumes="AGT-2")

    # Guests can only invite when the host allows it ------------------------------------
    closed, closed_code = h.make_event("agent closed", 72, extra={"allow_guest_invites": False})
    h.join(closed_code, h.GUEST)
    _, by_guest = h.rpc("propose_action", invite(closed, [jo]), guest)
    status, body = h.rpc("approve_action", {"p_action_id": by_guest}, guest)
    h.check("a guest can't invite people when the host turned that off", h.refused(status, body), (status, body))

    # Sharing a link outside wya: the app opens the share sheet, then marks it done ---------
    status, share = h.rpc("propose_action", {"p_kind": "share_link", "p_event_id": target, "p_payload": {"channel": "whatsapp"}}, host)
    status, result = h.rpc("approve_action", {"p_action_id": share}, host)
    h.check("approving a share returns the text and the invite link",
            status == 200 and isinstance(result, dict) and "/invite/" in result.get("url", "") and result.get("text"),
            (status, result))
    h.check("…without marking it sent yet", status_of(h, host, share) == "approved")
    h.rpc("mark_action_executed", {"p_action_id": share}, host)
    h.check("the app marks it sent after the share sheet", status_of(h, host, share) == "executed")
