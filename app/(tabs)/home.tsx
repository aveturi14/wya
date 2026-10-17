import NeedsYou, { NeedsYouItem } from '@/components/NeedsYou';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CountToggle from '@/components/ui/CountToggle';
import EmptyState from '@/components/ui/EmptyState';
import EventCover from '@/components/ui/EventCover';
import IconButton from '@/components/ui/IconButton';
import Logo from '@/components/ui/Logo';
import PressableScale from '@/components/ui/PressableScale';
import Screen, { MAX_WIDE_CONTENT_WIDTH } from '@/components/ui/Screen';
import { haptics } from '@/lib/haptics';
import Sticker from '@/components/ui/Sticker';
import TabScreen from '@/components/ui/TabScreen';
import { Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useLayout } from '@/hooks/useLayout';
import { useObligations } from '@/hooks/useObligations';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { useUnread } from '@/hooks/useUnread';
import { EVENT_COLUMNS, withAddresses } from '@/lib/events';
import { describe, Notification } from '@/lib/notifications';
import { canMarkAttendance, formatMoney } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

type EventWithRole = Event & { role: 'host' | 'attending' | 'invited'; rsvpStatus?: string };
type ListChoice = 'hosting' | 'invited';

// Hosting / Invited is remembered on this device (per account) once you pick one
const listKey = (userId: string) => `wya.eventsList.${userId}`;

