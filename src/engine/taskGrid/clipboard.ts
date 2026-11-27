import { canonicalGridJson } from '@/engine/taskGrid/taskColumnRegistry';
import { copyGridEditorValue, parseGridEditorText, type TaskGridBooleanLabels } from './editors';
import { gridSelectionCells, type GridCellAddress, type GridSelectionState } from './selection';
import type { TaskGridRowIndex } from './rowIndex';
import type { DateNotation } from '@/types/view';
import type {
  CellValidationError,
  GridResult,
  GridWriteIntent,
  PasteIntent,
  TaskColumnContext,
  TaskColumnDescriptor,
  TaskColumnId,
} from '@/types/taskGrid';

export interface TaskGridClipboardEnvironment {
  selection: Readonly<GridSelectionState>;
  rowIndex: TaskGridRowIndex;
  columns: readonly TaskColumnId[];
  descriptors: ReadonlyMap<TaskColumnId, TaskColumnDescriptor>;
  context: TaskColumnContext;
  dateNotation: DateNotation;
  booleanLabels?: TaskGridBooleanLabels;
}

function error(
  code: string,
  value?: unknown,
  cell?: GridCellAddress,
  taskId?: string,
): CellValidationError {
  return {
    code, messageKey: `taskGrid.validation.${code}`, taskId,
    rowKey: cell?.rowKey, columnId: cell?.columnId, value,
  };
}

function fail(code: string, value?: unknown): GridResult<never, readonly CellValidationError[]> {
  return { ok: false, errors: [error(code, value)] };
}

function quoteTsvCell(value: string): string {
  return /[\t\r\n"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function serializeTaskGridTsv(matrix: readonly (readonly string[])[]): string {
  return matrix.map(row => row.map(quoteTsvCell).join('\t')).join('\r\n');
}

export function parseTaskGridTsv(text: string): GridResult<string[][], readonly CellValidationError[]> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let afterQuote = false;

  const endCell = () => { row.push(cell); cell = ''; afterQuote = false; };
  const endRow = () => { endCell(); rows.push(row); row = []; };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') { cell += '"'; index++; }
        else { inQuotes = false; afterQuote = true; }
      } else {
        cell += char;
      }
      continue;
    }
    if (afterQuote && char !== '\t' && char !== '\r' && char !== '\n') return fail('tsvQuote', text);
    if (char === '"') {
      if (cell !== '') return fail('tsvQuote', text);
      inQuotes = true;
    } else if (char === '\t') {
      endCell();
    } else if (char === '\n') {
      endRow();
    } else if (char === '\r') {
      if (text[index + 1] !== '\n') return fail('tsvQuote', text);
      endRow();
      index++;
    } else {
      cell += char;
    }
  }
  if (inQuotes) return fail('tsvQuote', text);
  endRow();
  const width = rows[0]?.length ?? 0;
  const ragged = rows.find(candidate => candidate.length !== width);
  return ragged
    ? fail('tsvRectangle', ragged.join('\t'))
    : { ok: true, value: rows };
}

interface CellRectangle {
  rows: string[];
  columns: TaskColumnId[];
}

function selectionRectangle(environment: TaskGridClipboardEnvironment, withRuns = false): CellRectangle | null {
  const cells = gridSelectionCells(environment.selection, environment.rowIndex, environment.columns, withRuns);
  if (cells.length === 0) return null;
  const rows: string[] = [];
  const columns: TaskColumnId[] = [];
  const seenRows = new Set<string>();
  const seenColumns = new Set<TaskColumnId>();
  for (const cell of cells) {
    if (!seenRows.has(cell.rowKey)) {
      seenRows.add(cell.rowKey);
      rows.push(cell.rowKey);
    }
    if (!seenColumns.has(cell.columnId)) {
      seenColumns.add(cell.columnId);
      columns.push(cell.columnId);
    }
  }
  return { rows, columns };
}

export function copyTaskGridSelection(
  environment: TaskGridClipboardEnvironment,
): GridResult<string, readonly CellValidationError[]> {
  const rectangle = selectionRectangle(environment, true);
  if (!rectangle) return fail('selection');
  const matrix: string[][] = [];
  for (const rowKey of rectangle.rows) {
    const tasks = environment.rowIndex.runByRowKey.get(rowKey)?.tasks
      ?? [environment.rowIndex.taskByRowKey.get(rowKey)!.task];
    for (const task of tasks) {
      const values: string[] = [];
      for (const columnId of rectangle.columns) {
        const descriptor = environment.descriptors.get(columnId);
        if (!descriptor || !descriptor.available(environment.context)) return fail('plannerNotAvailable', columnId);
        values.push(copyGridEditorValue(
          descriptor, task, environment.context, environment.dateNotation, environment.booleanLabels,
        ));
      }
      matrix.push(values);
    }
  }
  return { ok: true, value: serializeTaskGridTsv(matrix) };
}

