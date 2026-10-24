import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseInstant } from '@/utils/dateUtils';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskDurationUnit } from '@/types/task';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { shownStart } from '@/utils/taskDates';

export interface ParsedTaskDuration {
  unit: TaskDurationUnit;
  scheduleDuration?: number;
  durationMinutes?: number;
  explicitUnit: boolean;
}

/**
 * Waar een getypte duur over gaat (spec "alleen uren" §3.12, besluit B8). Alles is optioneel: zonder
 * context leest de parser zoals in het OPS-profiel, met een kaal getal in de maat van de taak.
 */
export interface DurationInputContext {
  /** Telt het rekenprofiel een dagenmaat in werkdagen (conventie `workdayDurationMeasure`)? Aan (de
   *  standaard, OPS-profiel) ⇒ "5d" is de dagenmaat. Uit (P6, MS Project) ⇒ "5d" is de urenmaat: 5 × de
   *  werktijd per dag. */
  dayMeasure?: boolean;
  /** De werktijd per dag van de taakkalender in uren (`effHoursPerDay`). Nodig om een dag als uren te
   *  lezen (onder P6/MSP, of een kaal getal in een andere eenheid dan de maat van de taak). */
  hoursPerDay?: number;
  /** De eenheid die tabel of veld bij deze taak toont. Een kaal getal staat in die eenheid en houdt de
   *  maat van de taak. Standaard de maat van de taak. */
  shownUnit?: TaskDurationUnit;
}

/** Grootste duur die de invoer aanneemt: zo blijft het aantal minuten een veilig geheel getal. */
const MAX_SAFE_MINUTES = Number.MAX_SAFE_INTEGER;

/** Een getypt getal: cijfers met een optionele decimaal, als punt of als komma ("2.5", "2,5"). */
const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;

function toNumber(text: string): number {
  return Number(text.replace(',', '.'));
}

/** Een aantal werkdagen als invoer: eindig, niet negatief en niet onveilig groot. Zes decimalen, zoals
 *  de opslag in IFC (`ifcDayNumber`); zo blijft "2,5" precies 2,5 en wordt "1/3" geen lange staart. */
function dayAmount(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 24 * 60))) return null;
  return Number(value.toFixed(6));
}

function minutesOf(value: number): number | null {
  const minutes = Math.round(value);
  return Number.isSafeInteger(minutes) && minutes >= 0 && minutes <= MAX_SAFE_MINUTES ? minutes : null;
}

function validHoursPerDay(hoursPerDay: number | undefined): hoursPerDay is number {
  return hoursPerDay !== undefined && Number.isFinite(hoursPerDay) && hoursPerDay > 0;
}

/** Een aantal dagen in de urenmaat: dagen × werktijd per dag (B8 onder P6/MSP, B1a). */
function daysAsHours(days: number, hoursPerDay: number, explicitUnit: boolean): ParsedTaskDuration | null {
  const durationMinutes = minutesOf(days * hoursPerDay * 60);
  return durationMinutes === null ? null : { unit: 'hours', durationMinutes, explicitUnit };
}

/**
 * Eén taakduur-parser voor dialoog, eigenschappenpaneel en de Duur-kolom van het raster (B8, §3.12):
 *  - "5d" (ook "5 days"): de dagenmaat; onder een profiel zonder dagenmaat (P6, MSP) de urenmaat,
 *    5 × de werktijd per dag. Vast werk zet de store daarna om naar uren (B1a,
 *    `routeFixedWorkDurationToHours`).
 *  - "40u", "40h", "1,5u", "2h 30m": de urenmaat.
 *  - Een kaal getal ("3", "2,5") houdt de maat van de taak, in de eenheid die het veld toont
 *    (`shownUnit`).
 * Breuken zijn voor iedereen te typen, met een punt of een komma (B2). `null` bij onleesbare invoer.
 */
export function parseTaskDurationInput(
  input: string,
  selectedUnit: TaskDurationUnit,
  context: DurationInputContext = {},
): ParsedTaskDuration | null {
  const value = input.trim().toLowerCase();
  const dayMeasure = context.dayMeasure !== false;
  const days = value.match(new RegExp(String.raw`^${NUMBER}\s*(?:d|day|days)$`));
  if (days) {
    const amount = dayAmount(toNumber(days[1]));
    if (amount === null) return null;
    if (!dayMeasure && validHoursPerDay(context.hoursPerDay)) return daysAsHours(amount, context.hoursPerDay, true);
    return { unit: 'days', scheduleDuration: amount, explicitUnit: true };
  }
  const hours = value.match(new RegExp(String.raw`^${NUMBER}\s*(?:h|u|hour|hours)(?:\s*(\d+)\s*m)?$`));
  if (hours) {
    const hourAmount = toNumber(hours[1]);
    const minuteAmount = Number(hours[2] ?? '0');
    if (!Number.isFinite(hourAmount) || !Number.isSafeInteger(minuteAmount)) return null;
    const durationMinutes = minutesOf(Math.round(hourAmount * 60) + minuteAmount);
    return durationMinutes === null ? null : { unit: 'hours', durationMinutes, explicitUnit: true };
  }
  const numeric = value.match(new RegExp(String.raw`^${NUMBER}$`));
  if (!numeric) return null;
  const amount = toNumber(numeric[1]);
  if (!Number.isFinite(amount)) return null;
  const shown = context.shownUnit ?? selectedUnit;
  if (shown === selectedUnit || !validHoursPerDay(context.hoursPerDay)) {
    if (shown === 'hours') {
      const durationMinutes = minutesOf(amount * 60);
      return durationMinutes === null ? null : { unit: 'hours', durationMinutes, explicitUnit: false };
    }
    const scheduleDuration = dayAmount(amount);
    return scheduleDuration === null ? null : { unit: 'days', scheduleDuration, explicitUnit: false };
  }
  // Het veld toont een andere eenheid dan de maat van de taak (Duurweergave onder P6/MSP): het getal
  // staat in die eenheid, de taak houdt haar maat.
  if (shown === 'days') {
    const shownDays = dayAmount(amount);
    return shownDays === null ? null : daysAsHours(shownDays, context.hoursPerDay, false);
  }
  const scheduleDuration = dayAmount(amount / context.hoursPerDay);
  return scheduleDuration === null ? null : { unit: 'days', scheduleDuration, explicitUnit: false };
}

