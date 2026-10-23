import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Glow, Logo, Poster, StatusTag } from '../components/Brand';
import { glide, pop } from '../components/motion';
import { Check, Panel, SceneShell, Tap } from '../components/Ui';
import { BAR, BEAT, EVENT, PEOPLE, TOTAL_CENTS, money, sceneLength } from '../data/demo';
import { C, F, LOOKS, WALLET_GRADIENT } from '../styles/tokens';

const LENGTH = sceneLength('checkout');
export const PAY_TAP = BAR;
export const DONE_AT = PAY_TAP + BEAT * 2; // a beat of suspense, then the release

/** Scene 7 (simulated): paying for the tickets with the group card. Not a real merchant, not a booking. */
export default function S7Checkout() {
  const frame = useCurrentFrame();
  const done = frame >= DONE_AT;
  const waiting = frame >= PAY_TAP && !done;
  const spin = interpolate(frame, [PAY_TAP, DONE_AT], [0, 720]);
  return (
    <SceneShell length={LENGTH} bg={C.bg} enter="up">
      <Glow look={LOOKS.sunset} opacity={0.4} y={-6} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 380 }}>
        <Panel style={{ width: 900, padding: 50, transform: `translateY(${(1 - pop(frame, 0, 150, 16)) * 200}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            <Poster width={150} height={150} title="HS" titleSize={44} style={{ borderRadius: 30 }} />
            <div>
              <div style={{ fontSize: 50, fontWeight: 700, letterSpacing: -1 }}>{EVENT.title}</div>
              <div style={{ fontSize: 34, color: C.textSecondary }}>{PEOPLE.length} tickets · {EVENT.day}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 44, paddingTop: 34, borderTop: `2px solid ${C.border}` }}>
            <div style={{ fontSize: 40, fontWeight: 600 }}>Total</div>
            <div style={{ fontFamily: F.mono, fontSize: 80 }}>{money(TOTAL_CENTS, true)}</div>
          </div>
          <div style={{ fontSize: 28, color: C.textMuted, textAlign: 'right' }}>Excludes any applicable fees</div>
          {/* Pay with the group card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 40, padding: 26, borderRadius: 30, background: C.surfaceAlt }}>
            <div style={{ width: 130, height: 82, borderRadius: 16, background: '#111114', backgroundImage: WALLET_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Logo size={34} color={C.white} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 38, fontWeight: 600 }}>Group card</div>
              <div style={{ fontFamily: F.mono, fontSize: 32, color: C.textSecondary }}>•••• 4521</div>
            </div>
            <Check size={54} />
          </div>
          <div style={{ marginTop: 40, height: 128, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, background: done ? C.success : C.text, color: C.white, fontWeight: 600, fontSize: done ? 38 : 46, whiteSpace: 'nowrap', transform: `scale(${done ? 0.94 + 0.06 * pop(frame, DONE_AT, 240, 12) : 1})` }}>
            {waiting && <div style={{ width: 46, height: 46, borderRadius: 23, border: '6px solid rgba(255,255,255,0.3)', borderTopColor: C.white, transform: `rotate(${spin}deg)` }} />}
            {done ? <><Check size={52} bg={C.white} color={C.success} /> Payment demonstration complete</> : waiting ? 'Paying…' : `Pay ${money(TOTAL_CENTS, true)}`}
          </div>
        </Panel>
        <Tap x={540} y={1360} at={PAY_TAP} />
        {done && (
          <div style={{ marginTop: 44, fontFamily: F.body, fontWeight: 600, fontSize: 36, color: C.textSecondary, opacity: glide(frame, DONE_AT + 6, 10), textAlign: 'center', padding: '0 120px' }}>
            Tickets still come from the venue. This is a demo, not a booking.
          </div>
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 280 }}>
        <StatusTag label="Simulated checkout" at={4} />
      </AbsoluteFill>
    </SceneShell>
  );
}
