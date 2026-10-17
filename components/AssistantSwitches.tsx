import Card from '@/components/ui/Card';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Switch, Text, View } from 'react-native';

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
export default function AssistantSwitches() {
  const { theme } = useTheme();
  const c = theme.colors;
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
      <Text style={theme.type.heading}>wya assistant</Text>
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
              trackColor={{ false: c.surfaceAlt, true: c.primary }}
              thumbColor={theme.isDark ? (grants[s.key] ? c.onPrimary : c.text) : c.surface}
            />
          </View>
        ))}
      </Card>
    </View>
  );
}
