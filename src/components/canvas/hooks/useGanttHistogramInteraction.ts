import { useCallback, useEffect, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, RefObject } from 'react';
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
  onKeyDown: (event: ReactKeyboardEvent<HTMLCanvasElement>) => void;
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

  /**
   * De resourcelijst is getekend op het canvas, dus heeft geen DOM-listbox die de pijltjes al
   * gratis afhandelt. De volgorde is expres dezelfde als `buildHistogramPicker`: eerst de
   * verzamelrij, daarna de projectresources. Kale pijltjes blijven binnen dit focusoppervlak;
   * gemodificeerde pijltjes behoren aan bestaande globale sneltoetsen toe.
   */
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

  return { tooltip, onClick, onKeyDown, clearTooltip };
}
