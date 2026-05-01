import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';

interface UseGanttZoomOpts {
  containerRef: React.RefObject<HTMLDivElement | null>;
  taskTableWidth: number;
}

const ZOOM_FACTOR_PER_TICK = 1.1;

export function useGanttZoom({ containerRef, taskTableWidth }: UseGanttZoomOpts) {
  const view = useAppStore(s => s.view);
  const setZoom = useAppStore(s => s.setZoom);
  const setScroll = useAppStore(s => s.setScroll);
  const enableQuarterHourZoom = useAppStore(s => s.ui.enableQuarterHourZoom);

  // Latest values in a ref so the wheel handler doesn't re-attach every render
  const latest = useRef({ view, enableQuarterHourZoom });
  latest.current = { view, enableQuarterHourZoom };

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

    setZoom(clamped);
    setScroll(newScrollX, v.scrollY);
  };

  // Wheel handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      const { view: v } = latest.current;

      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY > 0 ? 1 / ZOOM_FACTOR_PER_TICK : ZOOM_FACTOR_PER_TICK;
        zoomAt(v.zoom * factor, anchorX);
        return;
      }

      if (e.shiftKey) {
        setScroll(v.scrollX, v.scrollY + e.deltaY);
      } else {
        setScroll(v.scrollX + e.deltaY, v.scrollY);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [containerRef, taskTableWidth, setZoom, setScroll]);

  return { zoomAt };
}
