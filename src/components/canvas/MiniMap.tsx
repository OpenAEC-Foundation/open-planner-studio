// Mini-map-strip onder de Gantt (fase 2.7, §11): thumbnail van de hele projectperiode
// (MiniMapRenderer, 1 fillRect per taakrij) + sleepbaar viewport-kader gekoppeld aan
// view.scrollX. Klik centreert het hoofdvenster; het kader toont het primaire pane (§10.3).

import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { MiniMapRenderer } from '@/engine/renderer/MiniMapRenderer';

const MINIMAP_HEIGHT = 48;

interface MiniMapProps {
  /** Datum die in het hoofdvenster op scrollX = 0 ligt (effectiveViewStart van GanttCanvas). */
  originDate: string;
  /** Breedte van het zichtbare chart-gedeelte van het primaire pane (px). */
  chartWidth: number;
}

export function MiniMap({ originDate, chartWidth }: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MiniMapRenderer | null>(null);

  const viewRows = useAppStore(s => s.viewRows);
  const scrollX = useAppStore(s => s.view.scrollX);
  const scrollY = useAppStore(s => s.view.scrollY);
  const zoom = useAppStore(s => s.view.zoom);
  const setScroll = useAppStore(s => s.setScroll);
  const uiTheme = useAppStore(s => s.ui.uiTheme);

  // Sleepstate: offset (in dagen) tussen de muispositie en de linkerrand van het kader.
  const [dragOffsetDays, setDragOffsetDays] = useState<number | null>(null);

  const render = useCallback(() => {
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
    const renderer = new MiniMapRenderer(ctx, {
      rows: viewRows,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      originDate,
      scrollX,
      zoom,
      chartWidth,
    });
    rendererRef.current = renderer;
    renderer.render();
  }, [viewRows, originDate, scrollX, zoom, chartWidth, uiTheme]);

  // Debounced redraw (§11/§17-risico 3): alleen op discrete wijzigingen, via rAF gecoalesced.
  useEffect(() => {
    const frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [render]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => requestAnimationFrame(render));
    obs.observe(container);
    return () => obs.disconnect();
  }, [render]);

  /** Zet een strip-x om naar de bijbehorende scrollX van het hoofdvenster. */
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
      // Greep binnen het kader: sleep met behoud van de greep-offset.
      const leftDay = scrollX / zoom;
      setDragOffsetDays(day - leftDay);
    } else {
      // Klik buiten het kader: centreer het hoofdvenster op het aangeklikte punt (§11.2)
      // en sleep daarna vanuit het midden verder.
      const halfDays = chartWidth > 0 ? chartWidth / 2 / zoom : 0;
      setScroll(Math.max(0, (day - halfDays) * zoom), scrollY);
      setDragOffsetDays(halfDays);
    }
  }, [scrollX, scrollY, zoom, chartWidth, setScroll]);

  useEffect(() => {
    if (dragOffsetDays === null) return;
    const handleMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const next = scrollXForMiniX(x, dragOffsetDays);
      if (next !== null) {
        const v = useAppStore.getState().view;
        setScroll(next, v.scrollY);
      }
    };
    const handleUp = () => setDragOffsetDays(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragOffsetDays, scrollXForMiniX, setScroll]);

  return (
    <div
      ref={containerRef}
      data-testid="minimap"
      className="relative overflow-hidden"
      style={{ height: MINIMAP_HEIGHT, flexShrink: 0 }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ cursor: dragOffsetDays !== null ? 'grabbing' : 'pointer' }}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
