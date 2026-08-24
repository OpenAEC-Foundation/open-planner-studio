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
  /** Aanwezigheid van P6's opgeslagen uitvoerveld, los van parseerbaarheid/statussubstitutie. */
  storedAxes: Record<XerFidelityAxis, boolean>;
}

export interface XerGroundTruth {
  encoding: XerGroundTruthEncoding;
  projects: Set<string>;
  tasks: XerGroundTruthTask[];
}

const IDENTITY_FIELDS = ['proj_id', 'task_id', 'task_code'] as const;

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

/** Canonieke minuutstring; ongeldige/sentinelwaarden zijn niet meetbaar. */
function parseOracleDate(raw: string | undefined): string | null {
  const value = raw?.trim() ?? '';
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour = '00', minute = '00'] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 16) !== `${year}-${month}-${day}T${hour}:${minute}`) return null;
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** P6-float staat in uren; het orakel wordt meteen naar afgeronde minuten genormaliseerd. */
function parseFloatMinutes(raw: string | undefined): number | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  const hours = Number(value);
  return Number.isFinite(hours) ? Math.round(hours * 60) : null;
}

function parseDrivingPath(raw: string | undefined): boolean | null {
  const value = raw?.trim().toUpperCase() ?? '';
  if (value === 'Y') return true;
  if (value === 'N') return false;
  return null;
}

function buildTask(fields: readonly string[], values: readonly string[]): XerGroundTruthTask | null {
  const row = new Map<string, string>();
  for (let index = 0; index < fields.length; index++) row.set(fields[index], values[index] ?? '');
  if (!IDENTITY_FIELDS.every(field => row.has(field))) return null;

  const projectId = row.get('proj_id')?.trim() ?? '';
  const taskId = row.get('task_id')?.trim() ?? '';
  const taskCode = row.get('task_code')?.trim() ?? '';
  if (!taskId) return null;

  const statusCode = row.get('status_code')?.trim() ?? '';
  const completed = statusCode.toLowerCase() === 'tk_complete';
  const start = completed ? parseOracleDate(row.get('act_start_date')) : null;
  const finish = completed ? parseOracleDate(row.get('act_end_date')) : null;

  return {
    projectId,
    taskId,
    taskCode,
    statusCode,
    axes: {
      es: completed ? start : parseOracleDate(row.get('early_start_date')),
      ef: completed ? finish : parseOracleDate(row.get('early_end_date')),
      ls: completed ? start : parseOracleDate(row.get('late_start_date')),
      lf: completed ? finish : parseOracleDate(row.get('late_end_date')),
      tf: parseFloatMinutes(row.get('total_float_hr_cnt')),
      ff: parseFloatMinutes(row.get('free_float_hr_cnt')),
    },
    drivingPath: parseDrivingPath(row.get('driving_path_flag')),
    storedAxes: {
      es: !!row.get('early_start_date')?.trim(),
      ef: !!row.get('early_end_date')?.trim(),
      ls: !!row.get('late_start_date')?.trim(),
      lf: !!row.get('late_end_date')?.trim(),
      tf: !!row.get('total_float_hr_cnt')?.trim(),
      ff: !!row.get('free_float_hr_cnt')?.trim(),
    },
  };
}

export function scanXerGroundTruth(bytes: Uint8Array): XerGroundTruth {
  const { text, encoding } = decodeXer(bytes);
  const tasks: XerGroundTruthTask[] = [];
  const projects = new Set<string>();
  let table = '';
  let fields: string[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    const cells = line.split('\t');
    const marker = cells[0]?.trim();
    if (marker === '%T') {
      table = cells[1]?.trim().toUpperCase() ?? '';
      fields = [];
      continue;
    }
    if (table !== 'TASK') continue;
    if (marker === '%F') {
      fields = cells.slice(1).map(field => field.trim());
      continue;
    }
    if (marker !== '%R' || fields.length === 0) continue;
    const task = buildTask(fields, cells.slice(1));
    if (!task) continue;
    tasks.push(task);
    projects.add(task.projectId);
  }

  return { encoding, projects, tasks };
}
