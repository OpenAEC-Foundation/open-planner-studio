// contourIo.ts — de adapterlaag van de contour-engine (2026-09): vertaalt tussen de RAUWE vormen
// waarin MS Project (MSPDI `<TimephasedData>`) en Primavera P6 (`<PlannedCurve>`/`<RemainingCurve>`/
// `<ActualCurve>`-spreidingsstrings) een werkverdeling opslaan, en de ene interne vorm die de
// engine rekent: `TimephasedContourPeriod[]` op de cumulatieve werkminuten-as van de taak (zie
// `contourEngine.ts` en `task.ts`'s `TaskSplitGap`-docblok). Zowel `mspdiReader`/`mspdiWriter` als
// `p6xmlReader`/`p6xmlWriter` leunen hierop — één as-vertaling, geen vier die stil uiteenlopen.
//
// DAG- VS UUR-MODUS. Een taak op een uur-kalender (`engine.isHourMode`) meet asafstanden met
// `CalendarEngine.workMinutesBetween` (minuutprecies, de kalenderbanden zijn de as). Een taak op
// een DAG-kalender heeft geen banden (`workMinutesBetween` gooit daar, zie de guard in `mppReader.ts`'s
// `computeShiftedAssignmentPeriods`); daar telt de as in hele werkdagen × `hoursPerDay × 60` —
// dezelfde `mpd`-conventie als `splitWalk.ts`. Een tijd-van-de-dag binnen zo'n dag-kalender wordt
// bewust genegeerd (een dag-taak tekent en boekt nooit binnen-de-dag), met één uitzondering: een
// EINDinstant met een tijd ná middernacht telt zijn eigen dag mee (MSPDI schrijft
// `Finish=…T17:00:00`), een STARTinstant niet.
//
// Bron voor de MSPDI-vorm: MPXJ `MSPDIReader.readTimephasedWork`/`MSPDIWriter.writeAssignment
// TimephasedData` (Type 1 = resterend werk, 2 = verricht werk, 3 = verricht overwerk; `Unit` volgt de
// periodelengte: 2 = dagen; `Value` = ISO-8601-duur `PT{H}H{M}M{S}S`). Bron voor de P6-vorm: MPXJ
// `TimephasedHelper` — `"werkuren:periode-uren;…"`, aaneengesloten vanaf een anker (`PlannedStartDate`
// resp. `ActualStartDate`/`RemainingStartDate`), elke periode gemeten in WERKuren van de kalender.
import type { TaskSplitGap, TimephasedContourPeriod } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { periodsToSlotWork } from '@/engine/contour/contourEngine';
import { addCalendarDays, formatDate, parseDate } from '@/utils/dateUtils';

export type ContourKind = TimephasedContourPeriod['kind'];

/** Eén absoluut werkvak zoals MSPDI het draagt: begin- en eindinstant plus het werk erin. */
export interface AbsoluteWorkItem {
  start: Date;
  finish: Date;
  workMinutes: number;
  kind: ContourKind;
}

/** Minuten per dagslot van de taakkalender (dezelfde definitie als `splitWalk.ts`). */
export function slotMinutesOf(engine: CalendarEngine): number {
  return Math.max(1, engine.hoursPerDay * 60);
}

function dayStart(d: Date): Date {
  return parseDate(formatDate(d));
}

function hasTimeOfDay(d: Date): boolean {
  return d.getTime() !== dayStart(d).getTime();
}

/**
 * Aspositie (werkminuten sinds `taskStart`) van een absoluut instant. Uur-modus: exact via de
 * banden; dag-modus: hele werkdagen vóór de dag van `at` (× mpd), plus — alleen als `inclusiveDay`
 * (een EINDinstant met tijd-van-de-dag) — de dag van `at` zelf wanneer die een werkdag is.
 * Nooit negatief (een instant vóór de taakstart klemt op 0).
 */
