/**
 * Onafhankelijke XER-grondwaarheidscan voor de fidelitymeetlat.
 *
 * Dit is bewust een minimale tweede parser: geen import uit `src/services/xer`, geen gedeelde
 * tokenizer, veldkaart, datumparser of encodinghelper. De latere productielezer kan daardoor niet
 * tegelijk met zijn eigen meetlat dezelfde fout gaan maken. Alleen TASK-%T/%F/%R en de expliciet
 * toegestane P6-orakelvelden worden gelezen.
 */

export type XerGroundTruthEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';
export type XerFidelityAxis = 'es' | 'ef' | 'ls' | 'lf' | 'tf' | 'ff';

export const XER_FIDELITY_AXES: readonly XerFidelityAxis[] = ['es', 'ef', 'ls', 'lf', 'tf', 'ff'];

export interface XerGroundTruthTask {
  projectId: string;
  taskId: string;
  taskCode: string;
  statusCode: string;
  axes: Record<XerFidelityAxis, string | number | null>;
  drivingPath: boolean | null;
  /** Niet-lege effectieve broncellen na statussemantiek; parsefouten staan apart in `errors`. */
  presentAxes: Record<XerFidelityAxis, boolean>;
}

export interface XerGroundTruth {
  encoding: XerGroundTruthEncoding;
  projects: Set<string>;
  tasks: XerGroundTruthTask[];
  /** Niet-lege onparseerbare waarden en ontbrekende verplichte identiteit zijn fataal. */
  errors: string[];
}

const IDENTITY_FIELDS = ['proj_id', 'task_id', 'task_code'] as const;
const KNOWN_STATUS_CODES = new Set(['tk_notstart', 'tk_active', 'tk_complete']);

interface XerNumberFormat {
  decimal: '.' | ',';
  group: '.' | ',' | null;
  fromCurrencyTable: boolean;
}

function decodeXer(bytes: Uint8Array): { text: string; encoding: XerGroundTruthEncoding } {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16be' };
  }
  const withoutUtf8Bom = bytes.length >= 3
    && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
    ? bytes.subarray(3)
    : bytes;
  try {
    return {
      text: new TextDecoder('utf-8', { fatal: true }).decode(withoutUtf8Bom),
      encoding: 'utf-8',
    };
  } catch {
    return {
      text: new TextDecoder('windows-1252').decode(bytes),
      encoding: 'windows-1252',
    };
  }
}

/** Canonieke minuutstring; leeg is niet meetbaar, niet-leeg maar ongeldig is een scannerfout. */
function parseOracleDate(
  raw: string | undefined,
  taskId: string,
  field: string,
  errors: string[],
): string | null {
  const value = raw?.trim() ?? '';
  if (!value || value === '0') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?$/.exec(value);
  if (!match) {
    errors.push(`TASK ${taskId}/${field}: ongeldige datum ${JSON.stringify(value)}`);
    return null;
  }
  const [, year, month, day, rawHour, rawMinute] = match;
  const hour = rawHour ?? '00';
  const minute = rawMinute ?? '00';
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
  if (Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 16) !== `${year}-${month}-${day}T${hour}:${minute}`) {
    errors.push(`TASK ${taskId}/${field}: ongeldige datum ${JSON.stringify(value)}`);
    return null;
  }
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function decodeNumberSymbol(
  values: readonly string[],
  field: 'decimal_symbol' | 'digit_group_symbol',
  errors: string[],
): '.' | ',' | null {
  for (const raw of values) {
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    if (value === '.' || value === 'period' || value === 'ds_period' || value === 'dg_period') return '.';
    if (value === ',' || value === 'comma' || value === 'ds_comma' || value === 'dg_comma') return ',';
  }
  if (field === 'decimal_symbol') errors.push('CURRTYPE/decimal_symbol: ontbrekende of onbekende waarde');
  return null;
}

