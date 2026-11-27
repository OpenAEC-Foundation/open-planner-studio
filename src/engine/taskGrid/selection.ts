import { uniqueTaskIds } from '@/engine/view/visibleRows';
import type { TaskColumnId } from '@/types/taskGrid';
import { nearestIndexedTaskRow, type TaskGridRowIndex } from './rowIndex';

export interface GridCellAddress {
  rowKey: string;
  columnId: TaskColumnId;
}

export interface GridSelectionState {
  active: GridCellAddress | null;
  anchor: GridCellAddress | null;
  range: { start: GridCellAddress; end: GridCellAddress } | null;
  selectedTaskIds: readonly string[];
  activeTaskId: string | null;
}

export type GridSelectionGesture = 'replace' | 'extend' | 'toggle-task';

export function createEmptyGridSelection(): GridSelectionState {
  return { active: null, anchor: null, range: null, selectedTaskIds: [], activeTaskId: null };
}

function validCell(
  cell: GridCellAddress | null,
  rowIndex: TaskGridRowIndex,
  columns: readonly TaskColumnId[],
): cell is GridCellAddress {
  return cell !== null && columns.includes(cell.columnId) && selectableRow(rowIndex, cell.rowKey) !== null;
}

function selectableRow(rowIndex: TaskGridRowIndex, rowKey: string): { rowKey: string; taskIds: string[] } | null {
  const task = rowIndex.taskByRowKey.get(rowKey);
  if (task) return { rowKey, taskIds: [task.task.id] };
  const run = rowIndex.runByRowKey.get(rowKey);
  return run ? { rowKey, taskIds: run.tasks.map(t => t.id) } : null;
}

function runRowKeyOf(rowIndex: TaskGridRowIndex, taskId: string): string | undefined {
  for (const [rowKey, run] of rowIndex.runByRowKey) {
    if (run.tasks.some(task => task.id === taskId)) return rowKey;
  }
  return undefined;
}

function indexedTaskRowsInRange(
  index: TaskGridRowIndex,
  fromRowKey: string,
  toRowKey: string,
) {
  const fromIndex = index.absoluteIndexByRowKey.get(fromRowKey);
  const toIndex = index.absoluteIndexByRowKey.get(toRowKey);
  if (fromIndex === undefined || toIndex === undefined) return [];
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  return index.rows.slice(start, end + 1).filter(row => row.kind === 'task' || row.kind === 'milestones');
}

function sameOrderedIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function sameCellAddress(left: GridCellAddress | null, right: GridCellAddress | null): boolean {
  return left?.rowKey === right?.rowKey && left?.columnId === right?.columnId;
}

function visibleSelectedTaskIds(
  selectedTaskIds: readonly string[],
  rowIndex: TaskGridRowIndex,
): string[] {
  const visibleIds = new Set(rowIndex.taskRows.map(row => row.task.id));
  for (const run of rowIndex.runByRowKey.values()) for (const task of run.tasks) visibleIds.add(task.id);
  return selectedTaskIds.filter(id => visibleIds.has(id));
}

function singleCellSelection(
  cell: GridCellAddress,
  taskId: string,
  selectedTaskIds: readonly string[] = [taskId],
): GridSelectionState {
  return {
    active: cell,
    anchor: cell,
    range: { start: cell, end: cell },
    selectedTaskIds,
    activeTaskId: taskId,
  };
}

