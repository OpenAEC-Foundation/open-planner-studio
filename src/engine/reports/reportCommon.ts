import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import { isHourModeCalendar, type WorkCalendar } from '@/types/calendar';
import type { Baseline } from '@/types/baseline';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { ProjectSolveOptions } from '@/engine/scheduler/solveInput';
import { createTaskEngineCache, type TaskEngineCache } from '@/engine/scheduler/taskEngineCache';
import {
  durationHoursPerDay, effHoursPerDay, effectiveCalendarOf, remainingTaskMeasure, taskMeasuredDuration,
  type MeasuredDuration,
} from '@/utils/taskDuration';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { shownStart, shownFinish, shownSpanOverlapsDays } from '@/utils/taskDates';
import { taskDateLabelIn, type TaskDateLabelOptions } from '@/utils/taskDateLabel';
import { isDateOnly, isInstant, type InstantSide } from '@/engine/calendar/workdayRules';
import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { progressState, taskWorkDays, type ProgressState } from '@/engine/scheduler/summaryProgress';
import { type ReportingPeriod, type ResolvedPeriod, resolveReportingPeriod } from './reportingPeriod';

/**
 * Gedeelde bouwstenen van de tabelrapporten.
 *
 * Alles hier is PUUR: geen store, geen React, geen i18n. Elk rapport in deze map krijgt één
 * `ReportContext` (een momentopname van het actieve document plus een injecteerbare "vandaag")
 * en levert rijen met rauwe waarden (ISO-datums, getallen, enum-statussen); de UI formatteert en
 * vertaalt. Zo delen de DOM-tabel, de vector-PDF-export én de headless testbatterij
 * (`tests/planning/check-reports.ts`) letterlijk dezelfde rekenweg.
 *
 * Afspraken die élk rapport volgt:
 * - Alleen BLADTAKEN tellen als activiteit (zelfde leaf-filter als de solver); verzameltaken
 *   verschijnen uitsluitend in het WBS-overzicht.
 * - Datums zijn de CPM-datums (`earlyStart`/`earlyFinish`), met `scheduleStart`/`scheduleFinish`
 *   als terugval vóór de eerste berekening — dezelfde keuze als het mijlpalen- en variance-rapport.
 * - De referentiedatum is de statusdatum van het project; ontbreekt die, dan "vandaag". Het rapport
 *   meldt via `statusDateMissing` dat het op vandaag rekent, zodat de gebruiker dat ziet.
 * - Werkdagen komen uit de TAAKkalender (`resolveCalendar`, zelfde mapping als de CPM en de
 *   belastingberekening), nooit uit een kale 5-daagse aanname.
 */
export interface ReportContext {
  tasks: readonly Task[];
  sequences: readonly Sequence[];
  resources: readonly Resource[];
  assignments: readonly ResourceAssignment[];
  /** Projectkalender. */
  calendar: WorkCalendar;
  /** Kalenderbibliotheek (taak-/resourcekalenders). */
  calendars: readonly WorkCalendar[];
  cpmResult: CPMResult | null;
  /** De actieve baseline, of null. */
  baseline: Baseline | null;
  /** Statusdatum van het project (ISO, date-only of datetime). */
  statusDate?: string;
  /** "Vandaag" als ISO-dag — injecteerbaar zodat de tests deterministisch zijn. */
  today: string;
  /** "Datums zoals opgeslagen" staat aan: verzameltaken tonen dan hun opgeslagen
   *  voortgang, net als hun opgeslagen datums (zie `isSummaryProgressDerived`). */
  datesAsRecorded?: boolean;
  /** De solve-opties van het project (`solveOptionsFor`) — alleen nodig voor rapporten die zelf een
   *  what-if doorrekenen (de kritiek-padtest van de DCMA-beoordeling); ontbreekt ⇒ die test n.v.t. */
  solveOptions?: ProjectSolveOptions;
}

