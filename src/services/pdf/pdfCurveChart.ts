/**
 * Curvegrafiek voor de rapporten (voortgangscurve, issue #689). Eén pure ligging
 * (`layoutCurveChart`: assen, lijnen, band, statusdatumlijn in logische px) en twee tekenaars: het
 * scherm tekent de ligging als SVG in de themakleuren (`CurveChartView`), de PDF tekent hem hier via
 * `Draw2D` op wit papier. Zo kunnen scherm en PDF niet uit elkaar lopen, net als de kolomspec van de
 * tabelrapporten (`pdfTable.ts`).
 *
 * Deze module doet geen i18n: alle teksten (aslabels, legenda, statusdatum) komen al vertaald binnen.
 */
import type { Draw2D } from './draw2d';
import { ellipsize } from '@/engine/renderer/textFit';

export interface CurveChartPoint { day: string; pct: number }

export interface CurveChartSeries {
  key: string;
  label: string;
  /** Lijnkleur (hex), dezelfde in DOM en PDF. */
  color: string;
  dashed?: boolean;
  points: CurveChartPoint[];
}

export interface CurveChartSpec {
  /** As (ISO-dagen). */
  from: string;
  to: string;
  series: CurveChartSeries[];
  /** Gevulde band tussen twee curves met dezelfde meetpunten. */
  band?: { key: string; label: string; color: string; upper: CurveChartPoint[]; lower: CurveChartPoint[] };
  /** Verticale lijn (de statusdatum). */
  marker?: { day: string; label: string; color: string };
  /** X-asstrepen met hun label (al opgemaakt). */
  xTicks: { day: string; label: string }[];
  /** Y-asstrepen (0–100) met hun label (al opgemaakt). */
  yTicks: { pct: number; label: string }[];
  /** Toegankelijke naam van de grafiek. */
  ariaLabel: string;
  /** Kleine regel onder de legenda (bv. hoe de werkelijke curve benaderd is). */
  footnote?: string;
}

export const CURVE_CHART_WIDTH = 760;
export const CURVE_CHART_HEIGHT = 280;
/** Hoogte van de legendaregel onder de grafiek (PDF). */
export const CURVE_CHART_LEGEND_HEIGHT = 24;
export const CURVE_CHART_FOOTNOTE_HEIGHT = 18;
/** Dekking van de band: de DOM zet hem als `fill-opacity`, de PDF mengt de kleur met wit. */
export const CURVE_BAND_OPACITY = 0.2;

const MARGIN = { left: 44, right: 14, top: 22, bottom: 26 };

export type Pt = readonly [number, number];

export interface CurveChartLayout {
  width: number;
  height: number;
  plot: { x: number; y: number; w: number; h: number };
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
  lines: { key: string; color: string; dashed: boolean; pts: Pt[] }[];
  band?: { color: string; polygon: Pt[] };
  marker?: { x: number; label: string; color: string; labelAlign: 'left' | 'right' };
}

