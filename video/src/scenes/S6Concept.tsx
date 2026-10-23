import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Avatar, Glow, Grain, Kinetic, Logo, Sticker, StatusTag } from '../components/Brand';
import { countUp, glide, leave, lerp, pop } from '../components/motion';
import { Check, Chip, SceneShell } from '../components/Ui';
import { BAR, BEAT, EVENT, ORGANISER, PEOPLE, SHARE_CENTS, TOTAL_CENTS, money, sceneLength } from '../data/demo';
import { C, F, LOOKS, R, WALLET_GRADIENT } from '../styles/tokens';

const LENGTH = sceneLength('concept');
export const IN_AT = (i: number) => 30 + i * BEAT; // each friend chips in, on the beat
export const FUNDED_AT = IN_AT(3) + 14;
export const CARD_AT = BAR * 3; // the drop
const RING = 520;
const SPOTS = [
  { x: 170, y: 560 }, { x: 910, y: 560 }, { x: 170, y: 1180 }, { x: 910, y: 1180 },
];
const CENTRE = { x: 540, y: 870 };

/** Scene 6 (concept, not built): everyone chips in first; the pot powers a virtual card for the organiser. */
export default function S6Concept() {
  const frame = useCurrentFrame();
  const phaseA = leave(frame, CARD_AT, 10);
  const inCount = PEOPLE.filter((_, i) => frame >= IN_AT(i) + 10).length;
  const pot = countUp(frame, IN_AT(Math.max(0, inCount - 1)) + 10, 10, Math.max(0, inCount - 1) * SHARE_CENTS, inCount * SHARE_CENTS);
  const progress = pot / TOTAL_CENTS;
  const card = pop(frame, CARD_AT, 90, 13);
  const sweep = interpolate(frame, [CARD_AT + 10, CARD_AT + 40], [-0.4, 1.4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const circ = Math.PI * (RING - 40);

  return (
    <SceneShell length={LENGTH} bg={C.inkBg} enter="scale">
      <Glow look={LOOKS.sunset} opacity={0.3 + 0.25 * card} y={4} dark />

      {/* Phase A: the group's pot fills from four contributions */}
      {phaseA > 0 && (
        <AbsoluteFill style={{ opacity: phaseA, transform: `scale(${1 - (1 - phaseA) * 0.2})` }}>
          <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
            {PEOPLE.map((p, i) => {
              const t = glide(frame, IN_AT(i), 12);
              if (t <= 0 || t >= 1) return null;
              const s = SPOTS[i];
              const x = lerp(t, s.x, CENTRE.x);
              const y = lerp(t, s.y, CENTRE.y) - Math.sin(t * Math.PI) * 120;
              return <circle key={p} cx={x} cy={y} r={22} fill={C.success} opacity={0.95} />;
            })}
            <circle cx={CENTRE.x} cy={CENTRE.y} r={(RING - 40) / 2} stroke={C.inkSurfaceAlt} strokeWidth={34} fill="none" />
            <circle cx={CENTRE.x} cy={CENTRE.y} r={(RING - 40) / 2} stroke={C.success} strokeWidth={34} fill="none" strokeLinecap="round"
              strokeDasharray={`${circ * progress} ${circ}`} transform={`rotate(-90 ${CENTRE.x} ${CENTRE.y})`} />
          </svg>
          <div style={{ position: 'absolute', left: CENTRE.x - 250, top: CENTRE.y - 120, width: 500, textAlign: 'center' }}>
            <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 34, color: C.inkTextSecondary }}>{EVENT.title} fund</div>
            <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 120, color: C.inkText, letterSpacing: -4 }}>{money(pot)}</div>
            <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 32, color: C.inkTextSecondary }}>of {money(TOTAL_CENTS)} · {inCount} of {PEOPLE.length} in</div>
          </div>
          {PEOPLE.map((p, i) => {
            const s = SPOTS[i];
            const done = frame >= IN_AT(i) + 10;
            return (
              <div key={p} style={{ position: 'absolute', left: s.x - 75, top: s.y - 75, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transform: `scale(${pop(frame, 4 + i * 3)})` }}>
                <Avatar name={p} size={150} ring={C.inkBg} />
                <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 32, color: C.inkText }}>{p} · {done ? 'in' : money(SHARE_CENTS)}</div>
              </div>
            );
          })}
          {/* The states the brief keeps apart: going ≠ paid in ≠ funds available ≠ booked */}
          <div style={{ position: 'absolute', top: 1350, left: 0, right: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16, padding: '0 70px' }}>
            <Chip label="4 going" tone="success" dark />
            <Chip label={`${inCount} of 4 paid in`} tone={inCount === 4 ? 'success' : 'warning'} dark />
            <Chip label={frame >= FUNDED_AT ? 'Funds available' : 'Collecting'} tone={frame >= FUNDED_AT ? 'success' : 'neutral'} dark />
            <Chip label="Not booked yet" tone="neutral" dark />
          </div>
        </AbsoluteFill>
      )}

      {/* Phase B: the hero reveal, the pot becomes a card */}
      {frame >= CARD_AT - 2 && (
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: 470, perspective: 1800 }}>
          <div
            style={{
              position: 'relative', width: 880, height: 555, borderRadius: R.xl, overflow: 'hidden', background: '#111114', backgroundImage: WALLET_GRADIENT,
              transform: `rotateY(${(1 - card) * 70 - 4}deg) rotateX(${(1 - card) * 18 + 4}deg) scale(${0.6 + 0.4 * card}) translateY(${Math.sin(frame / 22) * 6}px)`,
              boxShadow: '0 60px 120px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.06) inset', opacity: Math.min(1, card * 2),
            }}
          >
            <Grain opacity={0.25} radius={R.xl} />
            {/* A crisp light pass */}
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(105deg, transparent ${sweep * 100 - 18}%, rgba(255,255,255,0.28) ${sweep * 100}%, transparent ${sweep * 100 + 18}%)` }} />
            <div style={{ position: 'absolute', left: 56, top: 50 }}><Logo size={84} color={C.white} /></div>
            <div style={{ position: 'absolute', right: 50, top: 56 }}><Sticker label="group card" size={30} tilt={4} /></div>
            <div style={{ position: 'absolute', left: 56, top: 210, fontFamily: F.body, fontWeight: 600, fontSize: 40, color: 'rgba(255,255,255,0.8)' }}>{EVENT.title}</div>
            <div style={{ position: 'absolute', left: 56, top: 270, fontFamily: F.mono, fontWeight: 500, fontSize: 50, color: C.white, letterSpacing: 3, whiteSpace: 'nowrap' }}>•••• •••• •••• 4521</div>
            <div style={{ position: 'absolute', left: 56, bottom: 52, fontFamily: F.body, fontWeight: 600, fontSize: 32, color: 'rgba(255,255,255,0.75)', letterSpacing: 2 }}>{ORGANISER.toUpperCase()} · ORGANISER</div>
            <div style={{ position: 'absolute', right: 56, bottom: 50, fontFamily: F.mono, fontSize: 34, color: C.white }}>funded {money(TOTAL_CENTS)}</div>
          </div>
          <div style={{ marginTop: 80, width: 920 }}>
            <Kinetic text="Nobody fronts the whole thing." at={CARD_AT + 30} size={92} color={C.inkText} italicWords={['whole']} />
          </div>
          <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 18, opacity: glide(frame, CARD_AT + 60, 12) }}>
            <Check size={50} />
            <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 36, color: C.inkTextSecondary }}>Spends only what the group put in</div>
          </div>
        </AbsoluteFill>
      )}

      {/* Always visible: this part isn't built */}
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 290 }}>
        <StatusTag label="Concept demonstration · not live yet" dark at={6} />
      </AbsoluteFill>
    </SceneShell>
  );
}
