import type { TaskTime } from '@/types/task';
import { parseInstant } from '@/utils/dateUtils';

/**
 * Volgorde van de werkelijke datums direct nadat het werkelijke einde is AFGELEID (100 % zonder
 * `actualFinish`: statusdatum, anders de eigen geplande finish). De werkelijke start is dan vaak zelf
 * afgeleid — de geplande start — en die ligt ná de statusdatum bij een taak die volgens de planning
 * nog moest beginnen of bij een verouderde berekening (bv. mijlpaal op 100 %: AS 06-17, AF 06-10).
 * Ligt het einde vóór de start (instantprecisie, zoals `isActualFinishBeforeStart`):
 *  - mét statusdatum is het einde die datum, en een werkelijke datum erna bestaat niet: de
 *    start schuift terug naar het einde;
 *  - zonder statusdatum is het einde een (mogelijk verouderde) geplande finish: een vastgelegde start
 *    blijft staan en het afgeleide einde schuift mee.
 * Eén regel voor de store (`applyProgressInvariants`) en de lezers (`normalizeImportedProgress`).
 */
export function orderActualsAfterDerivedFinish(
  time: Pick<TaskTime, 'actualStart' | 'actualFinish'>,
  statusDate: string | undefined,
): void {
  if (!time.actualStart || !time.actualFinish) return;
  if (parseInstant(time.actualFinish).getTime() >= parseInstant(time.actualStart).getTime()) return;
  if (statusDate) time.actualStart = time.actualFinish;
  else time.actualFinish = time.actualStart;
}
