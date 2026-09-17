import { useCallback, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useLatestRef } from '@/hooks/useLatestRef';
import { useBarDrag } from './useBarDrag';
import { usePan } from './usePan';
import { useBoxSelect } from './useBoxSelect';
import { useDependencyDraw } from './useDependencyDraw';
import type {
  GanttContextMenuState,
  GanttPointerCoordinatorInput,
  GanttPointerCoordinatorOutput,
  GanttRelationPopoverState,
  GanttTooltipState,
} from './ganttCoordinatorTypes';

/**
 * Enige eigenaar van de pointerprioriteit op het primaire tijdlijncanvas. De DOM-grid links bezit
 * rijselectie, disclosure, rijsleep en de workspace-splitter; deze hook coördineert uitsluitend
 * balken, relaties, pannen en kaderselectie binnen de lokale canvascoördinaten.
 */
export function useGanttPointerCoordinator(
  input: GanttPointerCoordinatorInput,
): GanttPointerCoordinatorOutput {
  const {
    host,
    viewport,
    tasks,
    calendar,
    effectiveCalendarByTaskId,
    selectedTaskIds,
    headerHeight,
    dependencyMode,
    scrollMode,
    enableQuarterHourZoom,
    enableHourPlanning,
    compressNonWorkdays,
    selectTask,
    selectTasks,
    deselectAll,
    updateTask,
    setScroll,
    openTask,
    clearHistogramTooltip,
    startVerticalRowDrag,
  } = input;
  const canvasRef = host.primaryCanvasRef;
  const rendererRef = host.primaryRendererRef;
  const containerRef = viewport.refs.primaryContainerRef;
  const view = viewport.effectiveView;

  const justBoxSelectedRef = useRef(false);
  // Gezet zodra een balkbody-sleep aan de rijsleep van de DOM-grid is overgedragen: de mouseup van
  // dat gebaar levert op het canvas nog een click op, en die mag de zojuist verplaatste taak niet
  // her-selecteren of (naast een balk) de selectie wissen. Gewist bij de eerstvolgende mousedown,
  // want eindigt de sleep boven de grid, dan komt er op het canvas helemaal geen click (zelfde
  // vangnet als `useTableRowDrag`'s `justDraggedRef`).
  const justRowDraggedRef = useRef(false);
  const [hoverCursor, setHoverCursor] = useState('default');
  const [contextMenu, setContextMenu] = useState<GanttContextMenuState | null>(null);
  const [relationPopover, setRelationPopover] = useState<GanttRelationPopoverState | null>(null);
  const [tooltip, setTooltip] = useState<GanttTooltipState | null>(null);

  const latestTasks = useLatestRef(tasks);
  const getTask = useCallback(
    (taskId: string) => latestTasks.current.find(candidate => candidate.id === taskId),
    [latestTasks],
  );
  const pan = usePan({ setScroll, justBoxSelectedRef });
  const boxSelect = useBoxSelect({
    canvasRef,
    rendererRef,
    selectTasks,
    deselectAll,
    justBoxSelectedRef,
  });
  // Verticale balkbody-sleep ⇒ dezelfde rijsleep als de taakrij links (zie `ganttRowDragBridge`).
  // `useBarDrag` beslist pas ná de drempel over de richting en roept dit hooguit één keer per
  // gebaar aan; daarna is zijn eigen dragState al gewist, dus er lopen nooit twee gebaren tegelijk.
  const onVerticalBodyDrag = useCallback((candidate: {
    taskId: string;
    startClientX: number;
    startClientY: number;
  }) => {
    justRowDraggedRef.current = true;
    startVerticalRowDrag?.(candidate);
  }, [startVerticalRowDrag]);
  const barDrag = useBarDrag({
    zoom: view.zoom,
    enableQuarterHourZoom,
    enableHourPlanning,
    calendar,
    effectiveCalById: effectiveCalendarByTaskId,
    compressNonWorkdays,
    getTask,
    updateTask,
    onVerticalBodyDrag: startVerticalRowDrag ? onVerticalBodyDrag : undefined,
    axis: viewport.sharedAxis,
    canvasRef,
  });
  const onRelationDrawn = useCallback((sourceTaskId: string, targetTaskId: string, x: number, y: number) => {
    setRelationPopover({ sourceTaskId, targetTaskId, x, y });
  }, []);
  const dependencyDraw = useDependencyDraw({
    canvasRef,
    containerRef,
    depLineCanvasRef: host.dependencyCanvasRef,
    rendererRef,
    onRelationDrawn,
  });

  const onClick = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (justBoxSelectedRef.current) {
      justBoxSelectedRef.current = false;
      return;
    }
    if (justRowDraggedRef.current) {
      justRowDraggedRef.current = false;
      return;
    }
    clearHistogramTooltip();
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (y < headerHeight) return;

    const task = renderer.getRelationSourceAt(x, y);
    if (!task) {
      deselectAll();
      return;
    }
    if (event.shiftKey) selectTask(task.id, false, true);
    else if (event.ctrlKey || event.metaKey) selectTask(task.id, true, false);
    else selectTask(task.id, false, false);
  }, [canvasRef, rendererRef, clearHistogramTooltip, headerHeight, deselectAll, selectTask]);

  const onDoubleClick = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const task = renderer.getRelationSourceAt(x, y);
    if (task) openTask(task.id);
  }, [canvasRef, rendererRef, openTask]);

  const onContextMenu = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    setTooltip(null);
    clearHistogramTooltip();
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (y < headerHeight) return;
    const task = renderer.getRelationSourceAt(x, y);
    if (!task) return;
    if (task && !selectedTaskIds.includes(task.id)) selectTask(task.id, false);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      task,
      barHit: true,
      group: null,
    });
  }, [canvasRef, rendererRef, clearHistogramTooltip, headerHeight, selectedTaskIds, selectTask]);

  const beginPan = useCallback((event: ReactMouseEvent<HTMLCanvasElement>, button: number) => {
    pan.startPan({
      button,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originScrollX: view.scrollX,
      originScrollY: view.scrollY,
    });
  }, [pan, view.scrollX, view.scrollY]);

  /*
   * De karakteriseringsmatrix bewaakt deze ene volgorde:
   * 1 actief gebaar weigert een tweede; 2 middelklik pant overal; 3 header stopt; 4 relatie wint
   * van balkdrag; 5 Ctrl/Cmd-balk blijft selectie; 6 balkbody/rand sleept; 7 drag-achtergrond pant;
   * 8 iedere overige achtergrondroute start kaderselectie.
   */
  const onMouseDown = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    // Een nieuwe mousedown is onmiskenbaar een nieuwe interactie: een eventueel blijven hangen
    // rijsleep-vlag (sleep geëindigd boven de grid, dus zonder canvas-click) vervalt hier.
    justRowDraggedRef.current = false;
    // 1–2. Middelklik pant alleen wanneer geen enkel ander gebaar actief is.
    if (event.button === 1) {
      event.preventDefault();
      if (barDrag.active || dependencyDraw.active || boxSelect.active || pan.active) return;
      beginPan(event, 1);
      return;
    }
    if (event.button !== 0 || pan.active) return;

    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 3. Onder de timelineheader bestaat geen taakgebaar.
    if (y < headerHeight) return;

    // 4. Shift/dependency-mode gebruikt uitsluitend de publieke relatiehittest en wint van drag.
    if (event.shiftKey || dependencyMode) {
      const source = renderer.getRelationSourceAt(x, y);
      if (source) {
        event.preventDefault();
        dependencyDraw.startDepDraw({
          sourceTaskId: source.id,
          sourceX: event.clientX,
          sourceY: event.clientY,
          currentX: event.clientX,
          currentY: event.clientY,
        });
        return;
      }
    }

    const hit = renderer.getTaskBarBounds(x, y);
    if (hit) {
      // 5. Ctrl/Cmd op een balk is selectie; de latere click-handler voert de toggle uit.
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        return;
      }
      // 6. Gewone balkbody/rand start precies één tijdlijngebaar.
      event.preventDefault();
      barDrag.startBarDrag({
        taskId: hit.task.id,
        edge: hit.edge,
        startX: event.clientX,
        startY: event.clientY,
        originalStart: hit.task.time.earlyStart || hit.task.time.scheduleStart,
        originalFinish: hit.task.time.earlyFinish || hit.task.time.scheduleFinish,
        originalDuration: hit.task.time.scheduleDuration,
        originalDurationMinutes: hit.task.time.durationMinutes,
      });
      selectTask(hit.task.id, false);
      return;
    }

    // 7. Kale chartachtergrond pant in drag-mode, behalve met Ctrl/Cmd.
    if (scrollMode === 'drag' && !(event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      beginPan(event, 0);
      return;
    }
    // 8. Iedere overige achtergrondroute start boxselectie.
    event.preventDefault();
    boxSelect.startBoxSelect({ startClientX: event.clientX, startClientY: event.clientY });
  }, [barDrag, dependencyDraw, boxSelect, pan.active, beginPan, canvasRef, rendererRef, headerHeight, dependencyMode, selectTask, scrollMode]);

  const onMouseMove = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (barDrag.active || dependencyDraw.active || pan.active || boxSelect.active || contextMenu) {
      setTooltip(null);
      return;
    }
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (y < headerHeight) {
      setHoverCursor('default');
      setTooltip(null);
      return;
    }
    const hit = renderer.getTaskBarBounds(x, y);
    if (hit) {
      if (event.shiftKey || dependencyMode) setHoverCursor('crosshair');
      else if (hit.edge === 'left' || hit.edge === 'right') setHoverCursor('ew-resize');
      else setHoverCursor('grab');
      setTooltip({ x: event.clientX, y: event.clientY, task: hit.task });
      return;
    }
    const hoveredTask = renderer.getRelationSourceAt(x, y);
    if (hoveredTask) {
      setTooltip({ x: event.clientX, y: event.clientY, task: hoveredTask });
    } else {
      setTooltip(null);
    }
    if (scrollMode === 'drag') {
      setHoverCursor(event.ctrlKey || event.metaKey ? 'crosshair' : 'grab');
      return;
    }
    setHoverCursor('default');
  }, [barDrag.active, dependencyDraw.active, pan.active, boxSelect.active, contextMenu, canvasRef, rendererRef, headerHeight, dependencyMode, scrollMode]);

  const onMouseLeave = useCallback(() => setTooltip(null), []);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const closeRelationPopover = useCallback(() => setRelationPopover(null), []);

  const cursor = pan.panState
      ? 'grabbing'
      : barDrag.dragState
        ? (barDrag.dragState.edge === 'body' ? 'grabbing' : 'ew-resize')
        : dependencyDraw.active
          ? 'crosshair'
          : boxSelect.boxSelectState
            ? 'crosshair'
            : dependencyMode && (hoverCursor === 'grab' || hoverCursor === 'ew-resize')
              ? 'crosshair'
              : hoverCursor;

  return {
    onClick,
    onDoubleClick,
    onContextMenu,
    onMouseDown,
    onMouseMove,
    onMouseLeave,
    cursor,
    overlays: {
      barDrag: barDrag.dragState,
      pan: pan.panState,
      boxSelectCandidate: boxSelect.boxSelectCandidate,
      boxSelect: boxSelect.boxSelectState,
      dependency: dependencyDraw.depDragState,
    },
    contextMenu,
    relationPopover,
    tooltip,
    closeContextMenu,
    closeRelationPopover,
  };
}
