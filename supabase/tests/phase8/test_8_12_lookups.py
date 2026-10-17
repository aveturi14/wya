"""8.12 Venue and showtime lookups (/find, /movies)."""

ID = "8.12"
TITLE = "Venue and showtime lookups"
MIGRATION = None
FUNCTION = "lookup"
DECISIONS = ["SHOW-1", "LOOK-1"]
MANUAL = "manual_checklist.md §8.12 (results card, Make it a poll, Use this venue)"


def run(h):
    guest, joiner, stranger = h.login(h.GUEST), h.login(h.JOINER), h.login(h.STRANGER)

    event, code = h.make_event("lookup", 72)
    if not h.check("host can create a temp event", event, h.last_error):
        return
    h.join(code, h.GUEST, h.JOINER)
    h.rsvp(event, h.GUEST, "yes")

    places = {"event_id": event, "type": "places", "query": "thai near Fitzroy"}
    for who, token in [("logged-out visitors", None), ("strangers", stranger), ("invited guests who can't chat", joiner)]:
        status, body = h.fn_raw("lookup", places, token)
        h.check(f"{who} can't run lookups", status in (401, 403), (status, body))
    status, body = h.fn_raw("lookup", {**places, "type": "flights"}, guest)
    h.check("unknown lookup types are refused", status == 400, (status, body))

    for kind, query, fields in [("places", "thai near Fitzroy", {"name", "maps_url"}),
                                ("showtimes", "Hoyts Melbourne Central saturday", {"film", "starts_at"})]:
        try:
            status, body = h.fn("lookup", {"event_id": event, "type": kind, "query": query}, guest)
        except h.Blocked as e:
            h.record("blocked", f"{kind} lookup", f"missing: {e} (docs/PHASE8.md §3)")
            continue
        results = body.get("results", []) if isinstance(body, dict) else []
        h.check(f"{kind}: up to 5 results with {', '.join(sorted(fields))}",
                status == 200 and 0 < len(results) <= 5 and all(fields <= set(r) for r in results), (status, body))
        h.check(f"{kind}: posted in the chat", isinstance(body, dict) and body.get("message_id"), body)
