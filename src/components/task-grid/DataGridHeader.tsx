import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Minus } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
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
  textDirection?: 'ltr' | 'rtl';
  labels: DataGridLabels;
  onResizeStart?: (columnId: TaskColumnId, before: number) => boolean | void;
  onResizePreview?: (columnId: TaskColumnId, width: number) => void;
  onResizeCommit?: (columnId: TaskColumnId, before: number, after: number) => void;
  onResizeCancel?: (columnId: TaskColumnId, before: number) => void;
  onRemoveColumn?: (columnId: TaskColumnId) => void;
  onTogglePinned?: (columnId: TaskColumnId, pinned: boolean) => void;
  onAutoFitColumn?: (columnId: TaskColumnId) => void;
  onReorderColumn?: (
    draggedId: TaskColumnId,
    targetId: TaskColumnId,
    placement: 'before' | 'after',
  ) => void;
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

interface HeaderContextMenuState {
  columnId: TaskColumnId;
  x: number;
  y: number;
}

interface HeaderDropTarget {
  columnId: TaskColumnId;
  placement: 'before' | 'after';
}

export function DataGridHeader({
  columns,
  height,
  viewportWidth,
  textDirection = 'ltr',
  labels,
  onResizeStart,
  onResizePreview,
  onResizeCommit,
  onResizeCancel,
  onRemoveColumn,
  onTogglePinned,
  onAutoFitColumn,
  onReorderColumn,
}: DataGridHeaderProps) {
  const [drag, setDrag] = useState<ResizeDrag | null>(null);
  const dragRef = useRef<ResizeDrag | null>(null);
  const pendingPreviewRef = useRef<PendingResizePreview | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<TaskColumnId | null>(null);
  const [dropTarget, setDropTarget] = useState<HeaderDropTarget | null>(null);
  const [contextMenu, setContextMenu] = useState<HeaderContextMenuState | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ left: 0, top: 0 });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const contextTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pinned = computePinnedColumnLayout(columns, viewportWidth);
  const totalWidth = columns.reduce((total, column) => total + column.width, 0);
  const template = columns.map(column => `${column.width}px`).join(' ');
  const contextColumn = contextMenu
    ? columns.find(column => column.id === contextMenu.columnId)
    : undefined;

  useClickOutside(contextMenuRef, () => setContextMenu(null), contextMenu !== null, {
    contextmenu: true,
    defer: true,
  });

  useLayoutEffect(() => {
    if (!contextMenu) return;
    const menu = contextMenuRef.current;
    if (!menu) return;
    setContextMenuPosition({
      left: Math.max(0, Math.min(contextMenu.x, window.innerWidth - menu.offsetWidth)),
      top: Math.max(0, Math.min(contextMenu.y, window.innerHeight - menu.offsetHeight)),
    });
    menu.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [contextMenu]);

  const closeContextMenu = (restoreFocus: boolean) => {
    setContextMenu(null);
    if (!restoreFocus) return;
    const restore = () => contextTriggerRef.current?.focus();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
    else setTimeout(restore, 0);
  };

  const openContextMenu = (
    columnId: TaskColumnId,
    x: number,
    y: number,
    trigger: HTMLButtonElement | null,
  ) => {
    contextTriggerRef.current = trigger;
    setContextMenu({ columnId, x, y });
    setContextMenuPosition({ left: x, top: y });
  };

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
    if (onResizeStart?.(column.id, column.width) === false) return;
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
    if (currentDrag.current === currentDrag.before) {
      onResizeCancel?.(column.id, currentDrag.before);
      return;
    }
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
    if (onResizeStart?.(column.id, column.width) === false) return;
    onResizePreview?.(column.id, after);
    onResizeCommit?.(column.id, column.width, after);
  };

  const updateDropTarget = (event: DragEvent<HTMLDivElement>, column: DataGridColumnModel) => {
    if (!draggedColumnId || draggedColumnId === column.id) return;
    const dragged = columns.find(candidate => candidate.id === draggedColumnId);
    if (!dragged || dragged.pinned !== column.pinned) {
      event.dataTransfer.dropEffect = 'none';
      setDropTarget(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    setDropTarget({
      columnId: column.id,
      placement: event.clientX < rect.left + rect.width / 2 ? 'before' : 'after',
    });
  };

  const contextMenuPortal = contextMenu && contextColumn && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={contextMenuRef}
        role="menu"
        dir={textDirection}
        aria-label={contextColumn.label}
        className="task-grid-header-context-menu"
        style={contextMenuPosition}
        onKeyDown={event => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          closeContextMenu(true);
        }}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onTogglePinned?.(contextColumn.id, !contextColumn.pinned);
            closeContextMenu(true);
          }}
        >
          {contextColumn.pinned ? labels.unpinColumn : labels.pinColumn}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onAutoFitColumn?.(contextColumn.id);
            closeContextMenu(true);
          }}
        >
          {labels.autoFitColumn}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onRemoveColumn?.(contextColumn.id);
            closeContextMenu(false);
          }}
        >
          {labels.removeColumn(contextColumn.label)}
        </button>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <div
        role="row"
        aria-rowindex={1}
        className="task-grid-header-row"
        data-grid-sticky-enabled={pinned.stickyEnabled ? 'true' : 'false'}
        style={{ height, minWidth: totalWidth, gridTemplateColumns: template, direction: 'ltr' }}
      >
        {columns.map((column, columnIndex) => {
          const left = pinned.leftByColumnId.get(column.id);
          const isSticky = column.pinned && pinned.stickyEnabled && left !== undefined;
          return (
            <div
            key={column.id}
            role="columnheader"
            dir={textDirection}
            aria-colindex={columnIndex + 1}
            data-grid-pinned={column.pinned ? 'true' : undefined}
            className="task-grid-column-header"
            draggable={onReorderColumn !== undefined}
            data-grid-dragging={draggedColumnId === column.id ? 'true' : undefined}
            data-grid-drop-before={dropTarget?.columnId === column.id && dropTarget.placement === 'before' ? 'true' : undefined}
            data-grid-drop-after={dropTarget?.columnId === column.id && dropTarget.placement === 'after' ? 'true' : undefined}
            style={{
              width: column.width,
              height,
              position: isSticky ? 'sticky' : 'relative',
              left: isSticky ? left : undefined,
              zIndex: isSticky ? 6 : 5,
              justifyContent: column.align === 'end' ? 'flex-end' : column.align === 'center' ? 'center' : 'flex-start',
            }}
            onDragStart={event => {
              if (!onReorderColumn) return;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', column.id);
              setDraggedColumnId(column.id);
            }}
            onDragOver={event => updateDropTarget(event, column)}
            onDrop={event => {
              event.preventDefault();
              if (draggedColumnId && dropTarget?.columnId === column.id) {
                onReorderColumn?.(draggedColumnId, column.id, dropTarget.placement);
              }
              setDraggedColumnId(null);
              setDropTarget(null);
            }}
            onDragEnd={() => {
              setDraggedColumnId(null);
              setDropTarget(null);
            }}
            onContextMenu={event => {
              event.preventDefault();
              event.stopPropagation();
              openContextMenu(
                column.id,
                event.clientX,
                event.clientY,
                event.currentTarget.querySelector<HTMLButtonElement>('.task-grid-resize-handle'),
              );
            }}
            onKeyDown={event => {
              if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return;
              event.preventDefault();
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              openContextMenu(
                column.id,
                rect.left + Math.min(rect.width, 24),
                rect.top + Math.min(rect.height, 24),
                event.currentTarget.querySelector<HTMLButtonElement>('.task-grid-resize-handle'),
              );
            }}
          >
            <span className="task-grid-column-label">{column.label}</span>
            <button
              type="button"
              draggable={false}
              aria-label={labels.removeColumn(column.label)}
              className="task-grid-remove-column"
              onDragStart={event => event.preventDefault()}
              onClick={event => {
                event.stopPropagation();
                onRemoveColumn?.(column.id);
              }}
            >
              <Minus size={12} aria-hidden="true" />
            </button>
            <button
              type="button"
              draggable={false}
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
              onDoubleClick={event => {
                event.preventDefault();
                onAutoFitColumn?.(column.id);
              }}
            />
            </div>
          );
        })}
      </div>
      {contextMenuPortal}
    </>
  );
}
