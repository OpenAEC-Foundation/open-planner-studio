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
  | 'XER_DUPLICATE_TABLE'
  | 'XER_MISSING_REQUIRED_COLUMNS'
  | 'XER_MISSING_REQUIRED_VALUE'
  | 'XER_AMBIGUOUS_DECIMAL'
  | 'XER_INVALID_NUMBER_FORMAT'
  | 'XER_INVALID_NUMBER'
  | 'XER_SINGLE_PROJECT_REQUIRED'
  | 'XER_EMPTY_PROJECT'
  | 'XER_DUPLICATE_ID'
  | 'XER_AMBIGUOUS_LOCAL_RELATION'
  | 'XER_DANGLING_LOCAL_RELATION';

export class XerImportError extends Error {
  readonly xerCode: XerImportErrorCode;
  readonly table?: string;
  readonly field?: string;
  readonly missingColumns?: string[];
  readonly missingValues?: string[];
  readonly line?: number;
  readonly lines?: number[];
  readonly encoding?: XerEncoding;

  constructor(
    xerCode: XerImportErrorCode,
    message: string,
    context?: {
      table?: string;
      field?: string;
      missingColumns?: string[];
      missingValues?: string[];
      line?: number;
      lines?: number[];
      encoding?: XerEncoding;
    },
  ) {
    super(message);
    this.name = 'XerImportError';
    this.xerCode = xerCode;
    this.table = context?.table;
    this.field = context?.field;
    this.missingColumns = context?.missingColumns;
    this.missingValues = context?.missingValues;
    this.line = context?.line;
    this.lines = context?.lines;
    this.encoding = context?.encoding;
  }
}

export interface XerHeader {
  version: string;
  defaultCurrencyCode: string;
}

export interface XerRow {
  readonly line: number;
  readonly cells: Readonly<Record<string, string>>;
}

interface MutableXerRow {
  line: number;
  cells: Record<string, string>;
}

export interface XerTable {
  name: string;
  fields: string[];
  rows: XerRow[];
}

interface MutableXerTable {
  name: string;
  fields: string[];
  rows: MutableXerRow[];
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
  unknownFields: Array<{ table: string; name: string; rows: number }>;
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
  'TASK.task_notes',
  'TASKNOTE.task_notes',
  'TASKMEMO.task_memo',
  'TASKPROC.proc_descr',
  'WBSMEMO.wbs_memo',
]);

/** Decodeer uitsluitend P6-notitievervuiling en de DEL-DEL-regelovergang. */
export function decodeXerNoteText(raw: string): string {
  const withoutContamination = Array.from(raw)
    .filter(char => ![0, 0xfeff, 0xfffe].includes(char.charCodeAt(0)))
    .join('');
  return withoutContamination.split('\u007f\u007f').join('\n');
}

function decodeTextCell(table: string, field: string, raw: string): string {
  const unquoted = raw.replace(/""/g, '"');
  return P6_NOTE_FIELDS.has(`${table}.${field}`) ? decodeXerNoteText(unquoted) : unquoted;
}

/**
 * Gezaghebbende parser/readergrens: per ingelezen tabel de kolommen waaraan OPS daadwerkelijk
 * betekenis geeft. De tabelselectie wordt uit dezelfde inventaris afgeleid, zodat een tabel nooit
 * wel geparseerd maar buiten de bekende-veldencontrole kan vallen. Een lege lijst is bewust: de
 * tabelrijen worden retained voor brongetrouwheid, maar nog geen veld wordt door de live lezer
 * geïnterpreteerd. Een gevuld onbekend veld is dan dus echte niet-gerepresenteerde informatie.
 */
