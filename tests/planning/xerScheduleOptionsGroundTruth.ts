import type {
  XerScheduleOptionFallback,
  XerScheduleOptionsDiagnostic,
  XerScheduleOptionsSourceArchive,
  XerScheduleOptionsSourceRow,
} from '@/services/importTypes';
import type { ProgressMode, SchedulingOptions } from '@/types/project';

export interface RawXerScheduleRow {
  line: number;
  cells: Record<string, string>;
}

export interface RawXerScheduleScan {
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';
  tables: Map<string, { fields: string[]; rows: RawXerScheduleRow[] }>;
  sourceArchive: XerScheduleOptionsSourceArchive;
  projectRowIndexesById: Map<string, number[]>;
  scheduleRowIndexesById: Map<string, number[]>;
}

export interface IndependentXerScheduleExpected {
  progressMode: ProgressMode;
  schedulingOptions: SchedulingOptions;
  source: 'schedoptions' | 'xer-defaults';
  retainedSource: { sched_use_project_end_date_for_float?: boolean };
  fallbacks: XerScheduleOptionFallback[];
  diagnostics: XerScheduleOptionsDiagnostic[];
  sourceRowIndexes: number[];
  sourceRows: XerScheduleOptionsSourceRow[];
}

function decodeRaw(bytes: Uint8Array): { text: string; encoding: RawXerScheduleScan['encoding'] } {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(3)), encoding: 'utf-8' };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2)), encoding: 'utf-16le' };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be', { fatal: true }).decode(bytes.subarray(2)), encoding: 'utf-16be' };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' };
  }
}

function rowIndexes(rows: readonly XerScheduleOptionsSourceRow[]): Map<string, number[]> {
  const result = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const projectId = row.cells.proj_id?.trim() ?? '';
    const indexes = result.get(projectId) ?? [];
    indexes.push(index);
    result.set(projectId, indexes);
  });
  return result;
}

/** Testlaag-orakel: geen productieparser, reader of SCHEDOPTIONS-mapper wordt aangeroepen. */
export function scanRawXerScheduleOptions(bytes: Uint8Array): RawXerScheduleScan {
  const decoded = decodeRaw(bytes);
  const tables = new Map<string, { fields: string[]; rows: RawXerScheduleRow[] }>();
  let tableName = '';
  let fields: string[] = [];
  decoded.text.split(/\r?\n/).forEach((line, zeroBasedLine) => {
    const cells = line.split('\t');
    if (cells[0] === '%E') return;
    if (cells[0] === '%T') {
      tableName = cells[1]?.trim().toUpperCase() ?? '';
      fields = [];
      if (tableName && !tables.has(tableName)) tables.set(tableName, { fields: [], rows: [] });
      return;
    }
    if (!tableName) return;
    if (cells[0] === '%F') {
      fields = cells.slice(1).map(field => field.trim().toLowerCase());
      tables.get(tableName)!.fields = [...fields];
      return;
    }
    if (cells[0] !== '%R' || fields.length === 0) return;
    const row: RawXerScheduleRow = { line: zeroBasedLine + 1, cells: {} };
    fields.forEach((field, index) => { row.cells[field] = cells[index + 1] ?? ''; });
    tables.get(tableName)!.rows.push(row);
  });

  const projectRows: XerScheduleOptionsSourceRow[] = (tables.get('PROJECT')?.rows ?? [])
    .map(row => ({ table: 'PROJECT', line: row.line, cells: { ...row.cells } }));
  const scheduleRows: XerScheduleOptionsSourceRow[] = (tables.get('SCHEDOPTIONS')?.rows ?? [])
    .map(row => ({ table: 'SCHEDOPTIONS', line: row.line, cells: { ...row.cells } }));
  const rows = [...projectRows, ...scheduleRows];
  const projectRowIndexesById = rowIndexes(projectRows);
  const scheduleOffset = projectRows.length;
  const scheduleRowIndexesById = new Map<string, number[]>();
  scheduleRows.forEach((row, index) => {
    const projectId = row.cells.proj_id?.trim() ?? '';
    const indexes = scheduleRowIndexesById.get(projectId) ?? [];
    indexes.push(scheduleOffset + index);
    scheduleRowIndexesById.set(projectId, indexes);
  });
  const projectIds = new Set(projectRowIndexesById.keys());
  const unmatchedScheduleOptionsRowIndexes = [...scheduleRowIndexesById]
    .filter(([projectId]) => !projectIds.has(projectId))
    .flatMap(([, indexes]) => indexes);
  const diagnostics: XerScheduleOptionsDiagnostic[] = [...scheduleRowIndexesById]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([projectId, indexes]) => ({
      code: 'XER_DUPLICATE_SCHEDOPTIONS_PROJ_ID',
      projectId,
      rowIndexes: [...indexes],
      lines: indexes.map(index => rows[index].line),
    }));
  return {
    encoding: decoded.encoding,
    tables,
    sourceArchive: { rows, unmatchedScheduleOptionsRowIndexes, diagnostics },
    projectRowIndexesById,
    scheduleRowIndexesById,
  };
}

