import NeedsYou, { NeedsYouItem } from '@/components/NeedsYou';
import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { ChipRow } from '@/components/ui/Chip';
import IconButton from '@/components/ui/IconButton';
import ListRow, { ListGroup } from '@/components/ui/ListRow';
import Logo from '@/components/ui/Logo';
import Poster, { PosterGlow, PosterSticker, PosterThumb } from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Screen, { MAX_WIDE_CONTENT_WIDTH } from '@/components/ui/Screen';
import TabScreen from '@/components/ui/TabScreen';
import { eventTheme, POSTER_PILL } from '@/constants/eventThemes';
import { Fonts, Radius, Space } from '@/constants/theme';
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
import { format, formatDistanceToNowStrict, isToday, isTomorrow } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

type EventWithRole = Event & { role: 'host' | 'attending' | 'invited'; rsvpStatus?: string };
type Filter = 'all' | 'hosting' | 'invited' | 'past';

type OpenBill = {
  receipt_id: string; event_id: string; event_title: string; description: string; payer_name: string | null;
  total_cents: number; share_cents: number | null; claimed: boolean;
};

// Where you stand with an event, in a few words
function standing(e: EventWithRole) {
  if (e.role === 'host') return 'Hosting';
  return { yes: "You're in", maybe: 'Maybe', no: "Can't go", requested: 'Asked to join' }[e.rsvpStatus ?? ''] ?? 'Invited';
}

function when(e: Pick<Event, 'date' | 'kind'>, pattern = 'EEE d MMM') {
  return e.kind === 'open' ? 'Time TBD' : format(new Date(e.date), pattern);
}

