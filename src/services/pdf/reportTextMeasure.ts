// De tekstmeting van de rapporten: één bron voor de vector-PDF (`PdfVectorDraw2D`), het papier op het
// scherm (`svgDraw2d.ts`, issue #817) en de kolombreedtes die het rapportpaneel meet.
//
// WAAROM niet de canvas-meting van de browser (gemeten 9 november 2026, headless Chromium op Linux):
// `ctx.measureText` rondt bij kleine letters elke letterbreedte af op hele pixels (hinting). "Stakeholder
// management" in 9 px Inter: canvas 115, het fontbestand 109,0. Een datum in 8 px: canvas 64, het
// fontbestand 70,9. Het paneel mat de kolommen dus te smal voor de PDF (die kapte "30-03-2027 0…" af) en
// het papier kapte namen af die in de PDF pasten. Op Windows en macOS rondt canvas anders af: de meting
// hing van het apparaat af.
//
// WAAROM niet fontkit-`layout` (de meting van pdf-lib, `widthOfTextAtSize`): die draait de hele
// GSUB-vervanging van de letter. Bij Inter kost dat ruim 1 ms per tekst; 10.000 teksten (5000 taken) =
// 12 s. Deze meting telt de advance-breedtes uit de `hmtx`-tabel per teken op: in microseconden, op elk
// apparaat gelijk. Het verschil met de getekende glyphs (na GSUB) is bij Inter alleen "->" (een pijl) en
// bij Carlito de "ti"-ligatuur (0,7 % van een em). Papier en PDF meten allebei hiermee, dus ze kappen
// precies gelijk af; dat verschil zit in beide.
//
// Puur: geen DOM, geen pdf-lib. De fonts komen van fontkit (`fontkit.create(bytes)`); in de PDF van de
// ingebedde letter zelf, op het scherm uit dezelfde bytes (`loadReportTextMetrics` in `fontLoader.ts`).

import type { TextBaseline } from './draw2d';
import { shapeAndPlace, stripBidiControls, type ShapeFontkitFont, type ShapingFonts } from './bidiShape';

/** Het deel van een fontkit-font dat de meting leest. */
export interface MeasureFont {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  bbox: { maxY: number; minY: number };
  hasGlyphForCodePoint(codePoint: number): boolean;
  glyphForCodePoint(codePoint: number): { advanceWidth: number };
}

/**
 * Een terugvalletter achter de rapportletter: een CJK-letter van een extensie, of Inter achter een
 * andere rapportletter (`fallbackFonts` in `paginateVector.ts`). `covers` is de voorfilter van de
 * aanbieder; de meting kijkt daarna of de letter het teken echt heeft, net als de PDF.
 */
export interface MeasureFallbackFont {
  covers(codePoint: number): boolean;
  regular: MeasureFont;
  bold: MeasureFont;
}

/** Alle letters waarmee een rapport meet: zoals de vector-PDF ze kent. */
export interface ReportMeasureFonts {
  regular: MeasureFont;
  bold: MeasureFont;
  /** In volgorde: de eerste die een teken heeft, tekent het. */
  fallbacks: readonly MeasureFallbackFont[];
  /** Met Noto Sans Arabic: tekst met Arabisch of Hebreeuws gaat door de shaping-kern (`bidiShape.ts`). */
  shaping?: ShapingFonts;
  /** Basisrichting van de rapporttaal; stuurt de bidi in de shaping-kern. */
  baseDir: 'ltr' | 'rtl';
}

/** Ontleed een canvas-letter (`"9px InterPDF…"`, `"bold 9px …"`) naar gewicht en grootte in px. */
export function parseReportFont(css: string): { bold: boolean; size: number } {
  const bold = /(^|\s)(bold|[6-9]00)(\s|$)/i.test(css);
  const m = css.match(/(\d+(?:\.\d+)?)px/);
  return { bold, size: m ? parseFloat(m[1]) : 10 };
}

/**
 * RTL-codepoint? (Arabisch + Hebreeuws, incl. presentatievormen). De rapportletters dekken deze scripts
 * niet; tekst met zo'n teken gaat in de PDF door de shaping-kern.
 */
export function isRtlCodepoint(cp: number): boolean {
  return (
    (cp >= 0x0590 && cp <= 0x05FF) || // Hebreeuws
    (cp >= 0x0600 && cp <= 0x06FF) || // Arabisch
    (cp >= 0x0750 && cp <= 0x077F) || // Arabic Supplement
    (cp >= 0x08A0 && cp <= 0x08FF) || // Arabic Extended-A
    (cp >= 0xFB50 && cp <= 0xFDFF) || // Arabic Presentation Forms-A
    (cp >= 0xFE70 && cp <= 0xFEFF)    // Arabic Presentation Forms-B
  );
}

