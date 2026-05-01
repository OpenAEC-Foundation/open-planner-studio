import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';

interface UseGanttZoomOpts {
  containerRef: React.RefObject<HTMLDivElement | null>;
  taskTableWidth: number;
}

const ZOOM_FACTOR_PER_TICK = 1.1;
const ANIM_DURATION_MS = 180;

export function useGanttZoom({ containerRef, taskTableWidth }: UseGanttZoomOpts) {
  const view = useAppStore(s => s.view);
  const setZoom = useAppStore(s => s.setZoom);
  const setScroll = useAppStore(s => s.setScroll);
  const mouseWheelMode = useAppStore(s => s.ui.mouseWheelMode);
  const enableQuarterHourZoom = useAppStore(s => s.ui.enableQuarterHourZoom);
  const smoothZoom = useAppStore(s => s.ui.smoothZoom);

  // Latest values in a ref so the wheel handler doesn't re-attach every render
  const latest = useRef({ view, mouseWheelMode, enableQuarterHourZoom, smoothZoom });
  latest.current = { view, mouseWheelMode, enableQuarterHourZoom, smoothZoom };

  const animRef = useRef<number | null>(null);

  // Cursor-anchored zoom step. anchorX is canvas-X (pixels from canvas left edge).
  const zoomAt = (newZoom: number, anchorX: number) => {
    const { view: v, enableQuarterHourZoom: enableQH } = latest.current;
    const max = enableQH ? 1000 : 400;
    const clamped = Math.max(0.5, Math.min(max, newZoom));
    if (clamped === v.zoom) return;

    // Date under the cursor at current zoom (in fractional days from viewStart)
    const localX = anchorX - taskTableWidth + v.scrollX;
    const daysUnderCursor = localX / v.zoom;

    // New scrollX so the same fractional day stays under the cursor
    const newScrollX = Math.max(0, daysUnderCursor * clamped - (anchorX - taskTableWidth));

    if (latest.current.smoothZoom) {
      animateTo(clamped, newScrollX);
    } else {
      setZoom(clamped);
      setScroll(newScrollX, v.scrollY);
    }
  };

  const animateTo = (targetZoom: number, targetScrollX: number) => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    const startZoom = latest.current.view.zoom;
    const startScrollX = latest.current.view.scrollX;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / ANIM_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      const z = startZoom + (targetZoom - startZoom) * eased;
      const x = startScrollX + (targetScrollX - startScrollX) * eased;
      setZoom(z);
      setScroll(x, latest.current.view.scrollY);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
      else animRef.current = null;
    };
    animRef.current = requestAnimationFrame(tick);
  };

  // Wheel handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      const { mouseWheelMode: mode, view: v } = latest.current;

      const isZoomGesture =
        e.ctrlKey || e.metaKey ||
        (mode === 'zoom' && !e.shiftKey);

      if (isZoomGesture) {
        const factor = e.deltaY > 0 ? 1 / ZOOM_FACTOR_PER_TICK : ZOOM_FACTOR_PER_TICK;
        zoomAt(v.zoom * factor, anchorX);
        return;
      }

      // Scroll path
      if (mode === 'zoom' && e.shiftKey) {
        // Shift+wheel scrolls horizontally
        setScroll(v.scrollX + e.deltaY, v.scrollY);
      } else if (mode === 'scroll') {
        if (e.shiftKey) {
          setScroll(v.scrollX + e.deltaY, v.scrollY);
        } else {
          setScroll(v.scrollX + e.deltaX, v.scrollY + e.deltaY);
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [containerRef, taskTableWidth, setZoom, setScroll]);

  return { zoomAt };
}
