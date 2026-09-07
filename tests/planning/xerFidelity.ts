import { createHash } from 'node:crypto';
import {
  classifyExact,
  classifyMinuteExact,
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
  truthProjects: number;
  solvedProjects: number;
  truthTasks: number;
  solvedTasks: number;
  /** Compatibiliteitsalias voor de bestaande rapportage: gelijk aan `truthTasks`. */
  tasks: number;
  projects: XerProjectFidelity[];
  counters: XerFidelityCounters;
  /** Zevende rapportage-as; bewust geen lid van `counters` en dus buiten de zesassige nulpoort. */
  drivingPath: XerFidelityAxisCounts;
  errors: string[];
  /** De zesassige poort: nul uitlijnfouten, gelijke aantallen en nul afwijkingen. */
  gatePassed: boolean;
}

export interface XerCorpusFile {
  label: string;
  bytes: Uint8Array;
}

export type XerCorpusRole =
  | 'oracle'
  | 'engine-input'
  | 'parser-fixture'
  | 'pseudo-xer'
  | 'reference-only'
  | 'synthetic-fixture';

export interface XerCorpusManifestEntry {
  sha256: string;
  source: string;
  role: XerCorpusRole;
  included: boolean;
  exclusionReason?: string;
}

export interface XerCorpusManifest {
  version: 1;
  policy: string;
  files: Record<string, XerCorpusManifestEntry>;
}

export interface XerCorpusStats {
  scannedFiles: number;
  manifestFiles: number;
  includedFiles: number;
  excludedFiles: number;
  byteUniqueFiles: number;
  byteDuplicateFiles: number;
  /** Ruwe corpusmassa vóór dedup: vier datumassen aanwezig na statussemantiek. */
  fourDateTasks: number;
  /** Ruwe corpusmassa vóór dedup: alle zes poortassen aanwezig. */
  sixAxisTasks: number;
  /** Zevende rapportage-as vóór dedup; buiten de nulpoort. */
  drivingPathTasks: number;
  /** Reviewreconciliatie: byte-unieke bestanden met minstens één as, maar geen alles-zes-taak. */
  partialOnlyByteUniqueFiles: number;
  partialOnlyAxisCells: number;
  /** Geselecteerde, herkomstvaste bestanden met minstens één effectieve poortas. */
  byteUniqueOracleFiles: number;
  schemaDuplicateFiles: number;
  uniqueOracleFiles: number;
  byteUniqueOracleTasks: number;
  uniqueOracleTasks: number;
  selectedMeasurable: Record<XerFidelityAxis, number>;
}

