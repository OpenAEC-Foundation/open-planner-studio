import { createHash } from 'node:crypto';
import {
  classifyExact,
  compareFidelityRow,
  countFidelityAxis,
  type FidelityCounts,
} from './fidelityCore';
import {
  scanXerGroundTruth,
  XER_FIDELITY_AXES,
  type XerFidelityAxis,
  type XerGroundTruth,
  type XerGroundTruthTask,
} from './xerGroundTruth';
import {
  emptyCounters,
  type XerFidelityAxisCounts,
  type XerFidelityBaseline,
  type XerFidelityBaselineEntry,
  type XerFidelityCounters,
} from './xerFidelityTypes';

/** Solveruitvoer in meetlateenheden. Float is bewust al minuten: de latere adapter moet daarvoor
 * de taak-effectieve kalender gebruiken; deze onafhankelijke kern kent geen productiekalender. */
export interface XerSolvedTask {
  sourceTaskId: string;
  taskCode: string;
  earlyStart?: string;
  earlyFinish?: string;
  lateStart?: string;
  lateFinish?: string;
  totalFloatMinutes?: number;
  freeFloatMinutes?: number;
  drivingPath?: boolean;
}

export interface XerSolvedProject {
  projectId: string;
  tasks: XerSolvedTask[];
}

export interface XerProjectFidelity {
  projectId: string;
  tasks: number;
  counters: XerFidelityCounters;
  drivingPath: XerFidelityAxisCounts;
}

export interface XerFileFidelity {
  tasks: number;
  projects: XerProjectFidelity[];
  counters: XerFidelityCounters;
  /** Zevende rapportage-as; bewust geen lid van `counters` en dus buiten de zesassige nulpoort. */
  drivingPath: XerFidelityAxisCounts;
  errors: string[];
}

export interface XerCorpusFile {
  label: string;
  bytes: Uint8Array;
}

export interface XerCorpusStats {
  scannedFiles: number;
  byteUniqueFiles: number;
  byteDuplicateFiles: number;
  /** Ruwe corpusmassa vóór dedup: vier datumassen aanwezig na statussemantiek. */
  fourDateTasks: number;
  /** Ruwe corpusmassa vóór dedup: alle zes poortassen aanwezig. */
  sixAxisTasks: number;
  /** Zevende rapportage-as vóór dedup; buiten de nulpoort. */
  drivingPathTasks: number;
  byteUniqueOracleFiles: number;
  schemaDuplicateFiles: number;
  uniqueOracleFiles: number;
  /** Taken met alle zes assen na uitsluitend byte-dedup. */
  byteUniqueOracleTasks: number;
  /** Taken met alle zes assen na beide deduplagen. */
  uniqueOracleTasks: number;
}

export interface XerTargetBaselineResult {
  baseline: XerFidelityBaseline;
  stats: XerCorpusStats;
}

function asComparable(value: string | number | boolean | null | undefined): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return typeof value === 'boolean' ? (value ? 'Y' : 'N') : String(value);
}

function solvedAxis(task: XerSolvedTask | undefined, axis: XerFidelityAxis): string | number | undefined {
  if (!task) return undefined;
  switch (axis) {
    case 'es': return task.earlyStart;
    case 'ef': return task.earlyFinish;
    case 'ls': return task.lateStart;
    case 'lf': return task.lateFinish;
    case 'tf': return task.totalFloatMinutes;
    case 'ff': return task.freeFloatMinutes;
  }
}

function axisPair(counts: FidelityCounts): XerFidelityAxisCounts {
  return { deviations: counts.deviations, measurable: counts.measurable };
}

