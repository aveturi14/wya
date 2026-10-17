# Phase 8 manual checklist

What `run.py` can't check: screens, the share sheet, widgets and real devices. Plan and contracts: `docs/PHASE8.md`.

**Every UI row:** web at 375 and 1280 wide, light and dark, plus the iOS simulator (iPhone 18 Pro, iOS 27), unless the
row says otherwise. Sign in as `host@wya.test` (Hannah) for host rows and `guest@wya.test` (Gary) or `joiner@wya.test`
(Jo) for guest rows. Tick with the date and who checked.

## 8.0 Foundations
| # | Check | ✓ |
|---|---|---|
| 0.1 | Existing chats look unchanged (text and image messages) | |
| 0.2 | A `poll` message shows "Update wya to see this message" until 8.2 ships (insert one in the SQL editor: `kind 'poll'`, `data '{"question":"x"}'`) | |
| 0.4 | A `bot` reply (`select public.post_bot_message('<event id>', 'Hi from wya', '{"asked_by_name":"Gary Guest"}')` in the SQL editor) shows the logo, "wya · asked by Gary", and counts as unread in Chats | |
| 0.5 | Sending a text message and a photo still works; the Chats tab previews "📷 Photo" | |
| 0.3 | Chats tab previews: 📊 Poll, 💸 Split, 🗓 Plan, "wya: …" | |

## 8.1 Invite hardening
| # | Check | ✓ |
|---|---|---|
| 1.1 | Event form: Guest limit, link expiry, max uses, approve joins; saved and shown again on edit | |
| 1.2 | Full event: "I'm in" shows "This event is full" (no crash); Maybe still works | |
| 1.3 | Expired / used-up link: the invite page says so in plain words | |
| 1.4 | Approve joins: the guest sees "Asked to join"; the host sees "Asking to join" with Approve / Decline; Activity on both sides | |

## 8.2 Slash commands and polls
| # | Check | ✓ |
|---|---|---|
| 2.1 | Typing `/` lists only the commands available to you (host vs guest); `/help` explains each | |
| 2.2 | `/poll Thai / Pizza / Sushi` makes a poll card; votes update live on a second device | |
| 2.3 | Closed poll shows the winner and no vote buttons | |
| 2.4 | Mistyped command ("/pol") suggests the right one instead of posting text | |

## 8.3 Bill splitting
| # | Check | ✓ |
|---|---|---|
| 3.1 | `/split 120 dinner` makes a card: payer, total, each share, Paid / Owes / Disputed | |
| 3.2 | Without a PayID, `/split` explains how to add one (You → Get paid) | |
| 3.3 | "Pay Gary $40" opens the pay page; Copy all puts PayID, amount and reference on the clipboard in that order | |
| 3.4 | `wya.expo.app/pay/<id>` logged out → sign in → back to the pay page | |
| 3.5 | **Real iPhone and Android:** each bank shortcut that ships opens that bank's app (SPLIT-4). Remove any that don't | |
| 3.6 | An unpaid split doesn't show the "can't RSVP" block on the payer's events | |

## 8.4 "I'm here"
| # | Check | ✓ |
|---|---|---|
| 4.1 | The button appears on the event page only during the window, only for Going guests | |
| 4.2 | `/here` in chat does the same | |
| 4.3 | "Who came?" opens with checked-in guests ticked and "Checked in 7:42 PM" | |

## 8.5 Track records
| # | Check | ✓ |
|---|---|---|
| 5.1 | Event page under the host's name: "Hannah's events: 8 happened, 0 called off late" | |
| 5.2 | Your own record on You reads positively ("You've made it to 9 of your last 10") | |

## 8.6 Nudges
| # | Check | ✓ |
|---|---|---|
| 6.1 | Reminder wording in Activity, and tapping it opens the RSVP card | |
| 6.2 | Excuse prompt arrives 24 h after a late cancellation without an excuse (make the debt, wait or adjust `created_at` with the MCP) | |
| 6.3 | `/remind` twice in a row: the second says "Already reminded today" | |

## 8.7 Open events
| # | Check | ✓ |
|---|---|---|
| 7.1 | Create: "Fixed time / Find a time"; Find a time hides the pledge switch | |
| 7.2 | Home card and event page say "Time TBD"; sorting still sensible | |
| 7.3 | Grid of times with ✓ / ? / ✕ per person; best time highlighted; works at 375 wide | |
| 7.4 | Lock it in → everyone sees "It's on: Sat 7 PM. Are you in?" and the RSVP card | |

