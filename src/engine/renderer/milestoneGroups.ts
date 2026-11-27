import type { Task } from '@/types/task';
import { milestoneAnchorDate as anchorDate, milestonesInDrawnOrder, type ViewRow } from '@/engine/view/visibleRows';

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
