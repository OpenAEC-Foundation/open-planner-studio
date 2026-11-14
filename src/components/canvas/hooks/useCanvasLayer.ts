import { RefObject, useCallback, useEffect, useEffectEvent } from 'react';

interface MeasuredCanvasBox {
  width: number;
  height: number;
  dpr: number;
  pixels: ResizeObserverSize;
}

// Ook de overlays gebruiken de gemeten pixelmaat van hun hoofdlaag.
const measuredBoxes = new WeakMap<HTMLElement, MeasuredCanvasBox>();

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
  if (rect.width <= 0 || rect.height <= 0) return null;
  const box = measuredBoxes.get(container);
  const pixels = box?.dpr === dpr && box.width === rect.width && box.height === rect.height
    ? box.pixels
    : undefined;
  // Rond beide randen af: bij een fractionele oorsprong kan round(breedte * dpr) afwijken.
  canvas.width = Math.max(1, pixels?.inlineSize ?? Math.round(rect.right * dpr) - Math.round(rect.left * dpr));
  canvas.height = Math.max(1, pixels?.blockSize ?? Math.round(rect.bottom * dpr) - Math.round(rect.top * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(canvas.width / rect.width, 0, 0, canvas.height / rect.height, 0, 0);
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

  const paintObservedSize = useEffectEvent(paint);

  // Observeer CSS-maat én device-pixels: beide kunnen onafhankelijk wijzigen.
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;
    let frame: number | undefined;
    const schedulePaint = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        paintObservedSize();
      });
    };
    const measure: ResizeObserverCallback = ([entry]) => {
      const pixels = entry.devicePixelContentBoxSize?.[0];
      if (pixels) {
        const { width, height } = container.getBoundingClientRect();
        measuredBoxes.set(container, { width, height, dpr: window.devicePixelRatio || 1, pixels });
      }
      schedulePaint();
    };
    const cssObserver = new ResizeObserver(measure);
    cssObserver.observe(container);
    const pixelObserver = new ResizeObserver(measure);
    if ('devicePixelContentBoxSize' in ResizeObserverEntry.prototype) {
      pixelObserver.observe(container, { box: 'device-pixel-content-box' });
    }

    // Ook browsers zonder device-pixel-box moeten hertekenen bij een monitorwissel.
    let resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onResolutionChange = () => {
      resolution.removeEventListener('change', onResolutionChange);
      resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      resolution.addEventListener('change', onResolutionChange);
      schedulePaint();
    };
    resolution.addEventListener('change', onResolutionChange);
    return () => {
      resolution.removeEventListener('change', onResolutionChange);
      cssObserver.disconnect();
      pixelObserver.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
      measuredBoxes.delete(container);
    };
  }, [enabled, containerRef]);

  return paint;
}
