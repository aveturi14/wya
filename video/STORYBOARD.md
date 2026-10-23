# Storyboard: Where You At launch reel

1080×1920 · 30 fps · 2408 frames (1:20.3) · music at 128.57 BPM, so one beat is exactly 14 frames and every scene starts on a downbeat. Bars and frames come from `src/data/demo.ts`; each scene's beats are exported from its file in `src/scenes/`. One fictional event (Harbour Sessions, Sydney) and four fictional friends (Alex, Maya, Jamie, Sam, each with their own colour) run through the whole film. The poster look is the app's "Sunset".

| # | Time | Scene | On screen | Narration (VOICEOVER.md) | Transition in | Audio |
|---|---|---|---|---|---|---|
| 1 | 0:00–0:07.5 | The group chat | Dark chat; six messages land on the beat ("Harbour Sessions this weekend?" … "Wait, who's paid?"). Bar 3: the chat blurs, **Everyone's in.** springs in; one beat later **Nobody's paid.** in pink | s1 | hard open | Punchy beat and hook; message ticks; drums drop out at the freeze; a stab and kick on "Nobody's paid" |
| 2 | 0:07.5–0:14.9 | Meet Where You At | Cream page, sunset glow. The **wya.** wordmark (pink dot) springs in, "Where You At" in serif italic, "Plans that *actually* happen." Then everything lifts and the **Harbour Sessions** poster flies up with a slow camera push | s2 | scale-fade | Groove re-enters with hats; pop on the logo, whoosh on the poster |
| 3 | 0:14.9–0:26.1 | Invite and RSVP | Poster pinned at the top. **Share invite** is tapped, the link chip appears, four avatars drop in. Then the app's RSVP bar (**I'm in · Maybe · Can't go**), I'm in tapped; the list flips Invited → **Going** on the beat; Alex is **Hosting**; the poster sticker becomes "4 going". Finally: **Saying yes isn't paying.** with a "4 going · $0 sorted" chip | s3 | none (continuous page) | Shaker 16ths join; taps, pops, confirm chimes on each Going |
| 4 | 0:26.1–0:39.2 | Split the cost | "Alex got the tickets"; **$180** counts up, shrinks, and four rows arrive: Alex $45 **Paid the bill**, the others $45 **Owes**. "No awkward maths." Then "dinner after?": the app's **What did you have?** screen, items ticked on the beat with avatars, "2" and "Shared" chips, surcharge split by what each person ordered, **Confirm my share** | s4 | slide up | Chord pad and pumping bass; whooshes, pops, ticks |
| 5 | 0:39.2–0:52.3 | Pay back | Dark. Maya's **wya wallet** card with the **test balance** sticker; the pay sheet **Pay Alex $45** (lock), tapped → **Paid**, balance drops $60 → $15. Then "Paid back to Alex" $45 → $90 → $135 of $135 with a bar that only fills on real payments; rows flip **Owes → Paid**; **4 of 4. Sorted.** Tag: "Test balance: no real money moves yet" | s5 | scale-fade | Arp pulses; a confirm chime per payment; sparkle and success on "Sorted" (bar 26 downbeat) |
| 6 | 0:52.3–1:05.3 | Concept: pot → card | Tag throughout: **Concept demonstration · not live yet**. Four avatars send their $45 into a ring that fills to $180; chips keep the states apart: 4 going · 4 of 4 paid in · Funds available · Not booked yet. On the drop, the ring becomes a dimensional **wya group card** (•••• 4521, ALEX · ORGANISER, funded $180) with a light pass; "Nobody fronts the *whole* thing." | s6 | scale-fade | Filtered build, riser and clap roll; **impact and glassy shimmer on the card (bar 31)**; full hook after the drop |
| 7 | 1:05.3–1:12.8 | Simulated checkout | Tag: **Simulated checkout**. Harbour Sessions, 4 tickets, **$180.00** ("Excludes any applicable fees"), paying with the group card •••• 4521. Tap → spinner (a beat of suspense) → **Payment demonstration complete**, then "Tickets still come from the venue. This is a demo, not a booking." | s7 | slide up | Tension: half-time kick and a held chord; release and success on beat 3 of bar 36 |
| 8 | 1:12.8–1:20.3 | Close | The whole frame becomes the Sunset poster with grain; the four friends bounce together on the beat; **LESS CHASING. MORE GOING.** in Archivo Expanded; then a white pill with **wya.** \| *Where You At*, and "Make the plan happen · wya.expo.app" | s8 | none (poster takes over) | Full groove; rising bell sonic logo on the brand (bar 41); final hit and chord ring out to the last frame |

## Style frames
Exported from the final render with ffmpeg:
1. `out/style-1-chat.png` (0:06.5): Everyone's in. Nobody's paid.
2. `out/style-2-collection.png` (0:49.6): Paid back to Alex, $135 of $135, 4 of 4. Sorted.
3. `out/style-3-card.png` (1:02.0): the group card, Concept demonstration.

## Safe areas
Text and actions stay between y = 250 and y = 1520 (Instagram's header and caption overlays), with 80 px side margins.
