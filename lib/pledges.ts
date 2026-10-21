import { Theme } from '@/constants/theme';
import { Event } from '@/lib/types';
import { format, isSameDay } from 'date-fns';

// Option A ("pay up front") will add 'upfront'; everything below keys off the mode
export type DepositMode = 'none' | 'pledge';

// When a guest starts owing money under each mode
export const OWES_WHEN: Record<DepositMode, 'never' | 'on_flake'> = {
  none: 'never',
  pledge: 'on_flake',
};

export const PLEDGE_PRESETS_CENTS = [500, 1000, 2000];
export const CUTOFF_PRESETS_HOURS = [12, 24, 48];
export const MIN_PLEDGE_CENTS = 100;
export const MAX_PLEDGE_CENTS = 5000;

export type ObligationStatus = 'owed' | 'excuse_pending' | 'paid' | 'waived' | 'disputed';
export const OPEN_STATUSES: ObligationStatus[] = ['owed', 'excuse_pending', 'disputed'];

export type Obligation = {
  id: string;
  event_id: string;
  event_title: string;
  event_theme: string;
  event_date: string;
  role: 'guest' | 'host';
  other_user_id: string;
  other_name: string | null;
  amount_cents: number;
  currency: string;
  reason: 'no_show' | 'late_cancel' | 'shared_cost' | 'collection';
  status: ObligationStatus;
  reference: string;
  excuse: string | null;
  excuse_declined: boolean;
  created_at: string;
  paid_at: string | null;
  // 'split' (8.3): a share of a bill someone paid; never blocks RSVPs or counts against reliability
  // 'collect' (stage 1.1): a share of a collection, paid to the organiser by PayID only; same rules as a split
  kind: 'pledge' | 'split' | 'collect';
  split_id: string | null;
  // What a split or collection was for ("Dinner", "Karting at Kart World")
  description: string | null;
  // How it was settled: 'payid' ("I've paid") or 'wallet' (paid from the wya wallet, 9.11)
  paid_via?: 'payid' | 'wallet' | null;
  // Collections only: the organiser confirmed it arrived; a paid share on its way back
  collection_id?: string | null;
  confirmed_at?: string | null;
  refund_requested_at?: string | null;
  refunded_at?: string | null;
};

export const isOpen = (o: Pick<Obligation, 'status'>) => OPEN_STATUSES.includes(o.status);

// "$5" or "$5.50"
export function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export const isPledgeEvent = (event: Pick<Event, 'deposit_mode'>) => event.deposit_mode === 'pledge';

// Stored as hours before the start, so it moves with the event
export function cutoffFor(event: Pick<Event, 'date' | 'cutoff_hours'>) {
  return new Date(new Date(event.date).getTime() - event.cutoff_hours * 3600_000);
}

export const isPastCutoff = (event: Pick<Event, 'date' | 'cutoff_hours'>) => Date.now() >= cutoffFor(event).getTime();

// "Fri 7:00 PM", or "today at 7:00 PM"
export function formatCutoff(event: Pick<Event, 'date' | 'cutoff_hours'>) {
  const cutoff = cutoffFor(event);
  return isSameDay(cutoff, new Date()) ? `today at ${format(cutoff, 'h:mm a')}` : format(cutoff, 'EEE h:mm a');
}

// The host can mark who came from the start until 7 days after (matches record_attendance)
export function canMarkAttendance(event: Pick<Event, 'date'>) {
  const start = new Date(event.date).getTime();
  return Date.now() >= start && Date.now() <= start + 7 * 24 * 3600_000;
}

export function statusStyle(status: ObligationStatus, theme: Theme) {
  const c = theme.colors;
  // Quiet chips: the status colour on the text, not a coloured fill (Phase 9)
  return {
    owed: { label: 'Owes', bg: c.surfaceAlt, fg: c.dangerText },
    excuse_pending: { label: 'Excuse sent', bg: c.surfaceAlt, fg: c.warningText },
    disputed: { label: 'Not received', bg: c.surfaceAlt, fg: c.dangerText },
    paid: { label: 'Paid', bg: c.surfaceAlt, fg: c.successText },
    waived: { label: 'Let off', bg: c.surfaceAlt, fg: c.textSecondary },
  }[status];
}

export const reasonLabel = (reason: Obligation['reason']) =>
  reason === 'late_cancel' ? 'cancelled after the cutoff' : reason === 'shared_cost' ? 'shared a bill' : reason === 'collection' ? 'joined a collection' : "didn't show";

// "I'm here" (8.4): from 2 hours before the start until the end (or 6 hours after the start); mirrors check_in
export function canCheckIn(event: { date: string; end_date: string | null }, now = new Date()) {
  const start = new Date(event.date).getTime();
  const end = event.end_date ? new Date(event.end_date).getTime() : start + 6 * 3_600_000;
  return now.getTime() >= start - 2 * 3_600_000 && now.getTime() <= end;
}

// Pledge debts are the host's business (RSVP block, Pledges panel); splits and collections are between the people in them
export const isPledgeDebt = (o: Pick<Obligation, 'kind'>) => o.kind === 'pledge';

// Database errors raised with a hint we handle specially in the UI
export const isOpenDebtError = (e: { hint?: string | null } | null) => e?.hint === 'OPEN_DEBT';
