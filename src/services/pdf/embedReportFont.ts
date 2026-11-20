// Een rapportletter volledig inbedden, mét de glyphs die de tekstopmaak kiest (issue #1050).
//
// pdf-lib 1.17 (`CustomFontEmbedder`, bij `subset: false`) zet tekst om via `font.layout`: GSUB vervangt daar letters
// door andere glyphs (een ligatuur zoals Carlito "ti", of de doorlopende bovenstreep van Koptisch Ⲁ̅). Maar de
// breedtetabel (`/W`) en de ToUnicode-tabel bouwt het alleen uit de glyphs die rechtstreeks in de cmap staan. Een
// vervangen glyph kreeg zo de standaardbreedte (1000/1000 em, een gat na de glyph) en geen tekst (`bouwlogis ek`, een
// Koptische afkorting zonder streep bij kopiëren en zoeken).
//
// Deze functie bedt de bytes in zoals altijd en onthoudt per letter welke glyphs `encodeText` werkelijk gebruikte,
// met de bronteken(s) die fontkit erbij geeft. Bij het opslaan komen die glyphs in `/W` en in ToUnicode erbij. Dat
// gaat via de interne velden van pdf-lib (`embedder.glyphCache`, `embedder.encodeText`); pdf-lib staat vast op 1.17.1
// en de proef in `check-custom-report-font.ts` (deel G) leest beide tabellen terug uit de echte PDF.
import { PDFHexString, toHexStringOfMinLength, type PDFDocument, type PDFFont } from 'pdf-lib';

/** Wat pdf-lib en fontkit van een glyph gebruiken voor `/W` en ToUnicode. */
interface LaidOutGlyph {
  id: number;
  codePoints: number[];
  advanceWidth: number;
}

/** Het deel van pdf-lib's `CustomFontEmbedder` dat deze functie leest en vervangt. */
interface CustomFontEmbedderInternals {
  font: { layout(text: string, features?: unknown): { glyphs: LaidOutGlyph[] } };
  fontFeatures: unknown;
  glyphCache: { access(): LaidOutGlyph[]; invalidate(): void };
  encodeText(text: string): PDFHexString;
}

/** Bedt de letter volledig in (`subset: false`, zie `paginateVector.ts`) en registreert elke glyph die de tekst gebruikt. */
export async function embedReportFont(doc: PDFDocument, bytes: Uint8Array): Promise<PDFFont> {
  const font = await doc.embedFont(bytes, { subset: false });
  const embedder = (font as unknown as { embedder: CustomFontEmbedderInternals }).embedder;
  const cmapGlyphs = embedder.glyphCache;
  const used = new Map<number, LaidOutGlyph>();

  // Zelfde uitvoer als pdf-lib (één `layout`, glyph-id's als hex), plus het onthouden van de gebruikte glyphs.
  embedder.encodeText = text => {
    const { glyphs } = embedder.font.layout(text, embedder.fontFeatures);
    for (const glyph of glyphs) if (!used.has(glyph.id)) used.set(glyph.id, glyph);
    return PDFHexString.of(glyphs.map(glyph => toHexStringOfMinLength(glyph.id, 4)).join(''));
  };

  // De cmap-glyphs van pdf-lib plus de gebruikte; per id wint de gebruikte, want die draagt de bronteken(s) van de
  // tekst (de ligatuur "fi" leest dan als "fi"). Oplopend op id, zoals `computeWidths` en de ToUnicode-tabel vragen.
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
