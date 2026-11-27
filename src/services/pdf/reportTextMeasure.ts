import type { TextBaseline } from './draw2d';
import {
  isArabicScriptCp, isBidiControlCp, isNeutralCp, shapeAndPlace, stripBidiControls, type ShapeFontkitFont, type ShapingFonts,
} from './bidiShape';
import { hasRtlText } from './reportFont';

export interface MeasureFont {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  bbox: { maxY: number; minY: number };
  hasGlyphForCodePoint(codePoint: number): boolean;
  glyphForCodePoint(codePoint: number): { advanceWidth: number };
}

export interface MeasureFallbackFont {
  covers(codePoint: number): boolean;
  regular: MeasureFont;
  bold: MeasureFont;
}

export interface ReportMeasureFonts {
  regular: MeasureFont;
  bold: MeasureFont;
  fallbacks: readonly MeasureFallbackFont[];
  shaping?: ShapingFonts;
  baseDir: 'ltr' | 'rtl';
}

export function parseReportFont(css: string): { bold: boolean; size: number } {
  const bold = /(^|\s)(bold|[6-9]00)(\s|$)/i.test(css);
  const m = css.match(/(\d+(?:\.\d+)?)px/);
  return { bold, size: m ? parseFloat(m[1]) : 10 };
}

export { hasRtlText, isRtlCodepoint } from './reportFont';

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

export function fontAdvanceWidth(font: MeasureFont, text: string, size: number): number {
  let units = 0;
  for (const ch of text) units += advanceOf(font, ch.codePointAt(0)!);
  return (units * size) / (font.unitsPerEm || 1000);
}

export interface FallbackRun { fallback: number; str: string }

export function fallbackIndexFor(fonts: Pick<ReportMeasureFonts, 'fallbacks'>, cp: number): number {
  for (let i = 0; i < fonts.fallbacks.length; i++) {
    const f = fonts.fallbacks[i];
    if (f.covers(cp) && f.regular.hasGlyphForCodePoint(cp)) return i;
  }
  return -1;
}

export function needsFallback(fonts: ReportMeasureFonts, text: string): boolean {
  if (fonts.fallbacks.length === 0) return false;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (!fonts.regular.hasGlyphForCodePoint(cp) && fallbackIndexFor(fonts, cp) >= 0) return true;
  }
  return false;
}

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

export function fallbackRunWidth(fonts: ReportMeasureFonts, run: FallbackRun, bold: boolean, size: number): number {
  if (run.fallback < 0) return fontAdvanceWidth(bold ? fonts.bold : fonts.regular, run.str, size);
  const f = fonts.fallbacks[run.fallback];
  return fontAdvanceWidth(bold ? f.bold : f.regular, run.str, size);
}

export function measureReportText(fonts: ReportMeasureFonts, text: string, bold: boolean, size: number): number {
  if (fonts.shaping && hasRtlText(text)) {
    let width = 0;
    for (const run of shapeAndPlace(text, fonts.baseDir, size, fonts.shaping, bold)) width += run.width;
    return width;
  }
  const plain = stripBidiControls(text);
  if (needsFallback(fonts, plain)) {
    let width = 0;
    for (const run of splitFallbackRuns(fonts, plain)) width += fallbackRunWidth(fonts, run, bold, size);
    return width;
  }
  return fontAdvanceWidth(bold ? fonts.bold : fonts.regular, plain, size);
}

export function coversReportText(fonts: ReportMeasureFonts, text: string): boolean {
  const shaping = hasRtlText(text) ? fonts.shaping : undefined;
  const arabicHas = (cp: number) => shaping?.arabicRegular.hasGlyphForCodePoint?.(cp) ?? false;
  const covered = (cp: number): boolean => {
    const inMain = fonts.regular.hasGlyphForCodePoint(cp);
    if (!shaping) return inMain || fallbackIndexFor(fonts, cp) >= 0;
    if (isArabicScriptCp(cp)) return arabicHas(cp);
    if (isNeutralCp(cp)) return inMain || arabicHas(cp);
    return inMain;
  };
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined || isBidiControlCp(cp)) continue;
    if (!covered(cp)) return false;
  }
  return true;
}

export function fontVerticalMetrics(font: MeasureFont): { ascentEm: number; descentEm: number } {
  const upem = font.unitsPerEm || 1000;
  const ascent = font.ascent || font.bbox.maxY;
  const descent = font.descent || font.bbox.minY;
  return { ascentEm: ascent / upem, descentEm: descent / upem };
}

export function reportBaselineShift(fonts: ReportMeasureFonts, bold: boolean, size: number, baseline: TextBaseline): number {
  if (baseline === 'alphabetic') return 0;
  const { ascentEm, descentEm } = fontVerticalMetrics(bold ? fonts.bold : fonts.regular);
  const ascentPx = ascentEm * size;
  const descentPx = descentEm * size;
  return baseline === 'middle' ? (ascentPx + descentPx) / 2 : descentPx;
}

export interface ReportTextMetrics {
  measure(text: string, font: string): number;
  baselineShift(font: string, baseline: TextBaseline): number;
}

export function createReportTextMetrics(fonts: ReportMeasureFonts, uncovered?: Pick<ReportTextMetrics, 'measure'>): ReportTextMetrics {
  const widths = new Map<string, Map<string, number>>();
  const shifts = new Map<string, { middle: number; bottom: number }>();
  return {
    measure(text, font) {
      let perFont = widths.get(font);
      if (!perFont) { perFont = new Map(); widths.set(font, perFont); }
      const cached = perFont.get(text);
      if (cached !== undefined) return cached;
      const { bold, size } = parseReportFont(font);
      const width = uncovered && !coversReportText(fonts, text)
        ? uncovered.measure(text, font)
        : measureReportText(fonts, text, bold, size);
      if (perFont.size > 50_000) perFont.clear();
      perFont.set(text, width);
      return width;
    },
    baselineShift(font, baseline) {
      if (baseline === 'alphabetic') return 0;
      let perFont = shifts.get(font);
      if (!perFont) {
        const { bold, size } = parseReportFont(font);
        perFont = {
          middle: reportBaselineShift(fonts, bold, size, 'middle'),
          bottom: reportBaselineShift(fonts, bold, size, 'bottom'),
        };
        shifts.set(font, perFont);
      }
      return perFont[baseline];
    },
  };
}

export interface ReportFontFiles { regular: Uint8Array; bold: Uint8Array }

export type ReportFontkitFont = MeasureFont & ShapeFontkitFont;

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
