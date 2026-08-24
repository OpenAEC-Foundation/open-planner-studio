/**
 * XER-tabelgrammatica, zelfstandig hergeimplementeerd voor Open Planner Studio.
 *
 * Voor begrip van de recordstructuur en de tweepas rond CURRTYPE is MPXJ geraadpleegd:
 * https://github.com/joniles/mpxj (Primavera `XerFile`, LGPL-2.1, Jon Iles e.a.). Er is geen
 * MPXJ-code overgenomen; deze parser heeft een eigen tokenizer, rapportvorm en getalparser.
 */

export type XerEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';
export type XerImportErrorCode =
  | 'XER_INVALID_FILE'
  | 'XER_MISSING_REQUIRED_COLUMNS'
  | 'XER_AMBIGUOUS_DECIMAL'
  | 'XER_INVALID_NUMBER_FORMAT'
  | 'XER_INVALID_NUMBER';

export class XerImportError extends Error {
  readonly xerCode: XerImportErrorCode;
  readonly table?: string;
  readonly missingColumns?: string[];

  constructor(
    xerCode: XerImportErrorCode,
    message: string,
    context?: { table?: string; missingColumns?: string[] },
  ) {
    super(message);
    this.name = 'XerImportError';
    this.xerCode = xerCode;
    this.table = context?.table;
    this.missingColumns = context?.missingColumns;
  }
}

export interface XerHeader {
  version: string;
  defaultCurrencyCode: string;
}

export interface XerRow {
  line: number;
  cells: Record<string, string>;
}

export interface XerTable {
  name: string;
  fields: string[];
  rows: XerRow[];
}

export type XerImportIssueCode =
  | 'XER_MISSING_END_MARKER'
  | 'XER_ROW_FIELD_COUNT_MISMATCH'
  | 'XER_DATA_WITHOUT_FIELDS'
  | 'XER_ORPHAN_CONTINUATION'
  | 'XER_DUPLICATE_FIELD'
  | 'XER_UNKNOWN_RECORD';

export interface XerImportIssue {
  code: XerImportIssueCode;
  line: number;
  table?: string;
  expected?: number;
  actual?: number;
  field?: string;
}

export interface XerImportReport {
  encoding: XerEncoding;
  endMarkerSeen: boolean;
  issues: XerImportIssue[];
  unknownTables: Array<{ name: string; rows: number }>;
}

export interface XerTables {
  header: XerHeader;
  tables: Map<string, XerTable>;
  report: XerImportReport;
  numberFormat: XerNumberFormat;
}

export interface XerNumberFormat {
  decimal: '.' | ',';
  group: '.' | ',' | null;
  source: 'currtype' | 'default';
  currencyCode: string;
}

function decodeTextCell(field: string, raw: string): string {
  const unquoted = raw.replace(/""/g, '"');
  const isNote = field === 'task_notes'
    || field === 'memo_text'
    || field === 'notes'
    || field.endsWith('_notes');
  if (!isNote) return unquoted;
  const withoutContamination = Array.from(unquoted)
    .filter(char => ![0, 0xfeff, 0xfffe].includes(char.charCodeAt(0)))
    .join('');
  return withoutContamination.split('\u007f\u007f').join('\n');
}

// Tabelset waarvoor de latere X3-X8-lagen data nodig kunnen hebben. De selectie volgt voor begrip
// MPXJ's `PrimaveraXERFileReader.READ_REQUIRED_TABLES`; de opslag- en rapportcode hieronder is eigen.
const READ_TABLES = new Set([
  'PROJECT', 'CALENDAR', 'RSRC', 'RSRCRATE', 'PROJWBS', 'TASK', 'TASKPRED', 'TASKRSRC',
  'CURRTYPE', 'UDFTYPE', 'UDFVALUE', 'SCHEDOPTIONS', 'ACTVTYPE', 'ACTVCODE', 'TASKACTV',
  'COSTTYPE', 'ACCOUNT', 'PROJCOST', 'MEMOTYPE', 'WBSMEMO', 'TASKMEMO', 'ROLES', 'ROLERATE',
  'RSRCCURVDATA', 'TASKPROC', 'LOCATION', 'UMEASURE', 'SHIFT', 'SHIFTPER', 'RSRCROLE',
  'PCATTYPE', 'PCATVAL', 'PROJPCAT', 'RCATTYPE', 'RCATVAL', 'RSRCRCAT', 'ROLECATTYPE',
  'ROLECATVAL', 'ROLERCAT', 'ASGNMNTCATTYPE', 'ASGNMNTCATVAL', 'ASGNMNTACAT',
]);

function decodeXerBytes(bytes: Uint8Array): { text: string; encoding: XerEncoding } {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return {
      text: new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(3)),
      encoding: 'utf-8',
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      text: new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2)),
      encoding: 'utf-16le',
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return {
      text: new TextDecoder('utf-16be', { fatal: true }).decode(bytes.subarray(2)),
      encoding: 'utf-16be',
    };
  }
  try {
    return {
      text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      encoding: 'utf-8',
    };
  } catch {
    return {
      text: new TextDecoder('windows-1252').decode(bytes),
      encoding: 'windows-1252',
    };
  }
}

