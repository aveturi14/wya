import { StandaloneSidebar } from '@/components/nav/AppTabBar';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import IconButton from '@/components/ui/IconButton';
import PressableScale from '@/components/ui/PressableScale';
import Screen from '@/components/ui/Screen';
import TabScreen from '@/components/ui/TabScreen';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { useUnread } from '@/hooks/useUnread';
import { describe, Notification, notificationHref } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';

// "12 min ago" today, then "Yesterday", the weekday this week, and the date after that
function when(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return `${formatDistanceToNowStrict(d)} ago`;
  if (isYesterday(d)) return 'Yesterday';
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, 'EEE');
  return format(d, 'MMM d');
}

/** Activity, opened from the bell on the Events page (pushed on top of the tabs, no tab bar). */
export default function ActivityScreen() {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { isWide } = useLayout();
  const { refresh: refreshBadges } = useUnread();
  usePageTitle('Activity');
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(60);
    setItems(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Items stay unread until you open them or tap "Mark all read", so the bell
  // keeps meaning "something you haven't looked at"
  const markAllRead = async () => {
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase.rpc('mark_notifications_read');
    refreshBadges();
  };

  const open = async (n: Notification) => {
    if (!n.read_at) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id).then(() => refreshBadges());
    }
    router.push(notificationHref(n));
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'));

  const today = items.filter((n) => isToday(new Date(n.created_at)));
  const earlier = items.filter((n) => !isToday(new Date(n.created_at)));
  const anyUnread = items.some((n) => !n.read_at);

  const renderGroup = (label: string, list: Notification[]) => list.length > 0 && (
    <View style={styles.group}>
      <Text style={theme.type.sectionHeading}>{label}</Text>
      <Card padded={false}>
        {list.map((n, i) => {
          const d = describe(n, theme);
          const unread = !n.read_at;
          const row = (
            <>
              <View style={[styles.icon, { backgroundColor: d.color }]}><Ionicons name={d.icon} size={18} color={d.onColor} /></View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  <Emphasis text={d.text} words={[n.data.actor_name?.split(' ')[0], n.data.title]} />
                </Text>
                <Text style={theme.type.caption}>{when(n.created_at)}</Text>
              </View>
              {unread && <View style={styles.dot} accessibilityLabel="Unread" />}
            </>
          );
          return (
            <View key={n.id}>
              {i > 0 && <View style={styles.divider} />}
              {n.event_id ? (
                <PressableScale scaleTo={0.99} onPress={() => open(n)} style={styles.row} hoverStyle={styles.rowHover}>{row}</PressableScale>
              ) : (
                // Cancelled events no longer exist, so there's nothing to open
                <View style={styles.row}>{row}</View>
              )}
            </View>
          );
        })}
      </Card>
    </View>
  );

  const page = loading ? (
    <Screen style={styles.center}><ActivityIndicator color={theme.colors.primary} size="large" /></Screen>
  ) : (
    <TabScreen
      withTabBar={false}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
    >
      <View style={styles.topRow}>
        <IconButton icon="arrow-back" label="Back" onPress={goBack} size={44} />
        {anyUnread && (
          <PressableScale onPress={markAllRead} style={styles.markAll} hoverStyle={styles.markAllHover}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </PressableScale>
        )}
      </View>
      <Text style={theme.type.display}>Activity</Text>
      {items.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="Nothing yet"
          body="When guests RSVP to your events, or a host changes plans you're part of, it shows up here."
        />
      ) : (
        <>
          {renderGroup('Today', today)}
          {renderGroup('Earlier', earlier)}
        </>
      )}
    </TabScreen>
  );

  // Desktop keeps the sidebar, like event pages do
  if (!isWide) return page;
  return (
    <View style={styles.wide}>
      <StandaloneSidebar />
      <View style={{ flex: 1 }}>{page}</View>
    </View>
  );
}

/** The person's name and the event title in bold, the rest regular. */
function Emphasis({ text, words }: { text: string; words: (string | null | undefined)[] }) {
  const styles = useStyles();
  const targets = words.filter((w): w is string => !!w && w.length > 1);
  if (targets.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${targets.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
  return (
    <>
      {text.split(pattern).map((part, i) =>
        targets.includes(part) ? <Text key={i} style={styles.bold}>{part}</Text> : part)}
    </>
  );
}

const useStyles = makeStyles((t) => ({
  center: { justifyContent: 'center', alignItems: 'center' },
  wide: { flex: 1, flexDirection: 'row', backgroundColor: t.colors.background },
  content: { padding: Space.xl, paddingTop: Space.xxxl, gap: Space.xl },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  markAll: { paddingVertical: Space.sm, paddingHorizontal: 14, borderRadius: Radius.pill },
  markAllHover: { backgroundColor: t.colors.surfaceAlt },
  markAllText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: t.colors.primary },
  group: { gap: Space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 14, paddingHorizontal: Space.lg },
  rowHover: { backgroundColor: t.colors.surfaceAlt },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { ...t.type.body, fontSize: 14, lineHeight: 19 },
  bold: { fontFamily: Fonts.bodyBold },
  // Inset to line up with the text, not the icon
  divider: { height: 1, backgroundColor: t.colors.border, marginLeft: Space.lg + 40 + Space.md },
  icon: {
    width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
    borderWidth: t.outlineWidth, borderColor: t.colors.outline,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.primary },
}));
