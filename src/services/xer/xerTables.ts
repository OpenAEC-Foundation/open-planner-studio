/**
 * XER-tabelgrammatica, zelfstandig hergeimplementeerd voor Open Planner Studio.
 *
 * Voor begrip van de recordstructuur en de tweepas rond CURRTYPE is MPXJ geraadpleegd:
 * https://github.com/joniles/mpxj (Primavera `XerFile`, LGPL-2.1, Jon Iles e.a.). Er is geen
 * MPXJ-code overgenomen; deze parser heeft een eigen tokenizer, rapportvorm en getalparser.
 */

export type XerEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';
/**
 * XER is inhoudelijk tekst, maar encodingdetectie vereist de oorspronkelijke bytes. X4a moet de
 * registry daarom onder het huidige tweewaardige contract als `binary` bedraden en mag een reeds
 * gedecodeerde string nooit opnieuw encoderen.
 */
export const XER_TRANSPORT_KIND = 'binary' as const;
export type XerByteInput = Uint8Array;
export type XerImportErrorCode =
  | 'XER_INVALID_INPUT'
  | 'XER_INVALID_FILE'
  | 'XER_INVALID_ENCODING'
  | 'XER_MISSING_REQUIRED_COLUMNS'
  | 'XER_MISSING_REQUIRED_VALUE'
  | 'XER_AMBIGUOUS_DECIMAL'
  | 'XER_INVALID_NUMBER_FORMAT'
  | 'XER_INVALID_NUMBER';

export class XerImportError extends Error {
  readonly xerCode: XerImportErrorCode;
  readonly table?: string;
  readonly missingColumns?: string[];
  readonly missingValues?: string[];
  readonly line?: number;
  readonly encoding?: XerEncoding;

