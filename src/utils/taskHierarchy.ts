import type { Task } from '@/types/task';

/** Eén bron voor de semantische WBS-identiteit. Een expliciete lege samenvatting is nooit blad. */
export function isSummaryTask(task: Task | undefined): boolean {
  return task?.isSummary === true || (task?.childIds.length ?? 0) > 0;
}

export function isLeafTask(task: Task | undefined): boolean {
  return !!task && !isSummaryTask(task);
}
