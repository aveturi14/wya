import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Type } from '@/constants/typography';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filtered = events
    .filter((e) => filter === 'past' ? new Date(e.date) < new Date() : new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor={Colors.accent} />}
    >
      <View style={styles.header}>
        <View style={styles.headerGlow} />
        <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
        <Text style={styles.name}>{firstName}</Text>
      </View>

      <View style={styles.filterRow}>
        {(['upcoming', 'past'] as const).map((f) => (
          <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && styles.filterBtnActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>No {filter} events</Text>
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

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function EventCard({ event, onPress }: { event: EventWithRole; onPress: () => void }) {
  const isHost = event.role === 'host';
  const isGoing = event.rsvpStatus === 'yes';
  const isMaybe = event.rsvpStatus === 'maybe';
  const badgeColor = isHost ? Colors.accentMid : isGoing ? Colors.success : isMaybe ? Colors.warning : Colors.textSecondary;
  const badgeBg = isHost ? Colors.accentSubtle : isGoing ? Colors.successSubtle : isMaybe ? Colors.warningSubtle : Colors.surfaceHigh;
  const badgeLabel = isHost ? 'Hosting' : isGoing ? 'Going' : isMaybe ? 'Maybe' : 'Invited';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {event.cover_image
        ? <Image source={{ uri: event.cover_image }} style={styles.cardImage} />
        : <View style={[styles.cardImage, styles.cardImagePlaceholder]}><Ionicons name="calendar" size={28} color={Colors.accent} /></View>}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
          </View>
        </View>
        <View style={styles.cardMeta}>
          <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
          <Text style={styles.metaText}>{format(new Date(event.date), 'EEE, MMM d')}</Text>
          <View style={styles.metaDot} />
          <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
          <Text style={styles.metaText}>{format(new Date(event.date), 'h:mm a')}</Text>
        </View>
        <View style={styles.cardVenueRow}>
          <Ionicons name="location-outline" size={11} color={Colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>{event.venue_name ?? event.address}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentContainer: { paddingBottom: 100 },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 28, overflow: 'hidden' },
  headerGlow: { position: 'absolute', top: -40, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.accentGlow, opacity: 0.5 },
  greeting: { fontSize: 16, fontFamily: Fonts.bodyMedium, color: Colors.textSecondary, letterSpacing: 0.3 },
  name: { fontSize: 38, fontFamily: Fonts.displayBold, color: Colors.text, letterSpacing: -0.5, marginTop: 2 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 8, marginBottom: 24 },
  filterBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 24, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  filterBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  filterText: { ...Type.badge, color: Colors.textSecondary, fontSize: 13 },
  filterTextActive: { color: Colors.white },
  empty: { alignItems: 'center', paddingTop: 80, gap: 14 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accentSubtle, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { ...Type.cardTitle, fontSize: 24 },
  emptySubtext: { ...Type.description, textAlign: 'center', paddingHorizontal: 40, lineHeight: 22 },
  list: { paddingHorizontal: 20, gap: 16 },
  card: { backgroundColor: Colors.surface, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  cardImage: { width: '100%', height: 170 },
  cardImagePlaceholder: { backgroundColor: Colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: 16, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...Type.cardTitle, flex: 1, marginRight: 10 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { ...Type.badge },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardVenueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { ...Type.meta, fontSize: 12 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textMuted },
});
