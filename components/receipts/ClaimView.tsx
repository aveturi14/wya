import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PressableScale from '@/components/ui/PressableScale';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { billMoney, firstName, Receipt, ReceiptLine } from '@/lib/receipts';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

/**
 * "What did you have?" (Phase 8.18). Everyone going ticks their own items; a
 * shared item splits between everyone who ticks it. The bar fills as items are
 * claimed, and each person confirms the share the database worked out.
 */
export function ClaimList({ receipt, myId, editable, onToggle, onEditLine }: {
  receipt: Receipt;
  myId: string | undefined;
  // False once locked: the list just shows who had what
  editable: boolean;
  onToggle: (line: ReceiptLine) => void;
  // The payer's "Edit the bill" mode: tapping a line edits it instead of ticking it
  onEditLine?: (line: ReceiptLine) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const people = new Map(receipt.people.map((p) => [p.user_id, p]));
  const items = receipt.lines.filter((l) => l.kind === 'item');
  const extras = receipt.lines.filter((l) => l.kind === 'adjustment');

  return (
    <View style={{ gap: Space.md }}>
      <Card padded={false}>
        {items.map((line, i) => {
          const mine = !!myId && line.claimers.includes(myId);
          // The faces show who ticked it; the words say the one thing faces can't
          const caption = line.claimers.length > 1
            ? `${billMoney(Math.floor(line.amount_cents / line.claimers.length))} each`
            : line.claimers[0] === myId ? 'You' : firstName(people.get(line.claimers[0])?.name);
          return (
            <PressableScale
              key={line.id}
              onPress={() => (onEditLine ? onEditLine(line) : onToggle(line))}
              disabled={!editable && !onEditLine}
              scaleTo={0.99}
              style={[styles.item, i > 0 && styles.divider]}
              accessibilityRole={onEditLine ? 'button' : 'checkbox'}
              accessibilityState={onEditLine ? undefined : { checked: mine, disabled: !editable }}
              accessibilityLabel={`${line.name}, ${billMoney(line.amount_cents)}`}
            >
              {onEditLine
                ? <Ionicons name="create-outline" size={20} color={theme.colors.textSecondary} />
                : <View style={[styles.box, mine && styles.boxOn]}>{mine && <Ionicons name="checkmark" size={16} color={theme.colors.onPrimary} />}</View>}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[theme.type.value, { fontSize: 14 }]}>{line.name}{line.quantity > 1 ? ` ×${line.quantity}` : ''}</Text>
                {line.claimers.length > 0 && <Text style={theme.type.caption} numberOfLines={1}>{caption}</Text>}
              </View>
              <View style={styles.faces}>
                {line.claimers.slice(0, 3).map((id, j) => (
                  <View key={id} style={j > 0 && { marginLeft: -8 }}>
                    <Avatar name={people.get(id)?.name ?? null} url={people.get(id)?.avatar_url} seed={id} size={22} />
                  </View>
                ))}
              </View>
              <Text style={styles.amount}>{billMoney(line.amount_cents)}</Text>
            </PressableScale>
          );
        })}
      </Card>
      {extras.length > 0 && (
        <View style={styles.extras}>
          {extras.map((line) => (
            <PressableScale key={line.id} disabled={!onEditLine} onPress={() => onEditLine?.(line)} style={styles.extraRow}>
              <Text style={[theme.type.caption, { flex: 1 }]}>{line.name}</Text>
              <Text style={theme.type.caption}>{billMoney(line.amount_cents)}</Text>
            </PressableScale>
          ))}
          <Text style={theme.type.caption}>Shared by what each person ordered. GST is already included.</Text>
        </View>
      )}
    </View>
  );
}

/** "$64.00 of $96.00 claimed", filling up. */
export function ClaimedBar({ receipt }: { receipt: Receipt }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const all = receipt.items_cents > 0 && receipt.claimed_cents >= receipt.items_cents;
  const pct = receipt.items_cents > 0 ? Math.min(1, receipt.claimed_cents / receipt.items_cents) : 0;
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.barLabels}>
        <Text style={[theme.type.value, { fontFamily: Fonts.bodyBold, fontSize: 14 }]}>
          {billMoney(receipt.claimed_cents)} of {billMoney(receipt.items_cents)} claimed
        </Text>
        {all && <Text style={[theme.type.caption, { color: theme.colors.success, fontFamily: Fonts.bodyBold }]}>All claimed</Text>}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: all ? theme.colors.success : theme.colors.primary }]} />
      </View>
    </View>
  );
}

