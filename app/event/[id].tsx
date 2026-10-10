import GuestList, { Guest } from '@/components/GuestList';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Type } from '@/constants/typography';
import { useAuth } from '@/hooks/useAuth';
import { confirmAction, showAlert } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { Event, Rsvp, RsvpStatus } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'details' | 'chat'>('details');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageIdx, setImageIdx] = useState(0);
  // Null when this user may not share the invite (guest, and the host turned re-sharing off)
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const chatRef = useRef<FlatList>(null);

  const isHost = event?.host_id === user?.id;
  const canChat = isHost || rsvp?.status === 'yes' || rsvp?.status === 'maybe';

  const fetchEvent = useCallback(async () => {
    // Logged-out visitors are redirected to Welcome by the root layout; don't query in the meantime
    if (!user) return;
    const [{ data }, { data: guestList }, rsvpRes, { data: code }] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).maybeSingle(),
      supabase.rpc('get_guest_list', { p_event_id: id }),
      supabase.from('rsvps').select('*').eq('event_id', id).eq('user_id', user.id).maybeSingle(),
      supabase.rpc('get_invite_code', { p_event_id: id }),
    ]);

    if (data) {
      setEvent(data);
      supabase.from('profiles').select('*').eq('id', data.host_id).maybeSingle().then(({ data: hostData }) => {
        if (hostData) setHost(hostData);
      });
    }
    setInviteCode(code ?? null);

    if (rsvpRes.data) { setRsvp(rsvpRes.data); setAdditionalDetails(rsvpRes.data.additional_details ?? ''); }

    setGuests(guestList ?? []);
    setLoading(false);
  }, [id, user]);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, profile:profiles(*)')
      .eq('event_id', id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, [id]);

  const appendMessage = useCallback(async (messageId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, profile:profiles(*)')
      .eq('id', messageId)
      .single();
    if (data) setMessages((prev) => [...prev, data]);
  }, []);

  // Refetch whenever the screen comes back into focus, e.g. after editing the event
  useFocusEffect(useCallback(() => { fetchEvent(); }, [fetchEvent]));

  useEffect(() => {
    if (tab === 'chat' && canChat) {
      fetchMessages();
      const channel = supabase
        .channel(`chat:${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${id}` }, (payload) => appendMessage(payload.new.id))
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [tab, canChat, id, fetchMessages, appendMessage]);

  // Guests get their RSVP row when they accept the invite, so answering is always an update
  const handleRsvp = async (status: RsvpStatus) => {
    if (!rsvp || !status || status === 'invited') return;
    const { data, error } = await supabase
      .from('rsvps')
      .update({ status, additional_details: additionalDetails })
      .eq('id', rsvp.id)
      .select()
      .single();
    if (error) { showAlert('Could not update RSVP', error.message); return; }
    setRsvp(data);
    fetchEvent();
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
    if (!event || !inviteCode) return;
    try {
      // The hosted web app opens for anyone, with or without the app installed
      const inviteUrl = process.env.EXPO_PUBLIC_WEB_URL
        ? `${process.env.EXPO_PUBLIC_WEB_URL}/invite/${inviteCode}`
        : Linking.createURL(`invite/${inviteCode}`);
      const inviter = host?.full_name ? `${host.full_name} invited you` : "You're invited";
      const shareMessage = `${inviter} to ${event.title} on ${format(new Date(event.date), 'EEE, MMM d')}: ${inviteUrl}`;
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title: event.title, text: shareMessage, url: inviteUrl });
        } else {
          // fallback: show the link in a prompt so user can copy manually
          window.prompt('Copy invite link:', inviteUrl);
        }
      } else {
        await Share.share({ message: shareMessage });
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        showAlert('Share failed', e?.message ?? 'Could not open share sheet');
      }
    }
  };

  const removeGuest = async (guest: Guest) => {
    const name = guest.full_name ?? 'this guest';
    const ok = await confirmAction('Remove guest', `Remove ${name}? They'll lose access to this event and its chat, and can't rejoin with the invite link.`, 'Remove', true);
    if (!ok) return;
    const { error } = await supabase.rpc('remove_guest', { p_event_id: id, p_user_id: guest.user_id });
    if (error) { showAlert('Could not remove guest', error.message); return; }
    fetchEvent();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>;
  // Also shown to people who weren't invited, since they can't read the event
  if (!event) return (
    <View style={styles.center}>
      <Text style={styles.errorText}>Event not found</Text>
      <TouchableOpacity style={[styles.updateBtn, { paddingHorizontal: 40 }]} onPress={() => router.replace('/(tabs)/home')}>
        <Text style={styles.updateBtnText}>Go Home</Text>
      </TouchableOpacity>
    </View>
  );

  const allImages = [event.cover_image, ...(event.venue_images ?? [])].filter(Boolean) as string[];

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))} style={styles.topBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.topActions}>
          {isHost && (
            <TouchableOpacity style={styles.topBtn} onPress={() => router.push(`/event/edit/${id}`)}>
              <Ionicons name="create-outline" size={22} color={Colors.text} />
            </TouchableOpacity>
          )}
          {inviteCode && (
            <TouchableOpacity style={styles.topBtn} onPress={shareInvite}>
              <Ionicons name="share-outline" size={22} color={Colors.text} />
            </TouchableOpacity>
          )}
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
              {!!event.dress_code && <DetailRow icon="shirt-outline" text={event.dress_code} label="Dress Code" />}
              {(event.contact_numbers?.length ?? 0) > 0 && <DetailRow icon="call-outline" text={event.contact_numbers.join(' · ')} label="Contact" />}
            </View>

            {!!event.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About this event</Text>
                <Text style={styles.description}>{event.description}</Text>
              </View>
            )}

            {!!event.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes from host</Text>
                <View style={styles.notesBox}>
                  <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
                  <Text style={styles.notesText}>{event.notes}</Text>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{isHost ? 'Guests' : "Who's going"}</Text>
              <GuestList guests={guests} isHost={isHost} onRemove={isHost ? removeGuest : undefined} />
            </View>

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
                {rsvp && rsvp.status !== 'invited' && (
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
                <TouchableOpacity style={[styles.sendBtn, !newMessage.trim() && { backgroundColor: Colors.surfaceElevated }]} onPress={handleSendMessage} disabled={!newMessage.trim()}>
                  <Ionicons name="send" size={16} color={newMessage.trim() ? Colors.white : Colors.textMuted} />
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
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9 },
  icon: { marginRight: 13, marginTop: 2 },
  label: { ...Type.label, fontSize: 10, marginBottom: 3 },
  text: { ...Type.value, fontSize: 15 },
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
  btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  text: { ...Type.buttonSecondary, fontSize: 13 },
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
        <Text style={[msgStyles.time, isMe && msgStyles.timeMe]}>{format(new Date(message.created_at), 'h:mm a')}</Text>
      </View>
    </View>
  );
}
const msgStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', marginBottom: 14, paddingHorizontal: 16 },
  wrapMe: { flexDirection: 'row-reverse' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', marginRight: 8, alignSelf: 'flex-end' },
  avatarText: { ...Type.badge, color: Colors.white, fontSize: 12 },
  bubble: { maxWidth: '75%', backgroundColor: Colors.surfaceElevated, borderRadius: 18, borderBottomLeftRadius: 4, padding: 12, gap: 3, borderWidth: 1, borderColor: Colors.border },
  bubbleMe: { backgroundColor: Colors.accent, borderWidth: 0, borderBottomLeftRadius: 18, borderBottomRightRadius: 4, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  sender: { ...Type.badge, fontSize: 11, color: Colors.accentLight, marginBottom: 2 },
  text: { ...Type.chatMessage, color: Colors.text },
  textMe: { color: Colors.white },
  time: { ...Type.metaSmall, alignSelf: 'flex-end', marginTop: 2 },
  timeMe: { color: 'rgba(255,255,255,0.6)' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', gap: 14 },
  errorText: { ...Type.description },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 8, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  topBtn: { backgroundColor: 'rgba(6,6,10,0.7)', borderRadius: 22, padding: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  topActions: { flexDirection: 'row', gap: 8 },

  tabRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 102 : 62, paddingBottom: 14, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn: { paddingHorizontal: 22, paddingVertical: 9, borderRadius: 24, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  tabBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  tabText: { ...Type.badge, color: Colors.textSecondary, fontSize: 13 },
  tabTextActive: { color: Colors.white },

  scroll: { flex: 1 },
  heroImage: { width, height: 300, resizeMode: 'cover' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, position: 'absolute', bottom: 14, left: 0, right: 0 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: Colors.accentMid, width: 18, borderRadius: 3 },

  content: { padding: 22, gap: 22, paddingBottom: 110 },
  eventTitle: { ...Type.eventTitle },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hostAvatar: { width: 30, height: 30, borderRadius: 15 },
  hostName: { ...Type.meta, fontSize: 14 },

  detailsCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border, gap: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  directionsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 5, marginLeft: 10, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 },
  directionsBtnText: { ...Type.badge, color: Colors.white, fontSize: 12 },

  section: { gap: 12 },
  sectionTitle: { ...Type.label },
  description: { ...Type.description, fontSize: 15 },
  notesBox: { flexDirection: 'row', gap: 12, backgroundColor: Colors.accentSubtle, borderRadius: 14, padding: 16, borderLeftWidth: 3, borderLeftColor: Colors.accent },
  notesText: { flex: 1, ...Type.pullQuote, fontSize: 15 },

  rsvpBtns: { flexDirection: 'row', gap: 8 },
  label: { ...Type.label },
  additionalInput: { backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, ...Type.input, borderWidth: 1, borderColor: Colors.border, minHeight: 80, textAlignVertical: 'top' },
  updateBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  updateBtnText: { ...Type.buttonPrimary },

  chatList: { paddingTop: 18, paddingBottom: 12 },
  chatEmpty: { ...Type.meta, textAlign: 'center', paddingTop: 60 },
  chatInput: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface, gap: 8 },
  chatTextInput: { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, ...Type.input, maxHeight: 100, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 },
  lockedText: { ...Type.description, textAlign: 'center', paddingHorizontal: 40 },
});
