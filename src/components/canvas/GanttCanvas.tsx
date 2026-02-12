import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { GanttRenderer, GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import { diffDays, formatDate, parseDate, addCalendarDays, diffCalendarDays } from '@/utils/dateUtils';
import { createDefaultTaskTime, Task } from '@/types/task';
import { ContextMenu } from './ContextMenu';

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 50;
const TASK_TABLE_WIDTH = 350;

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

export function GanttCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);

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
  const updateTask = useAppStore(s => s.updateTask);
  const deleteTask = useAppStore(s => s.deleteTask);
  const setScroll = useAppStore(s => s.setScroll);
  const setZoom = useAppStore(s => s.setZoom);
  const setUI = useAppStore(s => s.setUI);
  const project = useAppStore(s => s.project);

  const rendererRef = useRef<GanttRenderer | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [cursor, setCursor] = useState('default');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Calculate total content width based on task date range
  const totalContentWidth = useMemo(() => {
    if (tasks.length === 0) return 2000;
    const viewStart = view.viewStartDate;
    let maxDays = 365;
    for (const task of tasks) {
      const end = task.time.earlyFinish || task.time.scheduleFinish || task.time.lateFinish;
      if (end) {
        const days = diffDays(viewStart, end);
        if (days > maxDays) maxDays = days;
      }
    }
    return Math.max(2000, (maxDays * 1.2) * view.zoom + TASK_TABLE_WIDTH);
  }, [tasks, view.viewStartDate, view.zoom]);

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
      view,
      selectedTaskIds,
      collapsedTaskIds,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      taskTableWidth: TASK_TABLE_WIDTH,
      rowHeight: ROW_HEIGHT,
      headerHeight: HEADER_HEIGHT,
    };

    const renderer = new GanttRenderer(ctx, opts);
    rendererRef.current = renderer;
    renderer.render();
  }, [tasks, sequences, calendar, view, selectedTaskIds, collapsedTaskIds]);

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

  // Native wheel handler to prevent browser zoom on ctrl+scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -5 : 5;
        setZoom(view.zoom + delta);
      } else if (e.shiftKey) {
        setScroll(view.scrollX + e.deltaY, view.scrollY);
      } else {
        setScroll(view.scrollX + e.deltaX, view.scrollY + e.deltaY);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [view.zoom, view.scrollX, view.scrollY, setZoom, setScroll]);

  // Sync horizontal scrollbar with canvas scrollX
  useEffect(() => {
    const hScroll = hScrollRef.current;
    if (!hScroll) return;
    const scrollLeft = view.scrollX;
    if (Math.abs(hScroll.scrollLeft - scrollLeft) > 1) {
      hScroll.scrollLeft = scrollLeft;
    }
  }, [view.scrollX]);

  // Click handler with collapse/expand and '+' button support
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
          name: 'Nieuwe taak',
          parentId: addTarget.id,
          time: createDefaultTaskTime(startDate, 5),
        });
        return;
      }
    }

    // Normal task selection
    const task = renderer.getTaskAtY(y);
    if (task) {
      selectTask(task.id, e.ctrlKey || e.metaKey);
    } else {
      deselectAll();
    }
  }, [selectTask, deselectAll, toggleCollapse, addTask, project.startDate]);

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

  // Drag and drop: mousedown
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
    }
  }, [selectTask]);

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

  // Cursor changes on hover
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragState) return; // Don't change cursor while dragging
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    if (y < HEADER_HEIGHT) {
      setCursor('default');
      return;
    }

    // Check for task bar edges
    const hit = renderer.getTaskBarBounds(x, y);
    if (hit) {
      if (hit.edge === 'left' || hit.edge === 'right') {
        setCursor('ew-resize');
      } else {
        setCursor('grab');
      }
      return;
    }

    // Check for collapse toggle or '+' button
    if (renderer.isInTaskTable(x)) {
      if (renderer.isCollapseToggle(x, y) || renderer.isAddButton(x, y)) {
        setCursor('pointer');
        return;
      }
    }

    setCursor('default');
  }, [dragState]);

  const handleHScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScroll(target.scrollLeft, view.scrollY);
  }, [setScroll, view.scrollY]);

  const startDate = project.startDate || formatDate(new Date());

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ cursor: dragState ? (dragState.edge === 'body' ? 'grabbing' : 'ew-resize') : cursor }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onContextMenu={handleContextMenu}
        />
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
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            if (contextMenu.task) setUI({ showTaskDialog: true, editingTaskId: contextMenu.task.id });
          }}
          onAddSubtask={() => {
            const parentId = contextMenu.task?.id || null;
            addTask({
              name: 'Nieuwe taak',
              parentId,
              time: createDefaultTaskTime(startDate, 5),
            });
          }}
          onAddMilestone={() => {
            addTask({
              name: 'Nieuwe mijlpaal',
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
          onToggleCollapse={() => {
            if (contextMenu.task) toggleCollapse(contextMenu.task.id);
          }}
          onDelete={() => {
            if (contextMenu.task) deleteTask(contextMenu.task.id);
          }}
          onAddTask={() => {
            addTask({
              name: 'Nieuwe taak',
              time: createDefaultTaskTime(startDate, 5),
            });
          }}
        />
      )}
    </div>
  );
}
