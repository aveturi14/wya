import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import EventCover from '@/components/ui/EventCover';
import Logo from '@/components/ui/Logo';
import PressableScale from '@/components/ui/PressableScale';
import Screen, { MAX_WIDE_CONTENT_WIDTH } from '@/components/ui/Screen';
import Segmented from '@/components/ui/Segmented';
import Sticker from '@/components/ui/Sticker';
import { Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useLayout } from '@/hooks/useLayout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { describe, Notification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

type EventWithRole = Event & { role: 'host' | 'attending' | 'invited'; rsvpStatus?: string };

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  usePageTitle('Your events');
  const [events, setEvents] = useState<EventWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
  const { isWide } = useLayout();
  const [gridWidth, setGridWidth] = useState(0);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    const [hostedRes, rsvpRes] = await Promise.all([
      supabase.from('events').select('*').eq('host_id', user.id),
      supabase.from('rsvps').select('*, event:events(*)').eq('user_id', user.id),
    ]);
    const hosted: EventWithRole[] = (hostedRes.data ?? []).map((e) => ({ ...e, role: 'host' }));
    const rsvped: EventWithRole[] = (rsvpRes.data ?? [])
      .filter((r: any) => r.event && r.event.host_id !== user.id)
      .map((r: any) => ({ ...r.event, role: r.status === 'yes' ? 'attending' : 'invited', rsvpStatus: r.status }));
    const unique = [...hosted, ...rsvped].filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i);
    setEvents(unique);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  // Refresh on focus so events created or joined elsewhere show up right away
  useFocusEffect(useCallback(() => { fetchEvents(); }, [fetchEvents]));

  const now = new Date();
  const filtered = events
    .filter((e) => (filter === 'past' ? new Date(e.date) < now : new Date(e.date) >= now))
    // Soonest first for upcoming, most recent first for past
    .sort((a, b) => (new Date(a.date).getTime() - new Date(b.date).getTime()) * (filter === 'past' ? -1 : 1));

  if (loading) return <Screen style={styles.center}><ActivityIndicator color={theme.colors.primary} size="large" /></Screen>;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const upcoming = events.filter((e) => new Date(e.date) >= now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  // The next thing you're actually going to (hosting or said yes)
  const nextUp = upcoming.find((e) => e.role === 'host' || e.rsvpStatus === 'yes');
  // Invites you haven't answered and Maybes: exactly what wya wants people to resolve
  const needsAnswer = upcoming.filter((e) => e.rsvpStatus === 'invited' || e.rsvpStatus === 'maybe');

  // Desktop: as many ~360px+ columns as fit, at least 2
  const gap = Space.xl;
  const cols = isWide ? Math.max(2, Math.floor((gridWidth + gap) / (360 + gap))) : 1;
  const itemWidth = cols > 1 && gridWidth ? (gridWidth - gap * (cols - 1)) / cols : undefined;
  const openEvent = (id: string) => router.push(`/event/${id}`);

  const header = (
    <>
      {/* On desktop the sidebar already has the logo and New event */}
      {!isWide && (
        <View style={styles.topRow}>
          <Logo size={28} />
          <Button title="New event" icon="add" size="sm" onPress={() => router.push('/(tabs)/create')} />
        </View>
      )}
      <View style={styles.greeting}>
        <Text style={theme.type.bodySecondary}>Hey {firstName} 👋</Text>
        <Text style={theme.type.hero}>{filter === 'upcoming' ? (isWide ? "What's next?" : "What's\nnext?") : (isWide ? 'Been there.' : 'Been\nthere.')}</Text>
      </View>
    </>
  );

  const list = filtered.length === 0 ? (
    <EmptyState
      icon={filter === 'upcoming' ? 'sparkles-outline' : 'time-outline'}
      title={filter === 'upcoming' ? 'Nothing planned yet' : 'No past events'}
      body={filter === 'upcoming' ? 'Throw something together, or wait for an invite to land.' : 'Events you host or go to will show up here afterwards.'}
      action={filter === 'upcoming' ? <Button title="Plan an event" icon="add" onPress={() => router.push('/(tabs)/create')} /> : undefined}
    />
  ) : (
    <View style={cols > 1 ? styles.grid : styles.list} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
      {filtered.map((event, i) => (
        // Width lives on a plain wrapper: changing an animating view's style mid-entrance leaves it invisible on web
        <View key={event.id} style={itemWidth ? { width: itemWidth } : undefined}>
          <Animated.View entering={FadeInDown.delay(i * 70).springify().damping(16)}>
            <EventCard event={event} onPress={() => openEvent(event.id)} />
          </Animated.View>
        </View>
      ))}
      {cols > 1 && filter === 'upcoming' && (
        <PressableScale onPress={() => router.push('/(tabs)/create')} style={[styles.planTile, itemWidth ? { width: itemWidth } : undefined]} hoverStyle={styles.planTileHover}>
          <Ionicons name="add" size={32} color={theme.colors.textSecondary} />
          <Text style={theme.type.value}>Plan something</Text>
        </PressableScale>
      )}
    </View>
  );

  return (
    <Screen maxWidth={isWide ? MAX_WIDE_CONTENT_WIDTH : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, isWide && styles.contentWide]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor={theme.colors.primary} />}
      >
        {isWide ? (
          <View style={styles.wideRow}>
            <View style={styles.wideMain}>
              {header}
              <Segmented options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} value={filter} onChange={setFilter} />
              {list}
            </View>
            <View style={styles.aside}>
              <NextUp event={nextUp} onPress={openEvent} />
              <NeedsAnswer events={needsAnswer} onPress={openEvent} />
              <LatestActivity onPress={openEvent} onSeeAll={() => router.push('/(tabs)/activity')} />
            </View>
          </View>
        ) : (
          <>
            {header}
            {needsAnswer.length > 0 && <NeedsAnswer events={needsAnswer} onPress={openEvent} />}
            <Segmented options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} value={filter} onChange={setFilter} />
            {list}
          </>
        )}
      </ScrollView>
    </Screen>
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
            <Text style={theme.type.caption}>{e.rsvpStatus === 'maybe' ? 'You said maybe · ' : ''}{format(new Date(e.date), 'EEE, MMM d')}</Text>
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
        <Sticker label={badge.label} bg={badge.bg} fg={badge.fg} tilt={4} style={styles.badge} />
      </View>
      <View style={styles.cardBody}>
        <Text style={theme.type.cardTitle} numberOfLines={1}>{event.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={c.textSecondary} />
          <Text style={theme.type.caption}>{format(date, 'EEE · h:mm a')}</Text>
          <Ionicons name="location-outline" size={14} color={c.textSecondary} style={{ marginLeft: Space.sm }} />
          <Text style={[theme.type.caption, { flex: 1 }]} numberOfLines={1}>{event.venue_name ?? event.address}</Text>
        </View>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: Space.xl, paddingTop: Space.xxxl, paddingBottom: 120, gap: Space.xl },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { gap: Space.xs },
  list: { gap: Space.xl },
  contentWide: { paddingHorizontal: Space.xxl, paddingTop: Space.xxl },
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
