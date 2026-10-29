import type { CalendarEngine } from './CalendarEngine';
import { parseDate, parseInstant, utcDayStart, MS_PER_DAY } from '@/utils/dateUtils';

const MS_PER_MIN = 60_000;

/**
 * De grens van een zachte deadline op de kalender `eng`: het laatste moment waarop de taak klaar mag
 * zijn. Null zonder (geldige) deadline. Eén definitie voor de backward pass
 * (`CPMSolver.applyBackwardBound`), de melding "deadline gemist" (`scheduleAnalysis`) en de
 * reconstructie uit opgeslagen datums (`recordedDates.cpmResultFromRecorded`), zodat speling en
 * melding in beide modi hetzelfde moment gebruiken. `eng` is altijd de engine van de TAAKkalender
 * (`CPMSolver.calendarFor`; in de reconstructie `resolveCalendar` + `engineForTaskCalendar`), niet
 * die van het project.
 *
 * Dag-modus: de werkdag op of vóór de datum (`prevWorkDay`), zoals altijd. Uur-modus (knownbugs 138
 * van het ontwerp "alleen uren"): een datum zonder tijd is het EINDE van die werkdag — het einde van
 * het laatste werkblok dat op die datum begint, zoals een dagtaak dezelfde datum leest. Werkt die
 * datum niet (weekend, feestdag), dan het laatste blokeinde vóór het einde van die datum. Een
 * deadline MET tijd (bv. uit MSPDI) is dat moment zelf, teruggezet naar een werkmoment.
 */
export function deadlineBound(deadline: string | undefined, eng: CalendarEngine): Date | null {
  if (!deadline) return null;
  if (!eng.isHourMode) {
    const dl = parseDate(deadline);
    return isNaN(dl.getTime()) ? null : eng.prevWorkDay(dl);
  }
  if (deadline.includes('T')) {
    const at = parseInstant(deadline);
    return isNaN(at.getTime()) ? null : eng.prevWorkInstant(at);
  }
  const day = parseDate(deadline);
  if (isNaN(day.getTime())) return null;
  const bands = eng.effectiveBandsOn(day);
  if (bands.length > 0) {
    return new Date(utcDayStart(day).getTime() + bands[bands.length - 1].end * MS_PER_MIN);
  }
  return eng.prevWorkInstant(new Date(day.getTime() + MS_PER_DAY));
}
