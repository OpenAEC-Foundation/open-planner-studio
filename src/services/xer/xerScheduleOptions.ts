// Bron: MPXJ als referentie voor de P6-enumtokens, geen code overgenomen (LGPL-2.1, github.com/joniles/mpxj).
import type {
  LevelingPriorityKey, LevelingResourceSetting, LevelingSettings, ProgressMode, ProjectSchedulingOptions,
} from '@/types/project';
import type {
  XerScheduleOptionFallback,
  XerScheduleOptionsDiagnostic,
  XerScheduleOptionsMetadata,
  XerScheduleOptionsSourceArchive,
  XerScheduleOptionsSourceRow,
} from '../importTypes';
import { parseXerNumber, type XerRow, type XerTables } from './xerTables';
import { resourceInternalId } from './xerResources';
import { p6OptionDefaults } from '@/engine/scheduler/conventions/registry';

export type {
  XerScheduleOptionFallback,
  XerScheduleOptionsDiagnostic,
  XerScheduleOptionsMetadata,
  XerScheduleOptionsSourceArchive,
  XerScheduleOptionsSourceRow,
} from '../importTypes';

export interface XerScheduleOptionsResult extends XerScheduleOptionsMetadata {
  progressMode: ProgressMode;
  schedulingOptions: ProjectSchedulingOptions;
}

interface IndexedSourceRow {
  row: XerRow;
  sourceRowIndex: number;
}

export interface XerScheduleOptionsIndex {
  numberFormat: XerTables['numberFormat'];
  projectRowsById: ReadonlyMap<string, IndexedSourceRow>;
  scheduleRowsById: ReadonlyMap<string, IndexedSourceRow>;
  sourceRowIndexesByProject: ReadonlyMap<string, readonly number[]>;
  diagnosticsByProject: ReadonlyMap<string, readonly XerScheduleOptionsDiagnostic[]>;
  sourceArchive: XerScheduleOptionsSourceArchive;
  levelResourceRowsByScheduleOptionsId: ReadonlyMap<string, readonly XerRow[]>;
  orphanLevelResourceRows: readonly XerRow[];
  resourceSourceIds: ReadonlySet<string>;
  maxUnitsPerHourByResource: ReadonlyMap<string, number>;
}

export type XerScheduleOptionColumnDisposition =
  | { field: string; status: 'mapped'; target: string }
  | { field: string; status: 'ignored' | 'todo'; reason: string };

const resourceLevelingReason = 'De CPM-solver voert geen resource-nivellering uit; het nivelleerfundament '
  + '(`schedulingOptions.leveling`) leest deze instelling (nog) niet — alleen keep/all/prioriteit/resourcelijst.';

