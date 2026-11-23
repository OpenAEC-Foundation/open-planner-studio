import { Task } from '@/types/task';
import type { BaselineOverlay } from '@/types/baseline';
import { Sequence } from '@/types/sequence';
import type { ViewState, BarSplitMode, DateNotation, DurationDisplay, TimeNotation } from '@/types/view';
import { displayDateTime } from '@/utils/displayDate';
import { statusDateAsUsed, statusDateInstant } from '@/utils/statusDateTime';
import { formatAxisClock } from '@/utils/displayTime';
import { parseDate, parseInstant, addCalendarDays, diffCalendarDays, isoDayOfWeek, getWeekNumberFor, utcDayStart, localNowOnDayAxis, MS_PER_DAY } from '@/utils/dateUtils';
import { holidayEndDate, isHourModeCalendar, WorkCalendar } from '@/types/calendar';
import { calendarWithEffectiveWorkTime } from '@/utils/effectiveWorkTime';
import { durationHoursPerDay, effHoursPerDay, formatTaskDurationDisplay } from '@/utils/taskDuration';
import { formatDuration, DEFAULT_DURATION_SUFFIXES, type DurationSuffixes } from '@/utils/durationFormat';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { isZeroDurationMilestone, taskDurationUnit } from '@/engine/scheduler/duration';
import { firstRowIndexByTask, type ViewRow } from '@/engine/view/visibleRows';
import { assignmentsForTask, computeBarColors, type BarPalette } from '@/services/print/barColors';
import type { BarColorContext } from '@/services/print/barColorCategories';
import type { BarColorSelection } from '@/types/barColor';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import { ensureCustomBarVisible, ensureHighContrastBarVisible, ensureThemeVisible } from '@/engine/renderer/resourcePalette';
import { TimelineTier, TierConfig, TIER_CONFIG, pickTiers, nextTickBoundary, snapToTickStart } from './timelineTiers';
import { readGanttPalette, barLabelColor, doneBarTones, type GanttPalette } from './themePalette';
import { paintProgressBarPiece } from './barPaint';
import { xToDayOffset, type GanttAxis } from './timeAxis';
import { resolveGanttAxis, isCompressedEffective } from './workdayAxis';
import { computeSplitSegments, splitEngineFor, taskSplitMeasure } from './splitBarGeometry';
import { milestoneAnchorX, taskBarSpan } from './barSpan';
import { milestoneGroups, type MilestoneGroups } from './milestoneGroups';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { classifyTraceTask, isRelationOutsideTrace, type TaskTrace } from '@/engine/taskGrid/trace';
import { ellipsize } from './textFit';
import { taskDateLabel } from '@/utils/taskDateLabel';
import { barLayout, type BarLayout } from './rowGeometry';
import {
  BASELINE_BLEND_PX, baselineDiamonds, baselineDiamondSize, baselineSpanX, baselineStripPieces, paintBaselineStrip, widenBars, widenShortRuns,
  type BaselineBar, type BaselineMilestone, type BaselineSlot,
} from './baselineStrip';
import { canvasFont, TEXT_ROLE_PX, type TextRole } from './textRoles';
import { shownStart, shownFinish, floatBandEnd } from '@/utils/taskDates';

const rowIndexCache = new WeakMap<ViewRow[], Map<string, number>>();
function cachedRowIndexByTask(rows: ViewRow[]): Map<string, number> {
  if (!Object.isFrozen(rows)) return firstRowIndexByTask(rows);
  let map = rowIndexCache.get(rows);
  if (!map) { map = firstRowIndexByTask(rows); rowIndexCache.set(rows, map); }
  return map;
}

interface ArrowEntry {
  seq: Sequence;
  predIdx: number;
  succIdx: number;
  loIdx: number;
  hiIdx: number;
  pred: Task;
  succ: Task;
}
function rowTask(row: ViewRow | undefined, id: string): Task | undefined {
  if (row?.kind === 'task') return row.task;
  if (row?.kind === 'milestones') return row.tasks.find(task => task.id === id);
  return undefined;
}

const arrowEntryCache = new WeakMap<Sequence[], { rows: ViewRow[]; entries: ArrowEntry[] }>();
function cachedArrowEntries(sequences: Sequence[], rows: ViewRow[], rowIndexByTask: Map<string, number>): ArrowEntry[] {
  const cacheable = Object.isFrozen(sequences) && Object.isFrozen(rows);
  const cached = cacheable ? arrowEntryCache.get(sequences) : undefined;
  if (cached && cached.rows === rows) return cached.entries;
  const entries: ArrowEntry[] = [];
  for (const seq of sequences) {
    const predIdx = rowIndexByTask.get(seq.predecessorId) ?? -1;
    const succIdx = rowIndexByTask.get(seq.successorId) ?? -1;
    if (predIdx < 0 || succIdx < 0) continue;
    const pred = rowTask(rows[predIdx], seq.predecessorId);
    const succ = rowTask(rows[succIdx], seq.successorId);
    if (!pred || !succ) continue;
    entries.push({
      seq, predIdx, succIdx, loIdx: Math.min(predIdx, succIdx), hiIdx: Math.max(predIdx, succIdx),
      pred, succ,
    });
  }
  if (cacheable) arrowEntryCache.set(sequences, { rows, entries });
  return entries;
}

interface BaselineHitRect {
  slots: BaselineSlot[];
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  diamond?: { cx: number; cy: number; s: number };
}

export interface GanttRenderOptions {
  rows: ViewRow[];
  sequences: Sequence[];
  calendar: WorkCalendar;
  view: ViewState;
  selectedTaskIds: string[];
  drivingSequenceIds?: string[];
  trace?: TaskTrace | null;
  violatedConstraintTaskIds?: string[];
  missedDeadlineTaskIds?: string[];
  statusDate?: string;
  showStatusDateLine?: boolean;
  showProgressLine?: boolean;
  showBaselineOverlay?: boolean;
  showResourceAccent?: boolean;
  showFloatBand?: boolean;
  showBarDates?: boolean;
  darkTheme?: boolean;
  barColorSelection?: BarColorSelection;
  activityCodeTypes?: ActivityCodeType[];
  customFieldDefs?: CustomFieldDef[];
  taskTypeLabels?: Record<string, string>;
  customTaskTypes?: import('@/types/task').CustomTaskType[];
  barColorNoneLabel?: string;
  resources?: import('@/types/resource').Resource[];
  assignments?: import('@/types/resource').ResourceAssignment[];
  baselineOverlay?: BaselineOverlay;
  baselineComparisons?: { slot: 1 | 2; overlay: BaselineOverlay }[];
  canvasWidth: number;
  canvasHeight: number;
  rowHeight: number;
  headerHeight: number;
  localizedMonths?: string[];
  localizedWeekdays?: string[];
  weekStartDay?: 'monday' | 'sunday';
  timeNotation?: TimeNotation;
  dateNotation?: DateNotation;
  enableQuarterHourZoom?: boolean;
  effectiveCalById?: Map<string, WorkCalendar>;
  barSplitMode?: BarSplitMode;
  durationDisplay?: DurationDisplay;
  workdayDurationMeasure?: boolean;
  durationSuffixes?: DurationSuffixes;
  externalStaleLabel?: string;
  durationDrag?: { taskId: string; edge: 'left' | 'right' };
  highContrast?: boolean;
  palette?: GanttPalette;
  compressNonWorkdays?: boolean;
  axis?: GanttAxis;
  fontFamily?: string;
  fontScale?: number;
}

interface RowObstacles {
  r0: number;
  r1: number;
  x1: Float64Array;
  x2: Float64Array;
}

const EMPTY_SPANS = new Float64Array(0);

const patternCache = new Map<string, CanvasPattern | null>();
function tilePattern(
  ctx: CanvasRenderingContext2D,
  key: string,
  size: number,
  draw: (p: CanvasRenderingContext2D) => void,
): CanvasPattern | null {
  const cached = patternCache.get(key);
  if (cached !== undefined) return cached;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function'
    || typeof ctx.createPattern !== 'function') return null;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const p = tile.getContext('2d');
  if (!p) return null;
  draw(p);
  const pattern = ctx.createPattern(tile, 'repeat');
  patternCache.set(key, pattern);
  return pattern;
}

function anchorPattern(pattern: CanvasPattern, x: number, y: number): void {
  if (typeof pattern.setTransform !== 'function' || typeof DOMMatrix === 'undefined') return;
  pattern.setTransform(new DOMMatrix().translateSelf(x, y));
}

function getNearCriticalHatch(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const size = 8;
  return tilePattern(ctx, 'near-critical', size, (p) => {
    p.fillStyle = 'rgba(0,0,0,0.82)';
    p.fillRect(0, 0, size / 2, size / 2);
    p.fillRect(size / 2, size / 2, size / 2, size / 2);
  });
}

function getCrossHatch(ctx: CanvasRenderingContext2D, strokeColor: string, size: number): CanvasPattern | null {
  return tilePattern(ctx, `cross|${strokeColor}|${size}`, size, (p) => {
    p.strokeStyle = strokeColor;
    p.lineWidth = 1;
    p.beginPath();
    p.moveTo(0, size); p.lineTo(size, 0);
    p.moveTo(-1, 1); p.lineTo(1, -1);
    p.moveTo(size - 1, size + 1); p.lineTo(size + 1, size - 1);
    p.moveTo(0, 0); p.lineTo(size, size);
    p.moveTo(size - 1, -1); p.lineTo(size + 1, 1);
    p.moveTo(-1, size - 1); p.lineTo(1, size + 1);
    p.stroke();
  });
}

const FLOAT_HATCH_SIZE = 5;

const OUTSIDE_LABEL_GAP = 6;
const OUTSIDE_LABEL_MAX = 260;
const OUTSIDE_LABEL_KNOCKOUT = 3;
const BAR_DATE_GAP = 6;
const BAR_RADIUS = 4;


export type GanttGridDensity = 'day' | 'week' | 'month';
export function gridDensityForZoom(zoom: number): GanttGridDensity {
  if (zoom >= 8) return 'day';
  if (zoom >= 2) return 'week';
  return 'month';
}

export class GanttRenderer {
  private ctx: CanvasRenderingContext2D;
  private opts: GanttRenderOptions;
  private colors: GanttPalette;
  private baselineHits = new Map<number, { task: Task; rects: BaselineHitRect[] }>();

  private viewStart: Date;
  private rows: ViewRow[];
  private rowIndexByTask: Map<string, number>;
  private milestoneGroups: MilestoneGroups;
  private projectEngine: CalendarEngine;
  private violatedSet: Set<string>;
  private missedDeadlineSet: Set<string>;
  private highContrast: boolean;
  private axis: GanttAxis;
  private compressed: boolean;
  private barColorContext: BarColorContext;

  private static readonly DIM_ALPHA = 0.45;

