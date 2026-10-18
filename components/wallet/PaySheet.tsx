import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Confetti from '@/components/ui/Confetti';
import Money from '@/components/ui/Money';
import Sheet from '@/components/ui/Sheet';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showError } from '@/lib/alert';
import { Due, DueItem } from '@/lib/dues';
import { Obligation } from '@/lib/pledges';
import { Receipt } from '@/lib/receipts';
import { errorHint, friendlyError } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { billMoney, firstName } from '@/lib/receipts';
import { payFromWallet, PayResult, useWallet } from '@/lib/wallet';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import TopUpPanel from './TopUpPanel';

/** One debt to pay, exactly as the person will be shown it. */
export type PayTarget = {
  obligationId: string;
  amountCents: number;
  toId: string;
  toName: string | null;
  toAvatar?: string | null;
  description: string; // "Dinner at Uncle Ming's"
  where?: string | null; // "Uncle Ming's"
  eventTitle?: string | null;
  items?: DueItem[] | null; // what this share is made of
  extrasCents?: number | null;
};

/**
 * Paying one debt from the wallet (9.13). It shows exactly who you're paying, how
 * much and what for, before anything moves. The amount isn't editable: it's this
 * debt's amount, and the database refuses anything else (and anyone else). If the
 * wallet is short, topping up is its own step first; nothing pays automatically.
 */
export default function PaySheet({ target, onClose, onPaid }: {
  target: PayTarget | null; // null = closed
  onClose: () => void;
  onPaid?: (result: PayResult) => void;
}) {
  return (
    <Sheet visible={!!target} onClose={onClose} title={target ? `Pay ${firstName(target.toName, 'them')}` : undefined}>
      {target && <PayBody target={target} onClose={onClose} onPaid={onPaid} />}
    </Sheet>
  );
}

