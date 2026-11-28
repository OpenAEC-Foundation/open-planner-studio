import type { ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import { isLeafTask } from '@/utils/taskHierarchy';

export interface MoveCandidateLookup {
  has(sourceTaskId: string, resourceId: string): boolean;
  list(sourceTaskId: string, resourceId: string): Task[];
}

const NONE: ReadonlySet<string> = new Set();

export function createMoveCandidateLookup(
  tasks: readonly Task[],
  assignments: readonly ResourceAssignment[],
  costResourceIds: ReadonlySet<string> = NONE,
): MoveCandidateLookup {
  const taskIdsByResource = new Map<string, Set<string>>();
  for (const a of assignments) {
    let taskIds = taskIdsByResource.get(a.resourceId);
    if (!taskIds) taskIdsByResource.set(a.resourceId, taskIds = new Set());
    taskIds.add(a.taskId);
  }
  const isCandidate = (t: Task, sourceTaskId: string, taken: ReadonlySet<string>, cost: boolean) =>
    t.id !== sourceTaskId && (cost || !t.isMilestone) && isLeafTask(t) && !taken.has(t.id);
  return {
    has(sourceTaskId, resourceId) {
      const taken = taskIdsByResource.get(resourceId) ?? NONE;
      const cost = costResourceIds.has(resourceId);
      for (const t of tasks) if (isCandidate(t, sourceTaskId, taken, cost)) return true;
      return false;
    },
    list(sourceTaskId, resourceId) {
      const taken = taskIdsByResource.get(resourceId) ?? NONE;
      const cost = costResourceIds.has(resourceId);
      return tasks.filter(t => isCandidate(t, sourceTaskId, taken, cost));
    },
  };
}
