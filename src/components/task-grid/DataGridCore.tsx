import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type UIEvent,
  type WheelEvent,
} from 'react';
import { computeVirtualWindow, minimalScrollTopForRow } from '@/engine/taskGrid/virtualization';
import { resolveTaskGridCommand, type TaskGridCommand } from '@/engine/taskGrid/navigation';
import { shouldRequestTaskGridCellFocus } from '@/engine/taskGrid/editLifecycle';
import { GROUPED_NAME_INDENT_UNIT } from '@/engine/taskGrid/nameIndent';
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
import { sameCellAddress, type GridCellAddress, type GridSelectionState } from '@/engine/taskGrid/selection';
import type { TaskColumnId } from '@/types/taskGrid';
import { nextFrame } from '@/utils/nextFrame';
import { OVERLAY_SCROLLBAR_SIZE, TASK_GRID_CHOOSER_STRIP, taskListScrollContentHeight } from '@/engine/taskGrid/scrollExtent';

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
  /** Rechtsklik op lege ruimte in het raster (onder de laatste rij), niet op een cel of kop. */
  onEmptyContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onDataRowMouseDown?: (
    row: DataGridDataRowModel,
    absoluteIndex: number,
    event: React.MouseEvent<HTMLDivElement>,
  ) => void;
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
}

/** Eén eigenaar voor een herkende gridtoets: annuleer browsergedrag, stop bubbling en voer exact
 * één gridopdracht uit — behalve 'exit-to-container' (Escape in selectiemodus), die het event
 * bewust laat doorbubbelen naar de globale `edit.deselect`-sneltoets. De losse functie houdt
 * dezelfde native-eventketen regressietestbaar. */
