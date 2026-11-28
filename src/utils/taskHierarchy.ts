import type { Task } from '@/types/task';

export function isSummaryTask(task: Pick<Task, 'isSummary' | 'childIds'> | undefined): boolean {
  return task?.isSummary === true || (task?.childIds.length ?? 0) > 0;
}

export function isLeafTask(task: Task | undefined): boolean {
  return !!task && !isSummaryTask(task);
}
