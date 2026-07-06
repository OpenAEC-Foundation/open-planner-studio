import type { Task } from '@/types/task';

/**
 * Gedeelde duur-resolutie-helpers (fase 2.8b, ontwerpdoc §3.1).
 *
 * PLAATSING: het ontwerpdoc beschrijft deze helpers onder §3.1 ("src/types/task.ts") maar hun
 * tweede argument is de effectieve KALENDER-ENGINE (`isHourMode`/`hoursPerDay`), die in
 * `src/engine/scheduler` leeft. Ze in `src/types` zetten zou een types→engine-afhankelijkheid
 * introduceren; de golf-0-tabel (§10, rij G0) noemt bovendien geen helper-bestand. Daarom leven
 * ze hier, naast `CalendarEngine`/`CPMSolver` — de enige aanroepers (golf 1/2), conform de
 * expliciete fallback in de golf-0-opdracht.
 *
 * FORWARD-COMPAT: het argument is getypeerd als het minimale structurele contract
 * `DurationCalendar` ({ isHourMode, hoursPerDay }). Golf 1 laat `CalendarEngine` dit contract
 * vervullen (het krijgt daar `isHourMode`); tot die tijd is de helper testbaar met een plain
 * object, en roept nog niemand hem aan (geen gedragswijziging in golf 0).
 */

/** Minimaal contract dat een uur-bewuste kalender-engine vervult (golf 1). */
export interface DurationCalendar {
  /** True ⇒ uur-kalender (`WorkCalendar.workTime` aanwezig); false ⇒ dag-kalender. */
  readonly isHourMode: boolean;
  /** Netto werkuren per dag; de dag↔minuut-factor is `hoursPerDay × 60`. */
  readonly hoursPerDay: number;
}

/**
 * Duur van een taak in integer MINUTEN, in de effectieve kalender.
 *
 * - Uur-kalender: `durationMinutes` is bron van waarheid indien aanwezig; anders (naakt getal =
 *   werkdagen, Bevinding 10) afgeleid als `scheduleDuration × hoursPerDay × 60`.
 * - Dag-kalender: er bestaat geen sub-dag-duur; de synthetische dag = `hoursPerDay × 60` min
 *   (§2.3, voor gemengde projecten), dus `scheduleDuration × hoursPerDay × 60`.
 */
export function durationMinutesOf(task: Task, effCal: DurationCalendar): number {
  if (effCal.isHourMode) {
    const dm = task.time.durationMinutes;
    if (dm != null) return dm;
  }
  return task.time.scheduleDuration * effCal.hoursPerDay * 60;
}

/**
 * Duur van een taak in eigen-kalender-WERKDAGEN (mogelijk fractioneel in uur-modus).
 *
 * INVARIANT (Bevinding 2, §3.1): `durationMinutes` wordt UITSLUITEND op een uur-kalender
 * gehonoreerd. Op een dag-kalender — of op een uur-kalender zónder `durationMinutes` — valt de
 * helper ALTIJD terug op `scheduleDuration`; er belandt dus nooit een fractionele dag
 * (`durationMinutes / (hpd×60)`) in de integer-dag-lus `addWorkDays`.
 */
export function durationDaysOf(task: Task, effCal: DurationCalendar): number {
  if (effCal.isHourMode && task.time.durationMinutes != null) {
    return task.time.durationMinutes / (effCal.hoursPerDay * 60);
  }
  return task.time.scheduleDuration;
}
