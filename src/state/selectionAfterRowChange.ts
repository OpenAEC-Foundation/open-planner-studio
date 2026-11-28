import { uniqueTaskIds, type ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';
import type { StoredSelectionAnchor } from '@/state/slices/types';

interface SelectionDraft {
  tasks: Task[];
  selectedTaskIds: string[];
  activeTaskId: string | null;
  viewRows: ViewRow[];
  ui: { gridActiveRowKey: string | null; selectionAnchor: StoredSelectionAnchor | null };
}

export function liftSelectionOutOfCollapsed(s: SelectionDraft, visibleBefore: ReadonlySet<string>): void {
  const visibleNow = new Set(uniqueTaskIds(s.viewRows));
  const byId = new Map(s.tasks.map(task => [task.id, task] as const));
  const lift = (id: string): string => {
    if (!visibleBefore.has(id) || visibleNow.has(id)) return id;
    const seen = new Set<string>([id]);
    let parentId = byId.get(id)?.parentId ?? null;
    while (parentId && !seen.has(parentId)) {
      if (visibleNow.has(parentId)) return parentId;
      seen.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return id;
  };
  const nextSelected = [...new Set(s.selectedTaskIds.map(lift))];
  const nextActive = s.activeTaskId === null ? null : lift(s.activeTaskId);
  const unchanged = nextActive === s.activeTaskId
    && nextSelected.length === s.selectedTaskIds.length
    && nextSelected.every((id, index) => id === s.selectedTaskIds[index]);
  if (unchanged) return;
  s.selectedTaskIds = nextSelected;
  s.activeTaskId = nextActive;
}

function groupPathOf(rowKey: string): readonly string[] {
  if (!rowKey.startsWith('{')) return [];
  const path: unknown = (JSON.parse(rowKey) as { groupPath?: unknown }).groupPath;
  return Array.isArray(path) ? path.map(String) : [];
}

function currentRowKey(rowsNow: readonly ViewRow[], neighbour: Extract<ViewRow, { kind: 'task' }>): string | null {
  const now = rowsNow.flatMap(row => row.kind === 'task' && row.task.id === neighbour.task.id ? [row.rowKey] : []);
  if (now.includes(neighbour.rowKey)) return neighbour.rowKey;
  const before = groupPathOf(neighbour.rowKey);
  const shared = (rowKey: string) => {
    const path = groupPathOf(rowKey);
    let length = 0;
    while (length < path.length && path[length] === before[length]) length++;
    return length;
  };
  let best: string | null = null;
  let bestShared = -1;
  for (const rowKey of now) {
    const length = shared(rowKey);
    if (length > bestShared) { best = rowKey; bestShared = length; }
  }
  return best;
}

export function selectNeighbourAfterRemoval(
  s: SelectionDraft,
  rowsBefore: readonly ViewRow[],
  selectedBefore: readonly string[],
  anchorRowKey: string | null,
): void {
  if (s.selectedTaskIds.length > 0 || selectedBefore.length === 0) return;
  const existing = new Set(s.tasks.map(task => task.id));
  const visibleNow = new Set(uniqueTaskIds(s.viewRows).filter(id => existing.has(id)));
  const rows = rowsBefore.flatMap(row => row.kind === 'task' ? [row] : []);
  const removedSelection = (row: (typeof rows)[number]) =>
    selectedBefore.includes(row.task.id) && !existing.has(row.task.id);
  const cursor = rows.findIndex(row => row.rowKey === anchorRowKey);
  const anchor = cursor >= 0 && removedSelection(rows[cursor]) ? cursor : rows.findIndex(removedSelection);
  if (anchor < 0) return;
  let neighbour: (typeof rows)[number] | undefined;
  for (let index = anchor + 1; index < rows.length && !neighbour; index++) {
    if (visibleNow.has(rows[index].task.id)) neighbour = rows[index];
  }
  for (let index = anchor - 1; index >= 0 && !neighbour; index--) {
    if (visibleNow.has(rows[index].task.id)) neighbour = rows[index];
  }
  if (!neighbour) return;
  const selection = [neighbour.task.id];
  s.selectedTaskIds = selection;
  s.activeTaskId = neighbour.task.id;
  s.ui.gridActiveRowKey = currentRowKey(s.viewRows, neighbour);
  s.ui.selectionAnchor = s.ui.gridActiveRowKey
    ? { rowKey: s.ui.gridActiveRowKey, taskIds: [neighbour.task.id], selection }
    : null;
}