function assertRequiredColumns(tables: ReadonlyMap<string, XerTable>): void {
  const requirements: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['PROJECT', ['proj_id']],
    ['CALENDAR', ['clndr_id']],
    ['PROJWBS', ['wbs_id', 'proj_id']],
    ['TASK', ['task_id', 'proj_id', 'task_code']],
    ['TASKPRED', ['task_id', 'pred_task_id', 'pred_type']],
    ['RSRC', ['rsrc_id']],
    ['TASKRSRC', ['task_id', 'rsrc_id']],
  ];
  for (const [tableName, required] of requirements) {
    const table = tables.get(tableName);
    if (!table) continue;
    const missingColumns = required.filter(field => !table.fields.includes(field));
    if (missingColumns.length === 0) continue;
    throw new XerImportError(
      'XER_MISSING_REQUIRED_COLUMNS',
      `XER-tabel ${tableName} mist verplichte kolommen: ${missingColumns.join(', ')}.`,
      { table: tableName, missingColumns },
    );
  }
}

/**
 * XER-getallen moeten in twee passen worden behandeld. De eerste pas bewaart alle cellen als
 * letterlijke tokens, ongeacht de tabelvolgorde. Pas nadat ook CURRTYPE bekend is, kiest deze
 * tweede pas de rij van ERMHDR-veld 9 en legt decimaal- en groepsteken vast. Zonder CURRTYPE is
 * punt-decimaal de enige veilige default; aantoonbare komma-decimalen worden verderop geweigerd
 * in plaats van locale-afhankelijk te gokken. Dit formaat geldt daarna voor elk numeriek veld,
 * dus ook uren, duren en floats.
 */
