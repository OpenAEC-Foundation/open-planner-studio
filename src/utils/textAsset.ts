export function looksLikeSpaFallback(body: string): boolean {
  return /^\uFEFF?\s*<(?:!doctype|html)\b/i.test(body);
}

export interface TextAssetResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type TextAssetFetch = (url: string) => Promise<TextAssetResponse>;

export async function fetchTextAsset(
  url: string,
  fetchImpl: TextAssetFetch = fetch,
): Promise<string> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (looksLikeSpaFallback(text)) throw new Error('SPA-fallback (body)');
  if (text.trim() === '') throw new Error('empty body');
  return text;
}
