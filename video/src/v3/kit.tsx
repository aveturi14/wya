import { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { glide, pop } from '../components/motion';
import { F } from '../styles/tokens';

/** The app's dark theme (constants/theme.ts "dark"), in app points. */
export const D = {
  bg: '#0B0B0D',
  surface: '#151518',
  surfaceAlt: '#1F1F23',
  sheet: '#18181C',
  text: '#F5F5F7',
  textSecondary: '#A1A1AA',
  textMuted: '#8A8A93',
  border: '#232327',
  chipStrong: '#33333A',
  lineStrong: '#38383F',
  pink: '#FF2E7A',
  success: '#34C77B',
  warning: '#F5B544',
  danger: '#FF6B6B',
  accent: '#C9A8FF', // the italic serif accent in headings (violet, light enough on black)
};

// Maya's 23rd wears the app's "Violet" look
export const VIOLET = { a: '#7B4DFF', b: '#FF6AD5', ink: '#FFFFFF' };
const posterBg = (l = VIOLET) => `radial-gradient(120% 90% at 15% 10%, ${l.a} 0%, transparent 60%), radial-gradient(110% 100% at 90% 90%, ${l.b} 0%, transparent 62%), linear-gradient(135deg, ${l.a}, ${l.b})`;

export const PEOPLE_FILL: Record<string, string> = { Maya: '#E040A0', Alex: '#7B4DFF', Jamie: '#1FB57A', Sam: '#FF7A3D', Tom: '#C9A227', Priya: '#3BB4F2' };

const tight = (s: number, em = -0.045) => Math.round(s * em * 10) / 10;
export const TD: Record<string, CSSProperties> = {
  title: { fontFamily: F.body, fontWeight: 700, fontSize: 27, lineHeight: '30px', letterSpacing: tight(27), color: D.text },
  heading: { fontFamily: F.body, fontWeight: 700, fontSize: 20, lineHeight: '24px', letterSpacing: tight(20, -0.035), color: D.text },
  cardTitle: { fontFamily: F.body, fontWeight: 700, fontSize: 17, lineHeight: '21px', letterSpacing: tight(17, -0.03), color: D.text },
  value: { fontFamily: F.body, fontWeight: 500, fontSize: 15, lineHeight: '21px', color: D.text },
  body: { fontFamily: F.body, fontWeight: 400, fontSize: 15, lineHeight: '22px', color: D.text },
  caption: { fontFamily: F.body, fontWeight: 400, fontSize: 13, lineHeight: '18px', color: D.textSecondary },
  label: { fontFamily: F.body, fontWeight: 600, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: D.textSecondary },
  money: { fontFamily: F.mono, fontWeight: 500, fontSize: 15, color: D.text },
  accent: { fontFamily: F.serif, fontStyle: 'italic', fontWeight: 400, color: D.text },
};

// ------------------------------------------------------------------ film-level type
/**
 * "Small plans fall apart *in the chat.*": bold sans plus an italic serif accent.
 * It moves around the frame to keep the eye travelling: `top` and `align` place it, `enter` picks
 * how it arrives (word by word, sliding in from a side, or zooming), and `hold` starts it large in
 * the centre of the frame for that many frames before it settles into place as the UI comes in.
 */
export function Heading({ main, accent, at = 0, top = 230, size = 92, accentFirst = false, align = 'left', enter = 'words', hold = 0 }: {
  main: string; accent: string; at?: number; top?: number; size?: number; accentFirst?: boolean;
  align?: 'left' | 'right' | 'center'; enter?: 'words' | 'left' | 'right' | 'zoom'; hold?: number;
}) {
  const f = useCurrentFrame();
  const words: { w: string; accent: boolean }[] = [];
  const push = (s: string, accent: boolean) => s.split(' ').filter(Boolean).forEach((w) => words.push({ w, accent }));
  if (accentFirst) { push(accent, true); push(main, false); } else { push(main, false); push(accent, true); }

  // Hold in the centre (larger), then glide to the resting place
  const settle = hold ? interpolate(f, [at + hold, at + hold + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.65, 0, 0.35, 1) }) : 1;
  const centreTop = 960 - size * 1.15;
  const y = hold ? centreTop + (top - centreTop) * settle : top;
  const scale = hold ? 1.18 - 0.18 * settle : 1;

  const block = pop(f, at, 170, 15);
  const shift = enter === 'left' ? `translateX(${(1 - block) * -160}px)` : enter === 'right' ? `translateX(${(1 - block) * 160}px)` : enter === 'zoom' ? `scale(${1.25 - 0.25 * block})` : '';
  const origin = hold || align === 'center' ? 'center top' : align === 'right' ? 'right top' : 'left top';
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: y, textAlign: align, fontFamily: F.body, fontWeight: 700, fontSize: size, lineHeight: 1.04, letterSpacing: -size * 0.045, color: D.text, transform: `scale(${scale}) ${enter === 'words' ? '' : shift}`, transformOrigin: origin, opacity: enter === 'words' ? 1 : Math.min(1, block * 1.4), zIndex: 20 }}>
      {words.map(({ w, accent: isAccent }, i) => {
        const t = enter === 'words' ? pop(f, at + i * 3, 200, 15) : 1;
        return (
          <span key={i} style={{ display: 'inline-block', marginRight: size * 0.24, opacity: Math.min(1, t * 1.5), transform: `translateY(${(1 - t) * size * 0.5}px)`, ...(isAccent ? { fontFamily: F.serif, fontStyle: 'italic', fontWeight: 400, color: D.accent, letterSpacing: -1 } : {}) }}>{w}</span>
        );
      })}
    </div>
  );
}

