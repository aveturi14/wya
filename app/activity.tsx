import { WithTopBar } from '@/components/nav/AppTabBar';
import Button from '@/components/ui/Button';
import { IconSquare, ListGroup } from '@/components/ui/ListRow';
import { PosterThumb } from '@/components/ui/Poster';
import EmptyState from '@/components/ui/EmptyState';
import IconButton from '@/components/ui/IconButton';
import PressableScale from '@/components/ui/PressableScale';
import TabScreen from '@/components/ui/TabScreen';
import Screen from '@/components/ui/Screen';
import { Fonts, Space } from '@/constants/theme';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { useUnread } from '@/hooks/useUnread';
import { describe, Notification, notificationHref } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
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
  const { refresh: refreshBadges } = useUnread();
  usePageTitle('Activity');
  const [items, setItems] = useState<Notification[]>([]);
  // Each row wears its event's poster; cancelled events are gone, so they keep an icon
  const [posters, setPosters] = useState<Record<string, { title: string; theme: string; cover_image: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(60);
    setItems(data ?? []);
    const ids = [...new Set((data ?? []).map((n) => n.event_id).filter((id): id is string => !!id))];
    if (ids.length > 0) {
      const { data: evs } = await supabase.from('events').select('id, title, theme, cover_image').in('id', ids);
      setPosters(Object.fromEntries((evs ?? []).map((e) => [e.id, e])));
    }
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
      <Text style={theme.type.label}>{label}</Text>
      <ListGroup>
        {list.map((n) => {
          const d = describe(n, theme);
          const unread = !n.read_at;
          const ev = n.event_id ? posters[n.event_id] : undefined;
          const row = (
            <>
              {ev ? <PosterThumb title={ev.title} theme={ev.theme} imageUrl={ev.cover_image} /> : <IconSquare icon={d.icon} size={44} />}
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  <Emphasis text={d.text} words={[n.data.actor_name?.split(' ')[0], n.data.title]} />
                </Text>
                <Text style={theme.type.caption} numberOfLines={1}>{ev ? `${ev.title} · ` : ''}{when(n.created_at)}</Text>
              </View>
              {unread && <View style={styles.dot} accessibilityLabel="Unread" />}
            </>
          );
          return (
            n.event_id ? (
              <PressableScale key={n.id} scaleTo={0.99} onPress={() => open(n)} style={styles.row} hoverStyle={styles.rowHover}>{row}</PressableScale>
            ) : (
              // Cancelled events no longer exist, so there's nothing to open
              <View key={n.id} style={styles.row}>{row}</View>
            )
          );
        })}
      </ListGroup>
    </View>
  );

  const page = loading ? (
    <Screen style={styles.center}><ActivityIndicator color={theme.colors.textSecondary} size="large" /></Screen>
  ) : (
    <TabScreen
      withTabBar={false}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.textSecondary} />}
    >
      <View style={styles.topRow}>
        <IconButton icon="chevron-back" label="Back" onPress={goBack} />
        {anyUnread && <Button title="Mark all read" variant="ghost" size="sm" onPress={markAllRead} />}
      </View>
      <Text style={theme.type.title} accessibilityRole="header">Activity</Text>
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

  // Desktop keeps the top bar, like event pages do
  return <WithTopBar>{page}</WithTopBar>;
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
  content: { paddingHorizontal: Space.lg, paddingTop: Space.md, gap: Space.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  group: { gap: Space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.md, paddingHorizontal: Space.md + 2 },
  rowHover: { backgroundColor: t.colors.surfaceAlt },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { ...t.type.body, fontSize: 14, lineHeight: 19 },
  bold: { fontFamily: Fonts.bodySemiBold },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: t.colors.secondary },
}));
