import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { assignmentLoadOnPlacement, taskLoadPlacement } from '@/engine/scheduler/ResourceLoad';
import { assignmentPlacementLoad, type PlacementDay, type PlacementOptions } from '@/engine/scheduler/workPlacement';
import type { ResourceAssignment } from '@/types/resource';
import type { Task, TaskTimephasedContour, TimephasedContourPeriod } from '@/types/task';

export interface ContourDayModel {
  days: PlacementDay[];
  isos: string[];
  shares: number[];
  actualMinutes: number[];
  remainingRates: number[];
  mpd: number;
}

const SHARE_EPS = 1e-9;

function withPeriods(contour: TaskTimephasedContour, kind: TimephasedContourPeriod['kind']): TaskTimephasedContour | null {
  const periods = contour.periods.filter(p => (kind === 'actual' ? p.kind === 'actual' : p.kind !== 'actual'));
  return periods.length > 0 ? { ...contour, periods } : null;
}

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
    remainingRates: remainingLoad.map((u, i) => (shares[i] > SHARE_EPS ? Number((u / shares[i]).toPrecision(12)) : 0)),
    mpd,
  };
}

export function remainingMinutesOfRates(rates: readonly number[], shares: readonly number[], mpd: number): number {
  let sum = 0;
  for (let i = 0; i < rates.length; i++) {
    const rate = rates[i];
    if (Number.isFinite(rate) && rate > 0) sum += rate * (shares[i] ?? 0) * mpd;
  }
  return sum;
}

export function ratesFromShapeWork(work: readonly number[], shares: readonly number[], totalMinutes: number, mpd: number): number[] {
  const weighted = remainingMinutesOfRates(work.map(w => w / mpd), shares, mpd);
  if (!(weighted > 0)) return work.map(() => 0);
  const scale = totalMinutes / weighted;
  return work.map(w => (Number.isFinite(w) && w > 0 ? (w / mpd) * scale : 0));
}

export function contourPeriodsFromRates(
  existing: readonly TimephasedContourPeriod[] | undefined,
  rates: readonly number[],
  days: readonly PlacementDay[],
  mpd: number,
): TimephasedContourPeriod[] {
  const actual = (existing ?? []).filter(p => p.kind === 'actual');
  const remaining: TimephasedContourPeriod[] = [];
  let lastRate = 0;
  days.forEach((d, i) => {
    const rate = Number.isFinite(rates[i]) && rates[i] > 0 ? rates[i] : 0;
    const residue = d.residueMinutes ?? 0;
    const residueRate = d.share > 0 ? rate : lastRate;
    let open: { afterMinutes: number; minutes: number; share: number; residue: number } | null = null;
    const close = () => {
      if (open) {
        const work = rate * open.share * mpd;
        remaining.push({
          afterMinutes: open.afterMinutes, minutes: open.minutes,
          workMinutes: open.residue > 0 ? work + residueRate * open.residue : work, kind: 'remaining',
        });
      }
      open = null;
    };
    for (const r of d.ranges) {
      if (!(r.axisMinutes > 0)) continue;
      if (open && Math.abs(open.afterMinutes + open.minutes - r.afterMinutes) < 1e-9) {
        open.minutes += r.axisMinutes;
        open.share += r.share;
      } else {
        close();
        open = { afterMinutes: r.afterMinutes, minutes: r.axisMinutes, share: r.share, residue: 0 };
      }
    }
    if (residue > 0 && residueRate > 0) {
      const from = Math.max(...d.ranges.map(r => r.afterMinutes + r.axisMinutes));
      if (open && Math.abs(open.afterMinutes + open.minutes - from) < 1e-9) {
        open.minutes += residue;
        open.residue = residue;
      } else {
        close();
        open = { afterMinutes: from, minutes: residue, share: 0, residue };
      }
    }
    close();
    if (d.share > 0) lastRate = rate;
  });
  return [...actual, ...remaining];
}