/**
 * De bewerkbare duur van een taak als kaal getal, in de eenheid die het veld toont (`shownUnit`,
 * standaard de maat van de taak): "2.5" voor 2,5 d, "12.083333" voor 12 u 5 min. Met een punt; de
 * parser leest punt en komma. `hoursPerDay` is nodig als het veld een andere eenheid toont dan de maat.
 */
export function formatTaskDurationInput(
  task: Task,
  opts: { shownUnit?: TaskDurationUnit; hoursPerDay?: number } = {},
): string {
  const own = task.time.durationUnit === 'hours' ? 'hours' : 'days';
  const shown = validHoursPerDay(opts.hoursPerDay) ? opts.shownUnit ?? own : own;
  const days = own === 'days' ? task.time.scheduleDuration : (task.time.durationMinutes ?? 0) / (60 * (opts.hoursPerDay ?? 1));
  const hours = own === 'hours' ? (task.time.durationMinutes ?? 0) / 60 : task.time.scheduleDuration * (opts.hoursPerDay ?? 0);
  return trimDecimals(shown === 'days' ? days : hours);
}

function trimDecimals(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(6).replace(/(?:\.0+|(\.\d*?)0+)$/, '$1');
}

/** Het startmoment waarvandaan een eenheidswissel meet: de getoonde start, op het eerstvolgende
 *  werkmoment. Een datum zonder tijd telt als het begin van die dag (D1). */
function conversionStart(task: Task, engine: CalendarEngine): Date {
  return engine.nextWorkInstant(parseInstant(shownStart(task)));
}

/**
 * Een bewuste eenheidswissel die het eindmoment houdt (§3.2, B1: een dagenmaat-taak mag een breuk
 * hebben). Vanaf de getoonde start van de taak, op haar eigen kalender met werkblokken
 * (`calendarForEngine`, zoals de motor):
 *  - dagen ⇒ uren: de werkminuten tussen de start en het einde van de dagenmaat (`addMeasuredWorkdays`).
 *    Op de voorbeeldweek (ma–do 8 u, vr 6 u) wordt 5 d vanaf ma 07:00 dus 38 u, niet 40 u;
 *  - uren ⇒ dagen: de werkdagen met hun deel tussen de start en het einde van de urenmaat
 *    (`measuredWorkdaysBetween`). 12 u vanaf ma 07:00 op 8 u per dag wordt 1,5 d.
 * `null` als de kalender geen werkblokken heeft of de taak geen leesbare start heeft.
 */
export function proposeTaskDurationConversion(
  task: Task,
  target: TaskDurationUnit,
  calendar: WorkCalendar,
): ParsedTaskDuration | null {
  if (target === task.time.durationUnit) return null;
  // Elke kalender heeft werkblokken (§3.2, B2): een dagkalender krijgt ze uit begin, einde en uren per
  // dag, zoals de motor (`calendarForEngine`). Zonder af te leiden werkblokken is er geen voorstel.
  const engine = new CalendarEngine(calendarForEngine(calendar));
  if (!engine.isHourMode) return null;
  const start = conversionStart(task, engine);
  if (Number.isNaN(start.getTime())) return null;

  if (target === 'hours') {
    const days = task.time.scheduleDuration;
    if (!Number.isFinite(days) || days < 0) return null;
    if (days === 0) return { unit: 'hours', durationMinutes: 0, explicitUnit: true };
    const end = engine.addMeasuredWorkdaysChecked(start, days);
    if (end.capped) return null;
    return { unit: 'hours', durationMinutes: Math.round(engine.workMinutesBetween(start, end.date)), explicitUnit: true };
  }

  const wanted = task.time.durationMinutes ?? 0;
  if (!Number.isFinite(wanted) || wanted < 0) return null;
  if (wanted === 0) return { unit: 'days', scheduleDuration: 0, explicitUnit: true };
  const end = engine.addWorkMinutes(start, wanted);
  const days = engine.measuredWorkdaysBetween(start, end);
  if (!Number.isFinite(days) || days <= 0) return null;
  return { unit: 'days', scheduleDuration: Number(days.toFixed(6)), explicitUnit: true };
}

/**
 * Eén ingang voor een bewuste eenheidswissel, gedeeld door eigenschappenpaneel, taakdialoog en
 * taakraster: de gekozen eenheid wordt meteen toegepast (geen voorstel om doorheen te klikken).
 * De omzetting houdt het eindmoment ({@link proposeTaskDurationConversion}); sinds de dagenmaat een
 * breuk mag hebben (B1) is ze altijd exact. `null` alleen als de kalender of de start niet te lezen is;
 * dan blijft de eenheid. De regel landt alléén hier, zodat de drie routes vanzelf gelijk blijven.
 */
export function convertTaskDurationUnit(
  task: Task,
  target: TaskDurationUnit,
  calendar: WorkCalendar,
): ParsedTaskDuration | null {
  return proposeTaskDurationConversion(task, target, calendar);
}
