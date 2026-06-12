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
      s.assignments = s.assignments.filter(a => a.id !== assignmentId);
      s.isDirty = true;
    }),
});
