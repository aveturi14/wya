import { Theme } from '@/constants/theme';
import { formatMoney } from '@/lib/pledges';
import { format } from 'date-fns';

export type Notification = {
  id: string;
  type:
    | 'joined' | 'rsvp' | 'event_updated' | 'event_cancelled'
    // Pledges (Phase 3)
    | 'pledge_added' | 'pledge_released' | 'pledge_owed' | 'payment_claimed' | 'payment_disputed'
    | 'excuse_submitted' | 'excuse_resolved' | 'debt_waived' | 'maybe_reminder' | 'maybe_expired'
    // Album (Phase 4): one per person per event, updated while unread
    | 'photos_added'
    // Invite approval (Phase 8.1)
    | 'join_requested' | 'join_approved'
    // Bill splitting (Phase 8.3): opens the pay page
    | 'split_owed'
    // Nudges (Phase 8.6)
    | 'rsvp_reminder' | 'excuse_prompt'
    // Open events (Phase 8.7): the host locked in the time
    | 'event_locked'
    // Home agent (Phase 8.8): someone you've been to events with invited you directly
    | 'direct_invite'
    // Itemised bills (Phase 8.18): open the bill
    | 'receipt_to_claim' | 'receipt_ready' | 'receipt_reopened';
  event_id: string | null;
  // Who caused it (null for wya's own reminders)
  actor_id?: string | null;
  data: {
    title?: string;
    status?: 'yes' | 'maybe' | 'no';
    changes?: string[];
    actor_name?: string | null;
    amount_cents?: number;
    reason?: 'no_show' | 'late_cancel';
    accepted?: boolean;
    cutoff?: string;
    count?: number;
    uploaders?: string[];
    obligation_id?: string;
    kind?: 'pledge' | 'split';
    description?: string | null;
    starts_at?: string;
    receipt_id?: string;
    total_cents?: number;
  };
  read_at: string | null;
  created_at: string;
};

// Where tapping a notification goes: the pay page for a split, the bill, the album for photos, otherwise the event
export const notificationHref = (n: Notification) =>
  n.type === 'split_owed' && n.data.obligation_id
    ? (`/pay/${n.data.obligation_id}` as const)
    : n.data.receipt_id && (n.type === 'receipt_to_claim' || n.type === 'receipt_ready' || n.type === 'receipt_reopened')
      ? (`/receipt/${n.data.receipt_id}` as const)
      : (`/event/${n.event_id}${n.type === 'photos_added' ? '?tab=photos' : ''}` as const);

