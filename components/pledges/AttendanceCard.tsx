import { Guest } from '@/components/GuestList';
import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import ListSection from '@/components/ui/ListSection';
import PressableScale from '@/components/ui/PressableScale';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/lib/alert';
import { formatMoney } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

/** Host only, after the start: untick anyone who didn't come. Everyone going starts ticked. */
export default function AttendanceCard({ eventId, guests, onSaved }: { eventId: string; guests: Guest[]; onSaved: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const going = guests.filter((g) => g.status === 'yes');
  const alreadyMarked = going.some((g) => g.attended != null);
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Start from what's been saved before, if anything
  useEffect(() => {
    setAbsent(new Set(going.filter((g) => g.attended === false).map((g) => g.user_id)));
  }, [guests]);

  if (going.length === 0) return null;

  const toggle = (id: string) => setAbsent((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('record_attendance', { p_event_id: eventId, p_absent: [...absent] });
    setSaving(false);
    if (error) { showAlert('Could not save', error.message); return; }
    onSaved();
  };

  return (
    <ListSection
      title="Who came?"
      defaultOpen
      subtitle={`${going.length - absent.size} of ${going.length} came. Untick anyone who didn't show; pledged no-shows will owe you their pledge.`}
      footer={<Button title={alreadyMarked ? 'Update attendance' : 'Done'} loading={saving} onPress={save} />}
      contentStyle={{ gap: Space.xs }}
    >
      {going.map((g) => {
        const came = !absent.has(g.user_id);
        return (
          <PressableScale key={g.user_id} haptic scaleTo={0.98} onPress={() => toggle(g.user_id)} style={styles.row} hoverStyle={styles.rowHover}>
            <Avatar name={g.full_name} url={g.avatar_url} seed={g.user_id} size={34} />
            <View style={{ flex: 1 }}>
              <Text style={[theme.type.value, !came && { color: theme.colors.textMuted, textDecorationLine: 'line-through' }]}>{g.full_name ?? 'Unknown'}</Text>
              {g.pledge_cents != null && <Text style={theme.type.caption}>Pledged {formatMoney(g.pledge_cents)}</Text>}
            </View>
            <View style={[styles.check, came && { backgroundColor: theme.colors.success, borderColor: theme.isDark ? theme.colors.success : theme.colors.outline }]}>
              {came && <Ionicons name="checkmark" size={18} color={theme.colors.onStatus} />}
            </View>
          </PressableScale>
        );
      })}
    </ListSection>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.sm, borderRadius: Radius.md },
  rowHover: { backgroundColor: t.colors.surfaceAlt },
  check: {
    width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center',
    borderWidth: t.outlineWidth + 1, borderColor: t.isDark ? t.colors.border : t.colors.outline,
  },
}));
