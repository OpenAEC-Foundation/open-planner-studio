import type { Task } from '@/types/task';
import { isCostResource, type Resource, type ResourceAssignment } from '@/types/resource';

export function hasMilestoneBlockingAssignments(
  taskId: string,
  assignments: readonly Pick<ResourceAssignment, 'taskId' | 'resourceId'>[],
  resources: readonly Pick<Resource, 'id' | 'type'>[],
): boolean {
  let costIds: Set<string> | null = null;
  for (const a of assignments) {
    if (a.taskId !== taskId) continue;
    costIds ??= new Set(resources.filter(r => isCostResource(r)).map(r => r.id));
    if (!costIds.has(a.resourceId)) return true;
  }
  return false;
}

export function taskMilestoneTransition(task: Task, isMilestone: boolean): Partial<Task> {
  if (task.isMilestone === isMilestone) return {};
  if (isMilestone) {
    return {
      isMilestone: true,
      time: {
        ...task.time,
        scheduleDuration: 0,
        durationMinutes: undefined,
      },
    };
  }
  return {
    isMilestone: false,
    milestoneKind: undefined,
    mandatory: undefined,
  };
}

export type MilestoneRefusal = 'summary' | 'assignments';

export function milestoneRefusal(
  target: { hasChildren: boolean; hasAssignments: boolean },
): MilestoneRefusal | null {
  if (target.hasChildren) return 'summary';
  if (target.hasAssignments) return 'assignments';
  return null;
}
