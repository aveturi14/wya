import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Avatar, Grain, Logo } from '../components/Brand';
import { glide, pop } from '../components/motion';
import { SceneShell } from '../components/Ui';
import { BAR, BEAT, PEOPLE, sceneLength } from '../data/demo';
import { C, F, LOOKS, posterGradient } from '../styles/tokens';

const LENGTH = sceneLength('close');
export const LINE1 = 10;
export const LINE2 = LINE1 + BEAT;
export const BRAND_AT = BAR * 2;

/** Scene 8: the friends together, then "Less chasing. More going." and the brand. */
export default function S8Close() {
  const frame = useCurrentFrame();
  const brand = glide(frame, BRAND_AT, 14);
  return (
    <SceneShell length={LENGTH + 8} bg={LOOKS.sunset.a} enter="none">
      {/* The whole frame becomes the event's poster */}
      <AbsoluteFill style={{ backgroundImage: posterGradient(LOOKS.sunset) }} />
      <Grain opacity={0.55} />

      {/* The four of them, together, bouncing on the beat */}
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 330 }}>
        <div style={{ display: 'flex' }}>
          {PEOPLE.map((p, i) => {
            const t = pop(frame, 2 + i * 4, 200, 11);
            const bounce = Math.abs(Math.sin(((frame + i * 3) / BEAT) * Math.PI)) * 14;
            return (
              <div key={p} style={{ marginLeft: i ? -40 : 0, transform: `translateY(${(1 - t) * 200 - bounce}px) rotate(${(i - 1.5) * 4}deg)` }}>
                <Avatar name={p} size={190} ring={LOOKS.sunset.a} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 80, paddingTop: 80, transform: `translateY(${-brand * 160}px)` }}>
        {[{ t: 'LESS CHASING.', at: LINE1 }, { t: 'MORE GOING.', at: LINE2 }].map((l) => {
          const t = pop(frame, l.at, 190, 14);
          return (
            <div key={l.t} style={{ fontFamily: F.poster, fontWeight: 900, fontSize: 132, lineHeight: 0.92, letterSpacing: -3, color: LOOKS.sunset.ink, opacity: Math.min(1, t * 1.5), transform: `translateX(${(1 - t) * -120}px)` }}>
              {l.t}
            </div>
          );
        })}
      </AbsoluteFill>

      {frame >= BRAND_AT - 2 && (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 460, opacity: brand }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 34, padding: '40px 64px', borderRadius: 999, background: C.white, boxShadow: '0 30px 70px rgba(0,0,0,0.2)', transform: `scale(${0.8 + 0.2 * pop(frame, BRAND_AT, 170, 13)})` }}>
            <Logo size={120} />
            <div style={{ width: 3, height: 90, background: C.border }} />
            <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 78, color: C.text }}>Where You At</div>
          </div>
          <div style={{ marginTop: 40, fontFamily: F.body, fontWeight: 600, fontSize: 46, color: LOOKS.sunset.ink, opacity: glide(frame, BRAND_AT + 14, 12) }}>
            Make the plan happen · <span style={{ fontFamily: F.mono, fontWeight: 500 }}>wya.expo.app</span>
          </div>
        </AbsoluteFill>
      )}
    </SceneShell>
  );
}
