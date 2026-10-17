import { ReliabilityRecord } from '@/components/pledges/Reliability';
import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Chip, { ChipRow } from '@/components/ui/Chip';
import IconButton from '@/components/ui/IconButton';
import ListRow, { ListGroup } from '@/components/ui/ListRow';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/pledges';
import { format } from 'date-fns';
import { useState } from 'react';
import { Text, View } from 'react-native';

// One row from get_guest_list: hosts get everyone with notes; guests get Going/Maybe without notes
export type Guest = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  // 'requested': asking to join (host view only)
  status: 'invited' | 'requested' | 'yes' | 'maybe' | 'no';
  additional_details: string | null;
  // Host view only (null for guests): the pledge this guest agreed to, and whether they came
  pledge_cents?: number | null;
  attended?: boolean | null;
  reliability?: ReliabilityRecord | null;
  // Host only: when they tapped "I'm here" (8.4)
  checked_in_at?: string | null;
};

type Filter = 'all' | 'yes' | 'maybe' | 'invited' | 'no';

/**
 * Everyone on the event by status (the host's guest sheet, and "Who's going" for guests):
 * people asking to join first, then In, Maybe, Waiting and Can't go, each with their
 * track record. A flag only when someone owes.
 */
export default function GuestList({ guests, isHost, onRemove, onApprove, onDecline }: {
  guests: Guest[];
  isHost: boolean;
  onRemove?: (guest: Guest) => void;
  // Host: people asking to join through a link that needs approval
  onApprove?: (guest: Guest) => void;
  onDecline?: (guest: Guest) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [filter, setFilter] = useState<Filter>('all');

  const groups = [
    { status: 'yes', label: 'In', color: c.success },
    { status: 'maybe', label: 'Maybe', color: c.warning },
    { status: 'invited', label: 'Waiting', color: c.chipStrong },
    { status: 'no', label: "Can't go", color: c.danger },
  ] as const;
  const count = (s: Guest['status']) => guests.filter((g) => g.status === s).length;
  const asking = guests.filter((g) => g.status === 'requested');

  if (guests.length === 0) {
    return (
      <Text style={theme.type.bodySecondary}>
        {isHost ? 'Nobody has opened your invite yet. Share the link to get the party started.' : "Nobody's said they're going yet. Be the first."}
      </Text>
    );
  }

  return (
    <View style={{ gap: Space.md }}>
      {isHost && (
        <ChipRow<Filter>
          options={[{ value: 'all', label: 'All' }, ...groups.filter((g) => count(g.status) > 0).map((g) => ({ value: g.status, label: g.label, count: count(g.status) }))]}
          value={filter}
          onChange={setFilter}
        />
      )}

      {isHost && asking.length > 0 && filter === 'all' && (
        <View style={{ gap: Space.sm }}>
          <Text style={theme.type.label}>Asking to join</Text>
          <ListGroup tone="alt">
            {asking.map((guest) => (
              <ListRow
                key={guest.user_id}
                leading={<Avatar name={guest.full_name} url={guest.avatar_url} seed={guest.user_id} size={36} />}
                title={guest.full_name ?? 'Unknown'}
                subtitle={recordLine(guest.reliability) ?? 'New to wya'}
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {onDecline && <IconButton icon="close" label={`Decline ${guest.full_name ?? ''}`} size={32} onPress={() => onDecline(guest)} />}
                    {onApprove && <Button title="Let in" size="sm" onPress={() => onApprove(guest)} />}
                  </View>
                }
              />
            ))}
          </ListGroup>
        </View>
      )}

      {groups.map((g) => {
        const list = guests.filter((x) => x.status === g.status);
        // Guests only ever receive Going/Maybe rows, so empty groups simply don't show
        if (list.length === 0 || (filter !== 'all' && filter !== g.status)) return null;
        return (
          <View key={g.status} style={{ gap: Space.sm }}>
            <Text style={theme.type.label}>{g.label} · {list.length}</Text>
            <ListGroup tone={isHost ? 'alt' : 'surface'}>
              {list.map((guest) => (
                <ListRow
                  key={guest.user_id}
                  leading={<Avatar name={guest.full_name} url={guest.avatar_url} seed={guest.user_id} size={36} />}
                  title={guest.full_name ?? 'Unknown'}
                  subtitle={isHost ? hostLine(guest) : guest.additional_details ?? undefined}
                  subtitleLines={2}
                  trailing={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
                      {guest.reliability?.open_debts ? <Chip label="Owes" color={c.dangerText} /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.color }} />}
                      {isHost && onRemove && (
                        <IconButton icon="person-remove-outline" label={`Remove ${guest.full_name ?? 'guest'}`} size={32} onPress={() => onRemove(guest)} />
                      )}
                    </View>
                  }
                />
              ))}
            </ListGroup>
          </View>
        );
      })}
    </View>
  );
}

function recordLine(record: ReliabilityRecord | null | undefined) {
  if (!record || record.counted === 0) return null;
  return `Came to ${record.attended} of ${record.counted}`;
}

// What a host sees about a guest: track record, pledge, check-in, their note
function hostLine(guest: Guest) {
  return [
    recordLine(guest.reliability) ?? 'No track record yet',
    guest.status === 'yes' && guest.pledge_cents != null ? `pledged ${formatMoney(guest.pledge_cents)}` : null,
    guest.checked_in_at ? `here at ${format(new Date(guest.checked_in_at), 'h:mm a')}` : null,
    guest.additional_details,
  ].filter(Boolean).join(' · ');
}
