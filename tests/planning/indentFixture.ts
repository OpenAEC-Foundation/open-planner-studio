import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import { detachFromParent, attachToParent } from '@/state/taskTree';
import { flattenOrder } from '@/utils/wbs';
import type { Task } from '@/types/task';

/** Vaste gewone taken op rootniveau: een blok selecteren en onder de vorige taak inspringen. */
export function indentFixture(size: number) {
  const base = generateBenchmarkProject(30, { seed: 71, resourceCount: 0 });
  const leaf = base.tasks.find(task => task.childIds.length === 0 && !task.isMilestone)!;
  return {
    ...base,
    tasks: Array.from({ length: size }, (_, index): Task => ({
      ...leaf, id: `outline-${index}`, name: `Werk ${index}`, wbsCode: String(index + 1),
      parentId: null, childIds: [], time: { ...leaf.time }, resourceIds: [],
    })),
    sequences: [], assignments: [], resources: [],
  };
}

/** Referentie van vóór de optimalisatie: de achterwaartse zoeklus blijft hier bewust staan. */
export function legacyIndent(tasks: Task[], ids: string[]): boolean {
  const selected = new Set(ids);
  let changed = false;
  const order = flattenOrder(tasks).map(task => task.id);
  for (const id of order) {
    if (!selected.has(id)) continue;
    const task = tasks.find(task => task.id === id);
    if (!task) continue;
    const index = order.indexOf(id);
    let newParentId: string | null = null;
    for (let i = index - 1; i >= 0; i--) {
      const candidate = tasks.find(task => task.id === order[i]);
      if (!candidate) continue;
      if (candidate.parentId === task.parentId && !selected.has(candidate.id)) {
        newParentId = candidate.id;
        break;
      }
      if (candidate.id === task.parentId) break;
    }
    if (!newParentId) continue;
    detachFromParent(tasks, id);
    attachToParent(tasks, id, newParentId);
    changed = true;
  }
  return changed;
}
