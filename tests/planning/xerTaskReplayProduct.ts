import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';
import { solveProject } from '@/engine/scheduler/solveProject';
import type { CPMPlannedFloorTrace } from '@/engine/scheduler/CPMSolver';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readXER } from '@/services/xer/xerReader';
import type { WorkCalendar } from '@/types/calendar';
import type { ResourceAssignment } from '@/types/resource';
import type { Sequence } from '@/types/sequence';
import type { Task } from '@/types/task';
import type { XerSolvedProject } from './xerFidelity';
import type { XerReplayPredicateLog } from './xerTaskReplay';

export interface XerReplaySourceContext {
  projectId: string;
  task: Readonly<Task>;
  incoming: readonly Readonly<Sequence>[];
  outgoing: readonly Readonly<Sequence>[];
  projectCalendar: Readonly<WorkCalendar>;
  taskCalendar: Readonly<WorkCalendar>;
  assignments: readonly Readonly<ResourceAssignment>[];
  schedulingOptions: ImportResult['project']['schedulingOptions'];
}

export interface XerReplayPredicateDecision {
  matched: boolean;
  source: Readonly<Record<string, string | number | boolean | null>>;
}

export interface XerTaskReplayCandidate {
  id: string;
  /** `baseline` modelleert een regelintegratie na de bestaande solve; `source` twee gelijke bronruns. */
  replayFrom: 'baseline' | 'source';
  predicate(context: XerReplaySourceContext): XerReplayPredicateDecision;
  /** Test-only mutatie op een verse clone. Oraclewaarden zijn niet beschikbaar in deze API. */
  apply(imported: XerReplayMutableSolveInput, matchedTaskCodes: ReadonlySet<string>): void;
}

export type XerReplayMutableSolveInput = Pick<
  ImportResult,
  'project' | 'calendar' | 'tasks' | 'sequences' | 'resourceCalendars'
>;

export interface XerProductReplayBeforeOracle {
  candidateId: string;
  baseline: XerSolvedProject[];
  counterfactual: XerSolvedProject[];
  predicate: XerReplayPredicateLog[];
  projectsSolvedSequentially: number;
}

export interface XerReplayLifecycleEvent {
  projectId: string;
  phase: 'baseline' | 'counterfactual';
  inputOrigin: 'fresh-source-clone' | 'baseline-solved-clone';
  activeSolveClones: number;
}

export interface XerReplayOptions {
  /** Testinstrumentatie: één event binnen de levensduur van iedere actieve solveclone. */
  onLifecycleEvent?: (event: XerReplayLifecycleEvent) => void;
}

function canonicalProductMinute(value: string | undefined): string | undefined {
  return value?.match(/^\d{4}-\d{2}-\d{2}$/) ? `${value}T00:00` : value;
}

/** Eén solvegraph tegelijk; de projectie bewaart daarna alleen taakuitkomsten en replaytrace. */
interface XerReplaySolveResult {
  project: XerSolvedProject;
  plannedFloorTraceByTaskCode: Readonly<Record<string, CPMPlannedFloorTrace>>;
}

function solveImported(imported: XerReplayMutableSolveInput): XerReplaySolveResult {
  const cpm = solveProject({
    tasks: imported.tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: imported.project.schedulingOptions,
    projectStartDate: imported.project.startDate,
    projectEndDate: imported.project.endDate,
  });
  if (cpm.error) throw new Error(`task replay ${imported.project.id}: ${cpm.error}`);
  const calendars = new Map<string, WorkCalendar>([
    [imported.calendar.id, imported.calendar],
    ...(imported.resourceCalendars ?? []).map(calendar => [calendar.id, calendar] as const),
  ]);
  const floatMinutesPerDay = new Map([...calendars].map(([id, calendar]) => [
    id,
    new CalendarEngine(calendar).hoursPerDay * 60,
  ]));
  const sourceTaskById = new Map(imported.tasks.map(task => [task.id, task] as const));
  const plannedFloorTraceByTaskCode = Object.fromEntries(Object.entries(cpm.plannedFloorTraceByTaskId ?? {})
    .flatMap(([taskId, trace]) => {
      const taskCode = sourceTaskById.get(taskId)?.wbsCode;
      return taskCode ? [[taskCode, trace] as const] : [];
    }));
  return {
    plannedFloorTraceByTaskCode,
    project: {
      projectId: imported.project.id,
      tasks: imported.tasks.filter(task => task.p6ActivityType !== undefined).map(task => {
        const calendar = (task.calendarId ? calendars.get(task.calendarId) : undefined) ?? imported.calendar;
        const minutesPerDay = floatMinutesPerDay.get(calendar.id)!;
        return {
          sourceTaskId: task.id,
          taskCode: task.wbsCode,
          earlyStart: canonicalProductMinute(task.time.earlyStart),
          earlyFinish: canonicalProductMinute(task.time.earlyFinish),
          lateStart: canonicalProductMinute(task.time.lateStart),
          lateFinish: canonicalProductMinute(task.time.lateFinish),
          totalFloatMinutes: task.time.totalFloat * minutesPerDay,
          freeFloatMinutes: task.time.freeFloat * minutesPerDay,
          drivingPath: task.time.isCritical,
        };
      }),
    },
  };
}

