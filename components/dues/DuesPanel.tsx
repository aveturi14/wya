import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PressableScale from '@/components/ui/PressableScale';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Due, isOpenDue, isSettledDue, sumDues } from '@/lib/dues';
import { billMoney, firstName } from '@/lib/receipts';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

/**
 * Dues (Phase 8.18): what you owe, what you're owed, and why, at the top of an
 * event's Bills tab (one event) and on Your dues (every event). Each row says
 * who, how much, what for, where, and opens up to show the items behind it.
 * Bills still being claimed show their amount as an estimate.
 */
export default function DuesPanel({ dues, scoped }: { dues: Due[]; scoped?: boolean }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [showSettled, setShowSettled] = useState(false);
  const totals = sumDues(dues);

  const owe = dues.filter((d) => d.direction === 'owe' && !isSettledDue(d));
  const owed = dues.filter((d) => d.direction === 'owed' && !isSettledDue(d));
  const settled = dues.filter(isSettledDue);
  // Money you can pay now first, then bills still being worked out
  const order = (a: Due, b: Due) => Number(a.state === 'pending') - Number(b.state === 'pending');

  if (dues.length === 0) {
    return (
      <Card style={styles.allClear}>
        <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
        <Text style={[theme.type.value, { flex: 1 }]}>{scoped ? 'Nothing owed for this event.' : "You're all square with everyone."}</Text>
      </Card>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.totals}>
        <Total label="You owe" cents={totals.owe} pending={totals.pendingOwe} tone="owe" />
        <Total label="Owed to you" cents={totals.owed} pending={totals.pendingOwed} tone="owed" />
      </View>

      {owe.length > 0 && (
        <View style={styles.group}>
          <Text style={theme.type.sectionHeading}>You owe</Text>
          {owe.sort(order).map((d) => <DueRow key={d.key} due={d} scoped={scoped} />)}
        </View>
      )}
      {owed.length > 0 && (
        <View style={styles.group}>
          <Text style={theme.type.sectionHeading}>Owed to you</Text>
          {owed.sort(order).map((d) => <DueRow key={d.key} due={d} scoped={scoped} />)}
        </View>
      )}
      {settled.length > 0 && (
        <View style={styles.group}>
          <PressableScale onPress={() => setShowSettled((v) => !v)} style={styles.settledToggle} haptic={false}>
            <Text style={theme.type.sectionHeading}>Settled ({settled.length})</Text>
            <Ionicons name={showSettled ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textMuted} />
          </PressableScale>
          {showSettled && settled.map((d) => <DueRow key={d.key} due={d} scoped={scoped} />)}
        </View>
      )}
    </View>
  );
}

function Total({ label, cents, pending, tone }: { label: string; cents: number; pending: number; tone: 'owe' | 'owed' }) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.total, tone === 'owe' && cents > 0 && styles.totalOwe]}>
      <Text style={[theme.type.label, tone === 'owe' && cents > 0 && { color: theme.colors.onHighlight }]}>{label}</Text>
      <Text style={[theme.type.stat, tone === 'owe' && cents > 0 && { color: theme.colors.onHighlight }]}>{billMoney(cents)}</Text>
      {pending > 0 && (
        <Text style={[theme.type.caption, tone === 'owe' && cents > 0 && { color: theme.colors.onHighlight }]}>+ about {billMoney(pending)} on bills not locked yet</Text>
      )}
    </View>
  );
}

