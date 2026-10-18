import { ReceiptSummary } from '@/components/chat/ReceiptCard';
import PaySheet, { payTargetFromObligation } from '@/components/wallet/PaySheet';
import DuesPanel from '@/components/dues/DuesPanel';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { Fonts, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { formatMoney, isOpen, Obligation } from '@/lib/pledges';
import { useDues } from '@/lib/dues';
import { friendlyError } from '@/lib/errors';
import { billMoney } from '@/lib/receipts';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';

type BillRow = { id: string; payer_id: string; description: string; total_cents: number; status: string; created_at: string; split_id: string | null; updated_at: string };
type SplitRow = { id: string; payer_id: string; description: string; total_cents: number; status: string; created_at: string };

/**
 * The event's Bills tab (Phase 8.18), kept out of the chat so the chat stays for
 * talking. Top to bottom: your dues for this event (who you owe, who owes you,
 * and why), "Paid the bill?" to start one (photo, or type it), then every bill.
 * Itemised bills open the receipt page; even splits (/split 120) show what you owe.
 */
export default function BillsTab({ eventId, myId, canStart, onStart, starting, obligations, version, onPaid }: {
  eventId: string;
  myId: string | undefined;
  // Anyone on the event (host or guest, not waiting to be let in), any time
  canStart: boolean;
  onStart: (how: 'camera' | 'library' | 'manual') => void;
  starting: boolean;
  obligations: Obligation[];
  version: number;
  // Something was paid: the page reloads its debts
  onPaid?: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [bills, setBills] = useState<BillRow[] | null>(null);
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const { dues, reload: reloadDues } = useDues(eventId, version);
  const [payingSplit, setPayingSplit] = useState<Obligation | null>(null);

  const load = useCallback(async () => {
    const [{ data: b, error: billsError }, { data: s, error: splitsError }] = await Promise.all([
      supabase.from('receipts').select('id, payer_id, description, total_cents, status, created_at, split_id, updated_at')
        .eq('event_id', eventId).order('created_at', { ascending: false }),
      supabase.from('split_bills').select('id, payer_id, description, total_cents, status, created_at')
        .eq('event_id', eventId).order('created_at', { ascending: false }),
    ]);
    if (billsError || splitsError) { setLoadError(billsError ?? splitsError); setBills((x) => x ?? []); return; }
    setLoadError(null);
    const rows = (b ?? []) as BillRow[];
    setBills(rows);
    // A locked bill is also a split underneath; show it once, as the bill
    const fromBills = new Set(rows.map((r) => r.split_id).filter(Boolean));
    setSplits(((s ?? []) as SplitRow[]).filter((x) => !fromBills.has(x.id)));
  }, [eventId]);
  useEffect(() => { load(); }, [load, version]);

  const start = (
    <Card style={styles.start}>
      <View style={{ gap: 2 }}>
        <Text style={theme.type.cardTitle}>Add a bill</Text>
        <Text style={theme.type.caption}>Paid for something? Add the receipt or type it out. Everyone ticks what they had, then pays you back.</Text>
      </View>
      <View style={styles.buttons}>
        {Platform.OS === 'web'
          ? <Button title="Upload receipt" icon="image-outline" style={styles.choice} onPress={() => onStart('library')} loading={starting} />
          : <Button title="Scan receipt" icon="camera-outline" style={styles.choice} onPress={() => onStart('camera')} loading={starting} />}
        <Button title="Type it in" icon="create-outline" variant="soft" style={styles.choice} onPress={() => onStart('manual')} />
      </View>
      {Platform.OS !== 'web' && <Button title="Use a photo you took" icon="image-outline" variant="ghost" size="sm" onPress={() => onStart('library')} style={{ alignSelf: 'flex-start' }} />}
      <Text style={theme.type.caption}>Or type it in the chat: <Text style={{ fontFamily: Fonts.monoRegular }}>/bill pizza 24, 2 beers 26, service 10%</Text></Text>
    </Card>
  );

  if (bills == null) return <View style={styles.loading}><ActivityIndicator color={theme.colors.textSecondary} /></View>;

  const empty = bills.length === 0 && splits.length === 0 && !loadError;
  return (
    <View style={styles.wrap}>
      {!!loadError && (
        <Card style={{ gap: Space.sm }}>
          <Text style={[theme.type.value, { color: theme.colors.dangerText }]}>Couldn't load the bills</Text>
          <Text style={theme.type.caption}>{friendlyError(loadError)}</Text>
          <Button title="Try again" icon="refresh" variant="soft" size="sm" onPress={load} style={{ alignSelf: 'flex-start' }} />
        </Card>
      )}
      {/* First thing in the tab: anyone on the event can add a bill, before, during or after */}
      {canStart && start}

      {dues && dues.length > 0 && (
        <View style={{ gap: Space.sm }}>
          <View style={styles.duesHead}>
            <Text style={theme.type.label}>Your dues here</Text>
            <Button title="All your dues" size="sm" variant="ghost" onPress={() => router.push('/dues')} />
          </View>
          <DuesPanel dues={dues} scoped onPaid={() => { reloadDues(); load(); onPaid?.(); }} />
        </View>
      )}

      {empty && (
        <EmptyState icon="receipt-outline" title="No bills yet" body="Bills for this event show up here, away from the chat." />
      )}

      {!empty && <Text style={theme.type.label}>Bills</Text>}
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
              <Button title={`Pay ${mine.other_name?.split(' ')[0] ?? 'them'} ${formatMoney(mine.amount_cents)}`} icon="wallet-outline" onPress={() => setPayingSplit(mine)} />
            ) : mine ? (
              <Text style={theme.type.bodySecondary}>{mine.status === 'paid' ? `You paid your share${mine.paid_via === 'wallet' ? ' from your wallet' : ''}` : 'Nothing to pay'}</Text>
            ) : null}
          </Card>
        );
      })}

      <PaySheet target={payingSplit ? payTargetFromObligation(payingSplit) : null} onClose={() => setPayingSplit(null)} onPaid={() => { reloadDues(); load(); onPaid?.(); }} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: Space.lg },
  loading: { paddingVertical: Space.xxl, alignItems: 'center' },
  start: { gap: Space.md },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, alignItems: 'center' },
  choice: { flexGrow: 1, flexBasis: 160 },
  split: { gap: Space.xs },
  duesHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
}));
