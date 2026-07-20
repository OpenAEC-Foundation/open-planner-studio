import { RefObject, useEffect, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import type { Sequence } from '@/types/sequence';

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
  addSequence: (seq: Omit<Sequence, 'id'>) => string;
  /** Aangeroepen ná het aanmaken van de relatie (op de drop-positie) — GanttCanvas opent hier de
   *  relatietype/lag-correctie-popover mee. */
  onRelationCreated: (sequenceId: string, clientX: number, clientY: number) => void;
}

// Dependency-draw (shift+drag van balk A naar balk B → FS-relatie + correctie-popover). Bezit
// `depDragState`, de window-listeners voor de sleep, én het tekenen van de tijdelijke pijl op het
// overlay-canvas. Het centrale mousedown-hittest roept `startDepDraw(...)` aan.
export function useDependencyDraw({
  canvasRef,
  containerRef,
  depLineCanvasRef,
  rendererRef,
  addSequence,
  onRelationCreated,
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
        if (targetTask && targetTask.id !== depDragState.sourceTaskId && x >= useAppStore.getState().ui.leftPanelWidth) {
          // Create Finish-to-Start dependency (default — ongewijzigd gedrag als de gebruiker de
          // hieronder geopende popover negeert/wegklikt).
          const newSequenceId = addSequence({
            predecessorId: depDragState.sourceTaskId,
            successorId: targetTask.id,
            type: 'FINISH_START',
            lagDays: 0,
          });
          // Fase 2.10 (item 3): meteen de correctie-popover openen op de drop-positie.
          onRelationCreated(newSequenceId, e.clientX, e.clientY);
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
  }, [depDragState, addSequence]);

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
  }, [depDragState]);

  return { depDragState, startDepDraw: setDepDragState, active: !!depDragState };
}
