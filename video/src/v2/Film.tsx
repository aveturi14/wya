import { ReactNode } from 'react';
import { AbsoluteFill, Audio, Sequence, getStaticFiles, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Avatar, Glow, Grain, Kinetic, Logo, Sticker } from '../components/Brand';
import { glide, pop } from '../components/motion';
import { SceneShell } from '../components/Ui';
import { C, F, LOOKS, posterGradient } from '../styles/tokens';
import { BAR, BEAT, CHAT, DURATION, PEOPLE, SceneName, VO, from, len } from './data';
import { BillsScreen, ClaimScreen, DuesScreen, EventScreen, FundScreen, HomeScreen, PayScreen, RsvpCard, ScanScreen } from './screens';
import { Phone } from './ui';

const PHONE_W = 690;
const PHONE_TOP = 450;

// ------------------------------------------------------------------ timings (scene-relative frames)
export const HOOK = { msg: (i: number) => 2 + i * 9, everyone: BEAT * 6, nobody: BEAT * 8 };
export const PROMISE = { words: [BEAT * 2, BEAT * 3, BEAT * 4] };
export const PLAN = { homeTap: 46, eventIn: 56, inviteTap: 96, sheetIn: 104, sheetOut: 160, goingAt: (i: number) => 176 + i * BEAT, rsvpIn: 170, rsvpTap: 190, rsvpOut: 290 };
export const SPLIT = { uploadTap: 40, scanIn: 52, claimIn: 118, tickAt: (i: number) => 140 + i * BEAT, confirmAt: 300 };
export const SETTLE = { sheetIn: 0, payAt: 64, duesIn: 140, paidAt: [150, 178, 206] };
export const NEXT = { inAt: (i: number) => 24 + i * 10, cardAt: BAR * 2, payAt: BAR * 2 + 78 };
export const CLOSE = { line1: 6, line2: 6 + BEAT, brand: BAR, soon: BAR + 26 };

