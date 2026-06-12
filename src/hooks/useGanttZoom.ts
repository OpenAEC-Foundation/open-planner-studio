import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import type { WheelFunction } from '@/state/slices/types';

interface UseGanttZoomOpts {
  containerRef: React.RefObject<HTMLDivElement | null>;
  taskTableWidth: number;
}

const ZOOM_FACTOR_PER_TICK = 1.1;

// Position-mode split thresholds (fixed, no user slider for now).
const HORIZONTAL_SPLIT = 0.5; // fraction of width: left half vs right half
const VERTICAL_BAND = 0.3;    // fraction of height: top band (near timescale)

export function useGanttZoom({ containerRef, taskTableWidth }: UseGanttZoomOpts) {
  const view = useAppStore(s => s.view);
  const setZoom = useAppStore(s => s.setZoom);
  const setScroll = useAppStore(s => s.setScroll);
  const enableQuarterHourZoom = useAppStore(s => s.ui.enableQuarterHourZoom);
  const scrollMode = useAppStore(s => s.ui.scrollMode);
  const positionDivision = useAppStore(s => s.ui.positionDivision);
  const modifierMap = useAppStore(s => s.ui.modifierMap);

  // Latest values in a ref so the wheel handler doesn't re-attach every render
  const latest = useRef({ view, enableQuarterHourZoom, scrollMode, positionDivision, modifierMap });
  latest.current = { view, enableQuarterHourZoom, scrollMode, positionDivision, modifierMap };

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
      const anchorY = e.clientY - rect.top;
      const {
        view: v,
        scrollMode: mode,
        positionDivision: division,
        modifierMap: map,
      } = latest.current;

      // Pick the dominant delta. Trackpads report deltaX for horizontal
      // gestures; for a single magnitude we use whichever axis moved more so
      // the chosen action still gets a sensible scalar amount.
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

      // Decide which function this wheel event performs.
      let fn: WheelFunction;
      if (mode === 'drag') {
        // Drag mode: the wheel always zooms (cursor-anchored), no modifier
        // needed. Panning is done by dragging the canvas (see GanttCanvas).
        fn = 'zoom';
      } else if (mode === 'modifier') {
        if (e.ctrlKey || e.metaKey) fn = map.ctrl;
        else if (e.shiftKey) fn = map.shift;
        else fn = map.plain;
      } else {
        // position mode: modifiers are fixed overrides, otherwise by cursor.
        if (e.ctrlKey || e.metaKey) {
          fn = 'zoom';
        } else if (e.shiftKey) {
          fn = 'horizontal';
        } else {
          const fracX = rect.width > 0 ? anchorX / rect.width : 0;
          const fracY = rect.height > 0 ? anchorY / rect.height : 0;
          if (division === 'left-right') {
            fn = fracX < HORIZONTAL_SPLIT ? 'vertical' : 'horizontal';
          } else if (division === 'top-bottom') {
            // Top band (near the timescale) pans horizontally; below scrolls rows.
            fn = fracY < VERTICAL_BAND ? 'horizontal' : 'vertical';
          } else {
            // corner: top-right quadrant pans horizontally; everything else vertical.
            const topRight = fracX >= HORIZONTAL_SPLIT && fracY < 0.5;
            fn = topRight ? 'horizontal' : 'vertical';
          }
        }
      }

      // Execute the chosen function.
      if (fn === 'zoom') {
        // Use the dominant delta so zoom direction is robust on trackpads too.
        const factor = delta > 0 ? 1 / ZOOM_FACTOR_PER_TICK : ZOOM_FACTOR_PER_TICK;
        zoomAt(v.zoom * factor, anchorX);
      } else if (fn === 'horizontal') {
        setScroll(v.scrollX + delta, v.scrollY);
      } else {
        // vertical: scroll task rows via view.scrollY (renderer offsets rows by it).
        setScroll(v.scrollX, v.scrollY + delta);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [containerRef, taskTableWidth, setZoom, setScroll]);

  return { zoomAt };
}
