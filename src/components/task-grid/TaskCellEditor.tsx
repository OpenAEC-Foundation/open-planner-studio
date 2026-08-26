import { useEffect, useRef, useState } from 'react';
import type { GridCellAddress } from '@/engine/taskGrid/selection';
import type { TaskGridAdapter, TaskGridAdapterEventTarget } from '@/engine/taskGrid/taskGridAdapter';
import type { CellValidationError } from '@/types/taskGrid';
import {
  GridEditorHost,
  type GridEditorCommitResult,
} from './GridEditorHost';

export interface CommitTaskCellEditorValueInput {
  adapter: TaskGridAdapter;
  cell: GridCellAddress;
  text: string;
  messageForError: (messageKey: string, error: CellValidationError) => string;
}

function errorId(cell: GridCellAddress): string {
  return `task-grid-error-${encodeURIComponent(cell.rowKey)}-${encodeURIComponent(cell.columnId)}`;
}

function editorError(
  cell: GridCellAddress,
  error: CellValidationError,
  messageForError: CommitTaskCellEditorValueInput['messageForError'],
): GridEditorCommitResult {
  return {
    ok: false,
    error: {
      id: errorId(cell),
      message: messageForError(error.messageKey, error),
    },
  };
}

function localError(
  cell: GridCellAddress,
  code: string,
  messageForError: CommitTaskCellEditorValueInput['messageForError'],
): GridEditorCommitResult {
  const error: CellValidationError = {
    code,
    messageKey: `taskGrid.validation.${code}`,
    rowKey: cell.rowKey,
    columnId: cell.columnId,
  };
  return editorError(cell, error, messageForError);
}

/** Voert de synchrone prepare → plan → commitgrens uit zonder een store- of slicenaam te kennen. */
export function commitTaskCellEditorValue({
  adapter,
  cell,
  text,
  messageForError,
}: CommitTaskCellEditorValueInput): GridEditorCommitResult {
  const meta = adapter.rowMetaByKey.get(cell.rowKey);
  const target: TaskGridAdapterEventTarget = {
    surfaceId: adapter.surfaceId,
    rowKey: cell.rowKey,
    taskId: meta?.kind === 'task' ? meta.taskId : undefined,
    columnId: cell.columnId,
  };
  if (adapter.callbacks.onPrepareEdit?.(target) === false) {
    return localError(cell, 'prepareRejected', messageForError);
  }
  const planned = adapter.planEdit(cell.rowKey, cell.columnId, text);
  if (!planned.ok) {
    const error = planned.errors[0];
    return error
      ? editorError(cell, error, messageForError)
      : localError(cell, 'invalid', messageForError);
  }
  const commit = adapter.callbacks.onCommitEdit;
  if (!commit) return localError(cell, 'commitUnavailable', messageForError);
  const committed = commit(target, planned.value);
  if (!committed.ok) {
    const error = committed.errors[0];
    return error
      ? editorError(cell, error, messageForError)
      : localError(cell, 'commitFailed', messageForError);
  }
  return { ok: true };
}

export interface TaskCellEditorProps {
  adapter: TaskGridAdapter;
  cell: GridCellAddress;
  label: string;
  messageForError: CommitTaskCellEditorValueInput['messageForError'];
  labelForOption?: (labelKey: string, value: string) => string;
  onCancel: () => void;
  onFocusCell: (cell: GridCellAddress) => void;
  nextCell?: GridCellAddress;
}

/**
 * Dunne React-schil. Task 12 vervangt het tekstveld per descriptor-editorKind; validatie,
 * schrijfplanning en commit blijven via dezelfde adaptergrens lopen.
 */
export function TaskCellEditor({
  adapter,
  cell,
  label,
  messageForError,
  labelForOption = (_labelKey, value) => value,
  onCancel,
  onFocusCell,
  nextCell,
}: TaskCellEditorProps) {
  const [text, setText] = useState(
    () => adapter.getCell(cell.rowKey, cell.columnId)?.editText ?? '',
  );
  const descriptor = adapter.descriptorsById.get(cell.columnId);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  useEffect(() => {
    const node = inputRef.current;
    node?.focus();
    if (node instanceof HTMLInputElement) node.select();
  }, [cell.rowKey, cell.columnId]);

  return (
    <GridEditorHost
      cell={cell}
      onCancel={onCancel}
      onFocusCell={onFocusCell}
      onCommit={() => {
        const result = commitTaskCellEditorValue({ adapter, cell, text, messageForError });
        return result.ok && nextCell ? { ...result, nextCell } : result;
      }}
    >
      {inputProps => (
        descriptor?.editorKind === 'enum' && descriptor.editorOptions ? (
          <select
            {...inputProps}
            ref={node => { inputRef.current = node; }}
            aria-label={label}
            value={text}
            onChange={event => setText(event.currentTarget.value)}
            className="task-grid-editor-input"
            data-task-editor-kind="enum"
          >
            {descriptor.editorOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label ?? labelForOption(option.labelKey ?? option.value, option.value)}
              </option>
            ))}
          </select>
        ) : descriptor?.editorKind === 'boolean' ? (
          <select
            {...inputProps}
            ref={node => { inputRef.current = node; }}
            aria-label={label}
            value={text}
            onChange={event => setText(event.currentTarget.value)}
            className="task-grid-editor-input"
            data-task-editor-kind="boolean"
          >
            <option value="">—</option>
            <option value="true">{labelForOption('boolean.true', 'true')}</option>
            <option value="false">{labelForOption('boolean.false', 'false')}</option>
          </select>
        ) : (
          <>
          <input
            {...inputProps}
            ref={node => { inputRef.current = node; }}
            type={descriptor?.editorKind === 'color' ? 'color' : 'text'}
            inputMode={descriptor?.editorKind === 'number' || descriptor?.editorKind === 'percentage'
              ? 'decimal'
              : undefined}
            aria-label={label}
            list={descriptor?.editorKind === 'autocomplete' && descriptor.editorOptions
              ? `${errorId(cell)}-options`
              : undefined}
            value={descriptor?.editorKind === 'color' && !/^#[\da-f]{6}$/i.test(text) ? '#000000' : text}
            onChange={event => setText(event.currentTarget.value)}
            className="task-grid-editor-input"
            data-task-editor-kind={descriptor?.editorKind ?? 'text'}
          />
          {descriptor?.editorKind === 'autocomplete' && descriptor.editorOptions && (
            <datalist id={`${errorId(cell)}-options`}>
              {descriptor.editorOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label ?? labelForOption(option.labelKey ?? option.value, option.value)}
                </option>
              ))}
            </datalist>
          )}
          </>
        )
      )}
    </GridEditorHost>
  );
}
