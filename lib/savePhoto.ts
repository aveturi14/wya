// Web: fetch the photo and hand it to the browser as a download.
// (A plain <a download> is ignored for links on another domain, hence the blob.)
// Phones use savePhoto.native.ts.
export async function savePhoto(url: string, name: string) {
  const blob = await (await fetch(url)).blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
}
