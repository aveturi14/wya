import PressableScale from '@/components/ui/PressableScale';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { TAB_BAR_HEIGHT, useTabBarOffset } from '@/hooks/useTabBarSpace';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { useUnread } from '@/hooks/useUnread';
import { haptics } from '@/lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, Text, View } from 'react-native';

type IconName = keyof typeof Ionicons.glyphMap;
// The props Tabs passes to a custom tab bar (the type itself isn't exported publicly)
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

// Order matters: this is the order in both the bottom bar and the rail
export const TABS: { name: string; label: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'home', label: 'Events', icon: 'home-outline', iconActive: 'home' },
  { name: 'chats', label: 'Chats', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  { name: 'create', label: 'New event', icon: 'add', iconActive: 'add' },
  { name: 'photos', label: 'Photos', icon: 'images-outline', iconActive: 'images' },
  { name: 'account', label: 'You', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

/** Floating bottom bar on phones, a floating icon rail on wide screens. */
export default function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { isWide } = useLayout();
  const badgeFor = useBadges();
  const activeName = state.routes[state.index]?.name;

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (name !== activeName && !event.defaultPrevented) {
      haptics.select();
      navigation.navigate(route.name);
    }
  };
  return isWide
    ? <Rail active={activeName} onPress={go} badgeFor={badgeFor} />
    : <BottomBar active={activeName} onPress={go} badgeFor={badgeFor} />;
}

type BarProps = { active?: string; onPress: (name: string) => void; badgeFor: (name: string) => number | string | undefined };

function BottomBar({ active, onPress, badgeFor }: BarProps) {
  const { theme } = useTheme();
  const styles = useStyles();
  const bottom = useTabBarOffset();
  const c = theme.colors;
  return (
    // Absolutely positioned, so the navigator reserves no space for it: pages scroll
    // behind the bar and show around its rounded ends. Tab pages pad their content
    // with useTabBarSpace() so the last item still clears it.
    <View style={[styles.bottomWrap, { bottom }]}>
      <View style={styles.bottomBar}>
        {TABS.map((tab) => {
          const focused = tab.name === active;
          if (tab.name === 'create') {
            return (
              <View key={tab.name} style={styles.bottomItem}>
                <PressableScale haptic={false} onPress={() => onPress(tab.name)} style={styles.createBtn} accessibilityLabel="Create event">
                  <Ionicons name="add" size={28} color={c.onPrimary} />
                </PressableScale>
              </View>
            );
          }
          return (
            <PressableScale key={tab.name} haptic={false} onPress={() => onPress(tab.name)} style={styles.bottomItem} accessibilityLabel={tab.label}>
              <View>
                <Ionicons name={focused ? tab.iconActive : tab.icon} size={24} color={focused ? c.text : c.textMuted} />
                <Badge value={badgeFor(tab.name)} />
              </View>
              <Text style={[styles.bottomLabel, { color: focused ? c.text : c.textMuted }]}>{tab.label}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The rail outside the tab navigator (event pages, Activity), so the app keeps
 * its navigation on wide screens wherever you are.
 */
export function StandaloneSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const badgeFor = useBadges();
  const active = TABS.find((t) => pathname === `/${t.name}`)?.name;
  return <Rail active={active} onPress={(name) => router.navigate(`/(tabs)/${name}` as any)} badgeFor={badgeFor} />;
}

function useBadges() {
  const { chats } = useUnread();
  // Activity's count lives on the bell in the Events header, not on the bar
  return (name: string) => (name === 'chats' ? chats : undefined);
}

// Desktop: a floating frosted pill of icons, with New event at the bottom (the design board's rail)
function Rail({ active, onPress, badgeFor }: BarProps) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  return (
    <View style={styles.railWrap}>
      <View style={styles.rail}>
        {TABS.filter((t) => t.name !== 'create').map((tab) => {
          const focused = tab.name === active;
          const badge = badgeFor(tab.name);
          return (
            <PressableScale
              key={tab.name}
              haptic={false}
              scaleTo={0.94}
              onPress={() => onPress(tab.name)}
              style={[styles.railItem, focused && styles.railItemActive]}
              hoverStyle={!focused && styles.railItemHover}
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: focused }}
              {...(Platform.OS === 'web' ? ({ title: tab.label } as object) : {})}
            >
              <Ionicons name={focused ? tab.iconActive : tab.icon} size={21} color={focused ? c.background : c.textSecondary} />
              <Badge value={badge} />
            </PressableScale>
          );
        })}
        <View style={styles.railDivider} />
        <PressableScale haptic={false} onPress={() => onPress('create')} style={styles.railCreate} accessibilityLabel="New event"
          {...(Platform.OS === 'web' ? ({ title: 'New event' } as object) : {})}>
          <Ionicons name="add" size={24} color={c.onPrimary} />
        </PressableScale>
      </View>
    </View>
  );
}

function Badge({ value }: { value?: number | string }) {
  const { theme } = useTheme();
  if (value === undefined || value === 0 || value === '') return null;
  return (
    <View style={{
      position: 'absolute', top: -4, right: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
      backgroundColor: theme.colors.secondary, justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 10, color: theme.colors.onSecondary }}>{typeof value === 'number' && value > 9 ? '9+' : value}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  // box-none: taps in the gaps around the bar reach the page behind it
  bottomWrap: { position: 'absolute', left: Space.lg, right: Space.lg, pointerEvents: 'box-none' },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', height: TAB_BAR_HEIGHT, paddingHorizontal: 6, borderRadius: Radius.pill,
    ...t.glass,
    // Pages scroll behind the bar: frosted on web; nearly solid on phones, which can't blur
    ...(Platform.OS === 'web' ? {} : { backgroundColor: t.colors.surface }),
    ...t.shadow(4),
  },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52 },
  bottomLabel: { fontFamily: Fonts.bodyBold, fontSize: 11 },
  createBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: t.colors.primary,
    justifyContent: 'center', alignItems: 'center', ...t.shadow(3),
  },
  railWrap: { width: 104, alignItems: 'center', paddingVertical: Space.xl },
  rail: { alignItems: 'center', gap: Space.md, paddingVertical: Space.md, paddingHorizontal: 10, borderRadius: Radius.pill, ...t.glass },
  railItem: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  // Active: an ink circle in light, a white one in dark (the board's "home" dot)
  railItemActive: { backgroundColor: t.colors.text },
  railItemHover: { backgroundColor: t.colors.surfaceAlt },
  railDivider: { width: 24, height: 1, backgroundColor: t.colors.border, marginVertical: 2 },
  railCreate: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: t.colors.primary,
    alignItems: 'center', justifyContent: 'center', ...t.shadow(3),
  },
}));
