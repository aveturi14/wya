import { Platform, TextStyle } from 'react-native';

/**
 * wya design system: "Poster, in the spotlight" (Phase 9, docs/PHASE9.md).
 *
 * The app itself is quiet and neutral: near-black or near-white pages, solid cards,
 * grey text, one text-coloured pill for the main action. Colour comes from each
 * event's poster (constants/eventThemes.ts) and its glow, not from the app chrome.
 * Both themes share every role name, shape, size and font; only colours differ.
 *
 * Screens read roles (theme.colors.primary), never raw hex values. Every text
 * role passes WCAG AA (4.5:1) on page, surface and surfaceAlt in its theme.
 */

export type ThemeName = 'light' | 'dark';

export type Colors = {
  background: string; // page
  surface: string; // cards, inputs
  surfaceAlt: string; // chips, soft buttons, rows inside cards
  sheet: string; // bottom sheets, a step above surface
  text: string;
  textSecondary: string;
  textMuted: string; // placeholders, captions, inactive tabs
  border: string; // dividers inside cards
  outline: string; // the hairline edge around cards, fields and outline buttons
  primary: string; // the main action: the text colour, as a pill
  onPrimary: string;
  secondary: string; // the sticker pink: badges, the wya. dot, unread counts
  onSecondary: string;
  highlight: string; // stickers wya adds to posters
  onHighlight: string;
  success: string; // Going (fills, dots)
  warning: string; // Maybe
  danger: string; // Not going, destructive
  onStatus: string; // text on success/warning/danger fills
  // The status colours as text on the page
  successText: string;
  warningText: string;
  dangerText: string;
  thumb: string; // switch knobs, white in both themes
  overlay: string;
  scrim: string; // behind full-screen photos, the same in both themes
  onScrim: string;
  scrimButton: string;
  // New in 9.2
  chipStrong: string; // unchecked boxes, switch tracks, empty bar segments
  lineStrong: string; // outline buttons and unticked boxes
  bar: string; // the floating tab bar and desktop top bar (translucent)
  barEdge: string;
};

const STICKER_PINK = '#FF2E7A';

const light: Colors = {
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F0F2',
  sheet: '#FFFFFF',
  text: '#0B0B0D',
  textSecondary: '#55555D',
  textMuted: '#6A6A72', // 4.6:1 on surfaceAlt
  border: '#ECECEE',
  outline: '#E3E3E6',
  primary: '#0B0B0D',
  onPrimary: '#FFFFFF',
  secondary: STICKER_PINK,
  onSecondary: '#0B0B0D', // white on the pink is 3.6:1, ink is 5.6:1
  highlight: STICKER_PINK,
  onHighlight: '#0B0B0D',
  success: '#34C77B',
  warning: '#F5B544',
  danger: '#FF6B6B',
  onStatus: '#0B0B0D',
  successText: '#1F7A4C',
  warningText: '#8F5D00',
  dangerText: '#C53030',
  thumb: '#FFFFFF',
  overlay: 'rgba(11, 11, 13, 0.45)',
  scrim: '#000000',
  onScrim: '#FFFFFF',
  scrimButton: 'rgba(255, 255, 255, 0.16)',
  chipStrong: '#D9D9DE',
  lineStrong: '#C9C9CF',
  bar: 'rgba(255, 255, 255, 0.86)',
  barEdge: 'rgba(0, 0, 0, 0.06)',
};

const dark: Colors = {
  background: '#0B0B0D',
  surface: '#151518',
  surfaceAlt: '#1F1F23',
  sheet: '#18181C',
  text: '#F5F5F7',
  textSecondary: '#A1A1AA',
  textMuted: '#8A8A93', // 4.8:1 on surfaceAlt
  border: '#232327',
  outline: '#2A2A2F',
  primary: '#F5F5F7',
  onPrimary: '#0B0B0D',
  secondary: STICKER_PINK,
  onSecondary: '#0B0B0D',
  highlight: STICKER_PINK,
  onHighlight: '#0B0B0D',
  success: '#34C77B',
  warning: '#F5B544',
  danger: '#FF6B6B',
  onStatus: '#0B0B0D',
  // Bright enough to read on near-black as they are
  successText: '#34C77B',
  warningText: '#F5B544',
  dangerText: '#FF6B6B',
  thumb: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.6)',
  scrim: '#000000',
  onScrim: '#FFFFFF',
  scrimButton: 'rgba(255, 255, 255, 0.16)',
  chipStrong: '#33333A',
  lineStrong: '#38383F',
  bar: 'rgba(28, 28, 32, 0.86)',
  barEdge: 'rgba(255, 255, 255, 0.06)',
};

// Names match the exports of @expo-google-fonts/* (and assets/fonts), loaded in app/_layout.tsx
export const Fonts = {
  // Geist for the whole app; titles are its bold weights, set tight
  display: 'Geist_700Bold',
  displayBold: 'Geist_600SemiBold',
  body: 'Geist_400Regular',
  bodyMedium: 'Geist_500Medium',
  bodySemiBold: 'Geist_600SemiBold',
  bodyBold: 'Geist_700Bold',
  // Geist Mono: dates, money, payment references
  mono: 'GeistMono_500Medium',
  monoRegular: 'GeistMono_400Regular',
  // One italic accent line per poster or greeting ("Jess turns", "here's your week")
  serif: 'InstrumentSerif_400Regular_Italic',
  // Poster titles only. Expo's Archivo package has no expanded width, so this one is bundled (OFL, assets/fonts)
  poster: 'ArchivoExpanded_900Black',
};

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

// sm small chips and thumbnails · md fields · lg cards · xl posters · pill buttons
export const Radius = { sm: 10, md: 12, lg: 18, xl: 22, pill: 999 };

