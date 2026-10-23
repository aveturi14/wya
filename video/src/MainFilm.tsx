import type { ReactElement } from 'react';
import { AbsoluteFill, Audio, Sequence, getStaticFiles, interpolate, staticFile } from 'remotion';
import { BAR, BEAT, PEOPLE, SceneName, VO, sceneFrom, sceneLength, voWindow } from './data/demo';
import S1Chat, { FREEZE, MSG_AT, NOBODY } from './scenes/S1Chat';
import S2Intro, { POSTER_AT } from './scenes/S2Intro';
import S3Invite, { GOING_AT, LINK_AT, NOT_PAID_AT, RSVP_AT, SHARE_TAP, YES_TAP } from './scenes/S3Invite';
import S4Split, { RECEIPT_AT, ROW_AT, SPLIT_AT } from './scenes/S4Split';
import S5Payback, { DONE_AT as SORTED_AT, PAID_AT, PAY_TAP } from './scenes/S5Payback';
import S6Concept, { CARD_AT, IN_AT } from './scenes/S6Concept';
import S7Checkout, { DONE_AT as CHECKOUT_DONE, PAY_TAP as CHECKOUT_TAP } from './scenes/S7Checkout';
import S8Close, { BRAND_AT } from './scenes/S8Close';
import { C } from './styles/tokens';

const SCENES: { name: SceneName; C: () => ReactElement }[] = [
  { name: 'chat', C: S1Chat },
  { name: 'intro', C: S2Intro },
  { name: 'invite', C: S3Invite },
  { name: 'split', C: S4Split },
  { name: 'payback', C: S5Payback },
  { name: 'concept', C: S6Concept },
  { name: 'checkout', C: S7Checkout },
  { name: 'close', C: S8Close },
];

type Sfx = 'message' | 'tap' | 'whoosh' | 'pop' | 'confirm' | 'success' | 'card';
const at = (scene: SceneName, frame: number, sfx: Sfx, volume = 0.6) => ({ frame: sceneFrom(scene) + frame, sfx, volume });

// Every sound effect, tied to the frame its animation happens on
const CUES = [
  ...[0, 1, 2, 3, 4, 5].map((i) => at('chat', MSG_AT(i), 'message', 0.5)),
  at('chat', FREEZE, 'whoosh', 0.35),
  at('intro', 4, 'pop', 0.5),
  at('intro', POSTER_AT, 'whoosh', 0.45),
  at('invite', SHARE_TAP, 'tap', 0.7),
  at('invite', LINK_AT, 'whoosh', 0.45),
  ...PEOPLE.map((_, i) => at('invite', LINK_AT + 18 + i * 6, 'pop', 0.35)),
  at('invite', YES_TAP, 'tap', 0.7),
  ...[0, 1, 2].map((i) => at('invite', GOING_AT(i), 'confirm', 0.4)),
  at('invite', NOT_PAID_AT, 'whoosh', 0.3),
  at('split', SPLIT_AT, 'whoosh', 0.4),
  ...[0, 1, 2, 3].map((i) => at('split', ROW_AT(i), 'pop', 0.3)),
  at('split', RECEIPT_AT, 'whoosh', 0.35),
  ...[0, 1, 2, 3].map((i) => at('split', RECEIPT_AT + 16 + i * BEAT, 'tap', 0.45)),
  at('payback', PAY_TAP, 'tap', 0.7),
  ...PAID_AT.map((f) => at('payback', f, 'confirm', 0.5)),
  at('payback', SORTED_AT, 'success', 0.55),
  ...[0, 1, 2, 3].map((i) => at('concept', IN_AT(i) + 10, 'confirm', 0.4)),
  at('concept', CARD_AT, 'card', 0.7),
  at('checkout', CHECKOUT_TAP, 'tap', 0.7),
  at('checkout', CHECKOUT_DONE, 'success', 0.55),
  at('close', BRAND_AT, 'pop', 0.5),
];

// Narration clips that exist in public/audio/vo (the film renders with or without them)
const files = new Set(getStaticFiles().map((f) => f.name));
const VO_CLIPS = VO.filter((v) => files.has(`audio/vo/${v.id}.wav`)).map((v) => ({ ...v, ...voWindow(v) }));

/** Music under narration: full level, ducked to about a third while someone's speaking. */
const musicVolume = (f: number) => {
  let duck = 0;
  for (const v of VO_CLIPS) {
    duck = Math.max(duck, interpolate(f, [v.start - 6, v.start, v.end, v.end + 10], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  }
  return 0.62 * (1 - 0.62 * duck);
};

export default function MainFilm() {
  return (
    <AbsoluteFill style={{ background: C.inkBg }}>
      {SCENES.map(({ name, C: Scene }) => (
        // Each scene runs a few frames past its slot so the next one fades in over it
        <Sequence key={name} from={sceneFrom(name)} durationInFrames={sceneLength(name) + (name === 'close' ? 0 : 6)} name={name}>
          <Scene />
        </Sequence>
      ))}
      <Audio src={staticFile('audio/music.wav')} volume={musicVolume} />
      {CUES.map((c, i) => (
        <Sequence key={i} from={c.frame} durationInFrames={BAR * 2} name={`sfx ${c.sfx}`}>
          <Audio src={staticFile(`audio/sfx/${c.sfx}.wav`)} volume={c.volume * 0.8} />
        </Sequence>
      ))}
      {VO_CLIPS.map((v) => (
        <Sequence key={v.id} from={v.start} name={`vo ${v.id}`}>
          <Audio src={staticFile(`audio/vo/${v.id}.wav`)} volume={1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
