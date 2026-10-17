import { supabase } from '@/lib/supabase';

/**
 * A Realtime channel with a name no other subscription is using.
 *
 * supabase.channel(name) hands back the EXISTING channel when one with that name
 * is still registered, and removeChannel() only unregisters it after the server
 * confirms (asynchronously). So when an effect re-subscribes quickly (switching
 * tabs, a dependency changing, React re-running effects in development), the
 * new run gets the old, already-subscribed channel, and adding .on() to it throws
 * "cannot add postgres_changes callbacks … after subscribe()". The name is only a
 * label: what a channel receives comes from its postgres_changes filters.
 */
export function freshChannel(name: string) {
  return supabase.channel(`${name}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
}