export function axisOffsetMinutes(engine: CalendarEngine, taskStart: Date, at: Date, inclusiveDay = false): number {
  if (engine.isHourMode) return Math.max(0, engine.workMinutesBetween(taskStart, at));
  const mpd = slotMinutesOf(engine);
  const startDay = dayStart(taskStart);
  const atDay = dayStart(at);
  if (atDay.getTime() < startDay.getTime()) return 0;
  const before = engine.workDaysBetween(startDay, addCalendarDays(atDay, -1));
  const own = inclusiveDay && hasTimeOfDay(at) && engine.isWorkDay(atDay) ? 1 : 0;
  return (before + own) * mpd;
}

/**
 * Absolute werkvakken (MSPDI) → contourperiodes op de taak-as. Een vak dat op de as geen lengte
 * heeft (bv. een weekend-item zonder werktijd — MPXJ laat die ook vallen) wordt overgeslagen;
 * de uitkomst is gesorteerd op `afterMinutes`.
 */
export function absoluteItemsToContourPeriods(
  engine: CalendarEngine,
  taskStart: Date,
  items: readonly AbsoluteWorkItem[],
): TimephasedContourPeriod[] {
  const out: TimephasedContourPeriod[] = [];
  for (const it of items) {
    if (isNaN(it.start.getTime()) || isNaN(it.finish.getTime()) || !Number.isFinite(it.workMinutes)) continue;
    const after = axisOffsetMinutes(engine, taskStart, it.start, false);
    const end = axisOffsetMinutes(engine, taskStart, it.finish, true);
    const minutes = end - after;
    if (!(minutes > 0)) continue;
    out.push({ afterMinutes: after, minutes, workMinutes: Math.max(0, it.workMinutes), kind: it.kind });
  }
  out.sort((a, b) => a.afterMinutes - b.afterMinutes || a.minutes - b.minutes);
  return out;
}

/**
 * `TaskSplitGap[]` uit de contourperiodes van ÁLLE toewijzingen van een taak — DEZELFDE afleiding
 * als de .mpp-lezer (`mppTimephased.ts`'s `deriveSplitGapsFromPeriods` per toewijzing +
 * `deriveTaskSplitGaps` over de taak: alleen periodes MET werk tellen, strikte discontinuïteit `>`
 * is een gat, en over meerdere toewijzingen geldt de DOORSNEDE van de gaten — de taak pauzeert
 * alleen waar géén enkele toewijzing werkt), zodat een MSPDI-/P6-contour dezelfde CPM-gaten
 * oplevert als een .mpp-contour. Bewust een eigen (pure) port en geen import uit de
 * mpp-servicesmap: die module hoort buiten de hoofdbundel te blijven
 * (`check-mpp-chunk-boundary.ts`), terwijl deze adapterlaag ook door de MSPDI-/P6-lezers wordt
 * geladen. De .mpp-kant blijft de referentie; `check-contour-engine.ts` toetst dat beide dezelfde
 * gaten geven.
 */
export function splitGapsFromContours(contours: readonly (readonly TimephasedContourPeriod[])[]): TaskSplitGap[] {
  const perAssignment = contours.map(gapsFromPeriods);
  if (perAssignment.length === 0) return [];
  return perAssignment.slice(1).reduce<TaskSplitGap[]>(
    (acc, gaps) => intersectGapIntervals(acc, gaps),
    [...perAssignment[0]],
  );
}

function gapsFromPeriods(periods: readonly TimephasedContourPeriod[]): TaskSplitGap[] {
  const worked = periods
    .filter((p) => p.workMinutes !== 0 && Number.isFinite(p.afterMinutes) && Number.isFinite(p.minutes))
    .slice()
    .sort((a, b) => a.afterMinutes - b.afterMinutes);
  const gaps: TaskSplitGap[] = [];
  for (let i = 1; i < worked.length; i++) {
    const prevEnd = worked[i - 1].afterMinutes + worked[i - 1].minutes;
    const nextStart = worked[i].afterMinutes;
    if (nextStart > prevEnd) gaps.push({ afterMinutes: prevEnd, gapMinutes: nextStart - prevEnd });
  }
  return gaps;
}

