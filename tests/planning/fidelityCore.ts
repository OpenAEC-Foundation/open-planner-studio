/**
 * Formaat-agnostische fidelitykern voor de onafhankelijke bestandsmeetlatten.
 *
 * Deze module weet niets van MPP, XER, parsers of de solver. Een formaatspecifieke laag levert
 * alleen een identiteit plus per as de eigen en orakelwaarde. De kern maakt daar één stabiele
 * rijvorm en onafhankelijke delta-administratie van. Zo delen MPP en XER wel de meetregels, maar
 * nooit hun grondwaarheidparser.
 */

export type FidelityVerdict = 'exact' | 'sameday' | 'diff' | 'missing';
export type FidelityComparator = (ours: string | undefined, truth: string | null) => FidelityVerdict;

const dayOf = (value: string): string => value.slice(0, 10);

/** Vergelijk twee ISO-instantstrings; date-only invoer blijft compatibel met de MPP-meetlat. */
export function classify(ours: string | undefined, truth: string | null): FidelityVerdict {
  if (!truth || !ours) return 'missing';
  if (ours.length >= 16 && ours.slice(0, 16) === truth.slice(0, 16)) return 'exact';
  if (ours.length === 10 && truth.slice(11, 16) === '00:00' && ours === dayOf(truth)) return 'exact';
  if (dayOf(ours) === dayOf(truth)) return 'sameday';
  return 'diff';
}

/** Strikte vergelijking voor scalairen zoals floatminuten en vlaggen. */
export function classifyExact(ours: string | undefined, truth: string | null): FidelityVerdict {
  if (truth === null || ours === undefined) return 'missing';
  return ours === truth ? 'exact' : 'diff';
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

/** Maak één rij; de literal-asvorm blijft behouden in het resultaattype. */
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
  /** Aantal aanwezige orakelcellen, onafhankelijk van wat de lezer oplevert. */
  measurable: number;
  /** Elk meetbaar veld dat niet exact is, inclusief een ontbrekende eigen waarde. */
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

/** Tel één as; meetbaarheid volgt uitsluitend het orakel en kan dus niet stil door de lezer dalen. */
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