export function dispatchDataGridKeyCommand(
  event: Pick<KeyboardEvent<HTMLDivElement>, 'preventDefault' | 'stopPropagation'>,
  command: TaskGridCommand,
  onCommand: (command: TaskGridCommand) => void,
): boolean {
  if (command.kind === 'unhandled') return false;
  // 'exit-to-container' (Escape in selectiemodus) mag het
  // event NIET opsouperen. De globale `edit.deselect`-sneltoets (shortcutRegistry.ts, altijd actief
  // op kale Escape, `skipPreventDefault: true`) hoort ook binnen een gefocuste gridcel te blijven
  // afvuren — deselectAll, traceMode/showDependencyMode uit. De globale poort
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

/** Staat de focus op een verbonden element buiten `container` (niet op `<body>`)? */
function focusBelongsOutside(container: HTMLElement | null): boolean {
  if (typeof document === 'undefined' || !container) return false;
  const focused = document.activeElement;
  return Boolean(focused && focused !== document.body && focused.isConnected && !container.contains(focused));
}

/**
 * Plan een celfocus voor het volgende frame. `ledger.current` is de nog openstaande focus en alleen
 * die mag nog focussen, één keer: een latere aanvraag vervangt hem, `ledger.current = null` (editor
 * opent, Escape naar de container) laat hem vervallen en `ledger.current?.()` voert hem meteen uit.
 * Zonder die vervaldatum wint een celfocus die vóór een snelle Enter was gepland (pijltoets en Enter
 * binnen één frame, of een traag frame op een belaste machine) het van het invoerveld dat de editor
 * intussen zelf had gefocust: de editor staat open, maar typen komt er niet meer in.
 */
function deferCellFocus(
  ledger: { current: (() => void) | null },
  container: { current: HTMLElement | null },
  focus: () => void,
): void {
  const run = () => {
    if (ledger.current !== run) return;
    ledger.current = null;
    // Is de focus intussen bewust naar een ander onderdeel gegaan (klik op een Gantt-balk, een
    // lintknop, een paneelveld), dan vervalt de celfocus: anders pakte het late frame de focus
    // terug naar het raster en belandde de volgende toets daar — Ctrl+C na een balkklik kopieerde
    // dan de celtekst in plaats van de taak. Dezelfde regel als `focusBelongsElsewhere` bij het
    // aanvragen, maar nu op het moment van uitvoeren.
    if (focusBelongsOutside(container.current)) return;
    focus();
  };
  ledger.current = run;
  nextFrame(run);
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

/** Wiel-delta in pixels; de regelmodus (Firefox) omgerekend zoals de browser ongeveer doet. */
function wheelPixels(delta: number, deltaMode: number): number {
  return deltaMode === 1 ? delta * 16 : delta;
}

/** De wielrichting zoals de browser hem op een gewone scroller toepast: Shift+wiel zonder eigen
 * horizontale delta (Chromium stuurt dan `deltaX=0, deltaY=100`) schuift horizontaal. */
function resolveWheelAxes(event: Pick<WheelEvent<Element>, 'deltaX' | 'deltaY' | 'shiftKey'>): { x: number; y: number } {
  if (event.shiftKey && event.deltaX === 0) return { x: event.deltaY, y: 0 };
  return { x: event.deltaX, y: event.deltaY };
}

/** De overlays zijn geen tabstop (`tabIndex={-1}`: Chromium maakt een scroller anders zelf
 * toetsenbordfocusbaar). Met `tabIndex` pakt een muisklik op de balk wel de focus; dan verliest de
 * actieve cel hem en werken de pijltjes niet meer. Een tegengehouden mousedown laat de focus staan;
 * slepen aan de duim en klikken in de track blijven werken (browsertest). */
function keepFocusOffBar(event: ReactMouseEvent<HTMLDivElement>): void {
  event.preventDefault();
}

/**
 * Echo-wacht tussen het raster en zijn zwevende balken. `echo[axis]` is de laatste waarde die de ene
 * kant in de andere schreef. Meldt de andere kant precies die waarde, dan is dat de echo van onze
 * eigen schrijfactie: niet terugschrijven. Twee snelle schrijfacties kunnen twee events geven die
 * allebei de laatste waarde melden, dus de echo blijft staan tot de volgende schrijfactie. Een event
 * met een andere waarde komt van de gebruiker (wiel, duim, toets); dan vervalt de echo, zodat de
 * gebruiker daarna ook weer precies op die oude waarde kan uitkomen.
 */
function isEcho(echo: { top: number | null; left: number | null }, axis: 'top' | 'left', value: number): boolean {
  const expected = echo[axis];
  if (expected !== null && Math.abs(expected - value) < 1) return true;
  echo[axis] = null;
  return false;
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
  onEmptyContextMenu,
  onDataRowMouseDown,
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
}: DataGridCoreProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Zwevende balken (eigenaarsbesluit 2026-10-15): de native balken van de scroller zijn verborgen
  // (globals.css) en twee dunne overlay-scrollers liggen over de rand, net als `gantt-hscroll`.
  // Elke overlay heeft een spacer met hetzelfde scrollbereik als de scroller, zodat 1 px op de balk
  // 1 px in het raster is. Duim slepen en in de track klikken blijven zo native browsergedrag.
  const hScrollRef = useRef<HTMLDivElement | null>(null);
  const vScrollRef = useRef<HTMLDivElement | null>(null);
  // De laatste waarde die het raster zelf in een overlay schreef. Het scroll-event van die schrijfactie
  // komt later (in WebKitGTK zelfs ná een volgende stap van de wielanimatie van het raster). Meldt de
  // overlay precies die waarde, dan is het onze eigen echo en mag hij het raster niet terugzetten:
  // anders stopt hij de wielanimatie en de store-sprongen (review #362, WebKitGTK 2.52).
  const barEchoRef = useRef<{ top: number | null; left: number | null }>({ top: null, left: null });
  // Andersom hetzelfde: de waarde die een overlay net in het raster schreef. Het scroll-event van het
  // raster meldt die later; spiegelen we hem dan terug, dan stopt de lopende animatie van de overlay
  // (WebKitGTK: wiel boven de horizontale balk bleef op 3 à 10 px steken).
  const coreEchoRef = useRef<{ top: number | null; left: number | null }>({ top: null, left: null });
  // De laatste stand die het raster zelf aan de store meldde (`handleScroll`).
  const reportedRef = useRef<{ top: number | null; left: number | null }>({ top: null, left: null });
  /** Zet een overlay op de stand van het raster en onthoud die waarde als verwachte echo. */
  const mirrorToBar = (bar: HTMLDivElement, axis: 'top' | 'left', value: number) => {
    const current = axis === 'top' ? bar.scrollTop : bar.scrollLeft;
    if (Math.abs(current - value) < 1) return;
    if (axis === 'top') bar.scrollTop = value;
    else bar.scrollLeft = value;
    // De browser rondt en klemt; de echo meldt de waarde die de overlay werkelijk kreeg.
    barEchoRef.current[axis] = axis === 'top' ? bar.scrollTop : bar.scrollLeft;
  };
  /** Meldt de overlay precies onze laatste spiegeling? Dan is dit event een echo (`isEcho`). */
  const isBarEcho = (axis: 'top' | 'left', value: number): boolean => isEcho(barEchoRef.current, axis, value);
  /** Overlay -> raster, en onthoud de waarde als verwachte echo van het raster. */
  const writeToCore = (container: HTMLDivElement, axis: 'top' | 'left', value: number) => {
    const current = axis === 'top' ? container.scrollTop : container.scrollLeft;
    if (Math.abs(current - value) < 1) return;
    if (axis === 'top') container.scrollTop = value;
    else container.scrollLeft = value;
    coreEchoRef.current[axis] = axis === 'top' ? container.scrollTop : container.scrollLeft;
  };
  const cellsRef = useRef(new Map<string, HTMLDivElement>());
  const pendingFocusKeyRef = useRef<string | null>(null);
  // De nog openstaande uitgestelde celfocus (`deferCellFocus`); `null` laat hem vervallen.
  const pendingCellFocusRef = useRef<(() => void) | null>(null);
  const lastRequestedActiveKeyRef = useRef<string | null>(null);
  const [announcedMessage, setAnnouncedMessage] = useState('');
  // Elke as volgt alleen zijn EIGEN prop. Een horizontale scroll (nieuwe `scrollLeft`) mag de
  // verticale stand nooit terugzetten — ook niet als de store die stand ooit anders klemde dan de
  // DOM (eigenaarsbevinding 2026-10-15: opzij schuiven onderaan liet de lijst omhoog springen).
  // Een prop die precies de waarde is die het raster zelf net meldde (`reportedRef`), is de echo
  // via de store: niet terugschrijven. Het raster kan intussen verder zijn (wielanimatie in
  // WebKitGTK); terugschrijven zou die animatie stoppen.
  // Na een eigen schrijfactie vervalt die echo (`null`): het raster staat dan niet meer op de gemelde
  // waarde. Anders slikt de wacht een echte sprong terug in: store 500 -> 800 (effect schrijft 800),
  // terug naar 500 vóór het scroll-event van het raster, prop 500 == gemeld 500, effect slaat over
  // en het late event meldt 800 (review #362).
  useEffect(() => {
    const container = containerRef.current;
    if (!container || scrollTop === reportedRef.current.top) return;
    synchronizeDataGridScrollPosition(container, scrollTop, container.scrollLeft);
    reportedRef.current.top = null;
  }, [scrollTop]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || scrollLeft === reportedRef.current.left) return;
    synchronizeDataGridScrollPosition(container, container.scrollTop, scrollLeft);
    reportedRef.current.left = null;
  }, [scrollLeft]);
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
  // Het scrollbereik volgt uit de props: geen native balken, dus de zichtbare maat is precies
  // `viewportWidth` × (`headerHeight` + `viewportHeight`). De inhoud is de kolommen plus de
  // kiezerstrook, en alle rijen plus de eindstrook (`scrollExtent.ts`).
  const contentWidth = totalWidth + TASK_GRID_CHOOSER_STRIP;
  const overflowX = Math.max(0, contentWidth - viewportWidth);
  // `rows` bevat de spookregel al (als rij), dus geen extra spookregel meetellen.
  const overflowY = Math.max(0, taskListScrollContentHeight(rows.length, rowHeight, false) - viewportHeight);
  const showHorizontalBar = overflowX > 0;
  const showVerticalBar = overflowY > 0;
  // De verticale balk begint onder de kop en stopt boven de horizontale balk: geen hoekvlakje,
  // geen overlap. De spacer is de balkhoogte plus het scrollbereik, dus de bereiken zijn gelijk.
  const verticalBarHeight = Math.max(0, viewportHeight - (showHorizontalBar ? OVERLAY_SCROLLBAR_SIZE : 0));
  // Een overlay die net verschijnt of een ander bereik krijgt, neemt de stand van het raster over.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (hScrollRef.current) mirrorToBar(hScrollRef.current, 'left', container.scrollLeft);
    if (vScrollRef.current) mirrorToBar(vScrollRef.current, 'top', container.scrollTop);
  }, [showHorizontalBar, showVerticalBar, verticalBarHeight, overflowX, overflowY]);
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
      deferCellFocus(pendingCellFocusRef, containerRef, () => cellsRef.current.get(key)?.focus());
      return;
    }
    pendingFocusKeyRef.current = key;
    containerRef.current?.focus();
    const absoluteIndex = rowIndexByKey.get(cell.rowKey);
    if (absoluteIndex === undefined || !columnIndexById.has(cell.columnId)) return;
    const nextScrollTop = minimalScrollTopForRow(
      absoluteIndex, scrollTop, viewportHeight, rowHeight, rows.length, OVERLAY_SCROLLBAR_SIZE,
    );
    if (nextScrollTop !== scrollTop) {
      if (containerRef.current) containerRef.current.scrollTop = nextScrollTop;
      onScrollTopChange?.(nextScrollTop);
    }
    deferCellFocus(pendingCellFocusRef, containerRef, () => {
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
  useLayoutEffect(() => {
    // Sluit de editor (commit of annuleren), dan is zijn invoerveld in déze commit al uit de DOM en
    // staat de focus op <body>. Wachtte de celfocus die de editor net aanvroeg op het volgende frame,
    // dan viel een toets daartussen (Escape, pijl, Enter) naast de grid en focuste het late frame de
    // cel alsnog (r.88-race). Voer hem daarom nu uit, voordat de browser een volgende toets aflevert.
    if (mode !== 'edit') pendingCellFocusRef.current?.();
  }, [mode]);
  useEffect(() => {
    // Een geopende editor neemt de focus zelf (TaskCellEditor) en zet hem bij commit of annuleren
    // terug op een cel. Een celfocus die nog uit de selectiemodus openstaat, vervalt hier: anders
    // berooft hij het zojuist gefocuste invoerveld wanneer het frame pas ná de Enter komt.
    if (mode === 'edit') pendingCellFocusRef.current = null;
    const shouldRequestFocus = shouldRequestTaskGridCellFocus({
      mode,
      activeKey,
      lastRequestedActiveKey: lastRequestedActiveKeyRef.current,
    });
    lastRequestedActiveKeyRef.current = activeKey;
    const focusBelongsElsewhere = focusBelongsOutside(containerRef.current);
    if (!shouldRequestFocus || !selection.active || focusBelongsElsewhere) {
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
    deferCellFocus(pendingCellFocusRef, containerRef, () => node.focus());
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
    // verlaat het grid dus meteen, zonder eerst weer een cel te bezoeken. Een celfocus die nog voor
    // het volgende frame openstaat (pijltoets of commit vlak ervoor) vervalt, anders pakt de cel de
    // focus alsnog terug.
    if (command.kind === 'exit-to-container') {
      pendingCellFocusRef.current = null;
      containerRef.current?.focus();
    }
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollTop: top, scrollLeft: left } = event.currentTarget;
    if (hScrollRef.current && !isEcho(coreEchoRef.current, 'left', left)) mirrorToBar(hScrollRef.current, 'left', left);
    if (vScrollRef.current && !isEcho(coreEchoRef.current, 'top', top)) mirrorToBar(vScrollRef.current, 'top', top);
    reportedRef.current = { top, left };
    onScrollTopChange?.(top);
    onScrollLeftChange?.(left);
  };

  // Overlay -> raster. Het raster vuurt daarna zijn eigen scroll-event (`handleScroll`), dus de
  // store en de meeschuivende Gantt volgen via precies hetzelfde pad als bij muiswiel of toetsen.
  // Een event dat alleen onze eigen spiegeling meldt (`isBarEcho`) slaat hij over.
  const handleHorizontalBarScroll = (event: UIEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const left = event.currentTarget.scrollLeft;
    if (!container || isBarEcho('left', left)) return;
    writeToCore(container, 'left', left);
  };
  const handleVerticalBarScroll = (event: UIEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const top = event.currentTarget.scrollTop;
    if (!container || isBarEcho('top', top)) return;
    writeToCore(container, 'top', top);
  };
  // Het wiel boven een overlay: de overlay schuift zelf langs zijn eigen as (native), de andere as
  // gaat door naar het raster. Shift+wiel telt als horizontaal (`resolveWheelAxes`): boven de
  // horizontale balk schuift de overlay dan zelf, boven de verticale balk schuift het raster opzij.
  // Dat laatste is zoals Chromium op de oude native balk deed. WebKitGTK schoof daar met Shift+wiel
  // juist verticaal; dat verschil is bewust nog niet rechtgezet (keuze voor de eigenaar, review #362).
  const handleBarWheel = (axis: 'x' | 'y') => (event: WheelEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const delta = resolveWheelAxes(event);
    if (axis === 'x' && delta.y !== 0) {
      container.scrollTop += wheelPixels(delta.y, event.deltaMode);
    } else if (axis === 'y' && delta.x !== 0) {
      container.scrollLeft += wheelPixels(delta.x, event.deltaMode);
    }
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
        // `scrollPaddingBottom`: schuift de browser zelf een cel in beeld (focus), dan eindigt die
        // boven de eindstrook en dus boven de zwevende horizontale balk (`minimalScrollTopForRow`).
        style={{
          width: viewportWidth,
          height: headerHeight + viewportHeight,
          direction: 'ltr',
          scrollPaddingBottom: OVERLAY_SCROLLBAR_SIZE,
        }}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onContextMenu={event => {
          // Cellen, groepsrijen en de kop handelen hun eigen rechtsklik af (en voorkomen de default).
          if (event.defaultPrevented || !onEmptyContextMenu) return;
          const target = event.target as Element;
          if (target.closest('[data-grid-data-row], [role="row"], [role="columnheader"]')) return;
          onEmptyContextMenu(event);
        }}
        onCopy={event => {
          if (shouldHandleDataGridClipboardEvent(event)) onCopy?.(event);
        }}
        onPaste={event => {
          if (shouldHandleDataGridClipboardEvent(event)) onPaste?.(event);
        }}
      >
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
                      style={{ width: totalWidth, height: rowHeight, paddingInlineStart: 8 + row.depth * GROUPED_NAME_INDENT_UNIT }}
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
                data-grid-ghost={row.ghost ? 'true' : undefined}
                data-grid-row-selected={row.selected ? 'true' : undefined}
                data-grid-trace-role={row.traceClass?.replace('task-grid-trace-', '')}
                data-grid-drop-zone={row.dropZone ?? undefined}
                data-grid-dragging={row.dragging ? 'true' : undefined}
                className={`task-grid-data-row${row.traceClass ? ` ${row.traceClass}` : ''}`}
                style={{ height: rowHeight, minWidth: totalWidth, gridTemplateColumns: template, direction: 'ltr' }}
                onMouseDown={event => onDataRowMouseDown?.(row, mounted.index, event)}
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
                      active={sameCellAddress(cell, selection.active)}
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
          {/* Eindstrook onder de laatste rij (spookregel): zo blijft die rij boven de zwevende
              horizontale balk zichtbaar. De Gantt rekent met dezelfde hoogte (`scrollExtent.ts`). */}
          <div
            role="presentation"
            data-grid-end-padding={OVERLAY_SCROLLBAR_SIZE}
            style={{ height: OVERLAY_SCROLLBAR_SIZE }}
          />
        </div>
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcedMessage || activeError?.message || ''}
        </div>
      </div>
      {showHorizontalBar && (
        <div
          ref={hScrollRef}
          aria-hidden="true"
          tabIndex={-1}
          dir="ltr"
          data-testid="task-grid-hscroll"
          className="task-grid-overlay-scrollbar task-grid-overlay-scrollbar-x"
          style={{ height: OVERLAY_SCROLLBAR_SIZE }}
          onScroll={handleHorizontalBarScroll}
          onWheel={handleBarWheel('x')}
          onMouseDown={keepFocusOffBar}
        >
          <div style={{ width: contentWidth, height: 1 }} />
        </div>
      )}
      {showVerticalBar && verticalBarHeight > 0 && (
        <div
          ref={vScrollRef}
          aria-hidden="true"
          tabIndex={-1}
          data-testid="task-grid-vscroll"
          className="task-grid-overlay-scrollbar task-grid-overlay-scrollbar-y"
          style={{ top: headerHeight, height: verticalBarHeight, width: OVERLAY_SCROLLBAR_SIZE }}
          onScroll={handleVerticalBarScroll}
          onWheel={handleBarWheel('y')}
          onMouseDown={keepFocusOffBar}
        >
          <div style={{ width: 1, height: verticalBarHeight + overflowY }} />
        </div>
      )}
    </TaskGridContext.Provider>
  );
}
