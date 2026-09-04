import { RefObject, useEffect, useState } from 'react';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { isTimelineCanvasX } from './useCanvasLayer';

export interface DependencyDragState {
  sourceTaskId: string;
  sourceX: number;
  sourceY: number;
  currentX: number;
  currentY: number;
}

interface UseDependencyDrawOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLElement | null>;
  depLineCanvasRef: RefObject<HTMLCanvasElement | null>;
  rendererRef: RefObject<GanttRenderer | null>;
  /** Op een geldig eindpunt opent de Gantt hier de conceptrelatie-popover. De projectmutatie
   *  gebeurt pas wanneer de gebruiker de popover normaal sluit. */
  onRelationDrawn: (sourceTaskId: string, targetTaskId: string, clientX: number, clientY: number) => void;
}

// Dependency-draw (drag van balk A naar balk B → FS-relatie + correctie-popover). Gearmd door
// shift ingedrukt te houden ÓF door de relatiemodus (`ui.showDependencyMode`, issue #40 — de
// lint-knop als "plakkende Shift"); die keuze zit in het centrale mousedown-hittest van de
// pointercoordinator, die `startDepDraw(...)` aanroept. Deze hook bezit `depDragState`, de
// window-listeners voor de sleep, én het tekenen van de tijdelijke pijl op het overlay-canvas.
export function useDependencyDraw({
  canvasRef,
  containerRef,
  depLineCanvasRef,
  rendererRef,
  onRelationDrawn,
}: UseDependencyDrawOptions) {
  const [depDragState, setDepDragState] = useState<DependencyDragState | null>(null);

  // Dependency drag: draw temporary line and handle release
  useEffect(() => {
    if (!depDragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDepDragState(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (canvas && renderer) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const targetTask = renderer.getTaskAtY(y);
        if (targetTask && targetTask.id !== depDragState.sourceTaskId && isTimelineCanvasX(x, rect.width)) {
          onRelationDrawn(depDragState.sourceTaskId, targetTask.id, e.clientX, e.clientY);
        }
      }
      setDepDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [depDragState, canvasRef, rendererRef, onRelationDrawn]);

  // Draw temporary dependency line on overlay canvas
  useEffect(() => {
    const depCanvas = depLineCanvasRef.current;
    const container = containerRef.current;
    if (!depCanvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    depCanvas.width = rect.width * dpr;
    depCanvas.height = rect.height * dpr;
    depCanvas.style.width = `${rect.width}px`;
    depCanvas.style.height = `${rect.height}px`;

    const ctx = depCanvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (depDragState) {
      const canvasRect = depCanvas.getBoundingClientRect();
      const startX = depDragState.sourceX - canvasRect.left;
      const startY = depDragState.sourceY - canvasRect.top;
      const endX = depDragState.currentX - canvasRect.left;
      const endY = depDragState.currentY - canvasRect.top;

      const accent = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim() || '#F59E0B';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(endY - startY, endX - startX);
      ctx.setLineDash([]);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 10 * Math.cos(angle - Math.PI / 6), endY - 10 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - 10 * Math.cos(angle + Math.PI / 6), endY - 10 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
  }, [depDragState, containerRef, depLineCanvasRef]);

  return { depDragState, startDepDraw: setDepDragState, active: !!depDragState };
}
