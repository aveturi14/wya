import { Album, signUrls, SignedUrls } from '@/lib/album';
import { freshChannel } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * An event's album with fresh signed links. Loads on focus (so the tab can show
 * a count); while `live`, new and deleted photos appear without a refresh.
 */
export function useAlbum(eventId: string | undefined, live: boolean) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [urls, setUrls] = useState<SignedUrls>({});
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    const { data, error } = await supabase.rpc('get_album', { p_event_id: eventId });
    if (error || !data) return;
    const next = data as Album;
    setAlbum(next);
    try { setUrls(await signUrls(next.photos)); } catch { /* links retry on the next load */ }
  }, [eventId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!live || !eventId) return;
    // A busy party sends many changes at once; reload at most every second and a half
    const soon = () => {
      if (pending.current) return;
      pending.current = setTimeout(() => { pending.current = null; load(); }, 1500);
    };
    const channel = freshChannel(`album:${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos', filter: `event_id=eq.${eventId}` }, soon)
      // Deletes can't be filtered by event, so drop the photo locally if it's ours to show
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'photos' }, (payload) => {
        const gone = (payload.old as { id?: string }).id;
        setAlbum((a) => (a && gone ? { ...a, photos: a.photos.filter((p) => p.id !== gone) } : a));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
    };
  }, [live, eventId, load]);

  return { album, urls, reload: load };
}
