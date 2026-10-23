import { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, staticFile } from 'remotion';
import { F, LOOKS, Look, PERSON, posterGradient } from '../styles/tokens';
import { A, AR, AS, T, shadow } from './app';

export const PW = 375; // phone width in app points
export const PH = 812;

/**
 * An iPhone with the app inside. Children are laid out in app points (375×812) and the
 * whole screen is scaled, so the UI keeps the app's exact proportions.
 */
export function Phone({ width = 640, children, style, glare = true }: { width?: number; children: ReactNode; style?: CSSProperties; glare?: boolean }) {
  const s = width / PW;
  const bezel = 14;
  return (
    <div style={{ position: 'relative', width: width + bezel * 2, height: PH * s + bezel * 2, borderRadius: 58 * s + bezel, background: '#0B0B0D', padding: bezel, boxSizing: 'border-box', boxShadow: '0 60px 120px rgba(30,10,40,0.28), 0 0 0 2px #2A2A2F inset', ...style }}>
      <div style={{ position: 'relative', width, height: PH * s, borderRadius: 58 * s, overflow: 'hidden', background: A.bg }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: PW, height: PH, transform: `scale(${s})`, transformOrigin: 'top left' }}>
          {children}
          <StatusBar />
          {/* Home indicator */}
          <div style={{ position: 'absolute', bottom: 8, left: (PW - 134) / 2, width: 134, height: 5, borderRadius: 3, background: A.text, opacity: 0.85 }} />
        </div>
        {glare && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(115deg, rgba(255,255,255,0.10) 0%, transparent 35%)' }} />}
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 30px 0 34px', boxSizing: 'border-box', fontFamily: F.body, fontWeight: 600, fontSize: 16, color: A.text, zIndex: 50 }}>
      <span>9:41</span>
      <div style={{ position: 'absolute', left: (PW - 122) / 2, top: 11, width: 122, height: 35, borderRadius: 18, background: '#000' }} />
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" fill={A.text} /><rect x="5" y="5" width="3" height="6" rx="1" fill={A.text} /><rect x="10" y="2.5" width="3" height="8.5" rx="1" fill={A.text} /><rect x="15" y="0" width="3" height="11" rx="1" fill={A.text} /></svg>
        <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke={A.text} opacity="0.4" fill="none" /><rect x="2" y="2" width="16" height="8" rx="2" fill={A.text} /><rect x="23" y="4" width="1.5" height="4" rx="0.7" fill={A.text} opacity="0.5" /></svg>
      </span>
    </div>
  );
}

/** components/ui/Button: 44pt pill. primary is the text colour; soft a grey chip; `color` for the event's colour. */
export function Btn({ title, variant = 'primary', size = 'md', icon, color, style, pressed = 0 }: {
  title: ReactNode; variant?: 'primary' | 'soft' | 'line'; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode; color?: { bg: string; fg: string }; style?: CSSProperties; pressed?: number;
}) {
  const p = color ?? (variant === 'primary' ? { bg: A.text, fg: A.surface } : variant === 'soft' ? { bg: A.surfaceAlt, fg: A.text } : { bg: 'transparent', fg: A.text });
  const h = size === 'sm' ? 32 : size === 'lg' ? 52 : 44;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: h, padding: `0 ${size === 'sm' ? 13 : size === 'lg' ? 22 : 18}px`, borderRadius: AR.pill, background: p.bg, color: p.fg, border: variant === 'line' ? `1px solid ${A.lineStrong}` : 'none', ...T.button, fontSize: size === 'sm' ? 13 : 15, transform: `scale(${1 - pressed * 0.04})`, boxSizing: 'border-box', ...style }}>
      {icon}{title}
    </div>
  );
}

/** components/ui/Card: white, radius 18, soft shadow, no outline. */
export function Card({ children, style, alt }: { children: ReactNode; style?: CSSProperties; alt?: boolean }) {
  return <div style={{ background: alt ? A.surfaceAlt : A.surface, borderRadius: AR.lg, boxShadow: alt ? 'none' : shadow(4), overflow: 'hidden', ...style }}>{children}</div>;
}

