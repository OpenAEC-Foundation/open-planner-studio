// Eigen lettertype in rapporten (issue #770, besluit Ethan 14 november 2026): de kern zonder scherm.
//
// Een planner kiest een lettertype van de computer of een lettertypebestand. Deze module leest zo'n bestand
// (`.ttf`, `.otf` of een collectie `.ttc`), zegt per face of de app hem mag en kan gebruiken, kiest per familie
// de gewone en de vette variant, en haalt één face als los bestand uit een collectie. Zonder imports en zonder
// DOM: de planningscheck draait het headless, en de desktopapp leest er de lettertypemappen mee in stukken
// (`ByteReader`), zonder elk bestand helemaal te laden.
//
// WAAROM zelf lezen en niet fontkit: fontkit wil het hele bestand, en voor de lijst van de computer zijn alleen
// de kop, de naamtabel en OS/2 nodig (een paar kilobyte per bestand, tegen tot 20 MB voor een CJK-letter).

/** Leest `length` bytes vanaf `offset`. Geeft aan het eind van het bestand minder terug dan gevraagd. */
export type ByteReader = (offset: number, length: number) => Promise<Uint8Array>;

export function bytesReader(bytes: Uint8Array): ByteReader {
  return async (offset, length) => bytes.subarray(offset, offset + length);
}

/** Eén face in een lettertypebestand. `dirOffset`: waar zijn tabeldirectory staat (0, behalve in een collectie). */
export interface FontFaceInfo {
  dirOffset: number;
  /** Ligt de face in een collectie? Dan moet hij er met {@link extractFace} uit voor PDF en browser. */
  inCollection: boolean;
  family: string;
  subfamily: string;
  postscriptName: string;
  /** OS/2 `usWeightClass` (400 gewoon, 700 vet). */
  weight: number;
  italic: boolean;
  /** OS/2 `fsType`: de inbedrechten. */
  fsType: number;
  /** Heeft een `fvar`-tabel. */
  variable: boolean;
  outlines: 'glyf' | 'cff' | null;
}

/** Waarom de app een face of familie niet gebruikt. De keuzelijst toont de reden erbij. */
export type FontRefusal = 'embeddingRestricted' | 'variable' | 'noOutlines' | 'postscriptOutlines' | 'noRegular';

interface TableRecord { offset: number; length: number }

class FontReadError extends Error {
  constructor(message: string) { super(message); this.name = 'FontReadError'; }
}

async function readExact(read: ByteReader, offset: number, length: number): Promise<DataView> {
  const bytes = await read(offset, length);
  if (bytes.length < length) throw new FontReadError(`Lettertypebestand te kort bij ${offset}+${length}`);
  return new DataView(bytes.buffer, bytes.byteOffset, length);
}

const tagAt = (v: DataView, at: number) => String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));

const SFNT_VERSIONS = new Set([0x00010000, 0x4f54544f /* OTTO */, 0x74727565 /* true */]);

async function readDirectory(read: ByteReader, dirOffset: number): Promise<Map<string, TableRecord>> {
  const head = await readExact(read, dirOffset, 12);
  if (!SFNT_VERSIONS.has(head.getUint32(0))) throw new FontReadError('Geen lettertypebestand');
  const numTables = head.getUint16(4);
  const dir = await readExact(read, dirOffset + 12, numTables * 16);
  const tables = new Map<string, TableRecord>();
  for (let i = 0; i < numTables; i++) {
    tables.set(tagAt(dir, i * 16), { offset: dir.getUint32(i * 16 + 8), length: dir.getUint32(i * 16 + 12) });
  }
  return tables;
}

