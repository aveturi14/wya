import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PressableScale from '@/components/ui/PressableScale';
import TextField from '@/components/ui/TextField';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { getProvider, ProviderId } from '@/lib/payments';
import { formatMoney, Obligation, reasonLabel } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

type Instructions = { host_name: string | null; provider: ProviderId | null; payid: string | null; reference: string };

/** "You owe Hannah $5": how to pay, plus I've paid and (pledges only) I have an excuse. Guest only. Also used by the pay page for splits. */
export default function PayCard({ obligation, onChange }: { obligation: Obligation; onChange: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [info, setInfo] = useState<Instructions | null>(null);
  const [excusing, setExcusing] = useState(false);
  const [excuse, setExcuse] = useState('');
  const [busy, setBusy] = useState(false);
  const hostName = obligation.other_name?.split(' ')[0] ?? 'the host';
  const amount = formatMoney(obligation.amount_cents);
  const payable = obligation.status === 'owed' || obligation.status === 'disputed';

  useEffect(() => {
    if (!payable) return;
    supabase.rpc('get_payment_instructions', { p_obligation_id: obligation.id }).then(({ data }) => setInfo(data?.[0] ?? null));
  }, [obligation.id, payable]);

  const call = async (fn: string, args: Record<string, unknown>) => {
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { showAlert('Something went wrong', error.message); return false; }
    onChange();
    return true;
  };

  if (obligation.status === 'excuse_pending') {
    return (
      <Card style={{ gap: Space.sm }}>
        <Text style={theme.type.heading}>Excuse sent</Text>
        <Text style={theme.type.bodySecondary}>{hostName} will decide whether to let you off the {amount} for {obligation.event_title}.</Text>
      </Card>
    );
  }
  if (!payable) return null;

  const provider = getProvider(info?.provider ?? undefined);

  return (
    <Card style={styles.card}>
      <View style={{ gap: 4 }}>
        <Text style={theme.type.title}>You owe {hostName} {amount}</Text>
        <Text style={theme.type.bodySecondary}>
          {obligation.status === 'disputed'
            ? `${hostName} hasn't received your payment for ${obligation.event_title}. Check the transfer went through.`
            : obligation.kind === 'split'
              ? `Your share of ${obligation.description ?? 'a bill'} at ${obligation.event_title}.`
              : `For ${obligation.event_title}: you ${reasonLabel(obligation.reason)}.`}
        </Text>
      </View>

      {info?.payid ? (
        <>
          <CopyRow label={`${hostName}'s ${provider.label}`} value={provider.format(info.payid)} copyValue={info.payid} />
          <CopyRow label="Description" value={info.reference} />
          {/* Bank apps ask for these one at a time; this puts all three on the clipboard for pasting into a note */}
          <Button
            title="Copy all"
            icon="copy-outline"
            variant="outline"
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            onPress={async () => {
              await Clipboard.setStringAsync(`${provider.label}: ${info.payid}\nAmount: ${amount}\nDescription: ${info.reference}`);
              haptics.success();
              showAlert('Copied', `${provider.label}, amount and description are on your clipboard.`);
            }}
          />
          <View style={{ gap: 4 }}>
            {provider.instructions({ amount, reference: info.reference, hostName }).map((line, i) => (
              <Text key={i} style={theme.type.caption}>{i + 1}. {line}</Text>
            ))}
          </View>
        </>
      ) : (
        <Text style={theme.type.bodySecondary}>Ask {hostName} how they'd like to be paid.</Text>
      )}

      {excusing ? (
        <View style={{ gap: Space.sm }}>
          <TextField label={`Tell ${hostName} what happened`} value={excuse} onChangeText={setExcuse} placeholder="My car broke down on the way…" multiline maxLength={500} />
          <Text style={theme.type.caption}>You can send one excuse. If {hostName} declines, you'll still owe {amount}.</Text>
          <View style={styles.row}>
            <Button title="Cancel" variant="ghost" onPress={() => setExcusing(false)} style={{ flex: 1 }} />
            <Button
              title="Send"
              disabled={!excuse.trim()}
              loading={busy}
              onPress={async () => { if (await call('submit_excuse', { p_obligation_id: obligation.id, p_excuse: excuse })) setExcusing(false); }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Button
            title="I've paid"
            icon="checkmark-circle"
            loading={busy}
            onPress={async () => { if (await call('claim_paid', { p_obligation_id: obligation.id })) haptics.success(); }}
            style={{ flex: 1 }}
          />
          {!obligation.excuse && obligation.kind !== 'split' && (
            <Button title="I have an excuse" variant="outline" onPress={() => setExcusing(true)} style={{ flex: 1 }} />
          )}
        </View>
      )}
      {obligation.excuse_declined && <Text style={theme.type.caption}>{hostName} declined your excuse.</Text>}
    </Card>
  );
}

function CopyRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [copied, setCopied] = useState(false);
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={async () => {
        await Clipboard.setStringAsync(copyValue ?? value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      style={styles.copyRow}
      hoverStyle={styles.copyHover}
      accessibilityLabel={`Copy ${label}`}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={theme.type.caption}>{label}</Text>
        <Text style={[theme.type.value, { fontFamily: Fonts.bodyBold }]}>{value}</Text>
      </View>
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? theme.colors.success : theme.colors.textSecondary} />
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: Space.lg, borderColor: t.isDark ? t.colors.danger : t.colors.outline },
  row: { flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' },
  copyRow: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md, borderRadius: Radius.md,
    backgroundColor: t.colors.surfaceAlt,
  },
  copyHover: { opacity: 0.85 },
}));
