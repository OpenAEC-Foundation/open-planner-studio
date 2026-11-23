import type { Task } from '@/types/task';
import { milestoneAnchorDate as anchorDate, milestonesInDrawnOrder, type ViewRow } from '@/engine/view/visibleRows';

/**
 * Issue #868, punt 3 (keuze Ethan): mijlpalen van een ingeklapte reeks die op dezelfde dag vallen,
 * staan als één ruitje met hun aantal (◆2). Een klik kiest ze allemaal, slepen verplaatst ze allemaal,
 * de tooltip noemt ze allemaal; wie er één apart wil bedienen, klapt de reeks uit.
 *
 * Per taak-id de groep waarin hij staat, alleen voor groepen van twee of meer. De groep staat in
 * tijdvolgorde; het eerste lid is de voorman: zijn ruitje wordt getekend en zijn plek is die van de
 * hele groep (tekenen, hittest, pijlen). Afhankelijk van de rijen alleen, niet van zoom of scroll.
 */
export type MilestoneGroups = ReadonlyMap<string, readonly Task[]>;

const EMPTY: MilestoneGroups = new Map();
const cache = new WeakMap<ViewRow[], MilestoneGroups>();

export function milestoneGroups(rows: ViewRow[]): MilestoneGroups {
  const cacheable = Object.isFrozen(rows);
  const cached = cacheable ? cache.get(rows) : undefined;
  if (cached) return cached;
  let groups: Map<string, readonly Task[]> | null = null;
  for (const row of rows) {
    if (row.kind !== 'milestones') continue;
    const byDay = new Map<string, Task[]>();
    for (const task of row.tasks) {
      const date = anchorDate(task);
      if (!date) continue;
      const day = date.slice(0, 10);
      const list = byDay.get(day);
      if (list) list.push(task); else byDay.set(day, [task]);
    }
    for (const list of byDay.values()) {
      if (list.length < 2) continue;
      const sorted = milestonesInDrawnOrder(list);
      groups ??= new Map();
      for (const task of sorted) groups.set(task.id, sorted);
    }
  }
  const result = groups ?? EMPTY;
  if (cacheable) cache.set(rows, result);
  return result;
}
