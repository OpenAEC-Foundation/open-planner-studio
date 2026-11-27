import { localizeDecimalPoint } from '@/utils/reportNumber';
import type { ViewState } from '@/types/view';
import { exceedsCapacity } from '@/engine/scheduler/capacityTolerance';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';
import { readHistogramPalette, type HistogramPalette } from './themePalette';
import { dateToX as axisDateToX, type GanttAxis } from './timeAxis';
import { ellipsize } from './textFit';
import { canvasFont, type TextRole } from './textRoles';

export interface HistogramSeries {
  load: Record<string, number>;
  capacity: Record<string, number>;
  overSet: Set<string>;
}

export interface HistogramPickerItem {
  id?: string;
  label: string;
  overallocated: boolean;
}

export interface HistogramRenderOptions {
  series: HistogramSeries;
  picker: HistogramPickerItem[];
  selectedResourceId?: string;
  view: ViewState;
  canvasWidth: number;
  canvasHeight: number;
  pickerWidth: number;
  pickerSide?: HistogramPickerSide;
  pickerScrollY?: number;
  labels: { unitsSuffix: string; numberLocale?: string };
  emptyHint?: string;
  palette?: HistogramPalette;
  axis?: GanttAxis;
  fontFamily?: string;
  fontScale?: number;
}

const ROW_H = 18;
const TOP_PAD = 8;
const BOTTOM_PAD = 4;
const LEFT_PAD = 8;
const PICKER_SCROLLBAR_W = 2;
const PICKER_SCROLLBAR_ALPHA = 0.45;

export type HistogramPickerSide = 'left' | 'right';

export function histogramPlotInsets(
  pickerWidth: number,
  pickerSide: HistogramPickerSide = 'left',
): { left: number; right: number } {
  return pickerSide === 'right' ? { left: 0, right: pickerWidth } : { left: pickerWidth, right: 0 };
}

export interface HistogramLayout {
  picker: { left: number; right: number };
  plot: { left: number; right: number };
}

export function histogramLayout(
  canvasWidth: number,
  pickerWidth: number,
  pickerSide: HistogramPickerSide = 'left',
): HistogramLayout {
  const inset = histogramPlotInsets(pickerWidth, pickerSide);
  return {
    picker: pickerSide === 'right'
      ? { left: canvasWidth - pickerWidth, right: canvasWidth }
      : { left: 0, right: pickerWidth },
    plot: { left: inset.left, right: canvasWidth - inset.right },
  };
}

export function isInHistogramPicker(layout: HistogramLayout, x: number): boolean {
  return x >= layout.picker.left && x < layout.picker.right;
}

export function histogramPickerRowHeight(fontScale = 1): number {
  return Math.round(ROW_H * fontScale);
}

export function histogramPickerTrackHeight(canvasHeight: number, fontScale = 1): number {
  const rowH = histogramPickerRowHeight(fontScale);
  return Math.max(0, canvasHeight - TOP_PAD - rowH);
}

export function histogramPickerMaxScroll(itemCount: number, canvasHeight: number, fontScale = 1): number {
  const rowH = histogramPickerRowHeight(fontScale);
  const scrollableCount = Math.max(0, itemCount - 1);
  const trackHeight = histogramPickerTrackHeight(canvasHeight, fontScale);
  return Math.max(0, scrollableCount * rowH - trackHeight);
}

export class HistogramRenderer {
  private ctx: CanvasRenderingContext2D;
  private opts: HistogramRenderOptions;
  private colors: HistogramPalette;
  private viewStart: Date;
  private fontScale: number;
  private layout: HistogramLayout;
  private chartOriginX: number;
  private rowH: number;
  private pickerScrollY: number;
  private maxScroll: number;

  constructor(ctx: CanvasRenderingContext2D, opts: HistogramRenderOptions) {
    this.ctx = ctx;
    this.opts = opts;
    this.colors = opts.palette ?? readHistogramPalette();
    this.viewStart = parseDate(opts.view.viewStartDate);
    this.fontScale = opts.fontScale ?? 1;
    this.layout = histogramLayout(opts.canvasWidth, opts.pickerWidth, opts.pickerSide);
    this.chartOriginX = this.layout.plot.left;
    this.rowH = histogramPickerRowHeight(this.fontScale);
    this.maxScroll = histogramPickerMaxScroll(opts.picker.length, opts.canvasHeight, this.fontScale);
    this.pickerScrollY = Math.min(this.maxScroll, Math.max(0, opts.pickerScrollY ?? 0));
  }

