import type { Task } from '@/types/task';
import { flattenOrder } from '@/utils/wbs';
import { parseDate } from '@/utils/dateUtils';
import { signedWorkDaysBetween } from '@/engine/variance';
import { descendantLeaves, isSummaryProgressDerived, summaryProgressOf } from '@/engine/scheduler/summaryProgress';
import {
  type ReportContext, durationDays, makeEngineCache, progressState,
  taskDepths, taskFinish, taskStart,
} from './reportCommon';

/**
 * WBS-/projectsamenvatting (discussie #31, rapport 10): de planning opgerold per WBS-element tot
 * een instelbaar niveau — het managementoverzicht.
 *
 * Aggregatieregels (zoals het voorstel, met de duurgewogen voortgang als enige methode — de
 * alternatieven daar (resource-/kostgewogen) vragen data die dit project niet per taak heeft):
 * - start/einde van een verzameltaak: de rollup uit de laatste berekening (min/max over de
 *   kinderen, `applyCpmResult`), dus identiek aan wat de Gantt toont;
 * - baseline-start/-einde: min/max over de nakomelingen in de actieve baseline;
 * - voortgang: Σ(duur × completion) / Σ(duur) over de bladnakomelingen — de gedeelde helper
 *   `summaryProgressOf` (summaryProgress.ts), dezelfde die `applyCpmResult` op de fase wegschrijft;
 * - minimale speling en de tellingen: over de bladnakomelingen.
 * `level` telt vanaf 1 (hoofdniveau); `maxLevel` 0 = de hele boom. Met `includeActivities`
 * verschijnen de bladtaken zelf ook, onder hun ouder.
 */
export interface WbsSummaryRow {
  taskId: string;
  level: number;
  isSummary: boolean;
  wbs: string;
  name: string;
  start: string;
  finish: string;
  baselineStart?: string;
  baselineFinish?: string;
  durationDays: number;
  completion: number;
  /** Werkdagen, getekend (+ = later dan de baseline). */
  finishVarianceDays?: number;
  minTotalFloat: number;
  isCritical: boolean;
  counts: { total: number; critical: number; inProgress: number; complete: number };
}

export interface WbsSummaryOptions {
  /** 0 = alle niveaus. */
  maxLevel: number;
  includeActivities: boolean;
}

export interface WbsSummaryResult {
  rows: WbsSummaryRow[];
  counts: { elements: number; activities: number };
}

export function computeWbsSummary(ctx: ReportContext, opts: WbsSummaryOptions): WbsSummaryResult {
  const byId = new Map(ctx.tasks.map(t => [t.id, t]));
  const depths = taskDepths(ctx.tasks);
  const baseMap = new Map(ctx.baseline ? ctx.baseline.tasks.map(b => [b.taskId, b]) : []);
  const projectEngine = makeEngineCache(ctx).project;

  // Bladnakomelingen per taak, gememoiseerd en cyclusvast — dezelfde verzameling als de
  // voortgangsrollup van `applyCpmResult` (`descendantLeaves`, summaryProgress.ts).
  const leafCache = new Map<string, Task[]>();
  const workDays = (l: Task) => durationDays(ctx, l);

  const rows: WbsSummaryRow[] = [];
  let elements = 0;
  let activities = 0;
  for (const t of flattenOrder(ctx.tasks)) {
    const level = depths.get(t.id) ?? 1;
    const isSummary = t.childIds.length > 0;
    if (opts.maxLevel > 0 && level > opts.maxLevel) continue;
    if (!isSummary && !opts.includeActivities) continue;

    const leaves = descendantLeaves(t, byId, leafCache);
    let bStart: string | undefined;
    let bFinish: string | undefined;
    for (const l of leaves) {
      const b = baseMap.get(l.id);
      if (b) {
        if (!bStart || b.start < bStart) bStart = b.start;
        if (!bFinish || b.finish > bFinish) bFinish = b.finish;
      }
    }
    const start = taskStart(t);
    const finish = taskFinish(t);
    // Voortgang: dezelfde helper als de verzameltaak-rollup, met dezelfde uitzonderingen — een
    // handmatig geplande fase, of het hele document in "datums zoals opgeslagen", toont de opgeslagen
    // waarde. Zo zegt het rapport altijd hetzelfde getal als Tabel, tooltip, PDF en MCP.
    const completion = isSummary && (!isSummaryProgressDerived(t) || ctx.datesAsRecorded)
      ? Math.round(Math.min(1, Math.max(0, t.time.completion)) * 1000) / 1000
      : summaryProgressOf(leaves, workDays).completion;
    if (isSummary) elements++; else activities++;
    rows.push({
      taskId: t.id,
      level,
      isSummary,
      wbs: t.wbsCode,
      name: t.name,
      start,
      finish,
      baselineStart: bStart,
      baselineFinish: bFinish,
      durationDays: isSummary
        ? Math.max(0, projectEngine.workDaysBetween(parseDate(start), parseDate(finish)))
        : durationDays(ctx, t),
      completion,
      finishVarianceDays: bFinish ? signedWorkDaysBetween(projectEngine, bFinish, finish) : undefined,
      minTotalFloat: leaves.length ? leaves.reduce((m, l) => Math.min(m, l.time.totalFloat), Infinity) : t.time.totalFloat,
      isCritical: leaves.some(l => l.time.isCritical),
      counts: {
        total: leaves.length,
        critical: leaves.filter(l => l.time.isCritical && progressState(l) !== 'complete').length,
        inProgress: leaves.filter(l => progressState(l) === 'inProgress').length,
        complete: leaves.filter(l => progressState(l) === 'complete').length,
      },
    });
  }
  return { rows, counts: { elements, activities } };
}
