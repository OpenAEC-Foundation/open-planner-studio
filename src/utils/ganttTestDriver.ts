import type { RefObject } from 'react';
import type { GanttRenderer } from '@/engine/renderer/GanttRenderer';

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

/** Registreert uitsluitend refs; rendererdata blijft eigendom van de gemounte Gantt. */
export function registerGanttTestSurface(
  surface: GanttTestSurface,
  refs: GanttTestRefs,
): () => void {
  surfaces.set(surface, refs);
  return () => {
    if (surfaces.get(surface) === refs) surfaces.delete(surface);
  };
}

/** Leest een renderer-eigen balkpunt en zet canvas-CSS-coördinaten om naar clientcoördinaten. */
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

/** Observer-only: wordt na een bestaande draw aangeroepen en kan zelf geen paint starten. */
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
