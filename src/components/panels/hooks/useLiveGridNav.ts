import { useCallback, useRef, type KeyboardEvent } from 'react';
import {
  controlKindOf, isLastGridRow, liveGridNavDirection, neighbourGridCell, scrollDeltaToReveal,
} from '@/utils/gridNavigation';

export function useLiveGridNav<F extends string>({ rowIds, fields, onAppendRow }: {
  rowIds: readonly string[];
  fields: readonly F[];
  onAppendRow?: () => boolean;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const pendingFocus = useRef<{ rowId: string; field: F } | null>(null);

  const cellElement = useCallback((rowId: string, field: F): HTMLElement | null => {
    const root = gridRef.current;
    if (!root) return null;
    const sel = `[data-ops-grid-cell="${cssEscape(rowId)}:${cssEscape(field)}"]`;
    const el = root.querySelector<HTMLElement>(sel);
    if (!el) return null;
    if ((el as HTMLInputElement).disabled) return null;
    return el;
  }, []);

  const revealElement = useCallback((el: HTMLElement) => {
    const root = gridRef.current;
    if (!root) return;
    const row: HTMLElement = el.closest('tr') ?? el;
    const head = root.querySelector('thead');
    const delta = scrollDeltaToReveal(
      root.getBoundingClientRect(),
      row.getBoundingClientRect(),
      head ? head.getBoundingClientRect().height : 0,
    );
    if (delta !== 0) root.scrollTop += delta;
  }, []);

  const revealCell = useCallback((rowId: string, field: F): boolean => {
    const el = cellElement(rowId, field);
    if (!el) return false;
    revealElement(el);
    return true;
  }, [cellElement, revealElement]);

  const focusCell = useCallback((rowId: string, field: F): boolean => {
    const el = cellElement(rowId, field);
    if (!el) return false;
    el.focus({ preventScroll: true });
    revealElement(el);
    if (el instanceof HTMLInputElement && el.type !== 'number') el.select();
    return true;
  }, [cellElement, revealElement]);

  const requestFocus = useCallback((rowId: string, field: F) => {
    pendingFocus.current = { rowId, field };
  }, []);

  const flushPendingFocus = useCallback(() => {
    const want = pendingFocus.current;
    if (!want) return;
    pendingFocus.current = null;
    focusCell(want.rowId, want.field);
  }, [focusCell]);

  const move = useCallback((rowId: string, field: F, direction: 'up' | 'down'): boolean => {
    let cur = { rowId, field };
    for (let guard = 0; guard <= rowIds.length; guard++) {
      const next = neighbourGridCell(rowIds, fields, cur, direction);
      if (!next) break;
      if (focusCell(next.rowId, next.field)) return true;
      cur = next;
    }
    if (direction === 'down' && isLastGridRow(rowIds, rowId) && onAppendRow) return onAppendRow();
    return false;
  }, [rowIds, fields, focusCell, onAppendRow]);

  const cellProps = useCallback((rowId: string, field: F) => ({
    'data-ops-grid-cell': `${rowId}:${field}`,
    onKeyDown: (e: KeyboardEvent) => {
      const target = e.target as HTMLElement & { type?: string };
      const direction = liveGridNavDirection(e, controlKindOf(target));
      if (!direction) return;
      e.preventDefault();
      e.stopPropagation();
      move(rowId, field, direction);
    },
  }), [move]);

  const rowProps = useCallback((rowId: string) => ({ 'data-ops-grid-row': rowId }), []);

  return { gridRef, cellProps, rowProps, focusCell, revealCell, requestFocus, flushPendingFocus, move };
}

function cssEscape(value: string): string {
  const g = globalThis as { CSS?: { escape?: (v: string) => string } };
  if (typeof g.CSS?.escape === 'function') return g.CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}
