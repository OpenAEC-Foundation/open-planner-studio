import { useCallback, useEffect, useRef } from 'react';
import { computeTimelineZoom, getGanttScrollBounds } from '@/utils/ganttViewport';
import { resolveWheelFunction } from '@/utils/ganttWheel';
import { maxGanttZoom } from '@/engine/renderer/timelineTiers';
import type { ModifierMap, PositionDivision, ScrollMode } from '@/state/slices/types';
import type { ViewState } from '@/types/view';

interface UseGanttZoomOpts {
  containerRef: React.RefObject<HTMLDivElement | null>;
  view: ViewState;
  enableQuarterHourZoom: boolean;
  scrollMode: ScrollMode;
  positionDivision: PositionDivision;
  modifierMap: ModifierMap;
  setZoom: (zoom: number) => void;
  setScroll: (x: number, y: number) => void;
  prepareScrollBounds?: (zoom: number) => void;
}

const ZOOM_FACTOR_PER_TICK = 1.1;

export function useGanttZoom({
  containerRef,
  view,
  enableQuarterHourZoom,

  scrollMode,
  positionDivision,
  modifierMap,
  setZoom,
  setScroll,
  prepareScrollBounds,
}: UseGanttZoomOpts) {
  const latest = useRef({ view, enableQuarterHourZoom, scrollMode, positionDivision, modifierMap });
  latest.current = { view, enableQuarterHourZoom, scrollMode, positionDivision, modifierMap };

  const zoomAt = useCallback((newZoom: number, anchorX: number) => {
    const { view: v, enableQuarterHourZoom: enableQH } = latest.current;
    const next = computeTimelineZoom(
      v.zoom,
      newZoom,
      v.scrollX,
      anchorX,
      maxGanttZoom(enableQH),
    );
    if (next.zoom === v.zoom) return;
    prepareScrollBounds?.(next.zoom);
    setZoom(next.zoom);
    setScroll(next.scrollX, v.scrollY);
  }, [setZoom, setScroll, prepareScrollBounds]);

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

      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

      const fn = resolveWheelFunction({
        mode,
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        fracX: rect.width > 0 ? anchorX / rect.width : 0,
        fracY: rect.height > 0 ? anchorY / rect.height : 0,
        division,
        map,
      });

      if (fn === 'zoom') {
        const factor = delta > 0 ? 1 / ZOOM_FACTOR_PER_TICK : ZOOM_FACTOR_PER_TICK;
        zoomAt(v.zoom * factor, anchorX);
      } else if (fn === 'horizontal') {
        setScroll(v.scrollX + delta, v.scrollY);
      } else {
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
