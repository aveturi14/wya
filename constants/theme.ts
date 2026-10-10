import { TextStyle } from 'react-native';

/**
 * wya design system.
 *
 * Two themes share every role name, shape, size and font; only colors and
 * outline weight differ:
 *   light — "Soft pop":   cream, violet, tangerine, sunshine, chunky ink outlines
 *   dark  — "After dark": near-black, electric lime, hot pink, hairline borders
 *
 * Screens read roles (theme.colors.primary), never raw hex values.
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
};

const light: Colors = {
  background: '#FFF6EC',
  surface: '#FFFFFF',
  surfaceAlt: '#FFEBD6',
  text: '#1C1530',
  textSecondary: '#5E5673',
  textMuted: '#A198B2',
  border: '#EADFD2',
  outline: '#1C1530',
  primary: '#8B5CFF',
  onPrimary: '#FFFFFF',
  secondary: '#FF6A3D',
  onSecondary: '#FFFFFF',
  highlight: '#FFE15C',
  onHighlight: '#1C1530',
  success: '#2FB57A',
  warning: '#FFB020',
  danger: '#E5484D',
  onStatus: '#1C1530',
  overlay: 'rgba(28, 21, 48, 0.55)',
};

const dark: Colors = {
  background: '#0B0B0F',
  surface: '#15151C',
  surfaceAlt: '#1F1F29',
  text: '#FFFFFF',
  textSecondary: '#A3A3B8',
  textMuted: '#5E5E73',
  border: '#2A2A36',
  outline: '#2A2A36',
  primary: '#D4FF3F',
  onPrimary: '#0B0B0F',
  secondary: '#FF3CAC',
  onSecondary: '#0B0B0F',
  highlight: '#D4FF3F',
  onHighlight: '#0B0B0F',
  success: '#3CE08A',
  warning: '#FFB13C',
  danger: '#FF5470',
  onStatus: '#0B0B0F',
  overlay: 'rgba(0, 0, 0, 0.7)',
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

function typeScale(c: Colors) {
  return {
    // Bricolage Grotesque — big, tight, bold
    hero: { fontFamily: Fonts.display, fontSize: 52, lineHeight: 52, letterSpacing: -2, color: c.text },
    display: { fontFamily: Fonts.display, fontSize: 38, lineHeight: 40, letterSpacing: -1.5, color: c.text },
    title: { fontFamily: Fonts.display, fontSize: 28, lineHeight: 31, letterSpacing: -1, color: c.text },
    heading: { fontFamily: Fonts.display, fontSize: 20, lineHeight: 24, letterSpacing: -0.5, color: c.text },
    cardTitle: { fontFamily: Fonts.display, fontSize: 18, lineHeight: 21, letterSpacing: -0.4, color: c.text },
    stat: { fontFamily: Fonts.display, fontSize: 30, lineHeight: 32, letterSpacing: -1, color: c.text },

    // DM Sans — everything functional
    body: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 22, color: c.text },
    bodySecondary: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 22, color: c.textSecondary },
    value: { fontFamily: Fonts.bodyMedium, fontSize: 15, lineHeight: 21, color: c.text },
    label: { fontFamily: Fonts.bodyBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: c.textSecondary },
    caption: { fontFamily: Fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: c.textSecondary },
    button: { fontFamily: Fonts.bodyBold, fontSize: 15, letterSpacing: 0.2 },
    input: { fontFamily: Fonts.body, fontSize: 15, color: c.text },
  } satisfies Record<string, TextStyle>;
}

function build(name: ThemeName, colors: Colors) {
  return {
    name,
    isDark: name === 'dark',
    colors,
    type: typeScale(colors),
    // Soft pop's signature is a chunky ink outline; After dark uses hairlines
    outlineWidth: name === 'light' ? 2 : 1,
  };
}

export const Themes = { light: build('light', light), dark: build('dark', dark) };
export type Theme = (typeof Themes)[ThemeName];
