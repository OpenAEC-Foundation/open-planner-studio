import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { TaskColumnId } from '@/types/taskGrid';
import type { DataGridColumnModel, DataGridLabels } from './taskGridContext';

export const DATA_GRID_COLUMN_MIN_WIDTH = 40;
export const DATA_GRID_COLUMN_MAX_WIDTH = 480;

export interface PinnedColumnLayout {
  stickyEnabled: boolean;
  totalPinnedWidth: number;
  leftByColumnId: ReadonlyMap<TaskColumnId, number>;
}

export function computePinnedColumnLayout(
  columns: readonly DataGridColumnModel[],
  viewportWidth: number,
): PinnedColumnLayout {
  const totalPinnedWidth = columns.reduce((total, column) => total + (column.pinned ? column.width : 0), 0);
  const stickyEnabled = totalPinnedWidth === 0 || (viewportWidth > 0 && totalPinnedWidth <= viewportWidth);
  const leftByColumnId = new Map<TaskColumnId, number>();
  if (stickyEnabled) {
    let left = 0;
    for (const column of columns) {
      if (!column.pinned) continue;
      leftByColumnId.set(column.id, left);
      left += column.width;
    }
  }
  return { stickyEnabled, totalPinnedWidth, leftByColumnId };
}

function clampWidth(width: number): number {
  return Math.max(DATA_GRID_COLUMN_MIN_WIDTH, Math.min(DATA_GRID_COLUMN_MAX_WIDTH, Math.round(width)));
}

export function keyboardResizeWidth(
  width: number,
  key: 'ArrowLeft' | 'ArrowRight',
  shiftKey: boolean,
): number {
  const step = shiftKey ? 32 : 8;
  return clampWidth(width + (key === 'ArrowRight' ? step : -step));
}

export interface DataGridHeaderProps {
  columns: readonly DataGridColumnModel[];
  height: number;
  viewportWidth: number;
  labels: DataGridLabels;
  onResizeStart?: (columnId: TaskColumnId, before: number) => void;
  onResizePreview?: (columnId: TaskColumnId, width: number) => void;
  onResizeCommit?: (columnId: TaskColumnId, before: number, after: number) => void;
  onResizeCancel?: (columnId: TaskColumnId, before: number) => void;
}

interface ResizeDrag {
  columnId: TaskColumnId;
  before: number;
  current: number;
  startX: number;
  pointerId: number;
}

interface PendingResizePreview {
  columnId: TaskColumnId;
  width: number;
}

