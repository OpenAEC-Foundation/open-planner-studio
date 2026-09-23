import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloneTasksForSolve, solveProject } from '@/engine/scheduler/solveProject';
import { readXER } from '@/services/xer/xerReader';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import {
  XER_SCHEDOPTIONS_COLUMN_DISPOSITIONS,
} from '@/services/xer/xerScheduleOptions';
import { XerImportError } from '@/services/xer/xerTables';
import type { ConventionKey, LegacySchedulingOptions, ProgressMode, SchedulingOptions } from '@/types/project';
import {
  measureXerFidelity,
  type XerCorpusManifest,
  type XerSolvedProject,
  type XerSolvedTask,
} from './xerFidelity';
import {
  scanXerGroundTruth,
  XER_FIDELITY_AXES,
  type XerGroundTruth,
} from './xerGroundTruth';
import { emptyCounters, type XerFidelityCounters } from './xerFidelityTypes';
import {
  expectedXerScheduleOptions,
  hasProjectAddressableScheduleRow,
  scanRawXerScheduleOptions,
  type IndependentXerScheduleExpected,
  type RawXerScheduleScan,
} from './xerScheduleOptionsGroundTruth';
import { legacyEffective } from './legacySolveOptions';
import { resolveConventions } from '@/engine/scheduler/conventions/registry';

const BLAST_AXES = [...XER_FIDELITY_AXES, 'isCritical'] as const;
type BlastAxis = typeof BLAST_AXES[number];
type AxisVector = [number, number, number, number, number, number, number];
type DefaultKey =
  | 'totalFloatFinish'
  | 'retainedLogic'
  | 'openEndedNotCritical'
  | 'predecessorLagCalendar'
  | 'expectedFinishDates'
  | 'preserveActualDates'
  | 'clampNegativeFreeFloat'
  | 'projectCriticalDefinition';

const DEFAULT_KEYS: readonly DefaultKey[] = [
  'totalFloatFinish',
  'retainedLogic',
  'openEndedNotCritical',
  'predecessorLagCalendar',
  'expectedFinishDates',
  'preserveActualDates',
  'clampNegativeFreeFloat',
  'projectCriticalDefinition',
];

const DEFERRED_DEFAULTS = [] as const;

interface SolverVariant {
  progressMode?: ProgressMode;
  /** Een (legacy-)blob; `projectResult` zet hem via `legacyEffective` om (rekenprofielen C1/C4). */
  schedulingOptions?: LegacySchedulingOptions;
}

interface DefaultMeasurement {
  chosenNegativeFloatTasks: number;
  counterfactualNegativeFloatTasks: number;
}

interface MeasuredFile {
  id: string;
  state: 'measured' | 'deferred';
  tasks: number;
  oracleNegativeFloatTasks: number;
  deferredCode?: string;
  houseNegativeFloatTasks?: number;
  xerDefaultsNegativeFloatTasks?: number;
  defaults?: Record<DefaultKey, DefaultMeasurement>;
}

interface ExpectedFinishVariantFile {
  id: string;
  tasks: number;
  sourceTasks: number;
  activeSourceTasks: number;
  movement: AxisVector;
  directionChanges: number;
  directionDigest: string;
}

interface ExpectedFinishVariantBaseline {
  selection: {
    chosen: boolean;
    counterfactual: boolean;
  };
  population: {
    oracleFiles: number;
    readableFiles: number;
    deferredFiles: number;
    projects: number;
    tasks: number;
    sourceTasks: number;
    activeSourceTasks: number;
    sourceFiles: number;
    movingFiles: number;
  };
  movement: AxisVector;
  files: ExpectedFinishVariantFile[];
  fidelity: {
    chosen: XerFidelityCounters;
    counterfactual: XerFidelityCounters;
  };
}

const EXPECTED_FINISH_SELECTION = { chosen: true, counterfactual: false } as const;

interface BaselineValueDelta {
  path: string;
  before: unknown;
  after: unknown;
}

/** De zes X12-assen van de defaults-fidelity (de struikeldraad "0 meetbaar op manifest-orakels"). */
const FIDELITY_AXES = ['es', 'ef', 'ls', 'lf', 'tf', 'ff'] as const;

interface BlastRadiusBaseline {
  version: 10;
  axes: readonly BlastAxis[];
  defaults: readonly DefaultKey[];
  deferredDefaults: typeof DEFERRED_DEFAULTS;
  population: {
    scanned: number;
    oracleAxisFiles: number;
    rawWithSchedOptions: number;
    rawWithoutSchedOptions: number;
    projectAddressableSchedOptions: number;
    functionallyWithoutSchedOptions: number;
    measured: number;
    deferred: number;
    readableFiles: number;
    openedProjectsWithDefaults: number;
    wiredProjectsWithDefaults: number;
    concreteProjectsCompared: number;
    oracleNegativeFloatFiles: number;
    withoutSchedOptionsNegativeFloatFiles: number;
    rawNegativeFloatFiles: number;
    rawWithoutSchedOptionsNegativeFloatFiles: number;
  };
  schedOptionsRows: {
    rows: number;
    floatFinish: number;
    retainedLogic: number;
    openEndedNotCritical: number;
    predecessorLagCalendar: number;
    projectEndForFloat: number;
    expectedFinishDates: number;
    lagFromEarlyStart: number;
    progressOverride: number;
    unknownFloatDialect: number;
    derivedRows: number;
    derivedFallbacks: number;
    derivedFloatDialectFallbacks: number;
    derivedNoProjectEndFallbacks: number;
    derivedRetainedLogic: number;
    derivedProgressOverride: number;
    derivedFinishFloat: number;
    derivedLagPredecessor: number;
    derivedLagSuccessor: number;
    derivedLag24Hour: number;
    derivedLagProjectDefault: number;
    retainedProjectEndValues: number;
  };
  corpusUnion: string[];
  files: MeasuredFile[];
  expectedFinishVariant: ExpectedFinishVariantBaseline;
  /** Historisch X7-dossier; de levende duration-type-regel staat als corpusloze mutatiefixture in X12. */
  legacyDurationTypeHistoricalDelta?: BaselineValueDelta[];
  /** Alleen in de meting (struikeldraad hieronder), NIET in het gecommitte bestand: op de
   *  SCHEDOPTIONS-loze populatie staat geen manifest-orakel, dus elke teller is 0 meetbaar. */
  fidelity: {
    house: XerFidelityCounters;
    xerDefaults: XerFidelityCounters;
    defaults: Record<DefaultKey, {
      chosen: XerFidelityCounters;
      counterfactual: XerFidelityCounters;
    }>;
  };
}

type RawXerTables = RawXerScheduleScan['tables'];
type RawXerTable = RawXerTables extends Map<string, infer T> ? T : never;

type BlastSolvedTask = XerSolvedTask & { isCritical?: boolean };
interface BlastSolvedProject extends XerSolvedProject {
  tasks: BlastSolvedTask[];
}

