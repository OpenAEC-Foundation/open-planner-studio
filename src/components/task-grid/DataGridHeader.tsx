import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Minus } from 'lucide-react';
import { CONTEXT_MENU_CONTAINER_CLASS, CONTEXT_MENU_ITEM_CLASS } from '@/components/canvas/ContextMenu';
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

/** Eén kolomkop-rechthoek (viewport-coördinaten, zoals `getBoundingClientRect()` teruggeeft) t.b.v.
 *  `resolveColumnDropTarget`. */
export interface ColumnHeaderRect {
  id: TaskColumnId;
  pinned: boolean;
  left: number;
  right: number;
}

/**
 * Browserreview, observatie 7: bepaalt de kolom-invoegpositie voor kolomherordenen GEBIEDSDEKKEND
 * over de volledige headerbreedte i.p.v. een smalle strook op de kolomgrens zelf — en klemt de
 * pointerpositie naar de dichtstbijzijnde geldige grens zodra hij BUITEN alle kolomkoppen valt (te
 * ver naar links, te ver naar rechts voorbij de laatste kolom, of — via de window-brede
 * dragover/drop-luisteraars die deze functie aanroepen, zie de useEffect hieronder — een paar pixels
 * te laag, over de rijen). Zonder die klem viel een drop die net niet op een headercel landde stil
 * terug op niets: geen enkele kolomkop kreeg het dragover/drop-event, dus de herordening werd
 * zwijgend genegeerd — precies het "je moet exact op de grens droppen"-gevoel uit de melding.
 *
 * Elke kandidaat (alle kolommen behalve de gesleepte zelf, en alleen uit dezelfde pin-groep — een
 * vastgezette kolom mag niet tussen losse kolommen belanden en andersom, zelfde regel als voorheen)
 * levert zijn linkerhelft op als "before" en zijn rechterhelft als "after", zodat ELKE positie in de
 * headerbalk een geldig doel is — nooit een dode zone.
 */
export function resolveColumnDropTarget(
  rects: readonly ColumnHeaderRect[],
  draggedColumnId: TaskColumnId,
  clientX: number,
): { columnId: TaskColumnId; placement: 'before' | 'after' } | null {
  const dragged = rects.find(rect => rect.id === draggedColumnId);
  const candidates = rects
    .filter(rect => rect.id !== draggedColumnId && (!dragged || rect.pinned === dragged.pinned))
    .slice()
    .sort((a, b) => a.left - b.left);
  if (candidates.length === 0) return null;
  const minLeft = candidates[0].left;
  const maxRight = candidates[candidates.length - 1].right;
  const x = Math.max(minLeft, Math.min(clientX, maxRight));
  const hit = candidates.find(rect => x < rect.right) ?? candidates[candidates.length - 1];
  const midpoint = hit.left + (hit.right - hit.left) / 2;
  return { columnId: hit.id, placement: x < midpoint ? 'before' : 'after' };
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
  const headerRowRef = useRef<HTMLDivElement>(null);
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

  // Browserreview, observatie 7: window-brede dragover/drop-luisteraars i.p.v. per-kolomkop
  // handlers (die vervielen hier). Zolang draggedColumnId gezet is (een kolomherordening loopt),
  // vangt dit ELKE dragover/drop in het hele document — ook ver voorbij de laatste kolom, of een
  // paar pixels onder de headerrij (over de tabelrijen). resolveColumnDropTarget klemt de
  // pointerpositie altijd naar de dichtstbijzijnde geldige grens; zonder deze window-luisteraars
  // kreeg zo'n net-mis drop GEEN dragover/drop-event op een headercel (native dragover/drop vuurt
  // alleen op het element letterlijk onder de cursor), en werd de herordening zwijgend genegeerd —
  // precies het "je moet exact op de grens droppen"-gevoel uit de melding. `preventDefault()` moet
  // vallen op ÉÉN van de dragover-events in de keten om de browser een drop toe te staan; een
  // window-listener (bubble-fase, standaard) is daar een geldige plek voor.
  const collectHeaderRects = (): ColumnHeaderRect[] => {
    const row = headerRowRef.current;
    if (!row) return [];
    return Array.from(row.querySelectorAll<HTMLElement>('[data-grid-column-id]')).map(el => {
      const rect = el.getBoundingClientRect();
      return {
        id: el.getAttribute('data-grid-column-id') as TaskColumnId,
        pinned: el.getAttribute('data-grid-pinned') === 'true',
        left: rect.left,
        right: rect.right,
      };
    });
  };

  useEffect(() => {
    if (!draggedColumnId) return;
    const handleDragOver = (event: globalThis.DragEvent) => {
      const target = resolveColumnDropTarget(collectHeaderRects(), draggedColumnId, event.clientX);
      if (!target) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      setDropTarget(target);
    };
    const handleDrop = (event: globalThis.DragEvent) => {
      event.preventDefault();
      const target = resolveColumnDropTarget(collectHeaderRects(), draggedColumnId, event.clientX);
      if (target) onReorderColumn?.(draggedColumnId, target.columnId, target.placement);
      setDraggedColumnId(null);
      setDropTarget(null);
    };
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [draggedColumnId, onReorderColumn]);

  const contextMenuPortal = contextMenu && contextColumn && typeof document !== 'undefined'
    ? createPortal(
      // Browserreview, observatie 6: was `className="task-grid-header-context-menu"` (globals.css)
      // met eigen, losse maatvoering — `font: inherit` in een createPortal naar `document.body` erft
      // daardoor html/body's volle `calc(13px * --ui-font-scale)` i.p.v. de compacte `text-xs` van
      // het taakmenu (ContextMenu.tsx). Nu dezelfde getokeniseerde klassen als dat menu
      // (CONTEXT_MENU_CONTAINER_CLASS/CONTEXT_MENU_ITEM_CLASS, geëxporteerd vanuit ContextMenu.tsx)
      // — één bron voor de maatvoering, zodat ze niet opnieuw uit elkaar kunnen groeien. De
      // role="menu"/role="menuitem"-opbouw blijft van dit menu zelf (dat is al zo ingericht;
      // ContextMenu.tsx's eigen MenuItem heeft die ARIA-rollen niet).
      <div
        ref={contextMenuRef}
        role="menu"
        dir={textDirection}
        aria-label={contextColumn.label}
        className={CONTEXT_MENU_CONTAINER_CLASS}
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
          className={`${CONTEXT_MENU_ITEM_CLASS} text-text-primary`}
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
          className={`${CONTEXT_MENU_ITEM_CLASS} text-text-primary`}
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
          className={`${CONTEXT_MENU_ITEM_CLASS} text-text-primary`}
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
        ref={headerRowRef}
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
            data-grid-column-id={column.id}
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
            // onDragOver/onDrop staan niet meer per kolomkop — de window-brede luisteraars
            // hierboven (observatie 7) vangen ELKE dragover/drop tijdens een actieve
            // herordening, geklemd naar de dichtstbijzijnde geldige grens. onDragEnd blijft als
            // vangnet voor het geval de sleep buiten het venster eindigt (bv. losgelaten buiten
            // de browser) zonder dat er ooit een 'drop' vuurt.
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