export function hasRtlText(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && isRtlCodepoint(cp)) return true;
  }
  return false;
}

/** Per font de advance (font-eenheden) per codepoint: een rapport tekent dezelfde tekens duizenden keren. */
const advanceCache = new WeakMap<MeasureFont, Map<number, number>>();

function advanceOf(font: MeasureFont, cp: number): number {
  let perFont = advanceCache.get(font);
  if (!perFont) { perFont = new Map(); advanceCache.set(font, perFont); }
  let adv = perFont.get(cp);
  if (adv === undefined) {
    adv = font.glyphForCodePoint(cp).advanceWidth;
    perFont.set(cp, adv);
  }
  return adv;
}

/**
 * Breedte van `text` op `size` px in één letter: de som van de advance-breedtes uit het fontbestand,
 * zonder kerning en zonder GSUB. Eerst in hele font-eenheden opgeteld, dan één keer geschaald: elke
 * aanroeper krijgt bit voor bit hetzelfde getal.
 */
export function fontAdvanceWidth(font: MeasureFont, text: string, size: number): number {
  let units = 0;
  for (const ch of text) units += advanceOf(font, ch.codePointAt(0)!);
  return (units * size) / (font.unitsPerEm || 1000);
}

/** Eén stuk tekst in één letter: de rapportletter (`fallback` −1) of terugvalletter nummer `fallback`. */
export interface FallbackRun { fallback: number; str: string }

/** Index van de eerste terugvalletter die `cp` echt heeft, of −1 (zoals `cjkProviderIndexFor` in de PDF). */
export function fallbackIndexFor(fonts: Pick<ReportMeasureFonts, 'fallbacks'>, cp: number): number {
  for (let i = 0; i < fonts.fallbacks.length; i++) {
    const f = fonts.fallbacks[i];
    if (f.covers(cp) && f.regular.hasGlyphForCodePoint(cp)) return i;
  }
  return -1;
}

/** Heeft `text` een teken dat de rapportletter mist en een terugvalletter wél heeft? */
export function needsFallback(fonts: ReportMeasureFonts, text: string): boolean {
  if (fonts.fallbacks.length === 0) return false;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (!fonts.regular.hasGlyphForCodePoint(cp) && fallbackIndexFor(fonts, cp) >= 0) return true;
  }
  return false;
}

/**
 * `text` in stukken per letter. De rapportletter gaat voor (cijfers en Latijn in een CJK-naam blijven
 * in de rapportletter); dekt niets een teken, dan blijft het in de rapportletter (de PDF valt dan terug
 * op raster).
 */
export function splitFallbackRuns(fonts: ReportMeasureFonts, text: string): FallbackRun[] {
  const runs: FallbackRun[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    const fallback = fonts.regular.hasGlyphForCodePoint(cp) ? -1 : fallbackIndexFor(fonts, cp);
    const last = runs[runs.length - 1];
    if (last && last.fallback === fallback) last.str += ch;
    else runs.push({ fallback, str: ch });
  }
  return runs;
}

/** Breedte van één stuk in zijn eigen letter. */
export function fallbackRunWidth(fonts: ReportMeasureFonts, run: FallbackRun, bold: boolean, size: number): number {
  if (run.fallback < 0) return fontAdvanceWidth(bold ? fonts.bold : fonts.regular, run.str, size);
  const f = fonts.fallbacks[run.fallback];
  return fontAdvanceWidth(bold ? f.bold : f.regular, run.str, size);
}

/**
 * De breedte van `text` zoals de vector-PDF hem meet en tekent. Drie wegen, in deze volgorde (dezelfde
 * als `PdfVectorDraw2D.fillText`): tekst met Arabisch of Hebreeuws door de shaping-kern (als die letters
 * er zijn); tekst met een teken uit een terugvalletter per stuk; de rest in de rapportletter.
 */
export function measureReportText(fonts: ReportMeasureFonts, text: string, bold: boolean, size: number): number {
  if (fonts.shaping && hasRtlText(text)) {
    let width = 0;
    for (const run of shapeAndPlace(text, fonts.baseDir, size, fonts.shaping, bold)) width += run.width;
    return width;
  }
  // LTR kent geen herordening: de bidi-stuurtekens worden niet getekend, dus ook niet gemeten.
  const plain = stripBidiControls(text);
  if (needsFallback(fonts, plain)) {
    let width = 0;
    for (const run of splitFallbackRuns(fonts, plain)) width += fallbackRunWidth(fonts, run, bold, size);
    return width;
  }
  return fontAdvanceWidth(bold ? fonts.bold : fonts.regular, plain, size);
}