/** De namen 1, 2, 6, 16 en 17 uit de `name`-tabel; Windows-Unicode (Engels eerst) gaat voor Mac Roman. */
async function readNames(read: ByteReader, table: TableRecord): Promise<Map<number, string>> {
  const v = await readExact(read, table.offset, table.length);
  const count = v.getUint16(2);
  const storage = v.getUint16(4);
  const best = new Map<number, { rank: number; value: string }>();
  for (let i = 0; i < count; i++) {
    const rec = 6 + i * 12;
    if (rec + 12 > table.length) break;
    const platform = v.getUint16(rec);
    const encoding = v.getUint16(rec + 2);
    const language = v.getUint16(rec + 4);
    const nameId = v.getUint16(rec + 6);
    const length = v.getUint16(rec + 8);
    const start = storage + v.getUint16(rec + 10);
    if (![1, 2, 6, 16, 17].includes(nameId) || start + length > table.length) continue;
    let rank: number;
    let value = '';
    if (platform === 3 && (encoding === 1 || encoding === 10)) {
      rank = language === 0x409 ? 0 : 1;
      for (let j = 0; j + 1 < length; j += 2) value += String.fromCharCode(v.getUint16(start + j));
    } else if (platform === 1 && encoding === 0) {
      rank = 2;
      for (let j = 0; j < length; j++) value += String.fromCharCode(v.getUint8(start + j));
    } else if (platform === 0) {
      rank = 1;
      for (let j = 0; j + 1 < length; j += 2) value += String.fromCharCode(v.getUint16(start + j));
    } else continue;
    const current = best.get(nameId);
    if (value.trim() && (!current || rank < current.rank)) best.set(nameId, { rank, value: value.trim() });
  }
  return new Map([...best].map(([id, { value }]) => [id, value]));
}

async function readFace(read: ByteReader, dirOffset: number, inCollection: boolean): Promise<FontFaceInfo> {
  const tables = await readDirectory(read, dirOffset);
  const nameTable = tables.get('name');
  if (!nameTable) throw new FontReadError('Lettertype zonder naamtabel');
  const names = await readNames(read, nameTable);
  const family = names.get(16) ?? names.get(1);
  if (!family) throw new FontReadError('Lettertype zonder familienaam');
  const subfamily = names.get(17) ?? names.get(2) ?? 'Regular';
  let weight = /bold/i.test(subfamily) ? 700 : 400;
  let fsType = 0;
  let italic = /italic|oblique/i.test(subfamily);
  const os2 = tables.get('OS/2');
  if (os2 && os2.length >= 64) {
    const v = await readExact(read, os2.offset, 64);
    weight = v.getUint16(4) || weight;
    fsType = v.getUint16(8);
    italic = italic || (v.getUint16(62) & 0x0001) !== 0;
  }
  return {
    dirOffset, inCollection, family, subfamily,
    postscriptName: names.get(6) ?? `${family}-${subfamily}`.replace(/\s+/g, ''),
    weight, italic, fsType,
    variable: tables.has('fvar'),
    outlines: tables.has('glyf') ? 'glyf' : tables.has('CFF ') ? 'cff' : null,
  };
}

/** Alle faces in een lettertypebestand: één bij `.ttf`/`.otf`, meer bij een collectie. Gooit bij iets anders. */
export async function readFontFaces(read: ByteReader): Promise<FontFaceInfo[]> {
  const head = await readExact(read, 0, 12);
  if (tagAt(head, 0) !== 'ttcf') return [await readFace(read, 0, false)];
  const numFonts = head.getUint32(8);
  if (numFonts === 0 || numFonts > 1000) throw new FontReadError('Lege of kapotte collectie');
  const offsets = await readExact(read, 12, numFonts * 4);
  const faces: FontFaceInfo[] = [];
  for (let i = 0; i < numFonts; i++) faces.push(await readFace(read, offsets.getUint32(i * 4), true));
  return faces;
}

/**
 * Mag en kan de app deze face in een PDF zetten? `null` = ja.
 * - fsType bit 1 (Restricted License) of bit 9 (alleen bitmaps): inbedden verboden.
 * - `fvar`: een variabel lettertype; pdf-lib bedt alleen de standaardstand in, dus vet zou in de PDF niet vet zijn.
 * - Geen `glyf` en geen `CFF `: geen contouren om in te bedden.
 * - `CFF ` (PostScript-contouren, veel `.otf`): pdf-lib 1.17 herkent ze niet (`isCFF` leest `font.cff`, dat
 *   @pdf-lib/fontkit niet heeft) en schrijft ze als TrueType-letter in; Poppler meldt dan een verkeerd
 *   lettertypetype. Tot dat werkt weigert de app ze met een eigen reden.
 */
