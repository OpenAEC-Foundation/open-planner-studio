import type { Resource, ResourceAssignment } from '@/types/resource';

export interface TaskResourceScope {
  resources: Resource[];
  assignments: ResourceAssignment[];
  isFiltered: boolean;
}

export function scopeTaskResources(
  resources: Resource[],
  assignments: ResourceAssignment[],
  selectedTaskIds: string[],
): TaskResourceScope {
  if (selectedTaskIds.length === 0) {
    return { resources, assignments, isFiltered: false };
  }

  const selectedIds = new Set(selectedTaskIds);
  const scopedAssignments = assignments.filter(assignment => selectedIds.has(assignment.taskId));
  const resourceIds = new Set(scopedAssignments.map(assignment => assignment.resourceId));
  return {
    resources: resources.filter(resource => resourceIds.has(resource.id)),
    assignments: scopedAssignments,
    isFiltered: true,
  };
}
