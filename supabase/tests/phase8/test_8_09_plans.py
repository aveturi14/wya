"""8.9 Flexible plans: items re-flow, fixed times stay put, conflicts are flagged."""

import datetime

ID = "8.9"
TITLE = "Flexible plans (/plan) with re-flow"
MIGRATION = "plans"
FUNCTION = None
DECISIONS = ["PLAN-1"]
MANUAL = "manual_checklist.md §8.9 (plan card, conflict wording)"


def run(h):
    host, guest, joiner, stranger = h.login(h.HOST), h.login(h.GUEST), h.login(h.JOINER), h.login(h.STRANGER)

    event, code = h.make_event("plan", 72)
    if not h.check("host can create a temp event", event, h.last_error):
        return
    h.join(code, h.GUEST, h.JOINER)
    h.rsvp(event, h.GUEST, "yes")  # Jo stays 'invited'
    _, rows = h.get("events", host, f"id=eq.{event}&select=date")
    start = h.parse_time(rows[0]["date"])
    at = lambda minutes: start + datetime.timedelta(minutes=minutes)  # noqa: E731

    def item(title, minutes, fixed=None, token=guest):
        return h.rpc("add_plan_item", {"p_event_id": event, "p_title": title, "p_duration_minutes": minutes,
                                       "p_fixed_start": fixed.isoformat() if fixed else None}, token)

    status, dinner = item("Dinner", 90)
    h.check("a Going guest adds dinner", status == 200 and isinstance(dinner, str), (status, dinner))
    item("Movie", 120, fixed=at(120))
    _, drinks = item("Drinks", 60, token=host)
    status, body = item("Karaoke", 60, token=joiner)
    h.check("someone who can't chat can't add to the plan", h.denied(status), (status, body), assumes="PLAN-1")
    status, body = h.rpc("get_plan", {"p_event_id": event}, stranger)
    h.check("strangers can't see the plan", h.denied(status) or body == [], (status, body))

    def plan():
        _, rows = h.rpc("get_plan", {"p_event_id": event}, guest)
        return {r["title"]: r for r in rows} if isinstance(rows, list) else {}

    p = plan()
    h.check("items run back to back from the start, the movie at its fixed time",
            p and h.parse_time(p["Dinner"]["starts_at"]) == at(0) and h.parse_time(p["Movie"]["starts_at"]) == at(120)
            and h.parse_time(p["Drinks"]["starts_at"]) == at(240), p)
    h.check("no conflicts yet", p and not any(r["conflict"] for r in p.values()), p)

    status, body = h.rpc("delay_plan_item", {"p_item_id": dinner, "p_minutes": 45}, guest)
    h.check("dinner runs 45 minutes over", status in (200, 204), (status, body))
    p = plan()
    h.check("the movie keeps its time and is flagged as a conflict",
            p and h.parse_time(p["Movie"]["starts_at"]) == at(120) and p["Movie"]["conflict"] is True
            and h.parse_time(p["Dinner"]["ends_at"]) == at(135), p)

    status, body = h.rpc("remove_plan_item", {"p_item_id": drinks}, guest)
    h.check("you can't remove someone else's item", h.denied(status), (status, body), assumes="PLAN-1")
    status, body = h.rpc("remove_plan_item", {"p_item_id": drinks}, host)
    h.check("the host can", status in (200, 204), (status, body))

    for label, minutes in [("zero minutes", 0), ("13 hours", 13 * 60)]:
        status, body = item("Odd", minutes)
        h.check(f"a duration of {label} is refused", h.denied(status), (status, body))
    for n in range(6):
        item(f"Stop {n}", 30)
    status, body = item("One too many", 30)
    h.check("a plan stops at 8 items", h.denied(status) and len(plan()) == 8, (status, body))
