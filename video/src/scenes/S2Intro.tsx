import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Glow, Logo, Poster } from '../components/Brand';
import { glide, pop } from '../components/motion';
import { SceneShell } from '../components/Ui';
import { BAR, EVENT, sceneLength } from '../data/demo';
import { C, F, LOOKS } from '../styles/tokens';

const LENGTH = sceneLength('intro');
export const POSTER_AT = BAR + 16;

/** Scene 2: meet Where You At, and the plan becomes a poster (the app's event card). */
export default function S2Intro() {
  const frame = useCurrentFrame();
  const logo = pop(frame, 4, 150, 13);
  const toTop = glide(frame, POSTER_AT - 10, 22);
  const poster = pop(frame, POSTER_AT, 120, 15);
  // A slow camera push on the poster once it lands
  const push = interpolate(frame, [POSTER_AT, LENGTH], [0.94, 1.02], { extrapolateRight: 'clamp' });
  return (
    <SceneShell length={LENGTH} bg={C.bg}>
      <Glow look={LOOKS.sunset} opacity={0.45 + 0.25 * poster} y={10} />
      {/* Logo and line: centred first, then up to the top as the poster arrives */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translateY(${-toTop * 600}px) scale(${1 - toTop * 0.35})` }}>
        <div style={{ transform: `scale(${0.6 + 0.4 * logo})`, opacity: logo }}>
          <Logo size={260} />
        </div>
        <div style={{ marginTop: 20, fontFamily: F.serif, fontStyle: 'italic', fontSize: 88, color: C.text, opacity: glide(frame, 14, 14) }}>
          Where You At
        </div>
        <div style={{ marginTop: 30, fontFamily: F.body, fontWeight: 700, fontSize: 64, letterSpacing: -2, color: C.text, opacity: glide(frame, 26, 14) * (1 - toTop) }}>
          Plans that <span style={{ fontFamily: F.serif, fontStyle: 'italic', fontWeight: 400 }}>actually</span> happen.
        </div>
      </AbsoluteFill>
      {frame >= POSTER_AT - 2 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 220 }}>
          <div style={{ transform: `translateY(${(1 - poster) * 900}px) rotate(${(1 - poster) * 8 - 2}deg) scale(${push})` }}>
            <Poster
              title={EVENT.title}
              line={EVENT.line}
              foot={`${EVENT.day.toUpperCase()} · ${EVENT.city.toUpperCase()}`}
              stickers={[{ label: 'planning', x: 470, y: 50, tilt: 6, bg: C.white }]}
            />
          </div>
        </AbsoluteFill>
      )}
    </SceneShell>
  );
}
