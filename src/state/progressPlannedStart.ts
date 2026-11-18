import { solveInputFor } from '@/engine/scheduler/solveInput';
import { cloneTasksForSolve, plannedStartBeforeStatusShift, solveProject } from '@/engine/scheduler/solveProject';
import type { Task } from '@/types/task';
import { taskTriggerChanges } from '@/utils/taskDefaults';
import type { AppState } from './appStore';

type ProgressPlanning = Pick<AppState,
  'tasks' | 'sequences' | 'project' | 'calendar' | 'calendars'
  | 'cpmResult' | 'datesAsRecorded' | 'scheduleStale'>;

/** De eerste afleiding rekent zo nodig op een kopie, gedeeld door alle taken in deze invoer. */
export function progressPlannedStarts(
  state: ProgressPlanning, placementEdited = false,
): (task: Task) => string | undefined {
  if (state.datesAsRecorded && !placementEdited) return () => undefined;
  if (!placementEdited && (!state.scheduleStale || !state.cpmResult)) {
    return task => plannedStartBeforeStatusShift(state.cpmResult, task);
  }
  let result: ReturnType<typeof solveProject> | undefined;
  return task => {
    if (!result) {
      const input = solveInputFor(state.project, cloneTasksForSolve(state.tasks), state.sequences, state.calendar, state.calendars);
      result = solveProject({
        ...input,
        schedulingOptions: { ...input.schedulingOptions, unstartedIgnoresStatusDate: true },
      });
    }
    return result.error ? undefined : result.tasks.get(task.id)?.earlyStart;
  };
}

export function taskPlacementChanged(before: Task, after: Task): boolean {
  return taskTriggerChanges(before, after).levelingGaps
    || before.isMilestone !== after.isMilestone || before.isHammock !== after.isHammock;
}

/** Bij gecombineerde invoer telt de bewerkte taak mee vóór het percentage haar start vastlegt. */
export function progressPlannedStartAfterEdit(state: AppState, before: Task, edited: Task): string | undefined {
  if (!taskPlacementChanged(before, edited)) return progressPlannedStarts(state)(edited);
  const tasks = state.tasks.map(task => task.id === edited.id ? edited : task);
  return progressPlannedStarts({ ...state, tasks }, true)(edited);
}
