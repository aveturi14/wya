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

/**
 * Uploads a picked image and returns its public URL. Throws on failure.
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
  const fullPath = fixedName ? path : `${path}.${ext}`;
  const body = await readFileBytes(asset.uri);
  const { data, error } = await supabase.storage.from(bucket).upload(fullPath, body, { contentType: mimeType, upsert: fixedName });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
}
