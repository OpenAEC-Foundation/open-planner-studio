/**
 * De generieke XLSX-lezer (issue #27, etappe 3 — taak T7).
 *
 * Weet **niets** van voortgang: hij levert het eerste werkblad op als rijen met cellen, plus de
 * datum/percentage-opmaakvlaggen en het datumstelsel. De voortgangsbetekenis geeft
 * `progressImport/parseProgressXlsx.ts` eraan.
 *
 * Drie architectuurbesluiten die je moet kennen vóór je hier iets verandert (X7 van het plan):
 *
 *  1. **Eigen XML-scanner, geen `DOMParser`.** De Node-shim waarmee de planningssuite draait kent
 *     geen attributen — en juist attributen (`r`, `t`, `s`, `numFmtId`, `date1904`) dragen hier alle
 *     betekenis. Los daarvan is een tag-scanner voor vier elementsoorten simpelweg het juiste
 *     gereedschap. De scanner kent zelfsluitende tags, enkele én dubbele quotes, commentaar en
 *     CDATA, en **weigert** entiteitsdeclaraties (`<!DOCTYPE`/`<!ENTITY`): een billion-laughs-DTD is
 *     een weigering, geen parseeropdracht.
 *  2. **Twee passes over dezelfde buffer.** Pass 1 pakt alleen de metadata-parts uit, daaruit volgt
 *     het partpad van het eerste blad, en pass 2 pakt alleen dát part uit. Central directory scannen
 *     is goedkoop, inflaten niet. Nooit "pak alles uit en zoek daarna".
 *  3. **Het rijnummer komt uit het `r`-attribuut, niet uit een teller.** Rijen mogen in een xlsx
 *     ontbreken. Omdat `rowNumber` de sleutel van de handmatige koppelingen is (A11), zou een teller
 *     de overrides stil op de verkeerde rij laten landen.
 *
 * Zonder `sharedStrings` is deze lezer waardeloos: Excel schrijft élke tekstcel bij opslaan als
 * gedeelde string, dus een blad dat de gebruiker in Excel heeft geopend en bewaard zou anders
 * volledig leeg terugkomen.
 */

import {
  ZipCompressionUnsupportedError,
  parseZipEntries,
  type ZipEntry,
  type ZipReadLimits,
} from '@/services/zip/zipReader';
import { unescapeXml } from './xmlText';

export interface XlsxCell {
  /** Kolomindex, 0-gebaseerd, afgeleid uit het `r`-attribuut (A → 0). */
  col: number;
  /** Rauwe tekstwaarde, al ontdaan van sharedStrings-indirectie en XML-escapes. */
  text: string;
  /** Numerieke waarde als de cel een getal droeg. */
  num?: number;
  /** De cel draagt een datum-`numFmt` (ingebouwd 14–22 / 27–36 / 45–47 / 50–58, of custom met y/m/d). */
  isDate?: boolean;
  /** De cel draagt een percentage-`numFmt` (ingebouwd 9/10, of custom met een vrije `%`). */
  isPercent?: boolean;
}

export interface XlsxRow {
  /** Rijnummer uit het `r`-attribuut, 1-gebaseerd. */
  rowNumber: number;
  cells: XlsxCell[];
}

export interface XlsxSheet {
  rows: XlsxRow[];
  epoch1904: boolean;
}

export type XlsxReadIssue =
  | 'notAZip' | 'encrypted' | 'noSheet' | 'tooLarge' | 'tooManyRows' | 'malformed'
  /** Niet het bestand maar de OMGEVING mankeert iets: geen `DecompressionStream`, dus een
   *  gedeflate blad kan hier niet uitgepakt worden. Bewust géén `notAZip`: dat zou de gebruiker
   *  naar het verkeerde bestand laten zoeken. */
  | 'unsupported';

export class XlsxReadError extends Error {
  readonly issue: XlsxReadIssue;
  constructor(issue: XlsxReadIssue, message?: string) {
    super(message ?? issue);
    this.name = 'XlsxReadError';
    this.issue = issue;
  }
}

export interface XlsxLimits {
  /** Gecomprimeerde bestandsgrootte — getoetst vóórdat er iets gealloceerd wordt. */
  readonly maxBytes: number;
  readonly maxUnpackedBytes: number;
  readonly maxEntryBytes: number;
  readonly maxEntries: number;
  readonly maxRatio: number;
  readonly maxRows: number;
  readonly maxCols: number;
  readonly maxSharedStrings: number;
}

