import GuestList, { Guest } from '@/components/GuestList';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Confetti from '@/components/ui/Confetti';
import EmptyState from '@/components/ui/EmptyState';
import EventCover from '@/components/ui/EventCover';
import PressableScale from '@/components/ui/PressableScale';
import Screen from '@/components/ui/Screen';
import Segmented from '@/components/ui/Segmented';
import Sticker from '@/components/ui/Sticker';
import TextField from '@/components/ui/TextField';
import { eventTheme } from '@/constants/eventThemes';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { Event, Rsvp, RsvpStatus } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useStyles();
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
  // Null when this user may not share the invite (guest, and the host turned re-sharing off)
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(0);
  const chatRef = useRef<FlatList>(null);
  usePageTitle(event?.title);

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
    const wasGoing = rsvp.status === 'yes';
    const { data, error } = await supabase
      .from('rsvps')
      .update({ status, additional_details: additionalDetails })
      .eq('id', rsvp.id)
      .select()
      .single();
    if (error) { showAlert('Could not update RSVP', error.message); return; }
    setRsvp(data);
    // Committing is the whole point of wya, so it gets a celebration
    if (status === 'yes' && !wasGoing) { haptics.success(); setConfetti((n) => n + 1); }
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

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'));

  if (loading) return <Screen style={styles.center}><ActivityIndicator color={theme.colors.primary} size="large" /></Screen>;
  // Also shown to people who weren't invited, since they can't read the event
  if (!event) return (
    <Screen style={styles.center}>
      <EmptyState
        icon="eye-off-outline"
        title="Event not found"
        body="It may have been deleted, or you haven't been invited."
        action={<Button title="Go home" onPress={() => router.replace('/(tabs)/home')} />}
      />
    </Screen>
  );

  const t = eventTheme(event.theme);
  const date = new Date(event.date);
  const going = guests.filter((g) => g.status === 'yes').map((g) => ({ id: g.user_id, name: g.full_name, avatarUrl: g.avatar_url }));

  const header = (
    <View>
      <View>
        <EventCover seed={event.id} title={event.title} theme={event.theme} imageUrl={event.cover_image} style={styles.cover} initialSize={180} />
        <View style={styles.coverButtons}>
          <RoundButton icon="arrow-back" onPress={goBack} label="Back" />
          <View style={styles.coverActions}>
            {isHost && <RoundButton icon="create-outline" onPress={() => router.push(`/event/edit/${id}`)} label="Edit event" />}
            {inviteCode && <RoundButton icon="share-outline" onPress={shareInvite} label="Share invite" />}
          </View>
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Sticker label={format(date, 'EEE · MMM d · h:mm a').toUpperCase()} bg={t.base} fg={t.ink} tilt={-2} />
        <Text style={theme.type.display}>{event.title}</Text>
        {host && (
          <View style={styles.hostRow}>
            <Avatar name={host.full_name} url={host.avatar_url} seed={host.id} size={30} />
            <Text style={theme.type.bodySecondary}>
              Hosted by <Text style={{ color: theme.colors.text, fontFamily: Fonts.bodyBold }}>{isHost ? 'you' : host.full_name ?? 'Unknown'}</Text>
            </Text>
          </View>
        )}
        {going.length > 0 && <AvatarStack people={going} />}
      </View>

      <View style={styles.tabs}>
        <Segmented
          options={[{ value: 'details', label: 'Details' }, { value: 'chat', label: 'Chat' }]}
          value={tab}
          onChange={setTab}
        />
      </View>
    </View>
  );

  return (
    <Screen>
      {tab === 'details' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {header}
          <View style={styles.body}>

            {!isHost && rsvp && (
              <Card style={styles.rsvpCard}>
                <Text style={theme.type.heading}>{rsvp.status === 'invited' ? 'Are you coming?' : 'Your RSVP'}</Text>
                <View style={styles.rsvpBtns}>
                  {(['yes', 'maybe', 'no'] as const).map((s) => (
                    <RsvpChoice key={s} status={s} active={rsvp.status === s} onPress={() => handleRsvp(s)} />
                  ))}
                </View>
                <TextField
                  label="A note for the host (optional)"
                  value={additionalDetails}
                  onChangeText={setAdditionalDetails}
                  placeholder="Dietary needs, +1s, running late…"
                  multiline
                />
                {rsvp.status !== 'invited' && (
                  <Button title="Save note" variant="outline" size="sm" onPress={() => handleRsvp(rsvp.status)} style={{ alignSelf: 'flex-start' }} />
                )}
              </Card>
            )}

            <Card padded={false}>
              <InfoRow icon="calendar" title={format(date, 'EEEE, MMMM d')} subtitle={format(date, 'h:mm a') + (event.end_date ? ` – ${format(new Date(event.end_date), 'h:mm a')}` : '')} />
              <InfoRow
                icon="location"
                title={event.venue_name || event.address}
                subtitle={event.venue_name ? event.address : undefined}
                action={<Button title="Directions" icon="navigate" size="sm" color={{ bg: t.base, fg: t.ink }} onPress={openDirections} />}
                divider
              />
              {!!event.dress_code && <InfoRow icon="shirt" title={event.dress_code} subtitle="Dress code" divider />}
              {(event.contact_numbers?.length ?? 0) > 0 && <InfoRow icon="call" title={event.contact_numbers.join(' · ')} subtitle="Contact" divider />}
            </Card>

            {!!event.description && (
              <View style={styles.section}>
                <Text style={theme.type.label}>About</Text>
                <Text style={theme.type.body}>{event.description}</Text>
              </View>
            )}

            {!!event.notes && (
              <View style={[styles.notes, { backgroundColor: t.base }]}>
                <Text style={[theme.type.label, { color: t.ink }]}>From the host</Text>
                <Text style={[theme.type.body, { color: t.ink }]}>{event.notes}</Text>
              </View>
            )}

            {(event.venue_images?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <Text style={theme.type.label}>The venue</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
                  {event.venue_images.map((uri) => <Image key={uri} source={{ uri }} style={styles.galleryImg} />)}
                </ScrollView>
              </View>
            )}

            <View style={styles.section}>
              <Text style={theme.type.label}>{isHost ? 'Guests' : "Who's going"}</Text>
              <GuestList guests={guests} isHost={isHost} onRemove={isHost ? removeGuest : undefined} />
            </View>
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {canChat ? (
            <FlatList
              ref={chatRef}
              data={messages}
              keyExtractor={(m) => m.id}
              ListHeaderComponent={header}
              contentContainerStyle={styles.chatList}
              onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item }) => <ChatBubble message={item} isMe={item.user_id === user?.id} />}
              ListEmptyComponent={<Text style={[theme.type.bodySecondary, styles.chatEmpty]}>No messages yet. Say hi 👋</Text>}
            />
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {header}
              <EmptyState icon="lock-closed-outline" title="Chat is for people who are coming" body={'RSVP "Going" or "Maybe" to join the conversation.'} />
            </ScrollView>
          )}
          {canChat && (
            <View style={styles.chatInput}>
              <TextInput
                style={styles.chatTextInput}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Message…"
                placeholderTextColor={theme.colors.textMuted}
                multiline
              />
              <PressableScale
                onPress={handleSendMessage}
                disabled={!newMessage.trim()}
                style={[styles.sendBtn, { backgroundColor: theme.colors.primary }]}
                accessibilityLabel="Send message"
              >
                <Ionicons name="arrow-up" size={20} color={theme.colors.onPrimary} />
              </PressableScale>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
      <Confetti burstKey={confetti} />
    </Screen>
  );
}

