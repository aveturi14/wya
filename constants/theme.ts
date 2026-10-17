import { Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * wya design system ("Glow", Phase 8 redesign).
 *
 * Two themes share every role name, shape, size and font; only colours differ:
 *   light — soft pastel mesh, indigo-violet and tangerine, ink text
 *   dark  — near-black mesh, electric lime and hot pink, white text
 * Frosted cards with hairline edges and soft shadows (the old 2px ink outlines
 * and hard offset shadows are gone), gradient headlines, a gradient backdrop
 * behind every page.
 *
 * Screens read roles (theme.colors.primary) and helpers (theme.glass,
 * theme.gradient), never raw hex values.
 */

export type ThemeName = 'light' | 'dark';

export type Colors = {
  background: string; // page
  surface: string; // cards, inputs
  surfaceAlt: string; // raised or secondary blocks, chips
  text: string;
  textSecondary: string;
  textMuted: string; // placeholders, captions
  border: string; // hairlines and dividers
  outline: string; // the bold edge around cards and buttons
  primary: string; // main action
  onPrimary: string;
  secondary: string; // second accent
  onSecondary: string;
  highlight: string; // stickers and badges
  onHighlight: string;
  success: string; // Going
  warning: string; // Maybe
  danger: string; // Not going, destructive
  onStatus: string; // text on success/warning/danger fills
  overlay: string;
  scrim: string; // behind full-screen photos, the same in both themes
  onScrim: string;
  scrimButton: string;
  glass: string; // frosted card fill (see theme.glass)
  glassBorder: string; // its hairline edge
};

export type Gradients = {
  headline: [string, string]; // greeting, second line
  headlineWarm: [string, string]; // greeting, third line
  accent: [string, string]; // rings, leading poll bars, chart bars
  heroBase: string; // the next-event card is dark in both themes
  mesh: string; // CSS gradients for the page backdrop
};

const light: Colors = {
  background: '#F7F3F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F1ECF6',
  text: '#15121F',
  textSecondary: '#5D5870',
  textMuted: '#A39DB3',
  border: 'rgba(21, 18, 31, 0.08)',
  outline: 'rgba(21, 18, 31, 0.10)',
  primary: '#5B47F0',
  onPrimary: '#FFFFFF',
  secondary: '#F2662E',
  onSecondary: '#FFFFFF',
  highlight: '#FFE15C',
  onHighlight: '#15121F',
  success: '#2FB57A',
  warning: '#F5A524',
  danger: '#E5484D',
  onStatus: '#15121F',
  overlay: 'rgba(21, 18, 31, 0.55)',
  scrim: '#0B0B0F',
  onScrim: '#FFFFFF',
  scrimButton: 'rgba(255, 255, 255, 0.14)',
  glass: 'rgba(255, 255, 255, 0.66)',
  glassBorder: 'rgba(255, 255, 255, 0.9)',
};

const lightGradients: Gradients = {
  headline: ['#5B47F0', '#B34BD1'],
  headlineWarm: ['#C2416B', '#EE6A35'],
  accent: ['#5B47F0', '#D0429E'],
  heroBase: '#1B1542',
  mesh: [
    'radial-gradient(55% 45% at 0% 0%, rgba(250, 196, 222, 0.75) 0%, rgba(250, 196, 222, 0) 70%)',
    'radial-gradient(45% 40% at 100% 12%, rgba(199, 182, 250, 0.7) 0%, rgba(199, 182, 250, 0) 70%)',
    'radial-gradient(40% 35% at 0% 60%, rgba(182, 216, 248, 0.6) 0%, rgba(182, 216, 248, 0) 70%)',
    'radial-gradient(50% 40% at 100% 75%, rgba(252, 208, 186, 0.7) 0%, rgba(252, 208, 186, 0) 70%)',
  ].join(', '),
};

const dark: Colors = {
  background: '#08080C',
  surface: '#14141B',
  surfaceAlt: '#1E1E28',
  text: '#FFFFFF',
  textSecondary: '#A3A3B8',
  textMuted: '#62627A',
  border: 'rgba(255, 255, 255, 0.08)',
  outline: 'rgba(255, 255, 255, 0.12)',
  primary: '#D7F74A',
  onPrimary: '#0B0B0F',
  secondary: '#FF4F9A',
  onSecondary: '#0B0B0F',
  highlight: '#D7F74A',
  onHighlight: '#0B0B0F',
  success: '#3CE08A',
  warning: '#FFB13C',
  danger: '#FF5470',
  onStatus: '#0B0B0F',
  overlay: 'rgba(0, 0, 0, 0.7)',
  scrim: '#0B0B0F',
  onScrim: '#FFFFFF',
  scrimButton: 'rgba(255, 255, 255, 0.14)',
  glass: 'rgba(255, 255, 255, 0.045)',
  glassBorder: 'rgba(255, 255, 255, 0.09)',
};

const darkGradients: Gradients = {
  headline: ['#D7F74A', '#F2B466'],
  headlineWarm: ['#F06A8C', '#F6A57B'],
  accent: ['#D7F74A', '#A98BFA'],
  heroBase: '#0E0E15',
  mesh: [
    'radial-gradient(50% 40% at 0% 0%, rgba(92, 62, 196, 0.42) 0%, rgba(92, 62, 196, 0) 70%)',
    'radial-gradient(45% 35% at 100% 10%, rgba(150, 180, 40, 0.18) 0%, rgba(150, 180, 40, 0) 70%)',
    'radial-gradient(40% 35% at 0% 65%, rgba(30, 120, 150, 0.22) 0%, rgba(30, 120, 150, 0) 70%)',
    'radial-gradient(45% 40% at 100% 60%, rgba(190, 40, 120, 0.22) 0%, rgba(190, 40, 120, 0) 70%)',
  ].join(', '),
};

// Names match the exports of @expo-google-fonts/*, loaded in app/_layout.tsx
export const Fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
};

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const Radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };

