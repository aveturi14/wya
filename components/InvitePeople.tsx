import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PressableScale from '@/components/ui/PressableScale';
import TextField from '@/components/ui/TextField';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { smsUrl, webUrl, whatsappUrl } from '@/lib/links';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Person = { user_id: string; full_name: string | null; avatar_url: string | null; events_together: number };
type Circle = { id: string; name: string; members: string[] };

const REASONS: Record<string, string> = {
  removed: 'removed from this event',
  unavailable: "can't be invited right now",
  not_connected: "hasn't been to an event with you",
  already_on: 'already on the event',
};

/**
 * "Invite your people" (8.8): pick from people you've been to events with (and
 * your circles), or hand a message to WhatsApp / your messages app. Every
 * invite is a proposal that runs only when you tap Invite; anything sent
 * outside wya is sent by you, from your phone.
 */
export default function InvitePeople({ eventId, existing }: { eventId: string; existing: string[] }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [circleName, setCircleName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: rows }, { data: cs }, { data: members }] = await Promise.all([
      supabase.rpc('get_recent_people', { p_limit: 60 }),
      supabase.from('circles').select('id, name').order('created_at'),
      supabase.from('circle_members').select('circle_id, user_id'),
    ]);
    setPeople(((rows ?? []) as Person[]).filter((p) => !existing.includes(p.user_id)));
    setCircles((cs ?? []).map((ci) => ({ ...ci, members: (members ?? []).filter((m) => m.circle_id === ci.id).map((m) => m.user_id) })));
  }, [existing]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const invite = async () => {
    setBusy(true);
    const { data: action, error } = await supabase.rpc('propose_action', {
      p_kind: 'invite_people', p_event_id: eventId, p_payload: { user_ids: [...picked] }, p_ttl_seconds: 600,
    });
    const run = error ? { data: null, error } : await supabase.rpc('approve_action', { p_action_id: action });
    setBusy(false);
    if (run.error) { showAlert('Could not invite', run.error.message); return; }
    const result = run.data as { invited: string[]; skipped: { user_id: string; reason: string }[] };
    const nameOf = (id: string) => people?.find((p) => p.user_id === id)?.full_name?.split(' ')[0] ?? 'Someone';
    haptics.success();
    showAlert(
      result.invited.length === 1 ? '1 person invited' : `${result.invited.length} people invited`,
      result.skipped.length ? result.skipped.map((s) => `${nameOf(s.user_id)}: ${REASONS[s.reason] ?? s.reason}`).join('\n') : "They'll see it in Activity.",
    );
    setPicked(new Set());
    setOpen(false);
  };

  const saveCircle = async () => {
    const { data: id, error } = await supabase.rpc('create_circle', { p_name: circleName });
    if (error) { showAlert('Could not save', error.message); return; }
    for (const member of picked) await supabase.rpc('add_circle_member', { p_circle_id: id, p_user_id: member });
    setCircleName('');
    load();
  };

  // WhatsApp or a text: wya prepares the message and link; the person chooses the chat and sends it
  const handOff = async (channel: 'whatsapp' | 'sms') => {
    const { data: action, error } = await supabase.rpc('propose_action', { p_kind: 'share_link', p_event_id: eventId, p_payload: { channel } });
    const run = error ? { data: null, error } : await supabase.rpc('approve_action', { p_action_id: action });
    if (run.error) { showAlert('Could not share', run.error.message); return; }
    const { text, url } = run.data as { text: string; url: string };
    const message = `${text}: ${webUrl(url)}`;
    try {
      await Linking.openURL(channel === 'whatsapp' ? whatsappUrl(message) : smsUrl(message));
      await supabase.rpc('mark_action_executed', { p_action_id: action });
    } catch {
      showAlert('Could not open it', channel === 'whatsapp' ? 'Is WhatsApp installed?' : 'This device has no messages app.');
    }
  };

  return (
    <Card style={{ gap: Space.md }}>
      <View style={{ gap: 4 }}>
        <Text style={theme.type.heading}>Invite your people</Text>
        <Text style={theme.type.bodySecondary}>Pick from people you've been to events with, or send the link yourself.</Text>
      </View>
      <View style={styles.buttons}>
        <Button title="From past events" icon="people-outline" size="sm" onPress={() => setOpen(true)} />
        <Button title="WhatsApp" icon="logo-whatsapp" size="sm" variant="outline" onPress={() => handOff('whatsapp')} />
        <Button title="Text" icon="chatbubble-outline" size="sm" variant="outline" onPress={() => handOff('sms')} />
      </View>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.sheet, { paddingTop: insets.top + Space.lg, paddingBottom: insets.bottom + Space.lg }]}>
          <View style={styles.sheetHeader}>
            <Text style={[theme.type.title, { flex: 1 }]}>Invite people</Text>
            <PressableScale onPress={() => setOpen(false)} accessibilityLabel="Close" style={styles.close}>
              <Ionicons name="close" size={22} color={c.text} />
            </PressableScale>
          </View>
          <ScrollView contentContainerStyle={{ gap: Space.md, paddingBottom: Space.xl }}>
            {circles.length > 0 && (
              <View style={styles.circleRow}>
                {circles.map((ci) => (
                  <PressableScale key={ci.id} onPress={() => setPicked((prev) => new Set([...prev, ...ci.members.filter((m) => !existing.includes(m))]))} style={styles.circleChip}>
                    <Text style={styles.circleText}>{ci.name} · {ci.members.length}</Text>
                  </PressableScale>
                ))}
              </View>
            )}
            {people === null ? null : people.length === 0 ? (
              <Text style={theme.type.bodySecondary}>Once you've been to events with people, they'll show up here.</Text>
            ) : people.map((p) => {
              const on = picked.has(p.user_id);
              return (
                <PressableScale key={p.user_id} onPress={() => toggle(p.user_id)} scaleTo={0.98} style={styles.person}>
                  <Avatar name={p.full_name} url={p.avatar_url} seed={p.user_id} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={theme.type.value}>{p.full_name ?? 'Someone'}</Text>
                    <Text style={theme.type.caption}>{p.events_together === 1 ? '1 event together' : `${p.events_together} events together`}</Text>
                  </View>
                  <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? c.primary : c.textMuted} />
                </PressableScale>
              );
            })}
            {picked.size > 1 && (
              <View style={styles.saveCircle}>
                <View style={{ flex: 1 }}><TextField value={circleName} onChangeText={setCircleName} placeholder="Save these as a circle, e.g. Uni friends" /></View>
                <Button title="Save" size="sm" variant="outline" disabled={!circleName.trim()} onPress={saveCircle} />
              </View>
            )}
          </ScrollView>
          <Button title={picked.size ? `Invite ${picked.size}` : 'Pick people to invite'} disabled={!picked.size} loading={busy} onPress={invite} />
          <Text style={[theme.type.caption, { textAlign: 'center' }]}>They'll get it in Activity. Nobody is invited until you tap Invite.</Text>
        </View>
      </Modal>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  sheet: { flex: 1, backgroundColor: t.colors.background, paddingHorizontal: Space.xl, gap: Space.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center' },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.surfaceAlt },
  circleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  circleChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill,
    backgroundColor: t.colors.surface, borderWidth: t.outlineWidth, borderColor: t.colors.outline },
  circleText: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: t.colors.text },
  person: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.sm },
  saveCircle: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
}));
