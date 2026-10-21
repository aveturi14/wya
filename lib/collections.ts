import { showAlert } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { webUrl } from '@/lib/links';
import { formatMoney } from '@/lib/pledges';
import { freshChannel } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { format, isSameDay } from 'date-fns';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Share } from 'react-native';

/**
 * Collect before you book (stage 1.1; docs/split-app/STAGE_1_1_PLAN.md).
 * An organiser asks the event's people for a fixed amount each; each person
 * taps "I'm in" (their consent and their debt), pays the organiser by PayID and
 * says so; the organiser confirms it arrived. Funded = enough CONFIRMED shares.
 * Every rule lives in the database (…_collections.sql); these are thin wrappers.
 *
 * Links (stage 1.1b; docs/split-app/STAGE_1_1_LINKS.md): every collection has a
 * link (/c/<code>). "I'm in" from the link is a request the organiser approves;
 * nothing is owed and no PayID is shown before that. Collections can also stand
 * alone (a hidden event holds them). $200 a person at most.
 */

export const MAX_PER_PERSON_CENTS = 20000;

export type CollectionStatus = 'open' | 'funded' | 'booked' | 'expired' | 'cancelled';
// in: committed · says_paid: they say they've paid · confirmed: the organiser got it
export type ShareState = 'in' | 'says_paid' | 'confirmed' | 'disputed' | 'refund_requested' | 'refunded';

export type CollectPerson = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  state: ShareState;
  amount_cents: number;
  // Only for the organiser (every share) and for your own
  obligation_id: string | null;
  joined_at: string;
  paid_at: string | null;
  confirmed_at: string | null;
};

export type CollectRequest = { user_id: string; name: string | null; avatar_url: string | null; requested_at: string };
// Where you stand on a link you asked through
export type RequestState = 'requested' | 'approved' | 'declined' | 'withdrawn';

export type Collection = {
  id: string;
  event_id: string;
  // False for collections without an event (the hidden one), and for people who came by the link
  can_open_event: boolean;
  standalone: boolean;
  // The organiser only
  link_code: string | null;
  link_enabled: boolean;
  event_title: string;
  event_date: string;
  event_theme: string;
  organiser_id: string;
  organiser_name: string | null;
  organiser_avatar: string | null;
  title: string;
  merchant_note: string | null;
  per_person_cents: number;
  min_people: number;
  max_people: number | null;
  // Already defaulted to per person × minimum when the organiser didn't set one
  target_cents: number;
  deadline: string;
  status: CollectionStatus;
  funded_at: string | null;
  booked_at: string | null;
  closed_at: string | null;
  go_ahead_short: boolean;
  created_at: string;
  is_organiser: boolean;
  can_join: boolean;
  counts: { joined: number; claimed: number; confirmed: number; claimed_cents: number; confirmed_cents: number; to_confirm: number; refunds_due: number; requests: number };
  people: CollectPerson[];
  // The organiser only: people waiting to be let in
  requests: CollectRequest[];
  my_request: RequestState | null;
  my_obligation_id: string | null;
  my_state: ShareState | null;
  my_reference: string | null;
};

export type MyCollection = {
  id: string;
  event_id: string;
  event_title: string;
  title: string;
  status: CollectionStatus;
  deadline: string;
  per_person_cents: number;
  min_people: number;
  target_cents: number;
  organiser_id: string;
  organiser_name: string | null;
  standalone: boolean;
  role: 'organiser' | 'member' | 'requested' | 'can_join';
  my_obligation_id: string | null;
  my_state: ShareState | null;
  joined: number;
  confirmed: number;
  confirmed_cents: number;
  to_confirm: number;
  refunds_due: number;
  // The organiser only: people waiting to be let in
  requests: number;
};

/** The booking page behind a link: works signed out, never a PayID or anyone's name but the organiser's. */
export type CollectionPreview =
  | { link_status: 'off'; title: string; organiser_name: string | null }
  | {
    link_status: 'open';
    id: string;
    title: string;
    merchant_note: string | null;
    per_person_cents: number;
    min_people: number;
    max_people: number | null;
    target_cents: number;
    deadline: string;
    status: CollectionStatus;
    organiser_name: string | null;
    organiser_avatar: string | null;
    joined: number;
    confirmed: number;
    // Signed in: organiser, member (in it), guest (on the event: joins straight away), or your request
    me: null | 'organiser' | 'member' | 'guest' | 'none' | RequestState;
  };