  private font(role: TextRole, bold = false): string {
    return canvasFont(role, this.fontScale, this.opts.fontFamily, bold);
  }

  private dateToX(date: Date): number {
    if (this.opts.axis) return this.opts.axis.dateToX(date);
    return axisDateToX(date, this.viewStart, this.chartOriginX, this.opts.view.zoom, this.opts.view.scrollX);
  }

  dateAtX(x: number): string {
    if (this.opts.axis) return formatDate(this.opts.axis.xToDate(x));
    const daysFromStart = (x - this.chartOriginX + this.opts.view.scrollX) / this.opts.view.zoom;
    const d = addCalendarDays(this.viewStart, Math.floor(daysFromStart));
    return formatDate(d);
  }

  pickerAt(x: number, y: number): { id?: string } | null {
    if (!isInHistogramPicker(this.layout, x)) return null;
    if (this.opts.picker.length === 0) return null;
    if (y >= TOP_PAD && y < TOP_PAD + this.rowH) return { id: this.opts.picker[0].id };
    const scrollTop = TOP_PAD + this.rowH;
    if (y < scrollTop) return null;
    const idx = 1 + Math.floor((y - scrollTop + this.pickerScrollY) / this.rowH);
    if (idx >= this.opts.picker.length) return null;
    return { id: this.opts.picker[idx].id };
  }

  dayAt(x: number, y: number): string | null {
    const { plot } = this.layout;
    if (x < plot.left || x >= plot.right || y < 0 || y > this.opts.canvasHeight) return null;
    const iso = this.dateAtX(x);
    return this.opts.series.load[iso] !== undefined ? iso : null;
  }

  render(): void {
    const { canvasWidth, canvasHeight } = this.opts;
    const { plot } = this.layout;
    const ctx = this.ctx;
    const c = this.colors;

    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(canvasWidth, 0.5);
    ctx.stroke();

    this.drawPicker();

    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.left, 0, plot.right - plot.left, canvasHeight);
    ctx.clip();

