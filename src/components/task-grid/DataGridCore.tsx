import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type UIEvent,
} from 'react';
import { computeVirtualWindow, minimalScrollTopForRow } from '@/engine/taskGrid/virtualization';
import { resolveTaskGridCommand, type TaskGridCommand } from '@/engine/taskGrid/navigation';
import { shouldRequestTaskGridCellFocus } from '@/engine/taskGrid/editLifecycle';
import { DataGridHeader, computePinnedColumnLayout, type DataGridHeaderProps } from './DataGridHeader';
import { GridCell } from './GridCell';
import {
  TaskGridContext,
  gridCellKey,
  type DataGridCellModel,
  type DataGridColumnModel,
  type DataGridDataRowModel,
  type DataGridLabels,
  type DataGridRowModel,
} from './taskGridContext';
import type { GridCellAddress, GridSelectionState } from '@/engine/taskGrid/selection';
import type { TaskColumnId } from '@/types/taskGrid';

export interface DataGridCoreProps {
  rows: readonly DataGridRowModel[];
  columns: readonly DataGridColumnModel[];
  selection: Readonly<GridSelectionState>;
  rowHeight: number;
  headerHeight: number;
  viewportHeight: number;
  viewportWidth: number;
  scrollTop: number;
  scrollLeft?: number;
  overscan?: number;
  mode?: 'select' | 'edit';
  textDirection?: 'ltr' | 'rtl';
  getCell: (row: DataGridDataRowModel, column: DataGridColumnModel) => DataGridCellModel;
  labels: DataGridLabels;
  onScrollTopChange?: (scrollTop: number) => void;
  onScrollLeftChange?: (scrollLeft: number) => void;
  onToggleGroup?: (rowKey: string, collapsed: boolean) => void;
  onCommand?: (command: TaskGridCommand) => void;
  onCellPointerDown?: (cell: GridCellAddress, event: React.PointerEvent<HTMLDivElement>) => void;
  onCellDoubleClick?: (cell: GridCellAddress, event: React.MouseEvent<HTMLDivElement>) => void;
  onCellContextMenu?: (cell: GridCellAddress, event: React.MouseEvent<HTMLDivElement>) => void;
  onDataRowMouseDown?: (
    row: DataGridDataRowModel,
    absoluteIndex: number,
    event: React.MouseEvent<HTMLDivElement>,
  ) => void;
  onDataRowMouseMove?: (
    row: DataGridDataRowModel,
    event: React.MouseEvent<HTMLDivElement>,
  ) => void;
  onDataRowMouseLeave?: (row: DataGridDataRowModel) => void;
  onGroupContextMenu?: (
    row: Extract<DataGridRowModel, { kind: 'group' }>,
    event: React.MouseEvent<HTMLDivElement>,
  ) => void;
  onCopy?: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  onPaste?: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  onResizeStart?: DataGridHeaderProps['onResizeStart'];
  onResizePreview?: DataGridHeaderProps['onResizePreview'];
  onResizeCommit?: DataGridHeaderProps['onResizeCommit'];
  onResizeCancel?: DataGridHeaderProps['onResizeCancel'];
  onRemoveColumn?: DataGridHeaderProps['onRemoveColumn'];
  onTogglePinned?: DataGridHeaderProps['onTogglePinned'];
  onAutoFitColumn?: DataGridHeaderProps['onAutoFitColumn'];
  onReorderColumn?: DataGridHeaderProps['onReorderColumn'];
  /** Browserreview, observatie 3b: de kolom die MOMENTEEL actief geresized wordt (via de handle of
   *  het toetsenbord), of `null` buiten een resize. Drijft de volledige-hoogte hulplijn — zie
   *  `resizeGuidelineLeft`. */
  resizeGuidelineColumnId?: TaskColumnId | null;
}

/** Eén eigenaar voor een herkende gridtoets: annuleer browsergedrag, stop bubbling en voer exact
 * één gridopdracht uit — behalve 'exit-to-container' (Escape in selectiemodus), die het event
 * bewust laat doorbubbelen naar de globale `edit.deselect`-sneltoets. De losse functie houdt
 * dezelfde native-eventketen regressietestbaar. */
