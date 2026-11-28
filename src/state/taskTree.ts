import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { ResourceAssignment } from '@/types/resource';

export function detachFromParent(tasks: Task[], id: string, byId?: ReadonlyMap<string, Task>): void {
  const task = byId ? byId.get(id) : tasks.find(t => t.id === id);
  if (!task?.parentId) return;
  const parent = byId ? byId.get(task.parentId) : tasks.find(t => t.id === task.parentId);
  if (parent) parent.childIds = parent.childIds.filter(cid => cid !== id);
}

export function attachToParent(
  tasks: Task[], id: string, parentId: string | null, index?: number, byId?: ReadonlyMap<string, Task>,
): void {
  const task = byId ? byId.get(id) : tasks.find(t => t.id === id);
  if (!task) return;
  task.parentId = parentId;
  if (parentId === null) return;
  const parent = byId ? byId.get(parentId) : tasks.find(t => t.id === parentId);
  if (!parent) return;
  const at = index === undefined
    ? parent.childIds.length
    : Math.max(0, Math.min(index, parent.childIds.length));
  parent.childIds.splice(at, 0, id);
}

export function isSelfOrDescendant(tasks: Task[], candidateId: string, ancestorId: string): boolean {
  const bezocht = new Set<string>();
  let cur: Task | undefined = tasks.find(t => t.id === candidateId);
  while (cur && !bezocht.has(cur.id)) {
    if (cur.id === ancestorId) return true;
    bezocht.add(cur.id);
    cur = cur.parentId ? tasks.find(t => t.id === cur!.parentId) : undefined;
  }
  return false;
}

export function reparentTask(tasks: Task[], id: string, newParentId: string | null, position?: number): void {
  detachFromParent(tasks, id);
  attachToParent(tasks, id, newParentId, position);
  const fromIdx = tasks.findIndex(t => t.id === id);
  if (fromIdx < 0) return;
  const [moved] = tasks.splice(fromIdx, 1);
  const sibIdx: number[] = [];
  tasks.forEach((t, i) => { if (t.parentId === newParentId) sibIdx.push(i); });
  const at = position === undefined
    ? sibIdx.length
    : Math.max(0, Math.min(position, sibIdx.length));
  let insertAt: number;
  if (at < sibIdx.length) {
    insertAt = sibIdx[at];
  } else if (sibIdx.length > 0) {
    insertAt = sibIdx[sibIdx.length - 1] + 1;
  } else if (newParentId) {
    const p = tasks.findIndex(t => t.id === newParentId);
    insertAt = p >= 0 ? p + 1 : tasks.length;
  } else {
    insertAt = tasks.length;
  }
  tasks.splice(insertAt, 0, moved);
}

export function collectSubtreeIds(tasks: Task[], rootId: string): string[] {
  return subtreeCollector(tasks)(rootId);
}

function firstById(tasks: readonly Task[]): Map<string, Task> {
  const byId = new Map<string, Task>();
  for (const t of tasks) if (!byId.has(t.id)) byId.set(t.id, t);
  return byId;
}

export function subtreeCollector(tasks: readonly Task[]): (rootId: string) => string[] {
  const byId = firstById(tasks);
  return (rootId) => {
    const out: string[] = [];
    const bezocht = new Set<string>();
    const walk = (id: string) => {
      if (bezocht.has(id)) return;
      bezocht.add(id);
      out.push(id);
      const t = byId.get(id);
      if (t) for (const cid of t.childIds) walk(cid);
    };
    walk(rootId);
    return out;
  };
}

interface TaskRemovalState {
  tasks: Task[];
  sequences: Sequence[];
  assignments: ResourceAssignment[];
  selectedTaskIds: string[];
  activeTaskId: string | null;
}

export function removeTaskSubtrees(s: TaskRemovalState, rootIds: readonly string[]): Set<string> {
  const removeIds = new Set<string>();
  const byId = firstById(s.tasks);
  const collect = subtreeCollector(s.tasks);
  for (const id of rootIds) {
    const task = byId.get(id);
    const parent = task?.parentId ? byId.get(task.parentId) : undefined;
    if (parent) parent.childIds = parent.childIds.filter(cid => cid !== id);
    for (const subtreeId of collect(id)) removeIds.add(subtreeId);
  }
  s.tasks = s.tasks.filter(t => !removeIds.has(t.id));
  s.sequences = s.sequences.filter(seq => !removeIds.has(seq.predecessorId) && !removeIds.has(seq.successorId));
  s.assignments = s.assignments.filter(a => !removeIds.has(a.taskId));
  s.selectedTaskIds = s.selectedTaskIds.filter(sid => !removeIds.has(sid));
  if (s.activeTaskId && removeIds.has(s.activeTaskId)) s.activeTaskId = s.selectedTaskIds[0] ?? null;
  return removeIds;
}

export function siblingIds(tasks: Task[], parentId: string | null): string[] {
  if (parentId === null) return tasks.filter(t => !t.parentId).map(t => t.id);
  return tasks.find(t => t.id === parentId)?.childIds ?? [];
}