  constructor(
    xerCode: XerImportErrorCode,
    message: string,
    context?: {
      table?: string;
      missingColumns?: string[];
      missingValues?: string[];
      line?: number;
      encoding?: XerEncoding;
    },
  ) {
    super(message);
    this.name = 'XerImportError';
    this.xerCode = xerCode;
    this.table = context?.table;
    this.missingColumns = context?.missingColumns;
    this.missingValues = context?.missingValues;
    this.line = context?.line;
    this.encoding = context?.encoding;
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
  | 'XER_TRAILING_RECORDS_AFTER_END'
  | 'XER_CURRENCY_NOT_FOUND'
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
  currencyCode?: string;
  ignoredRecords?: number;
  ignoredLines?: number;
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

// MPXJ's afzonderlijke NotesHelper-aanroepen zijn alleen als gedragsreferentie gebruikt. Deze
// expliciete tabel/veldmatrix voorkomt dat DEL-DEL in kalenderdata of andere structured text wijzigt.
const P6_NOTE_FIELDS = new Set([
  'ACCOUNT.acct_descr',
  'ROLES.role_descr',
  'RSRC.rsrc_notes',
  'TASKMEMO.task_memo',
  'TASKPROC.proc_descr',
  'WBSMEMO.wbs_memo',
]);

function decodeTextCell(table: string, field: string, raw: string): string {
  const unquoted = raw.replace(/""/g, '"');
  if (!P6_NOTE_FIELDS.has(`${table}.${field}`)) return unquoted;
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

function decodeBomPayload(
  bytes: Uint8Array,
  offset: number,
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be',
): { text: string; encoding: XerEncoding } {
  try {
    return {
      text: new TextDecoder(encoding, { fatal: true }).decode(bytes.subarray(offset)),
      encoding,
    };
  } catch {
    throw new XerImportError(
      'XER_INVALID_ENCODING',
      `XER-bestand heeft een ${encoding}-BOM maar een ongeldige of afgeknotte payload.`,
      { encoding },
    );
  }
}

function decodeXerBytes(bytes: Uint8Array): { text: string; encoding: XerEncoding } {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return decodeBomPayload(bytes, 3, 'utf-8');
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return decodeBomPayload(bytes, 2, 'utf-16le');
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeBomPayload(bytes, 2, 'utf-16be');
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

function assertRequiredIdentity(
  tables: ReadonlyMap<string, XerTable>,
  issues: readonly XerImportIssue[],
): void {
  const structurallyBrokenRows = new Set(issues
    .filter(issue => issue.code === 'XER_ROW_FIELD_COUNT_MISMATCH')
    .map(issue => `${issue.table ?? ''}\u0000${issue.line}`));
  const requirements: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['PROJECT', ['proj_id']],
    ['CALENDAR', ['clndr_id']],
    ['PROJWBS', ['wbs_id', 'proj_id']],
    ['TASK', ['task_id', 'proj_id', 'task_code']],
    ['TASKPRED', ['task_id', 'pred_task_id', 'pred_type']],
    ['RSRC', ['rsrc_id']],
    ['TASKRSRC', ['task_id']],
  ];
  for (const [tableName, required] of requirements) {
    const table = tables.get(tableName);
    if (!table) continue;
    for (const row of table.rows) {
      if (structurallyBrokenRows.has(`${tableName}\u0000${row.line}`)) continue;
      const missingValues = required.filter(field => !row.cells[field]?.trim());
      if (tableName === 'TASKRSRC'
        && !row.cells.rsrc_id?.trim()
        && !row.cells.role_id?.trim()) {
        missingValues.push('rsrc_id', 'role_id');
      }
      if (missingValues.length === 0) continue;
      throw new XerImportError(
        'XER_MISSING_REQUIRED_VALUE',
        `XER-tabel ${tableName} heeft op regel ${row.line} lege verplichte identiteit: `
          + `${missingValues.join(', ')}.`,
        { table: tableName, missingValues, line: row.line },
      );
    }
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
  issues: XerImportIssue[],
): XerNumberFormat {
  const currencyRows = tables.get('CURRTYPE')?.rows ?? [];
  if (currencyRows.length === 0) {
    return { decimal: '.', group: null, source: 'default', currencyCode };
  }
  const normalizedCurrency = currencyCode.trim().toLowerCase();
  const selected = normalizedCurrency
    ? currencyRows.find(row =>
      row.cells.curr_short_name?.trim().toLowerCase() === normalizedCurrency)
    : undefined;
  if (!selected) {
    issues.push({
      code: 'XER_CURRENCY_NOT_FOUND',
      line: 1,
      table: 'CURRTYPE',
      currencyCode,
    });
    return { decimal: '.', group: null, source: 'default', currencyCode };
  }

  const decodeToken = (raw: string, family: 'decimal' | 'group'): '.' | ',' => {
    const value = raw.trim().toLowerCase();
    if (value === '.' || value === 'period') return '.';
    if (value === ',' || value === 'comma') return ',';
    if (value === 'ds_period' && family === 'decimal') return '.';
    if (value === 'ds_comma' && family === 'decimal') return ',';
    if (value === 'dg_period' && family === 'group') return '.';
    if (value === 'dg_comma' && family === 'group') return ',';
    throw new XerImportError(
      'XER_INVALID_NUMBER_FORMAT',
      'CURRTYPE bevat geen betrouwbare combinatie van decimaal- en groepsteken.',
    );
  };
  const resolveRepresentations = (
    values: readonly string[],
    family: 'decimal' | 'group',
  ): '.' | ',' | null => {
    const decoded = values.filter(value => value.trim()).map(value => decodeToken(value, family));
    if (new Set(decoded).size > 1) {
      throw new XerImportError(
        'XER_INVALID_NUMBER_FORMAT',
        'CURRTYPE bevat tegenstrijdige separatorrepresentaties.',
      );
    }
    return decoded[0] ?? null;
  };
  const decimal = resolveRepresentations([
    selected.cells.decimal_symbol ?? '',
    selected.cells.decimal_symbol_type ?? '',
  ], 'decimal');
  const group = resolveRepresentations([
    selected.cells.digit_group_symbol ?? '',
    selected.cells.digit_group_symbol_type ?? '',
  ], 'group');
  if (decimal === null || group === decimal) {
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

// Expliciete P6-veldencatalogus: identiteit en vrije tekst mogen nooit op hun naamvorm als
// decimaalbewijs gelden. X4a en latere mappers kunnen deze lijst uitbreiden wanneer zij nieuwe
// numerieke tabellen consumeren; X2 gebruikt hem uitsluitend om een onveilige localegok te weren.
const XER_NUMERIC_FIELD_CATALOG = new Set([
  'CALENDAR.day_hr_cnt', 'CALENDAR.week_hr_cnt', 'CALENDAR.month_hr_cnt', 'CALENDAR.year_hr_cnt',
  'PROJECT.last_recalc_priority',
  'PROJCOST.cost_value', 'PROJCOST.cost_load_value', 'PROJCOST.actual_value', 'PROJCOST.remain_value',
  'ROLES.def_qty_per_hr', 'ROLERATE.cost_per_qty',
  'RSRC.def_qty_per_hr', 'RSRC.ot_factor',
  'RSRCRATE.cost_per_qty', 'RSRCRATE.max_qty_per_hr',
  'TASK.complete_pct', 'TASK.phys_complete_pct',
  'TASK.target_drtn_hr_cnt', 'TASK.remain_drtn_hr_cnt', 'TASK.act_drtn_hr_cnt',
  'TASK.total_float_hr_cnt', 'TASK.free_float_hr_cnt', 'TASK.old_remain_drtn_hr_cnt',
  'TASK.critical_drtn_hr_cnt',
  'TASK.target_work_qty', 'TASK.remain_work_qty', 'TASK.act_work_qty',
  'TASK.act_this_per_work_qty', 'TASK.target_equip_qty', 'TASK.remain_equip_qty',
  'TASK.act_equip_qty', 'TASK.act_this_per_equip_qty',
  'TASK.remain_cost', 'TASK.plan_cost', 'TASK.act_cost',
  'TASK.target_qty_per_hr', 'TASK.act_reg_qty', 'TASK.act_ot_qty',
  'TASKPRED.lag_hr_cnt',
  'TASKPROC.complete_pct', 'TASKPROC.seq_num', 'TASKPROC.proc_wt',
  'TASKRSRC.target_qty', 'TASKRSRC.remain_qty', 'TASKRSRC.act_reg_qty', 'TASKRSRC.act_ot_qty',
  'TASKRSRC.target_cost', 'TASKRSRC.remain_cost', 'TASKRSRC.act_reg_cost', 'TASKRSRC.act_ot_cost',
  'TASKRSRC.target_rate', 'TASKRSRC.cost_per_qty',
  'TASKRSRC.target_lag_drtn_hr_cnt', 'TASKRSRC.remain_lag_drtn_hr_cnt',
]);

function hasProvableCommaDecimals(tables: ReadonlyMap<string, XerTable>): boolean {
  const plainCommaDecimal = /^[+-]?\d+,\d+$/;
  const groupedCommaDecimal = /^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/;
  const commaGroupedInteger = /^[+-]?\d{1,3}(?:,\d{3})+$/;
  for (const table of tables.values()) {
    for (const row of table.rows) {
      for (const field of table.fields) {
        if (!XER_NUMERIC_FIELD_CATALOG.has(`${table.name}.${field}`)) continue;
        const value = row.cells[field]?.trim() ?? '';
        if ((plainCommaDecimal.test(value) || groupedCommaDecimal.test(value))
          && !commaGroupedInteger.test(value)) return true;
      }
    }
  }
  return false;
}

/** Parse uitsluitend de oorspronkelijke bestandsbytes; een stringingang is ook runtime ongeldig. */
export function parseXerTables(bytes: XerByteInput): XerTables {
  if (!(bytes instanceof Uint8Array)) {
    throw new XerImportError(
      'XER_INVALID_INPUT',
      'XER-parser verwacht oorspronkelijke bestandsbytes, geen reeds gedecodeerde tekst.',
    );
  }
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
        const continuation = decodeTextCell(current?.name ?? '', field, raw);
        previous.cells[field] = `${previous.cells[field] ?? ''}\n${continuation}`;
      });
    } else if (marker === '' && values.length > 1 && current) {
      issues.push({ code: 'XER_ORPHAN_CONTINUATION', line: index + 1, table: current.name });
    } else if (marker === '%R' && current && current.fields.length > 0) {
      const table = current;
      const rowValues = values.slice(1);
      if (rowValues.length !== table.fields.length) {
        issues.push({
          code: 'XER_ROW_FIELD_COUNT_MISMATCH',
          line: index + 1,
          table: table.name,
          expected: table.fields.length,
          actual: rowValues.length,
        });
      }
      const cells: Record<string, string> = {};
      table.fields.forEach((field, fieldIndex) => {
        cells[field] = decodeTextCell(table.name, field, rowValues[fieldIndex] ?? '');
      });
      table.rows.push({ line: index + 1, cells });
    } else if (marker === '%R' && current) {
      issues.push({ code: 'XER_DATA_WITHOUT_FIELDS', line: index + 1, table: current.name });
    } else if (marker === '%R' && currentUnknown) {
      currentUnknown.rows++;
    } else if (marker === '%E') {
      endMarkerSeen = true;
      const ignoredTail = lines.slice(index + 1);
      const ignoredRecords = ignoredTail.filter(line => line.trim()).length;
      if (ignoredRecords > 0) {
        const firstIgnoredOffset = ignoredTail.findIndex(line => line.trim());
        issues.push({
          code: 'XER_TRAILING_RECORDS_AFTER_END',
          line: index + 2 + firstIgnoredOffset,
          ignoredRecords,
          ignoredLines: ignoredTail.length,
        });
      }
      break;
    } else if (marker !== '') {
      issues.push({
        code: 'XER_UNKNOWN_RECORD',
        line: index + 1,
        ...(current ? { table: current.name } : {}),
      });
    }
  }

  assertRequiredColumns(tables);
  assertRequiredIdentity(tables, issues);
  const header: XerHeader = {
    version: headerCells[1] ?? '',
    defaultCurrencyCode: headerCells[8] ?? '',
  };
  const numberFormat = determineNumberFormat(tables, header.defaultCurrencyCode, issues);
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
