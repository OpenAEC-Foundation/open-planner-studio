import { useContext, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { GridCellAddress } from '@/engine/taskGrid/selection';
import { TaskGridContext, type DataGridError } from './taskGridContext';

export type GridEditorCommitResult =
  | { ok: true; nextCell?: GridCellAddress }
  | { ok: false; error: DataGridError };

export interface GridEditorInputProps {
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

export interface GridEditorHostProps {
  cell: GridCellAddress;
  error?: DataGridError;
  onCancel: () => void;
  onCommit: () => GridEditorCommitResult;
  onFocusCell: (cell: GridCellAddress) => void;
  children: (inputProps: GridEditorInputProps) => ReactNode;
}

export function GridEditorHost({
  cell,
  error,
  onCancel,
  onCommit,
  onFocusCell,
  children,
}: GridEditorHostProps) {
  const [currentError, setCurrentError] = useState<DataGridError | undefined>(error);
  const grid = useContext(TaskGridContext);
  useEffect(() => setCurrentError(error), [error, cell.rowKey, cell.columnId]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setCurrentError(undefined);
      grid?.announce('');
      onCancel();
      onFocusCell(cell);
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    const result = onCommit();
    if (!result.ok) {
      setCurrentError(result.error);
      grid?.announce(result.error.message);
      return;
    }
    setCurrentError(undefined);
    grid?.announce('');
    onFocusCell(result.nextCell ?? cell);
  };

  return (
    <div className="task-grid-editor-host" data-grid-editor-cell={`${cell.rowKey}\u0000${cell.columnId}`}>
      {children({
        'aria-invalid': currentError ? true : undefined,
        'aria-describedby': currentError?.id,
        onKeyDown,
      })}
      {currentError && <span id={currentError.id} className="task-grid-editor-error">{currentError.message}</span>}
    </div>
  );
}
