"""9.11 The wya wallet (test balance): top-ups, paying a debt exactly once, and who can't."""

import concurrent.futures

ID = "9.11"
TITLE = "Wallet: test top-ups and paying debts from it"
MIGRATION = "wallet"  # also …_wallet_cashout.sql
FUNCTION = None
DECISIONS = []
MANUAL = "manual_checklist.md §9.11 (add card, Apple Pay mock, top up, pay a bill share, payer sees Paid · wallet)"


def run(h):
    host, guest, joiner, stranger = h.login(h.HOST), h.login(h.GUEST), h.login(h.JOINER), h.login(h.STRANGER)
    hannah, gary, jo = h.id(h.HOST), h.id(h.GUEST), h.id(h.JOINER)

    def wallet(token):
        _, w = h.rpc("get_my_wallet", {}, token)
        return w if isinstance(w, dict) else {}

    # Start every run from empty test wallets, and leave them empty
    for token in (host, guest, joiner):
        h.rpc("reset_test_wallet", {}, token)
        h.on_cleanup(lambda token=token: h.rpc("reset_test_wallet", {}, token))
    status, body = h.rpc("reset_test_wallet", {}, None)
    h.check("logged-out visitors can't reset wallets", h.refused(status, body), (status, body))

    def card(token):
        status, mid = h.rpc("add_wallet_method", {"p_kind": "card", "p_brand": "visa", "p_last4": "4242",
                                                  "p_exp_month": 12, "p_exp_year": 2031}, token)
        return mid if status == 200 else None

    # Methods: only display details, valid ones, your own --------------------------------
    status, body = h.rpc("add_wallet_method", {"p_kind": "card", "p_brand": "visa", "p_last4": "42",
                                               "p_exp_month": 12, "p_exp_year": 2031}, joiner)
    h.check("a card needs exactly 4 last digits", h.refused(status, body), (status, body))
    status, body = h.rpc("add_wallet_method", {"p_kind": "card", "p_brand": "visa", "p_last4": "4242",
                                               "p_exp_month": 1, "p_exp_year": 2020}, joiner)
    h.check("an expired card is refused", h.refused(status, body) and h.mentions(body, "card_expired"), (status, body))
    jo_card = card(joiner)
    h.check("Jo saves a test card (brand, last 4, expiry)", jo_card, h.last_error)
    if not jo_card:
        return
    h.on_cleanup(lambda: h.rpc("remove_wallet_method", {"p_method_id": jo_card}, joiner))
    status, ap = h.rpc("add_wallet_method", {"p_kind": "apple_pay"}, joiner)
    _, ap2 = h.rpc("add_wallet_method", {"p_kind": "apple_pay"}, joiner)
    h.check("Apple Pay is saved once (adding it again returns the same one)", status == 200 and ap == ap2, (ap, ap2))
    h.on_cleanup(lambda: h.rpc("remove_wallet_method", {"p_method_id": ap}, joiner))

    # Nobody writes or reads wallets directly -----------------------------------------------
    status, body = h.insert("wallets", {"user_id": jo, "balance_cents": 100000}, joiner, select="user_id")
    h.check("nobody can write their own balance", h.refused(status, body), (status, body))
    status, body = h.insert("wallet_entries", {"txn_id": jo_card, "user_id": jo, "amount_cents": 500}, joiner, select="id")
    h.check("nobody can write ledger rows", h.refused(status, body), (status, body))
    _, rows = h.get("wallet_methods", stranger, f"user_id=eq.{jo}&select=id")
    h.check("strangers can't see Jo's cards", rows == [], rows)

    # Top-ups ---------------------------------------------------------------------------------
    before = wallet(joiner).get("balance_cents", 0)
    status, body = h.rpc("test_topup", {"p_cents": 1000, "p_method_id": jo_card}, stranger)
    h.check("you can't top up with someone else's card", h.refused(status, body), (status, body))
    status, body = h.rpc("test_topup", {"p_cents": 50, "p_method_id": jo_card}, joiner)
    h.check("a top-up under $1 is refused", h.refused(status, body), (status, body))
    status, body = h.rpc("test_topup", {"p_cents": 60000, "p_method_id": jo_card}, joiner)
    h.check("a top-up over the limit is refused", h.refused(status, body), (status, body), assumes="WAL-5")
    status, body = h.rpc("test_topup", {"p_cents": 2000, "p_method_id": jo_card}, joiner)
    h.check("Jo tops up $20 (test balance)", status == 200 and body.get("balance_cents") == before + 2000, (status, body))
    _, rows = h.get("wallets", stranger, f"user_id=eq.{jo}&select=balance_cents")
    h.check("nobody else can see Jo's balance", rows == [], rows)

    # A locked bill: Jo owes Gary --------------------------------------------------------------
    event, code = h.make_event("wallet", 72)
    if not h.check("host can create a temp event", event, h.last_error):
        return
    h.join(code, h.GUEST, h.JOINER)
    h.rsvp(event, h.GUEST, "yes")
    h.rsvp(event, h.JOINER, "yes")
    status, split = h.rpc("create_split", {"p_event_id": event, "p_description": "Pizza", "p_total_cents": 9000,
                                           "p_shares": {hannah: 3000, gary: 3000, jo: 3000}}, guest)
    if not h.check("Gary splits $90 three ways", status == 200, (status, split)):
        return
    _, debts = h.get("obligations", joiner, f"split_id=eq.{split}&guest_id=eq.{jo}&select=id,amount_cents")
    jo_debt = debts[0]["id"] if isinstance(debts, list) and debts else None
    _, debts = h.get("obligations", host, f"split_id=eq.{split}&guest_id=eq.{hannah}&select=id")
    hannah_debt = debts[0]["id"] if isinstance(debts, list) and debts else None

    status, body = h.rpc("claim_paid", {"p_obligation_id": jo_debt}, joiner)
    h.check("bills are wallet only: \"I've paid\" is refused", h.refused(status, body) and h.mentions(body, "wallet_only"), (status, body))
    status, body = h.rpc("pay_from_wallet", {"p_obligation_id": jo_debt, "p_expected_cents": 3000}, stranger)
    h.check("a stranger can't pay Jo's debt", h.refused(status, body), (status, body))
    status, body = h.rpc("pay_from_wallet", {"p_obligation_id": jo_debt, "p_expected_cents": 3000}, guest)
    h.check("Gary can't 'pay' Jo's debt to himself", h.refused(status, body), (status, body))
    status, body = h.rpc("pay_from_wallet", {"p_obligation_id": jo_debt, "p_expected_cents": 2500}, joiner)
    h.check("paying a different amount is refused", h.refused(status, body) and h.mentions(body, "amount_changed"), (status, body))
    status, body = h.rpc("pay_from_wallet", {"p_obligation_id": jo_debt, "p_expected_cents": 3000}, joiner)
    h.check("Jo is $10 short, and is told so", h.refused(status, body) and h.mentions(body, "insufficient_funds"), (status, body))

    h.rpc("test_topup", {"p_cents": 2000, "p_method_id": jo_card}, joiner)
    jo_before = wallet(joiner).get("balance_cents", 0)
    gary_before = wallet(guest).get("balance_cents", 0)
    status, paid = h.rpc("pay_from_wallet", {"p_obligation_id": jo_debt, "p_expected_cents": 3000}, joiner)
    h.check("Jo pays Gary $30 from her wallet", status == 200 and paid.get("paid_to_id") == gary and paid.get("amount_cents") == 3000,
            (status, paid))
    h.check("exactly $30 left Jo's wallet", wallet(joiner).get("balance_cents") == jo_before - 3000)
    h.check("exactly $30 arrived in Gary's", wallet(guest).get("balance_cents") == gary_before + 3000)
    status, again = h.rpc("pay_from_wallet", {"p_obligation_id": jo_debt, "p_expected_cents": 3000}, joiner)
    h.check("a second tap pays nothing more", status == 200 and again.get("already_paid") is True
            and wallet(joiner).get("balance_cents") == jo_before - 3000, (status, again))
    _, debt = h.get("obligations", joiner, f"id=eq.{jo_debt}&select=status,paid_via")
    h.check("the debt is paid, via the wallet", debt == [{"status": "paid", "paid_via": "wallet"}], debt)
    status, body = h.rpc("dispute_payment", {"p_obligation_id": jo_debt}, guest)
    h.check("a wallet payment can't be disputed", h.refused(status, body), (status, body), assumes="WAL-2")
    h.check("Gary is told Jo paid from her wallet", h.notifications(h.GUEST, "wallet_paid", event) >= 1)
    activity = wallet(guest).get("activity", [])
    h.check("Gary's wallet shows 'Jo paid you'", any(a.get("title", "").endswith("paid you") and a.get("amount_cents") == 3000 for a in activity),
            activity[:2])

    # Cash out (test balance) --------------------------------------------------------------
    gary_card = card(guest)
    if gary_card:
        h.on_cleanup(lambda: h.rpc("remove_wallet_method", {"p_method_id": gary_card}, guest))
        g_now = wallet(guest).get("balance_cents", 0)
        status, body = h.rpc("test_cashout", {"p_cents": g_now + 100, "p_method_id": gary_card}, guest)
        h.check("you can't cash out more than you have", h.refused(status, body), (status, body))
        status, body = h.rpc("test_cashout", {"p_cents": 1000, "p_method_id": jo_card}, guest)
        h.check("you can't cash out to someone else's card", h.refused(status, body), (status, body))
        status, body = h.rpc("test_cashout", {"p_cents": 1000, "p_method_id": gary_card}, guest)
        h.check("Gary cashes out $10", status == 200 and body.get("balance_cents") == g_now - 1000, (status, body))
        h.check("…and it shows in his activity", any(a.get("kind") == "cashout" for a in wallet(guest).get("activity", [])))

    # Many at once: 8 top-ups and payments racing, balances still exact ---------------------
    hannah_card = card(host)
    if hannah_card and hannah_debt:
        h.on_cleanup(lambda: h.rpc("remove_wallet_method", {"p_method_id": hannah_card}, host))
        h.rpc("test_topup", {"p_cents": 3000, "p_method_id": hannah_card}, host)
        h_before, g_before = wallet(host).get("balance_cents", 0), wallet(guest).get("balance_cents", 0)
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: h.rpc("pay_from_wallet", {"p_obligation_id": hannah_debt, "p_expected_cents": 3000}, host), range(8)))
        fresh = [b for s, b in results if s == 200 and isinstance(b, dict) and b.get("already_paid") is False]
        h.check("8 taps at once pay exactly once", len(fresh) == 1, [s for s, _ in results])
        h.check("…and move exactly $30", wallet(host).get("balance_cents") == h_before - 3000
                and wallet(guest).get("balance_cents") == g_before + 3000)