/** Your share, how it was worked out, and Confirm. */
export function ShareCard({ receipt, myId, onConfirm, busy }: {
  receipt: Receipt; myId: string | undefined; onConfirm: (cents: number) => void; busy: boolean;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const me = receipt.people.find((p) => p.user_id === myId);
  if (!me) return null;
  const extrasLabel = receipt.lines.filter((l) => l.kind === 'adjustment').length === 1
    ? receipt.lines.find((l) => l.kind === 'adjustment')!.name.toLowerCase().replace(/\s*\d+(\.\d+)?%$/, '')
    : 'the extras';

  return (
    <Card style={styles.share}>
      <View style={styles.shareTop}>
        <Text style={theme.type.cardTitle}>Your share</Text>
        <Text style={theme.type.cardTitle}>{billMoney(me.share_cents)}</Text>
      </View>
      {!me.claimed ? (
        <Text style={theme.type.caption}>{me.is_payer ? 'Tick what you had too. Anything nobody ticks stays with you.' : 'Tick what you had above.'}</Text>
      ) : (
        <Text style={theme.type.caption}>
          {billMoney(me.food_cents)} food{me.adjust_cents !== 0 ? ` ${me.adjust_cents > 0 ? '+' : '−'} ${billMoney(Math.abs(me.adjust_cents))} of ${extrasLabel}` : ''}
        </Text>
      )}
      {me.is_payer ? null : me.confirmed ? (
        <View style={styles.confirmed}>
          <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
          <Text style={[theme.type.value, { fontSize: 14 }]}>Confirmed. {firstName(receipt.payer_name)} locks it once everyone has.</Text>
        </View>
      ) : (
        <Button title="Confirm my share" onPress={() => onConfirm(me.share_cents)} disabled={!me.claimed} loading={busy} />
      )}
    </Card>
  );
}

/** Who's confirmed: everyone sees it, so nobody has to ask in the chat. */
export function PeopleStatus({ receipt, myId }: { receipt: Receipt; myId: string | undefined }) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <Card padded={false}>
      {receipt.people.map((p, i) => {
        const label = p.is_payer ? 'Paid the bill' : !p.claimed ? 'Nothing ticked' : p.confirmed ? 'Confirmed' : 'Not confirmed';
        const dot = p.is_payer ? theme.colors.primary : p.confirmed ? theme.colors.success : p.claimed ? theme.colors.warning : theme.colors.textMuted;
        return (
          <View key={p.user_id} style={[styles.person, i > 0 && styles.divider]}>
            <Avatar name={p.name} url={p.avatar_url} seed={p.user_id} size={28} />
            <Text style={[theme.type.value, { flex: 1, fontSize: 14 }]} numberOfLines={1}>{p.user_id === myId ? 'You' : firstName(p.name)}</Text>
            <Text style={[theme.type.value, { fontFamily: Fonts.bodyBold, fontSize: 14 }]}>{billMoney(p.share_cents)}</Text>
            <View style={styles.chip}>
              <View style={[styles.dot, { backgroundColor: dot }]} />
              <Text style={styles.chipText}>{label}</Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  item: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 12, paddingHorizontal: Space.md },
  divider: { borderTopWidth: 1, borderTopColor: t.colors.border },
  box: {
    width: 24, height: 24, borderRadius: 7, borderWidth: t.outlineWidth, borderColor: t.isDark ? t.colors.textSecondary : t.colors.outline,
    justifyContent: 'center', alignItems: 'center', backgroundColor: t.colors.surface,
  },
  boxOn: { backgroundColor: t.colors.primary, borderColor: t.isDark ? t.colors.primary : t.colors.outline },
  faces: { flexDirection: 'row' },
  amount: { fontFamily: Fonts.bodyBold, fontSize: 14, color: t.colors.text, minWidth: 64, textAlign: 'right' },
  extras: { gap: 4, paddingHorizontal: Space.xs },
  extraRow: { flexDirection: 'row', gap: Space.sm },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 10, borderRadius: Radius.pill, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden', borderWidth: t.isDark ? 0 : 1.5, borderColor: t.colors.outline },
  fill: { height: '100%', borderRadius: Radius.pill },
  share: { gap: Space.sm },
  shareTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confirmed: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 10, paddingHorizontal: Space.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: t.colors.surfaceAlt },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: Fonts.bodyMedium, fontSize: 11, color: t.colors.text },
}));
