import AlbumTab from '@/components/album/AlbumTab';
import CollectCard from '@/components/collect/CollectCard';
import CollectForm from '@/components/collect/CollectForm';
import EventChat from '@/components/event/EventChat';
import EventHero, { EventPoster, EventTitle, QuietCounts } from '@/components/event/EventHero';
import HostTools from '@/components/event/HostTools';
import RsvpBar from '@/components/event/RsvpBar';
import GuestList, { Guest } from '@/components/GuestList';
import InvitePeople from '@/components/InvitePeople';
import OpenEventSlots from '@/components/OpenEventSlots';
import AttendanceCard from '@/components/pledges/AttendanceCard';
import PayCard from '@/components/pledges/PayCard';
import PledgesPanel from '@/components/pledges/PledgesPanel';
import BillsTab from '@/components/receipts/BillsTab';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Confetti from '@/components/ui/Confetti';
import EmptyState from '@/components/ui/EmptyState';
import EventHeader from '@/components/ui/EventHeader';
import ImageLightbox from '@/components/ui/ImageLightbox';
import ListRow, { ListGroup } from '@/components/ui/ListRow';
import { PosterGlow } from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Screen, { MAX_WIDE_CONTENT_WIDTH } from '@/components/ui/Screen';
import Segmented from '@/components/ui/Segmented';
import Sheet from '@/components/ui/Sheet';
import { useTopInset } from '@/components/ui/TabScreen';
import { eventTheme } from '@/constants/eventThemes';
import { Radius, Space } from '@/constants/theme';
import { useAlbum } from '@/hooks/useAlbum';
import { useAuth } from '@/hooks/useAuth';
import { clamp, useLayout } from '@/hooks/useLayout';
import { useObligations } from '@/hooks/useObligations';
import { usePageTitle } from '@/hooks/usePageTitle';
import { TOP_BAR_SPACE } from '@/hooks/useTabBarSpace';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { useUnread } from '@/hooks/useUnread';
import { confirmAction, showAlert } from '@/lib/alert';
import { billTotal, parseBillText } from '@/lib/billText';
import { commandsFor, ParsedCommand, parseCommand, suggestCommands } from '@/lib/commands';
import { EVENT_COLUMNS, withAddresses } from '@/lib/events';
import { haptics } from '@/lib/haptics';
import { CollectionStatus, isLive } from '@/lib/collections';
import { canMarkAttendance, formatMoney, isOpen, isOpenDebtError, isPastCutoff, isPledgeDebt, isPledgeEvent } from '@/lib/pledges';
import { freshChannel } from '@/lib/realtime';
import { uploadReceiptPhoto } from '@/lib/receipts';
import { supabase } from '@/lib/supabase';
import { ChatMessage, Event, Profile, Rsvp, RsvpStatus } from '@/lib/types';
import { uploadFile } from '@/lib/upload';
import { shrink } from '@/lib/album';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Platform, ScrollView, Share, Text, View } from 'react-native';

