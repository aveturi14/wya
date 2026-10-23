import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Avatar, Glow, Kinetic, Sticker, StatusTag } from '../components/Brand';
import { countUp, glide, leave, pop } from '../components/motion';
import { Check, Chip, Lock, Panel, SceneShell, Tap } from '../components/Ui';
import { BAR, BEAT, LABELS, OWED_CENTS, ORGANISER, PEOPLE, SHARE_CENTS, money, sceneLength } from '../data/demo';
import { C, F, LOOKS, R, WALLET_GRADIENT } from '../styles/tokens';

const LENGTH = sceneLength('payback');
export const PAY_TAP = 70;
export const LIST_AT = BAR * 2 + 20;
const guests = PEOPLE.filter((p) => p !== ORGANISER);
// Maya paid in phase A; Jamie and Sam land on beats, Sam on the bar's downbeat (the musical accent)
export const PAID_AT = [PAY_TAP + 6, LIST_AT + BEAT * 3, BAR * 4 + BEAT * 2];
export const DONE_AT = BAR * 5;
const START_BALANCE = 6000;

/** Scene 5: everyone pays the organiser back from the wya wallet (test balance), and everyone can see it. */
export default function S5Payback() {
  const frame = useCurrentFrame();
  const phaseA = leave(frame, LIST_AT, 12);
  const phaseB = glide(frame, LIST_AT - 4, 14);
  const paidCount = PAID_AT.filter((at) => frame >= at).length;
  const back = countUp(frame, PAID_AT[Math.max(0, paidCount - 1)], 12, Math.max(0, paidCount - 1) * SHARE_CENTS, paidCount * SHARE_CENTS);
  const balance = frame < PAY_TAP + 6 ? START_BALANCE : countUp(frame, PAY_TAP + 6, 16, START_BALANCE, START_BALANCE - SHARE_CENTS);
  const done = frame >= DONE_AT;

  return (
    <SceneShell length={LENGTH} bg={C.inkBg} enter="scale">
      <Glow look={LOOKS.sunset} opacity={0.32} y={-10} dark />

      {/* Phase A: Maya's wallet and the pay sheet */}
      {phaseA > 0 && (
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: 290, opacity: phaseA }}>
          <div style={{ position: 'relative', width: 900, height: 470, borderRadius: R.xl, overflow: 'hidden', background: '#111114', backgroundImage: WALLET_GRADIENT, padding: 54, boxSizing: 'border-box', boxShadow: '0 40px 90px rgba(0,0,0,0.55)', transform: `translateY(${(1 - pop(frame, 2, 150, 15)) * 200}px)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 46, color: C.white }}>wya wallet</div>
              <Sticker label={LABELS.testBalance} size={30} tilt={3} bg={C.white} />
            </div>
            <div style={{ position: 'absolute', left: 54, bottom: 54 }}>
              <div style={{ fontFamily: F.body, fontSize: 34, color: 'rgba(255,255,255,0.68)' }}>Balance</div>
              <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 130, color: C.white, letterSpacing: -4 }}>{money(balance, true)}</div>
            </div>
          </div>
          <Panel dark style={{ width: 900, marginTop: 40, transform: `translateY(${(1 - pop(frame, 20, 160, 16)) * 300}px)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <Avatar name={ORGANISER} size={96} ring={C.inkSurface} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 46, fontWeight: 700 }}>Pay {ORGANISER}</div>
                <div style={{ fontSize: 32, color: C.inkTextSecondary }}>Tickets · Harbour Sessions</div>
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 56 }}>{money(SHARE_CENTS, true)}</div>
            </div>
            <div style={{ marginTop: 40, height: 120, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, background: frame >= PAY_TAP + 6 ? C.success : C.inkText, color: C.inkBg, fontWeight: 600, fontSize: 44 }}>
              {frame >= PAY_TAP + 6 ? <><Check size={56} bg={C.inkBg} color={C.success} /> {LABELS.paid}</> : <><Lock color={C.inkBg} /> Pay {ORGANISER} {money(SHARE_CENTS)}</>}
            </div>
          </Panel>
          <Tap x={540} y={1240} at={PAY_TAP} />
        </AbsoluteFill>
      )}

      {/* Phase B: the bill's status, the same for everyone */}
      {phaseB > 0 && (
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: 300, opacity: phaseB }}>
          <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 38, color: C.inkTextSecondary }}>Paid back to {ORGANISER}</div>
          <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 150, color: C.inkText, letterSpacing: -5 }}>
            {money(back)}<span style={{ color: C.inkTextSecondary, fontSize: 80 }}> / {money(OWED_CENTS)}</span>
          </div>
          {/* Progress: only money actually paid counts */}
          <div style={{ width: 900, height: 22, borderRadius: 11, background: C.inkSurfaceAlt, marginTop: 20, overflow: 'hidden' }}>
            <div style={{ width: `${(back / OWED_CENTS) * 100}%`, height: '100%', borderRadius: 11, background: C.success }} />
          </div>
          <Panel dark style={{ width: 900, padding: '20px 40px', marginTop: 50 }}>
            {guests.map((p, i) => {
              const paid = frame >= PAID_AT[i];
              const t = paid ? pop(frame, PAID_AT[i], 260, 13) : 0;
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '22px 0', borderTop: i ? `2px solid ${C.inkSurfaceAlt}` : 'none' }}>
                  <Avatar name={p} size={90} ring={C.inkSurface} />
                  <div style={{ flex: 1, fontSize: 44, fontWeight: 600 }}>{p}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 48, marginRight: 22 }}>{money(SHARE_CENTS)}</div>
                  {paid ? <div style={{ transform: `scale(${0.7 + 0.3 * t})` }}><Chip label={LABELS.paid} tone="success" dark /></div> : <Chip label={LABELS.owes} tone="warning" dark />}
                </div>
              );
            })}
          </Panel>
          {done && (
            <div style={{ marginTop: 60, display: 'flex', alignItems: 'center', gap: 26, transform: `scale(${pop(frame, DONE_AT, 200, 12)})` }}>
              <Check size={96} />
              <Kinetic text="4 of 4. Sorted." at={DONE_AT} size={96} color={C.inkText} />
            </div>
          )}
        </AbsoluteFill>
      )}

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 430 }}>
        <StatusTag label="Test balance: no real money moves yet" dark at={10} />
      </AbsoluteFill>
    </SceneShell>
  );
}
