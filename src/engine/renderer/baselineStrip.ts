import { MS_PER_DAY, parseDate, parseInstant } from '@/utils/dateUtils';
import { finishInstant } from '@/utils/taskDates';

export type BaselineSlot = 0 | 1 | 2;

export interface BaselineBar {
  slot: BaselineSlot;
  x1: number;
  x2: number;
}

export interface BaselineMilestone {
  slot: BaselineSlot;
  x: number;
  moment: string;
}

export interface BaselineSpan {
  start: string;
  finish: string;
  isMilestone: boolean;
}

export type BaselineSpanX = { kind: 'bar'; x1: number; x2: number } | { kind: 'milestone'; x: number; moment: string };

export function baselineStart(span: BaselineSpan): { date: Date; hourMode: boolean } | null {
  const startStr = span.start || span.finish;
  const finishStr = span.finish || span.start;
  if (!startStr) return null;
  const hourMode = startStr.includes('T') || finishStr.includes('T');
  const date = hourMode ? parseInstant(startStr) : parseDate(startStr);
  return Number.isNaN(date.getTime()) ? null : { date, hourMode };
}

export function baselineSpanX(
  span: BaselineSpan,
  dateToX: (date: Date) => number,
  dayWidth: number,
): BaselineSpanX | null {
  const begin = baselineStart(span);
  if (!begin) return null;
  const { date: start, hourMode } = begin;
  const finishStr = span.finish || span.start;
  if (span.isMilestone) {
    const moment = `${hourMode ? 'T' : 'D'}${start.getTime()}`;
    return { kind: 'milestone', x: hourMode ? dateToX(start) : dateToX(start) + dayWidth / 2, moment };
  }
  const end = hourMode ? finishInstant(finishStr) : parseDate(finishStr);
  if (Number.isNaN(end.getTime())) return null;
  const x1 = dateToX(start);
  const x2 = hourMode ? dateToX(end) : dateToX(new Date(end.getTime() + MS_PER_DAY));
  return { kind: 'bar', x1, x2 };
}

export interface BaselineStripPiece {
  x1: number;
  x2: number;
  slots: BaselineSlot[];
}

export interface BaselineDiamond {
  x: number;
  slots: BaselineSlot[];
}

const bySlot = (a: BaselineSlot, b: BaselineSlot) => a - b;

export function baselineStripPieces(bars: readonly BaselineBar[]): BaselineStripPiece[] {
  const valid = bars.filter(b => b.x2 > b.x1);
  if (valid.length === 0) return [];
  const edges = [...new Set(valid.flatMap(b => [b.x1, b.x2]))].sort((a, b) => a - b);
  const pieces: BaselineStripPiece[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i];
    const b = edges[i + 1];
    const slots = valid.filter(bar => bar.x1 <= a && bar.x2 >= b).map(bar => bar.slot).sort(bySlot);
    if (slots.length === 0) continue;
    pieces.push({ x1: a, x2: b, slots });
  }
  return pieces;
}

export function widenShortRuns(pieces: readonly BaselineStripPiece[], minWidth: number): BaselineStripPiece[] {
  const out = pieces.map(p => ({ ...p }));
  let i = 0;
  while (i < out.length) {
    let j = i;
    while (j + 1 < out.length && out[j + 1].x1 === out[j].x2) j++;
    const width = out[j].x2 - out[i].x1;
    if (width < minWidth) {
      const nextStart = j + 1 < out.length ? out[j + 1].x1 : Infinity;
      const prevEnd = i > 0 ? out[i - 1].x2 : -Infinity;
      let need = minWidth - width;
      const right = Math.min(need, nextStart - out[j].x2);
      out[j].x2 += right;
      need -= right;
      if (need > 0) out[i].x1 -= Math.min(need, out[i].x1 - prevEnd);
    }
    i = j + 1;
  }
  return out;
}

export const BASELINE_BLEND_PX = 21;

