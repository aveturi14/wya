import { ReceiptSummary } from '@/components/chat/ReceiptCard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { formatMoney, isOpen, Obligation } from '@/lib/pledges';
import { billMoney } from '@/lib/receipts';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';

type BillRow = { id: string; payer_id: string; description: string; total_cents: number; status: string; created_at: string; split_id: string | null; updated_at: string };
type SplitRow = { id: string; payer_id: string; description: string; total_cents: number; status: string; created_at: string };

/**
 * The event's Bills tab (Phase 8.18): start a bill, and every bill you're part
 * of, newest first. Kept out of the chat so the chat stays for talking.
 * Itemised bills open the receipt page; even splits (/split 120) show what you owe.
 */
export default function BillsTab({ eventId, myId, canStart, notStartedYet, onStart, starting, obligations, version }: {
  eventId: string;
  myId: string | undefined;
  // Going (host, or I'm in and not marked absent) and the event has started
  canStart: boolean;
  notStartedYet: boolean;
  onStart: (how: 'camera' | 'library' | 'manual') => void;
  starting: boolean;
  obligations: Obligation[];
  version: number;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [bills, setBills] = useState<BillRow[] | null>(null);
  const [splits, setSplits] = useState<SplitRow[]>([]);

  const load = useCallback(async () => {
    const [{ data: b }, { data: s }] = await Promise.all([
      supabase.from('receipts').select('id, payer_id, description, total_cents, status, created_at, split_id, updated_at')
        .eq('event_id', eventId).order('created_at', { ascending: false }),
      supabase.from('split_bills').select('id, payer_id, description, total_cents, status, created_at')
        .eq('event_id', eventId).order('created_at', { ascending: false }),
    ]);
    const rows = (b ?? []) as BillRow[];
    setBills(rows);
    // A locked bill is also a split underneath; show it once, as the bill
    const fromBills = new Set(rows.map((r) => r.split_id).filter(Boolean));
    setSplits(((s ?? []) as SplitRow[]).filter((x) => !fromBills.has(x.id)));
  }, [eventId]);
  useEffect(() => { load(); }, [load, version]);

  const start = (
    <Card style={styles.start}>
      <View style={styles.startTop}>
        <View style={styles.icon}><Ionicons name="receipt-outline" size={20} color={theme.colors.onPrimary} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={theme.type.cardTitle}>Paid the bill?</Text>
          <Text style={theme.type.caption}>Snap the receipt. Everyone who came ticks what they had, then pays you back.</Text>
        </View>
      </View>
      <View style={styles.buttons}>
        {Platform.OS !== 'web' && <Button title="Scan receipt" icon="camera-outline" onPress={() => onStart('camera')} loading={starting} />}
        <Button
          title={Platform.OS === 'web' ? 'Upload receipt' : 'From photos'}
          icon="image-outline"
          variant={Platform.OS === 'web' ? 'primary' : 'outline'}
          onPress={() => onStart('library')}
          loading={Platform.OS === 'web' && starting}
        />
        <Button title="Type it in" variant="ghost" onPress={() => onStart('manual')} />
      </View>
    </Card>
  );

  if (bills == null) return <View style={styles.loading}><ActivityIndicator color={theme.colors.primary} /></View>;

  const empty = bills.length === 0 && splits.length === 0;
  return (
    <View style={styles.wrap}>
      {canStart ? start : notStartedYet && (
        <Text style={theme.type.caption}>Once it starts, whoever paid can split the bill here.</Text>
      )}

      {empty && (
        <EmptyState icon="receipt-outline" title="No bills yet" body="Bills for this event show up here, away from the chat." />
      )}

      {bills.map((b) => (
        <ReceiptSummary
          key={b.id}
          myId={myId}
          version={version}
          bill={{
            receiptId: b.id, payerId: b.payer_id, description: b.description, totalCents: b.total_cents, createdAt: b.created_at,
            cancelled: b.status === 'cancelled', locked: b.status === 'locked',
          }}
        />
      ))}

      {splits.map((s) => {
        const mine = obligations.find((o) => o.kind === 'split' && o.split_id === s.id && o.role === 'guest');
        const owedToMe = obligations.filter((o) => o.kind === 'split' && o.split_id === s.id && o.role === 'host' && isOpen(o));
        return (
          <Card key={s.id} style={styles.split}>
            <Text style={theme.type.caption}>Split evenly{s.status === 'cancelled' ? ' · cancelled' : ''}</Text>
            <Text style={theme.type.cardTitle}>{s.description} · {billMoney(s.total_cents)}</Text>
            {s.payer_id === myId ? (
              <Text style={theme.type.bodySecondary}>
                {owedToMe.length === 0 ? 'Everyone has settled up.' : `${owedToMe.length} still to pay you ${formatMoney(owedToMe.reduce((t, o) => t + o.amount_cents, 0))}`}
              </Text>
            ) : mine && isOpen(mine) && s.status !== 'cancelled' ? (
              <Button title={`Pay ${mine.other_name?.split(' ')[0] ?? 'them'} ${formatMoney(mine.amount_cents)}`} icon="wallet-outline" onPress={() => router.push(`/pay/${mine.id}`)} />
            ) : mine ? (
              <Text style={theme.type.bodySecondary}>{mine.status === 'paid' ? 'You paid your share' : 'Nothing to pay'}</Text>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: Space.lg },
  loading: { paddingVertical: Space.xxl, alignItems: 'center' },
  start: { gap: Space.md },
  startTop: { flexDirection: 'row', gap: Space.md, alignItems: 'center' },
  icon: {
    width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: t.colors.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: t.outlineWidth, borderColor: t.colors.outline,
  },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, alignItems: 'center' },
  split: { gap: Space.xs },
}));
