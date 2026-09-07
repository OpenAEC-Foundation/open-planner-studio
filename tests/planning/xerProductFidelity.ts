import {
  classifyExact,
  classifyMinuteExact,
  compareFidelityRow,
  countFidelityAxis,
  type FidelityCounts,
} from './fidelityCore';
import {
  XER_FIDELITY_AXES,
  type XerFidelityAxis,
  type XerGroundTruth,
  type XerGroundTruthTask,
} from './xerGroundTruth';
import type { XerSolvedProject, XerSolvedTask } from './xerFidelity';

export interface XerProductAxisCounts {
  exact: number;
  sameday: number;
  diff: number;
  missing: number;
  measurable: number;
  deviations: number;
}

export interface XerProductTaskDelta {
  projectId: string;
  taskId: string;
  taskCode: string;
  axis: XerFidelityAxis | 'drivingPath';
  truth: string | number | boolean | null;
  ours: string | number | boolean | undefined;
  bucket: 'exact' | 'sameday' | 'diff' | 'missing';
}

/**
 * De productmeting blijft per project uitlegbaar. `taskCodeExact` is geen alternatieve
 * identiteitssleutel: sourceTaskId blijft de join. Deze vier tellers maken wel zichtbaar dat
 * de tweede identiteitskolom niet stil uit de dekking kan verdwijnen.
 */
export interface XerProductProjectMeasurement {
  projectId: string;
  truthTasks: number;
  solvedTasks: number;
  taskCodePresent: number;
  taskCodeExact: number;
  counters: Record<XerFidelityAxis, XerProductAxisCounts>;
  drivingPath: XerProductAxisCounts;
  identityErrors: string[];
}

export interface XerProductMeasurement {
  truthProjects: number;
  solvedProjects: number;
  truthTasks: number;
  solvedTasks: number;
  counters: Record<XerFidelityAxis, XerProductAxisCounts>;
  drivingPath: XerProductAxisCounts;
  /** Stabiel gesorteerd; de entrysom moet precies naar de globale tellers rollen. */
  projects: XerProductProjectMeasurement[];
  /** Alleen fouten uit de onafhankelijke raw-XER-scanner. */
  scannerErrors: string[];
  /** Alleen project-/taakidentiteitsfouten uit de productuitlijning. */
  identityErrors: string[];
  /** Compatibel gecombineerd kanaal voor bestaande rapportage. */
  errors: string[];
  detail: XerProductTaskDelta[];
  gatePassed: boolean;
}

function productCounts(counts: FidelityCounts): XerProductAxisCounts {
  // fidelityCore telt een afwezig orakelveld bewust als `missing`, omdat MPP dat als rijdiagnose
  // rapporteert. Voor X12 zijn alleen orakelmeetbare waarden productverplichtingen.
  const missing = counts.deviations - counts.sameday - counts.diff;
  return {
    exact: counts.exact,
    sameday: counts.sameday,
    diff: counts.diff,
    missing,
    measurable: counts.measurable,
    deviations: counts.deviations,
  };
}

function emptyCounts(): XerProductAxisCounts {
  return { exact: 0, sameday: 0, diff: 0, missing: 0, measurable: 0, deviations: 0 };
}

function addCounts(target: XerProductAxisCounts, source: XerProductAxisCounts): void {
  target.exact += source.exact;
  target.sameday += source.sameday;
  target.diff += source.diff;
  target.missing += source.missing;
  target.measurable += source.measurable;
  target.deviations += source.deviations;
}

