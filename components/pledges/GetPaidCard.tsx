import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import TextField from '@/components/ui/TextField';
import { Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { getProvider } from '@/lib/payments';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

/** Your PayID, used by guests who owe you after flaking on a pledge. */
export function useMyPayid() {
  const { user } = useAuth();
  const [value, setValue] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('payment_methods').select('value').eq('provider', 'payid').maybeSingle();
    setValue(data?.value ?? null);
    setLoaded(true);
  }, [user]);
  useEffect(() => { reload(); }, [reload]);
  return { payid: value, loaded, reload };
}

export default function GetPaidCard() {
  const { theme } = useTheme();
  const provider = getProvider();
  const { payid, loaded, reload } = useMyPayid();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const valid = provider.normalize(input) !== null;

  const save = async () => {
    setSaving(true);
    // The database validates too (same rules), and stores the normalised form
    const { error } = await supabase.rpc('set_payid', { p_value: input });
    setSaving(false);
    if (error) { showAlert('Could not save', error.message); return; }
    setEditing(false);
    reload();
  };

  const remove = async () => {
    if (!(await confirmAction('Remove PayID', 'Pledges on your events will need a PayID again before guests can owe you.', 'Remove', true))) return;
    const { error } = await supabase.rpc('remove_payid');
    if (error) { showAlert('Could not remove', error.message); return; }
    reload();
  };

  if (!loaded) return null;

  return (
    <Card style={{ gap: Space.md }}>
      <Text style={theme.type.bodySecondary}>
        If someone flakes on your event, or owes you for a split, they pay you here, directly.
      </Text>
      {editing || !payid ? (
        <>
          <TextField
            label={provider.inputLabel}
            value={input}
            onChangeText={setInput}
            placeholder={provider.placeholder}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={theme.type.caption}>{provider.help}</Text>
          <View style={{ flexDirection: 'row', gap: Space.sm }}>
            {payid && <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} style={{ flex: 1 }} />}
            <Button title="Save" disabled={!valid} loading={saving} onPress={save} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={theme.type.caption}>{provider.label}</Text>
            <Text style={theme.type.value}>{provider.format(payid)}</Text>
          </View>
          <Button title="Change" variant="soft" size="sm" onPress={() => { setInput(payid); setEditing(true); }} />
          <Button title="Remove" variant="ghost" size="sm" onPress={remove} />
        </View>
      )}
      {/* The privacy rule, up front */}
      <View style={{ flexDirection: 'row', gap: Space.sm, padding: Space.md, borderRadius: 12, backgroundColor: theme.colors.surfaceAlt }}>
        <Ionicons name="lock-closed-outline" size={15} color={theme.colors.textSecondary} style={{ marginTop: 2 }} />
        <Text style={[theme.type.caption, { flex: 1 }]}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.type.sectionHeading.fontFamily }}>Private. </Text>
          Guests see it only while they owe you, and never in chat or the assistant.
        </Text>
      </View>
    </Card>
  );
}
