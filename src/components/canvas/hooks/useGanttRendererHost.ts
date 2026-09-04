import { useCallback, useEffect, useRef } from 'react';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { HistogramRenderer } from '@/engine/renderer/HistogramRenderer';
import {
  recordGanttPaint,
  registerGanttTestSurface,
  type GanttPaintSurface,
} from '@/utils/ganttTestDriver';
import { buildGanttRenderOptions, type GanttRenderOptionsSourceInput } from '../ganttRenderOptions';
import { useCanvasLayer } from './useCanvasLayer';
import type { GanttRendererHost, GanttRendererHostInput } from './ganttCoordinatorTypes';

/**
 * De ene constructieroute voor primaire en secundaire Gantt-paints. De aanroeper levert alle
 * inhoudelijke opties; alleen de op painttijd gemeten canvasafmetingen worden hier toegevoegd.
 */
function renderGantt(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  input: GanttRenderOptionsSourceInput,
  rendererRef: GanttRendererHost['primaryRendererRef'],
  surface: Exclude<GanttPaintSurface, 'histogram'>,
): void {
  const renderer = new GanttRenderer(ctx, buildGanttRenderOptions({
    ...input,
    canvasWidth: width,
    canvasHeight: height,
  }));
  rendererRef.current = renderer;
  renderer.render();
  if (import.meta.env.DEV) recordGanttPaint(surface, width, height);
}

/** Maakt de stabiele refs waarmee pointercoördinatie vóór de renderoptie-afleiding kan worden samengesteld. */
export function useGanttRendererRefs(): GanttRendererHost {
  const primaryCanvasRef = useRef<HTMLCanvasElement>(null);
  const primaryRendererRef = useRef<GanttRenderer | null>(null);
  const secondaryCanvasRef = useRef<HTMLCanvasElement>(null);
  const secondaryRendererRef = useRef<GanttRenderer | null>(null);
  const histogramCanvasRef = useRef<HTMLCanvasElement>(null);
  const histogramRendererRef = useRef<HistogramRenderer | null>(null);
  const dependencyCanvasRef = useRef<HTMLCanvasElement>(null);
  return {
    primaryCanvasRef,
    primaryRendererRef,
    secondaryCanvasRef,
    secondaryRendererRef,
    histogramCanvasRef,
    histogramRendererRef,
    dependencyCanvasRef,
  };
}

/**
 * Bezit de drie canvaslagen, rendererinstanties en hun mount/resize-lifecycle. De host leest geen
 * store en leidt geen domeinopties af; GanttCanvas levert daarvoor expliciete, getypeerde invoer.
 */
export function useGanttRendererHost(
  input: GanttRendererHostInput,
  refs: GanttRendererHost,
): GanttRendererHost {
  const {
    primaryCanvasRef,
    primaryRendererRef,
    secondaryCanvasRef,
    secondaryRendererRef,
    histogramCanvasRef,
    histogramRendererRef,
    dependencyCanvasRef,
  } = refs;

  // Dev-only browsernaad: uitsluitend de levende canvas-/rendererrefs; geen rendererdata en geen
  // mogelijkheid om vanuit de driver een paint of productmutatie te starten.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const unregisterPrimary = registerGanttTestSurface('primary', {
      canvas: primaryCanvasRef,
      renderer: primaryRendererRef,
    });
    const unregisterSecondary = registerGanttTestSurface('secondary', {
      canvas: secondaryCanvasRef,
      renderer: secondaryRendererRef,
    });
    return () => {
      unregisterSecondary();
      unregisterPrimary();
    };
  }, [primaryCanvasRef, primaryRendererRef, secondaryCanvasRef, secondaryRendererRef]);

  const { onPrimarySize, primary } = input;
  const drawPrimary = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    onPrimarySize(width, height);
    renderGantt(ctx, width, height, primary, primaryRendererRef, 'primary');
  }, [onPrimarySize, primary, primaryRendererRef]);

  useCanvasLayer({
    canvasRef: primaryCanvasRef,
    containerRef: input.containers.primaryContainerRef,
    draw: drawPrimary,
    renderRevision: input.renderRevision,
  });

  const { onSecondarySize, secondary } = input;
  const drawSecondary = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    if (!secondary) return;
    onSecondarySize(width, height);
    renderGantt(ctx, width, height, secondary, secondaryRendererRef, 'secondary');
  }, [onSecondarySize, secondary, secondaryRendererRef]);

  useCanvasLayer({
    canvasRef: secondaryCanvasRef,
    containerRef: input.containers.secondaryContainerRef,
    draw: drawSecondary,
    enabled: input.secondary !== undefined,
    renderRevision: input.renderRevision,
  });

  useEffect(() => {
    if (!input.secondary) secondaryRendererRef.current = null;
  }, [input.secondary, secondaryRendererRef]);

  const drawHistogram = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    if (!input.histogram) return;
    const renderer = new HistogramRenderer(ctx, {
      ...input.histogram,
      canvasWidth: width,
      canvasHeight: height,
    });
    histogramRendererRef.current = renderer;
    renderer.render();
    if (import.meta.env.DEV) recordGanttPaint('histogram', width, height);
  }, [input.histogram, histogramRendererRef]);

  useCanvasLayer({
    canvasRef: histogramCanvasRef,
    containerRef: input.containers.histogramContainerRef,
    draw: drawHistogram,
    enabled: input.histogram !== undefined,
    renderRevision: input.renderRevision,
  });

  useEffect(() => {
    if (!input.histogram) histogramRendererRef.current = null;
  }, [input.histogram, histogramRendererRef]);

  return {
    primaryCanvasRef,
    primaryRendererRef,
    secondaryCanvasRef,
    secondaryRendererRef,
    histogramCanvasRef,
    histogramRendererRef,
    dependencyCanvasRef,
  };
}