const BLEND_STEPS = 16;
const EDGE_EPSILON = 1e-3;

function sCurve(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

const rampOf = (b: BaselineBar, blend: number) => Math.min(blend, (b.x2 - b.x1) / 2);

function laneWeight(b: BaselineBar, x: number, blend: number): number {
  if (x <= b.x1 || x >= b.x2) return 0;
  const ramp = rampOf(b, blend);
  return sCurve((x - b.x1) / ramp) * sCurve((b.x2 - x) / ramp);
}

export interface BaselineLane {
  slot: BaselineSlot;
  x: number[];
  top: number[];
  bottom: number[];
}

export function baselineLanes(bars: readonly BaselineBar[], height: number, blend: number): BaselineLane[] {
  const valid = bars.filter(b => b.x2 > b.x1).sort((a, b) => a.slot - b.slot);
  const edges = [...new Set(valid.flatMap(b => {
    const ramp = rampOf(b, blend);
    return [b.x1, b.x1 + ramp, b.x2 - ramp, b.x2];
  }))].sort((a, b) => a - b);
  const grid: number[] = [];
  edges.forEach((a, i) => {
    grid.push(a);
    const b = edges[i + 1];
    if (b === undefined) return;
    const active = valid.filter(v => v.x1 <= a && v.x2 >= b);
    const changing = active.length > 1 && active.some(v => {
      const ramp = rampOf(v, blend);
      return a < v.x1 + ramp || b > v.x2 - ramp;
    });
    if (!changing) return;
    const n = Math.max(1, Math.ceil((b - a) / (blend / BLEND_STEPS)));
    for (let k = 1; k < n; k++) grid.push(a + ((b - a) * k) / n);
  });
  return valid.map(bar => {
    const lane: BaselineLane = { slot: bar.slot, x: [], top: [], bottom: [] };
    for (const x of grid) {
      if (x < bar.x1 || x > bar.x2) continue;
      const at = x === bar.x1 ? x + EDGE_EPSILON : x === bar.x2 ? x - EDGE_EPSILON : x;
      let above = 0;
      let own = 0;
      let sum = 0;
      for (const other of valid) {
        const w = laneWeight(other, at, blend);
        sum += w;
        if (other.slot < bar.slot) above += w;
        else if (other === bar) own = w;
      }
      if (sum <= 0) continue;
      lane.x.push(x);
      lane.top.push((height * above) / sum);
      lane.bottom.push((height * (above + own)) / sum);
    }
    return lane;
  });
}

export function widenBars(bars: readonly BaselineBar[], minWidth: number): BaselineBar[] {
  const valid = bars.filter(b => b.x2 > b.x1);
  const real = baselineStripPieces(valid);
  const wide = widenShortRuns(real, minWidth);
  return valid.map(bar => {
    const mine = wide.filter((_, i) => real[i].x1 >= bar.x1 && real[i].x2 <= bar.x2);
    return { ...bar, x1: Math.min(...mine.map(p => p.x1)), x2: Math.max(...mine.map(p => p.x2)) };
  });
}

export function baselineDiamonds(milestones: readonly BaselineMilestone[]): BaselineDiamond[] {
  const byMoment = new Map<string, { x: number; slots: BaselineSlot[]; order: number }>();
  milestones.forEach((m, order) => {
    const group = byMoment.get(m.moment) ?? { x: m.x, slots: [], order };
    if (!group.slots.includes(m.slot)) group.slots.push(m.slot);
    byMoment.set(m.moment, group);
  });
  return [...byMoment.values()]
    .sort((a, b) => a.x - b.x || a.order - b.order)
    .map(g => ({ x: g.x, slots: g.slots.sort(bySlot) }));
}

export const baselineDiamondSize = (h: number): number => Math.max(2.4, h * 0.8);

export interface StripPainter {
  fillStyle: string | CanvasGradient | CanvasPattern;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
}

type Pt = readonly [number, number];

function clipConvex(subject: readonly Pt[], clip: readonly Pt[]): Pt[] {
  let out: Pt[] = [...subject];
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const [ax, ay] = clip[i];
    const [bx, by] = clip[(i + 1) % clip.length];
    const len = Math.hypot(bx - ax, by - ay);
    const inside = ([x, y]: Pt) => (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= -1e-9 * len;
    const cross = ([px, py]: Pt, [qx, qy]: Pt): Pt => {
      const a1 = by - ay, b1 = ax - bx, c1 = a1 * ax + b1 * ay;
      const a2 = qy - py, b2 = px - qx, c2 = a2 * px + b2 * py;
      const det = a1 * b2 - a2 * b1;
      return Math.abs(det) <= 1e-9 * len * Math.hypot(a2, b2) ? [px, py] : [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
    };
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(cross(prev, cur));
      }
    }
  }
  return out;
}

