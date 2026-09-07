import type { Task } from '@/types/task';
import { parseInstant } from '@/utils/dateUtils';

type P6SuspendResumeTask = Pick<Task, 'p6ProjectId' | 'p6SuspendResume' | 'time'>;

/**
 * Enige waarheid voor de P6 suspend/resume-route. De raw datums blijven universele taakdata;
 * alleen een expliciet P6-bron/opt-in-signaal met twee parseerbare, chronologische instanties mag
 * de P6-semantiek in writer, reader en solver activeren.
 */
export function hasValidP6SuspendResume(task: P6SuspendResumeTask): boolean {
  if (!task.p6ProjectId || task.p6SuspendResume !== true) return false;
  const { stop, resume } = task.time;
  if (!stop || !resume) return false;
  const stopTime = parseInstant(stop).getTime();
  const resumeTime = parseInstant(resume).getTime();
  return Number.isFinite(stopTime) && Number.isFinite(resumeTime) && stopTime <= resumeTime;
}

/** Wis uitsluitend een stale semantische opt-in; raw stop/resume blijven onaangeraakt. */
export function reconcileP6SuspendResume(task: P6SuspendResumeTask): void {
  if (task.p6SuspendResume === true && !hasValidP6SuspendResume(task)) {
    delete task.p6SuspendResume;
  }
}
