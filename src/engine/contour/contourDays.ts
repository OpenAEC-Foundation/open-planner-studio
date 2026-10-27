// De dagen van de contourdialoog op de gedeelde plaatsing (spec "alleen uren" §3.11, F4b).
//
// Histogram, nivelleerder en contourdialoog tonen dezelfde werkdagen met hetzelfde deel van de dag:
// `taskLoadPlacement` (de plaatsing van `workPlacement.ts`) en `assignmentLoadOnPlacement` (de
// belasting per dag). De dialoog bewerkt de INZET per werkdag (eenheden), los van het deel van de dag:
// een uniforme toewijzing van 1 is één fase van 1, ook als de taak wo 11:00 begint (wo 0,5 van de dag).
// Het werk van een dag is inzet × deel × werktijd per dag; dat is ook wat het histogram toont.
//
// Opslaan schrijft één periode per werkdag (aaneensluitende stukken van de plaatsing samen; een split
// midden op de dag geeft twee), op de split-as in de maat van de taak, met werk = inzet × deel × werktijd
// per dag. Zo leest de belasting
// (`assignmentPlacementLoad`) na Toepassen precies de dagen en het werk terug die de dialoog toonde.
import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { assignmentLoadOnPlacement, taskLoadPlacement } from '@/engine/scheduler/ResourceLoad';
import { assignmentPlacementLoad, type PlacementDay, type PlacementOptions } from '@/engine/scheduler/workPlacement';
import type { ResourceAssignment } from '@/types/resource';
import type { Task, TaskTimephasedContour, TimephasedContourPeriod } from '@/types/task';

export interface ContourDayModel {
  /** De werkdagen van de plaatsing, in volgorde. */
  days: PlacementDay[];
  isos: string[];
  /** Het deel van een nominale werkdag dat de taak op die dag bezet (`PlacementDay.share`). */
  shares: number[];
  /** Verricht werk per dag, in werkminuten (de `actual`-periodes van de contour). */
  actualMinutes: number[];
  /** Resterende inzet per werkdag, in eenheden: belasting ÷ deel van de dag. */
  remainingRates: number[];
  /** Werkminuten van een nominale werkdag van de taakkalender (`hoursPerDay × 60`). */
  mpd: number;
}

/** Ondergrens voor een deel van een dag; kleiner telt als geen werk op die dag. */
const SHARE_EPS = 1e-9;

function withPeriods(contour: TaskTimephasedContour, kind: TimephasedContourPeriod['kind']): TaskTimephasedContour | null {
  const periods = contour.periods.filter(p => (kind === 'actual' ? p.kind === 'actual' : p.kind !== 'actual'));
  return periods.length > 0 ? { ...contour, periods } : null;
}

/**
 * De dagen, het deel per dag, het verrichte werk en de resterende inzet van één toewijzing, op de
 * plaatsing van het histogram. `contour` lost de aanroeper op zoals het histogram (`contourLookup`
 * over alle toewijzingen van de taak). Zonder contour is de rest de belasting van het histogram (curve,
 * importcurve of opgeslagen werk) en het verrichte werk 0, zoals voorheen.
 */
export function contourDayModel(
  task: Task,
  assignment: ResourceAssignment,
  contour: TaskTimephasedContour | null,
  engine: CalendarEngine,
  options: PlacementOptions,
): ContourDayModel {
  const mpd = engine.hoursPerDay * 60;
  const days = taskLoadPlacement(task, engine, options)?.days ?? [];
  const shares = days.map(d => d.share);
  const loadOf = (c: TaskTimephasedContour | null) => (c ? assignmentPlacementLoad(assignment, days, mpd, c, () => []) : days.map(() => 0));
  const actualLoad = contour ? loadOf(withPeriods(contour, 'actual')) : days.map(() => 0);
  const remainingLoad = contour
    ? loadOf(withPeriods(contour, 'remaining'))
    : assignmentLoadOnPlacement(task, assignment, days, engine, null);
  return {
    days,
    isos: days.map(d => d.iso),
    shares,
    actualMinutes: actualLoad.map(u => u * mpd),
    // Zonder de ruis van de deling (0,9999999999): een uniforme inzet blijft één fase.
    remainingRates: remainingLoad.map((u, i) => (shares[i] > SHARE_EPS ? Number((u / shares[i]).toPrecision(12)) : 0)),
    mpd,
  };
}

/** Het resterende werk in werkminuten: Σ inzet × deel × werktijd per dag. */
export function remainingMinutesOfRates(rates: readonly number[], shares: readonly number[], mpd: number): number {
  let sum = 0;
  for (let i = 0; i < rates.length; i++) {
    const rate = rates[i];
    if (Number.isFinite(rate) && rate > 0) sum += rate * (shares[i] ?? 0) * mpd;
  }
  return sum;
}

/**
 * Een vorm (werk per dag, `shapeSlotWork`) als inzet per werkdag, met `totalMinutes` als totaal werk op
 * deze dagen: de vorm bepaalt de verhouding, het deel van de dag telt mee in het totaal.
 */
export function ratesFromShapeWork(work: readonly number[], shares: readonly number[], totalMinutes: number, mpd: number): number[] {
  const weighted = remainingMinutesOfRates(work.map(w => w / mpd), shares, mpd);
  if (!(weighted > 0)) return work.map(() => 0);
  const scale = totalMinutes / weighted;
  return work.map(w => (Number.isFinite(w) && w > 0 ? (w / mpd) * scale : 0));
}

/**
 * De contourperiodes na Toepassen: de bestaande `actual`-periodes blijven, de rest wordt één periode per
 * werkdag (aaneensluitende stukken samen), met werk = inzet × deel × werktijd per dag.
 */
export function contourPeriodsFromRates(
  existing: readonly TimephasedContourPeriod[] | undefined,
  rates: readonly number[],
  days: readonly PlacementDay[],
  mpd: number,
): TimephasedContourPeriod[] {
  const actual = (existing ?? []).filter(p => p.kind === 'actual');
  const remaining: TimephasedContourPeriod[] = [];
  days.forEach((d, i) => {
    const rate = Number.isFinite(rates[i]) && rates[i] > 0 ? rates[i] : 0;
    // Aaneensluitende stukken van één dag (twee werkblokken rond de pauze) worden één periode.
    let open: { afterMinutes: number; minutes: number; share: number } | null = null;
    const close = () => {
      if (open) remaining.push({ afterMinutes: open.afterMinutes, minutes: open.minutes, workMinutes: rate * open.share * mpd, kind: 'remaining' });
      open = null;
    };
    for (const r of d.ranges) {
      if (!(r.axisMinutes > 0)) continue;
      if (open && Math.abs(open.afterMinutes + open.minutes - r.afterMinutes) < 1e-9) {
        open.minutes += r.axisMinutes;
        open.share += r.share;
      } else {
        close();
        open = { afterMinutes: r.afterMinutes, minutes: r.axisMinutes, share: r.share };
      }
    }
    close();
  });
  return [...actual, ...remaining];
}