/** Een rapportcontext MET de solve-opties: verplicht voor een rapport dat de belasting verdeelt
 *  (`computeResourceLoading`), want de verdeling leest de maatconventie van het profiel. */
export type SolvedReportContext = ReportContext & { solveOptions: ProjectSolveOptions };

/** Alleen de dag-component van een ISO-datum(tijd): vergelijkbaar als string. */
export function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/** De getoonde vorm van een datum van de taak met deze id (besluit B4). */
export type ReportTaskDateLabel = (taskId: string, value: string | undefined, side: InstantSide, opts?: TaskDateLabelOptions) => string;

/**
 * Datums in een rapport volgens besluit B4 (spec "alleen uren"): een datum zonder tijd als het moment op de
 * dagrand van zijn kant valt (begin van de werkdag bij een start, einde bij een einde; een mijlpaal op elke
 * dagrand), anders het moment met zijn tijd. In de kalender van de taak, zoals raster en tooltip
 * (`taskDateLabel`). Rapportrijen houden hun momenten (sorteren, vergelijken); alleen de weergave gebruikt
 * deze vorm. Een onbekende taak (een vervallen baselinetaak) toont alleen de datum.
 */
export function makeTaskDateLabeler(ctx: Pick<ReportContext, 'tasks' | 'calendar' | 'calendars'>): ReportTaskDateLabel {
  const byId = new Map(ctx.tasks.map(t => [t.id, t]));
  return (taskId, value, side, opts) => {
    if (!value) return '';
    const task = byId.get(taskId);
    return task ? taskDateLabelIn(task, value, side, ctx, opts) : dayOf(value);
  };
}

/** Activiteiten: bladtaken zonder hammocks (een LOE-taak volgt anderen en is zelf geen werk). */
export function activityTasks(tasks: readonly Task[]): Task[] {
  return tasks.filter(t => t.childIds.length === 0 && !t.isHammock);
}

/** Referentiedag van het rapport: de statusdatum, anders vandaag. */
export function referenceDay(ctx: ReportContext): { day: string; statusDateMissing: boolean } {
  return referenceDayOf(ctx.statusDate, ctx.today);
}

const DAY_MS = 86_400_000;

/** Het statusmoment: alleen een statusdatum mét tijd op een uur-projectkalender, zoals in de motor
 *  (`isHourModeCalendar`). Anders telt de statusdag als geheel. */
export function statusMoment(ctx: Pick<ReportContext, 'statusDate' | 'calendar'>): Date | undefined {
  return ctx.statusDate && isInstant(ctx.statusDate) && isHourModeCalendar(ctx.calendar) ? parseInstant(ctx.statusDate) : undefined;
}

/**
 * Het verstreken deel (0–1) van een taakvenster aan het einde van `day`, of op `moment` als dat er is.
 * Eén fractie voor alle meetpunten, dus een curve daalt niet. Een uur-kalender meet in de dagenmaat
 * (`measuredWorkdaysBetween`): elke werkdag telt 1 en een taak mag midden op de dag starten of eindigen;
 * een einde zonder tijd bezet zijn hele dag. Een dagkalender kent geen tijd van de dag: hij telt werkdagen,
 * beide grenzen inclusief (`workDaysBetween`).
 */
export function elapsedWorkFraction(eng: CalendarEngine, start: string, finish: string, day: string, moment?: Date): number {
  if (!eng.isHourMode) {
    const from = dayOf(start);
    const to = dayOf(finish);
    if (day < from) return 0;
    if (day >= to) return 1;
    const s = parseDate(from);
    const total = eng.workDaysBetween(s, parseDate(to));
    if (!(total > 0)) return 1;
    return Math.min(1, Math.max(0, eng.workDaysBetween(s, parseDate(day)) / total));
  }
  const s = parseInstant(start);
  const f = isDateOnly(finish) ? new Date(parseDate(finish).getTime() + DAY_MS) : parseInstant(finish);
  const at = moment ?? new Date(parseDate(day).getTime() + DAY_MS);
  if (at <= s) return 0;
  if (at >= f) return 1;
  const total = eng.measuredWorkdaysBetween(s, f);
  if (!(total > 0)) return 1;
  return Math.min(1, Math.max(0, eng.measuredWorkdaysBetween(s, at) / total));
}