// What each notification says, and its icon and color
export function describe(n: Notification, theme: Theme) {
  const c = theme.colors;
  const who = n.data.actor_name?.split(' ')[0] ?? 'Someone';
  const title = n.data.title ?? 'an event';
  const amount = n.data.amount_cents != null ? formatMoney(n.data.amount_cents) : 'your pledge';
  const good = { color: c.success, onColor: c.onStatus };
  const bad = { color: c.danger, onColor: c.onStatus };
  const heads = { color: c.warning, onColor: c.onStatus };
  const info = { color: c.highlight, onColor: c.onHighlight };
  switch (n.type) {
    case 'joined':
      return { text: `${who} opened your invite to ${title}`, icon: 'person-add' as const, color: c.primary, onColor: c.onPrimary };
    case 'join_requested':
      return { text: `${who} is asking to join ${title}`, icon: 'hand-left' as const, ...heads };
    case 'join_approved':
      return { text: `${who} let you into ${title}. Are you coming?`, icon: 'enter' as const, ...good };
    case 'rsvp':
      if (n.data.status === 'yes') return { text: `${who} is going to ${title}`, icon: 'checkmark' as const, ...good };
      if (n.data.status === 'maybe') return { text: `${who} might come to ${title}`, icon: 'help' as const, ...heads };
      return { text: `${who} can't make it to ${title}`, icon: 'close' as const, ...bad };
    case 'event_updated': {
      const changes = n.data.changes ?? [];
      const what = changes.length === 1 ? `the ${changes[0]}` : changes.length === 2 ? `the ${changes[0]} and ${changes[1]}` : 'the details';
      return { text: `${who} changed ${what} of ${title}`, icon: 'create' as const, ...info };
    }
    case 'event_cancelled':
      return { text: `${who} cancelled ${title}`, icon: 'close-circle' as const, ...bad };
    case 'pledge_added':
      return { text: `${who} added a ${amount} pledge to ${title}. Confirm you're still in`, icon: 'shield-checkmark' as const, ...info };
    case 'pledge_released':
      return { text: `${who} removed the pledge from ${title}. You won't owe anything if you can't make it`, icon: 'shield-outline' as const, ...good };
    case 'pledge_owed':
      return {
        text: `You owe ${who} ${amount} for ${title} (you ${n.data.reason === 'late_cancel' ? 'cancelled after the cutoff' : "didn't show"})`,
        icon: 'wallet' as const, ...bad,
      };
    case 'direct_invite':
      return { text: `${who} invited you to ${title}. Are you coming?`, icon: 'person-add' as const, color: c.primary, onColor: c.onPrimary };
    case 'event_locked':
      return {
        text: `It's on: ${who} locked in ${n.data.starts_at ? format(new Date(n.data.starts_at), 'EEE d MMM, h:mm a') : 'a time'} for ${title}. Are you in?`,
        icon: 'calendar' as const, ...good,
      };
    case 'rsvp_reminder':
      return { text: `${who} is waiting on your answer for ${title}. Are you coming?`, icon: 'time' as const, ...heads };
    case 'excuse_prompt':
      return { text: `Missed ${title}? You can tell ${who} why. One excuse, and ${who} decides`, icon: 'chatbox-ellipses' as const, ...info };
    case 'split_owed':
      return { text: `You owe ${who} ${amount} for ${n.data.description ?? 'a bill'} at ${title}`, icon: 'receipt' as const, ...info };
    case 'receipt_to_claim':
      return {
        text: `${who} shared the bill for ${title}${n.data.total_cents != null ? ` (${formatMoney(n.data.total_cents)})` : ''}. Pick what you had`,
        icon: 'receipt' as const, ...heads,
      };
    case 'receipt_ready':
      return { text: `Everyone's confirmed ${n.data.description ?? 'the bill'} at ${title}. Lock it so they can pay you`, icon: 'lock-closed' as const, ...good };
    case 'receipt_reopened':
      return { text: `${who} reopened ${n.data.description ?? 'the bill'} at ${title}. Check your share`, icon: 'receipt' as const, ...info };
    case 'payment_claimed':
      return { text: `${who} says they paid you ${amount} for ${title}`, icon: 'cash' as const, ...good };
    case 'payment_disputed':
      return { text: `${who} hasn't received your ${amount} for ${title}`, icon: 'alert' as const, ...bad };
    case 'excuse_submitted':
      return { text: `${who} sent an excuse for missing ${title}`, icon: 'chatbox-ellipses' as const, ...heads };
    case 'excuse_resolved':
      return n.data.accepted
        ? { text: `${who} accepted your excuse. You don't owe anything for ${title}`, icon: 'heart' as const, ...good }
        : { text: `${who} declined your excuse. You still owe ${amount} for ${title}`, icon: 'close' as const, ...bad };
    case 'debt_waived':
      return { text: `${who} let you off the ${amount} for ${title}`, icon: 'heart' as const, ...good };
    case 'maybe_reminder': {
      const by = n.data.cutoff ? format(new Date(n.data.cutoff), 'EEE h:mm a') : 'the cutoff';
      return { text: `Decide on ${title} by ${by}`, icon: 'time' as const, ...heads };
    }
    case 'photos_added': {
      const others = (n.data.uploaders?.length ?? 1) - 1;
      const count = n.data.count ?? 1;
      return {
        text: `${who}${others > 0 ? ` and ${others} ${others === 1 ? 'other' : 'others'}` : ''} added ${count === 1 ? 'a photo' : `${count} photos`} to ${title}`,
        icon: 'images' as const, color: c.secondary, onColor: c.onSecondary,
      };
    }
    case 'maybe_expired':
      return { text: `You didn't decide on ${title} in time, so you're marked as not going`, icon: 'time' as const, color: c.surfaceAlt, onColor: c.textSecondary };
  }
}
