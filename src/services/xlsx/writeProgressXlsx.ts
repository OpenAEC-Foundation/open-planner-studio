import type { Task } from '@/types/task';
import { encodeProgressExportState } from '@/services/progressImport/exportState';
import { escapeXmlText, escapeXmlAttr } from '@/services/xlsx/xmlText';
import { isoHasClock, isoToSerial } from '@/services/xlsx/serialDate';
import { writeZip } from '@/services/zip/zipWriter';
import { shownStart, shownFinish } from '@/utils/taskDates';

export type ProgressSheetColumnKey =
  | 'OPS Task ID' | 'WBS' | 'Name' | 'Start' | 'Finish'
  | 'Completion (%)' | 'Actual Start' | 'Actual Finish' | 'OPS Export';

export interface ProgressXlsxText {
  headerNotes?: Partial<Record<ProgressSheetColumnKey, string>>;
  summaryNote?: string;
  sheetName?: string;
  validation?: { percentTitle: string; percentError: string; dateTitle: string; dateError: string };
}

export interface ProgressXlsxOptions {
  exportedAt?: string;
}

type ColumnKind = 'text' | 'date' | 'percent';

interface ColumnSpec {
  key: ProgressSheetColumnKey;
  kind: ColumnKind;
  editable: boolean;
}

const COLUMNS: readonly ColumnSpec[] = [
  { key: 'OPS Task ID', kind: 'text', editable: false },
  { key: 'WBS', kind: 'text', editable: false },
  { key: 'Name', kind: 'text', editable: false },
  { key: 'Start', kind: 'date', editable: false },
  { key: 'Finish', kind: 'date', editable: false },
  { key: 'Completion (%)', kind: 'percent', editable: true },
  { key: 'Actual Start', kind: 'date', editable: true },
  { key: 'Actual Finish', kind: 'date', editable: true },
];

const EXPORT_STATE_KEY: ProgressSheetColumnKey = 'OPS Export';

function columnLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

const STYLE = {
  default: 0,
  header: 1,
  roText: 2,
  roDate: 3,
  roDateTime: 4,
  fillText: 5,
  fillPercent: 6,
  fillDate: 7,
  fillDateTime: 8,
  summary: 9,
} as const;

function columnStyle(col: ColumnSpec): number {
  if (!col.editable) return col.kind === 'date' ? STYLE.roDate : STYLE.roText;
  if (col.kind === 'percent') return STYLE.fillPercent;
  if (col.kind === 'date') return STYLE.fillDate;
  return STYLE.fillText;
}

function percentValue(completion: number): number {
  if (!Number.isFinite(completion)) return 0;
  const clamped = Math.min(1, Math.max(0, completion));
  return Math.round(clamped * 1_000_000) / 10_000;
}

function serialText(serial: number): string {
  if (Number.isInteger(serial)) return String(serial);
  return String(Number(serial.toFixed(6)));
}

function displayText(kind: ColumnKind, raw: string): string {
  if (kind !== 'date') return raw;
  const serial = isoToSerial(raw);
  if (serial === undefined) return raw;
  return isoHasClock(raw) ? '0000-00-00 00:00' : '0000-00-00';
}

function inlineStringCell(ref: string, style: number, value: string): string {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXmlText(value)}</t></is></c>`;
}

function numberCell(ref: string, style: number, value: string): string {
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

function dataCell(ref: string, col: ColumnSpec, raw: string, marked: boolean): string {
  if (marked) return raw ? inlineStringCell(ref, STYLE.summary, raw) : '';
  if (!raw) return '';
  if (col.kind === 'date') {
    const serial = isoToSerial(raw);
    if (serial === undefined) {
      return inlineStringCell(ref, col.editable ? STYLE.fillText : STYLE.roText, raw);
    }
    const dated = isoHasClock(raw)
      ? (col.editable ? STYLE.fillDateTime : STYLE.roDateTime)
      : (col.editable ? STYLE.fillDate : STYLE.roDate);
    return numberCell(ref, dated, serialText(serial));
  }
  if (col.kind === 'percent') return numberCell(ref, STYLE.fillPercent, raw);
  return inlineStringCell(ref, col.editable ? STYLE.fillText : STYLE.roText, raw);
}

function rowValues(task: Task, marked: boolean, summaryNote: string): readonly string[] {
  return [
    task.id,
    task.wbsCode,
    task.name,
    shownStart(task),
    shownFinish(task),
    marked ? summaryNote : String(percentValue(task.time.completion)),
    marked ? summaryNote : (task.time.actualStart ?? ''),
    marked ? summaryNote : (task.time.actualFinish ?? ''),
  ];
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function sanitizeSheetName(name: string | undefined): string {
  const cleaned = (name ?? '')
    .replace(/[[\]:*?/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31)
    .replace(/^'+|'+$/g, '')
    .trim();
  return cleaned.length > 0 ? cleaned : 'Progress';
}

function columnWidth(maxChars: number): number {
  const raw = maxChars * 1.05 + 2;
  return Math.round(Math.min(46, Math.max(10, raw)) * 100) / 100;
}

function buildContentTypes(): string {
  return `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>';
}