type OpenBill = {
  receipt_id: string; event_id: string; event_title: string; description: string; payer_name: string | null;
  total_cents: number; share_cents: number | null; claimed: boolean;
};

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { activity: unreadActivity } = useUnread();
  usePageTitle('Your events');
  const [events, setEvents] = useState<EventWithRole[]>([]);
  // Hosted events that have started and whose Who came? hasn't been filled in
  const [toMark, setToMark] = useState<EventWithRole[]>([]);
  // Bills waiting for you to tick what you had (8.18)
  const [openBills, setOpenBills] = useState<OpenBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [savedList, setSavedList] = useState<ListChoice | null>(null);
  const { isWide } = useLayout();
  const { obligations } = useObligations();
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    if (!user) return;
    AsyncStorage.getItem(listKey(user.id))
      .then((v) => setSavedList(v === 'hosting' || v === 'invited' ? v : null))
      .catch(() => {});
  }, [user]);
  const chooseList = (v: ListChoice) => {
    setSavedList(v);
    if (user) AsyncStorage.setItem(listKey(user.id), v).catch(() => {});
  };

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    const [hostedRes, rsvpRes, billsRes] = await Promise.all([
      supabase.from('events').select(EVENT_COLUMNS).eq('host_id', user.id),
      supabase.from('rsvps').select(`*, event:events(${EVENT_COLUMNS})`).eq('user_id', user.id),
      supabase.rpc('get_my_open_receipts'),
    ]);
    setOpenBills((billsRes.data ?? []) as OpenBill[]);
    type Row = Omit<EventWithRole, 'address'>;
    const hosted: Row[] = (hostedRes.data ?? []).map((e) => ({ ...(e as Omit<Event, 'address'>), role: 'host' }));
    const rsvped: Row[] = (rsvpRes.data ?? [])
      .filter((r: any) => r.event && r.event.host_id !== user.id)
      .map((r: any) => ({ ...r.event, role: r.status === 'yes' ? 'attending' : 'invited', rsvpStatus: r.status }));
    const unique = [...hosted, ...rsvped].filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i);

    // Who came? is open from the start until 7 days after; one cheap read of the
    // Going rows (hosts can read their events' RSVPs) tells which are still unmarked
    const markable = hosted.filter(canMarkAttendance);
    let unmarked: Row[] = [];
    if (markable.length > 0) {
      const { data: going } = await supabase.from('rsvps').select('event_id, attendance_marked_at')
        .in('event_id', markable.map((e) => e.id)).eq('status', 'yes');
      unmarked = markable.filter((e) => {
        const rows = (going ?? []).filter((r) => r.event_id === e.id);
        return rows.length > 0 && rows.every((r) => r.attendance_marked_at == null);
      });
    }

    // The database only hands out addresses this user may see (hidden on pledge events until you commit)
    setEvents(await withAddresses(unique));
    setToMark(unmarked as EventWithRole[]);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  // Refresh on focus so events created or joined elsewhere show up right away
  useFocusEffect(useCallback(() => { fetchEvents(); }, [fetchEvents]));

  const now = new Date();
  const byTime = (a: EventWithRole, b: EventWithRole) =>
    (new Date(a.date).getTime() - new Date(b.date).getTime()) * (filter === 'past' ? -1 : 1);
  const timeMatch = (e: EventWithRole) => filter === 'past' ? new Date(e.date) < now : new Date(e.date) >= now;
  const hosting = events.filter((e) => e.role === 'host' && timeMatch(e)).sort(byTime);
  const invited = events.filter((e) => e.role !== 'host' && timeMatch(e)).sort(byTime);

  if (loading) return <Screen style={styles.center}><ActivityIndicator color={theme.colors.primary} size="large" /></Screen>;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const upcomingAll = events.filter((e) => new Date(e.date) >= now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  // Open events (8.7) are still picking a time, so they aren't the next plan yet
  const nextUp = upcomingAll.find((e) => e.kind !== 'open' && (e.role === 'host' || e.rsvpStatus === 'yes'));
  const needsAnswer = upcomingAll.filter((e) => e.rsvpStatus === 'invited' || e.rsvpStatus === 'maybe');

  // Until you pick, show the list with the soonest event (the latest one on Past)
  const soonest = [...hosting, ...invited].sort(byTime)[0];
  const list: ListChoice = savedList ?? (soonest?.role === 'host' || !soonest ? 'hosting' : 'invited');
  const shown = list === 'hosting' ? hosting : invited;

  const gap = Space.xl;
  const cols = isWide ? Math.max(2, Math.floor((gridWidth + gap) / (360 + gap))) : 1;
  const itemWidth = cols > 1 && gridWidth ? (gridWidth - gap * (cols - 1)) / cols : undefined;
  const openEvent = (id: string) => router.push(`/event/${id}`);
  const openActivity = () => router.push('/activity');
  const planEvent = () => router.push('/(tabs)/create');

  const needsYou: NeedsYouItem[] = [
    ...obligations
      .filter((o) => o.role === 'guest' && (o.status === 'owed' || o.status === 'disputed'))
      .map((o): NeedsYouItem => {
        const name = o.other_name?.split(' ')[0] ?? 'the host';
        return {
          // Splits (8.3) open their pay page; pledges open the event, where the PayCard is
          key: `owe:${o.id}`, kind: 'owe', action: 'Pay',
          onPress: () => (o.kind === 'split' ? router.push(`/pay/${o.id}`) : openEvent(o.event_id)),
          title: `You owe ${name} ${formatMoney(o.amount_cents)}`,
          subtitle: o.status === 'disputed'
            ? `${name} hasn't received it · ${o.event_title}`
            : o.kind === 'split'
              ? `${o.description ?? 'Your share'} · ${o.event_title}`
              : `${o.event_title} · ${o.reason === 'late_cancel' ? 'cancelled late' : 'missed it'}`,
        };
      }),
    ...openBills.map((b): NeedsYouItem => ({
      key: `bill:${b.receipt_id}`, kind: 'bill', action: b.claimed ? 'Confirm' : 'Pick',
      onPress: () => router.push(`/receipt/${b.receipt_id}`),
      title: b.claimed && b.share_cents != null ? `Confirm your ${formatMoney(b.share_cents)} share` : 'What did you have?',
      subtitle: `${b.payer_name?.split(' ')[0] ?? 'Someone'} shared ${b.description} · ${b.event_title}`,
    })),
    ...obligations
      .filter((o) => o.role === 'host' && o.kind !== 'split' && o.status === 'excuse_pending')
      .map((o): NeedsYouItem => ({
        key: `excuse:${o.id}`, kind: 'excuse', action: 'Review', onPress: () => openEvent(o.event_id),
        title: `${o.other_name?.split(' ')[0] ?? 'A guest'} sent an excuse`,
        subtitle: o.excuse ? `"${o.excuse}" · ${o.event_title}` : o.event_title,
      })),
    ...toMark.map((e): NeedsYouItem => ({
      key: `attendance:${e.id}`, kind: 'attendance', action: 'Mark', onPress: () => openEvent(e.id),
      title: 'Who came?',
      subtitle: `${e.title} started ${formatDistanceToNowStrict(new Date(e.date))} ago`,
    })),
    ...upcomingAll
      .filter((e) => e.rsvpStatus === 'invited')
      .map((e): NeedsYouItem => ({
        key: `invite:${e.id}`, kind: 'invite', action: 'Answer', onPress: () => openEvent(e.id),
        title: 'Are you coming?',
        subtitle: `${e.title} · ${format(new Date(e.date), 'EEE d MMM')}`,
      })),
  ];

  // The page title doubles as the Upcoming / Past switch, which saves a row
  const timeTitle = (type: object) => (
    <PressableScale
      haptic={false}
      scaleTo={0.97}
      onPress={() => { haptics.select(); setFilter(filter === 'upcoming' ? 'past' : 'upcoming'); }}
      style={styles.timeTitle}
      accessibilityRole="button"
      accessibilityLabel={filter === 'upcoming' ? 'Showing upcoming events. Show past events' : 'Showing past events. Show upcoming events'}
    >
      <Text style={type}>{filter === 'upcoming' ? 'Upcoming' : 'Past'}</Text>
      <Ionicons name="chevron-down" size={18} color={theme.colors.textMuted} style={styles.timeChevron} />
    </PressableScale>
  );

  const header = (
    <>
      {isWide ? (
        <View style={styles.wideHeader}>
          <View style={styles.greeting}>
            <Text style={theme.type.bodySecondary}>Hey {firstName}</Text>
            {timeTitle(theme.type.hero)}
          </View>
          <IconButton icon="notifications-outline" label="Activity" badge={unreadActivity} onPress={openActivity} />
        </View>
      ) : (
        <>
          <View style={styles.topRow}>
            <Logo size={40} />
            <IconButton icon="notifications-outline" label="Activity" badge={unreadActivity} onPress={openActivity} size={42} />
          </View>
          <View style={styles.greetingPhone}>
            <Text style={theme.type.bodySecondary}>Hey {firstName}</Text>
            {timeTitle(theme.type.display)}
          </View>
        </>
      )}
    </>
  );

  const toggles = (
    <View style={styles.toggles}>
      <CountToggle<ListChoice>
        options={[{ value: 'invited', label: 'Invited', count: invited.length }, { value: 'hosting', label: 'Hosting', count: hosting.length }]}
        value={list}
        onChange={chooseList}
      />
    </View>
  );

  const empty = filter === 'upcoming'
    ? list === 'hosting'
      ? { title: 'Nothing hosted yet', body: 'Plan something and invite your people.', plan: true }
      : { title: 'No invites yet', body: "When someone invites you to something, it'll land here." }
    : list === 'hosting'
      ? { title: 'Nothing hosted yet', body: 'Events you host will show up here afterwards.' }
      : { title: 'No past invites', body: "Events you were invited to will show up here afterwards." };

  const bothEmpty = hosting.length === 0 && invited.length === 0;
  const listView = bothEmpty ? (
    <EmptyState
      icon={filter === 'upcoming' ? 'sparkles-outline' : 'time-outline'}
      title={filter === 'upcoming' ? 'Nothing planned yet' : 'No past events'}
      body={filter === 'upcoming' ? 'Throw something together, or wait for an invite to land.' : 'Events you host or go to will show up here afterwards.'}
      action={filter === 'upcoming' ? <Button title="Plan an event" icon="add" onPress={planEvent} /> : undefined}
    />
  ) : shown.length === 0 ? (
    <EmptyState
      icon={filter === 'upcoming' ? 'sparkles-outline' : 'time-outline'}
      title={empty.title}
      body={empty.body}
      action={'plan' in empty ? <Button title="Plan an event" icon="add" onPress={planEvent} /> : undefined}
    />
  ) : (
    // Keyed by the list, so switching replays the cards' entrance
    <View key={`${filter}:${list}`} style={cols > 1 ? styles.grid : styles.list} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
      {shown.map((event, i) => (
        <View key={event.id} style={itemWidth ? { width: itemWidth } : undefined}>
          <Animated.View entering={FadeInDown.delay(Math.min(i, 6) * 70).springify().damping(16)}>
            <EventCard event={event} onPress={() => openEvent(event.id)} />
          </Animated.View>
        </View>
      ))}
      {cols > 1 && list === 'hosting' && filter === 'upcoming' && (
        <PressableScale onPress={planEvent} style={[styles.planTile, itemWidth ? { width: itemWidth } : undefined]} hoverStyle={styles.planTileHover}>
          <Ionicons name="add" size={32} color={theme.colors.textSecondary} />
          <Text style={theme.type.value}>Plan something</Text>
        </PressableScale>
      )}
    </View>
  );

  return (
    <TabScreen
      maxWidth={isWide ? MAX_WIDE_CONTENT_WIDTH : undefined}
      contentContainerStyle={[styles.content, isWide && styles.contentWide]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor={theme.colors.primary} />}
    >
      {isWide ? (
        <View style={styles.wideRow}>
          <View style={styles.wideMain}>
            {header}
            {toggles}
            {listView}
          </View>
          <View style={styles.aside}>
            <NeedsYou items={needsYou} />
            <NextUp event={nextUp} onPress={openEvent} />
            <NeedsAnswer events={needsAnswer} onPress={openEvent} />
            <LatestActivity onPress={openEvent} onSeeAll={openActivity} />
          </View>
        </View>
      ) : (
        <>
          {header}
          {toggles}
          <NeedsYou items={needsYou} />
          {listView}
        </>
      )}
    </TabScreen>
  );
}

