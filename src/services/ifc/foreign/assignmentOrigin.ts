import { relationRoles } from '../ifcSlotTables';
import type { WriteIFCInput } from '../ifcWriter';
import type { StepIndex } from './stepScanner';

export interface AssignmentOrigin {
  readonly unclear: (taskId: string, resourceId: string) => boolean;
  readonly remaining: (taskId: string, resourceId: string) => number;
}

type Objects = ReadonlyMap<number, { readonly kind: string; readonly id: string }>;
type Assignments = Pick<WriteIFCInput, 'assignments'>;

const PROCESS = 'IFCRELASSIGNSTOPROCESS';
const pairKey = (taskId: string, resourceId: string) => `${taskId}\u0000${resourceId}`;

function idsPerPair(input: Assignments): Map<string, string[]> {
  const ids = new Map<string, string[]>();
  for (const a of input.assignments ?? []) {
    const key = pairKey(a.taskId, a.resourceId);
    const list = ids.get(key);
    if (list) list.push(a.id); else ids.set(key, [a.id]);
  }
  return ids;
}

export function assignmentOrigin(index: StepIndex, objects: Objects, domain: Assignments, opened: Assignments | undefined): AssignmentOrigin {
  const roles = relationRoles(PROCESS)!;
  const inSource = new Map<string, number>();
  for (let r = 0; r < index.count; r++) {
    if (!index.isEntity(r) || index.type(r) !== PROCESS) continue;
    const relating = index.refAt(r, roles.relating);
    const task = relating >= 0 ? objects.get(Number(index.id(relating))) : undefined;
    if (task?.kind !== 'task') continue;
    for (const m of index.refsAt(r, roles.related)) {
      const resource = m >= 0 ? objects.get(Number(index.id(m))) : undefined;
      if (resource?.kind !== 'res') continue;
      const key = pairKey(task.id, resource.id);
      inSource.set(key, (inSource.get(key) ?? 0) + 1);
    }
  }
  const now = idsPerPair(domain), before = opened ? idsPerPair(opened) : undefined;
  const same = (key: string) => {
    const a = now.get(key) ?? [];
    if (!before) return a.length === (inSource.get(key) ?? 0);
    const b = new Set(before.get(key));
    return a.length === b.size && a.every(id => b.has(id));
  };
  const decided = new Map<string, boolean>();
  return {
    unclear: (taskId, resourceId) => {
      const key = pairKey(taskId, resourceId);
      let unclear = decided.get(key);
      if (unclear === undefined) decided.set(key, unclear = (inSource.get(key) ?? 0) > 1 && !same(key));
      return unclear;
    },
    remaining: (taskId, resourceId) => now.get(pairKey(taskId, resourceId))?.length ?? 0,
  };
}
