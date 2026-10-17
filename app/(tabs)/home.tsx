import ActivityWidget from '@/components/home/ActivityWidget';
import AlbumWidget from '@/components/home/AlbumWidget';
import Commitment from '@/components/home/Commitment';
import Headline from '@/components/home/Headline';
import HeroEvent, { HeroRole } from '@/components/home/HeroEvent';
import PledgesWidget from '@/components/home/PledgesWidget';
import PollWidget from '@/components/home/PollWidget';
import Ticker from '@/components/home/Ticker';
import NeedsYou, { NeedsYouItem } from '@/components/NeedsYou';
import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CountToggle from '@/components/ui/CountToggle';
import EmptyState from '@/components/ui/EmptyState';
import EventCover from '@/components/ui/EventCover';
import IconButton from '@/components/ui/IconButton';
import Logo from '@/components/ui/Logo';
import PressableScale from '@/components/ui/PressableScale';
import Screen from '@/components/ui/Screen';
import { haptics } from '@/lib/haptics';
import Sticker from '@/components/ui/Sticker';
import TabScreen from '@/components/ui/TabScreen';
import { Fonts, linear, Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useLayout } from '@/hooks/useLayout';
import { useObligations } from '@/hooks/useObligations';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { useUnread } from '@/hooks/useUnread';
import { EVENT_COLUMNS, withAddresses } from '@/lib/events';
import { Notification } from '@/lib/notifications';
import { canMarkAttendance, formatMoney } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

type EventWithRole = Event & { role: 'host' | 'attending' | 'invited'; rsvpStatus?: string };
type ListChoice = 'hosting' | 'invited';

