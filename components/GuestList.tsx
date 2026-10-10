import { Avatar } from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';
import PressableScale from '@/components/ui/PressableScale';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

// One row from get_guest_list: hosts get everyone with notes; guests get Going/Maybe without notes
export type Guest = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  status: 'invited' | 'yes' | 'maybe' | 'no';
  additional_details: string | null;
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
          <View key={g.status} style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={[styles.dot, { backgroundColor: g.color }]} />
              <Text style={theme.type.label}>{g.label} · {list.length}</Text>
            </View>
            <Card padded={false} raised={false}>
              {list.map((guest, i) => (
                <View key={guest.user_id} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <Avatar name={guest.full_name} url={guest.avatar_url} seed={guest.user_id} size={38} />
                  <View style={styles.rowText}>
                    <Text style={theme.type.value}>{guest.full_name ?? 'Unknown'}</Text>
                    {!!guest.additional_details && <Text style={theme.type.caption}>{guest.additional_details}</Text>}
                  </View>
                  {isHost && onRemove && (
                    <PressableScale onPress={() => onRemove(guest)} style={styles.removeBtn} hoverStyle={styles.removeHover} hitSlop={8} accessibilityLabel={`Remove ${guest.full_name ?? 'guest'}`}>
                      <Ionicons name="person-remove-outline" size={17} color={c.textSecondary} />
                    </PressableScale>
                  )}
                </View>
              ))}
            </Card>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: Space.lg },
  counts: { flexDirection: 'row', gap: Space.sm },
  countTile: {
    flex: 1, alignItems: 'center', paddingVertical: Space.lg, borderRadius: Radius.lg, gap: 2,
    borderWidth: t.isDark ? 0 : t.outlineWidth, borderColor: t.colors.outline,
  },
  group: { gap: Space.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingHorizontal: Space.lg, paddingVertical: Space.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: t.colors.border },
  rowText: { flex: 1, gap: 2 },
  removeBtn: { padding: 6, borderRadius: Radius.pill },
  removeHover: { backgroundColor: t.colors.surfaceAlt },
}));
