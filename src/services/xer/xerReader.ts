/**
 * Semantische XER-project-/taaklezer voor de begrensde X4a-scope.
 *
 * Voor begrip van P6's tokenvocabulaire en de betekenis van PROJECT/PROJWBS/TASK/TASKPRED is
 * MPXJ geraadpleegd: https://github.com/joniles/mpxj (Primavera-reader, LGPL-2.1, Jon Iles e.a.).
 * Er is geen MPXJ-code overgenomen. De mapping, fout-/rapportvorm, WBS-opbouw en kalenderkeuzes
 * hieronder zijn zelfstandig voor Open Planner Studio geïmplementeerd en door eigen fixtures
 * vastgelegd.
 */

import type { ImportResult } from '@/services/importTypes';
import { getCalendarBands, promoteHourCalendar } from '@/services/subdayIo';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence, SequenceType } from '@/types/sequence';
import type {
  P6ActivityType,
  P6DurationType,
  Task,
  TaskConstraint,
  TaskStatus,
} from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { formatInstant, parseInstant } from '@/utils/dateUtils';
import { readXerCalendars, type XerCalendarIssue } from './xerCalendarData';
import {
  parseXerNumber,
  parseXerTables,
  XerImportError,
  type XerImportReport,
  type XerRow,
  type XerTables,
} from './xerTables';

export interface XerEnumFallback {
  family: 'activityType' | 'durationType' | 'status' | 'priority' | 'constraint' | 'relation';
  token: string;
  fallback: string;
  table: 'PROJECT' | 'TASK' | 'TASKPRED';
  field: string;
  line: number;
}

export interface XerExternalRelation {
  id: string;
  localProjectId: string;
  localTaskId: string;
  externalProjectId: string;
  externalTaskId: string;
  direction: 'predecessor' | 'successor';
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lagMinutes: number;
}

export interface XerReaderMetadata {
  defaultCurrencyCode: string;
  tableReport: XerImportReport;
  calendarIssues: XerCalendarIssue[];
  enumFallbacks: XerEnumFallback[];
  externalRelations: XerExternalRelation[];
}

export interface XerReadResult extends ImportResult {
  /** Importtijd-metadata; externe relaties blijven hier brondata en sturen de solver niet. */
  xer: XerReaderMetadata;
}

const ACTIVITY_TYPES: readonly P6ActivityType[] = [
  'TT_Task', 'TT_Rsrc', 'TT_LOE', 'TT_Mile', 'TT_FinMile', 'TT_WBS',
];
const DURATION_TYPES: readonly P6DurationType[] = [
  'DT_FixedDrtn', 'DT_FixedDUR2', 'DT_FixedRate', 'DT_FixedQty',
];

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

function stableWbsRows(rows: readonly XerRow[], projectId: string): XerRow[] {
  return rows
    .filter(row => row.cells.proj_id === projectId)
    .sort((left, right) => {
      const parentOrder = (left.cells.parent_wbs_id ?? '').localeCompare(right.cells.parent_wbs_id ?? '');
      const leftSeq = Number(left.cells.seq_num) || 0;
      const rightSeq = Number(right.cells.seq_num) || 0;
      return parentOrder || leftSeq - rightSeq || left.line - right.line;
    });
}

