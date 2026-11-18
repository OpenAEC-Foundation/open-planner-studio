import { solveInputFor } from '@/engine/scheduler/solveInput';
import { cloneTasksForSolve, plannedStartBeforeStatusShift, solveProject } from '@/engine/scheduler/solveProject';
import type { Task } from '@/types/task';
import { taskTriggerChanges } from '@/utils/taskDefaults';
import type { AppState } from './appStore';
import { originalAppState } from './immerDraft';

export function progressPlannedStart(
  state: Pick<AppState, 'cpmResult' | 'datesAsRecorded'>, task: Task,
): string | undefined {
  return state.datesAsRecorded ? undefined
    : plannedStartBeforeStatusShift(state.cpmResult, task);
}

/** Bij gecombineerde invoer telt de bewerkte taak mee vóór het percentage haar start vastlegt. */
export function progressPlannedStartAfterEdit(state: AppState, before: Task, edited: Task): string | undefined {
  if (!taskTriggerChanges(before, edited).levelingGaps
    && before.isMilestone === edited.isMilestone && before.isHammock === edited.isHammock) {
    return progressPlannedStart(originalAppState(state) ?? state, edited);
  }
  const tasks = cloneTasksForSolve(state.tasks.map(task => task.id === edited.id ? edited : task));
  const input = solveInputFor(state.project, tasks, state.sequences, state.calendar, state.calendars);
  return solveProject({
    ...input,
    schedulingOptions: { ...input.schedulingOptions, unstartedIgnoresStatusDate: true },
  }).tasks.get(edited.id)?.earlyStart;
}
