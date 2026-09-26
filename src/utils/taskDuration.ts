import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { TFunction } from 'i18next';
import { isHourCalendar, deriveHoursPerDay } from '@/services/subdayIo';
import { formatDuration, type DurationSuffixes } from '@/utils/durationFormat';
import { formatReportNumber } from '@/utils/reportNumber';
import type { DurationDisplay } from '@/types/view';
import { isZeroDurationMilestone, taskDurationUnit } from '@/engine/scheduler/duration';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';

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

/** Effectieve kalender van een taak (§5): eigen `calendarId` uit de bibliotheek, anders de
 *  projectkalender — `resolveCalendar` met de argumenten in UI-volgorde. */
export function effectiveCalendarOf(
  task: Task,
  projectCal: WorkCalendar,
  library: WorkCalendar[],
): WorkCalendar {
  return resolveCalendar(task.calendarId, library, projectCal);
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
  if (taskDurationUnit(task) === 'hours') return task.time.durationMinutes ?? 0;
  return task.time.scheduleDuration * hpd * 60;
}

/** Hoe een duur- of werkdagtekst eruitziet: eenheid-instelling, vertaalde afkortingen, taal. */
export interface DurationTextFormat {
  /** Duurweergave (Automatisch/Dagen/Uren); ontbreekt ⇒ `'auto'` = de eigen taakeenheid. */
  display?: DurationDisplay;
  /** Vertaalde eenheid-afkortingen (`durationSuffixesFrom`); ontbreken ⇒ `d`/`h`/`m`. */
  suffixes?: DurationSuffixes;
  /** App-taal voor het decimaalteken ("0,5" in nl, "0.5" in en); ontbreekt ⇒ punt. */
  locale?: string;
}

function suffixesOf(fmt: DurationTextFormat | undefined): DurationSuffixes {
  return {
    day: fmt?.suffixes?.day ?? 'd',
    hour: fmt?.suffixes?.hour ?? 'h',
    minute: fmt?.suffixes?.minute ?? 'm',
  };
}

/**
 * Een aantal WERKDAGEN als weergavetekst — speling, restduur van een dagtaak, baselineduur, en de
 * dagvorm van een duur. Eén getalnotatie voor alle schermen: hoogstens twee decimalen, het
 * decimaalteken van de app-taal en geen duizendtalscheiding (`formatReportNumber`, dezelfde als de
 * rapporten), met de dag-afkorting erachter. Niet-eindig ⇒ "—". Zo staat er nooit meer
 * "1.6666666666666667" in een Nederlands scherm (audit weergaven, bevinding 8).
 */
export function formatWorkDaysText(days: number, fmt?: DurationTextFormat): string {
  const text = formatReportNumber(days, fmt?.locale);
  return text ? `${text}${suffixesOf(fmt).day}` : '—';
}

/** Minuten als uren + minuten ("5h", "1h 30m", "45m"), op hele minuten. */
function hoursText(minutes: number, hoursPerDay: number, suffixes: DurationSuffixes): string {
  return formatDuration(Math.round(minutes), hoursPerDay, 'hours', suffixes);
}

/**
 * DE duur-celtekst van een taak: taakraster, Gantt-afdruk/PDF, tooltip en balklabels lezen allemaal
 * deze ene functie (audit weergaven, bevinding 7 — het raster negeerde Duurweergave en de afdruk
 * toonde een urentaak van 5h als "0,56d").
 * - `auto` ⇒ de door de gebruiker gekozen, blijvende taakeenheid ("5h", "2d");
 * - `days`/`hours` ⇒ die eenheid, met de eigen eenheid erachter als ze verschilt ("18h(2d)").
 * Een nulduur-mijlpaal is "0d". `hoursPerDay` is die van de effectieve taakkalender (de omrekening
 * tussen dagen en uren); de EDIT-tekst van het raster blijft bewust de parsebare eigen vorm.
 */
