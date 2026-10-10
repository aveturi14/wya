import { File } from 'expo-file-system';

// fetch(uri).blob() can produce empty uploads on React Native, so read the bytes directly
export async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}
