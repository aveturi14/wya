import WidgetCard from '@/components/home/WidgetCard';
import { Avatar } from '@/components/ui/Avatar';
import PressableScale from '@/components/ui/PressableScale';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { formatMoney, isOpen, Obligation } from '@/lib/pledges';
import { Text, View } from 'react-native';

/**
 * Host view of pledges: how much is owed to you (paid straight to your PayID,
 * never through wya) and the latest people involved. Only shown once someone
 * has flaked on one of your events.
 */
export default function PledgesWidget({ obligations, onOpen }: { obligations: Obligation[]; onOpen: (eventId: string) => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  const mine = obligations.filter((o) => o.role === 'host');
  if (mine.length === 0) return null;

  const open = mine.filter(isOpen);
  const owed = open.reduce((sum, o) => sum + o.amount_cents, 0);
  // Open ones first (they need something), then the most recent
  const shown = [...mine].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || b.created_at.localeCompare(a.created_at)).slice(0, 4);

  const chip = (o: Obligation) => {
    if (o.status === 'excuse_pending') return { label: 'Review', dot: c.warning };
    if (o.status === 'disputed') return { label: 'Not received', dot: c.danger };
    if (o.status === 'paid') return { label: 'Paid', dot: c.success };
    if (o.status === 'waived') return { label: 'Let off', dot: c.textMuted };
    return { label: `Owes ${formatMoney(o.amount_cents)}`, dot: c.secondary };
  };

  return (
    <WidgetCard label={mine.some((o) => o.kind === 'split') ? 'Owed to you' : 'Pledges'} style={{ flex: 1 }}>
      <View style={{ gap: 4 }}>
        <Text style={styles.amount}>{formatMoney(owed)}</Text>
        <Text style={theme.type.caption}>{owed > 0 ? 'owed to you · paid straight to your PayID' : "nothing owed · everyone's square"}</Text>
      </View>
      <View>
        {shown.map((o, i) => {
          const ch = chip(o);
          return (
            <PressableScale key={o.id} onPress={() => onOpen(o.event_id)} scaleTo={0.98} style={[styles.row, i > 0 && styles.divider]}>
              <Avatar name={o.other_name} seed={o.other_user_id} size={34} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={theme.type.value} numberOfLines={1}>{o.other_name?.split(' ')[0] ?? 'Someone'}</Text>
                <Text style={theme.type.caption} numberOfLines={1}>
                  {o.kind === 'split' ? `Split · ${o.description ?? 'bill'}` : o.reason === 'late_cancel' ? 'Late cancel' : 'No-show'} · {o.event_title}
                </Text>
              </View>
              <View style={styles.chip}>
                <View style={[styles.dot, { backgroundColor: ch.dot }]} />
                <Text style={styles.chipText}>{ch.label}</Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </WidgetCard>
  );
}

const useStyles = makeStyles((t) => ({
  amount: { fontFamily: Fonts.display, fontSize: 44, lineHeight: 46, letterSpacing: -2, color: t.colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.sm },
  divider: { borderTopWidth: 1, borderTopColor: t.colors.border },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: Radius.pill, backgroundColor: t.colors.surfaceAlt,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: Fonts.bodyMedium, fontSize: 11.5, color: t.colors.text },
}));
