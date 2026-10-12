import AlbumTab from '@/components/album/AlbumTab';
import GuestList, { Guest } from '@/components/GuestList';
import AttendanceCard from '@/components/pledges/AttendanceCard';
import PayCard from '@/components/pledges/PayCard';
import PledgeNote from '@/components/pledges/PledgeNote';
import PledgesPanel from '@/components/pledges/PledgesPanel';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Confetti from '@/components/ui/Confetti';
import EmptyState from '@/components/ui/EmptyState';
import EventCover from '@/components/ui/EventCover';
import PressableScale from '@/components/ui/PressableScale';
import Screen, { MAX_WIDE_CONTENT_WIDTH } from '@/components/ui/Screen';
import Segmented from '@/components/ui/Segmented';
import Sticker from '@/components/ui/Sticker';
import TextField from '@/components/ui/TextField';
import { eventTheme } from '@/constants/eventThemes';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useAlbum } from '@/hooks/useAlbum';
import { useAuth } from '@/hooks/useAuth';
import { useUnread } from '@/hooks/useUnread';
import { useLayout } from '@/hooks/useLayout';
import { useObligations } from '@/hooks/useObligations';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { canMarkAttendance, formatMoney, isOpen, isOpenDebtError, isPastCutoff, isPledgeEvent } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { Event, Rsvp, RsvpStatus } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { uploadImage } from '@/lib/upload';
import { ReactElement, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EventScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { isWide } = useLayout();
  const { refresh: refreshBadges } = useUnread();
  const { obligations, reload: reloadObligations } = useObligations();

  const [event, setEvent] = useState<Event | null>(null);
  const [host, setHost] = useState<any>(null);
  const [rsvp, setRsvp] = useState<Rsvp | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  // Chats links straight to an event's chat (?tab=chat), Activity to its album (?tab=photos)
  const [tab, setTab] = useState<'details' | 'chat' | 'photos'>(initialTab === 'chat' || initialTab === 'photos' ? initialTab : 'details');
  const { album, urls: photoUrls, reload: reloadAlbum } = useAlbum(id, tab === 'photos');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [venueViewer, setVenueViewer] = useState<number | null>(null); // index into event.venue_images
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingImage, setSendingImage] = useState(false);
  // Null when this user may not share the invite (guest, and the host turned re-sharing off)
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(0);
  const chatRef = useRef<FlatList>(null);
  usePageTitle(event?.title);

  const isHost = event?.host_id === user?.id;
  const canChat = isHost || rsvp?.status === 'yes' || rsvp?.status === 'maybe';
  // Address is hidden for pledge events if the guest hasn't committed (invited, not going).
  // Hosts always see it. Once you're going (yes/maybe) the address is yours to keep even after cutoff.
  const canSeeAddress = isHost || !event || !isPledgeEvent(event)
    || (rsvp?.status === 'yes' || rsvp?.status === 'maybe');

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

  // While the chat is open, everything in it counts as read
  const markRead = useCallback(async () => {
    await supabase.rpc('mark_chat_read', { p_event_id: id });
    refreshBadges();
  }, [id, refreshBadges]);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, profile:profiles(*)')
      .eq('event_id', id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    markRead();
  }, [id, markRead]);

  const appendMessage = useCallback(async (messageId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, profile:profiles(*)')
      .eq('id', messageId)
      .single();
    if (data) setMessages((prev) => [...prev, data]);
    markRead();
  }, [markRead]);

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

  // Opening the keyboard hides the bottom of the chat: bring the latest messages back into view
  useEffect(() => {
    if (tab !== 'chat') return;
    const sub = Keyboard.addListener('keyboardDidShow', () => chatRef.current?.scrollToEnd({ animated: true }));
    return () => sub.remove();
  }, [tab]);

  // Guests get their RSVP row when they accept the invite, so answering is always an update
  const handleRsvp = async (status: RsvpStatus) => {
    if (!rsvp || !event || !status || status === 'invited') return;
    const wasGoing = rsvp.status === 'yes';
    // Leaving I'm in after the cutoff turns the pledge into a debt, so check first
    if (wasGoing && status !== 'yes' && rsvp.pledge_cents != null && isPastCutoff(event)) {
      const ok = await confirmAction(
        'Cancel after the cutoff?',
        `It's past the cutoff, so this counts as a flake. You'll owe ${host?.full_name ?? 'the host'} ${formatMoney(rsvp.pledge_cents)}.`,
        'Cancel anyway',
        true,
      );
      if (!ok) return;
    }
    const { data, error } = await supabase
      .from('rsvps')
      .update({ status, additional_details: additionalDetails })
      .eq('id', rsvp.id)
      .select()
      .single();
    if (error) { showAlert(isOpenDebtError(error) ? 'Settle up first' : 'Could not update RSVP', error.message); return; }
    setRsvp(data);
    // Committing is the whole point of wya, so it gets a celebration
    if (status === 'yes' && !wasGoing) { haptics.success(); setConfetti((n) => n + 1); }
    fetchEvent();
    // A late cancellation may have just created a debt
    reloadObligations();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    await supabase.from('chat_messages').insert({ event_id: id, user_id: user.id, content: newMessage.trim() });
    setNewMessage('');
  };

  const handlePickChatImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: false });
    if (result.canceled || !result.assets[0] || !user) return;
    setSendingImage(true);
    try {
      const url = await uploadImage('event-images', `chat/${user.id}/${Date.now()}`, result.assets[0]);
      await supabase.from('chat_messages').insert({ event_id: id, user_id: user.id, content: null, image_url: url });
    } catch (e: any) {
      showAlert('Could not send image', e?.message ?? 'Upload failed');
    } finally {
      setSendingImage(false);
    }
  };

  const openDirections = async () => {
    if (!event) return;
    const query = encodeURIComponent(event.address);
    const web = `https://www.google.com/maps/search/?api=1&query=${query}`;
    const open = (url: string) => Linking.openURL(url).catch(() => Linking.openURL(web));
    if (Platform.OS === 'web') { window.open(web, '_blank'); return; }
    // Android: the system lists whichever maps apps are installed
    if (Platform.OS === 'android') { open(`geo:0,0?q=${query}`); return; }
    // iOS: Apple Maps, plus Google Maps and Waze if they're installed
    const apps = [
      { text: 'Google Maps', url: `comgooglemaps://?q=${query}` },
      { text: 'Waze', url: `waze://?q=${query}` },
    ];
    const installed = (await Promise.all(apps.map(async (a) => ((await Linking.canOpenURL(a.url).catch(() => false)) ? a : null))))
      .filter((a): a is (typeof apps)[number] => a !== null);
    if (installed.length === 0) { open(`maps:?q=${query}`); return; }
    Alert.alert('Get directions', 'Choose your maps app', [
      { text: 'Apple Maps', onPress: () => open(`maps:?q=${query}`) },
      ...installed.map((a) => ({ text: a.text, onPress: () => open(a.url) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
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

  // Cover, title, host, who's going: on top on phones, the left column on desktop
  const hero = (
    <View>
      <View>
        <EventCover seed={event.id} title={event.title} theme={event.theme} imageUrl={event.cover_image} style={isWide ? styles.coverWide : styles.cover} initialSize={180} />
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
    </View>
  );

  const tabsBlock = (
    <View style={styles.tabs}>
      <Segmented
        options={[
          { value: 'details', label: 'Details' },
          { value: 'chat', label: 'Chat' },
          { value: 'photos', label: album?.photos.length ? `Photos ${album.photos.length}` : 'Photos' },
        ]}
        value={tab}
        onChange={setTab}
      />
    </View>
  );

  // Guest: anything you owe this host, from this event or an earlier one (it blocks RSVPs, R6)
  const debtsToHost = obligations.filter((o) => o.role === 'guest' && o.other_user_id === event.host_id && (isOpen(o) || o.event_id === id));
  const blockedByDebt = debtsToHost.some(isOpen);
  // Host: debts for this event
  const eventDebts = obligations.filter((o) => o.role === 'host' && o.event_id === id);
  const refreshPledges = () => { reloadObligations(); fetchEvent(); refreshBadges(); };

  const photos = (
    <View style={styles.body}>
      <AlbumTab eventId={id} album={album} urls={photoUrls} reload={reloadAlbum} />
    </View>
  );

  const details = (
    <View style={styles.body}>

      {!isHost && debtsToHost.map((o) => <PayCard key={o.id} obligation={o} onChange={refreshPledges} />)}

      {isHost && canMarkAttendance(event) && (
        <AttendanceCard eventId={id} guests={guests} onSaved={refreshPledges} />
      )}
      {isHost && <PledgesPanel eventId={id} obligations={eventDebts} onChange={refreshPledges} />}

      {!isHost && rsvp && (
        <Card style={styles.rsvpCard}>
          <Text style={theme.type.heading}>{rsvp.status === 'invited' ? 'Are you coming?' : 'Your RSVP'}</Text>
          {blockedByDebt && rsvp.status !== 'yes' && (
            <Text style={[theme.type.value, { color: theme.colors.danger }]}>Settle up with {host?.full_name?.split(' ')[0] ?? 'the host'} above to RSVP.</Text>
          )}
          <PledgeNote event={event} rsvp={rsvp} hostName={host?.full_name?.split(' ')[0] ?? 'the host'} onConfirm={() => handleRsvp('yes')} />
          <View style={styles.rsvpBtns}>
            {/* R11: on pledge events it's I'm in or Can't go once the cutoff has passed */}
            {(isPledgeEvent(event) && isPastCutoff(event) && rsvp.status !== 'maybe' ? (['yes', 'no'] as const) : (['yes', 'maybe', 'no'] as const)).map((s) => (
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
          title={canSeeAddress ? (event.venue_name || event.address) : (event.venue_name || 'Address hidden')}
          subtitle={canSeeAddress && event.venue_name ? event.address : canSeeAddress ? undefined : 'RSVP to see the address'}
          action={canSeeAddress ? <Button title="Directions" icon="navigate" size="sm" color={{ bg: t.base, fg: t.ink }} onPress={openDirections} /> : undefined}
          divider
        />
        {!!event.dress_code && <InfoRow icon="shirt" title={event.dress_code} subtitle="Dress code" divider />}
        {(event.contact_numbers?.length ?? 0) > 0 && <InfoRow icon="call" title={event.contact_numbers.join(' · ')} subtitle="Contact" divider />}
      </Card>

      {!!event.description && (
        <View style={styles.section}>
          <Text style={theme.type.sectionHeading}>About</Text>
          <Text style={theme.type.body}>{event.description}</Text>
        </View>
      )}

      {!!event.notes && (
        <View style={[styles.notes, { backgroundColor: t.base }]}>
          <Text style={[theme.type.sectionHeading, { color: t.ink }]}>From the host</Text>
          <Text style={[theme.type.body, { color: t.ink }]}>{event.notes}</Text>
        </View>
      )}

      {(event.venue_images?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={theme.type.sectionHeading}>The venue</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
            {event.venue_images.map((uri, i) => (
              <PressableScale key={uri} onPress={() => setVenueViewer(i)} accessibilityLabel="View photo">
                <Image source={{ uri }} style={styles.galleryImg} contentFit="cover" transition={200} recyclingKey={uri} />
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Venue photo lightbox */}
      <Modal visible={venueViewer != null} animationType="fade" onRequestClose={() => setVenueViewer(null)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.scrim }}>
          <FlatList
            data={event?.venue_images ?? []}
            keyExtractor={(uri) => uri}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={venueViewer ?? 0}
            getItemLayout={(_, i) => ({ length: screenWidth, offset: screenWidth * i, index: i })}
            renderItem={({ item: uri }) => (
              <View style={{ width: screenWidth, height: screenHeight, justifyContent: 'center' }}>
                <Image source={{ uri }} style={{ width: screenWidth, height: screenHeight - insets.top - insets.bottom - 80 }} contentFit="contain" transition={150} recyclingKey={uri} />
              </View>
            )}
          />
          <View style={{ position: 'absolute', top: insets.top + Space.md, right: Space.lg }}>
            <PressableScale onPress={() => setVenueViewer(null)} style={styles.lightboxClose} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={theme.colors.onScrim} />
            </PressableScale>
          </View>
        </View>
      </Modal>

      <View style={styles.section}>
        <Text style={theme.type.sectionHeading}>{isHost ? 'Guests' : "Who's going"}</Text>
        <GuestList guests={guests} isHost={isHost} onRemove={isHost ? removeGuest : undefined} />
      </View>
    </View>
  );

  // On phones the chat scrolls under the hero; on desktop the hero has its own column
  // Scrolling mid-layout is unreliable, so wait a frame
  const scrollChatToEnd = () => requestAnimationFrame(() => chatRef.current?.scrollToEnd({ animated: true }));

  const renderChat = (chatHeader: ReactElement | null) => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {canChat ? (
        <FlatList
          ref={chatRef}
          data={messages}
          keyExtractor={(m) => m.id}
          ListHeaderComponent={chatHeader}
          contentContainerStyle={styles.chatList}
          // After a new message or the keyboard resizing the list, show the latest messages
          onContentSizeChange={scrollChatToEnd}
          onLayout={scrollChatToEnd}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <ChatBubble message={item} isMe={item.user_id === user?.id} />}
          ListEmptyComponent={<Text style={[theme.type.bodySecondary, styles.chatEmpty]}>No messages yet. Say hi 👋</Text>}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {chatHeader}
          <EmptyState icon="lock-closed-outline" title="Chat is for people who are coming" body={'RSVP "Going" or "Maybe" to join the conversation.'} />
        </ScrollView>
      )}
      {canChat && (
        <View style={styles.chatInput}>
          <PressableScale
            onPress={handlePickChatImage}
            disabled={sendingImage}
            style={styles.attachBtn}
            accessibilityLabel="Send image"
          >
            {sendingImage
              ? <ActivityIndicator size="small" color={theme.colors.textSecondary} />
              : <Ionicons name="image-outline" size={22} color={theme.colors.textSecondary} />}
          </PressableScale>
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
  );

  if (isWide) {
    return (
      <Screen maxWidth={MAX_WIDE_CONTENT_WIDTH}>
        <View style={styles.wideRow}>
          <ScrollView style={styles.wideLeft} contentContainerStyle={styles.wideLeftContent} showsVerticalScrollIndicator={false}>
            {hero}
          </ScrollView>
          <View style={styles.wideRight}>
            {tabsBlock}
            {tab === 'chat' ? renderChat(null) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>{tab === 'details' ? details : photos}</ScrollView>
            )}
          </View>
        </View>
        <Confetti burstKey={confetti} />
      </Screen>
    );
  }

  return (
    <Screen>
      {tab === 'chat' ? renderChat(<>{hero}{tabsBlock}</>) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {hero}
          {tabsBlock}
          {tab === 'details' ? details : photos}
        </ScrollView>
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
      style={[styles.rsvpChoice, active && { backgroundColor: config.color, borderColor: c.outline }]}
      hoverStyle={!active && { backgroundColor: c.surfaceAlt }}
    >
      <Ionicons name={config.icon} size={22} color={active ? '#FFFFFF' : config.color} />
      <Text style={[theme.type.button, { fontSize: 14, color: active ? '#FFFFFF' : c.text }]}>{config.label}</Text>
    </PressableScale>
  );
}

function ChatBubble({ message, isMe }: { message: any; isMe: boolean }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const timeLabel = (
    <Text style={[theme.type.caption, { fontSize: 10, alignSelf: 'flex-end' }, isMe && { color: theme.colors.onPrimary, opacity: 0.7 }]}>
      {format(new Date(message.created_at), 'h:mm a')}
    </Text>
  );
  return (
    <View style={[styles.msgRow, isMe && { justifyContent: 'flex-end' }]}>
      {!isMe && <Avatar name={message.profile?.full_name ?? null} url={message.profile?.avatar_url} seed={message.user_id} size={30} />}
      {message.image_url ? (
        <View style={[styles.bubble, styles.bubbleImg, isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
          {!isMe && <Text style={[theme.type.caption, { fontFamily: Fonts.bodyBold, color: theme.colors.text }]}>{message.profile?.full_name ?? 'Unknown'}</Text>}
          <Image source={{ uri: message.image_url }} style={styles.chatImg} contentFit="cover" recyclingKey={message.id} transition={150} />
          {timeLabel}
        </View>
      ) : (
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {!isMe && <Text style={[theme.type.caption, { fontFamily: Fonts.bodyBold, color: theme.colors.text }]}>{message.profile?.full_name ?? 'Unknown'}</Text>}
          <Text style={[theme.type.body, isMe && { color: theme.colors.onPrimary }]}>{message.content}</Text>
          {timeLabel}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) => {
  const outline = { borderWidth: t.outlineWidth, borderColor: t.colors.outline };
  return {
    center: { justifyContent: 'center', alignItems: 'center', padding: Space.xl },
    scrollContent: { paddingBottom: Space.xxxl },
    cover: { height: 300, borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl, borderBottomWidth: t.outlineWidth, borderColor: t.colors.outline },
    coverWide: {
      height: 380, borderRadius: Radius.xl, borderWidth: t.outlineWidth, borderColor: t.colors.outline,
      ...t.shadow(5),
    },
    coverButtons: { position: 'absolute', top: Space.xxxl, left: Space.lg, right: Space.lg, flexDirection: 'row', justifyContent: 'space-between' },
    wideRow: { flex: 1, flexDirection: 'row', gap: Space.xl, paddingHorizontal: Space.xxl },
    wideLeft: { width: 440, flexGrow: 0 },
    wideLeftContent: { paddingTop: Space.xxl, paddingBottom: Space.xxl },
    wideRight: { flex: 1, minWidth: 0, paddingTop: Space.xl },
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
      backgroundColor: t.colors.surface, borderWidth: t.outlineWidth, borderColor: t.colors.outline,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.lg },
    infoDivider: { borderTopWidth: 1, borderTopColor: t.colors.border },
    infoIcon: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: t.colors.highlight, justifyContent: 'center', alignItems: 'center' },
    notes: { borderRadius: Radius.lg, padding: Space.lg, gap: Space.sm, transform: [{ rotate: '-0.6deg' }], ...outline },
    gallery: { gap: Space.sm },
    galleryImg: { width: 160, height: 120, borderRadius: Radius.md, ...outline },
    chatList: { paddingBottom: Space.lg, gap: Space.sm },
    chatEmpty: { textAlign: 'center', padding: Space.xl },
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Space.sm, paddingHorizontal: Space.lg },
    bubble: { maxWidth: '78%', borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
    bubbleMe: { backgroundColor: t.colors.primary, borderBottomRightRadius: 6, ...outline },
    bubbleThem: { backgroundColor: t.colors.surface, borderBottomLeftRadius: 6, borderWidth: t.outlineWidth, borderColor: t.colors.outline },
    chatInput: {
      flexDirection: 'row', alignItems: 'flex-end', gap: Space.sm, padding: Space.md, paddingBottom: Space.xl,
      borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: t.colors.background,
    },
    chatTextInput: {
      ...t.type.input, flex: 1, maxHeight: 120, backgroundColor: t.colors.surface, borderRadius: Radius.lg,
      paddingHorizontal: Space.lg, paddingVertical: 12, borderWidth: t.outlineWidth, borderColor: t.colors.outline,
      outlineStyle: 'none',
    } as any,
    attachBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    sendBtn: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', ...outline },
    chatImg: { width: 200, height: 200, borderRadius: Radius.md },
    bubbleImg: { backgroundColor: 'transparent', padding: 0, gap: 4 },
    lightboxClose: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.scrimButton },
  };
});
