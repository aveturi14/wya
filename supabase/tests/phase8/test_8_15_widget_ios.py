"""8.15 iOS Live Activity + widget: token registration and an update function users can't trigger."""

ID = "8.15"
TITLE = "iOS Live Activity + home-screen widget"
MIGRATION = "live_activity"
FUNCTION = "live-activity"
DECISIONS = ["LA-1", "WID-1"]
MANUAL = "manual_checklist.md §8.15 (Live Activity on a real iPhone: start, updates, I'm here, after-event debt)"

FAKE_TOKEN = "ab" * 32


def run(h):
    host, guest, stranger = h.login(h.HOST), h.login(h.GUEST), h.login(h.STRANGER)

    event, code = h.make_event("live activity", 3)
    if not h.check("host can create an event today", event, h.last_error):
        return
    h.join(code, h.GUEST)
    h.rsvp(event, h.GUEST, "yes")

    args = {"p_event_id": event, "p_token": FAKE_TOKEN, "p_kind": "update"}
    status, body = h.rpc("register_live_activity_token", args, guest)
    h.check("a Going guest registers a Live Activity token", status in (200, 204), (status, body))
    status, body = h.rpc("register_live_activity_token", args, stranger)
    h.check("strangers can't, for an event they're not on", h.denied(status), (status, body))
    status, body = h.rpc("register_live_activity_token", {**args, "p_kind": "forever"}, guest)
    h.check("unknown token kinds are refused", h.denied(status), (status, body))
    _, rows = h.get("live_activity_tokens", host, f"event_id=eq.{event}&select=token")
    h.check("the host can't read guests' tokens", rows == [], rows)

    for who, token in [("logged-out visitors", None), ("signed-in users", guest)]:
        status, body = h.fn_raw("live-activity", {"event_id": event}, token)
        h.check(f"{who} can't trigger live-activity (it needs the webhook secret)", status in (401, 403), (status, body))
