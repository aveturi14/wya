import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/pledges';
import { Text, View } from 'react-native';

export type SplitPerson = { user_id: string; name: string | null; share_cents: number; status: string; is_payer: boolean; paid_via?: 'payid' | 'wallet' | null };

/**
 * Each person's share of a split and whether they've paid (8.3), shared by the
 * split card and receipt splits (8.18). The payer can say a payment didn't arrive.
 */
export default function SplitPeople({ rows, myId, onDispute }: {
  rows: SplitPerson[];
  myId: string | undefined;
  // Only for the payer, on rows marked paid
  onDispute?: (row: SplitPerson) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  const chip = (r: SplitPerson) => {
    if (r.is_payer) return { label: 'Paid the bill', dot: c.primary };
    if (r.status === 'paid') return { label: r.paid_via === 'wallet' ? 'Paid · wallet' : 'Paid', dot: c.success };
    if (r.status === 'disputed') return { label: 'Not received', dot: c.danger };
    if (r.status === 'waived') return { label: 'Let off', dot: c.textMuted };
    return { label: 'Owes', dot: c.secondary };
  };

  return (
    <View>
      {rows.map((r, i) => {
        const ch = chip(r);
        return (
          <View key={r.user_id} style={[styles.person, i > 0 && styles.divider]}>
            <Avatar name={r.name} seed={r.user_id} size={28} />
            <Text style={[theme.type.value, { flex: 1, fontSize: 14 }]} numberOfLines={1}>
              {r.user_id === myId ? 'You' : r.name?.split(' ')[0] ?? 'Someone'}
            </Text>
            <Text style={[theme.type.value, { fontFamily: Fonts.bodyBold, fontSize: 14 }]}>{formatMoney(r.share_cents)}</Text>
            <View style={styles.chip}>
              <View style={[styles.dot, { backgroundColor: ch.dot }]} />
              <Text style={styles.chipText}>{ch.label}</Text>
            </View>
            {onDispute && r.status === 'paid' && r.paid_via !== 'wallet' && (
              <Button title="Didn't get it" size="sm" variant="ghost" onPress={() => onDispute(r)} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  person: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 6 },
  divider: { borderTopWidth: 1, borderTopColor: t.colors.border },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: t.colors.surfaceAlt },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: t.colors.text },
}));
