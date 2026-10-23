# Voiceover: Where You At launch reel

One young adult male voice, Australian or neutral, energetic and conversational: a friend explaining something useful, not an ad. About 185 words a minute, quicker in the problem and features, slower for the card and the tagline. **Always say "Where You At". Never say the letters W-Y-A.**

The film runs **with or without** narration. To add it, record one clip per line and save it as `public/audio/vo/<id>.wav` (any sample rate, mono or stereo). The film places each clip at its start time and ducks the music under it automatically. Keep each clip inside its window; times are taken from `src/data/demo.ts` (`VO`).

| id | Starts | Window | Line |
|---|---|---|---|
| s1 | 0:00.2 | to 0:07.4 | Making plans with friends? Easy. Getting everyone to actually commit, split the cost, and pay you back? That's another story. |
| s2 | 0:07.8 | to 0:14.9 | Meet **Where You At**. One link turns the group chat into an actual plan. |
| s3 | 0:15.2 | to 0:26.1 | Send the invite once. Everyone taps I'm in, Maybe, or Can't go, so you know who's really coming. Saying yes isn't paying, though. That bit's next. |
| s4 | 0:26.3 | to 0:39.2 | Alex grabbed the tickets: a hundred and eighty bucks. Split it four ways and everyone sees their share. Forty-five each. Dinner after? Snap the receipt, and everyone ticks what they had. |
| s5 | 0:39.4 | to 0:52.2 | Then everyone pays Alex back, right in the app. You can see who's paid and who hasn't, without chasing anyone. Four of four. Sorted. |
| s6 | 0:52.6 | to 1:05.3 | *(slower)* And here's where **Where You At** is heading. Everyone chips in first, the money lands in one place, and it powers a virtual card. So nobody has to front the whole thing. |
| s7 | 1:05.6 | to 1:12.8 | *(slower)* One group. Every share covered. One simple checkout. |
| s8 | 1:13.3 | to 1:20.3 | *(slow, warm)* Less chasing. More going. **Where You At.** |

190 words in total.

## Accuracy notes for the read
- s3 makes the point the strategy needs: agreeing to go isn't paying.
- s5 is a real feature, but the money is a test balance. The on-screen tag says so; the line doesn't need to.
- s6 says "where Where You At is heading": the pot and the card are a concept. Don't change it to present tense.
- s7 is over a screen labelled "Simulated checkout". Don't add "booked" or "tickets sorted".

## Recording options (free)
1. **Your own voice (best).** A phone in a quiet room with soft furnishings, 15 cm from your mouth. Read each line as its own take. Export WAV, name the files `s1.wav` … `s8.wav`.
2. **Kokoro** (open-source, Apache-2.0, runs locally, male English voices). `scripts/make_vo.py` generates all eight clips once you've agreed to download its model (about 340 MB from GitHub). See `README.md`.
3. **Avoid** the built-in macOS voices: they sound robotic, which the brief rules out.
