/**
 * Design tokens for the film, copied from the app so the film looks like Where You At:
 *   constants/theme.ts       light/dark colours, the sticker pink, fonts, radii
 *   constants/eventThemes.ts poster looks (two colours mixed with grain)
 *   constants/wallet.ts      the wallet card ("ink" in both themes)
 * Keep them in step with the app; don't invent new colours here.
 */

export const C = {
  // Light theme (constants/theme.ts)
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F0F2',
  text: '#0B0B0D',
  textSecondary: '#55555D',
  textMuted: '#6A6A72',
  border: '#ECECEE',
  // Dark theme
  inkBg: '#0B0B0D',
  inkSurface: '#151518',
  inkSurfaceAlt: '#1F1F23',
  inkText: '#F5F5F7',
  inkTextSecondary: '#A1A1AA',
  // Shared accents
  pink: '#FF2E7A', // the sticker pink: the wya. dot, badges
  success: '#34C77B',
  successText: '#1F7A4C',
  warning: '#F5B544',
  warningText: '#8F5D00',
  white: '#FFFFFF',
} as const;

// Event looks (constants/eventThemes.ts): a = top-left colour, b = bottom-right, ink = poster text
export const LOOKS = {
  sunset: { a: '#FF7A3D', b: '#FF2E7A', ink: '#16161A' },
  ocean: { a: '#2E6BFF', b: '#5BE1E6', ink: '#FFFFFF' },
  lime: { a: '#C6F432', b: '#1FB57A', ink: '#101012' },
  peach: { a: '#FFC46B', b: '#FF8A65', ink: '#1A1410' },
  tomato: { a: '#FF5A4E', b: '#FFB347', ink: '#1A0F0D' },
} as const;
export type Look = (typeof LOOKS)[keyof typeof LOOKS];

/** The app's poster gradient (eventThemes.posterGradient). */
export const posterGradient = (l: Look) =>
  `radial-gradient(120% 90% at 15% 10%, ${l.a} 0%, transparent 60%), radial-gradient(110% 100% at 90% 90%, ${l.b} 0%, transparent 62%), linear-gradient(135deg, ${l.a}, ${l.b})`;

// The wallet card (constants/wallet.ts): the same ink in both themes
export const WALLET_GRADIENT =
  'radial-gradient(90% 120% at 100% 0%, rgba(122,80,255,0.55) 0%, transparent 60%), radial-gradient(80% 100% at 0% 100%, rgba(255,46,122,0.35) 0%, transparent 60%), linear-gradient(135deg, #17171C, #0B0B0D)';

// Font families registered in fonts.ts (the app's own: Geist, Geist Mono, Instrument Serif, Archivo Expanded)
export const F = {
  body: 'Geist',
  mono: 'Geist Mono',
  serif: 'Instrument Serif',
  poster: 'Archivo Expanded',
} as const;

// constants/theme.ts Radius, scaled ×3 for a 1080px-wide frame (the app's points are ~360 wide)
export const R = { sm: 30, md: 36, lg: 54, xl: 66, pill: 999 } as const;

// Person colours (constants/theme.ts PERSON_FILLS), one per friend so they stay recognisable
export const PERSON = {
  Alex: '#2E6BFF',
  Maya: '#1FB57A',
  Jamie: '#FF8A65',
  Sam: '#C9A227',
} as const;

/**
 * Instagram Reels covers roughly the top 220px (header) and bottom 380px (caption,
 * buttons) of a 1920px frame. Important text stays between these.
 */
export const SAFE = { top: 250, bottom: 1920 - 400, side: 80 } as const;
