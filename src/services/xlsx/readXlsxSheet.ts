import {
  ZipCompressionUnsupportedError,
  parseZipEntries,
  type ZipEntry,
  type ZipReadLimits,
} from '@/services/zip/zipReader';
import { unescapeXml } from './xmlText';

export interface XlsxCell {
  col: number;
  text: string;
  num?: number;
  isDate?: boolean;
  hasTime?: boolean;
  isPercent?: boolean;
}

export interface XlsxRow {
  rowNumber: number;
  cells: XlsxCell[];
}

export interface XlsxSheet {
  rows: XlsxRow[];
  epoch1904: boolean;
}

export type XlsxReadIssue =
  | 'notAZip' | 'encrypted' | 'noSheet' | 'tooLarge' | 'tooManyRows' | 'malformed'
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

export type XlsxZipReader = (
  buffer: ArrayBuffer,
  limits: ZipReadLimits,
  select: (name: string) => boolean,
) => Promise<readonly ZipEntry[]>;

export const XLSX_METADATA_PARTS: ReadonlySet<string> = new Set([
  '[Content_Types].xml',
  '_rels/.rels',
  'xl/workbook.xml',
  'xl/_rels/workbook.xml.rels',
  'xl/styles.xml',
  'xl/sharedStrings.xml',
]);

const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export type XmlEvent =
  | { kind: 'open'; name: string; attrs: Record<string, string>; selfClosing: boolean }
  | { kind: 'close'; name: string }
  | { kind: 'text'; value: string };

const NAME_END = /[\s/>]/;

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

function localName(name: string): string {
  const colon = name.indexOf(':');
  return colon < 0 ? name : name.slice(colon + 1);
}

function isBuiltinDateFormat(id: number): boolean {
  return (id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47)
    || (id >= 50 && id <= 58);
}

function isBuiltinTimeFormat(id: number): boolean {
  return id === 22;
}

function isBuiltinPercentFormat(id: number): boolean {
  return id === 9 || id === 10;
}

function stripFormatLiterals(code: string): string {
  return code
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '');
}

function customFormatIsDate(code: string): boolean {
  return /[ymd]/i.test(stripFormatLiterals(code));
}

function formatSections(code: string): string[] {
  const sections: string[] = [];
  let current = '';
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]!;
    if (ch === '"') {
      const end = code.indexOf('"', i + 1);
      const stop = end < 0 ? code.length : end + 1;
      current += code.slice(i, stop);
      i = stop - 1;
    } else if (ch === '[') {
      const end = code.indexOf(']', i + 1);
      const stop = end < 0 ? code.length : end + 1;
      current += code.slice(i, stop);
      i = stop - 1;
    } else if (ch === '\\' || ch === '_' || ch === '*') {
      current += code.slice(i, i + 2);
      i++;
    } else if (ch === ';') {
      sections.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  sections.push(current);
  return sections;
}

function bracketCodes(section: string): string[] {
  const codes: string[] = [];
  for (let i = 0; i < section.length; i++) {
    const ch = section[i]!;
    if (ch === '"') {
      const end = section.indexOf('"', i + 1);
      i = end < 0 ? section.length : end;
    } else if (ch === '[') {
      const end = section.indexOf(']', i + 1);
      codes.push(section.slice(i + 1, end < 0 ? section.length : end));
      i = end < 0 ? section.length : end;
    } else if (ch === '\\' || ch === '_' || ch === '*') {
      i++;
    }
  }
  return codes;
}

function sectionCondition(section: string): ((value: number) => boolean) | undefined {
  let m: RegExpExecArray | null = null;
  for (const code of bracketCodes(section)) {
    m = /^\s*(<=|>=|<>|<|>|=)\s*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*$/.exec(code);
    if (m) break;
  }
  if (!m) return undefined;
  const limit = Number(m[2]);
  switch (m[1]) {
    case '<': return v => v < limit;
    case '<=': return v => v <= limit;
    case '>': return v => v > limit;
    case '>=': return v => v >= limit;
    case '=': return v => v === limit;
    default: return v => v !== limit;
  }
}

function activeSection(code: string, value: number | undefined): string {
  const sections = formatSections(code);
  if (value === undefined) return sections[0]!;
  const conditions = sections.map(sectionCondition);
  if (conditions.some(c => c !== undefined)) {
    for (let i = 0; i < sections.length; i++) {
      const condition = conditions[i];
      if (condition === undefined || condition(value)) return sections[i]!;
    }
    return sections[0]!;
  }
  if (value < 0) return sections[1] ?? sections[0]!;
  if (value === 0) return sections[2] ?? sections[0]!;
  return sections[0]!;
}

