/**
 * Pure XER-SCHEDOPTIONS-afleiding. `xerReader` roept deze module één keer per geopend project aan;
 * de mapping blijft hier zelfstandig zodat projectselectie en schedulingssemantiek niet mengen.
 *
 * Voor de betekenis van de P6-enumtokens is MPXJ als gedragsreferentie geraadpleegd
 * (https://github.com/joniles/mpxj, LGPL-2.1, Jon Iles e.a.). Er is geen MPXJ-code overgenomen;
 * mapping, defaults, kolommatrix en terugvalrapportage zijn hier zelfstandig geïmplementeerd.
 */
import type { ProgressMode, SchedulingOptions } from '@/types/project';
import type {
  XerScheduleOptionFallback,
  XerScheduleOptionsDiagnostic,
  XerScheduleOptionsMetadata,
  XerScheduleOptionsSourceArchive,
  XerScheduleOptionsSourceRow,
} from '../importTypes';
import { parseXerNumber, type XerRow, type XerTables } from './xerTables';

export type {
  XerScheduleOptionFallback,
  XerScheduleOptionsDiagnostic,
  XerScheduleOptionsMetadata,
  XerScheduleOptionsSourceArchive,
  XerScheduleOptionsSourceRow,
} from '../importTypes';

export interface XerScheduleOptionsResult extends XerScheduleOptionsMetadata {
  progressMode: ProgressMode;
  schedulingOptions: SchedulingOptions;
}

interface IndexedSourceRow {
  row: XerRow;
  sourceRowIndex: number;
}

/** Eenmalige bestandsindex: afleiding per project doet hierna uitsluitend Map-lookups. */
export interface XerScheduleOptionsIndex {
  numberFormat: XerTables['numberFormat'];
  projectRowsById: ReadonlyMap<string, IndexedSourceRow>;
  scheduleRowsById: ReadonlyMap<string, IndexedSourceRow>;
  sourceRowIndexesByProject: ReadonlyMap<string, readonly number[]>;
  diagnosticsByProject: ReadonlyMap<string, readonly XerScheduleOptionsDiagnostic[]>;
  sourceArchive: XerScheduleOptionsSourceArchive;
}

export type XerScheduleOptionColumnDisposition =
  | { field: string; status: 'mapped'; target: string }
  | { field: string; status: 'ignored' | 'todo'; reason: string };

const resourceLevelingReason = 'De CPM-solver voert geen resource-nivellering uit; er is in X5 geen veilige mapping.';

/** Exhaustieve bestemming van de 27 kolommen uit de openbare corpus-union. */
export const XER_SCHEDOPTIONS_COLUMN_DISPOSITIONS: readonly XerScheduleOptionColumnDisposition[] = [
  { field: 'enable_multiple_longest_path_calc', status: 'mapped', target: 'schedulingOptions.floatPaths.enabled' },
  {
    field: 'key_activity_for_multiple_longest_paths',
    status: 'todo',
    reason: 'OPS kan meerdere floatpaden berekenen maar heeft nog geen eindactiviteit-anker in het model.',
  },
  { field: 'level_all_rsrc_flag', status: 'ignored', reason: resourceLevelingReason },
  { field: 'level_float_thrs_cnt', status: 'ignored', reason: resourceLevelingReason },
  { field: 'level_keep_sched_date_flag', status: 'ignored', reason: resourceLevelingReason },
  { field: 'level_outer_assign_flag', status: 'ignored', reason: resourceLevelingReason },
  { field: 'level_outer_assign_priority', status: 'ignored', reason: resourceLevelingReason },
  { field: 'level_over_alloc_pct', status: 'ignored', reason: resourceLevelingReason },
  { field: 'level_within_float_flag', status: 'ignored', reason: resourceLevelingReason },
  { field: 'levelprioritylist', status: 'ignored', reason: resourceLevelingReason },
  { field: 'limit_multiple_longest_path_calc', status: 'mapped', target: 'schedulingOptions.floatPaths.maxPaths' },
  { field: 'max_multiple_longest_path', status: 'mapped', target: 'schedulingOptions.floatPaths.maxPaths' },
  { field: 'proj_id', status: 'mapped', target: 'SCHEDOPTIONS-rijselectie per project' },
  { field: 'sched_calendar_on_relationship_lag', status: 'mapped', target: 'schedulingOptions.lagCalendar' },
  { field: 'sched_float_type', status: 'mapped', target: 'schedulingOptions.totalFloatMode' },
  {
    field: 'sched_lag_early_start_flag',
    status: 'todo',
    reason: 'De N-semantiek raakt voortgang en actuals; X7 moet die taakvelden eerst aan de solver leveren.',
  },
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
  { field: 'schedoptions_id', status: 'ignored', reason: 'Technische rij-identiteit; proj_id is de projectbinding.' },
  { field: 'use_total_float', status: 'mapped', target: 'schedulingOptions.floatPaths.method (dialectalias)' },
  {
    field: 'use_total_float_multiple_longest_paths',
    status: 'mapped',
    target: 'schedulingOptions.floatPaths.method',
  },
] as const;

