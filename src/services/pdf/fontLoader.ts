import { REPORT_FONTS, type ReportFontId } from './reportFont';

/**
 * Font-loader voor de gevendorde rapportletters (statische glyf-TTF's, gewicht 400/700) en voor
 * Noto Sans Arabic. Doel: de print-renderer meet en tekent op één deterministisch, inbedbaar font
 * (bv. family `'InterPDF'`) i.p.v. de per-platform verschillende systeem-font-stack. Dat maakt
 * `measureText` in de preview identiek aan de pdf-lib-vector-export, die dezelfde TTF-bytes inbedt.
 *
 * Welke letters er zijn en onder welke familienaam staat in `reportFont.ts` (issue #770); dit
 * bestand haalt alleen bytes op en registreert ze. Alles is browser-only (FontFace, fetch) — geen
 * Tauri-imports; werkt in de web- én de desktop-build.
 */

/**
 * De URL van elk gevendord font, op pad. `import.meta.glob` met `?url` zet alleen de URL-strings in
 * de bundel: een letter wordt pas gedownload als iemand hem kiest. Eén glob in plaats van een import
 * per bestand, zodat de bestandsnamen maar op één plek staan (`REPORT_FONTS` in `reportFont.ts`);
 * de planningscheck `check-report-font.ts` leest diezelfde namen van schijf.
 */
const FONT_URLS = import.meta.glob<string>('./fonts/*.ttf', { query: '?url', import: 'default', eager: true });

function fontUrl(file: string): string {
  const url = FONT_URLS[`./fonts/${file}`];
  if (!url) throw new Error(`Gevendord font ontbreekt: ${file}`);
  return url;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  // Zonder deze controle wordt een 404-pagina als font gelezen; de fout komt dan pas diep in fontkit.
  if (!res.ok) throw new Error(`Font laden mislukt (${res.status}): ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Cache per bestand van de Promise op de rauwe bytes (voor de PDF-embedding én de FontFace-
 * registratie). Een Promise en geen bytes: twee gelijktijdige aanvragen delen één download. Een
 * mislukte download gaat uit de cache, zodat een volgende poging opnieuw probeert.
 */
const byteCache = new Map<string, Promise<Uint8Array>>();

function cachedBytes(file: string): Promise<Uint8Array> {
  let pending = byteCache.get(file);
  if (!pending) {
    pending = fetchBytes(fontUrl(file));
    pending.catch(() => { byteCache.delete(file); });
    byteCache.set(file, pending);
  }
  return pending;
}

/**
 * Rauwe TTF-bytes van een rapportletter voor een gewicht (400 = Regular, 700 = Bold). Bedoeld voor
 * de pdf-lib-embedding in `paginateVector.ts` (`embedFont(bytes, { subset: false })`).
 */
export function getReportFontBytes(id: ReportFontId, weight: 400 | 700): Promise<Uint8Array> {
  const { files } = REPORT_FONTS[id];
  return cachedBytes(weight === 700 ? files.bold : files.regular);
}

/** Rauwe TTF-bytes van het gevendorde Inter: de standaardletter en de terugval voor elke andere. */
export function getInterFontBytes(weight: 400 | 700): Promise<Uint8Array> {
  return getReportFontBytes('inter', weight);
}

/**
 * Rauwe TTF-bytes van het gevendorde Noto Sans Arabic voor een gewicht (400 = Regular, 700 = Bold).
 * Bedoeld voor de RTL-vector-uitbreiding: het gemengde Arabisch/Perzisch wordt door de bidi/shaping-kern
 * ({@link file://./bidiShape.ts}) geshapt en als apart CID-font (naast de rapportletter) ingebed.
 * Statische glyf-TTF's met GSUB/GPOS (zie `fonts/README.md`).
 *
 * Deze functie levert alléén de bytes voor de PDF-embedding; ze registreert geen canvas-`FontFace`.
 */
export function getArabicFontBytes(weight: 400 | 700): Promise<Uint8Array> {
  return cachedBytes(weight === 700 ? 'NotoSansArabic-Bold.ttf' : 'NotoSansArabic-Regular.ttf');
}

const faceLoads = new Map<ReportFontId, Promise<void>>();

/** Registreert één rapportletter (400 en 700) als `FontFace` onder zijn eigen familienaam. */
function ensureFaces(id: ReportFontId): Promise<void> {
  let pending = faceLoads.get(id);
  if (pending) return pending;
  const { family } = REPORT_FONTS[id];
  pending = (async () => {
    const [regular, bold] = await Promise.all([getReportFontBytes(id, 400), getReportFontBytes(id, 700)]);
    // FontFace kopieert de buffer; een view op de gecachte Uint8Array is prima als bron.
    const regularFace = new FontFace(family, regular as BufferSource, { weight: '400', style: 'normal' });
    const boldFace = new FontFace(family, bold as BufferSource, { weight: '700', style: 'normal' });
    await Promise.all([regularFace.load(), boldFace.load()]);
    document.fonts.add(regularFace);
    document.fonts.add(boldFace);
    await Promise.all([
      document.fonts.load(`9px "${family}"`),
      document.fonts.load(`bold 9px "${family}"`),
    ]);
  })();
  pending.catch(() => { faceLoads.delete(id); });
  faceLoads.set(id, pending);
  return pending;
}

/**
 * Zorgt dat de gekozen rapportletter én Inter (de terugval in elke rapportstack, zie
 * `reportFontStack`) als `FontFace` geregistreerd en geladen zijn, zodat `ctx.measureText`/`fillText`
 * de juiste glyf-metrics gebruiken. Idempotent per letter. Wacht ook op `document.fonts.ready` —
 * anders meet/tekent de eerste render op terugval-metrics.
 *
 * Wijst NOOIT af: de aanroepers starten er de preview en de metingen mee (`void …then(...)`). Lukt
 * het laden niet (bv. offline in de browser), dan tekent het canvas op de volgende letter in de
 * stack; de vector-export haalt de bytes zelf op en valt bij een fout terug op raster. Een volgende
 * aanroep probeert het opnieuw.
 */
export async function ensureReportFontLoaded(id: ReportFontId = 'inter'): Promise<void> {
  try {
    await Promise.all(id === 'inter' ? [ensureFaces('inter')] : [ensureFaces('inter'), ensureFaces(id)]);
    await document.fonts.ready;
  } catch (err) {
    console.warn(`[fontLoader] Rapportletter '${id}' niet geladen; het canvas valt terug op de volgende letter in de stack:`, err);
  }
}
