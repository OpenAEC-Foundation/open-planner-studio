import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useResolvedUITheme } from '@/hooks/useResolvedUITheme';
import { MiniMapRenderer } from '@/engine/renderer/MiniMapRenderer';
import { useCanvasLayer } from './hooks/useCanvasLayer';
import { listenWindowDrag } from '@/hooks/listenWindowDrag';

const MINIMAP_HEIGHT = 48;

interface MiniMapProps {
  originDate: string;
  timelineWidth: number;
  scrollX?: number;
  zoom?: number;
  onScrollXChange?: (scrollX: number) => void;
  testId?: string;
  axisDayOf?: (date: Date) => number;
}

export function MiniMap({
  originDate,
  timelineWidth,
  scrollX: scrollXProp,
  zoom: zoomProp,
  onScrollXChange,
  testId = 'minimap',
  axisDayOf,
}: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MiniMapRenderer | null>(null);

  const viewRows = useAppStore(s => s.viewRows);
  const storeScrollX = useAppStore(s => s.view.scrollX);
  const storeZoom = useAppStore(s => s.view.zoom);
  const setScroll = useAppStore(s => s.setScroll);
  const themeRevision = useResolvedUITheme();

  const scrollX = scrollXProp ?? storeScrollX;
  const zoom = zoomProp ?? storeZoom;

  const applyScrollX = useCallback((next: number) => {
    const clamped = Math.max(0, next);
    if (onScrollXChange) onScrollXChange(clamped);
    else setScroll(clamped, useAppStore.getState().view.scrollY);
  }, [onScrollXChange, setScroll]);

  const [dragOffsetDays, setDragOffsetDays] = useState<number | null>(null);

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const renderer = new MiniMapRenderer(ctx, {
      rows: viewRows,
      canvasWidth: width,
      canvasHeight: height,
      originDate,
      scrollX,
      zoom,
      chartWidth: timelineWidth,
      axisDayOf,
    });
    rendererRef.current = renderer;
    renderer.render();
  }, [viewRows, originDate, scrollX, zoom, timelineWidth, axisDayOf]);

  useCanvasLayer({
    canvasRef,
    containerRef,
    draw,
    renderRevision: themeRevision,
  });

  const scrollXForMiniX = useCallback((miniX: number, offsetDays: number): number | null => {
    const renderer = rendererRef.current;
    if (!renderer) return null;
    const day = renderer.miniXToDay(miniX);
    if (day === null) return null;
    return Math.max(0, (day - offsetDays) * zoom);
  }, [zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frame = renderer.frameBounds();
    const day = renderer.miniXToDay(x);
    if (day === null) return;

    if (frame && x >= frame.x && x <= frame.x + frame.w) {
      const leftDay = scrollX / zoom;
      setDragOffsetDays(day - leftDay);
    } else {
      const halfDays = timelineWidth > 0 ? timelineWidth / 2 / zoom : 0;
      applyScrollX((day - halfDays) * zoom);
      setDragOffsetDays(halfDays);
    }
  }, [scrollX, zoom, timelineWidth, applyScrollX]);

  useEffect(() => {
    if (dragOffsetDays === null) return;
    const handleMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const next = scrollXForMiniX(x, dragOffsetDays);
      if (next !== null) applyScrollX(next);
    };
    const handleUp = () => setDragOffsetDays(null);
    return listenWindowDrag({ onMove: handleMove, onUp: handleUp, onDocumentSwitch: handleUp });
  }, [dragOffsetDays, scrollXForMiniX, applyScrollX]);

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      className="relative overflow-hidden"
      style={{ height: MINIMAP_HEIGHT, flexShrink: 0 }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ cursor: dragOffsetDays !== null ? 'grabbing' : 'pointer', maxWidth: '100%', maxHeight: '100%' }}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
