import { readFileBytes } from '@/lib/readFile';
import { supabase } from '@/lib/supabase';
import { ImagePickerAsset } from 'expo-image-picker';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const TYPES_BY_EXTENSION: Record<string, string> = {
  ...Object.fromEntries(Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type])),
  jpeg: 'image/jpeg',
};

// Use the type the picker reports, not the URI: on web the URI is a blob: URL with no extension
function imageType(asset: ImagePickerAsset) {
  const nameExt = asset.fileName?.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = asset.mimeType && EXTENSIONS[asset.mimeType] ? asset.mimeType : TYPES_BY_EXTENSION[nameExt] ?? 'image/jpeg';
  return { mimeType, ext: EXTENSIONS[mimeType] };
}

export type Bucket = 'avatars' | 'event-images' | 'album';

/** Reads a local file (a file:, blob: or data: URI) and stores it. Returns its storage path. Throws on failure. */
export async function uploadFile(bucket: Bucket, path: string, uri: string, contentType: string, { upsert = false } = {}) {
  const body = await readFileBytes(uri);
  const { data, error } = await supabase.storage.from(bucket).upload(path, body, { contentType, upsert });
  if (error) throw error;
  return data.path;
}

/**
 * Uploads a picked image to a public bucket and returns its public URL. Throws on failure.
 * `path` excludes the extension unless `fixedName` is set, in which case it is used as-is
 * (e.g. avatars, which are overwritten in place).
 */
export async function uploadImage(
  bucket: 'avatars' | 'event-images',
  path: string,
  asset: ImagePickerAsset,
  { fixedName = false } = {},
): Promise<string> {
  const { mimeType, ext } = imageType(asset);
  const stored = await uploadFile(bucket, fixedName ? path : `${path}.${ext}`, asset.uri, mimeType, { upsert: fixedName });
  return supabase.storage.from(bucket).getPublicUrl(stored).data.publicUrl;
}