/** Geen retained XER-archief, resources, assignments, codes of baselines in de solveclone. */
function cloneSolveInput(imported: ImportResult): XerReplayMutableSolveInput {
  return structuredClone({
    project: imported.project,
    calendar: imported.calendar,
    tasks: imported.tasks,
    sequences: imported.sequences,
    resourceCalendars: imported.resourceCalendars,
  });
}

function sourceContexts(imported: ImportResult): XerReplaySourceContext[] {
  const incoming = new Map<string, Sequence[]>();
  const outgoing = new Map<string, Sequence[]>();
  for (const sequence of imported.sequences) {
    const inList = incoming.get(sequence.successorId) ?? [];
    inList.push(sequence);
    incoming.set(sequence.successorId, inList);
    const outList = outgoing.get(sequence.predecessorId) ?? [];
    outList.push(sequence);
    outgoing.set(sequence.predecessorId, outList);
  }
  const calendars = new Map<string, WorkCalendar>([
    [imported.calendar.id, imported.calendar],
    ...(imported.resourceCalendars ?? []).map(calendar => [calendar.id, calendar] as const),
  ]);
  const assignments = new Map<string, ResourceAssignment[]>();
  for (const assignment of imported.assignments) {
    const list = assignments.get(assignment.taskId) ?? [];
    list.push(assignment);
    assignments.set(assignment.taskId, list);
  }
  return imported.tasks.filter(task => task.p6ActivityType !== undefined).map(task => ({
    projectId: imported.project.id,
    task,
    incoming: incoming.get(task.id) ?? [],
    outgoing: outgoing.get(task.id) ?? [],
    projectCalendar: imported.calendar,
    taskCalendar: (task.calendarId ? calendars.get(task.calendarId) : undefined) ?? imported.calendar,
    assignments: assignments.get(task.id) ?? [],
    schedulingOptions: imported.project.schedulingOptions,
  }));
}

function materializedBaselineProjects(imported: ImportResult): XerSolvedProject[] {
  return (imported.baselines ?? []).flatMap(baseline => {
    if (!baseline.sourceProjectId) return [];
    return [{
      projectId: baseline.sourceProjectId,
      tasks: baseline.tasks.map(task => ({
        sourceTaskId: task.sourceTaskId ?? task.taskId,
        taskCode: task.sourceTaskCode ?? '',
        earlyStart: canonicalProductMinute(task.start),
        earlyFinish: canonicalProductMinute(task.finish),
      })),
    }];
  });
}

function addProject(target: Map<string, XerSolvedProject>, project: XerSolvedProject, kind: string): void {
  if (target.has(project.projectId)) throw new Error(`task replay: dubbel ${kind}project ${project.projectId}`);
  target.set(project.projectId, project);
}

/**
 * Productdeel van één manifestentry. Predicate, baseline en counterfactual worden hier volledig
 * zonder grondwaarheid berekend. Per geopend project leeft steeds maar één solveclone tegelijk.
 */
