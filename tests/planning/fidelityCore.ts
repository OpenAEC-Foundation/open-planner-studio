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

/**
 * Meettolerantie voor de float-assen (tf/ff, in minuten) — EIGENAARSBESLUIT IN AFWACHTING
 * (overdracht rekenprofielen §1d-9). `classifyExact` vergelijkt canonieke strings; daardoor telt
 * drijvende-kommaruis uit uren×60 / dagen×minutesPerDay als afwijking (gemeten 2026-09-23: precies
 * twee cellen in het hele corpus, HarbourPointe 4408/EC1600 tf én ff, ops 396640.00002000004 tegen
 * P6 396640). De grens is bewust GEEN nieuwe keuze maar de bestaande afrondingsgrens van de
 * cel-baseline (`roundMinutes` in `fidelityCells.ts`, 0,001 min): een verschil dat daar op grootte
 * 0 afrondt, is hier `exact`; alles wat een grootte ≥ 0,001 zou krijgen blijft `diff`. Zo kan er
 * geen `diff`-cel met grootte 0 meer bestaan. Uitsluitend voor tf/ff: datum-assen zijn canonieke
 * minuutstrings en kunnen geen sub-minuutrest dragen (gemeten: 0 waarden).
 */
export const FLOAT_EXACT_TOLERANCE_MIN = 0.001;

/** tf/ff: exact bij tekstgelijkheid, of als beide eindige getallen zijn waarvan het verschil op de
 *  0,001-minuutraster (`FLOAT_EXACT_TOLERANCE_MIN`) naar 0 afrondt. */
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

/** XER-minuutvergelijking: exact blijft de enige groene uitkomst; een geldige andere minuut op
 *  dezelfde datum krijgt de diagnostische `sameday`-bak en blijft dus een deviation. */
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
