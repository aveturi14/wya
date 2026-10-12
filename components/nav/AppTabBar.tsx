import Logo from '@/components/ui/Logo';
import PressableScale from '@/components/ui/PressableScale';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { useUnread } from '@/hooks/useUnread';
import { haptics } from '@/lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = keyof typeof Ionicons.glyphMap;
// The props Tabs passes to a custom tab bar (the type itself isn't exported publicly)
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

// Order matters: this is the order in both the bottom bar and the sidebar
export const TABS: { name: string; label: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'home', label: 'Events', icon: 'sparkles-outline', iconActive: 'sparkles' },
  { name: 'chats', label: 'Chats', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  { name: 'create', label: 'New event', icon: 'add', iconActive: 'add' },
  { name: 'activity', label: 'Activity', icon: 'notifications-outline', iconActive: 'notifications' },
  { name: 'account', label: 'You', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

/** Bottom tab bar on phones, left sidebar on wide screens. */
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
    ? <Sidebar active={activeName} onPress={go} badgeFor={badgeFor} />
    : <BottomBar active={activeName} onPress={go} badgeFor={badgeFor} />;
}

type BarProps = { active?: string; onPress: (name: string) => void; badgeFor: (name: string) => number | string | undefined };

function BottomBar({ active, onPress, badgeFor }: BarProps) {
  const { theme } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const c = theme.colors;
  return (
    // Outer wrapper provides the safe-area padding so content isn't hidden behind home indicator
    <View style={{ paddingBottom: insets.bottom, paddingHorizontal: Space.lg, pointerEvents: 'box-none' } as any}>
      <View style={styles.bottomBar}>
        {TABS.map((tab) => {
          const focused = tab.name === active;
          if (tab.name === 'create') {
            return (
              <View key={tab.name} style={styles.bottomItem}>
                <PressableScale haptic={false} onPress={() => onPress(tab.name)} style={styles.createBtn} accessibilityLabel="Create event">
                  <Ionicons name="add" size={26} color={c.onPrimary} />
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
 * The desktop sidebar outside the tab navigator (e.g. on event pages), so the
 * app keeps its navigation on wide screens wherever you are.
 */
export function StandaloneSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const badgeFor = useBadges();
  const active = TABS.find((t) => pathname === `/${t.name}`)?.name;
  return <Sidebar active={active} onPress={(name) => router.navigate(`/(tabs)/${name}` as any)} badgeFor={badgeFor} />;
}

function useBadges() {
  const { chats, activity } = useUnread();
  return (name: string) => (name === 'chats' ? chats : name === 'activity' ? activity : undefined);
}

function Sidebar({ active, onPress, badgeFor }: BarProps) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarLogo}><Logo size={34} /></View>
      <PressableScale haptic={false} onPress={() => onPress('create')} style={styles.sidebarCreate} accessibilityLabel="Create event">
        <Ionicons name="add" size={20} color={c.onPrimary} />
        <Text style={[theme.type.button, { color: c.onPrimary }]}>New event</Text>
      </PressableScale>
      <View style={styles.sidebarNav}>
        {TABS.filter((t) => t.name !== 'create' && t.name !== 'account').map((tab) => (
          <SidebarItem key={tab.name} tab={tab} focused={tab.name === active} badge={badgeFor(tab.name)} onPress={() => onPress(tab.name)} />
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <SidebarItem tab={TABS.find((t) => t.name === 'account')!} focused={active === 'account'} onPress={() => onPress('account')} />
    </View>
  );
}

function SidebarItem({ tab, focused, badge, onPress }: { tab: (typeof TABS)[number]; focused: boolean; badge?: number | string; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  return (
    <PressableScale haptic={false} scaleTo={0.98} onPress={onPress} style={[styles.sidebarItem, focused && styles.sidebarItemActive]} hoverStyle={!focused && styles.sidebarItemHover}>
      <Ionicons name={focused ? tab.iconActive : tab.icon} size={22} color={focused ? c.text : c.textSecondary} />
      <Text style={[styles.sidebarLabel, { color: focused ? c.text : c.textSecondary }]}>{tab.label}</Text>
      {badge !== undefined && badge !== 0 && <View style={{ marginLeft: 'auto' }}><Badge value={badge} inline /></View>}
    </PressableScale>
  );
}

function Badge({ value, inline }: { value?: number | string; inline?: boolean }) {
  const { theme } = useTheme();
  if (value === undefined || value === 0 || value === '') return null;
  return (
    <View style={[
      { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: theme.colors.secondary, justifyContent: 'center', alignItems: 'center' },
      !inline && { position: 'absolute', top: -4, right: -10 },
    ]}>
      <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 10, color: theme.colors.onSecondary }}>{typeof value === 'number' && value > 9 ? '9+' : value}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface,
    paddingTop: Space.sm, paddingBottom: Space.sm,
    borderRadius: Radius.xl, borderWidth: t.outlineWidth, borderColor: t.colors.outline,
    marginBottom: Space.sm,
    ...t.shadow(4),
  },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52 },
  bottomLabel: { fontFamily: Fonts.bodyBold, fontSize: 11 },
  createBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: t.colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: t.outlineWidth, borderColor: t.colors.outline,
    ...t.shadow(3),
  },
  sidebar: {
    width: 240, paddingHorizontal: Space.lg, paddingVertical: Space.xl, gap: Space.lg, backgroundColor: t.colors.surface,
    borderRightWidth: t.outlineWidth, borderRightColor: t.colors.outline,
  },
  sidebarLogo: { paddingHorizontal: Space.md, paddingBottom: Space.sm },
  sidebarCreate: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.sm, paddingVertical: 14, borderRadius: Radius.pill,
    backgroundColor: t.colors.primary, borderWidth: t.outlineWidth, borderColor: t.isDark ? t.colors.primary : t.colors.outline,
    ...(t.isDark ? {} : { boxShadow: `3px 3px 0px ${t.colors.outline}` }),
  },
  sidebarNav: { gap: Space.xs, marginTop: Space.sm },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingHorizontal: Space.md, paddingVertical: 12, borderRadius: Radius.md },
  sidebarItemActive: { backgroundColor: t.colors.surfaceAlt },
  sidebarItemHover: { backgroundColor: t.colors.surfaceAlt },
  sidebarLabel: { fontFamily: Fonts.bodyBold, fontSize: 15 },
}));
