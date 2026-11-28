import { introducedCycle, type RelationTree } from '@/engine/scheduler/relationRules';
import type { Task } from '@/types/task';

export interface HierarchyEditResult {
  changed: boolean;
  reparented: boolean;
}

export type HierarchyEdit = (tasks: Task[]) => HierarchyEditResult;

export const NO_HIERARCHY_CHANGE: HierarchyEditResult = { changed: false, reparented: false };

export type HierarchyChangeVerdict =
  | ({ ok: true } & HierarchyEditResult)
  | { ok: false; reason: 'cycle'; cycle: string[] };

export function hierarchyChangeVerdict(state: RelationTree, edit: HierarchyEdit): HierarchyChangeVerdict {
  const trial = state.tasks.map(task => ({ ...task, childIds: [...task.childIds] }));
  const result = edit(trial);
  if (!result.changed) return { ok: true, ...result };
  const cycle = introducedCycle(state, { tasks: trial, sequences: state.sequences });
  return cycle ? { ok: false, reason: 'cycle', cycle } : { ok: true, ...result };
}