function intersectGapIntervals(a: readonly TaskSplitGap[], b: readonly TaskSplitGap[]): TaskSplitGap[] {
  const result: TaskSplitGap[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const aStart = a[i].afterMinutes;
    const aEnd = aStart + a[i].gapMinutes;
    const bStart = b[j].afterMinutes;
    const bEnd = bStart + b[j].gapMinutes;
    const start = Math.max(aStart, bStart);
    const end = Math.min(aEnd, bEnd);
    if (start < end) result.push({ afterMinutes: start, gapMinutes: end - start });
    if (aEnd < bEnd) i++; else j++;
  }
  return result;
}

/** Eén dag-item voor de MSPDI-schrijver: kalenderdag, begin-/eindinstant en het werk erin. */
export interface ContourDayItem {
  iso: string;
  start: Date;
  finish: Date;
  workMinutes: number;
  kind: ContourKind;
}

/**
 * Contourperiodes → dag-items (per werkdag van de taakkalender vanaf `taskStart`, slot k = k-de
 * werkdag; gat-slots komen als 0-werk-dagen mee — precies hoe MS Project een split opslaat).
 * Actual- en remaining-periodes worden apart uitgesmeerd (MSPDI Type 2 resp. 1). Instants: uur-
 * modus ⇒ eerste bandstart / laatste bandeind van de dag; dag-modus ⇒ `workStartHour`/`workEndHour`
 * van de kalender.
 */
export function contourPeriodsToDayItems(
  engine: CalendarEngine,
  calendar: WorkCalendar,
  taskStart: Date,
  periods: readonly TimephasedContourPeriod[],
): ContourDayItem[] {
  const mpd = slotMinutesOf(engine);
  const kinds: ContourKind[] = ['actual', 'remaining'];
  const out: ContourDayItem[] = [];
  for (const kind of kinds) {
    const own = periods.filter((p) => p.kind === kind);
    if (own.length === 0) continue;
    const slots = periodsToSlotWork(own, mpd, 0);
    // Bepaal de eerste/laatste slot met werk; alles daartussen (ook 0) wordt geschreven.
    let first = -1;
    let last = -1;
    for (let k = 0; k < slots.length; k++) {
      if (slots[k] > 0) { if (first < 0) first = k; last = k; }
    }
    if (first < 0) continue;
    let day = dayStart(taskStart);
    let k = 0;
    let guard = 0;
    while (k <= last && guard++ < 200_000) {
      if (engine.isWorkDay(day)) {
        if (k >= first) {
          const { start, finish } = dayInstants(engine, calendar, day);
          out.push({ iso: formatDate(day), start, finish, workMinutes: slots[k], kind });
        }
        k++;
      }
      day = addCalendarDays(day, 1);
    }
  }
  return out;
}

function dayInstants(engine: CalendarEngine, calendar: WorkCalendar, day: Date): { start: Date; finish: Date } {
  const base = dayStart(day).getTime();
  if (engine.isHourMode) {
    const bands = engine.effectiveBandsOn(day);
    if (bands.length > 0) {
      return {
        start: new Date(base + bands[0].start * 60_000),
        finish: new Date(base + bands[bands.length - 1].end * 60_000),
      };
    }
  }
  const sh = Number.isFinite(calendar.workStartHour) ? calendar.workStartHour : 8;
  const eh = Number.isFinite(calendar.workEndHour) ? calendar.workEndHour : 17;
  return { start: new Date(base + sh * 3_600_000), finish: new Date(base + eh * 3_600_000) };
}

// ── P6-spreidingsstrings ────────────────────────────────────────────────────────────────────────