function scanNumberFormat(lines: readonly string[], errors: string[]): XerNumberFormat {
  const header = lines.find(line => line.startsWith('ERMHDR\t'))?.split('\t') ?? [];
  const defaultCurrency = header[8]?.trim() ?? '';
  let table = '';
  let fields: string[] = [];
  const currencyRows: Map<string, string>[] = [];
  for (const line of lines) {
    const cells = line.split('\t');
    const marker = cells[0]?.trim();
    if (marker === '%T') {
      table = cells[1]?.trim().toUpperCase() ?? '';
      fields = [];
      continue;
    }
    if (table !== 'CURRTYPE') continue;
    if (marker === '%F') {
      fields = cells.slice(1).map(field => field.trim());
      continue;
    }
    if (marker !== '%R' || fields.length === 0) continue;
    const row = new Map<string, string>();
    const values = cells.slice(1);
    for (let index = 0; index < fields.length; index++) row.set(fields[index], values[index] ?? '');
    currencyRows.push(row);
  }
  const row = (defaultCurrency
    ? currencyRows.find(candidate => candidate.get('curr_short_name')?.trim() === defaultCurrency)
    : undefined) ?? currencyRows[0];
  if (!row) return { decimal: '.', group: null, fromCurrencyTable: false };
  const decimal = decodeNumberSymbol([
    row.get('decimal_symbol') ?? '', row.get('decimal_symbol_type') ?? '',
  ], 'decimal_symbol', errors);
  const group = decodeNumberSymbol([
    row.get('digit_group_symbol') ?? '', row.get('digit_group_symbol_type') ?? '',
  ], 'digit_group_symbol', errors);
  if (decimal === null) return { decimal: '.', group: null, fromCurrencyTable: true };
  if (group === decimal) {
    errors.push('CURRTYPE: decimaal- en groepsteken zijn gelijk');
    return { decimal, group: null, fromCurrencyTable: true };
  }
  return { decimal, group, fromCurrencyTable: true };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** P6-float staat in uren; het orakel wordt meteen naar afgeronde minuten genormaliseerd. */
function parseFloatMinutes(
  raw: string | undefined,
  taskId: string,
  field: string,
  format: XerNumberFormat,
  errors: string[],
): number | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  const decimal = escapeRegExp(format.decimal);
  const group = format.group === null ? null : escapeRegExp(format.group);
  const integer = group === null ? '\\d+' : `(?:\\d+|\\d{1,3}(?:${group}\\d{3})+)`;
  const pattern = new RegExp(`^[+-]?${integer}(?:${decimal}\\d+)?$`);
  if (!pattern.test(value)) {
    errors.push(`TASK ${taskId}/${field}: ongeldig getal ${JSON.stringify(value)}`);
    return null;
  }
  let normalized = value;
  if (format.group !== null) normalized = normalized.split(format.group).join('');
  if (format.decimal === ',') normalized = normalized.replace(',', '.');
  const hours = Number(normalized);
  if (!Number.isFinite(hours)) {
    errors.push(`TASK ${taskId}/${field}: ongeldig getal ${JSON.stringify(value)}`);
    return null;
  }
  return Math.round(hours * 60);
}

function parseDrivingPath(
  raw: string | undefined,
  taskId: string,
  errors: string[],
): boolean | null {
  const value = raw?.trim().toUpperCase() ?? '';
  if (!value) return null;
  if (value === 'Y') return true;
  if (value === 'N') return false;
  errors.push(`TASK ${taskId}/driving_path_flag: ongeldige vlag ${JSON.stringify(raw?.trim())}`);
  return null;
}