/** Zelfde regel, zonder volledige context — voor de UI die het periodevenster vooraf toont. */
export function referenceDayOf(statusDate: string | undefined, today: string): { day: string; statusDateMissing: boolean } {
  if (statusDate) return { day: dayOf(statusDate), statusDateMissing: false };
  return { day: dayOf(today), statusDateMissing: true };
}

/** De getoonde datums (CPM, anders opgeslagen) onder de namen die de rapportmodules gebruiken. */
export { shownStart as taskStart, shownFinish as taskFinish };

/** Voortgangsstaat van een taak — gedeeld met `applyCpmResult` en daarom in
 *  `engine/scheduler/summaryProgress.ts`; hier heruitgevoerd zodat de rapportmodules hun vaste
 *  importpad houden. */
export { progressState, type ProgressState };

/** Achterstand t.o.v. de referentiedag, op dagniveau: `finish` als een onvoltooide taak vóór `refDay`
 *  had moeten eindigen, anders `start` als een niet-gestarte taak vóór `refDay` had moeten beginnen.
 *  Eén definitie voor look-ahead, voortgang en resourcetoewijzingen. */
export function scheduleSlip(t: Task, state: ProgressState, refDay: string): 'finish' | 'start' | undefined {
  if (state === 'complete') return undefined;
  if (dayOf(shownFinish(t)) < refDay) return 'finish';
  if (state === 'notStarted' && dayOf(shownStart(t)) < refDay) return 'start';
  return undefined;
}

/** Duur van een taak in werkdagen op haar eigen kalender (uur-taken: minuten ÷ uren per dag). Eén
 *  definitie met het gewicht van de verzameltaak-voortgang (`taskWorkDays`, summaryProgress.ts). */
export function durationDays(ctx: ReportContext, t: Task): number {
  return taskWorkDays(t, ctx.calendar, ctx.calendars);
}

/**
 * Resterende duur in werkdagen (een getal, voor tellingen en de toetsen). Spiegelt de solver
 * (`CPMSolver`, IN-PROGRESS-tak): in de urenmaat is `remainingMinutes` de bron, in de dagenmaat
 * `remainingTime`; ontbreekt die, dan `duur × (1 − completion)`. Voltooid ⇒ 0. De rest is exact (B3,
 * `applyRemainingDuration`); dit getal rondt af op één decimaal. Het rapport toont de rest in de maat
 * van de taak: {@link remainingMeasure}.
 */
export function remainingDays(ctx: ReportContext, t: Task): number {
  if (progressState(t) === 'complete') return 0;
  const cal = effectiveCalendarOf(t, ctx.calendar, ctx.calendars as WorkCalendar[]);
  const minPerDay = effHoursPerDay(cal) * 60;
  if (taskDurationUnit(t) === 'hours') {
    if (t.time.remainingMinutes !== undefined && minPerDay > 0) return round1(t.time.remainingMinutes / minPerDay);
  } else if (t.time.remainingTime !== undefined) {
    return round1(t.time.remainingTime);
  }
  return round1(durationDays(ctx, t) * (1 - t.time.completion));
}

/**
 * De restduur in de maat van de taak (B8): een dagenmaat-taak in werkdagen, een urenmaat-taak in
 * werkminuten. Dezelfde bron als de kolom Resterende duur van de tabel (`remainingTaskMeasure`);
 * voltooid ⇒ 0.
 */
export function remainingMeasure(t: Task): MeasuredDuration {
  const own = remainingTaskMeasure(t);
  if (progressState(t) !== 'complete') return own;
  return own.unit === 'hours' ? { unit: 'hours', minutes: 0 } : { unit: 'days', days: 0 };
}