/** components/ui/Chip: grey pill, ink when on. */
export function Chip({ label, on, style }: { label: string; on?: boolean; style?: CSSProperties }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', minHeight: 34, padding: '0 13px', borderRadius: AR.pill, background: on ? A.text : A.surfaceAlt, color: on ? A.surface : A.text, fontFamily: F.body, fontWeight: 600, fontSize: 13, boxSizing: 'border-box', ...style }}>
      {label}
    </div>
  );
}

/** The small status chip with a dot used in dues and bills ("To pay", "Paid"). */
export function DotChip({ label, dot, style }: { label: string; dot: string; style?: CSSProperties }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: AR.pill, background: A.surfaceAlt, fontFamily: F.body, fontWeight: 500, fontSize: 12, color: A.text, ...style }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: dot }} />{label}
    </div>
  );
}

/** components/ui/Avatar: the person's colour with their initial. */
export function Av({ name, size = 36, ring }: { name: keyof typeof PERSON; size?: number; ring?: string }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: PERSON[name], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.body, fontWeight: 600, fontSize: size * 0.4, border: ring ? `2px solid ${ring}` : 'none', boxSizing: 'border-box', flexShrink: 0 }}>
      {name[0]}
    </div>
  );
}

/** components/ui/Poster: gradient and grain, serif line, Archivo title, foot, stickers. */
export function AppPoster({ look = LOOKS.sunset, line, title, foot, footRight, sticker, height = 220, titleSize = 40, radius = AR.xl, ink, pill }: {
  look?: Look; line?: string; title: string; foot?: string; footRight?: string; sticker?: string; height?: number; titleSize?: number; radius?: number; ink?: string; pill?: string;
}) {
  const c = ink ?? '#FFFFFF';
  return (
    <div style={{ position: 'relative', height, borderRadius: radius, overflow: 'hidden', boxShadow: shadow(10) }}>
      <AbsoluteFill style={{ background: look.a, backgroundImage: posterGradient(look) }} />
      <AbsoluteFill style={{ backgroundImage: `url(${staticFile('img/grain.png')})`, backgroundSize: '180px 180px', opacity: 0.45, mixBlendMode: 'overlay' }} />
      {pill && (
        <div style={{ position: 'absolute', left: 16, top: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: AR.pill, background: 'rgba(255,255,255,0.25)', fontFamily: F.body, fontWeight: 600, fontSize: 13, color: c }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>{pill}
        </div>
      )}
      {sticker && (
        <div style={{ position: 'absolute', right: 14, top: 16, padding: '6px 12px', borderRadius: AR.pill, background: A.text, color: '#fff', fontFamily: F.body, fontWeight: 600, fontSize: 14, transform: 'rotate(-3deg)', boxShadow: '0 6px 14px rgba(0,0,0,0.2)' }}>{sticker}</div>
      )}
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
        {line && <div style={{ ...T.accent, color: c, fontSize: titleSize * 0.52, lineHeight: 1.1 }}>{line}</div>}
        <div style={{ ...T.poster, color: c, fontSize: titleSize, lineHeight: `${Math.round(titleSize * 0.9)}px` }}>{title}</div>
        {(foot || footRight) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontFamily: F.body, fontWeight: 600, fontSize: 12, letterSpacing: 0.3, color: c }}>
            <span>{foot}</span><span>{footRight}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** The app's segmented tabs: a grey track with a white active pill. */
export function Tabs({ items, active, style }: { items: string[]; active: number; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', padding: 4, borderRadius: AR.pill, background: A.surfaceAlt, ...style }}>
      {items.map((t, i) => (
        <div key={t} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: AR.pill, background: i === active ? A.surface : 'transparent', boxShadow: i === active ? shadow(1) : 'none', fontFamily: F.body, fontWeight: 600, fontSize: 15, color: i === active ? A.text : A.textSecondary }}>{t}</div>
      ))}
    </div>
  );
}

/** The floating bottom bar: Events · Chats · + · Photos · You. */
export function TabBar({ active = 0 }: { active?: number }) {
  const items = ['Events', 'Chats', '+', 'Photos', 'You'];
  return (
    <div style={{ position: 'absolute', left: 16, right: 16, bottom: 26, height: 68, borderRadius: AR.pill, background: 'rgba(255,255,255,0.96)', boxShadow: shadow(8), display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 40 }}>
      {items.map((t, i) =>
        t === '+' ? (
          <div key={t} style={{ width: 48, height: 48, borderRadius: 24, background: A.text, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 300, fontFamily: F.body }}>+</div>
        ) : (
          <div key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontFamily: F.body, fontWeight: 600, fontSize: 11, color: i === active ? A.text : A.textMuted }}>
            <TabIcon name={t} on={i === active} />
            {t}
          </div>
        ),
      )}
    </div>
  );
}