function PayBody({ target, onClose, onPaid }: { target: PayTarget; onClose: () => void; onPaid?: (r: PayResult) => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const { wallet, error, reload } = useWallet();
  const [step, setStep] = useState<'confirm' | 'topup' | 'done'>('confirm');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PayResult | null>(null);
  const [burst, setBurst] = useState(0);
  const who = firstName(target.toName, 'them');

  if (error && !wallet) {
    return (
      <View style={{ gap: Space.md }}>
        <Text style={[theme.type.value, { color: theme.colors.dangerText }]}>Couldn't open your wallet</Text>
        <Text style={theme.type.caption}>{friendlyError(error)}</Text>
        <Button title="Try again" icon="refresh" variant="soft" onPress={reload} />
      </View>
    );
  }
  if (!wallet) return <ActivityIndicator style={{ marginVertical: Space.xl }} color={theme.colors.textSecondary} />;

  const short = Math.max(0, target.amountCents - wallet.balance_cents);
  // Round a top-up for a shortfall up to the next $5, so it isn't $17.60 exactly
  const suggested = Math.max(500, Math.ceil(short / 500) * 500);

  const pay = async () => {
    setBusy(true);
    try {
      const r = await payFromWallet(target.obligationId, target.amountCents);
      haptics.success();
      setResult(r);
      setStep('done');
      setBurst((n) => n + 1);
      onPaid?.(r);
      reload();
    } catch (e) {
      const hint = errorHint(e);
      if (hint === 'insufficient_funds') { await reload(); showError('Not enough in your wallet', e); }
      else if (hint === 'amount_changed') { showError('The amount changed', e); onClose(); }
      else if (hint === 'not_payable') { showError('Nothing to pay', 'This one is already settled.'); onClose(); }
      else showError("Couldn't pay", e);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done' && result) {
    return (
      <View style={styles.done}>
        <Confetti burstKey={burst} />
        <View style={styles.doneMark}><Ionicons name="checkmark" size={34} color={theme.colors.onPrimary} /></View>
        <Text style={theme.type.title}>{result.already_paid ? 'Already paid' : `Paid ${who}`}</Text>
        <Money cents={result.amount_cents} size={34} />
        <Text style={[theme.type.bodySecondary, { textAlign: 'center' }]}>
          {result.already_paid ? 'This was paid earlier. Nothing was taken twice.' : `${who} sees it straight away.`} Left in your wallet: {billMoney(result.balance_after)}.
        </Text>
        <Button title="Done" onPress={onClose} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  if (step === 'topup') {
    return (
      <View style={{ gap: Space.md }}>
        <Text style={theme.type.bodySecondary}>
          Step 1 of 2: add at least {billMoney(short)} to your wallet. You'll confirm paying {who} next.
        </Text>
        <TopUpPanel
          wallet={wallet}
          initialCents={suggested}
          onChanged={reload}
          onDone={async () => { await reload(); setStep('confirm'); }}
          onCancel={() => setStep('confirm')}
        />
      </View>
    );
  }

  const items = target.items ?? [];
  return (
    <View style={{ gap: Space.lg }}>
      <View style={styles.payee}>
        <Avatar name={target.toName} url={target.toAvatar} seed={target.toId} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={theme.type.caption}>You're paying</Text>
          <Text style={theme.type.cardTitle} numberOfLines={1}>{target.toName ?? 'Someone'}</Text>
          <Text style={theme.type.caption} numberOfLines={2}>
            For {target.description}{target.where ? ` at ${target.where}` : ''}{target.eventTitle && target.eventTitle !== target.description ? ` · ${target.eventTitle}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.amountBox}>
        <Money cents={target.amountCents} size={40} />
        <Text style={theme.type.caption}>Your exact share. Only this amount can be paid, only to {who}.</Text>
      </View>

      {items.length > 0 && (
        <View style={styles.items}>
          {items.map((it, i) => (
            <View key={`${it.name}-${i}`} style={styles.itemRow}>
              <Text style={[theme.type.caption, { flex: 1 }]} numberOfLines={1}>
                {it.name}{it.units != null ? ` · ${it.units} of ${it.quantity}` : `${it.quantity > 1 ? ` ×${it.quantity}` : ''}${it.shared_by > 1 ? ` · split ${it.shared_by} ways` : ''}`}
              </Text>
              <Text style={styles.itemAmount}>{billMoney(it.my_cents)}</Text>
            </View>
          ))}
          {!!target.extrasCents && (
            <View style={styles.itemRow}>
              <Text style={[theme.type.caption, { flex: 1 }]}>{target.extrasCents < 0 ? 'Your share of the discounts' : 'Your share of the surcharges and tips'}</Text>
              <Text style={styles.itemAmount}>{billMoney(target.extrasCents)}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.from}>
        <Ionicons name="wallet-outline" size={20} color={theme.colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={theme.type.value}>From your wya wallet</Text>
          <Text style={theme.type.caption}>
            Balance {billMoney(wallet.balance_cents)}
            {short > 0 ? ` · short by ${billMoney(short)}` : ` · ${billMoney(wallet.balance_cents - target.amountCents)} left after`}
          </Text>
        </View>
      </View>

      {short > 0 ? (
        <View style={{ gap: Space.sm }}>
          <Button title={`Top up first (at least ${billMoney(short)})`} icon="add-circle-outline" onPress={() => setStep('topup')} />
          <Button title={`Pay ${who} ${billMoney(target.amountCents)}`} variant="soft" disabled />
        </View>
      ) : (
        <Button title={`Pay ${who} ${billMoney(target.amountCents)}`} icon="lock-closed" onPress={pay} loading={busy} />
      )}
      <Text style={[theme.type.caption, { textAlign: 'center' }]}>
        {wallet.test_mode ? 'Test balance: no real money moves yet. ' : ''}Nothing is paid until you tap Pay.
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  payee: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  amountBox: { alignItems: 'center', gap: Space.xs, paddingVertical: Space.md, borderRadius: Radius.lg, backgroundColor: t.colors.surfaceAlt },
  items: { gap: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  itemAmount: { fontFamily: Fonts.mono, fontSize: 13, color: t.colors.text },
  from: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md, borderRadius: Radius.md, borderWidth: 1, borderColor: t.colors.border },
  done: { alignItems: 'center', gap: Space.md, paddingVertical: Space.md },
  doneMark: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.success },
}));

// ---------------------------------------------------------------------------
// The same target from wherever Pay is pressed
// ---------------------------------------------------------------------------
/** From a dues row (Bills tab, Your dues): it already carries the items. */
export function payTargetFromDue(d: Due): PayTarget | null {
  if (!d.obligation_id || d.direction !== 'owe') return null;
  return {
    obligationId: d.obligation_id, amountCents: d.amount_cents, toId: d.other_id, toName: d.other_name, toAvatar: d.other_avatar,
    description: d.description, where: d.merchant ?? d.venue_name, eventTitle: d.event_title, items: d.items, extrasCents: d.extras_cents,
  };
}

/** From a debt (pay page, pledge card). Pass the matching dues row for the items, if there is one. */
export function payTargetFromObligation(o: Obligation, due?: Due | null): PayTarget {
  return {
    obligationId: o.id, amountCents: o.amount_cents, toId: o.other_user_id, toName: o.other_name, toAvatar: due?.other_avatar,
    description: o.kind === 'split' ? o.description ?? 'Your share' : `The pledge for ${o.event_title}`,
    where: due?.merchant ?? due?.venue_name ?? null, eventTitle: o.event_title, items: due?.items, extrasCents: due?.extras_cents,
  };
}

/** From a locked bill: your items, worked out the way the database does (shared items split evenly). */
export function payTargetFromReceipt(r: Receipt, myId: string | undefined): PayTarget | null {
  const mine = r.split?.find((row) => row.user_id === myId && row.obligation_id);
  if (!mine?.obligation_id || !myId) return null;
  const me = r.people.find((p) => p.user_id === myId);
  const payer = r.people.find((p) => p.is_payer);
  // The same maths as the database: units at the unit price, or a share of the units nobody took
  const items: DueItem[] = r.lines
    .filter((l) => l.kind === 'item' && l.claimers.includes(myId))
    .map((l) => {
      const claims = l.claims ?? l.claimers.map((user_id) => ({ user_id, units: null }));
      const units = claims.find((c) => c.user_id === myId)?.units ?? null;
      const sharing = claims.filter((c) => c.units == null).length;
      const taken = Math.min(l.units_claimed ?? 0, l.quantity);
      const my = l.quantity > 1 && units != null
        ? (l.amount_cents * units) / l.quantity
        : (l.amount_cents - (l.amount_cents * taken) / l.quantity) / Math.max(sharing, 1);
      return { name: l.name, quantity: l.quantity, amount_cents: l.amount_cents, shared_by: units != null ? 1 : sharing, my_cents: Math.round(my), units };
    });
  return {
    obligationId: mine.obligation_id, amountCents: mine.share_cents, toId: r.payer_id, toName: r.payer_name, toAvatar: payer?.avatar_url,
    description: r.description, where: r.merchant, eventTitle: r.event_title, items, extrasCents: me?.adjust_cents ?? null,
  };
}

