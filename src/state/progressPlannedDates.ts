import { solveInputFor } from '@/engine/scheduler/solveInput';
import { cloneTasksForSolve, plannedDatesBeforeStatusShift, solveProject } from '@/engine/scheduler/solveProject';
import { expandSummaryRelations, leafTasksForSolve } from '@/engine/scheduler/expandSummaryRelations';
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import type { PlannedProgressDates } from '@/engine/taskMutationRules';
import type { Task } from '@/types/task';
import { taskTriggerChanges } from '@/utils/taskDefaults';
import type { AppState } from './appStore';

type ProgressPlanning = Pick<AppState,
  'tasks' | 'sequences' | 'project' | 'calendar' | 'calendars'
  | 'cpmResult' | 'datesAsRecorded' | 'scheduleStale'>;

/** Reken op een kopie zonder de statusdatumvloer voor open werk. */
function progressSolveInput(state: ProgressPlanning) {
  const input = solveInputFor(state.project, cloneTasksForSolve(state.tasks), state.sequences, state.calendar, state.calendars);
  return {
    ...input,
    schedulingOptions: { ...input.schedulingOptions, unstartedIgnoresStatusDate: true },
  };
}

function solveProgressPlacement(state: ProgressPlanning): ReturnType<typeof solveProject> {
  return solveProject(progressSolveInput(state));
}

/** De eerste afleiding rekent zo nodig op een kopie, gedeeld door alle taken in deze invoer. */
export function progressPlannedDates(
  state: ProgressPlanning, placementEdited = false,
): (task: Task) => PlannedProgressDates | undefined {
  if (state.datesAsRecorded && !placementEdited) return () => undefined;
  if (!placementEdited && !state.scheduleStale && state.cpmResult) {
    return task => plannedDatesBeforeStatusShift(state.cpmResult, task);
  }
  let result: ReturnType<typeof solveProject> | undefined;
  return task => {
    result ??= solveProgressPlacement(state);
    return result.error ? undefined : result.tasks.get(task.id);
  };
}

function createProgressForwardPass(state: ProgressPlanning) {
  const input = progressSolveInput(state);
  const tasks = leafTasksForSolve(input.tasks);
  const byId = new Map(tasks.map(task => [task.id, task]));
  const { sequences } = expandSummaryRelations(input.tasks, input.sequences);
  const solver = new CPMSolver(tasks, sequences, input.calendar, input.calendars, input);
  const forward = solver.createIncrementalForwardPass();
  if (!forward) return;
  return {
    order: forward.order,
    earlyDates: forward.earlyDates,
    accept(task: Task): boolean {
      const work = byId.get(task.id);
      if (!work || (task.time.completion >= 1 && !task.time.actualFinish)
        || work.time.scheduleStart !== task.time.scheduleStart || work.time.scheduleFinish !== task.time.scheduleFinish
        || work.time.scheduleDuration !== task.time.scheduleDuration || work.time.durationMinutes !== task.time.durationMinutes
        || work.time.durationType !== task.time.durationType || work.time.durationUnit !== task.time.durationUnit) return false;
      work.time = { ...task.time };
      work.status = task.status;
      work.splitGaps = task.splitGaps;
      forward.markChanged(task.id);
      return true;
    },
  };
}

type ProgressForwardPass = NonNullable<ReturnType<typeof createProgressForwardPass>>;

interface LiveProgressPlan {
  lookup: ReturnType<typeof progressPlannedDates>;
  forward?: ProgressForwardPass;
}

const liveProgressStarts = new WeakMap<AppState, LiveProgressPlan>();

function lookupWithForward(state: ProgressPlanning, forward?: ProgressForwardPass, placementEdited = false) {
  const fallback = progressPlannedDates(state, placementEdited);
  return (task: Task): PlannedProgressDates | undefined => (
    (task.time.completion < 1 ? forward?.earlyDates(task.id) : undefined) ?? fallback(task)
  );
}

/** Hergebruik de rekenstand voor dezelfde momentopname. */
export function liveProgressPlannedDates(state: AppState): ReturnType<typeof progressPlannedDates> {
  let plan = liveProgressStarts.get(state);
  if (!plan) {
    const forward = !state.datesAsRecorded && (state.scheduleStale || !state.cpmResult)
      ? createProgressForwardPass(state) : undefined;
    plan = { lookup: lookupWithForward(state, forward), forward };
    liveProgressStarts.set(state, plan);
  }
  return plan.lookup;
}