function comparable(value: string | number | boolean | null | undefined): string | undefined | null {
  if (value === null || value === undefined) return value;
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

function validateIdentity(
  projectId: string,
  truthTasks: readonly XerGroundTruthTask[],
  solved: XerSolvedProject | undefined,
  errors: string[],
): { byId: Map<string, XerSolvedTask>; errors: string[] } {
  const projectErrors: string[] = [];
  const byId = new Map<string, XerSolvedTask>();
  for (const task of solved?.tasks ?? []) {
    if (!task.sourceTaskId.trim()) {
      projectErrors.push(`project ${projectId}: opgeloste taak heeft lege sourceTaskId`);
      continue;
    }
    if (!task.taskCode.trim()) projectErrors.push(`project ${projectId}/taak ${task.sourceTaskId}: taskCode is leeg`);
    if (byId.has(task.sourceTaskId)) projectErrors.push(`project ${projectId}: dubbele opgeloste taak-id ${task.sourceTaskId}`);
    else byId.set(task.sourceTaskId, task);
  }
  const truthById = new Map(truthTasks.map(task => [task.taskId, task]));
  for (const id of [...byId.keys()].filter(id => !truthById.has(id)).sort()) projectErrors.push(`project ${projectId}: extra taak ${id}`);
  for (const id of [...truthById.keys()].filter(id => !byId.has(id)).sort()) projectErrors.push(`project ${projectId}: ontbrekende taak ${id}`);
  for (const task of truthTasks) {
    const actual = byId.get(task.taskId);
    if (actual?.taskCode && actual.taskCode !== task.taskCode) {
      projectErrors.push(`project ${projectId}/taak ${task.taskId}: code verwacht ${task.taskCode}, kreeg ${actual.taskCode}`);
    }
  }
  errors.push(...projectErrors);
  return { byId, errors: projectErrors };
}

/** Productlaag: meet alle door readXER geopende projecten, zonder de grondwaarheid of solver te delen. */
export function measureXerProductFidelity(
  truth: XerGroundTruth,
  solvedProjects: readonly XerSolvedProject[],
): XerProductMeasurement {
  const scannerErrors = [...truth.errors];
  const identityErrors: string[] = [];
  const truthByProject = new Map<string, XerGroundTruthTask[]>();
  for (const task of truth.tasks) {
    const group = truthByProject.get(task.projectId) ?? [];
    group.push(task);
    truthByProject.set(task.projectId, group);
  }
  const solvedByProject = new Map<string, XerSolvedProject>();
  for (const project of solvedProjects) {
    if (!project.projectId.trim()) identityErrors.push('opgelost project heeft lege projectId');
    else if (solvedByProject.has(project.projectId)) identityErrors.push(`dubbel opgelost project ${project.projectId}`);
    else solvedByProject.set(project.projectId, project);
  }
  for (const id of [...solvedByProject.keys()].filter(id => !truthByProject.has(id)).sort()) identityErrors.push(`extra project ${id}`);
  for (const id of [...truthByProject.keys()].filter(id => !solvedByProject.has(id)).sort()) identityErrors.push(`ontbrekend project ${id}`);

  const counters = Object.fromEntries(XER_FIDELITY_AXES.map(axis => [axis, emptyCounts()])) as Record<XerFidelityAxis, XerProductAxisCounts>;
  const drivingPath = emptyCounts();
  const projects: XerProductProjectMeasurement[] = [];
  const detail: XerProductTaskDelta[] = [];
  for (const [projectId, truthTasks] of truthByProject) {
    const identity = validateIdentity(projectId, truthTasks, solvedByProject.get(projectId), identityErrors);
    const solvedById = identity.byId;
    const projectCounters = Object.fromEntries(XER_FIDELITY_AXES.map(axis => [axis, emptyCounts()])) as Record<XerFidelityAxis, XerProductAxisCounts>;
    const projectDrivingPath = emptyCounts();
    let taskCodePresent = 0;
    let taskCodeExact = 0;
    for (const truthTask of truthTasks) {
      const solved = solvedById.get(truthTask.taskId);
      if (solved?.taskCode.trim()) taskCodePresent++;
      if (solved?.taskCode === truthTask.taskCode) taskCodeExact++;
      const row = compareFidelityRow(truthTask.taskId, Object.fromEntries(XER_FIDELITY_AXES.map(axis => [axis, {
        ours: comparable(solvedAxis(solved, axis)) ?? undefined,
        truth: comparable(truthTask.axes[axis]) ?? null,
      }])) as Record<XerFidelityAxis, { ours: string | undefined; truth: string | null }>, {
        es: classifyMinuteExact, ef: classifyMinuteExact, ls: classifyMinuteExact, lf: classifyMinuteExact,
        tf: classifyExact, ff: classifyExact,
      });
      for (const axis of XER_FIDELITY_AXES) {
        const one = productCounts(countFidelityAxis([row], axis));
        addCounts(counters[axis], one);
        addCounts(projectCounters[axis], one);
        if (one.deviations > 0) {
          const delta = row.axes[axis];
          detail.push({ projectId, taskId: truthTask.taskId, taskCode: truthTask.taskCode, axis,
            truth: truthTask.axes[axis], ours: solvedAxis(solved, axis), bucket: delta.verdict });
        }
      }
      const driving = compareFidelityRow(truthTask.taskId, { driving: {
        ours: comparable(solved?.drivingPath) ?? undefined,
        truth: comparable(truthTask.drivingPath) ?? null,
      } }, { driving: classifyExact });
      const drivingCounts = productCounts(countFidelityAxis([driving], 'driving'));
      addCounts(drivingPath, drivingCounts);
      addCounts(projectDrivingPath, drivingCounts);
      if (drivingCounts.deviations > 0) {
        const delta = driving.axes.driving;
        detail.push({ projectId, taskId: truthTask.taskId, taskCode: truthTask.taskCode, axis: 'drivingPath',
          truth: truthTask.drivingPath, ours: solved?.drivingPath, bucket: delta.verdict });
      }
    }
    projects.push({
      projectId,
      truthTasks: truthTasks.length,
      solvedTasks: solvedByProject.get(projectId)?.tasks.length ?? 0,
      taskCodePresent,
      taskCodeExact,
      counters: projectCounters,
      drivingPath: projectDrivingPath,
      identityErrors: identity.errors,
    });
  }
  const truthTasks = truth.tasks.length;
  const solvedTasks = solvedProjects.reduce((total, project) => total + project.tasks.length, 0);
  const errors = [...scannerErrors, ...identityErrors];
  return {
    truthProjects: truthByProject.size,
    solvedProjects: solvedProjects.length,
    truthTasks,
    solvedTasks,
    counters,
    drivingPath,
    projects: projects.sort((left, right) => left.projectId.localeCompare(right.projectId)),
    scannerErrors,
    identityErrors,
    errors,
    detail,
    gatePassed: errors.length === 0 && truthByProject.size === solvedProjects.length
      && truthTasks === solvedTasks && XER_FIDELITY_AXES.every(axis => counters[axis].deviations === 0),
  };
}
