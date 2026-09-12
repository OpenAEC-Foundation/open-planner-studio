import { type ReportContext, isNearCritical, activityTasks, progressState, remainingDays, taskFinish, taskStart } from './reportCommon';

/**
 * Kritiek-en-near-critical-rapport (discussie #31, rapport 3): welke activiteiten bepalen het
 * projecteinde, en welke staan op het punt dat te gaan doen.
 *
 * Bron van de vlaggen is de laatste berekening: `isCritical` en `floatPath` komen rechtstreeks uit
 * de solver (fase 2.9), near-critical is `0 < TF ≤ drempel` (rapportdrempel) óf de markering uit
 * de planningsopties. Voltooide taken doen niet mee — een afgeronde taak stuurt niets meer.
 * Sortering zoals het voorstel: float-pad (1 = meest kritiek; zonder pad achteraan), dan totale
 * speling, dan start.
 */
export interface CriticalRow {
  taskId: string;
  wbs: string;
  name: string;
  start: string;
  finish: string;
  remainingDays: number;
  totalFloat: number;
  freeFloat: number;
  floatPath?: number;
  status: 'critical' | 'nearCritical';
}

export interface CriticalReportOptions {
  /** Near-critical-drempel in werkdagen (0 = alleen de planningsoptie). */
  nearCriticalDays: number;
}

export interface CriticalReportResult {
  rows: CriticalRow[];
  counts: { critical: number; nearCritical: number; leaves: number };
  /** Uit de solver: het aantal kritieke ketens (float-paden). */
  pathCount: number;
  calculated: boolean;
}

export function computeCriticalReport(ctx: ReportContext, opts: CriticalReportOptions): CriticalReportResult {
  const leaves = activityTasks(ctx.tasks);
  const rows: CriticalRow[] = [];
  for (const t of leaves) {
    if (progressState(t) === 'complete') continue;
    const status: CriticalRow['status'] | null = t.time.isCritical
      ? 'critical'
      : isNearCritical(t, opts.nearCriticalDays) ? 'nearCritical' : null;
    if (!status) continue;
    rows.push({
      taskId: t.id,
      wbs: t.wbsCode,
      name: t.name,
      start: taskStart(t),
      finish: taskFinish(t),
      remainingDays: remainingDays(ctx, t),
      totalFloat: t.time.totalFloat,
      freeFloat: t.time.freeFloat,
      floatPath: t.time.floatPath,
      status,
    });
  }
  rows.sort((a, b) =>
    (a.floatPath ?? Number.MAX_SAFE_INTEGER) - (b.floatPath ?? Number.MAX_SAFE_INTEGER)
    || a.totalFloat - b.totalFloat
    || a.start.localeCompare(b.start)
    || a.wbs.localeCompare(b.wbs));
  const cpm = ctx.cpmResult && !ctx.cpmResult.error ? ctx.cpmResult : null;
  return {
    rows,
    counts: {
      critical: rows.filter(r => r.status === 'critical').length,
      nearCritical: rows.filter(r => r.status === 'nearCritical').length,
      leaves: leaves.length,
    },
    pathCount: cpm ? cpm.criticalPaths.length : 0,
    calculated: cpm !== null,
  };
}
