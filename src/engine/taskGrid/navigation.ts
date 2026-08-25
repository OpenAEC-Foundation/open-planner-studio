import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import type { GridKeyEventLike } from '@/utils/gridNavigation';
import type { TaskColumnId } from '@/types/taskGrid';
import type { GridCellAddress } from './selection';
import type { TaskGridRowIndex } from './rowIndex';

export interface TaskGridCommandInput {
  event: GridKeyEventLike;
  mode: 'select' | 'edit';
  active: GridCellAddress | null;
  rowIndex: TaskGridRowIndex;
  columns: readonly TaskColumnId[];
  rowHeight: number;
  viewportHeight: number;
  isReadOnly: (cell: GridCellAddress) => boolean;
}

export type TaskGridCommand =
  | { kind: 'move'; cell: GridCellAddress; extend: boolean }
  | { kind: 'start-edit'; cell: GridCellAddress; replacement?: string }
  | { kind: 'readonly'; cell: GridCellAddress }
  | { kind: 'commit-edit'; cell: GridCellAddress; nextCell: GridCellAddress }
  | { kind: 'cancel-edit'; cell: GridCellAddress }
  | { kind: 'clear-cells' }
  | { kind: 'insert-task'; afterRowKey: string; targetColumnId: TaskColumnId }
  | { kind: 'unhandled' };

function startEdit(input: TaskGridCommandInput, replacement?: string): TaskGridCommand {
  const cell = input.active!;
  return input.isReadOnly(cell)
    ? { kind: 'readonly', cell }
    : replacement === undefined
      ? { kind: 'start-edit', cell }
      : { kind: 'start-edit', cell, replacement };
}

export function resolveTaskGridCommand(input: TaskGridCommandInput): TaskGridCommand {
  const { event, active, columns } = input;
  const rows = input.rowIndex.taskRows;
  if (!active || columns.length === 0 || rows.length === 0) return { kind: 'unhandled' };
  const rowIndex = input.rowIndex.taskIndexByRowKey.get(active.rowKey) ?? -1;
  const columnIndex = columns.indexOf(active.columnId);
  if (rowIndex < 0 || columnIndex < 0 || event.altKey) return { kind: 'unhandled' };

  if (input.mode === 'edit') {
    if (event.key === 'Escape') return { kind: 'cancel-edit', cell: active };
    if (event.key === 'Enter') {
      const delta = event.shiftKey ? -1 : 1;
      const nextRow = rows[Math.max(0, Math.min(rows.length - 1, rowIndex + delta))];
      return {
        kind: 'commit-edit',
        cell: active,
        nextCell: { rowKey: nextRow.rowKey, columnId: active.columnId },
      };
    }
    return { kind: 'unhandled' };
  }

  const hasCommandModifier = event.ctrlKey || event.metaKey;
  if (hasCommandModifier && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    return { kind: 'unhandled' };
  }

  const move = (
    nextRowIndex: number,
    nextColumnIndex: number,
    extend = event.shiftKey === true,
  ): TaskGridCommand => ({
    kind: 'move',
    cell: {
      rowKey: rows[Math.max(0, Math.min(rows.length - 1, nextRowIndex))].rowKey,
      columnId: columns[Math.max(0, Math.min(columns.length - 1, nextColumnIndex))],
    },
    extend,
  });

  if (event.key === 'ArrowUp' && !hasCommandModifier) return move(rowIndex - 1, columnIndex);
  if (event.key === 'ArrowDown' && !hasCommandModifier) return move(rowIndex + 1, columnIndex);
  if (event.key === 'ArrowLeft' && !hasCommandModifier) return move(rowIndex, columnIndex - 1);
  if (event.key === 'ArrowRight' && !hasCommandModifier) return move(rowIndex, columnIndex + 1);
  if (event.key === 'Home') return hasCommandModifier ? move(0, 0) : move(rowIndex, 0);
  if (event.key === 'End') {
    return hasCommandModifier
      ? move(rows.length - 1, columns.length - 1)
      : move(rowIndex, columns.length - 1);
  }
  if ((event.key === 'PageUp' || event.key === 'PageDown') && !hasCommandModifier) {
    const pageRows = Math.max(1, Math.floor(input.viewportHeight / input.rowHeight));
    const currentAbsolute = input.rowIndex.taskAbsoluteIndices[rowIndex];
    const targetAbsolute = currentAbsolute + (event.key === 'PageUp' ? -pageRows : pageRows);
    const positions = input.rowIndex.taskAbsoluteIndices;
    let low = 0;
    let high = positions.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (positions[middle] < targetAbsolute) low = middle + 1;
      else high = middle;
    }
    const targetTaskIndex = event.key === 'PageUp'
      ? Math.max(0, low < positions.length && positions[low] === targetAbsolute ? low : low - 1)
      : Math.min(rows.length - 1, low);
    return move(targetTaskIndex, columnIndex);
  }
  if (event.key === 'Tab' && !hasCommandModifier) {
    const linear = rowIndex * columns.length + columnIndex + (event.shiftKey ? -1 : 1);
    const clamped = Math.max(0, Math.min(rows.length * columns.length - 1, linear));
    return move(Math.floor(clamped / columns.length), clamped % columns.length, false);
  }
  if ((event.key === 'Enter' || event.key === 'F2') && !hasCommandModifier) return startEdit(input);
  if ((event.key === 'Delete' || event.key === 'Backspace') && !hasCommandModifier) return { kind: 'clear-cells' };
  if (event.key === 'Insert' && !hasCommandModifier) {
    return { kind: 'insert-task', afterRowKey: active.rowKey, targetColumnId: taskColumnId('task.name') };
  }
  if (!hasCommandModifier && !event.altKey && event.key.length === 1) return startEdit(input, event.key);
  return { kind: 'unhandled' };
}
