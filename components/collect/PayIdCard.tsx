import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Money from '@/components/ui/Money';
import PressableScale from '@/components/ui/PressableScale';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/lib/alert';
import { friendlyError } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { getProvider, ProviderId } from '@/lib/payments';
import { formatMoney, Obligation } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

type Instructions = { host_name: string | null; provider: ProviderId | null; payid: string | null; reference: string };

/**
 * "Pay Hannah $60" for a collection share (stage 1.1): PayID only, straight to the
 * organiser, then "I've paid". Never the wallet (C-5). The PayID comes from
 * get_payment_instructions, which only answers the payer, and only while they owe.
 */
export default function PayIdCard({ obligation, onChange }: { obligation: Obligation; onChange: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [info, setInfo] = useState<Instructions | null>(null);
  const [busy, setBusy] = useState(false);
  const who = obligation.other_name?.split(' ')[0] ?? 'the organiser';
  const amount = formatMoney(obligation.amount_cents);

  useEffect(() => {
    supabase.rpc('get_payment_instructions', { p_obligation_id: obligation.id }).then(({ data }) => setInfo(data?.[0] ?? null));
  }, [obligation.id, obligation.status]);

  const provider = getProvider(info?.provider ?? undefined);

  const claim = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('claim_paid', { p_obligation_id: obligation.id });
    setBusy(false);
    if (error) { showAlert("Couldn't save that", friendlyError(error)); return; }
    haptics.success();
    onChange();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.amount}>
        <Text style={theme.type.label}>Pay {who}</Text>
        <Money cents={obligation.amount_cents} size={40} />
        <Text style={[theme.type.caption, { textAlign: 'center' }]}>
          {obligation.status === 'disputed'
            ? `${who} hasn't received your payment for ${obligation.description ?? obligation.event_title}. Check the transfer went through.`
            // A standalone collection's (hidden) event has the collection's own title: don't say it twice
            : `Your share of ${obligation.description ?? 'the collection'}${obligation.description && obligation.description !== obligation.event_title ? ` for ${obligation.event_title}` : ''}, paid straight to ${who}.`}
        </Text>
      </View>

      {info?.payid ? (
        <>
          <CopyRow label={`${who}'s ${provider.label}`} value={provider.format(info.payid)} copyValue={info.payid} />
          <CopyRow label="Description" value={info.reference} />
          {/* Bank apps ask for these one at a time; this puts them all on the clipboard */}
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
            {provider.instructions({ amount, reference: info.reference, hostName: who }).map((line, i) => (
              <Text key={i} style={theme.type.caption}>{i + 1}. {line}</Text>
            ))}
          </View>
          {/* Scam check (1.1b): the name the bank shows has to be the organiser's */}
          <View style={styles.check}>
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.text} style={{ marginTop: 1 }} />
            <Text style={[theme.type.caption, { flex: 1 }]}>
              Check your bank shows <Text style={styles.strong}>{obligation.other_name ?? who}</Text> before you send. If it doesn't, don't pay.
            </Text>
          </View>
        </>
      ) : (
        <Text style={theme.type.bodySecondary}>Ask {who} for their PayID.</Text>
      )}

      <Button title="I've paid" icon="checkmark" loading={busy} onPress={claim} />
      <Text style={[theme.type.caption, { textAlign: 'center' }]}>
        wya doesn't hold the money. {who} confirms it arrived, and it counts once they do.
      </Text>
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
  copyRow: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md, borderRadius: Radius.md,
    backgroundColor: t.colors.surfaceAlt,
  },
  copyHover: { opacity: 0.85 },
  check: { flexDirection: 'row', gap: Space.sm, padding: Space.md, borderRadius: Radius.md, borderWidth: 1, borderColor: t.colors.border },
  strong: { color: t.colors.text, fontFamily: Fonts.bodySemiBold },
}));