  private engineCache = new Map<string, CalendarEngine>();

  private splitSegmentsByTask = new Map<string, { x1: number; x2: number }[]>();
  private outsideNameSpans = new Map<number, { left: number; right: number; top: number; bottom: number }>();
  private drawingRowIndex = -1;
  private readonly bar: BarLayout;

  constructor(ctx: CanvasRenderingContext2D, opts: GanttRenderOptions) {
    this.ctx = ctx;
    this.opts = opts;
    this.bar = barLayout(opts.rowHeight, {
      resourceAccent: !!opts.showResourceAccent,
      baselines: opts.showBaselineOverlay !== false
        && (!!opts.baselineOverlay || (opts.baselineComparisons?.length ?? 0) > 0),
    });
    this.colors = opts.palette ?? readGanttPalette();

    this.viewStart = parseDate(opts.view.viewStartDate);
    this.rows = opts.rows;
    this.rowIndexByTask = cachedRowIndexByTask(opts.rows);
    this.milestoneGroups = milestoneGroups(opts.rows);
    this.projectEngine = new CalendarEngine(opts.calendar);
    this.engineCache.set(opts.calendar.id, this.projectEngine);
    this.violatedSet = new Set(opts.violatedConstraintTaskIds ?? []);
    this.missedDeadlineSet = new Set(opts.missedDeadlineTaskIds ?? []);
    this.highContrast = !!opts.highContrast;
    this.barColorContext = {
      activityCodeTypes: opts.activityCodeTypes ?? [],
      customFieldDefs: opts.customFieldDefs ?? [],
      resources: opts.resources ?? [],
      assignments: opts.assignments ?? [],
      taskTypeLabels: opts.taskTypeLabels,
      customTaskTypes: opts.customTaskTypes,
      noneLabel: opts.barColorNoneLabel ?? '(geen)',
    };
    this.axis = opts.axis ?? resolveGanttAxis({
      calendar: this.projectEngine,
      compressNonWorkdays: !!opts.compressNonWorkdays,
      origin: this.viewStart,
      chartOriginX: 0,
      zoom: opts.view.zoom,
      scrollX: opts.view.scrollX,
    });
    this.compressed = isCompressedEffective(this.projectEngine, !!opts.compressNonWorkdays);
  }

  private font(role: TextRole, bold = false): string {
    return canvasFont(role, this.opts.fontScale ?? 1, this.opts.fontFamily, bold);
  }

  private highContrastBackgrounds(): string[] {
    return [this.colors.bg, this.compressed ? this.colors.gridWeekBand : this.colors.gridWeekend];
  }

  private categoryColor(color: string): string {
    return this.highContrast
      ? ensureHighContrastBarVisible(color, this.highContrastBackgrounds())
      : ensureThemeVisible(color, this.opts.darkTheme === true);
  }

  private barColor(task: Task, overrideColor?: string): string {
    if (overrideColor) return overrideColor;
    const selection = this.opts.barColorSelection;
    const custom = selection?.mode === 'critical' ? selection.colors : undefined;
    const visible = (color: string) => this.highContrast
      ? ensureHighContrastBarVisible(color, this.highContrastBackgrounds())
      : ensureCustomBarVisible(color, this.opts.darkTheme === true);
    if (task.time.isCritical) return custom?.critical ? visible(custom.critical) : this.colors.critical;
    if (task.time.isNearCritical) return custom?.nearCritical ? visible(custom.nearCritical) : this.colors.nearCritical;
    if (custom?.normal) return visible(custom.normal);
    const fp = task.time.floatPath;
    if (fp !== undefined && fp > 1) {
      const tints = this.colors.floatPathTints;
      return tints[(fp - 2) % tints.length];
    }
    return this.colors.normal;
  }

  private durationText(task: Task): string {
    if (isZeroDurationMilestone(task)) return '0d';
    const cal = this.opts.effectiveCalById?.get(task.id) ?? this.opts.calendar;
    return formatTaskDurationDisplay(
      task,
      cal,
      this.opts.durationDisplay ?? 'auto',
      this.opts.durationSuffixes,
    );
  }

  dateToX(date: Date): number {
    return this.axis.dateToX(date);
  }

  rowToY(rowIndex: number): number {
    return this.opts.headerHeight + rowIndex * this.opts.rowHeight - this.opts.view.scrollY;
  }

  private visibleRowRange(rowCount = this.rows.length): { first: number; last: number } {
    const { rowHeight, headerHeight, canvasHeight, view } = this.opts;
    return {
      first: Math.max(0, Math.ceil(view.scrollY / rowHeight) - 2),
      last: Math.min(rowCount - 1, Math.ceil((canvasHeight - headerHeight + view.scrollY) / rowHeight) + 1),
    };
  }

  private barGeometry(task: Task): { x1: number; x2: number; hourMode: boolean; start: Date; end: Date } {
    const span = taskBarSpan(task, date => this.dateToX(date), this.opts.view.zoom);
    if (span) return span;
    const d = this.viewStart;
    const x = this.dateToX(d);
    return { x1: x, x2: x + this.opts.view.zoom, hourMode: false, start: d, end: d };
  }

  private splitEngine(task: Task): CalendarEngine {
    return splitEngineFor(this.opts.effectiveCalById?.get(task.id) ?? this.opts.calendar);
  }

  private engineFor(task: Task): CalendarEngine | null {
    const cal = this.opts.effectiveCalById?.get(task.id) ?? this.opts.calendar;
    if (taskDurationUnit(task) !== 'hours') return null;
    const effectiveCalendar = calendarWithEffectiveWorkTime(cal);
    if (!effectiveCalendar) return null;
    const key = `${cal.id}\u0000effective-hour`;
    let eng = this.engineCache.get(key);
    if (!eng) {
      eng = new CalendarEngine(effectiveCalendar);
      this.engineCache.set(key, eng);
    }
    return eng;
  }

  private shouldSplit(isSelected: boolean): boolean {
    const mode = this.opts.barSplitMode ?? 'selection';
    return mode === 'always' || (mode === 'selection' && isSelected);
  }

  render(): void {
    const { canvasWidth, canvasHeight } = this.opts;
    const ctx = this.ctx;
    this.splitSegmentsByTask.clear();

    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    this.drawGridBackground();
    this.drawTodayLine();
    this.drawDependencyArrows();
    this.drawTaskBars();
    this.drawHolidayLabels();
    this.drawDragDurationBadge();
    this.drawTimelineHeader();
    this.drawProgressLine();
    this.drawStatusDateLine();
    this.drawStatusDateBadge();
  }

