// Histogram-renderer (fase 2.5, §6.4). Tekent één resource-belastingsstrook onder de Gantt met
// EXACT dezelfde X-as als GanttRenderer.dateToX (taskTableWidth + daysFromStart*zoom - scrollX),
// zodat de dagkolommen 1-op-1 boven de taakbalken staan. Eigen verticale schaal (eenheden i.p.v.
// rijen). Links van taskTableWidth: een resourcekiezer-lijst; rechts: staafjes per dag met het
// deel boven de capaciteitslijn in rood (P6-patroon). Thema-bewust via CSS-variabelen.
import type { ViewState } from '@/state/slices/types';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';

export interface HistogramSeries {
  /** iso-datum → belaste eenheden voor de getoonde resource (of som over alle renewables). */
  load: Record<string, number>;
  /** iso-datum → capaciteit op die dag. */
  capacity: Record<string, number>;
  /** iso-datums waar load > capacity. */
  overSet: Set<string>;
}

export interface HistogramPickerItem {
  /** undefined = de "alle resources"-somrij. */
  id?: string;
  label: string;
  overallocated: boolean;
}

export interface HistogramRenderOptions {
  series: HistogramSeries;
  picker: HistogramPickerItem[];
  selectedResourceId?: string;   // undefined = "alle resources"
  view: ViewState;               // effectiveView (zelfde origin als de Gantt)
  canvasWidth: number;
  canvasHeight: number;
  taskTableWidth: number;
  labels: { unitsSuffix: string };
  emptyHint?: string;            // getoond wanneer er geen (herberekende) data is
}

const ROW_H = 18;          // hoogte van een resourcekiezer-rij
const TOP_PAD = 8;         // ruimte boven de hoogste staaf
const BOTTOM_PAD = 4;      // ruimte onder de nullijn
const LEFT_PAD = 8;        // padding binnen de kiezerzone

function getColors() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    bg: v('--theme-surface', '#ffffff'),
    surfaceAlt: v('--theme-surface-alt', '#F6F8FB'),
    grid: v('--theme-border-light', '#EDF0F5'),
    border: v('--theme-border', '#E2E7EE'),
    text: v('--theme-text', '#333845'),
    textDim: v('--theme-text-dim', '#5B6472'),
    accent: v('--theme-accent', '#D97706'),
    hover: v('--theme-hover', 'rgba(0,0,0,0.05)'),
    active: v('--theme-active', 'rgba(0,0,0,0.08)'),
    barNormal: '#2563EB',   // gelijk aan GanttRenderer's "normal" (blauw)
    barOver: '#DC2626',     // gelijk aan GanttRenderer's "critical" (rood)
    capacity: v('--theme-text-dim', '#5B6472'),
  };
}

export class HistogramRenderer {
  private ctx: CanvasRenderingContext2D;
  private opts: HistogramRenderOptions;
  private colors: ReturnType<typeof getColors>;
  private viewStart: Date;

  constructor(ctx: CanvasRenderingContext2D, opts: HistogramRenderOptions) {
    this.ctx = ctx;
    this.opts = opts;
    this.colors = getColors();
    this.viewStart = parseDate(opts.view.viewStartDate);
  }

  /** Zelfde mapping als GanttRenderer.dateToX — gedeelde X-as. */
  private dateToX(date: Date): number {
    const msPerDay = 86400000;
    const daysFromStart = (date.getTime() - this.viewStart.getTime()) / msPerDay;
    return this.opts.taskTableWidth + daysFromStart * this.opts.view.zoom - this.opts.view.scrollX;
  }

  /** Inverse: kolom-iso onder een X-positie in de plotzone. */
  dateAtX(x: number): string {
    const daysFromStart = (x - this.opts.taskTableWidth + this.opts.view.scrollX) / this.opts.view.zoom;
    const d = addCalendarDays(this.viewStart, Math.floor(daysFromStart));
    return formatDate(d);
  }

  /** Hit-test op de kiezerzone: geeft { id } terug (id undefined = "alle resources"), of null. */
  pickerAt(x: number, y: number): { id?: string } | null {
    if (x >= this.opts.taskTableWidth) return null;
    const idx = Math.floor((y - TOP_PAD) / ROW_H);
    if (idx < 0 || idx >= this.opts.picker.length) return null;
    return { id: this.opts.picker[idx].id };
  }

  /** Hit-test op een dagkolom in de plotzone: geeft de iso-datum terug als daar belasting is. */
  dayAt(x: number, y: number): string | null {
    if (x < this.opts.taskTableWidth || y < 0 || y > this.opts.canvasHeight) return null;
    const iso = this.dateAtX(x);
    return this.opts.series.load[iso] !== undefined ? iso : null;
  }

