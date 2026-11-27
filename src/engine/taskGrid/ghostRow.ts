import type { Task } from '@/types/task';
import type { GridIntent, GridWriteIntent } from '@/types/taskGrid';
import { isTreeMode, type ViewRow } from '@/engine/view/visibleRows';

export const GHOST_ROW_KEY = 'ops-ghost-row';
export const GHOST_TASK_ID = 'ops-ghost-task';

export function hasGhostRow(view: Parameters<typeof isTreeMode>[0]): boolean {
  return isTreeMode(view);
}

export function isGhostTaskId(id: string | null | undefined): boolean {
  return id === GHOST_TASK_ID;
}

export function lastTaskRow(rows: readonly ViewRow[]): Extract<ViewRow, { kind: 'task' }> | null {
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index];
    if (row.kind === 'task' && !isGhostTaskId(row.task.id)) return row;
  }
  return null;
}

export function appendGhostRow(rows: readonly ViewRow[], ghostTask: Task): ViewRow[] {
  const last = lastTaskRow(rows);
  return [...rows, { kind: 'task', rowKey: GHOST_ROW_KEY, task: ghostTask, depth: last?.depth ?? 0, dimmed: false }];
}

export function intentsTouchGhost(intents: readonly GridIntent[]): boolean {
  return intents.some(intent => intent.kind === 'paste'
    ? intent.writes.some(write => isGhostTaskId(write.taskId))
    : isGhostTaskId(intent.taskId));
}

function retargetWrite(write: GridWriteIntent, taskId: string): GridWriteIntent {
  return isGhostTaskId(write.taskId) ? { ...write, taskId } : write;
}

export function retargetGhostIntents(intents: readonly GridIntent[], taskId: string): GridIntent[] {
  return intents.map(intent => intent.kind === 'paste'
    ? { ...intent, writes: intent.writes.map(write => retargetWrite(write, taskId)) }
    : retargetWrite(intent, taskId));
}
