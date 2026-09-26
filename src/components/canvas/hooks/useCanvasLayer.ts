import { RefObject, useCallback, useEffect } from 'react';

/** Lokale timelinegrens: de linker pixel is 0, de eerste pixel buiten beeld is exact `width`. */
export function isTimelineCanvasX(x: number, width: number): boolean {
  return x >= 0 && x < width;
}

/**
 * Zet `canvas` op de maat van `container`: dpr-geschaalde pixelmaat, CSS-maat en een context die
 * in CSS-pixels tekent. `null` als er geen 2D-context is. Gedeeld door de canvaslagen hieronder en
 * de overlay-tekenaars (relatiesleep, splits-geleidelijn).
 */
export function sizeCanvasToContainer(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
): { ctx: CanvasRenderingContext2D; width: number; height: number } | null {
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  return { ctx, width: rect.width, height: rect.height };
}

/** Accentkleur van het actieve thema voor overlaytekeningen (terugval: amber). */
export function readAccentColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim() || '#F59E0B';
}

// De gedeelde dpr/resize/render-loop van de drie canvas-lagen (primaire Gantt, secundair
// split-pane, histogram): dpr-schaling, canvas-pixel/CSS-maat synchroniseren, een teken-callback,
// plus een rAF-render-op-wijziging én een ResizeObserver.
//
// De consument levert alleen een gememoiseerde `draw(ctx, width, height)` (de CSS-maten, ná
// dpr-schaling — teken dus in CSS-pixels). De hook bezit:
//   - de dpr-schaling + canvas.width/height/style-synchronisatie;
//   - de requestAnimationFrame-render zodra `draw` (of een expliciete primitive revision) verandert;
//   - de ResizeObserver op de container die opnieuw tekent bij een maat-wijziging.
//
// `enabled` gate't alles (secundair pane / histogram staan conditioneel aan). `renderRevision` is
// bewust één primitive: de consumer benoemt zo zijn niet-door-`draw` gelezen invalidatie zonder
// een verborgen spread-dependency of een lintonderdrukking in deze generieke hook.
export interface UseCanvasLayerOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLElement | null>;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  enabled?: boolean;
  renderRevision?: string | number;
}

export function useCanvasLayer({
  canvasRef,
  containerRef,
  draw,
  enabled = true,
  renderRevision,
}: UseCanvasLayerOptions): () => void {
  const paint = useCallback(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const layer = sizeCanvasToContainer(canvas, container);
    if (layer) draw(layer.ctx, layer.width, layer.height);
  }, [canvasRef, containerRef, draw, enabled]);

  // Render-op-wijziging (was: `useEffect(() => rAF(render), [render])` per laag).
  useEffect(() => {
    if (!enabled) return;
    const frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [paint, enabled, renderRevision]);

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
