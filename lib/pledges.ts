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
  reason: 'no_show' | 'late_cancel';
  status: ObligationStatus;
  reference: string;
  excuse: string | null;
  excuse_declined: boolean;
  created_at: string;
  paid_at: string | null;
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
  return {
    owed: { label: 'Owes', bg: c.danger, fg: c.onStatus },
    excuse_pending: { label: 'Excuse sent', bg: c.warning, fg: c.onStatus },
    disputed: { label: 'Not received', bg: c.danger, fg: c.onStatus },
    paid: { label: 'Paid', bg: c.success, fg: c.onStatus },
    waived: { label: 'Let off', bg: c.surfaceAlt, fg: c.textSecondary },
  }[status];
}

export const reasonLabel = (reason: Obligation['reason']) => (reason === 'late_cancel' ? 'cancelled after the cutoff' : "didn't show");

// Database errors raised with a hint we handle specially in the UI
export const isOpenDebtError = (e: { hint?: string | null } | null) => e?.hint === 'OPEN_DEBT';
