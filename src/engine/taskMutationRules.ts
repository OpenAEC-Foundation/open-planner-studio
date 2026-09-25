import type { CustomFieldValue } from '@/types/structure';
import type { Task, TaskTime } from '@/types/task';
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

/** Werkelijk einde vóór werkelijke start? Op instantprecisie (`parseInstant`), niet als ruwe
 *  string: een date-only waarde en een datetime op dezelfde dag vergelijken anders verkeerd. */
export function isActualFinishBeforeStart(time: Pick<TaskTime, 'actualStart' | 'actualFinish'>): boolean {
  return !!time.actualStart && !!time.actualFinish
    && parseInstant(time.actualFinish).getTime() < parseInstant(time.actualStart).getTime();
}

/** Een nieuw voltooiingspercentage (0..1) zetten volgens de MSP-conventie: > 0 zonder werkelijke
 *  start ⇒ die afleiden (% ⇒ gestart), < 1 ⇒ een verouderd werkelijk einde vervalt. Daarna hoort de
 *  aanroeper `applyProgressInvariants` te draaien. */
export function applyCompletionEdit(time: TaskTime, completion: number): void {
  time.completion = completion;
  if (completion > 0 && !time.actualStart) time.actualStart = time.earlyStart || time.scheduleStart;
  if (completion < 1) time.actualFinish = undefined;
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
    else if (isActualFinishBeforeStart(time)) {
      // Het einde is hier AFGELEID en mag niet vóór de start liggen. Die start is vaak zelf afgeleid
      // (de geplande start, via `applyCompletionEdit`/raster/MCP) en ligt ná de statusdatum bij een
      // taak die volgens de planning nog moest beginnen, of bij een verouderde berekening (mijlpaal
      // op 100 % vóór F5 gaf AS 06-17 / AF 06-10). Mét statusdatum is het einde die datum en bestaat
      // een werkelijke datum erna niet (§3.2): de start schuift terug. Zonder statusdatum is het
      // einde een (mogelijk verouderde) geplande finish: een vastgelegde start blijft, het einde volgt.
      if (statusDate) time.actualStart = time.actualFinish;
      else time.actualFinish = time.actualStart;
    }
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
