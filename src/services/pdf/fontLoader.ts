import interRegularUrl from './fonts/Inter-Regular.ttf?url';
import interBoldUrl from './fonts/Inter-Bold.ttf?url';
import notoArabicRegularUrl from './fonts/NotoSansArabic-Regular.ttf?url';
import notoArabicBoldUrl from './fonts/NotoSansArabic-Bold.ttf?url';

/**
 * Font-loader voor het gevendorde Inter (statische glyf-TTF, wght 400/700). Doel: de print-renderer
 * meet en tekent op één deterministisch, inbedbaar font (family `'InterPDF'`) i.p.v. de per-platform
 * verschillende systeem-font-stack. Dat maakt `measureText` in de preview identiek aan de latere
 * pdf-lib-vector-export, die dezelfde TTF-bytes inbedt (§5.1/§5.2 ontwerpdoc).
 *
 * Alles is browser-only (FontFace, fetch) — geen Tauri-imports; werkt in de web- én de desktop-build.
 */

const FAMILY = 'InterPDF';

/** Cache van de rauwe TTF-bytes per gewicht (voor fase 2-embedding én de FontFace-registratie). */
const byteCache: Partial<Record<400 | 700, Uint8Array>> = {};

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Rauwe TTF-bytes van het gevendorde Inter voor een gewicht (400 = Regular, 700 = Bold). Bedoeld voor
 * de fase-2 pdf-lib-embedding (`embedFont(bytes, { subset: true })`); nu al gebouwd zodat het contract
 * stabiel is. Cachet per gewicht.
 */
export async function getInterFontBytes(weight: 400 | 700): Promise<Uint8Array> {
  if (byteCache[weight]) return byteCache[weight]!;
  const url = weight === 700 ? interBoldUrl : interRegularUrl;
  const bytes = await fetchBytes(url);
  byteCache[weight] = bytes;
  return bytes;
}

/** Cache van de rauwe Noto-Sans-Arabic-TTF-bytes per gewicht (voor de RTL-shaping-embedding). */
const arabicByteCache: Partial<Record<400 | 700, Uint8Array>> = {};

/**
 * Rauwe TTF-bytes van het gevendorde Noto Sans Arabic voor een gewicht (400 = Regular, 700 = Bold).
 * Bedoeld voor de RTL-vector-uitbreiding: het gemengde Arabisch/Perzisch wordt door de bidi/shaping-kern
 * ({@link file://./bidiShape.ts}) geshapt en als apart CID-font (naast Inter) ingebed. Statische glyf-TTF's
 * met GSUB/GPOS (zie `fonts/README.md`); cachet per gewicht, net als {@link getInterFontBytes}.
 *
 * De canvas-preview-`FontFace`-registratie (screen-metrics) is een aparte zorg voor de integratie-fase;
 * deze functie levert alléén de bytes voor de PDF-embedding.
 */
export async function getArabicFontBytes(weight: 400 | 700): Promise<Uint8Array> {
  if (arabicByteCache[weight]) return arabicByteCache[weight]!;
  const url = weight === 700 ? notoArabicBoldUrl : notoArabicRegularUrl;
  const bytes = await fetchBytes(url);
  arabicByteCache[weight] = bytes;
  return bytes;
}

let loadPromise: Promise<void> | null = null;

/**
 * Zorgt dat family `'InterPDF'` (weight 400 en 700) als `FontFace` geregistreerd én geladen is, zodat
 * `ctx.measureText`/`ctx.fillText` op `'InterPDF'` de juiste glyf-metrics gebruiken. Idempotent: laadt
 * één keer, cachet de Promise. Wacht op `document.fonts.load(...)` voor beide gewichten én op
 * `document.fonts.ready` — anders meet/tekent de eerste render op fallback-metrics (§5.2).
 */
export function ensureInterLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const [regular, bold] = await Promise.all([
      getInterFontBytes(400),
      getInterFontBytes(700),
    ]);
    // FontFace kopieert de buffer; een view op de gecachte Uint8Array is prima als bron.
    const regularFace = new FontFace(FAMILY, regular as BufferSource, { weight: '400', style: 'normal' });
    const boldFace = new FontFace(FAMILY, bold as BufferSource, { weight: '700', style: 'normal' });
    await Promise.all([regularFace.load(), boldFace.load()]);
    document.fonts.add(regularFace);
    document.fonts.add(boldFace);
    await Promise.all([
      document.fonts.load(`9px ${FAMILY}`),
      document.fonts.load(`bold 9px ${FAMILY}`),
    ]);
    await document.fonts.ready;
  })();
  return loadPromise;
}
