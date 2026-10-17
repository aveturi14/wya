import Card from '@/components/ui/Card';
import Switch from '@/components/ui/Switch';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

type Capability = 'suggest_people' | 'use_contacts' | 'draft_messages';

const SWITCHES: { key: Capability; title: string; caption: string }[] = [
  { key: 'suggest_people', title: 'Suggest people from my past events', caption: 'The assistant can propose inviting people you\'ve been to events with. You still approve every invite.' },
  { key: 'draft_messages', title: 'Let the assistant draft messages', caption: 'Invite texts and reminders written for you to check and send.' },
  { key: 'use_contacts', title: 'Use my contacts', caption: 'Only when you pick people to text. Nothing is uploaded.' },
];

/**
 * You → wya assistant (8.8): what the assistant may use. All off until you turn
 * them on; a switched-off capability is removed from the assistant's tools (8.11).
 */
export default function AssistantSwitches({ heading = true }: { heading?: boolean }) {
  const { theme } = useTheme();
  const [grants, setGrants] = useState<Record<string, boolean>>({});

  useFocusEffect(useCallback(() => {
    supabase.from('agent_grants').select('capability, enabled').then(({ data }) => {
      setGrants(Object.fromEntries((data ?? []).map((g) => [g.capability, g.enabled])));
    });
  }, []));

  const set = async (key: Capability, enabled: boolean) => {
    haptics.select();
    setGrants((g) => ({ ...g, [key]: enabled }));
    const { error } = await supabase.rpc('set_agent_grant', { p_capability: key, p_enabled: enabled });
    if (error) { setGrants((g) => ({ ...g, [key]: !enabled })); showAlert('Could not save', error.message); }
  };

  return (
    <View style={{ gap: Space.md }}>
      {heading && <Text style={theme.type.heading}>wya assistant</Text>}
      <Text style={theme.type.bodySecondary}>It suggests, you decide. Nothing is sent or changed until you tap.</Text>
      <Card style={{ gap: Space.lg }}>
        {SWITCHES.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={theme.type.value}>{s.title}</Text>
              <Text style={theme.type.caption}>{s.caption}</Text>
            </View>
            <Switch
              value={!!grants[s.key]}
              onValueChange={(v) => set(s.key, v)}
              accessibilityLabel={s.title}
            />
          </View>
        ))}
      </Card>
      <View style={{ flexDirection: 'row', gap: Space.sm, padding: Space.md, borderRadius: 12, backgroundColor: theme.colors.surfaceAlt }}>
        <Ionicons name="shield-checkmark-outline" size={15} color={theme.colors.textSecondary} style={{ marginTop: 2 }} />
        <Text style={[theme.type.caption, { flex: 1 }]}>Never sees addresses or PayIDs.</Text>
      </View>
    </View>
  );
}
