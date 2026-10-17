import Card from '@/components/ui/Card';
import Switch from '@/components/ui/Switch';
import Segmented from '@/components/ui/Segmented';
import TextField from '@/components/ui/TextField';
import { Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { haptics } from '@/lib/haptics';
import { format } from 'date-fns';
import { Text, View } from 'react-native';

// What the host controls about who can get in (Phase 8.1). The guest limit is an
// events column; the rest belongs to the invite link (event_invites).
export type InviteLimits = {
  maxGuests: number | null;
  expiry: Expiry;
  // The saved expiry when editing ('keep' leaves it as is)
  savedExpiresAt: string | null;
  maxUses: number | null;
  requiresApproval: boolean;
  allowGuestInvites: boolean;
};
export type Expiry = 'never' | 'start' | 'week' | 'keep';

export const DEFAULT_INVITE_LIMITS: InviteLimits = {
  maxGuests: null, expiry: 'never', savedExpiresAt: null, maxUses: null, requiresApproval: false, allowGuestInvites: true,
};

/** The expiry to save, worked out when the form is submitted (the start time may have changed). */
export function expiresAtFor(limits: InviteLimits, start: Date): string | null {
  switch (limits.expiry) {
    case 'start': return start.toISOString();
    case 'week': return new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    case 'keep': return limits.savedExpiresAt;
    default: return null;
  }
}

// Empty field = no limit; anything else must be a whole number in range
function parseLimit(text: string, max: number): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : undefined;
}

export default function InviteSettings({ value, onChange, uses }: {
  value: InviteLimits;
  onChange: (v: InviteLimits) => void;
  // Editing: how many people have joined through the link so far
  uses?: number;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  const set = (patch: Partial<InviteLimits>) => onChange({ ...value, ...patch });

  const expiryOptions: { value: Expiry; label: string }[] = [
    { value: 'never', label: 'Never' },
    { value: 'start', label: 'At the start' },
    { value: 'week', label: 'In 7 days' },
  ];
  if (value.savedExpiresAt) expiryOptions.push({ value: 'keep', label: format(new Date(value.savedExpiresAt), 'MMM d') });

  return (
    <Card style={styles.card}>
      <TextField
        label="Guest limit"
        value={value.maxGuests == null ? '' : String(value.maxGuests)}
        onChangeText={(t) => { const n = parseLimit(t, 500); if (n !== undefined) set({ maxGuests: n }); }}
        placeholder="No limit"
        keyboardType="number-pad"
      />
      <Text style={theme.type.caption}>Once this many people say I'm in, the event is full. Maybe doesn't count.</Text>

      <View style={styles.divider} />

      <Text style={theme.type.label}>Invite link expires</Text>
      <Segmented options={expiryOptions} value={value.expiry} onChange={(expiry) => set({ expiry })} />

      <TextField
        label="Link uses"
        value={value.maxUses == null ? '' : String(value.maxUses)}
        onChangeText={(t) => { const n = parseLimit(t, 10000); if (n !== undefined) set({ maxUses: n }); }}
        placeholder="Unlimited"
        keyboardType="number-pad"
      />
      {uses != null && <Text style={theme.type.caption}>{uses === 1 ? '1 person has' : `${uses} people have`} joined with the link so far</Text>}

      <ToggleRow
        title="Approve people who join"
        caption="New people wait until you let them in. Good for links shared in big group chats"
        value={value.requiresApproval}
        onChange={(requiresApproval) => set({ requiresApproval })}
      />
      <ToggleRow
        title="Let guests share the invite link"
        caption="When off, only you can invite people"
        value={value.allowGuestInvites}
        onChange={(allowGuestInvites) => set({ allowGuestInvites })}
      />
      {!value.allowGuestInvites && !value.requiresApproval && value.maxUses == null && value.expiry === 'never' && (
        <Text style={[theme.type.caption, { color: c.textSecondary }]}>Anyone you send the link to can still forward it.</Text>
      )}
    </Card>
  );
}

function ToggleRow({ title, caption, value, onChange }: { title: string; caption: string; value: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={theme.type.value}>{title}</Text>
        <Text style={theme.type.caption}>{caption}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { haptics.select(); onChange(v); }}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: Space.md },
  divider: { height: 1, backgroundColor: t.colors.border, marginVertical: Space.xs },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
}));
