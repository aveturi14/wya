import WidgetCard from '@/components/home/WidgetCard';
import DotRing from '@/components/ui/DotRing';
import { Fonts, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { isPledgeEvent } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

type Counts = { going: number; maybe: number; waiting: number; asking: number };

/**
 * Who's committed to your next plan, as a ring: Going (and how many of the
 * guest limit, or of everyone asked), Maybe, and, for the host, who hasn't answered.
 * Guests only ever see Going and Maybe (get_guest_list hides the rest).
 */
export default function Commitment({ event, isHost, big }: { event: Event; isHost: boolean; big: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [counts, setCounts] = useState<Counts | null>(null);

  useFocusEffect(useCallback(() => {
    supabase.rpc('get_guest_list', { p_event_id: event.id }).then(({ data }) => {
      const rows: { status: string }[] = data ?? [];
      const n = (s: string) => rows.filter((r) => r.status === s).length;
      setCounts({ going: n('yes'), maybe: n('maybe'), waiting: n('invited'), asking: n('requested') });
    });
  }, [event.id]));

  if (!counts) return <WidgetCard label="Commitment" right={event.title}><View style={{ height: big ? 280 : 200 }} /></WidgetCard>;

  const asked = counts.going + counts.maybe + (isHost ? counts.waiting + counts.asking : 0);
  const total = Math.max(1, event.max_guests ?? asked);
  const size = big ? 200 : 168;
  const pledge = isPledgeEvent(event);
  const legend = [
    { label: 'Going', value: counts.going, color: theme.gradients.accent[0] },
    { label: pledge ? 'Maybe · auto-resolves at cutoff' : 'Maybe', value: counts.maybe, color: c.secondary },
    ...(isHost ? [{ label: 'Waiting', value: counts.waiting, color: c.textMuted }] : []),
    ...(isHost && counts.asking > 0 ? [{ label: 'Asking to join', value: counts.asking, color: c.warning }] : []),
  ];

  return (
    <WidgetCard label="Commitment" right={event.title} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', paddingVertical: Space.sm }}>
        <DotRing
          size={size}
          stroke={14}
          track={c.surfaceAlt}
          segments={[
            { share: counts.going / total, colors: theme.gradients.accent },
            { share: counts.maybe / total, colors: [c.secondary, c.secondary] },
          ]}
        >
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: Fonts.display, fontSize: big ? 48 : 40, lineHeight: big ? 50 : 42, letterSpacing: -2, color: c.text }}>
              {counts.going}<Text style={{ color: c.textMuted }}>/{total}</Text>
            </Text>
            <Text style={theme.type.caption}>{pledge ? 'pledged “I’m in”' : 'said “I’m in”'}</Text>
          </View>
        </DotRing>
      </View>
      <View style={{ gap: Space.sm, marginTop: 'auto' }}>
        {legend.map((l) => (
          <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
            <Text style={[theme.type.value, { flex: 1, fontSize: 14 }]}>{l.label}</Text>
            <Text style={[theme.type.value, { fontFamily: Fonts.bodyBold, fontSize: 14 }]}>{l.value}</Text>
          </View>
        ))}
        {event.max_guests != null && (
          <Text style={theme.type.caption}>Guest limit {event.max_guests} · {Math.max(0, event.max_guests - counts.going)} spots left</Text>
        )}
      </View>
    </WidgetCard>
  );
}