function RoundButton({ icon, onPress, label }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string }) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <PressableScale onPress={onPress} style={styles.roundBtn} accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={theme.colors.text} />
    </PressableScale>
  );
}

function InfoRow({ icon, title, subtitle, action, divider }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  divider?: boolean;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.infoRow, divider && styles.infoDivider]}>
      <View style={styles.infoIcon}><Ionicons name={icon} size={18} color={theme.colors.onHighlight} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={theme.type.value}>{title}</Text>
        {subtitle && <Text style={theme.type.caption}>{subtitle}</Text>}
      </View>
      {action}
    </View>
  );
}

function RsvpChoice({ status, active, onPress }: { status: 'yes' | 'maybe' | 'no'; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  const config = {
    yes: { label: "I'm in", icon: 'checkmark-circle' as const, color: c.success },
    maybe: { label: 'Maybe', icon: 'help-circle' as const, color: c.warning },
    no: { label: "Can't go", icon: 'close-circle' as const, color: c.danger },
  }[status];
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.rsvpChoice, active && { backgroundColor: config.color, borderColor: theme.isDark ? config.color : c.outline }]}
      hoverStyle={!active && { backgroundColor: c.surfaceAlt }}
    >
      <Ionicons name={config.icon} size={22} color={active ? c.onStatus : config.color} />
      <Text style={[theme.type.button, { fontSize: 14, color: active ? c.onStatus : c.text }]}>{config.label}</Text>
    </PressableScale>
  );
}

