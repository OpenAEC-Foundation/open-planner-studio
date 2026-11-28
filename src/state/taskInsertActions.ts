import { useAppStore } from '@/state/appStore';
import { firstRowIndexByTask, isTreeMode } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';
import { lastTaskRow } from '@/engine/taskGrid/ghostRow';
import { refusalNotice } from '@/state/refusalNotice';

export type InsertWhere = 'above' | 'below';

export type NewTaskInput = Partial<Task> & { name: string };

function finishNewTask(id: string): string {
  const store = useAppStore.getState();
  store.focusOnTask(id, { preserveZoom: true });
  store.setUI({ showPropertiesPanel: true, pendingTaskNameFocusId: id });
  return id;
}

export function insertAnchorForScope(ids: string[], where: InsertWhere): string | undefined {
  if (ids.length === 0) return undefined;
  if (ids.length === 1) return ids[0];

  const { viewRows, tasks } = useAppStore.getState();
  const rowIndex = firstRowIndexByTask(viewRows);
  const zichtbaar = ids.filter((id) => rowIndex.has(id));

  let rank: (id: string) => number;
  let pool: string[];
  if (zichtbaar.length > 0) {
    pool = zichtbaar;
    rank = (id) => rowIndex.get(id)!;
  } else {
    const docIndex = new Map(tasks.map((t, i) => [t.id, i]));
    pool = ids;
    rank = (id) => docIndex.get(id) ?? Number.MAX_SAFE_INTEGER;
  }

  let best = pool[0];
  for (const id of pool) {
    if (where === 'above' ? rank(id) < rank(best) : rank(id) > rank(best)) best = id;
  }
  return best;
}

export function canInsertRelative(): boolean {
  return isTreeMode(useAppStore.getState().view);
}

function meldGeblokkeerd(): void {
  useAppStore.getState().notifyStructureLocked();
}

const TASK_ADDED_AT_END_KEY = 'task-added-at-end';

function meldAchteraan(): void {
  useAppStore.getState().notify(refusalNotice({
    messageKey: 'notifications.taskAddedAtEnd',
    dedupeKey: TASK_ADDED_AT_END_KEY,
    action: { kind: 'clearViewArrangement', labelKey: 'view.filter.clear' },
  }));
}

export function addTaskNearSelection(partial: NewTaskInput): string {
  const store = useAppStore.getState();
  const scope = store.selectedTaskIds;
  if (scope.length === 0) return finishNewTask(store.addTask(partial));
  if (!canInsertRelative()) {
    const id = finishNewTask(store.addTask(partial));
    meldAchteraan();
    return id;
  }
  const anchorId = insertAnchorForScope(scope, 'below');
  return finishNewTask(store.addTask(anchorId ? { ...partial, position: { anchorId, where: 'below' } } : partial));
}

export function insertTaskRelativeToScope(
  scope: string[],
  where: InsertWhere,
  partial: NewTaskInput,
): string | null {
  const store = useAppStore.getState();
  const anchorId = insertAnchorForScope(scope, where);
  if (!anchorId) return finishNewTask(store.addTask(partial));
  if (!canInsertRelative()) {
    meldGeblokkeerd();
    return null;
  }
  return finishNewTask(store.addTask({ ...partial, position: { anchorId, where } }));
}

export function endOfListPosition(): { position?: { anchorId: string; where: InsertWhere } } {
  const { viewRows, view } = useAppStore.getState();
  if (!isTreeMode(view)) return {};
  const last = lastTaskRow(viewRows);
  return last ? { position: { anchorId: last.task.id, where: 'below' } } : {};
}

export function addTaskAtEnd(partial: NewTaskInput): string {
  const id = useAppStore.getState().addTask({ ...partial, ...endOfListPosition() });
  return id ? finishNewTask(id) : id;
}