export function DataGridHeader({
  columns,
  height,
  viewportWidth,
  labels,
  onResizeStart,
  onResizePreview,
  onResizeCommit,
  onResizeCancel,
}: DataGridHeaderProps) {
  const [drag, setDrag] = useState<ResizeDrag | null>(null);
  const dragRef = useRef<ResizeDrag | null>(null);
  const pendingPreviewRef = useRef<PendingResizePreview | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const pinned = computePinnedColumnLayout(columns, viewportWidth);
  const totalWidth = columns.reduce((total, column) => total + column.width, 0);
  const template = columns.map(column => `${column.width}px`).join(' ');

  const cancelScheduledPreview = () => {
    if (previewFrameRef.current !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(previewFrameRef.current);
    }
    previewFrameRef.current = null;
    pendingPreviewRef.current = null;
  };

  const schedulePreview = (columnId: TaskColumnId, width: number) => {
    pendingPreviewRef.current = { columnId, width };
    if (previewFrameRef.current !== null) return;
    if (typeof requestAnimationFrame !== 'function') {
      const pending = pendingPreviewRef.current;
      pendingPreviewRef.current = null;
      if (pending) onResizePreview?.(pending.columnId, pending.width);
      return;
    }
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null;
      const pending = pendingPreviewRef.current;
      pendingPreviewRef.current = null;
      if (pending) onResizePreview?.(pending.columnId, pending.width);
    });
  };

  useEffect(() => cancelScheduledPreview, []);

  const beginResize = (event: PointerEvent<HTMLButtonElement>, column: DataGridColumnModel) => {
    event.preventDefault();
    if (dragRef.current) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const nextDrag = {
      columnId: column.id,
      before: column.width,
      current: column.width,
      startX: event.clientX,
      pointerId: event.pointerId,
    };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
    onResizeStart?.(column.id, column.width);
  };

  const moveResize = (event: PointerEvent<HTMLButtonElement>, column: DataGridColumnModel) => {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.columnId !== column.id || currentDrag.pointerId !== event.pointerId) return;
    const width = clampWidth(currentDrag.before + event.clientX - currentDrag.startX);
    if (width === currentDrag.current) return;
    const nextDrag = { ...currentDrag, current: width };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
    schedulePreview(column.id, width);
  };

  const finishResize = (column: DataGridColumnModel, pointerId?: number) => {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.columnId !== column.id
      || (pointerId !== undefined && currentDrag.pointerId !== pointerId)) return;
    cancelScheduledPreview();
    dragRef.current = null;
    setDrag(null);
    onResizePreview?.(column.id, currentDrag.current);
    onResizeCommit?.(column.id, currentDrag.before, currentDrag.current);
  };

  const cancelResize = (column: DataGridColumnModel, pointerId?: number) => {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.columnId !== column.id
      || (pointerId !== undefined && currentDrag.pointerId !== pointerId)) return;
    cancelScheduledPreview();
    dragRef.current = null;
    setDrag(null);
    onResizePreview?.(column.id, currentDrag.before);
    onResizeCancel?.(column.id, currentDrag.before);
  };

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>, column: DataGridColumnModel) => {
    if (event.key === 'Escape' && dragRef.current?.columnId === column.id) {
      event.preventDefault();
      cancelResize(column);
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const after = keyboardResizeWidth(column.width, event.key, event.shiftKey);
    if (after === column.width) return;
    onResizeStart?.(column.id, column.width);
    onResizePreview?.(column.id, after);
    onResizeCommit?.(column.id, column.width, after);
  };

  return (
    <div
      role="row"
      aria-rowindex={1}
      className="task-grid-header-row"
      data-grid-sticky-enabled={pinned.stickyEnabled ? 'true' : 'false'}
      style={{ height, minWidth: totalWidth, gridTemplateColumns: template }}
    >
      {columns.map((column, columnIndex) => {
        const left = pinned.leftByColumnId.get(column.id);
        const isSticky = column.pinned && pinned.stickyEnabled && left !== undefined;
        return (
          <div
            key={column.id}
            role="columnheader"
            aria-colindex={columnIndex + 1}
            data-grid-pinned={column.pinned ? 'true' : undefined}
            className="task-grid-column-header"
            style={{
              width: column.width,
              height,
              position: isSticky ? 'sticky' : 'relative',
              left: isSticky ? left : undefined,
              zIndex: isSticky ? 6 : 5,
              justifyContent: column.align === 'end' ? 'flex-end' : column.align === 'center' ? 'center' : 'flex-start',
            }}
          >
            <span className="task-grid-column-label">{column.label}</span>
            <button
              type="button"
              role="separator"
              aria-orientation="vertical"
              aria-label={labels.resizeColumn(column.label)}
              aria-valuemin={DATA_GRID_COLUMN_MIN_WIDTH}
              aria-valuemax={DATA_GRID_COLUMN_MAX_WIDTH}
              aria-valuenow={drag?.columnId === column.id ? drag.current : column.width}
              className="task-grid-resize-handle"
              onPointerDown={event => beginResize(event, column)}
              onPointerMove={event => moveResize(event, column)}
              onPointerUp={event => finishResize(column, event.pointerId)}
              onPointerCancel={event => cancelResize(column, event.pointerId)}
              onLostPointerCapture={event => cancelResize(column, event.pointerId)}
              onKeyDown={event => resizeWithKeyboard(event, column)}
            />
          </div>
        );
      })}
    </div>
  );
}
