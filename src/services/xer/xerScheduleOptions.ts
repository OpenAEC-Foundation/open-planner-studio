/**
 * Pure XER-SCHEDOPTIONS-afleiding. `xerReader` roept deze module één keer per geopend project aan;
 * de mapping blijft hier zelfstandig zodat projectselectie en schedulingssemantiek niet mengen.
 *
 * Voor de betekenis van de P6-enumtokens is MPXJ als gedragsreferentie geraadpleegd
 * (https://github.com/joniles/mpxj, LGPL-2.1, Jon Iles e.a.). Er is geen MPXJ-code overgenomen;
 * mapping, defaults, kolommatrix en terugvalrapportage zijn hier zelfstandig geïmplementeerd.
 */
import type { ProgressMode, ProjectSchedulingOptions } from '@/types/project';
import type {
  XerScheduleOptionFallback,
  XerScheduleOptionsDiagnostic,
  XerScheduleOptionsMetadata,
  XerScheduleOptionsSourceArchive,
  XerScheduleOptionsSourceRow,
} from '../importTypes';
import { parseXerNumber, type XerRow, type XerTables } from './xerTables';
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
  /** Alleen projectopties (rekenprofielen C3); de conventies komen uit het P6-profiel. */
  schedulingOptions: ProjectSchedulingOptions;
  /** A19 per bestand uit `PROJECT.rem_target_link_flag`. Geen projectoptie maar een afwijking op het
   *  P6-profiel (de P6-basis heeft hem uit); `xerReader` zet hem als override. */
  p6UseRemainingStartForProgress: boolean;
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

const P6_OPTIONS = p6OptionDefaults();

/** XER-eigen defaults; worden nooit als algemene OPS-projectdefaults toegepast. Sinds rekenprofielen
 *  C3 alleen PROJECTOPTIES (de P6-conventies staan in het profiel dat `xerReader` zet). De WAARDEN
 *  komen uit het conventieregister (`p6OptionDefaults`); hier staat alleen welke sleutels de lezer
 *  zaait en in welke volgorde (die volgorde is de bytevolgorde van het IFC-optieblok). Dat deze set
 *  gelijk is aan `defaultOptionsFor('p6')`, pint `check-conventions-registry.ts`. */