/** The subtitle pill at the bottom, one line at a time (kept above Instagram's caption area). */
export function Caption({ lines }: { lines: { t: string; at: number }[] }) {
  const f = useCurrentFrame();
  const cur = [...lines].reverse().find((l) => f >= l.at);
  if (!cur) return null;
  const t = glide(f, cur.at, 8);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 410 }}>
      <div key={cur.t} style={{ maxWidth: 940, padding: '18px 30px', borderRadius: 22, background: 'rgba(245,245,247,0.94)', color: D.bg, fontFamily: F.body, fontWeight: 600, fontSize: 38, lineHeight: 1.25, textAlign: 'center', opacity: t, transform: `translateY(${(1 - t) * 16}px)` }}>
        {cur.t}
      </div>
    </AbsoluteFill>
  );
}

/** The dark page with two soft pools of the event's colours. */
export function Page({ children, glow = 0.32 }: { children: ReactNode; glow?: number }) {
  const f = useCurrentFrame();
  const d = Math.sin(f / 40) * 3;
  return (
    <AbsoluteFill style={{ background: D.bg }}>
      <AbsoluteFill style={{ opacity: glow, backgroundImage: `radial-gradient(60% 30% at ${18 + d}% 12%, ${VIOLET.a} 0%, transparent 70%), radial-gradient(55% 30% at ${86 - d}% 88%, ${VIOLET.b} 0%, transparent 70%)` }} />
      {children}
    </AbsoluteFill>
  );
}

/** App UI drawn in app points and scaled up for the frame. */
export function Scaled({ s = 2.5, children, style }: { s?: number; children: ReactNode; style?: CSSProperties }) {
  return <div style={{ transform: `scale(${s})`, transformOrigin: 'top left', ...style }}>{children}</div>;
}

/** Springs a block in (scale and lift), for cards appearing on the beat. */
export function In({ at, children, style, from = 40 }: { at: number; children: ReactNode; style?: CSSProperties; from?: number }) {
  const f = useCurrentFrame();
  if (f < at - 1) return null;
  const t = pop(f, at, 190, 15);
  return <div style={{ opacity: Math.min(1, t * 1.6), transform: `translateY(${(1 - t) * from}px) scale(${0.94 + 0.06 * t})`, ...style }}>{children}</div>;
}

