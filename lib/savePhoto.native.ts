import { Directory, File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

// Phones: download to the cache, then add it to the photo library (asks for add-only access)
export async function savePhoto(url: string, name: string) {
  const { granted } = await requestPermissionsAsync(true, ['photo']);
  if (!granted) throw new Error('wya needs permission to save photos. You can allow it in Settings.');
  const target = new File(new Directory(Paths.cache), name);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(url, target);
  try {
    await Asset.create(file.uri);
  } finally {
    file.delete();
  }
}
