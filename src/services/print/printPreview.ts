import { ensureCustomBarVisible } from '@/engine/renderer/resourcePalette';
import type { CustomTaskType, Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { isHourModeCalendar, WorkCalendar } from '@/types/calendar';
import { parseDate, formatDate, addCalendarDays, getWeekNumberFor, diffCalendarDays, isoDayOfWeek, utcDayStart, localNowOnDayAxis } from '@/utils/dateUtils';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { DateNotation, DurationDisplay, TimeNotation } from '@/types/view';
import type { Draw2D } from '@/services/pdf/draw2d';
import { CanvasDraw2D } from '@/services/pdf/canvasDraw2d';
import { DEFAULT_REPORT_FONT_STACK } from '@/services/pdf/reportFont';
import { printableWidthLogicalPx } from '@/services/print/tileLayout';
import { PRINT_PALETTE as PRINT_COLORS, doneBarTones } from '@/engine/renderer/themePalette';
import { isCompressedEffective, resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { taskSplitSegments } from '@/engine/renderer/splitBarGeometry';
import { milestoneAnchorX, milestoneMoment, taskBarSpan, type TaskBarSpan } from '@/engine/renderer/barSpan';
import { taskDateLabel } from '@/utils/taskDateLabel';
import { paintProgressBarPiece } from '@/engine/renderer/barPaint';
import { snapToChoice } from '@/utils/numberChoice';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import {
  barCategoryDisplayColor,
  computeBarColors,
  type BarFill,
  type BarPalette,
} from '@/services/print/barColors';
import {
  effectiveBarColorSelection,
  visibleBarColorCategories,
  type BarColorContext,
} from '@/services/print/barColorCategories';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { BarColorSelection } from '@/types/barColor';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { RowAssignment, RowCurve } from '@/engine/reports/resourceGantt';
import { taskTreeRows } from '@/engine/reports/reportPeriodRows';
import { formatReportNumber } from '@/utils/reportNumber';
import { baselineReach, type BaselineOverlay } from '@/types/baseline';
import {
  BASELINE_BLEND_PX, baselineDiamonds, baselineDiamondSize, baselineSpanX, baselineStart, paintBaselineStrip, widenBars,
  type BaselineBar, type BaselineMilestone, type BaselineSlot,
} from '@/engine/renderer/baselineStrip';

const printBaselineColor = (slot: BaselineSlot): string => (
  slot === 0 ? PRINT_COLORS.baseline : slot === 1 ? PRINT_COLORS.baselineCompare1 : PRINT_COLORS.baselineCompare2
);
import { ellipsize } from '@/engine/renderer/textFit';
import { displayDate, displayDateTime } from '@/utils/displayDate';
import { statusDateAsUsed, statusDateInstant } from '@/utils/statusDateTime';
import { shownStart, shownFinish, floatBandEnd } from '@/utils/taskDates';
import { effectiveCalendarOf, effHoursPerDay, formatTaskDurationText } from '@/utils/taskDuration';
import type { DurationSuffixes } from '@/utils/durationFormat';

const ROW_HEIGHT = 24;
const PROJECT_HEADER_HEIGHT = 64;
const TIMELINE_HEADER_HEIGHT = 44;
const FOOTER_HEIGHT = 50;

const MAX_DAILY_GRID_STEPS = 5_000;
const MAX_DAILY_WEEKEND_STEPS = 5_000;

export const REPORT_MAX_ZOOM = 40;
export const REPORT_MIN_DAY_WIDTH = 0.01;

export function fixedScaleStartDayWidth(fitDayWidth: number): number {
  return Math.min(REPORT_MAX_ZOOM, Math.max(REPORT_MIN_DAY_WIDTH, fitDayWidth * (1 - 1e-9)));
}

const DEP_STUB = 6;
const BAR_LABEL_GAP = DEP_STUB + 8;
const BAR_LABEL_PAD_LEFT = 4;

const COL = {
  wbs:       { w: 50, max: 100 },
  duration:  { w: 45, max: 90 },
  start:     { w: 55, max: 110 },
  end:       { w: 55, max: 110 },
  complete:  { w: 45, max: 90 },
  units:     { w: 45, max: 90 },
  curve:     { w: 98 },
};

export type AutoColumnKey = 'wbs' | 'duration' | 'start' | 'end' | 'complete' | 'units';

export type TableColumnWidths = Partial<Record<AutoColumnKey, number>> & { readonly [columnKey: string]: number | undefined };

export type BuiltinPrintColumnKey = 'wbs' | 'name' | 'duration' | 'start' | 'end' | 'complete';

export interface PrintTableColumn {
  key: string;
  builtin?: BuiltinPrintColumnKey;
  header?: string;
  align?: 'left' | 'right' | 'center';
  cells?: ReadonlyMap<string, string>;
  fallbackWidth?: number;
  maxWidth?: number;
}

export const CUSTOM_COLUMN_FALLBACK_WIDTH = 55;
export const CUSTOM_COLUMN_MAX_WIDTH = 160;

type TableColumnKind = BuiltinPrintColumnKey | 'units' | 'curve' | 'custom';

interface TableColumnSlot {
  key: string;
  kind: TableColumnKind;
  spec?: PrintTableColumn;
}

function tableColumnSlots(
  tableColumns: readonly PrintTableColumn[] | undefined,
  showCompletion: boolean,
  assignmentColumns: boolean,
): TableColumnSlot[] {
  const slots: TableColumnSlot[] = [];
  if (!tableColumns) {
    slots.push({ key: 'wbs', kind: 'wbs' }, { key: 'name', kind: 'name' });
    slots.push({ key: 'duration', kind: 'duration' }, { key: 'start', kind: 'start' }, { key: 'end', kind: 'end' });
    if (showCompletion) slots.push({ key: 'complete', kind: 'complete' });
  } else {
    const seen = new Set<string>();
    for (const spec of tableColumns) {
      const kind: TableColumnKind = spec.builtin ?? 'custom';
      const key = spec.builtin ?? spec.key;
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push({ key, kind, spec });
    }
    if (!seen.has('name')) slots.unshift({ key: 'name', kind: 'name' });
  }
  if (assignmentColumns) {
    const nameIndex = slots.findIndex(slot => slot.kind === 'name');
    slots.splice(nameIndex + 1, 0, { key: 'units', kind: 'units' }, { key: 'curve', kind: 'curve' });
  }
  return slots;
}

function isAutoColumnKind(kind: TableColumnKind): kind is AutoColumnKey {
  return kind === 'wbs' || kind === 'duration' || kind === 'start' || kind === 'end' || kind === 'complete' || kind === 'units';
}

function resolveCustomColumnWidth(spec: PrintTableColumn | undefined, raw: number | undefined): number {
  const max = Math.max(AUTO_COLUMN_MIN_WIDTH, spec?.maxWidth ?? CUSTOM_COLUMN_MAX_WIDTH);
  const fallback = Math.min(max, Math.max(AUTO_COLUMN_MIN_WIDTH, spec?.fallbackWidth ?? CUSTOM_COLUMN_FALLBACK_WIDTH));
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(AUTO_COLUMN_MIN_WIDTH, raw));
}

export const AUTO_COLUMN_MIN_WIDTH = 30;

function resolveAutoColumnWidth(key: AutoColumnKey, raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return COL[key].w;
  return Math.min(COL[key].max, Math.max(AUTO_COLUMN_MIN_WIDTH, raw));
}

export const CURVE_COLUMN_WIDTH_MIN = 40;

export function measureCurveColumnWidth(labels: Iterable<string>, measure: (text: string) => number): number {
  let needed = 0;
  for (const label of labels) needed = Math.max(needed, Math.ceil(measure(label) + 2 * CELL_PAD + 1));
  return Math.min(COL.curve.w, Math.max(CURVE_COLUMN_WIDTH_MIN, needed));
}

function resolveCurveColumnWidth(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return COL.curve.w;
  return Math.min(COL.curve.w, Math.max(CURVE_COLUMN_WIDTH_MIN, raw));
}

const MIN_CHART_WIDTH_FRACTION = 0.2;
const MIN_CHART_WIDTH_FLOOR_PX = 160;
function minChartWidthPx(printableWidth: number): number {
  return Math.max(MIN_CHART_WIDTH_FLOOR_PX, printableWidth * MIN_CHART_WIDTH_FRACTION);
}

export const NAME_COLUMN_WIDTH_MIN = 60;
export const NAME_COLUMN_WIDTH_MAX = 400;
export const NAME_COLUMN_WIDTH_DEFAULT = 130;
export const NAME_COLUMN_AUTO_MAX = 800;

const CELL_PAD = 4;
const NAME_INDENT_PER_LEVEL = 12;
const NAME_RIGHT_PAD = 2;

function resolveNameColumnWidth(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return NAME_COLUMN_WIDTH_DEFAULT;
  return Math.min(NAME_COLUMN_AUTO_MAX, Math.max(NAME_COLUMN_WIDTH_MIN, raw));
}

function resolveSlotWidth(
  slot: TableColumnSlot,
  taskNameColumnWidth: number | undefined,
  curveColumnWidth: number | undefined,
  columnWidths: TableColumnWidths | undefined,
): number {
  if (slot.kind === 'name') return resolveNameColumnWidth(taskNameColumnWidth);
  if (slot.kind === 'curve') return resolveCurveColumnWidth(curveColumnWidth);
  if (slot.kind === 'custom') return resolveCustomColumnWidth(slot.spec, columnWidths?.[slot.key]);
  return resolveAutoColumnWidth(slot.kind, columnWidths?.[slot.kind]);
}

interface ColumnBox { x: number; w: number }

interface PositionedColumn extends ColumnBox, TableColumnSlot {}

interface ColPositions {
  list: PositionedColumn[];
  name: ColumnBox;
  wbs?: ColumnBox;
  units?: ColumnBox;
  curve?: ColumnBox;
  duration?: ColumnBox;
  start?: ColumnBox;
  end?: ColumnBox;
  complete?: ColumnBox;
  width: number;
}

function getColPositions(
  k: number,
  slots: readonly TableColumnSlot[],
  taskNameColumnWidth: number | undefined,
  curveColumnWidth: number | undefined,
  columnWidths: TableColumnWidths | undefined,
): ColPositions {
  let x = 0;
  let unscaled = 0;
  const list: PositionedColumn[] = [];
  const byKind: Partial<Record<TableColumnKind, ColumnBox>> = {};
  for (const slot of slots) {
    const raw = resolveSlotWidth(slot, taskNameColumnWidth, curveColumnWidth, columnWidths);
    const w = raw * k;
    const box = { ...slot, x, w };
    list.push(box);
    if (slot.kind !== 'custom' && !byKind[slot.kind]) byKind[slot.kind] = { x, w };
    x += w;
    unscaled += raw;
  }
  return {
    list,
    name: byKind.name ?? { x: 0, w: 0 },
    wbs: byKind.wbs, units: byKind.units, curve: byKind.curve, duration: byKind.duration,
    start: byKind.start, end: byKind.end, complete: byKind.complete,
    width: unscaled * k,
  };
}

export function nameCellFont(bold: boolean, fontStack: string = DEFAULT_REPORT_FONT_STACK): string {
  return `${bold ? 'bold ' : ''}9px ${fontStack}`;
}

export function curveCellFont(header: boolean, fontStack: string = DEFAULT_REPORT_FONT_STACK): string {
  return tableTextFont(header, fontStack);
}

export function tableTextFont(header: boolean, fontStack: string = DEFAULT_REPORT_FONT_STACK): string {
  return header ? `bold 9px ${fontStack}` : `8px ${fontStack}`;
}

export interface TableHeaderLabels {
  wbs: string; taskName: string; start: string; end: string; duration: string; completion: string;
  unitsPerDay?: string; curve?: string;
}

const DEFAULT_TABLE_HEADERS: Required<TableHeaderLabels> = {
  wbs: 'WBS', taskName: 'Taaknaam', start: 'Start', end: 'Einde', duration: 'Duur',
  completion: 'Volt.', unitsPerDay: 'Eenh./d', curve: 'Curve',
};

function headerLabel(labels: Partial<TableHeaderLabels> | undefined, key: keyof TableHeaderLabels): string {
  return labels?.[key] ?? DEFAULT_TABLE_HEADERS[key];
}

const AUTO_COLUMN_HEADER: Record<AutoColumnKey, keyof TableHeaderLabels> = {
  wbs: 'wbs', duration: 'duration', start: 'start', end: 'end', complete: 'completion', units: 'unitsPerDay',
};

export interface PrintRow {
  kind: 'task' | 'group';
  task?: Task;
  depth: number;
  label?: string;
  count?: number;
  assignment?: RowAssignment;
}

export function buildPrintRows(
  tasks: Task[],
  rows: ViewRow[] | undefined,
  rowAssignments?: ReadonlyMap<string, RowAssignment>,
): PrintRow[] {
  const printRows: PrintRow[] = [];
  for (const row of rows ?? taskTreeRows(tasks)) {
    if (row.kind === 'task') printRows.push({ kind: 'task', task: row.task, depth: row.depth, assignment: rowAssignments?.get(row.rowKey) });
    else if (row.kind === 'milestones') for (const task of row.tasks) printRows.push({ kind: 'task', task, depth: row.depth });
    else printRows.push({ kind: 'group', depth: row.depth, label: row.label, count: row.count });
  }
  return printRows;
}

function groupBandLabel(row: PrintRow): string {
  return `${row.label ?? ''}${row.count !== undefined ? ` (${row.count})` : ''}`;
}

export function measureTaskNameColumnWidth(
  printRows: PrintRow[],
  measure: (text: string, bold: boolean) => number,
): number {
  let needed = 0;
  for (const row of printRows) {
    const bold = row.kind === 'group' || (row.task?.childIds.length ?? 0) > 0;
    const text = row.kind === 'group' ? groupBandLabel(row) : (row.task?.name ?? '');
    const indent = row.depth * NAME_INDENT_PER_LEVEL;
    needed = Math.max(needed, Math.ceil(measure(text, bold) + indent + CELL_PAD + NAME_RIGHT_PAD + 1));
  }
  return resolveNameColumnWidth(needed);
}

interface TaskTableCellTexts extends Record<AutoColumnKey, string> {
  curve: string;
}

type CellTextOptions = Pick<PrintOptions,
  'dateNotation' | 'timeNotation' | 'numberLocale' | 'curveLabels' | 'durationDisplay' | 'durationSuffixes' | 'calendars'> & {
  calendar?: WorkCalendar;
  labels?: Pick<NonNullable<PrintOptions['labels']>, 'daySuffix'>;
};

function durationCellText(task: Task, options: CellTextOptions): string {
  const hoursPerDay = options.calendar
    ? effHoursPerDay(effectiveCalendarOf(task, options.calendar, options.calendars ?? []))
    : 8;
  return formatTaskDurationText(task, hoursPerDay, {
    display: options.durationDisplay,
    suffixes: options.durationSuffixes
      ?? (options.labels?.daySuffix ? { day: options.labels.daySuffix, hour: 'h', minute: 'm' } : undefined),
    locale: options.numberLocale,
  });
}

function taskDateCellText(task: Task, value: string, side: 'start' | 'end', options: CellTextOptions): string {
  const notation = options.dateNotation ?? 'dmy';
  if (!value || !options.calendar) return displayDate(value, notation);
  const calendar = effectiveCalendarOf(task, options.calendar, options.calendars ?? []);
  return displayDateTime(taskDateLabel(task, value, side, calendar), notation, options.timeNotation ?? '24h');
}

function customCellText(row: PrintRow, spec: PrintTableColumn | undefined): string {
  const task = row.kind === 'task' ? row.task : undefined;
  return task ? (spec?.cells?.get(task.id) ?? '') : '';
}

type TaskOwnCellTexts = Pick<TaskTableCellTexts, 'wbs' | 'duration' | 'start' | 'end' | 'complete'>;

const NO_TASK_CELLS: TaskOwnCellTexts = { wbs: '', duration: '', start: '', end: '', complete: '' };

interface TaskDayRange { start: number; finish: number; lastBandDay: number }

const dayRangeCache = new WeakMap<Task, TaskDayRange>();

function taskDayRange(task: Task): TaskDayRange {
  const cached = dayRangeCache.get(task);
  if (cached) return cached;
  const bandEnd = floatBandEnd(task, true);
  const range: TaskDayRange = {
    start: parseDate(shownStart(task)).getTime(),
    finish: parseDate(shownFinish(task)).getTime(),
    lastBandDay: bandEnd ? addCalendarDays(bandEnd, -1).getTime() : NaN,
  };
  if (Object.isFrozen(task)) dayRangeCache.set(task, range);
  return range;
}

const cellTextCaches: { calendar?: WorkCalendar; calendars?: readonly WorkCalendar[]; key: string; map: WeakMap<Task, TaskOwnCellTexts> }[] = [];

function cellTextCacheFor(options: CellTextOptions): WeakMap<Task, TaskOwnCellTexts> {
  const key = JSON.stringify([options.dateNotation, options.timeNotation, options.numberLocale, options.durationDisplay,
    options.durationSuffixes, options.labels?.daySuffix]);
  const hit = cellTextCaches.find(c => c.calendar === options.calendar && c.calendars === options.calendars && c.key === key);
  if (hit) return hit.map;
  const entry = { calendar: options.calendar, calendars: options.calendars, key, map: new WeakMap<Task, TaskOwnCellTexts>() };
  cellTextCaches.unshift(entry);
  if (cellTextCaches.length > 4) cellTextCaches.pop();
  return entry.map;
}

function taskOwnCellTexts(task: Task, options: CellTextOptions): TaskOwnCellTexts {
  const cache = Object.isFrozen(task) ? cellTextCacheFor(options) : undefined;
  const cached = cache?.get(task);
  if (cached) return cached;
  const texts: TaskOwnCellTexts = {
    wbs: task.wbsCode || '',
    duration: durationCellText(task, options),
    start: taskDateCellText(task, shownStart(task), 'start', options),
    end: taskDateCellText(task, shownFinish(task), 'end', options),
    complete: formatCompletion(task.time.completion),
  };
  cache?.set(task, texts);
  return texts;
}

function taskTableCellTexts(row: PrintRow, options: CellTextOptions): TaskTableCellTexts {
  const task = row.kind === 'task' ? row.task : undefined;
  const assignment = row.assignment;
  return {
    ...(task ? taskOwnCellTexts(task, options) : NO_TASK_CELLS),
    units: !assignment ? ''
      : assignment.cost ? (assignment.costAmount !== undefined ? formatReportNumber(assignment.costAmount, options.numberLocale) : '—')
      : formatReportNumber(assignment.unitsPerDay, options.numberLocale),
    curve: !assignment ? '' : assignment.cost || assignment.curve === null ? '—'
      : (options.curveLabels?.[assignment.curve] ?? assignment.curve),
  };
}

export interface TableColumnMeasureInput extends CellTextOptions {
  showCompletion: boolean;
  assignmentColumns?: boolean;
  tableHeaders?: Partial<TableHeaderLabels>;
  fontFamily?: string;
  tableColumns?: readonly PrintTableColumn[];
}

export interface TableColumnMeasureCache {
  builtin: Map<string, number>;
  custom: WeakMap<object, number>;
}

export function createTableColumnMeasureCache(): TableColumnMeasureCache {
  return { builtin: new Map(), custom: new WeakMap() };
}

export function measureTableColumnWidths(
  printRows: PrintRow[],
  input: TableColumnMeasureInput,
  measure: (text: string, font: string) => number,
  cache?: TableColumnMeasureCache,
): TableColumnWidths {
  const slots = tableColumnSlots(input.tableColumns, input.showCompletion, !!input.assignmentColumns)
    .filter(slot => slot.kind === 'custom' || isAutoColumnKind(slot.kind));

  const headerFont = tableTextFont(true, input.fontFamily);
  const cellFont = tableTextFont(false, input.fontFamily);
  const needed = new Map<string, number>();
  const cacheKeyOf = (slot: TableColumnSlot): object | string => (slot.kind === 'custom' ? (slot.spec?.cells ?? slot.spec ?? slot.key) : slot.key);
  const fromCache = (slot: TableColumnSlot): number | undefined => {
    const key = cacheKeyOf(slot);
    return typeof key === 'string' ? cache?.builtin.get(key) : cache?.custom.get(key);
  };
  const missing: TableColumnSlot[] = [];
  for (const slot of slots) {
    const cached = fromCache(slot);
    if (cached !== undefined) needed.set(slot.key, cached);
    else missing.push(slot);
  }
  if (missing.length > 0) {
    for (const slot of missing) needed.set(slot.key, measure(slotHeaderText(slot, input.tableHeaders), headerFont));
    const autoMissing = missing.some(slot => slot.kind !== 'custom');
    for (const row of printRows) {
      const cells = autoMissing ? taskTableCellTexts(row, input) : null;
      for (const slot of missing) {
        const text = slot.kind === 'custom' ? customCellText(row, slot.spec) : cells![slot.kind as AutoColumnKey];
        if (text) needed.set(slot.key, Math.max(needed.get(slot.key)!, measure(text, cellFont)));
      }
    }
    if (cache) {
      for (const slot of missing) {
        const key = cacheKeyOf(slot);
        if (typeof key === 'string') cache.builtin.set(key, needed.get(slot.key)!);
        else cache.custom.set(key, needed.get(slot.key)!);
      }
    }
  }

  const widths: Record<string, number> = {};
  for (const slot of slots) {
    const raw = Math.ceil(needed.get(slot.key)! + 2 * CELL_PAD + 1);
    widths[slot.key] = slot.kind === 'custom' ? resolveCustomColumnWidth(slot.spec, raw) : resolveAutoColumnWidth(slot.kind as AutoColumnKey, raw);
  }
  return widths;
}

function slotHeaderText(slot: TableColumnSlot, labels: Partial<TableHeaderLabels> | undefined): string {
  switch (slot.kind) {
    case 'name': return headerLabel(labels, 'taskName');
    case 'curve': return headerLabel(labels, 'curve');
    case 'custom': return slot.spec?.header ?? slot.key;
    default: return headerLabel(labels, AUTO_COLUMN_HEADER[slot.kind]);
  }
}


interface ReportMetrics {
  k: number;
  s(v: number): number;
  font(size: number, bold?: boolean): string;
  rowHeight: number;
  projectHeaderHeight: number;
  timelineHeaderHeight: number;
  totalHeaderHeight: number;
  tableWidth: number;
  footerHeight: number;
  cols: ColPositions;
}

export const REPORT_FONT_SCALES = [90, 100, 110, 125] as const;

function makeMetrics(
  reportFontScale: number | undefined,
  showCompletion: boolean,
  taskNameColumnWidth: number | undefined,
  assignmentColumns = false,
  curveColumnWidth?: number,
  columnWidths?: TableColumnWidths,
  fontStack: string = DEFAULT_REPORT_FONT_STACK,
  tableColumns?: readonly PrintTableColumn[],
): ReportMetrics {
  const pct = snapToChoice(REPORT_FONT_SCALES, reportFontScale ?? 100) ?? 100;
  const k = pct / 100;
  const cols = getColPositions(
    k, tableColumnSlots(tableColumns, showCompletion, assignmentColumns), taskNameColumnWidth, curveColumnWidth, columnWidths,
  );
  const projectHeaderHeight = PROJECT_HEADER_HEIGHT * k;
  const timelineHeaderHeight = TIMELINE_HEADER_HEIGHT * k;
  return {
    k,
    s: (v) => v * k,
    font: (size, bold) => `${bold ? 'bold ' : ''}${size * k}px ${fontStack}`,
    rowHeight: ROW_HEIGHT * k,
    projectHeaderHeight,
    timelineHeaderHeight,
    totalHeaderHeight: projectHeaderHeight + timelineHeaderHeight,
    tableWidth: cols.width,
    footerHeight: FOOTER_HEIGHT * k,
    cols,
  };
}

export interface PrintOptions {
  showCritical: boolean;
  showFloat: boolean;
  showDeps: boolean;
  showWeekends: boolean;
  showLegend: boolean;
  showTaskNames: boolean;
  showCompletion: boolean;
  showBarDates?: boolean;
  taskNameColumnWidth?: number;
  compressNonWorkdays?: boolean;
  showBaselineOverlay?: boolean;
  autoFit: boolean;
  customZoom: number;
  paperSize: 'A4' | 'A3' | 'A2' | 'A1';
  orientation: 'landscape' | 'portrait';
  companyName: string;
  labels?: {
    noTasks: string;
    printed: string;
    legend: {
      criticalPath: string; normal: string; nearCritical?: string; baseline?: string; milestone: string; summary: string; float: string; completion: string;
      relationStyle: string;
    };
    tableHeaders: TableHeaderLabels;
    today: string;
    statusDate: string;
    progressDate?: string;
    projectStart: string;
    projectEnd: string;
    projectDuration: string;
    daySuffix: string;
  };
  localizedMonths?: string[];
  localizedMonthsShort?: string[];
  locale?: string;
  projectStartDate?: string;
  projectEndDate?: string;
  projectAuthor?: string;
  dateNotation?: DateNotation;
  timeNotation?: TimeNotation;
  weekStartDay?: 'monday' | 'sunday';
  timelineColumns?: number;
  timeWindow?: { from: string; to: string };
  assignmentColumns?: boolean;
  rowAssignments?: ReadonlyMap<string, RowAssignment>;
  curveLabels?: Partial<Record<RowCurve, string>>;
  curveColumnWidth?: number;
  columnWidths?: TableColumnWidths;
  tableColumns?: readonly PrintTableColumn[];
  numberLocale?: string;
  durationDisplay?: DurationDisplay;
  durationSuffixes?: DurationSuffixes;
  calendars?: WorkCalendar[];
  workdayDurationMeasure?: boolean;
  reportFontScale?: number;
  fontFamily?: string;
  drivingSequenceIds?: string[];
  barColorSelection?: BarColorSelection;
  activityCodeTypes?: ActivityCodeType[];
  customFieldDefs?: CustomFieldDef[];
  taskTypeLabels?: Record<string, string>;
  customTaskTypes?: CustomTaskType[];
  barColorNoneLabel?: string;
  statusLine?: 'none' | 'statusDate' | 'progress';
  statusDate?: string;
  resources?: Resource[];
  assignments?: ResourceAssignment[];
  baselineOverlay?: BaselineOverlay;
  baselineComparisons?: { slot: 1 | 2; overlay: BaselineOverlay }[];
  baselineNames?: Partial<Record<BaselineSlot, string>>;
  rows?: ViewRow[];
  pageBreakBeforeGroups?: boolean;
  footerLayoutWidth?: number;
  barColorsLegendLabels?: {
    criticalOutline: string;
    categoriesMore?: (n: number) => string;
  };
}

function wrapWords(d2d: Draw2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (d2d.measureText(candidate).width <= maxWidth) { line = candidate; continue; }
    if (line) lines.push(line);
    line = d2d.measureText(word).width <= maxWidth ? word : ellipsize(d2d, word, maxWidth);
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

function formatCompletion(completion: number): string {
  return `${Math.round(completion * 100)}%`;
}

function fillLabelText(
  d2d: Draw2D,
  text: string,
  x: number,
  y: number,
  align: 'left' | 'right',
  color: string,
): void {
  if (!text) return;
  d2d.fillStyle = color;
  d2d.textAlign = align;
  d2d.fillText(text, x, y);
}

function drawBarLabel(
  d2d: Draw2D,
  m: ReportMetrics,
  name: string,
  barRightX: number,
  barLeftX: number,
  y: number,
  canvasWidth: number,
  color: string,
  fontSize: number,
  bold?: boolean,
) {
  const rightMargin = 10;
  d2d.font = m.font(fontSize, bold);
  d2d.fillStyle = color;
  d2d.textBaseline = 'alphabetic';
  const rightStart = barRightX + BAR_LABEL_GAP;
  const rightAvail = canvasWidth - rightMargin - rightStart;
  const leftEnd = barLeftX - BAR_LABEL_PAD_LEFT;
  const leftAvail = leftEnd - m.tableWidth;
  const textWidth = d2d.measureText(name).width;

  if (textWidth <= rightAvail) {
    fillLabelText(d2d, name, rightStart, y, 'left', color);
  } else if (textWidth <= leftAvail) {
    fillLabelText(d2d, name, leftEnd, y, 'right', color);
  } else if (rightAvail >= leftAvail) {
    fillLabelText(d2d, ellipsize(d2d, name, rightAvail), rightStart, y, 'left', color);
  } else {
    fillLabelText(d2d, ellipsize(d2d, name, leftAvail), leftEnd, y, 'right', color);
  }
}

const BAR_DATE_GAP = 6;

function barDateReservePx(m: ReportMetrics, columnWidths: TableColumnWidths | undefined): { left: number; right: number } {
  const width = (key: 'start' | 'end') => m.s(columnWidths?.[key] ?? COL[key].max);
  return { left: width('start') + BAR_LABEL_PAD_LEFT, right: BAR_LABEL_GAP + width('end') + 10 };
}


function drawBarLabelWithDates(
  d2d: Draw2D,
  m: ReportMetrics,
  name: string,
  dates: { start: string; finish: string },
  barEndX: number,
  barLeftX: number,
  y: number,
  canvasWidth: number,
  bold: boolean,
) {
  const rightMargin = 10;
  d2d.textBaseline = 'alphabetic';
  d2d.font = m.font(8);
  const leftEnd = barLeftX - BAR_LABEL_PAD_LEFT;
  const startW = dates.start ? d2d.measureText(dates.start).width : 0;
  if (dates.start && startW <= leftEnd - m.tableWidth) {
    fillLabelText(d2d, dates.start, leftEnd, y, 'right', PRINT_COLORS.textSecondary);
  }
  const x = barEndX + BAR_LABEL_GAP;
  const edge = canvasWidth - rightMargin;
  const finishW = dates.finish ? d2d.measureText(dates.finish).width : 0;
  const finishFits = dates.finish !== '' && x + finishW <= edge;
  if (finishFits) fillLabelText(d2d, dates.finish, x, y, 'left', PRINT_COLORS.textSecondary);
  if (!name) return;
  const nameX = finishFits ? x + finishW + BAR_DATE_GAP : x;
  d2d.font = m.font(9, bold);
  const label = ellipsize(d2d, name, edge - nameX);
  if (label) fillLabelText(d2d, label, nameX, y, 'left', PRINT_COLORS.text);
}

export type ReportRowWindowRequest = (result: RenderReportResult) => { y0: number; y1: number } | null;

export interface RenderReportResult {
  width: number;
  height: number;
  tableWidth: number;
  headerHeight: number;
  footerHeight: number;
  breakOffsets?: number[];
  forcedBreakOffsets?: number[];
  assignmentColumnsDropped?: boolean;
  dayWidth?: number;
  projectHeaderHeight?: number;
  tableColumnBounds?: { key: string; x: number; w: number }[];
}

export function renderReport(
  makeDraw2D: (logicalW: number, logicalH: number) => Draw2D,
  tasks: Task[],
  sequences: Sequence[],
  calendar: WorkCalendar,
  projectName: string,
  options: PrintOptions,
  rowWindow?: ReportRowWindowRequest,
): RenderReportResult {
  const printableWidth = printableWidthLogicalPx(
    options.paperSize.toLowerCase() as 'a4' | 'a3' | 'a2' | 'a1',
    options.orientation,
  );
  let assignmentColumns = !!options.assignmentColumns;
  let m = makeMetrics(options.reportFontScale, options.showCompletion, options.taskNameColumnWidth, assignmentColumns, options.curveColumnWidth, options.columnWidths, options.fontFamily, options.tableColumns);
  let assignmentColumnsDropped = false;
  if (assignmentColumns && m.tableWidth > printableWidth - minChartWidthPx(printableWidth)) {
    assignmentColumns = false;
    assignmentColumnsDropped = true;
    m = makeMetrics(options.reportFontScale, options.showCompletion, options.taskNameColumnWidth, false, undefined, options.columnWidths, options.fontFamily, options.tableColumns);
  }

  const printRows = buildPrintRows(tasks, options.rows, assignmentColumns ? options.rowAssignments : undefined);
  const printedTasks = printRows.flatMap(r => (r.kind === 'task' && r.task ? [r.task] : []));

  if (printedTasks.length === 0 && !(options.timeWindow && printRows.length > 0)) {
    const d2d = makeDraw2D(600, 200);
    d2d.fillStyle = PRINT_COLORS.bg;
    d2d.fillRect(0, 0, 600, 200);
    d2d.fillStyle = PRINT_COLORS.textSecondary;
    d2d.font = m.font(14);
    d2d.textAlign = 'center';
    const emptyLines = wrapWords(d2d, options.labels?.noTasks ?? 'No tasks to display', 560);
    const emptyLineH = m.s(18);
    const emptyTop = 100 - ((emptyLines.length - 1) * emptyLineH) / 2;
    emptyLines.forEach((line, i) => d2d.fillText(line, 300, emptyTop + i * emptyLineH));
    return { width: 600, height: 200, tableWidth: m.tableWidth, headerHeight: 0, footerHeight: 0 };
  }

  let minMs = 8640000000000000;
  let maxMs = 0;
  for (const row of printRows) {
    if (row.kind !== 'task' || !row.task) continue;
    const days = taskDayRange(row.task);
    if (days.start < minMs) minMs = days.start;
    if (days.finish > maxMs) maxMs = days.finish;
    if (options.showFloat && days.lastBandDay > maxMs) maxMs = days.lastBandDay;
  }
  let minDate = new Date(minMs);
  let maxDate = new Date(maxMs);

  if (options.showBaselineOverlay) {
    const overlays: BaselineOverlay[] = [];
    if (options.baselineOverlay) overlays.push(options.baselineOverlay);
    for (const c of options.baselineComparisons ?? []) overlays.push(c.overlay);
    const reach = baselineReach(overlays.map(o => {
      const own: BaselineOverlay = new Map();
      for (const t of printedTasks) { const e = o.get(t.id); if (e) own.set(t.id, e); }
      return own;
    }));
    if (reach.earliest) { const d = parseDate(reach.earliest); if (d < minDate) minDate = d; }
    if (reach.latest) { const d = parseDate(reach.latest); if (d > maxDate) maxDate = d; }
  }

  const calEngine = new CalendarEngine(calendar);
  let compressed = isCompressedEffective(calEngine, !!options.compressNonWorkdays);
  const timelineColumns = Math.max(1, Math.floor(options.timelineColumns ?? 1));
  const availableChartWidth = Math.max(1, printableWidth - m.tableWidth) * timelineColumns;
  const reserve = options.showBarDates && !options.timeWindow ? barDateReservePx(m, options.columnWidths) : null;
  const datePad = reserve && reserve.left + reserve.right <= availableChartWidth / 2 ? reserve : { left: 0, right: 0 };

  if (options.timeWindow) {
    minDate = parseDate(options.timeWindow.from);
    maxDate = addCalendarDays(parseDate(options.timeWindow.to), 1);
  } else {
    minDate = addCalendarDays(minDate, -7);
    maxDate = addCalendarDays(maxDate, 14);
  }

  const calendarDays = diffCalendarDays(minDate, maxDate);

  let measureAxis = resolveGanttAxis({
    calendar: calEngine, compressNonWorkdays: compressed,
    origin: minDate, chartOriginX: 0, zoom: 1, scrollX: 0,
  });
  if (options.timeWindow && compressed && measureAxis.daySpan(minDate, maxDate) < 1) {
    compressed = false;
    measureAxis = resolveGanttAxis({
      calendar: calEngine, compressNonWorkdays: false,
      origin: minDate, chartOriginX: 0, zoom: 1, scrollX: 0,
    });
  }
  const timelineDays = compressed
    ? Math.max(1, Math.ceil(measureAxis.daySpan(minDate, maxDate)))
    : calendarDays;

  let zoom: number;
  if (options.autoFit && timelineDays > 0) {
    zoom = (availableChartWidth - datePad.left - datePad.right) / timelineDays;
  } else {
    zoom = options.customZoom || 22;
  }

  const chartWidth = datePad.left + timelineDays * zoom + datePad.right;
  const canvasWidth = m.tableWidth + chartWidth;
  const windowed = !!options.timeWindow;
  const clampX = (x: number) => (windowed ? Math.min(canvasWidth, Math.max(m.tableWidth, x)) : x);
  const windowFromMs = minDate.getTime();
  const windowToMs = maxDate.getTime();
  const inWindowTime = (start: Date, endExclusive: Date) => endExclusive.getTime() > windowFromMs && start.getTime() < windowToMs;
  const barInWindow = (bar: TaskBarSpan | null) => !!bar && inWindowTime(bar.start, bar.hourMode ? bar.end : addCalendarDays(bar.end, 1));
  const momentInWindow = (moment: { date: Date; hourMode: boolean } | null) => !!moment && (moment.hourMode
    ? moment.date.getTime() >= windowFromMs && moment.date.getTime() < windowToMs
    : inWindowTime(moment.date, addCalendarDays(moment.date, 1)));
  const canvasHeight = m.totalHeaderHeight + printRows.length * m.rowHeight + m.footerHeight;

  const d2d = makeDraw2D(canvasWidth, canvasHeight);

  const axis = resolveGanttAxis({
    calendar: calEngine, compressNonWorkdays: compressed,
    origin: minDate, chartOriginX: m.tableWidth + datePad.left, zoom, scrollX: 0,
  });
  const dateToX = (date: Date) => axis.dateToX(date);
  const firstTimelineIndex = Math.ceil(axis.dayIndexOf(minDate));
  const timelineDates = Array.from(
    { length: timelineDays },
    (_, index) => compressed
      ? axis.dateAtIndex(firstTimelineIndex + index)
      : addCalendarDays(minDate, index),
  );
  const chartTop = m.totalHeaderHeight;
  const chartBottom = canvasHeight - m.footerHeight;
  const rowToY = (i: number) => m.totalHeaderHeight + i * m.rowHeight;

  const cols = m.cols;

  const breakOffsets = printRows.map((_, i) => m.totalHeaderHeight + (i + 1) * m.rowHeight);
  const forcedBreakOffsets = options.pageBreakBeforeGroups
    ? printRows.flatMap((row, i) => (row.kind === 'group' && i > 0 && printRows[i - 1].kind !== 'group' ? [m.totalHeaderHeight + i * m.rowHeight] : []))
    : undefined;
  const result: RenderReportResult = {
    width: canvasWidth, height: canvasHeight, tableWidth: m.tableWidth, headerHeight: m.totalHeaderHeight,
    footerHeight: m.footerHeight,
    projectHeaderHeight: m.projectHeaderHeight,
    tableColumnBounds: cols.list.map(col => ({ key: col.key, x: col.x, w: col.w })),
    breakOffsets, ...(forcedBreakOffsets && forcedBreakOffsets.length > 0 ? { forcedBreakOffsets } : {}),
    ...(assignmentColumnsDropped ? { assignmentColumnsDropped } : {}),
    dayWidth: zoom,
  };

  const win = rowWindow ? rowWindow(result) : null;
  const rowCount = printRows.length;
  const rowDrawn = (i: number): boolean => {
    if (!win || i <= 0 || i >= rowCount - 1) return true;
    const top = rowToY(i);
    return top < win.y1 + m.rowHeight && top + m.rowHeight > win.y0 - m.rowHeight;
  };

  d2d.fillStyle = PRINT_COLORS.bg;
  d2d.fillRect(0, 0, canvasWidth, canvasHeight);

  drawProjectHeader(d2d, m, canvasWidth, projectName, options);

  if (compressed) {
    const weekStartDay = options.weekStartDay ?? 'monday';
    for (const date of timelineDates) {
      if (getWeekNumberFor(date, weekStartDay) % 2 === 1) {
        d2d.fillStyle = PRINT_COLORS.gridWeekBand;
        d2d.fillRect(dateToX(date), chartTop, zoom, chartBottom - chartTop);
      }
    }
  } else if (options.showWeekends && calendarDays <= MAX_DAILY_WEEKEND_STEPS && zoom >= 0.5) {
    for (let i = 0; i < calendarDays; i++) {
      const date = addCalendarDays(minDate, i);
      const x = dateToX(date);
      const dateStr = formatDate(date);
      const isWorkDay = calEngine.isWorkDay(date);
      const isHoliday = !isWorkDay && calEngine.isHoliday(dateStr);
      const isWeekend = !isWorkDay && !isHoliday;

      if (isHoliday) {
        d2d.fillStyle = PRINT_COLORS.gridHoliday;
        d2d.fillRect(x, chartTop, zoom, chartBottom - chartTop);
      } else if (isWeekend) {
        d2d.fillStyle = PRINT_COLORS.gridWeekend;
        d2d.fillRect(x, chartTop, zoom, chartBottom - chartTop);
      }
    }
  }

  for (let i = 0; i < printRows.length; i++) {
    if (i % 2 === 0 && rowDrawn(i)) {
      d2d.fillStyle = 'rgba(249, 250, 251, 0.3)';
      d2d.fillRect(m.tableWidth, rowToY(i), chartWidth, m.rowHeight);
    }
  }

  const gridStep = Math.max(
    1,
    Math.ceil(timelineDates.length / MAX_DAILY_GRID_STEPS),
    Math.ceil(1 / Math.max(zoom, 0.000_001)),
  );
  for (let i = 0; i < timelineDates.length; i += gridStep) {
    const date = timelineDates[i];
    const x = dateToX(date);
    const dow = isoDayOfWeek(date);

    d2d.strokeStyle = PRINT_COLORS.grid;
    const weekStartDay = options.weekStartDay ?? 'monday';
    const startsWeek = compressed
      ? i === 0 || getWeekNumberFor(date, weekStartDay) !== getWeekNumberFor(timelineDates[i - 1], weekStartDay)
      : dow === (weekStartDay === 'sunday' ? 7 : 1);
    d2d.lineWidth = startsWeek ? 0.8 : 0.2;
    d2d.beginPath();
    d2d.moveTo(x, chartTop);
    d2d.lineTo(x, chartBottom);
    d2d.stroke();
  }

  for (let i = 0; i <= printRows.length; i++) {
    if (!rowDrawn(Math.min(i, rowCount - 1)) && !rowDrawn(i - 1)) continue;
    const y = rowToY(i);
    d2d.strokeStyle = PRINT_COLORS.grid;
    d2d.lineWidth = 0.3;
    d2d.beginPath();
    d2d.moveTo(m.tableWidth, y);
    d2d.lineTo(canvasWidth, y);
    d2d.stroke();
  }

  const todayX = dateToX(localNowOnDayAxis());
  const todayVisible = todayX > m.tableWidth && todayX < canvasWidth;
  if (todayVisible) {
    d2d.strokeStyle = PRINT_COLORS.today;
    d2d.lineWidth = 1.5;
    d2d.setLineDash([5, 3]);
    d2d.beginPath();
    d2d.moveTo(todayX, chartTop);
    d2d.lineTo(todayX, chartBottom);
    d2d.stroke();
    d2d.setLineDash([]);
  }

  let statusLineX: number | null = null;
  let drawStatusReferenceLine: (() => void) | null = null;
  if (options.statusDate && options.statusLine && options.statusLine !== 'none') {
    const statusUsesTime = isHourModeCalendar(calendar);
    const statusDay = parseDate(options.statusDate);
    const statusInstant = statusDateInstant(options.statusDate, statusUsesTime);
    const rawStatusX = dateToX(statusInstant);
    const statusVisible = windowed
      ? momentInWindow({ date: statusUsesTime ? statusInstant : statusDay, hourMode: statusUsesTime })
      : rawStatusX > m.tableWidth && rawStatusX < canvasWidth;
    const statusInset = 1.25;
    statusLineX = windowed ? Math.min(canvasWidth - statusInset, Math.max(m.tableWidth + statusInset, rawStatusX)) : rawStatusX;
    if (statusVisible) {
      drawStatusReferenceLine = () => {
        d2d.strokeStyle = PRINT_COLORS.today;
        d2d.lineWidth = 1.5;
        d2d.setLineDash([5, 3]);
        d2d.beginPath();
        if (options.statusLine === 'statusDate') {
          d2d.moveTo(statusLineX!, chartTop);
          d2d.lineTo(statusLineX!, chartBottom);
        } else {
          d2d.moveTo(statusLineX!, chartTop);
          for (let i = 0; i < printRows.length; i++) {
            const rowTop = rowToY(i);
            const rowBottom = rowTop + m.rowHeight;
            const rowMid = rowTop + m.rowHeight / 2;
            let px = statusLineX!;
            const row = printRows[i];
            const bar = row.kind === 'task' && row.task && !row.task.isMilestone && isLeafTask(row.task)
              ? taskBarSpan(row.task, dateToX, zoom)
              : null;
            if (row.task && bar) {
              const c = Math.max(0, Math.min(1, row.task.time.completion || 0));
              const finishRef = statusUsesTime ? bar.end.getTime() : utcDayStart(bar.end).getTime();
              const startRef = statusUsesTime ? bar.start.getTime() : utcDayStart(bar.start).getTime();
              const statusRef = statusUsesTime ? statusInstant.getTime() : utcDayStart(statusDay).getTime();
              const fullyDone = c >= 1 && finishRef <= statusRef;
              const notStarted = c === 0 && startRef >= statusRef;
              if (!fullyDone && !notStarted) px = clampX(bar.x1 + (bar.x2 - bar.x1) * c);
            }
            d2d.lineTo(statusLineX!, rowTop);
            d2d.lineTo(px, rowMid);
            d2d.lineTo(statusLineX!, rowBottom);
          }
        }
        d2d.stroke();
        d2d.setLineDash([]);
      };
    } else {
      statusLineX = null;
    }
  }

  const barHeight = m.rowHeight * 0.55;
  const barOffset = (m.rowHeight - barHeight) / 2;

  interface BarLabelJob {
    name: string;
    barRightX: number;
    barLeftX: number;
    y: number;
    bold: boolean;
    dates?: { start: string; finish: string };
    barEndX?: number;
  }
  const barLabelJobs: BarLabelJob[] = [];
  const barCellOptions: CellTextOptions = { ...options, calendar };
  const wantBarLabel = options.showTaskNames || options.showBarDates === true;
  const barLabel = (task: Task, job: Omit<BarLabelJob, 'name' | 'dates'>, milestone = false): BarLabelJob => {
    const cells = options.showBarDates ? taskOwnCellTexts(task, barCellOptions) : undefined;
    return {
      ...job,
      name: options.showTaskNames ? task.name : '',
      ...(cells ? { dates: { start: milestone ? '' : cells.start, finish: milestone ? (cells.end || cells.start) : cells.end } } : {}),
    };
  };

  const resources = options.resources ?? [];
  const assignments = options.assignments ?? [];
  const pal: BarPalette = {
    critical: PRINT_COLORS.critical, normal: PRINT_COLORS.normal,
    nearCritical: PRINT_COLORS.nearCritical, milestone: PRINT_COLORS.milestone,
    uncategorized: PRINT_COLORS.uncategorized,
  };
  const colorContext: BarColorContext = {
    activityCodeTypes: options.activityCodeTypes ?? [],
    customFieldDefs: options.customFieldDefs ?? [],
    resources,
    assignments,
    taskTypeLabels: options.taskTypeLabels,
    customTaskTypes: options.customTaskTypes,
    noneLabel: options.barColorNoneLabel ?? '(geen)',
  };
  const colorAdvice = (task: Task, width?: number): BarFill => computeBarColors(
    task,
    options.barColorSelection ?? { mode: 'critical' },
    colorContext,
    pal,
    width,
  );

  for (let i = 0; i < printRows.length; i++) {
    if (!rowDrawn(i)) continue;
    const row = printRows[i];
    const y = rowToY(i) + barOffset;

    if (row.kind === 'group') {
      d2d.fillStyle = PRINT_COLORS.gridWeekend;
      d2d.fillRect(m.tableWidth, rowToY(i), canvasWidth - m.tableWidth, m.rowHeight);
      if (options.showTaskNames) {
        barLabelJobs.push({
          name: `${row.label ?? ''}${row.count !== undefined ? ` (${row.count})` : ''}`,
          barRightX: m.tableWidth + m.s(4), barLeftX: m.tableWidth + m.s(4),
          y: rowToY(i) + m.rowHeight / 2 + m.s(3), bold: true,
        });
      }
      continue;
    }
    const task = row.task!;

    if (task.isMilestone) {
      const x = milestoneAnchorX(task, dateToX, zoom) ?? Number.NaN;
      const cy = y + barHeight / 2;
      const size = barHeight * 0.45;
      const inWindow = !windowed || momentInWindow(milestoneMoment(task));
      const cx = windowed ? Math.min(canvasWidth - size, Math.max(m.tableWidth + size, x)) : x;

      if (inWindow) {
        const advies = colorAdvice(task);
        d2d.fillStyle = advies.kind === 'solid' ? advies.fill : advies.segments[0].color;
        if (advies.outline) {
          d2d.strokeStyle = advies.outline;
          d2d.lineWidth = 1;
        }
        d2d.beginPath();
        d2d.moveTo(cx, cy - size);
        d2d.lineTo(cx + size, cy);
        d2d.lineTo(cx, cy + size);
        d2d.lineTo(cx - size, cy);
        d2d.closePath();
        d2d.fill();
        if (advies.outline) d2d.stroke();

        if (wantBarLabel) {
          barLabelJobs.push(barLabel(task, { barRightX: cx + size, barLeftX: cx - size, y: cy + m.s(3), bold: false }, true));
        }
      }
    } else if (isSummaryTask(task)) {
      const bar = taskBarSpan(task, dateToX, zoom);
      const rawX1 = bar?.x1 ?? Number.NaN;
      const rawX2 = bar?.x2 ?? Number.NaN;
      const x1 = clampX(rawX1);
      const x2 = clampX(rawX2);
      if (windowed && !barInWindow(bar)) continue;
      let sx1 = x1;
      let width = windowed ? x2 - x1 : Math.max(x2 - x1, 3);
      if (windowed && width < 3) {
        width = Math.min(3, canvasWidth - m.tableWidth);
        sx1 = Math.max(m.tableWidth, Math.min(x1, canvasWidth - width));
      }
      const hook = windowed ? Math.min(6, canvasWidth - sx1, sx1 + width - m.tableWidth) : 6;
      const barY = y + barHeight * 0.3;
      const barH = barHeight * 0.3;

      const sumCompletion = options.showCompletion ? Math.max(0, Math.min(1, task.time.completion || 0)) : 0;
      const sumProgressX = sumCompletion >= 1 ? Infinity : sumCompletion > 0 ? rawX1 + (rawX2 - rawX1) * sumCompletion : -Infinity;
      const sumGrey = doneBarTones(PRINT_COLORS.summary, false).fill;
      paintProgressBarPiece(d2d, sx1, sx1 + width, barY, barH, 0, PRINT_COLORS.summary, sumProgressX, false);

      d2d.fillStyle = sumCompletion > 0 ? sumGrey : PRINT_COLORS.summary;
      if (x1 === rawX1) {
        d2d.beginPath();
        d2d.moveTo(sx1, barY);
        d2d.lineTo(sx1, barY + barH + 5);
        d2d.lineTo(sx1 + hook, barY + barH);
        d2d.closePath();
        d2d.fill();
      }

      d2d.fillStyle = sumCompletion >= 1 ? sumGrey : PRINT_COLORS.summary;
      if (x2 === rawX2) {
        d2d.beginPath();
        d2d.moveTo(sx1 + width, barY);
        d2d.lineTo(sx1 + width, barY + barH + 5);
        d2d.lineTo(sx1 + width - hook, barY + barH);
        d2d.closePath();
        d2d.fill();
      }

      if (wantBarLabel) {
        barLabelJobs.push(barLabel(task, { barRightX: sx1 + width, barLeftX: sx1, y: y + barHeight / 2 + m.s(3), bold: true }));
      }
    } else {
      const bar = taskBarSpan(task, dateToX, zoom);
      const start = bar?.start ?? new Date(Number.NaN);
      const end = bar?.end ?? new Date(Number.NaN);
      const rawX1 = bar?.x1 ?? Number.NaN;
      const rawX2 = bar?.x2 ?? Number.NaN;
      const width = Math.max(rawX2 - rawX1, 3);
      const x1 = clampX(rawX1);
      const x2 = clampX(rawX2);
      if (windowed && !barInWindow(bar)) continue;

      const advies = colorAdvice(task, width);
      const baseColor = advies.kind === 'segments' ? advies.segments[0].color : advies.fill;
      const segments = task.splitGaps && task.splitGaps.length > 0
        ? taskSplitSegments(task, effectiveCalendarOf(task, calendar, options.calendars ?? []), options.workdayDurationMeasure ?? true)
          ?? [{ start, end }]
        : [{ start, end }];
      const allSegs = segments.map((s, i) => {
        const rx1 = i === 0 ? rawX1 : dateToX(s.start);
        const rx2 = i === segments.length - 1 ? rawX2 : dateToX(s.end);
        return { rx1, rx2, x1: clampX(rx1), x2: clampX(rx2) };
      });
      const segs = allSegs.filter((s, i) => !windowed || segments.length === 1 || s.x2 > s.x1 || inWindowTime(segments[i].start, segments[i].end));
      const split = allSegs.length > 1;

      if (split) {
        const lineFrom = allSegs[0].x2;
        const lineTo = allSegs[allSegs.length - 1].x1;
        if (!windowed || lineTo > lineFrom) {
          d2d.strokeStyle = baseColor + '80';
          d2d.lineWidth = 1;
          d2d.beginPath();
          d2d.moveTo(lineFrom, y + barHeight / 2);
          d2d.lineTo(lineTo, y + barHeight / 2);
          d2d.stroke();
        }
      }

      const completion = options.showCompletion ? task.time.completion : 0;
      const isDone = completion >= 1;
      const progressX = isDone ? Infinity : completion > 0 ? rawX1 + width * completion : -Infinity;

      for (const s of segs) {
        const minW = split ? 2 : 3;
        const rawSw = Math.max(s.rx2 - s.rx1, minW);
        let sx1 = s.x1;
        let sw = windowed ? s.x2 - s.x1 : rawSw;
        if (windowed && sw < minW) {
          sw = Math.min(minW, canvasWidth - m.tableWidth);
          sx1 = Math.max(m.tableWidth, Math.min(s.x1, canvasWidth - sw));
        }
        if (advies.kind === 'segments') {
          let sx = s.rx1;
          advies.segments.forEach((seg, si) => {
            const isLast = si === advies.segments.length - 1;
            const w = isLast ? s.rx1 + rawSw - sx : Math.round(rawSw * seg.weight);
            const vx1 = windowed ? Math.max(sx, m.tableWidth) : sx;
            const vx2 = windowed ? Math.min(sx + w, canvasWidth) : sx + w;
            if (!windowed || vx2 > vx1) {
              paintProgressBarPiece(d2d, vx1, vx2, y, barHeight, 3, seg.color, progressX, false, si === 0, isLast);
            }
            sx += w;
          });
        } else {
          paintProgressBarPiece(d2d, sx1, sx1 + sw, y, barHeight, 3, advies.fill, progressX, false);
        }
        if (advies.outline) {
          d2d.strokeStyle = advies.outline;
          d2d.lineWidth = 1;
          d2d.roundRect(sx1, y, sw, barHeight, 3);
          d2d.stroke();
        }
      }

      const bandEnd = options.showFloat && !isDone ? floatBandEnd(task) : null;
      const floatEndX = bandEnd ? clampX(dateToX(bandEnd)) : x2;
      if (bandEnd && floatEndX > x2) {
        d2d.fillStyle = PRINT_COLORS.float + '40';
        d2d.roundRect(x2, y + barHeight * 0.2, floatEndX - x2, barHeight * 0.6, 2);
        d2d.fill();
      }

      if (wantBarLabel) {
        const barRightX = bandEnd ? Math.max(x2, floatEndX) : x2;
        barLabelJobs.push(barLabel(task, { barRightX, barEndX: x2, barLeftX: x1, y: y + barHeight / 2 + m.s(3), bold: false }));
      }
    }

    if (options.showBaselineOverlay) {
      const layers: { slot: BaselineSlot; overlay: BaselineOverlay }[] = [];
      if (options.baselineOverlay) layers.push({ slot: 0, overlay: options.baselineOverlay });
      for (const c of options.baselineComparisons ?? []) layers.push(c);
      const bars: BaselineBar[] = [];
      const milestones: BaselineMilestone[] = [];
      for (const layer of layers) {
        const entry = layer.overlay.get(task.id);
        if (!entry) continue;
        const pos = baselineSpanX(entry, dateToX, zoom);
        if (!pos) continue;
        if (pos.kind === 'milestone') {
          if (!windowed || momentInWindow(baselineStart(entry))) milestones.push({ slot: layer.slot, x: clampX(pos.x), moment: pos.moment });
          continue;
        }
        if (clampX(pos.x2) > clampX(pos.x1)) bars.push({ slot: layer.slot, x1: pos.x1, x2: pos.x2 });
      }
      const diamonds = baselineDiamonds(milestones);
      if (bars.length || diamonds.length) {
        const baseHeight = Math.max(2, barHeight * 0.28);
        paintBaselineStrip(d2d, widenBars(bars, 2), diamonds, {
          top: y + barHeight + 1,
          height: baseHeight,
          blend: m.s(BASELINE_BLEND_PX),
          stripeWidth: Math.max(2, barHeight * 0.16),
          visibleX: windowed ? [m.tableWidth, canvasWidth] : undefined,
          diamondSize: baselineDiamondSize(baseHeight),
          colorOf: printBaselineColor,
        });
      }
    }
  }

  if (options.showDeps) {
    const rowIndexOf = new Map<string, number>();
    const tasksById = new Map<string, Task>();
    printRows.forEach((r, idx) => {
      if (r.kind === 'task' && r.task) { rowIndexOf.set(r.task.id, idx); tasksById.set(r.task.id, r.task); }
    });
    drawDependencies(d2d, m, tasksById, sequences, dateToX, rowToY, zoom, options, rowIndexOf,
      win ? (lo, hi) => rowDrawn(lo) || rowDrawn(hi) || (rowToY(lo) < win.y1 + m.rowHeight && rowToY(hi) + m.rowHeight > win.y0 - m.rowHeight) : undefined,
      windowed ? [m.tableWidth, canvasWidth] : undefined);
  }

  for (const job of barLabelJobs) {
    if (job.dates) drawBarLabelWithDates(d2d, m, job.name, job.dates, job.barEndX ?? job.barRightX, job.barLeftX, job.y, canvasWidth, job.bold);
    else drawBarLabel(d2d, m, job.name, job.barRightX, job.barLeftX, job.y, canvasWidth, PRINT_COLORS.text, 9, job.bold);
  }

  drawStatusReferenceLine?.();

  drawTimelineHeader(
    d2d, m, canvasWidth, minDate, calendarDays, timelineDates, compressed, zoom, dateToX, options,
    todayVisible ? todayX : null, statusLineX, isHourModeCalendar(calendar),
  );

  drawTaskTable(d2d, m, printRows, canvasHeight, cols, { ...options, calendar }, rowDrawn);

  drawFooter(d2d, m, canvasWidth, canvasHeight, projectName, options, printRows);

  return result;
}


export function renderPrintCanvas(
  canvas: HTMLCanvasElement,
  tasks: Task[],
  sequences: Sequence[],
  calendar: WorkCalendar,
  projectName: string,
  options: PrintOptions,
  renderScale?: number,
): RenderReportResult {
  const dpr = renderScale ?? (window.devicePixelRatio || 2);
  return renderReport(
    (w, h) => new CanvasDraw2D(canvas, w, h, dpr),
    tasks, sequences, calendar, projectName, options,
  );
}

export function measurePrintReport(
  tasks: Task[],
  sequences: Sequence[],
  calendar: WorkCalendar,
  projectName: string,
  options: PrintOptions,
): RenderReportResult {
  let font = '10px sans-serif';
  let fillStyle = '';
  let strokeStyle = '';
  let lineWidth = 1;
  let textAlign: import('@/services/pdf/draw2d').TextAlign = 'left';
  let textBaseline: import('@/services/pdf/draw2d').TextBaseline = 'alphabetic';
  const d2d: Draw2D = {
    get font() { return font; }, set font(value) { font = value; },
    get fillStyle() { return fillStyle; }, set fillStyle(value) { fillStyle = value; },
    get strokeStyle() { return strokeStyle; }, set strokeStyle(value) { strokeStyle = value; },
    get lineWidth() { return lineWidth; }, set lineWidth(value) { lineWidth = value; },
    get textAlign() { return textAlign; }, set textAlign(value) { textAlign = value; },
    get textBaseline() { return textBaseline; }, set textBaseline(value) { textBaseline = value; },
    setLineDash() {},
    fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, roundRect() {},
    fillText() {},
    measureText(text) {
      const size = Number.parseFloat(font) || 10;
      return { width: text.length * size * 0.55 };
    },
  };
  return renderReport(() => d2d, tasks, sequences, calendar, projectName, options);
}


function drawProjectHeader(
  d2d: Draw2D,
  m: ReportMetrics,
  canvasWidth: number,
  projectName: string,
  options: PrintOptions,
) {
  const hh = m.projectHeaderHeight;
  const pad = m.s(10);

  d2d.fillStyle = PRINT_COLORS.bg;
  d2d.fillRect(0, 0, canvasWidth, hh);

  d2d.strokeStyle = PRINT_COLORS.borderDark;
  d2d.lineWidth = 1;
  d2d.strokeRect(0.5, 0.5, canvasWidth - 1, hh - 1);

  const brandText = 'Open Planner Studio';
  d2d.fillStyle = PRINT_COLORS.textSecondary;
  d2d.font = m.font(8);
  d2d.textBaseline = 'middle';
  d2d.textAlign = 'right';
  d2d.fillText(brandText, canvasWidth - pad, m.s(16));
  const brandWidth = d2d.measureText(brandText).width;

  d2d.fillStyle = PRINT_COLORS.text;
  d2d.font = m.font(14, true);
  d2d.textBaseline = 'middle';
  d2d.textAlign = 'left';
  const nameMaxW = (canvasWidth - pad - brandWidth - m.s(12)) - pad;
  d2d.fillText(ellipsize(d2d, projectName, nameMaxW), pad, m.s(16));

  d2d.font = m.font(9);
  d2d.fillStyle = PRINT_COLORS.textSecondary;
  const row2Y = m.s(34);
  const rowMaxW = canvasWidth - 2 * pad;

  const companyLabel = options.companyName || '';
  const authorLabel = options.projectAuthor || '';
  const printLocale = options.locale ?? 'nl';
  const printDate = new Date().toLocaleDateString(printLocale, { day: '2-digit', month: 'long', year: 'numeric' });

  let row2Text = '';
  if (companyLabel) row2Text += companyLabel;
  if (authorLabel) row2Text += (row2Text ? '  |  ' : '') + authorLabel;
  row2Text += (row2Text ? '  |  ' : '') + `${options.labels?.printed ?? 'Printed:'} ${printDate}`;

  d2d.fillText(ellipsize(d2d, row2Text, rowMaxW), pad, row2Y);

  const row3Y = m.s(48);
  const labels = options.labels;
  let row3Text = '';
  if (options.projectStartDate) {
    row3Text += `${labels?.projectStart ?? 'Start:'} ${displayDate(options.projectStartDate, options.dateNotation ?? 'dmy')}`;
  }
  if (options.projectEndDate) {
    row3Text += (row3Text ? '  |  ' : '') + `${labels?.projectEnd ?? 'End:'} ${displayDate(options.projectEndDate, options.dateNotation ?? 'dmy')}`;
  }
  if (options.projectStartDate && options.projectEndDate) {
    const sd = parseDate(options.projectStartDate);
    const ed = parseDate(options.projectEndDate);
    const dur = diffCalendarDays(sd, ed);
    row3Text += `  |  ${labels?.projectDuration ?? 'Duration:'} ${dur}${labels?.daySuffix ?? 'd'}`;
  }

  d2d.fillText(ellipsize(d2d, row3Text, rowMaxW), pad, row3Y);

  d2d.textAlign = 'left';
  d2d.textBaseline = 'alphabetic';
}


interface TodayLabelBox {
  text: string;
  cx: number;
  left: number;
  right: number;
}

function reserveTodayLabel(
  d2d: Draw2D,
  m: ReportMetrics,
  canvasWidth: number,
  options: PrintOptions,
  todayX: number | null,
): TodayLabelBox | null {
  if (todayX === null) return null;
  const text = options.labels?.today ?? 'Vandaag';
  d2d.font = m.font(7, true);
  const half = d2d.measureText(text).width / 2 + m.s(3);
  const min = m.tableWidth + half;
  const max = canvasWidth - half;
  if (max < min) return null;
  const cx = Math.min(Math.max(todayX, min), max);
  return { text, cx, left: cx - half, right: cx + half };
}

function reserveHeaderLineLabel(
  d2d: Draw2D,
  m: ReportMetrics,
  canvasWidth: number,
  lineX: number,
  text: string,
): TodayLabelBox | null {
  d2d.font = m.font(7, true);
  const half = d2d.measureText(text).width / 2 + m.s(3);
  const min = m.tableWidth + half;
  const max = canvasWidth - half;
  if (max < min) return null;
  const cx = Math.min(Math.max(lineX, min), max);
  return { text, cx, left: cx - half, right: cx + half };
}

function drawTimelineHeader(
  d2d: Draw2D,
  m: ReportMetrics,
  canvasWidth: number,
  minDate: Date,
  calendarDays: number,
  timelineDates: Date[],
  compressed: boolean,
  zoom: number,
  dateToX: (d: Date) => number,
  options: PrintOptions,
  todayX: number | null,
  statusLineX: number | null = null,
  statusUsesTime = false,
) {
  const top = m.projectHeaderHeight;
  const h = m.timelineHeaderHeight;
  const monthRowH = h / 2;
  const weekRowH = h / 2;

  const todayLabel = reserveTodayLabel(d2d, m, canvasWidth, options, todayX);
  const statusLabel = statusLineX === null
    ? null
    : reserveHeaderLineLabel(d2d, m, canvasWidth, statusLineX,
      `${options.statusLine === 'progress'
        ? options.labels?.progressDate ?? 'Voortgangsdatum'
        : options.labels?.statusDate ?? 'Statusdatum'} ${displayDateTime(statusDateAsUsed(options.statusDate!, statusUsesTime), options.dateNotation ?? 'dmy', options.timeNotation ?? '24h')}`);

  d2d.fillStyle = PRINT_COLORS.headerBg;
  d2d.fillRect(0, top, canvasWidth, h);

  d2d.strokeStyle = PRINT_COLORS.border;
  d2d.lineWidth = 1;
  d2d.beginPath();
  d2d.moveTo(0, top + h);
  d2d.lineTo(canvasWidth, top + h);
  d2d.stroke();

  d2d.strokeStyle = PRINT_COLORS.grid;
  d2d.lineWidth = 0.5;
  d2d.beginPath();
  d2d.moveTo(m.tableWidth, top + monthRowH);
  d2d.lineTo(canvasWidth, top + monthRowH);
  d2d.stroke();

  const months = options.localizedMonths ?? ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

  const wsd = options.weekStartDay ?? 'monday';
  const weekStartDow = wsd === 'sunday' ? 7 : 1;

  let lastMonthLabelRight = -Infinity;
  let lastWeekLabelRight = -Infinity;
  const endExclusive = addCalendarDays(minDate, calendarDays);

  const monthStep = Math.max(
    zoom * 28 < 1 ? 12 : 1,
    Math.ceil(calendarDays / (28 * MAX_DAILY_GRID_STEPS)),
  );
  let monthCursor = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
  while (monthCursor < endExclusive) {
    const date = monthCursor < minDate ? minDate : monthCursor;
    const x = dateToX(date);
    const month = date.getUTCMonth();
    const monthName = months[month];
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const label = `${capitalizedMonth} ${date.getUTCFullYear()}`;

    d2d.strokeStyle = PRINT_COLORS.border;
    d2d.lineWidth = 0.5;
    d2d.beginPath();
    d2d.moveTo(x, top);
    d2d.lineTo(x, top + monthRowH);
    d2d.stroke();

    d2d.font = m.font(10, true);
    const monthLabelStart = x + m.s(4);
    if (monthLabelStart >= lastMonthLabelRight + m.s(6)) {
      d2d.fillStyle = PRINT_COLORS.text;
      d2d.textBaseline = 'middle';
      d2d.textAlign = 'left';
      d2d.fillText(label, monthLabelStart, top + monthRowH / 2);
      lastMonthLabelRight = monthLabelStart + d2d.measureText(label).width;
    }
    monthCursor = new Date(Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth() + monthStep, 1));
  }

  if (zoom * (compressed ? 5 : 7) >= 1 && calendarDays <= MAX_DAILY_GRID_STEPS * 7) {
    const firstWeekOffset = (weekStartDow - isoDayOfWeek(minDate) + 7) % 7;
    let weekCursor = addCalendarDays(minDate, firstWeekOffset);
    while (weekCursor < endExclusive) {
      const date = weekCursor;
      const dow = isoDayOfWeek(date);
      if (dow === weekStartDow) {
        const x = dateToX(date);
        const weekLabel = `W${getWeekNumberFor(date, wsd)}`;

        d2d.strokeStyle = PRINT_COLORS.grid;
        d2d.lineWidth = 0.5;
        d2d.beginPath();
        d2d.moveTo(x, top + monthRowH);
        d2d.lineTo(x, top + h);
        d2d.stroke();

        const weekLabelStart = x + m.s(2);
        d2d.font = m.font(9);
        if (weekLabelStart >= lastWeekLabelRight + m.s(4)) {
          d2d.fillStyle = PRINT_COLORS.textSecondary;
          d2d.textAlign = 'left';
          d2d.textBaseline = 'middle';
          d2d.fillText(weekLabel, weekLabelStart, top + monthRowH + weekRowH / 2);
          lastWeekLabelRight = weekLabelStart + d2d.measureText(weekLabel).width;
        }
      }
      weekCursor = addCalendarDays(weekCursor, 7);
    }
  }

  if (zoom > 15 && timelineDates.length <= MAX_DAILY_GRID_STEPS) {
    for (const date of timelineDates) {
      const x = dateToX(date);
      const dow = isoDayOfWeek(date);
      const dayNum = date.getUTCDate();
      if (compressed || options.timeWindow || (dow !== 6 && dow !== 7)) {
        d2d.fillStyle = PRINT_COLORS.textSecondary;
        d2d.font = m.font(7);
        d2d.textAlign = 'center';
        d2d.textBaseline = 'bottom';
        const dayCx = x + zoom / 2;
        const dayHalf = d2d.measureText(String(dayNum)).width / 2;
        const clash = (label: TodayLabelBox | null) => label !== null
          && dayCx + dayHalf > label.left
          && dayCx - dayHalf < label.right;
        if (!clash(todayLabel) && !clash(statusLabel)) {
          d2d.fillText(String(dayNum), dayCx, top + h - m.s(1));
        }
      }
    }
  }

  if (todayLabel) {
    d2d.fillStyle = PRINT_COLORS.today;
    d2d.font = m.font(7, true);
    d2d.textAlign = 'center';
    d2d.textBaseline = 'bottom';
    d2d.fillText(todayLabel.text, todayLabel.cx, top + h - m.s(1));
  }
  if (statusLabel && !(todayLabel
      && statusLabel.left < todayLabel.right
      && statusLabel.right > todayLabel.left)) {
    d2d.fillStyle = PRINT_COLORS.today;
    d2d.font = m.font(7, true);
    d2d.textAlign = 'center';
    d2d.textBaseline = 'bottom';
    d2d.fillText(statusLabel.text, statusLabel.cx, top + h - m.s(1));
  }

  d2d.fillStyle = PRINT_COLORS.headerBg;
  d2d.fillRect(0, top, m.tableWidth, h);

  const cols = m.cols;
  d2d.fillStyle = PRINT_COLORS.text;
  d2d.font = m.font(9, true);
  d2d.textBaseline = 'middle';
  d2d.textAlign = 'center';
  const headerY = top + h / 2;

  const th = options.labels?.tableHeaders;
  const headerText = (slot: TableColumnSlot, col: { w: number }, pad = 0) =>
    ellipsize(d2d, slotHeaderText(slot, th), col.w - pad);
  for (const col of cols.list) {
    const leftAligned = col.kind === 'name' || col.kind === 'curve' || (col.kind === 'custom' && (col.spec?.align ?? 'left') === 'left');
    if (leftAligned) {
      d2d.textAlign = 'left';
      d2d.fillText(headerText(col, col, m.s(4)), col.x + m.s(4), headerY);
    } else {
      d2d.textAlign = 'center';
      d2d.fillText(headerText(col, col), col.x + col.w / 2, headerY);
    }
  }

  d2d.strokeStyle = PRINT_COLORS.border;
  d2d.lineWidth = 0.5;
  const colBorders = [...cols.list.slice(1).map(col => col.x), m.tableWidth];
  for (const cx of colBorders) {
    d2d.beginPath();
    d2d.moveTo(cx, top);
    d2d.lineTo(cx, top + h);
    d2d.stroke();
  }

  d2d.strokeStyle = PRINT_COLORS.borderDark;
  d2d.lineWidth = 1;
  d2d.beginPath();
  d2d.moveTo(0, top + h);
  d2d.lineTo(m.tableWidth, top + h);
  d2d.stroke();

  d2d.textBaseline = 'alphabetic';
  d2d.textAlign = 'left';
}


function drawTaskTable(
  d2d: Draw2D,
  m: ReportMetrics,
  printRows: PrintRow[],
  canvasHeight: number,
  cols: ColPositions,
  options: PrintOptions & CellTextOptions,
  rowDrawn: (i: number) => boolean,
) {
  const chartBottom = canvasHeight - m.footerHeight;
  const cellPad = m.s(CELL_PAD);

  d2d.fillStyle = PRINT_COLORS.bg;
  d2d.fillRect(0, m.totalHeaderHeight, m.tableWidth, chartBottom - m.totalHeaderHeight);

  for (let i = 0; i < printRows.length; i++) {
    if (!rowDrawn(i)) continue;
    const row = printRows[i];
    const y = m.totalHeaderHeight + i * m.rowHeight;
    const textY = y + m.rowHeight / 2;

    if (i % 2 === 0) {
      d2d.fillStyle = PRINT_COLORS.rowEven;
      d2d.fillRect(0, y, m.tableWidth, m.rowHeight);
    }

    d2d.strokeStyle = PRINT_COLORS.grid;
    d2d.lineWidth = 0.3;
    d2d.beginPath();
    d2d.moveTo(0, y + m.rowHeight);
    d2d.lineTo(m.tableWidth, y + m.rowHeight);
    d2d.stroke();

    if (row.kind === 'group') {
      const indent = row.depth * m.s(NAME_INDENT_PER_LEVEL);
      d2d.fillStyle = PRINT_COLORS.summary;
      d2d.font = m.font(9, true);
      d2d.textAlign = 'left';
      d2d.textBaseline = 'middle';
      const nameX = cols.name.x + cellPad + indent;
      const nameAvail = cols.name.x + cols.name.w - m.s(NAME_RIGHT_PAD) - nameX;
      d2d.fillText(ellipsize(d2d, groupBandLabel(row), nameAvail), nameX, textY);
      d2d.textAlign = 'left';
      d2d.textBaseline = 'alphabetic';
      continue;
    }

    const task = row.task!;
    const cells = taskTableCellTexts(row, options);
    const cellText = (text: string, col: { w: number }) => ellipsize(d2d, text, col.w - 2 * cellPad);
    const depth = row.depth;
    const indent = depth * m.s(NAME_INDENT_PER_LEVEL);
    const isSummary = isSummaryTask(task);

    for (const col of cols.list) {
      if (col.kind === 'name') {
        d2d.fillStyle = isSummary ? PRINT_COLORS.summary : PRINT_COLORS.text;
        d2d.font = m.font(9, isSummary);
        d2d.textAlign = 'left';
        d2d.textBaseline = 'middle';
        const nameX = col.x + cellPad + indent;
        const nameAvail = col.x + col.w - m.s(NAME_RIGHT_PAD) - nameX;
        d2d.fillText(ellipsize(d2d, task.name, nameAvail), nameX, textY);
        continue;
      }
      if ((col.kind === 'units' || col.kind === 'curve') && !row.assignment) continue;
      const text = col.kind === 'custom' ? customCellText(row, col.spec) : cells[col.kind];
      if (!text) continue;
      d2d.fillStyle = PRINT_COLORS.textSecondary;
      d2d.font = m.font(8);
      d2d.textBaseline = 'middle';
      const align = col.kind === 'wbs' || col.kind === 'curve'
        ? 'left'
        : col.kind === 'custom' ? (col.spec?.align ?? 'left') : 'right';
      d2d.textAlign = align;
      const x = align === 'left' ? col.x + cellPad : align === 'right' ? col.x + col.w - cellPad : col.x + col.w / 2;
      d2d.fillText(cellText(text, col), x, textY);
    }

    d2d.textAlign = 'left';
    d2d.textBaseline = 'alphabetic';
  }

  d2d.strokeStyle = PRINT_COLORS.grid;
  d2d.lineWidth = 0.5;
  const colBorders = cols.list.slice(1).map(col => col.x);
  for (const cx of colBorders) {
    d2d.beginPath();
    d2d.moveTo(cx, m.totalHeaderHeight);
    d2d.lineTo(cx, chartBottom);
    d2d.stroke();
  }

  d2d.strokeStyle = PRINT_COLORS.borderDark;
  d2d.lineWidth = 1;
  d2d.beginPath();
  d2d.moveTo(m.tableWidth, m.projectHeaderHeight);
  d2d.lineTo(m.tableWidth, chartBottom);
  d2d.stroke();

  d2d.beginPath();
  d2d.moveTo(0, m.projectHeaderHeight);
  d2d.lineTo(0, chartBottom);
  d2d.stroke();
}


const drivingSets = new WeakMap<readonly string[], ReadonlySet<string>>();
function drivingSetOf(ids: readonly string[]): ReadonlySet<string> {
  let set = drivingSets.get(ids);
  if (!set) { set = new Set(ids); drivingSets.set(ids, set); }
  return set;
}

function drawDependencies(
  d2d: Draw2D,
  m: ReportMetrics,
  tasksById: Map<string, Task>,
  sequences: Sequence[],
  dateToX: (d: Date) => number,
  rowToY: (i: number) => number,
  zoom: number,
  options: PrintOptions,
  rowIndexOf: Map<string, number>,
  spanDrawn?: (lo: number, hi: number) => boolean,
  clipX?: readonly [number, number],
) {
  d2d.lineWidth = 1.2;

  const drivingSet = options.drivingSequenceIds ? drivingSetOf(options.drivingSequenceIds) : null;

  for (const seq of sequences) {
    const predIdx = rowIndexOf.get(seq.predecessorId);
    if (predIdx === undefined) continue;
    const succIdx = rowIndexOf.get(seq.successorId);
    if (succIdx === undefined) continue;
    if (spanDrawn && !spanDrawn(Math.min(predIdx, succIdx), Math.max(predIdx, succIdx))) continue;
    const pred = tasksById.get(seq.predecessorId);
    const succ = tasksById.get(seq.successorId);
    if (!pred || !succ) continue;
    const predY = rowToY(predIdx) + m.rowHeight / 2;
    const succY = rowToY(succIdx) + m.rowHeight / 2;

    const isDriving = drivingSet ? drivingSet.has(seq.id) : true;
    const isCriticalLink = drivingSet !== null && isDriving
      && options.showCritical && pred.time.isCritical && succ.time.isCritical;
    const color = isCriticalLink ? PRINT_COLORS.critical : PRINT_COLORS.dependency;
    d2d.strokeStyle = color;
    d2d.fillStyle = color;
    d2d.setLineDash(isDriving ? [] : [m.s(4), m.s(3)]);

    const predStart = seq.type === 'START_START' || seq.type === 'START_FINISH';
    const succFinish = seq.type === 'FINISH_FINISH' || seq.type === 'START_FINISH';
    const predBar = taskBarSpan(pred, dateToX, zoom);
    const succBar = taskBarSpan(succ, dateToX, zoom);
    const fromX = (predStart ? predBar?.x1 : predBar?.x2) ?? Number.NaN;
    const toX = (succFinish ? succBar?.x2 : succBar?.x1) ?? Number.NaN;
    const dirOut = predStart ? -1 : 1;
    const dirIn = succFinish ? 1 : -1;

    const outX = fromX + dirOut * DEP_STUB;

    let route: [number, number][];
    if ((outX - toX) * dirIn >= DEP_STUB) {
      route = [[fromX, predY], [outX, predY], [outX, succY], [toX, succY]];
    } else {
      const gutterInset = 2;
      const gutterY = succIdx > predIdx
        ? rowToY(succIdx) + gutterInset
        : rowToY(succIdx) + m.rowHeight - gutterInset;
      const inX = toX + dirIn * DEP_STUB;
      route = [[fromX, predY], [outX, predY], [outX, gutterY], [inX, gutterY], [inX, succY], [toX, succY]];
    }
    if (!strokeRoute(d2d, route, clipX)) continue;

    const headX = toX + dirIn * 5;
    if (clipX && (Math.min(toX, headX) < clipX[0] || Math.max(toX, headX) > clipX[1])) continue;
    d2d.beginPath();
    d2d.moveTo(toX, succY);
    d2d.lineTo(toX + dirIn * 5, succY - 3);
    d2d.lineTo(toX + dirIn * 5, succY + 3);
    d2d.closePath();
    d2d.fill();
  }

  d2d.setLineDash([]);
}


function strokeRoute(d2d: Draw2D, route: readonly [number, number][], clipX: readonly [number, number] | undefined): boolean {
  d2d.beginPath();
  let pen: [number, number] | null = null;
  let drawn = false;
  for (let i = 1; i < route.length; i++) {
    let [ax, ay] = route[i - 1];
    let [bx, by] = route[i];
    if (clipX) {
      const [lo, hi] = clipX;
      if (ax === bx) {
        if (ax < lo || ax > hi) continue;
      } else {
        const l = Math.max(lo, Math.min(ax, bx));
        const r = Math.min(hi, Math.max(ax, bx));
        if (l > r) continue;
        if (ax < bx) { ax = l; bx = r; } else { ax = r; bx = l; }
      }
    }
    if (!pen || !Object.is(pen[0], ax) || !Object.is(pen[1], ay)) d2d.moveTo(ax, ay);
    d2d.lineTo(bx, by);
    pen = [bx, by];
    drawn = true;
  }
  if (drawn) d2d.stroke();
  return drawn;
}

function drawFooter(
  d2d: Draw2D,
  m: ReportMetrics,
  canvasWidth: number,
  canvasHeight: number,
  projectName: string,
  options: PrintOptions,
  printRows: { kind: 'task' | 'group'; task?: Task; depth: number; label?: string; count?: number }[],
) {
  const footerTop = canvasHeight - m.footerHeight;
  const pad = m.s(10);
  const layoutWidth = Math.min(canvasWidth, options.footerLayoutWidth && options.footerLayoutWidth > 0 ? options.footerLayoutWidth : canvasWidth);

  d2d.fillStyle = PRINT_COLORS.surface;
  d2d.fillRect(0, footerTop, canvasWidth, m.footerHeight);

  d2d.strokeStyle = PRINT_COLORS.borderDark;
  d2d.lineWidth = 1;
  d2d.beginPath();
  d2d.moveTo(0, footerTop);
  d2d.lineTo(canvasWidth, footerTop);
  d2d.stroke();

  const midY = footerTop + m.footerHeight / 2;

  d2d.fillStyle = PRINT_COLORS.text;
  d2d.font = m.font(10, true);
  d2d.textAlign = 'left';
  d2d.textBaseline = 'middle';
  d2d.fillText(projectName, pad, midY - m.s(8));
  const leftNameW = d2d.measureText(projectName).width;

  d2d.fillStyle = PRINT_COLORS.textSecondary;
  d2d.font = m.font(8);
  const printLocale = options.locale ?? 'nl';
  const dateStr = new Date().toLocaleDateString(printLocale, { day: '2-digit', month: 'long', year: 'numeric' });
  const dateText = `${options.labels?.printed ?? 'Afgedrukt:'} ${dateStr}`;
  d2d.fillText(dateText, pad, midY + m.s(8));
  const leftBlockRight = pad + Math.max(leftNameW, d2d.measureText(dateText).width);

  const brandText = 'Open Planner Studio';
  d2d.font = m.font(8);
  const brandW = d2d.measureText(brandText).width;
  const rightBlockLeft = layoutWidth - pad - brandW;

  d2d.fillStyle = PRINT_COLORS.textSecondary;
  d2d.textAlign = 'right';
  d2d.textBaseline = 'middle';
  d2d.font = m.font(8);
  d2d.fillText(brandText, layoutWidth - pad, midY + m.s(8));

  if (options.showLegend) {
    const availLeft = leftBlockRight + m.s(16);
    const availRight = rightBlockLeft - m.s(16);
    const availSpan = availRight - availLeft;
    if (availSpan > m.s(20)) {
      const lg = options.labels?.legend;
      const swatchW = m.s(16);
      const swatchH = m.s(10);
      const gap = m.s(16);
      const labelPad = m.s(4);
      type LegendItem = { label: string; draw: (x: number) => void };
      const items: LegendItem[] = [];

      const legendPalette: BarPalette = {
        critical: PRINT_COLORS.critical,
        normal: PRINT_COLORS.normal,
        nearCritical: PRINT_COLORS.nearCritical,
        milestone: PRINT_COLORS.milestone,
        uncategorized: PRINT_COLORS.uncategorized,
      };
      const legendContext: BarColorContext = {
        activityCodeTypes: options.activityCodeTypes ?? [],
        customFieldDefs: options.customFieldDefs ?? [],
        resources: options.resources ?? [],
        assignments: options.assignments ?? [],
        taskTypeLabels: options.taskTypeLabels,
        customTaskTypes: options.customTaskTypes,
        noneLabel: options.barColorNoneLabel ?? '(geen)',
      };
      const selection = options.barColorSelection ?? { mode: 'critical' };
      const isCriticalMode = selection.mode === 'critical';
      if (isCriticalMode) {
        if (options.showCritical) {
          items.push({ label: lg?.criticalPath ?? 'Kritiek pad', draw: (x) => {
            d2d.fillStyle = selection.mode === 'critical' && selection.colors?.critical ? ensureCustomBarVisible(selection.colors.critical, false) : PRINT_COLORS.critical;
            d2d.roundRect(x, midY - swatchH / 2, swatchW, swatchH, m.s(2));
            d2d.fill();
          } });
        }
        items.push({ label: lg?.normal ?? 'Normaal', draw: (x) => {
          d2d.fillStyle = selection.mode === 'critical' && selection.colors?.normal ? ensureCustomBarVisible(selection.colors.normal, false) : PRINT_COLORS.normal;
          d2d.roundRect(x, midY - swatchH / 2, swatchW, swatchH, m.s(2));
          d2d.fill();
        } });
        const hasNearCritical = printRows.some(row => row.kind === 'task' && row.task
          && !row.task.time.isCritical && row.task.time.isNearCritical);
        if (hasNearCritical) {
          items.push({ label: lg?.nearCritical ?? 'Bijna-kritiek', draw: (x) => {
            d2d.fillStyle = selection.mode === 'critical' && selection.colors?.nearCritical ? ensureCustomBarVisible(selection.colors.nearCritical, false) : PRINT_COLORS.nearCritical;
            d2d.roundRect(x, midY - swatchH / 2, swatchW, swatchH, m.s(2));
            d2d.fill();
          } });
        }
      }
      if (selection.mode === 'category') {
        const effective = effectiveBarColorSelection(selection, legendContext).effective;
        if (effective.mode === 'category') {
          const visibleTasks = printRows
            .filter(row => row.kind === 'task' && row.task)
            .map(row => row.task!);
          const categories = visibleBarColorCategories(visibleTasks, effective.field, legendContext);
          const LEGEND_CATEGORY_CAP = 8;
          for (const category of categories.slice(0, LEGEND_CATEGORY_CAP)) {
            items.push({ label: category.label, draw: (x) => {
              d2d.fillStyle = barCategoryDisplayColor(category, legendPalette);
              d2d.roundRect(x, midY - swatchH / 2, swatchW, swatchH, m.s(2));
              d2d.fill();
            } });
          }
          const moreLabel = options.barColorsLegendLabels?.categoriesMore;
          if (categories.length > LEGEND_CATEGORY_CAP && moreLabel) {
            items.push({
              label: moreLabel(categories.length - LEGEND_CATEGORY_CAP),
              draw: () => { },
            });
          }
        }
      }
      if (!isCriticalMode) {
        items.push({ label: options.barColorsLegendLabels?.criticalOutline ?? 'Kritiek pad', draw: (x) => {
          d2d.strokeStyle = PRINT_COLORS.critical;
          d2d.lineWidth = 1;
          d2d.roundRect(x, midY - swatchH / 2, swatchW, swatchH, m.s(2));
          d2d.stroke();
        } });
      }
      items.push({ label: lg?.milestone ?? 'Mijlpaal', draw: (x) => {
        d2d.fillStyle = PRINT_COLORS.milestone;
        const mx = x + swatchW / 2;
        d2d.beginPath();
        d2d.moveTo(mx, midY - m.s(5));
        d2d.lineTo(mx + m.s(5), midY);
        d2d.lineTo(mx, midY + m.s(5));
        d2d.lineTo(mx - m.s(5), midY);
        d2d.closePath();
        d2d.fill();
      } });
      items.push({ label: lg?.summary ?? 'Samenvatting', draw: (x) => {
        d2d.fillStyle = PRINT_COLORS.summary;
        d2d.fillRect(x, midY - m.s(2), swatchW, m.s(4));
        d2d.beginPath();
        d2d.moveTo(x, midY - m.s(2));
        d2d.lineTo(x, midY + m.s(5));
        d2d.lineTo(x + m.s(4), midY + m.s(2));
        d2d.closePath();
        d2d.fill();
      } });
      if (options.showCompletion && printRows.some(row => row.kind === 'task' && (row.task?.time.completion ?? 0) > 0)) {
        items.push({ label: lg?.completion ?? 'Voltooid', draw: (x) => {
          paintProgressBarPiece(d2d, x, x + swatchW, midY - m.s(4), m.s(8), m.s(2), PRINT_COLORS.normal, x + swatchW / 2, false);
        } });
      }
      if (options.showFloat) {
        items.push({ label: lg?.float ?? 'Speling', draw: (x) => {
          d2d.fillStyle = PRINT_COLORS.float + '40';
          d2d.fillRect(x, midY - m.s(4), swatchW, m.s(8));
        } });
      }
      const layerOverlays: { slot: BaselineSlot; overlay: BaselineOverlay }[] = [];
      if (options.baselineOverlay) layerOverlays.push({ slot: 0, overlay: options.baselineOverlay });
      for (const c of options.baselineComparisons ?? []) layerOverlays.push(c);
      const shownLayers = options.showBaselineOverlay
        ? layerOverlays.filter(l => printRows.some(row => row.kind === 'task' && row.task && l.overlay.has(row.task.id)))
        : [];
      const swatch = (slot: BaselineSlot) => (x: number) => {
        d2d.fillStyle = printBaselineColor(slot);
        d2d.roundRect(x, midY - m.s(2), swatchW, m.s(4), m.s(2));
        d2d.fill();
      };
      if (shownLayers.length === 1 && shownLayers[0].slot === 0) {
        items.push({ label: lg?.baseline ?? 'Baseline', draw: swatch(0) });
      } else {
        for (const l of shownLayers) {
          items.push({ label: options.baselineNames?.[l.slot] ?? lg?.baseline ?? 'Baseline', draw: swatch(l.slot) });
        }
      }
      if (options.showDeps && options.drivingSequenceIds) {
        items.push({ label: lg?.relationStyle ?? 'Bepalend / niet-bepalend', draw: (x) => {
          d2d.strokeStyle = PRINT_COLORS.dependency;
          d2d.lineWidth = 1.2;
          d2d.setLineDash([]);
          d2d.beginPath();
          d2d.moveTo(x, midY - m.s(3));
          d2d.lineTo(x + swatchW, midY - m.s(3));
          d2d.stroke();
          d2d.setLineDash([m.s(4), m.s(3)]);
          d2d.beginPath();
          d2d.moveTo(x, midY + m.s(3));
          d2d.lineTo(x + swatchW, midY + m.s(3));
          d2d.stroke();
          d2d.setLineDash([]);
        } });
      }

      d2d.font = m.font(8);
      d2d.textBaseline = 'middle';
      const widths = items.map(it => swatchW + labelPad + d2d.measureText(it.label).width);
      const measure = (n: number) => widths.slice(0, n).reduce((a, b) => a + b, 0) + gap * Math.max(0, n - 1);
      let visible = items.length;
      while (visible > 0 && measure(visible) > availSpan) visible--;

      let lx = availLeft + Math.max(0, (availSpan - measure(visible)) / 2);
      for (let k = 0; k < visible; k++) {
        items[k].draw(lx);
        d2d.fillStyle = PRINT_COLORS.textSecondary;
        d2d.textAlign = 'left';
        d2d.fillText(items[k].label, lx + swatchW + labelPad, midY);
        lx += widths[k] + gap;
      }
    }
  }

  d2d.textAlign = 'left';
  d2d.textBaseline = 'alphabetic';
}
