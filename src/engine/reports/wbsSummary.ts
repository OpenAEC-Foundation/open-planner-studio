import type { Task } from '@/types/task';
import { flattenOrder } from '@/utils/wbs';
import { parseDate } from '@/utils/dateUtils';
import {
  type ReportContext, durationDays, makeEngineCache, progressState, round1, signedWorkDays,
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
 * - voortgang: Σ(duur × completion) / Σ(duur) over de bladnakomelingen;
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
  const engineFor = makeEngineCache(ctx);
  const projectEngine = engineFor({ calendarId: undefined } as unknown as Task);

  // Bladnakomelingen per taak, gememoiseerd en cyclusvast (een corrupte `childIds`-kring mag de
  // stack niet opblazen — `flattenOrder` verdedigt zich daar ook tegen). Iteratief, geen spread:
  // ook 200k bladen onder één verzameltaak blijven binnen de argumentlimiet.
  const leafCache = new Map<string, Task[]>();
  const descendantLeaves = (root: Task): Task[] => {
    const cached = leafCache.get(root.id);
    if (cached) return cached;
    if (root.childIds.length === 0) {
      const own = root.isHammock ? [] : [root];
      leafCache.set(root.id, own);
      return own;
    }
    const out: Task[] = [];
    const seen = new Set<string>([root.id]);
    const stack: Task[] = [root];
    while (stack.length) {
      const t = stack.pop()!;
      for (let i = t.childIds.length - 1; i >= 0; i--) {
        const c = byId.get(t.childIds[i]);
        if (!c || seen.has(c.id)) continue;
        seen.add(c.id);
        if (c.childIds.length === 0) { if (!c.isHammock) out.push(c); } else stack.push(c);
      }
    }
    leafCache.set(root.id, out);
    return out;
  };

  const rows: WbsSummaryRow[] = [];
  let elements = 0;
  let activities = 0;
  for (const t of flattenOrder(ctx.tasks)) {
    const level = depths.get(t.id) ?? 1;
    const isSummary = t.childIds.length > 0;
    if (opts.maxLevel > 0 && level > opts.maxLevel) continue;
    if (!isSummary && !opts.includeActivities) continue;

    const leaves = descendantLeaves(t);
    let weight = 0;
    let done = 0;
    let bStart: string | undefined;
    let bFinish: string | undefined;
    for (const l of leaves) {
      const d = durationDays(ctx, l);
      weight += d;
      done += d * Math.min(1, Math.max(0, l.time.completion));
      const b = baseMap.get(l.id);
      if (b) {
        if (!bStart || b.start < bStart) bStart = b.start;
        if (!bFinish || b.finish > bFinish) bFinish = b.finish;
      }
    }
    const start = taskStart(t);
    const finish = taskFinish(t);
    const completion = weight > 0
      ? done / weight
      : leaves.length > 0 ? leaves.filter(l => progressState(l) === 'complete').length / leaves.length : 0;
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
      completion: round1(completion * 100) / 100,
      finishVarianceDays: bFinish ? signedWorkDays(projectEngine, bFinish, finish) : undefined,
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
