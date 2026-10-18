import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Money from '@/components/ui/Money';
import PaySheet, { payTargetFromObligation } from '@/components/wallet/PaySheet';
import Sheet from '@/components/ui/Sheet';
import TextField from '@/components/ui/TextField';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { formatMoney, Obligation, reasonLabel } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

/** "You owe Hannah $5": pay it from your wya wallet, or (pledges only) send an excuse. Guest only. */
export default function PayCard({ obligation, onChange }: { obligation: Obligation; onChange: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [excusing, setExcusing] = useState(false);
  const [excuse, setExcuse] = useState('');
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const hostName = obligation.other_name?.split(' ')[0] ?? 'the host';
  const amount = formatMoney(obligation.amount_cents);
  const payable = obligation.status === 'owed' || obligation.status === 'disputed';


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

  return (
    <Card style={styles.card}>
      <View style={styles.amount}>
        <Text style={theme.type.label}>You owe {hostName}</Text>
        <Money cents={obligation.amount_cents} size={40} />
        <Text style={[theme.type.caption, { textAlign: 'center' }]}>
          {obligation.status === 'disputed'
            ? `${hostName} hasn't received an earlier payment for ${obligation.event_title}. Pay it from your wallet and it arrives straight away.`
            : obligation.kind === 'split'
              ? `Your share of ${obligation.description ?? 'a bill'} at ${obligation.event_title}.`
              : `For ${obligation.event_title}: you ${reasonLabel(obligation.reason)}.`}
        </Text>
      </View>

      {/* Paid from the wya wallet (9.13): one tap, the exact amount, straight to who it's owed to */}
      <Button title={`Pay ${hostName} ${amount} from your wallet`} icon="wallet-outline" onPress={() => setPaying(true)} />
      {!obligation.excuse && obligation.kind !== 'split' && (
        <Button title="I have an excuse" variant="line" onPress={() => setExcusing(true)} />
      )}
      {obligation.kind !== 'split' && (
        <Text style={[theme.type.caption, { textAlign: 'center' }]}>Until it's settled you can't RSVP to {hostName}'s events.</Text>
      )}
      {obligation.excuse_declined && <Text style={theme.type.caption}>{hostName} declined your excuse.</Text>}

      <PaySheet target={paying ? payTargetFromObligation(obligation) : null} onClose={() => setPaying(false)} onPaid={onChange} />

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
