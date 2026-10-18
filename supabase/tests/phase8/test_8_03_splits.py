"""8.3 Bill splitting: who owes whom, PayID privacy, I've paid / dispute, no RSVP block."""

ID = "8.3"
TITLE = "Bill splitting (/split) and the pay page"
MIGRATION = "splits"
FUNCTION = None
DECISIONS = ["SPLIT-1", "SPLIT-2", "SPLIT-3", "SPLIT-4", "SPLIT-5"]
MANUAL = "manual_checklist.md §8.3 (split card, pay page, copy all, bank shortcuts on a real phone)"


def split_args(event, description, total, participants=None, shares=None):
    return {"p_event_id": event, "p_description": description, "p_total_cents": total,
            "p_participants": participants, "p_shares": shares}


def run(h):
    host, guest, joiner, stranger = h.login(h.HOST), h.login(h.GUEST), h.login(h.JOINER), h.login(h.STRANGER)
    hannah, gary, jo, sam = h.id(h.HOST), h.id(h.GUEST), h.id(h.JOINER), h.id(h.STRANGER)

    # Gary pays the bill, so he needs a PayID; give him one only for this run
    _, rows = h.get("payment_methods", guest, "select=value")
    if not rows:
        status, body = h.rpc("set_payid", {"p_value": "gary.split@wya.test"}, guest)
        h.check("test setup: Gary gets a PayID", status in (200, 204), (status, body))
        h.on_cleanup(lambda: h.rpc("remove_payid", {}, guest))
    _, rows = h.get("payment_methods", host, "select=value")
    hannah_payid = rows[0]["value"] if rows else None

    event, code = h.make_event("split", 72)
    if not h.check("host can create a temp event", event, h.last_error):
        return
    h.join(code, h.GUEST, h.JOINER)
    h.rsvp(event, h.GUEST, "yes")
    h.rsvp(event, h.JOINER, "yes")

    # Since the wallet (9.11) the payer doesn't need a PayID: shares are paid back into their wallet
    _, rows = h.get("payment_methods", joiner, "select=value")
    if not rows:
        status, body = h.rpc("create_split", split_args(event, "Snacks", 300), joiner)
        h.check("a payer without a PayID can split (paid back to their wallet)", status == 200, (status, body))
        if status == 200:
            h.rpc("cancel_split", {"p_split_id": body}, joiner)

    # Even split: Hannah, Gary (payer), Jo -> 3 ways --------------------------------
    status, split = h.rpc("create_split", split_args(event, "Dinner", 10000), guest)
    if not h.check("a Going guest splits a $100 bill", status == 200 and isinstance(split, str), (status, split)):
        return
    _, rows = h.rpc("get_split", {"p_split_id": split}, guest)
    shares = {r["user_id"]: r["share_cents"] for r in rows} if isinstance(rows, list) else {}
    h.check("even split: others pay $33.33, the payer absorbs the extra cent",
            shares.get(hannah) == 3333 and shares.get(jo) == 3333 and shares.get(gary) == 3334, shares)
    _, debts = h.get("obligations", joiner, f"split_id=eq.{split}&select=id,kind,reason,status,amount_cents,host_id")
    jo_debt = debts[0] if isinstance(debts, list) and debts else {}
    h.check("Jo owes Gary $33.33 as a split debt",
            jo_debt.get("kind") == "split" and jo_debt.get("reason") == "shared_cost" and jo_debt.get("status") == "owed"
            and jo_debt.get("amount_cents") == 3333 and jo_debt.get("host_id") == gary, debts)
    h.check("Jo is told in Activity", h.notifications(h.JOINER, "split_owed", event) >= 1)
    _, msgs = h.get("chat_messages", guest, f"event_id=eq.{event}&kind=eq.split&select=id")
    h.check("a split card is posted in the chat", isinstance(msgs, list) and len(msgs) == 1, msgs)

    # Who can see what ------------------------------------------------------------
    status, body = h.rpc("get_split", {"p_split_id": split}, stranger)
    h.check("strangers can't see the split", h.refused(status, body) or body == [], (status, body))
    if jo_debt:
        status, pay = h.rpc("get_payment_instructions", {"p_obligation_id": jo_debt["id"]}, joiner)
        row = pay[0] if isinstance(pay, list) and pay else {}
        h.check("Jo sees Gary's PayID to pay him", status == 200 and row.get("payid") and row.get("payid") != hannah_payid,
                (status, pay))
        status, pay = h.rpc("get_payment_instructions", {"p_obligation_id": jo_debt["id"]}, host)
        h.check("Hannah can't see Gary's PayID through Jo's debt", h.refused(status, pay) or not pay, (status, pay))
        status, pay = h.rpc("get_payment_instructions", {"p_obligation_id": jo_debt["id"]})
        h.check("logged-out visitors get nothing (the pay page needs sign-in)", h.refused(status, pay) or not pay,
                (status, pay), assumes="SPLIT-3")
        h.check("get_split doesn't expose PayIDs", not h.mentions(rows, "gary.split@") and
                (not hannah_payid or not h.mentions(rows, hannah_payid)), rows)

        # I've paid and disputes reuse the pledge flow
        status, body = h.rpc("claim_paid", {"p_obligation_id": jo_debt["id"]}, joiner)
        h.check("Jo taps I've paid", status in (200, 204), (status, body))
        status, body = h.rpc("dispute_payment", {"p_obligation_id": jo_debt["id"]}, host)
        h.check("only the person owed can dispute it", h.refused(status, body), (status, body))
        status, body = h.rpc("dispute_payment", {"p_obligation_id": jo_debt["id"]}, guest)
        h.check("Gary disputes it", status in (200, 204), (status, body))
        _, rows = h.rpc("get_split", {"p_split_id": split}, joiner)
        jo_row = next((r for r in rows if r["user_id"] == jo), {}) if isinstance(rows, list) else {}
        h.check("the split shows Jo as disputed", jo_row.get("status") == "disputed", rows)

    # Custom shares and limits ----------------------------------------------------
    status, body = h.rpc("create_split", split_args(event, "Taxi", 3000, shares={hannah: 1000, jo: 1000}), guest)
    h.check("custom shares that don't add up are refused (shares_mismatch)",
            h.refused(status, body) and h.mentions(body, "shares_mismatch"), (status, body))
    status, split2 = h.rpc("create_split", split_args(event, "Taxi", 3000, shares={hannah: 500, jo: 1500, gary: 1000}), guest)
    h.check("custom shares that add up work", status == 200, (status, split2))
    _, debts = h.get("obligations", joiner, f"event_id=eq.{event}&kind=eq.split&select=id,split_id")
    h.check("Jo can owe two splits on the same event", isinstance(debts, list) and len(debts) == 2, debts)
    status, body = h.rpc("create_split", split_args(event, "Tickets", 3000, participants=[gary, sam]), guest)
    h.check("people who aren't Going can't be added to a split", h.refused(status, body), (status, body), assumes="SPLIT-2")
    for label, args in [("a $0 total", split_args(event, "Nothing", 0)), ("an empty description", split_args(event, "", 100)),
                        ("an 81-character description", split_args(event, "x" * 81, 100)),
                        ("more than $10,000", split_args(event, "Yacht", 1_000_001))]:
        status, body = h.rpc("create_split", args, guest)
        h.check(f"{label} is refused", h.refused(status, body), (status, body))
    status, body = h.rpc("create_split", split_args(event, "Crashing", 1000), stranger)
    h.check("strangers can't split a bill on the event", h.refused(status, body), (status, body))

    # A split debt doesn't block RSVPs to the payer's events -------------------------
    g_event, g_code = h.make_event("split block", 72, host=h.GUEST)
    if h.check("Gary can host an event", g_event, h.last_error):
        h.join(g_code, h.JOINER)
        status, body = h.rsvp(g_event, h.JOINER, "yes")
        h.check("Jo, who owes Gary for dinner, can still say I'm in to Gary's event", status == 200, (status, body),
                assumes="SPLIT-1")

    _, mine = h.rpc("get_my_obligations", {}, joiner)
    h.check("get_my_obligations returns the kind", isinstance(mine, list) and any(r.get("kind") == "split" for r in mine), mine)

    # Cancelling ------------------------------------------------------------------
    if isinstance(split2, str):
        status, body = h.rpc("cancel_split", {"p_split_id": split2}, joiner)
        h.check("only the payer can cancel a split", h.refused(status, body), (status, body))
        status, body = h.rpc("cancel_split", {"p_split_id": split2}, guest)
        h.check("the payer cancels it", status in (200, 204), (status, body))
        _, debts = h.get("obligations", joiner, f"split_id=eq.{split2}&select=status")
        h.check("…and its debts are waived", debts and all(d["status"] == "waived" for d in debts), debts)