const diffs: string[] = [];
let checks = 0;
const here = fileURLToPath(new URL('.', import.meta.url));
const baselinePath = join(here, 'xer-schedoptions-blast-radius.json');
const report = process.env.OPS_XER_SCHEDOPTIONS_REPORT;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(label);
}

function independentOraclePopulation(population: BlastRadiusBaseline['population']): unknown {
  return {
    scanned: population.scanned,
    oracleAxisFiles: population.oracleAxisFiles,
    rawWithSchedOptions: population.rawWithSchedOptions,
    rawWithoutSchedOptions: population.rawWithoutSchedOptions,
    projectAddressableSchedOptions: population.projectAddressableSchedOptions,
    functionallyWithoutSchedOptions: population.functionallyWithoutSchedOptions,
    oracleNegativeFloatFiles: population.oracleNegativeFloatFiles,
    withoutSchedOptionsNegativeFloatFiles: population.withoutSchedOptionsNegativeFloatFiles,
    rawNegativeFloatFiles: population.rawNegativeFloatFiles,
    rawWithoutSchedOptionsNegativeFloatFiles: population.rawWithoutSchedOptionsNegativeFloatFiles,
  };
}

function productDerivedPopulation(population: BlastRadiusBaseline['population']): unknown {
  return {
    measured: population.measured,
    deferred: population.deferred,
    readableFiles: population.readableFiles,
    openedProjectsWithDefaults: population.openedProjectsWithDefaults,
    wiredProjectsWithDefaults: population.wiredProjectsWithDefaults,
    concreteProjectsCompared: population.concreteProjectsCompared,
  };
}

function listXerFilesRecursive(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listXerFilesRecursive(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xer')) files.push(full);
  }
  return files;
}

function hash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Is dit corpusbestand een manifest-orakel (`role: oracle`, `included: true`)? Sinds 2026-09-23
 * (eigenaarsbesluit "alleen die P6-bestanden" + critreview manifest-etappe, optie (b)) tellen de
 * FIDELITY-afwijkingen van deze check alleen nog op manifest-orakels. De populatie zelf (welke
 * bestanden hebben een orakelas, welke hebben geen SCHEDOPTIONS-rij, worden de XER-standaardwaarden
 * daar toegepast en bedraad) blijft corpusbreed: dat is lezergedrag, geen P6-orakel. Een label buiten
 * het manifest of een afwijkende bytehash is een fout, geen stille uitsluiting.
 */
let manifestCache: XerCorpusManifest | undefined;
function manifestOracle(root: string, path: string, fullHash: string): boolean {
  manifestCache ??= JSON.parse(readFileSync(join(here, 'xer-corpus-manifest.json'), 'utf8')) as XerCorpusManifest;
  const label = relative(root, path).split('\\').join('/');
  const entry = manifestCache.files[label];
  if (!entry) throw new Error(`${label}: corpusbestand ontbreekt in xer-corpus-manifest.json`);
  if (entry.sha256 !== fullHash) throw new Error(`${label}: SHA-256 wijkt af van het manifest`);
  return entry.included === true;
}

function hasOracleAxis(truth: XerGroundTruth): boolean {
  return truth.tasks.some(task => XER_FIDELITY_AXES.some(axis => task.axes[axis] !== null));
}

function taskHasNegativeFloat(task: XerGroundTruth['tasks'][number]): boolean {
  return (typeof task.axes.tf === 'number' && task.axes.tf < 0)
    || (typeof task.axes.ff === 'number' && task.axes.ff < 0);
}

function decodedForTableMarker(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  const payload = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
    ? bytes.subarray(3)
    : bytes;
  return new TextDecoder('windows-1252').decode(payload);
}

function hasRawNegativeFloat(bytes: Uint8Array): boolean {
  let table = '';
  let fields: string[] = [];
  for (const line of decodedForTableMarker(bytes).split(/\r?\n/)) {
    const cells = line.split('\t');
    if (cells[0] === '%E') break;
    if (cells[0] === '%T') {
      table = cells[1]?.trim().toUpperCase() ?? '';
      fields = [];
      continue;
    }
    if (table !== 'TASK') continue;
    if (cells[0] === '%F') {
      fields = cells.slice(1).map(field => field.trim().toLowerCase());
      continue;
    }
    if (cells[0] !== '%R') continue;
    for (const field of ['total_float_hr_cnt', 'free_float_hr_cnt']) {
      const index = fields.indexOf(field);
      if (index >= 0 && /^-\d/.test(cells[index + 1]?.trim() ?? '')) return true;
    }
  }
  return false;
}

function addCounters(target: XerFidelityCounters, source: XerFidelityCounters): void {
  for (const axis of XER_FIDELITY_AXES) {
    target[axis].deviations += source[axis].deviations;
    target[axis].measurable += source[axis].measurable;
  }
}

function solvedTaskAxis(task: BlastSolvedTask, axis: BlastAxis): string | number | boolean | undefined {
  switch (axis) {
    case 'es': return task.earlyStart;
    case 'ef': return task.earlyFinish;
    case 'ls': return task.lateStart;
    case 'lf': return task.lateFinish;
    case 'tf': return task.totalFloatMinutes;
    case 'ff': return task.freeFloatMinutes;
    case 'isCritical': return task.isCritical;
  }
}

function movement(before: BlastSolvedProject, after: BlastSolvedProject): AxisVector {
  const afterById = new Map(after.tasks.map(task => [task.sourceTaskId, task]));
  return BLAST_AXES.map(axis => before.tasks.reduce((sum, task) => {
    const next = afterById.get(task.sourceTaskId);
    return sum + (next && solvedTaskAxis(task, axis) === solvedTaskAxis(next, axis) ? 0 : 1);
  }, 0)) as AxisVector;
}

function movementProjects(
  before: readonly BlastSolvedProject[],
  after: readonly BlastSolvedProject[],
): AxisVector {
  const afterByProject = new Map(after.map(project => [project.projectId, project]));
  const total = Array(BLAST_AXES.length).fill(0) as AxisVector;
  for (const project of before) {
    const next = afterByProject.get(project.projectId);
    if (!next) throw new Error(`blast-radius mist project ${project.projectId} in de tegenvariant`);
    movement(project, next).forEach((value, index) => { total[index] += value; });
  }
  return total;
}

interface TaskAxisMovement {
  projectId: string;
  taskId: string;
  taskCode: string;
  axis: BlastAxis;
  before: string | number | boolean | undefined;
  after: string | number | boolean | undefined;
}

