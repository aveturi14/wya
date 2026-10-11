import Button from '@/components/ui/Button';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { formatCutoff, formatMoney, isPastCutoff, isPledgeEvent } from '@/lib/pledges';
import { Event, Rsvp } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** What the guest's RSVP means on a pledge event, shown on the RSVP card. */
export default function PledgeNote({ event, rsvp, hostName, onConfirm }: {
  event: Event;
  rsvp: Rsvp;
  hostName: string;
  // R3: pledges were turned on after this guest said I'm in
  onConfirm: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const pledged = rsvp.status === 'yes' && rsvp.pledge_cents != null;
  // A kept pledge (R4b) still applies even if the host has since turned pledges off
  if (!isPledgeEvent(event) && !pledged) return null;

  const past = isPastCutoff(event);
  const cutoff = formatCutoff(event);
  const amount = formatMoney(pledged ? rsvp.pledge_cents! : event.deposit_cents);

  let text: string;
  let action: ReactNode = null;
  if (pledged) {
    text = past
      ? `You've pledged ${amount}. It's past the cutoff, so cancelling now counts as a flake.`
      : `You've pledged ${amount}. Free to cancel until ${cutoff}.`;
  } else if (rsvp.status === 'yes') {
    text = `${hostName} added a ${amount} pledge. Confirm you're still in.`;
    action = <Button title="Confirm I'm in" size="sm" onPress={onConfirm} style={{ alignSelf: 'flex-start' }} />;
  } else if (rsvp.status === 'maybe') {
    text = `Decide by ${cutoff}. After that you'll be marked as can't go.`;
  } else {
    text = past
      ? `I'm in means a ${amount} pledge you pay ${hostName} if you don't show.`
      : `I'm in means a ${amount} pledge you pay ${hostName} if you don't show. Free to cancel until ${cutoff}.`;
  }

  return (
    <View style={styles.note}>
      <Ionicons name="shield-checkmark" size={18} color={theme.colors.onHighlight} />
      <View style={{ flex: 1, gap: Space.sm }}>
        <Text style={[theme.type.value, { color: theme.colors.onHighlight }]}>{text}</Text>
        {action}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  note: {
    flexDirection: 'row', gap: Space.md, padding: Space.md, borderRadius: Radius.md, backgroundColor: t.colors.highlight,
    borderWidth: t.isDark ? 0 : t.outlineWidth, borderColor: t.colors.outline,
  },
}));