/** Stijg- en daalhoogte van een letter als deel van een em (daalhoogte negatief), zoals de PDF ze leest. */
export function fontVerticalMetrics(font: MeasureFont): { ascentEm: number; descentEm: number } {
  const upem = font.unitsPerEm || 1000;
  const ascent = font.ascent || font.bbox.maxY;
  const descent = font.descent || font.bbox.minY;
  return { ascentEm: ascent / upem, descentEm: descent / upem };
}

/**
 * Afstand (px, positief = omlaag) van de lijn die `baseline` aanwijst naar de alfabetische basislijn,
 * met de maten van de rapportletter: `middle` = halverwege stijg- en daalhoogte, `bottom` = de
 * daalhoogte. Precies de omrekening van `PdfVectorDraw2D.placeText`.
 */
export function reportBaselineShift(fonts: ReportMeasureFonts, bold: boolean, size: number, baseline: TextBaseline): number {
  if (baseline === 'alphabetic') return 0;
  const { ascentEm, descentEm } = fontVerticalMetrics(bold ? fonts.bold : fonts.regular);
  const ascentPx = ascentEm * size;
  const descentPx = descentEm * size;
  return baseline === 'middle' ? (ascentPx + descentPx) / 2 : descentPx;
}

/** Tekstmeting met dezelfde vorm als `SvgTextMetrics` (`svgDraw2d.ts`), op de letters van een rapport. */
export interface ReportTextMetrics {
  measure(text: string, font: string): number;
  baselineShift(font: string, baseline: TextBaseline): number;
}

/**
 * De meting van het papier en van de kolombreedtes in het paneel: `measureReportText` met een cache per
 * letter en tekst (een rapport meet dezelfde datums en koppen honderden keren).
 */
export function createReportTextMetrics(fonts: ReportMeasureFonts): ReportTextMetrics {
  const widths = new Map<string, Map<string, number>>();
  return {
    measure(text, font) {
      let perFont = widths.get(font);
      if (!perFont) { perFont = new Map(); widths.set(font, perFont); }
      const cached = perFont.get(text);
      if (cached !== undefined) return cached;
      const { bold, size } = parseReportFont(font);
      const width = measureReportText(fonts, text, bold, size);
      // Begrensd: een grote planning heeft duizenden unieke namen; die hoeven niet eeuwig te blijven.
      if (perFont.size > 50_000) perFont.clear();
      perFont.set(text, width);
      return width;
    },
    baselineShift(font, baseline) {
      const { bold, size } = parseReportFont(font);
      return reportBaselineShift(fonts, bold, size, baseline);
    },
  };
}

/** De rauwe TTF-bytes van één letter in twee gewichten. */
export interface ReportFontFiles { regular: Uint8Array; bold: Uint8Array }

/** Een fontkit-font zoals `fontkit.create(bytes)` hem geeft, voor meten én shapen. */
export type ReportFontkitFont = MeasureFont & ShapeFontkitFont;

/**
 * Stel de meetletters van een rapport samen zoals de vector-PDF ze heeft (`buildGanttReportPdf` +
 * `paginateVectorToPdfBytes`): de rapportletter, Inter als terugval achter elke andere letter (de
 * voorfilter is de dekking van Inter Regular, net als `fallbackFonts`), en Noto Sans Arabic in de
 * shaping-kern naast de rapportletter. Puur: `create` is `fontkit.create`. Eén bron voor de lader in de
 * app (`loadReportTextMetrics`) en de headless checks.
 */
export function assembleReportMeasureFonts(
  create: (bytes: Uint8Array) => ReportFontkitFont,
  main: ReportFontFiles,
  options: { interFallback?: ReportFontFiles; arabic?: ReportFontFiles; baseDir: 'ltr' | 'rtl' },
): ReportMeasureFonts {
  const regular = create(main.regular);
  const bold = create(main.bold);
  const fonts: ReportMeasureFonts = { regular, bold, fallbacks: [], baseDir: options.baseDir };
  if (options.interFallback) {
    const inter = { regular: create(options.interFallback.regular), bold: create(options.interFallback.bold) };
    fonts.fallbacks = [{ covers: (cp: number) => inter.regular.hasGlyphForCodePoint(cp), ...inter }];
  }
  if (options.arabic) {
    fonts.shaping = {
      latinRegular: regular,
      latinBold: bold,
      arabicRegular: create(options.arabic.regular),
      arabicBold: create(options.arabic.bold),
    };
  }
  return fonts;
}
