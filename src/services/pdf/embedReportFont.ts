// Een rapportletter volledig inbedden, en tekst zetten met de glyphs en verschuivingen die de tekstopmaak kiest
// (issue #1050).
//
// pdf-lib 1.17 (`CustomFontEmbedder`, bij `subset: false`) zet tekst om via `font.layout`: GSUB vervangt daar letters
// door andere glyphs (een ligatuur zoals Carlito "ti", of de doorlopende bovenstreep van Koptisch Ⲁ̅). Maar de
// breedtetabel (`/W`) en de ToUnicode-tabel bouwt het alleen uit de glyphs die rechtstreeks in de cmap staan. Een
// vervangen glyph kreeg zo de standaardbreedte (1000/1000 em, een gat na de glyph) en geen tekst (`bouwlogis ek`).
// En GPOS zet een teken zoals die bovenstreep met een eigen verschuiving neer (Noto Sans Coptic: −319 eenheden); één
// `Tj` voor de hele tekst tekent elke glyph op de vorige plus zijn breedte, zonder die verschuiving.
//
// `layoutPdfText` doet daarom één `layout` per tekst en geeft per glyph de id (als hex), de breedte en de
// verschuiving; de tekenaar (`pdfVectorDraw2d.ts`) zet een glyph met verschuiving op zijn eigen plek. Elke gebruikte
// glyph komt, met zijn bronteken(s), bij het opslaan in `/W` en in ToUnicode. Dat gaat via interne velden van pdf-lib
// (`embedder.glyphCache`, `embedder.font`); pdf-lib staat daarom exact op 1.17.1, en de proef in
// `check-custom-report-font.ts` (deel G) leest tekst, breedtes en plaats terug uit de echte PDF.
import { PDFHexString, toHexStringOfMinLength, type PDFDocument, type PDFFont } from 'pdf-lib';

/** Wat pdf-lib en fontkit van een glyph gebruiken voor `/W` en ToUnicode. */
interface LaidOutGlyph {
  id: number;
  codePoints: number[];
  advanceWidth: number;
}

/** Het deel van pdf-lib's `CustomFontEmbedder` dat deze module leest en vervangt. */
interface CustomFontEmbedderInternals {
  font: {
    unitsPerEm: number;
    layout(text: string, features?: unknown): { glyphs: LaidOutGlyph[]; positions: { xOffset: number; yOffset: number }[] };
  };
  fontFeatures: unknown;
  glyphCache: { access(): LaidOutGlyph[]; invalidate(): void };
  encodeText(text: string): PDFHexString;
}

/** Eén glyph zoals de PDF hem tekent; breedte en verschuiving in fonteenheden (`unitsPerEm` per em). */
export interface PdfGlyph {
  /** Glyph-id als 4 hex-tekens (Identity-H). */
  hex: string;
  /** De breedte die de PDF in `/W` voor deze glyph heeft: daarmee schuift de pen op, ook in één `Tj`. */
  advance: number;
  xOffset: number;
  yOffset: number;
}

export interface PdfTextLayout {
  glyphs: PdfGlyph[];
  unitsPerEm: number;
}

const layouts = new WeakMap<PDFFont, (text: string) => PdfTextLayout>();

/** Bedt de letter volledig in (`subset: false`, zie `paginateVector.ts`); tekst gaat daarna via {@link layoutPdfText}. */
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
  // Ook een rechtstreekse `encodeText` registreert zijn glyphs (zelfde uitvoer als pdf-lib).
  embedder.encodeText = text => PDFHexString.of(layoutText(text).glyphs.map(glyph => glyph.hex).join(''));

  // De cmap-glyphs van pdf-lib plus de gebruikte; per id wint de eerst gebruikte, want die draagt de bronteken(s)
  // van de tekst (de ligatuur "fi" leest dan als "fi"; knownbug 1943). Oplopend op id, zoals `computeWidths` en de
  // ToUnicode-tabel vragen.
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

/** De glyphs van `text` in een via {@link embedReportFont} ingebedde letter, met breedte en verschuiving. */
export function layoutPdfText(font: PDFFont, text: string): PdfTextLayout {
  const layout = layouts.get(font);
  if (!layout) throw new Error('layoutPdfText: lettertype niet via embedReportFont ingebed');
  return layout(text);
}
