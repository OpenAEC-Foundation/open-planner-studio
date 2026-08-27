import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import type { HistogramRenderer } from '@/engine/renderer/HistogramRenderer';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';

export interface GanttHistogramTooltip {
  x: number;
  y: number;
  lines: string[];
}

interface GanttHistogramInteractionInput {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  rendererRef: RefObject<HistogramRenderer | null>;
  assignments: ResourceAssignment[];
  resources: Resource[];
  tasks: Task[];
  selectedResourceId?: string;
  selectResource: (resourceId?: string) => void;
  formatContributionLabel: (count: number, isoDate: string) => string;
}

interface GanttHistogramInteraction {
  tooltip: GanttHistogramTooltip | null;
  onClick: (event: ReactMouseEvent<HTMLCanvasElement>) => void;
  clearTooltip: () => void;
}

/**
 * Bezit de interactie rond het bestaande histogramcanvas. Coördinaten worden uitsluitend aan de
 * levende HistogramRenderer voorgelegd; deze hook bouwt geen tijdas, picker of serie opnieuw op.
 */
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
  } = input;
  const [tooltip, setTooltip] = useState<GanttHistogramTooltip | null>(null);

  const clearTooltip = useCallback(() => setTooltip(null), []);

  // Het bestaande klikresultaat verdwijnt na zes seconden. De timer hoort bij dezelfde eigenaar
  // als de tooltipstate, zodat uitzetten/unmounten hem via de effect-cleanup opruimt.
  useEffect(() => {
    if (!tooltip) return;
    const timer = setTimeout(clearTooltip, 6000);
    return () => clearTimeout(timer);
  }, [tooltip, clearTooltip]);

  const contributingTaskNames = useCallback((isoDate: string): string[] => {
    const names = new Set<string>();
    for (const assignment of assignments) {
      if (selectedResourceId && assignment.resourceId !== selectedResourceId) continue;
      if (!selectedResourceId) {
        const resource = resources.find(candidate => candidate.id === assignment.resourceId);
        if (!resource || resource.type === 'MATERIAL') continue;
      }
      const task = tasks.find(candidate => candidate.id === assignment.taskId);
      if (!task) continue;
      const start = task.time.earlyStart || task.time.scheduleStart;
      const finish = task.time.earlyFinish || task.time.scheduleFinish;
      if (start && finish && isoDate >= start && isoDate <= finish) names.add(task.name || task.id);
    }
    return [...names];
  }, [assignments, resources, tasks, selectedResourceId]);

  const onClick = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pickerItem = renderer.pickerAt(x, y);
    if (pickerItem) {
      selectResource(pickerItem.id);
      clearTooltip();
      return;
    }
    const isoDate = renderer.dayAt(x, y);
    if (!isoDate) {
      clearTooltip();
      return;
    }
    const names = contributingTaskNames(isoDate);
    setTooltip({
      x: event.clientX,
      y: event.clientY,
      lines: [formatContributionLabel(names.length, isoDate), ...names.slice(0, 8)],
    });
  }, [canvasRef, rendererRef, selectResource, formatContributionLabel, contributingTaskNames, clearTooltip]);

  return { tooltip, onClick, clearTooltip };
}
