import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Avatar, Kinetic } from '../components/Brand';
import { pop } from '../components/motion';
import { SceneShell } from '../components/Ui';
import { BAR, BEAT, CHAT, sceneLength } from '../data/demo';
import { C, F, PERSON } from '../styles/tokens';

const LENGTH = sceneLength('chat');
// Messages land on the beat, then the chat freezes on bar 3
export const MSG_AT = (i: number) => 4 + i * (BEAT - 3);
export const FREEZE = BAR * 2;
export const NOBODY = BAR * 2 + BEAT * 3;

/** Scene 1: a group chat piling up, then "Everyone's in. Nobody's paid." */
export default function S1Chat() {
  const frame = useCurrentFrame();
  const frozen = interpolate(frame, [FREEZE - 4, FREEZE + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <SceneShell length={LENGTH} bg={C.inkBg} enter="none">
      {/* The chat: newest at the bottom, older messages pushed up */}
      <AbsoluteFill style={{ padding: '0 70px', justifyContent: 'flex-end', paddingBottom: 520, filter: `blur(${frozen * 10}px)`, opacity: 1 - frozen * 0.72, transform: `scale(${1 - frozen * 0.04})` }}>
        <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 34, color: C.inkTextSecondary, textAlign: 'center', marginBottom: 40 }}>
          the group chat · 4 people
        </div>
        {CHAT.map((m, i) => {
          const t = pop(frame, MSG_AT(i), 220, 17);
          if (frame < MSG_AT(i)) return null;
          const mine = m.who === 'Alex';
          return (
            <div key={i} style={{ display: 'flex', flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 18, marginTop: 22, opacity: t, transform: `translateY(${(1 - t) * 60}px) scale(${0.85 + 0.15 * t})`, transformOrigin: mine ? 'right bottom' : 'left bottom' }}>
              <Avatar name={m.who as keyof typeof PERSON} size={74} ring={C.inkBg} />
              <div style={{ maxWidth: 700 }}>
                {!mine && <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 26, color: PERSON[m.who as keyof typeof PERSON], marginBottom: 6, marginLeft: 6 }}>{m.who}</div>}
                <div style={{ padding: '24px 34px', borderRadius: 44, background: mine ? C.inkText : C.inkSurfaceAlt, color: mine ? C.inkBg : C.inkText, fontFamily: F.body, fontWeight: 500, fontSize: 46, lineHeight: 1.15 }}>
                  {m.text}
                </div>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* The punchline */}
      {frame >= FREEZE && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 30, padding: '0 60px' }}>
          <Kinetic text="Everyone's in." at={FREEZE} size={124} color={C.inkText} gap={4} />
          {frame >= NOBODY && <Kinetic text="Nobody's paid." at={NOBODY} size={124} color={C.pink} gap={4} />}
        </AbsoluteFill>
      )}
    </SceneShell>
  );
}
