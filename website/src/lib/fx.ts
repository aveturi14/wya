'use client';

import type { CSSProperties } from 'react';

// Tiny window-event bus so any section can fire a toast or confetti without
// prop drilling. The listeners live in components/Chrome.tsx.

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent('wya:toast', { detail: message }));
}

export function confetti(x: number, y: number, amount = 90) {
  window.dispatchEvent(new CustomEvent('wya:confetti', { detail: { x, y, amount } }));
}

/** Burst confetti from the center of an element. */
export function confettiFrom(el: Element, amount?: number) {
  const r = el.getBoundingClientRect();
  confetti(r.left + r.width / 2, r.top + r.height / 2, amount);
}

/** Typed helper for CSS custom properties in inline styles. */
export function vars(v: Record<`--${string}`, string>): CSSProperties {
  return v as CSSProperties;
}

export type EventThemeName = 'violet' | 'lime' | 'bubblegum' | 'tangerine' | 'ocean' | 'sunset';

// Mirrors constants/eventThemes.ts in the app
export const EVENT_THEMES: Record<EventThemeName, { label: string; base: string; ink: string; shape: string }> = {
  violet: { label: 'Violet', base: '#8B5CFF', ink: '#FFFFFF', shape: '#B394FF' },
  lime: { label: 'Lime', base: '#D4FF3F', ink: '#0B0B0F', shape: '#A8D91A' },
  bubblegum: { label: 'Bubblegum', base: '#FF3CAC', ink: '#0B0B0F', shape: '#FF8BCB' },
  tangerine: { label: 'Tangerine', base: '#FF6A3D', ink: '#1C1530', shape: '#FFA07F' },
  ocean: { label: 'Ocean', base: '#3CC8FF', ink: '#0B0B0F', shape: '#8ADFFF' },
  sunset: { label: 'Sunset', base: '#FFB13C', ink: '#1C1530', shape: '#FFD27F' },
};

export const THEME_ORDER = Object.keys(EVENT_THEMES) as EventThemeName[];

export function themeVars(name: EventThemeName): CSSProperties {
  const t = EVENT_THEMES[name];
  return vars({ '--b': t.base, '--i': t.ink, '--s': t.shape });
}
