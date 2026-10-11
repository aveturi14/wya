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

// Long edge in pixels. Re-encoding also drops the phone's metadata (incl. GPS).
const FULL_EDGE = 1600;
const THUMB_EDGE = 400;
const LINK_SECONDS = 60 * 60;

/** Album rules that the UI explains; the database enforces them. */
export const albumOpen = (album: Album) => new Date() >= new Date(album.opens_at);
export const albumClosed = (album: Album) => new Date() >= new Date(album.closes_at);
export const canDelete = (album: Album, photo: Photo, userId: string | undefined) => album.is_host || photo.user_id === userId;

async function shrink(source: string | ImageRef, longEdge: number, compress: number) {
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
      const full = await shrink(asset.uri, FULL_EDGE, 0.75);
      const thumb = await shrink(full.uri, THUMB_EDGE, 0.7);
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

/** One request signs every thumbnail and full-size link. */
export async function signUrls(photos: Photo[]): Promise<SignedUrls> {
  const paths = photos.flatMap((p) => [p.thumb_path, p.path]);
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from('album').createSignedUrls(paths, LINK_SECONDS);
  if (error) throw error;
  return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}

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