/** Lees precies één niet-leeg P6-project uit de oorspronkelijke XER-bestandsbytes. */
export function readXER(bytes: Uint8Array): XerReadResult {
  const tables = parseXerTables(bytes);
  const projectRows = tables.tables.get('PROJECT')?.rows ?? [];
  if (projectRows.length !== 1) {
    throw new XerImportError(
      'XER_SINGLE_PROJECT_REQUIRED',
      `Deze importstap verwacht precies één PROJECT-rij; gevonden: ${projectRows.length}.`,
      { table: 'PROJECT', lines: projectRows.map(row => row.line) },
    );
  }
  const projectRow = projectRows[0];
  const projectId = projectRow.cells.proj_id;
  const activityRows = (tables.tables.get('TASK')?.rows ?? [])
    .filter(row => row.cells.proj_id === projectId);
  if (activityRows.length === 0) {
    throw new XerImportError(
      'XER_EMPTY_PROJECT',
      `XER-project ${projectId} bevat geen activiteiten.`,
      { table: 'TASK' },
    );
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
    ].some(value => hasClock(value ?? ''))) {
      hourSignalCalendarIds.add(calendarId);
    }
  }
  for (const calendar of calendarList) {
    promoteHourCalendar(
      calendar,
      getCalendarBands(calendar),
      hourSignalCalendarIds.has(calendar.id),
      false,
    );
  }

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
    const start = sourceInstant(row.cells.target_start_date ?? '', hourMode)
      ?? sourceInstant(projectRow.cells.last_recalc_date ?? '', hourMode)
      ?? '1970-01-01';
    const finish = sourceInstant(row.cells.target_end_date ?? '', hourMode) ?? start;
    const durationHours = numberOf(tables, row, 'target_drtn_hr_cnt') ?? 0;
    const remainingHours = numberOf(tables, row, 'remain_drtn_hr_cnt');
    const durationMinutes = Math.round(durationHours * 60);
    const hoursPerDay = effectiveCalendar.hoursPerDay > 0 ? effectiveCalendar.hoursPerDay : 8;
    const activityType = activityTypeOf(row.cells.task_type ?? '', row, enumFallbacks);
    const durationType = durationTypeOf(
      row.cells.duration_type ?? '', projectDefaultDuration, row, enumFallbacks,
    );
    const status = statusOf(row.cells.status_code ?? '', row, enumFallbacks);
    const physicalPercent = numberOf(tables, row, 'phys_complete_pct') ?? 0;
    const completion = status === 'COMPLETED' ? 1 : Math.max(0, Math.min(1, physicalPercent / 100));
    const parentId = row.cells.wbs_id ? wbsTaskId(projectId, row.cells.wbs_id) : null;
    const time = createDefaultTaskTime(start, durationMinutes / (hoursPerDay * 60));
    time.scheduleFinish = finish;
    time.earlyStart = start;
    time.earlyFinish = finish;
    time.lateStart = start;
    time.lateFinish = finish;
    time.completion = completion;
    if (hourMode) {
      time.durationMinutes = durationMinutes;
      if (remainingHours !== null) time.remainingMinutes = Math.round(remainingHours * 60);
    } else if (remainingHours !== null) {
      time.remainingTime = remainingHours / hoursPerDay;
    }
    const actualStart = sourceInstant(row.cells.act_start_date ?? '', hourMode);
    const actualFinish = sourceInstant(row.cells.act_end_date ?? '', hourMode);
    if (actualStart) time.actualStart = actualStart;
    if (actualFinish) time.actualFinish = actualFinish;

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

  const starts = mappedActivities.map(task => task.time.scheduleStart).filter(Boolean).sort();
  const finishes = mappedActivities.map(task => task.time.scheduleFinish).filter(Boolean).sort();
  const projectStart = starts[0];
  const projectEnd = finishes[finishes.length - 1] ?? projectStart;
  const projectHourMode = projectCalendar.workTime !== undefined;
  const statusDate = sourceInstant(projectRow.cells.last_recalc_date ?? '', projectHourMode);

  const wbsRows = stableWbsRows(tables.tables.get('PROJWBS')?.rows ?? [], projectId);
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

  const sequences: Sequence[] = [];
  const externalRelations: XerExternalRelation[] = [];
  for (const row of tables.tables.get('TASKPRED')?.rows ?? []) {
    const successorProjectId = row.cells.proj_id || projectId;
    const predecessorProjectId = row.cells.pred_proj_id || successorProjectId;
    const relationType = relationTypeOf(row.cells.pred_type, row, enumFallbacks);
    const lagMinutes = Math.round((numberOf(tables, row, 'lag_hr_cnt', 'TASKPRED') ?? 0) * 60);
    const relationId = row.cells.task_pred_id || `xer-rel:${row.line}`;
    const predecessorLocal = predecessorProjectId === projectId && taskById.has(row.cells.pred_task_id);
    const successorLocal = successorProjectId === projectId && taskById.has(row.cells.task_id);
    if (predecessorLocal && successorLocal) {
      sequences.push({
        id: relationId,
        predecessorId: row.cells.pred_task_id,
        successorId: row.cells.task_id,
        type: relationType.sequence,
        lagMinutes,
        lagDays: lagMinutes / (projectCalendar.hoursPerDay * 60),
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
    },
    calendar: projectCalendar,
    resourceCalendars: calendarList.filter(calendar => calendar.id !== projectCalendar.id),
    tasks: allTasks,
    sequences,
    resources: [],
    assignments: [],
    xer: {
      defaultCurrencyCode: tables.header.defaultCurrencyCode,
      tableReport: tables.report,
      calendarIssues: calendars.issues,
      enumFallbacks,
      externalRelations,
    },
  };
}
