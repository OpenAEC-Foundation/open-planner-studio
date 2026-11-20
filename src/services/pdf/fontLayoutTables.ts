// Layouttabellen die fontkit niet leest (issue #1050).
//
// @pdf-lib/fontkit 1.1.1, de lezer onder pdf-lib, mist bij een GSUB-regel van type 8 (reverse chaining contextual
// single substitution) het veld `backtrackGlyphCount` en gooit dan 'Not a fixed size'. Zo'n regel staat in gewone
// lettertypen (bijvoorbeeld Noto Sans Coptic). pdf-lib zet elke tekst via `font.layout`, dus één zo'n regel liet de
// hele vector-PDF stuklopen: de export viel terug op raster en elk rapport met dat lettertype werd een plaatje.
//
// Daarom bekijkt deze module vóór het inbedden en meten of fontkit GDEF, GSUB en GPOS kan lezen, tot op het niveau
// van elke subtabel (daar zit de fout). Een tabel die niet te lezen is, gaat uit een kopie van het bestand; de rest
// blijft byte voor byte gelijk. Zonder GSUB tekent de PDF elke letter los (geen ligaturen), wat de meting van het
// rapport toch al aanneemt (`reportTextMeasure.ts` telt advance-breedtes op). Een gezond lettertype komt ongewijzigd
// terug, zonder kopie. Zonder imports: de aanroeper geeft fontkit mee, zodat dit headless te toetsen is.

/** Wat fontkit van een geopend lettertype nodig heeft; een getter op een tabel decodeert hem pas bij lezen. */
interface FontkitTables {
  directory: { tables: Record<string, unknown> };
  [tag: string]: unknown;
}

const LAYOUT_TABLES = ['GDEF', 'GSUB', 'GPOS'] as const;

/** Een lijst uit fontkit: een `LazyArray` (met `toArray`) of een gewone array. */
function items(value: unknown): unknown[] {
  if (value == null) return [];
  const lazy = value as { toArray?: () => unknown[] };
  if (typeof lazy.toArray === 'function') return lazy.toArray();
  return Array.isArray(value) ? value : [];
}

/** Decodeert de tabel tot op elke subtabel (en de regel achter een extension-regel); gooit als fontkit dat niet kan. */
function readTable(font: FontkitTables, tag: (typeof LAYOUT_TABLES)[number]): void {
  const table = font[tag] as Record<string, unknown> | undefined;
  if (!table || tag === 'GDEF') return;
  items(table.scriptList);
  items(table.featureList);
  for (const lookup of items(table.lookupList)) {
    for (const sub of items((lookup as { subTables?: unknown }).subTables)) {
      void (sub as { extension?: unknown } | null)?.extension;
    }
  }
}

/** De layouttabellen in dit lettertype die fontkit niet kan lezen. */
function unreadableLayoutTables(font: FontkitTables): string[] {
  return LAYOUT_TABLES.filter(tag => {
    if (!(tag in font.directory.tables)) return false;
    try { readTable(font, tag); return false; } catch { return true; }
  });
}

/** Een kopie van een los lettertypebestand (geen collectie) zonder de gegeven tabellen. */
function withoutTables(bytes: Uint8Array, drop: readonly string[]): Uint8Array {
  const src = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const records = Array.from({ length: src.getUint16(4) }, (_, i) => {
    const at = 12 + i * 16;
    return {
      tag: String.fromCharCode(...bytes.subarray(at, at + 4)), record: bytes.subarray(at, at + 16),
      offset: src.getUint32(at + 8), length: src.getUint32(at + 12),
    };
  }).filter(r => !drop.includes(r.tag));
  const n = records.length;
  let pos = 12 + n * 16;
  const placed = records.map(r => { const at = pos; pos += (r.length + 3) & ~3; return at; });
  const out = new Uint8Array(pos);
  const dst = new DataView(out.buffer);
  dst.setUint32(0, src.getUint32(0));
  // searchRange, entrySelector en rangeShift volgen uit het aantal tabellen (OpenType, tabeldirectory).
  const entrySelector = Math.floor(Math.log2(n));
  dst.setUint16(4, n);
  dst.setUint16(6, 16 * 2 ** entrySelector);
  dst.setUint16(8, entrySelector);
  dst.setUint16(10, n * 16 - 16 * 2 ** entrySelector);
  records.forEach((r, i) => {
    out.set(r.record, 12 + i * 16);
    dst.setUint32(12 + i * 16 + 8, placed[i]);
    out.set(bytes.subarray(r.offset, r.offset + r.length), placed[i]);
  });
  return out;
}

/**
 * Het lettertype zoals fontkit het kan inbedden en meten: ongewijzigd (dezelfde array) als fontkit elke
 * layouttabel leest, anders een kopie zonder de tabellen die fontkit niet leest.
 */
export function readableLayoutBytes(bytes: Uint8Array, create: (bytes: Uint8Array) => object): Uint8Array {
  const font = create(bytes) as Partial<FontkitTables>;
  if (!font.directory) return bytes; // een collectie: die komt hier niet (een face wordt er eerst uit gehaald)
  const unreadable = unreadableLayoutTables(font as FontkitTables);
  if (unreadable.length === 0) return bytes;
  console.warn(`[fontLayoutTables] fontkit leest ${unreadable.join(', ')} niet; die tabel(len) gaan niet mee in de PDF.`);
  return withoutTables(bytes, unreadable);
}
