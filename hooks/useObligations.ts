import { useAuth } from '@/hooks/useAuth';
import { Obligation } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** Every debt you're part of: as a guest (you owe) or as a host (owed to you). */
export function useObligations() {
  const { user } = useAuth();
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_my_obligations');
    setObligations(data ?? []);
  }, [user]);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { obligations, reload };
}
