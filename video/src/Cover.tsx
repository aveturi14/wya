import { AbsoluteFill } from 'remotion';
import { Avatar, Glow, Grain, Logo, Poster, Sticker } from './components/Brand';
import { EVENT, PEOPLE } from './data/demo';
import { C, F, LOOKS } from './styles/tokens';

/** REEL_POSTER.png: the Instagram cover. The headline, the event poster, the four friends, the brand. */
export default function Cover() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Glow look={LOOKS.sunset} opacity={0.7} y={6} />
      {/* One column, kept inside the 4:5 grid crop (y ≈ 285–1635) */}
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 300 }}>
        <div style={{ fontFamily: F.poster, fontWeight: 900, fontSize: 88, lineHeight: 0.95, letterSpacing: -3, color: C.text, textAlign: 'center' }}>
          EVERYONE'S IN.
        </div>
        <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 96, color: C.pink, marginTop: 10 }}>now everyone pays.</div>
        <div style={{ marginTop: 50, transform: 'rotate(-3deg)' }}>
          <Poster width={540} height={600} title={EVENT.title} line={EVENT.line} titleSize={66} foot={`${EVENT.day.toUpperCase()} · ${EVENT.city.toUpperCase()}`} stickers={[{ label: '4 going', x: 330, y: 40, tilt: 6, bg: C.text, fg: C.white }]} />
        </div>
        <div style={{ display: 'flex', marginTop: 40 }}>
          {PEOPLE.map((p, i) => (
            <div key={p} style={{ marginLeft: i ? -30 : 0 }}><Avatar name={p} size={120} /></div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 40 }}>
          <Logo size={90} />
          <Sticker label="Where You At" tilt={-4} size={38} bg={C.text} fg={C.white} />
        </div>
      </AbsoluteFill>
      <Grain opacity={0.12} />
    </AbsoluteFill>
  );
}
