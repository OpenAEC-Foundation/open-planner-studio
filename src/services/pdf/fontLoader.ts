import { ARABIC_REPORT_FAMILY, ARABIC_REPORT_UNICODE_RANGE, REPORT_FONTS, type ReportFontId } from './reportFont';
import { assembleReportMeasureFonts, createReportTextMetrics, type ReportFontkitFont, type ReportTextMetrics } from './reportTextMeasure';
import { createCanvasTextMetrics } from './canvasTextMetrics';

/**
 * Font-loader voor de gevendorde rapportletters (statische glyf-TTF's, gewicht 400/700) en voor
 * Noto Sans Arabic. Doel: de print-renderer meet en tekent op één deterministisch, inbedbaar font
 * (bv. family `'InterPDF'`) i.p.v. de per-platform verschillende systeem-font-stack. Dat maakt
 * `measureText` in de preview identiek aan de pdf-lib-vector-export, die dezelfde TTF-bytes inbedt.
 *
 * Welke letters er zijn en onder welke familienaam staat in `reportFont.ts` (issue #770); dit
 * bestand haalt bytes op en registreert de letters. Alles is browser-only (`@font-face`, fetch) — geen
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
 * Cache per bestand van de Promise op de rauwe bytes voor de PDF-embedding. (Het canvas en de DOM
 * laden hetzelfde bestand via de `@font-face`-regel hieronder.) Een Promise en geen bytes: twee
 * gelijktijdige aanvragen delen één download. Een
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

/** De bestanden van het gevendorde Noto Sans Arabic (statische glyf-TTF's met GSUB/GPOS, zie `fonts/README.md`). */
const ARABIC_FILES = { regular: 'NotoSansArabic-Regular.ttf', bold: 'NotoSansArabic-Bold.ttf' } as const;

/**
 * Rauwe TTF-bytes van het gevendorde Noto Sans Arabic voor een gewicht (400 = Regular, 700 = Bold).
 * Bedoeld voor de RTL-vector-uitbreiding: het gemengde Arabisch/Perzisch wordt door de bidi/shaping-kern
 * ({@link file://./bidiShape.ts}) geshapt en als apart CID-font (naast de rapportletter) ingebed.
 * Het scherm laadt hetzelfde bestand als `@font-face` (`ensureReportFontLoaded`).
 */
export function getArabicFontBytes(weight: 400 | 700): Promise<Uint8Array> {
  return cachedBytes(weight === 700 ? ARABIC_FILES.bold : ARABIC_FILES.regular);
}

/** Wat `ensureFaces` per letter registreert: de familie, de bestanden en eventueel een `unicode-range`. */
interface FaceSpec {
  family: string;
  files: { regular: string; bold: string };
  unicodeRange?: string;
  /** Een teken uit de `unicode-range`: `document.fonts.load` laadt alleen een face die de tekst raakt. */
  sample?: string;
}

/**
 * Noto Sans Arabic voor het scherm (review Sol #847). De PDF tekent en meet Arabisch in deze letter; het
 * SVG-papier en het canvas tekenen een tekst met Arabisch of Hebreeuws met deze familie vooraan
 * (`reportTextFont` in `reportFont.ts`). De `unicode-range` houdt cijfers en Latijn in de rapportletter.
 */
const ARABIC_FACES: FaceSpec = {
  family: ARABIC_REPORT_FAMILY, files: ARABIC_FILES, unicodeRange: ARABIC_REPORT_UNICODE_RANGE, sample: '\u0627\u0628',
};

const faceLoads = new Map<string, Promise<void>>();

/**
 * Registreert één letter (400 en 700) als CSS-`@font-face`-regel onder zijn eigen familienaam,
 * met de URL van het gevendorde bestand, en laadt beide gewichten.
 *
 * WAAROM een CSS-regel en geen `new FontFace(bytes)` (review Sol #837, ronde 1): de raster-terugval
 * van de tabelrapporten is een DOM-opname met `modern-screenshot`, en die neemt alleen
 * `CSSFontFaceRule`s uit de stylesheets mee — geen `FontFace`-objecten uit `document.fonts`. Met een
 * losse `FontFace` toonde de opname dus een andere letter dan de preview. Een CSS-regel staat ook in
 * `document.fonts`, dus het canvas meet en tekent er net zo op.
 */
function ensureFaces(key: string, { family, files, unicodeRange, sample }: FaceSpec): Promise<void> {
  let pending = faceLoads.get(key);
  if (pending) return pending;
  const style = document.createElement('style');
  style.dataset.opsReportFont = key;
  style.textContent = ([[files.regular, 400], [files.bold, 700]] as const).map(([file, weight]) => (
    `@font-face { font-family: "${family}"; src: url("${fontUrl(file)}") format("truetype"); `
    + `font-weight: ${weight}; font-style: normal; font-display: block;${unicodeRange ? ` unicode-range: ${unicodeRange};` : ''} }`
  )).join('\n');
  document.head.appendChild(style);
  pending = (async () => {
    const [regular, bold] = await Promise.all([
      document.fonts.load(`9px "${family}"`, sample),
      document.fonts.load(`bold 9px "${family}"`, sample),
    ]);
    // `load` geeft de faces die geladen zijn; leeg = de regel deed niets (bestand niet gevonden).
    if (regular.length === 0 || bold.length === 0) throw new Error(`Letter '${key}' niet geladen`);
  })();
  pending.catch(() => {
    // Weg met de regel en de cache: een mislukte face laadt nooit meer, een volgende poging begint schoon.
    faceLoads.delete(key);
    style.remove();
  });
  faceLoads.set(key, pending);
  return pending;
}