function determineNumberFormat(
  tables: ReadonlyMap<string, XerTable>,
  currencyCode: string,
): XerNumberFormat {
  const currencyRows = tables.get('CURRTYPE')?.rows ?? [];
  const selected = currencyRows.find(row =>
    row.cells.curr_short_name?.trim().toUpperCase() === currencyCode.trim().toUpperCase())
    ?? currencyRows[0];
  if (!selected) return { decimal: '.', group: null, source: 'default', currencyCode };
  const decodeSymbol = (values: readonly string[]): '.' | ',' | null => {
    for (const raw of values) {
      const value = raw.trim().toLowerCase();
      if (value === '.' || value === 'period' || value === 'ds_period' || value === 'dg_period') return '.';
      if (value === ',' || value === 'comma' || value === 'ds_comma' || value === 'dg_comma') return ',';
    }
    return null;
  };
  const decimalValues = [
    selected.cells.decimal_symbol ?? '',
    selected.cells.decimal_symbol_type ?? '',
  ];
  const groupValues = [
    selected.cells.digit_group_symbol ?? '',
    selected.cells.digit_group_symbol_type ?? '',
  ];
  const decimal = decodeSymbol(decimalValues);
  const group = decodeSymbol(groupValues);
  if (decimal === null
    || (group === null && groupValues.some(value => value.trim()))
    || group === decimal) {
    throw new XerImportError(
      'XER_INVALID_NUMBER_FORMAT',
      'CURRTYPE bevat geen betrouwbare combinatie van decimaal- en groepsteken.',
    );
  }
  return {
    decimal,
    group,
    source: 'currtype',
    currencyCode,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Parse een numerieke XER-token strikt volgens de in de tweepas bepaalde bestandsnotatie. */
export function parseXerNumber(raw: string, format: XerNumberFormat): number | null {
  const value = raw.trim();
  if (!value) return null;
  const decimal = escapeRegExp(format.decimal);
  const group = format.group === null ? null : escapeRegExp(format.group);
  const integer = group === null ? '\\d+' : `(?:\\d+|\\d{1,3}(?:${group}\\d{3})+)`;
  const pattern = new RegExp(`^[+-]?${integer}(?:${decimal}\\d+)?$`);
  if (!pattern.test(value)) {
    throw new XerImportError('XER_INVALID_NUMBER', `Ongeldig XER-getal: ${JSON.stringify(value)}.`);
  }
  let normalized = value;
  if (format.group !== null) normalized = normalized.split(format.group).join('');
  if (format.decimal === ',') normalized = normalized.replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new XerImportError('XER_INVALID_NUMBER', `Ongeldig XER-getal: ${JSON.stringify(value)}.`);
  }
  return parsed;
}

function hasProvableCommaDecimals(tables: ReadonlyMap<string, XerTable>): boolean {
  const numericField = /(?:_hr_cnt|_qty|_cost|_pct|_rate|_seq_num|_num|_id)$/;
  const commaDecimal = /^[+-]?(?:\d+,\d{1,2}|\d{1,3}(?:\.\d{3})+,\d+)$/;
  for (const table of tables.values()) {
    for (const row of table.rows) {
      for (const field of table.fields) {
        if (numericField.test(field) && commaDecimal.test(row.cells[field]?.trim() ?? '')) return true;
      }
    }
  }
  return false;
}

export function parseXerTables(bytes: Uint8Array): XerTables {
  const { text, encoding } = decodeXerBytes(bytes);
  const lines = text.split('\n').map(line => line.endsWith('\r') ? line.slice(0, -1) : line);
  const tables = new Map<string, XerTable>();
  const issues: XerImportIssue[] = [];
  const unknownTables: Array<{ name: string; rows: number }> = [];
  const headerCells = lines[0]?.split('\t') ?? [];
  if (headerCells[0] !== 'ERMHDR' || !(headerCells[1] ?? '').trim()) {
    throw new XerImportError(
      'XER_INVALID_FILE',
      'Ongeldig XER-bestand: ERMHDR met versie ontbreekt.',
    );
  }
  let current: XerTable | undefined;
  let currentUnknown: { name: string; rows: number } | undefined;
  let endMarkerSeen = false;

  for (let index = 1; index < lines.length; index++) {
    const values = lines[index].split('\t');
    const marker = values[0].trim();
    if (marker === '%T') {
      const name = (values[1] ?? '').trim().toUpperCase();
      currentUnknown = undefined;
      if (READ_TABLES.has(name)) {
        current = { name, fields: [], rows: [] };
        tables.set(name, current);
      } else {
        current = undefined;
        currentUnknown = { name, rows: 0 };
        unknownTables.push(currentUnknown);
      }
    } else if (marker === '%F' && current) {
      current.fields = values.slice(1).map(field => field.trim().toLowerCase());
      const seen = new Set<string>();
      for (const field of current.fields) {
        if (seen.has(field)) {
          issues.push({
            code: 'XER_DUPLICATE_FIELD',
            line: index + 1,
            table: current.name,
            field,
          });
        }
        seen.add(field);
      }
    } else if (marker === '%F' && currentUnknown) {
      // De kolomvorm van een bewust overgeslagen tabel is niet onze grammaticale verantwoordelijkheid.
    } else if (marker === '' && current && current.fields.length > 0 && current.rows.length > 0) {
      const previous = current.rows[current.rows.length - 1];
      values.slice(1).forEach((raw, fieldIndex) => {
        const field = current?.fields[fieldIndex];
        if (field === undefined || raw === '') return;
        const continuation = decodeTextCell(field, raw);
        previous.cells[field] = `${previous.cells[field] ?? ''}\n${continuation}`;
      });
    } else if (marker === '' && values.length > 1 && current) {
      issues.push({ code: 'XER_ORPHAN_CONTINUATION', line: index + 1, table: current.name });
    } else if (marker === '%R' && current && current.fields.length > 0) {
      const rowValues = values.slice(1);
      if (rowValues.length !== current.fields.length) {
        issues.push({
          code: 'XER_ROW_FIELD_COUNT_MISMATCH',
          line: index + 1,
          table: current.name,
          expected: current.fields.length,
          actual: rowValues.length,
        });
      }
      const cells: Record<string, string> = {};
      current.fields.forEach((field, fieldIndex) => {
        cells[field] = decodeTextCell(field, rowValues[fieldIndex] ?? '');
      });
      current.rows.push({ line: index + 1, cells });
    } else if (marker === '%R' && current) {
      issues.push({ code: 'XER_DATA_WITHOUT_FIELDS', line: index + 1, table: current.name });
    } else if (marker === '%R' && currentUnknown) {
      currentUnknown.rows++;
    } else if (marker === '%E') {
      endMarkerSeen = true;
      current = undefined;
      currentUnknown = undefined;
    } else if (marker !== '') {
      issues.push({
        code: 'XER_UNKNOWN_RECORD',
        line: index + 1,
        ...(current ? { table: current.name } : {}),
      });
    }
  }

  assertRequiredColumns(tables);
  const header: XerHeader = {
    version: headerCells[1] ?? '',
    defaultCurrencyCode: headerCells[8] ?? '',
  };
  const numberFormat = determineNumberFormat(tables, header.defaultCurrencyCode);
  if (numberFormat.source === 'default' && hasProvableCommaDecimals(tables)) {
    throw new XerImportError(
      'XER_AMBIGUOUS_DECIMAL',
      'XER-bestand gebruikt aantoonbaar komma-decimalen maar bevat geen bruikbare CURRTYPE-tabel.',
    );
  }

  return {
    header,
    tables,
    numberFormat,
    report: {
      encoding,
      endMarkerSeen,
      issues: endMarkerSeen ? issues : [
        ...issues,
        { code: 'XER_MISSING_END_MARKER', line: lines.length },
      ],
      unknownTables,
    },
  };
}