// Hosting / Invited is remembered on this device (per account) once you pick one
const listKey = (userId: string) => `wya.eventsList.${userId}`;

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { activity: unreadActivity, refresh: refreshBadges } = useUnread();
  usePageTitle('Your events');
  const [events, setEvents] = useState<EventWithRole[]>([]);
  // Hosted events that have started and whose Who came? hasn't been filled in
  const [toMark, setToMark] = useState<EventWithRole[]>([]);
  // Latest Activity, for the ticker and the Activity card
  const [notes, setNotes] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [savedList, setSavedList] = useState<ListChoice | null>(null);
  const { isWide } = useLayout();
  const { obligations, reload: reloadObligations } = useObligations();
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
    const [hostedRes, rsvpRes] = await Promise.all([
      supabase.from('events').select(EVENT_COLUMNS).eq('host_id', user.id),
      supabase.from('rsvps').select(`*, event:events(${EVENT_COLUMNS})`).eq('user_id', user.id),
    ]);
    type Row = Omit<EventWithRole, 'address'>;
    const hosted: Row[] = (hostedRes.data ?? []).map((e) => ({ ...(e as Omit<Event, 'address'>), role: 'host' }));
    // Events you've only asked to join aren't visible (the embed comes back empty), so they drop out here
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

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(12);
    setNotes(data ?? []);
  }, []);

  // Refresh on focus so events created or joined elsewhere show up right away
  useFocusEffect(useCallback(() => { fetchEvents(); fetchNotes(); }, [fetchEvents, fetchNotes]));

  const now = new Date();
  const byTime = (a: EventWithRole, b: EventWithRole) =>
    (new Date(a.date).getTime() - new Date(b.date).getTime()) * (filter === 'past' ? -1 : 1);
  const timeMatch = (e: EventWithRole) => filter === 'past' ? new Date(e.date) < now : new Date(e.date) >= now;
  const hosting = events.filter((e) => e.role === 'host' && timeMatch(e)).sort(byTime);
  const invited = events.filter((e) => e.role !== 'host' && timeMatch(e)).sort(byTime);

  if (loading) return <Screen style={styles.center}><ActivityIndicator color={theme.colors.primary} size="large" /></Screen>;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const committed = (e: EventWithRole) => e.role === 'host' || e.rsvpStatus === 'yes';
  const upcomingAll = events.filter((e) => new Date(e.date) >= now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  // On right now (started, not over: the end time, or 6 hours if there isn't one)
  const happening = events.filter((e) => {
    const start = new Date(e.date).getTime();
    const end = e.end_date ? new Date(e.end_date).getTime() : start + 6 * 3_600_000;
    return start <= now.getTime() && now.getTime() < end && committed(e);
  });
  // The hero: what's on now, else your next real plan, else the next thing you're asked to
  const hero = happening[0] ?? upcomingAll.find(committed) ?? upcomingAll.find((e) => e.rsvpStatus !== 'no');
  const heroRole: HeroRole = hero?.role === 'host' ? 'host' : ((hero?.rsvpStatus as HeroRole) ?? 'invited');
  const planCount = happening.length + upcomingAll.filter(committed).length;

  // Until you pick, show the list with the soonest event (the latest one on Past)
  const soonest = [...hosting, ...invited].sort(byTime)[0];
  const list: ListChoice = savedList ?? (soonest?.role === 'host' || !soonest ? 'hosting' : 'invited');
  const shown = list === 'hosting' ? hosting : invited;

  const gap = Space.xl;
  const cols = isWide ? Math.max(2, Math.floor((gridWidth + gap) / (340 + gap))) : 1;
  const itemWidth = cols > 1 && gridWidth ? (gridWidth - gap * (cols - 1)) / cols : undefined;
  const openEvent = (id: string) => router.push(`/event/${id}`);
  const openChat = (id: string) => router.push(`/event/${id}?tab=chat`);
  const openPhotos = (id: string) => router.push(`/event/${id}?tab=photos`);
  const openActivity = () => router.push('/activity');
  const planEvent = () => router.push('/(tabs)/create');
  const eventTitle = (id: string) => events.find((e) => e.id === id)?.title;

  // Same read rules as the Activity page: tapping an item marks it read
  const readNote = (n: Notification) => {
    if (n.read_at) return;
    setNotes((all) => all.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id).then(() => refreshBadges());
  };
  const markAllRead = async () => {
    await supabase.rpc('mark_notifications_read');
    fetchNotes();
    refreshBadges();
  };

  const needsYou: NeedsYouItem[] = [
    ...obligations
      .filter((o) => o.role === 'guest' && (o.status === 'owed' || o.status === 'disputed'))
      .map((o): NeedsYouItem => {
        const name = o.other_name?.split(' ')[0] ?? 'the host';
        return {
          key: `owe:${o.id}`, kind: 'owe', action: 'Pay', onPress: () => openEvent(o.event_id),
          title: `You owe ${name} ${formatMoney(o.amount_cents)}`,
          subtitle: o.status === 'disputed'
            ? `${name} hasn't received it · ${o.event_title}`
            : `${o.event_title} · ${o.reason === 'late_cancel' ? 'cancelled late' : 'missed it'}`,
        };
      }),
    ...obligations
      .filter((o) => o.role === 'host' && o.status === 'excuse_pending')
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

  const topBar = (
    <View style={styles.topRow}>
      <Logo size={isWide ? 30 : 34} />
      <View style={styles.topActions}>
        <IconButton icon="notifications-outline" label="Activity" badge={unreadActivity} onPress={openActivity} size={isWide ? 46 : 42} />
        <PressableScale onPress={() => router.push('/(tabs)/account')} accessibilityLabel="You" scaleTo={0.94}>
          <Avatar name={profile?.full_name ?? null} url={profile?.avatar_url} seed={user?.id ?? 'me'} size={isWide ? 46 : 42} />
        </PressableScale>
      </View>
    </View>
  );

  // The board's "New plan": an ink pill with a gradient + (white pill on dark)
  const newPlan = (
    <PressableScale onPress={planEvent} style={styles.newPlan} accessibilityLabel="New plan">
      <Text style={styles.newPlanText}>New plan</Text>
      <View style={[styles.newPlanPlus, theme.gradient(linear(theme.gradients.headlineWarm, 135))]}>
        <Ionicons name="add" size={20} color={theme.colors.onScrim} />
      </View>
    </PressableScale>
  );

  // The section title doubles as the Upcoming / Past switch, which saves a row
  const timeTitle = (
    <PressableScale
      haptic={false}
      scaleTo={0.97}
      onPress={() => { haptics.select(); setFilter(filter === 'upcoming' ? 'past' : 'upcoming'); }}
      style={styles.timeTitle}
      accessibilityRole="button"
      accessibilityLabel={filter === 'upcoming' ? 'Showing upcoming events. Show past events' : 'Showing past events. Show upcoming events'}
    >
      <Text style={theme.type.title}>{filter === 'upcoming' ? 'Upcoming' : 'Past'}</Text>
      <Ionicons name="chevron-down" size={18} color={theme.colors.textMuted} style={styles.timeChevron} />
    </PressableScale>
  );

  const toggles = (
    <CountToggle<ListChoice>
      options={[{ value: 'invited', label: 'Invited', count: invited.length }, { value: 'hosting', label: 'Hosting', count: hosting.length }]}
      value={list}
      onChange={chooseList}
    />
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

  const plans = (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, !isWide && { flexDirection: 'column', alignItems: 'flex-start' }]}>
        {timeTitle}
        {toggles}
      </View>
      {listView}
    </View>
  );

  const heroBlock = hero && <HeroEvent event={hero} role={heroRole} onOpen={() => openEvent(hero.id)} big={isWide} />;
  const commitment = hero && (hero.role === 'host' || hero.rsvpStatus === 'yes' || hero.rsvpStatus === 'maybe')
    ? <Commitment event={hero} isHost={hero.role === 'host'} big={isWide} />
    : null;

  return (
    <TabScreen
      maxWidth={isWide ? DASHBOARD_WIDTH : undefined}
      contentContainerStyle={[styles.content, isWide && styles.contentWide]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); fetchNotes(); reloadObligations(); }} tintColor={theme.colors.primary} />}
    >
      {topBar}
      {isWide ? (
        <>
          <View style={styles.headlineRow}>
            <Headline name={firstName} planCount={planCount} big />
            {newPlan}
          </View>
          <Ticker items={notes} />
          {hero && (
            <View style={styles.row}>
              <View style={{ flex: 2, minWidth: 0 }}>{heroBlock}</View>
              {commitment && <View style={{ flex: 1, minWidth: 300 }}>{commitment}</View>}
            </View>
          )}
          <View style={styles.row}>
            <PledgesWidget obligations={obligations} onOpen={openEvent} />
            <PollWidget eventTitle={eventTitle} onOpen={openChat} />
            <ActivityWidget items={notes} unread={unreadActivity} onMarkAllRead={markAllRead} onRead={readNote} />
          </View>
          <View style={styles.row}>
            {needsYou.length > 0 && <View style={{ flex: 1, minWidth: 0 }}><NeedsYou items={needsYou} /></View>}
            <AlbumWidget onOpen={openPhotos} big />
          </View>
          {plans}
        </>
      ) : (
        <>
          <Headline name={firstName} planCount={planCount} big={false} />
          <Ticker items={notes} />
          {heroBlock}
          <NeedsYou items={needsYou} />
          {commitment}
          <PledgesWidget obligations={obligations} onOpen={openEvent} />
          <PollWidget eventTitle={eventTitle} onOpen={openChat} />
          {plans}
          <AlbumWidget onOpen={openPhotos} big={false} />
        </>
      )}
    </TabScreen>
  );
}

