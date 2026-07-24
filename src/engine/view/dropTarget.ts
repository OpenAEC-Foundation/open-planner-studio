// Pure droptarget-resolver voor verticaal taak-verslepen (issue #21 punt 1, fase 1).
// Bepaalt, gegeven een hover-rij + verticale zone, WAAR een gesleepte taak zou landen — los van
// WIE er gesleept wordt (deze functie kent geen taskId; de drag-hook (fase 2, niet hier gebouwd)
// is verantwoordelijk voor de cykel-check en voor de daadwerkelijke aanroep van
// `taskSlice.moveTaskTo`). PUUR: geen store-/React-imports, alleen type-only op `ViewRow`.

import type { Task } from '@/types/task';
import type { ViewRow } from './visibleRows';

export interface DropTarget {
  parentId: string | null;
  childIndex: number;
}

/**
 * Vertaalt een hover-rij (`rows[rowIndex]`) + zone naar een `moveTaskTo`-doel.
 * - `'before'` — invoegen vóór de rij-taak, als sibling bij diens ouder.
 * - `'after'`  — invoegen ná de rij-taak, als sibling bij diens ouder. Dit blijft ALTIJD binnen
 *   dezelfde ouder als de rij-taak — ook wanneer de rij-taak het laatste kind van een summary is
 *   valt het doel dus niet naar root/grootouder uit (het bekende gat in ontwerp B §3.2 dat hiermee
 *   gedicht wordt), want `childIndex` wordt geklemd op de kindlijst-lengte van diezelfde ouder.
 * - `'nest'`   — de rij-taak wordt de nieuwe ouder; het gesleepte item wordt diens LAATSTE kind.
 *   Alleen geldig als de rij-taak een summary is (`childIds.length > 0`) — mijlpalen en gewone
 *   leaves zijn geen nest-doel.
 * - Groepsrijen (`kind: 'group'`) en een leeg/ongeldig `rowIndex` hebben geen structurele
 *   betekenis ⇒ altijd `null`.
 *
 * `tasksById` ontsluit de kindlijst van de ouder: voor niet-root ouders is dat `childIds`
 * (display-volgorde, zie `visibleRows.ts`); voor root bestaat geen aparte array, dus leunt de
 * root-siblinglijst op de rijvolgorde in `rows` — die is in tree-modus gelijk aan de rauwe
 * array-volgorde (zie `computeViewRows`), exact zoals `taskSlice.reorderSibling`'s root-tak.
 */
export function resolveDropTarget(
  rows: ViewRow[],
  rowIndex: number,
  zone: 'before' | 'after' | 'nest',
  tasksById: Map<string, Task>,
  draggedTaskId?: string,
): DropTarget | null {
  const row = rows[rowIndex];
  if (!row || row.kind !== 'task') return null;
  const refTask = row.task;

  if (zone === 'nest') {
    if (refTask.childIds.length === 0) return null; // mijlpaal/leaf: geen nest-doel
    return { parentId: refTask.id, childIndex: refTask.childIds.length };
  }

  const parentId = refTask.parentId;
  const siblingIds = siblingIdsOf(parentId, rows, tasksById);
  const refIdx = siblingIds.indexOf(refTask.id);
  // refIdx is normaliter altijd >=0 (refTask staat in zijn eigen siblinglijst); -1 als defensief
  // vangnet (bv. corrupte data) ⇒ dan maar achteraan.
  const base = refIdx >= 0 ? refIdx : siblingIds.length;

  let childIndex = zone === 'before' ? base : Math.min(base + 1, siblingIds.length);

  // Review issue #21 pt. 1 fase 2 (bewezen off-by-one): `childIndex` is hierboven berekend tegen
  // de siblinglijst MÉT het gesleepte item, maar `moveTaskTo` klemt/plaatst tegen de lijst
  // ZÓNDER dat item (remove-dan-insert). Staat het gesleepte item in dezelfde lijst vóór het
  // droppunt, dan verschuift zijn verwijdering het doel één plek — compenseer, anders landt elke
  // neerwaartse herordening binnen dezelfde ouder één positie te ver (en liegt de indicator).
  if (draggedTaskId !== undefined) {
    const dragIdx = siblingIds.indexOf(draggedTaskId);
    if (dragIdx >= 0 && dragIdx < childIndex) childIndex -= 1;
  }

  return { parentId, childIndex };
}

/** Kindlijst van `parentId` in display-volgorde; root (`null`) leunt op de rijvolgorde. */
function siblingIdsOf(
  parentId: string | null,
  rows: ViewRow[],
  tasksById: Map<string, Task>,
): string[] {
  if (parentId !== null) {
    return tasksById.get(parentId)?.childIds ?? [];
  }
  return rows
    .filter((r): r is Extract<ViewRow, { kind: 'task' }> => r.kind === 'task' && r.task.parentId === null)
    .map((r) => r.task.id);
}
