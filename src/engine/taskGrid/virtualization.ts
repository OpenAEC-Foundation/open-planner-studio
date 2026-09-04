import type { TaskColumnId } from '@/types/taskGrid';

export interface VirtualWindowInput {
  totalRows: number;
  rowHeight: number;
  viewportHeight: number;
  scrollTop: number;
  overscan?: number;
  headerRowCount?: number;
}

export interface VirtualMountedRow {
  index: number;
  ariaRowIndex: number;
}

export interface VirtualWindow {
  startIndex: number;
  endIndexExclusive: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  mountedRows: VirtualMountedRow[];
}

export function computeVirtualWindow(input: VirtualWindowInput): VirtualWindow {
  const totalRows = Math.max(0, Math.floor(input.totalRows));
  if (totalRows === 0) {
    return { startIndex: 0, endIndexExclusive: 0, topSpacerHeight: 0, bottomSpacerHeight: 0, mountedRows: [] };
  }
  if (!(input.rowHeight > 0) || !(input.viewportHeight >= 0)) {
    throw new RangeError('rowHeight moet positief zijn en viewportHeight mag niet negatief zijn');
  }
  const overscan = Math.max(0, Math.floor(input.overscan ?? 8));
  const maxScrollTop = Math.max(0, totalRows * input.rowHeight - input.viewportHeight);
  const scrollTop = Math.max(0, Math.min(maxScrollTop, input.scrollTop));
  const firstVisible = Math.min(totalRows - 1, Math.floor(scrollTop / input.rowHeight));
  const lastVisibleExclusive = input.viewportHeight === 0
    ? firstVisible
    : Math.min(totalRows, Math.ceil((scrollTop + input.viewportHeight) / input.rowHeight));
  const startIndex = Math.max(0, firstVisible - overscan);
  let endIndexExclusive = Math.min(totalRows, lastVisibleExclusive + overscan);
  const mountedBudget = Math.ceil(input.viewportHeight / input.rowHeight) + 2 * overscan;
  endIndexExclusive = Math.min(endIndexExclusive, startIndex + mountedBudget);
  const headerRows = Math.max(0, Math.floor(input.headerRowCount ?? 1));
  const mountedRows = Array.from(
    { length: Math.max(0, endIndexExclusive - startIndex) },
    (_, offset) => ({
      index: startIndex + offset,
      ariaRowIndex: startIndex + offset + headerRows + 1,
    }),
  );
  return {
    startIndex,
    endIndexExclusive,
    topSpacerHeight: startIndex * input.rowHeight,
    bottomSpacerHeight: (totalRows - endIndexExclusive) * input.rowHeight,
    mountedRows,
  };
}

/** Minimaal nieuwe scrollTop om een absolute rij volledig te tonen. */
export function minimalScrollTopForRow(
  rowIndex: number,
  currentScrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  totalRows: number,
): number {
  if (totalRows <= 0 || rowHeight <= 0 || viewportHeight < 0) return 0;
  const index = Math.max(0, Math.min(totalRows - 1, Math.floor(rowIndex)));
  const maxScrollTop = Math.max(0, totalRows * rowHeight - viewportHeight);
  const current = Math.max(0, Math.min(maxScrollTop, currentScrollTop));
  const rowTop = index * rowHeight;
  const rowBottom = rowTop + rowHeight;
  if (rowTop < current) return rowTop;
  if (rowBottom > current + viewportHeight) return Math.min(maxScrollTop, rowBottom - viewportHeight);
  return current;
}

export interface VirtualTaskColumn {
  id: TaskColumnId;
  width: number;
  pinned: boolean;
}

/** Indexwindow voor gewone kolommen; pinned kolommen blijven ongeacht hun index gemount. */
export function virtualizeTaskColumns<T extends VirtualTaskColumn>(
  columns: readonly T[],
  startIndex: number,
  endIndexExclusive: number,
): T[] {
  const start = Math.max(0, Math.floor(startIndex));
  const end = Math.max(start, Math.min(columns.length, Math.floor(endIndexExclusive)));
  return columns.filter((column, index) => column.pinned || (index >= start && index < end));
}
