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
  onCancel,
  onFocusCell,
  nextCell,
}: TaskCellEditorProps) {
  const [text, setText] = useState(() => adapter.copyCell(cell.rowKey, cell.columnId) ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
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
        <input
          {...inputProps}
          ref={inputRef}
          type="text"
          aria-label={label}
          value={text}
          onChange={event => setText(event.currentTarget.value)}
          className="task-grid-editor-input"
        />
      )}
    </GridEditorHost>
  );
}
