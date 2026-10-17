import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

/**
 * Dues (Phase 8.18): everything you owe and are owed, and why, from one database
 * function (get_my_dues). Covers itemised bills, even splits and pledges, plus
 * bills still being claimed, whose amounts are estimates ('pending').
 */
export type DueItem = { name: string; quantity: number; amount_cents: number; shared_by: number; my_cents: number };

export type Due = {
  key: string;
  kind: 'bill' | 'split' | 'pledge';
  // owe: you pay them · owed: they pay you
  direction: 'owe' | 'owed';
  state: 'pending' | 'owed' | 'excuse_pending' | 'disputed' | 'paid' | 'waived';
  amount_cents: number;
  other_id: string;
  other_name: string | null;
  other_avatar: string | null;
  description: string;
  merchant: string | null;
  event_id: string;
  event_title: string;
  event_date: string;
  venue_name: string | null;
  obligation_id?: string | null;
  receipt_id?: string | null;
  split_id?: string | null;
  created_at: string;
  paid_at?: string | null;
  // Pending bills
  claimed?: boolean;
  confirmed?: boolean;
  // Bills: what this person had, and their part of the surcharges/tips/discounts
  items?: DueItem[] | null;
  extras_cents?: number | null;
  // Even splits: how many people shared it
  split_people?: number | null;
};

export const isOpenDue = (d: Due) => d.state === 'owed' || d.state === 'disputed' || d.state === 'excuse_pending';
export const isSettledDue = (d: Due) => d.state === 'paid' || d.state === 'waived';

/** Totals for the header: what you owe now, what's owed to you, and bills not final yet. */
export function sumDues(dues: Due[]) {
  const sum = (f: (d: Due) => boolean) => dues.filter(f).reduce((t, d) => t + d.amount_cents, 0);
  return {
    owe: sum((d) => d.direction === 'owe' && isOpenDue(d)),
    owed: sum((d) => d.direction === 'owed' && isOpenDue(d)),
    pendingOwe: sum((d) => d.direction === 'owe' && d.state === 'pending'),
    pendingOwed: sum((d) => d.direction === 'owed' && d.state === 'pending'),
  };
}

/** Dues for one event, or every event when eventId is undefined. Reloads on focus and when `version` changes. */
export function useDues(eventId?: string, version = 0) {
  const [dues, setDues] = useState<Due[] | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_my_dues', eventId ? { p_event_id: eventId } : {});
    if (!error) setDues((data ?? []) as Due[]);
    else setDues((d) => d ?? []);
  }, [eventId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load, version]);
  return { dues, reload: load };
}
