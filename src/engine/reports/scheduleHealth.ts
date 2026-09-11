import type { Task, ConstraintType } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { formatLagShort } from '@/utils/lagFormat';
import { expandSummaryRelations, originalSequenceId } from '@/engine/scheduler/expandSummaryRelations';
import { resolveEffectiveLagDays } from '@/engine/scheduler/CPMSolver';
import { effHoursPerDay, effectiveCalendarOf } from '@/utils/taskDuration';
import type { WorkCalendar } from '@/types/calendar';
import { type ReportContext, dayOf, durationDays, isNearCritical, activityTasks, progressState } from './reportCommon';

/**
 * Planningsgezondheid (discussie #31, rapport 7): de geautomatiseerde planningsreview, in de
 * geest van de DCMA 14-punts-controle. Elke check levert een telling plus de betrokken taken of
 * relaties, met een ernst: `error` (de planning klopt niet), `warning` (verdient aandacht),
 * `info` (goed om te weten).
 *
 * De drempels zijn instelbaar; de defaults volgen DCMA (hoge speling en lange duur: 44 werkdagen,
 * ≈ twee maanden) in plaats van de losse voorbeeldgetallen uit het voorstel — die zijn wél
 * onderbouwd en breed bekend. Leads (negatieve lag) worden apart van lags gemeld: DCMA staat
 * leads helemaal niet toe, terwijl een gewone lag boven de drempel alleen ter informatie is.
 *
 * WAT HIER BEWUST NIET STAAT: de dubbele meldingen die het waarschuwingenpaneel (issue #53) al
 * geeft over solverfouten (cyclus, afgekapte leads, hammocks); dit rapport gaat over de KWALITEIT
 * van een rekenbare planning. Geschonden constraints en gemiste deadlines staan er wél in, want
 * die zijn de gebruikelijke oorzaak van negatieve speling en horen in één review bij elkaar.
 */
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
  | 'progressException';

export type HealthSeverity = 'error' | 'warning' | 'info';

export type ProgressExceptionReason =
  | 'actualStartAfterStatusDate'
  | 'actualFinishAfterStatusDate'
  | 'completeWithoutActualFinish'
  | 'actualFinishWithoutComplete'
  | 'progressWithoutActualStart';

export interface HealthItem {
  /** Taak-rij: wbs + naam; relatie-rij: "voorganger → opvolger". */
  taskId?: string;
  sequenceId?: string;
  wbs: string;
  name: string;
  /** Kind-specifieke feiten; de UI formatteert en vertaalt. */
  detail: {
    float?: number;
    days?: number;
    lag?: string;
    constraintType?: ConstraintType;
    date?: string;
    reason?: ProgressExceptionReason;
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
  /** Lag boven deze drempel (werkdagen) wordt gemeld; leads (negatief) altijd. */
  lagDays: number;
  nearCriticalDays: number;
}

export interface HealthResult {
  checks: HealthCheck[];
  totals: { errors: number; warnings: number; infos: number };
  leafCount: number;
  relationCount: number;
  calculated: boolean;
}

/** DCMA-definitie: constraints die de late datums vastzetten (en dus de logica kunnen overstemmen). */
const HARD_TYPES: ReadonlySet<ConstraintType> = new Set(['MSO', 'MFO', 'SNLT', 'FNLT']);

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
};

export const HEALTH_CHECK_ORDER: readonly HealthCheckId[] = [
  'negativeFloat', 'missedDeadline', 'violatedConstraint', 'progressException',
  'noPredecessor', 'noSuccessor', 'longDuration', 'lead', 'hardConstraint', 'outOfSequence',
  'nearCritical', 'highFloat', 'longLag',
];

