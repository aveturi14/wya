"""8.14 Android widget: the snapshot it shows follows the address rule (it sits on a lock screen)."""

ID = "8.14"
TITLE = "Android widget + ongoing notification (shared snapshot)"
MIGRATION = "widget_snapshot"
FUNCTION = None
DECISIONS = ["WID-1"]
MANUAL = "manual_checklist.md §8.14 (widget on an emulator and a real Android phone, ongoing notification)"


def snapshot(h, token):
    status, rows = h.rpc("get_widget_snapshot", {}, token)
    return status, ({r["event_id"]: r for r in rows if r.get("event_id")} if isinstance(rows, list) else {})


def run(h):
    guest, joiner, stranger = h.login(h.GUEST), h.login(h.JOINER), h.login(h.STRANGER)

    today, code = h.make_event("widget today", 3, mode="pledge")
    if not h.check("host can create a pledge event today", today, h.last_error):
        return
    h.join(code, h.GUEST, h.JOINER)
    h.rsvp(today, h.GUEST, "yes")  # Jo stays 'invited'
    later, code2 = h.make_event("widget later", 72)
    h.join(code2, h.GUEST)
    h.rsvp(later, h.GUEST, "yes")

    status, rows = snapshot(h, guest)
    h.check("Gary's snapshot has today's event with the address", status == 200 and today in rows
            and rows[today].get("address") == h.TEMP_ADDRESS, (status, rows), assumes="WID-1")
    h.check("…but not one three days away", later not in rows, rows)
    status, rows = snapshot(h, joiner)
    h.check("Jo (invited, pledge event) sees it without the address", today in rows and rows[today].get("address") is None, rows)
    status, rows = snapshot(h, stranger)
    h.check("a stranger's snapshot doesn't include it", status == 200 and today not in rows, (status, rows))
    status, body = h.rpc("get_widget_snapshot", {})
    h.check("logged-out visitors get nothing", h.denied(status), (status, body))
    status, rows = h.rpc("get_widget_snapshot", {}, guest)
    h.check("at most 3 rows", isinstance(rows, list) and len(rows) <= 3, rows)
