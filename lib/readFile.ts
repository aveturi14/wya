// Web: picked files are blob: URLs. Native builds use readFile.native.ts.
export async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}