export const XLSX_LIMITS: XlsxLimits = {
  maxBytes: 16 * 1024 * 1024,
  maxUnpackedBytes: 64 * 1024 * 1024,
  maxEntryBytes: 32 * 1024 * 1024,
  maxEntries: 512,
  maxRatio: 200,
  maxRows: 50_000,
  maxCols: 256,
  maxSharedStrings: 200_000,
};

/**
 * De naad naar de ZIP-laag. Productie geeft `parseZipEntries` door; een test kan hem vervangen om
 * te zien wélke parts er daadwerkelijk uitgepakt zijn (hardening-checklist: geen module-level
 * singletons, alles injecteerbaar).
 */
export type XlsxZipReader = (
  buffer: ArrayBuffer,
  limits: ZipReadLimits,
  select: (name: string) => boolean,
) => Promise<readonly ZipEntry[]>;

/** De metadata-parts van pass 1 — de enige entries die zonder kennis van het blad nodig zijn. */
export const XLSX_METADATA_PARTS: ReadonlySet<string> = new Set([
  '[Content_Types].xml',
  '_rels/.rels',
  'xl/workbook.xml',
  'xl/_rels/workbook.xml.rels',
  'xl/styles.xml',
  'xl/sharedStrings.xml',
]);

/** CFB/OLE2-magic: een met een wachtwoord beveiligde `.xlsx` is géén ZIP maar een CFB-container. */
const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

// ════════════════════════════════════════════════════════════════════════════════════════════
// XML-scanner
// ════════════════════════════════════════════════════════════════════════════════════════════

export type XmlEvent =
  | { kind: 'open'; name: string; attrs: Record<string, string>; selfClosing: boolean }
  | { kind: 'close'; name: string }
  | { kind: 'text'; value: string };

const NAME_END = /[\s/>]/;

/**
 * Pull-scanner over één XML-part. Bewust géén generieke parser: hij herkent elementen, attributen,
 * tekst, CDATA en commentaar, en verder niets. Alles wat met `<!` begint en geen commentaar of
 * CDATA is (dus `<!DOCTYPE`, `<!ENTITY`, …) is een **weigering**.
 */
export function* scanXml(xml: string): Generator<XmlEvent> {
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) {
      const rest = xml.slice(i);
      if (rest.length > 0) yield { kind: 'text', value: unescapeXml(rest) };
      return;
    }
    if (lt > i) yield { kind: 'text', value: unescapeXml(xml.slice(i, lt)) };

    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      if (end < 0) throw new XlsxReadError('malformed', 'niet-afgesloten commentaar');
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt + 9);
      if (end < 0) throw new XlsxReadError('malformed', 'niet-afgesloten CDATA');
      yield { kind: 'text', value: xml.slice(lt + 9, end) };
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<!', lt)) {
      // `<!DOCTYPE`/`<!ENTITY`: entiteitsdeclaraties worden nooit geïnterpreteerd (XXE /
      // billion-laughs). Weigeren is hier het hele verweer.
      throw new XlsxReadError('malformed', 'entiteitsdeclaratie in het XML-part');
    }
    if (xml.startsWith('<?', lt)) {
      const end = xml.indexOf('?>', lt + 2);
      if (end < 0) throw new XlsxReadError('malformed', 'niet-afgesloten processing instruction');
      i = end + 2;
      continue;
    }
    if (xml.startsWith('</', lt)) {
      const gt = xml.indexOf('>', lt);
      if (gt < 0) throw new XlsxReadError('malformed', 'niet-afgesloten sluittag');
      yield { kind: 'close', name: xml.slice(lt + 2, gt).trim() };
      i = gt + 1;
      continue;
    }

    // Opentag: naam, dan attributen tot een `>` buiten aanhalingstekens.
    let p = lt + 1;
    while (p < xml.length && !NAME_END.test(xml[p]!)) p++;
    const name = xml.slice(lt + 1, p);
    if (name.length === 0) throw new XlsxReadError('malformed', 'tag zonder naam');
    const attrs: Record<string, string> = {};
    let selfClosing = false;
    for (;;) {
      while (p < xml.length && /\s/.test(xml[p]!)) p++;
      if (p >= xml.length) throw new XlsxReadError('malformed', 'niet-afgesloten opentag');
      if (xml[p] === '/') {
        selfClosing = true;
        p++;
        continue;
      }
      if (xml[p] === '>') { p++; break; }
      const attrStart = p;
      while (p < xml.length && xml[p] !== '=' && !/[\s/>]/.test(xml[p]!)) p++;
      const attrName = xml.slice(attrStart, p);
      while (p < xml.length && /\s/.test(xml[p]!)) p++;
      if (xml[p] !== '=') {
        // Attribuut zonder waarde bestaat niet in XML; alles wat er zo uitziet is kapot.
        throw new XlsxReadError('malformed', `attribuut zonder waarde: ${attrName}`);
      }
      p++;
      while (p < xml.length && /\s/.test(xml[p]!)) p++;
      const quote = xml[p];
      if (quote !== '"' && quote !== "'") {
        throw new XlsxReadError('malformed', `ongequote attribuutwaarde: ${attrName}`);
      }
      const valueEnd = xml.indexOf(quote, p + 1);
      if (valueEnd < 0) throw new XlsxReadError('malformed', 'niet-afgesloten attribuutwaarde');
      attrs[attrName] = unescapeXml(xml.slice(p + 1, valueEnd));
      p = valueEnd + 1;
    }
    yield { kind: 'open', name, attrs, selfClosing };
    i = p;
  }
}

