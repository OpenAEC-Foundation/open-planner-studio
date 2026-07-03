import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';

// Undo/redo werkt met diepe JSON-kopieën van de muteerbare projectdata.
export interface Snapshot {
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  resourceCalendars: WorkCalendar[];
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
}

export function createSnapshot(state: Snapshot): Snapshot {
  return {
    tasks: JSON.parse(JSON.stringify(state.tasks)),
    sequences: JSON.parse(JSON.stringify(state.sequences)),
    resources: JSON.parse(JSON.stringify(state.resources)),
    assignments: JSON.parse(JSON.stringify(state.assignments)),
    resourceCalendars: JSON.parse(JSON.stringify(state.resourceCalendars)),
    activityCodeTypes: JSON.parse(JSON.stringify(state.activityCodeTypes)),
    customFieldDefs: JSON.parse(JSON.stringify(state.customFieldDefs)),
  };
}
