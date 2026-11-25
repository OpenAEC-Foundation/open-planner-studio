/**
 * Semantische XER-project-/taaklezer.
 *
 * Voor begrip van P6's tokenvocabulaire en de betekenis van PROJECT/PROJWBS/TASK/TASKPRED is
 * MPXJ geraadpleegd: https://github.com/joniles/mpxj (Primavera-reader, LGPL-2.1, Jon Iles e.a.).
 * Er is geen MPXJ-code overgenomen. De mapping, fout-/rapportvorm, WBS-opbouw en kalenderkeuzes
 * hieronder zijn zelfstandig voor Open Planner Studio geïmplementeerd en door eigen fixtures
 * vastgelegd.
 */

import type {
  ImportResult, XerEnumFallback, XerExternalRelation, XerImportMetadata,
} from '@/services/importTypes';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import {
  canonicalizeBands,
  getCalendarBands,
  promoteHourCalendar,
  registerCalendarBands,
  sixDecimalHoursToMinutes,
} from '@/services/subdayIo';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence, SequenceType } from '@/types/sequence';
import type {
  P6ActivityType,
  P6CompletePctType,
  P6DurationType,
  Task,
  TaskConstraint,
  TaskStatus,
} from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { effHoursPerDay, hourTaskScheduleDuration } from '@/utils/taskDuration';
import { defaultActualStart } from '@/engine/taskMutationRules';
import { orderActualsAfterDerivedFinish } from '@/engine/actualDatesOrder';
import { flattenOrder } from '@/utils/wbs';
import { formatInstant, parseInstant } from '@/utils/dateUtils';
import { hasValidP6SuspendResume } from '@/utils/p6SuspendResume';
import {
  archiveDocumentViewFromOwnedReaderMetadata,
  bindXerImportMetadataToArchive,
  createXerSourceArchiveFromOwnedMetadata,
  detectXerSourcePresentation,
  type XerSourceReconstruction,
} from '@/services/xerSourceArchive';
import type { RecordedTime } from '@/engine/scheduler/recordedDates';
import { defaultImportedActualFinish, deriveImportedWorkRules } from '@/services/importNormalize';
import { emptyMissingScheduleDates, resolveMissingScheduleDates } from '@/services/importDates';
import { taskWorkMinutes as activityWorkMinutesOf } from '@/engine/contour/contourEngine';
import { XER_DURATION_TYPE_TOKEN } from '@/engine/work/workRuleMapping';
import { DEFAULT_WORK_RULE, type WorkRule } from '@/types/workRule';
import {
  dayMeasureMinutesPerDay, lagFromRecord, lagRecordHolds, lagRecordKey, lagWorkMinutesPerDay, parseFieldRecords,
  parseLagRecords, readMeasure, type LagRecord,
} from '@/services/xmlDayMeasure';
import { readXerCalendars } from './xerCalendarData';
import { readXerOpsFields, XER_DURATION_FIELDS, type XerOpsFields } from './xerOpsMarkers';
import { sourceInstant } from './xerInstant';
import { readXerRecordedTimes } from './xerRecordedTimes';
import { buildXerMetadataCatalog, materializeXerMetadata, type XerMetadataCatalog } from './xerMetadata';
import { indexXerTaskResourceRows } from './xerResourceAssignments';
import {
  buildXerResourceCatalog,
  materializeXerResources,
  type XerResourceCatalog,
} from './xerResources';
import { assembleXerMultiProjectImport, type XerMultiProjectImport } from './xerMultiProject';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import {
  deriveXerScheduleOptions,
  indexXerScheduleOptions,
  type XerScheduleOptionsIndex,
} from './xerScheduleOptions';
import {
  parseXerNumber,
  parseXerTables,
  XerImportError,
  type XerRow,
  type XerTables,
} from './xerTables';

export interface XerReadResult extends ImportResult {
  xer: XerImportMetadata;
}

export type XerOpenResult = XerReadResult | XerMultiProjectImport;

export interface XerProjectRowsIndex {
  tasksByProject: ReadonlyMap<string, readonly XerRow[]>;
  wbsByProject: ReadonlyMap<string, readonly XerRow[]>;
  relationsByProject: ReadonlyMap<string, readonly XerRow[]>;
  visitCount: number;
  relationResolutionIssues: readonly {
    reason: 'ambiguous' | 'dangling';
    line: number;
    field: 'task_id' | 'pred_task_id' | 'proj_id';
    taskId: string;
    predecessorTaskId: string;
  }[];
}

export function indexXerProjectRows(tables: XerTables): XerProjectRowsIndex {
  const tasksByProject = new Map<string, XerRow[]>();
  const wbsByProject = new Map<string, XerRow[]>();
  const relationsByProject = new Map<string, XerRow[]>();
  const projectsByTaskId = new Map<string, Set<string>>();
  const relationResolutionIssues: Array<XerProjectRowsIndex['relationResolutionIssues'][number]> = [];
  const unscopedRelationResolution = new Map<string, {
    projectId?: string;
    reason?: 'ambiguous' | 'dangling';
    field?: 'task_id' | 'pred_task_id' | 'proj_id';
  }>();
  let visitCount = 0;
  const append = (map: Map<string, XerRow[]>, projectId: string, row: XerRow): void => {
    const rows = map.get(projectId) ?? [];
    rows.push(row);
    map.set(projectId, rows);
  };
  for (const row of tables.tables.get('TASK')?.rows ?? []) {
    visitCount++;
    append(tasksByProject, row.cells.proj_id, row);
    const taskProjects = projectsByTaskId.get(row.cells.task_id) ?? new Set<string>();
    taskProjects.add(row.cells.proj_id);
    projectsByTaskId.set(row.cells.task_id, taskProjects);
  }
  for (const row of tables.tables.get('PROJWBS')?.rows ?? []) { visitCount++; append(wbsByProject, row.cells.proj_id, row); }
  for (const row of tables.tables.get('TASKPRED')?.rows ?? []) {
    visitCount++;
    const successorProjectId = (row.cells.proj_id ?? '').trim();
    const predecessorProjectId = (row.cells.pred_proj_id ?? '').trim();
    if (successorProjectId || predecessorProjectId) {
      const projects = new Set([successorProjectId || predecessorProjectId, predecessorProjectId || successorProjectId]);
      for (const projectId of projects) append(relationsByProject, projectId, row);
      continue;
    }

    const cacheKey = `${row.cells.task_id}\u0000${row.cells.pred_task_id}`;
    let resolution = unscopedRelationResolution.get(cacheKey);
    if (!resolution) {
      const successorProjects = projectsByTaskId.get(row.cells.task_id);
      const predecessorProjects = projectsByTaskId.get(row.cells.pred_task_id);
      if (!successorProjects?.size || !predecessorProjects?.size) {
        resolution = {
          reason: 'dangling',
          field: !successorProjects?.size ? 'task_id' : 'pred_task_id',
        };
      } else {
        const [smallest, other] = successorProjects.size <= predecessorProjects.size
          ? [successorProjects, predecessorProjects]
          : [predecessorProjects, successorProjects];
        let onlyProjectId: string | undefined;
        let matches = 0;
        for (const projectId of smallest) {
          if (!other.has(projectId)) continue;
          onlyProjectId = projectId;
          matches++;
          if (matches > 1) break;
        }
        resolution = matches === 1
          ? { projectId: onlyProjectId }
          : { reason: 'ambiguous', field: 'proj_id' };
      }
      unscopedRelationResolution.set(cacheKey, resolution);
    }
    if (!resolution.projectId) {
      relationResolutionIssues.push({
        reason: resolution.reason ?? 'ambiguous',
        line: row.line,
        field: resolution.field ?? 'proj_id',
        taskId: row.cells.task_id,
        predecessorTaskId: row.cells.pred_task_id,
      });
      continue;
    }
    append(relationsByProject, resolution.projectId, row);
  }
  return { tasksByProject, wbsByProject, relationsByProject, visitCount, relationResolutionIssues };
}