export const XER_SCHEDOPTIONS_COLUMN_DISPOSITIONS: readonly XerScheduleOptionColumnDisposition[] = [
  { field: 'enable_multiple_longest_path_calc', status: 'mapped', target: 'schedulingOptions.floatPaths.enabled' },
  {
    field: 'key_activity_for_multiple_longest_paths',
    status: 'todo',
    reason: 'OPS kan meerdere floatpaden berekenen maar heeft nog geen eindactiviteit-anker in het model.',
  },
  { field: 'level_all_rsrc_flag', status: 'mapped', target: 'schedulingOptions.leveling.levelAllResources' },
  { field: 'level_float_thrs_cnt', status: 'ignored', reason: resourceLevelingReason },
  { field: 'level_keep_sched_date_flag', status: 'mapped', target: 'schedulingOptions.leveling.preserveScheduledDates' },
  { field: 'level_outer_assign_flag', status: 'ignored', reason: resourceLevelingReason },
  { field: 'level_outer_assign_priority', status: 'ignored', reason: resourceLevelingReason },
  { field: 'level_over_alloc_pct', status: 'ignored', reason: resourceLevelingReason },
  { field: 'level_within_float_flag', status: 'ignored', reason: resourceLevelingReason },
  { field: 'levelprioritylist', status: 'mapped', target: 'schedulingOptions.leveling.priority' },
  { field: 'limit_multiple_longest_path_calc', status: 'mapped', target: 'schedulingOptions.floatPaths.maxPaths' },
  { field: 'max_multiple_longest_path', status: 'mapped', target: 'schedulingOptions.floatPaths.maxPaths' },
  { field: 'proj_id', status: 'mapped', target: 'SCHEDOPTIONS-rijselectie per project' },
  { field: 'sched_calendar_on_relationship_lag', status: 'mapped', target: 'schedulingOptions.lagCalendar' },
  { field: 'sched_float_type', status: 'mapped', target: 'schedulingOptions.totalFloatMode' },
  { field: 'sched_lag_early_start_flag', status: 'mapped', target: 'schedulingOptions.startToStartLagFrom' },
  { field: 'sched_open_critical_flag', status: 'mapped', target: 'schedulingOptions.makeOpenEndedCritical' },
  {
    field: 'sched_outer_depend_type',
    status: 'todo',
    reason: 'Externe-relatieplanning vereist het X4b-multi-projectpad en valt buiten de X5-schrijfgrens.',
  },
  { field: 'sched_progress_override', status: 'mapped', target: 'project.progressMode' },
  { field: 'sched_retained_logic', status: 'mapped', target: 'project.progressMode' },
  {
    field: 'sched_setplantoforecast',
    status: 'todo',
    reason: 'OPS heeft nog geen afzonderlijke planned-versus-forecast-taakdatums die dit veilig kunnen consumeren.',
  },
  { field: 'sched_use_expect_end_flag', status: 'mapped', target: 'schedulingOptions.useExpectedFinishDates' },
  {
    field: 'sched_use_project_end_date_for_float',
    status: 'mapped',
    target: 'schedulingOptions.useProjectEndDateForFloat',
  },
  { field: 'schedhash', status: 'ignored', reason: 'Technische bronhash; geen planningssemantiek of stabiele OPS-identiteit.' },
  {
    field: 'schedoptions_id',
    status: 'mapped',
    target: 'RSRCLEVELLIST-koppeling (schedulingOptions.leveling.resources); proj_id is de projectbinding',
  },
  { field: 'use_total_float', status: 'mapped', target: 'schedulingOptions.floatPaths.method (dialectalias)' },
  {
    field: 'use_total_float_multiple_longest_paths',
    status: 'mapped',
    target: 'schedulingOptions.floatPaths.method',
  },
] as const;

const P6_OPTIONS = p6OptionDefaults();

export const XER_SCHEDULING_DEFAULTS = {
  progressMode: 'RETAINED_LOGIC',
  schedulingOptions: {
    lagCalendar: P6_OPTIONS.lagCalendar,
    criticalDefinition: P6_OPTIONS.criticalDefinition,
    totalFloatMode: P6_OPTIONS.totalFloatMode,
    makeOpenEndedCritical: P6_OPTIONS.makeOpenEndedCritical,
    useExpectedFinishDates: P6_OPTIONS.useExpectedFinishDates,
    p6CompletedLateFromRemainingWindow: P6_OPTIONS.p6CompletedLateFromRemainingWindow,
    startToStartLagFrom: P6_OPTIONS.startToStartLagFrom,
  },
} as const satisfies { progressMode: ProgressMode; schedulingOptions: ProjectSchedulingOptions };

function freshDefaults(): { progressMode: ProgressMode; schedulingOptions: ProjectSchedulingOptions } {
  return {
    progressMode: XER_SCHEDULING_DEFAULTS.progressMode,
    schedulingOptions: {
      ...XER_SCHEDULING_DEFAULTS.schedulingOptions,
      criticalDefinition: { ...XER_SCHEDULING_DEFAULTS.schedulingOptions.criticalDefinition },
    },
  };
}

function reportFallback(
  fallbacks: XerScheduleOptionFallback[],
  row: XerRow,
  field: string,
  token: string,
  fallback: string,
): void {
  fallbacks.push({ field, token, fallback, line: row.line });
}

function enumValue<T extends string>(
  row: XerRow,
  field: string,
  mapping: Readonly<Record<string, T>>,
  fallback: T,
  fallbacks: XerScheduleOptionFallback[],
): T {
  const token = row.cells[field]?.trim() ?? '';
  if (!token) return fallback;
  const value = mapping[token.toUpperCase()];
  if (value !== undefined) return value;
  reportFallback(fallbacks, row, field, token, fallback);
  return fallback;
}

function booleanValue(
  row: XerRow,
  field: string,
  fallback: boolean,
  fallbacks: XerScheduleOptionFallback[],
): boolean {
  const token = row.cells[field]?.trim() ?? '';
  if (!token) return fallback;
  if (token.toUpperCase() === 'Y') return true;
  if (token.toUpperCase() === 'N') return false;
  reportFallback(fallbacks, row, field, token, fallback ? 'true' : 'false');
  return fallback;
}