// ------------------------------------------------------------------ app components, dark
export function Card({ children, style, alt }: { children: ReactNode; style?: CSSProperties; alt?: boolean }) {
  return <div style={{ background: alt ? D.surfaceAlt : D.surface, borderRadius: 18, border: `1px solid ${D.border}`, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.45)', ...style }}>{children}</div>;
}

export function Btn({ title, variant = 'primary', icon, style, pressed = 0, size = 'md' }: { title: ReactNode; variant?: 'primary' | 'soft' | 'success'; icon?: ReactNode; style?: CSSProperties; pressed?: number; size?: 'sm' | 'md' }) {
  const p = variant === 'primary' ? { bg: D.text, fg: D.bg } : variant === 'success' ? { bg: D.success, fg: D.bg } : { bg: D.surfaceAlt, fg: D.text };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: size === 'sm' ? 32 : 44, padding: `0 ${size === 'sm' ? 13 : 18}px`, borderRadius: 999, background: p.bg, color: p.fg, fontFamily: F.body, fontWeight: 600, fontSize: size === 'sm' ? 13 : 15, whiteSpace: 'nowrap', transform: `scale(${1 - pressed * 0.05})`, boxSizing: 'border-box', ...style }}>
      {icon}{title}
    </div>
  );
}

export function Chip({ label, on, style }: { label: ReactNode; on?: boolean; style?: CSSProperties }) {
  return <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 30, padding: '0 12px', borderRadius: 999, background: on ? D.text : D.surfaceAlt, color: on ? D.bg : D.text, fontFamily: F.body, fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap', boxSizing: 'border-box', ...style }}>{label}</div>;
}

export function DotChip({ label, dot, style }: { label: string; dot: string; style?: CSSProperties }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: D.surfaceAlt, fontFamily: F.body, fontWeight: 500, fontSize: 11.5, color: D.text, whiteSpace: 'nowrap', ...style }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: dot }} />{label}
    </div>
  );
}

export function Av({ name, size = 28, ring = D.surface }: { name: string; size?: number; ring?: string }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: PEOPLE_FILL[name] ?? '#5B6B7A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.body, fontWeight: 600, fontSize: size * 0.42, border: `2px solid ${ring}`, boxSizing: 'border-box', flexShrink: 0 }}>{name[0]}</div>
  );
}

export function Faces({ names, size = 22 }: { names: readonly string[]; size?: number }) {
  return <div style={{ display: 'flex' }}>{names.map((n, i) => <div key={n} style={{ marginLeft: i ? -size * 0.35 : 0 }}><Av name={n} size={size} /></div>)}</div>;
}

/** components/ui/Poster in the Violet look: serif line, Archivo title, foot, stickers. */
export function Poster({ w, h, title = "Maya's 23rd", line = 'dinner for four', foot = 'SAT 14 NOV · 7PM', footRight = 'GOLDEN LANTERN', titleSize = 34, stickers = [], look = VIOLET, radius = 22, style }: {
  w: number; h: number; title?: string; line?: string; foot?: string; footRight?: string; titleSize?: number; stickers?: string[]; look?: typeof VIOLET; radius?: number; style?: CSSProperties;
}) {
  return (
    <div style={{ position: 'relative', width: w, height: h, borderRadius: radius, overflow: 'hidden', boxShadow: '0 24px 60px rgba(123,77,255,0.35)', ...style }}>
      <AbsoluteFill style={{ background: look.a, backgroundImage: posterBg(look) }} />
      <AbsoluteFill style={{ backgroundImage: `url(${staticFile('img/grain.png')})`, backgroundSize: '160px 160px', opacity: 0.45, mixBlendMode: 'overlay' }} />
      <div style={{ position: 'absolute', right: 10, top: 12, display: 'flex', gap: 6 }}>
        {stickers.map((s, i) => <div key={s} style={{ padding: '4px 10px', borderRadius: 999, background: i === stickers.length - 1 && s.startsWith('✓') ? D.success : '#fff', color: D.bg, fontFamily: F.body, fontWeight: 600, fontSize: 12, transform: `rotate(${i % 2 ? 3 : -3}deg)`, boxShadow: '0 6px 14px rgba(0,0,0,0.25)' }}>{s}</div>)}
      </div>
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 14, color: look.ink }}>
        {line && <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: titleSize * 0.52, lineHeight: 1.1 }}>{line}</div>}
        <div style={{ fontFamily: F.poster, fontWeight: 900, fontSize: titleSize, lineHeight: 0.92, letterSpacing: -titleSize * 0.04, textTransform: 'uppercase' }}>{title}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: F.body, fontWeight: 600, fontSize: 10.5, letterSpacing: 0.3 }}><span>{foot}</span><span>{footRight}</span></div>
      </div>
    </div>
  );
}