/** De duur in de maat van de taak (B8), zoals de kolom Duur van de tabel. */
export function durationMeasure(t: Task): MeasuredDuration {
  return taskMeasuredDuration(t);
}

/** De uren per dag waarmee de duur van een taak omrekent (Duurweergave): de werktijd per dag van haar
 *  kalender, bij kalendertijd 24 klokuren. */
export function taskHoursPerDay(ctx: ReportContext, t: Task): number {
  // Kalendertijd: 24 klokuren per dag, zoals de Duur-kolom (`durationHoursPerDay`).
  return durationHoursPerDay(t, effHoursPerDay(effectiveCalendarOf(t, ctx.calendar, ctx.calendars as WorkCalendar[])));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Kalender-engines per taak, gecachet per kalender-id (zelfde resolutie als de CPM). */
export function makeEngineCache(ctx: ReportContext): TaskEngineCache {
  return createTaskEngineCache(ctx.calendars as WorkCalendar[], ctx.calendar);
}

/**
 * De projectspanne uit de (berekende) taakdatums: vroegste start t/m laatste einde over alle taken,
 * op dagniveau. Undefined bij een project zonder taken.
 */
export function projectSpan(tasks: readonly Task[]): ResolvedPeriod | undefined {
  let from: string | undefined;
  let to: string | undefined;
  for (const t of tasks) {
    const s = dayOf(shownStart(t));
    const f = dayOf(shownFinish(t));
    if (!s || !f) continue;
    if (!from || s < from) from = s;
    if (!to || f > to) to = f;
  }
  return from && to ? { from, to } : undefined;
}

/**
 * De rapportageperiode opgelost tegen de referentiedag van dit rapport — één plek,
 * zodat look-ahead, voortgang, belasting en toewijzingen hetzelfde venster uit dezelfde keuze halen.
 */
export function resolvePeriodFor(ctx: ReportContext, period: ReportingPeriod): ResolvedPeriod & { refDay: string; statusDateMissing: boolean } {
  const { day, statusDateMissing } = referenceDay(ctx);
  const resolved = resolveReportingPeriod(period, day, projectSpan(ctx.tasks));
  return { ...resolved, refDay: day, statusDateMissing };
}

/** Interval-overlap op dagniveau (inclusieve grenzen) — dezelfde test als het "Actief tussen"-filter. */
export { shownSpanOverlapsDays as overlapsWindow };

/**
 * Namen van de toegewezen resources per taak, in toewijzingsvolgorde en ontdubbeld — één index
 * voor het hele rapport (O(toewijzingen)), niet per rij (O(taken × toewijzingen)).
 */
export function assignedResourceNamesIndex(ctx: ReportContext): Map<string, string[]> {
  const byId = new Map(ctx.resources.map(r => [r.id, r]));
  const out = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const a of ctx.assignments) {
    const key = `${a.taskId}\u0000${a.resourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = byId.get(a.resourceId);
    if (!r) continue;
    let list = out.get(a.taskId);
    if (!list) { list = []; out.set(a.taskId, list); }
    list.push(r.name);
  }
  return out;
}

/** Near-critical: 0 < TF ≤ drempel (rapportdrempel), of door de planningsopties zo gemarkeerd. */
export function isNearCritical(t: Task, thresholdDays: number): boolean {
  if (t.time.isCritical) return false;
  if (t.time.isNearCritical) return true;
  const tf = t.time.totalFloat;
  return thresholdDays > 0 && tf > 0 && tf <= thresholdDays;
}

/** Diepte in de WBS-boom: 1 = hoofdniveau. Eén implementatie (`utils/wbs.ts`, cyclusvast via
 *  `flattenOrder`); hier opnieuw geëxporteerd zodat de rapportlaag zijn bestaande import houdt. */
export { taskDepths } from '@/utils/wbs';