/** Na één bekende voortgangsmutatie is alleen het gewijzigde blad met zijn opvolgers verouderd. */
export function carryLiveProgressPlan(before: AppState, after: AppState, taskId: string): void {
  if (before === after || before.tasks === after.tasks) return;
  const forward = liveProgressStarts.get(before)?.forward;
  if (!forward || before.project !== after.project || before.activeDocumentId !== after.activeDocumentId
    || before.sequences !== after.sequences || before.calendars !== after.calendars || before.calendar !== after.calendar
    || before.datesAsRecorded !== after.datesAsRecorded || before.cpmResult !== after.cpmResult) return;
  const index = before.tasks.findIndex(item => item.id === taskId);
  const task = after.tasks[index];
  if (!task || task.id !== taskId || before.tasks.length !== after.tasks.length
    || before.tasks.some((item, i) => i !== index && item !== after.tasks[i])
    || !forward.accept(task)) return;
  // Verplaats de rekenstand. Een vorige momentopname kan later via Ctrl+Z terugkomen.
  liveProgressStarts.delete(before);
  liveProgressStarts.set(after, { lookup: lookupWithForward(after, forward), forward });
}

export function taskPlacementChanged(before: Task, after: Task): boolean {
  return taskTriggerChanges(before, after).levelingGaps
    || before.isMilestone !== after.isMilestone || before.milestoneKind !== after.milestoneKind
    || before.isHammock !== after.isHammock || before.time.remainingTime !== after.time.remainingTime
    || before.time.remainingMinutes !== after.time.remainingMinutes;
}

/** Voortgang van deze taken kan de geplande datum van een andere taak wijzigen. */
export function progressCanShiftOtherTasks(state: Pick<AppState, 'tasks' | 'sequences'>): (id: string) => boolean {
  if (state.tasks.some(task => task.isHammock || task.constraint?.type === 'ALAP' || task.constraint2?.type === 'ALAP')) {
    return () => true;
  }
  const { sequences } = expandSummaryRelations(state.tasks, state.sequences);
  const predecessors = new Set(sequences.map(sequence => sequence.predecessorId));
  return id => predecessors.has(id);
}

/** Toets de taken in relatievolgorde, met alleen de al aanvaarde voortgang als extra invoer. */
export function progressPlacementForBatch(
  state: ProgressPlanning, ids: ReadonlySet<string>, statusDate: string | undefined,
) {
  if (ids.size < 2) return;
  const canShiftOtherTasks = progressCanShiftOtherTasks(state);
  if (![...ids].some(canShiftOtherTasks)) return;
  let forward = state.datesAsRecorded ? undefined : createProgressForwardPass(state);
  const initial = forward ? undefined : solveProgressPlacement(state);
  if (initial?.error) return;

  const tasks = [...state.tasks];
  const indexes = new Map(tasks.map((task, index) => [task.id, index]));
  let lookup = initial && !state.datesAsRecorded
    ? (task: Task) => initial.tasks.get(task.id)
    : lookupWithForward(state, forward);
  let activeStatusDate = state.project.statusDate;
  const order = (forward?.order ?? [...initial!.tasks.keys()]).filter(id => ids.has(id));
  return {
    order,
    plannedDates: (task: Task) => lookup(task),
    accept: (before: Task, after: Task) => {
      const index = indexes.get(before.id);
      if (index === undefined || !taskPlacementChanged(before, after)) return;
      tasks[index] = after;
      if (canShiftOtherTasks(before.id)) {
        const updated = { ...state, tasks, project: { ...state.project, statusDate } };
        if (activeStatusDate !== statusDate) forward = createProgressForwardPass(updated);
        else if (forward && !forward.accept(after)) forward = undefined;
        activeStatusDate = statusDate;
        lookup = lookupWithForward(updated, forward, true);
      }
    },
  };
}

/** Bij gecombineerde invoer telt de bewerkte plaatsing mee, vóór de conceptvoortgang. */
export function progressPlannedDatesAfterEdit(state: AppState, before: Task, edited: Task): PlannedProgressDates | undefined {
  const { completion, actualStart, actualFinish } = before.time;
  const placement = !actualStart && edited.time.actualStart
    ? { ...edited, status: before.status, time: { ...edited.time, completion, actualStart, actualFinish } }
    : edited;
  if (!taskPlacementChanged(before, placement)) return progressPlannedDates(state)(placement);
  const tasks = state.tasks.map(task => task.id === placement.id ? placement : task);
  return progressPlannedDates({ ...state, tasks }, true)(placement);
}
