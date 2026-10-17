import AlbumTab from '@/components/album/AlbumTab';
import GuestList, { Guest } from '@/components/GuestList';
import AttendanceCard from '@/components/pledges/AttendanceCard';
import PayCard from '@/components/pledges/PayCard';
import OpenEventSlots from '@/components/OpenEventSlots';
import InvitePeople from '@/components/InvitePeople';
import PledgeNote from '@/components/pledges/PledgeNote';
import PledgesPanel from '@/components/pledges/PledgesPanel';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Confetti from '@/components/ui/Confetti';
import ImageLightbox from '@/components/ui/ImageLightbox';
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
import { canCheckIn, canMarkAttendance, formatMoney, isOpen, isOpenDebtError, isPastCutoff, isPledgeDebt, isPledgeEvent } from '@/lib/pledges';
import { EVENT_COLUMNS, withAddresses } from '@/lib/events';
import { freshChannel } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { ChatMessage, ChatMessageKind, Event, Rsvp, RsvpStatus } from '@/lib/types';
import PollCard from '@/components/chat/PollCard';
import SplitCard from '@/components/chat/SplitCard';
import ReceiptCard from '@/components/chat/ReceiptCard';
import BillsTab from '@/components/receipts/BillsTab';
import { uploadReceiptPhoto } from '@/lib/receipts';
import { billTotal, parseBillText } from '@/lib/billText';
import PlanCard from '@/components/chat/PlanCard';
import { commandsFor, ParsedCommand, parseCommand, suggestCommands } from '@/lib/commands';
import Logo from '@/components/ui/Logo';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { uploadImageToPath } from '@/lib/upload';
import { ReactElement, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';

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
  // Chats links straight to an event's chat (?tab=chat), Activity to its album (?tab=photos); bills (8.18) have ?tab=bills
  const [tab, setTab] = useState<'details' | 'chat' | 'bills' | 'photos'>(initialTab === 'chat' || initialTab === 'photos' || initialTab === 'bills' ? initialTab : 'details');
  const { album, urls: photoUrls, reload: reloadAlbum } = useAlbum(id, tab === 'photos');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [venueViewer, setVenueViewer] = useState<number | null>(null); // index into event.venue_images
  const [chatViewer, setChatViewer] = useState<number | null>(null); // index into chatImages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingImage, setSendingImage] = useState(false);
  const [sendingCommand, setSendingCommand] = useState(false);
  // Bumped per poll when a vote arrives over Realtime, so that poll reloads its results
  const [pollVersions, setPollVersions] = useState<Record<string, number>>({});
  // Bumped each time the page regains focus (e.g. back from the pay page), so split cards reload
  const [focusTick, setFocusTick] = useState(0);
  // Bumped when the plan changes over Realtime (8.9), so plan cards reload
  const [planTick, setPlanTick] = useState(0);
  // Bumped when someone ticks or confirms on a bill (8.18), so bill cards reload
  const [receiptTick, setReceiptTick] = useState(0);
  const [startingReceipt, setStartingReceipt] = useState(false);
  // Null when this user may not share the invite (guest, and the host turned re-sharing off)
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(0);
  const chatRef = useRef<FlatList>(null);
  usePageTitle(event?.title);

  const isHost = event?.host_id === user?.id;
  // Going: the host, or I'm in and not marked as a no-show (who can split and claim bills, 8.18)
  const isGoing = isHost || (rsvp?.status === 'yes' && rsvp.attended !== false);
  const canChat = isHost || rsvp?.status === 'yes' || rsvp?.status === 'maybe';
  // The database withholds the address on pledge events until a guest commits (yes/maybe);
  // hosts always get it. Null here means hidden.
  const canSeeAddress = !!event?.address;

  const fetchEvent = useCallback(async () => {
    // Logged-out visitors are redirected to Welcome by the root layout; don't query in the meantime
    if (!user) return;
    const [{ data }, { data: guestList }, rsvpRes, { data: code }] = await Promise.all([
      supabase.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle(),
      supabase.rpc('get_guest_list', { p_event_id: id }),
      supabase.from('rsvps').select('*').eq('event_id', id).eq('user_id', user.id).maybeSingle(),
      supabase.rpc('get_invite_code', { p_event_id: id }),
    ]);

    if (data) {
      // Fetched after the RSVP lookups above, so a status change is reflected straight away
      const [withAddress] = await withAddresses([data as Omit<Event, 'address'>]);
      setEvent(withAddress);
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
  useFocusEffect(useCallback(() => { fetchEvent(); setFocusTick((n) => n + 1); }, [fetchEvent]));

  useEffect(() => {
    if (tab === 'chat' && canChat) {
      fetchMessages();
      const channel = freshChannel(`chat:${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${id}` }, (payload) => appendMessage(payload.new.id))
        // Cards change in place (a poll being closed); keep the sender profile we already have
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${id}` },
          (payload) => setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? { ...m, ...(payload.new as Partial<ChatMessage>) } : m))))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poll_votes', filter: `event_id=eq.${id}` },
          (payload) => bumpPoll(payload.new.message_id))
        // DELETEs can't be filtered and carry only the primary key (which includes message_id)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'poll_votes' },
          (payload) => bumpPoll(payload.old.message_id))
        // The plan (8.9): any change reloads the plan cards; deletes can't be filtered, so any delete does too
        .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_items', filter: `event_id=eq.${id}` }, () => setPlanTick((n) => n + 1))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'plan_items' }, () => setPlanTick((n) => n + 1))
        // Bills (8.18): ticks and confirmations move the card's progress line
        .on('postgres_changes', { event: '*', schema: 'public', table: 'receipt_claims', filter: `event_id=eq.${id}` }, () => setReceiptTick((n) => n + 1))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'receipt_claims' }, () => setReceiptTick((n) => n + 1))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'receipt_confirmations', filter: `event_id=eq.${id}` }, () => setReceiptTick((n) => n + 1))
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [tab, canChat, id, fetchMessages, appendMessage]);

  // Bills tab (8.18): ticks, confirmations and new or locked bills from other phones
  useEffect(() => {
    if (tab !== 'bills') return;
    const bump = () => setReceiptTick((n) => n + 1);
    const filter = `event_id=eq.${id}`;
    const channel = freshChannel(`bills:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receipts', filter }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receipt_claims', filter }, bump)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'receipt_claims' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receipt_confirmations', filter }, bump)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tab, id]);

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
    if (error) {
      if (error.hint === 'event_full') { showAlert('This event is full', `${host?.full_name?.split(' ')[0] ?? 'The host'} has a guest limit, and it's been reached. You can still say Maybe.`); fetchEvent(); return; }
      showAlert(isOpenDebtError(error) ? 'Settle up first' : 'Could not update RSVP', error.message);
      return;
    }
    setRsvp(data);
    // Committing is the whole point of wya, so it gets a celebration
    if (status === 'yes' && !wasGoing) { haptics.success(); setConfetti((n) => n + 1); }
    fetchEvent();
    // A late cancellation may have just created a debt
    reloadObligations();
  };

  const bumpPoll = (messageId: string | undefined) => {
    if (messageId) setPollVersions((v) => ({ ...v, [messageId]: (v[messageId] ?? 0) + 1 }));
  };

  // "I'm here" (8.4): a claim the host sees in Who came?
  const checkIn = async () => {
    const { data, error } = await supabase.rpc('check_in', { p_event_id: id });
    if (error) { showAlert("Couldn't check you in", error.message); return false; }
    haptics.success();
    setRsvp((r) => (r ? { ...r, checked_in_at: data as string } : r));
    return true;
  };

  // "/poll …" and friends (Phase 8.2): parsed here, checked by the database
  const runCommand = async (cmd: ParsedCommand) => {
    switch (cmd.name) {
      case 'help':
        showAlert('Things you can type', commandsFor(isHost).map((c) => `${c.usage}\n${c.description}`).join('\n\n'));
        setNewMessage('');
        return;
      case 'unknown':
        showAlert(`There's no /${cmd.typed}`, cmd.suggestion ? `Did you mean ${cmd.suggestion.usage}?` : 'Type /help to see what you can do here.');
        return;
      case 'error':
        showAlert('Almost', cmd.message);
        return;
      case 'remind': {
        const { data, error } = await supabase.rpc('remind_unanswered', { p_event_id: id });
        if (error) {
          showAlert(error.hint === 'rate_limited' ? 'Already reminded' : 'Could not send reminders',
            error.hint === 'rate_limited' ? 'You can nudge people once every 12 hours.' : error.message);
          return;
        }
        setNewMessage('');
        showAlert('Reminder sent', data === 1 ? '1 person got a nudge in Activity.' : `${data ?? 0} people got a nudge in Activity.`);
        return;
      }
      case 'plan': {
        const { error } = await supabase.rpc('post_plan', { p_event_id: id });
        if (error) { showAlert('Could not show the plan', error.message); return; }
        setNewMessage('');
        return;
      }
      case 'here':
        if (await checkIn()) {
          setNewMessage('');
          showAlert("You're checked in", `${host?.full_name?.split(' ')[0] ?? 'The host'} can see you've arrived.`);
        }
        return;
      case 'bill': {
        // "/bill" on its own opens Bills; with lines, it becomes a draft the payer checks before sending
        if (!cmd.text) { setNewMessage(''); setTab('bills'); return; }
        const parsed = parseBillText(cmd.text);
        if (!parsed.lines.some((l) => l.kind === 'item')) {
          showAlert('Almost', 'Add each thing with its price, like: /bill pizza 24, 2 beers 26, service 10%');
          return;
        }
        setSendingCommand(true);
        const { data: rid, error } = await supabase.rpc('create_receipt', { p_event_id: id, p_image_path: null, p_description: parsed.description });
        const saved = error ? null : await supabase.rpc('save_receipt_draft', {
          p_receipt_id: rid, p_items: parsed.lines, p_total_cents: billTotal(parsed.lines), p_printed_subtotal_cents: null,
          p_source: 'manual', p_description: parsed.description,
        });
        setSendingCommand(false);
        const failed = error ?? saved?.error;
        if (failed) { showAlert(failed.hint === 'payid_required' ? 'Add your PayID first' : "Couldn't start the bill", failed.message); return; }
        setNewMessage('');
        router.push(`/receipt/${rid}`);
        return;
      }
      case 'split': {
        // "/split" on its own: split the bill item by item (8.18)
        if (cmd.scan) { setNewMessage(''); setTab('bills'); return; }
        setSendingCommand(true);
        const { error } = await supabase.rpc('create_split', { p_event_id: id, p_description: cmd.description, p_total_cents: cmd.totalCents });
        setSendingCommand(false);
        if (error) {
          showAlert(error.hint === 'payid_required' ? 'Add your PayID first' : 'Could not split the bill', error.message);
          return;
        }
        haptics.success();
        setNewMessage('');
        return;
      }
      case 'poll': {
        setSendingCommand(true);
        const { error } = await supabase.rpc('create_poll', { p_event_id: id, p_question: cmd.question, p_options: cmd.options, p_multi: false });
        setSendingCommand(false);
        if (error) { showAlert('Could not start the poll', error.message); return; }
        haptics.success();
        setNewMessage('');
      }
    }
  };

  const handleSendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !user) return;
    const cmd = parseCommand(text, isHost);
    if (cmd) { await runCommand(cmd); return; }
    await supabase.from('chat_messages').insert({ event_id: id, user_id: user.id, kind: 'text', content: text });
    setNewMessage('');
  };

  const handlePickChatImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: false });
    if (result.canceled || !result.assets[0] || !user) return;
    setSendingImage(true);
    try {
      const path = await uploadImageToPath('event-images', `chat/${user.id}/${Date.now()}`, result.assets[0]);
      const { error } = await supabase.from('chat_messages').insert({ event_id: id, user_id: user.id, kind: 'image', content: null, image_path: path });
      if (error) {
        // Don't leave an orphaned file behind if the message couldn't be saved
        await supabase.storage.from('event-images').remove([path]);
        throw error;
      }
    } catch (e: any) {
      showAlert('Could not send image', e?.message ?? 'Upload failed');
    } finally {
      setSendingImage(false);
    }
  };

  // Split the bill item by item (8.18): the person who paid snaps the receipt, then checks the lines
  const startReceipt = async (how: 'camera' | 'library' | 'manual') => {
    if (!user || startingReceipt) return;
    let path: string | null = null;
    if (how !== 'manual') {
      const pick = how === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await pick({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false });
      if (result.canceled || !result.assets[0]) return;
      setStartingReceipt(true);
      try {
        path = await uploadReceiptPhoto(id, user.id, result.assets[0]);
      } catch (e: any) {
        setStartingReceipt(false);
        showAlert("Couldn't upload the photo", e?.message ?? 'Try again');
        return;
      }
    }
    setStartingReceipt(true);
    const { data, error } = await supabase.rpc('create_receipt', { p_event_id: id, p_image_path: path });
    setStartingReceipt(false);
    if (error) {
      if (path) supabase.storage.from('receipts').remove([path]);
      showAlert(error.hint === 'payid_required' ? 'Add your PayID first' : "Couldn't start the bill", error.message);
      return;
    }
    router.push(`/receipt/${data}`);
  };

  const openDirections = async () => {
    if (!event?.address) return;
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

  // Someone asked to join through a link that needs approval (8.1)
  const approveJoin = async (guest: Guest) => {
    const { error } = await supabase.rpc('approve_join', { p_event_id: id, p_user_id: guest.user_id });
    if (error) { showAlert('Could not let them in', error.message); return; }
    haptics.success();
    fetchEvent();
  };

  const declineJoin = async (guest: Guest) => {
    const name = guest.full_name ?? 'this person';
    const ok = await confirmAction('Decline request', `Decline ${name}? They won't be able to ask again with this link.`, 'Decline', true);
    if (!ok) return;
    const { error } = await supabase.rpc('decline_join', { p_event_id: id, p_user_id: guest.user_id });
    if (error) { showAlert('Could not decline', error.message); return; }
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
  // Guest limit (8.1): guests see Going rows in the guest list, so this count is right for them too
  const spotsLeft = event.max_guests != null ? Math.max(0, event.max_guests - going.length) : null;

  // Cover, title, host, who's going: on top on phones, the left column on desktop
  // First names for poll voters and open-event answers: the host, plus Going/Maybe guests
  const nameOf = (userId: string | null) => {
    if (!userId) return null;
    const full = userId === event.host_id ? host?.full_name : guests.find((g) => g.user_id === userId)?.full_name;
    return full?.split(' ')[0] ?? null;
  };

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
        <Sticker label={event.kind === 'open' ? 'TIME TBD · FINDING A TIME' : format(date, 'EEE · MMM d · h:mm a').toUpperCase()} bg={t.base} fg={t.ink} tilt={-2} />
        <Text style={theme.type.display}>{event.title}</Text>
        {host && (
          <View style={styles.hostRow}>
            <Avatar name={host.full_name} url={host.avatar_url} seed={host.id} size={30} />
            <View style={{ flexShrink: 1 }}>
              <Text style={theme.type.bodySecondary}>
                Hosted by <Text style={{ color: theme.colors.text, fontFamily: Fonts.bodyBold }}>{isHost ? 'you' : host.full_name ?? 'Unknown'}</Text>
              </Text>
              {!isHost && <HostRecord hostId={host.id} name={host.full_name?.split(' ')[0] ?? 'Their'} />}
            </View>
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
          // Bills are for the people going (who can see them); the chat stays for talking
          ...(isGoing ? [{ value: 'bills' as const, label: 'Bills' }] : []),
          { value: 'photos', label: album?.photos.length ? `Photos ${album.photos.length}` : 'Photos' },
        ]}
        value={tab}
        onChange={setTab}
      />
    </View>
  );

  // Guest: anything you owe this host, from this event or an earlier one (it blocks RSVPs, R6)
  // Pledge debts only: a split (8.3) is between guests, paid from its card or the pay page, and never blocks RSVPs
  const debtsToHost = obligations.filter((o) => isPledgeDebt(o) && o.role === 'guest' && o.other_user_id === event.host_id && (isOpen(o) || o.event_id === id));
  const blockedByDebt = debtsToHost.some(isOpen);
  // Host: debts for this event
  const eventDebts = obligations.filter((o) => isPledgeDebt(o) && o.role === 'host' && o.event_id === id);
  const refreshPledges = () => { reloadObligations(); fetchEvent(); refreshBadges(); };

  const bills = (
    <View style={styles.body}>
      <BillsTab
        eventId={id}
        myId={user?.id}
        canStart={isGoing && event.kind !== 'open' && new Date(event.date) <= new Date()}
        notStartedYet={event.kind === 'open' || new Date(event.date) > new Date()}
        onStart={startReceipt}
        starting={startingReceipt}
        obligations={obligations}
        version={receiptTick + focusTick}
      />
    </View>
  );

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


      {event.kind === 'open' && (isHost || rsvp) && (
        <OpenEventSlots eventId={id} isHost={isHost} myId={user?.id} nameOf={nameOf} onLocked={fetchEvent} />
      )}
      {!isHost && rsvp && (
        <Card style={styles.rsvpCard}>
          <Text style={theme.type.heading}>{rsvp.status === 'invited' ? 'Are you coming?' : 'Your RSVP'}</Text>
          {blockedByDebt && rsvp.status !== 'yes' && (
            <Text style={[theme.type.value, { color: theme.colors.dangerText }]}>Settle up with {host?.full_name?.split(' ')[0] ?? 'the host'} above to RSVP.</Text>
          )}
          <PledgeNote event={event} rsvp={rsvp} hostName={host?.full_name?.split(' ')[0] ?? 'the host'} onConfirm={() => handleRsvp('yes')} />
          {rsvp.status === 'yes' && canCheckIn(event) && (
            rsvp.checked_in_at
              ? <Text style={[theme.type.caption, { color: theme.colors.successText }]}>You checked in at {format(new Date(rsvp.checked_in_at), 'h:mm a')}</Text>
              : <Button title="I'm here" icon="location-outline" variant="secondary" onPress={checkIn} style={{ alignSelf: 'flex-start' }} />
          )}
          {spotsLeft != null && rsvp.status !== 'yes' && (
            <Text style={[theme.type.caption, spotsLeft === 0 && { color: theme.colors.dangerText }]}>
              {spotsLeft === 0 ? "It's full. You can still say Maybe." : spotsLeft === 1 ? '1 spot left' : `${spotsLeft} spots left`}
            </Text>
          )}
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
          {/* Muting is private: the host just sees "can't be invited right now" (8.8) */}
          {rsvp.status === 'invited' && host && (
            <Button
              title={`Stop direct invites from ${host.full_name?.split(' ')[0] ?? 'this host'}`}
              variant="ghost"
              size="sm"
              style={{ alignSelf: 'flex-start' }}
              onPress={async () => {
                const ok = await confirmAction('Stop direct invites?', `${host.full_name?.split(' ')[0] ?? 'They'} won't be able to add you to events straight from wya. Invite links still work. They won't be told.`, 'Stop them');
                if (!ok) return;
                const { error } = await supabase.rpc('mute_host', { p_host_id: host.id });
                showAlert(error ? 'Could not save' : 'Done', error ? error.message : 'You can change this later under You.');
              }}
            />
          )}
          {rsvp.status !== 'invited' && (
            <Button title="Save note" variant="outline" size="sm" onPress={() => handleRsvp(rsvp.status)} style={{ alignSelf: 'flex-start' }} />
          )}
        </Card>
      )}

      <Card padded={false}>
        {event.kind === 'open'
          ? <InfoRow icon="calendar" title="Time to be decided" subtitle="Pick the times you can make below" />
          : <InfoRow icon="calendar" title={format(date, 'EEEE, MMMM d')} subtitle={format(date, 'h:mm a') + (event.end_date ? ` – ${format(new Date(event.end_date), 'h:mm a')}` : '')} />}
        <InfoRow
          icon="location"
          title={event.venue_name || event.address || 'Address hidden'}
          subtitle={!canSeeAddress ? 'RSVP to see the address' : event.venue_name ? event.address ?? undefined : undefined}
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

      <ImageLightbox images={event.venue_images ?? []} startIndex={venueViewer} onClose={() => setVenueViewer(null)} />

      <View style={styles.section}>
        <Text style={theme.type.sectionHeading}>{isHost ? 'Guests' : "Who's going"}</Text>
        {(isHost || (event.allow_guest_invites && (rsvp?.status === 'yes' || rsvp?.status === 'maybe'))) && (
          <InvitePeople eventId={id} existing={[event.host_id, ...guests.map((g) => g.user_id)]} />
        )}
        <GuestList guests={guests} isHost={isHost} onRemove={isHost ? removeGuest : undefined} onApprove={isHost ? approveJoin : undefined} onDecline={isHost ? declineJoin : undefined} />
      </View>
    </View>
  );

  // On phones the chat scrolls under the hero; on desktop the hero has its own column
  // Scrolling mid-layout is unreliable, so wait a frame
  const scrollChatToEnd = () => requestAnimationFrame(() => chatRef.current?.scrollToEnd({ animated: true }));

  // Every image in the chat, oldest first, so the viewer can swipe through them all
  const chatImages = messages.flatMap((m) => (m.image_path ? [chatImageUrl(m.image_path)] : []));
  const openChatImage = (path: string) => setChatViewer(chatImages.indexOf(chatImageUrl(path)));
  const suggestions = canChat ? suggestCommands(newMessage, isHost) : [];

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
          extraData={[pollVersions, focusTick, planTick, receiptTick]}
          renderItem={({ item }) => (item.kind === 'poll'
            ? <PollCard message={item} myId={user?.id} isHost={isHost} nameOf={nameOf} version={pollVersions[item.id] ?? 0} />
            : item.kind === 'split'
              ? <SplitCard message={item} myId={user?.id} version={focusTick} />
              : item.kind === 'plan'
                ? <PlanCard message={item} eventId={id} myId={user?.id} isHost={isHost} version={planTick + focusTick} />
              : item.kind === 'receipt'
                ? <ReceiptCard message={item} myId={user?.id} version={receiptTick + focusTick} />
              : <ChatBubble message={item} isMe={item.user_id === user?.id} onImagePress={openChatImage} />)}
          ListEmptyComponent={<Text style={[theme.type.bodySecondary, styles.chatEmpty]}>No messages yet. Say hi 👋</Text>}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {chatHeader}
          <EmptyState icon="lock-closed-outline" title="Chat is for people who are coming" body={'RSVP "Going" or "Maybe" to join the conversation.'} />
        </ScrollView>
      )}
      {suggestions.length > 0 && (
        <View style={styles.cmdSuggestions}>
          {suggestions.map((cmd) => (
            <PressableScale key={cmd.name} onPress={() => setNewMessage(`/${cmd.name} `)} style={styles.cmdRow} accessibilityLabel={`Use /${cmd.name}`}>
              <Text style={[theme.type.value, { fontFamily: Fonts.bodyBold }]}>/{cmd.name}</Text>
              <Text style={[theme.type.caption, { flex: 1 }]} numberOfLines={1}>{cmd.description}</Text>
            </PressableScale>
          ))}
        </View>
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
            placeholder="Message, or / for commands"
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />
          <PressableScale
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sendingCommand}
            style={[styles.sendBtn, { backgroundColor: theme.colors.primary }]}
            accessibilityLabel="Send message"
          >
            <Ionicons name="arrow-up" size={20} color={theme.colors.onPrimary} />
          </PressableScale>
        </View>
      )}
      <ImageLightbox images={chatImages} startIndex={chatViewer} onClose={() => setChatViewer(null)} />
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
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>{tab === 'details' ? details : tab === 'bills' ? bills : photos}</ScrollView>
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
          {tab === 'details' ? details : tab === 'bills' ? bills : photos}
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
      <Ionicons name={config.icon} size={22} color={active ? c.onStatus : config.color} />
      <Text style={[theme.type.button, { fontSize: 14, color: active ? c.onStatus : c.text }]}>{config.label}</Text>
    </PressableScale>
  );
}

