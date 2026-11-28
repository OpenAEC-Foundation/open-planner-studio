import type { Task, ConstraintType } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource } from '@/types/resource';
import type { CPMResult, ScheduleErrorInfo } from './CPMSolver';
import { effectiveExternalLinks } from './expandSummaryRelations';
import { parseInstant } from '@/utils/dateUtils';
import type { ResourceLoadResult } from './ResourceLoad';

export type ScheduleWarningKind =
  | 'scheduleError'
  | 'missedDeadline'
  | 'violatedConstraint'
  | 'externalSuccessorViolated'
  | 'outOfSequence'
  | 'truncatedLead'
  | 'droppedSequence'
  | 'hammockNoFinishDriver'
  | 'cappedTask'
  | 'externalLagCalendar'
  | 'overallocation';

export type ScheduleWarningSeverity = 'error' | 'warning';

export type ScheduleWarningTarget =
  | { type: 'task'; taskId: string }
  | { type: 'sequence'; sequenceId: string; predecessorId: string; successorId: string }
  | { type: 'resource'; resourceId: string }
  | { type: 'project'; taskIds: string[] };

export interface ScheduleWarningFacts {
  message?: string;
  errorInfo?: ScheduleErrorInfo;
  deadline?: string;
  finish?: string;
  constraintType?: ConstraintType;
  constraintDate?: string;
  days?: number;
  firstDay?: string;
  lastDay?: string;
  nonWorkingDays?: number;
  externalTaskName?: string;
  externalProjectName?: string;
  externalLinkId?: string;
  relType?: 'FS' | 'SS' | 'FF' | 'SF';
  anchor?: string;
  start?: string;
}

export interface ScheduleWarning {
  id: string;
  kind: ScheduleWarningKind;
  severity: ScheduleWarningSeverity;
  target: ScheduleWarningTarget;
  facts: ScheduleWarningFacts;
}

export interface ScheduleWarningsInput {
  tasks: readonly Task[];
  sequences: readonly Sequence[];
  resources: readonly Resource[];
  cpmResult: CPMResult | null;
  resourceLoadResult: ResourceLoadResult | null;
}

const KIND_ORDER: Record<ScheduleWarningKind, number> = {
  scheduleError: 0,
  missedDeadline: 1,
  violatedConstraint: 2,
  externalSuccessorViolated: 2.5,
  outOfSequence: 3,
  truncatedLead: 4,
  droppedSequence: 5,
  hammockNoFinishDriver: 6,
  cappedTask: 7,
  externalLagCalendar: 8,
  overallocation: 9,
};

const SEVERITY: Record<ScheduleWarningKind, ScheduleWarningSeverity> = {
  scheduleError: 'error',
  missedDeadline: 'warning',
  violatedConstraint: 'warning',
  externalSuccessorViolated: 'warning',
  outOfSequence: 'warning',
  truncatedLead: 'warning',
  droppedSequence: 'warning',
  hammockNoFinishDriver: 'warning',
  cappedTask: 'warning',
  externalLagCalendar: 'warning',
  overallocation: 'warning',
};