function fillPolygon(d: StripPainter, pts: readonly Pt[]): void {
  if (pts.length < 3) return;
  d.beginPath();
  d.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) d.lineTo(pts[i][0], pts[i][1]);
  d.closePath();
  d.fill();
}

function fillStriped(
  d: StripPainter, outline: readonly Pt[], colors: readonly string[], stripeWidth: number,
  anchorX: number, top: number, h: number, xMin: number, xMax: number,
): void {
  d.fillStyle = colors[0];
  fillPolygon(d, outline);
  if (colors.length < 2 || stripeWidth <= 0) return;
  const n = colors.length;
  const kFrom = Math.floor((xMin - anchorX) / stripeWidth);
  const kTo = Math.ceil((xMax + h - anchorX) / stripeWidth);
  for (let k = kFrom; k <= kTo; k++) {
    const ci = ((k % n) + n) % n;
    if (ci === 0) continue;
    const c1 = anchorX + k * stripeWidth;
    const c2 = c1 + stripeWidth;
    const band: Pt[] = [[c1, top], [c2, top], [c2 - h, top + h], [c1 - h, top + h]];
    const piece = clipConvex(band, outline);
    if (piece.length < 3) continue;
    d.fillStyle = colors[ci];
    fillPolygon(d, piece);
  }
}

export interface PaintBaselineStripOptions {
  top: number;
  height: number;
  blend: number;
  stripeWidth: number;
  colorOf: (slot: BaselineSlot) => string;
  diamondSize: number;
  visibleX?: readonly [number, number];
}

export function paintBaselineStrip(
  d: StripPainter,
  bars: readonly BaselineBar[],
  diamonds: readonly BaselineDiamond[],
  o: PaintBaselineStripOptions,
): void {
  const [vMin, vMax] = o.visibleX ?? [-Infinity, Infinity];
  const clampX = (x: number) => Math.min(vMax, Math.max(vMin, x));
  const bottom = o.top + o.height;
  for (const lane of baselineLanes(bars, o.height, o.blend)) {
    const n = lane.x.length;
    if (n < 2 || lane.x[n - 1] < vMin || lane.x[0] > vMax) continue;
    d.fillStyle = o.colorOf(lane.slot);
    const edge: Pt[] = lane.x.map((x, i) => [clampX(x), o.top + lane.top[i]]);
    fillPolygon(d, [...edge, [clampX(lane.x[n - 1]), bottom], [clampX(lane.x[0]), bottom]]);
  }
  const s = o.diamondSize;
  const cy = o.top + o.height / 2;
  for (const dm of diamonds) {
    if (dm.x + s < vMin || dm.x - s > vMax) continue;
    const outline: Pt[] = [[dm.x, cy - s], [dm.x + s, cy], [dm.x, cy + s], [dm.x - s, cy]];
    fillStriped(d, outline, dm.slots.map(o.colorOf), o.stripeWidth, dm.x - s, cy - s, 2 * s, dm.x - s, dm.x + s);
  }
}
