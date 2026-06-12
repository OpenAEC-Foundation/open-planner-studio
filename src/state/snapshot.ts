import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';

// Undo/redo werkt met diepe JSON-kopieën van de muteerbare projectdata.
export interface Snapshot {
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
}

export function createSnapshot(state: Snapshot): Snapshot {
  return {
    tasks: JSON.parse(JSON.stringify(state.tasks)),
    sequences: JSON.parse(JSON.stringify(state.sequences)),
    resources: JSON.parse(JSON.stringify(state.resources)),
    assignments: JSON.parse(JSON.stringify(state.assignments)),
  };
}