export const XER_KNOWN_FIELDS_BY_TABLE: Readonly<Record<string, readonly string[]>> = {
  PROJECT: [
    'proj_id', 'sum_base_proj_id', 'clndr_id', 'proj_short_name', 'proj_name',
    'last_recalc_date', 'data_date', 'plan_end_date', 'def_duration_type',
    'critical_path_type', 'critical_drtn_hr_cnt', 'rem_target_link_flag',
  ],
  CALENDAR: [
    'clndr_id', 'base_clndr_id', 'clndr_name', 'clndr_type', 'clndr_data',
    'day_hr_cnt', 'week_hr_cnt', 'month_hr_cnt', 'year_hr_cnt',
  ],
  RSRC: [
    'rsrc_id', 'parent_rsrc_id', 'role_id', 'clndr_id', 'unit_id', 'rsrc_name',
    'rsrc_short_name', 'rsrc_notes', 'rsrc_type', 'def_qty_per_hr',
  ],
  RSRCRATE: [
    'rsrc_rate_id', 'rsrc_id', 'start_date', 'max_qty_per_hr',
    'cost_per_qty', 'cost_per_qty2', 'cost_per_qty3', 'cost_per_qty4', 'cost_per_qty5',
  ],
  PROJWBS: ['wbs_id', 'proj_id', 'parent_wbs_id', 'wbs_name', 'wbs_short_name', 'seq_num'],
  TASK: [
    'task_id', 'proj_id', 'task_code', 'task_name', 'task_notes', 'wbs_id', 'clndr_id',
    'task_type', 'duration_type', 'status_code', 'complete_pct_type', 'complete_pct',
    'phys_complete_pct', 'priority_type', 'target_start_date', 'target_end_date',
    'target_drtn_hr_cnt', 'remain_drtn_hr_cnt', 'act_start_date', 'act_end_date',
    'suspend_date', 'resume_date', 'expect_end_date', 'cstr_type', 'cstr_date',
    'cstr_type2', 'cstr_date2',
  ],
  TASKPRED: [
    'task_pred_id', 'proj_id', 'task_id', 'pred_proj_id', 'pred_task_id', 'pred_type',
    'lag_hr_cnt',
  ],
  TASKRSRC: [
    'taskrsrc_id', 'proj_id', 'task_id', 'rsrc_id', 'role_id', 'rsrc_type', 'curv_id',
    'rate_type', 'cost_per_qty_source_type', 'remain_qty', 'target_qty', 'act_reg_qty',
    'act_ot_qty', 'act_this_per_qty', 'remain_qty_per_hr', 'target_qty_per_hr',
    'cost_per_qty', 'target_cost', 'remain_cost', 'act_reg_cost', 'act_ot_cost',
    'act_this_per_cost', 'target_crv', 'remain_crv', 'actual_crv',
  ],
  CURRTYPE: [
    'curr_short_name', 'decimal_symbol', 'decimal_symbol_type',
    'digit_group_symbol', 'digit_group_symbol_type',
  ],
  UDFTYPE: [
    'udf_type_id', 'table_name', 'logical_data_type', 'udf_type',
    'udf_type_label', 'udf_type_name',
  ],
  UDFVALUE: ['udf_type_id', 'fk_id', 'task_id', 'proj_id', 'udf_text', 'udf_number', 'udf_date'],
  SCHEDOPTIONS: [
    'enable_multiple_longest_path_calc', 'key_activity_for_multiple_longest_paths',
    'level_all_rsrc_flag', 'level_float_thrs_cnt', 'level_keep_sched_date_flag',
    'level_outer_assign_flag', 'level_outer_assign_priority', 'level_over_alloc_pct',
    'level_within_float_flag', 'levelprioritylist', 'limit_multiple_longest_path_calc',
    'max_multiple_longest_path', 'proj_id', 'sched_calendar_on_relationship_lag',
    'sched_float_type', 'sched_lag_early_start_flag', 'sched_open_critical_flag',
    'sched_outer_depend_type', 'sched_progress_override', 'sched_retained_logic',
    'sched_setplantoforecast', 'sched_use_expect_end_flag',
    'sched_use_project_end_date_for_float', 'schedhash', 'schedoptions_id',
    'use_total_float', 'use_total_float_multiple_longest_paths',
  ],
  ACTVTYPE: [
    'actv_code_type_id', 'parent_actv_code_type_id', 'actv_code_type',
    'actv_code_type_name', 'seq_num',
  ],
  ACTVCODE: [
    'actv_code_id', 'actv_code_type_id', 'parent_actv_code_id',
    'short_name', 'actv_code_name', 'seq_num',
  ],
  TASKACTV: ['task_id', 'proj_id', 'actv_code_type_id', 'actv_code_id'],
  COSTTYPE: [],
  ACCOUNT: [],
  PROJCOST: [],
  MEMOTYPE: ['memo_type_id'],
  WBSMEMO: [],
  TASKNOTE: ['task_id', 'proj_id', 'task_notes'],
  TASKMEMO: ['memo_id', 'memo_type_id', 'task_id', 'proj_id', 'task_memo'],
  ROLES: ['role_id', 'parent_role_id', 'role_name', 'role_short_name', 'role_descr'],
  ROLERATE: [
    'role_rate_id', 'role_id', 'start_date', 'max_qty_per_hr',
    'cost_per_qty', 'cost_per_qty2', 'cost_per_qty3', 'cost_per_qty4', 'cost_per_qty5',
  ],
  RSRCCURVDATA: [
    'curv_id', 'curv_name',
    ...Array.from({ length: 21 }, (_, index) => `pct_usage_${index}`),
  ],
  TASKPROC: [],
  LOCATION: [],
  UMEASURE: ['unit_id', 'unit_abbrev', 'unit_name'],
  SHIFT: [],
  SHIFTPER: [],
  RSRCROLE: [],
  PCATTYPE: [],
  PCATVAL: [],
  PROJPCAT: [],
  RCATTYPE: [],
  RCATVAL: [],
  RSRCRCAT: [],
  ROLECATTYPE: [],
  ROLECATVAL: [],
  ROLERCAT: [],
  ASGNMNTCATTYPE: [],
  ASGNMNTCATVAL: [],
  ASGNMNTACAT: [],
};

