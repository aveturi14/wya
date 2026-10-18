import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { showError } from '@/lib/alert';
import { addCard, cardBrand, formatCardNumber, formatExpiryInput, luhnValid, parseExpiry } from '@/lib/wallet';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { MethodArt } from './WalletArt';

/**
 * Add a card (proof of concept, 9.13). Everything is checked here, on the device:
 * the number (Luhn), the expiry and the CVC. Only the brand, last 4 digits and
 * expiry are saved; the full number and CVC are never sent and are cleared as
 * soon as the form closes. Test with 4242 4242 4242 4242.
 */
export default function AddCardForm({ onAdded, onCancel }: { onAdded: (id: string) => void; onCancel?: () => void }) {
  const { theme } = useTheme();
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  // Never keep a card number around after the form goes away
  useEffect(() => () => { setNumber(''); setCvc(''); }, []);

  const digits = number.replace(/\D/g, '');
  const brand = cardBrand(digits);
  const exp = parseExpiry(expiry);
  const numberOk = luhnValid(digits);
  const cvcOk = new RegExp(`^\\d{${brand === 'amex' ? 4 : 3}}$`).test(cvc);
  const ok = numberOk && !!exp && cvcOk;

  const save = async () => {
    setTried(true);
    if (!ok || !exp) return;
    setBusy(true);
    try {
      const id = await addCard({ number: digits, expMonth: exp.month, expYear: exp.year, label: name });
      setNumber(''); setCvc(''); setExpiry(''); setName(''); setTried(false);
      onAdded(id);
    } catch (e) {
      showError("Couldn't add the card", e);
    } finally {
      setBusy(false);
    }
  };

  const problem = !tried ? null
    : !numberOk ? (digits.length < 12 ? 'Enter the whole card number.' : "That card number doesn't look right. Check the digits.")
    : !exp ? 'Check the expiry date (MM/YY). It can\'t be in the past.'
    : !cvcOk ? `The security code is ${brand === 'amex' ? 4 : 3} digits, on the ${brand === 'amex' ? 'front' : 'back'}.`
    : null;

  return (
    <View style={{ gap: Space.md }}>
      <View style={{ alignItems: 'center' }}>
        <MethodArt brand={digits ? brand : null} last4={digits.length >= 4 ? digits.slice(-4) : null} expiry={expiry || null} name={name || null} />
      </View>
      <TextField
        label="Card number"
        value={formatCardNumber(number)}
        onChangeText={(v) => setNumber(v.replace(/\D/g, '').slice(0, 19))}
        placeholder="4242 4242 4242 4242"
        keyboardType="number-pad"
        autoComplete="cc-number"
        textContentType="creditCardNumber"
        maxLength={23}
      />
      <View style={{ flexDirection: 'row', gap: Space.sm }}>
        <View style={{ flex: 1 }}>
          <TextField label="Expiry" value={expiry} onChangeText={(v) => setExpiry(formatExpiryInput(v))} placeholder="MM/YY" keyboardType="number-pad" autoComplete="cc-exp" maxLength={5} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Security code" value={cvc} onChangeText={(v) => setCvc(v.replace(/\D/g, '').slice(0, 4))} placeholder={brand === 'amex' ? '1234' : '123'} keyboardType="number-pad" autoComplete="cc-csc" secure maxLength={4} />
        </View>
      </View>
      <TextField label="Name on card" optional value={name} onChangeText={setName} placeholder="Gary Guest" autoComplete="cc-name" maxLength={40} />
      {problem && <Text style={[theme.type.caption, { color: theme.colors.dangerText }]} accessibilityRole="alert">{problem}</Text>}
      <Text style={theme.type.caption}>
        Test only: no card is charged. Use 4242 4242 4242 4242. wya keeps just the brand, the last 4 digits and the expiry.
      </Text>
      <View style={{ flexDirection: 'row', gap: Space.sm }}>
        {onCancel && <Button title="Cancel" variant="ghost" onPress={onCancel} />}
        <Button title="Add card" icon="card-outline" onPress={save} loading={busy} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
