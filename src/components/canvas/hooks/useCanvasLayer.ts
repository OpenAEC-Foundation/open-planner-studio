import { RefObject, useCallback, useEffect } from 'react';

// De 3× identieke dpr/resize/render-loop-boilerplate uit GanttCanvas (audit P20/B1): drie
// canvas-lagen (primaire Gantt, secundair split-pane, histogram) deden elk exact dezelfde
// dance — dpr-schaling, canvas-pixel/CSS-maat synchroniseren, een teken-callback, plus een
// rAF-render-op-wijziging én een ResizeObserver. Dit hookt dat samen.
//
// De consument levert alleen een gememoiseerde `draw(ctx, width, height)` (de CSS-maten, ná
// dpr-schaling — teken dus in CSS-pixels, net als voorheen). De hook bezit:
//   - de dpr-schaling + canvas.width/height/style-synchronisatie;
//   - de requestAnimationFrame-render zodra `draw` (of een `extraDeps`-trigger) verandert;
//   - de ResizeObserver op de container die opnieuw tekent bij een maat-wijziging.
//
// `enabled` gate't alles (secundair pane / histogram staan conditioneel aan). `extraDeps` zijn
// extra herteken-triggers die 1-op-1 de oorspronkelijke expliciete effect-deps bewaren (het
// histogram hertekende óók op `histogramHeight`, ook al leest de teken-callback dat niet direct).
export interface UseCanvasLayerOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLElement | null>;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  enabled?: boolean;
  extraDeps?: unknown[];
}

export function useCanvasLayer({
  canvasRef,
  containerRef,
  draw,
  enabled = true,
  extraDeps = [],
}: UseCanvasLayerOptions): () => void {
  const paint = useCallback(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    draw(ctx, rect.width, rect.height);
  }, [canvasRef, containerRef, draw, enabled]);

  // Render-op-wijziging (was: `useEffect(() => rAF(render), [render])` per laag).
  useEffect(() => {
    if (!enabled) return;
    const frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
    // extraDeps: honoreert de originele expliciete herteken-triggers (bv. histogramHeight).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paint, enabled, ...extraDeps]);

  // ResizeObserver op de container (was: één observer-effect per laag).
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => requestAnimationFrame(paint));
    obs.observe(container);
    return () => obs.disconnect();
  }, [paint, enabled, containerRef]);

  return paint;
}
