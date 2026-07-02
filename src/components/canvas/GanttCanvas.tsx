import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { GanttRenderer, GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import { traceFrom } from '@/engine/scheduler/graphWalk';
import { groupTasksByCode } from '@/utils/grouping';
import { diffDays, formatDate, parseDate, addCalendarDays, diffCalendarDays } from '@/utils/dateUtils';
import { createDefaultTaskTime, Task } from '@/types/task';
import { ContextMenu } from './ContextMenu';
import { getLocalizedMonths } from '@/i18n/dateFormat';
import { useGanttZoom } from '@/hooks/useGanttZoom';
import { useZoomShortcuts } from '@/hooks/useZoomShortcuts';

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 50;
const TASK_TABLE_WIDTH = 350;
// Days of empty padding kept to the left of the earliest task / today so the
// timeline origin never sits exactly on a task bar.
const ORIGIN_PADDING_DAYS = 14;

interface ContextMenuState {
  x: number;
  y: number;
  task: Task | null;
}

interface DragState {
  taskId: string;
  edge: 'left' | 'right' | 'body';
  startX: number;
  originalStart: string;
  originalFinish: string;
  originalDuration: number;
}

interface TooltipState {
  x: number;
  y: number;
  task: Task;
}

interface DependencyDragState {
  sourceTaskId: string;
  sourceX: number;
  sourceY: number;
  currentX: number;
  currentY: number;
}

interface ToastState {
  message: string;
  type: 'error' | 'info';
}

// Map-style drag-to-pan (Optie 3 / 'drag' scroll mode). Captures the pointer
// origin and the scroll offsets at grab time; movement is applied as a delta.
interface PanState {
  startClientX: number;
  startClientY: number;
  originScrollX: number;
  originScrollY: number;
}

export function GanttCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);
  const depLineCanvasRef = useRef<HTMLCanvasElement>(null);

  const { t: tTask, i18n } = useTranslation('task');

  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const calendar = useAppStore(s => s.calendar);
  const view = useAppStore(s => s.view);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const collapsedTaskIds = useAppStore(s => s.ui.collapsedTaskIds);
  const selectTask = useAppStore(s => s.selectTask);
  const deselectAll = useAppStore(s => s.deselectAll);
  const toggleCollapse = useAppStore(s => s.toggleCollapse);
  const addTask = useAppStore(s => s.addTask);
  const addSequence = useAppStore(s => s.addSequence);
  const updateTask = useAppStore(s => s.updateTask);
  const deleteTask = useAppStore(s => s.deleteTask);
  const setScroll = useAppStore(s => s.setScroll);
  const setUI = useAppStore(s => s.setUI);
  const project = useAppStore(s => s.project);
  const uiTheme = useAppStore(s => s.ui.uiTheme);
  const weekStartDay = useAppStore(s => s.ui.weekStartDay);
  const enableQuarterHourZoom = useAppStore(s => s.ui.enableQuarterHourZoom);
  const scrollMode = useAppStore(s => s.ui.scrollMode);
  const traceMode = useAppStore(s => s.ui.traceMode);
  const cpmResult = useAppStore(s => s.cpmResult);
  const groupBy = useAppStore(s => s.view.groupBy);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);

  const { zoomAt } = useGanttZoom({ containerRef, taskTableWidth: TASK_TABLE_WIDTH });
  useZoomShortcuts({ zoomAt, containerRef, taskTableWidth: TASK_TABLE_WIDTH, originPaddingDays: ORIGIN_PADDING_DAYS });

  const rendererRef = useRef<GanttRenderer | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [depDragState, setDepDragState] = useState<DependencyDragState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [cursor, setCursor] = useState('default');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const localizedMonths = useMemo(() => getLocalizedMonths(i18n.language), [i18n.language]);

  const columnHeaders = useMemo(() => ({
    wbs: tTask('table.wbs'),
    taskName: tTask('table.name'),
    duration: tTask('table.duration'),
  }), [tTask]);

  // Groeperingsweergave: banden per activity-code-waarde (gedeelde util met TableEditor).
  const grouping = useMemo(() => {
    if (!groupBy) return undefined;
    const type = activityCodeTypes.find(t => t.id === groupBy);
    if (!type) return undefined;
    return groupTasksByCode(tasks, type, tTask('structure.none'));
  }, [groupBy, activityCodeTypes, tasks, tTask]);

  // Path tracing rond de (eerst) geselecteerde taak: transitieve voorgangers/opvolgers, met de
  // driving-ketens apart zodat de renderer die sterker kan tinten (MSP Task Path-conventie).
  const trace = useMemo(() => {
    if (traceMode === 'off' || selectedTaskIds.length === 0) return undefined;
    const focusId = selectedTaskIds[0];
    const drivingIds = cpmResult && !cpmResult.error
      ? new Set(cpmResult.drivingSequenceIds)
      : undefined;
    const tr = traceFrom(focusId, sequences, drivingIds);
    return {
      focusId,
      predecessors: traceMode !== 'successors' ? [...tr.predecessors] : [],
      drivingPredecessors: traceMode !== 'successors' ? [...tr.drivingPredecessors] : [],
      successors: traceMode !== 'predecessors' ? [...tr.successors] : [],
      drivenSuccessors: traceMode !== 'predecessors' ? [...tr.drivenSuccessors] : [],
    };
  }, [traceMode, selectedTaskIds, sequences, cpmResult]);

  // Show toast when CPM detects circular dependency
  useEffect(() => {
    if (cpmResult?.error) {
      setToast({ message: cpmResult.error, type: 'error' });
    }
  }, [cpmResult]);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Effective timeline origin (the date mapped to scrollX = 0). The stored
  // viewStartDate defaults to "today" and never accounts for tasks that start
  // earlier; since the horizontal scrollbar (and the setScroll clamp) only
  // allow scrollX >= 0, anything left of the origin is unreachable. Pin the
  // origin to the earliest task start (or today, whichever is earlier) minus a
  // small padding so past tasks become scrollable into view.
  const effectiveViewStart = useMemo(() => {
    let earliest = parseDate(view.viewStartDate);
    for (const task of tasks) {
      const start = task.time.earlyStart || task.time.scheduleStart || task.time.lateStart;
      if (start) {
        const d = parseDate(start);
        if (d.getTime() < earliest.getTime()) earliest = d;
      }
    }
    return formatDate(addCalendarDays(earliest, -ORIGIN_PADDING_DAYS));
  }, [tasks, view.viewStartDate]);

  // The view handed to the renderer/content-width uses the effective origin so
  // the date<->x mapping stays consistent across canvas, scrollbar and zoom.
  const effectiveView = useMemo(
    () => ({ ...view, viewStartDate: effectiveViewStart }),
    [view, effectiveViewStart],
  );

  // Calculate total content width based on task date range
  const totalContentWidth = useMemo(() => {
    if (tasks.length === 0) return 2000;
    const viewStart = effectiveViewStart;
    let maxDays = 365;
    for (const task of tasks) {
      const end = task.time.earlyFinish || task.time.scheduleFinish || task.time.lateFinish;
      if (end) {
        const days = diffDays(viewStart, end);
        if (days > maxDays) maxDays = days;
      }
    }
    return Math.max(2000, (maxDays * 1.2) * view.zoom + TASK_TABLE_WIDTH);
  }, [tasks, effectiveViewStart, view.zoom]);

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

    const opts: GanttRenderOptions = {
      tasks,
      sequences,
      calendar,
      view: effectiveView,
      selectedTaskIds,
      collapsedTaskIds,
      drivingSequenceIds: cpmResult && !cpmResult.error ? cpmResult.drivingSequenceIds : undefined,
      trace,
      grouping,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      taskTableWidth: TASK_TABLE_WIDTH,
      rowHeight: ROW_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      localizedMonths,
      columnHeaders,
      weekStartDay,
      enableQuarterHourZoom,
    };

    const renderer = new GanttRenderer(ctx, opts);
    rendererRef.current = renderer;
    renderer.render();
  }, [tasks, sequences, calendar, effectiveView, selectedTaskIds, collapsedTaskIds, cpmResult, trace, grouping, localizedMonths, columnHeaders, uiTheme, weekStartDay, enableQuarterHourZoom]);

  // Render on changes
  useEffect(() => {
    const frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [render]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(render);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [render]);

  // Sync horizontal scrollbar with canvas scrollX (also re-sync after zoom changes)
  useEffect(() => {
    const hScroll = hScrollRef.current;
    if (!hScroll) return;
    const desired = view.scrollX;
    if (Math.abs(hScroll.scrollLeft - desired) > 1) {
      hScroll.scrollLeft = desired;
    }
  }, [view.scrollX, view.zoom]);

  const defaultTaskName = tTask('defaultTask');
  const defaultMilestoneName = tTask('defaultMilestone');

  // Click handler with collapse/expand, '+' button support, and multi-selection
  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    if (y < HEADER_HEIGHT) return;

    // Check collapse/expand toggle
    if (renderer.isInTaskTable(x)) {
      const collapseTask = renderer.isCollapseToggle(x, y);
      if (collapseTask) {
        toggleCollapse(collapseTask.id);
        return;
      }

      // Check '+' button (add child task)
      const addTarget = renderer.isAddButton(x, y);
      if (addTarget) {
        const startDate = project.startDate || formatDate(new Date());
        addTask({
          name: defaultTaskName,
          parentId: addTarget.id,
          time: createDefaultTaskTime(startDate, 5),
        });
        return;
      }
    }

    // Normal task selection with multi-select support
    const task = renderer.getTaskAtY(y);
    if (task) {
      if (e.shiftKey) {
        // Shift+click: range selection
        selectTask(task.id, false, true);
      } else if (e.ctrlKey || e.metaKey) {
        // Ctrl+click: toggle individual task in selection
        selectTask(task.id, true, false);
      } else {
        // Plain click: single select (deselect others)
        selectTask(task.id, false, false);
      }
    } else {
      deselectAll();
    }
  }, [selectTask, deselectAll, toggleCollapse, addTask, project.startDate, defaultTaskName]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    const task = renderer.getTaskAtY(y);
    if (task) {
      setUI({ showTaskDialog: true, editingTaskId: task.id });
    }
  }, [setUI]);

  // Right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    if (y < HEADER_HEIGHT) return;

    const task = renderer.getTaskAtY(y);
    if (task) {
      selectTask(task.id, false);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, task });
  }, [selectTask]);

  // Drag and drop: mousedown (task move/resize + dependency drawing)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    if (y < HEADER_HEIGHT) return;

    const hit = renderer.getTaskBarBounds(x, y);
    if (hit) {
      // Shift+drag from task bar starts dependency drawing
      if (e.shiftKey) {
        e.preventDefault();
        setDepDragState({
          sourceTaskId: hit.task.id,
          sourceX: e.clientX,
          sourceY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
        });
        return;
      }

      e.preventDefault();
      setDragState({
        taskId: hit.task.id,
        edge: hit.edge,
        startX: e.clientX,
        originalStart: hit.task.time.earlyStart || hit.task.time.scheduleStart,
        originalFinish: hit.task.time.earlyFinish || hit.task.time.scheduleFinish,
        originalDuration: hit.task.time.scheduleDuration,
      });
      selectTask(hit.task.id, false);
      return;
    }

    // No bar hit: in 'drag' scroll mode, grabbing the empty chart background
    // pans the view (map-style). Only in the gantt area, never the task table
    // (the table has no horizontal pan and stays interactive).
    if (scrollMode === 'drag' && x >= TASK_TABLE_WIDTH) {
      e.preventDefault();
      const v = useAppStore.getState().view;
      setPanState({
        startClientX: e.clientX,
        startClientY: e.clientY,
        originScrollX: v.scrollX,
        originScrollY: v.scrollY,
      });
    }
  }, [selectTask, scrollMode]);

  // Map-style pan: translate pointer movement into scroll offsets. Dragging the
  // canvas content to the right reveals earlier content, so scrollX decreases.
  useEffect(() => {
    if (!panState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panState.startClientX;
      const dy = e.clientY - panState.startClientY;
      setScroll(panState.originScrollX - dx, panState.originScrollY - dy);
    };

    const handleMouseUp = () => setPanState(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [panState, setScroll]);

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
        if (targetTask && targetTask.id !== depDragState.sourceTaskId && x >= TASK_TABLE_WIDTH) {
          // Create Finish-to-Start dependency
          addSequence({
            predecessorId: depDragState.sourceTaskId,
            successorId: targetTask.id,
            type: 'FINISH_START',
            lagDays: 0,
          });
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

  // Drag and drop: mousemove (via native event for performance)
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const pixelDelta = e.clientX - dragState.startX;
      const daysDelta = Math.round(pixelDelta / view.zoom);
      if (daysDelta === 0) return;

      const origStart = parseDate(dragState.originalStart);
      const origFinish = parseDate(dragState.originalFinish);

      if (dragState.edge === 'body') {
        // Move entire task
        const newStart = addCalendarDays(origStart, daysDelta);
        const newFinish = addCalendarDays(origFinish, daysDelta);
        updateTask(dragState.taskId, {
          time: {
            ...useAppStore.getState().tasks.find(t => t.id === dragState.taskId)!.time,
            scheduleStart: formatDate(newStart),
            scheduleFinish: formatDate(newFinish),
            earlyStart: formatDate(newStart),
            earlyFinish: formatDate(newFinish),
          },
        });
      } else if (dragState.edge === 'right') {
        // Resize from right (change duration/finish)
        const newFinish = addCalendarDays(origFinish, daysDelta);
        const newDuration = Math.max(1, diffCalendarDays(origStart, newFinish));
        updateTask(dragState.taskId, {
          time: {
            ...useAppStore.getState().tasks.find(t => t.id === dragState.taskId)!.time,
            scheduleFinish: formatDate(newFinish),
            earlyFinish: formatDate(newFinish),
            scheduleDuration: newDuration,
          },
        });
      } else if (dragState.edge === 'left') {
        // Resize from left (change start/duration)
        const newStart = addCalendarDays(origStart, daysDelta);
        const newDuration = Math.max(1, diffCalendarDays(newStart, origFinish));
        updateTask(dragState.taskId, {
          time: {
            ...useAppStore.getState().tasks.find(t => t.id === dragState.taskId)!.time,
            scheduleStart: formatDate(newStart),
            earlyStart: formatDate(newStart),
            scheduleDuration: newDuration,
          },
        });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, view.zoom, updateTask]);

  // Cursor changes on hover + tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragState || depDragState || panState) {
      setTooltip(null);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    if (y < HEADER_HEIGHT) {
      setCursor('default');
      setTooltip(null);
      return;
    }

    // Check for task bar edges
    const hit = renderer.getTaskBarBounds(x, y);
    if (hit) {
      if (hit.edge === 'left' || hit.edge === 'right') {
        setCursor('ew-resize');
      } else {
        setCursor(e.shiftKey ? 'crosshair' : 'grab');
      }
      // Show tooltip for the hovered task
      setTooltip({ x: e.clientX, y: e.clientY, task: hit.task });
      return;
    }

    // Check if hovering task row in gantt area (not just bar)
    const hoveredTask = renderer.getTaskAtY(y);
    if (hoveredTask && x >= TASK_TABLE_WIDTH) {
      setTooltip({ x: e.clientX, y: e.clientY, task: hoveredTask });
    } else {
      setTooltip(null);
    }

    // Check for collapse toggle or '+' button
    if (renderer.isInTaskTable(x)) {
      if (renderer.isCollapseToggle(x, y) || renderer.isAddButton(x, y)) {
        setCursor('pointer');
        setTooltip(null);
        return;
      }
    }

    // In 'drag' scroll mode, show a grab affordance over the pannable chart
    // background so panning is discoverable.
    if (scrollMode === 'drag' && x >= TASK_TABLE_WIDTH) {
      setCursor('grab');
      return;
    }

    setCursor('default');
  }, [dragState, depDragState, panState, scrollMode]);

  // Hide tooltip on mouse leave
  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleHScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScroll(target.scrollLeft, view.scrollY);
  }, [setScroll, view.scrollY]);

  const startDate = project.startDate || formatDate(new Date());

  // Format date for tooltip display
  const formatTooltipDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = parseDate(dateStr);
      return `${d.getUTCDate().toString().padStart(2, '0')}-${(d.getUTCMonth() + 1).toString().padStart(2, '0')}-${d.getUTCFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{
            cursor: panState
              ? 'grabbing'
              : dragState
                ? (dragState.edge === 'body' ? 'grabbing' : 'ew-resize')
                : depDragState
                  ? 'crosshair'
                  : cursor,
          }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
        />
        {/* Overlay canvas for dependency drag line */}
        <canvas
          ref={depLineCanvasRef}
          className="absolute inset-0"
          style={{ pointerEvents: 'none' }}
        />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="gantt-tooltip"
            style={{
              left: tooltip.x - (containerRef.current?.getBoundingClientRect().left || 0) + 16,
              top: tooltip.y - (containerRef.current?.getBoundingClientRect().top || 0) - 10,
            }}
          >
            <div className="tooltip-title">{tooltip.task.name}</div>
            <div className="tooltip-row">
              <span className="tooltip-label">WBS:</span>
              <span className="tooltip-value">{tooltip.task.wbsCode || '-'}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Duration:</span>
              <span className="tooltip-value">{tooltip.task.time.scheduleDuration}d</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Start:</span>
              <span className="tooltip-value">{formatTooltipDate(tooltip.task.time.earlyStart || tooltip.task.time.scheduleStart)}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">End:</span>
              <span className="tooltip-value">{formatTooltipDate(tooltip.task.time.earlyFinish || tooltip.task.time.scheduleFinish)}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Status:</span>
              <span className="tooltip-value">{tooltip.task.status}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Critical:</span>
              <span className={tooltip.task.time.isCritical ? 'tooltip-critical-yes' : 'tooltip-value'}>
                {tooltip.task.time.isCritical ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Total float:</span>
              <span className="tooltip-value">{tooltip.task.time.totalFloat}d</span>
            </div>
          </div>
        )}
      </div>
      {/* Horizontal scrollbar */}
      <div
        ref={hScrollRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{ height: 14, flexShrink: 0 }}
        onScroll={handleHScroll}
      >
        <div style={{ width: totalContentWidth, height: 1 }} />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          task={contextMenu.task}
          traceActive={traceMode !== 'off'}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            if (contextMenu.task) setUI({ showTaskDialog: true, editingTaskId: contextMenu.task.id });
          }}
          onAddSubtask={() => {
            const parentId = contextMenu.task?.id || null;
            addTask({
              name: defaultTaskName,
              parentId,
              time: createDefaultTaskTime(startDate, 5),
            });
          }}
          onAddMilestone={() => {
            addTask({
              name: defaultMilestoneName,
              isMilestone: true,
              taskType: 'ATTENDANCE',
              parentId: contextMenu.task?.id || null,
              time: createDefaultTaskTime(startDate, 0),
            });
          }}
          onAddRelation={() => {
            if (contextMenu.task) {
              setUI({ showDependencyMode: true, dependencySourceId: contextMenu.task.id });
            }
          }}
          onTracePath={() => {
            if (traceMode !== 'off') {
              setUI({ traceMode: 'off' });
            } else if (contextMenu.task) {
              selectTask(contextMenu.task.id);
              setUI({ traceMode: 'both' });
            }
          }}
          onToggleCollapse={() => {
            if (contextMenu.task) toggleCollapse(contextMenu.task.id);
          }}
          onDelete={() => {
            if (contextMenu.task) deleteTask(contextMenu.task.id);
          }}
          onAddTask={() => {
            addTask({
              name: defaultTaskName,
              time: createDefaultTaskTime(startDate, 5),
            });
          }}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className={`gantt-toast ${toast.type === 'error' ? 'toast-error' : 'toast-info'}`}
          onClick={() => setToast(null)}
          style={{ cursor: 'pointer' }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