## 8.8 Home agent v1
| # | Check | ✓ |
|---|---|---|
| 8.1 | "Invite last Friday's crew" card: recipients listed, removable, Approve / Cancel | |
| 8.2 | **WhatsApp (real phone):** share opens WhatsApp with the text and link filled in; you pick the group | |
| 8.3 | **SMS (real phone):** composer opens with recipients and text; nothing is sent until you tap send | |
| 8.4 | Contacts permission is asked only when you first pick from contacts; denying it leaves everything else working | |
| 8.5 | You → Assistant: three switches, all off for a new account | |
| 8.6 | Assistant activity lists every proposal and its outcome | |
| 8.7 | At most one suggestion card a week; "Don't suggest this again" sticks | |

## 8.9 Flexible plans
| # | Check | ✓ |
|---|---|---|
| 9.1 | `/plan` card shows times; a conflict reads "Dinner now ends 9:45, the movie starts 9:30" | |
| 9.2 | "Running late +30" button on an item updates everyone live | |

## 8.10 `@wya` chat assistant
| # | Check | ✓ |
|---|---|---|
| 10.1 | Replies show the wya logo and "asked by Gary" | |
| 10.2 | "@wya what did we decide?" gives a short, correct summary of a real conversation | |
| 10.3 | "@wya split 240 for dinner" answers with a tap-to-create `/split` card, not a split | |
| 10.4 | Without the OpenAI key: free-text questions say "Not available yet"; headcount still works | |

## 8.11 "Ask wya" bar
| # | Check | ✓ |
|---|---|---|
| 11.1 | The bar on Events (phone and desktop); a request ends in proposal cards, never a send | |
| 11.2 | With "Suggest people" off, it says it can't suggest people and how to turn it on | |

## 8.12 Lookups
| # | Check | ✓ |
|---|---|---|
| 12.1 | `/find thai near Fitzroy` → up to 5 places with Maps links; "Make it a poll" | |
| 12.2 | `/movies …` → sessions with times; "Make it a poll" | |
| 12.3 | Host "Use this venue" updates the event's venue | |

## 8.13 Push (real devices)
| # | Check | ✓ |
|---|---|---|
| 13.1 | Permission asked after the first "I'm in", not at launch | |
| 13.2 | **Real iPhone:** a reminder arrives; tapping it opens the event | |
| 13.3 | **Real Android:** same | |
| 13.4 | Notification actions: "I'm here", "I'm in / Can't go" | |
| 13.5 | Turning a type off in You stops those pushes | |

## 8.14 Android widget
| # | Check | ✓ |
|---|---|---|
| 14.1 | Widget on the emulator and a real phone: next event, countdown, status; updates after RSVP changes | |
| 14.2 | Event day: the ongoing notification with countdown and "I'm here" | |
| 14.3 | Address hidden on the widget for an invited guest on a pledge event | |

## 8.15 iOS Live Activity and widget (real iPhone)
| # | Check | ✓ |
|---|---|---|
| 15.1 | Live Activity starts on the event day; countdown on the lock screen and Dynamic Island | |
| 15.2 | Host announcement appears as an update; "I'm here" works from the lock screen | |
| 15.3 | After the event, "You owe Gary $23 · Pay" until settled, then it ends | |
| 15.4 | Home-screen widget: next event and open debts | |

## 8.16 Live "on my way"
| # | Check | ✓ |
|---|---|---|
| 16.1 | Location permission asked only when tapping "I'm on my way" | |
| 16.2 | Others see buckets ("5 min away"), never a map or coordinates | |
| 16.3 | A Maybe or a stranger can't join the channel (try subscribing from their account) | |
| 16.4 | Sharing stops on arrival, on Stop, and when meetup mode ends | |
| 16.5 | Venue changed mid-plan: buckets recalculate | |

## 8.17 Calendar (real devices)
| # | Check | ✓ |
|---|---|---|
| 17.1 | "Fill from my calendar" asks for calendar permission at that moment | |
| 17.2 | Busy times are pre-ticked ✕, free ones ✓; you can change them before saving | |
| 17.3 | Network log shows only the answers sent, no calendar data | |
