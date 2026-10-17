"""8.5 Track records: a host's record, including late cancellations (which deletes used to erase)."""

ID = "8.5"
TITLE = "Track records (host record)"
MIGRATION = "track_records"
FUNCTION = None
DECISIONS = ["REC-1", "REC-2"]
MANUAL = "manual_checklist.md §8.5 (record under the host's name, your own record's wording)"


def record_of(h, token, host_id):
    status, rows = h.rpc("get_host_record", {"p_host_id": host_id}, token)
    return status, (rows[0] if isinstance(rows, list) and rows else None)


def run(h):
    host, guest, stranger = h.login(h.HOST), h.login(h.GUEST), h.login(h.STRANGER)
    hannah = h.id(h.HOST)

    status, mine = record_of(h, host, hannah)
    h.check("a host can see their own record", status == 200 and mine and {"hosted", "happened", "cancelled_late"} <= set(mine),
            (status, mine))
    status, seen = record_of(h, guest, hannah)
    h.check("a guest who shares an event with Hannah can see it", status == 200 and seen, (status, seen))
    status, body = h.rpc("get_host_record", {"p_host_id": hannah}, stranger)
    h.check("a stranger can't", h.refused(status, body) or body == [], (status, body), assumes="REC-1")
    status, body = h.rpc("get_host_record", {"p_host_id": hannah})
    h.check("logged-out visitors can't", h.refused(status, body), (status, body), assumes="REC-1")
    if not mine:
        return
    before = mine["cancelled_late"]

    # Called off 10 hours before the start with someone Going: counts
    late, code = h.make_event("host record late", 10)
    h.join(code, h.GUEST)
    h.rsvp(late, h.GUEST, "yes")
    h.delete_event(late)
    _, after = record_of(h, host, hannah)
    h.check("deleting an event with Going guests within 48 h counts as a late cancellation",
            after and after["cancelled_late"] == before + 1, (before, after), assumes="REC-2")

    # Called off 3 days ahead: doesn't count
    early, code = h.make_event("host record early", 72)
    h.join(code, h.GUEST)
    h.rsvp(early, h.GUEST, "yes")
    h.delete_event(early)
    _, again = record_of(h, host, hannah)
    h.check("deleting one 3 days ahead doesn't", again and after and again["cancelled_late"] == after["cancelled_late"],
            (after, again), assumes="REC-2")

    # Called off within 48 h but nobody was Going: doesn't count
    empty, _ = h.make_event("host record empty", 10)
    h.delete_event(empty)
    _, last = record_of(h, host, hannah)
    h.check("deleting one nobody was going to doesn't", last and again and last["cancelled_late"] == again["cancelled_late"],
            (again, last))
