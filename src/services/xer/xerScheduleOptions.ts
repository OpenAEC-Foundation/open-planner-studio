/**
 * Pure XER-SCHEDOPTIONS-afleiding. `xerReader` roept deze module één keer per geopend project aan;
 * de mapping blijft hier zelfstandig zodat projectselectie en schedulingssemantiek niet mengen.
 *
 * Voor de betekenis van de P6-enumtokens is MPXJ als gedragsreferentie geraadpleegd
 * (https://github.com/joniles/mpxj, LGPL-2.1, Jon Iles e.a.). Er is geen MPXJ-code overgenomen;
 * mapping, defaults, kolommatrix en terugvalrapportage zijn hier zelfstandig geïmplementeerd.
 */
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
  /** Alleen projectopties (rekenprofielen C3); de conventies komen uit het P6-profiel. */
  schedulingOptions: ProjectSchedulingOptions;
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
  /** Nivellering (fundament): RSRCLEVELLIST-rijen per `schedoptions_id`, in bronvolgorde. */
  levelResourceRowsByScheduleOptionsId: ReadonlyMap<string, readonly XerRow[]>;
  /** RSRCLEVELLIST-rijen met een lege `schedoptions_id` of een id zonder SCHEDOPTIONS-rij: ze horen bij
   *  geen enkel project en worden per afgeleid project als terugval gemeld (nooit stil). */
  orphanLevelResourceRows: readonly XerRow[];
  /** Alle `RSRC.rsrc_id`'s van het bestand (een lijstregel zonder resource valt zichtbaar weg). */
  resourceSourceIds: ReadonlySet<string>;
  /** `RSRCRATE.max_qty_per_hr` per resource, alleen als alle tariefrijen één en dezelfde waarde dragen. */
  maxUnitsPerHourByResource: ReadonlyMap<string, number>;
}

export type XerScheduleOptionColumnDisposition =
  | { field: string; status: 'mapped'; target: string }
  | { field: string; status: 'ignored' | 'todo'; reason: string };

const resourceLevelingReason = 'De CPM-solver voert geen resource-nivellering uit; het nivelleerfundament '
  + '(`schedulingOptions.leveling`) leest deze instelling (nog) niet — alleen keep/all/prioriteit/resourcelijst.';

/** Exhaustieve bestemming van de 27 kolommen uit de openbare corpus-union. */
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

/** `PROJECT.rem_target_link_flag` stuurt sinds 2026-09-24 GEEN conventie meer (eigenaarsbesluit "a",
 *  Fable-critreview PR #169 bevinding 2): A19 staat gewoon aan in het P6-profiel. De vlag wordt nog
 *  alleen als diagnose gelezen: een onbekend token komt als fallback in de metadata, Y/N/leeg niet.
 *  [VERMOED · hoog] In P6 heet het veld `LinkPlannedAndAtCompletionFlag` ("Link Budget and At
 *  Completion for not started activities") — een eenheden-/kostenkoppeling, geen datumregel. */
function reportRemainingTargetLinkFlag(
  row: XerRow | undefined,
  fallbacks: XerScheduleOptionFallback[],
): void {
  const token = row?.cells.rem_target_link_flag?.trim() ?? '';
  if (!token || token.toUpperCase() === 'Y' || token.toUpperCase() === 'N') return;
  reportFallback(fallbacks, row!, 'rem_target_link_flag', token, 'niet gebruikt');
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

/** Scheidingsteken tussen de sleutels van `LevelPriorityList` (P6's DEL-DEL-regelovergang). */
const LEVEL_PRIORITY_SEPARATOR = '\u007f\u007f';
const LEVEL_PRIORITY_FIELD_RE = /^[A-Za-z0-9_]{1,64}$/;

/**
 * `SCHEDOPTIONS.LevelPriorityList` ⇒ prioriteitssleutels. Gemeten vormen (alle 48 corpusrijen met de
 * kolom): `priority_type,ASC_BY_FIELD/ASC`, `priority_type,ASC` en `<veld>,/ASC`, elk afgesloten met
 * DEL-DEL; meerdere sleutels volgen elkaar met hetzelfde scheidingsteken op. De richting staat na de
 * laatste `/` (of, zonder `/`, direct na de komma); het tussenstuk (`ASC_BY_FIELD`) wordt niet
 * geïnterpreteerd en blijft in het bronarchief. Een sleutel die niet in die vorm past valt zichtbaar
 * terug (weggelaten), nooit stil.
 */
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

/**
 * Nivelleerinstellingen van één SCHEDOPTIONS-rij als DATA (`SchedulingOptions.leveling`, etappe
 * P6-nivellering fundament). Leest uitsluitend invoerinstellingen: de drie `level_*`-kolommen hieronder,
 * RSRCLEVELLIST (via `schedoptions_id`) en `RSRCRATE.max_qty_per_hr` — nooit opgeslagen rekenuitvoer
 * (bak 4) en nooit een afleiding "is er genivelleerd": P6 slaat niet op of er genivelleerd is, en het
 * blok heeft bewust geen aan/uit-veld (eigenaarsbeslissing 1 open, onderzoek §2b).
 * Draagt de rij geen van de drie kolommen en geen resourcelijst, dan `undefined` (geen blok).
 */
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

/**
 * RSRCLEVELLIST-rijen die bij geen SCHEDOPTIONS-rij horen (lege of onbekende `schedoptions_id`) vallen
 * weg, maar zichtbaar: elke afgeleide projectuitkomst meldt ze (een bestandsbrede rij heeft geen eigen
 * project, dus in een meerprojectbestand staat dezelfde melding bij elk project).
 */
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
  // PROJECT.rem_target_link_flag: alleen diagnose, stuurt niets (zie `reportRemainingTargetLinkFlag`).
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
    }, 'predecessor', fallbacks),
    totalFloatMode: enumValue<NonNullable<ProjectSchedulingOptions['totalFloatMode']>>(
      row, 'sched_float_type', {
      FT_SS: 'start',
      FT_FF: 'finish',
      FT_MIN: 'smallest',
    }, 'finish', fallbacks),
    makeOpenEndedCritical: booleanValue(row, 'sched_open_critical_flag', false, fallbacks),
    useExpectedFinishDates: booleanValue(row, 'sched_use_expect_end_flag', true, fallbacks),
    // P6 "Calculate Start-to-Start lag from" (Oracle P6 Help 99348): Y = Early Start (P6-standaard),
    // N = Actual Start ("statusdatum + rest-lag"). De variant van conventie C6; leeg ⇒ Early Start.
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
