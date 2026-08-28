/**
 * Semantische XER-project-/taaklezer voor de begrensde X4a-scope.
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
import { formatInstant, parseInstant } from '@/utils/dateUtils';
import { hasValidP6SuspendResume } from '@/utils/p6SuspendResume';
import {
  archiveDocumentViewFromOwnedReaderMetadata,
  bindXerImportMetadataToArchive,
  createXerSourceArchiveFromOwnedMetadata,
  detectXerSourcePresentation,
  type XerSourceArchive,
} from '@/services/xerSourceArchive';
import { readXerCalendars } from './xerCalendarData';
import { buildXerMetadataCatalog, materializeXerMetadata, type XerMetadataCatalog } from './xerMetadata';
import { indexXerTaskResourceRows } from './xerResourceAssignments';
import {
  buildXerResourceCatalog,
  materializeXerResources,
  type XerResourceCatalog,
} from './xerResources';
import { assembleXerMultiProjectImport, type XerMultiProjectImport } from './xerMultiProject';
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
  /** Importtijd-metadata; externe relaties blijven hier brondata en sturen de solver niet. */
  xer: XerImportMetadata;
}

/** X4b: één XER kan nu één payload óf een geordende verzameling documentpayloads opleveren. */
export type XerOpenResult = XerReadResult | XerMultiProjectImport;

/** Eén bestandsbrede partitionering vóór per-projectmaterialisatie. */
export interface XerProjectRowsIndex {
  tasksByProject: ReadonlyMap<string, readonly XerRow[]>;
  wbsByProject: ReadonlyMap<string, readonly XerRow[]>;
  relationsByProject: ReadonlyMap<string, readonly XerRow[]>;
  /** Testbaar operatiebewijs: iedere relevante bronrij precies éénmaal bezocht. */
  visitCount: number;
  /** Ongescopeerde relaties die zonder gok niet aan precies één lokaal project zijn toe te wijzen. */
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
      // Eén expliciete projectscope maakt een ontbrekende andere scope lokaal; twee verschillende
      // scopes materialiseren dezelfde externe relatie aan beide documentzijden.
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
        // Doorsnede wordt per endpointpaar hoogstens éénmaal berekend. Daarmee kosten de 30
        // herhaalde A→B-relaties in de schaalfixture één resolutie en 29 O(1)-cachehits, nooit
        // 30×12 projectscans of 360 materialisaties.
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

function sourceInstant(raw: string, hourMode: boolean): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  const normalized = value.replace(' ', 'T');
  const parsed = parseInstant(normalized);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return formatInstant(parsed, hourMode ? 'hour' : 'day');
}

function clockMinute(raw: string): number | undefined {
  const match = raw.trim().match(/^\d{4}-\d{2}-\d{2}[ T](\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return hour * 60 + minute;
}

/**
 * Een lege `CALENDAR.clndr_data` verliest de bandvorm, terwijl P6 de toegestane geplande
 * `target_start_date`/`target_end_date` en `target_drtn_hr_cnt` wel bewaart. Voor activiteiten
 * met een geheel aantal kalenderdagen is het modale start/eind-klokpaar daardoor bronbewijs voor
 * de standaardwerkdag van die effectieve kalender. Alleen twee beslisbare vormen worden hersteld:
 * een aaneengesloten band (klokspan === netto daguren) en P6's standaard lunchpauze 12:00-13:00.
 * Geen early/late/float-output komt in deze afleiding voor.
 */
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

/** X7-broninstant: de vorm hoort bij dit ene veld, niet bij de kalender die een buurveld promoveert. */
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
  if (!token || token === 'tk_notstart') return 'NOT_STARTED';
  if (token === 'tk_active') return 'STARTED';
  if (token === 'tk_complete') return 'COMPLETED';
  fallback(issues, 'status', raw, 'NOT_STARTED', 'TASK', 'status_code', row.line);
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
  };
  const known = mapping[token];
  if (known) return known;
  fallback(issues, 'relation', raw, 'FS', 'TASKPRED', 'pred_type', row.line);
  return mapping.PR_FS;
}

