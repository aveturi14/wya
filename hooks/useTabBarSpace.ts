import { Space } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The floating bottom bar on phones: 52pt items + 5pt padding top and bottom + a hairline
export const TAB_BAR_HEIGHT = 64;

// The floating top bar on wide screens: how far down it sits, and how much room pages leave for it
export const TOP_BAR_TOP = 16;
export const TOP_BAR_SPACE = 92;

/**
 * How far the floating bar sits above the bottom edge. Roughly where iOS puts
 * its own floating bars: a little into the home-indicator area rather than on
 * top of all of it, and never flush with the edge on phones without one.
 */
export function useTabBarOffset() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom - 12, Space.sm);
}

/**
 * Bottom padding for a tab page's scroll content, so the last item clears the
 * floating bar (bar + its offset + a small gap). Desktop has its bar at the top instead.
 */
export function useTabBarSpace() {
  const { isWide } = useLayout();
  const offset = useTabBarOffset();
  return isWide ? Space.xxxl : TAB_BAR_HEIGHT + offset + Space.xl;
}

/** Top padding that clears the desktop top bar (0 on phones). */
export function useTopBarSpace() {
  const { isWide } = useLayout();
  return isWide ? TOP_BAR_SPACE : 0;
}
