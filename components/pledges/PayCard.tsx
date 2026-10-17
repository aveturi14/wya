import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Money from '@/components/ui/Money';
import PressableScale from '@/components/ui/PressableScale';
import Sheet from '@/components/ui/Sheet';
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
      <View style={styles.amount}>
        <Text style={theme.type.label}>You owe {hostName}</Text>
        <Money cents={obligation.amount_cents} size={40} />
        <Text style={[theme.type.caption, { textAlign: 'center' }]}>
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
            variant="soft"
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

      <View style={styles.row}>
        <Button
          title="I've paid"
          icon="checkmark"
          loading={busy && !excusing}
          onPress={async () => { if (await call('claim_paid', { p_obligation_id: obligation.id })) haptics.success(); }}
          style={{ flex: 1 }}
        />
        {!obligation.excuse && obligation.kind !== 'split' && (
          <Button title="I have an excuse" variant="line" onPress={() => setExcusing(true)} style={{ flex: 1 }} />
        )}
      </View>
      {obligation.kind !== 'split' && (
        <Text style={[theme.type.caption, { textAlign: 'center' }]}>Until it's settled you can't RSVP to {hostName}'s events.</Text>
      )}
      {obligation.excuse_declined && <Text style={theme.type.caption}>{hostName} declined your excuse.</Text>}

      {/* A sheet, so you never leave the debt you're answering */}
      <Sheet
        visible={excusing}
        onClose={() => setExcusing(false)}
        title={<Text style={theme.type.heading}>Tell {hostName} <Text style={styles.serif}>what happened</Text></Text>}
        footer={
          <View style={styles.row}>
            <Button title="Cancel" variant="soft" onPress={() => setExcusing(false)} style={{ flex: 1 }} />
            <Button
              title="Send"
              disabled={!excuse.trim()}
              loading={busy}
              onPress={async () => { if (await call('submit_excuse', { p_obligation_id: obligation.id, p_excuse: excuse })) setExcusing(false); }}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <TextField value={excuse} onChangeText={setExcuse} placeholder="My car broke down on the way…" multiline maxLength={500} autoFocus accessibilityLabel={`Tell ${hostName} what happened`} />
        <Text style={theme.type.caption}>You can send one excuse. {hostName} can let you off or decline; if they decline, you'll still owe {amount}. You'll hear in Activity.</Text>
      </Sheet>
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
        <Text style={[theme.type.money, { fontFamily: Fonts.mono }]}>{value}</Text>
      </View>
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? theme.colors.success : theme.colors.textSecondary} />
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: Space.lg },
  amount: { alignItems: 'center', gap: 4, paddingVertical: Space.sm },
  serif: { fontFamily: Fonts.serif, fontSize: 22 },
  row: { flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' },
  copyRow: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md, borderRadius: Radius.md,
    backgroundColor: t.colors.surfaceAlt,
  },
  copyHover: { opacity: 0.85 },
}));
