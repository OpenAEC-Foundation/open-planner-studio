import { uniqueTaskIds, type ViewRow } from '@/engine/view/visibleRows';
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
  ui: { gridActiveRowKey: string | null };
}

/**
 * Na inklappen: een geselecteerde taak die vóór het inklappen zichtbaar was en nu niet meer, gaat
 * over op haar dichtstbijzijnde zichtbare voorouder (de ingeklapte samenvatting). Een taak die al
 * onzichtbaar was (filter, ingeklapte band) blijft zoals hij was.
 */
export function liftSelectionOutOfCollapsed(s: SelectionDraft, visibleBefore: ReadonlySet<string>): void {
  const visibleNow = new Set(uniqueTaskIds(s.viewRows));
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
 * Na verwijderen: is de hele selectie weg, dan wordt de eerste rij onder de verwijderde rij
 * geselecteerd die nu zichtbaar is, en anders de dichtstbijzijnde erboven. Dezelfde regel als de
 * celcursor van het raster (`reconcileGridSelection`). Bleef een deel van de selectie over, dan
 * blijft dat deel staan.
 *
 * Draai dit NA het herberekenen van `viewRows`: alleen nog bestaan is niet genoeg. Een fase die
 * alleen zichtbaar was als ouder van een gefilterd kind, valt met dat kind weg; selecteren zou haar
 * (met haar verborgen kinderen) bij een volgende Verwijderen wissen.
 *
 * Vertrekpunt is de rij van de celcursor (`anchorRowKey`) als die bij een verwijderde, geselecteerde
 * taak hoort; in een groepering staat een taak meer dan eens. Anders de bovenste verwijderde,
 * geselecteerde rij. De gekozen buurRIJ gaat naar `ui.gridActiveRowKey`: verdwijnt een taak uit
 * meer groepen, dan schuift de oude cursorplek op en kan het raster de groep niet meer raden.
 */
/**
 * De rij van de buur in de NIEUWE rijen. Een sleutel kan veranderen (groeperen op WBS: verwijderen
 * hernummert); dan hetzelfde voorkomen van die taak (het derde blijft het derde), anders het laatste.
 */
function currentRowKey(
  rowsBefore: ReadonlyArray<Extract<ViewRow, { kind: 'task' }>>,
  rowsNow: readonly ViewRow[],
  neighbour: Extract<ViewRow, { kind: 'task' }>,
): string | null {
  const now = rowsNow.flatMap(row => row.kind === 'task' && row.task.id === neighbour.task.id ? [row.rowKey] : []);
  if (now.includes(neighbour.rowKey)) return neighbour.rowKey;
  const ordinal = rowsBefore.filter(row => row.task.id === neighbour.task.id).indexOf(neighbour);
  return now[Math.min(ordinal, now.length - 1)] ?? null;
}

export function selectNeighbourAfterRemoval(
  s: SelectionDraft,
  rowsBefore: readonly ViewRow[],
  selectedBefore: readonly string[],
  anchorRowKey: string | null,
): void {
  if (s.selectedTaskIds.length > 0 || selectedBefore.length === 0) return;
  const existing = new Set(s.tasks.map(task => task.id));
  // Binnen een batch kan `viewRows` nog de oude stand zijn: dan telt ook het bestaan mee.
  const visibleNow = new Set(uniqueTaskIds(s.viewRows).filter(id => existing.has(id)));
  const rows = rowsBefore.flatMap(row => row.kind === 'task' ? [row] : []);
  const removedSelection = (row: (typeof rows)[number]) =>
    selectedBefore.includes(row.task.id) && !existing.has(row.task.id);
  const cursor = rows.findIndex(row => row.rowKey === anchorRowKey);
  const anchor = cursor >= 0 && removedSelection(rows[cursor]) ? cursor : rows.findIndex(removedSelection);
  if (anchor < 0) return;
  let neighbour: (typeof rows)[number] | undefined;
  for (let index = anchor + 1; index < rows.length && !neighbour; index++) {
    if (visibleNow.has(rows[index].task.id)) neighbour = rows[index];
  }
  for (let index = anchor - 1; index >= 0 && !neighbour; index--) {
    if (visibleNow.has(rows[index].task.id)) neighbour = rows[index];
  }
  if (!neighbour) return;
  s.selectedTaskIds = [neighbour.task.id];
  s.activeTaskId = neighbour.task.id;
  s.ui.gridActiveRowKey = currentRowKey(rows, s.viewRows, neighbour);
}
