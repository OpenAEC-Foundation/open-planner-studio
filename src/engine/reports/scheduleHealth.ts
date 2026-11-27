import type { Task, ConstraintType } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { formatLagShort } from '@/utils/lagFormat';
import { originalSequenceId } from '@/engine/scheduler/expandSummaryRelations';
import { resolveEffectiveLagDays } from '@/engine/scheduler/CPMSolver';
import { effHoursPerDay, effectiveCalendarOf } from '@/utils/taskDuration';
import type { WorkCalendar } from '@/types/calendar';
import { type ReportContext, dayOf, durationDays, isNearCritical, progressState } from './reportCommon';
import { buildLogicIndex, isHardConstraint } from './logicIndex';
import {
  type DcmaAssessment, computeDcmaAssessment, invalidDateReasons, isMissedTask, resourceLoadedTaskIds,
} from './dcmaAssessment';

export type HealthCheckId =
  | 'noPredecessor'
  | 'noSuccessor'
  | 'negativeFloat'
  | 'missedDeadline'
  | 'violatedConstraint'
  | 'nearCritical'
  | 'highFloat'
  | 'longDuration'
  | 'lead'
  | 'longLag'
  | 'hardConstraint'
  | 'outOfSequence'
  | 'progressException'
  | 'missedTask'
  | 'nonFsRelation'
  | 'missingResource';

export type HealthSeverity = 'error' | 'warning' | 'info';

export type ProgressExceptionReason =
  | 'actualStartAfterStatusDate'
  | 'actualFinishAfterStatusDate'
  | 'completeWithoutActualFinish'
  | 'actualFinishWithoutComplete'
  | 'progressWithoutActualStart'
  | 'forecastStartBeforeStatusDate'
  | 'forecastFinishBeforeStatusDate';

export interface HealthItem {
  taskId?: string;
  sequenceId?: string;
  wbs: string;
  name: string;
  detail: {
    float?: number;
    days?: number;
    lag?: string;
    constraintType?: ConstraintType;
    date?: string;
    reason?: ProgressExceptionReason;
    relationType?: Sequence['type'];
  };
}

export interface HealthCheck {
  id: HealthCheckId;
  severity: HealthSeverity;
  items: HealthItem[];
}

export interface HealthOptions {
  highFloatDays: number;
  longDurationDays: number;
  lagDays: number;
  nearCriticalDays: number;
}

export interface HealthResult {
  checks: HealthCheck[];
  totals: { errors: number; warnings: number; infos: number };
  leafCount: number;
  relationCount: number;
  calculated: boolean;
  dcma: DcmaAssessment;
}

const SEVERITY: Record<HealthCheckId, HealthSeverity> = {
  noPredecessor: 'warning',
  noSuccessor: 'warning',
  negativeFloat: 'error',
  missedDeadline: 'error',
  violatedConstraint: 'error',
  nearCritical: 'info',
  highFloat: 'info',
  longDuration: 'warning',
  lead: 'warning',
  longLag: 'info',
  hardConstraint: 'warning',
  outOfSequence: 'warning',
  progressException: 'error',
  missedTask: 'warning',
  nonFsRelation: 'info',
  missingResource: 'info',
};

export const HEALTH_CHECK_ORDER: readonly HealthCheckId[] = [
  'negativeFloat', 'missedDeadline', 'violatedConstraint', 'progressException',
  'noPredecessor', 'noSuccessor', 'longDuration', 'lead', 'hardConstraint', 'outOfSequence', 'missedTask',
  'nearCritical', 'highFloat', 'longLag', 'nonFsRelation', 'missingResource',
];