/** The big step heading above the phone: a numbered chip, the step, and a changing sub-line. */
function Step({ n, title, lines, at = 0 }: { n: number | string; title: string; lines: { text: string; at: number }[]; at?: number }) {
  const f = useCurrentFrame();
  const current = [...lines].reverse().find((l) => f >= l.at);
  const t = pop(f, at, 180, 15);
  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 210 }}>
      {/* The phone slides under the caption, never over it */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 470, background: `linear-gradient(180deg, ${C.bg} 78%, rgba(250,250,250,0) 100%)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, position: 'relative', opacity: t, transform: `translateY(${(1 - t) * 40}px)` }}>
        <div style={{ width: 70, height: 70, borderRadius: 35, background: C.text, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.body, fontWeight: 700, fontSize: 38 }}>{n}</div>
        <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 104, letterSpacing: -4.5, color: C.text, lineHeight: 1 }}>{title}</div>
      </div>
      <div style={{ height: 90, marginTop: 14, position: 'relative', width: 1000 }}>
        {current && (
          <div key={current.text} style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: F.serif, fontStyle: 'italic', fontSize: 66, color: C.text, opacity: glide(f, current.at, 8), transform: `translateY(${(1 - glide(f, current.at, 8)) * 24}px)` }}>
            {current.text}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

/** The phone, with an optional camera move (scale and offset in frame pixels). */
function PhoneShot({ children, zoom = 1, x = 0, y = 0, enter = 0 }: { children: ReactNode; zoom?: number; x?: number; y?: number; enter?: number }) {
  const f = useCurrentFrame();
  const t = pop(f, enter, 120, 16);
  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: PHONE_TOP, transform: `translate(${x}px, ${y + (1 - t) * 500}px) scale(${zoom})`, transformOrigin: `540px ${PHONE_TOP}px` }}>
      <Phone width={PHONE_W}>{children}</Phone>
    </AbsoluteFill>
  );
}

/** Slides one screen in over another, like a stack push. */
function Push({ f, at, under, over }: { f: number; at: number; under: ReactNode; over: ReactNode }) {
  const t = glide(f, at, 12);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-t * 110}px)`, opacity: 1 - t * 0.5 }}>{under}</div>
      {f >= at && <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - t) * 375}px)`, boxShadow: '-20px 0 40px rgba(0,0,0,0.12)' }}>{over}</div>}
    </>
  );
}

const cam = (f: number, keys: [number, number, number, number][]) => {
  // keys: [frame, zoom, x, y]
  const fr = keys.map((k) => k[0]);
  const opt = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
  return { zoom: interpolate(f, fr, keys.map((k) => k[1]), opt), x: interpolate(f, fr, keys.map((k) => k[2]), opt), y: interpolate(f, fr, keys.map((k) => k[3]), opt) };
};

// ------------------------------------------------------------------ scenes
function Hook() {
  const f = useCurrentFrame();
  const blur = interpolate(f, [HOOK.everyone - 4, HOOK.everyone + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <SceneShell length={len('hook')} bg={C.inkBg} enter="none">
      <AbsoluteFill style={{ padding: '0 70px', justifyContent: 'center', filter: `blur(${blur * 12}px)`, opacity: 1 - blur * 0.75 }}>
        {CHAT.map((m, i) => {
          if (f < HOOK.msg(i)) return null;
          const t = pop(f, HOOK.msg(i), 240, 17);
          const mine = m.who === 'Alex';
          return (
            <div key={i} style={{ display: 'flex', flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 16, marginTop: 20, opacity: t, transform: `translateY(${(1 - t) * 60}px) scale(${0.8 + 0.2 * t})`, transformOrigin: mine ? 'right bottom' : 'left bottom' }}>
              <Avatar name={m.who} size={76} ring={C.inkBg} />
              <div style={{ padding: '24px 34px', borderRadius: 44, background: mine ? C.inkText : C.inkSurfaceAlt, color: mine ? C.inkBg : C.inkText, fontFamily: F.body, fontWeight: 500, fontSize: 50 }}>{m.text}</div>
            </div>
          );
        })}
      </AbsoluteFill>
      {f >= HOOK.everyone && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 24 }}>
          <Kinetic text="Everyone's in." at={HOOK.everyone} size={128} color={C.inkText} gap={3} />
          {f >= HOOK.nobody && <Kinetic text="Nobody's paid." at={HOOK.nobody} size={128} color={C.pink} gap={3} />}
        </AbsoluteFill>
      )}
    </SceneShell>
  );
}

function Promise() {
  const f = useCurrentFrame();
  const words = ['Plan it.', 'Split it.', 'Settle up.'];
  const logo = pop(f, 0, 200, 12);
  return (
    <SceneShell length={len('promise')} bg={C.bg} enter="none">
      <Glow look={LOOKS.sunset} opacity={0.55} y={4} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <div style={{ transform: `scale(${0.5 + 0.5 * logo})`, opacity: logo }}><Logo size={210} /></div>
        <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 80, color: C.text, opacity: glide(f, 6, 8) }}>Where You At</div>
        <div style={{ display: 'flex', gap: 22, marginTop: 50 }}>
          {words.map((w, i) => {
            const t = pop(f, PROMISE.words[i], 260, 13);
            return (
              <div key={w} style={{ padding: '22px 34px', borderRadius: 999, background: i === 2 ? C.text : C.white, color: i === 2 ? C.white : C.text, fontFamily: F.body, fontWeight: 700, fontSize: 48, letterSpacing: -1.5, boxShadow: '0 20px 40px rgba(20,10,30,0.12)', opacity: Math.min(1, t * 1.5), transform: `translateY(${(1 - t) * 80}px) rotate(${(i - 1) * 2}deg)` }}>{w}</div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
}

function Plan() {
  const f = useCurrentFrame();
  const going = 1 + PEOPLE.slice(1).filter((_, i) => f >= PLAN.goingAt(i)).length;
  const sheetT = glide(f, PLAN.sheetIn, 10) * (1 - glide(f, PLAN.sheetOut, 10));
  const c = cam(f, [[0, 1, 0, 0], [PLAN.eventIn, 1, 0, 0], [PLAN.rsvpIn - 6, 1, 0, 0], [PLAN.rsvpIn + 6, 0.9, -110, 0], [PLAN.rsvpOut, 0.9, -110, 0], [PLAN.rsvpOut + 12, 1, 0, 0]]);
  const rsvp = glide(f, PLAN.rsvpIn, 10) * (1 - glide(f, PLAN.rsvpOut, 10));
  return (
    <SceneShell length={len('plan')} bg={C.bg} enter="up">
      <Glow look={LOOKS.sunset} opacity={0.4} y={-8} />
      <PhoneShot zoom={c.zoom} x={c.x} y={c.y}>
        <Push f={f} at={PLAN.eventIn} under={<HomeScreen f={f} tapAt={PLAN.homeTap} />} over={<EventScreen f={f} going={going} inviteTap={PLAN.inviteTap} sheetT={sheetT} />} />
      </PhoneShot>
      <Step n={1} title="Plan it." lines={[{ text: 'one place for the plan', at: 0 }, { text: 'one link for the group', at: PLAN.inviteTap }, { text: 'everyone says I\'m in', at: PLAN.rsvpIn }]} />
      {rsvp > 0 && (
        <div style={{ position: 'absolute', right: 34, top: 1500, transform: `scale(${1.5 * (0.8 + 0.2 * rsvp)})`, transformOrigin: 'right top', opacity: rsvp }}>
          <RsvpCard f={f} tapAt={PLAN.rsvpTap} />
        </div>
      )}
    </SceneShell>
  );
}

function Split() {
  const f = useCurrentFrame();
  const c = cam(f, [[0, 1, 0, 0], [SPLIT.claimIn, 1, 0, 0], [SPLIT.claimIn + 16, 1.14, 0, -170], [SPLIT.tickAt(3) + 20, 1.14, 0, -170], [SPLIT.confirmAt - 30, 1.12, 0, -420], [len('split'), 1.12, 0, -420]]);
  let screen: ReactNode;
  if (f < SPLIT.scanIn) screen = <BillsScreen f={f} tapAt={SPLIT.uploadTap} />;
  else if (f < SPLIT.claimIn) screen = <ScanScreen f={f - SPLIT.scanIn} />;
  else screen = <ClaimScreen f={f} tickAt={SPLIT.tickAt} confirmAt={SPLIT.confirmAt} />;
  return (
    <SceneShell length={len('split')} bg={C.bg} enter="up">
      <Glow look={LOOKS.peach} opacity={0.4} y={-8} />
      <PhoneShot zoom={c.zoom} x={c.x} y={c.y}>{screen}</PhoneShot>
      <Step n={2} title="Split it." lines={[{ text: 'Alex snaps the receipt', at: 0 }, { text: 'every line, read for you', at: SPLIT.scanIn + 10 }, { text: 'Maya ticks what she had', at: SPLIT.claimIn + 10 }, { text: 'the maths is done', at: SPLIT.tickAt(3) + 24 }]} />
    </SceneShell>
  );
}

function Settle() {
  const f = useCurrentFrame();
  const sheetT = glide(f, SETTLE.sheetIn, 10);
  const c = cam(f, [[0, 1.04, 0, -260], [SETTLE.duesIn - 8, 1.04, 0, -260], [SETTLE.duesIn + 8, 1.08, 0, -120], [len('settle'), 1.08, 0, -120]]);
  return (
    <SceneShell length={len('settle')} bg={C.bg} enter="none">
      <Glow look={LOOKS.lime} opacity={0.3} y={-8} />
      <PhoneShot zoom={c.zoom} x={c.x} y={c.y}>
        <Push f={f} at={SETTLE.duesIn} under={<PayScreen f={f} sheetT={sheetT} payAt={SETTLE.payAt} />} over={<DuesScreen f={f} paidAt={SETTLE.paidAt} />} />
      </PhoneShot>
      <Step n={3} title="Settle up." lines={[{ text: 'Maya pays Alex back', at: 0 }, { text: 'one tap. paid.', at: SETTLE.payAt + 8 }, { text: 'Alex sees who\'s paid', at: SETTLE.duesIn }, { text: 'nobody chases anyone', at: SETTLE.paidAt[2] + 10 }]} />
    </SceneShell>
  );
}

function Next() {
  const f = useCurrentFrame();
  const c = cam(f, [[0, 1, 0, 0], [NEXT.cardAt - 6, 1.04, 0, 0], [NEXT.cardAt + 10, 1.18, 0, -60], [NEXT.cardAt + 36, 1.18, 0, -60], [NEXT.cardAt + 52, 1.02, 0, -330], [len('next'), 1.02, 0, -330]]);
  return (
    <SceneShell length={len('next')} bg={C.bg} enter="up">
      <Glow look={LOOKS.sunset} opacity={0.5} y={-6} />
      <PhoneShot zoom={c.zoom} x={c.x} y={c.y}>
        <FundScreen f={f} inAt={NEXT.inAt} cardAt={NEXT.cardAt} payAt={NEXT.payAt} />
      </PhoneShot>
      <Step n="+" title="Pay as one." lines={[{ text: 'everyone chips in first', at: 0 }, { text: 'the group gets a card', at: NEXT.cardAt }, { text: 'nobody fronts a thing', at: NEXT.payAt + 8 }]} />
    </SceneShell>
  );
}

function Close() {
  const f = useCurrentFrame();
  const brand = glide(f, CLOSE.brand, 12);
  return (
    <SceneShell length={len('close') + 8} bg={LOOKS.sunset.a} enter="none">
      <AbsoluteFill style={{ backgroundImage: posterGradient(LOOKS.sunset) }} />
      <Grain opacity={0.55} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 300 }}>
        <div style={{ display: 'flex' }}>
          {PEOPLE.map((p, i) => {
            const t = pop(f, i * 3, 220, 11);
            const bounce = Math.abs(Math.sin(((f + i * 3) / BEAT) * Math.PI)) * 16;
            return <div key={p} style={{ marginLeft: i ? -36 : 0, transform: `translateY(${(1 - t) * 200 - bounce}px) rotate(${(i - 1.5) * 5}deg)` }}><Avatar name={p} size={180} ring={LOOKS.sunset.a} /></div>;
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 80, transform: `translateY(${-brand * 130}px)` }}>
        {[{ t: 'LESS CHASING.', at: CLOSE.line1 }, { t: 'MORE GOING.', at: CLOSE.line2 }].map((l) => {
          const t = pop(f, l.at, 220, 14);
          return <div key={l.t} style={{ fontFamily: F.poster, fontWeight: 900, fontSize: 124, lineHeight: 0.93, letterSpacing: -3, color: LOOKS.sunset.ink, opacity: Math.min(1, t * 1.5), transform: `translateX(${(1 - t) * -140}px)` }}>{l.t}</div>;
        })}
      </AbsoluteFill>
      {f >= CLOSE.brand - 2 && (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 470, opacity: brand }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '38px 60px', borderRadius: 999, background: C.white, boxShadow: '0 30px 70px rgba(0,0,0,0.2)', transform: `scale(${0.8 + 0.2 * pop(f, CLOSE.brand, 200, 13)})` }}>
            <Logo size={116} />
            <div style={{ width: 3, height: 88, background: C.border }} />
            <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 76, color: C.text }}>Where You At</div>
          </div>
          {f >= CLOSE.soon && (
            <div style={{ marginTop: 44, transform: `scale(${pop(f, CLOSE.soon, 240, 11)})` }}>
              <Sticker label="Coming soon" size={52} tilt={-5} bg={C.text} fg={C.white} />
            </div>
          )}
        </AbsoluteFill>
      )}
    </SceneShell>
  );
}

// ------------------------------------------------------------------ the film
const SCENES: { name: SceneName; C: () => ReactNode }[] = [
  { name: 'hook', C: Hook }, { name: 'promise', C: Promise }, { name: 'plan', C: Plan }, { name: 'split', C: Split },
  { name: 'settle', C: Settle }, { name: 'next', C: Next }, { name: 'close', C: Close },
];

type Sfx = 'message' | 'tap' | 'whoosh' | 'pop' | 'confirm' | 'success' | 'card';
const at = (s: SceneName, fr: number, sfx: Sfx, volume = 0.5) => ({ frame: from(s) + fr, sfx, volume });
const CUES = [
  ...CHAT.map((_, i) => at('hook', HOOK.msg(i), 'message', 0.45)),
  at('hook', HOOK.everyone, 'whoosh', 0.3),
  at('promise', 0, 'pop', 0.5), ...PROMISE.words.map((w) => at('promise', w, 'pop', 0.4)),
  at('plan', PLAN.homeTap, 'tap', 0.6), at('plan', PLAN.eventIn, 'whoosh', 0.3), at('plan', PLAN.inviteTap, 'tap', 0.6), at('plan', PLAN.sheetIn, 'whoosh', 0.25),
  at('plan', PLAN.rsvpTap, 'confirm', 0.45), ...[0, 1, 2].map((i) => at('plan', PLAN.goingAt(i), 'pop', 0.35)),
  at('split', SPLIT.uploadTap, 'tap', 0.6), at('split', SPLIT.scanIn, 'whoosh', 0.3), ...[0, 1, 2, 3].map((i) => at('split', SPLIT.tickAt(i), 'tap', 0.45)),
  at('split', SPLIT.confirmAt, 'confirm', 0.45),
  at('settle', SETTLE.payAt, 'tap', 0.6), at('settle', SETTLE.payAt + 6, 'success', 0.5), at('settle', SETTLE.duesIn, 'whoosh', 0.3),
  ...SETTLE.paidAt.map((p) => at('settle', p, 'confirm', 0.45)),
  ...[0, 1, 2, 3].map((i) => at('next', NEXT.inAt(i), 'pop', 0.35)), at('next', NEXT.cardAt, 'card', 0.6), at('next', NEXT.payAt, 'tap', 0.6), at('next', NEXT.payAt + 6, 'success', 0.5),
  at('close', CLOSE.brand, 'pop', 0.5), at('close', CLOSE.soon, 'confirm', 0.4),
];

const files = new Set(getStaticFiles().map((f) => f.name));
const VO_CLIPS = VO.filter((v) => files.has(`audio/vo2/${v.id}.wav`)).map((v) => ({ ...v, start: from(v.scene as SceneName) + v.at }));
const musicVolume = (f: number) => {
  let duck = 0;
  for (const v of VO_CLIPS) {
    const end = v.start + Math.round((v.text.split(' ').length / 190) * 60 * 30) + 8;
    duck = Math.max(duck, interpolate(f, [v.start - 6, v.start, end, end + 10], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  }
  return 0.5 * (1 - 0.6 * duck);
};

export default function FilmV2() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {SCENES.map(({ name, C: Scene }) => (
        <Sequence key={name} from={from(name)} durationInFrames={len(name) + (name === 'close' ? 0 : 6)} name={name}>
          <Scene />
        </Sequence>
      ))}
      <Audio src={staticFile('audio/music_v2.wav')} volume={musicVolume} />
      {CUES.map((c, i) => (
        <Sequence key={i} from={c.frame} durationInFrames={BAR * 2} name={`sfx ${c.sfx}`}>
          <Audio src={staticFile(`audio/sfx/${c.sfx}.wav`)} volume={c.volume * 0.8} />
        </Sequence>
      ))}
      {VO_CLIPS.map((v) => (
        <Sequence key={v.id} from={v.start} name={`vo ${v.id}`}><Audio src={staticFile(`audio/vo2/${v.id}.wav`)} /></Sequence>
      ))}
    </AbsoluteFill>
  );
}

export { DURATION };
