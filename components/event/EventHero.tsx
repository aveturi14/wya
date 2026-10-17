import { AvatarStack } from '@/components/ui/Avatar';
import IconButton from '@/components/ui/IconButton';
import Poster, { PosterSticker } from '@/components/ui/Poster';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney, isPledgeEvent } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { Event, Profile, Rsvp } from '@/lib/types';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

type Face = { id: string; name: string | null; avatarUrl?: string | null };

type HeroProps = {
  event: Event;
  host: Profile | null;
  isHost: boolean;
  rsvp: Rsvp | null;
  goingCount: number;
  posterHeight: number;
  onBack: () => void;
  onShare?: () => void;
};

/**
 * The top of an event page on phones: back and share over the glow, the event's
 * poster, then the title line. Desktop puts EventPoster and EventTitle in two columns.
 */
export default function EventHero(props: HeroProps) {
  return (
    <View style={{ gap: Space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" label="Back" tone="glass" onPress={props.onBack} />
        {props.onShare && <IconButton icon="share-outline" label="Share invite" tone="glass" onPress={props.onShare} />}
      </View>
      <EventPoster {...props} />
      <EventTitle {...props} />
    </View>
  );
}

/** The event's poster with wya's stickers ("8 going", "you're in", "waiting", "time TBD") and the host's. */
export function EventPoster({ event, isHost, rsvp, goingCount, posterHeight }: HeroProps) {

  const wya: PosterSticker[] = [];
  if (event.kind === 'open') wya.push({ label: 'time TBD', tone: 'ink' });
  else if (isHost && goingCount > 0) wya.push({ label: `${goingCount} going`, tone: 'ink' });
  else if (rsvp?.status === 'yes') wya.push({ label: "✓ you're in", tone: 'light' });
  else if (rsvp?.status === 'requested') wya.push({ label: 'waiting', tone: 'light' });
  const stickers = [...wya, ...(event.stickers ?? []).map((s, i): PosterSticker => ({ label: s, tone: i === 0 ? 'lime' : 'pink' }))].slice(0, 3);

  const line = event.poster_line || (isHost ? "you're hosting" : null);
  return (
    <Poster
      title={event.title}
      theme={event.theme}
      imageUrl={event.cover_image}
      line={line}
      date={event.date}
      open={event.kind === 'open'}
      place={event.venue_name}
      stickers={stickers}
      height={posterHeight}
      maxTitleSize={posterHeight > 400 ? 150 : 84}
    />
  );
}

/** The title and one line of when, where, who, plus the host's record. */
export function EventTitle({ event, host, isHost, big }: HeroProps & { big?: boolean }) {
  const { theme } = useTheme();
  const date = new Date(event.date);
  const hostFirst = host?.full_name?.split(' ')[0] ?? 'the host';
  const when = event.kind === 'open' ? 'Time TBD' : format(date, 'EEE d MMM, h:mm a').replace(':00', '');
  const sub = [
    when,
    event.venue_name,
    isHost ? null : `by ${hostFirst}`,
    isHost && isPledgeEvent(event) ? `${formatMoney(event.deposit_cents)} pledge` : null,
  ].filter(Boolean).join(' · ');

  return (
    <View style={{ gap: 2 }}>
      <Text style={big ? theme.type.display : theme.type.heading} accessibilityRole="header">{event.title}</Text>
      <Text style={big ? theme.type.bodySecondary : theme.type.caption}>{sub}</Text>
      {!isHost && host && <HostRecord hostId={host.id} name={hostFirst} />}
    </View>
  );
}

/** "14 going · 5 maybe · 2 can't" with a few faces: quiet, instead of coloured tiles. */
export function QuietCounts({ going, maybe, cant }: { going: Face[]; maybe: number; cant?: number }) {
  const { theme } = useTheme();
  if (going.length === 0 && maybe === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
      <AvatarStack people={going} max={4} size={22} label={false} />
      <Text style={theme.type.caption}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.type.sectionHeading.fontFamily }}>{going.length} going</Text>
        {` · ${maybe} maybe`}
        {cant != null ? ` · ${cant} can't` : ''}
      </Text>
    </View>
  );
}

// "Hannah's events: 8 happened · 0 called off late" (8.5). Shown once they've hosted something.
export function HostRecord({ hostId, name }: { hostId: string; name: string }) {
  const { theme } = useTheme();
  const [record, setRecord] = useState<{ hosted: number; happened: number; cancelled_late: number } | null>(null);
  useEffect(() => {
    supabase.rpc('get_host_record', { p_host_id: hostId }).then(({ data }) => setRecord(data?.[0] ?? null));
  }, [hostId]);
  if (!record || (record.happened === 0 && record.cancelled_late === 0)) return null;
  return (
    <Text style={[theme.type.caption, record.cancelled_late > 0 && { color: theme.colors.warningText }]}>
      {name}'s events: {record.happened} happened · {record.cancelled_late} called off late
    </Text>
  );
}
