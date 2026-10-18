import Button from '@/components/ui/Button';
import { ChipRow } from '@/components/ui/Chip';
import PressableScale from '@/components/ui/PressableScale';
import TextField from '@/components/ui/TextField';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showError } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { billMoney, parseCents } from '@/lib/receipts';
import { cashOut, Wallet } from '@/lib/wallet';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { MethodArt } from './WalletArt';

type Amount = 'all' | 'other';

/**
 * Take money back out of the wallet (9.13, test balance): all of it or part, back
 * to one of your saved cards or Apple Pay. Nothing real is paid out yet; with a
 * payments partner this becomes a payout to your bank.
 */
export default function CashOutPanel({ wallet, onDone, onCancel, onAddMethod }: {
  wallet: Wallet;
  onDone: (balanceCents: number) => void;
  onCancel: () => void;
  onAddMethod: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [amount, setAmount] = useState<Amount>('all');
  const [other, setOther] = useState('');
  const [methodId, setMethodId] = useState(wallet.methods.find((m) => m.is_default)?.id ?? wallet.methods[0]?.id);
  const [busy, setBusy] = useState(false);
  const cents = amount === 'all' ? wallet.balance_cents : parseCents(other) ?? 0;
  const method = wallet.methods.find((m) => m.id === methodId);

  const reason = wallet.balance_cents < 100 ? 'There\'s nothing to cash out yet.'
    : cents < 100 ? 'Cash out at least $1.'
    : cents > wallet.balance_cents ? `You have ${billMoney(wallet.balance_cents)}.`
    : !method ? 'Add a card to send it to.'
    : null;

  const go = async () => {
    if (!method) return;
    setBusy(true);
    try {
      const balance = await cashOut(cents, method.id);
      haptics.success();
      onDone(balance);
    } catch (e) {
      showError("Couldn't cash out", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: Space.lg }}>
      <View style={{ gap: Space.sm }}>
        <Text style={theme.type.label}>How much</Text>
        <ChipRow
          options={[{ value: 'all' as Amount, label: `All ${billMoney(wallet.balance_cents)}` }, { value: 'other' as Amount, label: 'Some of it' }]}
          value={amount}
          onChange={setAmount}
        />
        {amount === 'other' && <TextField label="Amount" value={other} onChangeText={setOther} placeholder="20.00" keyboardType="decimal-pad" autoFocus />}
      </View>

      <View style={{ gap: Space.sm }}>
        <Text style={theme.type.label}>Send it to</Text>
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
            <Text style={[theme.type.value, { flex: 1 }]}>{m.label}</Text>
            <Ionicons name={m.id === methodId ? 'radio-button-on' : 'radio-button-off'} size={20} color={m.id === methodId ? theme.colors.text : theme.colors.textMuted} />
          </PressableScale>
        ))}
        {wallet.methods.length === 0 && <Button title="Add a card" icon="card-outline" variant="soft" size="sm" onPress={onAddMethod} style={{ alignSelf: 'flex-start' }} />}
      </View>

      {reason && <Text style={[theme.type.caption, { color: theme.colors.warningText }]}>{reason}</Text>}
      <View style={{ flexDirection: 'row', gap: Space.sm }}>
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
        <Button title={`Cash out ${billMoney(Math.max(cents, 0))}`} icon="arrow-down" onPress={go} loading={busy} disabled={!!reason} style={{ flex: 1 }} />
      </View>
      <Text style={theme.type.caption}>Test balance: nothing real is paid out yet. With real payments this goes to your bank within a day or two.</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  method: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md, borderRadius: Radius.md,
    backgroundColor: t.colors.surfaceAlt, borderWidth: 1, borderColor: 'transparent',
  },
  methodOn: { borderColor: t.colors.text },
}));
