import type { Resource, ResourceAssignment } from '@/types/resource';
import { generateId } from '@/utils/id';
import type { AppSlice } from './types';

export interface ResourceSlice {
  resources: Resource[];
  assignments: ResourceAssignment[];
  addResource: (res: Omit<Resource, 'id'>) => string;
  removeResource: (id: string) => void;
  assignResource: (taskId: string, resourceId: string, units: number) => void;
  unassignResource: (assignmentId: string) => void;
}

export const createResourceSlice: AppSlice<ResourceSlice> = (set) => ({
  resources: [],
  assignments: [],

  addResource: (res) => {
    const id = generateId('res');
    set((s) => {
      s.resources.push({ ...res, id });
      s.isDirty = true;
    });
    return id;
  },

  removeResource: (id) =>
    set((s) => {
      s.resources = s.resources.filter(r => r.id !== id);
      s.assignments = s.assignments.filter(a => a.resourceId !== id);
      // Verweesde verwijzingen in task.resourceIds opruimen.
      for (const task of s.tasks) {
        const idx = task.resourceIds.indexOf(id);
        if (idx >= 0) task.resourceIds.splice(idx, 1);
      }
      s.isDirty = true;
    }),

  assignResource: (taskId, resourceId, units) =>
    set((s) => {
      const id = generateId('asgn');
      s.assignments.push({ id, taskId, resourceId, units });
      const task = s.tasks.find(t => t.id === taskId);
      if (task && !task.resourceIds.includes(resourceId)) {
        task.resourceIds.push(resourceId);
      }
      s.isDirty = true;
    }),

  unassignResource: (assignmentId) =>
    set((s) => {
      const removed = s.assignments.find(a => a.id === assignmentId);
      s.assignments = s.assignments.filter(a => a.id !== assignmentId);
      // task.resourceIds alleen opschonen als er geen andere toewijzing van
      // dezelfde resource aan dezelfde taak meer bestaat.
      if (removed) {
        const stillAssigned = s.assignments.some(
          a => a.taskId === removed.taskId && a.resourceId === removed.resourceId,
        );
        if (!stillAssigned) {
          const task = s.tasks.find(t => t.id === removed.taskId);
          const idx = task?.resourceIds.indexOf(removed.resourceId) ?? -1;
          if (task && idx >= 0) task.resourceIds.splice(idx, 1);
        }
      }
      s.isDirty = true;
    }),
});