/** Ionicons-style tab icons: filled when active, outlined otherwise. */
function TabIcon({ name, on }: { name: string; on: boolean }) {
  const c = on ? A.text : A.textMuted;
  const fill = on ? A.text : 'none';
  const p = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.8, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  if (name === 'Events') return <svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="3" fill={fill} /><path d="M3.5 10h17" stroke={on ? '#fff' : c} /><path d="M8 3v4M16 3v4" /></svg>;
  if (name === 'Chats') return <svg {...p}><path d="M4 12a8 7 0 1 1 3.5 5.8L4 19l.9-3.4A6.7 6.7 0 0 1 4 12z" fill={fill} /></svg>;
  if (name === 'Photos') return <svg {...p}><rect x="3.5" y="5" width="17" height="14" rx="3" fill={fill} /><circle cx="9" cy="10" r="1.8" stroke={on ? '#fff' : c} /><path d="M20 16l-5-4.5-8 7.5" stroke={on ? '#fff' : c} /></svg>;
  return <svg {...p}><circle cx="12" cy="8.5" r="3.8" fill={fill} /><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" fill={fill} /></svg>;
}

/** components/ui/Sheet: rises from the bottom, grab handle, scrim behind. */
export function Sheet({ t, children, height }: { t: number; children: ReactNode; height: number }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: A.overlay, opacity: t, zIndex: 60 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, transform: `translateY(${(1 - t) * (height + 40)}px)`, background: A.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: `10px ${AS.lg}px 30px`, boxSizing: 'border-box', zIndex: 61, boxShadow: '0 -10px 40px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 38, height: 5, borderRadius: 3, background: A.chipStrong, margin: '0 auto 14px' }} />
        {children}
      </div>
    </>
  );
}

/** A round icon button (back, share): grey glass circle. */
export function RoundBtn({ children }: { children: ReactNode }) {
  return <div style={{ width: 44, height: 44, borderRadius: 22, background: 'rgba(240,240,242,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>;
}

export const Icon = {
  back: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={A.text} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>,
  share: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={A.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>,
  people: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={A.text} strokeWidth="1.8"><circle cx="9" cy="8" r="3.2" /><circle cx="16.5" cy="9" r="2.6" /><path d="M3 19c.8-3.2 3.2-5 6-5s5.2 1.8 6 5M14.5 14.5c2.7-.4 5 1.2 6 4.5" strokeLinecap="round" /></svg>,
  megaphone: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={A.text} strokeWidth="1.8" strokeLinejoin="round"><path d="M4 10v4h3l6 4V6L7 10H4z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" strokeLinecap="round" /></svg>,
  flag: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={A.text} strokeWidth="1.8" strokeLinejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>,
  edit: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={A.text} strokeWidth="1.8" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z" /></svg>,
  image: (c = '#fff') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" /></svg>,
  lock: (c = '#fff') => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  check: (c = '#fff', s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  wallet: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={A.text} strokeWidth="1.8"><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12.5h2" strokeLinecap="round" /><path d="M5 6l10-3 1 3" /></svg>,
  link: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={A.text} strokeWidth="2.2" strokeLinecap="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>,
  chevron: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={A.textSecondary} strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>,
};

/** A tap: a finger-press ring at a point inside the phone (app points). */
export function TapDot({ x, y, frame, at }: { x: number; y: number; frame: number; at: number }) {
  const d = frame - at;
  if (d < -6 || d > 16) return null;
  const t = Math.max(0, d) / 16;
  return (
    <div style={{ position: 'absolute', left: x - 22, top: y - 22, width: 44, height: 44, borderRadius: 22, background: `rgba(11,11,13,${d < 0 ? 0.18 : 0.18 * (1 - t)})`, border: `2px solid rgba(255,255,255,${0.9 * (1 - t)})`, transform: `scale(${d < 0 ? 0.8 : 1 + t * 0.8})`, zIndex: 100, pointerEvents: 'none' }} />
  );
}
