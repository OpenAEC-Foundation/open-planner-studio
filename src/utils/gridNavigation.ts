export type GridDirection = 'up' | 'down' | 'left' | 'right';

export interface GridCellRef<F extends string = string> {
  rowId: string;
  field: F;
}

export function neighbourGridCell<F extends string>(
  rowIds: readonly string[],
  fields: readonly F[],
  cell: GridCellRef<F>,
  direction: GridDirection,
): GridCellRef<F> | null {
  const rowIndex = rowIds.indexOf(cell.rowId);
  const colIndex = fields.indexOf(cell.field);
  if (rowIndex === -1 || colIndex === -1) return null;

  let newRow = rowIndex;
  let newCol = colIndex;
  if (direction === 'up') newRow = rowIndex - 1;
  else if (direction === 'down') newRow = rowIndex + 1;
  else if (direction === 'left') newCol = colIndex - 1;
  else newCol = colIndex + 1;

  if (newRow < 0 || newRow >= rowIds.length) return null;
  if (newCol < 0 || newCol >= fields.length) return null;
  return { rowId: rowIds[newRow], field: fields[newCol] };
}

export function isLastGridRow(rowIds: readonly string[], rowId: string): boolean {
  return rowIds.length > 0 && rowIds[rowIds.length - 1] === rowId;
}

export type GridControlKind = 'text' | 'number' | 'select' | 'other';

export function controlKindOf(el: { tagName: string; type?: string } | null | undefined): GridControlKind {
  if (!el) return 'other';
  const tag = el.tagName.toUpperCase();
  if (tag === 'SELECT') return 'select';
  if (tag === 'TEXTAREA') return 'text';
  if (tag !== 'INPUT') return 'other';
  const type = (el.type ?? 'text').toLowerCase();
  if (type === 'number' || type === 'range') return 'number';
  if (type === 'checkbox' || type === 'radio' || type === 'button' || type === 'submit') return 'other';
  return 'text';
}

export interface GridBox {
  top: number;
  bottom: number;
}

export function scrollDeltaToReveal(viewport: GridBox, row: GridBox, stickyHeaderHeight = 0): number {
  const topLimit = viewport.top + stickyHeaderHeight;
  if (row.top < topLimit) return row.top - topLimit;
  if (row.bottom > viewport.bottom) {
    const delta = row.bottom - viewport.bottom;
    return Math.min(delta, row.top - topLimit);
  }
  return 0;
}

export interface GridKeyEventLike {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export function liveGridNavDirection(e: GridKeyEventLike, control: GridControlKind): 'up' | 'down' | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  if (e.key === 'Enter') return e.shiftKey ? 'up' : 'down';
  if (e.shiftKey) return null;
  if (control !== 'text') return null;
  if (e.key === 'ArrowDown') return 'down';
  if (e.key === 'ArrowUp') return 'up';
  return null;
}
