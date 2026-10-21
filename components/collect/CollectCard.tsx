import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/lib/alert';
import { Collection, collectAction, CollectionStatus, firstName, formatDeadline, useCollection } from '@/lib/collections';
import { friendlyError } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { formatMoney } from '@/lib/pledges';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

/** The status words on a collection, and their colour role. */
export function statusChip(status: CollectionStatus, theme: ReturnType<typeof useTheme>['theme']) {
  const c = theme.colors;
  return {
    open: { label: 'Collecting', color: c.textSecondary },
    funded: { label: 'Funded', color: c.successText },
    booked: { label: 'Booked', color: c.successText },
    expired: { label: "Didn't fill up", color: c.warningText },
    cancelled: { label: 'Cancelled', color: c.textMuted },
  }[status];
}

/**
 * Progress toward the target: confirmed money solid, money people say they've
 * paid lighter (it isn't counted until the organiser confirms it, C-3).
 */
export function CollectProgress({ c }: { c: Collection }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const target = Math.max(c.target_cents, 1);
  const confirmed = Math.min(1, c.counts.confirmed_cents / target);
  const claimed = Math.min(1, c.counts.claimed_cents / target);
  const need = Math.max(0, c.min_people - c.counts.confirmed);
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.track} accessibilityRole="progressbar"
        accessibilityLabel={`${formatMoney(c.counts.confirmed_cents)} of ${formatMoney(c.target_cents)} confirmed`}>
        <View style={[styles.fill, styles.claimed, { width: `${claimed * 100}%` }]} />
        <View style={[styles.fill, { width: `${confirmed * 100}%`, backgroundColor: theme.colors.primary }]} />
      </View>
      <View style={styles.legend}>
        <Text style={theme.type.caption}>
          <Text style={{ color: theme.colors.text }}>{formatMoney(c.counts.confirmed_cents)}</Text> of {formatMoney(c.target_cents)} confirmed
        </Text>
        <Text style={theme.type.caption}>
          {c.counts.joined} in{c.max_people ? ` of ${c.max_people}` : ''} · {c.counts.confirmed} paid
        </Text>
      </View>
      {c.status === 'open' && c.counts.claimed > c.counts.confirmed && (
        <Text style={theme.type.caption}>{c.counts.claimed - c.counts.confirmed} waiting for {c.is_organiser ? 'you' : firstName(c.organiser_name)} to confirm</Text>
      )}
      {c.status === 'open' && need > 0 && (
        <Text style={theme.type.caption}>Needs {need} more {need === 1 ? 'person' : 'people'} paid by {formatDeadline(c.deadline)}</Text>
      )}
    </View>
  );
}

/**
 * A collection, on the event page and in the chat: what it's for, progress, and
 * your next step ("I'm in, $60", "Pay Hannah", "Confirm 2 payments"). Tap for the
 * full page.
 */
export default function CollectCard({ collectionId, version = 0 }: { collectionId: string; version?: number }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { collection: c, error, reload } = useCollection(collectionId, version);
  const [busy, setBusy] = useState(false);
  const open = () => router.push(`/collect/${collectionId}`);

  if (error) {
    return (
      <Card style={{ gap: 4 }}>
        <Text style={theme.type.cardTitle}>Collecting money</Text>
        <Text style={theme.type.caption}>{friendlyError(error)}</Text>
      </Card>
    );
  }
  if (!c) return null;

  const org = c.is_organiser ? 'You' : firstName(c.organiser_name);
  const amount = formatMoney(c.per_person_cents);
  const chip = statusChip(c.status, theme);

  const join = async () => {
    setBusy(true);
    try {
      const obligationId = await collectAction('join_collection', { p_id: c.id }) as string;
      haptics.success();
      reload();
      router.push(`/pay/${obligationId}`);
    } catch (e) {
      showAlert("Couldn't join", friendlyError(e));
    }
    setBusy(false);
  };

  let action = null;
  if (c.is_organiser) {
    if (c.counts.requests > 0) action = <Button title={`${c.counts.requests} ${c.counts.requests === 1 ? 'person wants' : 'people want'} in`} icon="hand-left-outline" onPress={open} />;
    else if (c.counts.to_confirm > 0) action = <Button title={`Confirm ${c.counts.to_confirm} ${c.counts.to_confirm === 1 ? 'payment' : 'payments'}`} icon="checkmark-done" onPress={open} />;
    else if (c.counts.refunds_due > 0) action = <Button title={`Refund ${c.counts.refunds_due} ${c.counts.refunds_due === 1 ? 'person' : 'people'}`} variant="soft" onPress={open} />;
    else if (c.status === 'funded') action = <Button title="Mark as booked" icon="checkmark-circle-outline" onPress={open} />;
  } else if (c.can_join) {
    action = <Button title={`I'm in, ${amount}`} icon="hand-right-outline" loading={busy} onPress={join} />;
  } else if (c.my_obligation_id && (c.my_state === 'in' || c.my_state === 'disputed')) {
    action = <Button title={`Pay ${firstName(c.organiser_name)} ${amount}`} icon="card-outline" onPress={() => router.push(`/pay/${c.my_obligation_id}`)} />;
  }

  const mine = !c.is_organiser && c.my_state ? {
    in: `You're in for ${amount}`,
    disputed: `${firstName(c.organiser_name)} hasn't received your ${amount}`,
    says_paid: `You've paid. ${firstName(c.organiser_name)} hasn't confirmed it yet`,
    confirmed: `${firstName(c.organiser_name)} got your ${amount}`,
    refund_requested: `${firstName(c.organiser_name)} will refund your ${amount}`,
    refunded: `${firstName(c.organiser_name)} refunded your ${amount}`,
  }[c.my_state] : null;

  return (
    <Card onPress={open} style={styles.card} accessibilityLabel={`${c.title}. ${amount} each. Open`}>
      <View style={styles.header}>
        <Ionicons name="cash-outline" size={14} color={theme.colors.textSecondary} />
        <Text style={[theme.type.caption, { flex: 1 }]} numberOfLines={1}>{org} {c.is_organiser ? 'are' : 'is'} collecting</Text>
        <Chip label={chip.label} color={chip.color} />
      </View>
      <View style={{ gap: 2 }}>
        <Text style={theme.type.cardTitle}>{c.title}</Text>
        <Text style={theme.type.bodySecondary}>
          {amount} each{c.status === 'open' ? ` · by ${formatDeadline(c.deadline)}` : ''}
        </Text>
      </View>
      <CollectProgress c={c} />
      {c.status === 'funded' && !c.is_organiser && <Text style={theme.type.body}>Funded! {firstName(c.organiser_name)} can book now.</Text>}
      {mine && <Text style={theme.type.value}>{mine}</Text>}
      {action}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: Space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { height: 10, borderRadius: Radius.pill, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: Radius.pill },
  claimed: { backgroundColor: t.colors.primary, opacity: 0.28 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', gap: Space.sm, flexWrap: 'wrap' },
}));
