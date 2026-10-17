"""8.13 Push notifications: token registration and a send function users can't trigger."""

ID = "8.13"
TITLE = "Push notifications"
MIGRATION = "push"
FUNCTION = "send-push"
DECISIONS = ["PUSH-1"]
MANUAL = "manual_checklist.md §8.13 (permission timing, delivery on real iPhone and Android, notification actions)"

TOKEN = "ExponentPushToken[phase8-test-token]"


def run(h):
    host, guest = h.login(h.HOST), h.login(h.GUEST)

    status, body = h.rpc("register_push_token", {"p_token": TOKEN, "p_platform": "ios"}, guest)
    h.check("a signed-in user registers their push token", status in (200, 204), (status, body))
    h.on_cleanup(lambda: h.rpc("unregister_push_token", {"p_token": TOKEN}, guest))
    for label, args in [("a malformed token", {"p_token": "abc", "p_platform": "ios"}),
                        ("an unknown platform", {"p_token": TOKEN, "p_platform": "web"})]:
        status, body = h.rpc("register_push_token", args, guest)
        h.check(f"{label} is refused", h.denied(status), (status, body))
    status, body = h.rpc("register_push_token", {"p_token": TOKEN, "p_platform": "ios"})
    h.check("logged-out visitors can't register tokens", h.denied(status), (status, body))

    _, rows = h.get("push_tokens", guest, "select=token")
    h.check("you see your own tokens", isinstance(rows, list) and any(r["token"] == TOKEN for r in rows), rows)
    _, rows = h.get("push_tokens", host, f"token=eq.{TOKEN}&select=token")
    h.check("nobody sees anyone else's", rows == [], rows)
    status, body = h.insert("push_tokens", {"user_id": h.id(h.HOST), "token": TOKEN, "platform": "ios"}, guest, "token")
    h.check("tokens can't be written directly", h.denied(status), (status, body))

    for who, token in [("logged-out visitors", None), ("signed-in users", guest)]:
        status, body = h.fn_raw("send-push", {"notification_id": "00000000-0000-0000-0000-000000000000"}, token)
        h.check(f"{who} can't trigger send-push (it needs the webhook secret)", status in (401, 403), (status, body))