  render(): void {
    const { canvasWidth, canvasHeight, taskTableWidth } = this.opts;
    const ctx = this.ctx;
    const c = this.colors;

    // Achtergrond
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Bovenrand (scheiding met de Gantt erboven)
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(canvasWidth, 0.5);
    ctx.stroke();

    this.drawPicker();

    // Plotzone rechts van de tabel
    ctx.save();
    ctx.beginPath();
    ctx.rect(taskTableWidth, 0, canvasWidth - taskTableWidth, canvasHeight);
    ctx.clip();

    if (this.opts.emptyHint) {
      ctx.fillStyle = c.textDim;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.opts.emptyHint, (taskTableWidth + canvasWidth) / 2, canvasHeight / 2);
      ctx.restore();
      return;
    }

    this.drawBars();
    ctx.restore();

    // Scheidingslijn tussen kiezer en plot
    ctx.strokeStyle = c.border;
    ctx.beginPath();
    ctx.moveTo(taskTableWidth + 0.5, 0);
    ctx.lineTo(taskTableWidth + 0.5, canvasHeight);
    ctx.stroke();
  }

  private drawPicker(): void {
    const ctx = this.ctx;
    const c = this.colors;
    const { taskTableWidth } = this.opts;

    ctx.fillStyle = c.surfaceAlt;
    ctx.fillRect(0, 0, taskTableWidth, this.opts.canvasHeight);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '11px system-ui, sans-serif';

    this.opts.picker.forEach((item, i) => {
      const y = TOP_PAD + i * ROW_H;
      if (y > this.opts.canvasHeight) return;
      const selected = item.id === this.opts.selectedResourceId;
      if (selected) {
        ctx.fillStyle = c.active;
        ctx.fillRect(0, y, taskTableWidth, ROW_H);
      }
      // Rood badge bij overallocatie
      if (item.overallocated) {
        ctx.fillStyle = c.barOver;
        ctx.beginPath();
        ctx.arc(LEFT_PAD + 3, y + ROW_H / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = selected ? c.text : c.textDim;
      const textX = LEFT_PAD + 12;
      const maxW = taskTableWidth - textX - 4;
      ctx.fillText(this.truncate(item.label, maxW), textX, y + ROW_H / 2);
    });
  }

  private truncate(text: string, maxWidth: number): string {
    const ctx = this.ctx;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t + '…';
  }

  private drawBars(): void {
    const ctx = this.ctx;
    const c = this.colors;
    const { series, view, canvasHeight } = this.opts;

    const isos = Object.keys(series.load);
    if (isos.length === 0) return;

    // Y-schaal: top = max(load, capacity) in de dataset, zodat overallocatie-staven zichtbaar
    // boven de capaciteitslijn uitsteken (afwijking van "Y=maxCapacity" om rood zichtbaar te
    // houden — zie eindrapport). Minimaal 1 om deling door 0 te vermijden.
    let yMax = 1;
    for (const iso of isos) {
      yMax = Math.max(yMax, series.load[iso] ?? 0, series.capacity[iso] ?? 0);
    }

    const plotBottom = canvasHeight - BOTTOM_PAD;
    const plotHeight = canvasHeight - TOP_PAD - BOTTOM_PAD;
    const unitToY = (u: number) => plotBottom - (u / yMax) * plotHeight;
    const dayW = Math.max(1, view.zoom);
    const barInset = dayW > 6 ? 1 : 0;

    // Nullijn
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.opts.taskTableWidth, plotBottom + 0.5);
    ctx.lineTo(this.opts.canvasWidth, plotBottom + 0.5);
    ctx.stroke();

    for (const iso of isos) {
      const loadVal = series.load[iso] ?? 0;
      const capVal = series.capacity[iso] ?? 0;
      if (loadVal <= 0 && capVal <= 0) continue;
      const x = this.dateToX(parseDate(iso));
      if (x + dayW < this.opts.taskTableWidth || x > this.opts.canvasWidth) continue;

      const capY = unitToY(capVal);

      if (loadVal > 0) {
        const overCap = loadVal > capVal + 1e-9;
        const topY = unitToY(loadVal);
        const bx = x + barInset;
        const bw = Math.max(1, dayW - barInset * 2);
        if (overCap) {
          // Normale deel tot capaciteit, rode deel erboven.
          ctx.fillStyle = c.barNormal;
          ctx.fillRect(bx, capY, bw, plotBottom - capY);
          ctx.fillStyle = c.barOver;
          ctx.fillRect(bx, topY, bw, capY - topY);
        } else {
          ctx.fillStyle = c.barNormal;
          ctx.fillRect(bx, topY, bw, plotBottom - topY);
        }
      }

      // Capaciteitslijn-segment (stapvormig: per dag zijn eigen niveau).
      if (capVal > 0) {
        ctx.strokeStyle = c.capacity;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, capY);
        ctx.lineTo(x + dayW, capY);
        ctx.stroke();
      }
    }

    // Y-as-label (max) linksboven in de plotzone
    ctx.fillStyle = c.textDim;
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${this.formatUnits(yMax)} ${this.opts.labels.unitsSuffix}`, this.opts.taskTableWidth + 4, 2);
  }

  private formatUnits(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }
}