export function computeScheduleHealth(ctx: ReportContext, opts: HealthOptions): HealthResult {
  const logic = buildLogicIndex(ctx);
  const { leaves, relations, byId, hasPred, hasSucc, originalSeqById } = logic;
  const cpm = ctx.cpmResult && !ctx.cpmResult.error ? ctx.cpmResult : null;
  const { statusDate } = ctx;
  const statusDay = statusDate ? dayOf(statusDate) : undefined;
  const baseMap = new Map(ctx.baseline ? ctx.baseline.tasks.map(b => [b.taskId, b]) : []);
  const resourced = resourceLoadedTaskIds(ctx);

  const items = new Map<HealthCheckId, HealthItem[]>();
  const add = (id: HealthCheckId, item: HealthItem) => {
    let list = items.get(id);
    if (!list) { list = []; items.set(id, list); }
    list.push(item);
  };
  const taskItem = (t: Task, detail: HealthItem['detail'] = {}): HealthItem =>
    ({ taskId: t.id, wbs: t.wbsCode, name: t.name, detail });

  for (const t of leaves) {
    const state = progressState(t);
    if (!t.isMilestone) {
      if (!hasPred.has(t.id)) add('noPredecessor', taskItem(t));
      if (!hasSucc.has(t.id)) add('noSuccessor', taskItem(t));
    }
    if (state !== 'complete') {
      const tf = t.time.totalFloat;
      if (cpm && tf < 0) add('negativeFloat', taskItem(t, { float: tf }));
      if (cpm && isNearCritical(t, opts.nearCriticalDays)) add('nearCritical', taskItem(t, { float: tf }));
      if (cpm && tf > opts.highFloatDays) add('highFloat', taskItem(t, { float: tf }));
      if (!t.isMilestone) {
        const dur = durationDays(ctx, t);
        if (dur > opts.longDurationDays) add('longDuration', taskItem(t, { days: dur }));
      }
    }
    for (const c of [t.constraint, t.constraint2]) {
      if (isHardConstraint(c)) {
        add('hardConstraint', taskItem(t, { constraintType: c.type, date: c.date }));
      }
    }
    const { actualStart, actualFinish, completion } = t.time;
    if (statusDate && statusDay) {
      const taskCalendar = effectiveCalendarOf(t, ctx.calendar, ctx.calendars as WorkCalendar[]);
      for (const reason of invalidDateReasons(t, statusDate, statusDay, !!cpm, taskCalendar)) {
        const date = reason === 'actualStartAfterStatusDate' ? actualStart
          : reason === 'actualFinishAfterStatusDate' ? actualFinish
            : reason === 'forecastStartBeforeStatusDate' ? t.time.earlyStart : t.time.earlyFinish;
        add('progressException', taskItem(t, { reason, date }));
      }
    }
    if (completion >= 1 && !actualFinish) add('progressException', taskItem(t, { reason: 'completeWithoutActualFinish' }));
    if (actualFinish && completion < 1) add('progressException', taskItem(t, { reason: 'actualFinishWithoutComplete' }));
    if (completion > 0 && !actualStart) add('progressException', taskItem(t, { reason: 'progressWithoutActualStart' }));
    if (!t.isMilestone) {
      const bt = baseMap.get(t.id);
      if (statusDay && bt && dayOf(bt.finish) <= statusDay && isMissedTask(t, bt)) {
        add('missedTask', taskItem(t, { date: bt.finish }));
      }
      if (resourced.size > 0 && state !== 'complete' && !resourced.has(t.id) && durationDays(ctx, t) > 0) {
        add('missingResource', taskItem(t));
      }
    }
  }

  const seqItem = (s: Sequence, detail: HealthItem['detail'] = {}): HealthItem => {
    const shown = originalSeqById.get(originalSequenceId(s.id)) ?? s;
    const p = byId.get(shown.predecessorId);
    const q = byId.get(shown.successorId);
    return { sequenceId: shown.id, wbs: `${p?.wbsCode ?? '?'} → ${q?.wbsCode ?? '?'}`, name: `${p?.name ?? '?'} → ${q?.name ?? '?'}`, detail };
  };
  const reportedLag = new Set<string>();
  const reportedType = new Set<string>();
  for (const s of relations) {
    const orig = originalSequenceId(s.id);
    const shown = originalSeqById.get(orig) ?? s;
    if (shown.type !== 'FINISH_START' && !reportedType.has(orig)) {
      reportedType.add(orig);
      add('nonFsRelation', seqItem(s, { relationType: shown.type }));
    }
    if (reportedLag.has(orig)) continue;
    const pred = byId.get(s.predecessorId);
    if (!pred) continue;
    const hpd = effHoursPerDay(effectiveCalendarOf(pred, ctx.calendar, ctx.calendars as WorkCalendar[]));
    const lag = resolveEffectiveLagDays(s, pred, hpd);
    if (lag < 0) { add('lead', seqItem(s, { lag: formatLagShort(s), days: lag })); reportedLag.add(orig); }
    else if (lag > opts.lagDays) { add('longLag', seqItem(s, { lag: formatLagShort(s), days: lag })); reportedLag.add(orig); }
  }

  if (cpm) {
    for (const id of cpm.missedDeadlineTaskIds) {
      const t = byId.get(id);
      if (t) add('missedDeadline', taskItem(t, { date: t.deadline, float: t.time.totalFloat }));
    }
    for (const id of cpm.violatedConstraintTaskIds) {
      const t = byId.get(id);
      if (t) add('violatedConstraint', taskItem(t, { constraintType: t.constraint?.type, date: t.constraint?.date, float: t.time.totalFloat }));
    }
    const seenOos = new Set<string>();
    for (const id of cpm.outOfSequenceSequenceIds) {
      const orig = originalSequenceId(id);
      const s = originalSeqById.get(orig);
      if (s && !seenOos.has(orig)) { seenOos.add(orig); add('outOfSequence', seqItem(s)); }
    }
  }

  const checks: HealthCheck[] = HEALTH_CHECK_ORDER.map(id => ({ id, severity: SEVERITY[id], items: items.get(id) ?? [] }));
  const totals = { errors: 0, warnings: 0, infos: 0 };
  for (const c of checks) {
    if (c.items.length === 0) continue;
    if (c.severity === 'error') totals.errors += c.items.length;
    else if (c.severity === 'warning') totals.warnings += c.items.length;
    else totals.infos += c.items.length;
  }
  const relationCount = new Set(relations.map(s => originalSequenceId(s.id))).size;
  return { checks, totals, leafCount: leaves.length, relationCount, calculated: cpm !== null, dcma: computeDcmaAssessment(ctx, logic) };
}
