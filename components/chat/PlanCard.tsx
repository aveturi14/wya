import Button from '@/components/ui/Button';
import PressableScale from '@/components/ui/PressableScale';
import TextField from '@/components/ui/TextField';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { ChatMessage } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

type Item = {
  id: string; item_order: number; title: string; duration_minutes: number; fixed_start: string | null;
  starts_at: string; ends_at: string; conflict: boolean; created_by: string;
};

const time = (iso: string) => format(new Date(iso), 'h:mm a');

/**
 * The event's plan in the chat (8.9): things back to back from the start, any
 * fixed times kept, clashes called out ("Dinner now ends 9:45, the movie
 * starts 9:30"). Anyone in the chat adds things or says one's running late; the
 * person who added an item, or the host, can remove it. Reads get_plan live, so
 * every plan card in a chat shows the same, current plan.
 */
export default function PlanCard({ message, eventId, myId, isHost, version }: {
  message: ChatMessage; eventId: string; myId: string | undefined; isHost: boolean; version: number;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  const [items, setItems] = useState<Item[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('60');

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_plan', { p_event_id: eventId });
    setItems((data ?? []) as Item[]);
  }, [eventId]);
  useEffect(() => { load(); }, [load, version]);

  const call = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(fn, args);
    if (error) { showAlert('Could not update the plan', error.message); return false; }
    load();
    return true;
  };

  const add = async () => {
    const mins = Number(minutes);
    if (!title.trim() || !Number.isInteger(mins)) return;
    if (await call('add_plan_item', { p_event_id: eventId, p_title: title, p_duration_minutes: mins })) {
      setTitle('');
      setAdding(false);
    }
  };

  const remove = async (item: Item) => {
    if (await confirmAction('Remove from the plan?', item.title, 'Remove', true)) call('remove_plan_item', { p_item_id: item.id });
  };

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="map-outline" size={14} color={c.textSecondary} />
          <Text style={[theme.type.caption, { flex: 1 }]}>The plan · {format(new Date(message.created_at), 'h:mm a')}</Text>
        </View>
        {items && items.length === 0 && <Text style={theme.type.bodySecondary}>Nothing planned yet. Add the first thing.</Text>}
        {items?.map((item, i) => {
          const before = items[i - 1];
          const canRemove = item.created_by === myId || isHost;
          return (
            <View key={item.id} style={[styles.item, item.conflict && styles.clash]}>
              <View style={styles.itemTop}>
                <Text style={styles.time}>{time(item.starts_at)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={theme.type.value} numberOfLines={1}>
                    {item.title}{item.fixed_start ? '  ·  fixed' : ''}
                  </Text>
                  <Text style={theme.type.caption}>until {time(item.ends_at)}</Text>
                </View>
                {canRemove && (
                  <PressableScale onPress={() => remove(item)} hitSlop={8} accessibilityLabel={`Remove ${item.title}`}>
                    <Ionicons name="close" size={16} color={c.textMuted} />
                  </PressableScale>
                )}
              </View>
              {item.conflict && before && (
                <Text style={[theme.type.caption, { color: c.danger }]}>
                  {before.title} now ends {time(before.ends_at)}, {item.title} starts {time(item.starts_at)}
                </Text>
              )}
              <View style={styles.lateRow}>
                <Text style={theme.type.caption}>Running late?</Text>
                {[15, 30].map((m) => (
                  <PressableScale key={m} onPress={() => call('delay_plan_item', { p_item_id: item.id, p_minutes: m })} style={styles.late} accessibilityLabel={`${item.title} is running ${m} minutes late`}>
                    <Text style={styles.lateText}>+{m}m</Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          );
        })}
        {adding ? (
          <View style={{ gap: Space.sm }}>
            <TextField value={title} onChangeText={setTitle} placeholder="Dinner, movie, drinks…" />
            <View style={styles.addRow}>
              <View style={{ width: 110 }}><TextField value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="Minutes" /></View>
              <Text style={theme.type.caption}>minutes</Text>
              <View style={{ flex: 1 }} />
              <Button title="Cancel" size="sm" variant="ghost" onPress={() => setAdding(false)} />
              <Button title="Add" size="sm" disabled={!title.trim()} onPress={add} />
            </View>
          </View>
        ) : (
          (items?.length ?? 0) < 8 && <Button title="Add to the plan" icon="add" size="sm" variant="outline" onPress={() => setAdding(true)} style={{ alignSelf: 'flex-start' }} />
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
  item: { gap: 4, padding: Space.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: t.colors.border },
  clash: { borderColor: t.colors.danger },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  time: { fontFamily: Fonts.bodyBold, fontSize: 13, color: t.colors.text, width: 64, fontVariant: ['tabular-nums'] },
  lateRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginLeft: 64 + Space.md },
  late: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: t.colors.surfaceAlt },
  lateText: { fontFamily: Fonts.bodyMedium, fontSize: 11.5, color: t.colors.text },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
}));
