import { useWindowDimensions } from 'react-native';

// Below this width the app is phone-shaped: one column and a bottom tab bar.
// At or above it (laptops, wide browser windows): sidebar navigation and multi-column screens.
export const WIDE_BREAKPOINT = 1024;

export function useLayout() {
  const { width } = useWindowDimensions();
  return { isWide: width >= WIDE_BREAKPOINT, width };
}
