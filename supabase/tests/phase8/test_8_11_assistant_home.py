"""8.11 "Ask wya" bar: it only proposes, respects the capability switches, and never reaches strangers."""

ID = "8.11"
TITLE = "\"Ask wya\" bar on Events"
MIGRATION = None
FUNCTION = "assistant-home"
DECISIONS = ["AI-1", "AGT-1"]
MANUAL = "manual_checklist.md §8.11 (bar, proposal cards, editing recipients)"

ASK = {"text": "Invite everyone I've been to events with recently to my next event"}


def actions(h, token, ids):
    if not ids:
        return []
    _, rows = h.get("agent_actions", token, f"id=in.({','.join(ids)})&select=id,kind,status,payload")
    return rows if isinstance(rows, list) else []


def run(h):
    host = h.login(h.HOST)
    sam = h.id(h.STRANGER)

    status, body = h.fn_raw("assistant-home", ASK)
    h.check("logged-out calls are refused", status in (401, 403), (status, body))

    event, _ = h.make_event("ask wya target", 72)
    if not h.check("host has an upcoming event", event, h.last_error):
        return

    def cancel_all(rows):
        for row in rows:
            if row["status"] == "proposed":
                h.rpc("cancel_action", {"p_action_id": row["id"]}, host)

    h.rpc("set_agent_grant", {"p_capability": "suggest_people", "p_enabled": False}, host)
    status, body = h.fn("assistant-home", ASK, host)  # raises Blocked without a key
    h.check("it answers", status == 200 and isinstance(body, dict) and "reply" in body, (status, body))
    rows = actions(h, host, (body or {}).get("action_ids", []) if isinstance(body, dict) else [])
    h.check("with 'Suggest people' off, it proposes nobody from your past events",
            not any(r["kind"] == "invite_people" and r["payload"].get("user_ids") for r in rows), rows)
    cancel_all(rows)

    h.rpc("set_agent_grant", {"p_capability": "suggest_people", "p_enabled": True}, host)
    h.on_cleanup(lambda: h.rpc("set_agent_grant", {"p_capability": "suggest_people", "p_enabled": False}, host))
    status, body = h.fn("assistant-home", ASK, host)
    rows = actions(h, host, (body or {}).get("action_ids", []) if isinstance(body, dict) else [])
    h.check("with it on, anything it creates is only a proposal", all(r["status"] == "proposed" for r in rows), rows)
    h.check("…and never includes someone you don't know", not any(sam in (r["payload"].get("user_ids") or []) for r in rows),
            rows)
    cancel_all(rows)