function DueRow({ due, scoped }: { due: Due; scoped?: boolean }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const who = firstName(due.other_name, 'Someone');
  const owe = due.direction === 'owe';
  const where = due.merchant ?? due.venue_name;

  const headline = owe
    ? due.state === 'pending' ? `You'll owe ${who}` : `You owe ${who}`
    : due.state === 'pending' ? `${who} will owe you` : `${who} owes you`;
  const settledText = due.state === 'paid' ? (owe ? `You paid ${who}` : `${who} paid you`) : owe ? `${who} let you off` : `You let ${who} off`;
  const context = [due.description, where && where !== due.description ? where : null, scoped ? null : due.event_title, format(new Date(due.event_date), 'EEE d MMM')]
    .filter(Boolean).join(' · ');

  const chip = (() => {
    if (due.state === 'pending') {
      if (!due.claimed) return { label: 'Pick your items', color: theme.colors.warning };
      return due.confirmed ? { label: 'Confirmed · not locked', color: theme.colors.primary } : { label: 'Not confirmed', color: theme.colors.warning };
    }
    if (due.state === 'disputed') return { label: owe ? "Didn't arrive" : 'Disputed', color: theme.colors.danger };
    if (due.state === 'excuse_pending') return { label: 'Excuse sent', color: theme.colors.warning };
    if (due.state === 'paid') return { label: 'Paid', color: theme.colors.success };
    if (due.state === 'waived') return { label: 'Let off', color: theme.colors.textMuted };
    return { label: 'To pay', color: theme.colors.secondary };
  })();

  // One clear next step
  let action: { title: string; onPress: () => void; icon?: 'wallet-outline' | 'checkbox-outline' | 'receipt-outline' | 'open-outline' } | null = null;
  if (owe && (due.state === 'owed' || due.state === 'disputed') && due.obligation_id) {
    action = { title: `Pay ${who} ${billMoney(due.amount_cents)}`, icon: 'wallet-outline', onPress: () => router.push(`/pay/${due.obligation_id}`) };
  } else if (owe && due.state === 'pending' && due.receipt_id) {
    action = { title: !due.claimed ? 'Pick what you had' : due.confirmed ? 'See the bill' : `Confirm ${billMoney(due.amount_cents)}`, icon: 'checkbox-outline', onPress: () => router.push(`/receipt/${due.receipt_id}`) };
  }
  const openSource = () => (due.receipt_id ? router.push(`/receipt/${due.receipt_id}`) : router.push(`/event/${due.event_id}${due.kind === 'split' ? '?tab=bills' : ''}`));

  const items = due.items ?? [];
  return (
    <Card padded={false} style={[styles.row, isOpenDue(due) && owe && styles.rowOwe]}>
      <PressableScale onPress={() => setOpen((v) => !v)} scaleTo={0.99} style={styles.rowTop} accessibilityLabel={`${headline} ${billMoney(due.amount_cents)}. Show why`}>
        <Avatar name={due.other_name} url={due.other_avatar} seed={due.other_id} size={36} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={theme.type.value} numberOfLines={1}>{isSettledDue(due) ? settledText : headline}</Text>
          <Text style={theme.type.caption} numberOfLines={2}>{context}</Text>
          <View style={styles.chip}>
            <View style={[styles.dot, { backgroundColor: chip.color }]} />
            <Text style={styles.chipText}>{chip.label}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={styles.amount}>{due.state === 'pending' ? '≈ ' : ''}{billMoney(due.amount_cents)}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textMuted} />
        </View>
      </PressableScale>

      {open && (
        <View style={styles.why}>
          <Text style={theme.type.label}>Why</Text>
          {due.kind === 'bill' && items.length === 0 && (
            <Text style={theme.type.caption}>{owe ? 'Nothing ticked yet.' : `${who} hasn't ticked anything yet.`}</Text>
          )}
          {items.map((it, i) => (
            <View key={`${it.name}-${i}`} style={styles.whyLine}>
              <Text style={[theme.type.caption, styles.whyName]} numberOfLines={2}>
                {it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ''}
                <Text style={{ color: theme.colors.textMuted }}>{it.shared_by > 1 ? `  ${billMoney(it.amount_cents)} split ${it.shared_by} ways` : ''}</Text>
              </Text>
              <Text style={styles.whyAmount}>{billMoney(it.my_cents)}</Text>
            </View>
          ))}
          {due.kind === 'bill' && !!due.extras_cents && (
            <View style={styles.whyLine}>
              <Text style={[theme.type.caption, styles.whyName]}>{due.extras_cents < 0 ? 'Share of the discounts' : 'Share of the surcharges and tips'}</Text>
              <Text style={styles.whyAmount}>{billMoney(due.extras_cents)}</Text>
            </View>
          )}
          {due.kind === 'split' && (
            <Text style={theme.type.caption}>{due.description} split evenly{due.split_people ? ` between ${due.split_people} people` : ''}. {owe ? `${who} paid` : 'You paid'}.</Text>
          )}
          {due.kind === 'pledge' && (
            <Text style={theme.type.caption}>The pledge for {due.event_title}: {due.description.replace('Pledge: ', '')}.</Text>
          )}
          <Text style={theme.type.caption}>
            {owe ? `${who} paid` : 'You paid'}{where ? ` at ${where}` : ''}{due.state === 'pending' ? '. Not final until it\'s locked.' : '.'}
            {due.paid_at ? ` Paid ${format(new Date(due.paid_at), 'EEE d MMM')}.` : ''}
          </Text>
          <Button title={due.receipt_id ? 'Open the bill' : 'Open the event'} size="sm" variant="ghost" onPress={openSource} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}

      {action && <View style={styles.action}><Button title={action.title} icon={action.icon} size="sm" onPress={action.onPress} /></View>}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: Space.lg },
  allClear: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  totals: { flexDirection: 'row', gap: Space.sm },
  total: {
    flex: 1, gap: 2, padding: Space.md, borderRadius: Radius.md, backgroundColor: t.colors.surface,
    borderWidth: t.outlineWidth, borderColor: t.colors.outline, ...t.shadow(3),
  },
  totalOwe: { backgroundColor: t.colors.highlight },
  group: { gap: Space.sm },
  settledToggle: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  row: { overflow: 'hidden' },
  rowOwe: { borderColor: t.colors.outline },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md },
  chip: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill, backgroundColor: t.colors.surfaceAlt, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: t.colors.text },
  amount: { fontFamily: Fonts.bodyBold, fontSize: 16, color: t.colors.text },
  why: { gap: 6, paddingHorizontal: Space.md, paddingBottom: Space.md, paddingTop: Space.sm, borderTopWidth: 1, borderTopColor: t.colors.border },
  whyLine: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.sm },
  whyName: { flex: 1 },
  whyAmount: { fontFamily: Fonts.bodyBold, fontSize: 12, color: t.colors.text },
  action: { paddingHorizontal: Space.md, paddingBottom: Space.md },
}));
