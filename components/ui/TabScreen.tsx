import { MAX_CONTENT_WIDTH } from '@/components/ui/Screen';
import { Space } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { useTabBarSpace } from '@/hooks/useTabBarSpace';
import { makeStyles } from '@/hooks/useTheme';
import { ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, ScrollViewProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = Omit<ScrollViewProps, 'children'> & {
  children: ReactNode;
  maxWidth?: number;
  // Pages pushed on top of the tabs (Activity, edit event) have no floating bar to clear
  withTabBar?: boolean;
  // Forms: lift the content above the keyboard on iOS
  keyboardAvoiding?: boolean;
};

/**
 * The scrolling page used by every tab (and the pages that look like one).
 * On phones it keeps the header clear of the notch / Dynamic Island with a
 * fixed strip in the page colour under the status bar (content scrolls
 * beneath it, and a hairline appears once you've scrolled), and pads the end
 * so the last item clears the floating tab bar. Desktop layouts are untouched:
 * the page's own content style applies as before.
 */
export default function TabScreen({
  children, maxWidth = MAX_CONTENT_WIDTH, withTabBar = true, keyboardAvoiding, contentContainerStyle, onScroll, ...scrollProps
}: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { isWide } = useLayout();
  const tabBarSpace = useTabBarSpace();
  const [scrolled, setScrolled] = useState(false);
  const topInset = useTopInset();

  const phonePadding = isWide ? null : {
    // The strip already covers the inset; browsers (no inset) get a bit more air
    paddingTop: insets.top > 0 ? 0 : Space.xl,
    paddingBottom: withTabBar ? tabBarSpace : insets.bottom + Space.xl,
  };

  const scroll = (
    <ScrollView
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={32}
      {...scrollProps}
      onScroll={(e) => {
        const past = e.nativeEvent.contentOffset.y > 1;
        if (past !== scrolled) setScrolled(past);
        onScroll?.(e);
      }}
      contentContainerStyle={[contentContainerStyle, phonePadding]}
    >
      {children}
    </ScrollView>
  );

  return (
    <View style={styles.page}>
      {!isWide && <View style={[styles.strip, { height: topInset }, scrolled && styles.stripLine]} />}
      <View style={[styles.column, { maxWidth }]}>
        {keyboardAvoiding
          ? <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{scroll}</KeyboardAvoidingView>
          : scroll}
      </View>
    </View>
  );
}

/**
 * Where page content starts below the status bar, by kind of iPhone:
 * - Dynamic Island (inset 59pt and up): the status bar row is taller than the
 *   island, so tuck in by 6pt like Apple's own large titles.
 * - Notch (44–50pt): the full inset; the clock and battery sit lower.
 * - Home button (20pt, and Android's similar status bars): the bar has no
 *   spare room, so add a small gap to keep content off the clock.
 * Browsers report 0 and get their spacing from the page padding instead.
 */
const DYNAMIC_ISLAND_INSET = 59;
const DYNAMIC_ISLAND_TUCK = 6;
const FLAT_STATUS_BAR_MAX = 30;
export function useTopInset() {
  const { top } = useSafeAreaInsets();
  if (top >= DYNAMIC_ISLAND_INSET) return top - DYNAMIC_ISLAND_TUCK;
  if (top > 0 && top <= FLAT_STATUS_BAR_MAX) return top + Space.sm;
  return top;
}

const useStyles = makeStyles((t) => ({
  page: { flex: 1, backgroundColor: t.colors.background, alignItems: 'center' },
  // Full width (outside the centred column), so the hairline spans the screen
  strip: { alignSelf: 'stretch', backgroundColor: t.colors.background, zIndex: 1 },
  stripLine: { borderBottomWidth: 1, borderBottomColor: t.colors.border },
  column: { flex: 1, width: '100%' },
}));