/** XER-eigen defaults; worden nooit als algemene OPS-projectdefaults toegepast. */
export const XER_SCHEDULING_DEFAULTS = {
  progressMode: 'RETAINED_LOGIC',
  schedulingOptions: {
    p6Source: 'XER',
    lagCalendar: 'predecessor',
    criticalDefinition: { mode: 'totalFloat', thresholdHours: 0 },
    totalFloatMode: 'finish',
    makeOpenEndedCritical: false,
    useExpectedFinishDates: true,
    preserveActualDatesInBackwardPass: true,
    clampNegativeFreeFloat: true,
    p6ZeroDurationUsesPlannedBoundary: true,
    p6UseTaskPlannedStartFloor: true,
    p6FinishMilestoneBoundaryWindow: true,
    p6PreserveActualInstants: true,
    p6UseRemainingStartForProgress: false,
    p6PreserveZeroDurationConstraintInstants: true,
  },
} as const satisfies { progressMode: ProgressMode; schedulingOptions: SchedulingOptions };

function freshDefaults(): { progressMode: ProgressMode; schedulingOptions: SchedulingOptions } {
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

  // P6 kent naast Retained Logic en Progress Override ook Actual Dates (N/N). Het huidige OPS-
  // model heeft daarvoor nog geen derde modus. Ook een tegenstrijdige Y/Y-combinatie is niet
  // eenduidig. Beide vallen zichtbaar terug; lege velden hierboven blijven gewone defaults.
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
): SchedulingOptions['criticalDefinition'] {
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

/**
 * Indexeer PROJECT en SCHEDOPTIONS elk precies eenmaal. Een dubbele SCHEDOPTIONS-proj_id wordt
 * niet stil gekozen: alle raw rijen blijven bewaard, een typed diagnose wordt uitgegeven en de
 * onzekere SCHEDOPTIONS-semantiek wordt voor dat project niet toegepast.
 */
export function indexXerScheduleOptions(tables: XerTables): XerScheduleOptionsIndex {
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

  return {
    numberFormat: tables.numberFormat,
    projectRowsById,
    scheduleRowsById,
    sourceRowIndexesByProject,
    diagnosticsByProject,
    sourceArchive: { rows: sourceRows, unmatchedScheduleOptionsRowIndexes, diagnostics },
  };
}

export function deriveXerScheduleOptions(
  index: XerScheduleOptionsIndex,
  projectId: string,
  context: { hoursPerDay?: number; taskCount?: number } = {},
): XerScheduleOptionsResult {
  const defaults = freshDefaults();
  const projectRow = index.projectRowsById.get(projectId)?.row;
  // PROJECT.rem_target_link_flag is het documentgedragen P6-signaal dat remaining en target
  // gekoppeld blijven. Alleen dan beschrijven de XER Early/Late Start-assen bij een lopende taak
  // het resterende werkvenster; ontbrekend/N behoudt de historische Actual Start. De afleiding
  // gebruikt uitsluitend PROJECT-invoer en nooit early/late/float-orakelcellen.
  defaults.schedulingOptions.p6UseRemainingStartForProgress =
    projectRow?.cells.rem_target_link_flag?.trim().toUpperCase() === 'Y';
  const fallbacks: XerScheduleOptionFallback[] = [];
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

  const schedulingOptions: SchedulingOptions = {
    ...defaults.schedulingOptions,
    lagCalendar: enumValue<NonNullable<SchedulingOptions['lagCalendar']>>(
      row, 'sched_calendar_on_relationship_lag', {
      RCAL_PREDECESSOR: 'predecessor',
      RCAL_SUCCESSOR: 'successor',
      RCAL_24HOUR: '24hour',
      RCAL_PROJDEFAULT: 'projectDefault',
    }, 'predecessor', fallbacks),
    totalFloatMode: enumValue<NonNullable<SchedulingOptions['totalFloatMode']>>(
      row, 'sched_float_type', {
      FT_SS: 'start',
      FT_FF: 'finish',
      FT_MIN: 'smallest',
    }, 'finish', fallbacks),
    makeOpenEndedCritical: booleanValue(row, 'sched_open_critical_flag', false, fallbacks),
    useExpectedFinishDates: booleanValue(row, 'sched_use_expect_end_flag', true, fallbacks),
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

  const progressMode = progressModeValue(row, fallbacks);

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
