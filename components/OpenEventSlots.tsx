import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PressableScale from '@/components/ui/PressableScale';
import Sticker from '@/components/ui/Sticker';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

type Answer = 'yes' | 'maybe' | 'no';
type Slot = {
  slot_id: string; starts_at: string; ends_at: string | null; label: string | null;
  yes: number; maybe: number; no: number; rank: number; answers: { user_id: string; answer: Answer }[];
};

/**
 * "Find a time" on an open event (8.7): every candidate time with ✓ / ? / ✕
 * counts, your own answer, and who can make it. The best time (most yes, then
 * most maybe, then earliest) is marked. The host locks one in; that makes the
 * event fixed and tells everyone "It's on".
 */
export default function OpenEventSlots({ eventId, isHost, myId, nameOf, onLocked }: {
  eventId: string;
  isHost: boolean;
  myId: string | undefined;
  nameOf: (userId: string | null) => string | null;
  onLocked: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_slot_summary', { p_event_id: eventId });
    setSlots((data ?? []) as Slot[]);
  }, [eventId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const answer = async (slot: Slot, value: Answer) => {
    setBusy(slot.slot_id);
    haptics.select();
    const { error } = await supabase.rpc('set_availability', { p_event_id: eventId, p_answers: { [slot.slot_id]: value } });
    setBusy(null);
    if (error) { showAlert('Could not save', error.message); return; }
    load();
  };

  const lock = async (slot: Slot) => {
    const when = format(new Date(slot.starts_at), 'EEE d MMM, h:mm a');
    const ok = await confirmAction('Lock in this time?', `${when}. Everyone hears it's on and gets asked whether they're in.`, 'Lock it in');
    if (!ok) return;
    const { error } = await supabase.rpc('lock_event', { p_event_id: eventId, p_slot_id: slot.slot_id });
    if (error) { showAlert('Could not lock it in', error.message); return; }
    haptics.success();
    onLocked();
  };

  if (!slots) return null;
  const answered = new Set(slots.flatMap((s) => s.answers.map((a) => a.user_id))).size;
  const options: { value: Answer; label: string; color: string }[] = [
    { value: 'yes', label: '✓', color: c.success },
    { value: 'maybe', label: '?', color: c.warning },
    { value: 'no', label: '✕', color: c.danger },
  ];

  return (
    <Card style={{ gap: Space.md }}>
      <View style={{ gap: 4 }}>
        <Text style={theme.type.heading}>Find a time</Text>
        <Text style={theme.type.bodySecondary}>
          {isHost
            ? `${answered} ${answered === 1 ? 'person has' : 'people have'} answered. Lock in a time when you're ready.`
            : 'Mark every time you could make. The host picks one.'}
        </Text>
      </View>
      {slots.length === 0 && <Text style={theme.type.caption}>No times yet.</Text>}
      {slots.map((s) => {
        const mine = s.answers.find((a) => a.user_id === myId)?.answer;
        const best = s.rank === 1 && s.yes > 0;
        const coming = s.answers.filter((a) => a.answer === 'yes').map((a) => (a.user_id === myId ? 'You' : nameOf(a.user_id) ?? 'Someone'));
        return (
          <View key={s.slot_id} style={[styles.slot, best && styles.best]}>
            <View style={styles.slotTop}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[theme.type.value, { fontFamily: Fonts.bodyBold }]}>{format(new Date(s.starts_at), 'EEE d MMM · h:mm a')}</Text>
                {s.label && <Text style={theme.type.caption}>{s.label}</Text>}
              </View>
              {best && <Sticker label="Best so far" bg={c.primary} fg={c.onPrimary} />}
            </View>
            <Text style={theme.type.caption}>
              ✓ {s.yes} · ? {s.maybe} · ✕ {s.no}{coming.length > 0 ? `  ·  ${coming.slice(0, 4).join(', ')}${coming.length > 4 ? ` + ${coming.length - 4}` : ''}` : ''}
            </Text>
            <View style={styles.actions}>
              {options.map((o) => {
                const on = mine === o.value;
                return (
                  <PressableScale
                    key={o.value}
                    haptic={false}
                    disabled={busy === s.slot_id}
                    onPress={() => answer(s, o.value)}
                    style={[styles.answer, on && { backgroundColor: o.color, borderColor: o.color }]}
                    accessibilityLabel={`${o.value === 'yes' ? 'Can make it' : o.value === 'maybe' ? 'Maybe' : "Can't make it"}: ${format(new Date(s.starts_at), 'EEE d MMM h:mm a')}`}
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.answerText, on && { color: c.onStatus }]}>{o.label}</Text>
                  </PressableScale>
                );
              })}
              {isHost && <Button title="Lock it in" size="sm" variant={best ? 'primary' : 'outline'} onPress={() => lock(s)} style={{ marginLeft: 'auto' }} />}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  slot: { gap: Space.sm, padding: Space.md, borderRadius: Radius.md, borderWidth: 1, borderColor: t.colors.border },
  best: { borderColor: t.colors.primary, backgroundColor: t.colors.surfaceAlt },
  slotTop: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  answer: {
    width: 40, height: 34, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center',
    borderWidth: t.outlineWidth, borderColor: t.colors.outline, backgroundColor: t.colors.surface,
  },
  answerText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: t.colors.text },
}));
