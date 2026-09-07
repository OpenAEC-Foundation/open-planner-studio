import type { Task } from '@/types/task';
import {
  type ReportContext, assignedResourceNames, dayOf, isNearCritical, activityTasks, overlapsWindow,
  progressState, referenceDay, remainingDays, taskFinish, taskStart, windowEnd,
} from './reportCommon';

/**
 * Look-ahead-rapport (discussie #31, rapport 2): de activiteiten van de komende N weken vanaf de
 * statusdatum — het lijstje voor de weekvergadering op de bouw.
 *
 * Opgenomen worden de niet-voltooide bladtaken die het venster raken (interval-overlap, dus óók een
 * taak die het hele venster overspant — precies het gat dat discussie #32 aankaartte) PLUS de
 * achterstallige taken van vóór het venster: wie het venster inplant moet weten wat er nog open
 * staat. Status per rij:
 * - `overdue`     — niet voltooid en de (berekende) finish ligt vóór de referentiedag;
 * - `lateStart`   — nog niet gestart terwijl de start vóór de referentiedag lag;
 * - `inProgress`  — gestart, nog niet voltooid;
 * - `starting`    — nog niet gestart, start binnen het venster.
 *
 * ANDERS DAN HET VOORSTEL: geen aparte "voorganger/constraint"-kolom (te breed voor een
 * weeklijst; de constraintdatum staat wel in de rij-data), wél de toegewezen resources — op de
 * bouw is "wie" belangrijker dan "waarom". Kritiek en near-critical zijn vlaggen, geen aparte
 * statussen: een taak is tegelijk in uitvoering én kritiek.
 */
export type LookAheadStatus = 'overdue' | 'lateStart' | 'inProgress' | 'starting';

export interface LookAheadRow {
  taskId: string;
  wbs: string;
  name: string;
  start: string;
  finish: string;
  remainingDays: number;
  completion: number;
  totalFloat: number;
  isCritical: boolean;
  isNearCritical: boolean;
  isMilestone: boolean;
  constraintDate?: string;
  resources: string[];
  status: LookAheadStatus;
}

export interface LookAheadOptions {
  /** Vensterlengte in weken (kalenderweken vanaf de referentiedag). */
  weeks: number;
  /** Drempel voor near-critical (werkdagen); 0 = alleen de planningsoptie. */
  nearCriticalDays: number;
}

export interface LookAheadResult {
  from: string;
  to: string;
  statusDateMissing: boolean;
  rows: LookAheadRow[];
  counts: { total: number; overdue: number; lateStart: number; inProgress: number; starting: number; critical: number };
}

function statusOf(t: Task, refDay: string): LookAheadStatus | null {
  const state = progressState(t);
  if (state === 'complete') return null;
  if (dayOf(taskFinish(t)) < refDay) return 'overdue';
  if (state === 'inProgress') return 'inProgress';
  if (dayOf(taskStart(t)) < refDay) return 'lateStart';
  return 'starting';
}

export function computeLookAhead(ctx: ReportContext, opts: LookAheadOptions): LookAheadResult {
  const { day: from, statusDateMissing } = referenceDay(ctx);
  const to = windowEnd(from, Math.max(1, Math.round(opts.weeks)) * 7);
  const rows: LookAheadRow[] = [];
  for (const t of activityTasks(ctx.tasks)) {
    const status = statusOf(t, from);
    if (!status) continue;
    if (status !== 'overdue' && !overlapsWindow(t, from, to) && !(status === 'lateStart')) continue;
    rows.push({
      taskId: t.id,
      wbs: t.wbsCode,
      name: t.name,
      start: taskStart(t),
      finish: taskFinish(t),
      remainingDays: remainingDays(ctx, t),
      completion: t.time.completion,
      totalFloat: t.time.totalFloat,
      isCritical: t.time.isCritical,
      isNearCritical: isNearCritical(t, opts.nearCriticalDays),
      isMilestone: t.isMilestone,
      constraintDate: t.constraint?.date,
      resources: assignedResourceNames(ctx, t.id),
      status,
    });
  }
  rows.sort((a, b) => a.start.localeCompare(b.start) || a.finish.localeCompare(b.finish) || a.wbs.localeCompare(b.wbs));
  const count = (s: LookAheadStatus) => rows.filter(r => r.status === s).length;
  return {
    from, to, statusDateMissing, rows,
    counts: {
      total: rows.length,
      overdue: count('overdue'),
      lateStart: count('lateStart'),
      inProgress: count('inProgress'),
      starting: count('starting'),
      critical: rows.filter(r => r.isCritical).length,
    },
  };
}
