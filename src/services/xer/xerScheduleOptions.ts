/**
 * Pure XER-SCHEDOPTIONS-afleiding. Deze module bedraadt zichzelf bewust niet in `xerReader`: de
 * seriële importnaad volgt pas nadat de parallelle XER-kernbanen zijn samengebracht.
 *
 * Voor de betekenis van de P6-enumtokens is MPXJ als gedragsreferentie geraadpleegd
 * (https://github.com/joniles/mpxj, LGPL-2.1, Jon Iles e.a.). Er is geen MPXJ-code overgenomen;
 * mapping, defaults, kolommatrix en terugvalrapportage zijn hier zelfstandig geïmplementeerd.
 */
import type { ProgressMode, SchedulingOptions } from '@/types/project';
import { parseXerNumber, type XerRow, type XerTables } from './xerTables';

export interface XerScheduleOptionFallback {
  field: string;
  token: string;
  fallback: string;
  line: number;
}

export interface XerScheduleOptionsResult {
  source: 'schedoptions' | 'xer-defaults';
  progressMode: ProgressMode;
  schedulingOptions: SchedulingOptions;
  /** Bronwaarden waarvoor X5 nog geen correcte solverrepresentatie heeft. Ze blijven expliciet
   *  beschikbaar voor de latere readerwiring en worden niet als schijnoptie op het project gezet. */
  retainedSource: {
    sched_use_project_end_date_for_float?: boolean;
  };
  fallbacks: XerScheduleOptionFallback[];
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
    status: 'todo',
    reason: 'Meerdere gelijktijdig geplande projecten ontbreken; X5 bewaart de bronwaarde zonder solversturing.',
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
    lagCalendar: 'predecessor',
    criticalDefinition: { mode: 'totalFloat', thresholdHours: 0 },
    totalFloatMode: 'finish',
    makeOpenEndedCritical: false,
    useExpectedFinishDates: true,
    preserveActualDatesInBackwardPass: true,
    clampNegativeFreeFloat: true,
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
  tables: XerTables,
  projectId: string,
  fallbacks: XerScheduleOptionFallback[],
): SchedulingOptions['criticalDefinition'] {
  const row = tables.tables.get('PROJECT')?.rows.find(item => item.cells.proj_id?.trim() === projectId);
  if (!row) return { ...XER_SCHEDULING_DEFAULTS.schedulingOptions.criticalDefinition };
  const token = row.cells.critical_path_type?.trim() ?? '';
  if (token && token.toUpperCase() === 'CT_DRIVPATH') return { mode: 'longestPath' };
  if (token && token.toUpperCase() !== 'CT_TOTFLOAT') {
    reportFallback(fallbacks, row, 'critical_path_type', token, 'totalFloat');
  }
  const thresholdHours = parseXerNumber(row.cells.critical_drtn_hr_cnt ?? '', tables.numberFormat) ?? 0;
  return { mode: 'totalFloat', thresholdHours };
}

function scheduleRow(tables: XerTables, projectId: string): XerRow | undefined {
  return tables.tables.get('SCHEDOPTIONS')?.rows.find(row => row.cells.proj_id?.trim() === projectId);
}

export function deriveXerScheduleOptions(
  tables: XerTables,
  projectId: string,
  context: { hoursPerDay?: number; taskCount?: number } = {},
): XerScheduleOptionsResult {
  const defaults = freshDefaults();
  const fallbacks: XerScheduleOptionFallback[] = [];
  defaults.schedulingOptions.criticalDefinition = projectCriticalDefinition(
    tables,
    projectId,
    fallbacks,
  );

  const row = scheduleRow(tables, projectId);
  if (!row) {
    return {
      source: 'xer-defaults',
      progressMode: defaults.progressMode,
      schedulingOptions: defaults.schedulingOptions,
      retainedSource: {},
      fallbacks,
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
    const parsedMaximum = parseXerNumber(row.cells.max_multiple_longest_path ?? '', tables.numberFormat);
    const taskCount = Math.max(1, Math.floor(context.taskCount ?? Number.MAX_SAFE_INTEGER));
    schedulingOptions.floatPaths = {
      enabled,
      method: totalFloat ? 'TOTAL_FLOAT' : 'FREE_FLOAT',
      maxPaths: limited ? Math.max(1, Math.floor(parsedMaximum ?? 10)) : taskCount,
    };
  }

  return { source: 'schedoptions', progressMode, schedulingOptions, retainedSource, fallbacks };
}
