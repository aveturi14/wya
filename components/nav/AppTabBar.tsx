import { Avatar } from '@/components/ui/Avatar';
import Logo from '@/components/ui/Logo';
import PressableScale from '@/components/ui/PressableScale';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useLayout } from '@/hooks/useLayout';
import { TAB_BAR_HEIGHT, TOP_BAR_TOP, useTabBarOffset } from '@/hooks/useTabBarSpace';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { useUnread } from '@/hooks/useUnread';
import { haptics } from '@/lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname, useRouter } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';

type IconName = keyof typeof Ionicons.glyphMap;
// The props Tabs passes to a custom tab bar (the type itself isn't exported publicly)
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

// Order matters: this is the order in the bottom bar
export const TABS: { name: string; label: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'home', label: 'Events', icon: 'calendar-clear-outline', iconActive: 'calendar-clear' },
  { name: 'chats', label: 'Chats', icon: 'chatbubble-outline', iconActive: 'chatbubble' },
  { name: 'create', label: 'New event', icon: 'add', iconActive: 'add' },
  { name: 'photos', label: 'Photos', icon: 'images-outline', iconActive: 'images' },
  { name: 'account', label: 'You', icon: 'person-outline', iconActive: 'person' },
];

// The desktop top bar's centre pill: Activity joins it (on phones it's the bell on Events)
const TOP_ITEMS: { name: string; label: string; icon: IconName; href: string }[] = [
  { name: 'home', label: 'Events', icon: 'calendar-clear-outline', href: '/(tabs)/home' },
  { name: 'chats', label: 'Chats', icon: 'chatbubble-outline', href: '/(tabs)/chats' },
  { name: 'photos', label: 'Photos', icon: 'images-outline', href: '/(tabs)/photos' },
  { name: 'activity', label: 'Activity', icon: 'notifications-outline', href: '/activity' },
];

/** The floating bottom bar on phones, the floating top bar on wide screens. */
export default function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { isWide } = useLayout();
  const router = useRouter();
  const badgeFor = useBadges();
  const activeName = state.routes[state.index]?.name;

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) {
      // Activity isn't a tab; it's pushed on top
      const item = TOP_ITEMS.find((t) => t.name === name);
      if (item) router.push(item.href as any);
      return;
    }
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (name !== activeName && !event.defaultPrevented) {
      haptics.select();
      navigation.navigate(route.name);
    }
  };
  return isWide
    ? <TopBar active={activeName} onPress={go} badgeFor={badgeFor} />
    : <BottomBar active={activeName} onPress={go} badgeFor={badgeFor} />;
}

