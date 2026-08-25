/** XER-resourcecurves: rauwe 21-puntsbrondata plus een niet-destructieve OPS-best-fit. */

import type { ResourceCurve } from '@/types/resource';
import type { XerCurvePoints, XerResourceCurveSource, XerResourceIssue } from './xerResourceTypes';
import { parseXerNumber, XerImportError, type XerRow, type XerTables } from './xerTables';

const CURVE_FAMILIES: readonly ResourceCurve[] = [
  'UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK',
];
const CURVE_FIELDS = Array.from({ length: 21 }, (_, index) => `pct_usage_${index}`);

function interpolate(points: readonly (readonly [number, number])[], t: number): number {
  for (let index = 0; index < points.length - 1; index++) {
    const [leftT, leftWeight] = points[index];
    const [rightT, rightWeight] = points[index + 1];
    if (t < leftT || t > rightT) continue;
    const fraction = rightT === leftT ? 0 : (t - leftT) / (rightT - leftT);
    return leftWeight + fraction * (rightWeight - leftWeight);
  }
  return points[points.length - 1][1];
}

function familyProfile(curve: ResourceCurve): number[] {
  const controls: Record<ResourceCurve, readonly (readonly [number, number])[]> = {
    UNIFORM: [[0, 1], [1, 1]],
    FRONT_LOADED: [[0, 1], [1, 0.2]],
    BACK_LOADED: [[0, 0.2], [1, 1]],
    BELL: [[0, 0.2], [0.5, 1], [1, 0.2]],
    EARLY_PEAK: [[0, 0.2], [1 / 3, 1], [1, 0.2]],
    LATE_PEAK: [[0, 0.2], [2 / 3, 1], [1, 0.2]],
  };
  return Array.from({ length: 21 }, (_, index) => interpolate(controls[curve], index / 20));
}

function normalized(points: readonly number[]): number[] | undefined {
  if (points.length !== 21 || points.some(point => !Number.isFinite(point) || point < 0 || point > 100)) return undefined;
  const total = points.reduce((sum, point) => sum + point, 0);
  return total > 0 ? points.map(point => point / total) : undefined;
}

/** Kies de kleinste mean-squared error; normalisatie wijzigt de bewaarde bronpunten niet. */
export function bestFitXerCurve(points: readonly number[]): ResourceCurve | undefined {
  const observed = normalized(points);
  if (!observed) return undefined;
  let best: ResourceCurve | undefined;
  let bestError = Number.POSITIVE_INFINITY;
  for (const family of CURVE_FAMILIES) {
    const candidate = normalized(familyProfile(family));
    if (!candidate) continue;
    const error = observed.reduce((sum, point, index) => {
      const delta = point - candidate[index];
      return sum + delta * delta;
    }, 0) / observed.length;
    if (error < bestError) {
      best = family;
      bestError = error;
    }
  }
  return best;
}

function asCurveTuple<T>(points: readonly T[]): XerCurvePoints<T> {
  return points as XerCurvePoints<T>;
}

function assertUniqueCurveIds(rows: readonly XerRow[]): void {
  const firstLineById = new Map<string, number>();
  for (const row of rows) {
    const sourceId = row.cells.curv_id?.trim() ?? '';
    if (!sourceId) {
      throw new XerImportError('XER_MISSING_REQUIRED_VALUE',
        `RSRCCURVDATA.curv_id bevat een lege bronidentiteit op regel ${row.line}.`,
        { table: 'RSRCCURVDATA', field: 'curv_id', missingValues: ['curv_id'], line: row.line });
    }
    const firstLine = firstLineById.get(sourceId);
    if (firstLine !== undefined) {
      throw new XerImportError('XER_DUPLICATE_ID',
        `RSRCCURVDATA.curv_id bevat dubbele id '${sourceId}' op regels ${firstLine} en ${row.line}.`,
        { table: 'RSRCCURVDATA', field: 'curv_id', line: row.line, lines: [firstLine, row.line] });
    }
    firstLineById.set(sourceId, row.line);
  }
}

export function readXerResourceCurves(tables: XerTables): {
  sources: XerResourceCurveSource[];
  issues: XerResourceIssue[];
} {
  const rows = tables.tables.get('RSRCCURVDATA')?.rows ?? [];
  assertUniqueCurveIds(rows);
  const sources: XerResourceCurveSource[] = [];
  const issues: XerResourceIssue[] = [];
  for (const row of rows) {
    const sourceId = row.cells.curv_id.trim();
    const rawPoints = asCurveTuple(CURVE_FIELDS.map(field => row.cells[field] ?? ''));
    let numericPoints: XerCurvePoints<number> | undefined;
    try {
      const parsed = rawPoints.map(point => parseXerNumber(point, tables.numberFormat));
      if (parsed.every((point): point is number => point !== null)) {
        const candidate = asCurveTuple(parsed);
        if (bestFitXerCurve(candidate) !== undefined) numericPoints = candidate;
      }
    } catch {
      // De curvelaag bewaart de tokens en rapporteert één rijgebonden fallback.
    }
    const bestFit = numericPoints ? bestFitXerCurve(numericPoints) : undefined;
    sources.push({ rawRow: row, sourceId, internalId: `xer-curve:${sourceId}`, line: row.line,
      name: row.cells.curv_name?.trim() ?? '', rawPoints,
      ...(numericPoints ? { numericPoints } : {}), ...(bestFit ? { bestFit } : {}) });
    if (!numericPoints || !bestFit) {
      issues.push({ code: 'XER_CURVE_INVALID_POINTS', table: 'RSRCCURVDATA', line: row.line,
        sourceId, fallback: 'UNIFORM' });
    }
  }
  return { sources, issues };
}