/**
 * P6 `<PlannedCurve>`/`<RemainingCurve>`/`<ActualCurve>` → contourperiodes. Vorm (MPXJ
 * `TimephasedHelper.read`): `"werkuren:periodeuren;werkuren:periodeuren;…"`, aaneengesloten vanaf
 * het anker; `anchorOffsetMinutes` is de aspositie van dat anker (zie `axisOffsetMinutes`). Een
 * string zonder `:` is geen spreiding (de pre-contour-engine-schrijver zette hier een curveNAAM —
 * dat geval hoort de aanroeper apart af te vangen) ⇒ lege lijst; elk ongeldig paar ⇒ lege lijst
 * (MPXJ doet hetzelfde: geen halve spreiding).
 */
export function p6SpreadToContourPeriods(spread: string, anchorOffsetMinutes: number, kind: ContourKind): TimephasedContourPeriod[] {
  if (!spread || spread.indexOf(':') === -1) return [];
  const out: TimephasedContourPeriod[] = [];
  let cursor = Math.max(0, anchorOffsetMinutes);
  for (const item of spread.split(';')) {
    const parts = item.split(':');
    if (parts.length !== 2) return [];
    const work = parseFloat(parts[0]);
    const period = parseFloat(parts[1]);
    if (!Number.isFinite(work) || !Number.isFinite(period) || period <= 0 || work < 0) return [];
    out.push({ afterMinutes: cursor, minutes: period * 60, workMinutes: work * 60, kind });
    cursor += period * 60;
  }
  return out;
}

/**
 * Contourperiodes → P6-spreidingsstring (spiegel van `TimephasedHelper.write`): per periode
 * `"werkuren:periodeuren"`, een leeg stuk as tussen twee periodes als `"0:uren"`. Uren op
 * twee decimalen (MPXJ schrijft `#.#`; de lezer parseert elke double, dus meer precisie is
 * schema-veilig en verliest minder). Lege lijst ⇒ `null` (element weglaten).
 */
export function contourPeriodsToP6Spread(periods: readonly TimephasedContourPeriod[], anchorOffsetMinutes = 0): string | null {
  const sorted = periods
    .filter((p) => Number.isFinite(p.afterMinutes) && Number.isFinite(p.minutes) && p.minutes > 0)
    .sort((a, b) => a.afterMinutes - b.afterMinutes);
  if (sorted.length === 0) return null;
  const parts: string[] = [];
  let cursor = Math.max(0, anchorOffsetMinutes);
  for (const p of sorted) {
    const start = Math.max(p.afterMinutes, cursor);
    if (start > cursor + 1e-9) parts.push(`0:${fmtHours(start - cursor)}`);
    const end = p.afterMinutes + p.minutes;
    const len = end - start;
    if (len <= 0) continue;
    parts.push(`${fmtHours(Math.max(0, p.workMinutes))}:${fmtHours(len)}`);
    cursor = end;
  }
  return parts.length > 0 ? parts.join(';') : null;
}

function fmtHours(minutes: number): string {
  const h = Math.round((minutes / 60) * 100) / 100;
  return String(h);
}

// ── MSPDI-duurnotatie ────────────────────────────────────────────────────────────────────────────

/** `PT{H}H{M}M{S}S` → minuten (MSPDI `<Value>` van een TimephasedData-item); `null` bij een
 *  vorm zonder tijdcomponent. */
export function mspdiValueToMinutes(value: string): number | null {
  if (!value) return null;
  const m = value.match(/^P(?:(\d+)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) return null;
  const days = parseFloat(m[1] || '0');
  const hours = parseFloat(m[2] || '0');
  const mins = parseFloat(m[3] || '0');
  const secs = parseFloat(m[4] || '0');
  return days * 24 * 60 + hours * 60 + mins + secs / 60;
}

/** Minuten → `PT{H}H{M}M{S}S` (hele seconden). */
export function minutesToMspdiValue(minutes: number): string {
  const totalSeconds = Math.max(0, Math.round(minutes * 60));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `PT${h}H${m}M${s}S`;
}