/** "In 2 days", "Tonight", "Tomorrow": kept current while the page is open. */
function useCountdown(date?: string) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!date) return;
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [date]);
  if (!date) return '';
  const d = new Date(date);
  if (d.getTime() <= Date.now()) return 'On now';
  if (isToday(d)) return d.getHours() >= 17 ? 'Tonight' : `In ${formatDistanceToNowStrict(d)}`;
  if (isTomorrow(d)) return 'Tomorrow';
  return `In ${formatDistanceToNowStrict(d, { unit: 'day', roundingMethod: 'ceil' })}`;
}

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
  const [goingCount, setGoingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const { isWide } = useLayout();
  const { obligations } = useObligations();

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
  const upcomingAll = events.filter((e) => new Date(e.date) >= now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  // Open events (8.7) are still picking a time, so they aren't the next plan yet
  const nextUp = upcomingAll.find((e) => e.kind !== 'open' && (e.role === 'host' || e.rsvpStatus === 'yes'));
  const countdown = useCountdown(nextUp?.date);

  // The "8 going" sticker on your own next event (hosts can count their guests)
  useEffect(() => {
    setGoingCount(null);
    if (!nextUp || nextUp.role !== 'host') return;
    supabase.from('rsvps').select('id', { count: 'exact', head: true }).eq('event_id', nextUp.id).eq('status', 'yes')
      .then(({ count }) => setGoingCount(count ?? null));
  }, [nextUp?.id, nextUp?.role]);

  if (loading) return <Screen style={styles.center}><ActivityIndicator color={theme.colors.textSecondary} size="large" /></Screen>;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const past = events.filter((e) => new Date(e.date) < now).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const rest = upcomingAll.filter((e) => e.id !== nextUp?.id);
  const lists: Record<Filter, EventWithRole[]> = {
    all: rest,
    hosting: upcomingAll.filter((e) => e.role === 'host'),
    invited: upcomingAll.filter((e) => e.role !== 'host'),
    past,
  };
  const shown = lists[filter];

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
      subtitle: `${b.event_title} · ${b.payer_name?.split(' ')[0] ?? 'Someone'}'s bill`,
      about: b.event_title,
    })),
    ...obligations
      .filter((o) => o.role === 'host' && o.kind !== 'split' && o.status === 'excuse_pending')
      .map((o): NeedsYouItem => ({
        key: `excuse:${o.id}`, kind: 'excuse', action: 'Review', onPress: () => openEvent(o.event_id),
        title: `${o.other_name?.split(' ')[0] ?? 'A guest'} sent an excuse`,
        subtitle: o.excuse ? `"${o.excuse}" · ${o.event_title}` : o.event_title,
        about: o.event_title,
      })),
    ...toMark.map((e): NeedsYouItem => ({
      key: `attendance:${e.id}`, kind: 'attendance', action: 'Mark', onPress: () => openEvent(e.id),
      title: 'Mark who came',
      subtitle: `${e.title} · started ${formatDistanceToNowStrict(new Date(e.date))} ago`,
      about: e.title,
    })),
    ...upcomingAll
      .filter((e) => e.rsvpStatus === 'invited')
      .map((e): NeedsYouItem => ({
        key: `invite:${e.id}`, kind: 'invite', action: 'Answer', onPress: () => openEvent(e.id),
        title: 'Are you coming?',
        subtitle: `${e.title} · ${when(e)}`,
        about: e.title,
      })),
  ];

  const nothingAtAll = events.length === 0;

  const header = (
    <>
      {!isWide && (
        <View style={styles.topRow}>
          <Logo size={30} />
          <IconButton icon="notifications-outline" label="Activity" badge={unreadActivity} onPress={openActivity} />
        </View>
      )}
      <View>
        <Text style={theme.type.caption}>Hey {firstName}</Text>
        <Text style={[theme.type.title, isWide && theme.type.display]} accessibilityRole="header">
          {nothingAtAll ? 'Nothing planned ' : 'Your '}
          <Text style={[styles.serif, isWide && { fontSize: 38 }]}>{nothingAtAll ? 'yet' : 'week'}</Text>
        </Text>
      </View>
    </>
  );

  const nextUpPoster = nextUp && (
    <PressableScale onPress={() => openEvent(nextUp.id)} scaleTo={0.985} accessibilityLabel={`Next up: ${nextUp.title}, ${countdown}`}>
      <Poster
        title={nextUp.title}
        theme={nextUp.theme}
        imageUrl={nextUp.cover_image}
        line={nextUp.poster_line || (nextUp.role === 'host' ? "you're hosting" : "you're in")}
        date={nextUp.date}
        place={nextUp.venue_name}
        height={isWide ? 280 : 196}
        maxTitleSize={isWide ? 96 : 64}
        top={<CountdownPill label={countdown} />}
        stickers={[
          ...(goingCount ? [{ label: `${goingCount} going`, tone: 'ink' } as PosterSticker] : []),
          ...(nextUp.stickers ?? []).map((s) => ({ label: s, tone: 'lime' } as PosterSticker)),
        ].slice(0, 2)}
      />
    </PressableScale>
  );

  const chips = (
    <ChipRow<Filter>
      options={[
        { value: 'all', label: 'All', count: upcomingAll.length },
        { value: 'hosting', label: 'Hosting', count: lists.hosting.length },
        { value: 'invited', label: 'Invited', count: lists.invited.length },
        { value: 'past', label: 'Past' },
      ]}
      value={filter}
      onChange={setFilter}
    />
  );

  const emptyText = {
    all: nextUp ? "That's everything coming up." : 'Nothing coming up. Plan something, or wait for an invite to land.',
    hosting: 'Nothing hosted coming up. Plan something and invite your people.',
    invited: "No invites coming up. When someone invites you, it'll land here.",
    past: 'Events you host or go to show up here afterwards.',
  }[filter];

  // Phones: rows with a poster thumbnail. Desktop: small posters in a grid.
  const list = shown.length === 0 ? (
    filter === 'all' && nextUp ? null : <Text style={[theme.type.bodySecondary, styles.emptyLine]}>{emptyText}</Text>
  ) : isWide ? (
    <View key={filter} style={styles.grid}>
      {shown.map((e, i) => (
        <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(i, 6) * 50).springify().damping(18)} style={styles.gridItem}>
          <PressableScale onPress={() => openEvent(e.id)} scaleTo={0.98} accessibilityLabel={`${e.title}, ${when(e)}, ${standing(e)}`}>
            <Poster
              title={e.title} theme={e.theme} imageUrl={e.cover_image} date={e.date} open={e.kind === 'open'}
              height={170} lift={false} radius={16} maxTitleSize={40} wobble={false}
              stickers={[{ label: standing(e), tone: 'light' }]}
            />
          </PressableScale>
        </Animated.View>
      ))}
    </View>
  ) : (
    <Animated.View key={filter} entering={FadeInDown.springify().damping(18)}>
      <ListGroup>
        {shown.map((e) => <EventRow key={e.id} event={e} onPress={() => openEvent(e.id)} />)}
      </ListGroup>
    </Animated.View>
  );

  const firstTime = (
    <View style={{ gap: Space.lg }}>
      <View style={{ opacity: 0.94 }}>
        <Poster title="Your thing" theme="lime" line="make it happen" height={230} stickers={[{ label: 'sample', tone: 'light' }]} date={null} />
      </View>
      <Text style={[theme.type.bodySecondary, { textAlign: 'center' }]}>Make a poster, send the link, see who's really in.</Text>
      <Button title="Plan something" icon="add" onPress={planEvent} style={{ alignSelf: 'center' }} />
    </View>
  );

  const glowTheme = nothingAtAll ? 'lime' : nextUp?.theme;

  return (
    <TabScreen
      maxWidth={isWide ? MAX_WIDE_CONTENT_WIDTH : undefined}
      contentContainerStyle={[styles.content, isWide && styles.contentWide]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor={theme.colors.textSecondary} />}
    >
      {glowTheme && <PosterGlow theme={glowTheme} imageUrl={nextUp?.cover_image} top={isWide ? 60 : 110} height={isWide ? 400 : 320} />}
      {isWide ? (
        <View style={styles.wideRow}>
          <View style={styles.wideMain}>
            {header}
            {nothingAtAll ? firstTime : (
              <>
                {nextUpPoster}
                {chips}
                {list}
              </>
            )}
          </View>
          <View style={styles.aside}>
            {needsYou.length > 0 && <NeedsYou items={needsYou} heading />}
            <LatestActivity onPress={openEvent} />
          </View>
        </View>
      ) : (
        <>
          {header}
          {nothingAtAll ? firstTime : (
            <>
              {nextUpPoster}
              <NeedsYou items={needsYou} />
              {chips}
              {list}
            </>
          )}
        </>
      )}
    </TabScreen>
  );
}

