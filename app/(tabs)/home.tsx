import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import EventCover from '@/components/ui/EventCover';
import Logo from '@/components/ui/Logo';
import Screen from '@/components/ui/Screen';
import Segmented from '@/components/ui/Segmented';
import Sticker from '@/components/ui/Sticker';
import { Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
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

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor={theme.colors.primary} />}
      >
        <View style={styles.topRow}>
          <Logo size={28} />
          <Button title="New event" icon="add" size="sm" onPress={() => router.push('/(tabs)/create')} />
        </View>

        <View style={styles.greeting}>
          <Text style={theme.type.bodySecondary}>Hey {firstName} 👋</Text>
          <Text style={theme.type.hero}>{filter === 'upcoming' ? "What's\nnext?" : 'Been\nthere.'}</Text>
        </View>

        <Segmented
          options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]}
          value={filter}
          onChange={setFilter}
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon={filter === 'upcoming' ? 'sparkles-outline' : 'time-outline'}
            title={filter === 'upcoming' ? 'Nothing planned yet' : 'No past events'}
            body={filter === 'upcoming' ? 'Throw something together, or wait for an invite to land.' : 'Events you host or go to will show up here afterwards.'}
            action={filter === 'upcoming' ? <Button title="Plan an event" icon="add" onPress={() => router.push('/(tabs)/create')} /> : undefined}
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((event, i) => (
              <Animated.View key={event.id} entering={FadeInDown.delay(i * 70).springify().damping(16)}>
                <EventCard event={event} onPress={() => router.push(`/event/${event.id}`)} />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
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
  cover: { height: 160 },
  dateChip: {
    position: 'absolute', top: Space.md, left: Space.md, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.md, borderWidth: t.isDark ? 0 : t.outlineWidth, borderColor: t.colors.outline,
  },
  badge: { position: 'absolute', top: Space.md, right: Space.md },
  cardBody: { padding: Space.lg, gap: 6, borderTopWidth: t.outlineWidth, borderTopColor: t.colors.outline },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
}));
