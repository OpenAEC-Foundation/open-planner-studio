/** XER-resourcecurves: rauwe 21-puntsbrondata (RSRCCURVDATA `pct_usage_0..pct_usage_20`), niet-
 *  destructief bewaard. De OPS-curve/`curveValues` van een toewijzing worden pas in
 *  `xerResourceAssignments.ts` afgeleid, via de contour-engine (`normalizeCurveValues`/
 *  `matchCurveValues`) — deze module levert alleen de gevalideerde rauwe punten. */

import type { XerCurvePoints, XerResourceCurveSource, XerResourceIssue } from './xerResourceTypes';
import { normalizeCurveValues } from '@/engine/contour/contourEngine';
import { parseXerNumber, XerImportError, type XerRow, type XerTables } from './xerTables';

const CURVE_FIELDS = Array.from({ length: 21 }, (_, index) => `pct_usage_${index}`);

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
      if (parsed.every((point): point is number => point !== null) && normalizeCurveValues(parsed)) {
        numericPoints = asCurveTuple(parsed);
      }
    } catch {
      // De curvelaag bewaart de tokens en rapporteert één rijgebonden fallback.
    }
    sources.push({ rawRow: row, sourceId, internalId: `xer-curve:${sourceId}`, line: row.line,
      name: row.cells.curv_name?.trim() ?? '', rawPoints,
      ...(numericPoints ? { numericPoints } : {}) });
    if (!numericPoints) {
      issues.push({ code: 'XER_CURVE_INVALID_POINTS', table: 'RSRCCURVDATA', line: row.line,
        sourceId, fallback: 'UNIFORM' });
    }
  }
  return { sources, issues };
}
