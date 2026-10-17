import WidgetCard from '@/components/home/WidgetCard';
import Button from '@/components/ui/Button';
import { linear, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

type Poll = { id: string; event_id: string; question: string };
type Result = { option_id: string; label: string; votes: number; voter_ids: string[] };

/** The newest open poll in any of your chats, with live-ish results; Vote opens that chat. */
export default function PollWidget({ eventTitle, onOpen }: { eventTitle: (id: string) => string | undefined; onOpen: (eventId: string) => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  const [poll, setPoll] = useState<Poll | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      // Row security only returns messages from chats you're in
      const { data } = await supabase.from('chat_messages').select('id, event_id, data')
        .eq('kind', 'poll').order('created_at', { ascending: false }).limit(10);
      const latest = (data ?? []).find((m) => !m.data?.closed);
      if (!latest) { if (!cancelled) setPoll(null); return; }
      const { data: rows } = await supabase.rpc('get_poll_results', { p_message_id: latest.id });
      if (cancelled) return;
      setPoll({ id: latest.id, event_id: latest.event_id, question: latest.data?.question ?? 'Poll' });
      setResults(rows ?? []);
    })();
    return () => { cancelled = true; };
  }, []));

  if (!poll) return null;
  const voters = new Set(results.flatMap((r) => r.voter_ids)).size;
  const votes = results.reduce((s, r) => s + r.votes, 0);
  const ranked = [...results].sort((a, b) => b.votes - a.votes);
  const fills = [null, c.text, c.textMuted];

  return (
    <WidgetCard label="Poll" right={`${voters} ${voters === 1 ? 'vote' : 'votes'} · ${eventTitle(poll.event_id) ?? 'chat'}`} style={{ flex: 1 }}>
      <Text style={theme.type.title} numberOfLines={3}>{poll.question}</Text>
      <View style={{ gap: Space.md }}>
        {results.map((r) => {
          const pct = votes ? Math.round((r.votes / votes) * 100) : 0;
          const rank = ranked.indexOf(r);
          const leader = rank === 0 && r.votes > 0;
          return (
            <View key={r.option_id} style={{ gap: 6 }}>
              <View style={styles.optionRow}>
                <Text style={[theme.type.value, { flex: 1 }, leader && { fontFamily: theme.type.button.fontFamily }]} numberOfLines={1}>{r.label}</Text>
                <Text style={theme.type.caption}>{pct}%</Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${pct}%` },
                    leader ? theme.gradient(linear(theme.gradients.accent)) : { backgroundColor: fills[Math.min(rank, 2)] ?? c.textMuted },
                    leader && { backgroundColor: theme.gradients.accent[0] },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
      <Button title="Vote" variant="outline" size="sm" onPress={() => onOpen(poll.event_id)} style={{ alignSelf: 'flex-start', marginTop: 'auto' }} />
    </WidgetCard>
  );
}

const useStyles = makeStyles((t) => ({
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  track: { height: 8, borderRadius: Radius.pill, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 8, borderRadius: Radius.pill },
}));
