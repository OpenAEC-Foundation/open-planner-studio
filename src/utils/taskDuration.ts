import type { Task } from '@/types/task';
import { isHourModeCalendar, type WorkCalendar } from '@/types/calendar';
import type { TFunction } from 'i18next';
import { deriveHoursPerDay } from '@/services/subdayIo';
import { formatDuration, type DurationSuffixes } from '@/utils/durationFormat';
import { formatReportNumber } from '@/utils/reportNumber';
import type { DurationDisplay } from '@/types/view';
import { isZeroDurationMilestone, taskDurationUnit } from '@/engine/scheduler/duration';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import type { Project } from '@/types/project';

/**
 * Telt het rekenprofiel van dit project een dagenmaat in werkdagen (conventie `workdayDurationMeasure`)?
 * Aan in het OPS-profiel, uit onder P6 en MS Project. Bepaalt wat "d" betekent bij invoer (B8: aan ⇒ de
 * dagenmaat, uit ⇒ de urenmaat) en of Duurweergave meetelt (B9).
 */
export function profileCountsWorkdays(project: Pick<Project, 'schedulingProfile' | 'schedulingOptions'>): boolean {
  return effectiveSchedulingOptions(project).workdayDurationMeasure === true;
}

/**
 * B9 = optie 1 (spec §3.12): in een profiel met de dagenmaat toont elke taak haar eigen maat, een
 * dagenmaat-taak in d en een urenmaat-taak in u. Duurweergave ("Altijd dagen", "Altijd uren") heeft dan
 * geen effect; onder P6 en MS Project werkt de instelling zoals voorheen.
 */
export function effectiveDurationDisplay(display: DurationDisplay, countsWorkdays: boolean): DurationDisplay {
  return countsWorkdays ? 'auto' : display;
}

/**
 * Bouw de vertaalde duur-suffixen uit de i18n-`t` (common-namespace). Licht adapter-laagje zodat de PURE
 * engine-util `durationFormat.ts` geen i18n hoeft te importeren: de UI reikt de vertaalde
 * afkortingen als parameter aan. Uitsluitend voor de WEERGAVE; edit-seeds houden de default (parsebare) vorm.
 */
export function durationSuffixesFrom(t: TFunction<'common'>): DurationSuffixes {
  return { day: t('duration.suffixDay'), hour: t('duration.suffixHour'), minute: t('duration.suffixMinute') };
}

/**
 * UI-zijde duur-helpers. Spiegelen de engine-helpers
 * (`duration.ts` `durationMinutesOf`/`durationDaysOf`) maar werken rechtstreeks op een
 * `WorkCalendar` (met afgeleide `hoursPerDay`), zodat dialogen/tabellen/panelen ze zonder
 * engine-instantie kunnen gebruiken.
 */

/** Effectieve kalender van een taak: eigen `calendarId` uit de bibliotheek, anders de
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
  return isHourModeCalendar(cal) ? deriveHoursPerDay(cal.workTime!, cal.hoursPerDay) : cal.hoursPerDay;
}

/**
 * Het verborgen dagengetal (`scheduleDuration`) van een gewone URENtaak (blad, geen hangmat): werkminuten
 * ÷ de werktijd per dag van de taakkalender ({@link effHoursPerDay}; bij een blokkenkalender de modale
 * dagsom van de blokken).
 *
 * Eigenaarsbesluit 2026-10-15, optie 2 ("een dag is de echte werktijd"; bron:
 * docs/superpowers/plans/2026-10-07-review-pr109-uitkomsten.md op `claude/review-pr109-log`, "een dag",
 * #354). Een P6-kalender met `day_hr_cnt` 8 en blokken van 10 u geeft een taak van 1870 u dus 187 dagen,
 * net als de weergave en de motor — niet 233,75. De opgeslagen `hoursPerDay` blijft op de kalender staan
 * voor de export, maar telt hier niet. De andere plekken in de code verwijzen naar deze docstring.
 *
 * Wie rekent hiermee: de lezers (XER, IFC, P6 XML, MSPDI, .mpp), het paneel en de kalenderwissel
 * (`settleCalendarChange`). Raster en MCP rekenen dezelfde deling zelf uit met {@link effHoursPerDay}
 * (`gridTransaction` → `taskEditPlan`, `taskTools` → `taskFields`); de werkregel (`applyTriangleResult`)
 * ook, met de werktijd per dag
 * afgerond op hele minuten. Uitzondering: bij een verzameltaak of hangmat leidt de doorrekening het
 * dagengetal af uit de span (`writeDerivedSpan`); bij ELAPSEDTIME deelt die door 24 uur, niet door de
 * werktijd per dag. Kalender zonder werktijd ⇒ 0. Een dagtaak raakt dit nooit: daar is
 * `scheduleDuration` zelf de invoer.
 */
