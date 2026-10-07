/**
 * Het ophalen van een *tekst*-asset uit de eigen bundel (`BASE_URL`-relatief): markdown-artikelen
 * voor de in-app help, IFC-voorbeelden, … — met één betrouwbare "bestaat dit echt?"-poort.
 *
 * ── Waarom dit een eigen module is (en waarom `content-type` hier NIET bruikbaar is) ─────────────
 * `res.ok` alleen is geen bewijs dat het bestand bestaat: Vite (dev) en de meeste statische hosts
 * (prod) serveren voor een ONBEKEND pad hun SPA-fallback (`index.html`) mét status 200. Zonder
 * poort belandt die rauwe app-HTML als "artikelinhoud" in de markdown-renderer.
 *
 * De voor de hand liggende poort — de `content-type`-header — is precies de verkeerde. In de
 * Tauri-webview worden de bundel-assets geserveerd via het `tauri://`-protocol, dat zijn MIME-type
 * bepaalt met `tauri_utils::mime_type::MimeType::parse(bytes, path)`. Die kent een korte
 * extensielijst (css/csv/html/ico/js/json/jsonld/mjs/mp4/rtf/svg/txt) en valt voor ELKE andere
 * extensie terug op `MimeType::Html` ⇒ `text/html`. `md` staat niet in die lijst (`ifc` evenmin),
 * dus op de desktop krijgt élk help-artikel `content-type: text/html` mee — volstrekt correct
 * geserveerde inhoud, alleen verkeerd gelabeld. Een header-check verwierp daardoor in de
 * uitgeleverde `.deb`/installer ALLE artikelen ("Artikel niet gevonden"), terwijl de browserbuild
 * het probleem per definitie niet laat zien. (Bevestigd in tauri-utils 2.9.x, tauri 2.11.x.)
 *
 * De body-sniff hieronder is wél betrouwbaar: de SPA-fallback is per definitie `index.html` en
 * begint dus met `<!doctype`/`<html>`, terwijl een markdown-artikel of een IFC-bestand daar nooit
 * mee begint. Zet de content-type-check hier dus niet terug.
 */

/**
 * Herkent de SPA-fallback (`index.html`) aan de body. Bewust geankerd op het BEGIN van het
 * document (na een optionele BOM en witruimte): markdown die verderop een `<html>`-fragment in een
 * codeblok noemt is gewoon een geldig artikel.
 */
export function looksLikeSpaFallback(body: string): boolean {
  return /^\uFEFF?\s*<(?:!doctype|html)\b/i.test(body);
}

/** Minimale Response-vorm die `fetchTextAsset` nodig heeft (de echte `Response` voldoet hieraan). */
export interface TextAssetResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

/** Minimale `fetch`-vorm; injecteerbaar zodat de poort headless testbaar is (zie tests/planning). */
export type TextAssetFetch = (url: string) => Promise<TextAssetResponse>;

/**
 * Haal een tekst-asset op en geef zijn inhoud terug, of gooi wanneer er geen echte inhoud is.
 *
 * Verwerpt: een niet-ok status, de SPA-fallback (zie `looksLikeSpaFallback`) en een lege/witruimte-
 * body — dat laatste omdat een leeg artikel als een kapotte viewer oogt; als "niet gevonden" krijgt
 * de gebruiker tenminste de vertaalde foutmelding te zien.
 */
export async function fetchTextAsset(
  url: string,
  fetchImpl: TextAssetFetch = fetch,
): Promise<string> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  // GEEN content-type-check hier — zie de moduletoelichting hierboven (Tauri labelt .md als HTML).
  if (looksLikeSpaFallback(text)) throw new Error('SPA-fallback (body)');
  if (text.trim() === '') throw new Error('empty body');
  return text;
}
