import { RefObject, useEffect, useState } from 'react';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { isTimelineCanvasX, readAccentColor, sizeCanvasToContainer } from './useCanvasLayer';
import { listenWindowDrag } from '@/hooks/listenWindowDrag';

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
  onRelationDrawn: (sourceTaskId: string, targetTaskId: string, clientX: number, clientY: number) => void;
}

export function useDependencyDraw({
  canvasRef,
  containerRef,
  depLineCanvasRef,
  rendererRef,
  onRelationDrawn,
}: UseDependencyDrawOptions) {
  const [depDragState, setDepDragState] = useState<DependencyDragState | null>(null);

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

        const targetTask = renderer.getTaskAt(x, y);
        if (targetTask && targetTask.id !== depDragState.sourceTaskId && !renderer.getMilestoneGroup(targetTask.id)
          && isTimelineCanvasX(x, rect.width)) {
          onRelationDrawn(depDragState.sourceTaskId, targetTask.id, e.clientX, e.clientY);
        }
      }
      setDepDragState(null);
    };

    return listenWindowDrag({ onMove: handleMouseMove, onUp: handleMouseUp, onDocumentSwitch: () => setDepDragState(null) });
  }, [depDragState, canvasRef, rendererRef, onRelationDrawn]);

  useEffect(() => {
    const depCanvas = depLineCanvasRef.current;
    const container = containerRef.current;
    if (!depCanvas || !container) return;

    const layer = sizeCanvasToContainer(depCanvas, container);
    if (!layer) return;
    const { ctx } = layer;
    ctx.clearRect(0, 0, layer.width, layer.height);

    if (depDragState) {
      const canvasRect = depCanvas.getBoundingClientRect();
      const startX = depDragState.sourceX - canvasRect.left;
      const startY = depDragState.sourceY - canvasRect.top;
      const endX = depDragState.currentX - canvasRect.left;
      const endY = depDragState.currentY - canvasRect.top;

      const accent = readAccentColor();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

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