// React Native 0.86 on iOS can round a wrapped Text's height a hair short and
// clip its last line, depending on where it sits on screen
// (github.com/react/react-native/issues/58970). A sliver of bottom padding keeps
// the height rounding up. Remove once the upstream fix ships.
const TEXT_FIX = Platform.OS === 'ios' ? { paddingBottom: 0.01 } : {};

function typeScale(c: Colors) {
  return {
    // Bricolage Grotesque — big, tight, bold
    hero: { fontFamily: Fonts.display, fontSize: 52, lineHeight: 52, letterSpacing: -2, color: c.text, ...TEXT_FIX },
    display: { fontFamily: Fonts.display, fontSize: 38, lineHeight: 40, letterSpacing: -1.5, color: c.text, ...TEXT_FIX },
    title: { fontFamily: Fonts.display, fontSize: 28, lineHeight: 31, letterSpacing: -1, color: c.text, ...TEXT_FIX },
    heading: { fontFamily: Fonts.display, fontSize: 20, lineHeight: 24, letterSpacing: -0.5, color: c.text, ...TEXT_FIX },
    cardTitle: { fontFamily: Fonts.display, fontSize: 18, lineHeight: 21, letterSpacing: -0.4, color: c.text, ...TEXT_FIX },
    stat: { fontFamily: Fonts.display, fontSize: 30, lineHeight: 32, letterSpacing: -1, color: c.text, ...TEXT_FIX },

    // DM Sans — everything functional
    body: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 22, color: c.text, ...TEXT_FIX },
    bodySecondary: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 22, color: c.textSecondary, ...TEXT_FIX },
    value: { fontFamily: Fonts.bodyMedium, fontSize: 15, lineHeight: 21, color: c.text, ...TEXT_FIX },
    // Section header — use instead of label when a heading introduces content, not a field
    sectionHeading: { fontFamily: Fonts.display, fontSize: 16, lineHeight: 20, letterSpacing: -0.3, color: c.text, ...TEXT_FIX },
    label: { fontFamily: Fonts.bodyBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: c.textSecondary, ...TEXT_FIX },
    caption: { fontFamily: Fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: c.textSecondary, ...TEXT_FIX },
    button: { fontFamily: Fonts.bodyBold, fontSize: 15, letterSpacing: 0.2, ...TEXT_FIX },
    input: { fontFamily: Fonts.body, fontSize: 15, color: c.text },
  } satisfies Record<string, TextStyle>;
}

/**
 * A CSS gradient as a style: `backgroundImage` on web (react-native-web passes
 * it through), `experimental_backgroundImage` on phones (React Native 0.86
 * supports linear and radial gradients there). Where a platform can't draw it,
 * the View keeps its backgroundColor, so always set one as the fallback.
 */
export function gradient(css: string): ViewStyle {
  return (Platform.OS === 'web' ? { backgroundImage: css } : { experimental_backgroundImage: css }) as ViewStyle;
}

export const linear = ([from, to]: [string, string], angle = 90) => `linear-gradient(${angle}deg, ${from}, ${to})`;

function build(name: ThemeName, colors: Colors, gradients: Gradients) {
  const isDark = name === 'dark';
  // Hairline edges in both themes; the outline colour is a translucent ink/white
  const outlineWidth = 1;
  // Soft, lifted shadows (they used to be hard offset ink blocks)
  const shadow = (size: number) => ({
    boxShadow: `0px ${size * 2}px ${size * 7}px ${isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(40, 24, 90, 0.08)'}`,
  });
  // Frosted card: translucent fill, bright hairline, soft shadow; blurs what's behind it on web
  const glass: ViewStyle = {
    backgroundColor: colors.glass,
    borderWidth: outlineWidth,
    borderColor: colors.glassBorder,
    ...shadow(3),
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(18px) saturate(1.4)' } as ViewStyle) : {}),
  };
  return {
    name,
    isDark,
    colors,
    gradients,
    type: typeScale(colors),
    outlineWidth,
    // Convenience helpers — use instead of hard-coding boxShadow or isDark checks
    shadow,
    glass,
    gradient,
  };
}

export const Themes = { light: build('light', light, lightGradients), dark: build('dark', dark, darkGradients) };
export type Theme = (typeof Themes)[ThemeName];