/** Het deel van de tagnaam ná een eventuele namespace-prefix (`x:row` ⇒ `row`). */
function localName(name: string): string {
  const colon = name.indexOf(':');
  return colon < 0 ? name : name.slice(colon + 1);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// numFmt-classificatie
// ════════════════════════════════════════════════════════════════════════════════════════════

/** Ingebouwde datum-/tijd-`numFmtId`'s (ECMA-376, §18.8.30). */
function isBuiltinDateFormat(id: number): boolean {
  return (id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47)
    || (id >= 50 && id <= 58);
}

/** Ingebouwde percentageformaten: `0%` en `0.00%`. */
function isBuiltinPercentFormat(id: number): boolean {
  return id === 9 || id === 10;
}

/**
 * Haalt de letterlijke stukken uit een formatcode weg, zodat `"mei"` of `\%` niet als datum- resp.
 * percentageaanwijzing tellen. `[Red]`/`[$-409]` gaan om dezelfde reden weg.
 */
function stripFormatLiterals(code: string): string {
  return code
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '');
}

function customFormatIsDate(code: string): boolean {
  return /[ymd]/i.test(stripFormatLiterals(code));
}

function customFormatIsPercent(code: string): boolean {
  return stripFormatLiterals(code).includes('%');
}

interface StyleTable {
  /** Per `cellXfs`-index: draagt de stijl een datumopmaak? */
  readonly isDate: readonly boolean[];
  readonly isPercent: readonly boolean[];
}