function retainedBooleanValue(
  row: XerRow,
  field: string,
  fallbacks: XerScheduleOptionFallback[],
): boolean | undefined {
  const token = row.cells[field]?.trim() ?? '';
  if (!token) return undefined;
  if (token.toUpperCase() === 'Y') return true;
  if (token.toUpperCase() === 'N') return false;
  reportFallback(fallbacks, row, field, token, 'niet bewaard');
  return undefined;
}

function reportRemainingTargetLinkFlag(
  row: XerRow | undefined,
  fallbacks: XerScheduleOptionFallback[],
): void {
  const token = row?.cells.rem_target_link_flag?.trim() ?? '';
  if (!token || token.toUpperCase() === 'Y' || token.toUpperCase() === 'N') return;
  reportFallback(fallbacks, row!, 'rem_target_link_flag', token, 'niet gebruikt');
}

function declaresRetainedLogic(row: XerRow): boolean {
  const retained = row.cells.sched_retained_logic?.trim().toUpperCase() ?? '';
  const override = row.cells.sched_progress_override?.trim().toUpperCase() ?? '';
  return (retained === '' || retained === 'Y') && (override === '' || override === 'N');
}

function progressModeValue(
  row: XerRow,
  fallbacks: XerScheduleOptionFallback[],
): ProgressMode {
  const retainedToken = row.cells.sched_retained_logic?.trim() ?? '';
  const overrideToken = row.cells.sched_progress_override?.trim() ?? '';
  if (!retainedToken && !overrideToken) return 'RETAINED_LOGIC';

  const retained = booleanValue(row, 'sched_retained_logic', true, fallbacks);
  const override = booleanValue(row, 'sched_progress_override', false, fallbacks);
  if (retained && !override) return 'RETAINED_LOGIC';
  if (!retained && override) return 'PROGRESS_OVERRIDE';

  reportFallback(
    fallbacks,
    row,
    'sched_retained_logic/sched_progress_override',
    `${retainedToken || '(leeg)'}/${overrideToken || '(leeg)'}`,
    'RETAINED_LOGIC',
  );
  return 'RETAINED_LOGIC';
}

function projectCriticalDefinition(
  index: XerScheduleOptionsIndex,
  projectId: string,
  fallbacks: XerScheduleOptionFallback[],
): ProjectSchedulingOptions['criticalDefinition'] {
  const row = index.projectRowsById.get(projectId)?.row;
  if (!row) return { ...XER_SCHEDULING_DEFAULTS.schedulingOptions.criticalDefinition };
  const token = row.cells.critical_path_type?.trim() ?? '';
  if (token && token.toUpperCase() === 'CT_DRIVPATH') return { mode: 'longestPath' };
  if (token && token.toUpperCase() !== 'CT_TOTFLOAT') {
    reportFallback(fallbacks, row, 'critical_path_type', token, 'totalFloat');
  }
  const thresholdHours = parseXerNumber(row.cells.critical_drtn_hr_cnt ?? '', index.numberFormat) ?? 0;
  return { mode: 'totalFloat', thresholdHours };
}

function appendSourceRows(
  rows: readonly XerRow[],
  table: XerScheduleOptionsSourceRow['table'],
  sourceRows: XerScheduleOptionsSourceRow[],
  indexesByProject: Map<string, number[]>,
  indexedRowsByProject: Map<string, IndexedSourceRow[]>,
): void {
  for (const row of rows) {
    const sourceRowIndex = sourceRows.length;
    const sourceRow: XerScheduleOptionsSourceRow = { table, line: row.line, cells: { ...row.cells } };
    sourceRows.push(sourceRow);
    const projectId = sourceRow.cells.proj_id?.trim() ?? '';
    const indexes = indexesByProject.get(projectId) ?? [];
    indexes.push(sourceRowIndex);
    indexesByProject.set(projectId, indexes);
    const indexed = indexedRowsByProject.get(projectId) ?? [];
    indexed.push({ row, sourceRowIndex });
    indexedRowsByProject.set(projectId, indexed);
  }
}

