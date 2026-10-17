import { Guest } from '@/components/GuestList';
import { Avatar } from '@/components/ui/Avatar';
import { Tick } from '@/components/InvitePeople';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ListRow, { ListGroup } from '@/components/ui/ListRow';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/lib/alert';
import { formatMoney } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

/** Host only, after the start: untick anyone who didn't come. Everyone going starts ticked; check-ins ("here 6:52") make it a quick confirm. */
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

  // Pledged no-shows (unticked) will owe the host
  const willOwe = going.filter((g) => absent.has(g.user_id) && g.pledge_cents != null);

  return (
    <Card style={{ gap: Space.md }}>
      <View style={{ gap: 2 }}>
        <Text style={theme.type.heading}>Who came?</Text>
        <Text style={theme.type.caption}>{going.length - absent.size} of {going.length} came. Untick anyone who didn't show.</Text>
      </View>
      <ListGroup tone="alt">
        {going.map((g) => {
          const came = !absent.has(g.user_id);
          return (
            <ListRow
              key={g.user_id}
              onPress={() => toggle(g.user_id)}
              accessibilityLabel={`${g.full_name ?? 'Unknown'}, ${came ? 'came' : "didn't come"}`}
              leading={<Avatar name={g.full_name} url={g.avatar_url} seed={g.user_id} size={32} />}
              title={g.full_name ?? 'Unknown'}
              // Their own claim (8.4) makes it a quick confirm; the host still decides
              subtitle={g.checked_in_at ? `Here at ${format(new Date(g.checked_in_at), 'h:mm a')}` : "Didn't check in"}
              trailing={<Tick on={came} color={theme.colors.success} />}
            />
          );
        })}
      </ListGroup>
      {willOwe.length > 0 && (
        <View style={styles.note}>
          <Ionicons name="cash-outline" size={15} color={theme.colors.textSecondary} />
          <Text style={[theme.type.caption, { flex: 1 }]}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.type.sectionHeading.fontFamily }}>
              {willOwe.length === 1 ? `${willOwe[0].full_name?.split(' ')[0] ?? 'They'} will owe you ${formatMoney(willOwe[0].pledge_cents!)}.` : `${willOwe.length} people will owe you their pledge.`}
            </Text>
            {' '}They can send an excuse, and you decide.
          </Text>
        </View>
      )}
      <Button title={alreadyMarked ? 'Update' : 'Save'} loading={saving} onPress={save} />
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  note: { flexDirection: 'row', gap: Space.sm, alignItems: 'flex-start', padding: Space.md, borderRadius: Radius.md, backgroundColor: t.colors.surfaceAlt },
}));