function parseStyles(xml: string): StyleTable {
  const customFormats = new Map<number, string>();
  const isDate: boolean[] = [];
  const isPercent: boolean[] = [];
  let inCellXfs = false;
  for (const ev of scanXml(xml)) {
    if (ev.kind === 'close') {
      if (localName(ev.name) === 'cellXfs') inCellXfs = false;
      continue;
    }
    if (ev.kind !== 'open') continue;
    const tag = localName(ev.name);
    if (tag === 'numFmt') {
      const id = Number(ev.attrs.numFmtId);
      if (Number.isInteger(id)) customFormats.set(id, ev.attrs.formatCode ?? '');
      continue;
    }
    if (tag === 'cellXfs') {
      inCellXfs = true;
      continue;
    }
    if (tag === 'xf' && inCellXfs) {
      const id = Number(ev.attrs.numFmtId ?? '0');
      const custom = customFormats.get(id);
      isDate.push(custom !== undefined ? customFormatIsDate(custom) : isBuiltinDateFormat(id));
      isPercent.push(custom !== undefined ? customFormatIsPercent(custom) : isBuiltinPercentFormat(id));
    }
  }
  return { isDate, isPercent };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// sharedStrings
// ════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Excel schrijft élke tekstcel bij opslaan als index in `sharedStrings.xml`. Rijke tekst valt uiteen
 * in meerdere `<r><t>`-runs binnen één `<si>`; die worden aaneengeplakt, precies zoals Excel ze
 * toont.
 */
function parseSharedStrings(xml: string, max: number): string[] {
  const out: string[] = [];
  let current: string | null = null;
  let inText = false;
  for (const ev of scanXml(xml)) {
    if (ev.kind === 'open') {
      const tag = localName(ev.name);
      if (tag === 'si') {
        if (out.length >= max) throw new XlsxReadError('tooLarge', 'te veel gedeelde strings');
        current = '';
        if (ev.selfClosing) { out.push(''); current = null; }
      } else if (tag === 't' && current !== null && !ev.selfClosing) {
        inText = true;
      }
      continue;
    }
    if (ev.kind === 'text') {
      if (inText && current !== null) current += ev.value;
      continue;
    }
    const tag = localName(ev.name);
    if (tag === 't') inText = false;
    else if (tag === 'si' && current !== null) { out.push(current); current = null; }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// De werkbladscanner
// ════════════════════════════════════════════════════════════════════════════════════════════

/** `C7` ⇒ kolomindex 2. Geeft `undefined` als het `r`-attribuut geen kolomletters draagt. */
export function columnFromCellRef(ref: string | undefined): number | undefined {
  if (ref === undefined) return undefined;
  let col = 0;
  let seen = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) col = col * 26 + (code - 64);
    else if (code >= 97 && code <= 122) col = col * 26 + (code - 96);
    else break;
    seen++;
    if (seen > 3) return undefined; // XFD is de laatste kolom; meer letters is onzin.
  }
  return seen === 0 ? undefined : col - 1;
}

function parseWorksheet(xml: string, shared: readonly string[], styles: StyleTable, limits: XlsxLimits): XlsxRow[] {
  const rows: XlsxRow[] = [];
  let row: XlsxRow | null = null;
  let nextRowNumber = 1;

  // Cel-in-aanbouw.
  let cellRef: string | undefined;
  let cellType = '';
  let styleIndex = -1;
  let inV = false;
  let inIs = false;
  let inT = false;
  let vText = '';
  let isText = '';
  let cellOpen = false;
  let nextCol = 0;

  const flushCell = (): void => {
    if (!cellOpen || row === null) return;
    cellOpen = false;
    const col = columnFromCellRef(cellRef) ?? nextCol;
    nextCol = col + 1;
    if (col >= limits.maxCols) {
      throw new XlsxReadError('malformed', `kolomindex ${col} boven de grens`);
    }
    const raw = vText;
    let text = '';
    let num: number | undefined;
    switch (cellType) {
      case 's': {
        const idx = Number(raw);
        text = Number.isInteger(idx) && idx >= 0 && idx < shared.length ? shared[idx]! : '';
        break;
      }
      case 'inlineStr':
        text = isText;
        break;
      case 'str':
        text = raw;
        break;
      case 'b':
        text = raw.trim() === '1' ? 'TRUE' : 'FALSE';
        num = raw.trim() === '1' ? 1 : 0;
        break;
      case 'e':
        // De rauwe fouttekst (`#DIV/0!`) gaat door, zodat de rij een ZICHTBARE weigering wordt in
        // plaats van stil leeg.
        text = raw;
        break;
      case 'd':
        text = raw;
        break;
      default: {
        text = raw;
        if (raw.trim().length > 0) {
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) num = parsed;
        }
      }
    }
    const isDate = styleIndex >= 0 && styles.isDate[styleIndex] === true;
    const isPercent = styleIndex >= 0 && styles.isPercent[styleIndex] === true;
    if (text.length === 0 && num === undefined && !isDate && !isPercent) return; // lege cel
    row.cells.push({
      col,
      text,
      ...(num !== undefined ? { num } : {}),
      ...(isDate ? { isDate: true } : {}),
      ...(isPercent ? { isPercent: true } : {}),
    });
  };

  for (const ev of scanXml(xml)) {
    if (ev.kind === 'text') {
      if (inV) vText += ev.value;
      else if (inIs && inT) isText += ev.value;
      continue;
    }
    if (ev.kind === 'open') {
      const tag = localName(ev.name);
      if (tag === 'row') {
        const attr = ev.attrs.r;
        const parsed = attr !== undefined ? Number(attr) : NaN;
        const rowNumber = Number.isInteger(parsed) && parsed > 0 ? parsed : nextRowNumber;
        nextRowNumber = rowNumber + 1;
        if (rows.length >= limits.maxRows) {
          throw new XlsxReadError('tooManyRows', 'te veel rijen in het werkblad');
        }
        row = { rowNumber, cells: [] };
        rows.push(row);
        nextCol = 0;
        if (ev.selfClosing) row = null;
        continue;
      }
      if (tag === 'c') {
        flushCell();
        cellRef = ev.attrs.r;
        cellType = ev.attrs.t ?? '';
        styleIndex = ev.attrs.s !== undefined ? Number(ev.attrs.s) : -1;
        if (!Number.isInteger(styleIndex)) styleIndex = -1;
        vText = '';
        isText = '';
        inV = false;
        inIs = false;
        inT = false;
        cellOpen = true;
        if (ev.selfClosing) flushCell();
        continue;
      }
      if (tag === 'v' && cellOpen) { inV = !ev.selfClosing; continue; }
      if (tag === 'is' && cellOpen) { inIs = !ev.selfClosing; continue; }
      if (tag === 't' && inIs) { inT = !ev.selfClosing; continue; }
      continue;
    }
    const tag = localName(ev.name);
    if (tag === 'v') inV = false;
    else if (tag === 't') inT = false;
    else if (tag === 'is') inIs = false;
    else if (tag === 'c') flushCell();
    else if (tag === 'row') { flushCell(); row = null; }
    else if (tag === 'sheetData') { flushCell(); row = null; }
  }
  return rows;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// De pakketlaag
// ════════════════════════════════════════════════════════════════════════════════════════════

const decoder = new TextDecoder();

function textOf(entries: readonly ZipEntry[], name: string): string | undefined {
  const entry = entries.find(e => e.name === name);
  return entry === undefined ? undefined : decoder.decode(entry.data);
}

/** `worksheets/sheet1.xml` relatief aan `xl/` ⇒ `xl/worksheets/sheet1.xml`. */
function resolveTarget(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  return `${base}${target}`;
}

interface WorkbookInfo {
  readonly sheetRelId?: string;
  readonly epoch1904: boolean;
}

function parseWorkbook(xml: string): WorkbookInfo {
  let sheetRelId: string | undefined;
  let epoch1904 = false;
  for (const ev of scanXml(xml)) {
    if (ev.kind !== 'open') continue;
    const tag = localName(ev.name);
    if (tag === 'workbookPr') {
      const raw = ev.attrs.date1904;
      if (raw === '1' || raw === 'true') epoch1904 = true;
      continue;
    }
    if (tag === 'sheet' && sheetRelId === undefined) {
      // Het `r:id`-attribuut draagt de namespace-prefix letterlijk; we matchen op de lokale naam.
      for (const [key, value] of Object.entries(ev.attrs)) {
        if (localName(key) === 'id') { sheetRelId = value; break; }
      }
    }
  }
  return { ...(sheetRelId !== undefined ? { sheetRelId } : {}), epoch1904 };
}

function relationshipTarget(xml: string, relId: string): string | undefined {
  for (const ev of scanXml(xml)) {
    if (ev.kind !== 'open' || localName(ev.name) !== 'Relationship') continue;
    if (ev.attrs.Id === relId) return ev.attrs.Target;
  }
  return undefined;
}

/** Het eerste `Relationship` waarvan het type op `suffix` eindigt. */
function relationshipTargetByType(xml: string, suffix: string): string | undefined {
  for (const ev of scanXml(xml)) {
    if (ev.kind !== 'open' || localName(ev.name) !== 'Relationship') continue;
    if ((ev.attrs.Type ?? '').endsWith(suffix)) return ev.attrs.Target;
  }
  return undefined;
}

function startsWithCfbMagic(bytes: Uint8Array): boolean {
  if (bytes.length < CFB_MAGIC.length) return false;
  return CFB_MAGIC.every((b, i) => bytes[i] === b);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // Een `Uint8Array` kan een venster op een grotere buffer zijn; kopiëren houdt de zip-lezer
  // eerlijk over "wat is dit bestand".
  return bytes.slice().buffer as ArrayBuffer;
}

/**
 * Elke fout uit de ZIP-laag krijgt hier zijn `XlsxReadIssue`. De omgevingsweigering houdt zijn
 * EIGEN reden (`unsupported`) in plaats van als `notAZip` te vervlakken — het bestand mankeert
 * niets.
 */
function asXlsxReadError(err: unknown): XlsxReadError {
  if (err instanceof XlsxReadError) return err;
  if (err instanceof ZipCompressionUnsupportedError) {
    return new XlsxReadError('unsupported', err.message);
  }
  return new XlsxReadError('notAZip', err instanceof Error ? err.message : 'onleesbaar ZIP-archief');
}

function zipLimitsFrom(limits: XlsxLimits): ZipReadLimits {
  return {
    maxEntryBytes: limits.maxEntryBytes,
    maxTotalBytes: limits.maxUnpackedBytes,
    maxEntries: limits.maxEntries,
    maxRatio: limits.maxRatio,
  };
}

/**
 * Leest het **eerste** werkblad van een `.xlsx`. Elke overschrijding en elke structurele twijfel is
 * een `XlsxReadError`, nooit een half resultaat.
 */
export function readXlsxSheet(bytes: Uint8Array, limits: XlsxLimits = XLSX_LIMITS): Promise<XlsxSheet> {
  return readXlsxSheetWith(parseZipEntries, bytes, limits);
}

/** Zelfde lezer, met de ZIP-laag als injecteerbare naad (zie `XlsxZipReader`). */
export async function readXlsxSheetWith(
  readEntries: XlsxZipReader,
  bytes: Uint8Array,
  limits: XlsxLimits = XLSX_LIMITS,
): Promise<XlsxSheet> {
  // Grens vóór allocatie (hardening-checklist): geen kopie, geen view, niets — eerst de weegschaal.
  if (bytes.byteLength > limits.maxBytes) {
    throw new XlsxReadError('tooLarge', 'bestand boven de bytegrens');
  }
  if (startsWithCfbMagic(bytes)) {
    // Een met een wachtwoord beveiligde werkmap is een CFB/OLE2-container met een
    // `EncryptedPackage`-stream, geen ZIP. "Onleesbaar" zou hier de nutteloze melding zijn.
    throw new XlsxReadError('encrypted', 'wachtwoordbeveiligde werkmap');
  }
  if (bytes.byteLength < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new XlsxReadError('notAZip', 'geen ZIP-magic');
  }

  const buffer = toArrayBuffer(bytes);
  const zipLimits = zipLimitsFrom(limits);

  let meta: readonly ZipEntry[];
  try {
    meta = await readEntries(buffer, zipLimits, name => XLSX_METADATA_PARTS.has(name));
  } catch (err) {
    throw asXlsxReadError(err);
  }

  if (textOf(meta, '[Content_Types].xml') === undefined) {
    // Geen OOXML-pakket: wel een ZIP, maar niet er een die een werkmap kan bevatten.
    throw new XlsxReadError('notAZip', 'geen [Content_Types].xml');
  }

  const rootRels = textOf(meta, '_rels/.rels');
  if (rootRels !== undefined) {
    const workbookTarget = relationshipTargetByType(rootRels, '/officeDocument');
    if (workbookTarget !== undefined && resolveTarget('', workbookTarget) !== 'xl/workbook.xml') {
      // Deze lezer pakt in pass 1 uitsluitend de standaardpaden uit; een werkmap die ergens anders
      // woont zou een derde pass vragen. Weigeren is eerlijker dan een leeg blad opleveren.
      throw new XlsxReadError('noSheet', `werkmap op een onverwacht pad: ${workbookTarget}`);
    }
  }

  const workbookXml = textOf(meta, 'xl/workbook.xml');
  if (workbookXml === undefined) throw new XlsxReadError('noSheet', 'geen xl/workbook.xml');
  const workbook = parseWorkbook(workbookXml);

  const workbookRels = textOf(meta, 'xl/_rels/workbook.xml.rels');
  let sheetPath: string | undefined;
  if (workbook.sheetRelId !== undefined && workbookRels !== undefined) {
    const target = relationshipTarget(workbookRels, workbook.sheetRelId);
    if (target !== undefined) sheetPath = resolveTarget('xl/', target);
  }
  if (sheetPath === undefined && workbookRels !== undefined) {
    const target = relationshipTargetByType(workbookRels, '/worksheet');
    if (target !== undefined) sheetPath = resolveTarget('xl/', target);
  }
  if (sheetPath === undefined) throw new XlsxReadError('noSheet', 'geen werkblad in de relaties');

  const stylesXml = textOf(meta, 'xl/styles.xml');
  const styles: StyleTable = stylesXml !== undefined ? parseStyles(stylesXml) : { isDate: [], isPercent: [] };
  const sharedXml = textOf(meta, 'xl/sharedStrings.xml');
  const shared = sharedXml !== undefined ? parseSharedStrings(sharedXml, limits.maxSharedStrings) : [];

  // Pass 2: uitsluitend het bladpart zelf.
  let sheetEntries: readonly ZipEntry[];
  try {
    sheetEntries = await readEntries(buffer, zipLimits, name => name === sheetPath);
  } catch (err) {
    throw asXlsxReadError(err);
  }
  const sheetXml = textOf(sheetEntries, sheetPath);
  if (sheetXml === undefined) throw new XlsxReadError('noSheet', `bladpart ontbreekt: ${sheetPath}`);

  return { rows: parseWorksheet(sheetXml, shared, styles, limits), epoch1904: workbook.epoch1904 };
}