export const XER_SCHEDULING_DEFAULTS = {
  progressMode: 'RETAINED_LOGIC',
  schedulingOptions: {
    lagCalendar: P6_OPTIONS.lagCalendar,
    criticalDefinition: P6_OPTIONS.criticalDefinition,
    totalFloatMode: P6_OPTIONS.totalFloatMode,
    makeOpenEndedCritical: P6_OPTIONS.makeOpenEndedCritical,
    useExpectedFinishDates: P6_OPTIONS.useExpectedFinishDates,
    p6CompletedLateFromRemainingWindow: P6_OPTIONS.p6CompletedLateFromRemainingWindow,
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

function projectRemainingStartValue(
  row: XerRow | undefined,
  fallbacks: XerScheduleOptionFallback[],
): boolean {
  if (!row) return false;
  const token = row.cells.rem_target_link_flag?.trim() ?? '';
  if (!token) return false;
  if (token.toUpperCase() === 'Y') return true;
  if (token.toUpperCase() === 'N') return false;
  reportFallback(fallbacks, row, 'rem_target_link_flag', token, 'false');
  return false;
}

/** "Aantoonbaar retained logic" voor de completed-late-klem: geen declaratie (P6-default) of
 *  exact `sched_retained_logic=Y`/`sched_progress_override=N` — elk half of afwijkend paar (N/N
 *  "Actual Dates", Y/Y, N/Y, onbekende tokens) telt als NIET aantoonbaar. Bewust strenger dan
 *  `progressModeValue`, die voor de solver zelf op RETAINED_LOGIC terugvalt. */
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
  context: {
    hoursPerDay?: number;
    taskCount?: number;
    /** Heeft het project een bruikbaar einde voor `sched_use_project_end_date_for_float`: een
     *  geldige PROJECT-einddatum (P6's "Must Finish By") óf minstens één geldige
     *  TASK-doeleinddatum? De lezer bepaalt dit (hij kent de taakrijen en de uurmodus);
     *  `undefined` laat de optie ongemoeid. */
    hasUsableProjectEnd?: boolean;
  } = {},
): XerScheduleOptionsResult {
  const defaults = freshDefaults();
  const projectRow = index.projectRowsById.get(projectId)?.row;
  const fallbacks: XerScheduleOptionFallback[] = [];
  // PROJECT.rem_target_link_flag is het documentgedragen P6-signaal dat remaining en target
  // gekoppeld blijven. Alleen dan beschrijven de XER Early/Late Start-assen bij een lopende taak
  // het resterende werkvenster; ontbrekend/N behoudt de historische Actual Start. De afleiding
  // gebruikt uitsluitend PROJECT-invoer en nooit early/late/float-orakelcellen.
  const p6UseRemainingStartForProgress = projectRemainingStartValue(projectRow, fallbacks);
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
      p6UseRemainingStartForProgress,
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
    }, 'predecessor', fallbacks),
    totalFloatMode: enumValue<NonNullable<ProjectSchedulingOptions['totalFloatMode']>>(
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
  // Projecteinde zonder einde (her-review 7a, plan XER §9, X12-brok 1). `Y` zegt dat de late pass op
  // het projecteinde verankert, maar het bestand draagt dan geen einde: geen PROJECT-einddatum (P6's
  // "Must Finish By") en geen enkele TASK-doeleinddatum. Het taak-afgeleide einde van de lezer valt
  // dan terug op de projectSTART en de hele late zijde verankerde daarop (cases-import.xer: 77/160
  // P6-cellen). Volgens de P6-documentatie rekent P6 zonder Must Finish By de late datums terug
  // vanaf het vroegste projecteinde, max(EF) — wat de solver doet met de optie uit; gemeten op
  // cases-import.xer: 156/160, gelijk aan de transcriptie. Daarom: optie uit, en zichtbaar als
  // terugval gerapporteerd. De bronwaarde `Y` blijft in `retainedSource` bewaard.
  // Bewust smal: een bestand mét taakeinden houdt het taak-afgeleide einde (OZB, Roads, Harbour,
  // xernative, ashspace — de optie daar óók uitzetten verslechterde 100 X12-cellen op OZB; open
  // vraag in plan XER §9).
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
  // X-O7 laag 1, klasse (i) (review-bevinding 6, aangescherpt in de her-review, bevinding 3): de
  // bewijsbasis voor `p6CompletedLateFromRemainingWindow` is uitsluitend RETAINED_LOGIC-corpus
  // (rehab-2, geen enkel gemeten bestand declareert iets anders) — zie het docblok bij het veld in
  // `types/project.ts`. De klem is daarom fail-closed op "aantoonbaar retained logic": de vlag
  // blijft alleen aan wanneer de bron géén van beide velden declareert (P6-default, rehab-2) of
  // exact Y/N zegt. Niet alleen `sched_progress_override=Y` (N/Y) zet 'm uit, maar óók P6's
  // "Actual Dates" (N/N) en de tegenstrijdige Y/Y — die vielen in `progressModeValue` zichtbaar
  // terug op RETAINED_LOGIC en hielden de vlag stil aan, terwijl juist Actual Dates de modus is
  // waarin P6 voltooid werk anders behandelt en daar geen enkele meting van bestaat.
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

  return {
    source: 'schedoptions',
    progressMode,
    schedulingOptions,
    p6UseRemainingStartForProgress,
    retainedSource,
    fallbacks,
    diagnostics,
    sourceArchive: index.sourceArchive,
    sourceRowIndexes,
    sourceRows: retainedRows,
  };
}
