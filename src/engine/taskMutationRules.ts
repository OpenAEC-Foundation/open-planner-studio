import type { CustomFieldValue } from '@/types/structure';
import type { Task } from '@/types/task';
import { parseDate, parseInstant } from '@/utils/dateUtils';

/**
 * Vergelijkt een actual met de statusdatum op dezelfde precisie als de bestaande taaksetters.
 * Een statusdatum zonder tijd staat de hele kalenderdag toe; mét tijd geldt instantprecisie.
 */
export function isActualPastStatusDate(dateIso: string, statusDateIso: string): boolean {
  if (!statusDateIso.includes('T')) {
    return parseDate(dateIso).getTime() > parseDate(statusDateIso).getTime();
  }
  return parseInstant(dateIso).getTime() > parseInstant(statusDateIso).getTime();
}

/** Centrale voortgangsinvarianten, gedeeld door grid, store-setters en MCP-validatie. */
export function applyProgressInvariants(task: Task, statusDate: string | undefined): void {
  const time = task.time;
  if (time.actualFinish) {
    time.completion = 1;
    if (!time.actualStart) time.actualStart = time.actualFinish;
    task.status = 'COMPLETED';
  } else if (time.completion >= 1) {
    time.actualFinish = statusDate || time.earlyFinish || time.scheduleFinish;
    if (!time.actualStart) time.actualStart = time.actualFinish;
    task.status = 'COMPLETED';
  } else if (time.actualStart) {
    task.status = 'STARTED';
  } else {
    task.status = 'NOT_STARTED';
  }
  time.remainingTime = Math.round(time.scheduleDuration * (1 - time.completion));
}

/** Verliesloze toewijzing op een taak of geïsoleerde taakdraft. */
export function assignTaskActivityCode(
  task: Task,
  typeId: string,
  valueId: string | undefined,
): void {
  if (valueId === undefined) {
    if (task.activityCodes) delete task.activityCodes[typeId];
  } else {
    task.activityCodes = { ...(task.activityCodes ?? {}), [typeId]: valueId };
  }
}

/** Verliesloze toewijzing op een taak of geïsoleerde taakdraft. */
export function assignTaskCustomField(
  task: Task,
  defId: string,
  value: CustomFieldValue | undefined,
): void {
  if (value === undefined) {
    if (task.customFields) delete task.customFields[defId];
  } else {
    task.customFields = { ...(task.customFields ?? {}), [defId]: value };
  }
}
