import type { Task } from '@/types/task';
import type { CalendarEngine } from './CalendarEngine';
import { formatDate } from '@/utils/dateUtils';

/**
 * Werkdagen-spanne van `projStart` tot `projEnd`, MET de mijlpaal-alleen-uitzondering: een project
 * dat op één dag valt (`projStart` === `projEnd`, kalenderdag-vergelijking) zonder échte werk-taken
 * (uitsluitend mijlpalen, of taken met `scheduleDuration` 0) krijgt duur 0 in plaats van de 1 die de
 * inclusieve telling van `workDaysBetween` anders zou geven.
 *
 * GEDEELD door de solver-post-pass (`computeScheduleResults` in `scheduleAnalysis.ts`, de vaste-
 * datums-afleiding ná een echte solve) en de "datums zoals opgeslagen"-reconstructie
 * (`cpmResultFromRecorded` in `recordedDates.ts`, GEEN solve). Vóór deze extractie dupliceerde
 * `recordedDates.ts` alleen de werkdagen-telling en liet de mijlpaal-uitzondering bewust weg —
 * gedocumenteerd als semantische afwijking. Nu delen beide callsites exact dezelfde regel, dus die
 * afwijking bestaat niet meer (was: kwaliteitsreview GRAAG-6, taak 2 van issue #63).
 *
 * `projStart === null` ⇒ geen enkele taak leverde een datum (leeg schema) ⇒ duur 0, geen meting.
 */
export function projectDurationOf(
  engine: CalendarEngine,
  projStart: Date | null,
  projEnd: Date,
  tasks: Iterable<Task>,
): number {
  if (!projStart) return 0;
  let duration = engine.workDaysBetween(projStart, projEnd);
  if (formatDate(projStart) === formatDate(projEnd)) {
    const anyRealWork = [...tasks].some((t) => !t.isMilestone && t.time.scheduleDuration > 0);
    if (!anyRealWork) duration = 0;
  }
  return duration;
}