  private drawGridBackground(): void {
    const { canvasWidth, canvasHeight, headerHeight, view } = this.opts;
    const ctx = this.ctx;
    const density = gridDensityForZoom(view.zoom);

    const visibleDays = Math.ceil(canvasWidth / view.zoom) + 2;
    const startOffset = Math.floor(xToDayOffset(0, 0, view.zoom, view.scrollX));

    if (this.compressed) {
      const axisStartIndex = Math.floor(this.axis.dayIndexOf(this.viewStart) + view.scrollX / view.zoom);
      for (let i = -1; i < visibleDays; i++) {
        const date = this.axis.dateAtIndex(axisStartIndex + i);
        const x = this.axis.dateToX(date);

        if (getWeekNumberFor(date, this.opts.weekStartDay ?? 'monday') % 2 === 1) {
          ctx.fillStyle = this.colors.gridWeekBand;
          ctx.fillRect(x, headerHeight, view.zoom, canvasHeight - headerHeight);
        }

        const prevDate = this.axis.dateAtIndex(axisStartIndex + i - 1);
        const weekStartDay = this.opts.weekStartDay ?? 'monday';
        const isWeekBoundary = getWeekNumberFor(prevDate, weekStartDay) !== getWeekNumberFor(date, weekStartDay);
        const isMonthStart = density === 'month' && prevDate.getUTCMonth() !== date.getUTCMonth();
        if (density === 'day' || (density === 'week' && isWeekBoundary) || isMonthStart) {
          ctx.strokeStyle = this.colors.grid;
          ctx.lineWidth = density === 'day' ? (isWeekBoundary ? 1 : 0.5) : 1;
          ctx.beginPath();
          ctx.moveTo(x, headerHeight);
          ctx.lineTo(x, canvasHeight);
          ctx.stroke();
        }
      }
    } else {
      for (let i = -1; i < visibleDays; i++) {
        const date = addCalendarDays(this.viewStart, startOffset + i);
        const x = this.dateToX(date);
        const dayOfWeek = isoDayOfWeek(date);

        if (!this.projectEngine.isWorkDay(date)) {
          ctx.fillStyle = this.colors.gridWeekend;
          ctx.fillRect(x, headerHeight, view.zoom, canvasHeight - headerHeight);
        }

        const isWeekStart = dayOfWeek === (this.opts.weekStartDay === 'sunday' ? 7 : 1);
        const isMonthStart = date.getUTCDate() === 1;
        if (density === 'day' || (density === 'week' && isWeekStart) || (density === 'month' && isMonthStart)) {
          ctx.strokeStyle = this.colors.grid;
          ctx.lineWidth = density === 'day' ? (isWeekStart ? 1 : 0.5) : 1;
          ctx.beginPath();
          ctx.moveTo(x, headerHeight);
          ctx.lineTo(x, canvasHeight);
          ctx.stroke();
        }
      }
    }

    const { first, last } = this.visibleRowRange(this.rows.length + 1);
    for (let i = first; i <= last; i++) {
      const y = this.rowToY(i);
      if (y < headerHeight || y > canvasHeight) continue;
      ctx.strokeStyle = this.colors.grid;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
  }

  private drawHolidayLabels(): void {
    if (this.compressed) return;

    const { canvasWidth, canvasHeight, headerHeight, view } = this.opts;
    const zoom = view.zoom;
    const minWidthPx = zoom * 3;
    const ctx = this.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, headerHeight, canvasWidth, Math.max(0, canvasHeight - headerHeight));
    ctx.clip();
    ctx.fillStyle = this.colors.textSecondary;

    for (const h of this.opts.calendar.holidays) {
      const start = parseDate(h.startDate);
      const end = parseDate(holidayEndDate(h));
      const days = diffCalendarDays(start, end) + 1;
      const widthPx = days * zoom;
      if (widthPx < minWidthPx) continue;

      const x1 = this.dateToX(start);
      const x2 = x1 + widthPx;
      if (x2 < 0 || x1 > canvasWidth) continue;

      const clipX1 = Math.max(x1, 0);
      const clipX2 = Math.min(x2, canvasWidth);
      const visibleWidth = clipX2 - clipX1;
      if (visibleWidth < zoom) continue;

      if (widthPx >= 70) {
        ctx.font = this.font('body', true);
        ctx.textBaseline = 'top';
        ctx.save();
        ctx.beginPath();
        ctx.rect(clipX1, headerHeight, visibleWidth, Math.max(0, canvasHeight - headerHeight));
        ctx.clip();
        if (ctx.measureText(h.name).width <= visibleWidth - 8) {
          ctx.textAlign = 'center';
          ctx.fillText(h.name, (clipX1 + clipX2) / 2, headerHeight + 6);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(h.name, x1 + 4, headerHeight + 6);
        }
        ctx.restore();
      } else {
        ctx.font = this.font('small');
        ctx.save();
        ctx.beginPath();
        ctx.rect(clipX1, headerHeight, visibleWidth, Math.max(0, canvasHeight - headerHeight));
        ctx.clip();
        ctx.save();
        ctx.translate(clipX1 + zoom / 2, headerHeight + 8);
        ctx.rotate(Math.PI / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(h.name, 0, 0);
        ctx.restore();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  private drawTodayLine(): void {
    const ctx = this.ctx;
    const x = this.dateToX(localNowOnDayAxis());

    if (x >= 0 && x < this.opts.canvasWidth) {
      ctx.strokeStyle = this.colors.today;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, this.opts.headerHeight);
      ctx.lineTo(x, this.opts.canvasHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawStatusDateLine(): void {
    if (!this.opts.statusDate || this.opts.showStatusDateLine === false) return;
    if (this.opts.showProgressLine !== false) return;
    const ctx = this.ctx;
    const x = this.statusDateX(this.opts.statusDate);
    if (x >= 0 && x < this.opts.canvasWidth) {
      ctx.strokeStyle = this.colors.statusDate;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, this.opts.headerHeight);
      ctx.lineTo(x, this.opts.canvasHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  statusDateX(iso: string): number {
    return this.dateToX(statusDateInstant(iso, isHourModeCalendar(this.opts.calendar)));
  }

  static statusDateBadgeLabel(iso: string, usesTime: boolean, dateNotation: DateNotation = 'dmy', timeNotation: TimeNotation = '24h'): string {
    return displayDateTime(statusDateAsUsed(iso, usesTime), dateNotation, timeNotation);
  }

  private drawStatusDateBadge(): void {
    const iso = this.opts.statusDate;
    if (!iso) return;
    if (this.opts.showStatusDateLine === false && this.opts.showProgressLine === false) return;
    const { canvasWidth, headerHeight } = this.opts;
    const x = this.statusDateX(iso);
    if (x < 0 || x >= canvasWidth) return;

    const label = GanttRenderer.statusDateBadgeLabel(
      iso, isHourModeCalendar(this.opts.calendar), this.opts.dateNotation, this.opts.timeNotation);
    this.ctx.save();
    const h = GanttRenderer.DRAG_BADGE_H;
    const w = this.pillWidth(label);
    let bx = x + 4;
    if (bx + w > canvasWidth - 2) bx = x - 4 - w;
    bx = Math.max(2, bx);
    const by = headerHeight - h - 2;

    this.drawPill(label, bx, by, w, 3, this.colors.statusDate, 1);
    this.ctx.restore();
  }

  private pillWidth(label: string): number {
    const ctx = this.ctx;
    ctx.font = this.font('small', true);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    return ctx.measureText(label).width + GanttRenderer.DRAG_BADGE_PAD_X * 2;
  }

  private drawPill(label: string, x: number, y: number, w: number, radius: number, fill: string, strokeWidth: number): void {
    const ctx = this.ctx;
    const h = GanttRenderer.DRAG_BADGE_H;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = this.colors.bg;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
    ctx.fillStyle = this.colors.accentOn;
    ctx.fillText(label, x + GanttRenderer.DRAG_BADGE_PAD_X, y + h / 2 + 0.5);
  }

  private drawProgressLine(): void {
    if (!this.opts.statusDate || this.opts.showProgressLine === false) return;
    const ctx = this.ctx;
    const usesTime = isHourModeCalendar(this.opts.calendar);
    const statusRef = usesTime ? statusDateInstant(this.opts.statusDate, true) : parseDate(this.opts.statusDate);
    const statusX = this.statusDateX(this.opts.statusDate);
    const { headerHeight, canvasHeight, canvasWidth, rowHeight } = this.opts;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, headerHeight, canvasWidth, canvasHeight - headerHeight);
    ctx.clip();

    ctx.strokeStyle = this.colors.statusDate;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();

    const { first, last } = this.visibleRowRange();
    for (let i = first; i <= last; i++) {
      const rowTop = this.rowToY(i);
      const rowBottom = rowTop + rowHeight;
      if (rowBottom < headerHeight || rowTop > canvasHeight) continue;
      const rowMid = rowTop + rowHeight / 2;
      const row = this.rows[i];
      const task = row.kind === 'task' ? row.task : null;

      let progressX = statusX;
      if (task && !isZeroDurationMilestone(task) && isLeafTask(task)) {
        const geo = this.barGeometry(task);
        const c = Math.max(0, Math.min(1, task.time.completion || 0));
        const finishRef = usesTime ? geo.end : utcDayStart(geo.end);
        const startRef = usesTime ? geo.start : utcDayStart(geo.start);
        const fullyDoneByStatus = c >= 1 && finishRef <= statusRef;
        const notYetStarted = c === 0 && startRef >= statusRef;
        if (!fullyDoneByStatus && !notYetStarted) {
          progressX = geo.x1 + (geo.x2 - geo.x1) * c;
        }
      }

      if (progressX === statusX) {
        ctx.moveTo(statusX, rowTop);
        ctx.lineTo(statusX, rowBottom);
      } else {
        ctx.moveTo(progressX, rowMid);
        ctx.lineTo(statusX, rowTop);
        ctx.moveTo(progressX, rowMid);
        ctx.lineTo(statusX, rowBottom);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  private baselineColor(slot: BaselineSlot): string {
    return slot === 0 ? this.colors.baseline : slot === 1 ? this.colors.baselineCompare1 : this.colors.baselineCompare2;
  }

  private drawBaselineOverlay(task: Task, rowIndex: number, y: number, height: number, resourceAccentHeight = 0): void {
    if (this.opts.showBaselineOverlay === false) return;
    const layers: { slot: BaselineSlot; overlay: BaselineOverlay }[] = [];
    if (this.opts.baselineOverlay) layers.push({ slot: 0, overlay: this.opts.baselineOverlay });
    for (const c of this.opts.baselineComparisons ?? []) layers.push(c);
    if (layers.length === 0) return;

    const top = y + height + 1 + resourceAccentHeight;
    const h = this.bar.baselineHeight;
    const zoom = this.opts.view.zoom;
    const bars: BaselineBar[] = [];
    const milestones: BaselineMilestone[] = [];
    const toX = (d: Date) => this.dateToX(d);
    for (const layer of layers) {
      const entry = layer.overlay.get(task.id);
      if (!entry) continue;
      const pos = baselineSpanX(entry, toX, zoom);
      if (!pos) continue;
      if (pos.kind === 'milestone') milestones.push({ slot: layer.slot, x: pos.x, moment: pos.moment });
      else if (pos.x2 > pos.x1) bars.push({ slot: layer.slot, x1: pos.x1, x2: pos.x2 });
    }
    const pieces = widenShortRuns(baselineStripPieces(bars), 2);
    const diamonds = baselineDiamonds(milestones);
    if (pieces.length === 0 && diamonds.length === 0) return;
    const diamondSize = baselineDiamondSize(h);
    paintBaselineStrip(this.ctx, widenBars(bars, 2), diamonds, {
      top, height: h, blend: BASELINE_BLEND_PX, stripeWidth: this.bar.baselineStripeWidth, diamondSize,
      colorOf: slot => this.baselineColor(slot),
      visibleX: [0, this.opts.canvasWidth],
    });
    const cy = top + h / 2;
    this.baselineHits.set(rowIndex, {
      task,
      rects: [
        ...pieces.map(p => ({ slots: p.slots, x1: p.x1, x2: p.x2, y1: top, y2: top + h })),
        ...diamonds.map(dm => ({
          slots: dm.slots, x1: dm.x - diamondSize, x2: dm.x + diamondSize, y1: cy - diamondSize, y2: cy + diamondSize,
          diamond: { cx: dm.x, cy, s: diamondSize },
        })),
      ],
    });
  }

  getBaselineAt(canvasX: number, canvasY: number): { task: Task; slots: BaselineSlot[] } | null {
    const rowIndex = this.getRowIndex(canvasY);
    const PAD = 2;
    const distance = (r: BaselineHitRect): number => {
      if (r.diamond) {
        return Math.max(0, Math.abs(canvasX - r.diamond.cx) + Math.abs(canvasY - r.diamond.cy) - r.diamond.s);
      }
      const dx = canvasX < r.x1 ? r.x1 - canvasX : canvasX > r.x2 ? canvasX - r.x2 : 0;
      const dy = canvasY < r.y1 ? r.y1 - canvasY : canvasY > r.y2 ? canvasY - r.y2 : 0;
      return Math.max(dx, dy);
    };
    let best: { task: Task; slots: BaselineSlot[] } | null = null;
    let bestDistance = Infinity;
    for (const candidate of [rowIndex + 1, rowIndex, rowIndex - 1]) {
      const hit = this.baselineHits.get(candidate);
      if (!hit) continue;
      for (let i = hit.rects.length - 1; i >= 0; i--) {
        const r = hit.rects[i];
        const d = distance(r);
        if (d === 0) return { task: hit.task, slots: r.slots };
        if (d <= PAD && d < bestDistance) { best = { task: hit.task, slots: r.slots }; bestDistance = d; }
      }
    }
    return best;
  }

  private drawTimelineHeader(): void {
    const { canvasWidth, headerHeight, view, enableQuarterHourZoom } = this.opts;
    const ctx = this.ctx;

    ctx.fillStyle = this.colors.headerBg;
    ctx.fillRect(0, 0, canvasWidth, headerHeight);
    ctx.strokeStyle = this.colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(canvasWidth, headerHeight);
    ctx.stroke();

    const enableQH = enableQuarterHourZoom ?? false;
    const { major, mid, minor } = pickTiers(view.zoom, enableQH);

    const axisViewStartIdx = this.axis.dayIndexOf(this.viewStart);
    const startDate = this.axis.dateAtIndex(axisViewStartIdx + Math.floor(view.scrollX / view.zoom) - 1);
    const endDate = this.axis.dateAtIndex(axisViewStartIdx + Math.ceil((view.scrollX + canvasWidth) / view.zoom) + 1);

    if (mid) {
      ctx.font = this.font('body', true);
      ctx.fillStyle = this.colors.text;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      this.drawTierLabels(major, startDate, endDate, headerHeight / 6);

      ctx.font = this.font('small');
      ctx.fillStyle = this.colors.textSecondary;
      this.drawTierLabels(mid, startDate, endDate, headerHeight / 2);

      ctx.font = this.font('small');
      ctx.fillStyle = this.colors.textSecondary;
      this.drawTierLabels(minor, startDate, endDate, headerHeight * 5 / 6);
      return;
    }

    ctx.font = this.font('body', true);
    ctx.fillStyle = this.colors.text;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    this.drawTierLabels(major, startDate, endDate, headerHeight / 4);

    ctx.font = this.font('small');
    ctx.fillStyle = this.colors.textSecondary;
    this.drawTierLabels(minor, startDate, endDate, headerHeight * 3 / 4);
  }

  private drawTierLabels(
    tier: TimelineTier,
    startDate: Date,
    endDate: Date,
    yCenter: number,
  ): void {
    const { canvasWidth, weekStartDay, localizedMonths, localizedWeekdays } = this.opts;
    const wsd = weekStartDay ?? 'monday';
    const cfg = TIER_CONFIG[tier];

    if (tier === 'day' && this.compressed) {
      this.drawWorkdayTierLabels(startDate, endDate, yCenter, cfg, wsd, localizedWeekdays);
      return;
    }

    let cursor = snapToTickStart(startDate, tier, wsd);
    let lastDrawnRight = -Infinity;
    let compactHours: boolean | undefined;

    while (cursor.getTime() <= endDate.getTime()) {
      const next = nextTickBoundary(cursor, tier);
      const x1 = this.dateToX(cursor);
      const x2 = this.dateToX(next);
      if (tier === 'hour' && (this.opts.timeNotation ?? '24h') === '12h' && compactHours === undefined && x2 > x1) {
        compactHours = this.ctx.measureText('12 AM').width > x2 - x1 - 6;
      }
      const labelText = this.formatTierLabel(tier, cursor, wsd, localizedMonths, localizedWeekdays, compactHours === true);

      if (x2 <= 0) {
        cursor = next;
        continue;
      }
      if (x1 >= canvasWidth) break;

      lastDrawnRight = this.drawTickLabel(labelText, x1, x2, yCenter, cfg.minLabelWidth, lastDrawnRight);
      cursor = next;
    }
  }

  private drawWorkdayTierLabels(
    startDate: Date,
    endDate: Date,
    yCenter: number,
    cfg: TierConfig,
    wsd: 'monday' | 'sunday',
    localizedWeekdays?: string[],
  ): void {
    const { canvasWidth } = this.opts;

    let idx = Math.floor(this.axis.dayIndexOf(startDate));
    const endIdx = Math.ceil(this.axis.dayIndexOf(endDate));
    let lastDrawnRight = -Infinity;

    while (idx <= endIdx) {
      const cursor = this.axis.dateAtIndex(idx);
      const next = this.axis.dateAtIndex(idx + 1);
      const x1 = this.axis.dateToX(cursor);
      const x2 = this.axis.dateToX(next);
      const labelText = this.formatTierLabel('day', cursor, wsd, undefined, localizedWeekdays);

      if (x2 <= 0) {
        idx++;
        continue;
      }
      if (x1 >= canvasWidth) break;

      lastDrawnRight = this.drawTickLabel(labelText, x1, x2, yCenter, cfg.minLabelWidth, lastDrawnRight);
      idx++;
    }
  }

  private drawTickLabel(
    labelText: string,
    x1: number,
    x2: number,
    yCenter: number,
    minLabelWidth: number,
    lastDrawnRight: number,
  ): number {
    const labelX = Math.max(x1 + 4, 4);
    const slotWidth = x2 - Math.max(x1, 0);
    if (slotWidth >= minLabelWidth && labelX > lastDrawnRight + 4) {
      const measured = this.ctx.measureText(labelText).width;
      if (labelX + measured <= x2 - 2) {
        this.ctx.fillText(labelText, labelX, yCenter);
        return labelX + measured;
      }
    }
    return lastDrawnRight;
  }

  private formatTierLabel(
    tier: TimelineTier,
    d: Date,
    weekStartDay: 'monday' | 'sunday',
    localizedMonths?: string[],
    localizedWeekdays?: string[],
    compactHours = false,
  ): string {
    const months = localizedMonths || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const clock = (axisTier: 'hour' | 'quarterHour') => formatAxisClock(
      d.getUTCHours() * 60 + d.getUTCMinutes(), this.opts.timeNotation ?? '24h', axisTier, compactHours);
    switch (tier) {
      case 'year':        return `${d.getUTCFullYear()}`;
      case 'quarter':     return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
      case 'month':       return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      case 'week':        return `W${getWeekNumberFor(d, weekStartDay)}`;
      case 'day': {
        const dayNum = d.getUTCDate();
        if (localizedWeekdays && this.opts.view.zoom >= 40) {
          return `${localizedWeekdays[d.getUTCDay()]} ${dayNum}`;
        }
        return `${dayNum}`;
      }
      case 'hour':        return clock('hour');
      case 'quarterHour': return clock('quarterHour');
    }
  }

  private drawTaskBars(): void {
    this.baselineHits.clear();
    this.outsideNameSpans.clear();
    const { barHeight, barOffset } = this.bar;

    const trace = this.opts.trace;

    const { first, last } = this.visibleRowRange();
    for (let i = first; i <= last; i++) {
      const row = this.rows[i];
      const y = this.rowToY(i) + barOffset;
      if (y + barHeight < this.opts.headerHeight || y > this.opts.canvasHeight) continue;

      if (row.kind === 'group') {
        const rowY = this.rowToY(i);
        this.ctx.fillStyle = this.colors.summary + '14';
        this.ctx.fillRect(0, rowY, this.opts.canvasWidth, this.opts.rowHeight);
        continue;
      }
      if (row.kind === 'milestones') {
        this.drawingRowIndex = i;
        this.drawMilestoneRun(row.tasks, y, barHeight);
        continue;
      }
      const task = row.task;
      const isSelected = this.opts.selectedTaskIds.includes(task.id);
      this.drawingRowIndex = i;

      const traceRole = classifyTraceTask(trace, task.id);
      const overrideColor = this.traceOverrideColor(traceRole);
      const dimmed = traceRole === 'dimmed';

      if (dimmed) this.ctx.globalAlpha = 0.25;
      else if (row.dimmed) this.ctx.globalAlpha = GanttRenderer.DIM_ALPHA;
      let resourceAccentHeight = 0;
      if (isZeroDurationMilestone(task)) {
        this.drawMilestone(task, y, barHeight, isSelected, overrideColor);
      } else if (isSummaryTask(task)) {
        this.drawSummaryBar(task, y, barHeight, isSelected, overrideColor);
      } else if (task.isHammock) {
        this.drawHammockBar(task, y, barHeight, isSelected, overrideColor);
      } else {
        resourceAccentHeight = this.drawTaskBar(task, y, barHeight, isSelected, overrideColor);
      }
      this.drawConstraintMarkers(task, y);
      this.drawNotesIndicator(task, y);
      if (dimmed || row.dimmed) this.ctx.globalAlpha = 1;
      this.drawExternalGhosts(task, y, barHeight);
      this.drawBaselineOverlay(task, i, y, barHeight, resourceAccentHeight);
    }
  }

  private ellipsize(text: string, maxWidth: number): string {
    return ellipsize(this.ctx, text, maxWidth);
  }

  private drawBarName(name: string, color: string, x1: number, y: number, width: number, height: number, textY: number, indent = 0, split?: { x: number; color: string }): void {
    const ctx = this.ctx;
    ctx.font = this.font('body');
    ctx.textBaseline = 'middle';
    const label = this.ellipsize(name, width - 10 - indent);
    if (!label) return;
    const right = x1 + width - 4;
    const parts: { from: number; to: number; color: string }[] = split
      ? [{ from: x1 + 4, to: Math.min(split.x, right), color: split.color }, { from: Math.max(split.x, x1 + 4), to: right, color }]
      : [{ from: x1 + 4, to: right, color }];
    for (const part of parts) {
      if (part.to <= part.from) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(part.from, y, part.to - part.from, height);
      ctx.clip();
      ctx.fillStyle = part.color;
      ctx.fillText(label, x1 + 6 + indent, textY);
      ctx.restore();
    }
  }

  private drawOutsideBarName(name: string, color: string, barRight: number, textY: number, dates?: { finish: string; barLeft: number } | null): void {
    const ctx = this.ctx;
    const edge = this.opts.canvasWidth - 4;
    const preferredX = barRight + GanttRenderer.ARROW_STUB + OUTSIDE_LABEL_GAP;
    let x = preferredX;
    let floor = -Infinity;
    if (dates) {
      ctx.font = this.font('small');
      const dateWidth = dates.finish ? ctx.measureText(dates.finish).width : 0;
      if (dates.finish && preferredX + dateWidth <= edge) {
        this.drawBarDateText(dates.finish, preferredX, textY);
        x = floor = preferredX + dateWidth + BAR_DATE_GAP;
      } else {
        floor = dates.barLeft;
      }
    }
    const maxWidth = Math.min(OUTSIDE_LABEL_MAX, edge - Math.max(floor, 4));
    ctx.font = this.font('body');
    ctx.textBaseline = 'middle';
    const label = name && maxWidth >= 16 ? this.ellipsize(name, maxWidth) : '';
    if (!label) return;
    const labelWidth = ctx.measureText(label).width;
    x = Math.max(floor, Math.min(x, edge - labelWidth));
    const nameX = x;
    const half = Math.ceil(Math.round(TEXT_ROLE_PX.body * (this.opts.fontScale ?? 1)) / 2) + 1;
    this.outsideNameSpans.set(this.drawingRowIndex, { left: nameX, right: nameX + labelWidth, top: textY - half, bottom: textY + half });
    ctx.save();
    ctx.font = this.font('body');
    ctx.lineJoin = 'round';
    ctx.lineWidth = OUTSIDE_LABEL_KNOCKOUT;
    ctx.strokeStyle = this.colors.bg;
    ctx.strokeText(label, nameX, textY);
    ctx.fillStyle = color;
    ctx.fillText(label, nameX, textY);
    ctx.restore();
  }

  private barDates(task: Task): { start: string; finish: string } | null {
    if (this.opts.showBarDates !== true) return null;
    const cal = this.opts.effectiveCalById?.get(task.id) ?? this.opts.calendar;
    const notation = this.opts.dateNotation ?? 'dmy';
    const clock = this.opts.timeNotation ?? '24h';
    const label = (value: string, side: 'start' | 'end'): string =>
      value ? displayDateTime(taskDateLabel(task, value, side, cal), notation, clock) : '';
    return { start: label(shownStart(task), 'start'), finish: label(shownFinish(task), 'end') };
  }

  private drawStartDate(text: string, barLeft: number, textY: number): void {
    if (!text || barLeft - BAR_DATE_GAP <= 0) return;
    this.ctx.font = this.font('small');
    this.drawBarDateText(text, barLeft - BAR_DATE_GAP - this.ctx.measureText(text).width, textY);
  }

  private drawBarDateText(text: string, x: number, textY: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = this.font('small');
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = OUTSIDE_LABEL_KNOCKOUT;
    ctx.strokeStyle = this.colors.bg;
    ctx.strokeText(text, x, textY);
    ctx.fillStyle = this.colors.textSecondary;
    ctx.fillText(text, x, textY);
    ctx.restore();
  }

  private drawTaskBar(task: Task, y: number, height: number, isSelected: boolean, overrideColor?: string): number {
    const ctx = this.ctx;
    const geo = this.barGeometry(task);
    const { x1, x2 } = geo;

    const bandEnd = this.opts.showFloatBand !== false ? floatBandEnd(task) : null;
    const floatWidth = bandEnd ? Math.max(0, this.dateToX(bandEnd) - x2) : 0;
    if (x2 + floatWidth < 0 || x1 > this.opts.canvasWidth) return 0;

    const width = Math.max(x2 - x1, 4);
    const selection = this.opts.barColorSelection ?? { mode: 'critical' as const };
    const dark = this.opts.darkTheme === true;
    const modeAdvies = selection.mode === 'critical'
      ? null
      : computeBarColors(
          task,
          selection,
          this.barColorContext,
          {
            critical: this.colors.critical, normal: this.colors.normal,
            nearCritical: this.colors.nearCritical, milestone: this.colors.milestone,
            uncategorized: this.colors.ghost,
          } satisfies BarPalette,
          width,
        );
    const modeColor = modeAdvies && modeAdvies.kind === 'solid'
      ? this.categoryColor(modeAdvies.fill)
      : null;
    const modeSegments: { cx1: number; cx2: number; color: string }[] = [];
    if (!overrideColor && modeAdvies && modeAdvies.kind === 'segments') {
      let cx = x1;
      modeAdvies.segments.forEach((seg, si) => {
        const isLast = si === modeAdvies.segments.length - 1;
        const w = isLast ? x2 - cx : (x2 - x1) * seg.weight;
        modeSegments.push({ cx1: cx, cx2: cx + w, color: this.categoryColor(seg.color) });
        cx += w;
      });
    }

    const color = overrideColor ?? modeColor ?? this.barColor(task);

    let segs: { x1: number; x2: number }[] = [{ x1, x2 }];
    let split = false;
    if (task.splitGaps && task.splitGaps.length > 0) {
      const eng = this.splitEngine(task);
      const measure = geo.hourMode ? taskSplitMeasure(task, this.opts.workdayDurationMeasure ?? true) : false;
      const segments = computeSplitSegments(task.splitGaps, geo.start, geo.end, measure, eng);
      if (segments.length > 1) {
        segs = segments.map((s, i) => ({
          x1: i === 0 ? x1 : this.dateToX(s.start),
          x2: i === segments.length - 1 ? x2 : this.dateToX(s.end),
        }));
        split = true;
        this.splitSegmentsByTask.set(task.id, segs);
      }
    } else if (geo.hourMode && this.shouldSplit(isSelected)) {
      const eng = this.engineFor(task);
      const visFrom = Math.max(geo.start.getTime(), this.axis.xToDate(-this.opts.view.zoom).getTime() - MS_PER_DAY);
      const visTo = Math.min(geo.end.getTime(), this.axis.xToDate(this.opts.canvasWidth + this.opts.view.zoom).getTime() + MS_PER_DAY);
      const clipped = visFrom > geo.start.getTime() || visTo < geo.end.getTime();
      const intervals = eng && visTo > visFrom ? eng.workIntervalsBetween(new Date(visFrom), new Date(visTo)) : [];
      if (intervals.length > 0) {
        segs = intervals.map(iv => ({ x1: this.dateToX(iv.start), x2: this.dateToX(iv.end) }));
        if (intervals[0].start.getTime() <= visFrom && visFrom > geo.start.getTime()) segs[0].x1 = x1;
        const last = segs.length - 1;
        if (intervals[last].end.getTime() >= visTo && visTo < geo.end.getTime()) segs[last].x2 = x2;
        split = true;
      } else if (eng && clipped && visTo > visFrom) {
        const lx = this.dateToX(new Date(visFrom));
        const rx = this.dateToX(new Date(visTo));
        segs = [{ x1: lx, x2: lx }, { x1: rx, x2: rx }];
        split = true;
      }
    }

    if (split && segs.length > 1) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = ctx.globalAlpha * 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(segs[0].x2, y + height / 2);
      ctx.lineTo(segs[segs.length - 1].x1, y + height / 2);
      ctx.stroke();
      ctx.restore();
    }

    const completion = overrideColor ? 0 : task.time.completion;
    const isDone = completion >= 1;
    const greyTones = completion > 0 ? doneBarTones(color, dark) : null;
    const progressX = isDone ? Infinity : x1 + width * completion;
    const paintPiece = (px1: number, px2: number, base: string, roundLeft: boolean, roundRight: boolean): void =>
      paintProgressBarPiece(ctx, px1, px2, y, height, BAR_RADIUS, base, progressX, dark, roundLeft, roundRight);
    for (const s of segs) {
      const sw = Math.max(s.x2 - s.x1, split ? 2 : 4);
      if (modeSegments.length > 0) {
        for (let mi = 0; mi < modeSegments.length; mi++) {
          const ms = modeSegments[mi];
          const ox1 = Math.max(ms.cx1, s.x1);
          const ox2 = Math.min(ms.cx2, s.x2);
          if (ox2 - ox1 < 0.5) continue;
          paintPiece(ox1, ox2, ms.color, mi === 0 || ox1 > ms.cx1, mi === modeSegments.length - 1 || ox2 < ms.cx2);
        }
      } else {
        paintPiece(s.x1, s.x1 + sw, color, true, true);
      }
    }

    const outlineColor = overrideColor ? null : modeAdvies?.outline;
    if (outlineColor) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x1 - 0.75, y - 0.75, width + 1.5, height + 1.5, 3);
      ctx.stroke();
    }

    if (this.highContrast && !task.time.isCritical) {
      if (task.time.isNearCritical) {
        const hatch = getNearCriticalHatch(ctx);
        if (hatch) {
          ctx.fillStyle = hatch;
          for (const s of segs) {
            const sw = Math.max(s.x2 - s.x1, split ? 2 : 4);
            anchorPattern(hatch, s.x1, y);
            ctx.beginPath();
            ctx.roundRect(s.x1, y, sw, height, 3);
            ctx.fill();
          }
        }
      } else {
        ctx.strokeStyle = this.colors.text;
        ctx.lineWidth = 1.5;
        for (const s of segs) {
          const sw = Math.max(s.x2 - s.x1, split ? 2 : 4);
          ctx.beginPath();
          ctx.roundRect(s.x1 + 0.75, y + 0.75, sw - 1.5, height - 1.5, 3);
          ctx.stroke();
        }
      }
    }

    if (floatWidth > 0 && !isDone) {
      ctx.fillStyle = this.colors.float + '40';
      ctx.fillRect(x2, y + height / 4, floatWidth, height / 2);
      const hatch = getCrossHatch(ctx, this.colors.float + '40', FLOAT_HATCH_SIZE);
      if (hatch) {
        anchorPattern(hatch, x2, y + height / 4);
        ctx.fillStyle = hatch;
        ctx.fillRect(x2, y + height / 4, floatWidth, height / 2);
      }
    }

    if (isSelected) {
      ctx.strokeStyle = this.colors.selected;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x1 - 1, y - 1, width + 2, height + 2, 4);
      ctx.stroke();
    }

    let resourceAccentHeight = 0;
    if (this.opts.showResourceAccent) {
      const rows = assignmentsForTask(task.id, this.opts.resources ?? [], this.opts.assignments ?? []);
      if (rows.length > 0) {
        const total = rows.reduce((a, r) => a + r.unitsPerDay, 0) || 1;
        const accentH = this.bar.accentHeight;
        const accentY = y + height + 1;
        let ax = x1;
        rows.forEach((r, i) => {
          const isLast = i === rows.length - 1;
          const w = isLast ? x2 - ax : (x2 - x1) * (r.unitsPerDay / total);
          ctx.fillStyle = this.categoryColor(r.color);
          ctx.fillRect(ax, accentY, Math.max(w, 1), accentH);
          ax += w;
        });
        resourceAccentHeight = accentH;
      }
    }

    {
      const textY = y + height / 2;
      const labelBase = modeSegments.length > 0 ? modeSegments[0].color : color;
      const checkSize = Math.max(3, Math.round(height * 0.18));
      const checkW = checkSize * 2.2 + 5;
      const indent = isDone && greyTones ? checkW : 0;
      ctx.font = this.font('body');
      const fitsInside = width > 40 && ctx.measureText(task.name).width <= width - 10 - indent;
      const drawCheck = (cx: number): void => {
        if (!greyTones) return;
        ctx.save();
        ctx.strokeStyle = greyTones.text;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, textY);
        ctx.lineTo(cx + checkSize * 0.8, textY + checkSize * 0.8);
        ctx.lineTo(cx + checkSize * 2.2, textY - checkSize * 0.8);
        ctx.stroke();
        ctx.restore();
      };
      const dates = this.barDates(task);
      if (dates) this.drawStartDate(dates.start, x1, textY);
      if (fitsInside) {
        if (dates) this.drawOutsideBarName('', this.colors.text, x1 + width, textY, { finish: dates.finish, barLeft: x1 });
        if (isDone && greyTones) {
          drawCheck(x1 + 7);
          this.drawBarName(task.name, greyTones.text, x1, y, width, height, textY, indent);
        } else {
          const split = greyTones ? { x: progressX, color: greyTones.text } : undefined;
          this.drawBarName(task.name, barLabelColor(labelBase), x1, y, width, height, textY, 0, split);
        }
      } else {
        if (isDone && greyTones && width >= checkSize * 2.2 + 10) drawCheck(x1 + (width - checkSize * 2.2) / 2);
        this.drawOutsideBarName(task.name, isDone ? this.colors.textSecondary : this.colors.text, x1 + width, textY, dates && { finish: dates.finish, barLeft: x1 });
      }
    }
    return resourceAccentHeight;
  }

  private drawHammockBar(task: Task, y: number, height: number, isSelected: boolean, overrideColor?: string): void {
    const ctx = this.ctx;
    const { x1, x2 } = this.barGeometry(task);
    if (x2 < 0 || x1 >= this.opts.canvasWidth) return;

    const width = Math.max(x2 - x1, 4);
    const color = overrideColor ?? this.colors.hammock;
    const barY = y + height * 0.4;
    const barH = height * 0.2;
    const hook = height * 0.42;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x1, barY, width, barH, 1);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1 + 1, barY);
    ctx.lineTo(x1 + 1, barY + hook);
    ctx.moveTo(x2 - 1, barY);
    ctx.lineTo(x2 - 1, barY + hook);
    ctx.stroke();

    if (isSelected) {
      ctx.strokeStyle = this.colors.selected;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x1 - 1, y - 1, width + 2, height + 2, 4);
      ctx.stroke();
    }

    const dates = this.barDates(task);
    if (dates) this.drawStartDate(dates.start, x1, y + height / 2);
    this.drawOutsideBarName(task.name, this.colors.text, x1 + width, y + height / 2, dates && { finish: dates.finish, barLeft: x1 });
  }

  private drawSummaryBar(task: Task, y: number, height: number, isSelected: boolean, overrideColor?: string): void {
    const ctx = this.ctx;
    const { x1, x2 } = this.barGeometry(task);

    if (x2 < 0 || x1 >= this.opts.canvasWidth) return;

    const width = Math.max(x2 - x1, 4);
    const barY = y + height * 0.3;
    const barH = height * 0.4;

    const base = overrideColor ?? this.colors.summary;
    const completion = overrideColor ? 0 : Math.max(0, Math.min(1, task.time.completion || 0));
    const progressX = completion >= 1 ? Infinity : completion > 0 ? x1 + width * completion : -Infinity;
    const dark = this.opts.darkTheme === true;
    const grey = completion > 0 ? doneBarTones(base, dark).fill : base;
    paintProgressBarPiece(ctx, x1, x1 + width, barY, barH, 2, base, progressX, dark);

    ctx.fillStyle = completion > 0 ? grey : base;
    ctx.beginPath();
    ctx.moveTo(x1, barY);
    ctx.lineTo(x1, barY + barH + 4);
    ctx.lineTo(x1 + 6, barY + barH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = completion >= 1 ? grey : base;
    ctx.beginPath();
    ctx.moveTo(x1 + width, barY);
    ctx.lineTo(x1 + width, barY + barH + 4);
    ctx.lineTo(x1 + width - 6, barY + barH);
    ctx.closePath();
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = this.colors.selected;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1 - 1, barY - 1, width + 2, barH + 6);
    }

    const dates = this.barDates(task);
    if (dates) this.drawStartDate(dates.start, x1, y + height / 2);
    this.drawOutsideBarName(task.name, completion >= 1 ? this.colors.textSecondary : this.colors.text, x1 + width, y + height / 2, dates && { finish: dates.finish, barLeft: x1 });
  }

  private milestoneAnchorX(task: Task): number | null {
    return milestoneAnchorX(this.groupLead(task), date => this.dateToX(date), this.opts.view.zoom);
  }

  private groupLead(task: Task): Task {
    return this.milestoneGroups.get(task.id)?.[0] ?? task;
  }

  getMilestoneGroup(taskId: string): readonly Task[] | null {
    return this.milestoneGroups.get(taskId) ?? null;
  }

  private milestoneGrab(task: Task): { x: number; half: number } | null {
    const x = this.milestoneAnchorX(task);
    if (x === null) return null;
    return { x, half: Math.max(6, this.bar.barHeight * 0.4) };
  }

  private drawMilestoneRun(tasks: readonly Task[], y: number, height: number): void {
    const placed = tasks
      .filter(task => this.groupLead(task) === task)
      .map(task => ({ task, x: this.milestoneAnchorX(task) }))
      .filter((p): p is { task: Task; x: number } => p.x !== null)
      .sort((a, b) => a.x - b.x);
    const size = height * 0.4;
    const selected = this.opts.selectedTaskIds;
    placed.forEach(({ task, x }, k) => {
      const next = placed[k + 1];
      const room = next ? next.x - size - 4 - (x + size + 6) : Infinity;
      const group = this.milestoneGroups.get(task.id);
      const members = group ?? [task];
      const roles = members.map(member => classifyTraceTask(this.opts.trace, member.id));
      const shown = roles.findIndex(role => role !== 'dimmed');
      if (shown < 0) this.ctx.globalAlpha = 0.25;
      const look = members.find(member => member.time.isCritical) ?? task;
      this.drawMilestone(look, y, height, members.some(member => selected.includes(member.id)),
        this.traceOverrideColor(roles[Math.max(0, shown)]), room, group);
      this.ctx.globalAlpha = 1;
    });
  }

  private traceOverrideColor(traceRole: ReturnType<typeof classifyTraceTask>): string | undefined {
    if (traceRole === 'predecessor-driving') return this.colors.tracePredDriving;
    if (traceRole === 'predecessor') return this.colors.tracePred;
    if (traceRole === 'successor-driving') return this.colors.traceSuccDriving;
    if (traceRole === 'successor') return this.colors.traceSucc;
    return undefined;
  }

  private drawMilestone(task: Task, y: number, height: number, isSelected: boolean, overrideColor?: string, labelRoom = Infinity,
    group?: readonly Task[]): void {
    const ctx = this.ctx;
    const x = this.milestoneAnchorX(task);
    if (x === null) return;
    const cy = y + height / 2;
    const size = height * 0.4;

    const diamond = (s: number) => {
      ctx.beginPath();
      ctx.moveTo(x, cy - s);
      ctx.lineTo(x + s, cy);
      ctx.lineTo(x, cy + s);
      ctx.lineTo(x - s, cy);
      ctx.closePath();
    };

    const selection = this.opts.barColorSelection ?? { mode: 'critical' as const };
    const advice = selection.mode === 'critical'
      ? null
      : computeBarColors(task, selection, this.barColorContext, {
          critical: this.colors.critical,
          normal: this.colors.normal,
          nearCritical: this.colors.nearCritical,
          milestone: this.colors.milestone,
          uncategorized: this.colors.ghost,
        });
    const milestoneFill = advice?.kind === 'segments' ? advice.segments[0].color : advice?.fill;
    ctx.fillStyle = overrideColor ?? (milestoneFill
      ? this.categoryColor(milestoneFill)
      : ensureThemeVisible(this.colors.milestone, this.opts.darkTheme === true));
    diamond(size);
    ctx.fill();

    if (!overrideColor && advice?.outline) {
      ctx.strokeStyle = advice.outline;
      ctx.lineWidth = 1.5;
      diamond(size);
      ctx.stroke();
    }

    if (task.mandatory) {
      ctx.fillStyle = this.colors.bg;
      diamond(size * 0.45);
      ctx.fill();
    }

    if (isSelected) {
      ctx.strokeStyle = this.colors.selected;
      ctx.lineWidth = 2;
      diamond(size);
      ctx.stroke();
    }

    const labelStart = x + size + 6;
    let labelX = labelStart;
    if (group) {
      const count = String(group.length);
      ctx.fillStyle = this.colors.text;
      ctx.font = this.font('body');
      ctx.textBaseline = 'middle';
      ctx.fillText(count, labelX, cy);
      labelX += ctx.measureText(count).width + 4;
    }
    const dates = this.barDates(task);
    const date = dates && (dates.finish || dates.start);
    if (date) {
      ctx.font = this.font('small');
      const dateWidth = ctx.measureText(date).width;
      if (dateWidth <= labelRoom) {
        this.drawBarDateText(date, labelX, cy);
        labelX += dateWidth + BAR_DATE_GAP;
      }
    }
    ctx.fillStyle = this.colors.text;
    ctx.font = this.font('body');
    ctx.textBaseline = 'middle';
    const name = group ? group.map(member => member.name).join(', ') : task.name;
    const msLabel = this.ellipsize(name, Math.min(200, this.opts.canvasWidth - labelX - 4, labelRoom - (labelX - labelStart)));
    if (msLabel) ctx.fillText(msLabel, labelX, cy);
  }

  private drawExternalGhosts(task: Task, y: number, height: number): void {
    const links = task.externalLinks;
    if (!links || links.length === 0) return;
    const ctx = this.ctx;
    const ghostW = Math.max(this.opts.view.zoom * 1.5, 28);
    const gh = height * 0.72;
    const gy = y + (height - gh) / 2;
    const chartLeft = 0;

    for (const link of links) {
      const anchorStr = link.anchorDate;
      if (!anchorStr) continue;
      const anchor = anchorStr.includes('T') ? parseInstant(anchorStr) : parseDate(anchorStr);
      if (isNaN(anchor.getTime())) continue;
      const ax = this.dateToX(anchor);
      const gx1 = link.direction === 'predecessor' ? ax - ghostW : ax;
      if (gx1 + ghostW < chartLeft || gx1 > this.opts.canvasWidth) continue;

      ctx.save();
      ctx.beginPath();
      ctx.rect(chartLeft, this.opts.headerHeight, this.opts.canvasWidth - chartLeft, this.opts.canvasHeight - this.opts.headerHeight);
      ctx.clip();
      ctx.fillStyle = this.colors.ghost + '40';
      ctx.beginPath();
      ctx.roundRect(gx1, gy, ghostW, gh, 2);
      ctx.fill();
      ctx.strokeStyle = this.colors.ghost;
      ctx.lineWidth = 1;
      if (link.sourceMissing) ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.roundRect(gx1 + 0.5, gy + 0.5, ghostW - 1, gh - 1, 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (link.sourceMissing) {
        const label = this.opts.externalStaleLabel ?? 'verouderd';
        ctx.font = this.font('caption');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(label).width + 6;
        const bx = gx1 + Math.max((ghostW - tw) / 2, 0);
        const by = gy - 13;
        ctx.fillStyle = this.colors.critical;
        ctx.beginPath();
        ctx.roundRect(bx, by, tw, 12, 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, bx + 3, by + 6.5);
        ctx.textAlign = 'start';
      }
      ctx.restore();
    }
  }

  private drawConstraintMarkers(task: Task, y: number): void {
    const ctx = this.ctx;
    const chartLeft = 0;

    const c = task.constraint;
    if (c && c.type !== 'ASAP' && c.type !== 'ALAP') {
      const start = parseDate(shownStart(task));
      const end = parseDate(shownFinish(task));
      const startSide = c.type === 'SNET' || c.type === 'SNLT' || c.type === 'MSO';
      const px = startSide ? this.dateToX(start) : this.dateToX(end) + this.opts.view.zoom;
      if (px >= chartLeft && px <= this.opts.canvasWidth) {
        const earlySide = c.type === 'SNET' || c.type === 'FNET';
        const violated = this.violatedSet.has(task.id);
        ctx.fillStyle = violated
          ? this.colors.critical
          : earlySide ? this.colors.constraintEarly : this.colors.constraintLate;
        if (c.hard && (c.type === 'MSO' || c.type === 'MFO')) {
          ctx.strokeStyle = ctx.fillStyle as string;
          ctx.lineWidth = 1.5;
          const hy = y - 7;
          ctx.beginPath();
          ctx.moveTo(px, hy + 2);
          ctx.lineTo(px, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(px, hy, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const cy = y - 1;
          ctx.beginPath();
          ctx.moveTo(px, cy - 4);
          ctx.lineTo(px + 4, cy);
          ctx.lineTo(px, cy + 4);
          ctx.lineTo(px - 4, cy);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    if (task.deadline) {
      const d = parseDate(task.deadline);
      if (!isNaN(d.getTime())) {
        const dx = this.dateToX(d) + this.opts.view.zoom;
        if (dx >= chartLeft && dx <= this.opts.canvasWidth) {
          const missed = this.missedDeadlineSet.has(task.id);
          ctx.fillStyle = missed ? this.colors.critical : this.colors.deadlineOk;
          ctx.beginPath();
          ctx.moveTo(dx - 5, y - 2);
          ctx.lineTo(dx + 5, y - 2);
          ctx.lineTo(dx, y + 5);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  private drawNotesIndicator(task: Task, y: number): void {
    const notes = task.notes;
    if (!notes || !notes.some(n => !n.done)) return;
    const ctx = this.ctx;
    const chartLeft = 0;
    const end = parseDate(shownFinish(task));
    const px = this.dateToX(end) + this.opts.view.zoom;
    if (px < chartLeft || px > this.opts.canvasWidth) return;
    ctx.fillStyle = this.colors.textSecondary;
    ctx.beginPath();
    ctx.arc(px - 6, y - 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private static readonly DRAG_BADGE_PAD_X = 5;
  private static readonly DRAG_BADGE_H = 16;
  private static readonly DRAG_BADGE_GAP = 4;

  private dragDurationText(task: Task): string {
    const sfx = this.opts.durationSuffixes ?? DEFAULT_DURATION_SUFFIXES;
    const startStr = shownStart(task) || '';
    const endStr = shownFinish(task) || '';
    const hourMode = startStr.includes('T') || endStr.includes('T');
    if (hourMode) {
      const cal = this.opts.effectiveCalById?.get(task.id) ?? this.opts.calendar;
      const hoursPerDay = durationHoursPerDay(task, effHoursPerDay(cal));
      const minutes = task.time.durationMinutes
        ?? (taskDurationUnit(task) === 'hours' ? 0 : Math.round(task.time.scheduleDuration * hoursPerDay * 60));
      return formatDuration(minutes, hoursPerDay, this.opts.durationDisplay ?? 'auto', sfx);
    }
    return this.durationText(task);
  }

  private drawDragDurationBadge(): void {
    const drag = this.opts.durationDrag;
    if (!drag) return;
    const rowIndex = this.rowIndexByTask.get(drag.taskId);
    if (rowIndex === undefined) return;
    const row = this.rows[rowIndex];
    if (row?.kind !== 'task') return;
    const task = row.task;

    const { headerHeight, canvasHeight, canvasWidth } = this.opts;
    const { barHeight, barOffset } = this.bar;
    const barY = this.rowToY(rowIndex) + barOffset;
    if (barY + barHeight < headerHeight || barY > canvasHeight) return;

    const h = GanttRenderer.DRAG_BADGE_H;
    const gap = GanttRenderer.DRAG_BADGE_GAP;
    const label = this.dragDurationText(task);

    this.ctx.save();
    const w = this.pillWidth(label);

    const { x1, x2 } = this.barGeometry(task);
    let x: number;
    if (drag.edge === 'right') {
      x = x2 - gap - w;
      if (x < x1 + 2) x = x2 + gap;
    } else {
      x = x1 - gap - w;
      if (x < 2) x = x1 + gap;
    }
    const lo = 2;
    const hi = canvasWidth - w - 2;
    x = hi < lo ? lo : Math.min(Math.max(x, lo), hi);
    const y = barY + (barHeight - h) / 2;

    this.drawPill(label, x, y, w, h / 2, this.colors.selected, 1.5);
    this.ctx.restore();
  }

  private static readonly ARROW_PAD = 3;
  private static readonly ARROW_STUB = 8;
  private static readonly ARROW_STUB_TIGHT = 4;
  private readonly arrowPts: number[] = new Array(16).fill(0);

  private buildRowObstacles(): RowObstacles {
    const { rowHeight, headerHeight, canvasHeight, view } = this.opts;
    const n = this.rows.length;
    const first = Math.max(0, Math.ceil(view.scrollY / rowHeight) - 2);
    const last = Math.min(n - 1, Math.ceil((canvasHeight - headerHeight + view.scrollY) / rowHeight) + 1);
    if (last < first) return { r0: 0, r1: -1, x1: EMPTY_SPANS, x2: EMPTY_SPANS };

    const len = last - first + 1;
    const x1 = new Float64Array(len).fill(Infinity);
    const x2 = new Float64Array(len).fill(-Infinity);
    for (let i = first; i <= last; i++) {
      const row = this.rows[i];
      if (row.kind === 'group') continue;
      if (row.kind === 'milestones') {
        for (const task of row.tasks) {
          const anchor = this.milestoneAnchorX(task);
          if (anchor === null) continue;
          x1[i - first] = Math.min(x1[i - first], anchor - 6);
          x2[i - first] = Math.max(x2[i - first], anchor + 6);
        }
        continue;
      }
      const geo = this.barGeometry(row.task);
      const pad = isZeroDurationMilestone(row.task) ? 6 : GanttRenderer.ARROW_PAD;
      x1[i - first] = geo.x1 - pad;
      x2[i - first] = geo.x2 + pad;
    }
    return { r0: first, r1: last, x1, x2 };
  }

  private isColumnFree(obs: RowObstacles, x: number, a: number, b: number): boolean {
    const lo = Math.max(Math.min(a, b) + 1, obs.r0);
    const hi = Math.min(Math.max(a, b) - 1, obs.r1);
    for (let i = lo; i <= hi; i++) {
      const k = i - obs.r0;
      if (x > obs.x1[k] && x < obs.x2[k]) return false;
    }
    return true;
  }

  private pickColumn(obs: RowObstacles, prefer: number, alt: number, a: number, b: number): number {
    if (this.isColumnFree(obs, prefer, a, b)) return prefer;
    if (this.isColumnFree(obs, alt, a, b)) return alt;

    const lo = Math.min(prefer, alt);
    const hi = Math.max(prefer, alt);
    if (hi - lo < 2) return prefer;
    const rLo = Math.max(Math.min(a, b) + 1, obs.r0);
    const rHi = Math.min(Math.max(a, b) - 1, obs.r1);

    const spans: { a: number; b: number }[] = [];
    for (let i = rLo; i <= rHi; i++) {
      const k = i - obs.r0;
      if (obs.x2[k] > lo && obs.x1[k] < hi) spans.push({ a: obs.x1[k], b: obs.x2[k] });
    }
    spans.sort((p, q) => p.a - q.a);

    let best = NaN;
    let bestDist = Infinity;
    const consider = (from: number, to: number): void => {
      if (to - from < 1) return;
      const c = Math.min(Math.max(prefer, from), to);
      const d = Math.abs(c - prefer);
      if (d < bestDist) { bestDist = d; best = c; }
    };
    let cursor = lo;
    for (const s of spans) {
      if (s.a > cursor) consider(cursor, Math.min(s.a, hi));
      if (s.b > cursor) cursor = s.b;
      if (cursor >= hi) break;
    }
    if (cursor < hi) consider(cursor, hi);
    return Number.isNaN(best) ? prefer : best;
  }

  private static readonly ARROW_CLIP_MARGIN = 16;

  private strokeArrowPath(pts: number[], n: number): void {
    const ctx = this.ctx;
    const m = GanttRenderer.ARROW_CLIP_MARGIN;
    const minX = -m, minY = -m;
    const maxX = this.opts.canvasWidth + m, maxY = this.opts.canvasHeight + m;
    let inside = true;
    for (let i = 0; i < n; i += 2) {
      const x = pts[i], y = pts[i + 1];
      if (x < minX || x > maxX || y < minY || y > maxY) { inside = false; break; }
    }
    if (inside) {
      ctx.beginPath();
      let px = pts[0];
      let py = pts[1];
      ctx.moveTo(px, py);
      for (let i = 2; i < n; i += 2) {
        const x = pts[i];
        const y = pts[i + 1];
        if (x === px && y === py) continue;
        ctx.lineTo(x, y);
        px = x;
        py = y;
      }
      ctx.stroke();
      return;
    }

    let travelled = 0;
    let runOpen = false;
    let endX = 0, endY = 0;
    for (let i = 2; i < n; i += 2) {
      const x0 = pts[i - 2], y0 = pts[i - 1], x1 = pts[i], y1 = pts[i + 1];
      const dx = x1 - x0, dy = y1 - y0;
      if (dx === 0 && dy === 0) continue;
      const len = Math.hypot(dx, dy);
      let t0 = 0, t1 = 1;
      const edge = (p: number, q: number): boolean => {
        if (p === 0) return q >= 0;
        const r = q / p;
        if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
        return true;
      };
      const visible = edge(-dx, x0 - minX) && edge(dx, maxX - x0) && edge(-dy, y0 - minY) && edge(dy, maxY - y0) && t1 > t0;
      if (visible) {
        const sx = x0 + t0 * dx, sy = y0 + t0 * dy;
        const ex = x0 + t1 * dx, ey = y0 + t1 * dy;
        if (!runOpen || sx !== endX || sy !== endY) {
          if (runOpen) ctx.stroke();
          ctx.beginPath();
          ctx.lineDashOffset = travelled + t0 * len;
          ctx.moveTo(sx, sy);
          runOpen = true;
        }
        ctx.lineTo(ex, ey);
        endX = ex;
        endY = ey;
        if (t1 < 1) { ctx.stroke(); runOpen = false; }
      } else if (runOpen) {
        ctx.stroke();
        runOpen = false;
      }
      travelled += len;
    }
    if (runOpen) ctx.stroke();
    ctx.lineDashOffset = 0;
  }

  private relationAnchorX(task: Task, atStart: boolean): number {
    task = this.groupLead(task);
    const start = shownStart(task);
    const finish = shownFinish(task);
    if ((start ?? '').includes('T') || (finish ?? '').includes('T')) {
      const geo = this.barGeometry(task);
      return atStart ? geo.x1 : geo.x2;
    }
    return atStart
      ? this.dateToX(parseDate(start))
      : this.dateToX(parseDate(finish)) + this.opts.view.zoom;
  }

  private drawDependencyArrows(): void {
    const ctx = this.ctx;
    ctx.lineWidth = 1;
    if (this.opts.sequences.length === 0) return;
    const obs = this.buildRowObstacles();

    const drivingSet = this.opts.drivingSequenceIds ? new Set(this.opts.drivingSequenceIds) : null;

    const trace = this.opts.trace;

    const rowH = this.opts.rowHeight;
    const canvasH = this.opts.canvasHeight;
    const cullMargin = rowH / 2 + 8;
    const rightCull = this.opts.canvasWidth + GanttRenderer.ARROW_STUB + 8;
    for (const { seq, predIdx, succIdx, loIdx, hiIdx, pred, succ } of cachedArrowEntries(this.opts.sequences, this.rows, this.rowIndexByTask)) {
      const group = this.milestoneGroups.get(pred.id);
      if (group && group === this.milestoneGroups.get(succ.id)) continue;
      if (this.rowToY(hiIdx) + rowH / 2 < -cullMargin || this.rowToY(loIdx) + rowH / 2 > canvasH + cullMargin) continue;

      const isDriving = drivingSet ? drivingSet.has(seq.id) : true;
      const isCriticalLink = drivingSet !== null && isDriving
        && pred.time.isCritical && succ.time.isCritical;
      const color = isCriticalLink ? this.colors.critical : this.colors.dependency;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      const outsideTrace = isRelationOutsideTrace(trace, seq.predecessorId, seq.successorId);
      ctx.setLineDash(outsideTrace ? [1, 4] : isDriving ? [] : [4, 3]);
      ctx.globalAlpha = outsideTrace ? 0.15 : 1;

      const predY = this.rowToY(predIdx) + rowH / 2;
      const succY = this.rowToY(succIdx) + rowH / 2;

      let fromX: number, toX: number, dirOut: number, dirIn: number;
      const predStart = seq.type === 'START_START' || seq.type === 'START_FINISH';
      const succFinish = seq.type === 'FINISH_FINISH' || seq.type === 'START_FINISH';
      fromX = this.relationAnchorX(pred, predStart);
      toX = this.relationAnchorX(succ, !succFinish);
      dirOut = predStart ? -1 : 1;
      dirIn = succFinish ? 1 : -1;

      if (fromX < 0 && toX < 0) continue;
      if (Math.min(fromX, toX) > rightCull) continue;

      const tight = Math.abs(toX - fromX) < 2 * GanttRenderer.ARROW_STUB;
      const stub = tight ? GanttRenderer.ARROW_STUB_TIGHT : GanttRenderer.ARROW_STUB;
      const xa = fromX + dirOut * stub;
      const enter = toX + dirIn * stub;

      const pts = this.arrowPts;
      let n = 0;
      const elbowOk = dirIn < 0 ? xa <= enter : xa >= enter;
      if (elbowOk && this.isColumnFree(obs, xa, predIdx, succIdx)) {
        pts[n++] = fromX; pts[n++] = predY;
        pts[n++] = xa;    pts[n++] = predY;
        pts[n++] = xa;    pts[n++] = succY;
        pts[n++] = toX;   pts[n++] = succY;
      } else {
        const down = succIdx >= predIdx;
        const predTop = predY - rowH / 2;
        const succTop = succY - rowH / 2;
        const laneP = down ? predTop + rowH : predTop;
        const laneS = down ? succTop : succTop + rowH;
        const col = laneP === laneS ? enter : this.pickColumn(obs, enter, xa, predIdx, succIdx);
        pts[n++] = fromX; pts[n++] = predY;
        pts[n++] = xa;    pts[n++] = predY;
        pts[n++] = xa;    pts[n++] = laneP;
        pts[n++] = col;   pts[n++] = laneP;
        pts[n++] = col;   pts[n++] = laneS;
        pts[n++] = enter; pts[n++] = laneS;
        pts[n++] = enter; pts[n++] = succY;
        pts[n++] = toX;   pts[n++] = succY;
      }
      this.strokeArrowPath(pts, n);

      if (succY < -8 || succY > canvasH + 8 || toX < -8 || toX > this.opts.canvasWidth + 8) continue;
      ctx.beginPath();
      ctx.moveTo(toX, succY);
      ctx.lineTo(toX + dirIn * 5, succY - 3);
      ctx.lineTo(toX + dirIn * 5, succY + 3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }


  getRowAtY(canvasY: number): ViewRow | null {
    return this.rows[this.getRowIndex(canvasY)] ?? null;
  }

  getTaskAtY(canvasY: number): Task | null {
    const row = this.getRowAtY(canvasY);
    return row?.kind === 'task' ? row.task : null;
  }

  getTaskAt(canvasX: number, canvasY: number): Task | null {
    const row = this.getRowAtY(canvasY);
    if (row?.kind === 'task') return row.task;
    if (row?.kind !== 'milestones') return null;
    let best: Task | null = null;
    let bestDist = Infinity;
    for (const task of row.tasks) {
      const grab = this.milestoneGrab(task);
      if (!grab) continue;
      const dist = Math.abs(canvasX - grab.x);
      if (dist <= grab.half && dist < bestDist) { best = task; bestDist = dist; }
    }
    return best && this.groupLead(best);
  }

  getTaskNameAt(canvasX: number, canvasY: number): Task | null {
    const rowIndex = this.getRowIndex(canvasY);
    const row = this.rows[rowIndex];
    if (row?.kind !== 'task') return null;
    const task = row.task;
    const span = this.outsideNameSpans.get(rowIndex);
    return span && canvasX >= span.left && canvasX <= span.right && canvasY >= span.top && canvasY <= span.bottom
      ? task : null;
  }

  getRowIndex(canvasY: number): number {
    return Math.floor((canvasY - this.opts.headerHeight + this.opts.view.scrollY) / this.opts.rowHeight);
  }

  getRowsInYRange(y1: number, y2: number): ViewRow[] {
    const lo = Math.max(0, this.getRowIndex(Math.min(y1, y2)));
    const hi = Math.min(this.rows.length - 1, this.getRowIndex(Math.max(y1, y2)));
    return hi < lo ? [] : this.rows.slice(lo, hi + 1);
  }

  getTaskBarRect(taskId: string): { left: number; right: number; top: number; bottom: number } | null {
    const rowIndex = this.rowIndexByTask.get(taskId);
    if (rowIndex === undefined) return null;
    const row = this.rows[rowIndex];
    const task = row?.kind === 'task' ? row.task : row?.kind === 'milestones' ? row.tasks.find(t => t.id === taskId) : undefined;
    if (!task || isSummaryTask(task)) return null;
    const { barHeight, barOffset } = this.bar;
    const top = this.rowToY(rowIndex) + barOffset;
    if (isZeroDurationMilestone(task)) {
      const grab = this.milestoneGrab(task);
      return grab && { left: grab.x - grab.half, right: grab.x + grab.half, top, bottom: top + barHeight };
    }
    if (!shownStart(task) || !shownFinish(task)) {
      return null;
    }
    const { x1, x2 } = this.barGeometry(task);
    return {
      left: x1,
      right: x1 + Math.max(x2 - x1, 4),
      top,
      bottom: top + barHeight,
    };
  }

  getDrawnSegmentCount(taskId: string): number | null {
    const segs = this.splitSegmentsByTask.get(taskId);
    if (segs) return segs.length;
    return this.getTaskBarRect(taskId) ? 1 : null;
  }

  getTaskBarBounds(canvasX: number, canvasY: number): {
    task: Task; edge: 'left' | 'right' | 'body'; segmentIndex: number; segmentCount: number;
  } | null {
    if (canvasX < 0 || canvasX >= this.opts.canvasWidth) return null;
    const task = this.getTaskAt(canvasX, canvasY);
    if (!task || isSummaryTask(task)) return null;
    if (isZeroDurationMilestone(task)) {
      const grab = this.milestoneGrab(task);
      return grab && Math.abs(canvasX - grab.x) <= grab.half
        ? { task, edge: 'body', segmentIndex: 0, segmentCount: 1 }
        : null;
    }
    if (!shownStart(task) || !shownFinish(task)) {
      return null;
    }
    const edgeZone = 6;

    const segs = this.drawnSplitSegments(task);
    if (segs) {
      const count = segs.length;
      for (let i = 0; i < count; i++) {
        const { x1, x2 } = segs[i];
        const inner = Math.min(edgeZone, (x2 - x1) / 3);
        const lo = i === 0 ? x1 - edgeZone : x1;
        if (canvasX < lo || canvasX > x2 + edgeZone) continue;
        if (i === 0 && canvasX <= x1 + inner) return { task, edge: 'left', segmentIndex: 0, segmentCount: count };
        if (canvasX >= x2 - inner) return { task, edge: 'right', segmentIndex: i, segmentCount: count };
        return { task, edge: 'body', segmentIndex: i, segmentCount: count };
      }
      return null;
    }

    const { x1, x2 } = this.barGeometry(task);

    if (canvasX >= x1 - edgeZone && canvasX <= x2 + edgeZone) {
      if (canvasX <= x1 + edgeZone) return { task, edge: 'left', segmentIndex: 0, segmentCount: 1 };
      if (canvasX >= x2 - edgeZone) return { task, edge: 'right', segmentIndex: 0, segmentCount: 1 };
      return { task, edge: 'body', segmentIndex: 0, segmentCount: 1 };
    }
    return null;
  }

  getSplitGapAt(canvasX: number, canvasY: number): { task: Task; gapIndex: number; segmentCount: number } | null {
    if (canvasX < 0 || canvasX >= this.opts.canvasWidth) return null;
    const task = this.getTaskAt(canvasX, canvasY);
    if (!task || task.childIds.length > 0 || isZeroDurationMilestone(task)) return null;
    const segs = this.drawnSplitSegments(task);
    if (!segs || this.getTaskBarBounds(canvasX, canvasY)) return null;
    for (let i = 0; i < segs.length - 1; i++) {
      if (canvasX > segs[i].x2 && canvasX < segs[i + 1].x1) return { task, gapIndex: i, segmentCount: segs.length };
    }
    return null;
  }

  private drawnSplitSegments(task: Task): { x1: number; x2: number }[] | null {
    if (!task.splitGaps || task.splitGaps.length === 0) return null;
    const segs = this.splitSegmentsByTask.get(task.id);
    return segs && segs.length > 1 ? segs : null;
  }

  getRelationSourceAt(canvasX: number, canvasY: number): Task | null {
    if (canvasX < 0 || canvasX >= this.opts.canvasWidth) return null;
    const task = this.getTaskAt(canvasX, canvasY);
    if (!task) return null;

    const hasStart = !!shownStart(task);
    const hasFinish = !!shownFinish(task);

    if (hasStart !== hasFinish && isZeroDurationMilestone(task)) {
      const x = this.milestoneAnchorX(task);
      if (x === null) return null;
      const grab = 6;
      return canvasX >= x - grab && canvasX <= x + grab ? task : null;
    }

    if (!hasStart || !hasFinish) {
      return null;
    }

    const { x1, x2 } = this.barGeometry(task);
    const grab = 6;
    return canvasX >= x1 - grab && canvasX <= x2 + grab ? task : null;
  }
}
