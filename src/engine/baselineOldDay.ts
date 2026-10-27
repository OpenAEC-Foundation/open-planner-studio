/**
 * Herkent een baseline van een urentaak die nog met de OUDE dagtelling is opgeslagen.
 *
 * Achtergrond: sinds eigenaarsbesluit 2026-10-15, optie 2 (zie de docstring van
 * `hourTaskScheduleDuration`) is het dagengetal van een urentaak werkminuten ÷ de werktijd per dag van de
 * taakkalender. Daarvóór deelde de app door de opgeslagen `hoursPerDay`. Een baseline bewaart het dagengetal
 * van dat moment (`BaselineTask.duration`), dus een oude baseline van een taak van 1870 u op een kalender
 * met 8 u/dag en blokken van 10 u zegt 233,75 d, terwijl de taak nu 187 d is: een nep-afwijking van
 * −46,75 d. Besluit van de eigenaar (2026-10-15): oude baselines worden niet omgerekend; de tabel toont in
 * dit specifieke geval een klein ⚠ met uitleg.
 *
 * Bewust zuinig: het ⚠ komt alleen als ALLES geldt:
 *  1. de taak is een urentaak;
 *  2. de opgeslagen `hoursPerDay` van de taakkalender wijkt meer dan één minuut per dag af van de werktijd
 *     per dag (`effHoursPerDay`) — anders zijn oude en nieuwe telling gelijk;
 *  3. de baselineduur past bij de oude telling en niet bij de nieuwe. "Past" = `duur × uren per dag × 60`
 *     ligt binnen één minuut van een maatstaf `M` in werkminuten. Er zijn twee maatstaven, in deze volgorde:
 *     b. EERST de werkminuten tussen baseline-start en baseline-einde op de taakkalender (de urenmotor,
 *        `engineForTaskCalendar`). Dat is een eigen gegeven van de baseline. Past de duur daar bij de
 *        nieuwe telling, dan geen ⚠; past hij bij de oude, dan ⚠. De huidige duur telt dan niet mee, dus een
 *        latere duurwijziging (× 0,8 of × 1,25) verandert het ⚠ niet.
 *     a. ALLEEN als de span bij geen van beide past (een gestarte taak, waarvan de span van werkelijk begin
 *        tot einde loopt; een onderbreking; geen datums): de huidige werkminuten van de taak
 *        (`durationMinutes`). ⚠ als de duur daar bij de oude telling past en niet bij de nieuwe.
 * Past de duur nergens (een onderbreking én een gewijzigde duur, een gewijzigde kalender), dan geen ⚠.
 *
 * Bekende grens (review #363): bij een gestarte taak past de span vaak nergens, dus beslist a, en a kent
 * de duur van het moment van de baseline niet. Daardoor:
 *  - een NIEUWE baseline, daarna de duur × opgeslagen ÷ werktijd (10 u → 8 u): vals ⚠. Ook de export volgt
 *    dat: `mspdiWriter.ts` schrijft de baseline dan in de opgeslagen uren per dag (187 d ⇒ `PT1496H0M0S`
 *    in plaats van `PT1870H0M0S`), zodat de echte afwijking in MS Project verdwijnt;
 *  - een OUDE baseline, daarna de duur × werktijd ÷ opgeslagen (× 1,25): geen ⚠.
 * Met deze twee maatstaven is dat niet te scheiden. Alleen een kenmerk in de baseline zelf (dat via IFC heen
 * en terug gaat) lost het op; dat is later werk.
 */
import type { Task } from '@/types/task';
import type { BaselineTask } from '@/types/baseline';
import type { WorkCalendar } from '@/types/calendar';
import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { engineForTaskCalendar } from '@/engine/scheduler/CPMSolver';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { effHoursPerDay } from '@/utils/taskDuration';
import { parseInstant } from '@/utils/dateUtils';

/** Eén werkminuut: kleiner verschil is afronding, geen andere dagtelling. */
const TOLERANCE_MINUTES = 1;

/** De twee getallen van de taakkalender die de oude en de nieuwe dagtelling bepalen, of `null` als
 *  ze (binnen één minuut per dag) gelijk zijn — dan bestaat er geen oude-telling-baseline. */
function dayLengths(cal: WorkCalendar): { stored: number; effective: number } | null {
  const stored = cal.hoursPerDay;
  const effective = effHoursPerDay(cal);
  if (!(stored > 0) || !(effective > 0)) return null;
  if (Math.abs(stored - effective) * 60 <= TOLERANCE_MINUTES) return null;
  return { stored, effective };
}

/**
 * Is deze baseline van deze urentaak met de oude dagtelling opgeslagen? `cal` is de taakkalender,
 * `engine` de urenmotor van die kalender voor deze taak (`engineForTaskCalendar`).
 */
export function baselineHasOldDayCount(
  task: Task,
  baselineTask: BaselineTask,
  cal: WorkCalendar,
  engine: CalendarEngine,
): boolean {
  if (task.time.durationUnit !== 'hours') return false;
  const lengths = dayLengths(cal);
  if (!lengths) return false;
  if (!Number.isFinite(baselineTask.duration) || baselineTask.duration <= 0) return false;
  const fits = (minutes: number, hoursPerDay: number) =>
    Math.abs(baselineTask.duration * hoursPerDay * 60 - minutes) <= TOLERANCE_MINUTES;
  // b eerst: de baselinespan. Past hij bij een telling, dan beslist hij (bij twijfel: de nieuwe, geen ⚠).
  if (baselineTask.start && baselineTask.finish) {
    const start = parseInstant(baselineTask.start);
    const finish = parseInstant(baselineTask.finish);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(finish.getTime())) {
      const span = engine.workMinutesBetween(start, finish);
      if (span > 0 && fits(span, lengths.effective)) return false;
      if (span > 0 && fits(span, lengths.stored)) return true;
    }
  }
  // a alleen als de span nergens past: de huidige werkminuten van de taak.
  const work = task.time.durationMinutes;
  if (!(typeof work === 'number' && Number.isFinite(work) && work > 0)) return false;
  return fits(work, lengths.stored) && !fits(work, lengths.effective);
}

/**
 * De controle voor een heel document: kiest per taak de taakkalender (eigen kalender, anders de
 * projectkalender) en de urenmotor, met één motorcache. De goedkope voorwaarden (urentaak, afwijkende
 * uren per dag) gaan vóór de motor, zodat een raster met duizenden dagtaken niets extra rekent.
 */
export function createBaselineOldDayCheck(
  projectCalendar: WorkCalendar,
  calendars: readonly WorkCalendar[],
): (task: Task, baselineTask: BaselineTask) => boolean {
  const engines = new Map<string, CalendarEngine>();
  return (task, baselineTask) => {
    if (task.time.durationUnit !== 'hours') return false;
    const cal = resolveCalendar(task.calendarId, calendars as WorkCalendar[], projectCalendar);
    if (!dayLengths(cal)) return false;
    return baselineHasOldDayCount(task, baselineTask, cal, engineForTaskCalendar(engines, cal));
  };
}