const ACTIVITY_TYPES: readonly P6ActivityType[] = [
  'TT_Task', 'TT_Rsrc', 'TT_LOE', 'TT_Mile', 'TT_FinMile', 'TT_WBS',
];
const DURATION_TYPES: readonly P6DurationType[] = [
  'DT_FixedDrtn', 'DT_FixedDUR2', 'DT_FixedRate', 'DT_FixedQty',
];
const COMPLETE_PCT_TYPES: readonly P6CompletePctType[] = ['CP_Drtn', 'CP_Phys', 'CP_Units'];

function canonicalToken<T extends string>(raw: string, values: readonly T[]): T | undefined {
  const folded = raw.trim().toLowerCase();
  return values.find(value => value.toLowerCase() === folded);
}

function fallback(
  sink: XerEnumFallback[],
  family: XerEnumFallback['family'],
  token: string,
  value: string,
  table: XerEnumFallback['table'],
  field: string,
  line: number,
): void {
  if (!token.trim()) return;
  sink.push({ family, token, fallback: value, table, field, line });
}

function numberOf(
  tables: XerTables,
  row: XerRow,
  field: string,
  table: 'TASK' | 'TASKPRED' = 'TASK',
): number | null {
  const raw = row.cells[field] ?? '';
  try {
    return parseXerNumber(raw, tables.numberFormat);
  } catch (error) {
    if (error instanceof XerImportError) {
      throw new XerImportError(error.xerCode, error.message, {
        table, field, line: row.line, encoding: tables.report.encoding,
      });
    }
    throw error;
  }
}

function hasClock(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}/.test(raw.trim());
}

function projectStatusDate(tables: XerTables, projectRow: XerRow, hourMode: boolean): string | undefined {
  const fields = tables.tables.get('PROJECT')?.fields ?? [];
  const raw = fields.includes('last_recalc_date')
    ? projectRow.cells.last_recalc_date ?? ''
    : fields.includes('data_date')
      ? projectRow.cells.data_date ?? ''
      : '';
  return sourceInstant(raw, hourMode);
}

const MISSING_START_PLACEHOLDER = '0001-01-01';

