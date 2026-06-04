import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Event, Rsvp, RsvpStatus } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [host, setHost] = useState<any>(null);
  const [rsvp, setRsvp] = useState<Rsvp | null>(null);
  const [rsvpCounts, setRsvpCounts] = useState({ yes: 0, maybe: 0, no: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'details' | 'chat'>('details');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageIdx, setImageIdx] = useState(0);
  const chatRef = useRef<FlatList>(null);

  const isHost = event?.host_id === user?.id;
  const canChat = isHost || rsvp?.status === 'yes' || rsvp?.status === 'maybe';

  const fetchEvent = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').eq('id', id).single();
    if (data) {
      setEvent(data);
      const { data: hostData } = await supabase.from('profiles').select('*').eq('id', data.host_id).single();
      if (hostData) setHost(hostData);
    }

    if (user) {
      const { data: rsvpData } = await supabase.from('rsvps').select('*').eq('event_id', id).eq('user_id', user.id).single();
      if (rsvpData) { setRsvp(rsvpData); setAdditionalDetails(rsvpData.additional_details ?? ''); }
    }

    const { data: counts } = await supabase.from('rsvps').select('status').eq('event_id', id);
    if (counts) {
      setRsvpCounts({
        yes: counts.filter((r) => r.status === 'yes').length,
        maybe: counts.filter((r) => r.status === 'maybe').length,
        no: counts.filter((r) => r.status === 'no').length,
      });
    }
    setLoading(false);
  }, [id, user]);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('chat_messages').select('*').eq('event_id', id).order('created_at', { ascending: true });
    if (data) {
      const userIds = [...new Set(data.map((m: any) => m.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
      setMessages(data.map((m: any) => ({ ...m, profile: profileMap[m.user_id] })));
    }
  }, [id]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  useEffect(() => {
    if (tab === 'chat' && canChat) {
      fetchMessages();
      const channel = supabase
        .channel(`chat:${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${id}` }, () => fetchMessages())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [tab, canChat, id, fetchMessages]);

  const handleRsvp = async (status: RsvpStatus) => {
    if (!user || !status) return;
    const payload = { event_id: id, user_id: user.id, status, additional_details: additionalDetails };
    const { data, error } = rsvp
      ? await supabase.from('rsvps').update(payload).eq('id', rsvp.id).select().single()
      : await supabase.from('rsvps').insert(payload).select().single();
    if (!error && data) { setRsvp(data); fetchEvent(); }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    await supabase.from('chat_messages').insert({ event_id: id, user_id: user.id, content: newMessage.trim() });
    setNewMessage('');
  };

  const openDirections = () => {
    if (!event) return;
    const query = encodeURIComponent(event.address);
    if (Platform.OS === 'web') {
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    } else {
      Alert.alert('Get Directions', 'Choose your maps app', [
        { text: 'Apple Maps', onPress: () => Linking.openURL(`maps:?q=${query}`) },
        { text: 'Google Maps', onPress: () => Linking.openURL(`comgooglemaps://?q=${query}`) },
        { text: 'Waze', onPress: () => Linking.openURL(`waze://?q=${query}`) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const shareInvite = async () => {
    if (!event) return;
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(`wya://invite/${event.invite_code}`);
      Alert.alert('Copied!', 'Invite link copied to clipboard');
    } else {
      await Share.share({ message: `You're invited to ${event.title}! Join here: wya://invite/${event.invite_code}` });
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>;
  if (!event) return <View style={styles.center}><Text style={styles.errorText}>Event not found</Text></View>;

  const allImages = [event.cover_image, ...(event.venue_images ?? [])].filter(Boolean) as string[];

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.topBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.topBtn} onPress={shareInvite}>
            <Ionicons name="share-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'details' && styles.tabBtnActive]} onPress={() => setTab('details')}>
          <Text style={[styles.tabText, tab === 'details' && styles.tabTextActive]}>Details</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'chat' && styles.tabBtnActive]} onPress={() => setTab('chat')}>
          <Text style={[styles.tabText, tab === 'chat' && styles.tabTextActive]}>Chat</Text>
        </TouchableOpacity>
      </View>

      {tab === 'details' ? (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {allImages.length > 0 && (
            <View>
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                onScroll={(e) => setImageIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
                scrollEventThrottle={16}>
                {allImages.map((uri, i) => <Image key={i} source={{ uri }} style={styles.heroImage} />)}
              </ScrollView>
              {allImages.length > 1 && (
                <View style={styles.dots}>
                  {allImages.map((_, i) => <View key={i} style={[styles.dot, i === imageIdx && styles.dotActive]} />)}
                </View>
              )}
            </View>
          )}

          <View style={styles.content}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            {host && (
              <View style={styles.hostRow}>
                {host.avatar_url
                  ? <Image source={{ uri: host.avatar_url }} style={styles.hostAvatar} />
                  : <View style={[styles.hostAvatar, { backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: Colors.background, fontWeight: '700' }}>{(host.full_name ?? 'H')[0]}</Text></View>}
                <Text style={styles.hostName}>Hosted by {host.full_name ?? 'Unknown'}</Text>
              </View>
            )}

            <View style={styles.detailsCard}>
              <DetailRow icon="calendar-outline" text={format(new Date(event.date), 'EEEE, MMMM d, yyyy')} />
              <DetailRow icon="time-outline" text={format(new Date(event.date), 'h:mm a') + (event.end_date ? ` – ${format(new Date(event.end_date), 'h:mm a')}` : '')} />
              <View style={styles.locationRow}>
                <DetailRow icon="location-outline" text={[event.venue_name, event.address].filter(Boolean).join('\n')} flex />
                <TouchableOpacity style={styles.directionsBtn} onPress={openDirections}>
                  <Ionicons name="navigate" size={14} color={Colors.background} />
                  <Text style={styles.directionsBtnText}>Directions</Text>
                </TouchableOpacity>
              </View>
              {event.dress_code && <DetailRow icon="shirt-outline" text={event.dress_code} label="Dress Code" />}
              {(event.contact_numbers?.length ?? 0) > 0 && <DetailRow icon="call-outline" text={event.contact_numbers.join(' · ')} label="Contact" />}
            </View>

            {event.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About this event</Text>
                <Text style={styles.description}>{event.description}</Text>
              </View>
            )}

            {event.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes from host</Text>
                <View style={styles.notesBox}>
                  <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
                  <Text style={styles.notesText}>{event.notes}</Text>
                </View>
              </View>
            )}

            {isHost && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>RSVPs</Text>
                <View style={styles.rsvpCounts}>
                  <RsvpCount label="Going" count={rsvpCounts.yes} color={Colors.success} />
                  <RsvpCount label="Maybe" count={rsvpCounts.maybe} color={Colors.warning} />
                  <RsvpCount label="No" count={rsvpCounts.no} color={Colors.danger} />
                </View>
              </View>
            )}

            {!isHost && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your RSVP</Text>
                <View style={styles.rsvpBtns}>
                  {(['yes', 'maybe', 'no'] as const).map((s) => (
                    <RsvpButton key={s} status={s} active={rsvp?.status === s} onPress={() => handleRsvp(s)} />
                  ))}
                </View>
                <Text style={styles.label}>Additional details (optional)</Text>
                <TextInput
                  style={styles.additionalInput}
                  value={additionalDetails}
                  onChangeText={setAdditionalDetails}
                  placeholder="Dietary requirements, +1s, special requests..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                />
                {rsvp && (
                  <TouchableOpacity style={styles.updateBtn} onPress={() => handleRsvp(rsvp.status)}>
                    <Text style={styles.updateBtnText}>Update RSVP</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={120}>
          {canChat ? (
            <>
              <FlatList
                ref={chatRef}
                data={messages}
                keyExtractor={(m) => m.id}
                contentContainerStyle={styles.chatList}
                onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: true })}
                renderItem={({ item }) => <ChatBubble message={item} isMe={item.user_id === user?.id} />}
                ListEmptyComponent={<Text style={styles.chatEmpty}>No messages yet. Say hello!</Text>}
              />
              <View style={styles.chatInput}>
                <TextInput
                  style={styles.chatTextInput}
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Message..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                />
                <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage} disabled={!newMessage.trim()}>
                  <Ionicons name="send" size={20} color={newMessage.trim() ? Colors.accent : Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.center}>
              <Ionicons name="lock-closed-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.lockedText}>RSVP "Going" or "Maybe" to join the chat</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function DetailRow({ icon, text, label, flex }: { icon: string; text: string; label?: string; flex?: boolean }) {
  return (
    <View style={dStyles.row}>
      <Ionicons name={icon as any} size={18} color={Colors.accent} style={dStyles.icon} />
      <View style={flex ? { flex: 1 } : {}}>
        {label && <Text style={dStyles.label}>{label}</Text>}
        <Text style={dStyles.text}>{text}</Text>
      </View>
    </View>
  );
}
const dStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  icon: { marginRight: 12, marginTop: 2 },
  label: { fontSize: 11, color: Colors.textMuted, marginBottom: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  text: { color: Colors.text, fontSize: 15, lineHeight: 22 },
});

function RsvpButton({ status, active, onPress }: { status: 'yes' | 'maybe' | 'no'; active: boolean; onPress: () => void }) {
  const config = { yes: { label: '✓  Going', color: Colors.success }, maybe: { label: '?  Maybe', color: Colors.warning }, no: { label: "✕  Can't go", color: Colors.danger } }[status];
  return (
    <TouchableOpacity style={[rStyles.btn, active && { backgroundColor: config.color, borderColor: config.color }]} onPress={onPress}>
      <Text style={[rStyles.text, active && { color: Colors.background }]}>{config.label}</Text>
    </TouchableOpacity>
  );
}
const rStyles = StyleSheet.create({
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  text: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
});

function RsvpCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={cStyles.item}>
      <Text style={[cStyles.count, { color }]}>{count}</Text>
      <Text style={cStyles.label}>{label}</Text>
    </View>
  );
}
const cStyles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', backgroundColor: Colors.surfaceElevated, borderRadius: 12, paddingVertical: 14 },
  count: { fontSize: 28, fontWeight: '800' },
  label: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});

function ChatBubble({ message, isMe }: { message: any; isMe: boolean }) {
  return (
    <View style={[msgStyles.wrap, isMe && msgStyles.wrapMe]}>
      {!isMe && (
        <View style={msgStyles.avatar}>
          <Text style={msgStyles.avatarText}>{(message.profile?.full_name ?? '?')[0]}</Text>
        </View>
      )}
      <View style={[msgStyles.bubble, isMe && msgStyles.bubbleMe]}>
        {!isMe && <Text style={msgStyles.sender}>{message.profile?.full_name ?? 'Unknown'}</Text>}
        <Text style={[msgStyles.text, isMe && msgStyles.textMe]}>{message.content}</Text>
        <Text style={msgStyles.time}>{format(new Date(message.created_at), 'h:mm a')}</Text>
      </View>
    </View>
  );
}
const msgStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', marginBottom: 12, paddingHorizontal: 16 },
  wrapMe: { flexDirection: 'row-reverse' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', marginRight: 8, alignSelf: 'flex-end' },
  avatarText: { color: Colors.background, fontWeight: '700', fontSize: 13 },
  bubble: { maxWidth: '75%', backgroundColor: Colors.surfaceElevated, borderRadius: 16, borderBottomLeftRadius: 4, padding: 12, gap: 4 },
  bubbleMe: { backgroundColor: Colors.accent, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  sender: { fontSize: 12, fontWeight: '700', color: Colors.accent, marginBottom: 2 },
  text: { color: Colors.text, fontSize: 15, lineHeight: 20 },
  textMe: { color: Colors.background },
  time: { fontSize: 11, color: Colors.textMuted, alignSelf: 'flex-end' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { color: Colors.textSecondary, fontSize: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 8, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  topBtn: { backgroundColor: Colors.overlay, borderRadius: 20, padding: 8 },
  topActions: { flexDirection: 'row', gap: 8 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 100 : 60, paddingBottom: 12, gap: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: Colors.background },
  scroll: { flex: 1 },
  heroImage: { width, height: 280, resizeMode: 'cover' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, position: 'absolute', bottom: 12, left: 0, right: 0 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: Colors.text, width: 16 },
  content: { padding: 20, gap: 20, paddingBottom: 100 },
  eventTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, lineHeight: 34 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hostAvatar: { width: 32, height: 32, borderRadius: 16 },
  hostName: { color: Colors.textSecondary, fontSize: 14 },
  detailsCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  directionsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, gap: 4, marginLeft: 8 },
  directionsBtnText: { color: Colors.background, fontSize: 12, fontWeight: '700' },
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  description: { color: Colors.textSecondary, fontSize: 15, lineHeight: 23 },
  notesBox: { flexDirection: 'row', gap: 10, backgroundColor: Colors.surfaceElevated, borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: Colors.accent },
  notesText: { flex: 1, color: Colors.text, fontSize: 14, lineHeight: 21 },
  rsvpCounts: { flexDirection: 'row', gap: 10 },
  rsvpBtns: { flexDirection: 'row', gap: 8 },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  additionalInput: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: Colors.text, fontSize: 14, borderWidth: 1, borderColor: Colors.border, minHeight: 80, textAlignVertical: 'top' },
  updateBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  updateBtnText: { color: Colors.background, fontWeight: '700', fontSize: 15 },
  chatList: { paddingTop: 16, paddingBottom: 12 },
  chatEmpty: { textAlign: 'center', color: Colors.textMuted, paddingTop: 60, fontSize: 14 },
  chatInput: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface, gap: 8 },
  chatTextInput: { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: Colors.text, fontSize: 15, maxHeight: 100 },
  sendBtn: { padding: 8 },
  lockedText: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center', paddingHorizontal: 40 },
});
