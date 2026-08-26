// Mini-map-strip onder de Gantt (fase 2.7, §11): thumbnail van de hele projectperiode
// (MiniMapRenderer, 1 fillRect per taakrij) + sleepbaar viewport-kader gekoppeld aan
// view.scrollX. Klik centreert het bestuurde venster; standaard is dat het primaire pane (§10.3).
// Bij split view mount GanttCanvas een tweede strook die via de props het secundaire tijdvenster
// bestuurt (issue #35 punt 1) — één component, twee bestuurde vensters.

import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { MiniMapRenderer } from '@/engine/renderer/MiniMapRenderer';

const MINIMAP_HEIGHT = 48;

interface MiniMapProps {
  /** Datum die in het hoofdvenster op scrollX = 0 ligt (effectiveViewStart van GanttCanvas). */
  originDate: string;
  /** Werkelijk gemeten breedte van het bestuurde tijdlijnpaneel (px). */
  timelineWidth: number;
  /** Issue #35 punt 1 — bestuurde tijdvenster. Alle drie afwezig ⇒ het PRIMAIRE pane: de strip
   *  leest `view.scrollX`/`view.zoom` en schrijft via `setScroll` (ongewijzigd gedrag). Meegegeven
   *  ⇒ een tweede strip die het secundaire split-view-venster bestuurt
   *  (`splitView.secondaryScrollX`/`secondaryZoom`) zonder de gedeelde `view` aan te raken. De
   *  store-selectors hieronder blijven onvoorwaardelijk draaien (hooks-regel); pas ná het lezen
   *  kiezen we welke waarde geldt. */
  scrollX?: number;
  zoom?: number;
  onScrollXChange?: (scrollX: number) => void;
  /** Onderscheidt de twee stroken in self-tests; default is de bestaande 'minimap'. */
  testId?: string;
}

export function MiniMap({
  originDate,
  timelineWidth,
  scrollX: scrollXProp,
  zoom: zoomProp,
  onScrollXChange,
  testId = 'minimap',
}: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MiniMapRenderer | null>(null);

  const viewRows = useAppStore(s => s.viewRows);
  const storeScrollX = useAppStore(s => s.view.scrollX);
  const storeZoom = useAppStore(s => s.view.zoom);
  const setScroll = useAppStore(s => s.setScroll);
  const uiTheme = useAppStore(s => s.ui.uiTheme);

  const scrollX = scrollXProp ?? storeScrollX;
  const zoom = zoomProp ?? storeZoom;

  /** Enige schrijfweg van de strip. Het primaire pad houdt `view.scrollY` ongemoeid — vers uit de
   *  store, want tussen render en muis-event kan er verticaal gescrold zijn (de sleep-lus deed dat
   *  al zo; `scrollY` hoeft daarom geen abonnement meer te zijn, wat een re-render per
   *  verticale scroll scheelt). */
  const applyScrollX = useCallback((next: number) => {
    const clamped = Math.max(0, next);
    if (onScrollXChange) onScrollXChange(clamped);
    else setScroll(clamped, useAppStore.getState().view.scrollY);
  }, [onScrollXChange, setScroll]);

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
      chartWidth: timelineWidth,
    });
    rendererRef.current = renderer;
    renderer.render();
  }, [viewRows, originDate, scrollX, zoom, timelineWidth, uiTheme]);

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
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
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
        // maxWidth/maxHeight (issue #30): <canvas> is een replaced element — vóór de eerste
        // rAF-render (of wanneer die om wat voor reden dan ook uitblijft) valt `width`/`height`
        // zonder eigen stijl terug op het browser-intrinsieke 300×150 i.p.v. mee te stretchen met
        // `inset-0`. Deze twee regels zorgen dat de canvas nooit méér ruimte claimt dan de
        // (wél altijd correct gestretchte) container, ongeacht die race.
        style={{ cursor: dragOffsetDays !== null ? 'grabbing' : 'pointer', maxWidth: '100%', maxHeight: '100%' }}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
