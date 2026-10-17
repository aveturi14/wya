"""8.18 Itemised receipt splits: scan, claim what you had, confirm, lock into split debts."""

import json
import urllib.error
import urllib.request

ID = "8.18"
TITLE = "Receipt splits (scan, claim, confirm, lock)"
MIGRATION = "receipts"  # also …_bills_tab.sql and …_dues.sql
FUNCTION = "scan-receipt"
DECISIONS = ["RCPT-1", "RCPT-2", "RCPT-3"]
MANUAL = "manual_checklist.md §8.18 (scan a real receipt, two-phone claim, camera on iOS)"

# The brief's worked example: $96 of food, a 10% Sunday surcharge, $105.60
NONNAS = [
    {"name": "Margherita", "amount_cents": 2400},
    {"name": "Lasagne", "amount_cents": 2800},
    {"name": "Garlic bread", "amount_cents": 1200},
    {"name": "Spritz", "quantity": 2, "amount_cents": 3200},
    {"name": "Sunday surcharge 10%", "amount_cents": 960, "kind": "adjustment", "rate_bp": 1000},
]


def draft(rid, items, total, subtotal=None, source="demo"):
    return {"p_receipt_id": rid, "p_items": items, "p_total_cents": total,
            "p_printed_subtotal_cents": subtotal, "p_merchant": "Nonna's", "p_source": source}


def upload(h, path, token, data=b"\xff\xd8\xff\xe0 not really a jpeg"):
    req = urllib.request.Request(f"{h.url}/storage/v1/object/receipts/{path}", data=data, method="POST")
    req.add_header("apikey", h.key)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "image/jpeg")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code


