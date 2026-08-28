import { useCallback, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useLatestRef } from '@/hooks/useLatestRef';
import { useBarDrag } from './useBarDrag';
import { usePan } from './usePan';
import { useBoxSelect } from './useBoxSelect';
import { useRowDrag } from './useRowDrag';
import { useDependencyDraw } from './useDependencyDraw';
import type {
  GanttContextMenuState,
  GanttPointerCoordinatorInput,
  GanttPointerCoordinatorOutput,
  GanttRelationPopoverState,
  GanttTooltipState,
} from './ganttCoordinatorTypes';

// Halve breedte van de bewezen grijpzone rond de tabel/chart-scheiding.
const SPLITTER_GRAB_MARGIN = 4;

/**
 * Enige eigenaar van de pointerprioriteit op het primaire Ganttcanvas. De publieke renderers blijven
 * de waarheid voor row/bar/relation/collapse/add-hit-tests; deze hook kiest alleen welk bestaand
 * gebaar die uitkomst mag starten.
 */
export function useGanttPointerCoordinator(
  input: GanttPointerCoordinatorInput,
): GanttPointerCoordinatorOutput {
  const {
    host,
    viewport,
    tasks,
    rows,
    calendar,
    effectiveCalendarByTaskId,
    selectedTaskIds,
    taskTableWidth,
    headerHeight,
    dependencyMode,
    treeMode,
    scrollMode,
    enableQuarterHourZoom,
    enableHourPlanning,
    compressNonWorkdays,
    selectTask,
    selectTasks,
    deselectAll,
    toggleCollapse,
    setCollapsedGroupKey,
    addChildTask,
    updateTask,
    moveTaskTo,
    moveTasksTo,
    setScroll,
    openTask,
    revealTaskIfOffscreen,
    clearHistogramTooltip,
  } = input;
  const canvasRef = host.primaryCanvasRef;
  const rendererRef = host.primaryRendererRef;
  const containerRef = viewport.refs.primaryContainerRef;
  const tableSplitter = viewport.splitters.table;
  const view = viewport.effectiveView;

  const justBoxSelectedRef = useRef(false);
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
  const tasksById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const rowDrag = useRowDrag({
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
  const startRowDrag = rowDrag.startRowDrag;
  // Alleen de boomweergave heeft een eenduidige structurele doelvolgorde. Een verticale
  // balkgesture geeft daar zijn kandidaat door aan dezelfde rijsleep als de taakrij links;
  // gesorteerde/gegroepeerde weergaven behouden dus hun bestaande blokkering.
  const startVerticalBarDrag = useCallback((candidate: {
    taskId: string;
    startClientX: number;
    startClientY: number;
  }) => {
    startRowDrag(candidate);
  }, [startRowDrag]);
  const barDrag = useBarDrag({
    zoom: view.zoom,
    enableQuarterHourZoom,
    enableHourPlanning,
    calendar,
    effectiveCalById: effectiveCalendarByTaskId,
    compressNonWorkdays,
    getTask,
    updateTask,
    onVerticalBodyDrag: treeMode ? startVerticalBarDrag : undefined,
  });
  const onRelationDrawn = useCallback((sourceTaskId: string, targetTaskId: string, x: number, y: number) => {
    setRelationPopover({ sourceTaskId, targetTaskId, x, y });
  }, []);
  const dependencyDraw = useDependencyDraw({
    canvasRef,
    containerRef,
    depLineCanvasRef: host.dependencyCanvasRef,
    rendererRef,
    taskTableWidth,
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

    const row = renderer.getRowAtY(y);
    if (row?.kind === 'group') {
      setCollapsedGroupKey(row.key, !row.collapsed);
      return;
    }
    if (renderer.isInTaskTable(x)) {
      const collapseTask = renderer.isCollapseToggle(x, y);
      if (collapseTask) {
        toggleCollapse(collapseTask.id);
        return;
      }
      const addTarget = renderer.isAddButton(x, y);
      if (addTarget) {
        addChildTask(addTarget.id);
        return;
      }
    }

    const task = renderer.getTaskAtY(y);
    if (!task) {
      deselectAll();
      return;
    }
    if (event.shiftKey) selectTask(task.id, false, true);
    else if (event.ctrlKey || event.metaKey) selectTask(task.id, true, false);
    else {
      selectTask(task.id, false, false);
      if (renderer.isInTaskTable(x)) revealTaskIfOffscreen(task);
    }
  }, [canvasRef, rendererRef, clearHistogramTooltip, headerHeight, setCollapsedGroupKey, toggleCollapse, addChildTask, deselectAll, selectTask, revealTaskIfOffscreen]);

  const onDoubleClick = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const y = event.clientY - canvas.getBoundingClientRect().top;
    const task = renderer.getTaskAtY(y);
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
    const row = renderer.getRowAtY(y);
    if (row?.kind === 'group') {
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        task: null,
        barHit: false,
        group: { key: row.key, collapsed: row.collapsed },
      });
      return;
    }
    const task = renderer.getTaskAtY(y);
    if (task && !selectedTaskIds.includes(task.id)) selectTask(task.id, false);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      task,
      barHit: !!task && !!renderer.getRelationSourceAt(x, y),
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
   * 1 actief gebaar weigert een tweede; 2 middelklik pant overal; 3 splitter wint; 4 header stopt;
   * 5 relatie wint van balkdrag; 6 Ctrl/Cmd-balk blijft selectie; 7 balkbody/rand sleept;
   * 8 kale boomrij start rowdrag; 9 drag-achtergrond pant; 10 overige achtergrond boxselecteert.
   */
  const onMouseDown = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    // 1–2. Middelklik pant alleen wanneer geen enkel ander gebaar actief is.
    if (event.button === 1) {
      event.preventDefault();
      if (barDrag.active || dependencyDraw.active || boxSelect.active || rowDrag.active || pan.active) return;
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

    // 3. De tabelsplitter wint ook boven header, balk en achtergrond.
    if (Math.abs(x - taskTableWidth) <= SPLITTER_GRAB_MARGIN) {
      event.preventDefault();
      tableSplitter.start();
      return;
    }
    // 4. Onder de timelineheader bestaat geen taakgebaar.
    if (y < headerHeight) return;

    // 5. Shift/dependency-mode gebruikt uitsluitend de publieke relatiehittest en wint van drag.
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
      // 6. Ctrl/Cmd op een balk is selectie; de latere click-handler voert de toggle uit.
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        return;
      }
      // 7. Gewone balkbody/rand start precies één gebaar. Alleen de body kiest na de drempel
      // horizontaal (datum) of verticaal (de bestaande rijsleep); een rand blijft duur-slepen.
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

    if (renderer.isInTaskTable(x)) {
      event.preventDefault();
      const rowTask = renderer.getTaskAtY(y);
      // 8. Alleen een kale taakrij in pure boommodus wordt een rowdrag-kandidaat.
      if (rowTask && treeMode && !event.ctrlKey && !event.metaKey && !event.shiftKey && !contextMenu) {
        rowDrag.startRowDrag({
          taskId: rowTask.id,
          startClientX: event.clientX,
          startClientY: event.clientY,
        });
        return;
      }
      boxSelect.startBoxSelect({ startClientX: event.clientX, startClientY: event.clientY });
      return;
    }

    // 9. Kale chartachtergrond pant in drag-mode, behalve met Ctrl/Cmd.
    if (scrollMode === 'drag' && !(event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      beginPan(event, 0);
      return;
    }
    // 10. Iedere overige achtergrondroute start boxselectie.
    event.preventDefault();
    boxSelect.startBoxSelect({ startClientX: event.clientX, startClientY: event.clientY });
  }, [barDrag, dependencyDraw, boxSelect, rowDrag, pan.active, beginPan, canvasRef, rendererRef, taskTableWidth, tableSplitter, headerHeight, dependencyMode, selectTask, treeMode, contextMenu, scrollMode]);

  const onMouseMove = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (barDrag.active || dependencyDraw.active || pan.active || boxSelect.active || rowDrag.active || contextMenu) {
      setTooltip(null);
      return;
    }
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (Math.abs(x - taskTableWidth) <= SPLITTER_GRAB_MARGIN) {
      setHoverCursor('col-resize');
      setTooltip(null);
      return;
    }
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
    const hoveredTask = renderer.getTaskAtY(y);
    if (hoveredTask && x >= taskTableWidth) {
      setTooltip({ x: event.clientX, y: event.clientY, task: hoveredTask });
    } else {
      setTooltip(null);
    }
    if (renderer.isInTaskTable(x)
      && (renderer.isCollapseToggle(x, y) || renderer.isAddButton(x, y))) {
      setHoverCursor('pointer');
      setTooltip(null);
      return;
    }
    if (scrollMode === 'drag' && x >= taskTableWidth) {
      setHoverCursor(event.ctrlKey || event.metaKey ? 'crosshair' : 'grab');
      return;
    }
    setHoverCursor('default');
  }, [barDrag.active, dependencyDraw.active, pan.active, boxSelect.active, rowDrag.active, contextMenu, canvasRef, rendererRef, taskTableWidth, headerHeight, dependencyMode, scrollMode]);

  const onMouseLeave = useCallback(() => setTooltip(null), []);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const closeRelationPopover = useCallback(() => setRelationPopover(null), []);

  const cursor = tableSplitter.isResizing
    ? 'col-resize'
    : pan.panState
      ? 'grabbing'
      : barDrag.dragState
        ? (barDrag.dragState.edge === 'body' ? 'grabbing' : 'ew-resize')
        : dependencyDraw.active
          ? 'crosshair'
          : boxSelect.boxSelectState
            ? 'crosshair'
            : rowDrag.rowDragState
              ? 'grabbing'
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
      rowDragCandidate: rowDrag.rowDragCandidate,
      rowDrag: rowDrag.rowDragState,
      dependency: dependencyDraw.depDragState,
    },
    contextMenu,
    relationPopover,
    tooltip,
    closeContextMenu,
    closeRelationPopover,
  };
}
