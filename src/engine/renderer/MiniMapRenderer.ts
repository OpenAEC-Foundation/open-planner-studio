// Mini-map-thumbnail-renderer (fase 2.7, §11). BEWUST niet de volle GanttRenderer:
// één fillRect per taakrij, geen labels/pijlen/culling — de hele projectperiode wordt
// op de strip gemapt, dus de complete planning is altijd zichtbaar ongeacht de hoofd-zoom.
// Herbruikt de gedeelde `viewRows` (§4), dus filter/groep werken automatisch door.

import { parseDate, diffCalendarDays } from '@/utils/dateUtils';
import type { ViewRow } from '@/engine/view/visibleRows';

export interface MiniMapOptions {
  rows: ViewRow[];
  canvasWidth: number;
  canvasHeight: number;
  /** Datum die in het hoofdvenster op scrollX = 0 ligt (effectiveViewStart van GanttCanvas). */
  originDate: string;
  /** Hoofdvenster-state voor het viewport-kader (primaire pane bij split view, §10.3). */
  scrollX: number;
  zoom: number;
  /** Breedte van het zichtbare chart-gedeelte van het hoofdvenster (px). */
  chartWidth: number;
}

interface Span { startDay: number; endDay: number; span: number }

function getColors() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    bg: v('--theme-surface-alt', '#F6F8FB'),
    border: v('--theme-border', '#E2E7EE'),
    bar: '#2563EB',
    critical: '#DC2626',
    frame: v('--theme-accent', '#B45309'),
  };
}

/** Projectperiode (min start .. max finish) in dagen t.o.v. originDate. */
function projectSpan(rows: ViewRow[], originDate: string): Span | null {
  let min = Infinity;
  let max = -Infinity;
  const origin = parseDate(originDate);
  for (const row of rows) {
    if (row.kind !== 'task') continue;
    const s = row.task.time.earlyStart || row.task.time.scheduleStart;
    const f = row.task.time.earlyFinish || row.task.time.scheduleFinish || s;
    if (!s) continue;
    const sd = diffCalendarDays(origin, parseDate(s));
    const fd = f ? diffCalendarDays(origin, parseDate(f)) + 1 : sd + 1;
    if (sd < min) min = sd;
    if (fd > max) max = fd;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
  return { startDay: min, endDay: max, span: max - min };
}

export class MiniMapRenderer {
  private ctx: CanvasRenderingContext2D;
  private opts: MiniMapOptions;
  private span: Span | null;

  constructor(ctx: CanvasRenderingContext2D, opts: MiniMapOptions) {
    this.ctx = ctx;
    this.opts = opts;
    this.span = projectSpan(opts.rows, opts.originDate);
  }

  /** Dag (t.o.v. originDate) → x op de strip. */
  private dayToMiniX(day: number): number {
    if (!this.span) return 0;
    return ((day - this.span.startDay) / this.span.span) * this.opts.canvasWidth;
  }

  /** x op de strip → dag t.o.v. originDate (voor klik-centreren/slepen). */
  miniXToDay(x: number): number | null {
    if (!this.span) return null;
    return this.span.startDay + (x / this.opts.canvasWidth) * this.span.span;
  }

  render(): void {
    const { canvasWidth, canvasHeight, rows, scrollX, zoom, chartWidth } = this.opts;
    const ctx = this.ctx;
    const colors = getColors();

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (this.span) {
      // Alle rijen gecomprimeerd op de striphoogte; 1 fillRect per taakrij (§11.1).
      const taskRowCount = rows.length;
      const miniRowH = taskRowCount > 0 ? canvasHeight / taskRowCount : canvasHeight;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.kind !== 'task') continue;
        const s = row.task.time.earlyStart || row.task.time.scheduleStart;
        if (!s) continue;
        const f = row.task.time.earlyFinish || row.task.time.scheduleFinish || s;
        const origin = parseDate(this.opts.originDate);
        const x0 = this.dayToMiniX(diffCalendarDays(origin, parseDate(s)));
        const x1 = this.dayToMiniX(diffCalendarDays(origin, parseDate(f)) + 1);
        const y = i * miniRowH;
        ctx.fillStyle = row.task.time.isCritical ? colors.critical : colors.bar;
        ctx.fillRect(x0, y, Math.max(1, x1 - x0), Math.max(1, miniRowH - 1));
      }

      // Viewport-kader: het huidige hoofdvenster (breedte = zichtbare dagen / totale dagen).
      if (zoom > 0 && chartWidth > 0) {
        const leftDay = scrollX / zoom;
        const visibleDays = chartWidth / zoom;
        const fx = this.dayToMiniX(leftDay);
        const fw = Math.max(6, (visibleDays / this.span.span) * canvasWidth);
        ctx.strokeStyle = colors.frame;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(fx + 0.75, 0.75, fw - 1.5, canvasHeight - 1.5);
        ctx.fillStyle = colors.frame + '14';
        ctx.fillRect(fx, 0, fw, canvasHeight);
      }
    }

    // Bovenrand als scheiding met de Gantt erboven.
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(canvasWidth, 0.5);
    ctx.stroke();
  }

  /** Grenzen van het viewport-kader op de strip (voor sleep-hit-testing). */
  frameBounds(): { x: number; w: number } | null {
    if (!this.span || this.opts.zoom <= 0 || this.opts.chartWidth <= 0) return null;
    const fx = this.dayToMiniX(this.opts.scrollX / this.opts.zoom);
    const fw = Math.max(6, (this.opts.chartWidth / this.opts.zoom / this.span.span) * this.opts.canvasWidth);
    return { x: fx, w: fw };
  }
}
