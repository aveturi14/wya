import SplitPeople from '@/components/chat/SplitPeople';
import Chip from '@/components/ui/Chip';
import Button from '@/components/ui/Button';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { formatMoney } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { ChatMessage } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

type Row = {
  user_id: string; name: string | null; share_cents: number; status: string; is_payer: boolean;
  obligation_id: string | null; description: string; total_cents: number; split_status: string;
};

/**
 * A split in the event chat (Phase 8.3): who paid, each person's share and
 * whether they've paid. Only the payer and the people in it see the rows
 * (get_split); everyone else in the chat sees just the headline. Whoever owes
 * gets "Pay Gary $40" (the pay page); the payer can say they didn't get it, or cancel.
 */
export default function SplitCard({ message, myId, version }: { message: ChatMessage; myId: string | undefined; version: number }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const c = theme.colors;
  const [rows, setRows] = useState<Row[] | null>(null);
  const splitId: string | undefined = message.data?.split_id;

  const load = useCallback(async () => {
    if (!splitId) return;
    const { data } = await supabase.rpc('get_split', { p_split_id: splitId });
    setRows((data ?? []) as Row[]);
  }, [splitId]);
  const cancelledOnMessage = !!message.data?.cancelled;
  useEffect(() => { load(); }, [load, version, cancelledOnMessage]);

  const payer = rows?.find((r) => r.is_payer);
  const isPayer = message.user_id === myId;
  const mine = rows?.find((r) => r.user_id === myId && !r.is_payer);
  const cancelled = cancelledOnMessage || rows?.[0]?.split_status === 'cancelled';
  const total = message.data?.total_cents ?? rows?.[0]?.total_cents ?? 0;
  const people = message.data?.people ?? rows?.length ?? 0;
  const payerName = isPayer ? 'You' : payer?.name?.split(' ')[0] ?? 'Someone';

  const dispute = async (r: Row) => {
    const ok = await confirmAction('Didn\'t get it?', `${r.name?.split(' ')[0] ?? 'They'}'ll be told the payment hasn't arrived.`, "Didn't get it");
    if (!ok) return;
    // The payer can see the debt rows (owed to them), so look up the id directly
    const { data } = await supabase.from('obligations').select('id').eq('split_id', splitId!).eq('guest_id', r.user_id).maybeSingle();
    if (!data) return;
    const { error } = await supabase.rpc('dispute_payment', { p_obligation_id: data.id });
    if (error) showAlert('Could not update', error.message);
    load();
  };

  const cancel = async () => {
    const ok = await confirmAction('Cancel this split?', 'Anything still owed is let off. People who already paid you keep that between you.', 'Cancel split', true);
    if (!ok) return;
    const { error } = await supabase.rpc('cancel_split', { p_split_id: splitId });
    if (error) { showAlert('Could not cancel', error.message); return; }
    load();
  };

  return (
    <View style={[styles.row, isPayer && { justifyContent: 'flex-end' }]}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="receipt-outline" size={14} color={c.textSecondary} />
          <Text style={[theme.type.caption, { flex: 1 }]}>{payerName} split a bill · {format(new Date(message.created_at), 'h:mm a')}</Text>
          {cancelled && <Chip label="Cancelled" />}
        </View>
        <Text style={theme.type.cardTitle}>{message.data?.description ?? 'Shared cost'}</Text>
        <Text style={theme.type.bodySecondary}>
          {formatMoney(total)} · split {people} {people === 1 ? 'way' : 'ways'}
        </Text>

        {rows && rows.length > 0 ? (
          <SplitPeople rows={rows} myId={myId} onDispute={isPayer && !cancelled ? (r) => dispute(r as Row) : undefined} />
        ) : rows && (
          <Text style={theme.type.caption}>You're not in this one.</Text>
        )}

        {!cancelled && mine?.obligation_id && (mine.status === 'owed' || mine.status === 'disputed') && (
          <Button
            title={`Pay ${payer?.name?.split(' ')[0] ?? 'them'} ${formatMoney(mine.share_cents)}`}
            icon="wallet-outline"
            onPress={() => router.push(`/pay/${mine.obligation_id}`)}
          />
        )}
        {isPayer && !cancelled && <Button title="Cancel split" size="sm" variant="ghost" onPress={cancel} style={{ alignSelf: 'flex-start' }} />}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  // Same side padding as chat bubbles (msgRow in app/event/[id].tsx)
  row: { flexDirection: 'row', paddingHorizontal: Space.lg },
  card: {
    width: '86%', maxWidth: 420, gap: Space.sm, padding: Space.md, borderRadius: Radius.lg,
    backgroundColor: t.colors.surface, ...t.shadow(4),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
}));
