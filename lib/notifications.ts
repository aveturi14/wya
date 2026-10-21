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
    | 'receipt_to_claim' | 'receipt_ready' | 'receipt_reopened'
    // Wallet (9.11): someone paid you from their wya wallet
    | 'wallet_paid'
    // Collect before you book (stage 1.1): open the collection
    | 'collect_started' | 'collect_paid' | 'collect_confirmed' | 'collect_funded' | 'collect_unfunded' | 'collect_booked'
    | 'collect_expired' | 'collect_cancelled' | 'collect_refund_requested' | 'collect_refunded' | 'collect_reminder'
    // Collection links (stage 1.1b): asking to join through the link
    | 'collect_requested' | 'collect_approved' | 'collect_declined';
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
    kind?: 'pledge' | 'split' | 'collect';
    description?: string | null;
    starts_at?: string;
    receipt_id?: string;
    total_cents?: number;
    // Collections (stage 1.1)
    collection_id?: string;
    collection_title?: string;
    organiser_name?: string | null;
    deadline?: string;
    short?: boolean;
    slot?: '24h' | '2h' | 'confirm';
    waiting?: number;
    refunds_due?: number;
  };
  read_at: string | null;
  created_at: string;
};

// Where tapping a notification goes: the collection, the pay page for a split, the bill, the album for photos, otherwise the event
export const notificationHref = (n: Notification) =>
  n.data.collection_id && (n.type.startsWith('collect_') || n.data.kind === 'collect')
    ? (`/collect/${n.data.collection_id}` as const)
    : n.type === 'split_owed' && n.data.obligation_id
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
  const organiser = n.data.organiser_name?.split(' ')[0] ?? 'The organiser';
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
    case 'wallet_paid':
      return { text: `${who} paid you ${amount} from their wallet for ${n.data.description ?? title}`, icon: 'wallet' as const, ...good };
    case 'collect_started':
      return { text: `${who} is collecting ${amount} each for ${n.data.collection_title ?? title}. Are you in?`, icon: 'cash' as const, ...info };
    case 'collect_paid':
      return { text: `${who} says they've paid you ${amount} for ${n.data.collection_title ?? title}. Check it arrived`, icon: 'cash' as const, ...heads };
    case 'collect_confirmed':
      return { text: `${who} got your ${amount} for ${n.data.collection_title ?? title}`, icon: 'checkmark-done' as const, ...good };
    case 'collect_funded':
      return n.data.short
        ? { text: `${n.data.collection_title ?? title} is going ahead with fewer people`, icon: 'checkmark-circle' as const, ...good }
        : { text: `${n.data.collection_title ?? title} is funded. Time to book it`, icon: 'checkmark-circle' as const, ...good };
    case 'collect_unfunded':
      return { text: `${n.data.collection_title ?? title} isn't funded any more: a payment didn't arrive`, icon: 'alert' as const, ...bad };
    case 'collect_booked':
      return { text: `${who} booked ${n.data.collection_title ?? title}. You're all set`, icon: 'checkmark-circle' as const, ...good };
    case 'collect_expired':
      return { text: `${n.data.collection_title ?? title} didn't fill up in time.${n.data.refunds_due ? ` ${organiser} will refund anyone who paid` : ''}`, icon: 'time' as const, ...heads };
    case 'collect_cancelled':
      return { text: `${who} cancelled ${n.data.collection_title ?? title}. Anyone who paid gets refunded`, icon: 'close-circle' as const, ...bad };
    case 'collect_refund_requested':
      return { text: `${who} left ${n.data.collection_title ?? title} and asked for their ${amount} back`, icon: 'return-down-back' as const, ...heads };
    case 'collect_refunded':
      return { text: `${who} refunded your ${amount} for ${n.data.collection_title ?? title}`, icon: 'return-down-back' as const, ...good };
    case 'collect_requested':
      return { text: `${who} wants in on ${n.data.collection_title ?? title} (${amount})`, icon: 'hand-left' as const, ...heads };
    case 'collect_approved':
      return { text: `${who} let you in on ${n.data.collection_title ?? title}. Pay ${amount} to ${who} by PayID`, icon: 'checkmark-circle' as const, ...good };
    case 'collect_declined':
      return { text: `${who} said no to ${n.data.collection_title ?? title}. You don't owe anything`, icon: 'close-circle' as const, ...bad };
    case 'collect_reminder':
      return n.data.slot === 'confirm'
        ? { text: `${n.data.waiting ?? 1} ${n.data.waiting === 1 ? 'payment is' : 'payments are'} waiting for you to confirm on ${n.data.collection_title ?? title}`, icon: 'time' as const, ...heads }
        : { text: `Pay ${organiser} ${amount} for ${n.data.collection_title ?? title} by ${n.data.deadline ? format(new Date(n.data.deadline), 'EEE h:mm a') : 'the deadline'}`, icon: 'time' as const, ...heads };
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
