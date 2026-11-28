export type FidelityVerdict = 'exact' | 'sameday' | 'diff' | 'missing';
export type FidelityComparator = (ours: string | undefined, truth: string | null) => FidelityVerdict;

const dayOf = (value: string): string => value.slice(0, 10);

export function classify(ours: string | undefined, truth: string | null): FidelityVerdict {
  if (!truth || !ours) return 'missing';
  if (ours.length >= 16 && ours.slice(0, 16) === truth.slice(0, 16)) return 'exact';
  if (ours.length === 10 && truth.slice(11, 16) === '00:00' && ours === dayOf(truth)) return 'exact';
  if (dayOf(ours) === dayOf(truth)) return 'sameday';
  return 'diff';
}

export function classifyExact(ours: string | undefined, truth: string | null): FidelityVerdict {
  if (truth === null || ours === undefined) return 'missing';
  return ours === truth ? 'exact' : 'diff';
}

export const FLOAT_EXACT_TOLERANCE_MIN = 0.001;

export function classifyFloatMinutes(ours: string | undefined, truth: string | null): FidelityVerdict {
  if (truth === null || ours === undefined) return 'missing';
  if (ours === truth) return 'exact';
  const a = ours.trim() === '' ? NaN : Number(ours);
  const b = truth.trim() === '' ? NaN : Number(truth);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'diff';
  return Math.round(Math.abs(a - b) / FLOAT_EXACT_TOLERANCE_MIN) === 0 ? 'exact' : 'diff';
}

const CANONICAL_MINUTE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function isCanonicalMinute(value: string): boolean {
  const match = CANONICAL_MINUTE.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 16) === value;
}

export function classifyMinuteExact(
  ours: string | undefined,
  truth: string | null,
): FidelityVerdict {
  if (truth === null || ours === undefined) return 'missing';
  if (!isCanonicalMinute(ours) || !isCanonicalMinute(truth)) return 'diff';
  if (ours === truth) return 'exact';
  return dayOf(ours) === dayOf(truth) ? 'sameday' : 'diff';
}

export interface FidelityValuePair {
  ours: string | undefined;
  truth: string | null;
}

export interface FidelityDelta extends FidelityValuePair {
  verdict: FidelityVerdict;
}

export interface FidelityComparisonRow<Axis extends string> {
  identity: string;
  axes: Record<Axis, FidelityDelta>;
}

export function compareFidelityRow<Axis extends string>(
  identity: string,
  values: Record<Axis, FidelityValuePair>,
  comparators: Partial<Record<Axis, FidelityComparator>> = {},
): FidelityComparisonRow<Axis> {
  const axes = {} as Record<Axis, FidelityDelta>;
  for (const axis of Object.keys(values) as Axis[]) {
    const pair = values[axis];
    axes[axis] = { ...pair, verdict: (comparators[axis] ?? classify)(pair.ours, pair.truth) };
  }
  return { identity, axes };
}

export interface FidelityCounts {
  exact: number;
  sameday: number;
  diff: number;
  missing: number;
  measurable: number;
  deviations: number;
}

export function emptyFidelityCounts(): FidelityCounts {
  return { exact: 0, sameday: 0, diff: 0, missing: 0, measurable: 0, deviations: 0 };
}

export function addFidelityCounts(target: FidelityCounts, source: FidelityCounts): void {
  target.exact += source.exact;
  target.sameday += source.sameday;
  target.diff += source.diff;
  target.missing += source.missing;
  target.measurable += source.measurable;
  target.deviations += source.deviations;
}

export function countFidelityAxis<Axis extends string>(
  rows: readonly FidelityComparisonRow<Axis>[],
  axis: Axis,
): FidelityCounts {
  const counts = emptyFidelityCounts();
  for (const row of rows) {
    const delta = row.axes[axis];
    counts[delta.verdict]++;
    if (delta.truth !== null) {
      counts.measurable++;
      if (delta.verdict !== 'exact') counts.deviations++;
    }
  }
  return counts;
}
