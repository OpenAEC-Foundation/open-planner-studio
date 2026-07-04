import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import type { Baseline } from '@/types/baseline';

// Undo/redo werkt met diepe JSON-kopieën van de muteerbare projectdata + de afgeleide
// rekenresultaten. De afgeleide resultaten (`cpmResult`/`resourceLoadResult`) zijn FIRST-CLASS
// state (A5, deze golf): zonder ze in de snapshot zou undo/redo van bv. `applyLeveling` de taken
// wél maar de statusbalk/het histogram NIET terugdraaien (stale afgeleide weergave).
export interface Snapshot {
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  /** Gedeelde kalender-bibliotheek (fase 2.8a; hernoemd uit `resourceCalendars`). */
  calendars: WorkCalendar[];
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  /** Afgeleide CPM-uitkomst — bevat een `Map`, dus NIET JSON-kloonbaar; bewaard per referentie
   *  (runCPM vervangt het object als geheel en muteert het nooit in-place, dus delen is veilig). */
  cpmResult: CPMResult | null;
  /** Afgeleide belasting/capaciteit/overallocatie — idem, per referentie. */
  resourceLoadResult: ResourceLoadResult | null;
  /** Was de planning "verouderd" (datum-mutatie zonder F5) op het moment van de snapshot? */
  scheduleStale: boolean;
  /** Baselines (fase 2.6): plain data, JSON-kloonbaar. */
  baselines: Baseline[];
  /** Actieve baseline (fase 2.6): scalar; `null` is een legitieme waarde (geen actieve baseline). */
  activeBaselineId: string | null;
}

/** Alleen de projectdata-arrays worden diep gekloond; de afgeleide resultaten worden per referentie
 *  bewaard (immutabel, worden altijd als geheel vervangen door runCPM/recomputeResourceLoad). */
export function createSnapshot(state: Snapshot): Snapshot {
  return {
    tasks: JSON.parse(JSON.stringify(state.tasks)),
    sequences: JSON.parse(JSON.stringify(state.sequences)),
    resources: JSON.parse(JSON.stringify(state.resources)),
    assignments: JSON.parse(JSON.stringify(state.assignments)),
    calendars: JSON.parse(JSON.stringify(state.calendars)),
    activityCodeTypes: JSON.parse(JSON.stringify(state.activityCodeTypes)),
    customFieldDefs: JSON.parse(JSON.stringify(state.customFieldDefs)),
    cpmResult: state.cpmResult,
    resourceLoadResult: state.resourceLoadResult,
    scheduleStale: state.scheduleStale,
    baselines: JSON.parse(JSON.stringify(state.baselines)),
    activeBaselineId: state.activeBaselineId,
  };
}
