// A host-chosen look for one event: colors its cover art, accents and invite.
// Bold enough to read on both the light (cream) and dark (black) app themes.

export type EventThemeName = 'lime' | 'bubblegum' | 'violet' | 'tangerine' | 'ocean' | 'sunset';

export type EventTheme = {
  name: EventThemeName;
  label: string;
  base: string; // cover background and accent
  ink: string; // text and shapes on the base
  shape: string; // decorative shapes in generated cover art
};

export const EventThemes: Record<EventThemeName, EventTheme> = {
  lime: { name: 'lime', label: 'Lime', base: '#D4FF3F', ink: '#0B0B0F', shape: '#A8D91A' },
  bubblegum: { name: 'bubblegum', label: 'Bubblegum', base: '#FF3CAC', ink: '#0B0B0F', shape: '#FF8BCB' },
  violet: { name: 'violet', label: 'Violet', base: '#7A50FF', ink: '#FFFFFF', shape: '#A27FFF' }, // white on it is 4.75:1
  tangerine: { name: 'tangerine', label: 'Tangerine', base: '#FF6A3D', ink: '#1C1530', shape: '#FFA07F' },
  ocean: { name: 'ocean', label: 'Ocean', base: '#3CC8FF', ink: '#0B0B0F', shape: '#8ADFFF' },
  sunset: { name: 'sunset', label: 'Sunset', base: '#FFB13C', ink: '#1C1530', shape: '#FFD27F' },
};

export const EVENT_THEME_NAMES = Object.keys(EventThemes) as EventThemeName[];

export function eventTheme(name: string | null | undefined): EventTheme {
  return EventThemes[(name as EventThemeName) ?? 'violet'] ?? EventThemes.violet;
}
