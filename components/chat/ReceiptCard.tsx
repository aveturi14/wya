import SplitPeople from '@/components/chat/SplitPeople';
import PaySheet, { payTargetFromReceipt } from '@/components/wallet/PaySheet';
import Chip from '@/components/ui/Chip';
import Button from '@/components/ui/Button';
import Money from '@/components/ui/Money';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { billMoney, firstName, getReceipt, Receipt } from '@/lib/receipts';
import { ChatMessage } from '@/lib/types';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

export type ReceiptHeadline = {
  receiptId: string;
  payerId: string;
  payerName?: string | null;
  description: string;
  totalCents: number;
  createdAt: string;
  cancelled?: boolean;
  locked?: boolean;
  edited?: boolean;
};

/**
 * One bill at a glance (Phase 8.18), in the event's Bills tab: how far along it
 * is and one button for you ("Pick what you had", "Confirm", "Pay Gary $39.60").
 * Once locked it shows each share with Paid / Owes. Everything else happens on
 * the receipt page.
 */
export function ReceiptSummary({ bill, myId, version, style }: { bill: ReceiptHeadline; myId: string | undefined; version: number; style?: object }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setReceipt(await getReceipt(bill.receiptId).catch(() => null));
  }, [bill.receiptId]);
  useEffect(() => { load(); }, [load, version, bill.locked, bill.cancelled, bill.totalCents]);

  const isPayer = bill.payerId === myId;
  const cancelled = !!bill.cancelled || receipt?.status === 'cancelled';
  const draft = receipt?.status === 'draft';
  const locked = !cancelled && (receipt?.status === 'locked' || !!bill.locked);
  const total = receipt?.total_cents ?? bill.totalCents;
  const open = () => router.push(`/receipt/${bill.receiptId}`);

  const me = receipt?.people.find((p) => p.user_id === myId);
  const confirmedCount = receipt?.people.filter((p) => !p.is_payer && p.claimed && p.confirmed).length ?? 0;
  const claimers = receipt?.people.filter((p) => !p.is_payer && p.claimed).length ?? 0;
  const myDebt = receipt?.split?.find((r) => r.user_id === myId && r.obligation_id);
  const payer = isPayer ? 'You' : firstName(receipt?.payer_name ?? bill.payerName);

  let status = '';
  let action: { title: string; onPress: () => void; icon?: 'wallet-outline' | 'checkbox-outline' | 'lock-closed' | 'create-outline' } | null = null;
  if (cancelled) {
    status = 'Cancelled';
  } else if (draft) {
    status = 'Draft · only you can see it';
    action = { title: 'Check the lines and send', icon: 'create-outline', onPress: open };
  } else if (locked) {
    status = 'Itemised · locked';
    if (myDebt && (myDebt.status === 'owed' || myDebt.status === 'disputed')) {
      action = { title: `Pay ${firstName(receipt?.payer_name)} ${billMoney(myDebt.share_cents)}`, icon: 'wallet-outline', onPress: () => setPaying(true) };
    }
  } else if (receipt) {
    status = `${billMoney(receipt.claimed_cents)} of ${billMoney(receipt.items_cents)} claimed · ${confirmedCount} of ${claimers} confirmed`;
    if (isPayer) action = { title: receipt.blockers.length ? 'Open the bill' : 'Lock the split', icon: 'lock-closed', onPress: open };
    else if (!me?.claimed) action = { title: 'Pick what you had', icon: 'checkbox-outline', onPress: open };
    else if (!me.confirmed) action = { title: `Confirm ${billMoney(me.share_cents)}`, icon: 'checkbox-outline', onPress: open };
  }

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={theme.type.cardTitle} numberOfLines={2}>{receipt?.description ?? bill.description}</Text>
          <Text style={theme.type.caption}>
            {payer} paid · {format(new Date(bill.createdAt), 'EEE h:mm a')}{bill.edited && !cancelled ? ' · edited' : ''}
          </Text>
        </View>
        {cancelled ? <Chip label="Cancelled" /> : <Money value={billMoney(total)} size={15} />}
      </View>
      {!!status && <Text style={theme.type.caption}>{status}</Text>}

      {locked && receipt?.split && <SplitPeople rows={receipt.split} myId={myId} />}

      {action && <Button title={action.title} icon={action.icon} onPress={action.onPress} />}
      {!cancelled && !draft && receipt && (
        <Button title={locked ? 'See who had what' : 'Open the bill'} size="sm" variant="ghost" onPress={open} style={{ alignSelf: 'flex-start' }} />
      )}
      <PaySheet target={paying && receipt ? payTargetFromReceipt(receipt, myId) : null} onClose={() => setPaying(false)} onPaid={() => load()} />
    </View>
  );
}

/** Bill cards posted in the chat before bills moved to their own tab still show up there. */
export default function ReceiptCard({ message, myId, version }: { message: ChatMessage; myId: string | undefined; version: number }) {
  const styles = useStyles();
  const isPayer = message.user_id === myId;
  if (!message.data?.receipt_id || !message.user_id) return null;
  return (
    <View style={[styles.row, isPayer && { justifyContent: 'flex-end' }]}>
      <ReceiptSummary
        myId={myId}
        version={version}
        style={styles.chatCard}
        bill={{
          receiptId: message.data.receipt_id, payerId: message.user_id, payerName: message.profile?.full_name,
          description: message.data.description ?? 'The bill', totalCents: message.data.total_cents ?? 0,
          createdAt: message.created_at, cancelled: !!message.data.cancelled, locked: !!message.data.locked, edited: !!message.data.edited_at,
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  // Same side padding as chat bubbles (msgRow in app/event/[id].tsx)
  row: { flexDirection: 'row', paddingHorizontal: Space.lg },
  card: { gap: Space.md, padding: Space.md + 2, borderRadius: Radius.lg, backgroundColor: t.colors.surface, ...t.shadow(4) },
  chatCard: { width: '86%', maxWidth: 420 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.sm },
}));
