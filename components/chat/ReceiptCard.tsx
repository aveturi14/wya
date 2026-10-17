import SplitPeople from '@/components/chat/SplitPeople';
import Button from '@/components/ui/Button';
import Sticker from '@/components/ui/Sticker';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { billMoney, firstName, getReceipt, Receipt } from '@/lib/receipts';
import { ChatMessage } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

/**
 * A bill in the event chat (Phase 8.18). While people are claiming it shows how
 * far along it is and one button for you ("Pick what you had", "Confirm");
 * once locked it shows each share with Paid / Owes, like a split card.
 * Everything happens on the receipt page; the card is the way in.
 */
export default function ReceiptCard({ message, myId, version }: { message: ChatMessage; myId: string | undefined; version: number }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const c = theme.colors;
  const receiptId: string | undefined = message.data?.receipt_id;
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const load = useCallback(async () => {
    if (receiptId) setReceipt(await getReceipt(receiptId).catch(() => null));
  }, [receiptId]);
  // The card's data changes when the bill is edited, locked or cancelled
  const stamp = JSON.stringify(message.data ?? {});
  useEffect(() => { load(); }, [load, version, stamp]);

  const isPayer = message.user_id === myId;
  const cancelled = !!message.data?.cancelled || receipt?.status === 'cancelled';
  const locked = !cancelled && (receipt?.status === 'locked' || !!message.data?.locked);
  const total = receipt?.total_cents ?? message.data?.total_cents ?? 0;
  const open = () => router.push(`/receipt/${receiptId}`);

  const me = receipt?.people.find((p) => p.user_id === myId);
  const confirmedCount = receipt?.people.filter((p) => !p.is_payer && p.claimed && p.confirmed).length ?? 0;
  const claimers = receipt?.people.filter((p) => !p.is_payer && p.claimed).length ?? 0;
  const myDebt = receipt?.split?.find((r) => r.user_id === myId && r.obligation_id);

  let status = '';
  let action: { title: string; onPress: () => void; icon?: 'wallet-outline' | 'checkbox-outline' | 'lock-closed' } | null = null;
  if (cancelled) {
    status = 'Cancelled';
  } else if (locked) {
    status = 'Itemised · locked';
    if (myDebt && (myDebt.status === 'owed' || myDebt.status === 'disputed')) {
      action = { title: `Pay ${firstName(receipt?.payer_name)} ${billMoney(myDebt.share_cents)}`, icon: 'wallet-outline', onPress: () => router.push(`/pay/${myDebt.obligation_id}`) };
    }
  } else if (receipt) {
    status = `${billMoney(receipt.claimed_cents)} of ${billMoney(receipt.items_cents)} claimed · ${confirmedCount} of ${claimers} confirmed`;
    if (isPayer) action = { title: receipt.blockers.length ? 'Open the bill' : 'Lock the split', icon: 'lock-closed', onPress: open };
    else if (!me?.claimed) action = { title: 'Pick what you had', icon: 'checkbox-outline', onPress: open };
    else if (!me.confirmed) action = { title: `Confirm ${billMoney(me.share_cents)}`, icon: 'checkbox-outline', onPress: open };
  }

  return (
    <View style={[styles.row, isPayer && { justifyContent: 'flex-end' }]}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="receipt-outline" size={14} color={c.textSecondary} />
          <Text style={[theme.type.caption, { flex: 1 }]}>
            {isPayer ? 'You' : firstName(receipt?.payer_name ?? message.profile?.full_name)} shared the bill · {format(new Date(message.created_at), 'h:mm a')}
          </Text>
          {cancelled && <Sticker label="Cancelled" />}
          {message.data?.edited_at && !cancelled && <Text style={theme.type.caption}>Edited</Text>}
        </View>
        <Text style={theme.type.cardTitle}>{message.data?.description ?? 'The bill'} · {billMoney(total)}</Text>
        {!!status && <Text style={theme.type.bodySecondary}>{status}</Text>}

        {locked && receipt?.split && <SplitPeople rows={receipt.split} myId={myId} />}
        {!receipt && !cancelled && <Text style={theme.type.caption}>For the people who came.</Text>}

        {action && <Button title={action.title} icon={action.icon} onPress={action.onPress} />}
        {!cancelled && receipt && (
          <Button title={locked ? 'See who had what' : 'Open the bill'} size="sm" variant="ghost" onPress={open} style={{ alignSelf: 'flex-start' }} />
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  // Same side padding as chat bubbles (msgRow in app/event/[id].tsx)
  row: { flexDirection: 'row', paddingHorizontal: Space.lg },
  card: {
    width: '86%', maxWidth: 420, gap: Space.sm, padding: Space.md, borderRadius: Radius.lg,
    backgroundColor: t.colors.surface, borderWidth: t.outlineWidth, borderColor: t.colors.outline, ...t.shadow(3),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
}));
