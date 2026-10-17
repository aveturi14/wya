"""8.4 "I'm here" check-in: a claim that pre-ticks Who came?, inside a time window."""

ID = "8.4"
TITLE = "\"I'm here\" check-in (/here)"
MIGRATION = "check_in"
FUNCTION = None
DECISIONS = ["CHK-1", "CHK-2"]
MANUAL = "manual_checklist.md §8.4 (button during the window, Who came? pre-ticked)"


def run(h):
    host, guest, joiner, stranger = h.login(h.HOST), h.login(h.GUEST), h.login(h.JOINER), h.login(h.STRANGER)
    gary = h.id(h.GUEST)

    # Started 30 minutes ago: inside the window
    event, code = h.make_event("check-in now", -0.5)
    if not h.check("host can create an event that's under way", event, h.last_error):
        return
    h.join(code, h.GUEST, h.JOINER)
    h.rsvp(event, h.GUEST, "yes")
    h.rsvp(event, h.JOINER, "maybe")

    status, body = h.rpc("check_in", {"p_event_id": event}, guest)
    h.check("a Going guest checks in during the event", status == 200 and body, (status, body))
    status, again = h.rpc("check_in", {"p_event_id": event}, guest)
    h.check("checking in twice is fine (same time kept)", status == 200 and again == body, (status, again))
    for who, token in [("a Maybe", joiner), ("a stranger", stranger)]:
        status, body = h.rpc("check_in", {"p_event_id": event}, token)
        h.check(f"{who} can't check in", h.denied(status), (status, body))
    status, body = h.patch("rsvps", f"event_id=eq.{event}&user_id=eq.{gary}", {"checked_in_at": h.iso(0)}, guest)
    h.check("checked_in_at can't be written directly", h.denied(status), (status, body))

    _, rows = h.rpc("get_guest_list", {"p_event_id": event}, host)
    gary_row = next((r for r in rows if r["user_id"] == gary), {}) if isinstance(rows, list) else {}
    h.check("the host sees when Gary checked in", gary_row.get("checked_in_at"), rows)
    _, rows = h.rpc("get_guest_list", {"p_event_id": event}, guest)
    h.check("guests don't see check-in times", isinstance(rows, list) and all(not r.get("checked_in_at") for r in rows), rows)

    status, body = h.rpc("record_attendance", {"p_event_id": event, "p_absent": [gary]}, host)
    _, rows = h.get("rsvps", guest, f"event_id=eq.{event}&user_id=eq.{gary}&select=attended")
    h.check("the host can still mark a checked-in guest absent (a check-in is a claim)",
            status in (200, 204) and rows and rows[0]["attended"] is False, (status, body, rows), assumes="CHK-1")

    # Five hours before the start: too early
    early, code2 = h.make_event("check-in early", 5)
    h.join(code2, h.GUEST)
    h.rsvp(early, h.GUEST, "yes")
    status, body = h.rpc("check_in", {"p_event_id": early}, guest)
    h.check("checking in 5 hours early is refused", h.denied(status), (status, body), assumes="CHK-2")