// The smallest comfortable tap target (Apple HIG); big buttons are this tall
export const TOUCH = 44;

// React Native 0.86 on iOS can round a wrapped Text's height a hair short and
// clip its last line, depending on where it sits on screen
// (github.com/react/react-native/issues/58970). A sliver of bottom padding keeps
// the height rounding up. Remove once the upstream fix ships.
const TEXT_FIX = Platform.OS === 'ios' ? { paddingBottom: 0.01 } : {};

// Titles are tracked in at about −0.045em; React Native wants points, so work it out per size
const tight = (size: number, em = -0.045) => Math.round(size * em * 10) / 10;

function typeScale(c: Colors) {
  return {
    // Geist bold, set tight
    hero: { fontFamily: Fonts.display, fontSize: 44, lineHeight: 46, letterSpacing: tight(44), color: c.text, ...TEXT_FIX },
    display: { fontFamily: Fonts.display, fontSize: 34, lineHeight: 37, letterSpacing: tight(34), color: c.text, ...TEXT_FIX },
    title: { fontFamily: Fonts.display, fontSize: 27, lineHeight: 30, letterSpacing: tight(27), color: c.text, ...TEXT_FIX },
    heading: { fontFamily: Fonts.display, fontSize: 20, lineHeight: 24, letterSpacing: tight(20, -0.035), color: c.text, ...TEXT_FIX },
    cardTitle: { fontFamily: Fonts.display, fontSize: 17, lineHeight: 21, letterSpacing: tight(17, -0.03), color: c.text, ...TEXT_FIX },
    stat: { fontFamily: Fonts.mono, fontSize: 28, lineHeight: 32, letterSpacing: -0.6, color: c.text, fontVariant: ['tabular-nums'], ...TEXT_FIX },

    // Geist for everything functional
    body: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 22, color: c.text, ...TEXT_FIX },
    bodySecondary: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 22, color: c.textSecondary, ...TEXT_FIX },
    value: { fontFamily: Fonts.bodyMedium, fontSize: 15, lineHeight: 21, color: c.text, ...TEXT_FIX },
    // Section header: use instead of label when a heading introduces content, not a field
    sectionHeading: { fontFamily: Fonts.bodySemiBold, fontSize: 16, lineHeight: 20, letterSpacing: -0.3, color: c.text, ...TEXT_FIX },
    label: { fontFamily: Fonts.bodySemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: c.textSecondary, ...TEXT_FIX },
    caption: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 18, color: c.textSecondary, ...TEXT_FIX },
    // The smallest text in the app (timestamps, chips): 12px is the floor
    micro: { fontFamily: Fonts.bodyMedium, fontSize: 12, lineHeight: 15, color: c.textSecondary, ...TEXT_FIX },
    button: { fontFamily: Fonts.bodySemiBold, fontSize: 15, ...TEXT_FIX },
    input: { fontFamily: Fonts.body, fontSize: 15, color: c.text },

    // New in Phase 9
    accent: { fontFamily: Fonts.serif, fontSize: 22, lineHeight: 26, color: c.text, ...TEXT_FIX }, // the italic serif line
    money: { fontFamily: Fonts.mono, fontSize: 15, lineHeight: 20, color: c.text, fontVariant: ['tabular-nums'], ...TEXT_FIX },
    mono: { fontFamily: Fonts.monoRegular, fontSize: 13, lineHeight: 18, color: c.textSecondary, fontVariant: ['tabular-nums'], ...TEXT_FIX },
    // Poster titles: upper case, very tight; the poster shrinks the size to fit (9.3)
    poster: { fontFamily: Fonts.poster, fontSize: 40, lineHeight: 36, letterSpacing: tight(40, -0.04), textTransform: 'uppercase', ...TEXT_FIX },
  } satisfies Record<string, TextStyle>;
}

function build(name: ThemeName, colors: Colors) {
  const isDark = name === 'dark';
  // A hairline edge in both themes; cards sit on the page by colour in dark and
  // by a soft shadow in light. (The kit drops edges where it doesn't need them in 9.2.)
  const outlineWidth = 1;
  // Soft elevation in light, none in dark (surfaces step up in colour instead).
  // `size` is kept from the old hard-offset helper: bigger means a little more lift.
  const shadow = (size: number) => (isDark
    ? { boxShadow: 'none' }
    : { boxShadow: `0px 1px 2px rgba(0, 0, 0, 0.04), 0px ${4 + size}px ${16 + size * 3}px -10px rgba(0, 0, 0, ${0.1 + size * 0.01})` });
  return {
    name,
    isDark,
    colors,
    type: typeScale(colors),
    outlineWidth,
    // How strongly an event's poster glows behind its page (9.3)
    glowOpacity: isDark ? 0.5 : 0.28,
    // Convenience helpers: use instead of hard-coding boxShadow or isDark checks
    shadow,
  };
}

export const Themes = { light: build('light', light), dark: build('dark', dark) };
export type Theme = (typeof Themes)[ThemeName];

// Faces without a photo get one of these, picked from their id, so the same person
// is the same colour everywhere. Initials use whichever of ink or white reads better.
export const PERSON_FILLS = ['#F25F5C', '#2E6BFF', '#1FB57A', '#7B4DFF', '#FF8A65', '#3BB4F2', '#C9A227', '#E040A0', '#5B6B7A', '#00A88F', '#9B5CFF', '#FF7A3D'];

function luminance(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Ink or white, whichever has more contrast on a solid colour (for text on event colours and faces). */
export function inkOn(hex: string) {
  const l = luminance(hex);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#0B0B0D' : '#FFFFFF';
}
