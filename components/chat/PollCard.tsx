import Button from '@/components/ui/Button';
import PressableScale from '@/components/ui/PressableScale';
import Sticker from '@/components/ui/Sticker';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { ChatMessage } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

type PollResult = { option_id: string; label: string; votes: number; voter_ids: string[]; closed: boolean };

/**
 * A poll in the event chat (Phase 8.2). Results come from get_poll_results;
 * `version` changes when a vote arrives over Realtime, which reloads them.
 */
export default function PollCard({ message, myId, isHost, nameOf, version }: {
  message: ChatMessage;
  myId: string | undefined;
  isHost: boolean;
  // First names for voters and the poll's starter (from the guest list)
  nameOf: (userId: string | null) => string | null;
  version: number;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  const [results, setResults] = useState<PollResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_poll_results', { p_message_id: message.id });
    if (data) setResults(data as PollResult[]);
  }, [message.id]);
  // `closed` lives on the message; it changes when the poll is closed (message UPDATE over Realtime)
  const closedOnMessage = !!message.data?.closed;
  useEffect(() => { load(); }, [load, version, closedOnMessage]);

  const multi = !!message.data?.multi;
  const closed = results?.[0]?.closed ?? closedOnMessage;
  const mine = useMemo(() => new Set((results ?? []).filter((r) => myId && r.voter_ids.includes(myId)).map((r) => r.option_id)), [results, myId]);
  const voterCount = useMemo(() => new Set((results ?? []).flatMap((r) => r.voter_ids)).size, [results]);
  const top = Math.max(0, ...(results ?? []).map((r) => r.votes));
  const isMe = message.user_id === myId;
  const starter = isMe ? 'You' : nameOf(message.user_id) ?? 'Someone';

  const vote = async (optionId: string) => {
    if (closed || busy || !results) return;
    // Single choice: tap another option to switch, tap yours again to take it back
    const next = multi
      ? (mine.has(optionId) ? [...mine].filter((id) => id !== optionId) : [...mine, optionId])
      : (mine.has(optionId) ? [] : [optionId]);
    haptics.select();
    setBusy(true);
    const { error } = await supabase.rpc('vote_poll', { p_message_id: message.id, p_option_ids: next });
    setBusy(false);
    if (error) showAlert('Could not vote', error.message);
    load();
  };

  const close = async () => {
    const ok = await confirmAction('Close this poll?', 'Nobody can vote after this. The results stay in the chat.', 'Close poll');
    if (!ok) return;
    const { error } = await supabase.rpc('close_poll', { p_message_id: message.id });
    if (error) { showAlert('Could not close the poll', error.message); return; }
    load();
  };

  return (
    <View style={[styles.row, isMe && { justifyContent: 'flex-end' }]}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="stats-chart" size={14} color={c.textSecondary} />
          <Text style={[theme.type.caption, { flex: 1 }]}>{starter} started a poll</Text>
          {closed && <Sticker label="Closed" />}
        </View>
        <Text style={theme.type.cardTitle}>{message.data?.question ?? 'Poll'}</Text>

        <View style={styles.options}>
          {(results ?? (message.data?.options ?? []).map((o: { id: string; label: string }) => ({ option_id: o.id, label: o.label, votes: 0, voter_ids: [], closed })))
            .map((r: PollResult) => {
              const picked = mine.has(r.option_id);
              const share = voterCount ? r.votes / voterCount : 0;
              const winner = closed && r.votes > 0 && r.votes === top;
              const names = r.voter_ids.map((id) => (id === myId ? 'You' : nameOf(id) ?? 'Someone'));
              return (
                <PressableScale
                  key={r.option_id}
                  onPress={() => vote(r.option_id)}
                  disabled={closed}
                  scaleTo={0.98}
                  haptic={false}
                  style={[styles.option, picked && styles.optionPicked]}
                  accessibilityRole={multi ? 'checkbox' : 'radio'}
                  accessibilityState={{ checked: picked, disabled: closed }}
                  accessibilityLabel={`${r.label}, ${r.votes} ${r.votes === 1 ? 'vote' : 'votes'}`}
                >
                  <View style={styles.optionTop}>
                    <Ionicons
                      name={picked ? (multi ? 'checkbox' : 'radio-button-on') : (multi ? 'square-outline' : 'radio-button-off')}
                      size={18}
                      color={picked ? c.primary : c.textMuted}
                    />
                    <Text style={[theme.type.value, { flex: 1 }, winner && { fontFamily: Fonts.bodyBold }]}>{r.label}</Text>
                    <Text style={[theme.type.value, { fontFamily: Fonts.bodyBold }]}>{r.votes}</Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.round(share * 100)}%`, backgroundColor: picked || winner ? c.primary : c.textMuted }]} />
                  </View>
                  {names.length > 0 && (
                    <Text style={theme.type.caption} numberOfLines={1}>
                      {names.slice(0, 3).join(', ')}{names.length > 3 ? ` + ${names.length - 3}` : ''}
                    </Text>
                  )}
                </PressableScale>
              );
            })}
        </View>

        <View style={styles.footer}>
          <Text style={[theme.type.caption, { flex: 1 }]}>
            {voterCount === 1 ? '1 person voted' : `${voterCount} people voted`}
            {/* The hint only until you've voted, so the line fits on a phone */}
            {closed || mine.size > 0 ? '' : multi ? ' · pick any' : ' · tap to vote'} · {format(new Date(message.created_at), 'h:mm a')}
          </Text>
          {!closed && (isMe || isHost) && <Button title="Close" size="sm" variant="ghost" onPress={close} />}
        </View>
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
  options: { gap: Space.sm },
  option: { gap: 6, padding: Space.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: t.colors.border },
  optionPicked: { borderColor: t.colors.primary, backgroundColor: t.colors.surfaceAlt },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  track: { height: 6, borderRadius: Radius.pill, backgroundColor: t.colors.border, overflow: 'hidden' },
  fill: { height: 6, borderRadius: Radius.pill },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
}));