export function indexXerScheduleOptions(tables: Pick<XerTables, 'tables' | 'numberFormat'>): XerScheduleOptionsIndex {
  const sourceRows: XerScheduleOptionsSourceRow[] = [];
  const sourceRowIndexesByProject = new Map<string, number[]>();
  const projectCandidates = new Map<string, IndexedSourceRow[]>();
  const scheduleCandidates = new Map<string, IndexedSourceRow[]>();
  appendSourceRows(
    tables.tables.get('PROJECT')?.rows ?? [],
    'PROJECT',
    sourceRows,
    sourceRowIndexesByProject,
    projectCandidates,
  );
  appendSourceRows(
    tables.tables.get('SCHEDOPTIONS')?.rows ?? [],
    'SCHEDOPTIONS',
    sourceRows,
    sourceRowIndexesByProject,
    scheduleCandidates,
  );

  const projectRowsById = new Map<string, IndexedSourceRow>();
  for (const [projectId, rows] of projectCandidates) {
    if (rows.length === 1) projectRowsById.set(projectId, rows[0]);
  }
  const scheduleRowsById = new Map<string, IndexedSourceRow>();
  const diagnosticsByProject = new Map<string, XerScheduleOptionsDiagnostic[]>();
  const diagnostics: XerScheduleOptionsDiagnostic[] = [];
  for (const [projectId, rows] of scheduleCandidates) {
    if (rows.length === 1) {
      scheduleRowsById.set(projectId, rows[0]);
      continue;
    }
    const diagnostic: XerScheduleOptionsDiagnostic = {
      code: 'XER_DUPLICATE_SCHEDOPTIONS_PROJ_ID',
      projectId,
      rowIndexes: rows.map(item => item.sourceRowIndex),
      lines: rows.map(item => item.row.line),
    };
    diagnostics.push(diagnostic);
    diagnosticsByProject.set(projectId, [diagnostic]);
  }
  const projectIds = new Set(projectCandidates.keys());
  const unmatchedScheduleOptionsRowIndexes = [...scheduleCandidates]
    .filter(([projectId]) => !projectIds.has(projectId))
    .flatMap(([, rows]) => rows.map(item => item.sourceRowIndex));

  const levelResourceRowsByScheduleOptionsId = new Map<string, XerRow[]>();
  const orphanLevelResourceRows: XerRow[] = [];
  const scheduleOptionsIds = new Set((tables.tables.get('SCHEDOPTIONS')?.rows ?? [])
    .map(row => row.cells.schedoptions_id?.trim() ?? '').filter(id => id !== ''));
  for (const row of tables.tables.get('RSRCLEVELLIST')?.rows ?? []) {
    const scheduleOptionsId = row.cells.schedoptions_id?.trim() ?? '';
    if (!scheduleOptionsId || !scheduleOptionsIds.has(scheduleOptionsId)) {
      orphanLevelResourceRows.push(row);
      continue;
    }
    levelResourceRowsByScheduleOptionsId.set(scheduleOptionsId, [
      ...(levelResourceRowsByScheduleOptionsId.get(scheduleOptionsId) ?? []), row,
    ]);
  }
  const resourceSourceIds = new Set((tables.tables.get('RSRC')?.rows ?? [])
    .map(row => row.cells.rsrc_id?.trim() ?? '').filter(id => id !== ''));
  const rateValues = new Map<string, Array<number | null>>();
  for (const row of tables.tables.get('RSRCRATE')?.rows ?? []) {
    const resourceId = row.cells.rsrc_id?.trim() ?? '';
    if (!resourceId) continue;
    rateValues.set(resourceId, [
      ...(rateValues.get(resourceId) ?? []), parseXerNumber(row.cells.max_qty_per_hr ?? '', tables.numberFormat),
    ]);
  }
  const maxUnitsPerHourByResource = new Map<string, number>();
  for (const [resourceId, values] of rateValues) {
    const first = values[0];
    if (first !== null && first !== undefined && first >= 0 && values.every(value => value === first)) {
      maxUnitsPerHourByResource.set(resourceId, first);
    }
  }

  return {
    numberFormat: tables.numberFormat,
    projectRowsById,
    scheduleRowsById,
    sourceRowIndexesByProject,
    diagnosticsByProject,
    sourceArchive: { rows: sourceRows, unmatchedScheduleOptionsRowIndexes, diagnostics },
    levelResourceRowsByScheduleOptionsId,
    orphanLevelResourceRows,
    resourceSourceIds,
    maxUnitsPerHourByResource,
  };
}

const LEVEL_PRIORITY_SEPARATOR = '\u007f\u007f';
const LEVEL_PRIORITY_FIELD_RE = /^[A-Za-z0-9_]{1,64}$/;

