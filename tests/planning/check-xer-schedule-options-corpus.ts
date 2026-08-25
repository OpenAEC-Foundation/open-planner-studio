import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloneTasksForSolve, solveProject } from '@/engine/scheduler/solveProject';
import { readXER } from '@/services/xer/xerReader';
import {
  deriveXerScheduleOptions,
  XER_SCHEDOPTIONS_COLUMN_DISPOSITIONS,
  type XerScheduleOptionsResult,
} from '@/services/xer/xerScheduleOptions';
import { parseXerTables, XerImportError } from '@/services/xer/xerTables';
import type { ProgressMode, SchedulingOptions } from '@/types/project';
import type { Task } from '@/types/task';
import {
  measureXerFidelity,
  type XerSolvedProject,
  type XerSolvedTask,
} from './xerFidelity';
import {
  scanXerGroundTruth,
  XER_FIDELITY_AXES,
  type XerFidelityAxis,
  type XerGroundTruth,
} from './xerGroundTruth';
import { emptyCounters, type XerFidelityCounters } from './xerFidelityTypes';

type AxisVector = [number, number, number, number, number, number];
type DefaultKey =
  | 'totalFloatFinish'
  | 'retainedLogic'
  | 'openEndedNotCritical'
  | 'predecessorLagCalendar'
  | 'projectEndForFloat'
  | 'expectedFinishDates'
  | 'preserveActualDates'
  | 'clampNegativeFreeFloat'
  | 'projectCriticalDefinition';

const DEFAULT_KEYS: readonly DefaultKey[] = [
  'totalFloatFinish',
  'retainedLogic',
  'openEndedNotCritical',
  'predecessorLagCalendar',
  'projectEndForFloat',
  'expectedFinishDates',
  'preserveActualDates',
  'clampNegativeFreeFloat',
  'projectCriticalDefinition',
];

interface SolverVariant {
  progressMode?: ProgressMode;
  schedulingOptions?: SchedulingOptions;
}

interface DefaultMeasurement {
  /** Aantal taakwaarden dat per X1-as verandert van de tegenvariant naar de gekozen XER-default. */
  movement: AxisVector;
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
  xerDefaultsMovement?: AxisVector;
  xerDefaultsNegativeFloatTasks?: number;
  defaults?: Record<DefaultKey, DefaultMeasurement>;
}

interface BlastRadiusBaseline {
  version: 5;
  axes: readonly XerFidelityAxis[];
  defaults: readonly DefaultKey[];
  population: {
    scanned: number;
    oracleAxisFiles: number;
    withSchedOptions: number;
    withoutSchedOptions: number;
    measured: number;
    deferred: number;
    oracleNegativeFloatFiles: number;
    withoutSchedOptionsNegativeFloatFiles: number;
    rawNegativeFloatFiles: number;
    rawWithoutSchedOptionsNegativeFloatFiles: number;
  };
  schedOptionsRows: {
    rows: number;
    parserRejectedWithoutSchedOptions: number;
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
    derivedRetainedLogic: number;
    derivedProgressOverride: number;
    derivedFinishFloat: number;
    derivedLagPredecessor: number;
    derivedLagSuccessor: number;
    derivedLag24Hour: number;
    derivedLagProjectDefault: number;
  };
  corpusUnion: string[];
  files: MeasuredFile[];
  fidelity: {
    house: XerFidelityCounters;
    xerDefaults: XerFidelityCounters;
    defaults: Record<DefaultKey, {
      chosen: XerFidelityCounters;
      counterfactual: XerFidelityCounters;
    }>;
  };
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

function hasScheduleTableMarker(bytes: Uint8Array): boolean {
  return /^%T\tSCHEDOPTIONS\s*$/m.test(decodedForTableMarker(bytes));
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

function solvedTaskAxis(task: XerSolvedTask, axis: XerFidelityAxis): string | number | undefined {
  switch (axis) {
    case 'es': return task.earlyStart;
    case 'ef': return task.earlyFinish;
    case 'ls': return task.lateStart;
    case 'lf': return task.lateFinish;
    case 'tf': return task.totalFloatMinutes;
    case 'ff': return task.freeFloatMinutes;
  }
}

function movement(before: XerSolvedProject, after: XerSolvedProject): AxisVector {
  const afterById = new Map(after.tasks.map(task => [task.sourceTaskId, task]));
  return XER_FIDELITY_AXES.map(axis => before.tasks.reduce((sum, task) => {
    const next = afterById.get(task.sourceTaskId);
    return sum + (next && solvedTaskAxis(task, axis) === solvedTaskAxis(next, axis) ? 0 : 1);
  }, 0)) as AxisVector;
}

function negativeFloatTasks(solved: XerSolvedProject): number {
  return solved.tasks.filter(task => (task.totalFloatMinutes ?? 0) < 0).length;
}

function projectResult(
  imported: ReturnType<typeof readXER>,
  variant: SolverVariant,
): XerSolvedProject {
  const tasks = cloneTasksForSolve(imported.tasks);
  const cpm = solveProject({
    tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: variant.progressMode,
    schedulingOptions: variant.schedulingOptions,
    projectStartDate: imported.project.startDate,
  });
  if (cpm.error) throw new Error(cpm.error);
  const calendarById = new Map([
    [imported.calendar.id, imported.calendar],
    ...(imported.resourceCalendars ?? []).map(calendar => [calendar.id, calendar] as const),
  ]);
  const output: XerSolvedTask[] = tasks
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
        totalFloatMinutes: Math.round(task.time.totalFloat * minutesPerDay),
        freeFloatMinutes: Math.round(task.time.freeFloat * minutesPerDay),
      };
    });
  return { projectId: imported.project.id, tasks: output };
}