function NextUp({ event, onPress }: { event?: EventWithRole; onPress: (id: string) => void }) {
  const { theme } = useTheme();
  return (
    <Card onPress={event ? () => onPress(event.id) : undefined} style={{ gap: Space.xs }}>
      <Text style={theme.type.label}>Next up</Text>
      {event ? (
        <>
          <Text style={[theme.type.display, { color: theme.isDark ? theme.colors.primary : theme.colors.text }]}>
            {formatDistanceToNowStrict(new Date(event.date))}
          </Text>
          <Text style={theme.type.value} numberOfLines={1}>{event.title}</Text>
          <Text style={theme.type.caption}>{format(new Date(event.date), 'EEEE, MMM d · h:mm a')}</Text>
        </>
      ) : (
        <Text style={theme.type.bodySecondary}>Nothing on the calendar. Plan something?</Text>
      )}
    </Card>
  );
}

function LatestActivity({ onPress, onSeeAll }: { onPress: (id: string) => void; onSeeAll: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [items, setItems] = useState<Notification[]>([]);
  useFocusEffect(useCallback(() => {
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(3)
      .then(({ data }) => setItems(data ?? []));
  }, []));
  return (
    <Card style={{ gap: Space.md }}>
      <View style={styles.asideHeader}>
        <Text style={theme.type.label}>Latest</Text>
        <Button title="See all" variant="ghost" size="sm" onPress={onSeeAll} />
      </View>
      {items.length === 0 ? (
        <Text style={theme.type.bodySecondary}>RSVPs and changes to your plans will show up here.</Text>
      ) : items.map((n) => {
        const d = describe(n, theme);
        const content = (
          <>
            <View style={[styles.activityIcon, { backgroundColor: d.color }]}><Ionicons name={d.icon} size={14} color={d.onColor} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={theme.type.value} numberOfLines={2}>{d.text}</Text>
              <Text style={theme.type.caption}>{formatDistanceToNowStrict(new Date(n.created_at))} ago</Text>
            </View>
          </>
        );
        // Cancelled events no longer exist, so those rows aren't tappable (but shouldn't look disabled)
        return n.event_id ? (
          <PressableScale key={n.id} onPress={() => onPress(n.event_id!)} scaleTo={0.98} style={styles.answerRow} hoverStyle={styles.answerRowHover}>{content}</PressableScale>
        ) : (
          <View key={n.id} style={styles.answerRow}>{content}</View>
        );
      })}
    </Card>
  );
}

function NeedsAnswer({ events, onPress }: { events: EventWithRole[]; onPress: (id: string) => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <Card style={{ gap: Space.md }}>
      <View style={styles.asideHeader}>
        <Text style={theme.type.label}>Needs your answer</Text>
        {events.length > 0 && <Sticker label={String(events.length)} bg={theme.colors.secondary} fg={theme.colors.onSecondary} />}
      </View>
      {events.length === 0 ? (
        <Text style={theme.type.bodySecondary}>You're all caught up.</Text>
      ) : events.slice(0, 5).map((e) => (
        <PressableScale key={e.id} onPress={() => onPress(e.id)} scaleTo={0.98} style={styles.answerRow} hoverStyle={styles.answerRowHover}>
          <EventCover seed={e.id} title={e.title} theme={e.theme} imageUrl={e.cover_image} style={styles.answerThumb} initialSize={22} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={theme.type.value} numberOfLines={1}>{e.title}</Text>
            <Text style={theme.type.caption}>{e.rsvpStatus === 'maybe' ? 'You said maybe · ' : ''}{e.kind === 'open' ? 'Time TBD' : format(new Date(e.date), 'EEE, MMM d')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
        </PressableScale>
      ))}
    </Card>
  );
}

function EventCard({ event, onPress }: { event: EventWithRole; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  const date = new Date(event.date);
  // No address means the database is hiding it (pledge event, not committed yet)
  const locationLabel = event.venue_name || event.address || 'Address hidden';

  const badge = event.role === 'host'
    ? { label: 'Hosting', bg: c.surface, fg: c.text }
    : event.rsvpStatus === 'yes' ? { label: 'Going', bg: c.success, fg: c.onStatus }
    : event.rsvpStatus === 'maybe' ? { label: 'Maybe', bg: c.warning, fg: c.onStatus }
    : event.rsvpStatus === 'no' ? { label: 'Not going', bg: c.surfaceAlt, fg: c.textSecondary }
    : { label: 'Invited', bg: c.secondary, fg: c.onSecondary };

  return (
    <Card onPress={onPress} padded={false}>
      <View>
        <EventCover seed={event.id} title={event.title} theme={event.theme} imageUrl={event.cover_image} style={styles.cover} initialSize={110} />
        <View style={[styles.dateChip, { backgroundColor: c.surface }]}>
          <Text style={[theme.type.label, { fontSize: 10 }]}>{event.kind === 'open' ? 'TIME' : format(date, 'MMM').toUpperCase()}</Text>
          <Text style={[theme.type.heading, { lineHeight: 22 }]}>{event.kind === 'open' ? 'TBD' : format(date, 'd')}</Text>
        </View>
        <Sticker label={badge.label} bg={badge.bg} fg={badge.fg} tilt={4} style={styles.badge} />
      </View>
      <View style={styles.cardBody}>
        <Text style={theme.type.cardTitle} numberOfLines={1}>{event.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={c.textSecondary} />
          <Text style={theme.type.caption}>{event.kind === 'open' ? 'Time TBD' : format(date, 'EEE · h:mm a')}</Text>
          <Ionicons name="location-outline" size={14} color={c.textSecondary} style={{ marginLeft: Space.sm }} />
          <Text style={[theme.type.caption, { flex: 1 }]} numberOfLines={1}>{locationLabel}</Text>
        </View>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  center: { justifyContent: 'center', alignItems: 'center' },
  // Phones: TabScreen sets the top and bottom padding (safe area, floating bar)
  content: { padding: Space.xl, paddingTop: Space.xxxl, gap: 18 },
  // A sliver of padding so the bell's outline never meets the status-bar strip
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 },
  timeTitle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6 },
  // Sits on the title's baseline-ish; small on purpose (a hint, not a control)
  timeChevron: { marginTop: 6 },
  greeting: { gap: Space.xs },
  greetingPhone: { gap: 2 },
  wideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  toggles: { gap: 10 },
  list: { gap: Space.xl },
  contentWide: { paddingHorizontal: Space.xxl, paddingTop: Space.xxl, gap: Space.xl },
  wideRow: { flexDirection: 'row', gap: Space.xxl, alignItems: 'flex-start' },
  wideMain: { flex: 1, gap: Space.xl, minWidth: 0 },
  // Stays in view while the grid scrolls (web only; native has no sticky positioning)
  aside: { width: 320, gap: Space.lg, ...(Platform.OS === 'web' ? { position: 'sticky' as any, top: Space.xxl } : {}) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.xl },
  planTile: {
    minHeight: 240, borderRadius: Radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: t.colors.textMuted,
    justifyContent: 'center', alignItems: 'center', gap: Space.sm,
  },
  planTileHover: { backgroundColor: t.colors.surfaceAlt },
  asideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.xs, borderRadius: Radius.md },
  answerRowHover: { backgroundColor: t.colors.surfaceAlt },
  answerThumb: { width: 44, height: 44, borderRadius: Radius.sm },
  activityIcon: { width: 28, height: 28, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' },
  cover: { height: 160 },
  dateChip: {
    position: 'absolute', top: Space.md, left: Space.md, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.md, borderWidth: t.isDark ? 0 : t.outlineWidth, borderColor: t.colors.outline,
  },
  badge: { position: 'absolute', top: Space.md, right: Space.md },
  cardBody: { padding: Space.lg, gap: 6, borderTopWidth: t.outlineWidth, borderTopColor: t.colors.outline },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
}));
