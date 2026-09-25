import type { CustomFieldValue } from '@/types/structure';
import type { Task, TaskTime } from '@/types/task';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { orderActualsAfterDerivedFinish } from '@/engine/actualDatesOrder';
import { taskDurationUnit } from '@/engine/scheduler/duration';

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
    // Afgeleid einde vóór een (vaak zelf afgeleide) start: zelfde regel als de lezers.
    orderActualsAfterDerivedFinish(time, statusDate);
    task.status = 'COMPLETED';
  } else if (time.actualStart) {
    task.status = 'STARTED';
  } else {
    task.status = 'NOT_STARTED';
  }
  applyRemainingDuration(task);
}

/**
 * Restduur afgeleid uit `completion`, in dezelfde eenheid en vorm als de duur van de taak:
 *  - dagtaak: `remainingTime` in hele werkdagen, zoals `scheduleDuration`;
 *  - urentaak: `remainingMinutes` in hele minuten, zoals `durationMinutes`, met `remainingTime` als
 *    ONafgeronde werkdagfractie, zoals `scheduleDuration` ({@link hourRemainingDays}). Vroeger kreeg
 *    ook een urentaak `Math.round` op hele dagen: 5 u op 40 % gaf restduur 0, zonder minuten, en
 *    MSPDI/P6 exporteerden die 0.
 * Eén regel voor de store (`applyProgressInvariants`) en de lezers (`normalizeImportedProgress`).
 * `keepRecordedMinutes` (alleen de lezers): een uit het bestand gelezen `remainingMinutes` blijft
 * staan — MSP's eigen exacte restduur bij een afgeronde voortgang (T9); de werkdagfractie volgt dan
 * die minuten.
 */
export function applyRemainingDuration(task: Task, keepRecordedMinutes = false): void {
  const time = task.time;
  if (taskDurationUnit(task) !== 'hours') {
    time.remainingTime = Math.round(time.scheduleDuration * (1 - time.completion));
    return;
  }
  const minutes = keepRecordedMinutes && time.remainingMinutes != null
    ? time.remainingMinutes
    : Math.round((time.durationMinutes ?? 0) * (1 - time.completion));
  time.remainingMinutes = minutes;
  time.remainingTime = hourRemainingDays(time, minutes);
}

/**
 * Werkdagfractie bij `minutes` restduur van een urentaak, in de vorm van haar `scheduleDuration`
 * (minuten ÷ (uren per dag × 60)). De factor komt uit de duur zelf (`scheduleDuration` ÷
 * `durationMinutes`), zodat store en lezers hier geen kalender voor nodig hebben; eerst
 * vermenigvuldigen houdt de uitkomst vrij van deelruis (6 × 1728 / 2880 = 3,6, niet 3,5999…).
 */
export function hourRemainingDays(time: Pick<TaskTime, 'scheduleDuration' | 'durationMinutes'>, minutes: number): number {
  const totalMinutes = time.durationMinutes ?? 0;
  return totalMinutes > 0 ? (time.scheduleDuration * minutes) / totalMinutes : 0;
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