export default function EventScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { isWide, contentWidth, height: windowHeight } = useLayout();
  // Desktop: the poster column is a share of the window, and the poster keeps its 4:5 shape
  const posterColumn = clamp(contentWidth * 0.38, 340, 520);
  const posterHeight = Math.min(Math.round(posterColumn * 1.25), Math.max(420, windowHeight - 140));
  const { refresh: refreshBadges } = useUnread();
  const { obligations, reload: reloadObligations } = useObligations();

  const [event, setEvent] = useState<Event | null>(null);
  const [host, setHost] = useState<Profile | null>(null);
  const [rsvp, setRsvp] = useState<Rsvp | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  // Chats links straight to an event's chat (?tab=chat), Activity to its album (?tab=photos); bills (8.18) have ?tab=bills
  const [tab, setTab] = useState<'details' | 'chat' | 'bills' | 'photos'>(initialTab === 'chat' || initialTab === 'photos' || initialTab === 'bills' ? initialTab : 'details');
  const { album, urls: photoUrls, reload: reloadAlbum, error: albumError } = useAlbum(id, tab === 'photos');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [venueViewer, setVenueViewer] = useState<number | null>(null); // index into event.venue_images
  // Side tasks open as sheets over the event (guest list, invite people, Who came?)
  const [sheet, setSheet] = useState<'guests' | 'invite' | 'came' | null>(null);
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
  // The event's latest collection (stage 1.1), and whether the "Collect money" form is open
  const [collection, setCollection] = useState<{ id: string; status: CollectionStatus } | null>(null);
  const [collecting, setCollecting] = useState(false);
  const chatRef = useRef<FlatList>(null);
  usePageTitle(event?.title);
  const topInset = useTopInset();

  const isHost = event?.host_id === user?.id;
  // Going: the host, or I'm in and not marked as a no-show
  const isGoing = isHost || (rsvp?.status === 'yes' && rsvp.attended !== false);
  // On the event's bills: the host or any guest, except someone still asking to join or marked absent (8.18)
  const onBills = isHost || (!!rsvp && rsvp.status !== 'requested' && rsvp.attended !== false);
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

  const fetchCollection = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('collections').select('id, status').eq('event_id', id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    setCollection((data as { id: string; status: CollectionStatus } | null) ?? null);
  }, [id, user]);

  // Refetch whenever the screen comes back into focus, e.g. after editing the event
  useFocusEffect(useCallback(() => { fetchEvent(); fetchCollection(); setFocusTick((n) => n + 1); }, [fetchEvent, fetchCollection]));

  // Someone starts (or closes) a collection on this event while you're looking
  useEffect(() => {
    if (!user) return;
    const channel = freshChannel(`collections:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collections', filter: `event_id=eq.${id}` }, () => fetchCollection())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, user, fetchCollection]);

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
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false });
    if (result.canceled || !result.assets[0] || !user) return;
    setSendingImage(true);
    try {
      // Sharp on a big screen but not a 12 MB original: the same size and quality as the album
      const photo = await shrink(result.assets[0].uri, 2560, 0.85);
      const path = await uploadFile('event-images', `chat/${user.id}/${Date.now()}.jpg`, photo.uri, 'image/jpeg');
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

  // Muting is private: the host just sees "can't be invited right now" (8.8)
  const muteHost = async () => {
    if (!host) return;
    const first = host.full_name?.split(' ')[0];
    const ok = await confirmAction('Stop direct invites?', `${first ?? 'They'} won't be able to add you to events straight from wya. Invite links still work. They won't be told.`, 'Stop them');
    if (!ok) return;
    const { error } = await supabase.rpc('mute_host', { p_host_id: host.id });
    showAlert(error ? 'Could not save' : 'Done', error ? error.message : 'You can change this later under You.');
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'));

  if (loading) return <Screen style={styles.center}><ActivityIndicator color={theme.colors.textSecondary} size="large" /></Screen>;
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
  const hostFirst = host?.full_name?.split(' ')[0] ?? 'the host';
  const going = guests.filter((g) => g.status === 'yes').map((g) => ({ id: g.user_id, name: g.full_name, avatarUrl: g.avatar_url }));
  const maybeCount = guests.filter((g) => g.status === 'maybe').length;
  // Guest limit (8.1): guests see Going rows in the guest list, so this count is right for them too
  const spotsLeft = event.max_guests != null ? Math.max(0, event.max_guests - going.length) : null;

  // First names for poll voters and open-event answers: the host, plus Going/Maybe guests
  const nameOf = (userId: string | null) => {
    if (!userId) return null;
    const full = userId === event.host_id ? host?.full_name : guests.find((g) => g.user_id === userId)?.full_name;
    return full?.split(' ')[0] ?? null;
  };

  // Guest: anything you owe this host, from this event or an earlier one (it blocks RSVPs, R6)
  // Pledge debts only: a split (8.3) is between guests, paid from its card or the pay page, and never blocks RSVPs
  const debtsToHost = obligations.filter((o) => isPledgeDebt(o) && o.role === 'guest' && o.other_user_id === event.host_id && (isOpen(o) || o.event_id === id));
  const blockedByDebt = debtsToHost.some(isOpen);
  // Host: debts for this event
  const eventDebts = obligations.filter((o) => isPledgeDebt(o) && o.role === 'host' && o.event_id === id);
  const refreshPledges = () => { reloadObligations(); fetchEvent(); refreshBadges(); };
  const canInvite = isHost || (event.allow_guest_invites && (rsvp?.status === 'yes' || rsvp?.status === 'maybe'));
  const markable = isHost && canMarkAttendance(event);
  const when = event.kind === 'open' ? 'Time TBD' : format(date, 'EEE h:mm a').replace(':00', '');

  const heroProps = { event, host, isHost, rsvp, goingCount: going.length, onBack: goBack, onShare: inviteCode ? shareInvite : undefined };

  const tabsBlock = (
    <Segmented
      stretch
      options={[
        { value: 'details', label: 'Details' },
        { value: 'chat', label: 'Chat' },
        // Bills are for everyone on the event; the chat stays for talking
        ...(onBills ? [{ value: 'bills' as const, label: 'Bills' }] : []),
        { value: 'photos', label: album?.photos.length ? `Photos ${album.photos.length}` : 'Photos' },
      ]}
      value={tab}
      onChange={setTab}
    />
  );

  // Chat, bills and photos: back and a small poster on one line instead of the big hero
  const slimHeader = (
    <EventHeader title={event.title} theme={event.theme} imageUrl={event.cover_image} subtitle={`${going.length} going · ${when}`} onBack={goBack} />
  );

  // What you do here: the host's tools, or a guest's answer (and anything owed)
  const answer = (
    <View style={{ gap: Space.md }}>
      {!isHost && debtsToHost.map((o) => <PayCard key={o.id} obligation={o} onChange={refreshPledges} />)}
      {isHost ? (
        <HostTools
          guests={guests}
          maxGuests={event.max_guests}
          onInvite={() => setSheet('invite')}
          onRemind={() => runCommand({ name: 'remind' } as ParsedCommand)}
          onWhoCame={markable ? () => setSheet('came') : undefined}
          onEdit={() => router.push(`/event/edit/${id}`)}
          onGuests={() => setSheet('guests')}
        />
      ) : rsvp?.status === 'requested' ? (
        <Card style={{ gap: 4 }}>
          <Text style={theme.type.cardTitle}>{host?.full_name?.split(' ')[0] ?? 'The host'} will let you know</Text>
          <Text style={theme.type.bodySecondary}>You asked to join. You'll get a note in Activity when they answer.</Text>
        </Card>
      ) : rsvp ? (
        <RsvpBar
          event={event}
          rsvp={rsvp}
          hostName={hostFirst}
          blockedByDebt={blockedByDebt}
          spotsLeft={spotsLeft}
          note={additionalDetails}
          onNoteChange={setAdditionalDetails}
          onAnswer={handleRsvp}
          onCheckIn={checkIn}
          onMuteHost={host ? muteHost : undefined}
        />
      ) : null}
      {/* Collect before you book (stage 1.1): the live one, or the last one while it still matters */}
      {collection && collection.status !== 'cancelled' && <CollectCard key={collection.id} collectionId={collection.id} version={focusTick} />}
      {!isHost && (going.length > 0 || maybeCount > 0) && (
        <PressableScale onPress={() => setSheet('guests')} scaleTo={0.98} accessibilityLabel="See who's going" style={{ alignSelf: 'flex-start' }}>
          <QuietCounts going={going} maybe={maybeCount} />
        </PressableScale>
      )}
    </View>
  );

  const unlocked = !isHost && isPledgeEvent(event) && rsvp?.status === 'yes' && canSeeAddress;
  const details = (
    <View style={styles.tabBody}>
      {markable && <AttendanceCard eventId={id} guests={guests} onSaved={refreshPledges} />}
      {isHost && <PledgesPanel eventId={id} obligations={eventDebts} onChange={refreshPledges} />}

      {isGoing && !(collection && isLive(collection.status)) && (
        <ListGroup>
          <ListRow
            icon="cash-outline"
            title="Collect money"
            subtitle="Everyone pays you their share before you book"
            chevron
            onPress={() => setCollecting(true)}
          />
        </ListGroup>
      )}

      {event.kind === 'open' && (isHost || rsvp) && (
        <OpenEventSlots eventId={id} isHost={isHost} myId={user?.id} nameOf={nameOf} onLocked={fetchEvent} />
      )}

      <ListGroup>
        {canSeeAddress ? (
          <ListRow
            icon={unlocked ? 'lock-open-outline' : 'location-outline'}
            iconColor={unlocked ? theme.colors.successText : undefined}
            title={event.venue_name || event.address!}
            subtitle={[event.venue_name ? event.address : null, unlocked ? 'Unlocked' : null].filter(Boolean).join(' · ')}
            subtitleLines={2}
            trailing={<Button title="Directions" size="sm" variant="soft" onPress={openDirections} />}
          />
        ) : (
          <ListRow icon="lock-closed-outline" title="Address after you RSVP" subtitle={event.venue_name ?? undefined} />
        )}
        {event.kind === 'open'
          ? <ListRow icon="calendar-clear-outline" title="Time to be decided" subtitle="Pick the times you can make above" />
          : <ListRow icon="calendar-clear-outline" title={format(date, 'EEEE d MMMM')} subtitle={format(date, 'h:mm a') + (event.end_date ? ` – ${format(new Date(event.end_date), 'h:mm a')}` : '')} />}
        {(event.contact_numbers?.length ?? 0) > 0 && <ListRow icon="call-outline" title={event.contact_numbers.join(' · ')} subtitle="Contact" />}
      </ListGroup>

      {(!!event.description || !!event.notes || !!event.dress_code) && (
        <Card style={{ gap: Space.sm }}>
          <Text style={theme.type.label}>From {isHost ? 'you' : hostFirst}</Text>
          {!!event.description && <Text style={theme.type.body}>{event.description}</Text>}
          {!!event.notes && <Text style={theme.type.body}>{event.notes}</Text>}
          {!!event.dress_code && <Chip label={`Dress: ${event.dress_code}`} />}
        </Card>
      )}

      {(event.venue_images?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={theme.type.label}>The venue</Text>
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
        <Text style={theme.type.label}>Guests</Text>
        <ListGroup>
          <ListRow
            icon="people-outline"
            title={isHost ? 'Guest list' : "Who's going"}
            subtitle={`${going.length} going · ${maybeCount} maybe${isHost ? ` · ${guests.filter((g) => g.status === 'invited').length} waiting` : ''}`}
            chevron
            onPress={() => setSheet('guests')}
          />
          {canInvite && <ListRow icon="person-add-outline" title="Invite people" subtitle="From past events, or send the link" chevron onPress={() => setSheet('invite')} />}
        </ListGroup>
      </View>
    </View>
  );

  const bills = (
    <View style={styles.tabBody}>
      <BillsTab
        eventId={id}
        myId={user?.id}
        canStart={onBills}
        onStart={startReceipt}
        starting={startingReceipt}
        obligations={obligations}
        onPaid={reloadObligations}
        version={receiptTick + focusTick}
      />
    </View>
  );

  const photos = (
    <View style={styles.tabBody}>
      <AlbumTab eventId={id} album={album} urls={photoUrls} reload={reloadAlbum} error={albumError} accent={{ bg: t.a, fg: t.ink }} />
    </View>
  );

  const content = tab === 'details' ? details : tab === 'bills' ? bills : photos;

  const chat = (header: ReactElement | null) => (
    <EventChat
      eventId={id}
      eventTheme={event.theme}
      header={header}
      canChat={canChat}
      messages={messages}
      myId={user?.id}
      isHost={isHost}
      nameOf={nameOf}
      listRef={chatRef}
      pollVersions={pollVersions}
      focusTick={focusTick}
      planTick={planTick}
      receiptTick={receiptTick}
      draft={newMessage}
      onDraftChange={setNewMessage}
      onSend={handleSendMessage}
      sending={sendingCommand}
      onPickImage={handlePickChatImage}
      sendingImage={sendingImage}
      suggestions={canChat ? suggestCommands(newMessage, isHost) : []}
      onUseCommand={(name) => setNewMessage(`/${name} `)}
    />
  );

  const sheets = (
    <>
      <Sheet visible={sheet === 'guests'} onClose={() => setSheet(null)} title={isHost ? 'Guests' : "Who's going"} subtitle={`${going.length} going · ${maybeCount} maybe`} height={isHost ? '88%' : undefined}>
        <GuestList guests={guests} isHost={isHost} onRemove={isHost ? removeGuest : undefined} onApprove={isHost ? approveJoin : undefined} onDecline={isHost ? declineJoin : undefined} />
      </Sheet>
      {canInvite && (
        <InvitePeople
          eventId={id}
          existing={[event.host_id, ...guests.map((g) => g.user_id)]}
          visible={sheet === 'invite'}
          onClose={() => setSheet(null)}
          onShareLink={inviteCode ? shareInvite : undefined}
        />
      )}
      {isGoing && (
        <CollectForm
          eventId={id}
          eventTitle={event.title}
          eventDate={event.kind === 'open' ? undefined : event.date}
          visible={collecting}
          onClose={() => setCollecting(false)}
          onCreated={(cid) => { setCollecting(false); fetchCollection(); router.push(`/collect/${cid}`); }}
        />
      )}
      {markable && (
        <Sheet visible={sheet === 'came'} onClose={() => setSheet(null)}>
          <AttendanceCard eventId={id} guests={guests} onSaved={() => { refreshPledges(); setSheet(null); }} />
        </Sheet>
      )}
    </>
  );

  if (isWide) {
    // Desktop: the poster on the left, everything else beside it
    return (
      <Screen maxWidth={MAX_WIDE_CONTENT_WIDTH} glow={{ theme: event.theme, imageUrl: event.cover_image }}>
        <View style={[styles.wideRow, { paddingTop: TOP_BAR_SPACE }]}>
          <ScrollView style={[styles.wideLeft, { width: posterColumn }]} contentContainerStyle={styles.wideLeftContent} showsVerticalScrollIndicator={false}>
            <EventPoster {...heroProps} posterHeight={posterHeight} />
          </ScrollView>
          <View style={styles.wideRight}>
            {tab === 'chat' ? (
              <>
                <View style={styles.wideHead}>
                  <EventTitle {...heroProps} posterHeight={0} big />
                  {tabsBlock}
                </View>
                {chat(null)}
              </>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wideRightContent}>
                <EventTitle {...heroProps} posterHeight={0} big />
                {answer}
                {tabsBlock}
                {content}
              </ScrollView>
            )}
          </View>
        </View>
        {sheets}
        <Confetti burstKey={confetti} colors={[t.a, t.b]} />
      </Screen>
    );
  }

  return (
    <Screen>
      {tab === 'chat' ? (
        chat(<View style={[styles.pad, { paddingTop: topInset + Space.sm, gap: Space.md, paddingBottom: Space.md }]}>{slimHeader}{tabsBlock}</View>)
      ) : tab === 'details' ? (
        // The tabs stick under the status bar as you scroll past the poster
        <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: Space.xxxl }}>
          <View style={[styles.pad, { paddingTop: topInset + Space.sm, gap: Space.lg }]}>
            <PosterGlow theme={event.theme} imageUrl={event.cover_image} top={-40} height={460} />
            <EventHero {...heroProps} posterHeight={220} />
            {answer}
          </View>
          <View style={[styles.pad, styles.sticky]}>{tabsBlock}</View>
          {content}
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: Space.xxxl }}>
          <View style={[styles.pad, { paddingTop: topInset + Space.sm }]}>{slimHeader}</View>
          <View style={[styles.pad, styles.sticky]}>{tabsBlock}</View>
          {content}
        </ScrollView>
      )}
      {sheets}
      <Confetti burstKey={confetti} colors={[t.a, t.b]} />
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  center: { justifyContent: 'center', alignItems: 'center', padding: Space.xl },
  pad: { paddingHorizontal: Space.lg },
  sticky: { backgroundColor: t.colors.background, paddingVertical: Space.sm, zIndex: 2 },
  tabBody: { paddingHorizontal: Space.lg, paddingTop: Space.md, gap: Space.lg },
  section: { gap: Space.sm },
  gallery: { gap: Space.sm },
  galleryImg: { width: 150, height: 104, borderRadius: Radius.md },
  wideRow: { flex: 1, flexDirection: 'row', gap: Space.xxl + Space.xs, paddingHorizontal: Space.xxl, justifyContent: 'center' },
  wideLeft: { flexGrow: 0 },
  // Room for the poster's lift shadow, which the scroll view would otherwise clip into a grey box
  wideLeftContent: { paddingHorizontal: Space.lg, paddingTop: Space.xs, paddingBottom: Space.xxxl + Space.lg },
  wideRight: { flex: 1, minWidth: 0, maxWidth: 760 },
  wideHead: { gap: Space.md, paddingBottom: Space.md },
  wideRightContent: { gap: Space.lg, paddingBottom: Space.xxxl },
}));