export function formatTaskDurationText(task: Task, hoursPerDay: number, fmt?: DurationTextFormat): string {
  const suffixes = suffixesOf(fmt);
  if (isZeroDurationMilestone(task)) return `0${suffixes.day}`;
  const nativeUnit = taskDurationUnit(task);
  const minutes = nativeUnit === 'hours'
    ? task.time.durationMinutes ?? 0
    : task.time.scheduleDuration * hoursPerDay * 60;
  const native = nativeUnit === 'days'
    ? formatWorkDaysText(task.time.scheduleDuration, fmt)
    : hoursText(minutes, hoursPerDay, suffixes);

  // Automatisch betekent letterlijk de door de gebruiker gekozen, blijvende taakeenheid. Houd de
  // exacte kalenderwandeling voor een bewuste eenheidswissel in TaskDurationField; de renderer mag
  // niet bij iedere tekenronde duizenden werkdagen doorlopen om een presentatie-equivalent te zoeken.
  const display = fmt?.display ?? 'auto';
  if (display === 'auto' || display === nativeUnit) return native;
  const converted = display === 'days'
    ? formatWorkDaysText(hoursPerDay > 0 ? minutes / (hoursPerDay * 60) : NaN, fmt)
    : hoursText(minutes, hoursPerDay, suffixes);
  return `${converted}(${native})`;
}

/**
 * De resterende duur van een urentaak in MINUTEN — dezelfde bron als de planning (`CPMSolver`,
 * IN-PROGRESS-tak): `remainingMinutes` als die er is, anders duur × (1 − voortgang). Voltooid ⇒ 0.
 * `remainingTime` is voor een urentaak onbruikbaar als weergave: `applyProgressInvariants` rondt hem
 * op HELE dagen af, dus een taak van 5h op 40% stond als "0" terwijl er 3 uur werk openstaat.
 */
export function remainingTaskMinutes(task: Task): number {
  if (task.time.completion >= 1 || task.time.actualFinish) return 0;
  return Math.max(0, task.time.remainingMinutes
    ?? Math.round((task.time.durationMinutes ?? 0) * (1 - task.time.completion)));
}

/**
 * Restduur als weergavetekst (paneel "Resterend", rasterkolom "Resterende duur"): een urentaak in
 * uren/minuten ({@link remainingTaskMinutes}), een dagtaak in werkdagen met dezelfde getalopmaak als
 * speling en duur ({@link formatWorkDaysText}). De eenheid staat in de waarde, niet in het label.
 */
export function formatRemainingDurationText(task: Task, fmt?: DurationTextFormat): string {
  if (taskDurationUnit(task) === 'hours') return hoursText(remainingTaskMinutes(task), 1, suffixesOf(fmt));
  const days = task.time.remainingTime ?? Math.round(task.time.scheduleDuration * (1 - task.time.completion));
  return formatWorkDaysText(days, fmt);
}

/**
 * Geformatteerde duur voor tabellen/panelen/tooltips (§6.5) op basis van de effectieve kalender:
 * {@link formatTaskDurationText} met de uren per dag van `cal`. `enableHourPlanning` doet bewust
 * niets meer — de blijvende taakeenheid blijft ook zichtbaar als de schakelaar uit staat.
 */
export function formatTaskDurationDisplay(
  task: Task,
  cal: WorkCalendar,
  display: DurationDisplay,
  enableHourPlanning: boolean,
  suffixes?: DurationSuffixes,
  locale?: string,
): string {
  void enableHourPlanning;
  return formatTaskDurationText(task, effHoursPerDay(cal), { display, suffixes, locale });
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
    if (!seen.has(cal.id)) seen.set(cal.id, { id: cal.id, name: cal.name, hpd, isHour: hour });
  };
  consider(projectCal);
  for (const t of tasks) {
    if (t.isMilestone) continue;
    consider(effectiveCalendarOf(t, projectCal, library));
    if (taskDurationUnit(t) === 'hours') hasHour = true;
    else hasDay = true;
  }
  const hpds = [...hpdSet].sort((a, b) => a - b);
  // §6.5: waarschuw zodra het project duur-eenheden mengt — óf verschillende effectieve daglengtes
  // (`hpds.length > 1`), óf dag- én uur-taken tegelijk (`hasDay && hasHour`, óók bij gelijke hoursPerDay).
  const mixed = hpds.length > 1 || (hasDay && hasHour);
  return { mixed, hpds, hasDay, hasHour, calendars: [...seen.values()] };
}
