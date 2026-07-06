import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { TFunction } from 'i18next';
import { isHourCalendar, deriveHoursPerDay } from '@/services/subdayIo';
import { formatDuration, type DurationUnit, type DurationSuffixes } from '@/utils/durationFormat';
import type { DurationDisplay } from '@/state/slices/types';

/**
 * Bouw de vertaalde duur-suffixen uit de i18n-`t` (common-namespace). Licht adapter-laagje zodat de PURE
 * engine-util `durationFormat.ts` geen i18n hoeft te importeren (§6.4/§11): de UI reikt de vertaalde
 * afkortingen als parameter aan. Uitsluitend voor de WEERGAVE; edit-seeds houden de default (parsebare) vorm.
 */
export function durationSuffixesFrom(t: TFunction<'common'>): DurationSuffixes {
  return { day: t('duration.suffixDay'), hour: t('duration.suffixHour'), minute: t('duration.suffixMinute') };
}

/**
 * UI-zijde duur-helpers (fase 2.8b, §6.4/§6.5). Spiegelen de engine-helpers
 * (`duration.ts` `durationMinutesOf`/`durationDaysOf`) maar werken rechtstreeks op een
 * `WorkCalendar` (met afgeleide `hoursPerDay`), zodat dialogen/tabellen/panelen ze zonder
 * engine-instantie kunnen gebruiken.
 */

/** Effectieve kalender van een taak (§5): eigen `calendarId` uit de bibliotheek, anders de projectkalender. */
export function effectiveCalendarOf(
  task: Task,
  projectCal: WorkCalendar,
  library: WorkCalendar[],
): WorkCalendar {
  return (task.calendarId ? library.find((c) => c.id === task.calendarId) : undefined) || projectCal;
}

/**
 * Netto werkuren/dag van een kalender: bij een uur-kalender de afgeleide modale bandsom
 * (Bevinding 8), anders de opgegeven scalar `hoursPerDay`.
 */
export function effHoursPerDay(cal: WorkCalendar): number {
  return isHourCalendar(cal) ? deriveHoursPerDay(cal.workTime!, cal.hoursPerDay) : cal.hoursPerDay;
}

/**
 * Duur van een taak in integer MINUTEN o.b.v. een `WorkCalendar` (spiegelt `durationMinutesOf`).
 * Uur-kalender ⇒ `durationMinutes` als bron; anders `scheduleDuration × hpd × 60`.
 */
export function taskDurationMinutes(task: Task, cal: WorkCalendar): number {
  const hpd = effHoursPerDay(cal);
  if (isHourCalendar(cal) && task.time.durationMinutes != null) return task.time.durationMinutes;
  return task.time.scheduleDuration * hpd * 60;
}

function unitFor(display: DurationDisplay): DurationUnit {
  return display; // 'auto' | 'days' | 'hours' zijn identiek aan DurationUnit
}

/**
 * Geformatteerde duur voor tabellen/panelen/tooltips (§6.5).
 * - `enableHourPlanning` UIT ⇒ byte-identiek: het naakte aantal werkdagen (huidig gedrag).
 * - AAN ⇒ de eigen eenheid per taak via `durationDisplay` (`auto`/`days`/`hours`).
 */
export function formatTaskDurationDisplay(
  task: Task,
  cal: WorkCalendar,
  display: DurationDisplay,
  enableHourPlanning: boolean,
  suffixes?: DurationSuffixes,
): string {
  if (!enableHourPlanning) return `${task.isMilestone ? 0 : task.time.scheduleDuration}`;
  if (task.isMilestone) return '0';
  return formatDuration(taskDurationMinutes(task, cal), effHoursPerDay(cal), unitFor(display), suffixes);
}

/**
 * Mixed-kalender-detectie (§6.5): een project mengt duur-eenheden zodra het kalenders met
 * verschillende `hoursPerDay` gebruikt, óf dag- én uur-taken tegelijk heeft. Kijkt naar de
 * effectieve kalender van elke taak plus de projectkalender.
 */
export function detectMixedCalendars(
  tasks: Task[],
  projectCal: WorkCalendar,
  library: WorkCalendar[],
): {
  mixed: boolean;
  hpds: number[];
  hasDay: boolean;
  hasHour: boolean;
  /** De feitelijk gebruikte kalenders (project + taak-kalenders), voor een per-kalender-hoursPerDay-tooltip. */
  calendars: { id: string; name: string; hpd: number; isHour: boolean }[];
} {
  const hpdSet = new Set<number>();
  let hasDay = false;
  let hasHour = false;
  const seen = new Map<string, { id: string; name: string; hpd: number; isHour: boolean }>();
  const consider = (cal: WorkCalendar) => {
    const hpd = effHoursPerDay(cal);
    hpdSet.add(hpd);
    const hour = isHourCalendar(cal);
    if (hour) hasHour = true;
    else hasDay = true;
    if (!seen.has(cal.id)) seen.set(cal.id, { id: cal.id, name: cal.name, hpd, isHour: hour });
  };
  consider(projectCal);
  for (const t of tasks) {
    if (t.isMilestone) continue;
    consider(effectiveCalendarOf(t, projectCal, library));
  }
  const hpds = [...hpdSet].sort((a, b) => a - b);
  // §6.5: waarschuw zodra het project duur-eenheden mengt — óf verschillende effectieve daglengtes
  // (`hpds.length > 1`), óf dag- én uur-taken tegelijk (`hasDay && hasHour`, óók bij gelijke hoursPerDay).
  const mixed = hpds.length > 1 || (hasDay && hasHour);
  return { mixed, hpds, hasDay, hasHour, calendars: [...seen.values()] };
}