function wbsTaskId(projectId: string, wbsId: string): string {
  return `xer-wbs:${projectId}:${wbsId}`;
}

/** Unicode-codepointvolgorde, onafhankelijk van hostlocale en ICU-versie. */
function compareCodePoints(left: string, right: string): number {
  const a = Array.from(left, char => char.codePointAt(0) ?? 0);
  const b = Array.from(right, char => char.codePointAt(0) ?? 0);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

function stableWbsRows(rows: readonly XerRow[], projectId: string): XerRow[] {
  return rows
    .filter(row => row.cells.proj_id === projectId)
    .sort((left, right) => {
      const parentOrder = compareCodePoints(
        left.cells.parent_wbs_id ?? '', right.cells.parent_wbs_id ?? '',
      );
      const leftSeq = Number(left.cells.seq_num) || 0;
      const rightSeq = Number(right.cells.seq_num) || 0;
      return parentOrder
        || leftSeq - rightSeq
        || compareCodePoints(left.cells.wbs_id ?? '', right.cells.wbs_id ?? '')
        || left.line - right.line;
    });
}

function assertUniqueId(
  rows: readonly XerRow[], table: 'PROJWBS' | 'TASK' | 'TASKPRED', field: string,
): void {
  const firstLineById = new Map<string, number>();
  for (const row of rows) {
    const id = row.cells[field]?.trim() ?? '';
    // TASKPRED-id is in sommige exports leeg; de regelgebonden fallback blijft intrinsiek uniek.
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

/** Map precies één reeds getokenized, niet-leeg P6-project. X4b roept deze kern één keer per
 * PROJECT-rij aan; zo blijft de X4a-mapping zelf één implementatie. */
function readXerProject(
  tables: XerTables,
  scheduleOptionsIndex: XerScheduleOptionsIndex,
  projectId: string,
  resourceCatalog: XerResourceCatalog,
  metadataCatalog: XerMetadataCatalog,
  taskResourceRowsByProject: ReadonlyMap<string, readonly XerRow[]>,
  projectRowsIndex: XerProjectRowsIndex,
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

  // Identiteit en lokale eindpunten moeten vaststaan vóór maps, WBS-boom of relaties ontstaan.
  assertUniqueId(rawWbsRows, 'PROJWBS', 'wbs_id');
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
  // P6 kan een geldige project-/taakexport zonder CALENDAR-tabel leveren. De projectverwijzing
  // blijft dan bruikbaar als id en krijgt de smalle X3-default ma-vr 08:00-16:00; geen lokale
  // appinstelling of feestdagenbron mag zo'n import machine-afhankelijk maken.
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

  // Een expliciet TASK-tijdstip is bronbewijs voor uurmodus. Dit gebeurt vóór datum-/duurmapping,
  // zodat geen minuut wordt afgerond en lege clndr_data via de bestaande kalenderbanden promoveert.
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
    promoteHourCalendar(
      calendar,
      getCalendarBands(calendar),
      hourSignalCalendarIds.has(calendar.id),
      false,
    );
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
  for (const row of activityRows) {
    const effectiveCalendar = calendarById.get(row.cells.clndr_id) ?? projectCalendar;
    const hourMode = effectiveCalendar.workTime !== undefined;
    const explicitTargetStart = sourceInstant(row.cells.target_start_date ?? '', hourMode);
    const explicitTargetFinish = sourceInstant(row.cells.target_end_date ?? '', hourMode);
    const hasExplicitTargetWindow = explicitTargetStart !== undefined && explicitTargetFinish !== undefined;
    let start = explicitTargetStart
      ?? sourceInstant(projectRow.cells.last_recalc_date ?? '', hourMode)
      ?? '1970-01-01';
    let finish = explicitTargetFinish ?? start;
    // P6 XER kan een TT_FinMile op de eerste minuut ná een werkbandgrens serialiseren met gelijke
    // target start/finish. Voor deze nulduur-activiteit is die minuut een grenscodering, geen werk:
    // de mijlpaal hoort bij de bandstart en de finishzijde bij het vorige werkbandeinde. De regel is
    // bewust gesloten op TT_FinMile + start===finish + exact bandstart+1; een gewone activiteit,
    // een andere minuut of een reeds exacte bandgrens blijft letterlijk zoals aangeleverd.
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
    const sourceDurationMinutes = Math.round(durationHours * 60);
    const hoursPerDay = effectiveCalendar.hoursPerDay > 0 ? effectiveCalendar.hoursPerDay : 8;
    const activityType = activityTypeOf(row.cells.task_type ?? '', row, enumFallbacks);
    const durationType = durationTypeOf(
      row.cells.duration_type ?? '', projectDefaultDuration, row, enumFallbacks,
    );
    const rawStatus = row.cells.status_code ?? '';
    const status = statusOf(rawStatus, row, enumFallbacks);
    const rawCompletePctType = row.cells.complete_pct_type ?? '';
    const completePctType = rawCompletePctType.trim() === ''
      ? undefined
      : completePctTypeOf(rawCompletePctType, row, enumFallbacks);
    const statusToken = rawStatus.trim().toLowerCase();
    const statusForcesCompletion = statusToken === 'tk_notstart' || statusToken === 'tk_complete';
    // Status is de leidende P6-toestand. Percentagekolommen verklaren uitsluitend de voortgang
    // van een actieve taak; ze mogen een expliciete TK_NotStart nooit de solver-in-progressroute
    // in trekken. CP_Drtn en CP_Units lezen complete_pct, CP_Phys leest uitsluitend
    // phys_complete_pct — geen familie valt terug op de percentagekolom van een andere familie.
    // Lees uitsluitend de percentagefamilie die de expliciete P6-status en -methode werkelijk
    // gebruiken. Anders kan bijvoorbeeld een corrupte `complete_pct` een CP_Phys-taak (waar
    // uitsluitend `phys_complete_pct` betekenis heeft) ten onrechte onopenbaar maken.
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
    const completion = statusToken === 'tk_complete'
      ? 1
      : statusToken === 'tk_notstart'
        ? 0
        : Math.max(0, Math.min(1, completionPercent / 100));
    const parentId = row.cells.wbs_id ? wbsTaskId(projectId, row.cells.wbs_id) : null;
    const plannedWindowMinutes = hourMode && plannedWindowCalendarIds.has(effectiveCalendar.id)
      ? calendarEngines.get(effectiveCalendar.id)?.workMinutesBetween(
        parseInstant(start), parseInstant(finish),
      )
      : undefined;
    // Alleen bij een lege bronkalender mag het target-venster de door ontbrekende banddata verloren
    // fractionele slotdag herstellen. De expliciete targetduur blijft autoritair zodra vensterwerk
    // en bronduur meer dan één effectieve dag verschillen: target_start/target_end mogen immers
    // planningsruimte omvatten en zijn dan geen alternatieve duurkolom. Zo is de positieve vorm
    // kalender-afleidbaar en de negatieve vorm gesloten zonder stored P6-rekenuitvoer te lezen.
    const plannedWindowRepairsFractionalDay = plannedWindowMinutes !== undefined
      && plannedWindowMinutes > 0
      && Math.abs(plannedWindowMinutes - sourceDurationMinutes) <= hoursPerDay * 60;
    const durationMinutes = plannedWindowRepairsFractionalDay
      ? plannedWindowMinutes
      : sourceDurationMinutes;
    const time = createDefaultTaskTime(start, durationMinutes / (hoursPerDay * 60));
    time.scheduleFinish = finish;
    time.earlyStart = start;
    time.earlyFinish = finish;
    time.lateStart = start;
    time.lateFinish = finish;
    time.completion = completion;
    const p6RemainingHours = status === 'STARTED' && completePctType === 'CP_Drtn'
      && durationCompletionPercent !== null
      ? durationHours * (1 - completion)
      : remainingHours;
    if (hourMode) {
      time.durationMinutes = durationMinutes;
      if (p6RemainingHours !== null) {
        time.remainingMinutes = Math.round(p6RemainingHours * 60);
      }
    } else if (p6RemainingHours !== null) {
      time.remainingTime = p6RemainingHours / hoursPerDay;
    }
    const actualStart = sourceInstant(row.cells.act_start_date ?? '', hourMode);
    const actualFinish = sourceInstant(row.cells.act_end_date ?? '', hourMode);
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
  }

  const projectHourMode = projectCalendar.workTime !== undefined;
  const derivedSchedule = deriveXerScheduleOptions(scheduleOptionsIndex, projectId, {
    hoursPerDay: projectCalendar.hoursPerDay,
    taskCount: mappedActivities.length,
  });
  const {
    progressMode,
    schedulingOptions,
    ...scheduleOptionsMetadata
  } = derivedSchedule;
  const starts = mappedActivities.map(task => task.time.scheduleStart).filter(Boolean).sort();
  const finishes = mappedActivities.map(task => task.time.scheduleFinish).filter(Boolean).sort();
  const projectStart = starts[0];
  const taskDerivedProjectEnd = finishes[finishes.length - 1] ?? projectStart;
  const sourceProjectEnd = sourceInstant(projectRow.cells.plan_end_date ?? '', projectHourMode);
  // PROJECT.plan_end_date is allowed project input, but changes the late pass only when P6's
  // corresponding SCHEDOPTIONS switch is explicitly Y. Without that switch, the historical
  // task-derived project range remains byte-identical for XER and every other format.
  const projectEnd = schedulingOptions.useProjectEndDateForFloat && sourceProjectEnd
    ? sourceProjectEnd
    : taskDerivedProjectEnd;
  const statusDate = sourceInstant(projectRow.cells.last_recalc_date ?? '', projectHourMode);

  const wbsRows = stableWbsRows(rawWbsRows, projectId);
  const wbsTasks: Task[] = wbsRows.map(row => {
    const id = wbsTaskId(projectId, row.cells.wbs_id);
    const parentId = row.cells.parent_wbs_id
      ? wbsTaskId(projectId, row.cells.parent_wbs_id)
      : null;
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
  const allTasks = [...wbsTasks, ...mappedActivities];
  const taskById = new Map(allTasks.map(task => [task.id, task]));
  for (const task of allTasks) {
    if (!task.parentId) continue;
    const parent = taskById.get(task.parentId);
    if (parent && !parent.childIds.includes(task.id)) parent.childIds.push(task.id);
  }

  // X8 projecteert uitsluitend na de bestandsbrede mapping. Daardoor kunnen identieke task_id's
  // uit verschillende PROJECT-rijen nooit metadata naar elkaar lekken; de catalogus zelf blijft
  // als readonly bronreferentie voor X9 gedeeld.
  const metadata = materializeXerMetadata(metadataCatalog, projectId);
  for (const [taskId, taskMetadata] of metadata.taskMetadata) {
    const task = taskById.get(taskId);
    if (!task) continue;
    if (taskMetadata.activityCodes) task.activityCodes = taskMetadata.activityCodes;
    if (taskMetadata.customFields) task.customFields = taskMetadata.customFields;
    if (taskMetadata.notes) task.notes = taskMetadata.notes;
  }

  // X6: projectresources zijn bewust mutable kopieën; de raw catalogus en TASKRSRC-cellen blijven
  // één maal geparseerde, bevroren bestandsdata. Dit voorkomt P×52.640 structuredClone-kopieën.
  const resourceResult = materializeXerResources(resourceCatalog, tables, {
    projectId,
    projectCalendarId: projectCalendar.id,
    projectHoursPerDay: projectCalendar.hoursPerDay,
    availableCalendarIds: new Set(calendarList.map(calendar => calendar.id)),
    calendarHoursPerDay: new Map(calendarList.map(calendar => [calendar.id, calendar.hoursPerDay])),
    taskIds: new Set(mappedActivities.map(task => task.id)),
  }, taskResourceRowsByProject.get(projectId) ?? []);
  for (const assignment of resourceResult.assignments) {
    const task = taskById.get(assignment.taskId);
    if (task && !task.resourceIds.includes(assignment.resourceId)) task.resourceIds.push(assignment.resourceId);
  }

  const sequences: Sequence[] = [];
  const externalRelations: XerExternalRelation[] = [];
  for (const row of relationRows) {
    const successorProjectId = row.cells.proj_id || projectId;
    const predecessorProjectId = row.cells.pred_proj_id || successorProjectId;
    const relationType = relationTypeOf(row.cells.pred_type, row, enumFallbacks);
    const lagMinutes = Math.round((numberOf(tables, row, 'lag_hr_cnt', 'TASKPRED') ?? 0) * 60);
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
      sequences.push({
        id: relationId,
        predecessorId: row.cells.pred_task_id,
        successorId: row.cells.task_id,
        type: relationType.sequence,
        lagMinutes,
        lagDays: lagMinutes / (projectCalendar.hoursPerDay * 60),
        ...(p6StartAtPredecessorFinishBoundary
          ? { p6StartAtPredecessorFinishBoundary: true }
          : {}),
      });
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

  return {
    project: {
      id: projectId,
      name: projectRow.cells.proj_short_name || projectId,
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
    },
    calendar: projectCalendar,
    resourceCalendars: calendarList.filter(calendar => calendar.id !== projectCalendar.id),
    tasks: allTasks,
    sequences,
    resources: resourceResult.resources,
    assignments: resourceResult.assignments,
    activityCodeTypes: metadata.activityCodeTypes,
    customFieldDefs: metadata.customFieldDefs,
    xer: {
      sourceProjectId: projectId,
      defaultCurrencyCode: tables.header.defaultCurrencyCode,
      tableReport: tables.report,
      calendarIssues: calendars.issues,
      enumFallbacks,
      scheduleOptions: scheduleOptionsMetadata,
      externalRelations,
      externalLinks: [],
      // `assembleXerMultiProjectImport` vervangt dit vóór de reader retourneert door het echte,
      // bestandsbrede verslag. De verplichte vorm voorkomt dat een XER-document zonder X10-data
      // door een nieuwe codeweg kan ontsnappen.
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

/**
 * Lees de oorspronkelijke XER-bytes. Eén PROJECT behoudt de enkelvoudige X4a-returnvorm, maar
 * krijgt hetzelfde X4b-rapportcontract; meerdere PROJECT-rijen waaieren uit naar losse payloads.
 * De baselinebeslissing zit vóór de openroute: die krijgt dus uitsluitend documenten die echt als
 * tab geopend mogen worden.
 */
export function readXER(bytes: Uint8Array): XerOpenResult {
  const tables = parseXerTables(bytes);
  const scheduleOptionsIndex = indexXerScheduleOptions(tables);
  const availableCalendarIds = new Set((tables.tables.get('CALENDAR')?.rows ?? [])
    .map(row => row.cells.clndr_id?.trim()).filter((id): id is string => Boolean(id)));
  for (const row of tables.tables.get('PROJECT')?.rows ?? []) {
    const calendarId = row.cells.clndr_id?.trim();
    if (calendarId) availableCalendarIds.add(calendarId);
  }
  const resourceCatalog = buildXerResourceCatalog(tables, availableCalendarIds);
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
    ),
  );
  // Precies één frozen bytearchief per ingelezen bestand. De projectmappers leveren alleen views;
  // hier, ná alle projectdiagnostics, delen alle werkelijk geopende documenten dezelfde referentie.
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
    // De openvorm blijft compatibel: één PROJECT levert nog altijd één ImportResult. Alleen de
    // rapportberekening loopt uniform door dezelfde X4b-kern als een meervoudig bestand.
    return projectRows.length === 1 ? assembled.documents[0].result : assembled;
  }
  throw new XerImportError(
    'XER_EMPTY_PROJECT',
    'Geen enkel XER-project bevat activiteiten om te openen.',
    { table: 'TASK' },
  );
}

/** Herbouw de volledige X9-runtimegrafiek uit uitsluitend de canonieke XER-bronbytes. */
export function reconstructXerSourceArchiveFromBytes(bytes: Uint8Array): XerSourceArchive {
  const opened = readXER(bytes);
  const first = 'kind' in opened ? opened.results[0] : opened;
  if (!first?.xerSourceArchive) {
    throw new Error('De XER-bron leverde geen reconstruerbaar bronarchief op.');
  }
  return first.xerSourceArchive;
}
