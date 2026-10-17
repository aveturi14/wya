import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import ListRow, { ListGroup } from '@/components/ui/ListRow';
import Sheet from '@/components/ui/Sheet';
import TextField from '@/components/ui/TextField';
import { Fonts, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { smsUrl, webUrl, whatsappUrl } from '@/lib/links';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

type Person = { user_id: string; full_name: string | null; avatar_url: string | null; events_together: number };
type Circle = { id: string; name: string; members: string[] };

const REASONS: Record<string, string> = {
  removed: 'removed from this event',
  unavailable: "can't be invited right now",
  not_connected: "hasn't been to an event with you",
  already_on: 'already on the event',
};

/**
 * "Invite your people" (8.8), as a sheet over the event: pick from people you've been
 * to events with (and your circles), or hand a message to WhatsApp / your messages
 * app. Every invite is a proposal that runs only when you tap Invite; anything sent
 * outside wya is sent by you, from your phone.
 */
export default function InvitePeople({ eventId, existing, visible, onClose, onShareLink }: {
  eventId: string;
  existing: string[];
  visible: boolean;
  onClose: () => void;
  onShareLink?: () => void; // the event's invite link, shared the usual way
}) {
  const { theme } = useTheme();
  const styles = useStyles();
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
  useEffect(() => { if (visible) load(); }, [visible, load]);

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
    onClose();
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

  // Circles add their members to the picked set (minus anyone already on the event)
  const pickCircle = (ci: Circle) => setPicked((prev) => new Set([...prev, ...ci.members.filter((m) => !existing.includes(m))]));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={<Text style={theme.type.heading}>Invite <Text style={styles.serif}>your people</Text></Text>}
      footer={
        <>
          <Button title={picked.size ? `Invite ${picked.size} ${picked.size === 1 ? 'person' : 'people'}` : 'Pick people to invite'} disabled={!picked.size} loading={busy} onPress={invite} />
          <View style={styles.handoffs}>
            <Button title="WhatsApp" icon="logo-whatsapp" variant="soft" style={{ flex: 1 }} onPress={() => handOff('whatsapp')} />
            <Button title="Text" icon="chatbubble-outline" variant="soft" style={{ flex: 1 }} onPress={() => handOff('sms')} />
            {onShareLink && <Button title="Link" icon="link-outline" variant="soft" style={{ flex: 1 }} onPress={onShareLink} />}
          </View>
          <Text style={[theme.type.caption, { textAlign: 'center' }]}>They'll get it in Activity. Nobody is invited until you tap Invite.</Text>
        </>
      }
    >
      {circles.length > 0 && (
        <View style={styles.circleRow}>
          {circles.map((ci) => <Chip key={ci.id} label={ci.name} count={ci.members.length} onPress={() => pickCircle(ci)} />)}
        </View>
      )}
      {people === null ? null : people.length === 0 ? (
        <Text style={theme.type.bodySecondary}>Once you've been to events with people, they'll show up here. Until then, send the link.</Text>
      ) : (
        <ListGroup tone="alt">
          {people.map((p) => {
            const on = picked.has(p.user_id);
            return (
              <ListRow
                key={p.user_id}
                onPress={() => toggle(p.user_id)}
                accessibilityLabel={`${p.full_name ?? 'Someone'}, ${on ? 'picked' : 'not picked'}`}
                leading={<Avatar name={p.full_name} url={p.avatar_url} seed={p.user_id} size={36} />}
                title={p.full_name ?? 'Someone'}
                subtitle={p.events_together === 1 ? '1 event together' : `${p.events_together} events together`}
                trailing={<Tick on={on} />}
              />
            );
          })}
        </ListGroup>
      )}
      {picked.size > 1 && (
        <View style={styles.saveCircle}>
          <View style={{ flex: 1 }}><TextField value={circleName} onChangeText={setCircleName} placeholder="Save as a circle, e.g. Uni friends" /></View>
          <Button title="Save" size="sm" variant="line" disabled={!circleName.trim()} onPress={saveCircle} />
        </View>
      )}
    </Sheet>
  );
}

/** A square tick box: filled with the text colour when on. */
export function Tick({ on, color }: { on: boolean; color?: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={{
      width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
      ...(on ? { backgroundColor: color ?? c.text } : { borderWidth: 1.5, borderColor: c.lineStrong }),
    }}>
      {on && <Ionicons name="checkmark" size={16} color={color ? c.thumb : c.background} />}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  serif: { fontFamily: Fonts.serif, fontSize: 22 },
  handoffs: { flexDirection: 'row', gap: Space.sm },
  circleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  saveCircle: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
}));