export function updateGridSelection(
  state: Readonly<GridSelectionState>,
  cell: GridCellAddress,
  rowIndex: TaskGridRowIndex,
  columns: readonly TaskColumnId[],
  gesture: GridSelectionGesture,
): GridSelectionState {
  const row = selectableRow(rowIndex, cell.rowKey);
  if (!row || !columns.includes(cell.columnId)) return state as GridSelectionState;
  const activeTaskId = row.taskIds[0];

  if (gesture === 'replace') {
    const alreadySingleCell = sameCellAddress(state.active, cell)
      && sameCellAddress(state.anchor, cell)
      && sameCellAddress(state.range?.start ?? null, cell)
      && sameCellAddress(state.range?.end ?? null, cell)
      && state.activeTaskId === activeTaskId
      && sameOrderedIds(state.selectedTaskIds, row.taskIds);
    return alreadySingleCell ? state as GridSelectionState : singleCellSelection(cell, activeTaskId, row.taskIds);
  }

  if (gesture === 'toggle-task') {
    const all = row.taskIds.every(id => state.selectedTaskIds.includes(id));
    const selectedTaskIds = all
      ? state.selectedTaskIds.filter(id => !row.taskIds.includes(id))
      : [...state.selectedTaskIds, ...row.taskIds.filter(id => !state.selectedTaskIds.includes(id))];
    return singleCellSelection(cell, activeTaskId, selectedTaskIds);
  }

  const anchor = validCell(state.anchor, rowIndex, columns) ? state.anchor : cell;
  const selectedTaskIds = uniqueTaskIds(indexedTaskRowsInRange(rowIndex, anchor.rowKey, cell.rowKey));
  return {
    active: cell,
    anchor,
    range: { start: anchor, end: cell },
    selectedTaskIds,
    activeTaskId,
  };
}

export function gridSelectionCells(
  state: Readonly<GridSelectionState>,
  rowIndex: TaskGridRowIndex,
  columns: readonly TaskColumnId[],
  withRuns = false,
): GridCellAddress[] {
  const range = state.range;
  if (!range || !validCell(range.start, rowIndex, columns) || !validCell(range.end, rowIndex, columns)) return [];
  const fromRow = rowIndex.absoluteIndexByRowKey.get(range.start.rowKey)!;
  const toRow = rowIndex.absoluteIndexByRowKey.get(range.end.rowKey)!;
  const fromColumn = columns.indexOf(range.start.columnId);
  const toColumn = columns.indexOf(range.end.columnId);
  const rowStart = Math.min(fromRow, toRow);
  const rowEnd = Math.max(fromRow, toRow);
  const columnStart = Math.min(fromColumn, toColumn);
  const columnEnd = Math.max(fromColumn, toColumn);
  const cells: GridCellAddress[] = [];
  for (let absoluteIndex = rowStart; absoluteIndex <= rowEnd; absoluteIndex++) {
    const row = rowIndex.rows[absoluteIndex];
    if (row.kind !== 'task' && !(withRuns && row.kind === 'milestones')) continue;
    for (let columnIndex = columnStart; columnIndex <= columnEnd; columnIndex++) {
      cells.push({ rowKey: row.rowKey, columnId: columns[columnIndex] });
    }
  }
  return cells;
}

export function reconcileGridSelection(
  state: Readonly<GridSelectionState>,
  previousRows: TaskGridRowIndex,
  nextRows: TaskGridRowIndex,
  previousColumns: readonly TaskColumnId[],
  nextColumns: readonly TaskColumnId[],
): GridSelectionState {
  if (!state.active || nextColumns.length === 0 || nextRows.taskRows.length === 0) {
    const empty = createEmptyGridSelection();
    return sameGridSelection(empty, state) ? state : empty;
  }

  const oldRowIndex = previousRows.absoluteIndexByRowKey.get(state.active.rowKey) ?? 0;
  const nearest = nearestIndexedTaskRow(nextRows, oldRowIndex);
  const row = selectableRow(nextRows, state.active.rowKey)
    ?? (nearest ? { rowKey: nearest.rowKey, taskIds: [nearest.task.id] } : null);
  if (!row) {
    const empty = createEmptyGridSelection();
    return sameGridSelection(empty, state) ? state : empty;
  }

  const oldColumnIndex = Math.max(0, previousColumns.indexOf(state.active.columnId));
  const columnId = nextColumns.includes(state.active.columnId)
    ? state.active.columnId
    : nextColumns[Math.min(oldColumnIndex, nextColumns.length - 1)];
  const active = { rowKey: row.rowKey, columnId };

  const previousRangeTaskIds = state.range
    ? uniqueTaskIds(indexedTaskRowsInRange(previousRows, state.range.start.rowKey, state.range.end.rowKey))
    : [];
  const hasAdditiveTaskSelection = !sameOrderedIds(state.selectedTaskIds, previousRangeTaskIds);
  const reconciledAdditiveIds = hasAdditiveTaskSelection
    ? visibleSelectedTaskIds(state.selectedTaskIds, nextRows)
    : null;

  const canKeepRange = validCell(state.active, nextRows, nextColumns)
    && validCell(state.anchor, nextRows, nextColumns)
    && state.range !== null
    && validCell(state.range.start, nextRows, nextColumns)
    && validCell(state.range.end, nextRows, nextColumns);
  if (!canKeepRange) {
    const next = singleCellSelection(active, row.taskIds[0], reconciledAdditiveIds ?? row.taskIds);
    return sameGridSelection(next, state) ? state : next;
  }

  const range = state.range!;
  const next: GridSelectionState = {
    active,
    anchor: state.anchor,
    range,
    selectedTaskIds: reconciledAdditiveIds
      ?? uniqueTaskIds(indexedTaskRowsInRange(nextRows, range.start.rowKey, range.end.rowKey)),
    activeTaskId: row.taskIds[0],
  };
  return sameGridSelection(next, state) ? state : next;
}