    if (this.opts.emptyHint) {
      ctx.fillStyle = c.textDim;
      ctx.font = this.font('body');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.opts.emptyHint, (plot.left + plot.right) / 2, canvasHeight / 2);
      ctx.restore();
      return;
    }

    this.drawBars();
    ctx.restore();

    const separatorX = this.opts.pickerSide === 'right' ? plot.right - 0.5 : plot.left + 0.5;
    ctx.strokeStyle = c.border;
    ctx.beginPath();
    ctx.moveTo(separatorX, 0);
    ctx.lineTo(separatorX, canvasHeight);
    ctx.stroke();
  }

  private drawPickerRow(item: HistogramPickerItem, y: number, reserveScrollbar: boolean): void {
    const ctx = this.ctx;
    const c = this.colors;
    const { pickerWidth } = this.opts;
    const x0 = this.layout.picker.left;
    const selected = item.id === this.opts.selectedResourceId;
    if (selected) {
      ctx.fillStyle = c.active;
      ctx.fillRect(x0, y, pickerWidth, this.rowH);
    }
    if (item.overallocated) {
      ctx.fillStyle = c.barOver;
      ctx.beginPath();
      ctx.arc(x0 + LEFT_PAD + 3, y + this.rowH / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = selected ? c.text : c.textDim;
    const textOffset = LEFT_PAD + 12;
    const maxW = pickerWidth - textOffset - 4 - (reserveScrollbar ? PICKER_SCROLLBAR_W + 2 : 0);
    ctx.fillText(ellipsize(ctx, item.label, maxW), x0 + textOffset, y + this.rowH / 2);
  }

  private drawPicker(): void {
    const ctx = this.ctx;
    const c = this.colors;
    const { pickerWidth, picker, canvasHeight } = this.opts;
    const x0 = this.layout.picker.left;

    ctx.fillStyle = c.surfaceAlt;
    ctx.fillRect(x0, 0, pickerWidth, canvasHeight);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = this.font('body');

    if (picker.length === 0) return;

    const showScrollbar = this.maxScroll > 0;

    this.drawPickerRow(picker[0], TOP_PAD, false);

    const scrollTop = TOP_PAD + this.rowH;
    const scrollableItems = picker.slice(1);
    if (scrollableItems.length === 0 || scrollTop >= canvasHeight) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, scrollTop, pickerWidth, canvasHeight - scrollTop);
    ctx.clip();
    scrollableItems.forEach((item, i) => {
      const y = scrollTop - this.pickerScrollY + i * this.rowH;
      if (y + this.rowH < scrollTop || y > canvasHeight) return;
      this.drawPickerRow(item, y, showScrollbar);
    });
    ctx.restore();

    if (!showScrollbar) return;
    const trackHeight = histogramPickerTrackHeight(canvasHeight, this.fontScale);
    const contentHeight = scrollableItems.length * this.rowH;
    const thumbHeight = Math.max(12, trackHeight * Math.min(1, trackHeight / contentHeight));
    const thumbY = scrollTop + (this.pickerScrollY / this.maxScroll) * (trackHeight - thumbHeight);
    ctx.save();
    ctx.fillStyle = c.textDim;
    ctx.globalAlpha = PICKER_SCROLLBAR_ALPHA;
    ctx.fillRect(x0 + pickerWidth - PICKER_SCROLLBAR_W - 1, thumbY, PICKER_SCROLLBAR_W, thumbHeight);
    ctx.restore();
  }

  private drawBars(): void {
    const ctx = this.ctx;
    const c = this.colors;
    const { series, view, canvasHeight } = this.opts;
    const { plot } = this.layout;

    const isos = Object.keys(series.load);
    if (isos.length === 0) return;

    const dayW = Math.max(1, view.zoom);
    const barInset = dayW > 6 ? 1 : 0;

    let yMaxData = 1;
    for (const iso of isos) {
      const x = this.dateToX(parseDate(iso));
      if (x + dayW < plot.left || x > plot.right) continue;
      yMaxData = Math.max(yMaxData, series.load[iso] ?? 0, series.capacity[iso] ?? 0);
    }
    const yMax = yMaxData * 1.05;

    const plotBottom = canvasHeight - BOTTOM_PAD;
    const plotHeight = canvasHeight - TOP_PAD - BOTTOM_PAD;
    const unitToY = (u: number) => plotBottom - (u / yMax) * plotHeight;

    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plot.left, plotBottom + 0.5);
    ctx.lineTo(plot.right, plotBottom + 0.5);
    ctx.stroke();

    for (const iso of isos) {
      const loadVal = series.load[iso] ?? 0;
      const capVal = series.capacity[iso] ?? 0;
      if (loadVal <= 0 && capVal <= 0) continue;
      const x = this.dateToX(parseDate(iso));
      if (x + dayW < plot.left || x > plot.right) continue;

      const capY = unitToY(capVal);

      if (loadVal > 0) {
        const overCap = exceedsCapacity(loadVal, capVal);
        const topY = unitToY(loadVal);
        const bx = x + barInset;
        const bw = Math.max(1, dayW - barInset * 2);
        if (overCap) {
          ctx.fillStyle = c.barNormal;
          ctx.fillRect(bx, capY, bw, plotBottom - capY);
          ctx.fillStyle = c.barOver;
          ctx.fillRect(bx, topY, bw, capY - topY);
        } else {
          ctx.fillStyle = c.barNormal;
          ctx.fillRect(bx, topY, bw, plotBottom - topY);
        }
      }

      if (capVal > 0) {
        ctx.strokeStyle = c.capacity;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, capY);
        ctx.lineTo(x + dayW, capY);
        ctx.stroke();
      }
    }

    ctx.fillStyle = c.textDim;
    ctx.font = this.font('caption');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${this.formatUnits(yMaxData)} ${this.opts.labels.unitsSuffix}`, plot.left + 4, 2);
  }

  private formatUnits(n: number): string {
    return Number.isInteger(n) ? String(n) : localizeDecimalPoint(n.toFixed(1), this.opts.labels.numberLocale);
  }
}
