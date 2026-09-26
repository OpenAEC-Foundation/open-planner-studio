/** De bytes uit een base64-`data:`-URL (`data:image/png;base64,…`); gooit bij een ander formaat. */
export function dataUrlToBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
  const marker = ';base64,';
  const idx = dataUrl.indexOf(marker);
  if (idx === -1) throw new Error('Onverwacht data-URL-formaat (geen base64)');
  const binary = atob(dataUrl.slice(idx + marker.length));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
