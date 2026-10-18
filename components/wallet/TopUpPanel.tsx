import Button from '@/components/ui/Button';
import { ChipRow } from '@/components/ui/Chip';
import PressableScale from '@/components/ui/PressableScale';
import TextField from '@/components/ui/TextField';
import { Fonts, Radius, Space } from '@/constants/theme';
import { APPLE_PAY_BUTTON } from '@/constants/wallet';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showError } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { billMoney, parseCents } from '@/lib/receipts';
import { addApplePay, topUp, Wallet, WalletMethod } from '@/lib/wallet';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import AddCardForm from './AddCardForm';
import { MethodArt } from './WalletArt';

type Preset = '2000' | '5000' | '10000' | 'other';

/**
 * Top up the wallet (test balance, 9.13): pick an amount and a saved way to pay,
 * then confirm. Apple Pay shows its own confirm step (a mock of Apple's sheet:
 * nothing is charged). Limits come from the wallet (WAL-5).
 */
export default function TopUpPanel({ wallet, initialCents, initialMethodId, onDone, onCancel, onChanged }: {
  wallet: Wallet;
  initialCents?: number; // e.g. what's short for a payment
  initialMethodId?: string; // e.g. Apple Pay, when that's the button that was pressed
  onDone: (balanceCents: number) => void;
  onCancel?: () => void;
  // A way to pay was added: the parent reloads the wallet so it shows up here
  onChanged: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const start = initialCents ?? 5000;
  const [preset, setPreset] = useState<Preset>(([2000, 5000, 10000].includes(start) ? String(start) : 'other') as Preset);
  const [other, setOther] = useState(preset === 'other' ? (start / 100).toFixed(2) : '');
  const defaultMethod = wallet.methods.find((m) => m.is_default) ?? wallet.methods[0];
  const [methodId, setMethodId] = useState<string | undefined>(initialMethodId ?? defaultMethod?.id);
  const [step, setStep] = useState<'choose' | 'apple' | 'card'>('choose');
  const [busy, setBusy] = useState(false);

  const cents = preset === 'other' ? parseCents(other) ?? 0 : parseInt(preset, 10);
  const room = Math.min(
    wallet.limits.max_topup_cents,
    wallet.limits.max_balance_cents - wallet.balance_cents,
    wallet.limits.monthly_topup_cents - wallet.limits.topped_up_this_month_cents,
  );
  const method = wallet.methods.find((m) => m.id === methodId);
  const tooSmall = cents < 100;
  const tooBig = cents > room;
  const reason = room <= 0
    ? (wallet.balance_cents >= wallet.limits.max_balance_cents ? `Your wallet is full (it holds up to ${billMoney(wallet.limits.max_balance_cents)}).` : "You've reached this month's top-up limit.")
    : tooSmall ? 'Top up at least $1.'
    : tooBig ? `You can add up to ${billMoney(room)} right now.`
    : !method ? 'Add a way to pay first.'
    : null;

  const presets = useMemo(() => [
    { value: '2000' as Preset, label: '$20' }, { value: '5000' as Preset, label: '$50' },
    { value: '10000' as Preset, label: '$100' }, { value: 'other' as Preset, label: 'Other' },
  ], []);

  const run = async (m: WalletMethod) => {
    setBusy(true);
    try {
      const balance = await topUp(cents, m.id);
      haptics.success();
      onDone(balance);
    } catch (e) {
      showError("Couldn't top up", e);
    } finally {
      setBusy(false);
      setStep('choose');
    }
  };

  const useApplePay = async () => {
    try {
      const existing = wallet.methods.find((m) => m.kind === 'apple_pay')?.id;
      const id = existing ?? await addApplePay();
      if (!existing) onChanged();
      setMethodId(id);
      setStep('apple');
    } catch (e) {
      showError("Couldn't set up Apple Pay", e);
    }
  };

  if (step === 'card') {
    return <AddCardForm onAdded={(id) => { setMethodId(id); setStep('choose'); onChanged(); }} onCancel={() => setStep('choose')} />;
  }

  if (step === 'apple' && method) {
    // A look-alike of Apple's payment sheet, so the flow can be shown. Nothing is charged.
    return (
      <View style={styles.apple}>
        <View style={styles.appleHead}>
          <Ionicons name="logo-apple" size={20} color={theme.colors.text} />
          <Text style={[theme.type.cardTitle, { flex: 1 }]}>Pay</Text>
          <Text style={theme.type.caption}>Demo</Text>
        </View>
        <View style={styles.appleRow}>
          <MethodArt applePay size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={theme.type.value}>Apple Pay</Text>
            <Text style={theme.type.caption}>Test card on this device</Text>
          </View>
        </View>
        <View style={[styles.appleRow, styles.appleTotal]}>
          <Text style={[theme.type.value, { flex: 1 }]}>Pay wya wallet</Text>
          <Text style={styles.appleAmount}>{billMoney(cents)}</Text>
        </View>
        <Button title={`Confirm ${billMoney(cents)}`} icon="logo-apple" color={APPLE_PAY_BUTTON} onPress={() => run(method)} loading={busy} />
        <Text style={[theme.type.caption, { textAlign: 'center' }]}>
          Demo: no real payment. On a phone this is where Face ID or the side button confirms.
        </Text>
        <Button title="Back" variant="ghost" size="sm" onPress={() => setStep('choose')} style={{ alignSelf: 'center' }} />
      </View>
    );
  }

  return (
    <View style={{ gap: Space.lg }}>
      <View style={{ gap: Space.sm }}>
        <Text style={theme.type.label}>How much</Text>
        <ChipRow options={presets} value={preset} onChange={setPreset} />
        {preset === 'other' && (
          <TextField label="Amount" value={other} onChangeText={setOther} placeholder="25.00" keyboardType="decimal-pad" autoFocus />
        )}
      </View>

      <View style={{ gap: Space.sm }}>
        <Text style={theme.type.label}>Pay with</Text>
        {wallet.methods.map((m) => (
          <PressableScale
            key={m.id}
            onPress={() => setMethodId(m.id)}
            style={[styles.method, m.id === methodId && styles.methodOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: m.id === methodId }}
            accessibilityLabel={m.label}
          >
            <MethodArt applePay={m.kind === 'apple_pay'} brand={m.brand} size="sm" />
            <View style={{ flex: 1 }}>
              <Text style={theme.type.value}>{m.label}</Text>
              {m.kind === 'card' && <Text style={theme.type.caption}>Expires {String(m.exp_month).padStart(2, '0')}/{String(m.exp_year).slice(2)}</Text>}
            </View>
            <Ionicons name={m.id === methodId ? 'radio-button-on' : 'radio-button-off'} size={20} color={m.id === methodId ? theme.colors.text : theme.colors.textMuted} />
          </PressableScale>
        ))}
        <View style={styles.addRow}>
          {!wallet.methods.some((m) => m.kind === 'apple_pay') && (
            <Button title="Use Apple Pay" icon="logo-apple" size="sm" color={APPLE_PAY_BUTTON} onPress={useApplePay} />
          )}
          <Button title="Add a card" icon="card-outline" size="sm" variant="soft" onPress={() => setStep('card')} />
        </View>
      </View>

      {reason && <Text style={[theme.type.caption, { color: theme.colors.warningText }]}>{reason}</Text>}
      <View style={{ flexDirection: 'row', gap: Space.sm }}>
        {onCancel && <Button title="Cancel" variant="ghost" onPress={onCancel} />}
        {method?.kind === 'apple_pay' ? (
          <Button title={`Top up ${billMoney(Math.max(cents, 0))}`} icon="logo-apple" color={APPLE_PAY_BUTTON} disabled={!!reason} onPress={() => setStep('apple')} style={{ flex: 1 }} />
        ) : (
          <Button title={`Top up ${billMoney(Math.max(cents, 0))}`} icon="add-circle-outline" disabled={!!reason} loading={busy} onPress={() => method && run(method)} style={{ flex: 1 }} />
        )}
      </View>
      {wallet.test_mode && <Text style={theme.type.caption}>Test balance: no real money moves. Top-ups up to {billMoney(wallet.limits.max_topup_cents)} at a time.</Text>}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  method: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md, borderRadius: Radius.md,
    backgroundColor: t.colors.surfaceAlt, borderWidth: 1, borderColor: 'transparent',
  },
  methodOn: { borderColor: t.colors.text },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  apple: { gap: Space.md, padding: Space.lg, borderRadius: Radius.lg, backgroundColor: t.colors.surfaceAlt },
  appleHead: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  appleRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  appleTotal: { paddingTop: Space.md, borderTopWidth: 1, borderTopColor: t.colors.border },
  appleAmount: { fontFamily: Fonts.mono, fontSize: 18, color: t.colors.text },
}));
