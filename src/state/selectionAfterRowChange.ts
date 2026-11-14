import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';

/**
 * Selectie na in-/uitklappen en verwijderen (issue #899). Zonder deze regels bleef de selectie op
 * een verborgen of verdwenen taak staan, en zette het raster zijn celcursor op de bovenste rij.
 * Beide functies muteren een (Immer-)draft en raken niets aan als er niets verandert.
 */
interface SelectionDraft {
  tasks: Task[];
  selectedTaskIds: string[];
  activeTaskId: string | null;
  viewRows: ViewRow[];
}

export function visibleTaskIdSet(rows: readonly ViewRow[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) if (row.kind === 'task') ids.add(row.task.id);
  return ids;
}

/**
 * Na inklappen: een geselecteerde taak die vóór het inklappen zichtbaar was en nu niet meer, gaat
 * over op haar dichtstbijzijnde zichtbare voorouder (de ingeklapte samenvatting). Een taak die al
 * onzichtbaar was (filter, ingeklapte band) blijft zoals hij was.
 */
export function liftSelectionOutOfCollapsed(s: SelectionDraft, visibleBefore: ReadonlySet<string>): void {
  const visibleNow = visibleTaskIdSet(s.viewRows);
  const byId = new Map(s.tasks.map(task => [task.id, task] as const));
  const lift = (id: string): string => {
    if (!visibleBefore.has(id) || visibleNow.has(id)) return id;
    const seen = new Set<string>([id]);
    let parentId = byId.get(id)?.parentId ?? null;
    // Bezocht-bewaking: een corrupte parentId-cyclus kan via import binnenkomen.
    while (parentId && !seen.has(parentId)) {
      if (visibleNow.has(parentId)) return parentId;
      seen.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return id;
  };
  const nextSelected = [...new Set(s.selectedTaskIds.map(lift))];
  const nextActive = s.activeTaskId === null ? null : lift(s.activeTaskId);
  const unchanged = nextActive === s.activeTaskId
    && nextSelected.length === s.selectedTaskIds.length
    && nextSelected.every((id, index) => id === s.selectedTaskIds[index]);
  if (unchanged) return;
  s.selectedTaskIds = nextSelected;
  s.activeTaskId = nextActive;
}

/**
 * Na verwijderen: is de hele selectie weg, dan wordt de taak geselecteerd die nu op de plek van de
 * bovenste verwijderde rij staat (de eerste overgebleven rij eronder), en anders de dichtstbijzijnde
 * erboven. Dezelfde regel als de celcursor van het raster (`reconcileGridSelection`). Bleef een
 * deel van de selectie over, dan blijft dat deel staan.
 */
export function selectNeighbourAfterRemoval(
  s: SelectionDraft,
  rowsBefore: readonly ViewRow[],
  selectedBefore: readonly string[],
): void {
  if (s.selectedTaskIds.length > 0 || selectedBefore.length === 0) return;
  const remaining = new Set(s.tasks.map(task => task.id));
  const order: string[] = [];
  for (const row of rowsBefore) if (row.kind === 'task') order.push(row.task.id);
  const wasSelected = new Set(selectedBefore);
  const anchor = order.findIndex(id => wasSelected.has(id) && !remaining.has(id));
  if (anchor < 0) return;
  let neighbour: string | undefined;
  for (let index = anchor + 1; index < order.length && !neighbour; index++) {
    if (remaining.has(order[index])) neighbour = order[index];
  }
  for (let index = anchor - 1; index >= 0 && !neighbour; index--) {
    if (remaining.has(order[index])) neighbour = order[index];
  }
  if (!neighbour) return;
  s.selectedTaskIds = [neighbour];
  s.activeTaskId = neighbour;
}
