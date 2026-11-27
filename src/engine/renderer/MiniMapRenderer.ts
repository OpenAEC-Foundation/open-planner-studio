import { parseDate, diffCalendarDays } from '@/utils/dateUtils';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';
import { readMiniMapPalette, type MiniMapPalette } from './themePalette';
import { shownStart, shownFinish } from '@/utils/taskDates';

export interface MiniMapOptions {
  rows: ViewRow[];
  canvasWidth: number;
  canvasHeight: number;
  originDate: string;
  scrollX: number;
  zoom: number;
  chartWidth: number;
  axisDayOf?: (date: Date) => number;
  palette?: MiniMapPalette;
}

interface Span { startDay: number; endDay: number; span: number }

type DayOf = (date: Date) => number;

function taskDays(task: Task, dayOf: DayOf): { startDay: number; endDay: number } | null {
  const s = shownStart(task);
  if (!s) return null;
  const f = shownFinish(task) || s;
  return {
    startDay: dayOf(parseDate(s)),
    endDay: dayOf(parseDate(f)) + 1,
  };
}

function rowDays(row: ViewRow, dayOf: DayOf): { startDay: number; endDay: number } | null {
  if (row.kind === 'task') return taskDays(row.task, dayOf);
  if (row.kind !== 'milestones') return null;
  let out: { startDay: number; endDay: number } | null = null;
  for (const task of row.tasks) {
    const days = taskDays(task, dayOf);
    if (!days) continue;
    out = out ? { startDay: Math.min(out.startDay, days.startDay), endDay: Math.max(out.endDay, days.endDay) } : days;
  }
  return out;
}

function projectSpan(rows: ViewRow[], dayOf: DayOf): Span | null {
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    const days = rowDays(row, dayOf);
    if (!days) continue;
    if (days.startDay < min) min = days.startDay;
    if (days.endDay > max) max = days.endDay;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
  return { startDay: min, endDay: max, span: max - min };
}

interface Layout { days: Array<{ startDay: number; endDay: number } | null>; span: Span | null }
const layoutCache = new WeakMap<ViewRow[], { originDate: string; axisDayOf: DayOf | undefined; layout: Layout }>();
function layoutFor(rows: ViewRow[], originDate: string, axisDayOf: DayOf | undefined): Layout {
  const cacheable = Object.isFrozen(rows);
  const hit = cacheable ? layoutCache.get(rows) : undefined;
  if (hit && hit.originDate === originDate && hit.axisDayOf === axisDayOf) return hit.layout;
  const origin = parseDate(originDate);
  const dayOf: DayOf = axisDayOf ?? ((date) => diffCalendarDays(origin, date));
  const layout: Layout = {
    days: rows.map((row) => rowDays(row, dayOf)),
    span: projectSpan(rows, dayOf),
  };
  if (cacheable) layoutCache.set(rows, { originDate, axisDayOf, layout });
  return layout;
}

export class MiniMapRenderer {
  private ctx: CanvasRenderingContext2D;
  private opts: MiniMapOptions;
  private span: Span | null;
  private days: Layout['days'];

  constructor(ctx: CanvasRenderingContext2D, opts: MiniMapOptions) {
    this.ctx = ctx;
    this.opts = opts;
    const layout = layoutFor(opts.rows, opts.originDate, opts.axisDayOf);
    this.span = layout.span;
    this.days = layout.days;
  }

  private dayToMiniX(day: number): number {
    if (!this.span) return 0;
    return ((day - this.span.startDay) / this.span.span) * this.opts.canvasWidth;
  }

  miniXToDay(x: number): number | null {
    if (!this.span) return null;
    return this.span.startDay + (x / this.opts.canvasWidth) * this.span.span;
  }

  render(): void {
    const { canvasWidth, canvasHeight, rows } = this.opts;
    const ctx = this.ctx;
    const colors = this.opts.palette ?? readMiniMapPalette();

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (this.span) {
      const taskRowCount = rows.length;
      const miniRowH = taskRowCount > 0 ? canvasHeight / taskRowCount : canvasHeight;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.kind === 'group') continue;
        const days = this.days[i];
        if (!days) continue;
        const x0 = this.dayToMiniX(days.startDay);
        const x1 = this.dayToMiniX(days.endDay);
        const y = i * miniRowH;
        const critical = row.kind === 'task' ? row.task.time.isCritical : row.tasks.some(t => t.time.isCritical);
        ctx.fillStyle = critical ? colors.critical : colors.bar;
        ctx.fillRect(x0, y, Math.max(1, x1 - x0), Math.max(1, miniRowH - 1));
      }

      const frame = this.frameBounds();
      if (frame) {
        ctx.strokeStyle = colors.frame;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(frame.x + 0.75, 0.75, frame.w - 1.5, canvasHeight - 1.5);
        ctx.fillStyle = colors.frame + '14';
        ctx.fillRect(frame.x, 0, frame.w, canvasHeight);
      }
    }

    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(canvasWidth, 0.5);
    ctx.stroke();
  }

  frameBounds(): { x: number; w: number } | null {
    if (!this.span || this.opts.zoom <= 0 || this.opts.chartWidth <= 0) return null;
    const { canvasWidth } = this.opts;
    const fw = Math.min(canvasWidth, Math.max(6, (this.opts.chartWidth / this.opts.zoom / this.span.span) * canvasWidth));
    const fx = Math.max(0, Math.min(this.dayToMiniX(this.opts.scrollX / this.opts.zoom), canvasWidth - fw));
    return { x: fx, w: fw };
  }
}
