import type { Task, ConstraintType } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource } from '@/types/resource';
import type { CPMResult } from './CPMSolver';
import type { ResourceLoadResult } from './ResourceLoad';

/**
 * Waarschuwingenlijst (issue #53). De statusbalk telde al gemiste deadlines, geschonden constraints
 * en out-of-sequence-relaties, maar zonder detail. Deze module maakt van de bestaande
 * solver-uitvoer (`cpmResult`) en de belastingsuitvoer (`resourceLoadResult`) één platte, gesorteerde
 * lijst met per item een navigeerbaar DOEL (taak / relatie / resource / project).
 *
 * Bewust een PURE afleiding en geen opgeslagen state: er wordt hier niets herberekend en er komt
 * geen nieuw documentveld bij (geen `DOCUMENT_FIELDS`, geen IFC-round-trip). Wat de solver in
 * `cpmResult` heeft vastgelegd, ís de waarheid; deze functie hangt er alleen doelen en een vaste
 * volgorde aan. Ids die inmiddels geen bestaande taak/relatie/resource meer aanwijzen (verwijderd
 * ná de laatste solve, dus `scheduleStale`) worden overgeslagen in plaats van als spookrij getoond.
 *
 * De relatie-gekeyde velden van `cpmResult` bevatten na `foldSyntheticSequenceIds` alleen originele
 * ids (zie `expandSummaryRelations.ts`); een synthetisch `::exp-N`-id zou hier simpelweg niet in
 * `sequences` gevonden worden en daarmee vanzelf wegvallen.
 */

export type ScheduleWarningKind =
  | 'scheduleError'
  | 'missedDeadline'
  | 'violatedConstraint'
  | 'outOfSequence'
  | 'truncatedLead'
  | 'droppedSequence'
  | 'hammockNoFinishDriver'
  | 'cappedTask'
  | 'overallocation';

export type ScheduleWarningSeverity = 'error' | 'warning';

export type ScheduleWarningTarget =
  | { type: 'task'; taskId: string }
  | { type: 'sequence'; sequenceId: string; predecessorId: string; successorId: string }
  | { type: 'resource'; resourceId: string }
  /** Projectbreed (solverfout). `taskIds` is gevuld voor een cyclus — de loop in volgorde. */
  | { type: 'project'; taskIds: string[] };

/** Kind-specifieke feiten voor de omschrijving. ISO-datums onbewerkt; de UI formatteert. */
export interface ScheduleWarningFacts {
  message?: string;
  deadline?: string;
  finish?: string;
  constraintType?: ConstraintType;
  constraintDate?: string;
  /** Aantal overbezette dagen (overallocation). */
  days?: number;
  firstDay?: string;
  lastDay?: string;
}

export interface ScheduleWarning {
  /** Stabiel over herberekeningen: `${kind}:${doel-id}`. */
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

/** Vaste weergavevolgorde per soort; fouten staan altijd bovenaan. */
const KIND_ORDER: Record<ScheduleWarningKind, number> = {
  scheduleError: 0,
  missedDeadline: 1,
  violatedConstraint: 2,
  outOfSequence: 3,
  truncatedLead: 4,
  droppedSequence: 5,
  hammockNoFinishDriver: 6,
  cappedTask: 7,
  overallocation: 8,
};

const SEVERITY: Record<ScheduleWarningKind, ScheduleWarningSeverity> = {
  scheduleError: 'error',
  missedDeadline: 'warning',
  violatedConstraint: 'warning',
  outOfSequence: 'warning',
  truncatedLead: 'warning',
  droppedSequence: 'warning',
  hammockNoFinishDriver: 'warning',
  cappedTask: 'warning',
  overallocation: 'warning',
};

/**
 * Verzamelt alle actieve waarschuwingen. Volgorde: fouten eerst, daarna per soort (`KIND_ORDER`)
 * en daarbinnen documentvolgorde — de positie van de taak in `tasks` (voor een relatie: die van
 * de opvolger; voor een resource: die in `resources`). Ids die niet (meer) bestaan vallen weg.
 * Dubbele ids in een solver-veld leveren één rij (verzamelingssemantiek, zoals de statusbalk).
 */
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

  // Sorteersleutel binnen een soort: documentvolgorde van het doel.
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
    // Volgorde: de opvolger bepaalt de plek (die "ondervindt" de waarschuwing); onbekende opvolger
    // (kan bij `droppedSequence`) valt achteraan.
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
        facts: { message: cpmResult.error },
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
    for (const id of cpmResult.outOfSequenceSequenceIds ?? []) pushSequence('outOfSequence', id);
    for (const id of cpmResult.truncatedLeadSequenceIds ?? []) pushSequence('truncatedLead', id);
    for (const id of cpmResult.droppedSequenceIds ?? []) pushSequence('droppedSequence', id);
    for (const id of cpmResult.hammockNoFinishDriverTaskIds ?? []) pushTask('hammockNoFinishDriver', id);
    for (const id of cpmResult.cappedTaskIds ?? []) pushTask('cappedTask', id);
  }

  if (resourceLoadResult) {
    for (const [resourceId, days] of Object.entries(resourceLoadResult.overallocatedDays)) {
      if (!resourceById.has(resourceId) || days.length === 0) continue;
      push({
        id: `overallocation:${resourceId}`, kind: 'overallocation', severity: 'warning',
        target: { type: 'resource', resourceId },
        facts: { days: days.length, firstDay: days[0], lastDay: days[days.length - 1] },
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
