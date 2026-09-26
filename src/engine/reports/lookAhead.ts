import type { Task } from '@/types/task';
import {
  type ReportContext, assignedResourceNamesIndex, isNearCritical, activityTasks, overlapsWindow,
  progressState, remainingDays, resolvePeriodFor, scheduleSlip, taskFinish, taskStart,
} from './reportCommon';
import type { ReportingPeriod } from './reportingPeriod';

/**
 * Look-ahead-rapport: de activiteiten in de rapportageperiode (standaard de komende maand vanaf
 * de statusdatum) — het lijstje voor de weekvergadering
 * op de bouw.
 *
 * Opgenomen worden de niet-voltooide bladtaken die het venster raken (interval-overlap, dus óók een
 * taak die het hele venster overspant) PLUS de
 * achterstallige taken van vóór de referentiedag: wie het venster inplant moet weten wat er nog
 * open staat. Status per rij (altijd t.o.v. de referentiedag, niet t.o.v. het venster):
 * - `overdue`     — niet voltooid en de (berekende) finish ligt vóór de referentiedag;
 * - `lateStart`   — nog niet gestart terwijl de start vóór de referentiedag lag;
 * - `inProgress`  — gestart, nog niet voltooid;
 * - `starting`    — nog niet gestart, start binnen het venster.
 *
 * Bewust geen aparte "voorganger/constraint"-kolom (te breed voor een
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
  /** Rapportageperiode; standaard `nextMonth`. */
  period: ReportingPeriod;
  /** Drempel voor near-critical (werkdagen); 0 = alleen de planningsoptie. */
  nearCriticalDays: number;
}

export interface LookAheadResult {
  from: string;
  to: string;
  statusDateMissing: boolean;
  rows: LookAheadRow[];
  counts: { total: number; overdue: number; lateStart: number; inProgress: number; starting: number; critical: number; nearCritical: number };
}

function statusOf(t: Task, refDay: string): LookAheadStatus | null {
  const state = progressState(t);
  if (state === 'complete') return null;
  const slip = scheduleSlip(t, state, refDay);
  if (slip === 'finish') return 'overdue';
  if (state === 'inProgress') return 'inProgress';
  return slip === 'start' ? 'lateStart' : 'starting';
}

export function computeLookAhead(ctx: ReportContext, opts: LookAheadOptions): LookAheadResult {
  const { from, to, refDay, statusDateMissing } = resolvePeriodFor(ctx, opts.period);
  // Achterstallig en had-moeten-starten werk hoort bij elk venster dat de referentiedag raakt of
  // erná ligt. Een venster dat helemaal in het verleden ligt (aangepast 2020) is een terugblik en
  // sleept de actuele achterstand niet mee — dezelfde regel als de vooruitblik van het voortgangs-
  // rapport.
  const includeBacklog = to >= refDay;
  const rows: LookAheadRow[] = [];
  const resourceNames = assignedResourceNamesIndex(ctx);
  for (const t of activityTasks(ctx.tasks)) {
    const status = statusOf(t, refDay);
    if (!status) continue;
    const backlog = status === 'overdue' || status === 'lateStart';
    if (!overlapsWindow(t, from, to) && !(backlog && includeBacklog)) continue;
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
      resources: resourceNames.get(t.id) ?? [],
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
      nearCritical: rows.filter(r => r.isNearCritical).length,
    },
  };
}
