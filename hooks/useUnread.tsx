import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

type Unread = { chats: number; activity: number; refresh: () => void };

const UnreadContext = createContext<Unread>({ chats: 0, activity: 0, refresh: () => {} });

/** Unread chat messages and Activity items for the tab badges, kept live with realtime. */
export function UnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [chats, setChats] = useState(0);
  const [activity, setActivity] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) { setChats(0); setActivity(0); return; }
    const [{ data: chatRows }, { count }] = await Promise.all([
      supabase.rpc('get_my_chats'),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
    ]);
    setChats((chatRows ?? []).reduce((sum: number, r: { unread: number }) => sum + (r.unread ?? 0), 0));
    setActivity(count ?? 0);
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return;
    // Row security means each person only receives their own notifications and chats they're in
    const channel = supabase
      .channel(`unread:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refresh]);

  return <UnreadContext.Provider value={{ chats, activity, refresh }}>{children}</UnreadContext.Provider>;
}

export const useUnread = () => useContext(UnreadContext);
