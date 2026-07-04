import type { MilestoneKind } from './task';

/** Eén taak zoals hij in de baseline vastligt. Keyed op de stabiele Task.id (tevens de basis van
 *  de IFC-GUID via ifcGuid(task.id)) zodat matching over hernoemingen heen werkt. */
export interface BaselineTask {
  taskId: string;
  start: string;           // ISO 8601 — snapshot van task.time.earlyStart t.t.v. opslaan (fallback: scheduleStart)
  finish: string;          // ISO 8601 — snapshot van task.time.earlyFinish (fallback: scheduleFinish)
  duration: number;        // werkdagen (task.time.scheduleDuration)
  isMilestone: boolean;
  milestoneKind?: MilestoneKind;
}

/** Een P6-stijl baseline: onbeperkt aantal; precies één is "actief" (activeBaselineId in de slice). */
export interface Baseline {
  id: string;
  name: string;
  createdAt: string;       // ISO datetime — de snapshot-datum (ook getoond in het rapport)
  tasks: BaselineTask[];   // keyed op taskId
  projectEnd: string;      // ISO — projecteinde t.t.v. de snapshot (voor de variance-samenvatting)
  projectDuration: number; // werkdagen
}
