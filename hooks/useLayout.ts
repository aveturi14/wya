import { useWindowDimensions } from 'react-native';

// Below this width the app is phone-shaped: one column and a bottom tab bar.
// At or above it (laptops, wide browser windows): sidebar navigation and multi-column screens.
export const WIDE_BREAKPOINT = 1024;

// Desktop sizes come from the window, not fixed numbers, so a 1280 laptop and a 2560
// monitor both look laid out on purpose. `contentWidth` is the usable width of the wide
// column (the pages pad 32pt each side, up to the 1440 cap).
const WIDE_CONTENT_MAX = 1440;
const WIDE_GUTTER = 32;
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const contentWidth = Math.min(width, WIDE_CONTENT_MAX) - WIDE_GUTTER * 2;
  return { isWide, width, height, contentWidth };
}
