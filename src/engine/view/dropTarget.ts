import type { Task } from '@/types/task';
import type { ViewRow } from './visibleRows';
import { isLeafTask } from '@/utils/taskHierarchy';

export interface DropTarget {
  parentId: string | null;
  childIndex: number;
}

export function resolveDropTarget(
  rows: readonly ViewRow[],
  rowIndex: number,
  zone: 'before' | 'after' | 'nest',
  tasksById: Map<string, Task>,
  draggedTaskId?: string,
): DropTarget | null {
  const row = rows[rowIndex];
  if (!row || row.kind === 'group') return null;
  if (row.kind === 'milestones' && zone === 'nest') return null;
  const refTask = row.kind === 'task' ? row.task
    : zone === 'before' ? row.tasks[0] : row.tasks[row.tasks.length - 1];

  if (zone === 'nest') {
    if (isLeafTask(refTask)) return null;
    return { parentId: refTask.id, childIndex: refTask.childIds.length };
  }

  const parentId = refTask.parentId;
  const siblingIds = siblingIdsOf(parentId, rows, tasksById);
  const refIdx = siblingIds.indexOf(refTask.id);
  const base = refIdx >= 0 ? refIdx : siblingIds.length;

  let childIndex = zone === 'before' ? base : Math.min(base + 1, siblingIds.length);

  if (draggedTaskId !== undefined) {
    const dragIdx = siblingIds.indexOf(draggedTaskId);
    if (dragIdx >= 0 && dragIdx < childIndex) childIndex -= 1;
  }

  return { parentId, childIndex };
}

function siblingIdsOf(
  parentId: string | null,
  rows: readonly ViewRow[],
  tasksById: Map<string, Task>,
): string[] {
  if (parentId !== null) {
    return tasksById.get(parentId)?.childIds ?? [];
  }
  return rows.flatMap((r) => (r.kind === 'task' ? [r.task] : r.kind === 'milestones' ? r.tasks : []))
    .filter((t) => t.parentId === null)
    .map((t) => t.id);
}
