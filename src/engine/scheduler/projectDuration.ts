import type { Task } from '@/types/task';
import type { CalendarEngine } from './CalendarEngine';
import { isDateOnly, workdayDateOfInstant } from '@/engine/calendar/workdayRules';
import type { InstantSide } from '@/engine/calendar/workdayRules';
import { formatDate, parseDate, parseInstant } from '@/utils/dateUtils';

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
 *
 * Begin en einde mogen ook de vastgelegde tekst zijn. Een datum zonder tijd is al een werkdag (D2: een
 * einde zonder tijd loopt tot het einde van die werkdag) en valt dus nooit terug naar de vorige dag.
 * Alleen een echt moment volgt in uur-modus de werkblokregel, met de 24:00-regel aan de eindkant.
 */
export function projectDurationOf(
  engine: CalendarEngine,
  projStart: Date | string | null,
  projEnd: Date | string,
  tasks: Iterable<Task>,
): number {
  if (!projStart) return 0;
  // Tel werkdagdatums inclusief: een eindmoment op 24:00 of na een nacht hoort nog
  // bij het werkblok van de vorige dag, ongeacht de kloktijd van de projectstart.
  const dayOf = (value: Date | string, side: InstantSide): Date => {
    if (typeof value === 'string' && isDateOnly(value)) return parseDate(value);
    const instant = typeof value === 'string' ? parseInstant(value) : value;
    return engine.isHourMode ? workdayDateOfInstant(engine, instant, side) : instant;
  };
  const startDay = dayOf(projStart, 'start');
  const endDay = dayOf(projEnd, 'end');
  let duration = engine.workDaysBetween(startDay, endDay);
  if (formatDate(startDay) === formatDate(endDay)) {
    const anyRealWork = [...tasks].some((t) => !t.isMilestone && t.time.scheduleDuration > 0);
    if (!anyRealWork) duration = 0;
  }
  return duration;
}
