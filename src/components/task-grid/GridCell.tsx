import { useCallback, useState, type MouseEvent } from 'react';
import { gridCellKey, useTaskGridContext, type DataGridCellModel, type DataGridColumnModel } from './taskGridContext';
import { isClippedBoxTruncated, resolveGridCellTitle } from '@/engine/taskGrid/cellTitle';
import type { GridCellAddress } from '@/engine/taskGrid/selection';

/** Elke box in de cel die zelf afknipt (overflow hidden + ellipsis) draagt dit attribuut; de
 * naamcel knipt bijvoorbeeld niet op de contentspan maar op het geneste tekstlabel. */
export const GRID_CLIP_ATTRIBUTE = 'data-grid-clip';

export function isGridCellTruncated(cell: {
  querySelectorAll: (selector: string) => ArrayLike<{ scrollWidth: number; clientWidth: number }>;
}): boolean {
  const boxes = cell.querySelectorAll(`[${GRID_CLIP_ATTRIBUTE}]`);
  for (let index = 0; index < boxes.length; index++) {
    if (isClippedBoxTruncated(boxes[index])) return true;
  }
  return false;
}

export interface GridCellProps {
  cell: GridCellAddress;
  column: DataGridColumnModel;
  columnIndex: number;
  model: DataGridCellModel;
  selected: boolean;
  active: boolean;
  rowHeight: number;
  textDirection?: 'ltr' | 'rtl';
  stickyEnabled: boolean;
  pinnedLeft?: number;
  onPointerDown?: (cell: GridCellAddress, event: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick?: (cell: GridCellAddress, event: React.MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (cell: GridCellAddress, event: React.MouseEvent<HTMLDivElement>) => void;
}

export function GridCell({
  cell,
  column,
  columnIndex,
  model,
  selected,
  active,
  rowHeight,
  textDirection = 'ltr',
  stickyEnabled,
  pinnedLeft,
  onPointerDown,
  onDoubleClick,
  onContextMenu,
}: GridCellProps) {
  const { registerCell } = useTaskGridContext();
  const ref = useCallback((node: HTMLDivElement | null) => {
    registerCell(cell, node);
  }, [cell, registerCell]);
  const pinned = column.pinned && stickyEnabled && pinnedLeft !== undefined;
  // Issue #89: de volledige celwaarde is alleen een tooltip wanneer de cel hem afknipt. Dat is
  // pas bij de muis te meten (scrollWidth vs. clientWidth), dus de native title wordt bij
  // binnenkomst van de muis bepaald — ruim vóór de hover-vertraging waarmee de browser hem toont.
  const [truncated, setTruncated] = useState(false);
  const measureTruncation = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (model.tooltip || !model.title) return;
    setTruncated(isGridCellTruncated(event.currentTarget));
  }, [model.title, model.tooltip]);
  const title = resolveGridCellTitle({ tooltip: model.tooltip, title: model.title, truncated });

  return (
    <div
      ref={ref}
      role="gridcell"
      dir={textDirection}
      data-grid-data-cell="true"
      data-grid-row-key={cell.rowKey}
      data-grid-column-id={column.id}
      data-grid-cell-key={gridCellKey(cell)}
      data-grid-pinned={column.pinned ? 'true' : undefined}
      data-grid-active={active ? 'true' : undefined}
      data-grid-selected={selected ? 'true' : undefined}
      data-grid-readonly={model.readOnly ? 'true' : undefined}
      data-grid-stale={model.stale ? 'true' : undefined}
      aria-colindex={columnIndex + 1}
      aria-selected={selected}
      aria-readonly={model.readOnly}
      aria-invalid={model.error ? true : undefined}
      aria-describedby={model.error?.id}
      tabIndex={active ? 0 : -1}
      title={title}
      className="task-grid-cell"
      style={{
        width: column.width,
        height: rowHeight,
        justifyContent: column.align === 'end' ? 'flex-end' : column.align === 'center' ? 'center' : 'flex-start',
        position: pinned ? 'sticky' : 'relative',
        left: pinned ? pinnedLeft : undefined,
        zIndex: pinned ? 3 : undefined,
      }}
      onMouseEnter={measureTruncation}
      onMouseLeave={() => setTruncated(false)}
      onPointerDown={event => onPointerDown?.(cell, event)}
      onDoubleClick={event => onDoubleClick?.(cell, event)}
      onContextMenu={event => onContextMenu?.(cell, event)}
    >
      <span className="task-grid-cell-content" data-grid-clip="true">{model.content ?? model.text}</span>
      {model.statusText && <span className="sr-only">{model.statusText}</span>}
      {model.error && <span id={model.error.id} className="sr-only">{model.error.message}</span>}
    </div>
  );
}