export function faceRefusal(face: FontFaceInfo): FontRefusal | null {
  if ((face.fsType & 0x0002) !== 0 || (face.fsType & 0x0200) !== 0) return 'embeddingRestricted';
  if (face.variable) return 'variable';
  if (face.outlines === null) return 'noOutlines';
  if (face.outlines === 'cff') return 'postscriptOutlines';
  return null;
}

/** Een familie zoals de keuzelijst haar toont: de gewone en (als die er is) de vette variant, of een reden. */
export interface FontFamilyChoice<F extends FontFaceInfo = FontFaceInfo> {
  family: string;
  regular: F | null;
  /** `null`: geen vette variant; de vette tekst komt dan in de gewone letter (besluit 3a). */
  bold: F | null;
  refusal: FontRefusal | null;
}

/**
 * Groepeert faces per familie en kiest per familie de gewone en de vette variant. Cursief telt niet mee.
 * Gewoon: het gewicht het dichtst bij 400. Vet: minstens 200 zwaarder dan gewoon, het dichtst bij 700. Een
 * geweigerde vette variant valt weg; een geweigerde gewone variant weigert de hele familie. Gesorteerd op naam.
 */
export function groupFontFamilies<F extends FontFaceInfo>(faces: readonly F[]): FontFamilyChoice<F>[] {
  const byFamily = new Map<string, F[]>();
  for (const face of faces) {
    const key = face.family.toLocaleLowerCase('en');
    const list = byFamily.get(key);
    if (list) list.push(face); else byFamily.set(key, [face]);
  }
  const closest = (list: F[], target: number) => list.reduce<F | null>(
    (best, f) => (!best || Math.abs(f.weight - target) < Math.abs(best.weight - target) ? f : best), null);
  const result = [...byFamily.values()].map((list): FontFamilyChoice<F> => {
    const upright = list.filter(f => !f.italic);
    const regular = closest(upright, 400);
    if (!regular) return { family: list[0].family, regular: null, bold: null, refusal: 'noRegular' };
    const refusal = faceRefusal(regular);
    if (refusal) return { family: regular.family, regular, bold: null, refusal };
    const bold = closest(upright.filter(f => f.weight >= regular.weight + 200 && faceRefusal(f) === null), 700);
    return { family: regular.family, regular, bold, refusal: null };
  });
  return result.sort((a, b) => a.family.localeCompare(b.family, 'en', { sensitivity: 'base' }));
}

/**
 * Eén face als los lettertypebestand. Een los bestand komt ongewijzigd terug; uit een collectie bouwt dit een
 * nieuw bestand met alleen de tabellen van die face. Nodig omdat pdf-lib en de browser (`@font-face`) uit een
 * collectie niet de goede face kiezen.
 */
export async function extractFace(read: ByteReader, face: FontFaceInfo): Promise<Uint8Array> {
  // Een los bestand: het hele bestand (de lezer geeft aan het eind minder terug dan gevraagd).
  if (!face.inCollection) return (await read(0, Number.MAX_SAFE_INTEGER)).slice();
  const head = await readExact(read, face.dirOffset, 12);
  const tables = [...(await readDirectory(read, face.dirOffset))];
  const dirBytes = await read(face.dirOffset + 12, tables.length * 16);
  let pos = 12 + tables.length * 16;
  const placed = tables.map(([, t]) => { const at = pos; pos += (t.length + 3) & ~3; return at; });
  const out = new Uint8Array(pos);
  const ov = new DataView(out.buffer);
  out.set(new Uint8Array(head.buffer, head.byteOffset, 12));
  out.set(dirBytes, 12);
  for (let i = 0; i < tables.length; i++) {
    const t = tables[i][1];
    ov.setUint32(12 + i * 16 + 8, placed[i]);
    const data = await read(t.offset, t.length);
    if (data.length < t.length) throw new FontReadError('Collectie te kort');
    out.set(data, placed[i]);
  }
  return out;
}
