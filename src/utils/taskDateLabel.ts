import {
  blocksClock, ELAPSED_CLOCK, freeDayEndingAt, isDateOnly, workdayBoundaryLabel, type DayClock, type InstantSide,
} from '@/engine/calendar/workdayRules';
import { isElapsedTask, isZeroDurationMilestone } from '@/engine/scheduler/duration';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';

/**
 * De getoonde vorm van een taakdatum (spec "alleen uren", besluit B4). Een tijd staat er alleen bij als
 * het moment midden op de werkdag valt:
 *  - een startachtig veld zonder tijd op het begin van het eerste werkblok van zijn werkdag;
 *  - een eindachtig veld zonder tijd op het einde van het laatste werkblok van zijn werkdag (ook de
 *    24:00-regel en de nachtploeg, die bij de dag horen waarop hun blok begint);
 *  - een mijlpaal heeft één moment en toont geen tijd als dat moment op een van beide dagranden valt, ook
 *    op het einde van een dag zonder werkblok (D4, zie {@link momentLabel}).
 * Elk ander moment blijft een moment met de klokdatum. De uitkomst is dus een datum (`YYYY-MM-DD`) of het
 * moment zelf; de schermen formatteren die met hun eigen notatie (`displayDateTime` laat een datum
 * zonder tijd ook zonder tijd).
 *
 * De regels zelf staan in `workdayBoundaryLabel` (`@/engine/calendar/workdayRules`); hier komen de klok van
 * de taak (kalendertijd of de werkblokken van haar kalender) en de mijlpaalregel bij.
 */

/** Eén klok per kalenderobject. Een kalender in de store is onveranderlijk (Immer): een gewijzigde kalender
 *  is een nieuw object en krijgt een nieuwe klok. Zo bouwt een tabel met duizend rijen niet per cel een
 *  engine. */
const clockCache = new WeakMap<WorkCalendar, DayClock>();

export function calendarClock(calendar: WorkCalendar): DayClock {
  let clock = clockCache.get(calendar);
  if (!clock) {
    clock = blocksClock(calendar);
    clockCache.set(calendar, clock);
  }
  return clock;
}

/** De klok van een taak: kalendertijd voor een kalendertijd-taak, anders de werkblokken van haar kalender. */
export function taskDateClock(task: Task, calendar: WorkCalendar): DayClock {
  return isElapsedTask(task) ? ELAPSED_CLOCK : calendarClock(calendar);
}

/**
 * B4 voor één moment. `milestoneSide` = het moment hoort bij een nulduur-mijlpaal: dan telt elke dagrand,
 * eerst die van de soort van de mijlpaal (een FINISH-mijlpaal op het einde van ma blijft "ma", ook als
 * hetzelfde moment het begin van di is, zoals op een 24-uurskalender). Voor een mijlpaal telt aan de
 * eindkant ook het einde van een dag zonder werkblok (D4, {@link freeDayEndingAt}): bij een nachtploeg
 * 22:00–06:00 is zo 06:00 het einde van za, dus "za". Zo toont de tabel de dag die de planner bij het
 * afmelden typte (B10), en leest de statusregel dezelfde dag (`isTaskActualPastStatusDate`). Een gewone
 * taak krijgt die D4-regel niet; haar weergave blijft gelijk.
 */
export function momentLabel(clock: DayClock, value: string, side: InstantSide, milestoneSide?: InstantSide): string {
  if (!milestoneSide) return workdayBoundaryLabel(clock, value, side);
  const at = (edge: InstantSide): string => {
    const label = workdayBoundaryLabel(clock, value, edge);
    if (isDateOnly(label) || edge === 'start') return label;
    return freeDayEndingAt(clock, value) ?? label;
  };
  const first = at(milestoneSide);
  if (isDateOnly(first)) return first;
  return at(milestoneSide === 'start' ? 'end' : 'start');
}

export interface TaskDateLabelOptions {
  /** Is dit een eigen start- of eindveld van de taak (start, einde, vroegst, laatst, werkelijk, baseline)?
   *  Alleen dan geldt de mijlpaalregel. Een beperking, deadline, onderbreking of anker volgt haar eigen
   *  kant. Standaard aan. */
  milestoneOwn?: boolean;
}

/**
 * De getoonde vorm van één datum van een taak volgens B4: een datum zonder tijd als het moment op de
 * dagrand van zijn kant valt, anders het moment. Een lege waarde of een datum zonder tijd komt ongewijzigd
 * terug.
 */
export function taskDateLabel(
  task: Task,
  value: string,
  side: InstantSide,
  calendar: WorkCalendar,
  opts: TaskDateLabelOptions = {},
): string {
  if (!value) return value;
  const clock = taskDateClock(task, calendar);
  const milestone = (opts.milestoneOwn ?? true) && isZeroDurationMilestone(task);
  if (!milestone) return momentLabel(clock, value, side);
  return momentLabel(clock, value, side, task.milestoneKind === 'FINISH' ? 'end' : 'start');
}

/** Dezelfde regel met de kalender van de taak uit de bibliotheek van het document (eigen `calendarId`,
 *  anders de projectkalender). */
export function taskDateLabelIn(
  task: Task,
  value: string,
  side: InstantSide,
  calendars: { calendar: WorkCalendar; calendars: readonly WorkCalendar[] },
  opts: TaskDateLabelOptions = {},
): string {
  const calendar = resolveCalendar(task.calendarId, calendars.calendars as WorkCalendar[], calendars.calendar);
  return taskDateLabel(task, value, side, calendar, opts);
}
