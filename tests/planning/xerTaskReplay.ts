import { XER_FIDELITY_AXES, type XerFidelityAxis, type XerGroundTruth } from './xerGroundTruth';
import type { XerSolvedProject, XerSolvedTask } from './xerFidelity';

export type XerReplayClassification = 'improved' | 'regressed' | 'unchanged';
export type XerReplayValue = string | number | null | undefined;

export interface XerReplayCounts {
  improved: number;
  regressed: number;
  unchanged: number;
}

export interface XerReplayPredicateLog {
  projectId: string;
  taskCode: string;
  matched: boolean;
  /** Uitsluitend geselecteerde bron-/provenancefeiten; nooit P6-orakelwaarden. */
  source: Readonly<Record<string, string | number | boolean | null>>;
}

export interface XerReplayAxisResult {
  oracle: string | number | null;
  baseline: string | number | undefined;
  counterfactual: string | number | undefined;
  classification: XerReplayClassification;
}

export interface XerReplayTaskResult {
  projectId: string;
  taskId: string;
  taskCode: string;
  predicate: XerReplayPredicateLog;
  axes: Record<XerFidelityAxis, XerReplayAxisResult>;
  overall: XerReplayClassification;
}

export interface XerTaskReplayResult {
  tasks: XerReplayTaskResult[];
  predicate: XerReplayPredicateLog[];
  aggregate: Record<XerFidelityAxis, XerReplayCounts> & { overall: XerReplayCounts };
}

export interface EvaluateXerTaskReplayInput {
  /** Alleen meetlat; baseline/counterfactual en predicate zijn al berekend vóór deze aanroep. */
  oracle: XerGroundTruth;
  baseline: readonly XerSolvedProject[];
  counterfactual: readonly XerSolvedProject[];
  predicate: readonly XerReplayPredicateLog[];
}

function emptyCounts(): XerReplayCounts {
  return { improved: 0, regressed: 0, unchanged: 0 };
}

function axisValue(task: XerSolvedTask, axis: XerFidelityAxis): string | number | undefined {
  switch (axis) {
    case 'es': return task.earlyStart;
    case 'ef': return task.earlyFinish;
    case 'ls': return task.lateStart;
    case 'lf': return task.lateFinish;
    case 'tf': return task.totalFloatMinutes;
    case 'ff': return task.freeFloatMinutes;
  }
}

function classify(
  _axis: XerFidelityAxis,
  oracle: string | number | null,
  baseline: string | number | undefined,
  counterfactual: string | number | undefined,
): XerReplayClassification {
  if (oracle === null) return 'unchanged';
  // De X12-meetlat is exact: alleen een overgang naar exact is verbetering en alleen een
  // overgang van exact af is regressie. Twee verschillende niet-exacte waarden wassen elkaar
  // niet via afstand, tolerantie of same-day-logica.
  const baselineExact = baseline !== undefined && String(baseline) === String(oracle);
  const counterfactualExact = counterfactual !== undefined && String(counterfactual) === String(oracle);
  if (!baselineExact && counterfactualExact) return 'improved';
  if (baselineExact && !counterfactualExact) return 'regressed';
  return 'unchanged';
}

function count(target: XerReplayCounts, classification: XerReplayClassification): void {
  target[classification]++;
}

function indexProjects(
  kind: 'baseline' | 'counterfactual',
  projects: readonly XerSolvedProject[],
): Map<string, XerSolvedProject> {
  const indexed = new Map<string, XerSolvedProject>();
  for (const project of projects) {
    if (!project.projectId.trim()) throw new Error(`task replay: leeg ${kind}project-id`);
    if (indexed.has(project.projectId)) throw new Error(`task replay: dubbel ${kind}project ${project.projectId}`);
    indexed.set(project.projectId, project);
  }
  return indexed;
}

function indexTasks(
  kind: 'baseline' | 'counterfactual',
  projectId: string,
  tasks: readonly XerSolvedTask[],
): Map<string, XerSolvedTask> {
  const indexed = new Map<string, XerSolvedTask>();
  for (const task of tasks) {
    if (!task.taskCode.trim()) throw new Error(`task replay: lege ${kind}taakcode in project ${projectId}`);
    if (indexed.has(task.taskCode)) throw new Error(`task replay: dubbele ${kind}taak ${projectId}/${task.taskCode}`);
    indexed.set(task.taskCode, task);
  }
  return indexed;
}

function indexPredicates(predicate: readonly XerReplayPredicateLog[]): Map<string, XerReplayPredicateLog> {
  const indexed = new Map<string, XerReplayPredicateLog>();
  for (const log of predicate) {
    const key = `${log.projectId}\u0000${log.taskCode}`;
    if (!log.projectId.trim() || !log.taskCode.trim()) throw new Error('task replay: predicate mist project-id of taakcode');
    if (indexed.has(key)) throw new Error(`task replay: dubbele predicate ${log.projectId}/${log.taskCode}`);
    indexed.set(key, log);
  }
  return indexed;
}

/**
 * Koppelt reeds berekende baseline/counterfactual aan het onafhankelijke P6-orakel.
 * Deze functie voert geen predicate of solve uit: raw oracle kan daardoor uitsluitend de
 * classificatie bepalen en nooit de kandidaatroute.
 */
