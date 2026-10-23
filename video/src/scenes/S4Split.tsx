import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Avatar, Glow, Kinetic } from '../components/Brand';
import { countUp, glide, leave, lerp, pop } from '../components/motion';
import { Callout, Check, Chip, Panel, SceneShell } from '../components/Ui';
import { BAR, BEAT, LABELS, ORGANISER, PEOPLE, SHARE_CENTS, TOTAL_CENTS, money, sceneLength } from '../data/demo';
import { C, F, LOOKS, PERSON } from '../styles/tokens';

const LENGTH = sceneLength('split');
export const SPLIT_AT = BAR + 6; // $180 breaks into four
export const ROW_AT = (i: number) => SPLIT_AT + 16 + i * 5;
export const RECEIPT_AT = BAR * 4 + 4; // "Dinner after?"

// The demo receipt (lib/demoReceipt.ts lines, kept short) and who ticked what
const LINES: { name: string; amount: string; who: (keyof typeof PERSON)[]; units?: string }[] = [
  { name: 'Margherita', amount: '$24', who: ['Maya'] },
  { name: 'Lasagne', amount: '$28', who: ['Jamie'] },
  { name: 'Garlic bread', amount: '$12', who: ['Alex', 'Maya', 'Sam'], units: 'Shared' },
  { name: 'Spritz ×2', amount: '$32', who: ['Sam'], units: '2' },
];

/** Scene 4: $180 becomes four clear $45 shares. Then a quick look at itemised receipts. */
export default function S4Split() {
  const frame = useCurrentFrame();
  const phaseA = leave(frame, RECEIPT_AT, 12);
  const phaseB = glide(frame, RECEIPT_AT - 4, 14);
  const split = glide(frame, SPLIT_AT, 20);
  const total = countUp(frame, 6, 26, 0, TOTAL_CENTS);

  return (
    <SceneShell length={LENGTH} bg={C.bg} enter="up">
      <Glow look={LOOKS.peach} opacity={0.35} y={-6} />

      {phaseA > 0 && (
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: 290, opacity: phaseA }}>
          <Callout at={2}>
            <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 66, color: C.text, textAlign: 'center' }}>{ORGANISER} got the tickets</div>
          </Callout>
          {/* The total, which shrinks and lifts as it splits */}
          <div style={{ marginTop: 10, fontFamily: F.mono, fontWeight: 500, fontSize: lerp(split, 230, 120), letterSpacing: -6, color: C.text, transform: `translateY(${-split * 10}px)` }}>
            {money(total)}
          </div>
          <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 38, color: C.textSecondary, opacity: split }}>
            Tickets · split {PEOPLE.length} ways
          </div>

          <Panel style={{ width: 900, padding: '20px 40px', marginTop: 50, opacity: glide(frame, SPLIT_AT + 8, 10) }}>
            {PEOPLE.map((p, i) => {
              const t = pop(frame, ROW_AT(i), 200, 15);
              const payer = p === ORGANISER;
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '22px 0', borderTop: i ? `2px solid ${C.border}` : 'none', opacity: Math.min(1, t * 1.4), transform: `translateX(${(1 - t) * 80}px)` }}>
                  <Avatar name={p} size={90} ring={C.surface} />
                  <div style={{ flex: 1, fontSize: 44, fontWeight: 600 }}>{p}</div>
                  <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 52, marginRight: 22 }}>{money(SHARE_CENTS)}</div>
                  {payer ? <Chip label={LABELS.paidTheBill} tone="warning" /> : <Chip label={LABELS.owes} tone="pink" />}
                </div>
              );
            })}
          </Panel>

          <Callout at={ROW_AT(3) + BEAT * 2} style={{ marginTop: 50 }}>
            <Kinetic text="No awkward maths." at={ROW_AT(3) + BEAT * 2} size={84} />
          </Callout>
        </AbsoluteFill>
      )}

      {/* Dinner after: the payer snaps the receipt and everyone ticks what they had */}
      {phaseB > 0 && (
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: 300, opacity: phaseB, transform: `translateY(${(1 - phaseB) * 120}px)` }}>
          <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 70, color: C.text, marginBottom: 26 }}>dinner after?</div>
          <Panel style={{ width: 900, padding: 44 }}>
            <div style={{ fontSize: 50, fontWeight: 700, letterSpacing: -1 }}>What did you have?</div>
            <div style={{ fontSize: 32, color: C.textSecondary, marginTop: 8, marginBottom: 20 }}>Dinner at Nonna's · paid by {ORGANISER}</div>
            {LINES.map((l, i) => {
              const at = RECEIPT_AT + 16 + i * BEAT;
              const ticked = frame >= at;
              return (
                <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 0', borderTop: `2px solid ${C.border}` }}>
                  <div style={{ transform: `scale(${ticked ? pop(frame, at, 260, 14) : 0})`, width: 52 }}>{ticked && <Check size={52} />}</div>
                  <div style={{ flex: 1, fontSize: 40, fontWeight: 500 }}>{l.name}</div>
                  {l.units && ticked && <Chip label={l.units} tone="neutral" style={{ fontSize: 28, padding: '8px 18px' }} />}
                  <div style={{ display: 'flex' }}>
                    {l.who.map((w, j) => (
                      <div key={w} style={{ marginLeft: j ? -22 : 0, opacity: ticked ? 1 : 0.15 }}>
                        <Avatar name={w} size={64} ring={C.surface} />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 40, width: 110, textAlign: 'right' }}>{l.amount}</div>
                </div>
              );
            })}
            <div style={{ borderTop: `2px solid ${C.border}`, paddingTop: 20, fontSize: 30, color: C.textSecondary }}>
              Sunday surcharge 10% · split by what each person ordered
            </div>
          </Panel>
          <div style={{ marginTop: 40, transform: `scale(${pop(frame, RECEIPT_AT + 16 + LINES.length * BEAT + 6)})`, opacity: interpolate(frame, [RECEIPT_AT + 70, RECEIPT_AT + 76], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', height: 116, padding: '0 64px', borderRadius: 999, background: C.text, color: C.white, fontFamily: F.body, fontWeight: 600, fontSize: 42 }}>
              Confirm my share
            </div>
          </div>
        </AbsoluteFill>
      )}
    </SceneShell>
  );
}