function ensureReportFaces(id: ReportFontId): Promise<void> {
  return ensureFaces(id, REPORT_FONTS[id]);
}

/**
 * Zorgt dat de gekozen rapportletter, Inter (de terugval in elke rapportstack, zie `reportFontStack`)
 * en Noto Sans Arabic (de letter van Arabische tekst, zie `reportTextFont`) als `@font-face`
 * geregistreerd en geladen zijn, zodat `ctx.measureText`/`fillText` en het SVG-papier de juiste
 * glyf-metrics gebruiken. Idempotent per letter. Wacht ook op `document.fonts.ready` —
 * anders meet/tekent de eerste render op terugval-metrics.
 *
 * Wijst NOOIT af: de aanroepers starten er de preview en de metingen mee (`void …then(...)`). Lukt
 * het laden niet (bv. offline in de browser), dan tekent het canvas op de volgende letter in de
 * stack; de vector-export haalt de bytes zelf op en valt bij een fout terug op raster. Een volgende
 * aanroep probeert het opnieuw.
 */
export async function ensureReportFontLoaded(id: ReportFontId = 'inter'): Promise<void> {
  try {
    await Promise.all([
      ensureReportFaces('inter'),
      ...(id === 'inter' ? [] : [ensureReportFaces(id)]),
      ensureFaces('arabic', ARABIC_FACES),
    ]);
    await document.fonts.ready;
  } catch (err) {
    console.warn(`[fontLoader] Rapportletter '${id}' niet geladen; het canvas valt terug op de volgende letter in de stack:`, err);
  }
}

const metricLoads = new Map<string, Promise<ReportTextMetrics>>();

/**
 * De tekstmeting van het rapportpapier en van de kolombreedtes in het paneel (issue #817): dezelfde
 * meting als de vector-PDF (`measureReportText`), uit dezelfde fontbytes, met dezelfde terugvalletters
 * (Inter achter een andere rapportletter, Noto Sans Arabic voor tekst van rechts naar links). Zo meten
 * papier, paneel en PDF hetzelfde getal en kappen ze gelijk af. Zie de kop van `reportTextMeasure.ts`
 * waarom dat niet de canvas-meting van de browser is.
 *
 * Een tekst met een teken dat geen van die letters heeft (`coversReportText`: Chinees zonder
 * CJK-extensie, Lao) meet met het canvas: het scherm tekent hem in een systeemletter en de PDF valt
 * dan terug op raster, ook met de browser. De meting uit het fontbestand gaf daar de lege glyph.
 *
 * fontkit wordt pas hier geladen (een eigen chunk, net als de PDF-export). Eén lading per letter en
 * schrijfrichting. Wijst nooit af: lukt het laden niet (bijvoorbeeld offline in de browser), dan meet
 * het canvas, zoals vóór deze meting. De PDF-export haalt de bytes zelf op en valt dan terug op raster.
 */
export function loadReportTextMetrics(id: ReportFontId = 'inter', baseDir: 'ltr' | 'rtl' = 'ltr'): Promise<ReportTextMetrics> {
  const key = `${id}|${baseDir}`;
  let pending = metricLoads.get(key);
  if (pending) return pending;
  pending = (async () => {
    try {
      const [{ default: fontkit }, regular, bold, arabicRegular, arabicBold, interRegular, interBold] = await Promise.all([
        import('@pdf-lib/fontkit'),
        getReportFontBytes(id, 400),
        getReportFontBytes(id, 700),
        getArabicFontBytes(400),
        getArabicFontBytes(700),
        id === 'inter' ? Promise.resolve(null) : getInterFontBytes(400),
        id === 'inter' ? Promise.resolve(null) : getInterFontBytes(700),
      ]);
      const fonts = assembleReportMeasureFonts(
        bytes => fontkit.create(bytes) as unknown as ReportFontkitFont,
        { regular, bold },
        {
          interFallback: interRegular && interBold ? { regular: interRegular, bold: interBold } : undefined,
          arabic: { regular: arabicRegular, bold: arabicBold },
          baseDir,
        },
      );
      return createReportTextMetrics(fonts, createCanvasTextMetrics());
    } catch (err) {
      metricLoads.delete(key);
      console.warn(`[fontLoader] Lettermaten van '${id}' niet geladen; het papier meet met het canvas:`, err);
      return createCanvasTextMetrics();
    }
  })();
  metricLoads.set(key, pending);
  return pending;
}