export function evaluateXerTaskReplay(input: EvaluateXerTaskReplayInput): XerTaskReplayResult {
  if (input.oracle.errors.length > 0) {
    throw new Error(`task replay: onafhankelijke scannerfout: ${input.oracle.errors.join('; ')}`);
  }
  const truthProjects = new Map<string, Map<string, (typeof input.oracle.tasks)[number]>>();
  for (const task of input.oracle.tasks) {
    const tasks = truthProjects.get(task.projectId) ?? new Map();
    if (tasks.has(task.taskCode)) throw new Error(`task replay: dubbele orakeltaak ${task.projectId}/${task.taskCode}`);
    tasks.set(task.taskCode, task);
    truthProjects.set(task.projectId, tasks);
  }
  const baselineProjects = indexProjects('baseline', input.baseline);
  const counterfactualProjects = indexProjects('counterfactual', input.counterfactual);
  const predicates = indexPredicates(input.predicate);

  for (const projectId of truthProjects.keys()) {
    if (!baselineProjects.has(projectId)) throw new Error(`task replay: ontbrekend baselineproject ${projectId}`);
    if (!counterfactualProjects.has(projectId)) throw new Error(`task replay: ontbrekend counterfactualproject ${projectId}`);
  }
  for (const projectId of baselineProjects.keys()) {
    if (!truthProjects.has(projectId)) throw new Error(`task replay: extra baselineproject ${projectId}`);
  }
  for (const projectId of counterfactualProjects.keys()) {
    if (!truthProjects.has(projectId)) throw new Error(`task replay: extra counterfactualproject ${projectId}`);
  }

  const aggregate = Object.fromEntries([
    ...XER_FIDELITY_AXES.map(axis => [axis, emptyCounts()] as const),
    ['overall', emptyCounts()] as const,
  ]) as XerTaskReplayResult['aggregate'];
  const results: XerReplayTaskResult[] = [];

  for (const [projectId, truthTasks] of truthProjects) {
    const baselineTasks = indexTasks('baseline', projectId, baselineProjects.get(projectId)!.tasks);
    const counterfactualTasks = indexTasks('counterfactual', projectId, counterfactualProjects.get(projectId)!.tasks);
    for (const taskCode of truthTasks.keys()) {
      if (!baselineTasks.has(taskCode)) throw new Error(`task replay: ontbrekende baselinetaak ${projectId}/${taskCode}`);
      if (!counterfactualTasks.has(taskCode)) throw new Error(`task replay: ontbrekende counterfactualtaak ${projectId}/${taskCode}`);
    }
    for (const taskCode of baselineTasks.keys()) {
      if (!truthTasks.has(taskCode)) throw new Error(`task replay: extra baselinetaak ${projectId}/${taskCode}`);
    }
    for (const taskCode of counterfactualTasks.keys()) {
      if (!truthTasks.has(taskCode)) throw new Error(`task replay: extra counterfactualtaak ${projectId}/${taskCode}`);
    }

    for (const [taskCode, truthTask] of truthTasks) {
      const baselineTask = baselineTasks.get(taskCode)!;
      const counterfactualTask = counterfactualTasks.get(taskCode)!;
      if (baselineTask.sourceTaskId !== truthTask.taskId) {
        throw new Error(`task replay: baseline bron-taak-id voor ${projectId}/${taskCode} verwacht ${truthTask.taskId}, kreeg ${baselineTask.sourceTaskId}`);
      }
      if (counterfactualTask.sourceTaskId !== truthTask.taskId) {
        throw new Error(`task replay: counterfactual bron-taak-id voor ${projectId}/${taskCode} verwacht ${truthTask.taskId}, kreeg ${counterfactualTask.sourceTaskId}`);
      }
      const predicateKey = `${projectId}\u0000${taskCode}`;
      const predicate = predicates.get(predicateKey);
      if (!predicate) throw new Error(`task replay: ontbrekende predicate ${projectId}/${taskCode}`);

      const axes = Object.fromEntries(XER_FIDELITY_AXES.map(axis => {
        const oracle = truthTask.axes[axis];
        const baseline = axisValue(baselineTask, axis);
        const counterfactual = axisValue(counterfactualTask, axis);
        const classification = classify(axis, oracle, baseline, counterfactual);
        if (oracle !== null) count(aggregate[axis], classification);
        return [axis, { oracle, baseline, counterfactual, classification }];
      })) as Record<XerFidelityAxis, XerReplayAxisResult>;
      const measurable = XER_FIDELITY_AXES.filter(axis => axes[axis].oracle !== null);
      const overall: XerReplayClassification = measurable.some(axis => axes[axis].classification === 'regressed')
        ? 'regressed'
        : measurable.some(axis => axes[axis].classification === 'improved')
          ? 'improved'
          : 'unchanged';
      if (measurable.length > 0) count(aggregate.overall, overall);
      results.push({ projectId, taskId: truthTask.taskId, taskCode, predicate, axes, overall });
      predicates.delete(predicateKey);
    }
  }
  if (predicates.size > 0) {
    const extra = predicates.values().next().value as XerReplayPredicateLog;
    throw new Error(`task replay: extra predicate ${extra.projectId}/${extra.taskCode}`);
  }
  return { tasks: results, predicate: [...input.predicate], aggregate };
}

/** De acceptatiepoort: netto winst kan nooit een regressie op welke as dan ook wegstrepen. */
export function shouldRejectXerTaskReplay(result: XerTaskReplayResult): boolean {
  return XER_FIDELITY_AXES.some(axis => result.aggregate[axis].regressed > 0);
}
