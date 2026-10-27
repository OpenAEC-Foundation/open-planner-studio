import type { TaskTime } from '@/types/task';
import { parseInstant } from '@/utils/dateUtils';
import { isDateOnly } from '@/engine/calendar/workdayRules';

/**
 * Volgorde direct nadat het werkelijke einde is afgeleid (100 % zonder `actualFinish`).
 * Een aanwezige werkelijke start is een feit: ligt het afgeleide einde ervoor, dan wordt het
 * einde gelijk aan die start: een afgeleid einde valt nooit vóór een vastgelegde start.
 * Alleen een ONTBREKENDE, zojuist automatisch afgeleide start mag terug naar het einde op de
 * statusdatum. De aanroeper legt dat vast vóór hij de start invult; aanwezigheid achteraf zegt
 * niets over de herkomst. Zonder statusdatum blijft de eigen geplande start staan, zoals voorheen.
 * Gedeeld door de store en de lezers, op instantprecisie zoals `isActualFinishBeforeStart`.
 * Uitzondering: een afgeleid einde zonder tijd naast een vastgelegde start. Zo'n datum is de hele
 * werkdag; de laadgrens zet hem later met de kalender op het einde van die dag (D2/D6,
 * `normalizeTaskDates`). Als 00:00 gelezen lag hij vóór een start om 10:15 op dezelfde dag, en werd
 * het einde die start. Vergelijk daarom op dagniveau.
 */
export function orderActualsAfterDerivedFinish(
  time: Pick<TaskTime, 'actualStart' | 'actualFinish'>,
  statusDate: string | undefined,
  startWasDerived: boolean,
): void {
  if (!time.actualStart || !time.actualFinish) return;
  if (!startWasDerived && isDateOnly(time.actualFinish)) {
    if (time.actualStart.slice(0, 10) > time.actualFinish) time.actualFinish = time.actualStart;
    return;
  }
  if (parseInstant(time.actualFinish).getTime() >= parseInstant(time.actualStart).getTime()) return;
  if (startWasDerived && statusDate) time.actualStart = time.actualFinish;
  else time.actualFinish = time.actualStart;
}
