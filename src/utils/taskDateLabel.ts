import {
  blocksClock, ELAPSED_CLOCK, isInstant, milestoneWorkdayOf, workdayBoundaryLabel, workdayEdgeAt, type DayClock,
  type InstantSide,
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
 *  - een mijlpaal heeft één moment en toont geen tijd als dat moment op het begin of einde van zijn werkdag
 *    valt (`milestoneWorkdayOf`, ook op een dag zonder werkblok: D4; zie {@link momentLabel}).
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
 * B4 voor één moment. `milestoneSide` = het moment hoort bij een nulduur-mijlpaal, met de kant van zijn soort
 * (FINISH de eindkant, anders de startkant). Dan toont de tabel alleen de datum als het moment op het begin
 * of het einde van zijn werkdag valt. Die werkdag komt uit `milestoneWorkdayOf` (spec §4.2, B10 met de
 * aanvulling "einde blijft einde"): de dag waarvan de werkspanne het moment bevat, ook op een dag zonder
 * werkblok (D4). Leest de rest van de app (`workdayOfInstant`) het moment op een echte werkdag waarvan de
 * spanne het bevat, dan is het die dag; zo gaat het echte begin van ma voor een D4-einde van zo op hetzelfde
 * moment. Een moment midden in echte werktijd hoort nooit bij een D4-dag. Verder beslist op een gedeelde rand
 * de soort. Een FINISH-mijlpaal op het einde van ma blijft "ma", ook als hetzelfde moment het begin van
 * di is (24-uurskalender). Bij ma–do 22:00–06:00 en vr 22:00–02:00 is za 02:00 "vr" en zo 06:00 "za".
 * Dezelfde werkdag gebruiken het afmelden (B10, `milestoneMomentOn`) en de statusregel
 * (`isTaskActualPastStatusDate`). Stond de mijlpaal op een dagrand, dan toont de tabel na afmelden de dag die
 * de planner typte. Midden op de dag toont hij het moment met zijn klokdatum (B4); bij een nachtdienst kan
 * dat de dag na de getypte zijn (knownbug 499). Een gewone taak krijgt deze regel niet; haar weergave blijft
 * gelijk.
 */
export function momentLabel(clock: DayClock, value: string, side: InstantSide, milestoneSide?: InstantSide): string {
  if (!milestoneSide) return workdayBoundaryLabel(clock, value, side);
  if (!isInstant(value)) return value;
  const day = milestoneWorkdayOf(clock, value, milestoneSide);
  return day && workdayEdgeAt(clock, day, value) ? day : value;
}

/** De kant van de soort van een mijlpaal: FINISH de eindkant, anders de startkant (D7). */
export function milestoneKindSide(task: Task): InstantSide {
  return task.milestoneKind === 'FINISH' ? 'end' : 'start';
}

/** De werkdag van een moment van een nulduur-mijlpaal (`milestoneWorkdayOf`) met de klok van de taak. */
export function milestoneDay(task: Task, value: string, calendar: WorkCalendar): string {
  return milestoneWorkdayOf(taskDateClock(task, calendar), value, milestoneKindSide(task));
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
  return momentLabel(clock, value, side, milestoneKindSide(task));
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
