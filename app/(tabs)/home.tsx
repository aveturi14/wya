import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Event, Rsvp } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type EventWithRole = Event & { role: 'host' | 'attending' | 'invited'; rsvpStatus?: string };

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<EventWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');

  const fetchEvents = useCallback(async () => {
    if (!user) return;

    const now = new Date().toISOString();

    const [hostedRes, rsvpRes] = await Promise.all([
      supabase.from('events').select('*').eq('host_id', user.id),
      supabase
        .from('rsvps')
        .select('*, event:events(*)')
        .eq('user_id', user.id),
    ]);

    const hosted: EventWithRole[] = (hostedRes.data ?? []).map((e) => ({ ...e, role: 'host' }));
    const rsvped: EventWithRole[] = (rsvpRes.data ?? [])
      .filter((r: any) => r.event && r.event.host_id !== user.id)
      .map((r: any) => ({ ...r.event, role: r.status === 'yes' ? 'attending' : 'invited', rsvpStatus: r.status }));

    const all = [...hosted, ...rsvped];
    const unique = all.filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i);
    setEvents(unique);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filtered = events.filter((e) => {
    const isPast = new Date(e.date) < new Date();
    return filter === 'past' ? isPast : !isPast;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor={Colors.accent} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {profile?.full_name?.split(' ')[0] ?? 'there'} 👋</Text>
          <Text style={styles.subtitle}>Your events</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['upcoming', 'past'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No {filter} events</Text>
          <Text style={styles.emptySubtext}>
            {filter === 'upcoming' ? 'Create an event or wait for invites' : 'Past events will appear here'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} onPress={() => router.push(`/event/${event.id}`)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function EventCard({ event, onPress }: { event: EventWithRole; onPress: () => void }) {
  const roleColor = event.role === 'host' ? Colors.accent : event.rsvpStatus === 'yes' ? Colors.success : Colors.warning;
  const roleLabel = event.role === 'host' ? 'Hosting' : event.rsvpStatus === 'yes' ? 'Going' : event.rsvpStatus === 'maybe' ? 'Maybe' : 'Invited';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {event.cover_image ? (
        <Image source={{ uri: event.cover_image }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Ionicons name="calendar" size={32} color={Colors.textMuted} />
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '22', borderColor: roleColor + '44' }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
          </View>
        </View>
        <Text style={styles.cardDate}>
          <Ionicons name="calendar-outline" size={12} /> {format(new Date(event.date), 'EEE, MMM d · h:mm a')}
        </Text>
        <Text style={styles.cardVenue} numberOfLines={1}>
          <Ionicons name="location-outline" size={12} /> {event.venue_name ?? event.address}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  greeting: { fontSize: 28, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginTop: 2 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { color: Colors.textSecondary, fontWeight: '500', fontSize: 14 },
  filterTextActive: { color: Colors.background },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: Colors.text, fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  list: { paddingHorizontal: 20, gap: 16, paddingBottom: 100 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  cardImage: { width: '100%', height: 160 },
  cardImagePlaceholder: { backgroundColor: Colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: 16, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 8 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  roleText: { fontSize: 12, fontWeight: '600' },
  cardDate: { fontSize: 13, color: Colors.textSecondary },
  cardVenue: { fontSize: 13, color: Colors.textMuted },
});