function measureProject(
  projectId: string,
  truthTasks: readonly XerGroundTruthTask[],
  solved: XerSolvedProject | undefined,
  projectIndex: number,
  errors: string[],
): XerProjectFidelity {
  const solvedById = new Map<string, XerSolvedTask>();
  let duplicateSolvedIds = 0;
  for (const task of solved?.tasks ?? []) {
    if (solvedById.has(task.sourceTaskId)) duplicateSolvedIds++;
    else solvedById.set(task.sourceTaskId, task);
  }
  if (duplicateSolvedIds > 0) {
    errors.push(`project ${projectIndex + 1}: ${duplicateSolvedIds} dubbele opgeloste taak-id('s)`);
  }

  const rows = truthTasks.map(truthTask => {
    const ours = solvedById.get(truthTask.taskId);
    return compareFidelityRow(truthTask.taskId, Object.fromEntries(
      XER_FIDELITY_AXES.map(axis => [axis, {
        ours: asComparable(solvedAxis(ours, axis)) ?? undefined,
        truth: asComparable(truthTask.axes[axis]) ?? null,
      }]),
    ) as Record<XerFidelityAxis, { ours: string | undefined; truth: string | null }>, {
      tf: classifyExact,
      ff: classifyExact,
    });
  });

  const counters = emptyCounters();
  for (const axis of XER_FIDELITY_AXES) counters[axis] = axisPair(countFidelityAxis(rows, axis));

  const drivingRows = truthTasks.map(truthTask => {
    const ours = solvedById.get(truthTask.taskId);
    return compareFidelityRow(truthTask.taskId, {
      driving: {
        ours: asComparable(ours?.drivingPath) ?? undefined,
        truth: asComparable(truthTask.drivingPath) ?? null,
      },
    }, { driving: classifyExact });
  });

  return {
    projectId,
    tasks: truthTasks.length,
    counters,
    drivingPath: axisPair(countFidelityAxis(drivingRows, 'driving')),
  };
}

function addAxisCounts(target: XerFidelityAxisCounts, source: XerFidelityAxisCounts): void {
  target.measurable += source.measurable;
  target.deviations += source.deviations;
}

function isFullOracleTask(task: XerGroundTruthTask): boolean {
  return XER_FIDELITY_AXES.every(axis => task.storedAxes[axis]);
}

function byteHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Inhoudsvingerafdruk volgens het plan: project-id-set + taakcodes + orakelwaarden. Geen
 * bestandsmetadata, rijvolgorde, whitespace of bytes, zodat inhoudelijk gelijke exports samenvallen.
 */
export function xerSchemaFingerprint(truth: XerGroundTruth): string {
  const projects = [...truth.projects].sort().join('\u001f');
  const rows = truth.tasks.map(task => [
    task.projectId,
    task.taskCode,
    task.statusCode,
    ...XER_FIDELITY_AXES.map(axis => task.axes[axis] ?? ''),
    task.drivingPath === null ? '' : task.drivingPath ? 'Y' : 'N',
  ].join('\u001f')).sort();
  return createHash('sha256').update(`${projects}\u001e${rows.join('\u001e')}`).digest('hex').slice(0, 16);
}

function targetCountersPerProject(truth: XerGroundTruth): XerFidelityCounters {
  const byProject = new Map<string, XerGroundTruthTask[]>();
  for (const task of truth.tasks) {
    const list = byProject.get(task.projectId) ?? [];
    list.push(task);
    byProject.set(task.projectId, list);
  }
  const total = emptyCounters();
  for (const tasks of byProject.values()) {
    for (const axis of XER_FIDELITY_AXES) {
      const measurable = tasks.reduce((sum, task) => sum + (task.axes[axis] === null ? 0 : 1), 0);
      addAxisCounts(total[axis], { deviations: 0, measurable });
    }
  }
  return total;
}

function targetEntry(label: string, truth: XerGroundTruth, fingerprint: string): XerFidelityBaselineEntry {
  return {
    label,
    tasks: truth.tasks.length,
    projects: truth.projects.size,
    counters: targetCountersPerProject(truth),
    schemaFingerprint: fingerprint,
  };
}

/**
 * Bouw de nuldoel-baseline uit uitsluitend het onafhankelijke orakel. Dit is nog geen lezermeting:
 * X1 levert geen productielezer. De synthetische `measureXerFidelity`-checks hierboven bewaken het
 * echte vergelijkpad; een latere taak sluit daar de opgeloste documenten op aan.
 */