const READ_TABLES = new Set(Object.keys(XER_KNOWN_FIELDS_BY_TABLE));
const KNOWN_FIELD_SETS = new Map(Object.entries(XER_KNOWN_FIELDS_BY_TABLE)
  .map(([table, fields]) => [table, new Set(fields)] as const));

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

function assertRequiredIdentity(tables: ReadonlyMap<string, XerTable>): void {
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
  const matchingRows = normalizedCurrency
    ? currencyRows.filter(row =>
      row.cells.curr_short_name?.trim().toLowerCase() === normalizedCurrency)
    : [];
  if (matchingRows.length === 0) {
    issues.push({
      code: 'XER_CURRENCY_NOT_FOUND',
      line: 1,
      table: 'CURRTYPE',
      currencyCode,
    });
    return { decimal: '.', group: null, source: 'default', currencyCode };
  }

  const formatError = (message: string, line: number, lines = [line]): XerImportError =>
    new XerImportError('XER_INVALID_NUMBER_FORMAT', message, {
      table: 'CURRTYPE',
      line,
      lines,
    });
  const decodeToken = (
    raw: string,
    family: 'decimal' | 'group',
    line: number,
  ): '.' | ',' => {
    const value = raw.trim().toLowerCase();
    if (value === '.' || value === 'period') return '.';
    if (value === ',' || value === 'comma') return ',';
    if (value === 'ds_period' && family === 'decimal') return '.';
    if (value === 'ds_comma' && family === 'decimal') return ',';
    if (value === 'dg_period' && family === 'group') return '.';
    if (value === 'dg_comma' && family === 'group') return ',';
    throw formatError(
      'CURRTYPE bevat geen betrouwbare combinatie van decimaal- en groepsteken.',
      line,
    );
  };
  const resolveRepresentations = (
    values: readonly string[],
    family: 'decimal' | 'group',
    line: number,
  ): '.' | ',' | null => {
    const decoded = values.filter(value => value.trim()).map(value => decodeToken(value, family, line));
    if (new Set(decoded).size > 1) {
      throw formatError(
        'CURRTYPE bevat tegenstrijdige separatorrepresentaties.',
        line,
      );
    }
    return decoded[0] ?? null;
  };
  const formats = matchingRows.map(row => {
    const decimal = resolveRepresentations([
      row.cells.decimal_symbol ?? '',
      row.cells.decimal_symbol_type ?? '',
    ], 'decimal', row.line);
    const group = resolveRepresentations([
      row.cells.digit_group_symbol ?? '',
      row.cells.digit_group_symbol_type ?? '',
    ], 'group', row.line);
    if (decimal === null || group === decimal) {
      throw formatError(
        'CURRTYPE bevat geen betrouwbare combinatie van decimaal- en groepsteken.',
        row.line,
      );
    }
    return { decimal, group, line: row.line };
  });
  const selected = formats[0];
  const conflict = formats.find(format =>
    format.decimal !== selected.decimal || format.group !== selected.group);
  if (conflict) {
    throw formatError(
      'CURRTYPE bevat meerdere matching valutaregels met tegenstrijdige getalsemantiek.',
      conflict.line,
      [selected.line, conflict.line],
    );
  }
  return {
    decimal: selected.decimal,
    group: selected.group,
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

// MPXJ's XerFile.FIELD_TYPE_MAP is geraadpleegd om alle NUMERIC/DURATION/CURRENCY-veldnamen te
// inventariseren. Alleen de veldclassificatie is zelfstandig overgenomen, geen parsercode. De map
// is veldnaamgebaseerd (met target_qty als eveneens numerieke tabelvariant), zodat vrije tekst en
// INTEGER-identiteit nooit door een suffixgok als komma-decimaalbewijs gelden.
const XER_DECIMAL_FIELDS = new Set([
  'act_cost', 'act_equip_qty', 'act_ot_cost', 'act_ot_qty', 'act_reg_cost', 'act_reg_qty',
  'act_work_qty', 'asgnmnt_catg_id', 'asgnmnt_catg_short_len', 'asgnmnt_catg_type_id',
  'base_exch_rate', 'complete_pct', 'cost_per_qty', 'cost_per_qty2', 'cost_per_qty3',
  'cost_per_qty4', 'cost_per_qty5', 'critical_drtn_hr_cnt', 'curv_id', 'day_hr_cnt',
  'def_qty_per_hr', 'est_wt', 'free_float_hr_cnt', 'indep_remain_total_cost',
  'indep_remain_work_qty', 'lag_hr_cnt', 'latitude', 'longitude', 'max_qty_per_hr',
  'month_hr_cnt', 'orig_cost', 'parent_asgnmnt_catg_id',
  'pct_usage_0', 'pct_usage_1', 'pct_usage_2', 'pct_usage_3', 'pct_usage_4', 'pct_usage_5',
  'pct_usage_6', 'pct_usage_7', 'pct_usage_8', 'pct_usage_9', 'pct_usage_10', 'pct_usage_11',
  'pct_usage_12', 'pct_usage_13', 'pct_usage_14', 'pct_usage_15', 'pct_usage_16',
  'pct_usage_17', 'pct_usage_18', 'pct_usage_19', 'pct_usage_20', 'phys_complete_pct',
  'proc_wt', 'remain_cost', 'remain_drtn_hr_cnt', 'remain_equip_qty', 'remain_qty',
  'remain_qty_per_hr', 'remain_work_qty', 'target_cost', 'target_drtn_hr_cnt',
  'target_equip_qty', 'target_lag_drtn_hr_cnt', 'target_qty', 'target_qty_per_hr',
  'target_work_qty', 'total_float_hr_cnt', 'udf_number', 'week_hr_cnt', 'year_hr_cnt',

  // Aanvullende P6-velden die de bestaande X2-catalogus al als decimaaldragend behandelde.
  'act_drtn_hr_cnt', 'act_this_per_equip_qty', 'act_this_per_work_qty', 'actual_value',
  'cost_load_value', 'cost_value', 'last_recalc_priority', 'old_remain_drtn_hr_cnt', 'ot_factor',
  'plan_cost', 'remain_lag_drtn_hr_cnt', 'remain_value', 'target_rate',
]);

interface XerDecimalEvidence {
  table: string;
  field: string;
  line: number;
}

function findProvableCommaDecimal(
  tables: ReadonlyMap<string, XerTable>,
): XerDecimalEvidence | null {
  const plainCommaDecimal = /^[+-]?\d+,\d+$/;
  const groupedCommaDecimal = /^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/;
  const commaGroupedInteger = /^[+-]?\d{1,3}(?:,\d{3})+$/;
  for (const table of tables.values()) {
    for (const row of table.rows) {
      for (const field of table.fields) {
        if (!XER_DECIMAL_FIELDS.has(field)) continue;
        const value = row.cells[field]?.trim() ?? '';
        if ((plainCommaDecimal.test(value) || groupedCommaDecimal.test(value))
          && !commaGroupedInteger.test(value)) {
          return { table: table.name, field, line: row.line };
        }
      }
    }
  }
  return null;
}

function collectUnknownFields(
  tables: ReadonlyMap<string, XerTable>,
): Array<{ table: string; name: string; rows: number }> {
  const result: Array<{ table: string; name: string; rows: number }> = [];
  for (const table of tables.values()) {
    const known = KNOWN_FIELD_SETS.get(table.name) ?? new Set<string>();
    for (const field of new Set(table.fields)) {
      if (known.has(field)) continue;
      const rows = table.rows.reduce((count, row) =>
        count + ((row.cells[field]?.trim() ?? '') !== '' ? 1 : 0), 0);
      if (rows > 0) result.push({ table: table.name, name: field, rows });
    }
  }
  return result;
}

/** Sluit parseropbouw af zonder rij- of celkopieën; iedere latere lezer deelt dezelfde bronrij. */
function freezeXerRows(tables: ReadonlyMap<string, XerTable>): void {
  for (const table of tables.values()) {
    for (const row of table.rows) {
      Object.freeze(row.cells);
      Object.freeze(row);
    }
  }
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
  const tables = new Map<string, MutableXerTable>();
  const issues: XerImportIssue[] = [];
  const unknownTables: Array<{ name: string; rows: number }> = [];
  const knownTableHeaderLines = new Map<string, number>();
  const headerCells = lines[0]?.split('\t') ?? [];
  if (headerCells[0] !== 'ERMHDR' || !(headerCells[1] ?? '').trim()) {
    throw new XerImportError(
      'XER_INVALID_FILE',
      'Ongeldig XER-bestand: ERMHDR met versie ontbreekt.',
    );
  }
  let current: MutableXerTable | undefined;
  let currentUnknown: { name: string; rows: number } | undefined;
  let endMarkerSeen = false;

  for (let index = 1; index < lines.length; index++) {
    const values = lines[index].split('\t');
    const marker = values[0].trim();
    if (marker === '%T') {
      const name = (values[1] ?? '').trim().toUpperCase();
      currentUnknown = undefined;
      if (READ_TABLES.has(name)) {
        const firstHeaderLine = knownTableHeaderLines.get(name);
        if (firstHeaderLine !== undefined) {
          const secondHeaderLine = index + 1;
          throw new XerImportError(
            'XER_DUPLICATE_TABLE',
            `Bekende XER-tabel ${name} begint vóór de eerste %E meer dan één keer.`,
            {
              table: name,
              line: secondHeaderLine,
              lines: [firstHeaderLine, secondHeaderLine],
            },
          );
        }
        knownTableHeaderLines.set(name, index + 1);
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
        const syntheticEndToken = ignoredTail[ignoredTail.length - 1] === '' ? 1 : 0;
        issues.push({
          code: 'XER_TRAILING_RECORDS_AFTER_END',
          line: index + 2 + firstIgnoredOffset,
          ignoredRecords,
          ignoredLines: ignoredTail.length - syntheticEndToken,
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

  const immutableTables = tables as unknown as Map<string, XerTable>;
  assertRequiredColumns(immutableTables);
  assertRequiredIdentity(immutableTables);
  const header: XerHeader = {
    version: headerCells[1] ?? '',
    defaultCurrencyCode: headerCells[8] ?? '',
  };
  const numberFormat = determineNumberFormat(immutableTables, header.defaultCurrencyCode, issues);
  const commaDecimalEvidence = numberFormat.source === 'default'
    ? findProvableCommaDecimal(immutableTables)
    : null;
  if (commaDecimalEvidence) {
    throw new XerImportError(
      'XER_AMBIGUOUS_DECIMAL',
      'XER-bestand gebruikt aantoonbaar komma-decimalen maar bevat geen bruikbare CURRTYPE-tabel.',
      commaDecimalEvidence,
    );
  }

  const unknownFields = collectUnknownFields(immutableTables);
  freezeXerRows(immutableTables);
  return {
    header,
    tables: immutableTables,
    numberFormat,
    report: {
      encoding,
      endMarkerSeen,
      issues: endMarkerSeen ? issues : [
        ...issues,
        { code: 'XER_MISSING_END_MARKER', line: lines.length },
      ],
      unknownTables,
      unknownFields,
    },
  };
}