function ChatBubble({ message, isMe }: { message: any; isMe: boolean }) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.msgRow, isMe && { justifyContent: 'flex-end' }]}>
      {!isMe && <Avatar name={message.profile?.full_name ?? null} url={message.profile?.avatar_url} seed={message.user_id} size={30} />}
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        {!isMe && <Text style={[theme.type.caption, { fontFamily: Fonts.bodyBold, color: theme.colors.text }]}>{message.profile?.full_name ?? 'Unknown'}</Text>}
        <Text style={[theme.type.body, isMe && { color: theme.colors.onPrimary }]}>{message.content}</Text>
        <Text style={[theme.type.caption, { fontSize: 10, alignSelf: 'flex-end' }, isMe && { color: theme.colors.onPrimary, opacity: 0.7 }]}>
          {format(new Date(message.created_at), 'h:mm a')}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => {
  const outline = { borderWidth: t.outlineWidth, borderColor: t.colors.outline };
  return {
    center: { justifyContent: 'center', alignItems: 'center', padding: Space.xl },
    scrollContent: { paddingBottom: Space.xxxl },
    cover: { height: 300, borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl, ...(t.isDark ? {} : { borderBottomWidth: t.outlineWidth, borderColor: t.colors.outline }) },
    coverButtons: { position: 'absolute', top: Space.xxxl, left: Space.lg, right: Space.lg, flexDirection: 'row', justifyContent: 'space-between' },
    coverActions: { flexDirection: 'row', gap: Space.sm },
    roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: t.colors.surface, justifyContent: 'center', alignItems: 'center', ...outline },
    titleBlock: { paddingHorizontal: Space.xl, paddingTop: Space.xl, gap: Space.md },
    hostRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
    tabs: { paddingHorizontal: Space.xl, paddingTop: Space.xl, paddingBottom: Space.sm },
    body: { paddingHorizontal: Space.xl, paddingTop: Space.md, gap: Space.xl },
    section: { gap: Space.md },
    rsvpCard: { gap: Space.lg },
    rsvpBtns: { flexDirection: 'row', gap: Space.sm },
    rsvpChoice: {
      flex: 1, alignItems: 'center', gap: 6, paddingVertical: Space.md, borderRadius: Radius.md,
      backgroundColor: t.colors.surface, borderWidth: t.outlineWidth, borderColor: t.isDark ? t.colors.border : t.colors.outline,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.lg },
    infoDivider: { borderTopWidth: 1, borderTopColor: t.colors.border },
    infoIcon: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: t.colors.highlight, justifyContent: 'center', alignItems: 'center' },
    notes: { borderRadius: Radius.lg, padding: Space.lg, gap: Space.sm, transform: [{ rotate: '-0.6deg' }], ...(t.isDark ? {} : outline) },
    gallery: { gap: Space.sm },
    galleryImg: { width: 160, height: 120, borderRadius: Radius.md, ...(t.isDark ? {} : outline) },
    chatList: { paddingBottom: Space.lg, gap: Space.sm },
    chatEmpty: { textAlign: 'center', padding: Space.xl },
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Space.sm, paddingHorizontal: Space.lg },
    bubble: { maxWidth: '78%', borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
    bubbleMe: { backgroundColor: t.colors.primary, borderBottomRightRadius: 6, ...(t.isDark ? {} : outline) },
    bubbleThem: { backgroundColor: t.colors.surface, borderBottomLeftRadius: 6, borderWidth: t.outlineWidth, borderColor: t.isDark ? t.colors.border : t.colors.outline },
    chatInput: {
      flexDirection: 'row', alignItems: 'flex-end', gap: Space.sm, padding: Space.md, paddingBottom: Space.xl,
      borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: t.colors.background,
    },
    chatTextInput: {
      ...t.type.input, flex: 1, maxHeight: 120, backgroundColor: t.colors.surface, borderRadius: Radius.lg,
      paddingHorizontal: Space.lg, paddingVertical: 12, borderWidth: t.outlineWidth, borderColor: t.isDark ? t.colors.border : t.colors.outline,
      outlineStyle: 'none',
    } as any,
    sendBtn: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', ...(t.isDark ? {} : outline) },
  };
});
