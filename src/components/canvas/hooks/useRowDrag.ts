import { RefObject, useEffect, useState } from 'react';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';
import { resolveDropTarget, type DropTarget } from '@/engine/view/dropTarget';
import { ROW_DRAG_THRESHOLD } from './constants';

/** Issue #21 punt 1 (fase 2): rijsleep vanaf de takentabel, nog ONDER de drempel — nog geen
 *  droptarget-berekening, alleen bijhouden vanaf waar we moeten meten. Wordt bij overschrijding
 *  gepromoveerd tot RowDragState; blijft de sleep onder de drempel tot mouseup, dan gebeurt er
 *  niets (de normale klik/selectie volgt) — exact het kandidaat→promoot-patroon van
 *  `useBoxSelect`. */
export interface RowDragCandidate {
  taskId: string;
  startClientX: number;
  startClientY: number;
}

/** Issue #21 punt 1 (fase 2): actieve rijsleep (na de drempel). Client-coördinaten, net als
 *  BoxSelectState — omgerekend naar canvas-relatief bij het meten van de doelrij. `dropTarget` is
 *  het actuele `moveTaskTo`-doel (null = geen geldig doel, bv. buiten de rijenlijst of cykel).
 *  `hoverRowIndex`/`hoverZone` zijn puur voor een eventuele visuele indicator (fase 3 bouwt de
 *  echte indicator; dit hook levert alvast de rauwe hover-info zodat een minimale lijn — géén
 *  vereiste van fase 2 — bijna gratis meekomt zonder de droptarget-logica te dupliceren). */
export interface RowDragState {
  taskId: string;
  currentClientX: number;
  currentClientY: number;
  dropTarget: DropTarget | null;
  hoverRowIndex: number | null;
  hoverZone: 'before' | 'after' | 'nest' | null;
}

interface UseRowDragOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  rendererRef: RefObject<GanttRenderer | null>;
  /** Dezelfde `viewRows` als aan de renderer meegegeven — rowIndex uit `getRowIndex` indexeert
   *  hierin, dus dit MOET dezelfde array zijn die de renderer op dat moment gebruikt. */
  rows: ViewRow[];
  tasksById: Map<string, Task>;
  moveTaskTo: (id: string, target: DropTarget) => void;
  /** Gedeelde vlag met de click-handler: onderdrukt de eerstvolgende click ná een rijsleep
   *  (zelfde patroon als `justBoxSelectedRef`). */
  justRowDraggedRef: RefObject<boolean>;
  /** Hoogte van de tijdlijnheader in canvas-px. Review issue #21 pt. 1 fase 2: `getRowIndex`
   *  klemt niet, dus een hover BOVEN de header zou bij scrollY>0 op een echte rij mappen en
   *  daar een (grotendeels verstopte) droptarget tonen — boven de header is er géén target. */
  headerHeight: number;
}

// Rijsleep (verticaal taak-verslepen vanuit de takentabel — issue #21 punt 1, fase 2). Bezit de
// twee fases — kandidaat (onder drempel) en gepromoveerde sleep — met elk hun eigen
// window-listeners, gespiegeld aan `useBoxSelect`. De mutatie (`moveTaskTo`) gebeurt uitsluitend
// bij mouseup, nooit tijdens het slepen zelf — dus één aanroep = één undo-stap, geen coalescing
// nodig (zie ontwerp-B §4/§5).
export function useRowDrag({ canvasRef, rendererRef, rows, tasksById, moveTaskTo, justRowDraggedRef, headerHeight }: UseRowDragOptions) {
  const [rowDragCandidate, setRowDragCandidate] = useState<RowDragCandidate | null>(null);
  const [rowDragState, setRowDragState] = useState<RowDragState | null>(null);

  const computeHover = (clientY: number, draggedTaskId: string): { rowIndex: number; zone: 'before' | 'after' | 'nest'; target: DropTarget | null } | null => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return null;
    const rect = canvas.getBoundingClientRect();
    const y = clientY - rect.top;
    if (y < headerHeight) return null; // boven de tijdlijnheader is geen droptarget
    const rowIndex = renderer.getRowIndex(y);
    const zone = renderer.getRowZone(y);
    // draggedTaskId gaat mee zodat de resolver compenseert voor de remove-dan-insert-verschuiving
    // bij herordenen binnen dezelfde ouder (review issue #21 pt. 1 fase 2).
    return { rowIndex, zone, target: resolveDropTarget(rows, rowIndex, zone, tasksById, draggedTaskId) };
  };

  // Kandidaatfase: nog onder de drempel. Bij overschrijding (verticale beweging, |dy| — dit is
  // een verticaal gebaar, geen hypot zoals box-select) promoveren we tot een echte rijsleep;
  // onder de drempel bij mouseup gebeurt niets (de gewone klik-afhandeling selecteert dan).
  useEffect(() => {
    if (!rowDragCandidate) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dy = e.clientY - rowDragCandidate.startClientY;
      if (Math.abs(dy) < ROW_DRAG_THRESHOLD) return;
      setRowDragCandidate(null);
      const hover = computeHover(e.clientY, rowDragCandidate.taskId);
      setRowDragState({
        taskId: rowDragCandidate.taskId,
        currentClientX: e.clientX,
        currentClientY: e.clientY,
        dropTarget: hover?.target ?? null,
        hoverRowIndex: hover?.rowIndex ?? null,
        hoverZone: hover?.zone ?? null,
      });
    };

    const handleMouseUp = () => setRowDragCandidate(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowDragCandidate]);

  // Gepromoveerde fase: doelrij+zone continu herberekenen (geen mutatie!) zodat een eventuele
  // indicator altijd het actuele doel toont. mouseup = de ENIGE plek waar `moveTaskTo` wordt
  // aangeroepen (één undo-stap). Escape (capture-fase, `stopImmediatePropagation`) annuleert
  // zonder mutatie — zelfde reden als bij box-select: anders wint de globale deselect-sneltoets
  // niet, hier is er geen deselect-risico maar wél een niet-bedoelde moveTaskTo-aanroep als de
  // globale Escape-listener eerst iets anders zou triggeren.
  useEffect(() => {
    if (!rowDragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const hover = computeHover(e.clientY, rowDragState.taskId);
      setRowDragState(prev => prev ? {
        ...prev,
        currentClientX: e.clientX,
        currentClientY: e.clientY,
        dropTarget: hover?.target ?? null,
        hoverRowIndex: hover?.rowIndex ?? null,
        hoverZone: hover?.zone ?? null,
      } : null);
    };

    const handleMouseUp = () => {
      if (rowDragState.dropTarget) {
        moveTaskTo(rowDragState.taskId, rowDragState.dropTarget);
      }
      // Geen geldig doel (bv. cykel, buiten de lijst) ⇒ stille no-op — de store-actie zelf guardt
      // cykels ook al, dus dit is een dubbele bodem, geen enige bescherming.
      justRowDraggedRef.current = true;
      setRowDragState(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      justRowDraggedRef.current = true;
      setRowDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowDragState, moveTaskTo, justRowDraggedRef]);

  return {
    rowDragCandidate,
    rowDragState,
    startRowDrag: setRowDragCandidate,
    active: !!rowDragCandidate || !!rowDragState,
  };
}
