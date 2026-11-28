import { RefObject, useEffect, useState } from 'react';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { BOX_SELECT_THRESHOLD } from './constants';
import { listenWindowDrag } from '@/hooks/listenWindowDrag';
import { uniqueTaskIds } from '@/engine/view/visibleRows';
import type { SelectionAnchor } from '@/state/slices/types';

export interface BoxSelectCandidate {
  startClientX: number;
  startClientY: number;
}

export interface BoxSelectState {
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
}

interface UseBoxSelectOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  rendererRef: RefObject<GanttRenderer | null>;
  selectTasks: (ids: string[], additive: boolean, activeTaskId?: string | null, anchor?: SelectionAnchor) => void;
  setGridActiveRowKey: (rowKey: string) => void;
  deselectAll: () => void;
  justBoxSelectedRef: RefObject<boolean>;
}

export function useBoxSelect({ canvasRef, rendererRef, selectTasks, setGridActiveRowKey, deselectAll, justBoxSelectedRef }: UseBoxSelectOptions) {
  const [boxSelectCandidate, setBoxSelectCandidate] = useState<BoxSelectCandidate | null>(null);
  const [boxSelectState, setBoxSelectState] = useState<BoxSelectState | null>(null);

  useEffect(() => {
    if (!boxSelectCandidate) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - boxSelectCandidate.startClientX;
      const dy = e.clientY - boxSelectCandidate.startClientY;
      if (Math.hypot(dx, dy) < BOX_SELECT_THRESHOLD) return;
      setBoxSelectCandidate(null);
      setBoxSelectState({
        startClientX: boxSelectCandidate.startClientX,
        startClientY: boxSelectCandidate.startClientY,
        currentClientX: e.clientX,
        currentClientY: e.clientY,
      });
    };

    const handleMouseUp = () => setBoxSelectCandidate(null);

    return listenWindowDrag({ onMove: handleMouseMove, onUp: handleMouseUp, onDocumentSwitch: () => setBoxSelectCandidate(null) });
  }, [boxSelectCandidate]);

  useEffect(() => {
    if (!boxSelectState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setBoxSelectState(prev => prev ? { ...prev, currentClientX: e.clientX, currentClientY: e.clientY } : null);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (canvas && renderer) {
        const rect = canvas.getBoundingClientRect();
        const y1 = boxSelectState.startClientY - rect.top;
        const y2 = e.clientY - rect.top;
        const rows = renderer.getRowsInYRange(Math.min(y1, y2), Math.max(y1, y2));
        const ids = uniqueTaskIds(rows);
        const additive = e.ctrlKey || e.metaKey;
        const top = rows.find(row => uniqueTaskIds([row]).length > 0);
        if (top && ids.length > 0) {
          const taskIds = uniqueTaskIds([top]);
          selectTasks(ids, additive, taskIds[0], { rowKey: top.rowKey, taskIds });
          setGridActiveRowKey(top.rowKey);
        } else if (!additive) {
          deselectAll();
        }
      }
      justBoxSelectedRef.current = true;
      armJustBoxSelectedClear();
      setBoxSelectState(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      justBoxSelectedRef.current = true;
      armJustBoxSelectedClear();
      setBoxSelectState(null);
    };

    function armJustBoxSelectedClear(): void {
      window.addEventListener('click', () => { justBoxSelectedRef.current = false; }, { once: true });
    }

    return listenWindowDrag({
      onMove: handleMouseMove, onUp: handleMouseUp, onKeyDown: handleKeyDown, keyCapture: true,
      onDocumentSwitch: () => setBoxSelectState(null),
    });
  }, [boxSelectState, canvasRef, rendererRef, selectTasks, setGridActiveRowKey, deselectAll, justBoxSelectedRef]);

  return {
    boxSelectCandidate,
    boxSelectState,
    startBoxSelect: setBoxSelectCandidate,
    active: !!boxSelectCandidate || !!boxSelectState,
  };
}
