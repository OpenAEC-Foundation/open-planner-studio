import { plannedStartBeforeStatusShift } from '@/engine/scheduler/solveProject';
import type { Task } from '@/types/task';
import type { AppState } from './appStore';

export function progressPlannedStart(
  state: Pick<AppState, 'cpmResult' | 'datesAsRecorded'>, task: Task,
): string | undefined {
  return state.datesAsRecorded ? undefined
    : plannedStartBeforeStatusShift(state.cpmResult, task);
}
