import type { Task } from '@/types/task';
import type { CalendarEngine } from './CalendarEngine';
import { workdayDateOfInstant } from '@/engine/calendar/workdayRules';
import { formatDate } from '@/utils/dateUtils';

/**
 * Werkdagen-spanne van `projStart` tot `projEnd`, MET de mijlpaal-alleen-uitzondering: een project
 * dat op één werkdag valt (begin- en eindkant volgens de werkblokken) zonder échte werk-taken
 * (uitsluitend mijlpalen, of taken met `scheduleDuration` 0) krijgt duur 0 in plaats van de 1 die de
 * inclusieve telling van `workDaysBetween` anders zou geven.
 *
 * GEDEELD door de solver-post-pass (`computeScheduleResults` in `scheduleAnalysis.ts`, de vaste-
 * datums-afleiding ná een echte solve) en de "datums zoals opgeslagen"-reconstructie
 * (`cpmResultFromRecorded` in `recordedDates.ts`, GEEN solve), zodat beide exact dezelfde regel volgen.
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
  // Tel werkdagdatums inclusief: een eindmoment op 24:00 of na een nacht hoort nog
  // bij het werkblok van de vorige dag, ongeacht de kloktijd van de projectstart.
  const startDay = engine.isHourMode ? workdayDateOfInstant(engine, projStart, 'start') : projStart;
  const endDay = engine.isHourMode ? workdayDateOfInstant(engine, projEnd, 'end') : projEnd;
  let duration = engine.workDaysBetween(startDay, endDay);
  if (formatDate(startDay) === formatDate(endDay)) {
    const anyRealWork = [...tasks].some((t) => !t.isMilestone && t.time.scheduleDuration > 0);
    if (!anyRealWork) duration = 0;
  }
  return duration;
}
