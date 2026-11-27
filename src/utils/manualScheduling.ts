import type { Task } from '@/types/task';

export function isManuallyScheduled(task: Pick<Task, 'manuallyScheduled'>): boolean {
  return task.manuallyScheduled === true;
}
