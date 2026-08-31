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

/** De compacte tekeninvoer voor de actieve baseline. Zowel Gantt als rapport gebruiken deze
 * afleiding, zodat ze per taak altijd exact dezelfde opgeslagen datums tonen. */
export interface BaselineOverlayEntry {
  start: string;
  finish: string;
  isMilestone: boolean;
}

export type BaselineOverlay = Map<string, BaselineOverlayEntry>;

/** Een P6-stijl baseline: onbeperkt aantal; precies één is "actief" (activeBaselineId in de slice). */
export interface Baseline {
  id: string;
  name: string;
  createdAt: string;       // ISO datetime — de snapshot-datum (ook getoond in het rapport)
  tasks: BaselineTask[];   // keyed op taskId
  projectEnd: string;      // ISO — projecteinde t.t.v. de snapshot (voor de variance-samenvatting)
  projectDuration: number; // werkdagen
}

/** Bouw de taak-id-index van de actieve baseline; geen actieve of onbekende baseline = geen overlay. */
export function buildBaselineOverlay(
  baselines: Baseline[],
  activeBaselineId: string | null | undefined,
): BaselineOverlay | undefined {
  if (!activeBaselineId) return undefined;
  const active = baselines.find(b => b.id === activeBaselineId);
  if (!active) return undefined;
  const map: BaselineOverlay = new Map();
  for (const task of active.tasks) {
    map.set(task.taskId, { start: task.start, finish: task.finish, isMilestone: task.isMilestone });
  }
  return map;
}
