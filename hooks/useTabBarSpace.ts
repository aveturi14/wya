import { Space } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The floating bar: 52pt items + 8pt padding top and bottom + a 2pt outline each side
export const TAB_BAR_HEIGHT = 68;

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
 * floating bar (bar + its offset + a small gap). Desktop has a sidebar instead.
 */
export function useTabBarSpace() {
  const { isWide } = useLayout();
  const offset = useTabBarOffset();
  return isWide ? Space.xxxl : TAB_BAR_HEIGHT + offset + Space.xl;
}
