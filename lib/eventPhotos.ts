import { supabase } from '@/lib/supabase';

const MARKER = '/storage/v1/object/public/event-images/';

// Public URL → path inside the event-images bucket (null for anything else)
function storagePath(url: string): string | null {
  const i = url.indexOf(MARKER);
  return i === -1 ? null : decodeURIComponent(url.slice(i + MARKER.length).split('?')[0]);
}

// Best effort: a leftover file is harmless, so failures are ignored
export async function deleteEventPhotos(urls: (string | null | undefined)[]) {
  const paths = urls.map((u) => (u ? storagePath(u) : null)).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from('event-images').remove(paths);
}