// X7-reviewpunt 4: de vroegere 16→15-teller is geen CP_Drtn- of projectindexeffect. Deze vijftien
// taakdelta's komen exact van X5's `preserveActualDatesInBackwardPass=true` tegenover de
// house/counterfactual `false`. De pin bewaart taak + as + beide instanties; alleen een totaalteller
// zou opnieuw een toevallig gelijk blijvende verschuiving kunnen verbergen.
const TORTURE_PRESERVE_ACTUAL_LS_PIN = [
  ['A1000', '2025-12-26T08:00', '2026-01-05T08:00'],
  ['A2000', '2026-01-03T15:00', '2026-01-19T08:00'],
  ['A2100', '2026-01-15T15:00', '2026-01-16T08:00'],
  ['A2110', '2026-02-12T12:00', '2026-01-30T08:00'],
  ['A2300', '2026-04-16T13:00', '2026-02-09T08:00'],
  ['A3000', '2025-12-26T08:00', '2026-01-05T08:00'],
  ['A3010', '2026-01-03T15:00', '2026-01-19T07:00'],
  ['A3020', '2026-06-01T12:30', '2026-01-12T07:00'],
  ['A3030', '2026-10-14T07:00', '2026-02-02T07:00'],
  ['A4100', '2026-01-15T15:00', '2026-01-26T07:00'],
  ['A4110', '2026-01-22T15:00', '2026-02-02T07:00'],
  ['A4200', '2026-01-31T15:00', '2026-02-16T07:00'],
  ['A4210', '2026-02-12T15:00', '2026-02-23T07:00'],
  ['A4220', '2026-02-24T15:00', '2026-02-25T08:00'],
  ['A4230', '2026-02-17T15:00', '2026-02-17T07:00'],
] as const;

function lateStartPin(details: readonly TaskAxisMovement[]): Array<readonly [string, unknown, unknown]> {
  return details.filter(detail => detail.axis === 'ls')
    .map(detail => [detail.taskId, detail.before, detail.after] as const);
}

function movementDetails(
  before: readonly BlastSolvedProject[],
  after: readonly BlastSolvedProject[],
): TaskAxisMovement[] {
  const afterByProject = new Map(after.map(project => [project.projectId, project]));
  const details: TaskAxisMovement[] = [];
  for (const project of before) {
    const nextProject = afterByProject.get(project.projectId);
    if (!nextProject) throw new Error(`detailmeting mist project ${project.projectId}`);
    const nextById = new Map(nextProject.tasks.map(task => [task.sourceTaskId, task]));
    for (const task of project.tasks) {
      const next = nextById.get(task.sourceTaskId);
      if (!next) throw new Error(`detailmeting mist taak ${project.projectId}/${task.sourceTaskId}`);
      for (const axis of BLAST_AXES) {
        const beforeValue = solvedTaskAxis(task, axis);
        const afterValue = solvedTaskAxis(next, axis);
        if (beforeValue !== afterValue) details.push({
          projectId: project.projectId,
          taskId: task.sourceTaskId,
          taskCode: task.taskCode,
          axis,
          before: beforeValue,
          after: afterValue,
        });
      }
    }
  }
  return details;
}

function negativeFloatTasks(solved: readonly BlastSolvedProject[]): number {
  return solved.reduce((sum, project) => sum
    + project.tasks.filter(task => (task.totalFloatMinutes ?? 0) < 0).length, 0);
}

function projectResult(
  imported: ImportResult,
  variant: SolverVariant,
): BlastSolvedProject {
  const tasks = cloneTasksForSolve(imported.tasks);
  const cpm = solveProject({
    tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: variant.progressMode,
    schedulingOptions: legacyEffective(variant.schedulingOptions),
    projectStartDate: imported.project.startDate,
  });
  if (cpm.error) throw new Error(cpm.error);
  const calendarById = new Map([
    [imported.calendar.id, imported.calendar],
    ...(imported.resourceCalendars ?? []).map(calendar => [calendar.id, calendar] as const),
  ]);
  const output: BlastSolvedTask[] = tasks
    .filter(task => task.p6ActivityType !== undefined)
    .map(task => {
      const calendar = (task.calendarId ? calendarById.get(task.calendarId) : undefined) ?? imported.calendar;
      const minutesPerDay = calendar.hoursPerDay * 60;
      return {
        sourceTaskId: task.id,
        taskCode: task.wbsCode,
        earlyStart: task.time.earlyStart,
        earlyFinish: task.time.earlyFinish,
        lateStart: task.time.lateStart,
        lateFinish: task.time.lateFinish,
        totalFloatMinutes: task.time.totalFloat * minutesPerDay,
        freeFloatMinutes: task.time.freeFloat * minutesPerDay,
        isCritical: cpm.tasks.get(task.id)?.isCritical,
      };
    });
  return { projectId: imported.project.id, tasks: output };
}

function variantDefinitions(
  criticalDefinition: SchedulingOptions['criticalDefinition'],
): Record<DefaultKey, { chosen: SolverVariant; counterfactual: SolverVariant }> {
  return {
    totalFloatFinish: {
      chosen: { schedulingOptions: { totalFloatMode: 'finish' } },
      counterfactual: { schedulingOptions: { totalFloatMode: 'smallest' } },
    },
    retainedLogic: {
      chosen: { progressMode: 'RETAINED_LOGIC' },
      counterfactual: { progressMode: 'PROGRESS_OVERRIDE' },
    },
    openEndedNotCritical: {
      chosen: { schedulingOptions: { makeOpenEndedCritical: false } },
      counterfactual: { schedulingOptions: { makeOpenEndedCritical: true } },
    },
    predecessorLagCalendar: {
      chosen: { schedulingOptions: { lagCalendar: 'predecessor' } },
      counterfactual: { schedulingOptions: { lagCalendar: 'successor' } },
    },
    expectedFinishDates: {
      chosen: { schedulingOptions: { useExpectedFinishDates: true } },
      counterfactual: { schedulingOptions: { useExpectedFinishDates: false } },
    },
    preserveActualDates: {
      chosen: { schedulingOptions: { preserveActualDatesInBackwardPass: true } },
      counterfactual: { schedulingOptions: { preserveActualDatesInBackwardPass: false } },
    },
    clampNegativeFreeFloat: {
      chosen: { schedulingOptions: { clampNegativeFreeFloat: true } },
      counterfactual: { schedulingOptions: { clampNegativeFreeFloat: false } },
    },
    projectCriticalDefinition: {
      chosen: { schedulingOptions: { criticalDefinition } },
      counterfactual: { schedulingOptions: { criticalDefinition: { mode: 'totalFloat', thresholdHours: 0 } } },
    },
  };
}

function deferredCode(error: unknown): string {
  return error instanceof XerImportError ? error.xerCode : 'UNEXPECTED_IMPORT_ERROR';
}