function variantDefinitions(
  derived: ReturnType<typeof deriveXerScheduleOptions>,
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
    projectEndForFloat: {
      chosen: { schedulingOptions: { useProjectEndDateForFloat: true } },
      counterfactual: { schedulingOptions: { useProjectEndDateForFloat: false } },
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
      chosen: { schedulingOptions: { criticalDefinition: derived.schedulingOptions.criticalDefinition } },
      counterfactual: { schedulingOptions: { criticalDefinition: { mode: 'totalFloat', threshold: 0 } } },
    },
  };
}

function deferredCode(error: unknown): string {
  return error instanceof XerImportError ? error.xerCode : 'UNEXPECTED_IMPORT_ERROR';
}

function measureCorpus(root: string): BlastRadiusBaseline {
  const scanned = listXerFilesRecursive(root).map(path => {
    const bytes = readFileSync(path);
    return { path, bytes, fullHash: hash(bytes), truth: scanXerGroundTruth(bytes) };
  });
  const oracleFiles = scanned.filter(file => hasOracleAxis(file.truth));
  const parsed = oracleFiles.map(file => {
    try {
      return { ...file, tables: parseXerTables(file.bytes) };
    } catch {
      if (hasScheduleTableMarker(file.bytes)) {
        throw new Error(`${file.fullHash.slice(0, 16)}: orakeldrager met SCHEDOPTIONS is niet parseerbaar`);
      }
      return { ...file, tables: null };
    }
  });
  const hasScheduleRows = (file: typeof parsed[number]): boolean =>
    (file.tables?.tables.get('SCHEDOPTIONS')?.rows.length ?? 0) > 0;
  const without = parsed.filter(file => !hasScheduleRows(file));
  const withTable = parsed.filter(hasScheduleRows);

  const allScheduleTables = [];
  const derivedRows: XerScheduleOptionsResult[] = [];
  let parserRejectedWithoutSchedOptions = 0;
  for (const file of scanned) {
    try {
      const tables = parseXerTables(file.bytes);
      const table = tables.tables.get('SCHEDOPTIONS');
      if (table) {
        allScheduleTables.push(table);
        for (const row of table.rows) {
          derivedRows.push(deriveXerScheduleOptions(tables, row.cells.proj_id?.trim() ?? ''));
        }
      }
    } catch {
      if (hasScheduleTableMarker(file.bytes)) {
        throw new Error(`${file.fullHash.slice(0, 16)}: SCHEDOPTIONS-drager is niet parseerbaar`);
      }
      parserRejectedWithoutSchedOptions++;
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

  const occurrences = new Map<string, number>();
  const files: MeasuredFile[] = [];
  for (const file of [...without].sort((a, b) =>
    a.fullHash.localeCompare(b.fullHash) || a.path.localeCompare(b.path))) {
    const occurrence = (occurrences.get(file.fullHash) ?? 0) + 1;
    occurrences.set(file.fullHash, occurrence);
    const id = `${file.fullHash.slice(0, 16)}-${occurrence}`;
    const oracleNegativeFloatTasks = file.truth.tasks.filter(taskHasNegativeFloat).length;
    let imported: ReturnType<typeof readXER>;
    try {
      imported = readXER(file.bytes);
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

    if (!file.tables) throw new Error(`${id}: productie-import slaagde zonder parseerbare tabellen`);
    const derived = deriveXerScheduleOptions(file.tables, imported.project.id, {
      hoursPerDay: imported.calendar.hoursPerDay,
      taskCount: imported.tasks.filter((task: Task) => task.p6ActivityType !== undefined).length,
    });
    const house = projectResult(imported, {});
    const houseMeasurement = measureXerFidelity(file.truth, [house]);
    if (houseMeasurement.errors.length > 0) throw new Error(`${id}: fidelity-uitlijning mislukt`);
    addCounters(fidelity.house, houseMeasurement.counters);

    const xerDefaults = projectResult(imported, {
      progressMode: derived.progressMode,
      schedulingOptions: derived.schedulingOptions,
    });
    const xerDefaultsFidelity = measureXerFidelity(file.truth, [xerDefaults]);
    if (xerDefaultsFidelity.errors.length > 0) {
      throw new Error(`${id}: gecombineerde-XER-defaultuitlijning mislukt`);
    }
    addCounters(fidelity.xerDefaults, xerDefaultsFidelity.counters);

    const defaultMeasurements = {} as Record<DefaultKey, DefaultMeasurement>;
    for (const [key, pair] of Object.entries(variantDefinitions(derived)) as Array<[
      DefaultKey,
      ReturnType<typeof variantDefinitions>[DefaultKey],
    ]>) {
      const chosen = projectResult(imported, pair.chosen);
      const counterfactual = projectResult(imported, pair.counterfactual);
      defaultMeasurements[key] = {
        movement: movement(counterfactual, chosen),
        chosenNegativeFloatTasks: negativeFloatTasks(chosen),
        counterfactualNegativeFloatTasks: negativeFloatTasks(counterfactual),
      };
      for (const [variant, solved] of [
        ['chosen', chosen],
        ['counterfactual', counterfactual],
      ] as const) {
        const measured = measureXerFidelity(file.truth, [solved]);
        if (measured.errors.length > 0) throw new Error(`${id}: ${variant}-uitlijning mislukt`);
        addCounters(fidelity.defaults[key][variant], measured.counters);
      }
    }
    files.push({
      id,
      state: 'measured',
      tasks: file.truth.tasks.length,
      oracleNegativeFloatTasks,
      houseNegativeFloatTasks: negativeFloatTasks(house),
      xerDefaultsMovement: movement(house, xerDefaults),
      xerDefaultsNegativeFloatTasks: negativeFloatTasks(xerDefaults),
      defaults: defaultMeasurements,
    });
  }

  return {
    version: 5,
    axes: XER_FIDELITY_AXES,
    defaults: DEFAULT_KEYS,
    population: {
      scanned: scanned.length,
      oracleAxisFiles: oracleFiles.length,
      withSchedOptions: withTable.length,
      withoutSchedOptions: without.length,
      measured: files.filter(file => file.state === 'measured').length,
      deferred: files.filter(file => file.state === 'deferred').length,
      oracleNegativeFloatFiles: oracleFiles.filter(file => file.truth.tasks.some(taskHasNegativeFloat)).length,
      withoutSchedOptionsNegativeFloatFiles: without.filter(file => file.truth.tasks.some(taskHasNegativeFloat)).length,
      rawNegativeFloatFiles: scanned.filter(file => hasRawNegativeFloat(file.bytes)).length,
      rawWithoutSchedOptionsNegativeFloatFiles: scanned.filter(file =>
        !hasScheduleTableMarker(file.bytes) && hasRawNegativeFloat(file.bytes)).length,
    },
    schedOptionsRows: {
      rows: scheduleRows.length,
      parserRejectedWithoutSchedOptions,
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
      derivedRetainedLogic: derivedRows.filter(result => result.progressMode === 'RETAINED_LOGIC').length,
      derivedProgressOverride: derivedRows.filter(result => result.progressMode === 'PROGRESS_OVERRIDE').length,
      derivedFinishFloat: derivedRows.filter(result => result.schedulingOptions.totalFloatMode === 'finish').length,
      derivedLagPredecessor: derivedRows.filter(result => result.schedulingOptions.lagCalendar === 'predecessor').length,
      derivedLagSuccessor: derivedRows.filter(result => result.schedulingOptions.lagCalendar === 'successor').length,
      derivedLag24Hour: derivedRows.filter(result => result.schedulingOptions.lagCalendar === '24hour').length,
      derivedLagProjectDefault: derivedRows.filter(result =>
        result.schedulingOptions.lagCalendar === 'projectDefault').length,
    },
    corpusUnion: union,
    files,
    fidelity,
  };
}

if (!existsSync(baselinePath)) {
  diffs.push('blast-radiusbaseline ontbreekt');
} else {
  const committed = JSON.parse(readFileSync(baselinePath, 'utf8')) as BlastRadiusBaseline;
  eq('baselineversie en asvolgorde', { version: committed.version, axes: committed.axes }, {
    version: 5,
    axes: XER_FIDELITY_AXES,
  });
  eq('baseline bevat alle defaults los van elkaar', committed.defaults, DEFAULT_KEYS);
  eq('baseline pint exact de 36 actuele bestanden zonder SCHEDOPTIONS', committed.files.length, 36);
  eq('baseline bevat alleen hash-identiteiten',
    committed.files.every(file => /^[0-9a-f]{16}-\d+$/.test(file.id)), true);
  eq('iedere gemeten bestandregel pint iedere default als eigen gekozen/tegenvariant',
    committed.files.filter(file => file.state === 'measured').every(file =>
      JSON.stringify(Object.keys(file.defaults ?? {})) === JSON.stringify(DEFAULT_KEYS)), true);
  eq('iedere gemeten bestandregel pint ook de gecombineerde XER-defaultset',
    committed.files.filter(file => file.state === 'measured').every(file =>
      Array.isArray(file.xerDefaultsMovement)
      && file.xerDefaultsMovement.length === XER_FIDELITY_AXES.length
      && typeof file.xerDefaultsNegativeFloatTasks === 'number'), true);
}

const root = process.env.OPS_XER_CORPUS;
if (!root) {
  console.log('OK  XER-SCHEDOPTIONS-corpus: corpus niet aanwezig; committe pins structureel gecontroleerd');
} else if (!existsSync(root)) {
  diffs.push('OPS_XER_CORPUS bestaat niet');
} else {
  const measured = measureCorpus(root);
  eq('openbare populatie en negatieve-floatverdeling', measured.population, {
    scanned: 93,
    oracleAxisFiles: 60,
    withSchedOptions: 24,
    withoutSchedOptions: 36,
    measured: 32,
    deferred: 4,
    oracleNegativeFloatFiles: 5,
    withoutSchedOptionsNegativeFloatFiles: 4,
    rawNegativeFloatFiles: 6,
    rawWithoutSchedOptionsNegativeFloatFiles: 5,
  });
  eq('meerderheidsinstellingen worden uit alle 50 tabelrijen herleid', measured.schedOptionsRows, {
    rows: 50,
    parserRejectedWithoutSchedOptions: 22,
    floatFinish: 41,
    retainedLogic: 48,
    openEndedNotCritical: 48,
    predecessorLagCalendar: 44,
    projectEndForFloat: 39,
    expectedFinishDates: 48,
    lagFromEarlyStart: 40,
    progressOverride: 1,
    unknownFloatDialect: 8,
    derivedRows: 50,
    derivedFallbacks: 8,
    derivedFloatDialectFallbacks: 8,
    derivedRetainedLogic: 49,
    derivedProgressOverride: 1,
    derivedFinishFloat: 50,
    derivedLagPredecessor: 45,
    derivedLagSuccessor: 3,
    derivedLag24Hour: 1,
    derivedLagProjectDefault: 1,
  });
  eq('de 27-kolommenunion is exact de productieclassificatiematrix', measured.corpusUnion,
    XER_SCHEDOPTIONS_COLUMN_DISPOSITIONS.map(item => item.field).sort());

  if (report === 'baseline') {
    console.log(JSON.stringify(measured));
  } else if (existsSync(baselinePath)) {
    const committed = JSON.parse(readFileSync(baselinePath, 'utf8')) as BlastRadiusBaseline;
    eq('per-bestand/per-as-defaultbeweging en X1-fidelity blijven exact gepind', measured, committed);
  }
}

if (diffs.length > 0) {
  console.error(`XER-SCHEDOPTIONS-corpus: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-SCHEDOPTIONS-corpus: ${checks} checks groen`);
