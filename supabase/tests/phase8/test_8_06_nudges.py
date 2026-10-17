"""8.6 Nudges in Activity: one reminder for unanswered invites, plus the host's /remind."""

ID = "8.6"
TITLE = "Nudges in Activity (rsvp_reminder, excuse_prompt, /remind)"
MIGRATION = "nudges"
FUNCTION = None
DECISIONS = ["NUD-1", "NUD-2"]
MANUAL = "manual_checklist.md §8.6 (excuse prompt after 24 h, reminder wording)"


def run(h):
    host, guest, joiner = h.login(h.HOST), h.login(h.GUEST), h.login(h.JOINER)

    soon, code = h.make_event("nudge soon", 20)
    if not h.check("host can create a temp event", soon, h.last_error):
        return
    h.join(code, h.GUEST, h.JOINER)
    h.rsvp(soon, h.GUEST, "yes")  # Jo stays 'invited'

    status, body = h.rpc("process_nudges", {}, host)
    h.check("process_nudges runs", status == 200, (status, body))
    h.check("an unanswered guest gets one reminder within 24 h of the start",
            h.notifications(h.JOINER, "rsvp_reminder", soon) == 1, assumes="NUD-1")
    h.rpc("process_nudges", {}, host)
    h.check("running it again doesn't remind twice", h.notifications(h.JOINER, "rsvp_reminder", soon) == 1)
    h.check("Going guests aren't reminded", h.notifications(h.GUEST, "rsvp_reminder", soon) == 0)

    later, code = h.make_event("nudge later", 72)
    h.join(code, h.JOINER)
    h.rpc("process_nudges", {}, host)
    h.check("nobody is reminded 3 days ahead", h.notifications(h.JOINER, "rsvp_reminder", later) == 0, assumes="NUD-1")

    # Pledge event: starts in 40 h, cutoff 24 h before -> the cutoff is 16 h away
    pledge, code = h.make_event("nudge pledge", 40, mode="pledge", cutoff_hours=24)
    h.join(code, h.JOINER)
    h.rpc("process_nudges", {}, host)
    h.check("on a pledge event, the reminder comes within 24 h of the cutoff",
            h.notifications(h.JOINER, "rsvp_reminder", pledge) == 1, assumes="NUD-1")

    # /remind
    status, body = h.rpc("remind_unanswered", {"p_event_id": later}, guest)
    h.check("guests can't /remind", h.refused(status, body), (status, body))
    status, body = h.rpc("remind_unanswered", {"p_event_id": later}, host)
    h.check("the host's /remind reaches the unanswered guest",
            status == 200 and h.notifications(h.JOINER, "rsvp_reminder", later) == 1, (status, body))
    status, body = h.rpc("remind_unanswered", {"p_event_id": later}, host)
    h.check("a second /remind within 12 h is refused (rate_limited)",
            h.refused(status, body) and h.mentions(body, "rate_limited"), (status, body))

    # A brand-new late-cancel debt gets no excuse prompt yet (the 24 h case is checked by hand)
    late, code = h.make_event("nudge excuse", 10, mode="pledge", cutoff_hours=24)
    h.join(code, h.JOINER)
    h.rsvp(late, h.JOINER, "yes")
    h.rsvp(late, h.JOINER, "no")
    h.rpc("process_nudges", {}, host)
    h.check("no excuse prompt for a fresh late cancellation", h.notifications(h.JOINER, "excuse_prompt", late) == 0,
            assumes="NUD-2")
