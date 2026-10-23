import type { ReactElement } from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from 'remotion';
import { BAR, BEATS, BEAT_ORDER, DURATION, type Beat } from './data';
import * as B from './beats';
import { VO } from './vo';
import { VO_FRAMES } from './voTimings';
import { VO_FRAMES as VO_FRAMES_M } from './voTimings_vo3m';

const SCENES: Record<Beat, () => ReactElement> = {
  hook: B.Hook, problem: B.Problem, home: B.Home, create: B.Create, open: B.Open, link: B.Link, pledge: B.Pledge, host: B.Host,
  chat: B.Chat, album: B.Album, bill: B.Bill, snap: B.Snap, tick: B.Tick, adds: B.Adds, pay: B.Pay, square: B.Square, close: B.Close,
};

type Sfx = 'message' | 'tap' | 'whoosh' | 'pop' | 'confirm' | 'success' | 'card';
// Sound effects, in frames from the start of each beat (they match the cues in beats.tsx)
const CUES: Partial<Record<Beat, [number, Sfx, number?][]>> = {
  hook: [[6, 'message'], [22, 'message'], [38, 'message'], [54, 'message'], [70, 'message']],
  problem: [[6, 'card'], [28, 'card'], [56, 'card'], [84, 'card']],
  home: [[8, 'card', 0.6], [20, 'card', 0.6]],
  create: [[BAR * 2, 'pop']],
  open: [[BAR + 16, 'tap'], [BAR + 20, 'confirm']],
  link: [[4, 'message'], [BAR, 'card'], [BAR + 30, 'tap'], [BAR + 34, 'success']],
  pledge: [[44, 'tap'], [45, 'confirm'], [BAR + 6, 'card'], [BAR * 2, 'card']],
  host: [[30, 'tap'], [34, 'message']],
  chat: [[4, 'card'], [BAR, 'card'], [BAR * 2, 'card']],
  album: [[6, 'pop', 0.6], [18, 'pop', 0.5], [30, 'pop', 0.5], [42, 'pop', 0.5]],
  bill: [[28, 'card', 0.6], [34, 'message'], [42, 'message'], [50, 'message'], [58, 'message'], [66, 'message'], [BAR + 40, 'card'], [BAR + 52, 'card'], [BAR + 64, 'card']],
  snap: [[14, 'whoosh', 0.5], [20, 'card'], [72, 'success']],
  tick: [[2, 'message'], [26, 'tap'], [40, 'tap'], [BAR + 30, 'tap'], [BAR * 2 + 10, 'confirm']],
  adds: [[16, 'tap'], [56, 'success']],
  pay: [[34, 'tap'], [38, 'success'], [BAR * 2 + 48, 'tap'], [BAR * 2 + 52, 'confirm'], [BAR * 2 + 92, 'card', 0.6], [BAR * 2 + 132, 'tap'], [BAR * 2 + 136, 'success']],
  square: [[0, 'pop'], [14, 'pop'], [34, 'success']],
};

const fadeOut = (f: number) => interpolate(f, [DURATION - 30, DURATION], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

// Voice clips that exist (the timings files are written by scripts/make_vo3.py), in film frames.
// vo3 is the female read (af_heart), vo3m the male one (am_fenrir).
type Voice = 'vo3' | 'vo3m';
const linesFor = (voice: Voice) => {
  const frames = voice === 'vo3m' ? VO_FRAMES_M : VO_FRAMES;
  return VO.filter((l) => frames[l.id]).map((l) => ({ ...l, start: BEATS[l.beat].from + l.at, end: BEATS[l.beat].from + l.at + frames[l.id] }));
};
// Music dips under the voice (6-frame ramps either side) and comes back up between lines
const DUCK = 0.42;

export default function FilmV3({ voice = 'vo3' }: { voice?: Voice }) {
  const LINES = linesFor(voice);
  const duck = (f: number) => LINES.reduce((g, l) => Math.min(g, interpolate(f, [l.start - 6, l.start, l.end, l.end + 8], [1, DUCK, DUCK, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })), 1);
  return (
    <AbsoluteFill style={{ background: '#0B0B0D' }}>
      <Audio src={staticFile('audio/music_v4.wav')} volume={(f) => 0.56 * fadeOut(f) * duck(f)} />
      {LINES.map((l) => (
        <Sequence key={l.id} from={l.start} durationInFrames={l.end - l.start + 6} name={`vo ${l.id}`}>
          <Audio src={staticFile(`audio/${voice}/${l.id}.wav`)} volume={1} />
        </Sequence>
      ))}
      {BEAT_ORDER.map((name) => {
        const Scene = SCENES[name];
        const { from, len } = BEATS[name];
        return (
          <Sequence key={name} from={from} durationInFrames={len} name={name}>
            <Scene />
            {name !== 'hook' && name !== 'close' && <Audio src={staticFile('audio/sfx/whoosh.wav')} volume={0.25} />}
            {(CUES[name] ?? []).map(([at, sfx, v = 1], i) => (
              <Sequence key={i} from={at} name={sfx}><Audio src={staticFile(`audio/sfx/${sfx}.wav`)} volume={0.45 * v * (LINES.length ? 0.7 : 1)} /></Sequence>
            ))}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
