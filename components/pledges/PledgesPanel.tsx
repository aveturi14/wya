import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import ListSection from '@/components/ui/ListSection';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { formatMoney, isOpen, Obligation, reasonLabel, statusStyle } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { Text, View } from 'react-native';

/** Host only: who owes for this event, and what to do about each. */
export default function PledgesPanel({ eventId, obligations, onChange }: { eventId: string; obligations: Obligation[]; onChange: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  if (obligations.length === 0) return null;

  const call = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(fn, args);
    if (error) { showAlert('Something went wrong', error.message); return; }
    onChange();
  };
  const anyOpen = obligations.some(isOpen);
  const letEveryoneOff = anyOpen && obligations.length > 1 && (
    <Button
      title="Let everyone off"
      variant="ghost"
      size="sm"
      onPress={async () => {
        if (await confirmAction('Let everyone off?', 'Nobody will owe you anything for this event.', 'Let everyone off')) call('waive_all', { p_event_id: eventId });
      }}
      style={{ alignSelf: 'flex-start' }}
    />
  );
  // What needs the host's attention first, settled ones last
  const sorted = [...obligations].sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  return (
    <ListSection title="Pledges" defaultOpen subtitle={summary(obligations)} footer={letEveryoneOff} contentStyle={{ gap: Space.md }}>
      {sorted.map((o, i) => {
        const name = o.other_name?.split(' ')[0] ?? 'Someone';
        const s = statusStyle(o.status, theme);
        return (
          <View key={o.id} style={[styles.item, i > 0 && styles.divider]}>
            <View style={styles.itemTop}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={theme.type.value}>{name} · {formatMoney(o.amount_cents)}</Text>
                <Text style={theme.type.caption}>{reasonLabel(o.reason)} · ref {o.reference.replace('-', '\u2011')}</Text>
              </View>
              <Chip label={s.label} color={s.fg} />
            </View>

            {o.status === 'excuse_pending' && (
              <View style={styles.excuse}>
                <Text style={[theme.type.accent, { fontSize: 18, lineHeight: 23 }]}>"{o.excuse}"</Text>
                <View style={styles.actions}>
                  <Button title="Let them off" size="sm" onPress={() => call('resolve_excuse', { p_obligation_id: o.id, p_accept: true })} />
                  <Button title="Decline" variant="soft" size="sm" onPress={() => call('resolve_excuse', { p_obligation_id: o.id, p_accept: false })} />
                </View>
              </View>
            )}
            {/* A wallet payment is on the ledger, so there's nothing to dispute */}
            {o.status === 'paid' && o.paid_via !== 'wallet' && (
              <View style={styles.actions}>
                <Button
                  title="Didn't get it"
                  variant="ghost"
                  size="sm"
                  onPress={async () => {
                    if (await confirmAction('Payment not received?', `${name} will be asked to check their transfer, and will owe you again.`, "Didn't get it")) {
                      call('dispute_payment', { p_obligation_id: o.id });
                    }
                  }}
                />
              </View>
            )}
            {(o.status === 'owed' || o.status === 'disputed') && (
              <View style={styles.actions}>
                <Button title="Let them off" variant="ghost" size="sm" onPress={() => call('waive_obligation', { p_obligation_id: o.id })} />
              </View>
            )}
          </View>
        );
      })}
    </ListSection>
  );
}

// "10 flaked · 4 to settle · 3 paid", so the host gets the picture without scrolling
function summary(obligations: Obligation[]) {
  const open = obligations.filter(isOpen).length;
  const paid = obligations.filter((o) => o.status === 'paid').length;
  return [`${obligations.length} flaked`, open && `${open} to settle`, paid && `${paid} paid`].filter(Boolean).join(' · ');
}

const ORDER: Record<Obligation['status'], number> = { excuse_pending: 0, disputed: 1, owed: 2, paid: 3, waived: 4 };

const useStyles = makeStyles((t) => ({
  item: { gap: Space.sm, paddingTop: Space.sm },
  divider: { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: Space.md },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  excuse: { gap: Space.sm, padding: Space.md, borderRadius: Radius.md, backgroundColor: t.colors.surfaceAlt },
  actions: { flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' },
}));