function fallback(
  sink: XerScheduleOptionFallback[], row: XerScheduleOptionsSourceRow,
  field: string, token: string, value: string,
): void {
  sink.push({ field, token, fallback: value, line: row.line });
}

function bool(
  row: XerScheduleOptionsSourceRow, field: string, defaultValue: boolean,
  fallbacks: XerScheduleOptionFallback[],
): boolean {
  const token = row.cells[field]?.trim() ?? '';
  if (!token) return defaultValue;
  if (token.toUpperCase() === 'Y') return true;
  if (token.toUpperCase() === 'N') return false;
  fallback(fallbacks, row, field, token, String(defaultValue));
  return defaultValue;
}

function enumToken<T extends string>(
  row: XerScheduleOptionsSourceRow, field: string, mapping: Readonly<Record<string, T>>,
  defaultValue: T, fallbacks: XerScheduleOptionFallback[],
): T {
  const token = row.cells[field]?.trim() ?? '';
  if (!token) return defaultValue;
  const value = mapping[token.toUpperCase()];
  if (value !== undefined) return value;
  fallback(fallbacks, row, field, token, defaultValue);
  return defaultValue;
}

function rawNumber(raw: string): number | null {
  const token = raw.trim();
  if (!token) return null;
  const normalized = token.includes(',') && !token.includes('.') ? token.replace(',', '.') : token;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function expectedXerScheduleOptions(
  scan: RawXerScheduleScan,
  projectId: string,
  context: { taskCount?: number } = {},
): IndependentXerScheduleExpected {
  const projectIndexes = scan.projectRowIndexesById.get(projectId) ?? [];
  const scheduleIndexes = scan.scheduleRowIndexesById.get(projectId) ?? [];
  const sourceRowIndexes = [...projectIndexes, ...scheduleIndexes];
  const sourceRows = sourceRowIndexes.map(index => scan.sourceArchive.rows[index]);
  const projectRow = projectIndexes.length === 1 ? scan.sourceArchive.rows[projectIndexes[0]] : undefined;
  const scheduleRow = scheduleIndexes.length === 1 ? scan.sourceArchive.rows[scheduleIndexes[0]] : undefined;
  const diagnostics = scan.sourceArchive.diagnostics.filter(item => item.projectId === projectId);
  const fallbacks: XerScheduleOptionFallback[] = [];
  const criticalToken = projectRow?.cells.critical_path_type?.trim() ?? '';
  let criticalDefinition: SchedulingOptions['criticalDefinition'];
  if (criticalToken.toUpperCase() === 'CT_DRIVPATH') {
    criticalDefinition = { mode: 'longestPath' };
  } else {
    if (criticalToken && criticalToken.toUpperCase() !== 'CT_TOTFLOAT' && projectRow) {
      fallback(fallbacks, projectRow, 'critical_path_type', criticalToken, 'totalFloat');
    }
    criticalDefinition = {
      mode: 'totalFloat',
      thresholdHours: rawNumber(projectRow?.cells.critical_drtn_hr_cnt ?? '') ?? 0,
    };
  }
  const schedulingOptions: SchedulingOptions = {
    // Onafhankelijk testorakel: deze XER-eigen switches zijn letterlijk uit de toegestane
    // PROJECT/SCHEDOPTIONS-bronvorm afgeleid als vaste, brongebonden defaults — geen import van
    // `xerScheduleOptions.ts`, zodat een productwijziging de verwachting niet kan meeschuiven.
    p6Source: 'XER',
    lagCalendar: 'predecessor',
    criticalDefinition,
    totalFloatMode: 'finish',
    makeOpenEndedCritical: false,
    useExpectedFinishDates: true,
    preserveActualDatesInBackwardPass: true,
    clampNegativeFreeFloat: true,
    p6ZeroDurationUsesPlannedBoundary: true,
    p6UseTaskPlannedStartFloor: true,
    p6FinishMilestoneBoundaryWindow: true,
    p6PreserveActualInstants: true,
    // PROJECT is de bron van deze keuze, óók als een project geen SCHEDOPTIONS-rij heeft.
    // Dit blijft een onafhankelijke raw-scan: nooit de productie-afleiding hergebruiken.
    p6UseRemainingStartForProgress:
      projectRow?.cells.rem_target_link_flag?.trim().toUpperCase() === 'Y',
    p6PreserveZeroDurationConstraintInstants: true,
  };
  if (!scheduleRow) {
    return {
      progressMode: 'RETAINED_LOGIC', schedulingOptions, source: 'xer-defaults',
      retainedSource: {}, fallbacks, diagnostics, sourceRowIndexes, sourceRows,
    };
  }

  schedulingOptions.lagCalendar = enumToken(scheduleRow, 'sched_calendar_on_relationship_lag', {
    RCAL_PREDECESSOR: 'predecessor', RCAL_SUCCESSOR: 'successor',
    RCAL_24HOUR: '24hour', RCAL_PROJDEFAULT: 'projectDefault',
  } as const, 'predecessor', fallbacks);
  schedulingOptions.totalFloatMode = enumToken(scheduleRow, 'sched_float_type', {
    FT_SS: 'start', FT_FF: 'finish', FT_MIN: 'smallest',
  } as const, 'finish', fallbacks);
  schedulingOptions.makeOpenEndedCritical = bool(
    scheduleRow, 'sched_open_critical_flag', false, fallbacks,
  );
  schedulingOptions.useExpectedFinishDates = bool(
    scheduleRow, 'sched_use_expect_end_flag', true, fallbacks,
  );
  const retainedToken = scheduleRow.cells.sched_use_project_end_date_for_float?.trim() ?? '';
  let retainedSource: IndependentXerScheduleExpected['retainedSource'] = {};
  if (retainedToken.toUpperCase() === 'Y') {
    retainedSource = { sched_use_project_end_date_for_float: true };
    schedulingOptions.useProjectEndDateForFloat = true;
  } else if (retainedToken.toUpperCase() === 'N') {
    retainedSource = { sched_use_project_end_date_for_float: false };
    schedulingOptions.useProjectEndDateForFloat = false;
  }
  else if (retainedToken) fallback(
    fallbacks, scheduleRow, 'sched_use_project_end_date_for_float', retainedToken, 'niet bewaard',
  );

  const retainedTokenRaw = scheduleRow.cells.sched_retained_logic?.trim() ?? '';
  const overrideTokenRaw = scheduleRow.cells.sched_progress_override?.trim() ?? '';
  let progressMode: ProgressMode = 'RETAINED_LOGIC';
  if (retainedTokenRaw || overrideTokenRaw) {
    const retained = bool(scheduleRow, 'sched_retained_logic', true, fallbacks);
    const override = bool(scheduleRow, 'sched_progress_override', false, fallbacks);
    if (!retained && override) progressMode = 'PROGRESS_OVERRIDE';
    else if (!(retained && !override)) fallback(
      fallbacks,
      scheduleRow,
      'sched_retained_logic/sched_progress_override',
      `${retainedTokenRaw || '(leeg)'}/${overrideTokenRaw || '(leeg)'}`,
      'RETAINED_LOGIC',
    );
  }

  const floatPathFields = [
    'enable_multiple_longest_path_calc', 'use_total_float_multiple_longest_paths',
    'use_total_float', 'limit_multiple_longest_path_calc', 'max_multiple_longest_path',
  ];
  if (floatPathFields.some(field => (scheduleRow.cells[field]?.trim() ?? '') !== '')) {
    const methodField = scheduleRow.cells.use_total_float_multiple_longest_paths?.trim()
      ? 'use_total_float_multiple_longest_paths' : 'use_total_float';
    const limited = bool(scheduleRow, 'limit_multiple_longest_path_calc', true, fallbacks);
    schedulingOptions.floatPaths = {
      enabled: bool(scheduleRow, 'enable_multiple_longest_path_calc', false, fallbacks),
      method: bool(scheduleRow, methodField, false, fallbacks) ? 'TOTAL_FLOAT' : 'FREE_FLOAT',
      maxPaths: limited
        ? Math.max(1, Math.floor(rawNumber(scheduleRow.cells.max_multiple_longest_path ?? '') ?? 10))
        : Math.max(1, Math.floor(context.taskCount ?? Number.MAX_SAFE_INTEGER)),
    };
  }
  return {
    progressMode, schedulingOptions, source: 'schedoptions', retainedSource,
    fallbacks, diagnostics, sourceRowIndexes, sourceRows,
  };
}

export function hasProjectAddressableScheduleRow(scan: RawXerScheduleScan): boolean {
  return [...scan.scheduleRowIndexesById].some(([projectId, indexes]) =>
    indexes.length === 1 && scan.projectRowIndexesById.has(projectId));
}
