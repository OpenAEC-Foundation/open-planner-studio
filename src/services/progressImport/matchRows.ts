import type { Task } from '@/types/task';
import type { ProgressMatchKind, ProgressOverrides, ProgressRow, ProgressRowReason } from './types';

export interface ProgressRowMatch {
  rowNumber: number;
  taskId?: string;
  match?: ProgressMatchKind;
  reason?: Extract<ProgressRowReason, 'unmatched' | 'ambiguousWbs' | 'duplicateRow'>;
}

export interface ProgressMatchResult {
  matches: readonly ProgressRowMatch[];
  ignoredOverrideRows: readonly number[];
}

export function matchProgressRows(
  rows: readonly ProgressRow[],
  tasks: readonly Task[],
  overrides?: ProgressOverrides,
): ProgressMatchResult {
  const taskById = new Map<string, Task>();
  for (const task of tasks) taskById.set(task.id, task);

  const taskIdsByWbs = new Map<string, string[]>();
  for (const task of tasks) {
    const wbs = task.wbsCode;
    if (!wbs) continue;
    const existing = taskIdsByWbs.get(wbs);
    if (existing) existing.push(task.id);
    else taskIdsByWbs.set(wbs, [task.id]);
  }

  const claimedBy = new Set<string>();
  const ignoredOverrideRows: number[] = [];
  const overrideOutcomeByIndex = new Map<number, { taskId: string } | { duplicate: true }>();

  if (overrides) {
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const target = overrides.get(row.rowNumber);
      if (target === undefined) continue;
      if (!taskById.has(target)) {
        ignoredOverrideRows.push(row.rowNumber);
        continue;
      }
      if (claimedBy.has(target)) {
        overrideOutcomeByIndex.set(index, { duplicate: true });
        continue;
      }
      claimedBy.add(target);
      overrideOutcomeByIndex.set(index, { taskId: target });
    }
  }

  const matches: ProgressRowMatch[] = rows.map((row, index) => {
    const overrideOutcome = overrideOutcomeByIndex.get(index);
    if (overrideOutcome) {
      if ('duplicate' in overrideOutcome) {
        return { rowNumber: row.rowNumber, reason: 'duplicateRow' };
      }
      return { rowNumber: row.rowNumber, taskId: overrideOutcome.taskId, match: 'manual' };
    }

    if (row.taskId && taskById.has(row.taskId)) {
      if (claimedBy.has(row.taskId)) {
        return { rowNumber: row.rowNumber, reason: 'duplicateRow' };
      }
      claimedBy.add(row.taskId);
      return { rowNumber: row.rowNumber, taskId: row.taskId, match: 'id' };
    }

    if (row.wbsCode) {
      const candidates = taskIdsByWbs.get(row.wbsCode);
      if (candidates && candidates.length === 1) {
        const taskId = candidates[0];
        if (claimedBy.has(taskId)) {
          return { rowNumber: row.rowNumber, reason: 'duplicateRow' };
        }
        claimedBy.add(taskId);
        return { rowNumber: row.rowNumber, taskId, match: 'wbs' };
      }
      if (candidates && candidates.length > 1) {
        return { rowNumber: row.rowNumber, reason: 'ambiguousWbs' };
      }
    }

    return { rowNumber: row.rowNumber, reason: 'unmatched' };
  });

  return { matches, ignoredOverrideRows };
}
