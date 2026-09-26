// Mini-map-thumbnail-renderer. BEWUST niet de volle GanttRenderer:
// één fillRect per taakrij, geen labels/pijlen/culling — de hele projectperiode wordt
// op de strip gemapt, dus de complete planning is altijd zichtbaar ongeacht de hoofd-zoom.
// Herbruikt de gedeelde `viewRows`, dus filter/groep werken automatisch door.

import { parseDate, diffCalendarDays } from '@/utils/dateUtils';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';
import { readMiniMapPalette, type MiniMapPalette } from './themePalette';
import { shownStart, shownFinish } from '@/utils/taskDates';

export interface MiniMapOptions {
  rows: ViewRow[];
  canvasWidth: number;
  canvasHeight: number;
  /** Datum die in het hoofdvenster op scrollX = 0 ligt (effectiveViewStart van GanttCanvas). */
  originDate: string;
  /** Hoofdvenster-state voor het viewport-kader (primaire pane bij split view). */
  scrollX: number;
  zoom: number;
  /** Breedte van het zichtbare chart-gedeelte van het hoofdvenster (px). */
  chartWidth: number;
  /** Geïnjecteerd mini-map-palet. Afwezig ⇒ zelf gelezen via `readMiniMapPalette()`
   *  op render-moment; meegeven maakt de renderer headless-testbaar. */
  palette?: MiniMapPalette;
}

interface Span { startDay: number; endDay: number; span: number }

/** Startdag en (exclusieve) einddag van een taak t.o.v. `origin`; null zonder start. Een taak
 *  zonder einde beslaat zijn startdag. */
function taskDays(task: Task, origin: Date): { startDay: number; endDay: number } | null {
  const s = shownStart(task);
  if (!s) return null;
  const f = shownFinish(task) || s;
  return {
    startDay: diffCalendarDays(origin, parseDate(s)),
    endDay: diffCalendarDays(origin, parseDate(f)) + 1,
  };
}

/** Projectperiode (min start .. max finish) in dagen t.o.v. originDate. */
function projectSpan(rows: ViewRow[], originDate: string): Span | null {
  let min = Infinity;
  let max = -Infinity;
  const origin = parseDate(originDate);
  for (const row of rows) {
    const days = row.kind === 'task' ? taskDays(row.task, origin) : null;
    if (!days) continue;
    if (days.startDay < min) min = days.startDay;
    if (days.endDay > max) max = days.endDay;
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
    const { canvasWidth, canvasHeight, rows } = this.opts;
    const ctx = this.ctx;
    const colors = this.opts.palette ?? readMiniMapPalette();

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (this.span) {
      // Alle rijen gecomprimeerd op de striphoogte; 1 fillRect per taakrij.
      const taskRowCount = rows.length;
      const miniRowH = taskRowCount > 0 ? canvasHeight / taskRowCount : canvasHeight;
      const origin = parseDate(this.opts.originDate);
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.kind !== 'task') continue;
        const days = taskDays(row.task, origin);
        if (!days) continue;
        const x0 = this.dayToMiniX(days.startDay);
        const x1 = this.dayToMiniX(days.endDay);
        const y = i * miniRowH;
        ctx.fillStyle = row.task.time.isCritical ? colors.critical : colors.bar;
        ctx.fillRect(x0, y, Math.max(1, x1 - x0), Math.max(1, miniRowH - 1));
      }

      // Viewport-kader: het huidige hoofdvenster (breedte = zichtbare dagen / totale dagen).
      const frame = this.frameBounds();
      if (frame) {
        ctx.strokeStyle = colors.frame;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(frame.x + 0.75, 0.75, frame.w - 1.5, canvasHeight - 1.5);
        ctx.fillStyle = colors.frame + '14';
        ctx.fillRect(frame.x, 0, frame.w, canvasHeight);
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

  /** Grenzen van het viewport-kader op de strip — getekend door render() en gebruikt voor de
   *  sleep-hit-testing. Geklemd op de strip zelf: buiten-project scrollen of verder
   *  uitzoomen dan de projectperiode geeft anders een kader dat buiten canvasWidth valt — onzichtbaar
   *  (de canvas clipt aan zijn eigen randen), maar nooit netjes tegen de rechterrand zodra de
   *  zichtbare dagen de projectperiode overtreffen. */
  frameBounds(): { x: number; w: number } | null {
    if (!this.span || this.opts.zoom <= 0 || this.opts.chartWidth <= 0) return null;
    const { canvasWidth } = this.opts;
    const fw = Math.min(canvasWidth, Math.max(6, (this.opts.chartWidth / this.opts.zoom / this.span.span) * canvasWidth));
    const fx = Math.max(0, Math.min(this.dayToMiniX(this.opts.scrollX / this.opts.zoom), canvasWidth - fw));
    return { x: fx, w: fw };
  }
}
