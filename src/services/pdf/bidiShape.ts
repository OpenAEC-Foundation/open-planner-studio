// @ts-expect-error -- bidi-js heeft geen type-declaraties; hieronder lokaal getypeerd.
import bidiFactoryUntyped from 'bidi-js';

interface BidiApi {
  getEmbeddingLevels(
    text: string,
    baseDirection?: 'ltr' | 'rtl' | 'auto',
  ): { levels: Uint8Array };
}
const bidiFactory = bidiFactoryUntyped as unknown as () => BidiApi;

export interface ShapeFontkitFont {
  unitsPerEm: number;
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
  hasGlyphForCodePoint?(codePoint: number): boolean;
}

export interface ShapingFonts {
  latinRegular: ShapeFontkitFont;
  latinBold: ShapeFontkitFont;
  arabicRegular: ShapeFontkitFont;
  arabicBold: ShapeFontkitFont;
}

export type FontKey = 'F0' | 'F1' | 'F2' | 'F3';

export interface PlacedGlyph {
  gid: number;
  hex: string;
  x: number;
  y: number;
  advance: number;
}

export interface ShapedRun {
  glyphHex: string;
  glyphs: PlacedGlyph[];
  fontKey: FontKey;
  xStart: number;
  width: number;
}

export interface RawRun {
  text: string;
  level: number;
  dir: 'ltr' | 'rtl';
  fontKey: FontKey;
  glyphIds: number[];
  advances: number[];
  xOffsets: number[];
  yOffsets: number[];
}

const bidi = bidiFactory();

const HAS_LETTER = /\p{L}/u;

export function isArabicScriptCp(cp: number): boolean {
  return (
    (cp >= 0x0600 && cp <= 0x06ff) ||
    (cp >= 0x0750 && cp <= 0x077f) ||
    (cp >= 0x08a0 && cp <= 0x08ff) ||
    (cp >= 0xfb50 && cp <= 0xfdff) ||
    (cp >= 0xfe70 && cp <= 0xfeff)
  );
}

export function isBidiControlCp(cp: number): boolean {
  return cp === 0x200e || cp === 0x200f || cp === 0x061c || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069);
}

const BIDI_CONTROLS = /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g;

export function stripBidiControls(text: string): string {
  return text.replace(BIDI_CONTROLS, '');
}

export function isNeutralCp(cp: number): boolean {
  return (
    cp === 0x20 || cp === 0x09 || cp === 0x0a || cp === 0x0d ||
    cp === 0x00a0 ||
    (cp >= 0x2000 && cp <= 0x206f)
  );
}

function fontClassFor(
  cp: number,
  arabicHasGlyph?: (cp: number) => boolean,
): 'latin' | 'arabic' {
  if (isArabicScriptCp(cp)) return 'arabic';
  if (isNeutralCp(cp)) return arabicHasGlyph && !arabicHasGlyph(cp) ? 'latin' : 'arabic';
  return 'latin';
}

function pickFont(
  cls: 'latin' | 'arabic',
  bold: boolean,
  fonts: ShapingFonts,
): { fk: ShapeFontkitFont; fontKey: FontKey } {
  if (cls === 'arabic') {
    return bold
      ? { fk: fonts.arabicBold, fontKey: 'F3' }
      : { fk: fonts.arabicRegular, fontKey: 'F2' };
  }
  return bold
    ? { fk: fonts.latinBold, fontKey: 'F1' }
    : { fk: fonts.latinRegular, fontKey: 'F0' };
}

interface LogicalRun {
  start: number;
  end: number;
  level: number;
  cls: 'latin' | 'arabic';
}

function segmentRuns(
  text: string,
  baseDir: 'ltr' | 'rtl',
  arabicHasGlyph?: (cp: number) => boolean,
): LogicalRun[] {
  const { levels } = bidi.getEmbeddingLevels(text, baseDir);
  const runs: LogicalRun[] = [];
  let start = 0;
  let curLevel = levels[0] ?? (baseDir === 'rtl' ? 1 : 0);
  let curCls = fontClassFor(text.charCodeAt(0), arabicHasGlyph);
  for (let i = 1; i <= text.length; i++) {
    const atEnd = i === text.length;
    const lvl = atEnd ? -1 : levels[i];
    const cls = atEnd ? curCls : fontClassFor(text.charCodeAt(i), arabicHasGlyph);
    if (atEnd || lvl !== curLevel || cls !== curCls) {
      runs.push({ start, end: i, level: curLevel, cls: curCls });
      start = i;
      curLevel = lvl;
      curCls = cls;
    }
  }
  return runs;
}

