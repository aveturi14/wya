import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';

/**
 * Every events column the app may select directly. `address` isn't one of them:
 * the database hides it on pledge events until a guest commits, so it comes
 * from get_event_addresses (see withAddresses). `select('*')` on events fails.
 * Keep in sync with the column grants (20261012000200_address_gating.sql and later ones, e.g. max_guests in 8.1).
 */
// One literal (not concatenated) so supabase-js can still type the selected rows
export const EVENT_COLUMNS =
  'id, host_id, title, description, date, end_date, venue_name, latitude, longitude, dress_code, notes, cover_image, venue_images, contact_numbers, created_at, allow_guest_invites, theme, deposit_mode, deposit_cents, cutoff_hours, max_guests, kind, poster_line, stickers' as const;

/** Fills in `address` where the caller may see it; null means hidden. */
export async function withAddresses<T extends Omit<Event, 'address'>>(events: T[]): Promise<(T & { address: string | null })[]> {
  if (events.length === 0) return [];
  const { data } = await supabase.rpc('get_event_addresses', { p_event_ids: events.map((e) => e.id) });
  const byId = new Map<string, string>((data ?? []).map((r: { event_id: string; address: string }) => [r.event_id, r.address]));
  return events.map((e) => ({ ...e, address: byId.get(e.id) ?? null }));
}