function targetRectangle(
  source: readonly (readonly string[])[],
  environment: TaskGridClipboardEnvironment,
): GridResult<CellRectangle, readonly CellValidationError[]> {
  const selected = selectionRectangle(environment);
  if (!selected || !environment.selection.active) return fail('selection');
  const sourceRows = source.length;
  const sourceColumns = source[0]?.length ?? 0;
  const selectedIsLarger = selected.rows.length > 1 || selected.columns.length > 1;
  if (selectedIsLarger) {
    return sourceRows > 0 && sourceColumns > 0
      && selected.rows.length % sourceRows === 0 && selected.columns.length % sourceColumns === 0
      ? { ok: true, value: selected }
      : fail('pasteDimensions', source);
  }

  const activeTaskIndex = environment.rowIndex.taskIndexByRowKey.get(environment.selection.active.rowKey);
  const activeColumnIndex = environment.columns.indexOf(environment.selection.active.columnId);
  if (activeTaskIndex === undefined || activeColumnIndex < 0
    || activeTaskIndex + sourceRows > environment.rowIndex.taskRows.length
    || activeColumnIndex + sourceColumns > environment.columns.length) {
    return fail('pasteBounds', source);
  }
  return {
    ok: true,
    value: {
      rows: environment.rowIndex.taskRows.slice(activeTaskIndex, activeTaskIndex + sourceRows).map(row => row.rowKey),
      columns: environment.columns.slice(activeColumnIndex, activeColumnIndex + sourceColumns),
    },
  };
}

export interface TaskGridPasteOptions {
  skipReadOnlyCells?: boolean;
}

export function planTaskGridPaste(
  text: string,
  environment: TaskGridClipboardEnvironment,
  options: TaskGridPasteOptions = {},
): GridResult<PasteIntent, readonly CellValidationError[]> {
  const parsed = parseTaskGridTsv(text);
  if (!parsed.ok) return parsed;
  const target = targetRectangle(parsed.value, environment);
  if (!target.ok) return target;
  const sourceRows = parsed.value.length;
  const sourceColumns = parsed.value[0]?.length ?? 0;
  const writes: GridWriteIntent[] = [];
  const byTarget = new Map<string, unknown>();
  let skippedReadOnlyCount = 0;
  const skippedReadOnlyTaskIds = new Set<string>();

  for (let rowOffset = 0; rowOffset < target.value.rows.length; rowOffset++) {
    const rowKey = target.value.rows[rowOffset];
    const task = environment.rowIndex.taskByRowKey.get(rowKey)!.task;
    for (let columnOffset = 0; columnOffset < target.value.columns.length; columnOffset++) {
      const columnId = target.value.columns[columnOffset];
      const cell = { rowKey, columnId };
      const source = parsed.value[rowOffset % sourceRows][columnOffset % sourceColumns];
      const descriptor = environment.descriptors.get(columnId);
      if (!descriptor || !descriptor.available(environment.context)) {
        return { ok: false, errors: [error('plannerNotAvailable', source, cell, task.id)] };
      }
      const planWrite = descriptor.planWriteUnchecked ?? descriptor.planWrite;
      if (!descriptor.parse || !planWrite) {
        if (options.skipReadOnlyCells) { skippedReadOnlyCount++; skippedReadOnlyTaskIds.add(task.id); continue; }
        return { ok: false, errors: [error('readOnly', source, cell, task.id)] };
      }
      const parsedValue = parseGridEditorText(
        descriptor, source, task, environment.context, environment.dateNotation, environment.booleanLabels,
      );
      if (!parsedValue.ok) {
        const first = parsedValue.errors[0] ?? error('invalid', source);
        return { ok: false, errors: [{ ...first, taskId: task.id, rowKey, columnId, value: source }] };
      }
      const validated = descriptor.validate
        ? descriptor.validate(parsedValue.value, task, environment.context)
        : { ok: true as const, value: parsedValue.value };
      if (!validated.ok) {
        const first = validated.errors[0] ?? error('invalid', source);
        return { ok: false, errors: [{ ...first, taskId: task.id, rowKey, columnId, value: source }] };
      }
      const key = `${task.id}\u0000${columnId}`;
      const previous = byTarget.get(key);
      if (byTarget.has(key)) {
        if (canonicalGridJson(previous) !== canonicalGridJson(validated.value)) {
          return { ok: false, errors: [error('conflictingDuplicate', source, cell, task.id)] };
        }
        continue;
      }
      byTarget.set(key, validated.value);

      const currentText = copyGridEditorValue(
        descriptor, task, environment.context, environment.dateNotation, environment.booleanLabels,
      );
      const parsedCurrent = parseGridEditorText(
        descriptor, currentText, task, environment.context, environment.dateNotation, environment.booleanLabels,
      );
      const validatedCurrent = parsedCurrent.ok && descriptor.validate
        ? descriptor.validate(parsedCurrent.value, task, environment.context)
        : parsedCurrent;
      if (validatedCurrent.ok
        && canonicalGridJson(validatedCurrent.value) === canonicalGridJson(validated.value)) {
        continue;
      }
      const planned = planWrite(validated.value, task, environment.context);
      if (!planned.ok) {
        const first = planned.errors[0] ?? error('invalid', source);
        return { ok: false, errors: [{ ...first, taskId: task.id, rowKey, columnId, value: source }] };
      }
      writes.push(...planned.value);
    }
  }
  return {
    ok: true,
    value: {
      kind: 'paste',
      writes,
      ...(options.skipReadOnlyCells ? { allowSkippingReadOnlyCells: true } : {}),
      ...(skippedReadOnlyCount > 0 ? { skippedReadOnlyCount, skippedReadOnlyTaskIds: [...skippedReadOnlyTaskIds] } : {}),
    },
  };
}

export function planTaskGridClear(
  environment: TaskGridClipboardEnvironment,
): GridResult<PasteIntent, readonly CellValidationError[]> {
  return planTaskGridPaste('', environment);
}
