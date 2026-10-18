import { supabase } from '@/lib/supabase';
import { uploadFile } from '@/lib/upload';
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImageRef } from 'expo-image-manipulator';
import { ImagePickerAsset } from 'expo-image-picker';

// One row of get_album, plus signed links once they're fetched
export type Photo = {
  id: string;
  user_id: string;
  path: string;
  thumb_path: string;
  width: number;
  height: number;
  created_at: string;
  uploader_name: string | null;
  uploader_avatar: string | null;
};

export type Album = {
  photos: Photo[];
  can_add: boolean;
  is_host: boolean;
  my_count: number;
  per_person: number;
  per_event: number;
  opens_at: string;
  closes_at: string;
};

export type SignedUrls = Record<string, string>; // storage path -> short-lived link

// Long edge in pixels. Big enough to stay sharp full-screen on a retina laptop;
// re-encoding also drops the phone's metadata (incl. GPS).
const FULL_EDGE = 2560;
const FULL_QUALITY = 0.85;
const THUMB_EDGE = 720;
const THUMB_QUALITY = 0.8;
const LINK_SECONDS = 60 * 60;
// Reuse a link until it has this long left, so images stay cached instead of reloading
const LINK_REUSE_MS = 10 * 60 * 1000;

/** Album rules that the UI explains; the database enforces them. */
export const albumOpen = (album: Album) => new Date() >= new Date(album.opens_at);
export const albumClosed = (album: Album) => new Date() >= new Date(album.closes_at);
export const canDelete = (album: Album, photo: Photo, userId: string | undefined) => album.is_host || photo.user_id === userId;

/** Re-encodes as JPEG, shrinking the long edge to `longEdge` if it's bigger (also used for receipts). */
export async function shrink(source: string | ImageRef, longEdge: number, compress: number) {
  // Render once to learn the real size (picker sizes can be missing on web), then resize if it's bigger
  const image = await ImageManipulator.manipulate(source).renderAsync();
  const resized = Math.max(image.width, image.height) > longEdge
    ? await ImageManipulator.manipulate(image)
        .resize(image.width >= image.height ? { width: longEdge } : { height: longEdge })
        .renderAsync()
    : image;
  return resized.saveAsync({ format: SaveFormat.JPEG, compress });
}

export type UploadResult = { added: number; failed: { asset: ImagePickerAsset; message: string }[] };

/**
 * Shrinks and uploads photos one at a time (gentle on phone memory), registering
 * each with add_photo. Stops early if the album or the person's allowance is full.
 */
export async function uploadPhotos(
  eventId: string,
  userId: string,
  assets: ImagePickerAsset[],
  onProgress: (done: number, total: number) => void,
): Promise<UploadResult> {
  const result: UploadResult = { added: 0, failed: [] };
  for (const [i, asset] of assets.entries()) {
    onProgress(i, assets.length);
    const id = Crypto.randomUUID();
    const base = `${eventId}/${userId}/${id}`;
    const paths = [`${base}.jpg`, `${base}_thumb.jpg`];
    try {
      const full = await shrink(asset.uri, FULL_EDGE, FULL_QUALITY);
      // From the original, not the compressed full image, so the thumbnail isn't compressed twice
      const thumb = await shrink(asset.uri, THUMB_EDGE, THUMB_QUALITY);
      await uploadFile('album', paths[0], full.uri, 'image/jpeg');
      await uploadFile('album', paths[1], thumb.uri, 'image/jpeg');
      const { error } = await supabase.rpc('add_photo', { p_event_id: eventId, p_photo_id: id, p_width: full.width, p_height: full.height });
      if (error) throw error;
      result.added++;
    } catch (e) {
      await supabase.storage.from('album').remove(paths); // don't leave files without a photo
      const message = (e as { message?: string })?.message ?? 'Upload failed';
      const full = /ALBUM_FULL|YOUR_LIMIT/.test(JSON.stringify(e));
      result.failed.push(...(full ? assets.slice(i) : [asset]).map((a) => ({ asset: a, message })));
      if (full) break;
    }
  }
  onProgress(assets.length, assets.length);
  return result;
}

// Signed links we already have, by storage path. Asking again would give a new URL
// for the same file, which the browser treats as a new image (a flash and a re-download).
const linkCache = new Map<string, { url: string; expires: number }>();

/** Short-lived links for any album files: reused while fresh, the rest in one request. */
export async function signPaths(paths: string[]): Promise<SignedUrls> {
  const now = Date.now();
  const missing = paths.filter((p) => (linkCache.get(p)?.expires ?? 0) - now < LINK_REUSE_MS);
  if (missing.length > 0) {
    const { data, error } = await supabase.storage.from('album').createSignedUrls(missing, LINK_SECONDS);
    if (error) throw error;
    for (const d of data) if (d.signedUrl && d.path) linkCache.set(d.path, { url: d.signedUrl, expires: now + LINK_SECONDS * 1000 });
  }
  return Object.fromEntries(paths.flatMap((p) => { const hit = linkCache.get(p); return hit ? [[p, hit.url]] : []; }));
}

/** One request signs every thumbnail and full-size link. */
export const signUrls = (photos: Photo[]) => signPaths(photos.flatMap((p) => [p.thumb_path, p.path]));

// One row of get_my_albums (the Photos tab): an album you can see, newest event first
export type AlbumSummary = {
  event_id: string;
  title: string;
  theme: string;
  cover_image: string | null;
  starts_at: string;
  photo_count: number;
  thumb_paths: string[]; // up to 6, newest first
  is_open: boolean; // photos can be added now (start until 30 days after)
};

/** Deletes the row, then the files it returns. Only the owner or the host can. */
export async function deletePhoto(photoId: string) {
  const { data, error } = await supabase.rpc('delete_photo', { p_photo_id: photoId });
  if (error) throw error;
  const files = (data as { path: string; thumb_path: string }[]).flatMap((r) => [r.path, r.thumb_path]);
  if (files.length) await supabase.storage.from('album').remove(files);
}

/** Removes every album file for an event (before the event itself is deleted). Host only. */
export async function deleteAlbumFiles(eventId: string) {
  const { data } = await supabase.from('photos').select('path, thumb_path').eq('event_id', eventId);
  const files = (data ?? []).flatMap((r) => [r.path, r.thumb_path]);
  for (let i = 0; i < files.length; i += 100) await supabase.storage.from('album').remove(files.slice(i, i + 100));
}