function levelPriorityValue(
  row: XerRow,
  fallbacks: XerScheduleOptionFallback[],
): LevelingPriorityKey[] {
  const out: LevelingPriorityKey[] = [];
  for (const rawEntry of (row.cells.levelprioritylist ?? '').split(LEVEL_PRIORITY_SEPARATOR)) {
    const entry = rawEntry.trim();
    if (!entry) continue;
    const comma = entry.indexOf(',');
    const field = comma < 0 ? '' : entry.slice(0, comma).trim();
    const rest = comma < 0 ? '' : entry.slice(comma + 1).trim();
    const direction = rest.slice(rest.lastIndexOf('/') + 1).trim().toUpperCase();
    if (LEVEL_PRIORITY_FIELD_RE.test(field) && (direction === 'ASC' || direction === 'DESC')) {
      out.push({ field, direction });
    } else {
      reportFallback(fallbacks, row, 'levelprioritylist', entry, 'sleutel weggelaten');
    }
  }
  return out;
}

function levelingValue(
  index: XerScheduleOptionsIndex,
  row: XerRow,
  fallbacks: XerScheduleOptionFallback[],
): LevelingSettings | undefined {
  const has = (field: string) => Object.prototype.hasOwnProperty.call(row.cells, field);
  const preserveScheduledDates = retainedBooleanValue(row, 'level_keep_sched_date_flag', fallbacks);
  const levelAllResources = retainedBooleanValue(row, 'level_all_rsrc_flag', fallbacks);
  const priority = has('levelprioritylist') ? levelPriorityValue(row, fallbacks) : undefined;
  const listRows = index.levelResourceRowsByScheduleOptionsId.get(row.cells.schedoptions_id?.trim() ?? '') ?? [];
  const resources: LevelingResourceSetting[] = [];
  const seen = new Set<string>();
  for (const listRow of listRows) {
    const sourceId = listRow.cells.rsrc_id?.trim() ?? '';
    if (!index.resourceSourceIds.has(sourceId)) {
      reportFallback(fallbacks, listRow, 'RSRCLEVELLIST.rsrc_id', sourceId, 'weggelaten (geen RSRC-rij)');
      continue;
    }
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    const maxUnitsPerHour = index.maxUnitsPerHourByResource.get(sourceId);
    resources.push({
      resourceId: resourceInternalId(sourceId),
      ...(maxUnitsPerHour !== undefined ? { maxUnitsPerHour } : {}),
    });
  }
  if (preserveScheduledDates === undefined && levelAllResources === undefined
    && priority === undefined && listRows.length === 0) return undefined;
  return {
    ...(preserveScheduledDates !== undefined ? { preserveScheduledDates } : {}),
    ...(levelAllResources !== undefined ? { levelAllResources } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(listRows.length > 0 ? { resources } : {}),
  };
}

function reportOrphanLevelResourceRows(index: XerScheduleOptionsIndex, fallbacks: XerScheduleOptionFallback[]): void {
  for (const listRow of index.orphanLevelResourceRows) {
    reportFallback(fallbacks, listRow, 'RSRCLEVELLIST.schedoptions_id',
      listRow.cells.schedoptions_id?.trim() || '(leeg)', 'weggelaten (geen SCHEDOPTIONS-rij)');
  }
}

export function deriveXerScheduleOptions(
  index: XerScheduleOptionsIndex,
  projectId: string,
  context: {
    hoursPerDay?: number;
    taskCount?: number;
    hasUsableProjectEnd?: boolean;
  } = {},
): XerScheduleOptionsResult {
  const defaults = freshDefaults();
  const projectRow = index.projectRowsById.get(projectId)?.row;
  const fallbacks: XerScheduleOptionFallback[] = [];
  reportRemainingTargetLinkFlag(projectRow, fallbacks);
  const sourceRowIndexes = [...(index.sourceRowIndexesByProject.get(projectId) ?? [])];
  const retainedRows = sourceRowIndexes.map(rowIndex => index.sourceArchive.rows[rowIndex]);
  const diagnostics = [...(index.diagnosticsByProject.get(projectId) ?? [])];
  defaults.schedulingOptions.criticalDefinition = projectCriticalDefinition(
    index,
    projectId,
    fallbacks,
  );

  const row = index.scheduleRowsById.get(projectId)?.row;
  if (!row) {
    reportOrphanLevelResourceRows(index, fallbacks);
    return {
      source: 'xer-defaults',
      progressMode: defaults.progressMode,
      schedulingOptions: defaults.schedulingOptions,
      retainedSource: {},
      fallbacks,
      diagnostics,
      sourceArchive: index.sourceArchive,
      sourceRowIndexes,
      sourceRows: retainedRows,
    };
  }

  const schedulingOptions: ProjectSchedulingOptions = {
    ...defaults.schedulingOptions,
    lagCalendar: enumValue<NonNullable<ProjectSchedulingOptions['lagCalendar']>>(
      row, 'sched_calendar_on_relationship_lag', {
      RCAL_PREDECESSOR: 'predecessor',
      RCAL_SUCCESSOR: 'successor',
      RCAL_24HOUR: '24hour',
      RCAL_PROJDEFAULT: 'projectDefault',
    }, 'successor', fallbacks),
    totalFloatMode: enumValue<NonNullable<ProjectSchedulingOptions['totalFloatMode']>>(
      row, 'sched_float_type', {
      FT_SS: 'start',
      FT_FF: 'finish',
      FT_MIN: 'smallest',
    }, 'finish', fallbacks),
    makeOpenEndedCritical: booleanValue(row, 'sched_open_critical_flag', false, fallbacks),
    useExpectedFinishDates: booleanValue(row, 'sched_use_expect_end_flag', true, fallbacks),
    startToStartLagFrom: booleanValue(row, 'sched_lag_early_start_flag', true, fallbacks)
      ? 'earlyStart' : 'actualStart',
  };

  const retainedProjectEndValue = retainedBooleanValue(
    row,
    'sched_use_project_end_date_for_float',
    fallbacks,
  );
  const retainedSource = retainedProjectEndValue === undefined
    ? {}
    : { sched_use_project_end_date_for_float: retainedProjectEndValue };
  if (retainedProjectEndValue !== undefined) {
    schedulingOptions.useProjectEndDateForFloat = retainedProjectEndValue;
  }
  if (schedulingOptions.useProjectEndDateForFloat === true && context.hasUsableProjectEnd === false) {
    schedulingOptions.useProjectEndDateForFloat = false;
    reportFallback(
      fallbacks,
      row,
      'sched_use_project_end_date_for_float',
      row.cells.sched_use_project_end_date_for_float?.trim() ?? '',
      'N (geen projecteinddatum en geen taakeinddatum in de bron: projecteinde = max(EF))',
    );
  }

  const progressMode = progressModeValue(row, fallbacks);
  if (!declaresRetainedLogic(row)) {
    schedulingOptions.p6CompletedLateFromRemainingWindow = false;
  }

  const floatPathFields = [
    'enable_multiple_longest_path_calc',
    'use_total_float_multiple_longest_paths',
    'use_total_float',
    'limit_multiple_longest_path_calc',
    'max_multiple_longest_path',
  ];
  if (floatPathFields.some(field => (row.cells[field]?.trim() ?? '') !== '')) {
    const enabled = booleanValue(row, 'enable_multiple_longest_path_calc', false, fallbacks);
    const methodField = row.cells.use_total_float_multiple_longest_paths?.trim()
      ? 'use_total_float_multiple_longest_paths'
      : 'use_total_float';
    const totalFloat = booleanValue(row, methodField, false, fallbacks);
    const limited = booleanValue(row, 'limit_multiple_longest_path_calc', true, fallbacks);
    const parsedMaximum = parseXerNumber(row.cells.max_multiple_longest_path ?? '', index.numberFormat);
    const taskCount = Math.max(1, Math.floor(context.taskCount ?? Number.MAX_SAFE_INTEGER));
    schedulingOptions.floatPaths = {
      enabled,
      method: totalFloat ? 'TOTAL_FLOAT' : 'FREE_FLOAT',
      maxPaths: limited ? Math.max(1, Math.floor(parsedMaximum ?? 10)) : taskCount,
    };
  }

  const leveling = levelingValue(index, row, fallbacks);
  if (leveling) schedulingOptions.leveling = leveling;
  reportOrphanLevelResourceRows(index, fallbacks);

  return {
    source: 'schedoptions',
    progressMode,
    schedulingOptions,
    retainedSource,
    fallbacks,
    diagnostics,
    sourceArchive: index.sourceArchive,
    sourceRowIndexes,
    sourceRows: retainedRows,
  };
}