/**
 * Browserreview, observatie 3b: de kolomresize-hulplijn moet de VOLLEDIGE zichtbare tabelhoogte
 * bestrijken (header + rijen), niet alleen de headerrij — vóór deze fix bestond de "hulplijn"
 * puur uit de hover-/focusachtergrond van `.task-grid-resize-handle`, die `position:absolute` is
 * ten opzichte van de HEADERCEL zelf (`inset-block:0` op een cel van ~28px hoog), dus zichtbaar
 * losstaand van de rijen eronder. Deze pure functie berekent alleen de X-positie (content-space,
 * dus vóór aftrek van scrollLeft — de hulplijn leeft in dezelfde horizontaal scrollende laag als
 * de kolommen zelf, zie de render hieronder) van de RECHTERRAND van de kolom die actief geresized
 * wordt. `null` zodra die kolom niet (meer) in `columns` voorkomt — bv. net verwijderd terwijl de
 * resize nog "actief" leek.
 */
export function resizeGuidelineLeft(
  columns: readonly DataGridColumnModel[],
  columnId: TaskColumnId | null,
): number | null {
  if (columnId === null) return null;
  let x = 0;
  for (const column of columns) {
    x += column.width;
    if (column.id === columnId) return x;
  }
  return null;
}

export function dispatchDataGridKeyCommand(
  event: Pick<KeyboardEvent<HTMLDivElement>, 'preventDefault' | 'stopPropagation'>,
  command: TaskGridCommand,
  onCommand: (command: TaskGridCommand) => void,
): boolean {
  if (command.kind === 'unhandled') return false;
  // Napunt 1 (onafhankelijke eindreview): 'exit-to-container' (Escape in selectiemodus) mag het
  // event NIET opsouperen. De globale `edit.deselect`-sneltoets (shortcutRegistry.ts, altijd actief
  // op kale Escape, `skipPreventDefault: true`) hoort ook binnen een gefocuste gridcel te blijven
  // afvuren — deselectAll, traceMode/showDependencyMode uit, net als vóór FIX 1. De globale poort
  // (`shouldHandleGlobalShortcutEvent`) toetst `!event.defaultPrevented`, dus zowel preventDefault
  // als stopPropagation moeten hier achterwege blijven, anders bereikt Escape de window-listener
  // nooit. De grid regelt uitsluitend zijn eigen focusverplaatsing; het globale deselect-gedrag komt
  // via de normale bubbel — geen dubbele uitvoering, want de grid roept dat gedrag zelf niet aan.
  if (command.kind !== 'exit-to-container') {
    event.preventDefault();
    event.stopPropagation();
  }
  onCommand(command);
  return true;
}

type ClosestClipboardTarget = { closest?: (selector: string) => unknown };

/** Composite editors houden hun tekstklembord; alleen een gewone gridcel gebruikt TSV. */
export function shouldHandleDataGridClipboardEvent(event: {
  target: EventTarget | ClosestClipboardTarget | null;
}): boolean {
  return !(event.target as ClosestClipboardTarget | null)
    ?.closest?.('input, textarea, select, [contenteditable="true"]');
}

function sameCell(left: GridCellAddress | null, right: GridCellAddress | null): boolean {
  return left?.rowKey === right?.rowKey && left?.columnId === right?.columnId;
}

function selectedCell(
  cell: GridCellAddress,
  selection: Readonly<GridSelectionState>,
  rowIndexByKey: ReadonlyMap<string, number>,
  columnIndexById: ReadonlyMap<TaskColumnId, number>,
): boolean {
  const range = selection.range;
  if (!range) return false;
  const row = rowIndexByKey.get(cell.rowKey);
  const fromRow = rowIndexByKey.get(range.start.rowKey);
  const toRow = rowIndexByKey.get(range.end.rowKey);
  const column = columnIndexById.get(cell.columnId);
  const fromColumn = columnIndexById.get(range.start.columnId);
  const toColumn = columnIndexById.get(range.end.columnId);
  if (row === undefined || fromRow === undefined || toRow === undefined
    || column === undefined || fromColumn === undefined || toColumn === undefined) return false;
  return row >= Math.min(fromRow, toRow) && row <= Math.max(fromRow, toRow)
    && column >= Math.min(fromColumn, toColumn) && column <= Math.max(fromColumn, toColumn);
}

function nextFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback);
  else setTimeout(callback, 0);
}

interface DataGridScrollTarget {
  scrollTop: number;
  scrollLeft: number;
}

/** Houd de werkelijke scrollcontainer gelijk aan de gecontroleerde scrollprops. Dit is ook nodig
 * bij programmatische Gantt-sprongen: virtualisatie rekent met `scrollTop`, terwijl de browser de
 * DOM-viewport anders op de oude positie laat staan. */
export function synchronizeDataGridScrollPosition(
  container: DataGridScrollTarget,
  scrollTop: number,
  scrollLeft: number,
): void {
  if (container.scrollTop !== scrollTop) container.scrollTop = scrollTop;
  if (container.scrollLeft !== scrollLeft) container.scrollLeft = scrollLeft;
}

export function DataGridCore({
  rows,
  columns,
  selection,
  rowHeight,
  headerHeight,
  viewportHeight,
  viewportWidth,
  scrollTop,
  scrollLeft = 0,
  overscan,
  mode = 'select',
  textDirection = 'ltr',
  getCell,
  labels,
  onScrollTopChange,
  onScrollLeftChange,
  onToggleGroup,
  onCommand,
  onCellPointerDown,
  onCellDoubleClick,
  onCellContextMenu,
  onDataRowMouseDown,
  onDataRowMouseMove,
  onDataRowMouseLeave,
  onGroupContextMenu,
  onCopy,
  onPaste,
  onResizeStart,
  onResizePreview,
  onResizeCommit,
  onResizeCancel,
  onRemoveColumn,
  onTogglePinned,
  onAutoFitColumn,
  onReorderColumn,
  resizeGuidelineColumnId = null,
}: DataGridCoreProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cellsRef = useRef(new Map<string, HTMLDivElement>());
  const pendingFocusKeyRef = useRef<string | null>(null);
  const lastRequestedActiveKeyRef = useRef<string | null>(null);
  const [announcedMessage, setAnnouncedMessage] = useState('');
  useEffect(() => {
    const container = containerRef.current;
    if (container) synchronizeDataGridScrollPosition(container, scrollTop, scrollLeft);
  }, [scrollLeft, scrollTop]);
  const virtual = useMemo(() => computeVirtualWindow({
    totalRows: rows.length,
    rowHeight,
    viewportHeight,
    scrollTop,
    overscan,
    headerRowCount: 1,
  }), [rows.length, rowHeight, viewportHeight, scrollTop, overscan]);
  const pinned = useMemo(() => computePinnedColumnLayout(columns, viewportWidth), [columns, viewportWidth]);
  const totalWidth = columns.reduce((total, column) => total + column.width, 0);
  const template = columns.map(column => `${column.width}px`).join(' ');
  const guidelineLeft = resizeGuidelineLeft(columns, resizeGuidelineColumnId);
  const rowIndexByKey = useMemo(
    () => new Map(rows.map((row, index) => [row.rowKey, index] as const)),
    [rows],
  );
  const columnIndexById = useMemo(
    () => new Map(columns.map((column, index) => [column.id, index] as const)),
    [columns],
  );
  const dataRows = useMemo(
    () => rows.flatMap((row, absoluteIndex) => row.kind === 'data' ? [{ ...row, absoluteIndex }] : []),
    [rows],
  );
  const navigationIndex = useMemo(() => ({
    taskRows: dataRows,
    taskIndexByRowKey: new Map(dataRows.map((row, index) => [row.rowKey, index] as const)),
    taskAbsoluteIndices: dataRows.map(row => row.absoluteIndex),
  }), [dataRows]);

  const registerCell = useCallback((cell: GridCellAddress, node: HTMLDivElement | null) => {
    const key = gridCellKey(cell);
    if (node) cellsRef.current.set(key, node);
    else cellsRef.current.delete(key);
  }, []);
  const requestCellFocus = useCallback((cell: GridCellAddress) => {
    const key = gridCellKey(cell);
    const mounted = cellsRef.current.get(key);
    if (mounted) {
      pendingFocusKeyRef.current = null;
      nextFrame(() => cellsRef.current.get(key)?.focus());
      return;
    }
    pendingFocusKeyRef.current = key;
    containerRef.current?.focus();
    const absoluteIndex = rowIndexByKey.get(cell.rowKey);
    if (absoluteIndex === undefined || !columnIndexById.has(cell.columnId)) return;
    const nextScrollTop = minimalScrollTopForRow(absoluteIndex, scrollTop, viewportHeight, rowHeight, rows.length);
    if (nextScrollTop !== scrollTop) {
      if (containerRef.current) containerRef.current.scrollTop = nextScrollTop;
      onScrollTopChange?.(nextScrollTop);
    }
    nextFrame(() => {
      const node = cellsRef.current.get(key);
      if (!node) return;
      pendingFocusKeyRef.current = null;
      node.focus();
    });
  }, [rowIndexByKey, columnIndexById, scrollTop, viewportHeight, rowHeight, rows.length, onScrollTopChange]);

  const activeRowIndex = selection.active ? rowIndexByKey.get(selection.active.rowKey) : undefined;
  const activeColumnIndex = selection.active ? columnIndexById.get(selection.active.columnId) : undefined;
  const activeMounted = activeRowIndex !== undefined && activeColumnIndex !== undefined
    && activeRowIndex >= virtual.startIndex && activeRowIndex < virtual.endIndexExclusive
    && rows[activeRowIndex]?.kind === 'data';

  const activeKey = selection.active ? gridCellKey(selection.active) : null;
  useEffect(() => {
    const shouldRequestFocus = shouldRequestTaskGridCellFocus({
      mode,
      activeKey,
      lastRequestedActiveKey: lastRequestedActiveKeyRef.current,
    });
    lastRequestedActiveKeyRef.current = activeKey;
    if (!shouldRequestFocus || !selection.active) {
      pendingFocusKeyRef.current = null;
      return;
    }
    requestCellFocus(selection.active);
  }, [activeKey, mode, selection.active, requestCellFocus]);

  useEffect(() => {
    setAnnouncedMessage('');
  }, [activeKey]);

  useEffect(() => {
    const key = pendingFocusKeyRef.current;
    if (!key) return;
    const node = cellsRef.current.get(key);
    if (!node) return;
    pendingFocusKeyRef.current = null;
    nextFrame(() => node.focus());
  }, [virtual.startIndex, virtual.endIndexExclusive]);

  useEffect(() => {
    if (activeMounted || !activeKey || typeof document === 'undefined') return;
    const container = containerRef.current;
    if (!container) return;
    const focused = document.activeElement;
    if (!focused || focused === document.body || !focused.isConnected) container.focus();
  }, [activeMounted, activeKey]);

  const activeDataRow = activeRowIndex !== undefined && rows[activeRowIndex]?.kind === 'data'
    ? rows[activeRowIndex] as DataGridDataRowModel
    : null;
  const activeColumn = activeColumnIndex !== undefined ? columns[activeColumnIndex] : undefined;
  const activeError = activeDataRow && activeColumn ? getCell(activeDataRow, activeColumn).error : undefined;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!selection.active || !onCommand || event.defaultPrevented
      || target.closest('button,input,select,textarea,[contenteditable="true"]')) return;
    const command = resolveTaskGridCommand({
      event,
      mode,
      active: selection.active,
      rowIndex: navigationIndex,
      columns: columns.map(column => column.id),
      rowHeight,
      viewportHeight,
      isReadOnly: cell => {
        const rowIndex = rowIndexByKey.get(cell.rowKey);
        const columnIndex = columnIndexById.get(cell.columnId);
        const row = rowIndex === undefined ? undefined : rows[rowIndex];
        const column = columnIndex === undefined ? undefined : columns[columnIndex];
        return !row || row.kind !== 'data' || !column || getCell(row, column).readOnly;
      },
    });
    dispatchDataGridKeyCommand(event, command, onCommand);
    // WCAG 2.1.2: Escape in selectmodus geeft een expliciete uitgang. De logische selectie
    // (`selection.active`) blijft ongewijzigd, maar de DOM-focus verhuist naar de gridcontainer,
    // die zelf geen taborde-stop is (`tabIndex={activeMounted ? -1 : 0}`) — een daaropvolgende Tab
    // verlaat het grid dus meteen, zonder eerst weer een cel te bezoeken.
    if (command.kind === 'exit-to-container') containerRef.current?.focus();
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    onScrollTopChange?.(event.currentTarget.scrollTop);
    onScrollLeftChange?.(event.currentTarget.scrollLeft);
  };

  return (
    <TaskGridContext.Provider value={{
      selection,
      registerCell,
      requestCellFocus,
      announce: setAnnouncedMessage,
    }}>
      <div
        ref={containerRef}
        role="grid"
        aria-label={labels.grid}
        aria-multiselectable="true"
        aria-rowcount={rows.length + 1}
        aria-colcount={columns.length}
        tabIndex={activeMounted ? -1 : 0}
        className="task-grid-core"
        dir="ltr"
        data-grid-sticky-enabled={pinned.stickyEnabled ? 'true' : 'false'}
        style={{ width: viewportWidth, height: headerHeight + viewportHeight, direction: 'ltr' }}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onCopy={event => {
          if (shouldHandleDataGridClipboardEvent(event)) onCopy?.(event);
        }}
        onPaste={event => {
          if (shouldHandleDataGridClipboardEvent(event)) onPaste?.(event);
        }}
      >
        {guidelineLeft !== null && (
          // Browserreview, observatie 3b: MOET vóór `<DataGridHeader>` in de DOM staan — een
          // `position:sticky`-element start zijn "natuurlijke" (ongescrolde) positie op de plek waar
          // het in de gewone flow zou staan, en plakt pas daarna aan `top:0` zodra scrollen het
          // anders naar boven zou duwen. Ná de header renderen zou die natuurlijke positie op de
          // ONDERKANT van de header leggen (getest: de lijn begon dan pas bij y = headerHeight, niet
          // bij y = 0) — vóór de header renderen geeft 'm exact dezelfde starthoogte als de header
          // zelf, dus de lijn bestrijkt zowel de header als alle rijen eronder. Alleen `top` (geen
          // `left`) is gezet, dus de VERTICALE as plakt aan de bovenkant van déze scrollcontainer —
          // precies zoals de headerrij zelf — terwijl de HORIZONTALE positie (via
          // `marginInlineStart`, niet `left`, want dat zou ook horizontaal plakken) gewoon meescrollt
          // met de kolommen. `height:0` op de buitenste laag houdt 'm buiten de flow (geen invloed op
          // scrollHeight); de binnenste laag is `position:absolute` op die buitenste laag en tekent
          // de daadwerkelijke lijn, met `overflow:visible` (default) zodat ze buiten de 0-hoge
          // buitenste doos mag uitsteken.
          <div
            className="task-grid-resize-guideline"
            style={{ marginInlineStart: guidelineLeft }}
          >
            <span
              className="task-grid-resize-guideline-line"
              style={{ height: headerHeight + viewportHeight }}
            />
          </div>
        )}
        <DataGridHeader
          columns={columns}
          height={headerHeight}
          viewportWidth={viewportWidth}
          textDirection={textDirection}
          labels={labels}
          onResizeStart={onResizeStart}
          onResizePreview={onResizePreview}
          onResizeCommit={onResizeCommit}
          onResizeCancel={onResizeCancel}
          onRemoveColumn={onRemoveColumn}
          onTogglePinned={onTogglePinned}
          onAutoFitColumn={onAutoFitColumn}
          onReorderColumn={onReorderColumn}
        />
        <div role="presentation" className="task-grid-body" style={{ minWidth: totalWidth }}>
          <div
            role="presentation"
            data-grid-top-spacer={virtual.topSpacerHeight}
            style={{ height: virtual.topSpacerHeight }}
          />
          {virtual.mountedRows.map(mounted => {
            const row = rows[mounted.index];
            if (row.kind === 'group') {
              const expanded = !row.collapsed;
              return (
                <div
                  key={row.rowKey}
                  role="row"
                  aria-rowindex={mounted.ariaRowIndex}
                  className="task-grid-group-row"
                  style={{ height: rowHeight, minWidth: totalWidth, direction: 'ltr' }}
                  onContextMenu={event => onGroupContextMenu?.(row, event)}
                >
                  {columns.length > 0 && (
                    <div
                      role="gridcell"
                      aria-colindex={1}
                      aria-colspan={columns.length}
                      dir={textDirection}
                      data-grid-group-cell="true"
                      className="task-grid-group-cell"
                      style={{ width: totalWidth, height: rowHeight, paddingInlineStart: 8 + row.depth * 14 }}
                    >
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={expanded ? labels.collapseGroup(row.label) : labels.expandGroup(row.label)}
                        className="task-grid-group-toggle"
                        onClick={() => onToggleGroup?.(row.rowKey, !row.collapsed)}
                      >
                        <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                        <span className="task-grid-group-label">{row.label}</span>
                        <span className="task-grid-group-count">{row.count}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div
                key={row.rowKey}
                role="row"
                aria-rowindex={mounted.ariaRowIndex}
                data-grid-data-row="true"
                data-grid-row-key={row.rowKey}
                data-ops-row-index={mounted.index}
                data-grid-dimmed={row.dimmed ? 'true' : undefined}
                data-grid-row-selected={row.selected ? 'true' : undefined}
                data-grid-trace-role={row.traceClass?.replace('task-grid-trace-', '')}
                data-grid-drop-zone={row.dropZone ?? undefined}
                data-grid-dragging={row.dragging ? 'true' : undefined}
                className={`task-grid-data-row${row.traceClass ? ` ${row.traceClass}` : ''}`}
                style={{ height: rowHeight, minWidth: totalWidth, gridTemplateColumns: template, direction: 'ltr' }}
                onMouseDown={event => onDataRowMouseDown?.(row, mounted.index, event)}
                onMouseMove={event => onDataRowMouseMove?.(row, event)}
                onMouseLeave={() => onDataRowMouseLeave?.(row)}
              >
                {columns.map((column, columnIndex) => {
                  const cell = { rowKey: row.rowKey, columnId: column.id };
                  return (
                    <GridCell
                      key={column.id}
                      cell={cell}
                      column={column}
                      columnIndex={columnIndex}
                      model={getCell(row, column)}
                      selected={selectedCell(cell, selection, rowIndexByKey, columnIndexById)}
                      active={sameCell(cell, selection.active)}
                      rowHeight={rowHeight}
                      textDirection={textDirection}
                      stickyEnabled={pinned.stickyEnabled}
                      pinnedLeft={pinned.leftByColumnId.get(column.id)}
                      onPointerDown={onCellPointerDown}
                      onDoubleClick={onCellDoubleClick}
                      onContextMenu={onCellContextMenu}
                    />
                  );
                })}
              </div>
            );
          })}
          <div
            role="presentation"
            data-grid-bottom-spacer={virtual.bottomSpacerHeight}
            style={{ height: virtual.bottomSpacerHeight }}
          />
        </div>
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcedMessage || activeError?.message || ''}
        </div>
      </div>
    </TaskGridContext.Provider>
  );
}