function buildRootRels(): string {
  return `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>`
    + '</Relationships>';
}

function buildWorkbook(sheetName: string): string {
  return `${XML_DECL}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
    + `<sheets><sheet name="${escapeXmlAttr(sheetName)}" sheetId="1" r:id="rId1"/></sheets>`
    + '</workbook>';
}

function buildWorkbookRels(): string {
  return `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>`
    + `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>`
    + '</Relationships>';
}

function buildStyles(): string {
  const numFmts = [
    '<numFmt numFmtId="164" formatCode="yyyy-mm-dd"/>',
    '<numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm"/>',
    '<numFmt numFmtId="166" formatCode="0.####"/>',
  ];
  const fonts = [
    '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>',
  ];
  const fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const cellStyleXfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>'];

  const xf = (opts: {
    numFmtId?: number; fontId?: number; fillId?: number;
    locked?: boolean; wrap?: boolean;
  }): string => {
    const numFmtId = opts.numFmtId ?? 0;
    const head = [
      `<xf numFmtId="${numFmtId}" fontId="${opts.fontId ?? 0}" fillId="${opts.fillId ?? 0}" borderId="0" xfId="0"`,
      numFmtId !== 0 ? ' applyNumberFormat="1"' : '',
      opts.fontId ? ' applyFont="1"' : '',
      opts.fillId ? ' applyFill="1"' : '',
      opts.wrap ? ' applyAlignment="1"' : '',
      opts.locked === undefined ? '' : ' applyProtection="1"',
    ].join('');
    const children = `${opts.wrap ? '<alignment vertical="top" wrapText="1"/>' : ''}`
      + (opts.locked === undefined ? '' : `<protection locked="${opts.locked ? 1 : 0}"/>`);
    return children ? `${head}>${children}</xf>` : `${head}/>`;
  };

  const cellXfs = [
    xf({}),
    xf({ fontId: 1, wrap: true, locked: true }),
    xf({ locked: true }),
    xf({ numFmtId: 164, locked: true }),
    xf({ numFmtId: 165, locked: true }),
    xf({ locked: false }),
    xf({ numFmtId: 166, locked: false }),
    xf({ numFmtId: 164, locked: false }),
    xf({ numFmtId: 165, locked: false }),
    xf({ fillId: 1, wrap: true, locked: true }),
  ];

  const group = (tag: string, items: readonly string[]): string =>
    `<${tag} count="${items.length}">${items.join('')}</${tag}>`;

  return `${XML_DECL}<styleSheet xmlns="${NS_MAIN}">`
    + group('numFmts', numFmts)
    + group('fonts', fonts)
    + group('fills', fills)
    + group('borders', borders)
    + group('cellStyleXfs', cellStyleXfs)
    + group('cellXfs', cellXfs)
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '<dxfs count="0"/>'
    + '<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>'
    + '</styleSheet>';
}

function validationXml(opts: {
  type: 'decimal' | 'date';
  sqref: string;
  f1: string;
  f2: string;
  title?: string;
  error?: string;
  prompt?: string;
}): string {
  const attrs = [
    `type="${opts.type}"`,
    'operator="between"',
    'allowBlank="1"',
    `showInputMessage="${opts.prompt ? '1' : '0'}"`,
    'showErrorMessage="1"',
    'errorStyle="stop"',
  ];
  if (opts.title) attrs.push(`errorTitle="${escapeXmlAttr(opts.title)}"`);
  if (opts.error) attrs.push(`error="${escapeXmlAttr(opts.error)}"`);
  if (opts.prompt) {
    if (opts.title) attrs.push(`promptTitle="${escapeXmlAttr(opts.title)}"`);
    attrs.push(`prompt="${escapeXmlAttr(opts.prompt)}"`);
  }
  attrs.push(`sqref="${opts.sqref}"`);
  return `<dataValidation ${attrs.join(' ')}><formula1>${opts.f1}</formula1><formula2>${opts.f2}</formula2></dataValidation>`;
}

function fillableSqref(letter: string, markedRows: ReadonlySet<number>, lastRow: number): string {
  const ranges: string[] = [];
  let runStart: number | undefined;
  const flush = (end: number): void => {
    if (runStart === undefined) return;
    ranges.push(runStart === end ? `${letter}${runStart}` : `${letter}${runStart}:${letter}${end}`);
    runStart = undefined;
  };
  for (let row = 2; row <= lastRow; row++) {
    if (markedRows.has(row)) flush(row - 1);
    else if (runStart === undefined) runStart = row;
  }
  flush(lastRow);
  return ranges.join(' ');
}

function buildWorksheet(tasks: readonly Task[], text: ProgressXlsxText, options: ProgressXlsxOptions): string {
  const notes = text.headerNotes;
  const summaryNote = text.summaryNote;
  const exportedAt = options.exportedAt;
  const stateLetter = columnLetter(COLUMNS.length);
  const headers = COLUMNS.map(col => {
    const note = notes?.[col.key];
    return note ? `${col.key} — ${note}` : col.key;
  });
  if (exportedAt !== undefined) {
    const note = notes?.[EXPORT_STATE_KEY];
    headers.push(note ? `${EXPORT_STATE_KEY} — ${note}` : EXPORT_STATE_KEY);
  }

  const maxChars = COLUMNS.map(col => col.key.length);
  for (const task of tasks) {
    const marked = summaryNote !== undefined && task.childIds.length > 0;
    const values = rowValues(task, marked, summaryNote ?? '');
    COLUMNS.forEach((col, i) => {
      if (marked && col.editable) return;
      const shown = displayText(col.kind, values[i] ?? '');
      if (shown.length > (maxChars[i] ?? 0)) maxChars[i] = shown.length;
    });
  }
  const cols = COLUMNS.map((col, i) => {
    const n = i + 1;
    return `<col min="${n}" max="${n}" width="${columnWidth(maxChars[i] ?? 0)}" customWidth="1" style="${columnStyle(col)}"/>`;
  }).join('') + (exportedAt !== undefined
    ? `<col min="${COLUMNS.length + 1}" max="${COLUMNS.length + 1}" width="10" hidden="1" customWidth="1" style="${STYLE.roText}"/>`
    : '');

  const headerCells = headers
    .map((h, i) => inlineStringCell(`${columnLetter(i)}1`, STYLE.header, h))
    .join('');
  const rows = [`<row r="1" ht="46" customHeight="1">${headerCells}</row>`];

  const markedRows = new Set<number>();
  tasks.forEach((task, index) => {
    const rowNumber = index + 2;
    const marked = summaryNote !== undefined && task.childIds.length > 0;
    if (marked) markedRows.add(rowNumber);
    const values = rowValues(task, marked, summaryNote ?? '');
    const cells = COLUMNS.map((col, i) =>
      dataCell(`${columnLetter(i)}${rowNumber}`, col, values[i] ?? '', marked && col.editable),
    ).join('');
    const stateCell = exportedAt !== undefined && task.childIds.length === 0
      ? inlineStringCell(`${stateLetter}${rowNumber}`, STYLE.roText, encodeProgressExportState(task, exportedAt))
      : '';
    rows.push(`<row r="${rowNumber}">${cells}${stateCell}</row>`);
  });

  const lastRow = Math.max(2, tasks.length + 1);
  const dateRule = {
    type: 'date' as const, f1: '1', f2: '2958465',
    title: text.validation?.dateTitle, error: text.validation?.dateError,
  };
  const validations = [
    { sqref: fillableSqref('F', markedRows, lastRow), opts: {
      type: 'decimal' as const, f1: '0', f2: '100',
      title: text.validation?.percentTitle, error: text.validation?.percentError,
      prompt: notes?.['Completion (%)'],
    } },
    { sqref: fillableSqref('G', markedRows, lastRow), opts: { ...dateRule, prompt: notes?.['Actual Start'] } },
    { sqref: fillableSqref('H', markedRows, lastRow), opts: { ...dateRule, prompt: notes?.['Actual Finish'] } },
  ]
    .filter(v => v.sqref.length > 0)
    .map(v => validationXml({ ...v.opts, sqref: v.sqref }));

  const lastCol = exportedAt !== undefined ? stateLetter : columnLetter(COLUMNS.length - 1);
  return `${XML_DECL}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
    + `<dimension ref="A1:${lastCol}${lastRow}"/>`
    + '<sheetViews><sheetView tabSelected="1" workbookViewId="0">'
    + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
    + '<selection pane="bottomLeft" activeCell="F2" sqref="F2"/>'
    + '</sheetView></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + `<cols>${cols}</cols>`
    + `<sheetData>${rows.join('')}</sheetData>`
    + '<sheetProtection sheet="1" selectLockedCells="0" selectUnlockedCells="0" formatColumns="0" formatRows="0"/>'
    + (validations.length > 0
      ? `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`
      : '')
    + '</worksheet>';
}

export function buildProgressXlsxParts(
  tasks: readonly Task[],
  text: ProgressXlsxText = {},
  options: ProgressXlsxOptions = {},
): readonly { name: string; xml: string }[] {
  return [
    { name: '[Content_Types].xml', xml: buildContentTypes() },
    { name: '_rels/.rels', xml: buildRootRels() },
    { name: 'xl/workbook.xml', xml: buildWorkbook(sanitizeSheetName(text.sheetName)) },
    { name: 'xl/_rels/workbook.xml.rels', xml: buildWorkbookRels() },
    { name: 'xl/worksheets/sheet1.xml', xml: buildWorksheet(tasks, text, options) },
    { name: 'xl/styles.xml', xml: buildStyles() },
  ];
}

export async function writeProgressSheetXLSX(
  tasks: readonly Task[],
  text: ProgressXlsxText = {},
  options: ProgressXlsxOptions = {},
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const files = buildProgressXlsxParts(tasks, text, options).map(part => ({
    name: part.name,
    data: encoder.encode(part.xml),
  }));
  return writeZip(files);
}