export function collectScheduleWarnings(input: ScheduleWarningsInput): ScheduleWarning[] {
  const { tasks, sequences, resources, cpmResult, resourceLoadResult } = input;
  const out: ScheduleWarning[] = [];
  const seen = new Set<string>();

  const taskIndex = new Map<string, number>();
  const taskById = new Map<string, Task>();
  tasks.forEach((t, i) => { taskIndex.set(t.id, i); taskById.set(t.id, t); });
  const seqById = new Map<string, Sequence>();
  for (const s of sequences) seqById.set(s.id, s);
  const resourceIndex = new Map<string, number>();
  const resourceById = new Map<string, Resource>();
  resources.forEach((r, i) => { resourceIndex.set(r.id, i); resourceById.set(r.id, r); });

  const order = new Map<string, number>();

  const push = (w: ScheduleWarning, position: number) => {
    if (seen.has(w.id)) return;
    seen.add(w.id);
    order.set(w.id, position);
    out.push(w);
  };

  const pushTask = (kind: ScheduleWarningKind, taskId: string, facts: ScheduleWarningFacts = {}) => {
    const idx = taskIndex.get(taskId);
    if (idx === undefined) return;
    push({
      id: `${kind}:${taskId}`, kind, severity: SEVERITY[kind],
      target: { type: 'task', taskId }, facts,
    }, idx);
  };

  const pushSequence = (kind: ScheduleWarningKind, sequenceId: string) => {
    const seq = seqById.get(sequenceId);
    if (!seq) return;
    const idx = taskIndex.get(seq.successorId) ?? Number.MAX_SAFE_INTEGER;
    push({
      id: `${kind}:${sequenceId}`, kind, severity: SEVERITY[kind],
      target: { type: 'sequence', sequenceId, predecessorId: seq.predecessorId, successorId: seq.successorId },
      facts: {},
    }, idx);
  };

  if (cpmResult) {
    if (cpmResult.error) {
      const taskIds = (cpmResult.cycleTaskIds ?? []).filter(id => taskById.has(id));
      push({
        id: 'scheduleError:project', kind: 'scheduleError', severity: 'error',
        target: { type: 'project', taskIds },
        facts: { message: cpmResult.error, ...(cpmResult.errorInfo ? { errorInfo: cpmResult.errorInfo } : {}) },
      }, 0);
    }

    for (const id of cpmResult.missedDeadlineTaskIds ?? []) {
      const t = taskById.get(id);
      if (!t) continue;
      pushTask('missedDeadline', id, { deadline: t.deadline, finish: t.time.earlyFinish });
    }
    for (const id of cpmResult.violatedConstraintTaskIds ?? []) {
      const t = taskById.get(id);
      if (!t) continue;
      pushTask('violatedConstraint', id, {
        constraintType: t.constraint?.type, constraintDate: t.constraint?.date,
      });
    }
    const linksOf = effectiveExternalLinks(tasks);
    for (const { taskId, linkId } of cpmResult.externalSuccessorViolations ?? []) {
      const t = taskById.get(taskId);
      const link = t ? linksOf(t).find(l => l.id === linkId) : undefined;
      const idx = taskIndex.get(taskId);
      if (!t || !link || idx === undefined) continue;
      const startSide = link.relType === 'SS' || link.relType === 'SF';
      const actualStart = startSide && t.time.actualStart && !isNaN(parseInstant(t.time.actualStart).getTime())
        ? t.time.actualStart : undefined;
      push({
        id: `externalSuccessorViolated:${taskId}:${linkId}`, kind: 'externalSuccessorViolated',
        severity: SEVERITY.externalSuccessorViolated, target: { type: 'task', taskId },
        facts: {
          externalTaskName: link.sourceRef.taskName || link.sourceRef.taskId,
          externalProjectName: link.sourceRef.projectName || link.sourceRef.projectId,
          externalLinkId: link.id, relType: link.relType, anchor: link.anchorDate,
          ...(startSide ? { start: actualStart ?? t.time.earlyStart } : { finish: t.time.earlyFinish }),
        },
      }, idx);
    }
    for (const id of cpmResult.outOfSequenceSequenceIds ?? []) pushSequence('outOfSequence', id);
    for (const id of cpmResult.truncatedLeadSequenceIds ?? []) pushSequence('truncatedLead', id);
    for (const id of cpmResult.droppedSequenceIds ?? []) pushSequence('droppedSequence', id);
    for (const id of cpmResult.hammockNoFinishDriverTaskIds ?? []) pushTask('hammockNoFinishDriver', id);
    for (const id of cpmResult.cappedTaskIds ?? []) pushTask('cappedTask', id);
    for (const id of cpmResult.externalLagCalendarFallbackTaskIds ?? []) pushTask('externalLagCalendar', id);
  }

  if (resourceLoadResult) {
    for (const [resourceId, days] of Object.entries(resourceLoadResult.overallocatedDays)) {
      if (!resourceById.has(resourceId) || days.length === 0) continue;
      const reasons = resourceLoadResult.overallocatedReasons[resourceId] ?? {};
      const nonWorkingDays = days.filter(d => reasons[d] === 'non-working-day').length;
      push({
        id: `overallocation:${resourceId}`, kind: 'overallocation', severity: 'warning',
        target: { type: 'resource', resourceId },
        facts: { days: days.length, firstDay: days[0], lastDay: days[days.length - 1], nonWorkingDays },
      }, resourceIndex.get(resourceId) ?? Number.MAX_SAFE_INTEGER);
    }
  }

  out.sort((a, b) => {
    const k = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (k !== 0) return k;
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });
  return out;
}

export function hasScheduleWarningTarget(w: ScheduleWarning): boolean {
  return w.target.type !== 'project' || w.target.taskIds.length > 0;
}

export interface ScheduleWarningSummary {
  errors: number;
  warnings: number;
  total: number;
}

export function summarizeScheduleWarnings(warnings: readonly ScheduleWarning[]): ScheduleWarningSummary {
  let errors = 0;
  for (const w of warnings) if (w.severity === 'error') errors++;
  return { errors, warnings: warnings.length - errors, total: warnings.length };
}
