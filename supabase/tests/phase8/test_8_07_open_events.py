"""8.7 Open events: candidate times, availability, best slot, lock in."""

ID = "8.7"
TITLE = "Open events: availability, best slot, lock in"
MIGRATION = "open_events"
FUNCTION = None
DECISIONS = ["OPEN-1", "OPEN-2", "OPEN-3"]
MANUAL = "manual_checklist.md §8.7 (Find a time flow, the grid, Lock it in)"


def run(h):
    host, guest, joiner, stranger = h.login(h.HOST), h.login(h.GUEST), h.login(h.JOINER), h.login(h.STRANGER)
    gary = h.id(h.GUEST)

    event, code = h.make_event("open dinner", 96, extra={"kind": "open"})
    if not h.check("host can create an open event", event, h.last_error):
        return
    _, rows = h.get("events", host, f"id=eq.{event}&select=kind")
    h.check("kind is readable (column grant + EVENT_COLUMNS)", rows and rows[0]["kind"] == "open", rows)
    bad, _ = h.make_event("open pledge", 96, mode="pledge", extra={"kind": "open"})
    h.check("an open event can't carry a pledge", bad is None, bad, assumes="OPEN-3")
    h.join(code, h.GUEST, h.JOINER)

    slots = [{"starts_at": h.iso(96)}, {"starts_at": h.iso(120)}, {"starts_at": h.iso(144), "label": "Sunday lunch"}]
    status, body = h.rpc("add_slots", {"p_event_id": event, "p_slots": slots}, guest)
    h.check("guests can't add candidate times", h.denied(status), (status, body), assumes="OPEN-1")
    status, ids = h.rpc("add_slots", {"p_event_id": event, "p_slots": [{"starts_at": h.iso(-5)}, {"starts_at": h.iso(100)}]}, host)
    h.check("times in the past are refused", h.denied(status), (status, ids))
    status, ids = h.rpc("add_slots", {"p_event_id": event, "p_slots": slots}, host)
    if not h.check("the host adds three candidate times", status == 200 and isinstance(ids, list) and len(ids) == 3, (status, ids)):
        return
    a, b, c = ids

    status, body = h.rpc("get_slot_summary", {"p_event_id": event}, stranger)
    h.check("strangers can't see the times", h.denied(status) or body == [], (status, body))

    h.rpc("set_availability", {"p_event_id": event, "p_answers": {a: "yes", b: "yes"}}, guest)
    status, body = h.rpc("set_availability", {"p_event_id": event, "p_answers": {b: "yes", c: "maybe"}}, joiner)
    h.check("invited guests can answer", status in (200, 204), (status, body))
    _, summary = h.rpc("get_slot_summary", {"p_event_id": event}, guest)
    rank = {r["slot_id"]: r["rank"] for r in summary} if isinstance(summary, list) else {}
    h.check("the slot most people can make ranks first", rank.get(b) == 1 and rank.get(a) == 2 and rank.get(c) == 3, summary)

    h.rpc("set_availability", {"p_event_id": event, "p_answers": {a: "no", b: "yes"}}, guest)
    _, summary = h.rpc("get_slot_summary", {"p_event_id": event}, guest)
    by_id = {r["slot_id"]: r for r in summary} if isinstance(summary, list) else {}
    h.check("changing an answer replaces it", by_id and by_id[a]["yes"] == 0 and by_id[a]["no"] == 1
            and by_id[c]["rank"] == 2 and by_id[a]["rank"] == 3, summary)

    other, _ = h.make_event("open other", 96, extra={"kind": "open"})
    _, other_ids = h.rpc("add_slots", {"p_event_id": other, "p_slots": slots[:2]}, host)
    if isinstance(other_ids, list) and other_ids:
        status, body = h.rpc("set_availability", {"p_event_id": event, "p_answers": {other_ids[0]: "yes"}}, guest)
        h.check("you can't answer for another event's times", h.denied(status), (status, body))

    status, body = h.rpc("lock_event", {"p_event_id": event, "p_slot_id": b}, guest)
    h.check("guests can't lock the time", h.denied(status), (status, body))
    status, body = h.rpc("lock_event", {"p_event_id": event, "p_slot_id": b}, host)
    h.check("the host locks the best time", status in (200, 204), (status, body))
    _, rows = h.get("events", host, f"id=eq.{event}&select=kind,date")
    h.check("the event becomes fixed at that time",
            rows and rows[0]["kind"] == "fixed" and h.parse_time(rows[0]["date"]) == h.parse_time(slots[1]["starts_at"]), rows)
    h.check("everyone is told it's on", h.notifications(h.JOINER, "event_locked", event) >= 1)
    _, rows = h.get("rsvps", guest, f"event_id=eq.{event}&user_id=eq.{gary}&select=status")
    h.check("saying yes to a time didn't make Gary Going", rows and rows[0]["status"] == "invited", rows, assumes="OPEN-2")
    status, body = h.rpc("set_availability", {"p_event_id": event, "p_answers": {a: "yes"}}, guest)
    h.check("answers are closed once locked", h.denied(status), (status, body))
