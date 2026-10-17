import { inkOn } from './theme';

/**
 * An event's look (Phase 9.3): two colours that mix with grain into its poster,
 * glow behind its pages and fill its RSVP and pay buttons. The names must match the
 * `events.theme` check constraint (20261018000200_posters.sql).
 */
export type EventThemeName = 'sunset' | 'violet' | 'ocean' | 'lime' | 'peach' | 'tomato' | 'midnight';

export type EventTheme = {
  name: EventThemeName;
  label: string;
  a: string; // the poster's first colour (top left); buttons in the event colour use it
  b: string; // the second colour (bottom right)
  posterInk: string; // title and text printed on the poster
  // Kept from before Phase 9 so older call sites still read: a solid fill and the text on it
  base: string;
  ink: string;
  shape: string;
};

function look(name: EventThemeName, label: string, a: string, b: string, posterInk: string): EventTheme {
  return { name, label, a, b, posterInk, base: a, ink: inkOn(a), shape: b };
}

export const EventThemes: Record<EventThemeName, EventTheme> = {
  sunset: look('sunset', 'Sunset', '#FF7A3D', '#FF2E7A', '#16161A'),
  violet: look('violet', 'Violet', '#7B4DFF', '#FF6AD5', '#FFFFFF'),
  ocean: look('ocean', 'Ocean', '#2E6BFF', '#5BE1E6', '#FFFFFF'),
  lime: look('lime', 'Lime', '#C6F432', '#1FB57A', '#101012'),
  peach: look('peach', 'Peach', '#FFC46B', '#FF8A65', '#1A1410'),
  tomato: look('tomato', 'Tomato', '#FF5A4E', '#FFB347', '#1A0F0D'),
  midnight: look('midnight', 'Midnight', '#1C1F4A', '#7A5CFF', '#FFFFFF'),
};

export const EVENT_THEME_NAMES = Object.keys(EventThemes) as EventThemeName[];

// The pre-Phase 9 names, in case a row or a cached screen still has one (the posters migration renames them)
const LEGACY: Record<string, EventThemeName> = { bubblegum: 'violet', tangerine: 'sunset' };

export function eventTheme(name: string | null | undefined): EventTheme {
  if (!name) return EventThemes.violet;
  return EventThemes[(LEGACY[name] ?? name) as EventThemeName] ?? EventThemes.violet;
}

/**
 * The poster's mixed gradient as CSS: each colour pools in its own corner over a
 * diagonal blend (the mockups' "mesh").
 */
export function posterGradient(t: EventTheme) {
  return `radial-gradient(120% 90% at 15% 10%, ${t.a} 0%, transparent 60%), radial-gradient(110% 100% at 90% 90%, ${t.b} 0%, transparent 62%), linear-gradient(135deg, ${t.a}, ${t.b})`;
}

// Sticker colours on posters: wya's own are light or ink; hosts' get lime or pink too
export const STICKER_TONES = {
  light: { bg: '#FFFFFF', fg: '#111113' },
  ink: { bg: '#16161A', fg: '#FFFFFF' },
  lime: { bg: '#C6F432', fg: '#101012' },
  pink: { bg: '#FF2E7A', fg: '#0B0B0D' },
};

// Text over a cover photo (it sits on a dark shade)
export const PHOTO_INK = '#FFFFFF';

// See-through white pills printed on posters (the countdown on Next up, "add a sticker" in Create)
export const POSTER_PILL = 'rgba(255, 255, 255, 0.32)';
export const POSTER_PILL_STRONG = 'rgba(255, 255, 255, 0.85)';
