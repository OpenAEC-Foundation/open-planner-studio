import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import type { Baseline } from '@/types/baseline';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { effHoursPerDay, effectiveCalendarOf, taskDurationMinutes } from '@/utils/taskDuration';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { addCalendarDays, formatDate, parseDate } from '@/utils/dateUtils';

/**
 * Gedeelde bouwstenen van de tabelrapporten (discussie #31, manuvarkey — de rapportuitbreiding).
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
}

export type ProgressState = 'notStarted' | 'inProgress' | 'complete';

/** Alleen de dag-component van een ISO-datum(tijd): vergelijkbaar als string. */
export function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export function leafTasks(tasks: readonly Task[]): Task[] {
  return tasks.filter(t => t.childIds.length === 0);
}

/** Activiteiten: bladtaken zonder hammocks (een LOE-taak volgt anderen en is zelf geen werk). */
export function activityTasks(tasks: readonly Task[]): Task[] {
  return tasks.filter(t => t.childIds.length === 0 && !t.isHammock);
}

/** Referentiedag van het rapport: de statusdatum, anders vandaag. */
export function referenceDay(ctx: ReportContext): { day: string; statusDateMissing: boolean } {
  if (ctx.statusDate) return { day: dayOf(ctx.statusDate), statusDateMissing: false };
  return { day: dayOf(ctx.today), statusDateMissing: true };
}

export function taskStart(t: Task): string {
  return t.time.earlyStart || t.time.scheduleStart;
}

export function taskFinish(t: Task): string {
  return t.time.earlyFinish || t.time.scheduleFinish;
}

/**
 * Voortgangsstaat van een taak. Voltooid zodra completion 1, status COMPLETED of een werkelijk
 * einde; gestart zodra completion > 0, status STARTED of een werkelijke start. De volgorde is
 * bewust "meest afgeronde wint": een taak met actualFinish maar completion 0.9 (importruis) telt
 * als voltooid — het gezondheidsrapport meldt zo'n inconsistentie apart.
 */
export function progressState(t: Task): ProgressState {
  if (t.time.completion >= 1 || t.status === 'COMPLETED' || !!t.time.actualFinish) return 'complete';
  if (t.time.completion > 0 || t.status === 'STARTED' || !!t.time.actualStart) return 'inProgress';
  return 'notStarted';
}

/** Duur van een taak in werkdagen op haar eigen kalender (uur-taken: minuten ÷ uren per dag). */
export function durationDays(ctx: ReportContext, t: Task): number {
  const cal = effectiveCalendarOf(t, ctx.calendar, ctx.calendars as WorkCalendar[]);
  const minPerDay = effHoursPerDay(cal) * 60;
  if (minPerDay <= 0) return t.time.scheduleDuration;
  return round1(taskDurationMinutes(t, cal) / minPerDay);
}

/**
 * Resterende duur in werkdagen. Spiegelt de solver (`CPMSolver`, IN-PROGRESS-tak): in uur-modus is
 * `remainingMinutes` de bron, in dag-modus `remainingTime`; ontbreekt die, dan `duur × (1 −
 * completion)`. Voltooid ⇒ 0. Let op: `applyProgressInvariants` rondt `remainingTime` op hele dagen,
 * dus een dag-taak toont hier nooit halve dagen — dat is de opgeslagen waarde, geen rekenfout.
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

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Kalender-engine per taak, gecachet per kalender-id (zelfde resolutie als de CPM). */
export function makeEngineCache(ctx: ReportContext): (t: Task) => CalendarEngine {
  const cache = new Map<string, CalendarEngine>();
  return (t: Task) => {
    const key = t.calendarId ?? '';
    let eng = cache.get(key);
    if (!eng) {
      eng = new CalendarEngine(calendarForEngine(resolveCalendar(t.calendarId, ctx.calendars as WorkCalendar[], ctx.calendar)));
      cache.set(key, eng);
    }
    return eng;
  };
}

/** Getekend werkdag-verschil a→b (a≤b ⇒ ≥0), zelfde conventie als `variance.ts`. */
export function signedWorkDays(eng: CalendarEngine, aIso: string, bIso: string): number {
  const a = parseDate(aIso);
  const b = parseDate(bIso);
  return a <= b ? eng.workDaysBetween(a, b) - 1 : -(eng.workDaysBetween(b, a) - 1);
}

/** Vensterrand: `days − 1` kalenderdagen ná `fromDay` (inclusief venster van precies `days` dagen). */
export function windowEnd(fromDay: string, days: number): string {
  return formatDate(addCalendarDays(parseDate(fromDay), Math.max(0, days - 1)));
}

/** Vensterstart: `days − 1` kalenderdagen vóór `toDay` (inclusief). */
export function windowStart(toDay: string, days: number): string {
  return formatDate(addCalendarDays(parseDate(toDay), -Math.max(0, days - 1)));
}

/** Interval-overlap op dagniveau (inclusieve grenzen) — dezelfde test als het "Actief tussen"-filter. */
export function overlapsWindow(t: Task, fromDay: string, toDay: string): boolean {
  return dayOf(taskStart(t)) <= toDay && dayOf(taskFinish(t)) >= fromDay;
}

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

/** Diepte in de WBS-boom: 1 = hoofdniveau. Cyclusvast (zoals `flattenOrder`): een corrupte
 *  `parentId`-kring wordt als hoofdniveau behandeld in plaats van de stack op te blazen. */
export function taskDepths(tasks: readonly Task[]): Map<string, number> {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const depth = new Map<string, number>();
  for (const t of tasks) {
    if (depth.has(t.id)) continue;
    // Loop de ouderketen op tot een bekende diepte, een wortel of een kring.
    const chain: Task[] = [];
    const onChain = new Set<string>();
    let cur: Task | undefined = t;
    let base = 0;
    while (cur) {
      const known = depth.get(cur.id);
      if (known !== undefined) { base = known; break; }
      if (onChain.has(cur.id)) { base = 0; break; } // kring: de rest telt vanaf hoofdniveau
      chain.push(cur);
      onChain.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    for (let i = chain.length - 1; i >= 0; i--) {
      base += 1;
      depth.set(chain[i].id, base);
    }
  }
  return depth;
}