function sectionShowsMoment(section: string): boolean {
  let clock = false;
  let date = false;
  for (let i = 0; i < section.length; i++) {
    const ch = section[i]!;
    if (ch === '"') {
      const end = section.indexOf('"', i + 1);
      i = end < 0 ? section.length : end;
    } else if (ch === '[') {
      const end = section.indexOf(']', i + 1);
      const inner = section.slice(i + 1, end < 0 ? section.length : end);
      if (/^(?:h+|s+)$/i.test(inner)) clock = true;
      i = end < 0 ? section.length : end;
    } else if (ch === '\\' || ch === '_' || ch === '*') {
      i++;
    } else if (ch === 'h' || ch === 'H' || ch === 's' || ch === 'S') {
      clock = true;
    } else if (ch === 'y' || ch === 'Y' || ch === 'd' || ch === 'D') {
      date = true;
    }
  }
  return clock && date;
}

function customFormatHasTime(code: string, value: number | undefined): boolean {
  return sectionShowsMoment(activeSection(code, value));
}

function customFormatIsPercent(code: string): boolean {
  return stripFormatLiterals(code).includes('%');
}

interface StyleTable {
  readonly isDate: readonly boolean[];
  readonly hasTime: readonly (boolean | string)[];
  readonly isPercent: readonly boolean[];
}

function parseStyles(xml: string): StyleTable {
  const customFormats = new Map<number, string>();
  const isDate: boolean[] = [];
  const hasTime: (boolean | string)[] = [];
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
      hasTime.push(custom !== undefined ? custom : isBuiltinTimeFormat(id));
      isPercent.push(custom !== undefined ? customFormatIsPercent(custom) : isBuiltinPercentFormat(id));
    }
  }
  return { isDate, hasTime, isPercent };
}

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
    if (seen > 3) return undefined;
  }
  return seen === 0 ? undefined : col - 1;
}

function parseWorksheet(xml: string, shared: readonly string[], styles: StyleTable, limits: XlsxLimits): XlsxRow[] {
  const rows: XlsxRow[] = [];
  let row: XlsxRow | null = null;
  let nextRowNumber = 1;
  let lastRowNumber = 0;

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
    if (col < nextCol) {
      throw new XlsxReadError(
        'malformed',
        `kolomindex ${col} is niet oplopend binnen rij ${row.rowNumber}`,
      );
    }
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
    const clock = isDate ? styles.hasTime[styleIndex] : undefined;
    const hasTime = typeof clock === 'string' ? customFormatHasTime(clock, num) : clock === true;
    const isPercent = styleIndex >= 0 && styles.isPercent[styleIndex] === true;
    if (text.length === 0 && num === undefined && !isDate && !isPercent) return;
    row.cells.push({
      col,
      text,
      ...(num !== undefined ? { num } : {}),
      ...(isDate ? { isDate: true } : {}),
      ...(hasTime ? { hasTime: true } : {}),
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
        if (rowNumber <= lastRowNumber) {
          throw new XlsxReadError(
            'malformed',
            `rijnummer ${rowNumber} is niet oplopend (na ${lastRowNumber})`,
          );
        }
        lastRowNumber = rowNumber;
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

const decoder = new TextDecoder();

function textOf(entries: readonly ZipEntry[], name: string): string | undefined {
  const entry = entries.find(e => e.name === name);
  return entry === undefined ? undefined : decoder.decode(entry.data);
}

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
  return bytes.slice().buffer as ArrayBuffer;
}

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

export function readXlsxSheet(bytes: Uint8Array, limits: XlsxLimits = XLSX_LIMITS): Promise<XlsxSheet> {
  return readXlsxSheetWith(parseZipEntries, bytes, limits);
}

export async function readXlsxSheetWith(
  readEntries: XlsxZipReader,
  bytes: Uint8Array,
  limits: XlsxLimits = XLSX_LIMITS,
): Promise<XlsxSheet> {
  if (bytes.byteLength > limits.maxBytes) {
    throw new XlsxReadError('tooLarge', 'bestand boven de bytegrens');
  }
  if (startsWithCfbMagic(bytes)) {
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
    throw new XlsxReadError('notAZip', 'geen [Content_Types].xml');
  }

  const rootRels = textOf(meta, '_rels/.rels');
  if (rootRels !== undefined) {
    const workbookTarget = relationshipTargetByType(rootRels, '/officeDocument');
    if (workbookTarget !== undefined && resolveTarget('', workbookTarget) !== 'xl/workbook.xml') {
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
  const styles: StyleTable = stylesXml !== undefined ? parseStyles(stylesXml) : { isDate: [], hasTime: [], isPercent: [] };
  const sharedXml = textOf(meta, 'xl/sharedStrings.xml');
  const shared = sharedXml !== undefined ? parseSharedStrings(sharedXml, limits.maxSharedStrings) : [];

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
