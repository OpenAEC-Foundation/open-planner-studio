import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import type { HistogramRenderer } from '@/engine/renderer/HistogramRenderer';
import { resourceIsLevelable, type Resource, type ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import { computedFinish, computedStart } from '@/utils/taskDates';

export interface GanttHistogramTooltip {
  x: number;
  y: number;
  lines: string[];
  isoDate: string;
}

const HOVER_DELAY_MS = 300;

const TOOLTIP_SAFETY_NET_MS = 6000;

interface GanttHistogramInteractionInput {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  rendererRef: RefObject<HistogramRenderer | null>;
  assignments: ResourceAssignment[];
  resources: Resource[];
  tasks: Task[];
  selectedResourceId?: string;
  selectResource: (resourceId?: string) => void;
  formatContributionLabel: (count: number, isoDate: string) => string;
  active: boolean;
  describeNonWorkingDay?: (resourceId: string, isoDate: string) => string | null;
}

interface GanttHistogramInteraction {
  tooltip: GanttHistogramTooltip | null;
  onClick: (event: ReactMouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (event: ReactMouseEvent<HTMLCanvasElement>) => void;
  onMouseLeave: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLCanvasElement>) => void;
  clearTooltip: () => void;
}

export function useGanttHistogramInteraction(
  input: GanttHistogramInteractionInput,
): GanttHistogramInteraction {
  const {
    canvasRef,
    rendererRef,
    assignments,
    resources,
    tasks,
    selectedResourceId,
    selectResource,
    formatContributionLabel,
    describeNonWorkingDay,
    active,
  } = input;
  const [tooltip, setTooltip] = useState<GanttHistogramTooltip | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hoverDateRef = useRef<string | null>(null);
  const taskIndex = useRef<{ source: Task[]; byId: Map<string, Task> } | null>(null);
  const resourceIndex = useRef<{ source: Resource[]; byId: Map<string, Resource> } | null>(null);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = undefined;
    }
  }, []);

  const clearTooltip = useCallback(() => {
    clearHoverTimer();
    hoverDateRef.current = null;
    setTooltip(null);
  }, [clearHoverTimer]);

  useEffect(() => clearHoverTimer, [clearHoverTimer]);

  useEffect(() => {
    if (!active) clearTooltip();
  }, [active, clearTooltip]);

  useEffect(() => {
    if (!tooltip) return;
    const timer = setTimeout(clearTooltip, TOOLTIP_SAFETY_NET_MS);
    return () => clearTimeout(timer);
  }, [tooltip, clearTooltip]);

  const contributingTaskNames = useCallback((isoDate: string): string[] => {
    if (taskIndex.current?.source !== tasks) {
      const byId = new Map<string, Task>();
      for (const task of tasks) if (!byId.has(task.id)) byId.set(task.id, task);
      taskIndex.current = { source: tasks, byId };
    }
    if (!selectedResourceId && resourceIndex.current?.source !== resources) {
      const byId = new Map<string, Resource>();
      for (const resource of resources) if (!byId.has(resource.id)) byId.set(resource.id, resource);
      resourceIndex.current = { source: resources, byId };
    }
    const names = new Set<string>();
    for (const assignment of assignments) {
      if (selectedResourceId && assignment.resourceId !== selectedResourceId) continue;
      if (!selectedResourceId) {
        const resource = resourceIndex.current!.byId.get(assignment.resourceId);
        if (!resource || !resourceIsLevelable(resource)) continue;
      }
      const task = taskIndex.current.byId.get(assignment.taskId);
      if (!task) continue;
      const start = computedStart(task)?.slice(0, 10);
      const finish = computedFinish(task)?.slice(0, 10);
      if (start && finish && isoDate >= start && isoDate <= finish) names.add(task.name || task.id);
    }
    return [...names];
  }, [assignments, resources, tasks, selectedResourceId]);

  const buildTooltip = useCallback((isoDate: string, x: number, y: number): GanttHistogramTooltip => {
    const names = contributingTaskNames(isoDate);
    const lines = [formatContributionLabel(names.length, isoDate), ...names.slice(0, 8)];
    const reasonLine = selectedResourceId ? describeNonWorkingDay?.(selectedResourceId, isoDate) : null;
    if (reasonLine) lines.push(reasonLine);
    return { x, y, lines, isoDate };
  }, [contributingTaskNames, formatContributionLabel, selectedResourceId, describeNonWorkingDay]);

  const onClick = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pickerItem = renderer.pickerAt(x, y);
    if (pickerItem) selectResource(pickerItem.id);
  }, [canvasRef, rendererRef, selectResource]);

  const onMouseMove = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const clientX = event.clientX;
    const clientY = event.clientY;

    if (renderer.pickerAt(x, y)) {
      clearTooltip();
      return;
    }

    const isoDate = renderer.dayAt(x, y);
    if (!isoDate) {
      clearTooltip();
      return;
    }

    if (isoDate === hoverDateRef.current) {
      setTooltip(prev => (prev && prev.isoDate === isoDate ? { ...prev, x: clientX, y: clientY } : prev));
      return;
    }

    clearHoverTimer();
    hoverDateRef.current = isoDate;
    setTooltip(null);
    hoverTimer.current = setTimeout(() => {
      if (hoverDateRef.current !== isoDate) return;
      setTooltip(buildTooltip(isoDate, clientX, clientY));
    }, HOVER_DELAY_MS);
  }, [canvasRef, rendererRef, clearTooltip, clearHoverTimer, buildTooltip]);

  const onMouseLeave = useCallback(() => {
    clearTooltip();
  }, [clearTooltip]);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (
      (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
      || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    ) return;

    const ids: (string | undefined)[] = [undefined, ...resources.map(resource => resource.id)];
    if (ids.length <= 1) return;
    const currentIndex = ids.indexOf(selectedResourceId);
    const step = event.key === 'ArrowUp' ? -1 : 1;
    const nextIndex = Math.max(0, Math.min(ids.length - 1, currentIndex + step));
    event.preventDefault();
    event.stopPropagation();
    if (nextIndex === currentIndex) return;
    selectResource(ids[nextIndex]);
    clearTooltip();
  }, [resources, selectedResourceId, selectResource, clearTooltip]);

  return { tooltip, onClick, onMouseMove, onMouseLeave, onKeyDown, clearTooltip };
}
