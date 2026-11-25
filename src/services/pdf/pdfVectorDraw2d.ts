import {
  PDFFont, PDFOperator, PDFHexString,
  pushGraphicsState, popGraphicsState, setGraphicsState,
  setFillingRgbColor, setStrokingRgbColor, setLineWidth, setDashPattern,
  moveTo, lineTo, closePath, appendBezierCurve, rectangle, fill, stroke,
  beginText, endText, setFontAndSize, setTextMatrix, showText,
} from 'pdf-lib';
import { resolveCornerRadii, type CornerRadii, type Draw2D, type TextAlign, type TextBaseline } from './draw2d';
import { layoutPdfText } from './embedReportFont';
import {
  shapeAndPlace, isArabicScriptCp, isNeutralCp,
  type ShapingFonts, type ShapedRun, type FontKey,
  isBidiControlCp,
  stripBidiControls,
} from './bidiShape';
import {
  fallbackIndexFor, fallbackRunWidth, fontAdvanceWidth, fontVerticalMetrics, hasRtlText, isRtlCodepoint, measureReportText,
  needsFallback, parseReportFont, splitFallbackRuns, type FallbackRun, type ReportMeasureFonts,
} from './reportTextMeasure';

const KAPPA = 0.5522847498307936;

interface RGBA { r: number; g: number; b: number; a: number }

export interface PdfResourcePool {
  regular: PDFFont;
  bold: PDFFont;
  registerAlpha(alpha: number): string;
}

export interface PdfTextPlacement {
  x0: number; y0: number; x1: number; y1: number;
  ops: PDFOperator[];
}

interface FontMetrics { ascentEm: number; descentEm: number }

interface TextPlacement { tx: number; baselineY: number; ascentPx: number; descentPx: number }

interface FontkitFont {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  bbox: { maxY: number; minY: number };
  hasGlyphForCodePoint(codePoint: number): boolean;
  glyphForCodePoint(codePoint: number): { advanceWidth: number };
  layout(
    string: string,
    features?: unknown,
    script?: unknown,
    language?: unknown,
    direction?: 'ltr' | 'rtl',
  ): {
    glyphs: Array<{ id: number }>;
    positions: Array<{ xAdvance: number; xOffset?: number; yOffset?: number }>;
  };
}

export interface ArabicShapingFonts {
  regular: FontkitFont;
  bold: FontkitFont;
}

export interface CjkVectorFont {
  id: string;
  covers(codepoint: number): boolean;
  fk: FontkitFont;
  fkBold: FontkitFont;
  embed?: {
    regular: PDFFont;
    bold: PDFFont;
    keyRegular: string;
    keyBold: string;
  };
}

function fontkitOf(font: PDFFont): FontkitFont {
  return (font as unknown as { embedder: { font: FontkitFont } }).embedder.font;
}

function laidOutTextOps(font: PDFFont, text: string, x: number, y: number, size: number): PDFOperator[] {
  const { glyphs, unitsPerEm } = layoutPdfText(font, text);
  if (glyphs.every(g => g.xOffset === 0 && g.yOffset === 0)) {
    return [setTextMatrix(1, 0, 0, 1, x, y), showText(PDFHexString.of(glyphs.map(g => g.hex).join('')))];
  }
  const scale = size / unitsPerEm;
  const ops: PDFOperator[] = [];
  let pen = 0;
  for (const g of glyphs) {
    ops.push(setTextMatrix(1, 0, 0, 1, x + (pen + g.xOffset) * scale, y + g.yOffset * scale), showText(PDFHexString.of(g.hex)));
    pen += g.advance;
  }
  return ops;
}

function readMetrics(fk: FontkitFont): FontMetrics {
  return fontVerticalMetrics(fk);
}

