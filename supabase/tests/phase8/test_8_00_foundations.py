"""8.0 Foundations: typed chat messages, bot messages only from the server, function scaffold."""

ID = "8.0"
TITLE = "Foundations: typed chat messages, rate limits, function scaffold"
MIGRATION = "phase8_foundations"
FUNCTION = None
DECISIONS = []
MANUAL = "manual_checklist.md §8.0"


def run(h):
    host, guest = h.login(h.HOST), h.login(h.GUEST)
    gary = h.id(h.GUEST)

    event, code = h.make_event("foundations", 72)
    if not h.check("host can create a temp event", event, h.last_error):
        return
    h.join(code, h.GUEST)
    h.rsvp(event, h.GUEST, "yes")

    status, body = h.insert("chat_messages", {"event_id": event, "user_id": gary, "content": "hi"}, guest, "id,kind")
    h.check("a plain text message still works and defaults to kind 'text'",
            status == 201 and body[0]["kind"] == "text", (status, body))

    for kind in ["bot", "system", "poll", "split", "plan"]:
        status, body = h.insert("chat_messages", {"event_id": event, "user_id": gary, "content": "x", "kind": kind}, guest)
        h.check(f"clients can't insert '{kind}' messages directly", h.refused(status, body), (status, body))

    status, body = h.insert("chat_messages", {"event_id": event, "user_id": None, "content": "x", "kind": "bot"}, guest)
    h.check("clients can't insert a message with no sender", h.refused(status, body), (status, body))
    status, body = h.insert("chat_messages", {"event_id": event, "user_id": h.id(h.HOST), "content": "x"}, guest)
    h.check("clients can't post as someone else", h.denied(status), (status, body))

    status, body = h.rpc("post_bot_message", {"p_event_id": event, "p_text": "x", "p_data": {}}, guest)
    h.check("post_bot_message isn't callable by users", h.refused(status, body), (status, body))
    status, body = h.rpc("post_bot_message", {"p_event_id": event, "p_text": "x", "p_data": {}}, host)
    h.check("…not even by the host", h.refused(status, body), (status, body))

    status, rows = h.get("chat_messages", guest, f"event_id=eq.{event}&select=id,kind,data")
    h.check("kind and data are readable", status == 200 and isinstance(rows, list), (status, rows))

    gitignore = (h.ROOT / ".gitignore").read_text()
    h.check("supabase/functions/.env is git-ignored (local function secrets)", "supabase/functions/.env" in gitignore)
