"""8.16 Live "on my way": meetup mode is host-only and time-boxed. The location itself is never stored,
and the private Realtime channel is checked by hand (it isn't reachable over plain REST)."""

ID = "8.16"
TITLE = "Live \"on my way\" (opt-in, ephemeral)"
MIGRATION = "meetup_mode"
FUNCTION = None
DECISIONS = ["LOC-1"]
MANUAL = "manual_checklist.md §8.16 (permission at tap time, buckets, channel access, stops on arrival)"


def run(h):
    host, guest = h.login(h.HOST), h.login(h.GUEST)

    soon, code = h.make_event("meetup soon", 1)
    if not h.check("host can create an event starting in an hour", soon, h.last_error):
        return
    h.join(code, h.GUEST)
    h.rsvp(soon, h.GUEST, "yes")

    status, body = h.rpc("set_meetup_mode", {"p_event_id": soon, "p_on": True}, guest)
    h.check("guests can't turn on meetup mode", h.denied(status), (status, body))
    status, body = h.rpc("set_meetup_mode", {"p_event_id": soon, "p_on": True}, host)
    h.check("the host can, near the start", status in (200, 204), (status, body))
    _, rows = h.get("events", guest, f"id=eq.{soon}&select=meetup_until")
    h.check("meetup_until is set and readable (column grant + EVENT_COLUMNS)", rows and rows[0]["meetup_until"], rows)
    h.rpc("set_meetup_mode", {"p_event_id": soon, "p_on": False}, host)
    _, rows = h.get("events", guest, f"id=eq.{soon}&select=meetup_until")
    h.check("turning it off clears it", rows and rows[0]["meetup_until"] is None, rows)

    far, _ = h.make_event("meetup far", 72)
    status, body = h.rpc("set_meetup_mode", {"p_event_id": far, "p_on": True}, host)
    h.check("not allowed 3 days ahead", h.denied(status), (status, body))
