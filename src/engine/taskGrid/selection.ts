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
  return cell !== null && columns.includes(cell.columnId) && rowIndex.taskByRowKey.has(cell.rowKey);
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
  return index.rows.slice(start, end + 1).filter(row => row.kind === 'task');
}

function sameOrderedIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function sameCellAddress(left: GridCellAddress | null, right: GridCellAddress | null): boolean {
  return left?.rowKey === right?.rowKey && left?.columnId === right?.columnId;
}

function visibleSelectedTaskIds(
  selectedTaskIds: readonly string[],
  rowIndex: TaskGridRowIndex,
): string[] {
  const visibleIds = new Set(rowIndex.taskRows.map(row => row.task.id));
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

/** Pas één pointer-/keyboardselectiegebaar puur toe; ongeldige groeps-/kolomcellen zijn een no-op. */
export function updateGridSelection(
  state: Readonly<GridSelectionState>,
  cell: GridCellAddress,
  rowIndex: TaskGridRowIndex,
  columns: readonly TaskColumnId[],
  gesture: GridSelectionGesture,
): GridSelectionState {
  const row = rowIndex.taskByRowKey.get(cell.rowKey);
  if (!row || !columns.includes(cell.columnId)) return state as GridSelectionState;

  if (gesture === 'replace') {
    const alreadySingleCell = sameCellAddress(state.active, cell)
      && sameCellAddress(state.anchor, cell)
      && sameCellAddress(state.range?.start ?? null, cell)
      && sameCellAddress(state.range?.end ?? null, cell)
      && state.activeTaskId === row.task.id
      && state.selectedTaskIds.length === 1
      && state.selectedTaskIds[0] === row.task.id;
    return alreadySingleCell ? state as GridSelectionState : singleCellSelection(cell, row.task.id);
  }

  if (gesture === 'toggle-task') {
    const selectedTaskIds = [...state.selectedTaskIds];
    const index = selectedTaskIds.indexOf(row.task.id);
    if (index >= 0) selectedTaskIds.splice(index, 1);
    else selectedTaskIds.push(row.task.id);
    return singleCellSelection(cell, row.task.id, selectedTaskIds);
  }

  const anchor = validCell(state.anchor, rowIndex, columns) ? state.anchor : cell;
  const selectedTaskIds = uniqueTaskIds(indexedTaskRowsInRange(rowIndex, anchor.rowKey, cell.rowKey));
  return {
    active: cell,
    anchor,
    range: { start: anchor, end: cell },
    selectedTaskIds,
    activeTaskId: row.task.id,
  };
}

/** Geordende taakcellen in de rechthoek; groepskoppen tussen de grenzen worden overgeslagen. */
export function gridSelectionCells(
  state: Readonly<GridSelectionState>,
  rowIndex: TaskGridRowIndex,
  columns: readonly TaskColumnId[],
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
    if (row.kind !== 'task') continue;
    for (let columnIndex = columnStart; columnIndex <= columnEnd; columnIndex++) {
      cells.push({ rowKey: row.rowKey, columnId: columns[columnIndex] });
    }
  }
  return cells;
}

/**
 * Herstel de cursor na filter/collapse/delete/column remove. Exacte occurrence wint; anders wordt
 * de oude absolute index op de dichtstbijzijnde taakrij/kolom geprojecteerd.
 */
export function reconcileGridSelection(
  state: Readonly<GridSelectionState>,
  previousRows: TaskGridRowIndex,
  nextRows: TaskGridRowIndex,
  previousColumns: readonly TaskColumnId[],
  nextColumns: readonly TaskColumnId[],
): GridSelectionState {
  if (!state.active || nextColumns.length === 0 || nextRows.taskRows.length === 0) {
    return createEmptyGridSelection();
  }

  const oldRowIndex = previousRows.absoluteIndexByRowKey.get(state.active.rowKey) ?? 0;
  const row = nextRows.taskByRowKey.get(state.active.rowKey) ?? nearestIndexedTaskRow(nextRows, oldRowIndex);
  if (!row) return createEmptyGridSelection();

  const oldColumnIndex = Math.max(0, previousColumns.indexOf(state.active.columnId));
  const columnId = nextColumns.includes(state.active.columnId)
    ? state.active.columnId
    : nextColumns[Math.min(oldColumnIndex, nextColumns.length - 1)];
  const active = { rowKey: row.rowKey, columnId };

  const previousRangeTaskIds = state.range
    ? uniqueTaskIds(indexedTaskRowsInRange(previousRows, state.range.start.rowKey, state.range.end.rowKey))
    : [];
  // Ctrl/Cmd-selectie heeft bewust een taakset die afwijkt van de ene aaneengesloten celrechthoek.
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
    return singleCellSelection(active, row.task.id, reconciledAdditiveIds ?? [row.task.id]);
  }

  const range = state.range!;
  return {
    active,
    anchor: state.anchor,
    range,
    selectedTaskIds: reconciledAdditiveIds
      ?? uniqueTaskIds(indexedTaskRowsInRange(nextRows, range.start.rowKey, range.end.rowKey)),
    activeTaskId: row.task.id,
  };
}