type BarProps = { active?: string; onPress: (name: string) => void; badgeFor: (name: string) => number | undefined };

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
      <View style={[styles.bar, styles.bottomBar]} accessibilityRole="tablist">
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
          const badge = badgeFor(tab.name);
          return (
            <PressableScale
              key={tab.name}
              haptic={false}
              onPress={() => onPress(tab.name)}
              style={styles.bottomItem}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${tab.label}, ${badge} unread` : tab.label}
            >
              <View>
                <Ionicons name={focused ? tab.iconActive : tab.icon} size={23} color={focused ? c.text : c.textMuted} />
                <Badge value={badge} />
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
 * The desktop top bar outside the tab navigator (event pages, Activity, dues), so the
 * app keeps its navigation on wide screens wherever you are. Wrap the page in it: the
 * bar floats over the top and the page gets the room under it.
 */
export function WithTopBar({ children }: { children: ReactNode }) {
  const { isWide } = useLayout();
  const router = useRouter();
  const pathname = usePathname();
  const badgeFor = useBadges();
  if (!isWide) return <>{children}</>;
  const active = pathname.startsWith('/activity') ? 'activity' : pathname.startsWith('/event') ? 'home' : undefined;
  return (
    <View style={{ flex: 1 }}>
      {children}
      <TopBar
        active={active}
        badgeFor={badgeFor}
        onPress={(name) => {
          const item = TOP_ITEMS.find((t) => t.name === name);
          if (name === 'create' || name === 'account') router.navigate(`/(tabs)/${name}` as any);
          else if (item) router.navigate(item.href as any);
        }}
      />
    </View>
  );
}

function useBadges() {
  const { chats, activity } = useUnread();
  return (name: string) => (name === 'chats' ? chats : name === 'activity' ? activity : undefined);
}

/** Logo on the left, Events · Chats · Photos · Activity in a pill in the middle, New event and you on the right. */
function TopBar({ active, onPress, badgeFor }: BarProps) {
  const { theme } = useTheme();
  const { profile, user } = useAuth();
  const styles = useStyles();
  const c = theme.colors;
  return (
    <View style={styles.topWrap} pointerEvents="box-none">
      <PressableScale haptic={false} onPress={() => onPress('home')} style={styles.topLogo} accessibilityLabel="wya, home">
        <Logo size={26} />
      </PressableScale>
      <View style={styles.topCentre} pointerEvents="box-none">
        <View style={[styles.bar, styles.topPill]} accessibilityRole="tablist">
          {TOP_ITEMS.map((item) => {
            const focused = item.name === active;
            const badge = badgeFor(item.name);
            return (
              <PressableScale
                key={item.name}
                haptic={false}
                scaleTo={0.97}
                onPress={() => onPress(item.name)}
                style={[styles.topItem, focused && styles.topItemOn]}
                hoverStyle={!focused && styles.topItemHover}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={badge ? `${item.label}, ${badge} unread` : item.label}
              >
                <Ionicons name={item.icon} size={16} color={focused ? c.background : c.textSecondary} />
                <Text style={[styles.topLabel, { color: focused ? c.background : c.textSecondary }]}>{item.label}</Text>
                <Badge value={badge} inline />
              </PressableScale>
            );
          })}
        </View>
      </View>
      <View style={styles.topRight}>
        <PressableScale haptic={false} onPress={() => onPress('create')} style={styles.newEvent} hoverStyle={{ opacity: 0.88 }} accessibilityLabel="Create event">
          <Ionicons name="add" size={18} color={c.onPrimary} />
          <Text style={[theme.type.button, { color: c.onPrimary, fontSize: 14 }]}>New event</Text>
        </PressableScale>
        <PressableScale
          haptic={false}
          onPress={() => onPress('account')}
          style={[styles.me, active === 'account' && styles.meOn]}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === 'account' }}
          accessibilityLabel="You"
        >
          <Avatar name={profile?.full_name ?? null} url={profile?.avatar_url} seed={user?.id ?? 'me'} size={36} />
        </PressableScale>
      </View>
    </View>
  );
}

function Badge({ value, inline }: { value?: number; inline?: boolean }) {
  const { theme } = useTheme();
  if (!value) return null;
  return (
    <View style={[
      { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: theme.colors.secondary, justifyContent: 'center', alignItems: 'center' },
      !inline && { position: 'absolute', top: -4, right: -10 },
    ]}>
      <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 11, color: theme.colors.onSecondary }}>{value > 9 ? '9+' : value}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  // Frosted on the web and iOS-like everywhere: translucent, a hairline edge, a soft shadow in light
  bar: {
    backgroundColor: t.colors.bar,
    borderWidth: 1, borderColor: t.colors.barEdge,
    boxShadow: t.isDark ? '0px 10px 30px -12px rgba(0, 0, 0, 0.6)' : '0px 8px 24px -10px rgba(0, 0, 0, 0.16)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'saturate(160%) blur(16px)', WebkitBackdropFilter: 'saturate(160%) blur(16px)' } as object) : {}),
  },
  // box-none: taps in the gaps around the bar reach the page behind it
  bottomWrap: { position: 'absolute', left: Space.md + 2, right: Space.md + 2, pointerEvents: 'box-none' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', height: TAB_BAR_HEIGHT, paddingHorizontal: 4, borderRadius: Radius.pill },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 52 },
  bottomLabel: { fontFamily: Fonts.bodySemiBold, fontSize: 12 },
  createBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.colors.primary, justifyContent: 'center', alignItems: 'center' },

  topWrap: {
    position: 'absolute', top: TOP_BAR_TOP, left: Space.xl, right: Space.xl, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', pointerEvents: 'box-none',
  },
  topLogo: { paddingVertical: 6, paddingHorizontal: 4, borderRadius: Radius.md },
  // Centred on the window, whatever the widths of the logo and the right-hand group
  topCentre: { ...({ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const), alignItems: 'center', justifyContent: 'center' },
  topPill: { flexDirection: 'row', gap: 2, padding: 5, borderRadius: Radius.pill },
  topItem: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 15, borderRadius: Radius.pill },
  topItemOn: { backgroundColor: t.colors.text },
  topItemHover: { backgroundColor: t.colors.surfaceAlt },
  topLabel: { fontFamily: Fonts.bodySemiBold, fontSize: 14 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: Space.md - 2 },
  newEvent: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: Radius.pill, backgroundColor: t.colors.primary },
  me: { borderRadius: 22, padding: 2 },
  meOn: { borderWidth: 2, borderColor: t.colors.text, padding: 0 },
}));
