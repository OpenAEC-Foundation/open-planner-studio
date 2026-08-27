import { useCallback, useEffect, useRef } from 'react';
import { computeAnchoredZoom, getGanttScrollBounds } from '@/utils/ganttViewport';
import { resolveWheelFunction } from '@/utils/ganttWheel';
import type { ModifierMap, PositionDivision, ScrollMode } from '@/state/slices/types';
import type { ViewState } from '@/types/view';

interface UseGanttZoomOpts {
  containerRef: React.RefObject<HTMLDivElement | null>;
  taskTableWidth: number;
  view: ViewState;
  enableQuarterHourZoom: boolean;
  scrollMode: ScrollMode;
  positionDivision: PositionDivision;
  modifierMap: ModifierMap;
  setZoom: (zoom: number) => void;
  setScroll: (x: number, y: number) => void;
}

const ZOOM_FACTOR_PER_TICK = 1.1;

export function useGanttZoom({
  containerRef,
  taskTableWidth,
  view,
  enableQuarterHourZoom,
  scrollMode,
  positionDivision,
  modifierMap,
  setZoom,
  setScroll,
}: UseGanttZoomOpts) {
  // Latest values in a ref so the wheel handler doesn't re-attach every render
  const latest = useRef({ view, enableQuarterHourZoom, scrollMode, positionDivision, modifierMap });
  latest.current = { view, enableQuarterHourZoom, scrollMode, positionDivision, modifierMap };

  // Cursor-anchored zoom step. anchorX is canvas-X (pixels from canvas left edge).
  const zoomAt = useCallback((newZoom: number, anchorX: number) => {
    const { view: v, enableQuarterHourZoom: enableQH } = latest.current;
    const next = computeAnchoredZoom({
      currentZoom: v.zoom,
      currentScrollX: v.scrollX,
      requestedZoom: newZoom,
      anchorX,
      taskTableWidth,
      maxZoom: enableQH ? 1000 : 400,
    });
    if (!next) return;
    setZoom(next.zoom);
    setScroll(next.scrollX, v.scrollY);
  }, [setZoom, setScroll, taskTableWidth]);

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

      // Decide which function this wheel event performs. De beslissing zelf staat in
      // `@/utils/ganttWheel` omdat het secundaire split-view-pane (GanttCanvas) exact dezelfde
      // semantiek moet volgen — met alleen andere doelen om naartoe te schrijven.
      const fn = resolveWheelFunction({
        mode,
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        fracX: rect.width > 0 ? anchorX / rect.width : 0,
        fracY: rect.height > 0 ? anchorY / rect.height : 0,
        division,
        map,
      });

      // Execute the chosen function.
      if (fn === 'zoom') {
        // Use the dominant delta so zoom direction is robust on trackpads too.
        const factor = delta > 0 ? 1 / ZOOM_FACTOR_PER_TICK : ZOOM_FACTOR_PER_TICK;
        zoomAt(v.zoom * factor, anchorX);
      } else if (fn === 'horizontal') {
        setScroll(v.scrollX + delta, v.scrollY);
      } else {
        // vertical: scroll task rows via view.scrollY (renderer offsets rows by it).
        // Valt het hele project verticaal binnen het venster (maxScrollY <= 0), dan is verticaal
        // scrollen een no-op → het gewone wiel voelt "dood" (vooral in de keys-modus, waar het
        // platte wiel per default verticaal is en de tijdlijn achter Shift zit). Val in dat geval
        // terug op horizontaal, zodat het wiel altijd íets zichtbaars doet. `maxScrollY === null`
        // = nog geen render-pass geweest (headless) → ongewijzigd verticaal.
        const { maxScrollY } = getGanttScrollBounds();
        if (maxScrollY !== null && maxScrollY <= 0) {
          setScroll(v.scrollX + delta, v.scrollY);
        } else {
          setScroll(v.scrollX, v.scrollY + delta);
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [containerRef, setScroll, zoomAt]);

  return { zoomAt };
}
