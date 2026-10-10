import { Theme } from '@/constants/theme';

export type Notification = {
  id: string;
  type: 'joined' | 'rsvp' | 'event_updated' | 'event_cancelled';
  event_id: string | null;
  data: { title?: string; status?: 'yes' | 'maybe' | 'no'; changes?: string[]; actor_name?: string | null };
  read_at: string | null;
  created_at: string;
};

// What each notification says, and its icon and color
export function describe(n: Notification, theme: Theme) {
  const c = theme.colors;
  const who = n.data.actor_name?.split(' ')[0] ?? 'Someone';
  const title = n.data.title ?? 'an event';
  switch (n.type) {
    case 'joined':
      return { text: `${who} opened your invite to ${title}`, icon: 'person-add' as const, color: c.primary, onColor: c.onPrimary };
    case 'rsvp':
      if (n.data.status === 'yes') return { text: `${who} is going to ${title}`, icon: 'checkmark' as const, color: c.success, onColor: c.onStatus };
      if (n.data.status === 'maybe') return { text: `${who} might come to ${title}`, icon: 'help' as const, color: c.warning, onColor: c.onStatus };
      return { text: `${who} can't make it to ${title}`, icon: 'close' as const, color: c.danger, onColor: c.onStatus };
    case 'event_updated': {
      const changes = n.data.changes ?? [];
      const what = changes.length === 1 ? `the ${changes[0]}` : changes.length === 2 ? `the ${changes[0]} and ${changes[1]}` : 'the details';
      return { text: `${who} changed ${what} of ${title}`, icon: 'create' as const, color: c.highlight, onColor: c.onHighlight };
    }
    case 'event_cancelled':
      return { text: `${who} cancelled ${title}`, icon: 'close-circle' as const, color: c.danger, onColor: c.onStatus };
  }
}
