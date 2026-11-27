import type { RefObject } from 'react';
import type { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { parseDate } from '@/utils/dateUtils';

export type GanttTestSurface = 'primary' | 'secondary';
export type GanttPaintSurface = GanttTestSurface | 'histogram';

interface GanttTestRefs {
  canvas: RefObject<HTMLCanvasElement | null>;
  renderer: RefObject<GanttRenderer | null>;
}

const surfaces = new Map<GanttTestSurface, GanttTestRefs>();
const paints: Record<GanttPaintSurface, {
  count: number;
  last: { width: number; height: number } | null;
}> = {
  primary: { count: 0, last: null },
  secondary: { count: 0, last: null },
  histogram: { count: 0, last: null },
};

export function registerGanttTestSurface(
  surface: GanttTestSurface,
  refs: GanttTestRefs,
): () => void {
  surfaces.set(surface, refs);
  return () => {
    if (surfaces.get(surface) === refs) surfaces.delete(surface);
  };
}

export function taskBarPoint(
  taskId: string,
  edge: 'left' | 'body' | 'right' = 'body',
  surface: GanttTestSurface = 'primary',
): { x: number; y: number } | null {
  const refs = surfaces.get(surface);
  const canvas = refs?.canvas.current;
  const renderer = refs?.renderer.current;
  if (!canvas || !renderer) return null;
  const bar = renderer.getTaskBarRect(taskId);
  if (!bar) return null;

  const canvasX = edge === 'left'
    ? bar.left
    : edge === 'right'
      ? bar.right
      : (bar.left + bar.right) / 2;
  const canvasY = (bar.top + bar.bottom) / 2;
  const bounds = canvas.getBoundingClientRect();
  return { x: bounds.left + canvasX, y: bounds.top + canvasY };
}

export function dateX(isoDate: string, surface: GanttTestSurface = 'primary'): number | null {
  const renderer = surfaces.get(surface)?.renderer.current;
  return renderer ? renderer.dateToX(parseDate(isoDate)) : null;
}

export function taskSegmentCount(taskId: string, surface: GanttTestSurface = 'primary'): number | null {
  const renderer = surfaces.get(surface)?.renderer.current;
  return renderer ? renderer.getDrawnSegmentCount(taskId) : null;
}

export function recordGanttPaint(surface: GanttPaintSurface, width: number, height: number): void {
  const paint = paints[surface];
  paint.count += 1;
  paint.last = { width, height };
}

export function paintCount(surface: GanttPaintSurface): number {
  return paints[surface].count;
}

export function lastSize(surface: GanttPaintSurface): { width: number; height: number } | null {
  const size = paints[surface].last;
  return size ? { ...size } : null;
}