export function computeScheduleHealth(ctx: ReportContext, opts: HealthOptions): HealthResult {
  const leaves = activityTasks(ctx.tasks);
  const leafIds = new Set(leaves.map(t => t.id));
  const byId = new Map(ctx.tasks.map(t => [t.id, t]));
  const cpm = ctx.cpmResult && !ctx.cpmResult.error ? ctx.cpmResult : null;
  const statusDay = ctx.statusDate ? dayOf(ctx.statusDate) : undefined;

  const items = new Map<HealthCheckId, HealthItem[]>();
  const add = (id: HealthCheckId, item: HealthItem) => {
    let list = items.get(id);
    if (!list) { list = []; items.set(id, list); }
    list.push(item);
  };
  const taskItem = (t: Task, detail: HealthItem['detail'] = {}): HealthItem =>
    ({ taskId: t.id, wbs: t.wbsCode, name: t.name, detail });

  // Dezelfde relatieset als de solver: relaties op verzameltaken worden eerst naar bladtaakrelaties
  // uitgevouwen (`expandSummaryRelations`, zoals `runCPM` doet — op een MS Project-import is dat
  // de normale vorm, review-bevinding 2). Alleen relaties tussen bladtaken blijven over.
  const hasPred = new Set<string>();
  const hasSucc = new Set<string>();
  const { sequences: expanded } = expandSummaryRelations(ctx.tasks, ctx.sequences);
  const relations = expanded.filter(s => leafIds.has(s.predecessorId) && leafIds.has(s.successorId));
  for (const s of relations) { hasSucc.add(s.predecessorId); hasPred.add(s.successorId); }
  // Externe links tellen als logica aan die kant.
  for (const t of leaves) {
    for (const l of t.externalLinks ?? []) {
      if (l.direction === 'predecessor') hasPred.add(t.id); else hasSucc.add(t.id);
    }
  }

  for (const t of leaves) {
    const state = progressState(t);
    // Open einden: alleen niet-mijlpalen (een start-/eindmijlpaal is per definitie een open eind).
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
      if (c && (c.hard || HARD_TYPES.has(c.type))) {
        add('hardConstraint', taskItem(t, { constraintType: c.type, date: c.date }));
      }
    }
    // Voortgangsuitzonderingen: inconsistente actuals.
    const { actualStart, actualFinish, completion } = t.time;
    if (statusDay && actualStart && dayOf(actualStart) > statusDay) {
      add('progressException', taskItem(t, { reason: 'actualStartAfterStatusDate', date: actualStart }));
    }
    if (statusDay && actualFinish && dayOf(actualFinish) > statusDay) {
      add('progressException', taskItem(t, { reason: 'actualFinishAfterStatusDate', date: actualFinish }));
    }
    if (completion >= 1 && !actualFinish) add('progressException', taskItem(t, { reason: 'completeWithoutActualFinish' }));
    if (actualFinish && completion < 1) add('progressException', taskItem(t, { reason: 'actualFinishWithoutComplete' }));
    if (completion > 0 && !actualStart) add('progressException', taskItem(t, { reason: 'progressWithoutActualStart' }));
  }

  // Rapporteer per GEMODELLEERDE relatie: een faserelatie vouwt voor de solver uit tot n×m
  // bladrelaties, maar de planner ziet er één (op de fasenamen) en telt hem één keer.
  const originalSeqById = new Map(ctx.sequences.map(s => [s.id, s]));
  const seqItem = (s: Sequence, detail: HealthItem['detail'] = {}): HealthItem => {
    const shown = originalSeqById.get(originalSequenceId(s.id)) ?? s;
    const p = byId.get(shown.predecessorId);
    const q = byId.get(shown.successorId);
    return { sequenceId: shown.id, wbs: `${p?.wbsCode ?? '?'} → ${q?.wbsCode ?? '?'}`, name: `${p?.name ?? '?'} → ${q?.name ?? '?'}`, detail };
  };
  // Eén lag-definitie met de solver (`resolveEffectiveLagDays`): procent-lag uit de voorgangerduur,
  // `lagDays` leidend, minuut-lag via de uren/dag van de voorgangerkalender (review-bevinding 3).
  const reportedLag = new Set<string>();
  for (const s of relations) {
    const orig = originalSequenceId(s.id);
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
  return { checks, totals, leafCount: leaves.length, relationCount, calculated: cpm !== null };
}
