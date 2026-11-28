import { PDFHexString, toHexStringOfMinLength, type PDFDocument, type PDFFont } from 'pdf-lib';

interface LaidOutGlyph {
  id: number;
  codePoints: number[];
  advanceWidth: number;
}

interface CustomFontEmbedderInternals {
  font: {
    unitsPerEm: number;
    layout(text: string, features?: unknown): { glyphs: LaidOutGlyph[]; positions: { xOffset: number; yOffset: number }[] };
  };
  fontFeatures: unknown;
  glyphCache: { access(): LaidOutGlyph[]; invalidate(): void };
  encodeText(text: string): PDFHexString;
}

export interface PdfGlyph {
  hex: string;
  advance: number;
  xOffset: number;
  yOffset: number;
}

export interface PdfTextLayout {
  glyphs: PdfGlyph[];
  unitsPerEm: number;
}

const layouts = new WeakMap<PDFFont, (text: string) => PdfTextLayout>();

export async function embedReportFont(doc: PDFDocument, bytes: Uint8Array): Promise<PDFFont> {
  const font = await doc.embedFont(bytes, { subset: false });
  const embedder = (font as unknown as { embedder: CustomFontEmbedderInternals }).embedder;
  const cmapGlyphs = embedder.glyphCache;
  const used = new Map<number, LaidOutGlyph>();

  const layoutText = (text: string): PdfTextLayout => {
    const { glyphs, positions } = embedder.font.layout(text, embedder.fontFeatures);
    for (const glyph of glyphs) if (!used.has(glyph.id)) used.set(glyph.id, glyph);
    return {
      unitsPerEm: embedder.font.unitsPerEm,
      glyphs: glyphs.map((glyph, i) => ({
        hex: toHexStringOfMinLength(glyph.id, 4),
        advance: glyph.advanceWidth,
        xOffset: positions[i].xOffset,
        yOffset: positions[i].yOffset,
      })),
    };
  };
  layouts.set(font, layoutText);
  embedder.encodeText = text => PDFHexString.of(layoutText(text).glyphs.map(glyph => glyph.hex).join(''));

  embedder.glyphCache = {
    access: () => {
      const byId = new Map(cmapGlyphs.access().map(glyph => [glyph.id, glyph] as const));
      for (const [id, glyph] of used) byId.set(id, glyph);
      return [...byId.values()].sort((a, b) => a.id - b.id);
    },
    invalidate: () => cmapGlyphs.invalidate(),
  };
  return font;
}

export function layoutPdfText(font: PDFFont, text: string): PdfTextLayout {
  const layout = layouts.get(font);
  if (!layout) throw new Error('layoutPdfText: lettertype niet via embedReportFont ingebed');
  return layout(text);
}