export function parseColor(css: string): RGBA {
  const s = css.trim();
  if (s[0] === '#') {
    const hex = s.slice(1);
    const h = (i: number, n: number) => parseInt(hex.substr(i, n), 16);
    if (hex.length === 3) return { r: h(0, 1) * 17 / 255, g: h(1, 1) * 17 / 255, b: h(2, 1) * 17 / 255, a: 1 };
    if (hex.length === 6) return { r: h(0, 2) / 255, g: h(2, 2) / 255, b: h(4, 2) / 255, a: 1 };
    if (hex.length === 8) return { r: h(0, 2) / 255, g: h(2, 2) / 255, b: h(4, 2) / 255, a: h(6, 2) / 255 };
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(',').map(p => p.trim());
    return {
      r: (parseFloat(parts[0]) || 0) / 255,
      g: (parseFloat(parts[1]) || 0) / 255,
      b: (parseFloat(parts[2]) || 0) / 255,
      a: parts.length > 3 ? (parseFloat(parts[3]) || 0) : 1,
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

export class PdfVectorDraw2D implements Draw2D {
  readonly operators: PDFOperator[] = [];
  readonly texts: PdfTextPlacement[] = [];

  font = '10px sans-serif';
  fillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;
  textAlign: TextAlign = 'left';
  textBaseline: TextBaseline = 'alphabetic';

  readonly uncoveredCodepoints = new Set<number>();
  hasRtl = false;
  usedArabic = false;
  readonly usedCjkCodepoints = new Map<number, Set<number>>();
  usedCjk = false;

  private readonly H: number;
  private readonly pool: PdfResourcePool;
  private readonly fkReg: FontkitFont;
  private readonly fkBold: FontkitFont;
  private readonly mReg: FontMetrics;
  private readonly mBold: FontMetrics;
  private readonly cjkFonts: CjkVectorFont[];
  private readonly cjkEmbedReady: boolean;
  private readonly baseDir: 'ltr' | 'rtl';
  private readonly shapingFonts?: ShapingFonts;
  private readonly fkArabic?: FontkitFont;
  private readonly coverageCache = new Map<number, boolean>();
  private readonly coverageCacheComplex = new Map<number, boolean>();
  private readonly measureFonts: ReportMeasureFonts;
  private dash: number[] = [];
  private pathBuf: PDFOperator[] = [];

  constructor(
    logicalW: number,
    logicalH: number,
    pool: PdfResourcePool,
    baseDir: 'ltr' | 'rtl' = 'ltr',
    arabicFonts?: ArabicShapingFonts,
    cjkFonts?: CjkVectorFont[],
  ) {
    void logicalW;
    this.H = logicalH;
    this.pool = pool;
    this.fkReg = fontkitOf(pool.regular);
    this.fkBold = fontkitOf(pool.bold);
    this.mReg = readMetrics(this.fkReg);
    this.mBold = readMetrics(this.fkBold);
    this.cjkFonts = cjkFonts ?? [];
    this.cjkEmbedReady = this.cjkFonts.length > 0 && this.cjkFonts.every(c => c.embed !== undefined);
    this.baseDir = baseDir;
    if (arabicFonts) {
      this.fkArabic = arabicFonts.regular;
      this.shapingFonts = {
        latinRegular: this.fkReg,
        latinBold: this.fkBold,
        arabicRegular: arabicFonts.regular,
        arabicBold: arabicFonts.bold,
      };
    }
    this.measureFonts = {
      regular: this.fkReg,
      bold: this.fkBold,
      fallbacks: this.cjkFonts.map(c => ({ covers: (cp: number) => c.covers(cp), regular: c.fk, bold: c.fkBold })),
      shaping: this.shapingFonts,
      baseDir,
    };
  }

  private checkCoverage(text: string, fk: FontkitFont): void {
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined || isBidiControlCp(cp)) continue;
      if (isRtlCodepoint(cp)) this.hasRtl = true;
      let covered = this.coverageCache.get(cp);
      if (covered === undefined) {
        covered =
          fk.hasGlyphForCodePoint(cp) ||
          (this.fkArabic?.hasGlyphForCodePoint(cp) ?? false) ||
          this.cjkProviderIndexFor(cp) >= 0;
        this.coverageCache.set(cp, covered);
      }
      if (!covered) this.uncoveredCodepoints.add(cp);
    }
  }

  private checkCoverageComplex(text: string, bold: boolean): void {
    const latinFk = bold ? this.fkBold : this.fkReg;
    const arabicHas = (cp: number) => this.fkArabic?.hasGlyphForCodePoint(cp) ?? false;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined || isBidiControlCp(cp)) continue;
      if (isRtlCodepoint(cp)) this.hasRtl = true;
      let covered = this.coverageCacheComplex.get(cp);
      if (covered === undefined) {
        if (isArabicScriptCp(cp)) {
          covered = arabicHas(cp);
        } else if (isNeutralCp(cp)) {
          covered = latinFk.hasGlyphForCodePoint(cp) || arabicHas(cp);
        } else {
          covered = latinFk.hasGlyphForCodePoint(cp);
        }
        this.coverageCacheComplex.set(cp, covered);
      }
      if (!covered) this.uncoveredCodepoints.add(cp);
    }
  }

  private cjkProviderIndexFor(cp: number): number {
    return fallbackIndexFor(this.measureFonts, cp);
  }

  private textHasCjk(text: string): boolean {
    return needsFallback(this.measureFonts, text);
  }

  private collectCjkCodepoints(text: string): void {
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) continue;
      if (this.fkReg.hasGlyphForCodePoint(cp)) continue;
      const idx = this.cjkProviderIndexFor(cp);
      if (idx < 0) continue;
      let set = this.usedCjkCodepoints.get(idx);
      if (!set) { set = new Set<number>(); this.usedCjkCodepoints.set(idx, set); }
      set.add(cp);
      this.usedCjk = true;
    }
  }

  private shapeComplex(text: string, bold: boolean, size: number): { runs: ShapedRun[]; width: number } {
    const runs = shapeAndPlace(text, this.baseDir, size, this.shapingFonts!, bold);
    let width = 0;
    for (const r of runs) width += r.width;
    return { runs, width };
  }

  private flipY(y: number): number { return this.H - y; }

  setLineDash(segments: number[]): void { this.dash = segments.slice(); }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.paintFill([rectangle(x, this.flipY(y + h), w, h)], this.fillStyle);
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    this.paintStroke([rectangle(x, this.flipY(y + h), w, h)], this.strokeStyle);
  }

  beginPath(): void { this.pathBuf = []; }
  moveTo(x: number, y: number): void { this.pathBuf.push(moveTo(x, this.flipY(y))); }
  lineTo(x: number, y: number): void { this.pathBuf.push(lineTo(x, this.flipY(y))); }
  closePath(): void { this.pathBuf.push(closePath()); }
  fill(): void { this.paintFill(this.pathBuf, this.fillStyle); }
  stroke(): void { this.paintStroke(this.pathBuf, this.strokeStyle); }

  roundRect(x: number, y: number, w: number, h: number, r: CornerRadii): void {
    this.pathBuf = [];
    if (w < 0) return;
    const [tl, tr, br, bl] = resolveCornerRadii(r, w, h);
    const fy = (yy: number) => this.flipY(yy);
    const P = this.pathBuf;
    P.push(moveTo(x + tl, fy(y)));
    P.push(lineTo(x + w - tr, fy(y)));
    P.push(appendBezierCurve(x + w - tr + KAPPA * tr, fy(y), x + w, fy(y + tr - KAPPA * tr), x + w, fy(y + tr)));
    P.push(lineTo(x + w, fy(y + h - br)));
    P.push(appendBezierCurve(x + w, fy(y + h - br + KAPPA * br), x + w - br + KAPPA * br, fy(y + h), x + w - br, fy(y + h)));
    P.push(lineTo(x + bl, fy(y + h)));
    P.push(appendBezierCurve(x + bl - KAPPA * bl, fy(y + h), x, fy(y + h - bl + KAPPA * bl), x, fy(y + h - bl)));
    P.push(lineTo(x, fy(y + tl)));
    P.push(appendBezierCurve(x, fy(y + tl - KAPPA * tl), x + tl - KAPPA * tl, fy(y), x + tl, fy(y)));
    P.push(closePath());
  }

  fillText(text: string, x: number, y: number): void {
    if (!text) return;
    const { bold, size } = parseReportFont(this.font);
    const pdfFont = bold ? this.pool.bold : this.pool.regular;
    const metrics = bold ? this.mBold : this.mReg;

    if (this.shapingFonts && hasRtlText(text)) {
      this.checkCoverageComplex(text, bold);
      this.fillTextComplex(text, x, y, bold, size, metrics);
      return;
    }

    text = stripBidiControls(text);
    if (!text) return;

    this.checkCoverage(text, bold ? this.fkBold : this.fkReg);

    if (this.textHasCjk(text)) {
      this.collectCjkCodepoints(text);
      if (this.cjkEmbedReady) this.fillTextCjk(text, x, y, bold, size, metrics);
      return;
    }

    const width = fontAdvanceWidth(bold ? this.fkBold : this.fkReg, text, size);
    const place = this.placeText(x, y, width, size, metrics);
    this.pushText(place, width, [
      beginText(),
      setFontAndSize(bold ? 'F1' : 'F0', size),
      ...laidOutTextOps(pdfFont, text, place.tx, this.flipY(place.baselineY), size),
      endText(),
    ]);
  }

  private placeText(x: number, y: number, width: number, size: number, metrics: FontMetrics): TextPlacement {
    let tx = x;
    if (this.textAlign === 'center') tx = x - width / 2;
    else if (this.textAlign === 'right') tx = x - width;
    const ascentPx = metrics.ascentEm * size;
    const descentPx = metrics.descentEm * size;
    let baselineY = y;
    if (this.textBaseline === 'middle') baselineY = y + (ascentPx + descentPx) / 2;
    else if (this.textBaseline === 'bottom') baselineY = y + descentPx;
    return { tx, baselineY, ascentPx, descentPx };
  }

  private pushText(place: TextPlacement, width: number, textOps: PDFOperator[]): void {
    const c = parseColor(this.fillStyle);
    const ops: PDFOperator[] = c.a < 1
      ? [
        pushGraphicsState(), setGraphicsState(this.pool.registerAlpha(c.a)),
        setFillingRgbColor(c.r, c.g, c.b), ...textOps,
        popGraphicsState(),
      ]
      : [setFillingRgbColor(c.r, c.g, c.b), ...textOps];
    this.texts.push({
      x0: place.tx,
      x1: place.tx + width,
      y0: place.baselineY - place.ascentPx,
      y1: place.baselineY - place.descentPx,
      ops,
    });
  }

  private fillTextComplex(
    text: string, x: number, y: number, bold: boolean, size: number, metrics: FontMetrics,
  ): void {
    const { runs, width } = this.shapeComplex(text, bold, size);
    if (runs.length === 0) return;

    const place = this.placeText(x, y, width, size, metrics);
    const pdfBaselineY = this.flipY(place.baselineY);

    const textOps: PDFOperator[] = [beginText()];
    for (const run of runs) {
      if (run.fontKey === 'F2' || run.fontKey === 'F3') this.usedArabic = true;
      textOps.push(setFontAndSize(run.fontKey as FontKey, size));
      for (const g of run.glyphs) {
        textOps.push(
          setTextMatrix(1, 0, 0, 1, place.tx + g.x, pdfBaselineY + g.y),
          showText(PDFHexString.of(g.hex)),
        );
      }
    }
    textOps.push(endText());
    this.pushText(place, width, textOps);
  }

  private fillTextCjk(
    text: string, x: number, y: number, bold: boolean, size: number, metrics: FontMetrics,
  ): void {
    const runs = splitFallbackRuns(this.measureFonts, text);
    if (runs.length === 0) return;

    const widths = runs.map(r => fallbackRunWidth(this.measureFonts, r, bold, size));
    let total = 0;
    for (const w of widths) total += w;

    const place = this.placeText(x, y, total, size, metrics);
    const pdfBaselineY = this.flipY(place.baselineY);

    const textOps: PDFOperator[] = [beginText()];
    let cursor = place.tx;
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const { fontKey, pdfFont } = this.cjkRunFont(r, bold);
      textOps.push(setFontAndSize(fontKey, size), ...laidOutTextOps(pdfFont, r.str, cursor, pdfBaselineY, size));
      cursor += widths[i];
    }
    textOps.push(endText());
    this.pushText(place, total, textOps);
  }

  private cjkRunFont(
    run: FallbackRun, bold: boolean,
  ): { fontKey: string; pdfFont: PDFFont } {
    if (run.fallback < 0) {
      return bold
        ? { fontKey: 'F1', pdfFont: this.pool.bold }
        : { fontKey: 'F0', pdfFont: this.pool.regular };
    }
    const embed = this.cjkFonts[run.fallback].embed!;
    return bold
      ? { fontKey: embed.keyBold, pdfFont: embed.bold }
      : { fontKey: embed.keyRegular, pdfFont: embed.regular };
  }

  measureText(text: string): { width: number } {
    const { bold, size } = parseReportFont(this.font);
    return { width: measureReportText(this.measureFonts, text, bold, size) };
  }

  private paintFill(pathOps: PDFOperator[], colorStr: string): void {
    if (pathOps.length === 0) return;
    const c = parseColor(colorStr);
    if (c.a < 1) {
      const gs = this.pool.registerAlpha(c.a);
      this.operators.push(
        pushGraphicsState(), setGraphicsState(gs),
        setFillingRgbColor(c.r, c.g, c.b), ...pathOps, fill(),
        popGraphicsState(),
      );
    } else {
      this.operators.push(setFillingRgbColor(c.r, c.g, c.b), ...pathOps, fill());
    }
  }

  private paintStroke(pathOps: PDFOperator[], colorStr: string): void {
    if (pathOps.length === 0) return;
    const c = parseColor(colorStr);
    const pre: PDFOperator[] = [
      setStrokingRgbColor(c.r, c.g, c.b),
      setLineWidth(this.lineWidth),
      setDashPattern(this.dash, 0),
    ];
    if (c.a < 1) {
      const gs = this.pool.registerAlpha(c.a);
      this.operators.push(pushGraphicsState(), setGraphicsState(gs), ...pre, ...pathOps, stroke(), popGraphicsState());
    } else {
      this.operators.push(...pre, ...pathOps, stroke());
    }
  }
}
