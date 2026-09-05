import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import type { HistogramRenderer } from '@/engine/renderer/HistogramRenderer';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';

export interface GanttHistogramTooltip {
  x: number;
  y: number;
  lines: string[];
  /** ISO-dag waarvoor `lines` is opgebouwd — gebruikt om een mousemove binnen dezelfde dag te
   *  onderscheiden van een overstap naar een andere dag (zie `onMouseMove`). */
  isoDate: string;
}

/** Vertraging vóór een hover de tooltip toont — dezelfde orde van grootte als de generieke
 *  `title`-tooltip elders in de app (`TooltipHost`, 400 ms): kort genoeg om niet traag te voelen,
 *  lang genoeg om een muis die gewoon over de strook passeert niet te laten opflitsen. */
const HOVER_DELAY_MS = 300;

interface GanttHistogramInteractionInput {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  rendererRef: RefObject<HistogramRenderer | null>;
  assignments: ResourceAssignment[];
  resources: Resource[];
  tasks: Task[];
  selectedResourceId?: string;
  selectResource: (resourceId?: string) => void;
  formatContributionLabel: (count: number, isoDate: string) => string;
  /** R1: extra tooltipregel als deze dag voor `selectedResourceId` overbezet is met reden
   *  `non-working-day` (de resourcekalender kent die dag geen werkdag). `null` als niet van
   *  toepassing. Alleen aangeroepen met een gekozen resource — bij "alle resources" kan een dag
   *  meerdere resources met eventueel verschillende redenen optellen, dus daar blijft de tooltip
   *  ongewijzigd. */
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

/**
 * Bezit de interactie rond het bestaande histogramcanvas. Coördinaten worden uitsluitend aan de
 * levende HistogramRenderer voorgelegd; deze hook bouwt geen tijdas, picker of serie opnieuw op.
 *
 * Tooltipgedrag (eigenaarscorrectie op R1): een ECHTE hover-tooltip, niet een klikresultaat.
 * `onMouseMove` toont de bijdragende-takenlijst na `HOVER_DELAY_MS` boven een dagkolom, ververst
 * zodra de muis naar een andere dag gaat (meteen verbergen + opnieuw vertragen — hetzelfde patroon
 * als `TooltipHost`s `dismiss()` gevolgd door een nieuwe timer) en verdwijnt bij het verlaten van de
 * strook (`onMouseLeave`). Een klik selecteert alleen nog de resource via `pickerAt` — de tooltip zelf
 * opent niet meer bij klik, maar `onKeyDown`s bestaande picker-navigatie (↑/↓) blijft ongewijzigd en
 * mag de tooltip laten staan/wissen zoals voorheen.
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
    describeNonWorkingDay,
  } = input;
  const [tooltip, setTooltip] = useState<GanttHistogramTooltip | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // De dag waarvoor een hover momenteel getoond wordt óf waarvoor de vertragingstimer loopt —
  // zodat een mousemove binnen dezelfde dag geen nieuwe vertraging start (alleen de positie volgt).
  const hoverDateRef = useRef<string | null>(null);

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

  // Opruimen bij unmount (en bij elke re-render die de timer al verving — de ref-vlag voorkomt dat
  // een oude cleanup een inmiddels vervangen timer opruimt, al gebeurt dat hier niet want er is maar
  // één plek die de ref zet).
  useEffect(() => clearHoverTimer, [clearHoverTimer]);

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
    // Geen tooltip meer bij klik (eigenaarscorrectie): dat is nu uitsluitend hover (`onMouseMove`).
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

    // Boven een picker-rij (de resourcelijst zelf) toont deze strook geen dag-tooltip.
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
      // Zelfde dag: alleen meebewegen met de cursor, geen nieuwe vertraging/herberekening.
      setTooltip(prev => (prev && prev.isoDate === isoDate ? { ...prev, x: clientX, y: clientY } : prev));
      return;
    }

    // Andere dag (of eerste hover): meteen verbergen, dan opnieuw vertragen — zelfde patroon als
    // `TooltipHost`s dismiss-vóór-nieuwe-timer.
    clearHoverTimer();
    hoverDateRef.current = isoDate;
    setTooltip(null);
    hoverTimer.current = setTimeout(() => {
      if (hoverDateRef.current !== isoDate) return; // de muis is intussen alweer verder gegaan
      setTooltip(buildTooltip(isoDate, clientX, clientY));
    }, HOVER_DELAY_MS);
  }, [canvasRef, rendererRef, clearTooltip, clearHoverTimer, buildTooltip]);

  const onMouseLeave = useCallback(() => {
    clearTooltip();
  }, [clearTooltip]);

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

  return { tooltip, onClick, onMouseMove, onMouseLeave, onKeyDown, clearTooltip };
}
