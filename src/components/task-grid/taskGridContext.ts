import { createContext, useContext, type ReactNode } from 'react';
import type { GridCellAddress, GridSelectionState } from '@/engine/taskGrid/selection';
import type { TaskColumnId } from '@/types/taskGrid';

export interface DataGridColumnModel {
  id: TaskColumnId;
  label: string;
  width: number;
  pinned: boolean;
  align?: 'start' | 'center' | 'end';
}

export interface DataGridDataRowModel {
  kind: 'data';
  rowKey: string;
  depth: number;
  dimmed?: boolean;
  selected?: boolean;
  traceClass?: string | null;
  dropZone?: 'before' | 'after' | 'nest' | null;
  dragging?: boolean;
}

export interface DataGridGroupRowModel {
  kind: 'group';
  rowKey: string;
  label: string;
  count: number;
  depth: number;
  collapsed: boolean;
}

export type DataGridRowModel = DataGridDataRowModel | DataGridGroupRowModel;

export interface DataGridError {
  id: string;
  message: string;
}

export interface DataGridCellModel {
  text: string;
  content?: ReactNode;
  readOnly: boolean;
  stale?: boolean;
  statusText?: string;
  title?: string;
  error?: DataGridError;
}

export interface DataGridLabels {
  grid: string;
  collapseGroup: (label: string) => string;
  expandGroup: (label: string) => string;
  resizeColumn: (label: string) => string;
  removeColumn: (label: string) => string;
  pinColumn: string;
  unpinColumn: string;
  autoFitColumn: string;
}

export interface TaskGridContextValue {
  selection: Readonly<GridSelectionState>;
  registerCell: (cell: GridCellAddress, node: HTMLDivElement | null) => void;
  requestCellFocus: (cell: GridCellAddress) => void;
  announce: (message: string) => void;
}

export const TaskGridContext = createContext<TaskGridContextValue | null>(null);

export function useTaskGridContext(): TaskGridContextValue {
  const value = useContext(TaskGridContext);
  if (!value) throw new Error('TaskGridContext ontbreekt rond een gridcel');
  return value;
}

export function gridCellKey(cell: GridCellAddress): string {
  return `${cell.rowKey}\u0000${cell.columnId}`;
}