export interface XerTargetBaselineResult {
  baseline: XerFidelityBaseline;
  stats: XerCorpusStats;
  errors: string[];
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
  errors: string[],
): XerProjectFidelity {
  const solvedById = new Map<string, XerSolvedTask>();
  for (const task of solved?.tasks ?? []) {
    if (!task.sourceTaskId.trim()) {
      errors.push(`project ${projectId}: opgeloste taak heeft lege sourceTaskId`);
      continue;
    }
    if (!task.taskCode.trim()) {
      errors.push(`project ${projectId}/taak ${task.sourceTaskId}: opgeloste taskCode is leeg`);
    }
    if (solvedById.has(task.sourceTaskId)) {
      errors.push(`project ${projectId}: dubbele opgeloste taak-id: ${task.sourceTaskId}`);
    }
    else solvedById.set(task.sourceTaskId, task);
  }

  const truthById = new Map(truthTasks.map(task => [task.taskId, task]));
  for (const taskId of [...solvedById.keys()].filter(id => !truthById.has(id)).sort()) {
    errors.push(`project ${projectId}: onverwachte opgeloste taak-id: ${taskId}`);
  }
  for (const taskId of [...truthById.keys()].filter(id => !solvedById.has(id)).sort()) {
    errors.push(`project ${projectId}: ontbrekende opgeloste taak-id: ${taskId}`);
  }
  for (const truthTask of truthTasks) {
    const solvedTask = solvedById.get(truthTask.taskId);
    if (solvedTask && solvedTask.taskCode.trim() && solvedTask.taskCode !== truthTask.taskCode) {
      errors.push(
        `project ${projectId}/taak ${truthTask.taskId}: taskCode verwacht ${truthTask.taskCode}, `
        + `kreeg ${solvedTask.taskCode}`,
      );
    }
  }

  const rows = truthTasks.map(truthTask => {
    const ours = solvedById.get(truthTask.taskId);
    return compareFidelityRow(truthTask.taskId, Object.fromEntries(
      XER_FIDELITY_AXES.map(axis => [axis, {
        ours: asComparable(solvedAxis(ours, axis)) ?? undefined,
        truth: asComparable(truthTask.axes[axis]) ?? null,
      }]),
    ) as Record<XerFidelityAxis, { ours: string | undefined; truth: string | null }>, {
      es: classifyMinuteExact,
      ef: classifyMinuteExact,
      ls: classifyMinuteExact,
      lf: classifyMinuteExact,
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
  return XER_FIDELITY_AXES.every(axis => task.presentAxes[axis]);
}

function hasOracleAxis(task: XerGroundTruthTask): boolean {
  return XER_FIDELITY_AXES.some(axis => task.axes[axis] !== null);
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
    task.taskId,
    task.taskCode,
    ...XER_FIDELITY_AXES.map(axis => task.axes[axis] === null ? '\u2400' : task.axes[axis]),
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
  const taskProjects = new Set(truth.tasks.map(task => task.projectId));
  return {
    label,
    tasks: truth.tasks.length,
    projects: taskProjects.size,
    counters: targetCountersPerProject(truth),
    schemaFingerprint: fingerprint,
  };
}

/**
 * Bouw de nuldoel-baseline uit uitsluitend het onafhankelijke orakel. Dit is nog geen lezermeting:
 * X1 levert geen productielezer. De synthetische `measureXerFidelity`-checks hierboven bewaken het
 * echte vergelijkpad; een latere taak sluit daar de opgeloste documenten op aan.
 */
export function buildXerTargetBaseline(
  files: readonly XerCorpusFile[],
  manifest: XerCorpusManifest,
): XerTargetBaselineResult {
  const baseline: XerFidelityBaseline = { files: {} };
  const errors: string[] = [];
  const stats: XerCorpusStats = {
    scannedFiles: files.length,
    manifestFiles: Object.keys(manifest.files).length,
    includedFiles: Object.values(manifest.files).filter(entry => entry.included).length,
    excludedFiles: Object.values(manifest.files).filter(entry => !entry.included).length,
    byteUniqueFiles: 0,
    byteDuplicateFiles: 0,
    fourDateTasks: 0,
    sixAxisTasks: 0,
    drivingPathTasks: 0,
    partialOnlyByteUniqueFiles: 0,
    partialOnlyAxisCells: 0,
    byteUniqueOracleFiles: 0,
    schemaDuplicateFiles: 0,
    uniqueOracleFiles: 0,
    byteUniqueOracleTasks: 0,
    uniqueOracleTasks: 0,
    selectedMeasurable: Object.fromEntries(XER_FIDELITY_AXES.map(axis => [axis, 0])) as Record<XerFidelityAxis, number>,
  };
  const filesByLabel = new Map<string, XerCorpusFile>();
  for (const file of files) {
    if (filesByLabel.has(file.label)) errors.push(`dubbel corpuslabel: ${file.label}`);
    else filesByLabel.set(file.label, file);
  }
  for (const label of Object.keys(manifest.files).sort()) {
    if (!filesByLabel.has(label)) errors.push(`manifestbestand ontbreekt in corpus: ${label}`);
  }
  for (const label of [...filesByLabel.keys()].filter(label => !(label in manifest.files)).sort()) {
    errors.push(`corpusbestand ontbreekt in manifest: ${label}`);
  }
  const seenSchemas = new Set<string>();
  const filesByHash = new Map<string, Array<{
    file: XerCorpusFile;
    manifestEntry: XerCorpusManifestEntry;
    truth: XerGroundTruth;
  }>>();

  for (const file of [...files].sort((a, b) => a.label.localeCompare(b.label))) {
    const manifestEntry = manifest.files[file.label];
    if (!manifestEntry) continue;
    const fullByteHash = byteHash(file.bytes);
    if (manifestEntry.sha256 !== fullByteHash) {
      errors.push(`${file.label}: SHA-256 verwacht ${manifestEntry.sha256}, kreeg ${fullByteHash}`);
    }
    if (manifestEntry.included !== (manifestEntry.role === 'oracle')) {
      errors.push(`${file.label}: included moet exact overeenkomen met role=oracle`);
    }
    if (!manifestEntry.included && !manifestEntry.exclusionReason?.trim()) {
      errors.push(`${file.label}: uitgesloten manifestentry mist exclusionReason`);
    }
    const truth = scanXerGroundTruth(file.bytes);
    stats.fourDateTasks += truth.tasks.filter(task =>
      task.presentAxes.es && task.presentAxes.ef && task.presentAxes.ls && task.presentAxes.lf).length;
    stats.sixAxisTasks += truth.tasks.filter(isFullOracleTask).length;
    stats.drivingPathTasks += truth.tasks.filter(task => task.drivingPath !== null).length;

    const group = filesByHash.get(fullByteHash) ?? [];
    group.push({ file, manifestEntry, truth });
    filesByHash.set(fullByteHash, group);
  }

  for (const [fullByteHash, group] of filesByHash) {
    stats.byteUniqueFiles++;
    stats.byteDuplicateFiles += group.length - 1;

    const oracle = group.find(candidate =>
      candidate.manifestEntry.included && candidate.manifestEntry.role === 'oracle');
    const selected = oracle ?? group[0];
    const { file, truth } = selected;

    const fullOracleTasks = truth.tasks.filter(isFullOracleTask).length;
    const axisTasks = truth.tasks.filter(hasOracleAxis).length;
    const axisCells = XER_FIDELITY_AXES.reduce((sum, axis) =>
      sum + truth.tasks.filter(task => task.axes[axis] !== null).length, 0);
    if (axisTasks > 0 && fullOracleTasks === 0) {
      stats.partialOnlyByteUniqueFiles++;
      stats.partialOnlyAxisCells += axisCells;
    }
    if (!oracle) continue;
    if (truth.errors.length > 0) {
      errors.push(...truth.errors.map(error => `${file.label}: ${error}`));
      continue;
    }
    if (axisTasks === 0) {
      errors.push(`${file.label}: als orakel geselecteerd maar geen enkele poortas meetbaar`);
      continue;
    }
    stats.byteUniqueOracleFiles++;
    stats.byteUniqueOracleTasks += axisTasks;

    const fingerprint = xerSchemaFingerprint(truth);
    if (seenSchemas.has(fingerprint)) {
      stats.schemaDuplicateFiles++;
      continue;
    }
    seenSchemas.add(fingerprint);
    stats.uniqueOracleFiles++;
    stats.uniqueOracleTasks += axisTasks;
    const entry = targetEntry(file.label, truth, fingerprint);
    for (const axis of XER_FIDELITY_AXES) stats.selectedMeasurable[axis] += entry.counters[axis].measurable;
    baseline.files[fullByteHash.slice(0, 16)] = entry;
  }

  return { baseline, stats, errors };
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
  const errors: string[] = [...truth.errors];
  const solvedByProject = new Map<string, XerSolvedProject>();
  for (const project of solvedProjects) {
    if (!project.projectId.trim()) {
      errors.push('opgelost project heeft lege projectId');
      continue;
    }
    if (solvedByProject.has(project.projectId)) {
      errors.push(`dubbele opgeloste project-id: ${project.projectId}`);
    } else {
      solvedByProject.set(project.projectId, project);
    }
  }
  for (const projectId of [...solvedByProject.keys()].filter(id => !truthByProject.has(id)).sort()) {
    errors.push(`onverwacht opgelost project-id: ${projectId}`);
  }
  for (const projectId of [...truthByProject.keys()].filter(id => !solvedByProject.has(id)).sort()) {
    errors.push(`ontbrekend opgelost project-id: ${projectId}`);
  }

  const projects = [...truthByProject.entries()].map(([projectId, tasks]) =>
    measureProject(projectId, tasks, solvedByProject.get(projectId), errors));

  const counters = emptyCounters();
  const drivingPath: XerFidelityAxisCounts = { deviations: 0, measurable: 0 };
  for (const project of projects) {
    for (const axis of XER_FIDELITY_AXES) addAxisCounts(counters[axis], project.counters[axis]);
    addAxisCounts(drivingPath, project.drivingPath);
  }

  const truthTasks = projects.reduce((sum, project) => sum + project.tasks, 0);
  const solvedTasks = solvedProjects.reduce((sum, project) => sum + project.tasks.length, 0);
  const truthProjects = truthByProject.size;
  const solvedProjectCount = solvedProjects.length;
  const hasDeviations = XER_FIDELITY_AXES.some(axis => counters[axis].deviations !== 0);

  return {
    truthProjects,
    solvedProjects: solvedProjectCount,
    truthTasks,
    solvedTasks,
    tasks: truthTasks,
    projects,
    counters,
    drivingPath,
    errors,
    gatePassed: errors.length === 0
      && truthProjects === solvedProjectCount
      && truthTasks === solvedTasks
      && !hasDeviations,
  };
}