function CountdownPill({ label }: { label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.pill}>
      <Ionicons name="time-outline" size={13} color={styles.pillText.color as string} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function EventRow({ event, onPress }: { event: EventWithRole; onPress: () => void }) {
  const t = eventTheme(event.theme);
  const invited = event.rsvpStatus === 'invited';
  return (
    <ListRow
      leading={<PosterThumb title={event.title} theme={event.theme} imageUrl={event.cover_image} />}
      title={event.title}
      subtitle={`${when(event)} · ${standing(event)}`}
      onPress={onPress}
      accessibilityLabel={`${event.title}, ${when(event)}, ${standing(event)}`}
      trailing={invited ? <Button title="RSVP" size="sm" color={{ bg: t.a, fg: t.ink }} onPress={onPress} /> : undefined}
      chevron={!invited}
    />
  );
}

function LatestActivity({ onPress }: { onPress: (id: string) => void }) {
  const { theme } = useTheme();
  const [items, setItems] = useState<Notification[]>([]);
  useFocusEffect(useCallback(() => {
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(4)
      .then(({ data }) => setItems(data ?? []));
  }, []));
  if (items.length === 0) return null;
  return (
    <View style={{ gap: Space.sm }}>
      <Text style={theme.type.label}>Latest</Text>
      <ListGroup>
        {items.map((n) => (
          <ListRow
            key={n.id}
            leading={<Avatar name={n.data.actor_name ?? null} seed={n.actor_id ?? n.id} size={32} />}
            title={describe(n, theme).text}
            titleLines={2}
            subtitle={`${formatDistanceToNowStrict(new Date(n.created_at))} ago`}
            // Cancelled events no longer exist, so those rows aren't tappable
            onPress={n.event_id ? () => onPress(n.event_id!) : undefined}
          />
        ))}
      </ListGroup>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  center: { justifyContent: 'center', alignItems: 'center' },
  // Phones: TabScreen sets the top and bottom padding (safe area, floating bar)
  content: { paddingHorizontal: Space.lg, paddingTop: Space.md, gap: Space.lg },
  contentWide: { paddingHorizontal: Space.xxl, paddingTop: 0, gap: Space.xl },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serif: { fontFamily: Fonts.serif, fontSize: 31, letterSpacing: -0.3 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 11,
    borderRadius: Radius.pill, backgroundColor: POSTER_PILL,
  },
  pillText: { fontFamily: Fonts.bodySemiBold, fontSize: 13, color: t.colors.scrim },
  emptyLine: { textAlign: 'center', paddingVertical: Space.lg },
  wideRow: { flexDirection: 'row', gap: Space.xxl, alignItems: 'flex-start' },
  wideMain: { flex: 1, gap: Space.lg, minWidth: 0 },
  aside: { width: 320, gap: Space.lg, paddingTop: 52 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  gridItem: { width: '31.5%', minWidth: 180, flexGrow: 1, maxWidth: '33%' },
}));
