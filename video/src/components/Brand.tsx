import { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { C, F, LOOKS, Look, PERSON, R, posterGradient } from '../styles/tokens';
import { pop } from './motion';

/** The "wya." wordmark: Geist bold, tight, with the sticker-pink dot (components/ui/Logo). */
export function Logo({ size = 120, color = C.text }: { size?: number; color?: string }) {
  return (
    <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: -size * 0.05, color }}>
      wya<span style={{ color: C.pink }}>.</span>
    </div>
  );
}

/** The page glow behind posters (components/ui/Poster PosterGlow): two soft pools of the event's colours. */
export function Glow({ look = LOOKS.sunset, opacity = 0.5, y = 0, dark = false }: { look?: Look; opacity?: number; y?: number; dark?: boolean }) {
  const frame = useCurrentFrame();
  // A slow breathe, like the app's glow
  const drift = Math.sin(frame / 40) * 30;
  return (
    <AbsoluteFill
      style={{
        opacity: opacity * (dark ? 1.1 : 1),
        backgroundImage: `radial-gradient(55% 32% at ${28 + drift / 20}% ${30 + y}%, ${look.a} 0%, transparent 72%), radial-gradient(55% 32% at ${74 - drift / 20}% ${44 + y}%, ${look.b} 0%, transparent 72%)`,
        filter: 'saturate(1.05)',
      }}
    />
  );
}

/** The repeating grain texture the app lays over posters. */
export function Grain({ opacity = 0.5, radius }: { opacity?: number; radius?: number }) {
  return (
    <AbsoluteFill style={{ borderRadius: radius, overflow: 'hidden', opacity, mixBlendMode: 'overlay' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${staticFile('img/grain.png')})`, backgroundSize: '540px 540px' }} />
    </AbsoluteFill>
  );
}

/** A tilted pill sticker with a soft drop shadow (components/ui/Sticker). */
export function Sticker({ label, bg = C.white, fg = C.text, tilt = -4, size = 34, style }: {
  label: string; bg?: string; fg?: string; tilt?: number; size?: number; style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', padding: `${size * 0.32}px ${size * 0.62}px`, borderRadius: R.pill,
        background: bg, color: fg, fontFamily: F.body, fontWeight: 600, fontSize: size, lineHeight: 1,
        transform: `rotate(${tilt}deg)`, boxShadow: '0 10px 24px rgba(0,0,0,0.18)', whiteSpace: 'nowrap', ...style,
      }}
    >
      {label}
    </div>
  );
}

/**
 * An event as a gig poster (components/ui/Poster): the look's gradient mixed with grain,
 * a serif accent line, the title in Archivo Expanded, stickers, and a foot with when and where.
 */
export function Poster({ width = 760, height = 960, look = LOOKS.sunset, line, title, foot, stickers = [], titleSize = 92, style }: {
  width?: number; height?: number; look?: Look; line?: string; title: string; foot?: string;
  stickers?: { label: string; bg?: string; fg?: string; tilt?: number; x: number; y: number }[];
  titleSize?: number; style?: CSSProperties;
}) {
  return (
    <div style={{ position: 'relative', width, height, borderRadius: R.xl, overflow: 'hidden', boxShadow: '0 50px 90px rgba(20,10,30,0.28)', ...style }}>
      <AbsoluteFill style={{ background: look.a, backgroundImage: posterGradient(look) }} />
      <Grain opacity={0.55} radius={R.xl} />
      <AbsoluteFill style={{ padding: 54, justifyContent: 'flex-end' }}>
        {line && <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: titleSize * 0.42, color: look.ink, lineHeight: 1, marginBottom: 8 }}>{line}</div>}
        <div style={{ fontFamily: F.poster, fontWeight: 900, fontSize: titleSize, lineHeight: 0.9, letterSpacing: -titleSize * 0.02, color: look.ink, textTransform: 'uppercase' }}>
          {title}
        </div>
        {foot && <div style={{ marginTop: 22, fontFamily: F.body, fontWeight: 600, fontSize: 30, letterSpacing: 0.8, color: look.ink, opacity: 0.9 }}>{foot}</div>}
      </AbsoluteFill>
      {stickers.map((s) => (
        <div key={s.label} style={{ position: 'absolute', left: s.x, top: s.y }}>
          <Sticker label={s.label} bg={s.bg} fg={s.fg} tilt={s.tilt ?? -5} />
        </div>
      ))}
    </div>
  );
}

/** A friend's avatar: their person colour with an initial (components/ui/Avatar), ring for stacks. */
export function Avatar({ name, size = 110, ring = C.bg }: { name: keyof typeof PERSON; size?: number; ring?: string }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size / 2, background: PERSON[name], border: `${Math.max(4, size * 0.06)}px solid ${ring}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.body, fontWeight: 700, fontSize: size * 0.42, color: C.white,
        boxSizing: 'border-box',
      }}
    >
      {name[0]}
    </div>
  );
}

/** The app's black pill button (Button primary): 44pt tall, scaled for the frame. */
export function Pill({ children, dark = true, style }: { children: ReactNode; dark?: boolean; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 16, height: 120, padding: '0 60px', borderRadius: R.pill,
        background: dark ? C.text : C.white, color: dark ? C.white : C.text, fontFamily: F.body, fontWeight: 600, fontSize: 44, ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A small, clearly readable status label for anything that isn't live yet. */
export function StatusTag({ label, dark = false, at = 0 }: { label: string; dark?: boolean; at?: number }) {
  const frame = useCurrentFrame();
  const t = pop(frame, at, 160, 18);
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 14, padding: '16px 28px', borderRadius: R.pill,
        background: dark ? 'rgba(255,255,255,0.14)' : 'rgba(11,11,13,0.06)', border: `2px solid ${dark ? 'rgba(255,255,255,0.35)' : 'rgba(11,11,13,0.18)'}`,
        color: dark ? C.inkText : C.text, fontFamily: F.body, fontWeight: 600, fontSize: 34, opacity: t, transform: `translateY(${(1 - t) * 20}px)`,
      }}
    >
      <span style={{ width: 16, height: 16, borderRadius: 8, background: C.warning }} />
      {label}
    </div>
  );
}

/** Kinetic headline: each word springs up in turn. */
export function Kinetic({ text, at = 0, size = 120, color = C.text, gap = 3, font = F.body, weight = 700, italicWords = [], align = 'center' }: {
  text: string; at?: number; size?: number; color?: string; gap?: number; font?: string; weight?: number; italicWords?: string[]; align?: CSSProperties['textAlign'];
}) {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  return (
    <div style={{ textAlign: align, lineHeight: 0.98, fontFamily: font, fontWeight: weight, fontSize: size, letterSpacing: -size * 0.035, color }}>
      {words.map((w, i) => {
        const t = pop(frame, at + i * gap, 170, 15);
        const italic = italicWords.includes(w);
        return (
          <span key={i} style={{ display: 'inline-block', marginRight: size * 0.22, opacity: Math.min(1, t * 1.4), transform: `translateY(${(1 - t) * size * 0.5}px) scale(${0.9 + 0.1 * t})`, fontFamily: italic ? F.serif : undefined, fontStyle: italic ? 'italic' : undefined, fontWeight: italic ? 400 : undefined }}>
            {w}
          </span>
        );
      })}
    </div>
  );
}
