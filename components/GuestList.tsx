import { Colors } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// One row from get_guest_list: hosts get everyone with notes; guests get Going/Maybe without notes
export type Guest = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  status: 'invited' | 'yes' | 'maybe' | 'no';
  additional_details: string | null;
};

const GROUPS = [
  { status: 'yes', label: 'Going', color: Colors.success },
  { status: 'maybe', label: 'Maybe', color: Colors.warning },
  { status: 'no', label: 'Not going', color: Colors.danger },
  { status: 'invited', label: 'No answer yet', color: Colors.textSecondary },
] as const;

export default function GuestList({ guests, isHost, onRemove }: {
  guests: Guest[];
  isHost: boolean;
  onRemove?: (guest: Guest) => void;
}) {
  const groups = GROUPS.map((g) => ({ ...g, guests: guests.filter((x) => x.status === g.status) }))
    // Guests only ever receive Going/Maybe rows, so empty groups simply don't show
    .filter((g) => isHost || g.guests.length > 0);

  return (
    <View style={styles.wrap}>
      {isHost && (
        <View style={styles.counts}>
          {GROUPS.slice(0, 3).map((g) => (
            <View key={g.status} style={styles.countItem}>
              <Text style={[styles.count, { color: g.color }]}>{guests.filter((x) => x.status === g.status).length}</Text>
              <Text style={styles.countLabel}>{g.label}</Text>
            </View>
          ))}
        </View>
      )}

      {guests.length === 0 && (
        <Text style={styles.empty}>{isHost ? 'Nobody has opened your invite yet. Share the link to get started.' : 'Nobody has said they\'re going yet.'}</Text>
      )}

      {groups.filter((g) => g.guests.length > 0).map((g) => (
        <View key={g.status} style={styles.group}>
          <Text style={[styles.groupTitle, { color: g.color }]}>{g.label} · {g.guests.length}</Text>
          {g.guests.map((guest) => (
            <View key={guest.user_id} style={styles.row}>
              {guest.avatar_url
                ? <Image source={{ uri: guest.avatar_url }} style={styles.avatar} />
                : <View style={[styles.avatar, styles.avatarPlaceholder]}><Text style={styles.avatarInitial}>{(guest.full_name ?? '?')[0]}</Text></View>}
              <View style={styles.rowText}>
                <Text style={styles.name}>{guest.full_name ?? 'Unknown'}</Text>
                {!!guest.additional_details && <Text style={styles.details}>{guest.additional_details}</Text>}
              </View>
              {isHost && onRemove && (
                <TouchableOpacity onPress={() => onRemove(guest)} style={styles.removeBtn} hitSlop={8}>
                  <Ionicons name="person-remove-outline" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  counts: { flexDirection: 'row', gap: 10 },
  countItem: { flex: 1, alignItems: 'center', backgroundColor: Colors.surfaceElevated, borderRadius: 14, paddingVertical: 18, borderWidth: 1, borderColor: Colors.border },
  count: { ...Type.statNumber },
  countLabel: { ...Type.label, marginTop: 6, fontSize: 10 },
  empty: { ...Type.description },
  group: { gap: 8 },
  groupTitle: { ...Type.label, fontSize: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarPlaceholder: { backgroundColor: Colors.accentSubtle, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { ...Type.value, color: Colors.accentLight },
  rowText: { flex: 1, gap: 2 },
  name: { ...Type.value, fontSize: 14 },
  details: { ...Type.metaSmall },
  removeBtn: { padding: 4 },
});