function measureCorpus(root: string): BlastRadiusBaseline {
  const scanned = listXerFilesRecursive(root).map(path => {
    const bytes = readFileSync(path);
    return {
      path,
      bytes,
      fullHash: hash(bytes),
      truth: scanXerGroundTruth(bytes),
      rawScan: scanRawXerScheduleOptions(bytes),
    };
  });
  const oracleFiles = scanned.filter(file => hasOracleAxis(file.truth));
  const hasRawScheduleRows = (file: typeof scanned[number]): boolean =>
    (file.rawScan.tables.get('SCHEDOPTIONS')?.rows.length ?? 0) > 0;
  const hasAddressableScheduleRows = (file: typeof scanned[number]): boolean =>
    hasProjectAddressableScheduleRow(file.rawScan);
  const rawWithout = oracleFiles.filter(file => !hasRawScheduleRows(file));
  const rawWith = oracleFiles.filter(hasRawScheduleRows);
  const without = oracleFiles.filter(file => !hasAddressableScheduleRows(file));
  const addressable = oracleFiles.filter(hasAddressableScheduleRows);

  const allScheduleTables = scanned
    .map(file => file.rawScan.tables.get('SCHEDOPTIONS'))
    .filter((table): table is RawXerTable => table !== undefined);
  const derivedRows: IndependentXerScheduleExpected[] = [];
  for (const file of scanned) {
    for (const projectId of file.rawScan.projectRowIndexesById.keys()) {
      if ((file.rawScan.scheduleRowIndexesById.get(projectId)?.length ?? 0) > 0) {
        derivedRows.push(expectedXerScheduleOptions(file.rawScan, projectId));
      }
    }
  }
  const union = [...new Set(allScheduleTables.flatMap(table => table.fields))].sort();
  const scheduleRows = allScheduleTables.flatMap(table => table.rows);
  const normalizedCount = (field: string, token: string): number => scheduleRows.filter(row =>
    row.cells[field]?.trim().toUpperCase() === token).length;

  const fidelity: BlastRadiusBaseline['fidelity'] = {
    house: emptyCounters(),
    xerDefaults: emptyCounters(),
    defaults: Object.fromEntries(DEFAULT_KEYS.map(key => [key, {
      chosen: emptyCounters(),
      counterfactual: emptyCounters(),
    }])) as BlastRadiusBaseline['fidelity']['defaults'],
  };

  // X7-reviewpunt 4: een eigen corpusbaan over ALLE dossiers met een fidelity-as, dus niet alleen
  // de functioneel SCHEDOPTIONS-loze defaultpopulatie hieronder en ook niet de gecombineerde
  // xerDefaults-vector. De gekozen baan zet uitsluitend expected-finish aan; de tegenvariant
  // uitsluitend uit. Richtingsdigest bevat before/after en wordt daardoor rood als beide vlaggen
  // worden verwisseld, ook wanneer de symmetrische bewegingsteller gelijk blijft.
  const expectedOccurrences = new Map<string, number>();
  const expectedFiles: ExpectedFinishVariantFile[] = [];
  const expectedMovement = Array(BLAST_AXES.length).fill(0) as AxisVector;
  const expectedFidelity = { chosen: emptyCounters(), counterfactual: emptyCounters() };
  let expectedReadableFiles = 0;
  let expectedDeferredFiles = 0;
  let expectedProjects = 0;
  let expectedTasks = 0;
  let expectedSourceTasks = 0;
  let expectedActiveSourceTasks = 0;
  for (const file of [...oracleFiles].sort((a, b) =>
    a.fullHash.localeCompare(b.fullHash) || a.path.localeCompare(b.path))) {
    const occurrence = (expectedOccurrences.get(file.fullHash) ?? 0) + 1;
    expectedOccurrences.set(file.fullHash, occurrence);
    const id = `${file.fullHash.slice(0, 16)}-${occurrence}`;
    const fileIsOracle = manifestOracle(root, file.path, file.fullHash);
    let importedProjects: ImportResult[];
    try {
      const opened = readXER(file.bytes);
      importedProjects = isMultiDocumentImport(opened) ? opened.results : [opened];
    } catch {
      expectedDeferredFiles++;
      continue;
    }
    expectedReadableFiles++;
    expectedProjects += importedProjects.length;
    const openedProjectIds = new Set(importedProjects.map(imported => imported.project.id));
    const openedTruth: XerGroundTruth = {
      ...file.truth,
      projects: new Set([...file.truth.projects].filter(projectId => openedProjectIds.has(projectId))),
      tasks: file.truth.tasks.filter(task => openedProjectIds.has(task.projectId)),
    };
    expectedTasks += openedTruth.tasks.length;
    const sourceTasks = (file.rawScan.tables.get('TASK')?.rows ?? []).filter(row =>
      openedProjectIds.has(row.cells.proj_id?.trim() ?? '')
      && (row.cells.expect_end_date?.trim() ?? '') !== '').length;
    expectedSourceTasks += sourceTasks;
    const activeSourceTasks = importedProjects.flatMap(imported => imported.tasks).filter(task =>
      task.p6ExpectedFinish !== undefined
      && task.status === 'STARTED'
      && task.time.completion > 0
      && task.time.completion < 1).length;
    expectedActiveSourceTasks += activeSourceTasks;
    const chosen = importedProjects.map(imported => projectResult(imported, {
      schedulingOptions: { useExpectedFinishDates: EXPECTED_FINISH_SELECTION.chosen },
    }));
    const counterfactual = importedProjects.map(imported => projectResult(imported, {
      schedulingOptions: { useExpectedFinishDates: EXPECTED_FINISH_SELECTION.counterfactual },
    }));
    const movement = movementProjects(counterfactual, chosen);
    movement.forEach((value, index) => { expectedMovement[index] += value; });
    const details = movementDetails(counterfactual, chosen);
    for (const [variant, solved] of [
      ['chosen', chosen],
      ['counterfactual', counterfactual],
    ] as const) {
      const measured = measureXerFidelity(openedTruth, solved);
      if (measured.errors.length > 0) throw new Error(`${id}: expected-finish ${variant}-uitlijning mislukt`);
      // Fidelity alleen op manifest-orakels (zie `manifestOracle`); de uitlijning blijft corpusbreed.
      if (fileIsOracle) addCounters(expectedFidelity[variant], measured.counters);
    }
    if (sourceTasks > 0 || details.length > 0) {
      expectedFiles.push({
        id,
        tasks: openedTruth.tasks.length,
        sourceTasks,
        activeSourceTasks,
        movement,
        directionChanges: details.length,
        directionDigest: hash(new TextEncoder().encode(JSON.stringify(details))),
      });
    }
  }
  const expectedFinishVariant: ExpectedFinishVariantBaseline = {
    selection: EXPECTED_FINISH_SELECTION,
    population: {
      oracleFiles: oracleFiles.length,
      readableFiles: expectedReadableFiles,
      deferredFiles: expectedDeferredFiles,
      projects: expectedProjects,
      tasks: expectedTasks,
      sourceTasks: expectedSourceTasks,
      activeSourceTasks: expectedActiveSourceTasks,
      sourceFiles: expectedFiles.filter(file => file.sourceTasks > 0).length,
      movingFiles: expectedFiles.filter(file => file.movement.some(Boolean)).length,
    },
    movement: expectedMovement,
    files: expectedFiles,
    fidelity: expectedFidelity,
  };

  const occurrences = new Map<string, number>();
  const files: MeasuredFile[] = [];
  let openedProjectsWithDefaults = 0;
  let wiredProjectsWithDefaults = 0;
  let concreteProjectsCompared = 0;
  for (const file of oracleFiles) {
    let importedProjects: ImportResult[];
    try {
      const opened = readXER(file.bytes);
      importedProjects = isMultiDocumentImport(opened) ? opened.results : [opened];
    } catch {
      continue;
    }
    const archives = importedProjects.map(imported => imported.xer?.scheduleOptions.sourceArchive);
    if (!archives.every(archive => archive === archives[0])) {
      throw new Error(`${file.path}: SCHEDOPTIONS-bronarchief is per document gekopieerd`);
    }
    if (JSON.stringify(archives[0]) !== JSON.stringify(file.rawScan.sourceArchive)) {
      throw new Error(`${file.path}: bestandsbreed raw-bronarchief wijkt af van het onafhankelijke orakel`);
    }
    for (const imported of importedProjects) {
      const expected = expectedXerScheduleOptions(file.rawScan, imported.project.id, {
        taskCount: imported.tasks.filter(task => task.p6ActivityType !== undefined).length,
      });
      const actualMetadata = imported.xer?.scheduleOptions;
      // Rekenprofielen C4: de conventies staan in het profiel; vergeleken als opgeloste set in de
      // sleutelvolgorde van de onafhankelijke hand-lijst.
      const resolved = resolveConventions(imported.project.schedulingProfile);
      const actual = {
        progressMode: imported.project.progressMode,
        schedulingOptions: imported.project.schedulingOptions,
        conventions: Object.fromEntries(Object.keys(expected.conventions).map(key => [key, resolved[key as ConventionKey]])),
        source: actualMetadata?.source,
        retainedSource: actualMetadata?.retainedSource,
        fallbacks: actualMetadata?.fallbacks,
        diagnostics: actualMetadata?.diagnostics,
        sourceRowIndexes: actualMetadata?.sourceRowIndexes,
        sourceRows: actualMetadata?.sourceRows,
      };
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${file.path}/${imported.project.id}: concrete SCHEDOPTIONS-afleiding wijkt af`);
      }
      concreteProjectsCompared++;
    }
  }
  for (const file of [...without].sort((a, b) =>
    a.fullHash.localeCompare(b.fullHash) || a.path.localeCompare(b.path))) {
    const occurrence = (occurrences.get(file.fullHash) ?? 0) + 1;
    occurrences.set(file.fullHash, occurrence);
    const id = `${file.fullHash.slice(0, 16)}-${occurrence}`;
    // Fidelity alleen op manifest-orakels. Een bestand zonder SCHEDOPTIONS-rij is per definitie niet
    // aantoonbaar door P6 doorgerekend (SCHEDOPTIONS is een van de drie kenmerken), dus met de huidige
    // populatie telt hier niets mee: 0 meetbaar, verwacht en gepind. Detectie, bedrading en de
    // bewegingsvectoren blijven corpusbreed — die zijn karakterisering (herpinbaar), geen ratchet.
    const fileIsOracle = manifestOracle(root, file.path, file.fullHash);
    let oracleNegativeFloatTasks = file.truth.tasks.filter(taskHasNegativeFloat).length;
    let importedProjects: ImportResult[];
    try {
      const opened = readXER(file.bytes);
      importedProjects = isMultiDocumentImport(opened) ? opened.results : [opened];
    } catch (error) {
      files.push({
        id,
        state: 'deferred',
        tasks: file.truth.tasks.length,
        oracleNegativeFloatTasks,
        deferredCode: deferredCode(error),
      });
      continue;
    }

    // X4b kan aanwezige baselineprojecten bewust niet als document openen. De blast-radius meet
    // daarom alle WERKELIJK geopende projecten uit dit bestand en filtert de onafhankelijke
    // grondwaarheid op exact die ids; zo blijft de uitlijning per project zonder terug te vallen
    // op één willekeurig actief document.
    const openedProjectIds = new Set(importedProjects.map(imported => imported.project.id));
    const openedTruth: XerGroundTruth = {
      ...file.truth,
      projects: new Set([...file.truth.projects].filter(projectId => openedProjectIds.has(projectId))),
      tasks: file.truth.tasks.filter(task => openedProjectIds.has(task.projectId)),
    };
    oracleNegativeFloatTasks = openedTruth.tasks.filter(taskHasNegativeFloat).length;
    // Gebruik ook hier het onafhankelijke PROJECT/SCHEDOPTIONS-orakel. De oude lokale subset
    // controleerde slechts zeven publieke opties en verklaarde daardoor iedere correct bedrade
    // XER-defaultset met interne bronsemantiek ten onrechte als "niet bedraad". Dit pad leest
    // nog steeds uitsluitend raw tabellen; het importeert geen productie-afleiding.
    const xerDefaultsExpected = importedProjects.map(imported =>
      expectedXerScheduleOptions(file.rawScan, imported.project.id, {
        taskCount: imported.tasks.filter(task => task.p6ActivityType !== undefined).length,
      }));
    // Rekenprofielen C4: de solvervariant draagt opties + opgeloste conventies als één legacy-blob
    // mét bronmarkering, zodat `legacyEffective` exact het verwachte P6-profiel oplevert.
    const xerDefaultsVariants = xerDefaultsExpected.map(expected => ({
      progressMode: expected.progressMode,
      schedulingOptions: { p6Source: 'XER', ...expected.schedulingOptions, ...expected.conventions } as LegacySchedulingOptions,
    }));
    openedProjectsWithDefaults += importedProjects.length;
    wiredProjectsWithDefaults += importedProjects.filter((imported, index) => {
      const resolved = resolveConventions(imported.project.schedulingProfile);
      const expected = xerDefaultsExpected[index];
      return JSON.stringify({
        progressMode: imported.project.progressMode,
        schedulingOptions: imported.project.schedulingOptions,
        conventions: Object.fromEntries(Object.keys(expected.conventions).map(key => [key, resolved[key as ConventionKey]])),
        source: imported.xer?.scheduleOptions.source,
      }) === JSON.stringify({
        progressMode: expected.progressMode,
        schedulingOptions: expected.schedulingOptions,
        conventions: expected.conventions,
        source: expected.source,
      });
    }).length;
    const house = importedProjects.map(imported => projectResult(imported, {}));
    const houseMeasurement = measureXerFidelity(openedTruth, house);
    if (houseMeasurement.errors.length > 0) throw new Error(`${id}: fidelity-uitlijning mislukt`);
    if (fileIsOracle) addCounters(fidelity.house, houseMeasurement.counters);

    const xerDefaults = importedProjects.map((imported, index) => projectResult(imported, {
      progressMode: xerDefaultsVariants[index].progressMode,
      schedulingOptions: xerDefaultsVariants[index].schedulingOptions,
    }));
    const xerDefaultsFidelity = measureXerFidelity(openedTruth, xerDefaults);
    if (xerDefaultsFidelity.errors.length > 0) {
      throw new Error(`${id}: gecombineerde-XER-defaultuitlijning mislukt`);
    }
    if (fileIsOracle) addCounters(fidelity.xerDefaults, xerDefaultsFidelity.counters);
    if (report === 'details' && id === '2a7732b5b99de2a5-1') {
      console.log(`XER-DETAILS ${JSON.stringify(movementDetails(house, xerDefaults))}`);
    }

    const defaultMeasurements = {} as Record<DefaultKey, DefaultMeasurement>;
    for (const key of DEFAULT_KEYS) {
      const chosen = importedProjects.map((imported, index) => projectResult(
        imported,
        variantDefinitions(xerDefaultsVariants[index].schedulingOptions?.criticalDefinition)[key].chosen,
      ));
      const counterfactual = importedProjects.map((imported, index) => projectResult(
        imported,
        variantDefinitions(
          xerDefaultsVariants[index].schedulingOptions?.criticalDefinition,
        )[key].counterfactual,
      ));
      defaultMeasurements[key] = {
        chosenNegativeFloatTasks: negativeFloatTasks(chosen),
        counterfactualNegativeFloatTasks: negativeFloatTasks(counterfactual),
      };
      if (id === '2a7732b5b99de2a5-1' && key === 'preserveActualDates') {
        const counterfactualToChosen = movementDetails(counterfactual, chosen);
        eq('torture per-taak/orakelpin: preserveActualDates false→true beweegt exact 15 late starts',
          lateStartPin(counterfactualToChosen), TORTURE_PRESERVE_ACTUAL_LS_PIN);
        eq('torture causaliteit: gecombineerde XER-defaultbeweging op late start is exact dezelfde X5-mutatie',
          lateStartPin(movementDetails(house, xerDefaults)), TORTURE_PRESERVE_ACTUAL_LS_PIN);
      }
      for (const [variant, solved] of [
        ['chosen', chosen],
        ['counterfactual', counterfactual],
      ] as const) {
        const measured = measureXerFidelity(openedTruth, solved);
        if (measured.errors.length > 0) throw new Error(`${id}: ${variant}-uitlijning mislukt`);
        if (fileIsOracle) addCounters(fidelity.defaults[key][variant], measured.counters);
      }
    }
    files.push({
      id,
      state: 'measured',
      tasks: openedTruth.tasks.length,
      oracleNegativeFloatTasks,
      houseNegativeFloatTasks: negativeFloatTasks(house),
      xerDefaultsNegativeFloatTasks: negativeFloatTasks(xerDefaults),
      defaults: defaultMeasurements,
    });
  }

  return {
    version: 10,
    axes: BLAST_AXES,
    defaults: DEFAULT_KEYS,
    deferredDefaults: DEFERRED_DEFAULTS,
    population: {
      scanned: scanned.length,
      oracleAxisFiles: oracleFiles.length,
      rawWithSchedOptions: rawWith.length,
      rawWithoutSchedOptions: rawWithout.length,
      projectAddressableSchedOptions: addressable.length,
      functionallyWithoutSchedOptions: without.length,
      measured: files.filter(file => file.state === 'measured').length,
      deferred: files.filter(file => file.state === 'deferred').length,
      readableFiles: files.filter(file => file.state === 'measured').length,
      openedProjectsWithDefaults,
      wiredProjectsWithDefaults,
      concreteProjectsCompared,
      oracleNegativeFloatFiles: oracleFiles.filter(file => file.truth.tasks.some(taskHasNegativeFloat)).length,
      withoutSchedOptionsNegativeFloatFiles: without.filter(file => file.truth.tasks.some(taskHasNegativeFloat)).length,
      rawNegativeFloatFiles: scanned.filter(file => hasRawNegativeFloat(file.bytes)).length,
      rawWithoutSchedOptionsNegativeFloatFiles: scanned.filter(file =>
        !hasAddressableScheduleRows(file) && hasRawNegativeFloat(file.bytes)).length,
    },
    schedOptionsRows: {
      rows: scheduleRows.length,
      floatFinish: normalizedCount('sched_float_type', 'FT_FF'),
      retainedLogic: normalizedCount('sched_retained_logic', 'Y'),
      openEndedNotCritical: normalizedCount('sched_open_critical_flag', 'N'),
      predecessorLagCalendar: normalizedCount('sched_calendar_on_relationship_lag', 'RCAL_PREDECESSOR'),
      projectEndForFloat: normalizedCount('sched_use_project_end_date_for_float', 'Y'),
      expectedFinishDates: normalizedCount('sched_use_expect_end_flag', 'Y'),
      lagFromEarlyStart: normalizedCount('sched_lag_early_start_flag', 'Y'),
      progressOverride: normalizedCount('sched_progress_override', 'Y'),
      unknownFloatDialect: normalizedCount('sched_float_type', 'ST_TOTALFLOAT'),
      derivedRows: derivedRows.length,
      derivedFallbacks: derivedRows.reduce((sum, result) => sum + result.fallbacks.length, 0),
      derivedFloatDialectFallbacks: derivedRows.reduce((sum, result) => sum
        + result.fallbacks.filter(item => item.field === 'sched_float_type').length, 0),
      // X12-brok 1: `Y` zonder PROJECT.plan_end_date en zonder één TASK.target_end_date ⇒ terugval N.
      derivedNoProjectEndFallbacks: derivedRows.reduce((sum, result) => sum
        + result.fallbacks.filter(item => item.field === 'sched_use_project_end_date_for_float').length, 0),
      derivedRetainedLogic: derivedRows.filter(result => result.progressMode === 'RETAINED_LOGIC').length,
      derivedProgressOverride: derivedRows.filter(result => result.progressMode === 'PROGRESS_OVERRIDE').length,
      derivedFinishFloat: derivedRows.filter(result => result.schedulingOptions.totalFloatMode === 'finish').length,
      derivedLagPredecessor: derivedRows.filter(result => result.schedulingOptions.lagCalendar === 'predecessor').length,
      derivedLagSuccessor: derivedRows.filter(result => result.schedulingOptions.lagCalendar === 'successor').length,
      derivedLag24Hour: derivedRows.filter(result => result.schedulingOptions.lagCalendar === '24hour').length,
      derivedLagProjectDefault: derivedRows.filter(result =>
        result.schedulingOptions.lagCalendar === 'projectDefault').length,
      retainedProjectEndValues: derivedRows.filter(result =>
        result.retainedSource.sched_use_project_end_date_for_float !== undefined).length,
    },
    corpusUnion: union,
    files,
    expectedFinishVariant,
    fidelity,
  };
}

if (!existsSync(baselinePath)) {
  diffs.push('blast-radiusbaseline ontbreekt');
} else {
  const committed = JSON.parse(readFileSync(baselinePath, 'utf8')) as BlastRadiusBaseline;
  eq('baselineversie en asvolgorde', { version: committed.version, axes: committed.axes }, {
    version: 10,
    axes: BLAST_AXES,
  });
  eq('baseline bevat alle defaults los van elkaar', committed.defaults, DEFAULT_KEYS);
  eq('geen geïmplementeerde XER-default staat nog als uitstel geregistreerd',
    committed.deferredDefaults, DEFERRED_DEFAULTS);
  eq('baseline pint exact de 36 functioneel SCHEDOPTIONS-loze bestanden', committed.files.length, 36);
  eq('baseline bevat alleen hash-identiteiten',
    committed.files.every(file => /^[0-9a-f]{16}-\d+$/.test(file.id)), true);
  eq('iedere gemeten bestandregel pint iedere default als eigen gekozen/tegenvariant',
    committed.files.filter(file => file.state === 'measured').every(file =>
      JSON.stringify(Object.keys(file.defaults ?? {})) === JSON.stringify(DEFAULT_KEYS)), true);
  eq('iedere gemeten bestandregel draagt de gecombineerde XER-defaultset (negatieve-floattelling)',
    committed.files.filter(file => file.state === 'measured').every(file =>
      typeof file.xerDefaultsNegativeFloatTasks === 'number'), true);
  // Fixronde critreview integratie-eindstand (2026-09-23, orkestratorbesluit): de bewegingsvectoren
  // (`files[].xerDefaultsMovement`, `files[].defaults[].movement`), de 0-projectie
  // (`causalProductEffects`, 72× 0) en het `fidelity`-blok zijn uit de pin gehaald — ze werden niet
  // vergeleken (mutant 0 → 99999 bleef groen) en maten P3-/generatorbestanden, geen P6-getrouwheid.
  // Deze regel voorkomt dat ze via een `OPS_XER_SCHEDOPTIONS_REPORT=baseline`-kopie terugsluipen.
  eq('geen dode pinnen: geen bewegingsvectoren, 0-projectie of fidelity-blok in het gecommitte bestand', {
    top: ['causalProductEffects', 'fidelity'].filter(key => key in committed),
    movement: committed.files.filter(file => 'xerDefaultsMovement' in file
      || Object.values(file.defaults ?? {}).some(value => 'movement' in value)).map(file => file.id),
  }, { top: [], movement: [] });
  // v10: de negatieve-floatvelden in `files[]` zijn geen vormpin meer maar worden mét corpus per
  // bestand tegen de meting vergeleken; deze regel eist dat ze op iedere gemeten regel bestaan.
  eq('v10: iedere gemeten bestandregel draagt alle negatieve-floatvelden die tegen de meting vergeleken worden',
    committed.files.filter(file => file.state === 'measured').every(file =>
      typeof file.houseNegativeFloatTasks === 'number'
      && Object.values(file.defaults ?? {}).every(value =>
        typeof value.chosenNegativeFloatTasks === 'number'
        && typeof value.counterfactualNegativeFloatTasks === 'number')), true);
  eq('expectedFinishDates heeft een zelfstandige gekozen/tegenvariant-corpuspin',
    typeof committed.expectedFinishVariant === 'object'
    && Array.isArray(committed.expectedFinishVariant?.files)
    && committed.expectedFinishVariant?.movement.length === BLAST_AXES.length, true);
  eq('historisch ontbrekend-duration-type-dossier blijft als zodanig herkenbaar',
    Array.isArray(committed.legacyDurationTypeHistoricalDelta)
    && committed.legacyDurationTypeHistoricalDelta.length > 0, true);
}

const root = process.env.OPS_XER_CORPUS;
if (!root) {
  console.log('OK  XER-SCHEDOPTIONS-corpus: corpus niet aanwezig; committe pins structureel gecontroleerd');
} else if (!existsSync(root)) {
  diffs.push('OPS_XER_CORPUS bestaat niet');
} else {
  const measured = measureCorpus(root);
  eq('onafhankelijke X12-orakelvorm pint alleen raw/scanner-populatie en negatieve-floatverdeling',
    independentOraclePopulation(measured.population), {
    scanned: 93,
    // De rauwe X12-meetlat normaliseert completed taken niet meer naar actuals. Twee bestanden
    // die uitsluitend via die oude substitutie een as leken te dragen vallen daarom bewust uit
    // deze SCHEDOPTIONS-populatie; de historische v8-pin blijft afzonderlijk rood en ongemoeid.
    oracleAxisFiles: 58,
    rawWithSchedOptions: 23,
    rawWithoutSchedOptions: 35,
    projectAddressableSchedOptions: 22,
    functionallyWithoutSchedOptions: 36,
    oracleNegativeFloatFiles: 5,
    withoutSchedOptionsNegativeFloatFiles: 4,
    rawNegativeFloatFiles: 6,
    rawWithoutSchedOptionsNegativeFloatFiles: 5,
  });
  eq('productafgeleide populatie pint alleen reader-, wiring- en projectvergelijkingstellers',
    productDerivedPopulation(measured.population), {
      measured: 34,
      deferred: 2,
      readableFiles: 34,
      openedProjectsWithDefaults: 35,
      wiredProjectsWithDefaults: 35,
      concreteProjectsCompared: 70,
    });
  eq('meerderheidsinstellingen worden uit alle 50 tabelrijen herleid', measured.schedOptionsRows, {
    rows: 50,
    floatFinish: 41,
    retainedLogic: 48,
    openEndedNotCritical: 48,
    predecessorLagCalendar: 44,
    projectEndForFloat: 39,
    expectedFinishDates: 48,
    lagFromEarlyStart: 40,
    progressOverride: 1,
    unknownFloatDialect: 8,
    derivedRows: 49,
    // X12-brok 1: +16 terugvallen `sched_use_project_end_date_for_float` Y ⇒ N (geen enkel einde in de
    // bron: de dertien cases-import.xer-projecten en drie taakloze OZB-projecten) — samen 8 + 16.
    derivedFallbacks: 24,
    derivedFloatDialectFallbacks: 8,
    derivedNoProjectEndFallbacks: 16,
    derivedRetainedLogic: 48,
    derivedProgressOverride: 1,
    derivedFinishFloat: 49,
    derivedLagPredecessor: 44,
    derivedLagSuccessor: 3,
    derivedLag24Hour: 1,
    derivedLagProjectDefault: 1,
    retainedProjectEndValues: 47,
  });
  eq('exact twee functioneel SCHEDOPTIONS-loze bestanden blijven typed uitgesteld',
    measured.files.filter(file => file.state === 'deferred').map(file => file.deferredCode).sort(),
    ['XER_DANGLING_LOCAL_RELATION', 'XER_INVALID_FILE']);
  eq('de onafhankelijke ruwe SCHEDOPTIONS-scan vindt exact 27 kolommen',
    measured.corpusUnion.length, 27);
  eq('de 27-kolommenunion is exact de productieclassificatiematrix', measured.corpusUnion,
    XER_SCHEDOPTIONS_COLUMN_DISPOSITIONS.map(item => item.field).sort());

  if (report === 'baseline') {
    // Zonder `fidelity`: dat is alleen de bron van de struikeldraad hieronder, geen pin.
    const pinned: Partial<BlastRadiusBaseline> = { ...measured };
    delete pinned.fidelity;
    console.log(JSON.stringify(pinned));
  } else if (existsSync(baselinePath)) {
    const committed = JSON.parse(readFileSync(baselinePath, 'utf8')) as BlastRadiusBaseline;
    // v10 (hercheck 2026-09-23): `files[]` — incl. `xerDefaultsNegativeFloatTasks` en
    // `defaults[*].chosen/counterfactualNegativeFloatTasks` — werd alleen op vorm gecontroleerd
    // (mutant 99999 bleef groen). Nu per bestand exact tegen de meting.
    const measuredById = new Map(measured.files.map(file => [file.id, file]));
    for (const file of committed.files) {
      eq(`files[${file.id}] (state, taken, negatieve-floattellingen per defaultset) exact als gemeten`,
        measuredById.get(file.id), file);
    }
    eq('files[]-identiteiten exact als gemeten',
      measured.files.map(file => file.id).sort(), committed.files.map(file => file.id).sort());
    // Herpin 2026-09-23 (populatie, tweede toepassing van het besluit van 2026-09-23: de vier
    // DCP-03-Baseline-kopieën zijn generatoruitvoer → reader-only): alleen `expectedFinishVariant.fidelity`
    // (manifest-orakels) beweegt — measurable −240 per as (4 × 60), deviations es 2559 → 2331,
    // ef 2534 → 2298, ls 655 → 419, lf 846 → 606, tf 2932 → 2888, ff 1139 → 1059; chosen en
    // counterfactual gelijk. Detectie-/populatietellers en files[] ongewijzigd.
    eq('expectedFinishDates zelfstandige per-bestand/as/populatie en richting blijven exact gepind',
      measured.expectedFinishVariant, committed.expectedFinishVariant);
    // Herpin 2026-09-05 (X-O7 laag 1, klasse (i) — `p6CompletedLateFromRemainingWindow`), gemeten
    // over de hele corpusunie: `xerDefaults` ls 4791 → 3901, lf 4781 → 3891, tf 4592 → 4235
    // (es/ef/ff ongewijzigd). Netto −2.137 afwijkende cellen, volledig toe te schrijven aan één
    // corpusbestand (rehab-2): de late zijde van voltooide activiteiten volgt nu het
    // statusdatumvenster in plaats van de rauwe actual-pin. De tf-winst is NETTO: per cel gemeten
    // op rehab-2 worden 572 tf-cellen exact en 215 eerder exacte tf-cellen fout — alle 215 zijn
    // voltooide taken waar P6 `tf = 0` geeft en onze afgeleide LS nog van een zelf foute
    // opvolger-LS komt (diagnose laag 1, klasse (ii)); vóór deze etappe was hun `tf = 0`
    // degeneratie (LS = de historische actual-start), dus per ongeluk goed. Zie het baanrapport en
    // het docblok bij `p6CompletedLateFromRemainingWindow` in `types/project.ts`.
    // Herpin 2026-09-23 (X12 brok 2, conventies C1–C3; bij de brok-2-herpin vergeten, opgevangen in
    // de fixronde): alleen de `xerDefaults`-rijen bewegen, alle zes assen omlaag — es 1384 → 887,
    // ef 1414 → 917, ls 3353 → 3231, lf 3351 → 3229, tf 3868 → 3494, ff 303 → 88. `house` en de
    // completedProgress-rijen (chosen/counterfactual) zijn byte-identiek; bijgewerkt in het JSON-bestand:
    // `fidelity.xerDefaults`, `files[rehab-2].xerDefaultsMovement` en deze projectie.
    // Herpin 2026-09-23 (X12 brok 3, C4 + C5 + C6, na de merge van de brok-2-fixronde): opnieuw alleen
    // `xerDefaults` — es 887 → 452, ef 917 → 482, tf 3494 → 3196, ff 88 → 47; ls/lf ongewijzigd (3231/
    // 3229). rehab-2 xerDefaultsMovement [3714, 3563, 3325, 3433, 4395, 2251, 70] → [4001, 3894, 3325,
    // 3433, 4675, 2268, 70]. `house` en completedProgress byte-identiek. Overgenomen uit
    // `OPS_XER_SCHEDOPTIONS_REPORT=baseline` (alleen deze drie plekken).
    // Herpin 2026-09-23 (populatiewijziging van deze pin, geen omhoog-herpin; orkestratorbesluit (b)
    // na de critreview van de manifest-etappe): de fidelity-afwijkingen tellen alleen nog op manifest-
    // orakels (`manifestOracle`). De xerDefaults-/house-/defaults-populatie (bestanden ZONDER SCHEDOPTIONS-
    // rij) bevat geen enkel manifest-orakel — SCHEDOPTIONS is een van de drie P6-kenmerken — dus die
    // tellers zijn nu 0 meetbaar, verwacht en hieronder expliciet gepind. Oude telling (alle 36 bestanden,
    // o.a. rehab-2 = P3-uitvoer): xerDefaults es 452, ef 482, ls 3231, lf 3229, tf 3196, ff 47 (meetbaar
    // 7637/7649/7519/7510/7602/7221); house es 4557, ef 4391, ls 5280, lf 5317, tf 6233, ff 2314. Nieuw:
    // alles 0/0. expected-finish-fidelity idem alleen op de 13 manifest-orakels (meetbaar es 18524 →
    // 10358 e.d.; chosen = counterfactual). De bewegingsvectoren (`files[].xerDefaultsMovement`, de
    // defaults-movement) blijven corpusbreed als KARAKTERISERING: herpinbaar, geen ratchet, want de
    // "afwijking t.o.v. P6" van een bestand zonder SCHEDOPTIONS is geen meetlat. Ze bewogen hier door C1/C4
    // uit (rehab-2 [4001, 3894, 3325, 3433, 4675, 2268, 70] → [3228, 3066, 3325, 3433, 3938, 2217, 70]).
    // Op de P6-populatie waren de xerDefaults-afwijkingen al 0 meetbaar, dus daar niets omhoog.
    // Herpin 2026-09-23 (fixronde critreview integratie-eindstand): bewegingsvectoren, de
    // `causalProductEffects`-projectie en `fidelity` zijn uit het gecommitte bestand gehaald (zie de
    // structuurregel "geen dode pinnen" hierboven). Wat blijft is deze STRUIKELDRAAD: zodra er een
    // manifest-orakel zonder SCHEDOPTIONS-rij bijkomt, wordt een van deze tellers > 0 en de regel rood —
    // dan hoort er een echte meetlat bij, geen karakterisering.
    eq('defaults-fidelity telt alleen op manifest-orakels: 0 meetbaar (verwacht; geen orakel zonder SCHEDOPTIONS)',
      (['house', 'xerDefaults'] as const).map(branch => FIDELITY_AXES.map(axis => measured.fidelity[branch][axis].measurable)),
      [FIDELITY_AXES.map(() => 0), FIDELITY_AXES.map(() => 0)]);
  }
}

if (diffs.length > 0) {
  console.error(`XER-SCHEDOPTIONS-corpus: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-SCHEDOPTIONS-corpus: ${checks} checks groen`);
