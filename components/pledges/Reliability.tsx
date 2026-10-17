import { useTheme } from '@/hooks/useTheme';
import Chip from '@/components/ui/Chip';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

export type ReliabilityRecord = { attended: number; counted: number; open_debts: number };

/** A person's track record: visible to themselves and to hosts of events they're invited to. */
export function useReliability(userId: string | null | undefined) {
  const [record, setRecord] = useState<ReliabilityRecord | null>(null);
  useEffect(() => {
    if (!userId) return;
    supabase.rpc('get_reliability', { p_user_id: userId }).then(({ data }) => setRecord(data?.[0] ?? null));
  }, [userId]);
  return record;
}

/** "Came to 9 of 10", plus a flag for unsettled debts. Nothing until there's a record. */
export function ReliabilityText({ record }: { record: ReliabilityRecord | null }) {
  const { theme } = useTheme();
  if (!record || record.counted === 0) return <Text style={theme.type.caption}>No track record yet</Text>;
  return <Text style={theme.type.caption}>Came to {record.attended} of {record.counted}</Text>;
}

export function OwesFlag({ record }: { record: ReliabilityRecord | null }) {
  const { theme } = useTheme();
  if (!record?.open_debts) return null;
  return <Chip label="Owes money" color={theme.colors.dangerText} />;
}
