import { Guest } from '@/components/GuestList';
import Card from '@/components/ui/Card';
import PressableScale from '@/components/ui/PressableScale';
import { Fonts, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

type Tool = { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };

/**
 * Under the host's poster: Invite · Remind · Who came? · Edit in one row, then one bar
 * for how the guest list stands (In, Maybe, Waiting) that opens the guest list.
 */
export default function HostTools({ guests, maxGuests, onInvite, onRemind, onWhoCame, onEdit, onGuests }: {
  guests: Guest[];
  maxGuests: number | null;
  onInvite: () => void;
  onRemind: () => void;
  onWhoCame?: () => void; // only once the event has started
  onEdit: () => void;
  onGuests: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  const tools: Tool[] = [
    { key: 'invite', icon: 'people-outline', label: 'Invite', onPress: onInvite },
    { key: 'remind', icon: 'megaphone-outline', label: 'Remind', onPress: onRemind },
    ...(onWhoCame ? [{ key: 'came', icon: 'flag-outline' as const, label: 'Who came', onPress: onWhoCame }] : []),
    { key: 'edit', icon: 'create-outline', label: 'Edit', onPress: onEdit },
  ];

  const n = (s: Guest['status']) => guests.filter((g) => g.status === s).length;
  const yes = n('yes'), maybe = n('maybe'), waiting = n('invited'), asking = n('requested');
  const invited = guests.filter((g) => g.status !== 'requested').length;
  const pct = (v: number) => (invited ? `${(v / invited) * 100}%` : '0%') as `${number}%`;

  return (
    <View style={{ gap: Space.md }}>
      <View style={styles.tools}>
        {tools.map((tool) => (
          <PressableScale key={tool.key} onPress={tool.onPress} scaleTo={0.96} style={styles.tool} hoverStyle={styles.toolHover} accessibilityLabel={tool.label}>
            <Ionicons name={tool.icon} size={18} color={c.text} />
            <Text style={styles.toolText}>{tool.label}</Text>
          </PressableScale>
        ))}
      </View>
      <Card onPress={onGuests} style={{ gap: Space.sm }} accessibilityLabel={`Guests: ${yes} in, ${maybe} maybe, ${waiting} waiting. Open the guest list`}>
        <View style={styles.row}>
          <Text style={theme.type.sectionHeading}>{invited} invited</Text>
          <View style={styles.rowEnd}>
            {maxGuests != null && <Text style={theme.type.caption}>Full at {maxGuests}</Text>}
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </View>
        </View>
        <View style={styles.bar}>
          <View style={{ width: pct(yes), backgroundColor: c.success }} />
          <View style={{ width: pct(maybe), backgroundColor: c.warning }} />
        </View>
        <View style={styles.row}>
          <Legend color={c.success} label={`${yes} in`} />
          <Legend color={c.warning} label={`${maybe} maybe`} />
          <Legend color={c.chipStrong} label={`${waiting} waiting`} />
          {asking > 0 && <Legend color={c.secondary} label={`${asking} asking`} />}
        </View>
      </Card>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={theme.type.caption}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  tools: { flexDirection: 'row', gap: 6 },
  tool: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 14, backgroundColor: t.colors.surfaceAlt, minHeight: 56, justifyContent: 'center' },
  toolHover: { backgroundColor: t.colors.chipStrong },
  toolText: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: t.colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Space.sm, flexWrap: 'wrap' },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bar: { height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden', flexDirection: 'row' },
}));