function clockMinute(raw: string): number | undefined {
  const match = raw.trim().match(/^\d{4}-\d{2}-\d{2}[ T](\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return hour * 60 + minute;
}

function inferBlankCalendarBands(
  tables: XerTables,
  calendar: WorkCalendar,
  activityRows: readonly XerRow[],
  projectCalendarId: string,
): boolean {
  const sourceRow = (tables.tables.get('CALENDAR')?.rows ?? [])
    .find(row => row.cells.clndr_id.trim() === calendar.id);
  if (!sourceRow || (sourceRow.cells.clndr_data ?? '').trim() !== '') return false;

  const pairCounts = new Map<string, number>();
  for (const row of activityRows) {
    if ((row.cells.clndr_id || projectCalendarId) !== calendar.id) continue;
    const durationHours = numberOf(tables, row, 'target_drtn_hr_cnt') ?? 0;
    const dayCount = durationHours / calendar.hoursPerDay;
    if (!(durationHours > 0) || Math.abs(dayCount - Math.round(dayCount)) > 1e-9) continue;
    const start = clockMinute(row.cells.target_start_date ?? '');
    const finish = clockMinute(row.cells.target_end_date ?? '');
    if (start === undefined || finish === undefined || finish <= start) continue;
    const key = `${start}:${finish}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }
  let best: { start: number; finish: number; count: number } | undefined;
  for (const [key, count] of pairCounts) {
    const [start, finish] = key.split(':').map(Number);
    if (!best || count > best.count || (count === best.count && key < `${best.start}:${best.finish}`)) {
      best = { start, finish, count };
    }
  }
  if (!best) return false;

  const netMinutes = calendar.hoursPerDay * 60;
  const spanMinutes = best.finish - best.start;
  let dayBands: { start: number; end: number }[] | undefined;
  if (spanMinutes === netMinutes) {
    dayBands = [{ start: best.start, end: best.finish }];
  } else {
    const gapMinutes = spanMinutes - netMinutes;
    const lunchStart = 12 * 60;
    const lunchEnd = lunchStart + gapMinutes;
    if (gapMinutes > 0 && best.start < lunchStart && lunchEnd < best.finish) {
      dayBands = [
        { start: best.start, end: lunchStart },
        { start: lunchEnd, end: best.finish },
      ];
    }
  }
  if (!dayBands) return false;
  const byDay = Object.fromEntries(calendar.workDays.map(day => [day, dayBands]));
  const canonical = canonicalizeBands(byDay).bands;
  registerCalendarBands(calendar, { canonical, deviates: dayBands.length > 1 });
  calendar.workStartHour = best.start / 60;
  calendar.workEndHour = best.finish / 60;
  return true;
}

function sourceX7Instant(raw: string): string | undefined {
  return sourceInstant(raw, hasClock(raw));
}

function activityTypeOf(
  raw: string,
  row: XerRow,
  issues: XerEnumFallback[],
): P6ActivityType {
  const known = canonicalToken(raw, ACTIVITY_TYPES);
  if (known) return known;
  fallback(issues, 'activityType', raw, 'TT_Task', 'TASK', 'task_type', row.line);
  return 'TT_Task';
}

function durationTypeOf(
  raw: string,
  defaultType: P6DurationType,
  row: XerRow,
  issues: XerEnumFallback[],
  table: 'PROJECT' | 'TASK' = 'TASK',
): P6DurationType {
  const known = canonicalToken(raw, DURATION_TYPES);
  if (known) return known;
  fallback(
    issues,
    'durationType',
    raw,
    defaultType,
    table,
    table === 'PROJECT' ? 'def_duration_type' : 'duration_type',
    row.line,
  );
  return defaultType;
}

function statusOf(raw: string, row: XerRow, issues: XerEnumFallback[]): TaskStatus {
  const token = raw.trim().toLowerCase();
  if (token === 'tk_notstart') return 'NOT_STARTED';
  if (token === 'tk_active') return 'STARTED';
  if (token === 'tk_complete') return 'COMPLETED';
  fallback(issues, 'status', raw, 'NOT_STARTED', 'TASK', 'status_code', row.line);
  return 'NOT_STARTED';
}

function statusFromProgress(
  completion: number,
  actualStart: string | undefined,
  actualFinish: string | undefined,
): TaskStatus {
  if (actualFinish || completion >= 1) return 'COMPLETED';
  if (actualStart || completion > 0) return 'STARTED';
  return 'NOT_STARTED';
}

function completePctTypeOf(raw: string, row: XerRow, issues: XerEnumFallback[]): P6CompletePctType {
  const known = canonicalToken(raw, COMPLETE_PCT_TYPES);
  if (known) return known;
  fallback(issues, 'completePctType', raw, 'CP_Drtn', 'TASK', 'complete_pct_type', row.line);
  return 'CP_Drtn';
}

function priorityOf(raw: string, row: XerRow, issues: XerEnumFallback[]): number {
  const priorities: Record<string, number> = {
    pt_lowest: 0,
    pt_verylow: 250,
    pt_low: 400,
    pt_normal: 500,
    pt_high: 750,
    pt_veryhigh: 900,
    pt_top: 1000,
  };
  const token = raw.trim().toLowerCase();
  if (!token) return 500;
  const known = priorities[token];
  if (known !== undefined) return known;
  fallback(issues, 'priority', raw, '500', 'TASK', 'priority_type', row.line);
  return 500;
}

function constraintOf(
  raw: string,
  dateRaw: string,
  hourMode: boolean,
  row: XerRow,
  issues: XerEnumFallback[],
  secondary: boolean,
): TaskConstraint | undefined {
  const token = raw.trim().toUpperCase();
  if (!token) return undefined;
  const mapping: Record<string, { type: TaskConstraint['type']; hard?: boolean }> = {
    CS_ALAP: { type: 'ALAP' },
    CS_MSO: { type: 'MSO' },
    CS_MSOA: { type: 'SNET' },
    CS_MSOB: { type: 'SNLT' },
    CS_MEO: { type: 'MFO' },
    CS_MEOA: { type: 'FNET' },
    CS_MEOB: { type: 'FNLT' },
    CS_MANDSTART: { type: 'MSO', hard: true },
    CS_MANSTART: { type: 'MSO', hard: true },
    CS_MANDFIN: { type: 'MFO', hard: true },
    CS_MANFINISH: { type: 'MFO', hard: true },
  };
  const known = mapping[token];
  if (!known) {
    fallback(issues, 'constraint', raw, 'ASAP', 'TASK', secondary ? 'cstr_type2' : 'cstr_type', row.line);
    return undefined;
  }
  const date = sourceInstant(dateRaw, hourMode);
  return {
    type: known.type,
    ...(date ? { date } : {}),
    ...(!secondary && known.hard ? { hard: true } : {}),
  };
}

function relationTypeOf(
  raw: string,
  row: XerRow,
  issues: XerEnumFallback[],
): { sequence: SequenceType; source: 'FS' | 'SS' | 'FF' | 'SF' } {
  const token = raw.trim().toUpperCase();
  const mapping: Record<string, { sequence: SequenceType; source: 'FS' | 'SS' | 'FF' | 'SF' }> = {
    PR_FS: { sequence: 'FINISH_START', source: 'FS' },
    PR_SS: { sequence: 'START_START', source: 'SS' },
    PR_FF: { sequence: 'FINISH_FINISH', source: 'FF' },
    PR_SF: { sequence: 'START_FINISH', source: 'SF' },
    FS: { sequence: 'FINISH_START', source: 'FS' },
    SS: { sequence: 'START_START', source: 'SS' },
    FF: { sequence: 'FINISH_FINISH', source: 'FF' },
    SF: { sequence: 'START_FINISH', source: 'SF' },
  };
  const known = mapping[token];
  if (known) return known;
  fallback(issues, 'relation', raw, 'FS', 'TASKPRED', 'pred_type', row.line);
  return mapping.PR_FS;
}

function wbsTaskId(projectId: string, wbsId: string): string {
  return `xer-wbs:${projectId}:${wbsId}`;
}

function compareCodePoints(left: string, right: string): number {
  const a = Array.from(left, char => char.codePointAt(0) ?? 0);
  const b = Array.from(right, char => char.codePointAt(0) ?? 0);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

export function xerProjectName(projectRow: XerRow, wbsRows: readonly XerRow[]): string {
  const direct = (projectRow.cells.proj_name ?? '').trim();
  if (direct) return direct;
  const ids = new Set(wbsRows.map(row => row.cells.wbs_id));
  const roots = wbsRows.filter(row => !row.cells.parent_wbs_id || !ids.has(row.cells.parent_wbs_id));
  return roots.length === 1 ? (roots[0].cells.wbs_name ?? '').trim() : '';
}

function compareP6Keys(left: string, right: string): number {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) {
    const a = left.replace(/^0+(?=\d)/, '');
    const b = right.replace(/^0+(?=\d)/, '');
    return a.length - b.length || compareCodePoints(a, b) || compareCodePoints(left, right);
  }
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return compareCodePoints(left, right);
}

function localParentWbsId(row: XerRow, localWbsIds: ReadonlySet<string>): string | null {
  const parent = row.cells.parent_wbs_id;
  return parent && localWbsIds.has(parent) ? parent : null;
}

function stableWbsRows(rows: readonly XerRow[], projectId: string, localWbsIds: ReadonlySet<string>): XerRow[] {
  return rows
    .filter(row => row.cells.proj_id === projectId)
    .sort((left, right) => {
      const parentOrder = compareP6Keys(
        localParentWbsId(left, localWbsIds) ?? '', localParentWbsId(right, localWbsIds) ?? '',
      );
      const leftSeq = Number(left.cells.seq_num) || 0;
      const rightSeq = Number(right.cells.seq_num) || 0;
      return parentOrder
        || leftSeq - rightSeq
        || compareP6Keys(left.cells.wbs_id ?? '', right.cells.wbs_id ?? '')
        || left.line - right.line;
    });
}

function assertUniqueId(
  rows: readonly XerRow[], table: 'PROJWBS' | 'TASK' | 'TASKPRED', field: string,
): void {
  const firstLineById = new Map<string, number>();
  for (const row of rows) {
    const id = row.cells[field]?.trim() ?? '';
    if (!id) continue;
    const firstLine = firstLineById.get(id);
    if (firstLine !== undefined) {
      throw new XerImportError(
        'XER_DUPLICATE_ID',
        `${table}.${field} bevat dubbele id '${id}' op regels ${firstLine} en ${row.line}.`,
        { table, field, line: row.line, lines: [firstLine, row.line] },
      );
    }
    firstLineById.set(id, row.line);
  }
}

function readXerProject(
  tables: XerTables,
  scheduleOptionsIndex: XerScheduleOptionsIndex,
  projectId: string,
  resourceCatalog: XerResourceCatalog,
  metadataCatalog: XerMetadataCatalog,
  taskResourceRowsByProject: ReadonlyMap<string, readonly XerRow[]>,
  projectRowsIndex: XerProjectRowsIndex,
  opsFields: XerOpsFields,
): XerReadResult {
  const projectRow = scheduleOptionsIndex.projectRowsById.get(projectId)?.row;
  if (!projectRow) {
    throw new XerImportError(
      'XER_MISSING_REQUIRED_VALUE',
      `PROJECT.proj_id '${projectId}' bestaat niet in de getokenized XER-invoer.`,
      { table: 'PROJECT', field: 'proj_id' },
    );
  }
  const activityRows = projectRowsIndex.tasksByProject.get(projectId) ?? [];
  if (activityRows.length === 0) {
    throw new XerImportError(
      'XER_EMPTY_PROJECT',
      `XER-project ${projectId} bevat geen activiteiten.`,
      { table: 'TASK' },
    );
  }
  const rawWbsRows = projectRowsIndex.wbsByProject.get(projectId) ?? [];
  const relationRows = projectRowsIndex.relationsByProject.get(projectId) ?? [];

  assertUniqueId(rawWbsRows, 'PROJWBS', 'wbs_id');
  const localWbsIds = new Set(
    rawWbsRows.filter(row => row.cells.proj_id === projectId).map(row => row.cells.wbs_id),
  );
  assertUniqueId(activityRows, 'TASK', 'task_id');
  assertUniqueId(relationRows, 'TASKPRED', 'task_pred_id');
  const localTaskIds = new Set(activityRows.map(row => row.cells.task_id));
  for (const row of relationRows) {
    const successorProjectId = row.cells.proj_id || projectId;
    const predecessorProjectId = row.cells.pred_proj_id || successorProjectId;
    const missingField = successorProjectId === projectId && !localTaskIds.has(row.cells.task_id)
      ? 'task_id'
      : predecessorProjectId === projectId && !localTaskIds.has(row.cells.pred_task_id)
        ? 'pred_task_id'
        : undefined;
    if (missingField) {
      throw new XerImportError(
        'XER_DANGLING_LOCAL_RELATION',
        `TASKPRED op regel ${row.line} verwijst via ${missingField} naar een ontbrekende lokale activiteit.`,
        { table: 'TASKPRED', field: missingField, line: row.line },
      );
    }
  }

  const calendars = readXerCalendars(tables);
  const calendarList: WorkCalendar[] = [...calendars.calendars];
  if (calendarList.length === 0) {
    calendarList.push({
      id: projectRow.cells.clndr_id || `xer-calendar:${projectId}`,
      name: 'P6 Standard Calendar',
      description: '',
      workDays: [1, 2, 3, 4, 5],
      workStartHour: 8,
      workEndHour: 16,
      hoursPerDay: 8,
      holidays: [],
    });
  }
  const calendarById = new Map(calendarList.map(calendar => [calendar.id, calendar]));
  const fallbackCalendar = calendarList[0];
  const projectCalendar = calendarById.get(projectRow.cells.clndr_id) ?? fallbackCalendar;

  const hourSignalCalendarIds = new Set<string>();
  for (const row of activityRows) {
    const calendarId = row.cells.clndr_id || projectCalendar.id;
    if ([
      row.cells.target_start_date,
      row.cells.target_end_date,
      row.cells.act_start_date,
      row.cells.act_end_date,
      row.cells.cstr_date,
      row.cells.cstr_date2,
      row.cells.suspend_date,
      row.cells.resume_date,
      row.cells.expect_end_date,
    ].some(value => hasClock(value ?? ''))) {
      hourSignalCalendarIds.add(calendarId);
    }
  }
  const plannedWindowCalendarIds = new Set<string>();
  for (const calendar of calendarList) {
    if (inferBlankCalendarBands(tables, calendar, activityRows, projectCalendar.id)) {
      plannedWindowCalendarIds.add(calendar.id);
    }
    const periodHoursPerDay = calendar.hoursPerDay;
    if (promoteHourCalendar(
      calendar,
      getCalendarBands(calendar),
      hourSignalCalendarIds.has(calendar.id),
      false,
    )) calendar.hoursPerDay = periodHoursPerDay;
  }
  const calendarEngines = new Map(calendarList.map(calendar => [
    calendar.id,
    new CalendarEngine(calendar),
  ] as const));


  const enumFallbacks: XerEnumFallback[] = [];
  const projectDefaultDuration = durationTypeOf(
    projectRow.cells.def_duration_type ?? '',
    'DT_FixedDUR2',
    projectRow,
    enumFallbacks,
    'PROJECT',
  );
  const mappedActivities: Task[] = [];
  const inheritedRuleByTaskId = new Map<string, WorkRule>();
  let hasExplicitTaskFinish = false;
  const missingDates = emptyMissingScheduleDates();
  let missingPlannedStarts = 0;
  const derivedCompleted: Task[] = [];
  for (const row of activityRows) {
    const effectiveCalendar = calendarById.get(row.cells.clndr_id) ?? projectCalendar;
    const hourMode = effectiveCalendar.workTime !== undefined;
    const explicitTargetStart = sourceInstant(row.cells.target_start_date ?? '', hourMode);
    const explicitTargetFinish = sourceInstant(row.cells.target_end_date ?? '', hourMode);
    const hasExplicitTargetWindow = explicitTargetStart !== undefined && explicitTargetFinish !== undefined;
    if (explicitTargetFinish !== undefined) hasExplicitTaskFinish = true;
    const anchorStart = explicitTargetStart === undefined
      ? projectStatusDate(tables, projectRow, hourMode)
        ?? sourceInstant(projectRow.cells.plan_start_date ?? '', hourMode)
      : undefined;
    if (explicitTargetStart === undefined) {
      missingPlannedStarts += 1;
      if (anchorStart === undefined) missingDates.start.add(row.cells.task_id);
    }
    if (explicitTargetFinish === undefined) missingDates.finish.add(row.cells.task_id);
    let start = explicitTargetStart ?? anchorStart ?? MISSING_START_PLACEHOLDER;
    let finish = explicitTargetFinish ?? start;
    if (hourMode && start === finish
      && row.cells.task_type?.trim().toLowerCase() === 'tt_finmile') {
      const engine = calendarEngines.get(effectiveCalendar.id);
      const raw = parseInstant(start);
      const bands = engine?.effectiveBandsOn(raw) ?? [];
      const minute = raw.getUTCHours() * 60 + raw.getUTCMinutes();
      if (bands.length > 0 && minute === bands[0].start + 1) {
        const bandStart = new Date(raw.getTime() - 60_000);
        start = formatInstant(bandStart, 'hour');
        finish = formatInstant(engine!.prevWorkInstant(bandStart), 'hour');
      }
    }
    const durationHours = numberOf(tables, row, 'target_drtn_hr_cnt') ?? 0;
    const remainingHours = numberOf(tables, row, 'remain_drtn_hr_cnt');
    const sourceDurationMinutes = sixDecimalHoursToMinutes(durationHours);
    const hoursPerDay = effectiveCalendar.hoursPerDay > 0 ? effectiveCalendar.hoursPerDay : 8;
    const activityType = activityTypeOf(row.cells.task_type ?? '', row, enumFallbacks);
    const durationType = durationTypeOf(
      row.cells.duration_type ?? '', projectDefaultDuration, row, enumFallbacks,
    );
    const rawStatus = row.cells.status_code ?? '';
    const statusToken = rawStatus.trim().toLowerCase();
    const hasSourceStatus = statusToken !== '';
    const sourceStatus = hasSourceStatus ? statusOf(rawStatus, row, enumFallbacks) : undefined;
    const actualStart = sourceInstant(row.cells.act_start_date ?? '', hourMode);
    const actualFinish = sourceInstant(row.cells.act_end_date ?? '', hourMode);
    const rawCompletePctType = row.cells.complete_pct_type ?? '';
    const completePctType = rawCompletePctType.trim() === ''
      ? undefined
      : completePctTypeOf(rawCompletePctType, row, enumFallbacks);
    const statusForcesCompletion = statusToken === 'tk_notstart' || statusToken === 'tk_complete';
    const durationCompletionPercent = !statusForcesCompletion
      && (completePctType === 'CP_Drtn' || completePctType === 'CP_Units')
      ? numberOf(tables, row, 'complete_pct')
      : null;
    const completionPercent = statusForcesCompletion
      ? 0
      : completePctType === 'CP_Drtn' || completePctType === 'CP_Units'
        ? durationCompletionPercent
          ?? (completePctType === 'CP_Drtn' && remainingHours !== null && durationHours > 0
            ? (1 - remainingHours / durationHours) * 100
            : 0)
        : numberOf(tables, row, 'phys_complete_pct') ?? 0;
    const sourceCompletion = statusToken === 'tk_complete'
      ? 1
      : statusToken === 'tk_notstart'
        ? 0
        : Math.max(0, Math.min(1, completionPercent / 100));
    const status = sourceStatus ?? statusFromProgress(sourceCompletion, actualStart, actualFinish);
    const completion = !hasSourceStatus && actualFinish ? 1 : sourceCompletion;
    const parentId = row.cells.wbs_id && localWbsIds.has(row.cells.wbs_id)
      ? wbsTaskId(projectId, row.cells.wbs_id)
      : null;
    const plannedWindowMinutes = hourMode && plannedWindowCalendarIds.has(effectiveCalendar.id)
      ? calendarEngines.get(effectiveCalendar.id)?.workMinutesBetween(
        parseInstant(start), parseInstant(finish),
      )
      : undefined;
    const plannedWindowRepairsFractionalDay = plannedWindowMinutes !== undefined
      && plannedWindowMinutes > 0
      && Math.abs(plannedWindowMinutes - sourceDurationMinutes) <= hoursPerDay * 60;
    const durationMinutes = plannedWindowRepairsFractionalDay
      ? plannedWindowMinutes
      : sourceDurationMinutes;
    const time = createDefaultTaskTime(
      start,
      hourTaskScheduleDuration(durationMinutes, effectiveCalendar),
      'hours',
    );
    time.scheduleFinish = finish;
    time.earlyStart = start;
    time.earlyFinish = finish;
    time.lateStart = start;
    time.lateFinish = finish;
    time.completion = completion;
    const remainingFromPercent = status === 'STARTED' && completePctType === 'CP_Drtn'
      && durationCompletionPercent !== null;
    const p6RemainingHours = remainingFromPercent
      ? durationHours * (1 - completion)
      : remainingHours;
    time.durationMinutes = durationMinutes;
    if (p6RemainingHours !== null) {
      time.remainingMinutes = remainingFromPercent
        ? Math.round(p6RemainingHours * 60)
        : sixDecimalHoursToMinutes(p6RemainingHours);
    }
    const inheritedRule = opsFields.inheritedWorkRuleByTask.get(row.cells.task_id);
    if (inheritedRule && XER_DURATION_TYPE_TOKEN[inheritedRule] === row.cells.duration_type?.trim()) {
      inheritedRuleByTaskId.set(row.cells.task_id, inheritedRule);
    }
    const opsUnit = opsFields.unitByTask.get(row.cells.task_id);
    if (opsUnit) {
      const workMinutesPerDay = dayMeasureMinutesPerDay(effectiveCalendar, false);
      const measure = readMeasure({
        unit: opsUnit,
        durationMinutes,
        remainingMinutes: time.remainingMinutes,
        minutesPerDay: workMinutesPerDay > 0 ? workMinutesPerDay : 480,
        calendar: effectiveCalendar,
        dayRecords: opsUnit === 'days' ? parseFieldRecords(opsFields.dayRecordsByTask.get(row.cells.task_id), XER_DURATION_FIELDS) : {},
        exactRecords: opsUnit === 'hours' ? parseFieldRecords(opsFields.exactRecordsByTask.get(row.cells.task_id), XER_DURATION_FIELDS) : {},
        keepSourceMinutes: true,
      });
      time.durationUnit = measure.durationUnit;
      time.scheduleDuration = measure.scheduleDuration;
      if (measure.durationType) time.durationType = measure.durationType;
      delete time.durationMinutes;
      delete time.remainingMinutes;
      delete time.remainingTime;
      if (measure.durationMinutes !== undefined) time.durationMinutes = measure.durationMinutes;
      if (measure.remainingMinutes !== undefined) time.remainingMinutes = measure.remainingMinutes;
      if (measure.remainingTime !== undefined) time.remainingTime = measure.remainingTime;
    }
    if (actualStart) time.actualStart = actualStart;
    if (actualFinish) time.actualFinish = actualFinish;
    const stop = sourceX7Instant(row.cells.suspend_date ?? '');
    const resume = sourceX7Instant(row.cells.resume_date ?? '');
    if (stop) time.stop = stop;
    if (resume) time.resume = resume;
    const validSuspendResume = hasValidP6SuspendResume({
      p6ProjectId: projectId,
      p6SuspendResume: true,
      time,
    });
    const expectedFinish = sourceX7Instant(row.cells.expect_end_date ?? '');

    const isStartMilestone = activityType === 'TT_Mile';
    const isFinishMilestone = activityType === 'TT_FinMile';
    mappedActivities.push({
      id: row.cells.task_id,
      name: row.cells.task_name || row.cells.task_code || 'Activity',
      description: '',
      wbsCode: row.cells.task_code,
      taskType: 'CONSTRUCTION',
      status,
      isMilestone: isStartMilestone || isFinishMilestone,
      ...((isStartMilestone || isFinishMilestone)
        ? { milestoneKind: isFinishMilestone ? 'FINISH' as const : 'START' as const }
        : {}),
      priority: priorityOf(row.cells.priority_type ?? '', row, enumFallbacks),
      parentId,
      childIds: [],
      time,
      resourceIds: [],
      ...(row.cells.clndr_id && row.cells.clndr_id !== projectCalendar.id
        ? { calendarId: row.cells.clndr_id }
        : {}),
      p6DurationType: durationType,
      p6ActivityType: activityType,
      p6ProjectId: projectId,
      p6TaskId: row.cells.task_id,
      ...(hasExplicitTargetWindow ? { p6ExplicitTargetWindow: true } : {}),
      ...(completePctType ? { p6CompletePctType: completePctType } : {}),
      ...(expectedFinish ? { p6ExpectedFinish: expectedFinish } : {}),
      ...(validSuspendResume ? { p6SuspendResume: true } : {}),
      ...(activityType === 'TT_LOE' ? { isHammock: true } : {}),
      ...(() => {
        const constraint = constraintOf(
          row.cells.cstr_type ?? '', row.cells.cstr_date ?? '', hourMode, row, enumFallbacks, false,
        );
        const constraint2 = constraintOf(
          row.cells.cstr_type2 ?? '', row.cells.cstr_date2 ?? '', hourMode, row, enumFallbacks, true,
        );
        return { ...(constraint ? { constraint } : {}), ...(constraint2 ? { constraint2 } : {}) };
      })(),
    });
    if (!hasSourceStatus && status === 'COMPLETED') derivedCompleted.push(mappedActivities[mappedActivities.length - 1]);
  }

  resolveMissingScheduleDates(mappedActivities, missingDates, '', task =>
    calendarById.get(task.calendarId ?? '') ?? projectCalendar);

  const opsDefaultWorkRule = opsFields.defaultWorkRuleByProject.get(projectId);
  const defaultWorkRule = opsDefaultWorkRule
    && XER_DURATION_TYPE_TOKEN[opsDefaultWorkRule] === projectRow.cells.def_duration_type?.trim()
    ? opsDefaultWorkRule : undefined;
  const projectHourMode = projectCalendar.workTime !== undefined;
  const sourceProjectEnd = sourceInstant(projectRow.cells.plan_end_date ?? '', projectHourMode);
  const derivedSchedule = deriveXerScheduleOptions(scheduleOptionsIndex, projectId, {
    hoursPerDay: projectCalendar.hoursPerDay,
    taskCount: mappedActivities.length,
    hasUsableProjectEnd: sourceProjectEnd !== undefined || hasExplicitTaskFinish,
  });
  const {
    progressMode,
    schedulingOptions,
  } = derivedSchedule;
  const recordedTimes = readXerRecordedTimes(activityRows, {
    numberOf: (row, field) => numberOf(tables, row, field),
    effectiveCalendarOf: (row) => {
      const effectiveCalendar = calendarById.get(row.cells.clndr_id) ?? projectCalendar;
      const engine = calendarEngines.get(effectiveCalendar.id)!;
      return {
        id: effectiveCalendar.id,
        hourMode: effectiveCalendar.workTime !== undefined,
        minutesPerDay: engine.hoursPerDay * 60,
      };
    },
    taskIdOf: (row) => row.cells.task_id,
    criticalDefinition: schedulingOptions.criticalDefinition,
  });
  const scheduleOptionsMetadata: XerImportMetadata['scheduleOptions'] = {
    source: derivedSchedule.source,
    retainedSource: derivedSchedule.retainedSource,
    fallbacks: derivedSchedule.fallbacks,
    diagnostics: derivedSchedule.diagnostics,
    sourceArchive: derivedSchedule.sourceArchive,
    sourceRowIndexes: derivedSchedule.sourceRowIndexes,
    sourceRows: derivedSchedule.sourceRows,
  };
  const starts = mappedActivities.map(task => task.time.scheduleStart).filter(Boolean).sort();
  const finishes = mappedActivities.map(task => task.time.scheduleFinish).filter(Boolean).sort();
  const projectStart = starts[0];
  const taskDerivedProjectEnd = finishes[finishes.length - 1] ?? projectStart;
  const projectEnd = schedulingOptions.useProjectEndDateForFloat
    ? sourceProjectEnd ?? ''
    : taskDerivedProjectEnd;
  const statusDate = projectStatusDate(tables, projectRow, projectHourMode);
  for (const task of derivedCompleted) {
    const t = task.time;
    if (t.actualFinish) {
      if (!t.actualStart) t.actualStart = t.actualFinish;
      continue;
    }
    const startWasDerived = !t.actualStart;
    if (startWasDerived) t.actualStart = defaultActualStart(t);
    t.actualFinish = defaultImportedActualFinish(t, statusDate);
    orderActualsAfterDerivedFinish(t, statusDate, startWasDerived);
  }

  const wbsRows = stableWbsRows(rawWbsRows, projectId, localWbsIds);
  const wbsTasks: Task[] = wbsRows.map(row => {
    const id = wbsTaskId(projectId, row.cells.wbs_id);
    const localParent = localParentWbsId(row, localWbsIds);
    const parentId = localParent ? wbsTaskId(projectId, localParent) : null;
    return {
      id,
      name: row.cells.wbs_name || row.cells.wbs_short_name || 'WBS',
      description: '',
      wbsCode: row.cells.wbs_short_name ?? '',
      taskType: 'CONSTRUCTION',
      status: 'NOT_STARTED',
      isMilestone: false,
      isSummary: true,
      priority: 500,
      parentId,
      childIds: [],
      time: createDefaultTaskTime(projectStart, 0),
      resourceIds: [],
    };
  });
  const allTasks = [...flattenOrder([...wbsTasks, ...mappedActivities])];
  deriveImportedWorkRules(mappedActivities);
  const taskById = new Map(allTasks.map(task => [task.id, task]));
  for (const task of allTasks) {
    if (!task.parentId) continue;
    const parent = taskById.get(task.parentId);
    if (parent && !parent.childIds.includes(task.id)) parent.childIds.push(task.id);
  }

  const metadata = materializeXerMetadata(metadataCatalog, projectId);
  for (const [taskId, taskMetadata] of metadata.taskMetadata) {
    const task = taskById.get(taskId);
    if (!task) continue;
    if (taskMetadata.activityCodes) task.activityCodes = taskMetadata.activityCodes;
    if (taskMetadata.customFields) task.customFields = taskMetadata.customFields;
    if (taskMetadata.notes) task.notes = taskMetadata.notes;
  }

  const resourceResult = materializeXerResources(resourceCatalog, tables, {
    projectId,
    projectCalendarId: projectCalendar.id,
    projectHoursPerDay: projectCalendar.hoursPerDay,
    availableCalendarIds: new Set(calendarList.map(calendar => calendar.id)),
    calendarHoursPerDay: new Map(calendarList.map(calendar => [calendar.id, calendar.hoursPerDay])),
    taskIds: new Set(mappedActivities.map(task => task.id)),
    taskWorkMinutes: new Map(mappedActivities.map(task => [
      task.id,
      activityWorkMinutes(task, task.time.durationUnit === 'days'
        ? effHoursPerDay(calendarById.get(task.calendarId ?? '') ?? projectCalendar)
        : calendarById.get(task.calendarId ?? '')?.hoursPerDay ?? projectCalendar.hoursPerDay),
    ])),
    hourTaskHoursPerDay: new Map(mappedActivities.flatMap(task => {
      if (task.time.durationUnit !== 'hours') return [];
      const hoursPerDay = effHoursPerDay(calendarById.get(task.calendarId ?? '') ?? projectCalendar);
      return hoursPerDay > 0 ? [[task.id, hoursPerDay] as const] : [];
    })),
  }, taskResourceRowsByProject.get(projectId) ?? []);
  for (const assignment of resourceResult.assignments) {
    const task = taskById.get(assignment.taskId);
    if (task && !task.resourceIds.includes(assignment.resourceId)) task.resourceIds.push(assignment.resourceId);
  }

  const sequences: Sequence[] = [];
  const externalRelations: XerExternalRelation[] = [];
  const lagRecordsBySuccessor = new Map<string, Map<string, LagRecord>>();
  const lagKeyCount = new Map<string, number>();
  const lagKeyOf = (row: XerRow) => lagRecordKey(row.cells.pred_task_id, relationTypeOf(row.cells.pred_type, row, []).sequence);
  if (opsFields.lagRecordsByTask.size > 0) {
    for (const row of relationRows) {
      const key = `${row.cells.task_id}>${lagKeyOf(row)}`;
      lagKeyCount.set(key, (lagKeyCount.get(key) ?? 0) + 1);
    }
  }
  const effCalByTaskId = new Map(opsFields.lagRecordsByTask.size > 0
    ? mappedActivities.map(task => [task.id, calendarById.get(task.calendarId ?? '') ?? projectCalendar] as const)
    : []);
  const lagRecordOf = (row: XerRow): LagRecord | undefined => {
    const successorId = row.cells.task_id;
    const text = opsFields.lagRecordsByTask.get(successorId);
    if (text === undefined || lagKeyCount.get(`${successorId}>${lagKeyOf(row)}`) !== 1) return undefined;
    let records = lagRecordsBySuccessor.get(successorId);
    if (!records) {
      records = parseLagRecords(text);
      lagRecordsBySuccessor.set(successorId, records);
    }
    return records.get(lagKeyOf(row));
  };
  for (const row of relationRows) {
    const successorProjectId = row.cells.proj_id || projectId;
    const predecessorProjectId = row.cells.pred_proj_id || successorProjectId;
    const relationType = relationTypeOf(row.cells.pred_type, row, enumFallbacks);
    const lagMinutes = sixDecimalHoursToMinutes(numberOf(tables, row, 'lag_hr_cnt', 'TASKPRED') ?? 0);
    const relationId = row.cells.task_pred_id || `xer-rel:${row.line}`;
    const predecessorLocal = predecessorProjectId === projectId && taskById.has(row.cells.pred_task_id);
    const successorLocal = successorProjectId === projectId && taskById.has(row.cells.task_id);
    if (predecessorLocal && successorLocal) {
      const predecessor = taskById.get(row.cells.pred_task_id)!;
      const successor = taskById.get(row.cells.task_id)!;
      const predecessorCalendar = calendarEngines.get(
        predecessor.calendarId ?? projectCalendar.id,
      ) ?? calendarEngines.get(projectCalendar.id)!;
      const plannedPredecessorFinish = parseInstant(predecessor.time.scheduleFinish);
      const plannedSuccessorStart = parseInstant(successor.time.scheduleStart);
      const finishMinute = plannedPredecessorFinish.getUTCHours() * 60
        + plannedPredecessorFinish.getUTCMinutes();
      const p6StartAtPredecessorFinishBoundary = relationType.sequence === 'FINISH_START'
        && lagMinutes === 0
        && predecessorCalendar.isHourMode
        && plannedPredecessorFinish.getTime() === plannedSuccessorStart.getTime()
        && predecessorCalendar.effectiveBandsOn(plannedPredecessorFinish)
          .some(band => band.end === finishMinute);
      const sequence: Sequence = {
        id: relationId,
        predecessorId: row.cells.pred_task_id,
        successorId: row.cells.task_id,
        type: relationType.sequence,
        lagMinutes,
        lagDays: lagMinutes / (projectCalendar.hoursPerDay * 60),
        ...(p6StartAtPredecessorFinishBoundary
          ? { p6StartAtPredecessorFinishBoundary: true }
          : {}),
      };
      const lagRecord = opsFields.lagRecordsByTask.size > 0 ? lagRecordOf(row) : undefined;
      if (lagRecord && lagRecordHolds(lagRecord, lagMinutes,
        lagWorkMinutesPerDay(sequence, schedulingOptions.lagCalendar, projectCalendar, effCalByTaskId))) {
        delete sequence.lagMinutes;
        Object.assign(sequence, lagFromRecord(lagRecord));
      }
      sequences.push(sequence);
    } else if (successorLocal && predecessorProjectId !== projectId) {
      externalRelations.push({
        id: relationId,
        localProjectId: projectId,
        localTaskId: row.cells.task_id,
        externalProjectId: predecessorProjectId,
        externalTaskId: row.cells.pred_task_id,
        direction: 'predecessor',
        type: relationType.source,
        lagMinutes,
      });
    } else if (predecessorLocal && successorProjectId !== projectId) {
      externalRelations.push({
        id: relationId,
        localProjectId: projectId,
        localTaskId: row.cells.pred_task_id,
        externalProjectId: successorProjectId,
        externalTaskId: row.cells.task_id,
        direction: 'successor',
        type: relationType.source,
        lagMinutes,
      });
    }
  }

  if (inheritedRuleByTaskId.size > 0) {
    const projectRule = defaultWorkRule ?? DEFAULT_WORK_RULE;
    for (const task of mappedActivities) {
      const rule = task.p6TaskId !== undefined ? inheritedRuleByTaskId.get(task.p6TaskId) : undefined;
      if (rule && rule === projectRule && task.workRule === rule) delete task.workRule;
    }
  }

  return {
    project: {
      id: projectId,
      name: xerProjectName(projectRow, wbsRows) || projectRow.cells.proj_short_name || projectId,
      description: '',
      startDate: projectStart,
      endDate: projectEnd,
      calendarId: projectCalendar.id,
      createdAt: projectStart,
      modifiedAt: statusDate ?? projectStart,
      author: '',
      company: '',
      ...(statusDate ? { statusDate } : {}),
      progressMode,
      schedulingOptions,
      schedulingProfile: builtInProfile('p6'),
      ...(defaultWorkRule ? { defaultWorkRule } : {}),
    },
    calendar: projectCalendar,
    resourceCalendars: calendarList.filter(calendar => calendar.id !== projectCalendar.id),
    tasks: allTasks,
    sequences,
    resources: resourceResult.resources,
    assignments: resourceResult.assignments,
    activityCodeTypes: metadata.activityCodeTypes,
    customFieldDefs: metadata.customFieldDefs,
    recordedTimes,
    recordedTimesOrigin: 'xer',
    suggestedProfileId: 'p6',
    ...(missingPlannedStarts > 0 ? { xerMissingPlannedStarts: missingPlannedStarts } : {}),
    xer: {
      sourceProjectId: projectId,
      defaultCurrencyCode: tables.header.defaultCurrencyCode,
      tableReport: tables.report,
      calendarIssues: calendars.issues,
      enumFallbacks,
      scheduleOptions: scheduleOptionsMetadata,
      externalRelations,
      externalLinks: [],
      report: {
        projectsSeen: 1,
        documentsOpened: 1,
        emptyProjectsSkipped: 0,
        baselineProjectsExcluded: 0,
        baselinesMaterialized: 0,
        danglingBaselineReferences: 0,
        externalLinksPreserved: 0,
        baselineExclusionReverted: false,
        baselineFallbackReasons: [],
      },
      resources: {
        catalog: resourceCatalog,
        assignments: resourceResult.sources.assignments,
        issues: resourceResult.issues,
      },
      metadata: { catalog: metadataCatalog },
    },
  };
}

function activityWorkMinutes(task: Task, hoursPerDay: number): number {
  return activityWorkMinutesOf(task.time, hoursPerDay);
}

export function readXER(bytes: Uint8Array): XerOpenResult {
  const tables = parseXerTables(bytes);
  const scheduleOptionsIndex = indexXerScheduleOptions(tables);
  const availableCalendarIds = new Set((tables.tables.get('CALENDAR')?.rows ?? [])
    .map(row => row.cells.clndr_id?.trim()).filter((id): id is string => Boolean(id)));
  for (const row of tables.tables.get('PROJECT')?.rows ?? []) {
    const calendarId = row.cells.clndr_id?.trim();
    if (calendarId) availableCalendarIds.add(calendarId);
  }
  const opsFields = readXerOpsFields(tables);
  const resourceCatalog = buildXerResourceCatalog(tables, availableCalendarIds, opsFields);
  const metadataCatalog = buildXerMetadataCatalog(tables);
  const taskResourceRowsByProject = indexXerTaskResourceRows(tables);
  const projectRowsIndex = indexXerProjectRows(tables);
  const unresolvedRelation = projectRowsIndex.relationResolutionIssues[0];
  if (unresolvedRelation) {
    if (unresolvedRelation.reason === 'dangling') {
      throw new XerImportError(
        'XER_DANGLING_LOCAL_RELATION',
        `Ongescopeerde TASKPRED op regel ${unresolvedRelation.line} verwijst naar een ontbrekend endpoint via ${unresolvedRelation.field}.`,
        { table: 'TASKPRED', field: unresolvedRelation.field, line: unresolvedRelation.line },
      );
    }
    throw new XerImportError(
      'XER_AMBIGUOUS_LOCAL_RELATION',
      `Ongescopeerde TASKPRED op regel ${unresolvedRelation.line} is ambigu: activiteiten '${unresolvedRelation.predecessorTaskId}' en '${unresolvedRelation.taskId}' identificeren niet één uniek lokaal project.`,
      { table: 'TASKPRED', field: 'proj_id', line: unresolvedRelation.line },
    );
  }
  const projectRows = tables.tables.get('PROJECT')?.rows ?? [];
  const assembled = assembleXerMultiProjectImport(
    tables,
    projectId => readXerProject(
      tables,
      scheduleOptionsIndex,
      projectId,
      resourceCatalog,
      metadataCatalog,
      taskResourceRowsByProject,
      projectRowsIndex,
      opsFields,
    ),
  );
  const presentation = detectXerSourcePresentation(bytes);
  const documentViews = Object.fromEntries(assembled.documents.map(document => [
    document.projectId,
    archiveDocumentViewFromOwnedReaderMetadata(document.result.xer),
  ]));
  const taskSourceRowsByProject = Object.fromEntries(
    [...projectRowsIndex.tasksByProject].map(([projectId, rows]) => [projectId, rows]),
  );
  const archive = createXerSourceArchiveFromOwnedMetadata(bytes, {
    ...presentation,
    encoding: tables.report.encoding,
    diagnostics: {
      schemaVersion: 1,
      file: {
        tableReport: tables.report,
        scheduleOptions: scheduleOptionsIndex.sourceArchive.diagnostics,
        relationResolutionIssues: projectRowsIndex.relationResolutionIssues,
        resourceCatalogIssues: resourceCatalog.issues,
        metadataCatalogIssues: metadataCatalog.issues,
        importReport: assembled.report,
      },
      documentViews,
    },
    readModel: {
      schemaVersion: 1,
      numberFormat: tables.numberFormat,
      scheduleOptionsSourceArchive: scheduleOptionsIndex.sourceArchive,
      resourceCatalog,
      metadataCatalog,
      taskSourceRowsByProject,
    },
  });
  for (const document of assembled.documents) {
    document.result.xerSourceArchive = archive;
    document.result.xer = bindXerImportMetadataToArchive(archive, document.projectId);
  }
  if (assembled.results.length > 0) {
    return projectRows.length === 1 ? assembled.documents[0].result : assembled;
  }
  throw new XerImportError(
    'XER_EMPTY_PROJECT',
    'Geen enkel XER-project bevat activiteiten om te openen.',
    { table: 'TASK' },
  );
}

export function reconstructXerSourceFromBytes(bytes: Uint8Array): XerSourceReconstruction {
  const opened = readXER(bytes);
  const results = 'kind' in opened ? opened.results : [opened];
  const first = results[0];
  if (!first?.xerSourceArchive) {
    throw new Error('De XER-bron leverde geen reconstruerbaar bronarchief op.');
  }
  const recordedTimesByProject: Record<string, Record<string, RecordedTime>> = {};
  for (const result of results) {
    const projectId = result.xer?.sourceProjectId;
    if (!projectId || !result.recordedTimes) continue;
    recordedTimesByProject[projectId] = result.recordedTimes;
  }
  return { archive: first.xerSourceArchive, recordedTimesByProject };
}