export function replayXerProductBeforeOracle(
  bytes: Uint8Array,
  candidate: XerTaskReplayCandidate,
  options: XerReplayOptions = {},
): XerProductReplayBeforeOracle {
  const opened = readXER(bytes);
  const imports = isMultiDocumentImport(opened)
    ? opened.taskProjects.map(document => document.result)
    : [opened];
  const baseline = new Map<string, XerSolvedProject>();
  const counterfactual = new Map<string, XerSolvedProject>();
  const predicate: XerReplayPredicateLog[] = [];
  let projectsSolvedSequentially = 0;
  let activeSolveClones = 0;

  function solveOne(
    imported: XerReplayMutableSolveInput,
    phase: XerReplayLifecycleEvent['phase'],
    inputOrigin: XerReplayLifecycleEvent['inputOrigin'],
  ): XerReplaySolveResult {
    activeSolveClones++;
    try {
      options.onLifecycleEvent?.({
        projectId: imported.project.id,
        phase,
        inputOrigin,
        activeSolveClones,
      });
      return solveImported(imported);
    } finally {
      activeSolveClones--;
    }
  }

  for (const imported of imports) {
    const decisions = sourceContexts(imported).map(context => ({
      context,
      decision: candidate.predicate(context),
    }));
    const matchedTaskCodes = new Set(decisions
      .filter(({ decision }) => decision.matched)
      .map(({ context }) => context.task.wbsCode));
    predicate.push(...decisions.map(({ context, decision }) => ({
      projectId: context.projectId,
      taskCode: context.task.wbsCode,
      matched: decision.matched,
      source: decision.source,
    })));

    const replayInput = cloneSolveInput(imported);
    const baselineSolve = solveOne(replayInput, 'baseline', 'fresh-source-clone');
    for (const log of predicate) {
      if (log.projectId !== imported.project.id) continue;
      const trace = baselineSolve.plannedFloorTraceByTaskCode[log.taskCode];
      if (!trace) continue;
      log.source = {
        ...log.source,
        plannedFloorTracePreFloorEarlyStart: trace.preFloorEarlyStart,
        plannedFloorTracePreFloorEarlyFinish: trace.preFloorEarlyFinish,
        plannedFloorTraceTargetStart: trace.targetStart,
        plannedFloorTraceTargetFinish: trace.targetFinish,
        plannedFloorTracePlannedWindowIsLater: trace.plannedWindowIsLater,
        plannedFloorTraceBoundarySource: trace.boundarySource,
        ...(trace.boundarySequenceId
          ? { plannedFloorTraceBoundarySequenceId: trace.boundarySequenceId }
          : {}),
        ...(trace.boundaryPredecessorTaskCode
          ? { plannedFloorTraceBoundaryPredecessorTaskCode: trace.boundaryPredecessorTaskCode }
          : {}),
      };
    }
    addProject(baseline, baselineSolve.project, 'baseline');
    projectsSolvedSequentially++;

    const inputOrigin = candidate.replayFrom === 'source'
      ? 'fresh-source-clone'
      : 'baseline-solved-clone';
    if (candidate.replayFrom === 'source') Object.assign(replayInput, cloneSolveInput(imported));
    candidate.apply(replayInput, matchedTaskCodes);
    addProject(counterfactual, solveOne(replayInput, 'counterfactual', inputOrigin).project, 'counterfactual');
    projectsSolvedSequentially++;
  }

  for (const imported of imports) {
    for (const project of materializedBaselineProjects(imported)) {
      if (baseline.has(project.projectId)) continue;
      addProject(baseline, project, 'baseline');
      addProject(counterfactual, structuredClone(project), 'counterfactual');
      predicate.push(...project.tasks.map(task => ({
        projectId: project.projectId,
        taskCode: task.taskCode,
        matched: false,
        source: { materializedBaseline: true },
      })));
    }
  }

  return {
    candidateId: candidate.id,
    baseline: [...baseline.values()],
    counterfactual: [...counterfactual.values()],
    predicate,
    projectsSolvedSequentially,
  };
}

export const syntheticZeroRegressionCandidate: XerTaskReplayCandidate = {
  id: 'synthetic-zero-regression',
  replayFrom: 'source',
  predicate: context => ({
    matched: false,
    source: {
      p6Source: context.schedulingOptions?.p6Source ?? null,
      activityType: context.task.p6ActivityType ?? null,
    },
  }),
  apply: () => undefined,
};

/** Onderzoeks-counterfactual vanaf een verse XER-bronclone: verwijder alleen de finish-milestone-boundary. */
export const dropFinishMilestoneBoundaryCandidate: XerTaskReplayCandidate = {
  id: 'drop-p6-finish-milestone-boundary',
  replayFrom: 'source',
  predicate: context => {
    const source = {
      p6Source: context.schedulingOptions?.p6Source ?? null,
      boundaryEnabled: context.schedulingOptions?.p6FinishMilestoneBoundaryWindow === true,
      useProjectEndDateForFloat: context.schedulingOptions?.useProjectEndDateForFloat === true,
      activityType: context.task.p6ActivityType ?? null,
      milestoneKind: context.task.milestoneKind ?? null,
      zeroDurationMilestone: isZeroDurationMilestone(context.task),
      predecessorCount: context.incoming.length,
      successorCount: context.outgoing.length,
      calendarHoursPerDay: context.taskCalendar.hoursPerDay,
      assignmentCount: context.assignments.length,
    };
    return {
      matched: source.p6Source === 'XER'
        && source.boundaryEnabled,
      source,
    };
  },
  apply: (imported, matchedTaskCodes) => {
    if (matchedTaskCodes.size === 0) return;
    const schedulingOptions = imported.project.schedulingOptions;
    if (!schedulingOptions || schedulingOptions.p6Source !== 'XER') return;
    imported.project.schedulingOptions = {
      ...schedulingOptions,
      p6FinishMilestoneBoundaryWindow: false,
    };
  },
};
