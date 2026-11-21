import { solveInputFor, solveOptionsFor } from '@/engine/scheduler/solveInput';
import { cloneTasksForSolve, plannedDatesBeforeStatusShift, solveProject } from '@/engine/scheduler/solveProject';
import { expandSummaryRelations, leafTasksForSolve } from '@/engine/scheduler/expandSummaryRelations';
import { CPMSolver, type CPMResult } from '@/engine/scheduler/CPMSolver';
import { settleDurationAftermath } from '@/engine/work/workRuleApply';
import type { PlannedProgressDates } from '@/engine/taskMutationRules';
import type { Task } from '@/types/task';
import { clearLevelingGaps, hourInputFinishBasis, taskCalendarHoursPerDay, taskTriggerChanges, taskWorkMinutesOf } from '@/utils/taskDefaults';
import { sameValue } from '@/utils/sameValue';
import type { Snapshot } from './snapshot';
import type { AppState } from './appStore';

type ProgressPlanning = Pick<AppState,
  'tasks' | 'sequences' | 'project' | 'calendar' | 'calendars'
  | 'cpmResult' | 'datesAsRecorded' | 'scheduleStale'>
  & Partial<Pick<AppState, 'activeDocumentId' | 'historyEvents'>>;

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

/** De taak zoals ze vóór nog niet doorgerekende eigen voortgang stond. De andere taken
 * blijven bij een nieuwe berekening op hun actuele stand, ook als een voorganger veranderde. */
function earlierProgressTask(state: ProgressPlanning, task: Task): { before: Snapshot; task: Task } | undefined {
  const events = state.historyEvents;
  if (!events || !state.scheduleStale || !task.time.actualStart || task.time.actualFinish) return undefined;
  const index = state.tasks.findIndex(item => item.id === task.id);
  let current = task;
  let project = state.project;
  let earlier: { before: Snapshot; task: Task } | undefined;
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.state !== 'applied') continue;
    const delta = event.deltas.find(item => item.kind === 'document-data' && item.documentId === state.activeDocumentId);
    if (delta?.kind !== 'document-data') continue;
    const { before } = delta;
    if (before.cpmResult !== state.cpmResult || before.calendar !== state.calendar
      || before.calendars !== state.calendars || before.sequences !== state.sequences) break;
    const previous = before.tasks[index];
    if (previous?.id !== task.id) break;
    const hasProgressEdit = taskPlacementChanged(previous, current);
    const placement = { ...previous };
    if (hasProgressEdit && !sameValue(previous.splitGaps, current.splitGaps)) clearLevelingGaps(placement);
    if (progressLocationChanged(placement, current)) break;
    const options = solveOptionsFor(project);
    const previousOptions = solveOptionsFor(before.project);
    // De eerste voortgang mag tegelijk automatisch de statusdatum op vandaag hebben gezet.
    if (hasProgressEdit && !previousOptions.dataDate) options.dataDate = undefined;
    if (!sameValue(options, previousOptions)) break;
    if (hasProgressEdit) {
      earlier = { before, task: previous };
      if (!previous.time.actualStart) break;
    }
    current = previous;
    project = before.project;
  }
  return earlier;
}

function progressLocationChanged(before: Task, after: Task): boolean {
  const { actualStart, actualFinish, completion, remainingTime, remainingMinutes } = before.time;
  const placement = { ...after, time: { ...after.time, actualStart, actualFinish, completion, remainingTime, remainingMinutes } };
  return taskPlacementChanged(before, placement)
    || before.parentId !== after.parentId || !sameValue(before.childIds, after.childIds)
    || before.manuallyScheduled !== after.manuallyScheduled || !sameValue(before.resourceIds, after.resourceIds)
    || before.time.resume !== after.time.resume
    || before.levelingDelay !== after.levelingDelay || before.levelingDelayMinutes !== after.levelingDelayMinutes
    || before.levelingDelayElapsed !== after.levelingDelayElapsed
    || !sameValue(before.splitGaps, after.splitGaps)
    || !sameValue(before.externalLinks, after.externalLinks)
    || !sameValue(before.timephasedDurationWalks, after.timephasedDurationWalks)
    || before.timephasedStartAnchor !== after.timephasedStartAnchor || before.timephasedFinishFloor !== after.timephasedFinishFloor;
}

/** De eerste afleiding rekent zo nodig op een kopie, gedeeld door alle taken in deze invoer. */
export function progressPlannedDates(
  state: ProgressPlanning, placementEdited = false, forward?: ProgressForwardPass, solved?: CPMResult,
): (task: Task) => PlannedProgressDates | undefined {
  if (state.datesAsRecorded && !placementEdited) return () => undefined;
  let result = solved;
  return task => {
    const earlier = earlierProgressTask(state, task);
    if (earlier) {
      const { before } = earlier;
      const othersUnchanged = before.tasks.length === state.tasks.length
        && before.tasks.every((item, i) => {
          const latest = state.tasks[i];
          return item === latest || item.id === latest.id && (item.id === task.id
            || (!taskPlacementChanged(item, latest) && !progressLocationChanged(item, latest)));
        });
      if (othersUnchanged && !placementEdited) {
        return progressPlannedDates(before)(earlier.task) ?? earlier.task.time;
      }
      const tasks = state.tasks.map(item => item.id === task.id ? earlier.task : item);
      const result = solveProgressPlacement({ ...state, tasks });
      return result.error ? undefined : result.tasks.get(task.id);
    }
    if (solved) return solved.tasks.get(task.id);
    const placed = task.time.completion < 1 ? forward?.earlyDates(task.id) : undefined;
    if (placed) return placed;
    if (!placementEdited && !state.scheduleStale && state.cpmResult) {
      return plannedDatesBeforeStatusShift(state.cpmResult, task);
    }
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

/** Hergebruik de rekenstand voor dezelfde momentopname. */
export function liveProgressPlannedDates(state: AppState): ReturnType<typeof progressPlannedDates> {
  let plan = liveProgressStarts.get(state);
  if (!plan) {
    const forward = !state.datesAsRecorded && (state.scheduleStale || !state.cpmResult)
      ? createProgressForwardPass(state) : undefined;
    plan = { lookup: progressPlannedDates(state, false, forward), forward };
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
  liveProgressStarts.set(after, { lookup: progressPlannedDates(after, false, forward), forward });
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
  let lookup = progressPlannedDates(state, false, forward, initial);
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
        lookup = progressPlannedDates(updated, true, forward);
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
  const updated = { ...placement };
  const changes = taskTriggerChanges(before, updated);
  if (changes.timeBase) {
    const hoursPerDay = taskCalendarHoursPerDay(before, state.calendars, state.calendar);
    settleDurationAftermath(updated, state, taskWorkMinutesOf(before, hoursPerDay), hourInputFinishBasis(before));
  } else if (changes.levelingGaps) clearLevelingGaps(updated);
  const tasks = state.tasks.map(task => task.id === updated.id ? updated : task);
  return progressPlannedDates({ ...state, tasks }, true)(updated);
}
