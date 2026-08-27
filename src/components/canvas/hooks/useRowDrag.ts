import { RefObject, useCallback, useEffect, useState } from 'react';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';
import { resolveDropTarget, type DropTarget } from '@/engine/view/dropTarget';
import { useLatestRef } from '@/hooks/useLatestRef';
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
  /** Issue #26 (vervolgmelding): de huidige selectie. Sleep je een rij die daar deel van uitmaakt
   *  én telt de selectie meer dan één taak, dan verhuist de HELE groep (`moveTasksTo`) — op het
   *  canvas is een meervoudige selectie extra gewoon door de box-select. Sleep je een
   *  niet-geselecteerde rij, dan verhuist alleen die rij. Identiek aan de tabel (useTableRowDrag). */
  selectedTaskIds: string[];
  moveTasksTo: (ids: string[], target: DropTarget) => void;
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
export function useRowDrag({ canvasRef, rendererRef, rows, tasksById, moveTaskTo, selectedTaskIds, moveTasksTo, justRowDraggedRef, headerHeight }: UseRowDragOptions) {
  const [rowDragCandidate, setRowDragCandidate] = useState<RowDragCandidate | null>(null);
  const [rowDragState, setRowDragState] = useState<RowDragState | null>(null);
  const optionsRef = useLatestRef({
    canvasRef,
    rendererRef,
    rows,
    tasksById,
    moveTaskTo,
    selectedTaskIds,
    moveTasksTo,
    justRowDraggedRef,
    headerHeight,
  });
  const candidateRef = useLatestRef(rowDragCandidate);
  const dragStateRef = useLatestRef(rowDragState);
  const candidateActive = rowDragCandidate !== null;
  const dragActive = rowDragState !== null;

  const computeHover = useCallback((clientY: number, draggedTaskId: string): { rowIndex: number; zone: 'before' | 'after' | 'nest'; target: DropTarget | null } | null => {
    const current = optionsRef.current;
    const canvas = current.canvasRef.current;
    const renderer = current.rendererRef.current;
    if (!canvas || !renderer) return null;
    const rect = canvas.getBoundingClientRect();
    const y = clientY - rect.top;
    if (y < current.headerHeight) return null; // boven de tijdlijnheader is geen droptarget
    const rowIndex = renderer.getRowIndex(y);
    const zone = renderer.getRowZone(y);
    // draggedTaskId gaat mee zodat de resolver compenseert voor de remove-dan-insert-verschuiving
    // bij herordenen binnen dezelfde ouder (review issue #21 pt. 1 fase 2).
    return {
      rowIndex,
      zone,
      target: resolveDropTarget(current.rows, rowIndex, zone, current.tasksById, draggedTaskId),
    };
  }, [optionsRef]);

  // Kandidaatfase: nog onder de drempel. Bij overschrijding (verticale beweging, |dy| — dit is
  // een verticaal gebaar, geen hypot zoals box-select) promoveren we tot een echte rijsleep;
  // onder de drempel bij mouseup gebeurt niets (de gewone klik-afhandeling selecteert dan).
  useEffect(() => {
    if (!candidateActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      const current = candidateRef.current;
      if (!current) return;
      const dy = e.clientY - current.startClientY;
      if (Math.abs(dy) < ROW_DRAG_THRESHOLD) return;
      setRowDragCandidate(null);
      const hover = computeHover(e.clientY, current.taskId);
      setRowDragState({
        taskId: current.taskId,
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
  }, [candidateActive, candidateRef, computeHover]);

  // Gepromoveerde fase: doelrij+zone continu herberekenen (geen mutatie!) zodat een eventuele
  // indicator altijd het actuele doel toont. mouseup = de ENIGE plek waar `moveTaskTo` wordt
  // aangeroepen (één undo-stap). Escape (capture-fase, `stopImmediatePropagation`) annuleert
  // zonder mutatie — zelfde reden als bij box-select: anders wint de globale deselect-sneltoets
  // niet, hier is er geen deselect-risico maar wél een niet-bedoelde moveTaskTo-aanroep als de
  // globale Escape-listener eerst iets anders zou triggeren.
  useEffect(() => {
    if (!dragActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      const current = dragStateRef.current;
      if (!current) return;
      const hover = computeHover(e.clientY, current.taskId);
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
      const current = dragStateRef.current;
      const options = optionsRef.current;
      if (current?.dropTarget) {
        // Onderdeel van een meervoudige selectie ⇒ de hele groep mee (issue #26-vervolgmelding);
        // anders exact het oude pad. `moveTasksTo` doet de groep in één undo-stap.
        const groepssleep = options.selectedTaskIds.length > 1
          && options.selectedTaskIds.includes(current.taskId);
        if (groepssleep) options.moveTasksTo(options.selectedTaskIds, current.dropTarget);
        else options.moveTaskTo(current.taskId, current.dropTarget);
      }
      // Geen geldig doel (bv. cykel, buiten de lijst) ⇒ stille no-op — de store-actie zelf guardt
      // cykels ook al, dus dit is een dubbele bodem, geen enige bescherming.
      options.justRowDraggedRef.current = true;
      armJustRowDraggedClear();
      setRowDragState(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      optionsRef.current.justRowDraggedRef.current = true;
      armJustRowDraggedClear();
      setRowDragState(null);
    };

    // Issue #21 punt 1 (dode-klik-fix): eindigt de sleep buiten het canvas, dan bereikt geen
    // canvas-click de handler die de vlag normaal consumeert (handleClick in GanttCanvas) —
    // de vlag zou dan blijven staan en de EERSTVOLGENDE echte canvas-klik inslikken. Eenmalige
    // window-listener in de BUBBLE-fase (default, geen `capture`) wist de vlag alsnog: bij een
    // klik ÓP het canvas bereikt React's onClick de root-container (die vóór window ligt in de
    // bubble-keten) eerst en consumeert 'm daar al — deze listener wist 'm dan idempotent nog
    // een keer. Bij een klik BUITEN het canvas is dit de enige plek die de vlag opruimt.
    function armJustRowDraggedClear(): void {
      window.addEventListener('click', () => {
        optionsRef.current.justRowDraggedRef.current = false;
      }, { once: true });
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [dragActive, dragStateRef, optionsRef, computeHover]);

  return {
    rowDragCandidate,
    rowDragState,
    startRowDrag: setRowDragCandidate,
    active: !!rowDragCandidate || !!rowDragState,
  };
}