function sameGridSelection(left: Readonly<GridSelectionState>, right: Readonly<GridSelectionState>): boolean {
  return left.activeTaskId === right.activeTaskId
    && sameCellAddress(left.active, right.active)
    && sameCellAddress(left.anchor, right.anchor)
    && sameCellAddress(left.range?.start ?? null, right.range?.start ?? null)
    && sameCellAddress(left.range?.end ?? null, right.range?.end ?? null)
    && (left.range === null) === (right.range === null)
    && sameOrderedIds(left.selectedTaskIds, right.selectedTaskIds);
}

function nearestOccurrence(
  rowIndex: TaskGridRowIndex,
  taskId: string,
  cursorRowKey: string | null,
  preferredRowKey: string | null,
): TaskGridRowIndex['taskRows'][number] | undefined {
  const preferredRow = preferredRowKey ? rowIndex.taskByRowKey.get(preferredRowKey) : undefined;
  if (preferredRow?.task.id === taskId) return preferredRow;
  const cursorRow = cursorRowKey ? rowIndex.taskByRowKey.get(cursorRowKey) : undefined;
  if (cursorRow?.task.id === taskId) return cursorRow;
  const cursor = cursorRowKey ? rowIndex.taskIndexByRowKey.get(cursorRowKey) : undefined;
  let best: TaskGridRowIndex['taskRows'][number] | undefined;
  let bestDistance = Infinity;
  rowIndex.taskRows.forEach((row, index) => {
    if (row.task.id !== taskId) return;
    const distance = cursor === undefined ? index : Math.abs(index - cursor);
    if (distance < bestDistance) { best = row; bestDistance = distance; }
  });
  return best;
}

export function withSelectionAnchor(state: GridSelectionState, rowKey: string): GridSelectionState {
  return state.active && rowKey !== state.anchor?.rowKey
    ? { ...state, anchor: { rowKey, columnId: state.active.columnId } }
    : state;
}

export function syncActiveCellToPublishedTask(
  reconciled: Readonly<GridSelectionState>,
  publishedActiveTaskId: string | null,
  publishedSelectedTaskIds: readonly string[],
  rowIndex: TaskGridRowIndex,
  columns: readonly TaskColumnId[],
  preferredRowKey: string | null = null,
): GridSelectionState {
  const activeRow = publishedActiveTaskId
    ? nearestOccurrence(rowIndex, publishedActiveTaskId, reconciled.active?.rowKey ?? null, preferredRowKey)
    : undefined;
  const activeRowKey = activeRow?.rowKey
    ?? (publishedActiveTaskId ? runRowKeyOf(rowIndex, publishedActiveTaskId) : undefined);
  if (activeRowKey && activeRowKey !== reconciled.active?.rowKey) {
    const columnId = reconciled.active?.columnId ?? columns[0];
    if (columnId) {
      const jumped = updateGridSelection(
        createEmptyGridSelection(),
        { rowKey: activeRowKey, columnId },
        rowIndex,
        columns,
        'replace',
      );
      return { ...jumped, selectedTaskIds: [...publishedSelectedTaskIds], activeTaskId: publishedActiveTaskId };
    }
  }
  return { ...reconciled, selectedTaskIds: [...publishedSelectedTaskIds], activeTaskId: publishedActiveTaskId };
}
