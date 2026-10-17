"""8.2 Slash commands and polls (the commands are parsed in the app; polls are checked here)."""

import concurrent.futures

ID = "8.2"
TITLE = "Slash commands and polls"
MIGRATION = "polls"
FUNCTION = None
DECISIONS = ["CMD-1"]
MANUAL = "manual_checklist.md §8.2 (typing /, /help, the poll card)"


def poll_args(event, options, question="Where should we eat?", multi=False):
    return {"p_event_id": event, "p_question": question, "p_options": options, "p_multi": multi}


def run(h):
    host, guest, joiner, stranger = h.login(h.HOST), h.login(h.GUEST), h.login(h.JOINER), h.login(h.STRANGER)
    gary = h.id(h.GUEST)

    event, code = h.make_event("polls", 72)
    if not h.check("host can create a temp event", event, h.last_error):
        return
    h.join(code, h.GUEST, h.JOINER)
    h.rsvp(event, h.GUEST, "yes")  # Jo stays 'invited', so can't chat

    status, poll = h.rpc("create_poll", poll_args(event, ["Thai", "Pizza", "Sushi"]), guest)
    if not h.check("a Going guest can start a poll", status == 200 and isinstance(poll, str), (status, poll)):
        return
    for who, token in [("an invited guest who can't chat", joiner), ("a stranger", stranger)]:
        status, body = h.rpc("create_poll", poll_args(event, ["A", "B"]), token)
        h.check(f"{who} can't start a poll", h.refused(status, body), (status, body))
    for label, options in [("one option", ["Only"]), ("seven options", list("ABCDEFG")), ("a 61-character option", ["x" * 61, "y"])]:
        status, body = h.rpc("create_poll", poll_args(event, options), guest)
        h.check(f"a poll with {label} is refused", h.refused(status, body), (status, body))

    _, rows = h.get("chat_messages", host, f"id=eq.{poll}&select=kind,data")
    options = (rows[0]["data"] or {}).get("options", []) if rows else []
    h.check("it's a 'poll' message with option ids 1–3",
            rows and rows[0]["kind"] == "poll" and [o["id"] for o in options] == ["1", "2", "3"], rows)

    h.rpc("vote_poll", {"p_message_id": poll, "p_option_ids": ["1"]}, guest)
    h.rpc("vote_poll", {"p_message_id": poll, "p_option_ids": ["2"]}, host)
    status, body = h.rpc("vote_poll", {"p_message_id": poll, "p_option_ids": ["3"]}, guest)
    h.check("changing your vote works", status in (200, 204), (status, body))
    _, results = h.rpc("get_poll_results", {"p_message_id": poll}, host)
    votes = {r["option_id"]: r for r in results} if isinstance(results, list) else {}
    h.check("results count each person once (changed vote moved)",
            votes and votes["1"]["votes"] == 0 and votes["2"]["votes"] == 1 and votes["3"]["votes"] == 1, results)
    h.check("voters are listed", votes and gary in votes["3"]["voter_ids"], results)

    status, body = h.rpc("vote_poll", {"p_message_id": poll, "p_option_ids": ["1", "2"]}, guest)
    h.check("two choices on a single-choice poll are refused", h.refused(status, body), (status, body))
    status, body = h.rpc("vote_poll", {"p_message_id": poll, "p_option_ids": ["1"]}, joiner)
    h.check("someone who can't chat can't vote", h.refused(status, body), (status, body))
    status, body = h.rpc("get_poll_results", {"p_message_id": poll}, stranger)
    h.check("strangers can't see results", h.refused(status, body) or body == [], (status, body))
    status, body = h.insert("poll_votes", {"message_id": poll, "option_id": "1", "user_id": gary}, guest, "message_id")
    h.check("votes can't be written directly", h.refused(status, body), (status, body))

    status, body = h.rpc("close_poll", {"p_message_id": poll}, stranger)
    h.check("strangers can't close a poll", h.refused(status, body), (status, body))
    status, body = h.rpc("close_poll", {"p_message_id": poll}, host)
    h.check("the host can close a poll", status in (200, 204), (status, body))
    status, body = h.rpc("vote_poll", {"p_message_id": poll, "p_option_ids": ["1"]}, guest)
    h.check("no votes after closing", h.refused(status, body), (status, body))

    # Votes arriving together mustn't overwrite each other
    h.rsvp(event, h.JOINER, "maybe")
    _, poll2 = h.rpc("create_poll", poll_args(event, ["A", "B"], "Race?"), guest)

    def vote(token, n):
        for i in range(n):
            h.rpc("vote_poll", {"p_message_id": poll2, "p_option_ids": ["1" if i % 2 else "2"]}, token)

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(lambda t: vote(t, 6), [host, guest, joiner]))
    _, results = h.rpc("get_poll_results", {"p_message_id": poll2}, host)
    total = sum(r["votes"] for r in results) if isinstance(results, list) else None
    h.check("18 votes from 3 people at once leave exactly 3 votes", total == 3, results)