const DAY_MS = 86_400_000;
function dayNum(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function layoutCurveChart(spec: CurveChartSpec, width = CURVE_CHART_WIDTH, height = CURVE_CHART_HEIGHT): CurveChartLayout {
  const plot = { x: MARGIN.left, y: MARGIN.top, w: width - MARGIN.left - MARGIN.right, h: height - MARGIN.top - MARGIN.bottom };
  const d0 = dayNum(spec.from);
  const d1 = Math.max(d0 + 1, dayNum(spec.to));
  const xOf = (day: string) => plot.x + ((dayNum(day) - d0) / (d1 - d0)) * plot.w;
  const yOf = (pct: number) => plot.y + plot.h - (Math.min(100, Math.max(0, pct)) / 100) * plot.h;
  const pts = (list: CurveChartPoint[]): Pt[] => list.map(p => [xOf(p.day), yOf(p.pct)] as const);
  const inRange = (day: string) => dayNum(day) >= d0 && dayNum(day) <= d1;
  const markerX = spec.marker && inRange(spec.marker.day) ? xOf(spec.marker.day) : undefined;
  return {
    width, height, plot,
    yTicks: spec.yTicks.map(t => ({ y: yOf(t.pct), label: t.label })),
    xTicks: spec.xTicks.filter(t => inRange(t.day)).map(t => ({ x: xOf(t.day), label: t.label })),
    lines: spec.series.filter(s => s.points.length > 0).map(s => ({ key: s.key, color: s.color, dashed: !!s.dashed, pts: pts(s.points) })),
    band: spec.band && spec.band.upper.length > 0
      ? { color: spec.band.color, polygon: [...pts(spec.band.upper), ...pts(spec.band.lower).reverse()] }
      : undefined,
    marker: spec.marker && markerX !== undefined
      ? { x: markerX, label: spec.marker.label, color: spec.marker.color, labelAlign: markerX > plot.x + plot.w * 0.75 ? 'right' : 'left' }
      : undefined,
  };
}

/** Een hexkleur gemengd met wit — de PDF kent geen doorzichtigheid. */
export function mixWithWhite(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (shift: number) => Math.round(255 - (255 - ((n >> shift) & 255)) * alpha);
  return `#${[16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

const PRINT = { grid: '#e5e7eb', axis: '#9ca3af', text: '#6b7280' };

/** Tekent de grafiek (zonder legenda) met linksboven op (`x0`, `y0`). */
export function drawCurveChart(d2d: Draw2D, layout: CurveChartLayout, x0: number, y0: number, fontFamily: string): void {
  const { plot } = layout;
  const X = (x: number) => x0 + x;
  const Y = (y: number) => y0 + y;
  d2d.setLineDash([]);
  // Raster en y-labels.
  d2d.font = `10px ${fontFamily}`;
  d2d.textBaseline = 'middle';
  d2d.textAlign = 'right';
  for (const t of layout.yTicks) {
    d2d.strokeStyle = PRINT.grid;
    d2d.lineWidth = 1;
    d2d.beginPath();
    d2d.moveTo(X(plot.x), Y(t.y));
    d2d.lineTo(X(plot.x + plot.w), Y(t.y));
    d2d.stroke();
    d2d.fillStyle = PRINT.text;
    d2d.fillText(t.label, X(plot.x - 6), Y(t.y));
  }
  // Band.
  if (layout.band && layout.band.polygon.length > 2) {
    d2d.fillStyle = mixWithWhite(layout.band.color, CURVE_BAND_OPACITY);
    d2d.beginPath();
    layout.band.polygon.forEach(([x, y], i) => (i === 0 ? d2d.moveTo(X(x), Y(y)) : d2d.lineTo(X(x), Y(y))));
    d2d.closePath();
    d2d.fill();
  }
  // X-as met strepen en labels.
  d2d.strokeStyle = PRINT.axis;
  d2d.lineWidth = 1;
  d2d.beginPath();
  d2d.moveTo(X(plot.x), Y(plot.y + plot.h));
  d2d.lineTo(X(plot.x + plot.w), Y(plot.y + plot.h));
  d2d.stroke();
  d2d.textAlign = 'center';
  d2d.textBaseline = 'middle';
  d2d.fillStyle = PRINT.text;
  const spacing = layout.xTicks.length > 1 ? layout.xTicks[1].x - layout.xTicks[0].x : plot.w;
  for (const t of layout.xTicks) {
    d2d.beginPath();
    d2d.moveTo(X(t.x), Y(plot.y + plot.h));
    d2d.lineTo(X(t.x), Y(plot.y + plot.h + 4));
    d2d.stroke();
    d2d.fillText(ellipsize(d2d, t.label, Math.max(20, spacing - 4)), X(t.x), Y(plot.y + plot.h + 14));
  }
  // Curves.
  for (const line of layout.lines) {
    if (line.pts.length < 1) continue;
    d2d.strokeStyle = line.color;
    d2d.lineWidth = 2;
    d2d.setLineDash(line.dashed ? [6, 4] : []);
    d2d.beginPath();
    line.pts.forEach(([x, y], i) => (i === 0 ? d2d.moveTo(X(x), Y(y)) : d2d.lineTo(X(x), Y(y))));
    d2d.stroke();
  }
  d2d.setLineDash([]);
  // Statusdatum.
  if (layout.marker) {
    const m = layout.marker;
    d2d.strokeStyle = m.color;
    d2d.lineWidth = 1.5;
    d2d.setLineDash([3, 3]);
    d2d.beginPath();
    d2d.moveTo(X(m.x), Y(plot.y - 4));
    d2d.lineTo(X(m.x), Y(plot.y + plot.h));
    d2d.stroke();
    d2d.setLineDash([]);
    d2d.fillStyle = m.color;
    d2d.font = `bold 10px ${fontFamily}`;
    d2d.textAlign = m.labelAlign === 'left' ? 'left' : 'right';
    d2d.textBaseline = 'middle';
    d2d.fillText(m.label, X(m.x + (m.labelAlign === 'left' ? 4 : -4)), Y(plot.y - 12));
  }
  d2d.textAlign = 'left';
  d2d.textBaseline = 'alphabetic';
}

/** De legenda-items in tekenvolgorde: band, dan de lijnen, dan de statusdatum. */
export function curveLegendItems(spec: CurveChartSpec): { key: string; label: string; color: string; kind: 'band' | 'line' | 'dashed' | 'marker' }[] {
  const items: { key: string; label: string; color: string; kind: 'band' | 'line' | 'dashed' | 'marker' }[] = [];
  for (const s of spec.series) if (s.points.length > 0) items.push({ key: s.key, label: s.label, color: s.color, kind: s.dashed ? 'dashed' : 'line' });
  if (spec.band && spec.band.upper.length > 0) items.push({ key: spec.band.key, label: spec.band.label, color: spec.band.color, kind: 'band' });
  if (spec.marker) items.push({ key: 'marker', label: spec.marker.label, color: spec.marker.color, kind: 'marker' });
  return items;
}

/** Tekent de legenda op één regel vanaf (`x0`, `y0`); geeft niets terug (vaste hoogte). */
export function drawCurveLegend(d2d: Draw2D, spec: CurveChartSpec, x0: number, y0: number, maxWidth: number, fontFamily: string, textColor: string): void {
  const midY = y0 + CURVE_CHART_LEGEND_HEIGHT / 2;
  let x = x0;
  d2d.font = `10px ${fontFamily}`;
  d2d.textBaseline = 'middle';
  d2d.textAlign = 'left';
  for (const item of curveLegendItems(spec)) {
    if (x > x0 + maxWidth - 40) break;
    if (item.kind === 'band') {
      d2d.fillStyle = mixWithWhite(item.color, CURVE_BAND_OPACITY * 2);
      d2d.fillRect(x, midY - 5, 18, 10);
    } else {
      d2d.strokeStyle = item.color;
      d2d.lineWidth = item.kind === 'marker' ? 1.5 : 2;
      d2d.setLineDash(item.kind === 'dashed' ? [5, 3] : item.kind === 'marker' ? [3, 3] : []);
      d2d.beginPath();
      if (item.kind === 'marker') { d2d.moveTo(x + 9, midY - 7); d2d.lineTo(x + 9, midY + 7); } else { d2d.moveTo(x, midY); d2d.lineTo(x + 18, midY); }
      d2d.stroke();
      d2d.setLineDash([]);
    }
    x += 24;
    d2d.fillStyle = textColor;
    const label = ellipsize(d2d, item.label, Math.max(20, x0 + maxWidth - x));
    d2d.fillText(label, x, midY);
    x += d2d.measureText(label).width + 18;
  }
}