export const I = {
  check: (c = '#fff', s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  lock: (c = D.bg) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  pin: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={D.text} strokeWidth="2"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.3" /></svg>,
  apple: <svg width="14" height="16" viewBox="0 0 24 28" fill={D.text}><path d="M19.5 14.8c0-3 2.5-4.5 2.6-4.6-1.4-2.1-3.6-2.4-4.4-2.4-1.9-.2-3.6 1.1-4.6 1.1-1 0-2.4-1.1-4-1-2 0-3.9 1.2-5 3-2.1 3.7-.5 9.2 1.5 12.2 1 1.5 2.2 3.1 3.8 3 1.5-.1 2.1-1 3.9-1 1.8 0 2.4 1 4 1 1.6 0 2.7-1.5 3.700-3 1.2-1.700 1.6-3.400 1.700-3.500-.1 0-3.200-1.200-3.200-4.800zM16.500 5.800c.8-1 1.400-2.400 1.200-3.800-1.200.1-2.700.8-3.500 1.800-.8.9-1.500 2.300-1.300 3.700 1.400.1 2.800-.7 3.600-1.700z" /></svg>,
};

/** The dark phone for the Home beat. */
export function Phone({ width = 640, children }: { width?: number; children: ReactNode }) {
  const s = width / 375;
  return (
    <div style={{ width: width + 28, height: 812 * s + 28, borderRadius: 58 * s + 14, background: '#1A1A1E', padding: 14, boxSizing: 'border-box', boxShadow: '0 60px 120px rgba(0,0,0,0.6), 0 0 0 2px #2E2E34 inset' }}>
      <div style={{ position: 'relative', width, height: 812 * s, borderRadius: 58 * s, overflow: 'hidden', background: D.bg }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 375, height: 812, transform: `scale(${s})`, transformOrigin: 'top left' }}>
          {children}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 50, display: 'flex', justifyContent: 'space-between', padding: '15px 30px 0 34px', boxSizing: 'border-box', fontFamily: F.body, fontWeight: 600, fontSize: 16, color: D.text }}>
            <span>9:41</span>
            <div style={{ position: 'absolute', left: 126, top: 11, width: 122, height: 35, borderRadius: 18, background: '#000' }} />
            <span style={{ fontSize: 13 }}>●●● ▮</span>
          </div>
          <div style={{ position: 'absolute', bottom: 8, left: 120, width: 134, height: 5, borderRadius: 3, background: D.text, opacity: 0.8 }} />
        </div>
      </div>
    </div>
  );
}

/** A tap ring at a point (in the coordinates of whatever contains it). */
export function Tap({ x, y, at, size = 44 }: { x: number; y: number; at: number; size?: number }) {
  const f = useCurrentFrame();
  const d = f - at;
  if (d < -4 || d > 14) return null;
  const t = Math.max(0, d) / 14;
  return <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2, background: `rgba(255,255,255,${0.22 * (1 - t)})`, border: `2px solid rgba(255,255,255,${0.9 * (1 - t)})`, transform: `scale(${1 + t * 0.8})`, zIndex: 50 }} />;
}

/** Confetti burst from a point (app points). */
export function Burst({ at, x, y }: { at: number; x: number; y: number }) {
  const f = useCurrentFrame() - at;
  if (f < 0 || f > 45) return null;
  const cols = [VIOLET.a, VIOLET.b, D.success, D.warning, '#3BB4F2'];
  return (
    <>
      {Array.from({ length: 24 }, (_, i) => {
        const ang = (i / 24) * Math.PI * 2;
        const v = 90 + (i % 4) * 30;
        return <div key={i} style={{ position: 'absolute', left: x + Math.cos(ang) * v * (f / 26), top: y + Math.sin(ang) * v * (f / 26) + 0.1 * f * f, width: 7, height: 11, borderRadius: 2, background: cols[i % 5], transform: `rotate(${i * 37 + f * 14}deg)`, opacity: 1 - f / 45 }} />;
      })}
    </>
  );
}