def run(h):
    host, guest, joiner, stranger = h.login(h.HOST), h.login(h.GUEST), h.login(h.JOINER), h.login(h.STRANGER)
    hannah, gary, jo = h.id(h.HOST), h.id(h.GUEST), h.id(h.JOINER)

    # Gary paid the bill, so he needs a PayID; give him one only for this run
    _, rows = h.get("payment_methods", guest, "select=value")
    if not rows:
        status, body = h.rpc("set_payid", {"p_value": "gary.receipt@wya.test"}, guest)
        h.check("test setup: Gary gets a PayID", status in (200, 204), (status, body))
        h.on_cleanup(lambda: h.rpc("remove_payid", {}, guest))

    event, code = h.make_event("receipt", 72)
    if not h.check("host can create a temp event", event, h.last_error):
        return
    h.join(code, h.GUEST, h.JOINER)
    h.rsvp(event, h.GUEST, "yes")
    h.rsvp(event, h.JOINER, "yes")
    items = lambda rid, *names: {"p_receipt_id": rid, "p_item_ids": [
        l["id"] for l in (h.rpc("get_receipt", {"p_receipt_id": rid}, guest)[1] or {}).get("lines", [])
        if l["name"] in names]}

    # Starting a bill -----------------------------------------------------------------
    status, body = h.rpc("create_receipt", {"p_event_id": event, "p_description": "Crashing"}, stranger)
    h.check("strangers can't start a bill on the event", h.refused(status, body), (status, body))
    status, body = h.rpc("create_receipt", {"p_event_id": event, "p_image_path": f"{event}/{hannah}/x.jpg"}, guest)
    h.check("the photo has to be in the payer's own folder", h.refused(status, body), (status, body))
    h.check("Gary can upload a receipt photo to his folder", upload(h, f"{event}/{gary}/test.jpg", guest) in (200, 201))
    h.on_cleanup(lambda: h.request("DELETE", f"/storage/v1/object/receipts/{event}/{gary}/test.jpg", guest))
    h.check("…but not into someone else's", upload(h, f"{event}/{hannah}/test.jpg", guest) >= 400)
    h.check("strangers can't upload to the event", upload(h, f"{event}/{h.id(h.STRANGER)}/test.jpg", stranger) >= 400)

    status, rid = h.rpc("create_receipt", {"p_event_id": event, "p_image_path": f"{event}/{gary}/test.jpg",
                                           "p_description": "Dinner at Nonna's"}, guest)
    if not h.check("a Going guest starts a bill", status == 200 and isinstance(rid, str), (status, rid)):
        return
    status, body = h.rpc("get_receipt", {"p_receipt_id": rid}, host)
    h.check("a draft is the payer's alone", body is None, (status, body))
    status, body = h.rpc("save_receipt_draft", draft(rid, NONNAS, 10560, 9600), host)
    h.check("only the payer edits the draft", h.refused(status, body), (status, body))

    # The scan must add up -------------------------------------------------------------
    off = [dict(l) for l in NONNAS]
    off[1]["amount_cents"] = 2900
    h.rpc("save_receipt_draft", draft(rid, off, 10560, 9600), guest)
    status, body = h.rpc("send_receipt", {"p_receipt_id": rid}, guest)
    h.check("a bill whose items don't match the printed subtotal can't be sent",
            h.refused(status, body) and h.mentions(body, "receipt_unbalanced"), (status, body))
    status, body = h.rpc("save_receipt_draft", draft(rid, NONNAS, 10560, 9600), guest)
    h.check("the payer fixes the line", status in (200, 204), (status, body))
    status, body = h.rpc("send_receipt", {"p_receipt_id": rid}, guest)
    h.check("…and sends it", status == 200, (status, body))
    _, msgs = h.get("chat_messages", guest, f"event_id=eq.{event}&kind=eq.receipt&select=id,data")
    h.check("no card in the chat: bills live in the Bills tab", msgs == [], msgs)
    _, bills = h.get("receipts", joiner, f"event_id=eq.{event}&select=id,status")
    h.check("Jo sees the sent bill (the Bills tab lists it)", isinstance(bills, list) and any(b["id"] == rid for b in bills), bills)
    h.check("Hannah and Jo are asked to pick what they had",
            h.notifications(h.HOST, "receipt_to_claim", event) == 1 and h.notifications(h.JOINER, "receipt_to_claim", event) == 1)
    status, body = h.insert("receipt_claims", {"item_id": rid, "user_id": jo, "receipt_id": rid, "event_id": event}, joiner,
                            select="item_id")
    h.check("claims can't be written directly", h.refused(status, body), (status, body))
    status, body = h.rpc("get_receipt", {"p_receipt_id": rid}, stranger)
    h.check("strangers can't see the bill", body is None or h.refused(status, body), (status, body))

    # Claiming: the worked example -----------------------------------------------------
    h.rpc("set_receipt_claims", items(rid, "Margherita", "Garlic bread"), guest)
    h.rpc("set_receipt_claims", items(rid, "Lasagne", "Garlic bread"), host)
    status, body = h.rpc("set_receipt_claims", items(rid, "Spritz", "Garlic bread"), joiner)
    h.check("Jo ticks what she had", status in (200, 204), (status, body))
    status, body = h.rpc("set_receipt_claims", items(rid, "Sunday surcharge 10%"), joiner)
    h.check("surcharges can't be ticked (they follow what you ordered)", h.refused(status, body), (status, body))
    _, r = h.rpc("get_receipt", {"p_receipt_id": rid}, joiner)
    shares = {p["user_id"]: p["share_cents"] for p in (r or {}).get("people", [])}
    h.check("worked example: Gary $30.80, Hannah $35.20, Jo $39.60",
            shares.get(gary) == 3080 and shares.get(hannah) == 3520 and shares.get(jo) == 3960, shares)
    h.check("everything is claimed", (r or {}).get("claimed_cents") == 9600, r and r.get("claimed_cents"))

    status, body = h.rpc("lock_receipt", {"p_receipt_id": rid}, guest)
    h.check("can't lock before everyone confirms", h.refused(status, body) and h.mentions(body, "receipt_not_ready"),
            (status, body), assumes="RCPT-1")
    status, body = h.rpc("confirm_receipt_share", {"p_receipt_id": rid, "p_expected_cents": 3900}, joiner)
    h.check("confirming a stale amount is refused (share_changed)",
            h.refused(status, body) and h.mentions(body, "share_changed"), (status, body))
    h.rpc("confirm_receipt_share", {"p_receipt_id": rid, "p_expected_cents": 3960}, joiner)
    h.rpc("confirm_receipt_share", {"p_receipt_id": rid, "p_expected_cents": 3520}, host)
    h.check("Gary hears everyone's confirmed", h.notifications(h.GUEST, "receipt_ready", event) == 1)

    # The payer fixes a price: only the person whose share moved confirms again
    _, r = h.rpc("get_receipt", {"p_receipt_id": rid}, guest)
    lasagne = next((l["id"] for l in (r or {}).get("lines", []) if l["name"] == "Lasagne"), None)
    status, body = h.rpc("edit_receipt_item", {"p_receipt_id": rid, "p_item_id": lasagne, "p_name": "Lasagne",
                                               "p_quantity": 1, "p_amount_cents": 3000}, guest)
    h.check("the payer corrects the lasagne to $30", status == 200, (status, body))
    _, r = h.rpc("get_receipt", {"p_receipt_id": rid}, guest)
    people = {p["user_id"]: p for p in (r or {}).get("people", [])}
    h.check("the surcharge follows: total $107.80, Hannah now $37.40",
            (r or {}).get("total_cents") == 10780 and people.get(hannah, {}).get("share_cents") == 3740, r)
    h.check("Hannah has to confirm again; Jo doesn't",
            people.get(hannah, {}).get("confirmed") is False and people.get(jo, {}).get("confirmed") is True, people)
    h.rpc("confirm_receipt_share", {"p_receipt_id": rid, "p_expected_cents": 3740}, host)

    # Lock -----------------------------------------------------------------------------
    status, body = h.rpc("lock_receipt", {"p_receipt_id": rid}, joiner)
    h.check("only the payer can lock", h.refused(status, body), (status, body))
    status, split = h.rpc("lock_receipt", {"p_receipt_id": rid}, guest)
    h.check("the payer locks it", status == 200 and isinstance(split, str), (status, split))
    _, debts = h.get("obligations", guest, f"split_id=eq.{split}&select=guest_id,amount_cents,kind,status")
    owed = {d["guest_id"]: d["amount_cents"] for d in debts} if isinstance(debts, list) else {}
    h.check("lock creates split debts: Hannah $37.40, Jo $39.60 to Gary",
            owed == {hannah: 3740, jo: 3960} and all(d["kind"] == "split" for d in debts), debts)
    h.check("Jo is told she owes", h.notifications(h.JOINER, "split_owed", event) >= 1)
    _, msgs = h.get("chat_messages", guest, f"event_id=eq.{event}&kind=eq.split&select=id")
    h.check("locking doesn't post a split card in the chat either", msgs == [], msgs)
    _, dues = h.rpc("get_my_dues", {"p_event_id": event}, joiner)
    jo_due = next((d for d in dues if d.get("kind") == "bill" and d.get("direction") == "owe"), {}) if isinstance(dues, list) else {}
    h.check("Jo's dues: she owes Gary $39.60 for the bill, with her 2 items and $3.60 of extras",
            jo_due.get("amount_cents") == 3960 and jo_due.get("other_id") == gary and len(jo_due.get("items") or []) == 2
            and jo_due.get("extras_cents") == 360 and jo_due.get("merchant") == "Nonna's", jo_due)
    _, dues = h.rpc("get_my_dues", {"p_event_id": event}, guest)
    owed_to_gary = sorted(d["amount_cents"] for d in dues if d.get("direction") == "owed") if isinstance(dues, list) else []
    h.check("Gary's dues: Hannah and Jo owe him $37.40 and $39.60", owed_to_gary == [3740, 3960], dues)
    status, body = h.rpc("get_my_dues", {"p_event_id": event}, stranger)
    h.check("strangers' dues show nobody else's", body == [], (status, body))
    status, body = h.rpc("set_receipt_claims", items(rid, "Spritz"), joiner)
    h.check("ticks are refused once locked", h.refused(status, body) and h.mentions(body, "receipt_locked"), (status, body))

    # Unlock while nobody has paid, then not after -------------------------------------
    status, body = h.rpc("unlock_receipt", {"p_receipt_id": rid}, guest)
    h.check("the payer reopens it while nobody has paid", status in (200, 204), (status, body))
    _, debts = h.get("obligations", joiner, f"split_id=eq.{split}&select=id")
    h.check("…the debts are gone", debts == [], debts)
    status, split = h.rpc("lock_receipt", {"p_receipt_id": rid}, guest)
    h.check("…and it locks again without anyone re-confirming", status == 200, (status, split))
    _, debts = h.get("obligations", joiner, f"split_id=eq.{split}&select=id")
    if isinstance(debts, list) and debts:
        h.rpc("claim_paid", {"p_obligation_id": debts[0]["id"]}, joiner)
    status, body = h.rpc("unlock_receipt", {"p_receipt_id": rid}, guest)
    h.check("can't reopen once someone has paid", h.refused(status, body) and h.mentions(body, "receipt_paid"), (status, body))

    # Odd cents and discounts ----------------------------------------------------------
    status, rid2 = h.rpc("create_receipt", {"p_event_id": event, "p_description": "Odd cents"}, guest)
    h.rpc("save_receipt_draft", draft(rid2, [{"name": "Chips", "amount_cents": 1000},
                                             {"name": "Cocktail", "amount_cents": 777},
                                             {"name": "Happy hour", "amount_cents": -100, "kind": "adjustment"}],
                                      1677, source="manual"), guest)
    h.rpc("send_receipt", {"p_receipt_id": rid2}, guest)
    _, open_bills = h.rpc("get_my_open_receipts", {}, joiner)
    h.check("Jo sees the new bill under Needs you",
            isinstance(open_bills, list) and any(b["receipt_id"] == rid2 for b in open_bills), open_bills)
    h.rpc("set_receipt_claims", items(rid2, "Chips"), guest)
    h.rpc("set_receipt_claims", items(rid2, "Chips"), host)
    h.rpc("set_receipt_claims", items(rid2, "Chips", "Cocktail"), joiner)
    _, r = h.rpc("get_receipt", {"p_receipt_id": rid2}, guest)
    shares = {p["user_id"]: p["share_cents"] for p in (r or {}).get("people", [])}
    h.check("shares add up to the total exactly, payer covers the odd cents",
            sum(shares.values()) == 1677 and shares.get(hannah) == 314 and shares.get(jo) == 1047
            and shares.get(gary) == 316, shares)
    status, body = h.rpc("cancel_receipt", {"p_receipt_id": rid2}, joiner)
    h.check("only the payer can cancel a bill", h.refused(status, body), (status, body))
    status, body = h.rpc("cancel_receipt", {"p_receipt_id": rid2}, guest)
    h.check("the payer cancels it", status in (200, 204), (status, body))

    # Scanning (needs OPENAI_API_KEY and the function deployed) --------------------------
    status, rid3 = h.rpc("create_receipt", {"p_event_id": event, "p_image_path": f"{event}/{gary}/test.jpg"}, guest)
    status, body = h.fn_raw("scan-receipt", {"receipt_id": rid3}, joiner)
    if status == 404 and not (isinstance(body, dict) and body.get("error")):
        h.record("blocked", "scan-receipt", "not deployed (npx supabase functions deploy scan-receipt)")
        return
    h.check("only the payer can scan", status in (401, 403, 503), (status, body))
    status, body = h.fn("scan-receipt", {"receipt_id": rid3}, guest)  # raises Blocked without a key
    # The test photo isn't a real receipt, so a clean "couldn't read it" is the right answer too
    h.check("the scan answers with lines or a clear error", status in (200, 422), (status, json.dumps(body)[:300]))