function buildTask(
  fields: readonly string[],
  values: readonly string[],
  rowNumber: number,
  format: XerNumberFormat,
  errors: string[],
): XerGroundTruthTask | null {
  const row = new Map<string, string>();
  for (let index = 0; index < fields.length; index++) row.set(fields[index], values[index] ?? '');
  for (const field of IDENTITY_FIELDS) {
    if (!row.has(field)) errors.push(`TASK %F/${field}: ontbrekend verplicht veld`);
  }
  if (!IDENTITY_FIELDS.every(field => row.has(field))) return null;

  const projectId = row.get('proj_id')?.trim() ?? '';
  const taskId = row.get('task_id')?.trim() ?? '';
  const taskCode = row.get('task_code')?.trim() ?? '';
  if (!taskId) {
    errors.push(`TASK rij ${rowNumber}/task_id: ontbrekende waarde`);
    return null;
  }

  const statusCode = row.get('status_code')?.trim() ?? '';
  const normalizedStatus = statusCode.toLowerCase();
  if (statusCode && !KNOWN_STATUS_CODES.has(normalizedStatus)) {
    errors.push(`TASK ${taskId}/status_code: onbekende waarde ${JSON.stringify(statusCode)}`);
  }
  const completed = normalizedStatus === 'tk_complete';
  const startField = completed ? 'act_start_date' : 'early_start_date';
  const finishField = completed ? 'act_end_date' : 'early_end_date';
  const lateStartField = completed ? 'act_start_date' : 'late_start_date';
  const lateFinishField = completed ? 'act_end_date' : 'late_end_date';
  const start = parseOracleDate(row.get(startField), taskId, startField, errors);
  const finish = parseOracleDate(row.get(finishField), taskId, finishField, errors);
  const lateStart = completed ? start : parseOracleDate(row.get(lateStartField), taskId, lateStartField, errors);
  const lateFinish = completed ? finish : parseOracleDate(row.get(lateFinishField), taskId, lateFinishField, errors);

  return {
    projectId,
    taskId,
    taskCode,
    statusCode,
    axes: {
      es: start,
      ef: finish,
      ls: lateStart,
      lf: lateFinish,
      tf: parseFloatMinutes(row.get('total_float_hr_cnt'), taskId, 'total_float_hr_cnt', format, errors),
      ff: parseFloatMinutes(row.get('free_float_hr_cnt'), taskId, 'free_float_hr_cnt', format, errors),
    },
    drivingPath: parseDrivingPath(row.get('driving_path_flag'), taskId, errors),
    presentAxes: {
      es: start !== null,
      ef: finish !== null,
      ls: lateStart !== null,
      lf: lateFinish !== null,
      tf: !!row.get('total_float_hr_cnt')?.trim(),
      ff: !!row.get('free_float_hr_cnt')?.trim(),
    },
  };
}

export function scanXerGroundTruth(bytes: Uint8Array): XerGroundTruth {
  const { text, encoding } = decodeXer(bytes);
  const lines = text.split('\n').map(rawLine => rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine);
  const tasks: XerGroundTruthTask[] = [];
  const declaredProjects = new Set<string>();
  const taskProjects = new Set<string>();
  const errors: string[] = [];
  const numberFormat = scanNumberFormat(lines, errors);
  let table = '';
  let fields: string[] = [];
  let taskRowNumber = 0;
  let projectRowNumber = 0;
  let sawProjectTable = false;
  const seenTaskIds = new Set<string>();

  for (const line of lines) {
    const cells = line.split('\t');
    const marker = cells[0]?.trim();
    if (marker === '%T') {
      table = cells[1]?.trim().toUpperCase() ?? '';
      if (table === 'PROJECT') sawProjectTable = true;
      fields = [];
      continue;
    }
    if (marker === '%F') {
      fields = cells.slice(1).map(field => field.trim());
      continue;
    }
    if (marker !== '%R' || fields.length === 0) continue;
    if (table === 'PROJECT') {
      projectRowNumber++;
      const projectIdIndex = fields.indexOf('proj_id');
      if (projectIdIndex < 0) {
        errors.push('PROJECT %F/proj_id: ontbrekend verplicht veld');
        continue;
      }
      const projectId = cells[projectIdIndex + 1]?.trim() ?? '';
      if (!projectId) errors.push(`PROJECT rij ${projectRowNumber}/proj_id: ontbrekende waarde`);
      else if (declaredProjects.has(projectId)) errors.push(`PROJECT rij ${projectRowNumber}: dubbele proj_id ${projectId}`);
      else declaredProjects.add(projectId);
      continue;
    }
    if (table !== 'TASK') continue;
    taskRowNumber++;
    const task = buildTask(fields, cells.slice(1), taskRowNumber, numberFormat, errors);
    if (!task) continue;
    const taskKey = `${task.projectId}\u0000${task.taskId}`;
    if (seenTaskIds.has(taskKey)) {
      errors.push(`TASK rij ${taskRowNumber}: dubbele task_id ${task.projectId}/${task.taskId}`);
    } else {
      seenTaskIds.add(taskKey);
    }
    tasks.push(task);
    taskProjects.add(task.projectId);
  }

  if (sawProjectTable) {
    for (const task of tasks) {
      if (!declaredProjects.has(task.projectId)) {
        errors.push(`TASK ${task.taskId}/proj_id: niet aanwezig in PROJECT-set (${task.projectId})`);
      }
    }
  }
  return {
    encoding,
    projects: sawProjectTable ? declaredProjects : taskProjects,
    tasks,
    errors,
  };
}
