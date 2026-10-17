import PledgeNote from '@/components/pledges/PledgeNote';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { eventTheme } from '@/constants/eventThemes';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { canCheckIn, isPastCutoff, isPledgeEvent } from '@/lib/pledges';
import { Event, Rsvp, RsvpStatus } from '@/lib/types';
import { format } from 'date-fns';
import { useState } from 'react';
import { Text, View } from 'react-native';

/**
 * A guest's answer: I'm in (in the event's colour) · Maybe · Can't go in one row, the
 * pledge line under the buttons it applies to, and, once it's nearly time, "I'm here"
 * as its own state. Drawing only: every change goes through the page's handlers.
 */
export default function RsvpBar({ event, rsvp, hostName, blockedByDebt, spotsLeft, note, onNoteChange, onAnswer, onCheckIn, onMuteHost }: {
  event: Event;
  rsvp: Rsvp;
  hostName: string;
  blockedByDebt: boolean;
  spotsLeft: number | null;
  note: string;
  onNoteChange: (v: string) => void;
  onAnswer: (status: RsvpStatus) => void;
  onCheckIn: () => void;
  onMuteHost?: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const t = eventTheme(event.theme);
  const [noteOpen, setNoteOpen] = useState(!!rsvp.additional_details);
  // R11: on pledge events it's I'm in or Can't go once the cutoff has passed
  const choices = isPledgeEvent(event) && isPastCutoff(event) && rsvp.status !== 'maybe' ? (['yes', 'no'] as const) : (['yes', 'maybe', 'no'] as const);
  const arriving = rsvp.status === 'yes' && canCheckIn(event);

  return (
    <View style={{ gap: Space.md }}>
      {arriving && (
        rsvp.checked_in_at ? (
          <Text style={[theme.type.value, { color: c.successText }]}>You checked in at {format(new Date(rsvp.checked_in_at), 'h:mm a')}. {hostName} can see you're here.</Text>
        ) : (
          <View style={{ gap: Space.sm }}>
            <Button title="I'm here" icon="hand-right-outline" size="lg" color={{ bg: t.a, fg: t.ink }} onPress={onCheckIn} />
            <Text style={[theme.type.caption, { textAlign: 'center' }]}>Lets {hostName} know you've arrived. Your pledge is safe once you're marked as came.</Text>
          </View>
        )
      )}

      {blockedByDebt && rsvp.status !== 'yes' && (
        <Text style={[theme.type.value, { color: c.dangerText }]}>Settle up with {hostName} above to RSVP.</Text>
      )}

      <View style={{ flexDirection: 'row', gap: Space.sm }} accessibilityRole="radiogroup">
        {choices.map((s) => {
          const active = rsvp.status === s;
          const label = s === 'yes' ? (active ? "You're in" : "I'm in") : s === 'maybe' ? 'Maybe' : "Can't go";
          return (
            <Button
              key={s}
              title={label}
              icon={s === 'yes' && active ? 'checkmark' : undefined}
              // I'm in always wears the event's colour; the others fill in once picked
              color={s === 'yes' ? { bg: t.a, fg: t.ink } : active ? { bg: c.primary, fg: c.onPrimary } : undefined}
              variant="soft"
              style={{ flex: s === 'yes' ? 1.35 : 1, paddingHorizontal: 8 }}
              onPress={() => onAnswer(s)}
              accessibilityLabel={`${label}${active ? ', your answer' : ''}`}
            />
          );
        })}
      </View>

      <PledgeNote event={event} rsvp={rsvp} hostName={hostName} onConfirm={() => onAnswer('yes')} />

      {spotsLeft != null && rsvp.status !== 'yes' && (
        <Text style={[theme.type.caption, spotsLeft === 0 && { color: c.dangerText }]}>
          {spotsLeft === 0 ? "It's full. You can still say Maybe." : spotsLeft === 1 ? '1 spot left' : `${spotsLeft} spots left`}
        </Text>
      )}

      {noteOpen ? (
        <View style={{ gap: Space.sm }}>
          <TextField label="A note for the host" optional value={note} onChangeText={onNoteChange} placeholder="Dietary needs, +1s, running late…" multiline />
          {rsvp.status !== 'invited' && <Button title="Save note" variant="line" size="sm" onPress={() => onAnswer(rsvp.status)} style={{ alignSelf: 'flex-start' }} />}
        </View>
      ) : (
        <Button title="Add a note for the host" icon="create-outline" variant="ghost" size="sm" onPress={() => setNoteOpen(true)} style={{ alignSelf: 'flex-start' }} />
      )}

      {/* Muting is private: the host just sees "can't be invited right now" (8.8) */}
      {rsvp.status === 'invited' && onMuteHost && (
        <Button title={`Stop direct invites from ${hostName}`} variant="ghost" size="sm" style={{ alignSelf: 'flex-start' }} onPress={onMuteHost} />
      )}
    </View>
  );
}