// The dashboard is a little wider than other desktop pages (three cards across)
const DASHBOARD_WIDTH = 1240;

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
          <Text style={[theme.type.label, { fontSize: 10 }]}>{format(date, 'MMM').toUpperCase()}</Text>
          <Text style={[theme.type.heading, { lineHeight: 22 }]}>{format(date, 'd')}</Text>
        </View>
        <Sticker label={badge.label} bg={badge.bg} fg={badge.fg} style={styles.badge} />
      </View>
      <View style={styles.cardBody}>
        <Text style={theme.type.cardTitle} numberOfLines={1}>{event.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={c.textSecondary} />
          <Text style={theme.type.caption}>{format(date, 'EEE · h:mm a')}</Text>
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
  content: { padding: Space.xl, paddingTop: Space.lg, gap: Space.xl },
  contentWide: { paddingHorizontal: Space.xxl, paddingTop: Space.xl, gap: Space.xl },
  // A sliver of padding so the bell's edge never meets the status-bar strip
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  headlineRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Space.xl, marginTop: Space.md },
  newPlan: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingLeft: 24, paddingRight: 6, paddingVertical: 6,
    borderRadius: Radius.pill, backgroundColor: t.colors.text, ...t.shadow(3),
  },
  newPlanText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: t.colors.background },
  newPlanPlus: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.secondary },
  row: { flexDirection: 'row', gap: Space.xl, alignItems: 'stretch' },
  section: { gap: Space.lg, marginTop: Space.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.md },
  timeTitle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6 },
  // Sits on the title's baseline-ish; small on purpose (a hint, not a control)
  timeChevron: { marginTop: 4 },
  list: { gap: Space.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.xl },
  planTile: {
    minHeight: 240, borderRadius: Radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.colors.textMuted,
    justifyContent: 'center', alignItems: 'center', gap: Space.sm,
  },
  planTileHover: { backgroundColor: t.colors.glass },
  cover: { height: 160 },
  dateChip: {
    position: 'absolute', top: Space.md, left: Space.md, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.md, ...t.glass,
  },
  badge: { position: 'absolute', top: Space.md, right: Space.md },
  cardBody: { padding: Space.lg, gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
}));
