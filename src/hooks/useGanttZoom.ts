import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { computeTimelineZoom, getGanttScrollBounds } from '@/utils/ganttViewport';
import { resolveWheelFunction } from '@/utils/ganttWheel';

interface UseGanttZoomOpts {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const ZOOM_FACTOR_PER_TICK = 1.1;

export function useGanttZoom({ containerRef }: UseGanttZoomOpts) {
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
    const next = computeTimelineZoom(v.zoom, newZoom, v.scrollX, anchorX, max);
    if (next.zoom === v.zoom) return;

    setZoom(next.zoom);
    setScroll(next.scrollX, v.scrollY);
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
  }, [containerRef, setZoom, setScroll]);

  return { zoomAt };
}
