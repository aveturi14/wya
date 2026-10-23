import { CSSProperties } from 'react';
import { F } from '../styles/tokens';

/**
 * The app's light theme, in the app's own units (points on a 375-wide phone), copied
 * from constants/theme.ts so the screens in the film are the real UI. Screens render at
 * 375×812 inside <Phone> and are scaled up as a whole, so these numbers stay 1:1 with
 * the app's StyleSheets.
 */
export const A = {
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F0F2',
  sheet: '#FFFFFF',
  text: '#0B0B0D',
  textSecondary: '#55555D',
  textMuted: '#6A6A72',
  border: '#ECECEE',
  chipStrong: '#D9D9DE',
  lineStrong: '#C9C9CF',
  pink: '#FF2E7A',
  success: '#34C77B',
  successText: '#1F7A4C',
  warning: '#F5B544',
  overlay: 'rgba(11,11,13,0.35)',
};

// Radius and Space (constants/theme.ts)
export const AR = { sm: 10, md: 12, lg: 18, xl: 22, pill: 999 };
export const AS = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

const tight = (size: number, em = -0.045) => Math.round(size * em * 10) / 10;

// theme.type (light), as CSS
export const T: Record<string, CSSProperties> = {
  hero: { fontFamily: F.body, fontWeight: 700, fontSize: 44, lineHeight: '46px', letterSpacing: tight(44), color: A.text },
  display: { fontFamily: F.body, fontWeight: 700, fontSize: 34, lineHeight: '37px', letterSpacing: tight(34), color: A.text },
  title: { fontFamily: F.body, fontWeight: 700, fontSize: 27, lineHeight: '30px', letterSpacing: tight(27), color: A.text },
  heading: { fontFamily: F.body, fontWeight: 700, fontSize: 20, lineHeight: '24px', letterSpacing: tight(20, -0.035), color: A.text },
  cardTitle: { fontFamily: F.body, fontWeight: 700, fontSize: 17, lineHeight: '21px', letterSpacing: tight(17, -0.03), color: A.text },
  stat: { fontFamily: F.mono, fontWeight: 500, fontSize: 28, lineHeight: '32px', letterSpacing: -0.6, color: A.text },
  body: { fontFamily: F.body, fontWeight: 400, fontSize: 15, lineHeight: '22px', color: A.text },
  bodySecondary: { fontFamily: F.body, fontWeight: 400, fontSize: 15, lineHeight: '22px', color: A.textSecondary },
  value: { fontFamily: F.body, fontWeight: 500, fontSize: 15, lineHeight: '21px', color: A.text },
  sectionHeading: { fontFamily: F.body, fontWeight: 600, fontSize: 16, lineHeight: '20px', letterSpacing: -0.3, color: A.text },
  label: { fontFamily: F.body, fontWeight: 600, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: A.textSecondary },
  caption: { fontFamily: F.body, fontWeight: 400, fontSize: 13, lineHeight: '18px', color: A.textSecondary },
  micro: { fontFamily: F.body, fontWeight: 500, fontSize: 12, lineHeight: '15px', color: A.textSecondary },
  button: { fontFamily: F.body, fontWeight: 600, fontSize: 15 },
  accent: { fontFamily: F.serif, fontStyle: 'italic', fontWeight: 400, fontSize: 22, lineHeight: '26px', color: A.text },
  money: { fontFamily: F.mono, fontWeight: 500, fontSize: 15, lineHeight: '20px', color: A.text },
  poster: { fontFamily: F.poster, fontWeight: 900, fontSize: 40, lineHeight: '36px', letterSpacing: tight(40, -0.04), textTransform: 'uppercase' },
};

/** theme.shadow(n), light theme */
export const shadow = (n: number) => `0px 1px 2px rgba(0, 0, 0, 0.04), 0px ${4 + n}px ${16 + n * 3}px -10px rgba(0, 0, 0, ${0.1 + n * 0.01})`;
