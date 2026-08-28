import type { MilestoneKind } from './task';

/** Eén taak zoals hij in de baseline vastligt. Keyed op de stabiele Task.id (tevens de basis van
 *  de IFC-GUID via ifcGuid(task.id)) zodat matching over hernoemingen heen werkt. */
export interface BaselineTask {
  taskId: string;
  /** Oorspronkelijke bronidentiteit als deze baseline uit een extern bronproject is opgebouwd.
   *  `taskId` blijft bewust de koppeling naar de huidige OPS-taak voor varianceweergave. */
  sourceTaskId?: string;
  sourceTaskCode?: string;
  start: string;           // ISO 8601 — snapshot van task.time.earlyStart t.t.v. opslaan (fallback: scheduleStart)
  finish: string;          // ISO 8601 — snapshot van task.time.earlyFinish (fallback: scheduleFinish)
  duration: number;        // werkdagen (task.time.scheduleDuration)
  isMilestone: boolean;
  milestoneKind?: MilestoneKind;
}

/** Een P6-stijl baseline: onbeperkt aantal; precies één is "actief" (activeBaselineId in de slice). */
export interface Baseline {
  id: string;
  /** Projectidentiteit van een gematerialiseerd extern baselineproject (onder meer XER X4b). */
  sourceProjectId?: string;
  name: string;
  createdAt: string;       // ISO datetime — de snapshot-datum (ook getoond in het rapport)
  tasks: BaselineTask[];   // keyed op taskId
  projectEnd: string;      // ISO — projecteinde t.t.v. de snapshot (voor de variance-samenvatting)
  projectDuration: number; // werkdagen
}
