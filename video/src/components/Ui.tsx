import { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, F, R } from '../styles/tokens';
import { glide, pop } from './motion';

/**
 * Wraps a scene: a quick scale-and-fade in over the scene before it (scenes overlap by a
 * few frames), so cuts feel like one continuous film. Scenes don't fade out: fading to the
 * film's dark base made light-to-light cuts dip to grey. `length` is kept for callers.
 */
export function SceneShell({ children, length, bg, enter = 'scale' }: { children: ReactNode; length: number; bg: string; enter?: 'scale' | 'up' | 'none' }) {
  const frame = useCurrentFrame();
  const t = enter === 'none' ? 1 : glide(frame, 0, 10);
  const scale = enter === 'scale' ? 1.04 - 0.04 * t : 1;
  const y = enter === 'up' ? (1 - t) * 80 : 0;
  return (
    <AbsoluteFill style={{ background: bg, opacity: Math.min(t * 1.5, 1), transform: `translateY(${y}px) scale(${scale})` }}>
      {children}
    </AbsoluteFill>
  );
}

/** A card or sheet surface (components/ui/Card): white on light, raised charcoal on dark. */
export function Panel({ children, dark = false, style }: { children: ReactNode; dark?: boolean; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: dark ? C.inkSurface : C.surface, borderRadius: R.lg, padding: 48,
        boxShadow: dark ? '0 30px 80px rgba(0,0,0,0.5)' : '0 30px 80px rgba(20,10,30,0.12), 0 2px 6px rgba(20,10,30,0.06)',
        border: dark ? `2px solid ${C.inkSurfaceAlt}` : 'none', color: dark ? C.inkText : C.text, fontFamily: F.body, ...style,
      }}
    >
      {children}
    </div>
  );
}

/** The app's status chip: a small pill with a dot (Going, Owes, Paid…). */
export function Chip({ label, tone, dark = false, style }: { label: string; tone: 'success' | 'warning' | 'neutral' | 'pink' | 'ink'; dark?: boolean; style?: CSSProperties }) {
  const tones = {
    success: { bg: dark ? 'rgba(52,199,123,0.16)' : '#E6F7EE', fg: dark ? C.success : C.successText, dot: C.success },
    warning: { bg: dark ? 'rgba(245,181,68,0.16)' : '#FFF3DF', fg: dark ? C.warning : C.warningText, dot: C.warning },
    neutral: { bg: dark ? C.inkSurfaceAlt : C.surfaceAlt, fg: dark ? C.inkTextSecondary : C.textSecondary, dot: dark ? C.inkTextSecondary : C.textMuted },
    pink: { bg: '#FFE3EE', fg: '#B0124F', dot: C.pink },
    ink: { bg: C.text, fg: C.white, dot: C.white },
  }[tone];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '12px 24px', borderRadius: R.pill, background: tones.bg, color: tones.fg, fontFamily: F.body, fontWeight: 600, fontSize: 32, whiteSpace: 'nowrap', ...style }}>
      <span style={{ width: 14, height: 14, borderRadius: 7, background: tones.dot }} />
      {label}
    </div>
  );
}

export function Check({ size = 44, color = C.white, bg = C.success }: { size?: number; color?: string; bg?: string }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </div>
  );
}

export function Lock({ size = 36, color = C.white }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function LinkIcon({ size = 40, color = C.text }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </svg>
  );
}

/** A big tap ripple at a point, for "the user tapped this". */
export function Tap({ x, y, at }: { x: number; y: number; at: number }) {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + 18) return null;
  const t = interpolate(frame, [at, at + 18], [0, 1]);
  return (
    <div style={{ position: 'absolute', left: x - 70, top: y - 70, width: 140, height: 140, borderRadius: 70, border: `6px solid rgba(11,11,13,${0.5 * (1 - t)})`, transform: `scale(${0.4 + t})`, pointerEvents: 'none' }} />
  );
}

/** A label that springs in (used for scene callouts). */
export function Callout({ children, at, style }: { children: ReactNode; at: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const t = pop(frame, at, 170, 16);
  return <div style={{ opacity: Math.min(1, t * 1.3), transform: `translateY(${(1 - t) * 40}px) scale(${0.94 + 0.06 * t})`, ...style }}>{children}</div>;
}