// Chat images live in the public event-images bucket; rows keep only the path
const chatImageUrl = (path: string) => supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl;

// "Hannah's events: 8 happened · 0 called off late" (8.5). Shown once they've hosted something.
function HostRecord({ hostId, name }: { hostId: string; name: string }) {
  const { theme } = useTheme();
  const [record, setRecord] = useState<{ hosted: number; happened: number; cancelled_late: number } | null>(null);
  useEffect(() => {
    supabase.rpc('get_host_record', { p_host_id: hostId }).then(({ data }) => setRecord(data?.[0] ?? null));
  }, [hostId]);
  if (!record || (record.happened === 0 && record.cancelled_late === 0)) return null;
  return (
    <Text style={[theme.type.caption, record.cancelled_late > 0 && { color: theme.colors.warningText }]}>
      {name}'s events: {record.happened} happened · {record.cancelled_late} called off late
    </Text>
  );
}

// Kinds this version of the app can draw; anything newer gets a polite placeholder
const DRAWN_KINDS: ChatMessageKind[] = ['text', 'image', 'poll', 'split', 'plan', 'bot', 'system', 'receipt'];

function ChatBubble({ message, isMe, onImagePress }: { message: ChatMessage; isMe: boolean; onImagePress: (path: string) => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  // Image bubbles have no background, so their time sits on the page, not on primary
  const onPrimary = isMe && !message.image_path;
  const timeLabel = (
    <Text style={[theme.type.micro, { alignSelf: 'flex-end' }, onPrimary && { color: theme.colors.onPrimary, opacity: 0.7 }]}>
      {format(new Date(message.created_at), 'h:mm a')}
    </Text>
  );
  if (message.kind === 'bot' || message.kind === 'system') {
    const askedBy: string | undefined = message.data?.asked_by_name;
    return (
      <View style={styles.msgRow}>
        <View style={styles.botMark}><Logo size={11} /></View>
        <View style={[styles.bubble, styles.bubbleBot]}>
          <Text style={[theme.type.caption, { fontFamily: Fonts.bodyBold, color: theme.colors.text }]}>
            wya{askedBy ? <Text style={{ fontFamily: Fonts.body, color: theme.colors.textSecondary }}>{` · asked by ${askedBy.split(' ')[0]}`}</Text> : null}
          </Text>
          <Text style={theme.type.body}>{message.content}</Text>
          {timeLabel}
        </View>
      </View>
    );
  }
  if (!DRAWN_KINDS.includes(message.kind)) {
    return (
      <View style={[styles.msgRow, isMe && { justifyContent: 'flex-end' }]}>
        <View style={[styles.bubble, styles.bubbleThem]}>
          <Text style={theme.type.bodySecondary}>Update wya to see this message</Text>
          {timeLabel}
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.msgRow, isMe && { justifyContent: 'flex-end' }]}>
      {!isMe && <Avatar name={message.profile?.full_name ?? null} url={message.profile?.avatar_url} seed={message.user_id ?? message.id} size={30} />}
      {message.image_path ? (
        <View style={[styles.bubble, styles.bubbleImg, isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
          {!isMe && <Text style={[theme.type.caption, { fontFamily: Fonts.bodyBold, color: theme.colors.text }]}>{message.profile?.full_name ?? 'Unknown'}</Text>}
          <PressableScale onPress={() => onImagePress(message.image_path!)} accessibilityLabel="View image">
            <Image source={{ uri: chatImageUrl(message.image_path) }} style={styles.chatImg} contentFit="cover" recyclingKey={message.id} transition={150} />
          </PressableScale>
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
    cmdSuggestions: { borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: t.colors.surface, paddingVertical: Space.xs },
    cmdRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingHorizontal: Space.lg, paddingVertical: Space.sm },
    // wya's replies: highlight fill so they read as the app, not a person
    bubbleBot: { backgroundColor: t.colors.surfaceAlt, borderBottomLeftRadius: 6, borderWidth: t.outlineWidth, borderColor: t.colors.outline },
    botMark: {
      width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
      backgroundColor: t.colors.surface, borderWidth: t.outlineWidth, borderColor: t.colors.outline,
    },
  };
});