export const isLive = (s: CollectionStatus) => s === 'open' || s === 'funded';
export const firstName = (name: string | null | undefined, fallback = 'Someone') => name?.split(' ')[0] || fallback;

// "by Thu 6pm", or "by 6pm today"
export function formatDeadline(iso: string) {
  const d = new Date(iso);
  const time = format(d, 'h:mm a').replace(':00', '').toLowerCase();
  return isSameDay(d, new Date()) ? `${time} today` : `${format(d, 'EEE d MMM')}, ${time}`;
}

/** For an event, or on its own (no eventId: a standalone collection). Returns the collection id. */
export async function createCollection(args: {
  eventId?: string; title: string; perPersonCents: number; minPeople: number; deadline: Date;
  maxPeople?: number | null; targetCents?: number | null; note?: string | null;
}) {
  const common = {
    p_title: args.title, p_per_person_cents: args.perPersonCents,
    p_min_people: args.minPeople, p_deadline: args.deadline.toISOString(),
    p_max_people: args.maxPeople ?? null, p_target_cents: args.targetCents ?? null, p_merchant_note: args.note ?? null,
  };
  const { data, error } = args.eventId
    ? await supabase.rpc('create_collection', { p_event_id: args.eventId, ...common })
    : await supabase.rpc('create_standalone_collection', common);
  if (error) throw error;
  return data as string;
}

export const collectionLink = (code: string) => webUrl(`c/${code}`);

/** The share sheet on phones (and browsers that have one); otherwise the link goes on the clipboard. */
export async function shareCollection(c: Pick<Collection, 'title' | 'per_person_cents' | 'deadline' | 'organiser_name' | 'link_code'>) {
  if (!c.link_code) return;
  const url = collectionLink(c.link_code);
  const message = `${firstName(c.organiser_name)} is collecting ${formatMoney(c.per_person_cents)} each for ${c.title}, by ${formatDeadline(c.deadline)}. Tap to say you're in: ${url}`;
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: c.title, text: message, url });
        return;
      }
      await Clipboard.setStringAsync(message);
      haptics.success();
      showAlert('Link copied', 'Paste it in your group chat.');
      return;
    }
    await Share.share({ message });
  } catch {
    // Closing the share sheet isn't an error
  }
}

/** Calls one of the collection RPCs; throws the database error (its message is written for people). */
export async function collectAction(
  fn: 'join_collection' | 'leave_collection' | 'confirm_received' | 'dispute_payment' | 'mark_refunded'
    | 'go_ahead_anyway' | 'mark_booked' | 'extend_deadline' | 'cancel_collection' | 'claim_paid'
    | 'request_to_join' | 'withdraw_request' | 'approve_request' | 'decline_request' | 'set_collection_link' | 'report_collection',
  args: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** One collection, kept fresh: on focus, and live while open (status changes, and shares you can see). */
export function useCollection(id: string | undefined, version = 0) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [error, setError] = useState<{ message?: string; hint?: string | null } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error: e } = await supabase.rpc('get_collection', { p_id: id });
    if (e) setError(e);
    else { setCollection(data as Collection); setError(null); }
    setLoaded(true);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { if (version) load(); }, [version, load]);

  useEffect(() => {
    if (!id || !collection) return;
    const channel = freshChannel(`collect:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'collections', filter: `id=eq.${id}` }, () => load())
      // The organiser sees every share change; a participant sees their own
      .on('postgres_changes', { event: '*', schema: 'public', table: 'obligations', filter: `collection_id=eq.${id}` }, () => load())
      // Requests through the link (organiser: all of them; requester: their own)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collection_requests', filter: `collection_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, !!collection, load]);

  return { collection, error, loaded, reload: load };
}

/** What I'm organising, what I've joined, and open ones on my events (Home → Needs you). */
export function useMyCollections(enabled = true) {
  const [items, setItems] = useState<MyCollection[]>([]);
  const load = useCallback(async () => {
    if (!enabled) return;
    const { data } = await supabase.rpc('get_my_collections');
    setItems((data ?? []) as MyCollection[]);
  }, [enabled]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return { collections: items, reload: load };
}