function reorderL2(runs: LogicalRun[]): LogicalRun[] {
  if (runs.length === 0) return runs;
  let maxLevel = 0;
  let minOdd = Infinity;
  for (const r of runs) {
    if (r.level > maxLevel) maxLevel = r.level;
    if ((r.level & 1) === 1 && r.level < minOdd) minOdd = r.level;
  }
  if (minOdd === Infinity) return runs;
  const out = runs.slice();
  for (let L = maxLevel; L >= minOdd; L--) {
    let i = 0;
    while (i < out.length) {
      if (out[i].level >= L) {
        let j = i;
        while (j + 1 < out.length && out[j + 1].level >= L) j++;
        let a = i;
        let b = j;
        while (a < b) {
          const t = out[a];
          out[a] = out[b];
          out[b] = t;
          a++;
          b--;
        }
        i = j + 1;
      } else {
        i++;
      }
    }
  }
  return out;
}

function gidHex(id: number): string {
  return (id & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

export function shapeAndPlace(
  text: string,
  baseDir: 'ltr' | 'rtl',
  size: number,
  fonts: ShapingFonts,
  bold = false,
): ShapedRun[] {
  const raw = layoutRuns(text, baseDir, fonts, bold, size);
  const out: ShapedRun[] = [];
  let x = 0;
  for (const r of raw) {
    const upem = fkUpem(r);
    const s = size / upem;
    const glyphs: PlacedGlyph[] = [];
    let pen = x;
    for (let i = 0; i < r.glyphIds.length; i++) {
      const adv = r.advances[i] * s;
      glyphs.push({
        gid: r.glyphIds[i],
        hex: gidHex(r.glyphIds[i]),
        x: pen + r.xOffsets[i] * s,
        y: r.yOffsets[i] * s,
        advance: adv,
      });
      pen += adv;
    }
    out.push({
      glyphHex: r.glyphIds.map(gidHex).join(''),
      glyphs,
      fontKey: r.fontKey,
      xStart: x,
      width: r._width,
    });
    x += r._width;
  }
  return out;
}

function fkUpem(r: RawRunSized): number {
  return r._upem;
}

interface RawRunSized extends RawRun {
  _width: number;
  _upem: number;
}

export function layoutRuns(
  text: string,
  baseDir: 'ltr' | 'rtl',
  fonts: ShapingFonts,
  bold = false,
  size = 1,
): RawRunSized[] {
  if (!text) return [];
  const arabicHasGlyph = fonts.arabicRegular.hasGlyphForCodePoint
    ? (cp: number) => fonts.arabicRegular.hasGlyphForCodePoint!(cp)
    : undefined;
  const logical = segmentRuns(text, baseDir, arabicHasGlyph);
  const visual = reorderL2(logical);
  const runs: RawRunSized[] = [];
  for (const lr of visual) {
    const str = stripBidiControls(text.slice(lr.start, lr.end));
    const dir: 'ltr' | 'rtl' = (lr.level & 1) === 1 ? 'rtl' : 'ltr';
    const { fk, fontKey } = pickFont(lr.cls, bold, fonts);
    const script = lr.cls === 'latin' && !HAS_LETTER.test(str) ? 'latn' : undefined;
    const gr = str ? fk.layout(str, undefined, script, undefined, dir) : { glyphs: [], positions: [] };
    const glyphIds = gr.glyphs.map(g => g.id);
    const advances = gr.positions.map(p => p.xAdvance);
    const xOffsets = gr.positions.map(p => p.xOffset ?? 0);
    const yOffsets = gr.positions.map(p => p.yOffset ?? 0);
    const upem = fk.unitsPerEm || 1000;
    let sum = 0;
    for (const a of advances) sum += a;
    runs.push({
      text: str,
      level: lr.level,
      dir,
      fontKey,
      glyphIds,
      advances,
      xOffsets,
      yOffsets,
      _width: (sum * size) / upem,
      _upem: upem,
    });
  }
  return runs;
}
