import { solveInputFor } from '@/engine/scheduler/solveInput';
import { cloneTasksForSolve, plannedStartBeforeStatusShift, solveProject } from '@/engine/scheduler/solveProject';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import type { Task } from '@/types/task';
import { taskTriggerChanges } from '@/utils/taskDefaults';
import type { AppState } from './appStore';

type ProgressPlanning = Pick<AppState,
  'tasks' | 'sequences' | 'project' | 'calendar' | 'calendars'
  | 'cpmResult' | 'datesAsRecorded' | 'scheduleStale'>;

/** Bereken de huidige plaatsing zonder de statusdatumvloer voor open werk. */
function solveProgressPlacement(state: ProgressPlanning): ReturnType<typeof solveProject> {
  const input = solveInputFor(state.project, cloneTasksForSolve(state.tasks), state.sequences, state.calendar, state.calendars);
  return solveProject({
    ...input,
    schedulingOptions: { ...input.schedulingOptions, unstartedIgnoresStatusDate: true },
  });
}

/** De eerste afleiding rekent zo nodig op een kopie, gedeeld door alle taken in deze invoer. */
export function progressPlannedStarts(
  state: ProgressPlanning, placementEdited = false,
): (task: Task) => string | undefined {
  if (state.datesAsRecorded && !placementEdited) return () => undefined;
  if (!placementEdited && !state.scheduleStale && state.cpmResult) {
    return task => plannedStartBeforeStatusShift(state.cpmResult, task);
  }
  let result: ReturnType<typeof solveProject> | undefined;
  return task => {
    result ??= solveProgressPlacement(state);
    return result.error ? undefined : result.tasks.get(task.id)?.earlyStart;
  };
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
  const initial = solveProgressPlacement(state);
  if (initial.error) return;

  const tasks = [...state.tasks];
  const indexes = new Map(tasks.map((task, index) => [task.id, index]));
  let lookup = state.datesAsRecorded
    ? progressPlannedStarts(state)
    : (task: Task) => initial.tasks.get(task.id)?.earlyStart;
  // De CPM-resultaten volgen de voorwaartse pass, inclusief uitgerolde verzameltaakrelaties.
  const order = [...initial.tasks.keys()].filter(id => ids.has(id));
  return {
    order,
    plannedStart: (task: Task) => lookup(task),
    accept: (before: Task, after: Task) => {
      const index = indexes.get(before.id);
      if (index === undefined || !taskPlacementChanged(before, after)) return;
      tasks[index] = after;
      if (canShiftOtherTasks(before.id)) {
        lookup = progressPlannedStarts({ ...state, tasks, project: { ...state.project, statusDate } }, true);
      }
    },
  };
}

/** Bij gecombineerde invoer telt de bewerkte taak mee vóór het percentage haar start vastlegt. */
export function progressPlannedStartAfterEdit(state: AppState, before: Task, edited: Task): string | undefined {
  if (!taskPlacementChanged(before, edited)) return progressPlannedStarts(state)(edited);
  const tasks = state.tasks.map(task => task.id === edited.id ? edited : task);
  return progressPlannedStarts({ ...state, tasks }, true)(edited);
}