export function buildXerTargetBaseline(files: readonly XerCorpusFile[]): XerTargetBaselineResult {
  const baseline: XerFidelityBaseline = { files: {} };
  const stats: XerCorpusStats = {
    scannedFiles: files.length,
    byteUniqueFiles: 0,
    byteDuplicateFiles: 0,
    fourDateTasks: 0,
    sixAxisTasks: 0,
    drivingPathTasks: 0,
    byteUniqueOracleFiles: 0,
    schemaDuplicateFiles: 0,
    uniqueOracleFiles: 0,
    byteUniqueOracleTasks: 0,
    uniqueOracleTasks: 0,
  };
  const seenBytes = new Set<string>();
  const seenSchemas = new Set<string>();

  for (const file of [...files].sort((a, b) => a.label.localeCompare(b.label))) {
    const truth = scanXerGroundTruth(file.bytes);
    stats.fourDateTasks += truth.tasks.filter(task =>
      task.storedAxes.es && task.storedAxes.ef && task.storedAxes.ls && task.storedAxes.lf).length;
    stats.sixAxisTasks += truth.tasks.filter(isFullOracleTask).length;
    stats.drivingPathTasks += truth.tasks.filter(task => task.drivingPath !== null).length;

    const fullByteHash = byteHash(file.bytes);
    if (seenBytes.has(fullByteHash)) {
      stats.byteDuplicateFiles++;
      continue;
    }
    seenBytes.add(fullByteHash);
    stats.byteUniqueFiles++;

    const fullOracleTasks = truth.tasks.filter(isFullOracleTask).length;
    if (fullOracleTasks === 0) continue;
    stats.byteUniqueOracleFiles++;
    stats.byteUniqueOracleTasks += fullOracleTasks;

    const fingerprint = xerSchemaFingerprint(truth);
    if (seenSchemas.has(fingerprint)) {
      stats.schemaDuplicateFiles++;
      continue;
    }
    seenSchemas.add(fingerprint);
    stats.uniqueOracleFiles++;
    stats.uniqueOracleTasks += fullOracleTasks;
    baseline.files[fullByteHash.slice(0, 16)] = targetEntry(file.label, truth, fingerprint);
  }

  return { baseline, stats };
}

export function validateXerBaselinePins(baseline: XerFidelityBaseline): string[] {
  const problems: string[] = [];
  Object.values(baseline.files).forEach((entry, index) => {
    const hasDeviation = XER_FIDELITY_AXES.some(axis => entry.counters[axis].deviations !== 0);
    if (hasDeviation && !entry.reason?.trim()) {
      problems.push(`baseline-entry ${index + 1}: niet-nul afwijking vereist een niet-lege reason`);
    }
  });
  return problems;
}

/**
 * Meet expliciet per project en tel pas daarna op tot het bestand. Er bestaat bewust geen globale
 * `truth.tasks.length === solved.tasks.length`-assertie: één XER kan meerdere projecten dragen.
 */
export function measureXerFidelity(
  truth: XerGroundTruth,
  solvedProjects: readonly XerSolvedProject[],
): XerFileFidelity {
  const truthByProject = new Map<string, XerGroundTruthTask[]>();
  for (const task of truth.tasks) {
    const list = truthByProject.get(task.projectId) ?? [];
    list.push(task);
    truthByProject.set(task.projectId, list);
  }
  const solvedByProject = new Map(solvedProjects.map(project => [project.projectId, project]));
  const errors: string[] = [];
  const projects = [...truthByProject.entries()].map(([projectId, tasks], index) =>
    measureProject(projectId, tasks, solvedByProject.get(projectId), index, errors));

  const counters = emptyCounters();
  const drivingPath: XerFidelityAxisCounts = { deviations: 0, measurable: 0 };
  for (const project of projects) {
    for (const axis of XER_FIDELITY_AXES) addAxisCounts(counters[axis], project.counters[axis]);
    addAxisCounts(drivingPath, project.drivingPath);
  }

  return {
    tasks: projects.reduce((sum, project) => sum + project.tasks, 0),
    projects,
    counters,
    drivingPath,
    errors,
  };
}
