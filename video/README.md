# Where You At: launch reel (Remotion)

A 1:20 vertical launch film (1080×1920, 30 fps, H.264/AAC) for Instagram Reels, TikTok and YouTube Shorts. It lives in its own folder with its own `package.json`, so nothing here touches the app or its bundle.

## What's here
```
video/
  src/Root.tsx            compositions: LaunchReel (the film) and Poster (the cover still)
  src/MainFilm.tsx        scenes in order, music with ducking, sound-effect cues, narration clips
  src/scenes/S1–S8        one file per scene; each exports its beat timings
  src/components/         Brand (logo, poster, glow, grain, stickers, avatars, kinetic text), Ui (panels, chips, icons), motion helpers
  src/data/demo.ts        every name, amount, label, bar and narration line (change things here, not in scenes)
  src/styles/             tokens copied from the app (constants/theme.ts, eventThemes.ts, wallet.ts) and font loading
  public/fonts            the app's fonts (OFL), public/img/grain.png, public/audio (music, sfx, vo)
  scripts/make_audio.py   generates the original music and sound effects
  scripts/make_vo.py      optional: generates the narration with Kokoro
  PRODUCT_AUDIT.md        what's real, simulated or a concept, and why each scene is labelled the way it is
  STORYBOARD.md · VOICEOVER.md · AUDIO_CREDITS.md
```

## Install (once)
```bash
cd video
npm install
```

## Preview and edit
```bash
npm run studio
```
Opens Remotion Studio at http://localhost:3000. Scrub the timeline, edit any file in `src/`, and it reloads. From the repo root, the Claude preview launcher's `reel-studio` entry runs the same thing on port 3123.

## Render
```bash
npm run render
```
Writes `out/WHERE_YOU_AT_LAUNCH_REEL.mp4` (about 2–3 minutes on an M-series Mac). The first render downloads Remotion's headless Chrome (about 170 MB).

```bash
npm run poster
```
Writes `out/REEL_POSTER.png`, the 1080×1920 cover.

```bash
npm run render:draft
```
A quick half-size draft for checking timing.

## Audio
- **Music and sound effects** are original, made by `npm run audio` (`scripts/make_audio.py`, numpy only). Re-run it after changing the tempo or sections.
- **Narration** is optional. Put clips at `public/audio/vo/s1.wav … s8.wav` (record your own, or see `scripts/make_vo.py` for Kokoro), then render again. Clips are placed automatically and the music ducks under them. Lines and timings are in `VOICEOVER.md`.

## Rules the film keeps
- The brand is spoken as **"Where You At"**, never as letters.
- Anything not built is labelled on screen: the collection pot and virtual card are a **Concept demonstration**, the checkout is a **Simulated checkout**, and the wallet is a **test balance**.
- One event, four friends, one set of amounts ($45 × 4 = $180), all from `src/data/demo.ts`.
- Important text stays between y = 250 and y = 1520, clear of Instagram's overlays.