export function hourTaskScheduleDuration(minutes: number, cal: WorkCalendar): number {
  const hpd = effHoursPerDay(cal);
  return hpd > 0 ? minutes / (hpd * 60) : 0;
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
 * rapporten), met de dag-afkorting erachter. Niet-eindig ⇒ "—". Zo staat er nooit
 * "1.6666666666666667" in een Nederlands scherm.
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
 * deze ene functie, zodat ze allemaal Duurweergave volgen (anders toont bv. de afdruk een urentaak
 * van 5h als "0,56d").
 * - `auto` ⇒ de door de gebruiker gekozen, blijvende taakeenheid ("5h", "2d");
 * - `days`/`hours` ⇒ die eenheid, met de eigen eenheid erachter als ze verschilt ("18h(2d)").
 * Een nulduur-mijlpaal is "0d". `hoursPerDay` is die van de effectieve taakkalender (de omrekening
 * tussen dagen en uren); de EDIT-tekst van het raster blijft bewust de parsebare eigen vorm.
 */
export function formatTaskDurationText(task: Task, hoursPerDay: number, fmt?: DurationTextFormat): string {
  if (isZeroDurationMilestone(task)) return `0${suffixesOf(fmt).day}`;
  return formatMeasuredDurationText(taskMeasuredDuration(task), hoursPerDay, fmt);
}

/** Een duur in de maat van een taak (B8): werkdagen in de dagenmaat, werkminuten in de urenmaat. */
export type MeasuredDuration = { unit: 'days'; days: number } | { unit: 'hours'; minutes: number };

/** De duur van een taak in haar eigen maat. */
export function taskMeasuredDuration(task: Task): MeasuredDuration {
  return taskDurationUnit(task) === 'hours'
    ? { unit: 'hours', minutes: task.time.durationMinutes ?? 0 }
    : { unit: 'days', days: task.time.scheduleDuration };
}

/**
 * Een duur in zijn maat als weergavetekst, de regel van {@link formatTaskDurationText}: `auto` ⇒ de eigen
 * maat ("2,5d", "40h"); `days`/`hours` ⇒ die eenheid met de eigen maat erachter als ze verschilt
 * ("18h(2d)"). `hoursPerDay` is die van de taakkalender en telt alleen bij een omrekening.
 */
export function formatMeasuredDurationText(duration: MeasuredDuration, hoursPerDay: number, fmt?: DurationTextFormat): string {
  const suffixes = suffixesOf(fmt);
  const minutes = duration.unit === 'hours' ? duration.minutes : duration.days * hoursPerDay * 60;
  const native = duration.unit === 'days'
    ? formatWorkDaysText(duration.days, fmt)
    : hoursText(minutes, hoursPerDay, suffixes);

  // Automatisch betekent letterlijk de door de gebruiker gekozen, blijvende taakeenheid. Houd de
  // exacte kalenderwandeling voor een bewuste eenheidswissel in TaskDurationField; de renderer mag
  // niet bij iedere tekenronde duizenden werkdagen doorlopen om een presentatie-equivalent te zoeken.
  const display = fmt?.display ?? 'auto';
  if (display === 'auto' || display === duration.unit) return native;
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
  return formatMeasuredDurationText(remainingTaskMeasure(task), 1, { ...fmt, display: 'auto' });
}

/** De restduur van een taak in haar eigen maat: een urentaak in minuten ({@link remainingTaskMinutes}),
 *  een dagtaak in werkdagen (`remainingTime`, anders de afgeronde duur × (1 − voortgang)). */
export function remainingTaskMeasure(task: Task): MeasuredDuration {
  if (taskDurationUnit(task) === 'hours') return { unit: 'hours', minutes: remainingTaskMinutes(task) };
  return { unit: 'days', days: task.time.remainingTime ?? Math.round(task.time.scheduleDuration * (1 - task.time.completion)) };
}

/**
 * Geformatteerde duur voor tabellen/panelen/tooltips op basis van de effectieve kalender:
 * {@link formatTaskDurationText} met de uren per dag van `cal`.
 */
export function formatTaskDurationDisplay(
  task: Task,
  cal: WorkCalendar,
  display: DurationDisplay,
  suffixes?: DurationSuffixes,
  locale?: string,
): string {
  return formatTaskDurationText(task, effHoursPerDay(cal), { display, suffixes, locale });
}

/**
 * Mixed-kalender-detectie: een project mengt duur-eenheden zodra het kalenders met
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
    const hour = isHourModeCalendar(cal);
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
  // Waarschuw zodra het project duur-eenheden mengt — óf verschillende effectieve daglengtes
  // (`hpds.length > 1`), óf dag- én uur-taken tegelijk (`hasDay && hasHour`, óók bij gelijke hoursPerDay).
  const mixed = hpds.length > 1 || (hasDay && hasHour);
  return { mixed, hpds, hasDay, hasHour, calendars: [...seen.values()] };
}
