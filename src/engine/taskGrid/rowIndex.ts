import type { TaskViewRow, ViewRow } from '@/engine/view/visibleRows';

/**
 * Eén herbruikbare index over de actuele zichtbare rijen. De adapter bouwt hem alleen opnieuw
 * wanneer ViewRow[] verandert; toets- en enkelvoudige selectiecommando's blijven daarna O(1).
 */
export interface TaskGridRowIndex {
  readonly rows: readonly ViewRow[];
  readonly taskRows: readonly TaskViewRow[];
  readonly taskByRowKey: ReadonlyMap<string, TaskViewRow>;
  readonly taskIndexByRowKey: ReadonlyMap<string, number>;
  readonly absoluteIndexByRowKey: ReadonlyMap<string, number>;
  readonly taskAbsoluteIndices: readonly number[];
}

export function createTaskGridRowIndex(rows: readonly ViewRow[]): TaskGridRowIndex {
  const taskRows: TaskViewRow[] = [];
  const taskByRowKey = new Map<string, TaskViewRow>();
  const taskIndexByRowKey = new Map<string, number>();
  const absoluteIndexByRowKey = new Map<string, number>();
  const taskAbsoluteIndices: number[] = [];

  for (let absoluteIndex = 0; absoluteIndex < rows.length; absoluteIndex++) {
    const row = rows[absoluteIndex];
    if (absoluteIndexByRowKey.has(row.rowKey)) {
      throw new TypeError(`ViewRow.rowKey moet uniek zijn: ${row.rowKey}`);
    }
    absoluteIndexByRowKey.set(row.rowKey, absoluteIndex);
    if (row.kind !== 'task') continue;
    taskIndexByRowKey.set(row.rowKey, taskRows.length);
    taskByRowKey.set(row.rowKey, row);
    taskAbsoluteIndices.push(absoluteIndex);
    taskRows.push(row);
  }

  return {
    rows,
    taskRows,
    taskByRowKey,
    taskIndexByRowKey,
    absoluteIndexByRowKey,
    taskAbsoluteIndices,
  };
}

/** Dichtstbijzijnde taakrij bij een absolute oude positie; een gelijke afstand kiest eerder. */
export function nearestIndexedTaskRow(
  index: TaskGridRowIndex,
  absoluteIndex: number,
): TaskViewRow | null {
  const positions = index.taskAbsoluteIndices;
  if (positions.length === 0) return null;
  let low = 0;
  let high = positions.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (positions[middle] < absoluteIndex) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return index.taskRows[0];
  if (low === positions.length) return index.taskRows[index.taskRows.length - 1] ?? null;
  const before = low - 1;
  return absoluteIndex - positions[before] <= positions[low] - absoluteIndex
    ? index.taskRows[before]
    : index.taskRows[low];
}
