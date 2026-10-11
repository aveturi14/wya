import { OwesFlag, ReliabilityRecord, ReliabilityText } from '@/components/pledges/Reliability';
import { Avatar } from '@/components/ui/Avatar';
import ListSection from '@/components/ui/ListSection';
import PressableScale from '@/components/ui/PressableScale';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/pledges';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

// One row from get_guest_list: hosts get everyone with notes; guests get Going/Maybe without notes
export type Guest = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  status: 'invited' | 'yes' | 'maybe' | 'no';
  additional_details: string | null;
  // Host view only (null for guests): the pledge this guest agreed to, and whether they came
  pledge_cents?: number | null;
  attended?: boolean | null;
  reliability?: ReliabilityRecord | null;
};

export default function GuestList({ guests, isHost, onRemove }: {
  guests: Guest[];
  isHost: boolean;
  onRemove?: (guest: Guest) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;

  const groups = [
    { status: 'yes', label: 'Going', color: c.success },
    { status: 'maybe', label: 'Maybe', color: c.warning },
    { status: 'no', label: 'Not going', color: c.danger },
    { status: 'invited', label: 'No answer yet', color: c.textMuted },
  ] as const;
  const count = (s: Guest['status']) => guests.filter((g) => g.status === s).length;

  return (
    <View style={styles.wrap}>
      {isHost && (
        <View style={styles.counts}>
          {groups.slice(0, 3).map((g) => (
            <View key={g.status} style={[styles.countTile, { backgroundColor: g.color }]}>
              <Text style={[theme.type.stat, { color: c.onStatus }]}>{count(g.status)}</Text>
              <Text style={[theme.type.label, { color: c.onStatus }]}>{g.label}</Text>
            </View>
          ))}
        </View>
      )}

      {guests.length === 0 && (
        <Text style={theme.type.bodySecondary}>
          {isHost ? 'Nobody has opened your invite yet. Share the link to get the party started.' : "Nobody's said they're going yet. Be the first."}
        </Text>
      )}

      {groups.map((g) => {
        const list = guests.filter((x) => x.status === g.status);
        // Guests only ever receive Going/Maybe rows, so empty groups simply don't show
        if (list.length === 0) return null;
        return (
          <ListSection key={g.status} title={g.label} count={list.length} accent={g.color}>
            {list.map((guest, i) => (
              <View key={guest.user_id} style={[styles.row, i > 0 && styles.rowDivider]}>
                <Avatar name={guest.full_name} url={guest.avatar_url} seed={guest.user_id} size={38} />
                <View style={styles.rowText}>
                  <Text style={theme.type.value}>{guest.full_name ?? 'Unknown'}</Text>
                  {!!guest.additional_details && <Text style={theme.type.caption}>{guest.additional_details}</Text>}
                  {isHost && <HostGuestMeta guest={guest} />}
                </View>
                {isHost && onRemove && (
                  <PressableScale onPress={() => onRemove(guest)} style={styles.removeBtn} hoverStyle={styles.removeHover} hitSlop={8} accessibilityLabel={`Remove ${guest.full_name ?? 'guest'}`}>
                    <Ionicons name="person-remove-outline" size={17} color={c.textSecondary} />
                  </PressableScale>
                )}
              </View>
            ))}
          </ListSection>
        );
      })}
    </View>
  );
}

// What a host sees about a guest: their pledge, track record, and any unsettled debt
function HostGuestMeta({ guest }: { guest: Guest }) {
  const { theme } = useTheme();
  const record = guest.reliability ?? null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, flexWrap: 'wrap', marginTop: 2 }}>
      {guest.status === 'yes' && guest.pledge_cents != null && <Text style={[theme.type.caption, { color: theme.colors.text }]}>Pledged {formatMoney(guest.pledge_cents)}</Text>}
      <ReliabilityText record={record} />
      <OwesFlag record={record} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: Space.md },
  counts: { flexDirection: 'row', gap: Space.sm },
  countTile: {
    flex: 1, alignItems: 'center', paddingVertical: Space.lg, borderRadius: Radius.lg, gap: 2,
    borderWidth: t.isDark ? 0 : t.outlineWidth, borderColor: t.colors.outline,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: t.colors.border },
  rowText: { flex: 1, gap: 2 },
  removeBtn: { padding: 6, borderRadius: Radius.pill },
  removeHover: { backgroundColor: t.colors.surfaceAlt },
}));
