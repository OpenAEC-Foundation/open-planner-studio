import type { Task, TaskConstraint, ConstraintType } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { type ReportContext, activityTasks } from './reportCommon';

/**
 * De logica van een planning zoals de rapporten haar zien: welke bladtaken een voorganger of
 * opvolger hebben, en over welke relaties dat gaat. Gedeeld door de planningsgezondheid en de
 * DCMA-beoordeling, zodat "zonder voorganger" in beide precies hetzelfde betekent.
 *
 * Dezelfde relatieset als de solver: relaties op verzameltaken worden eerst naar bladtaakrelaties
 * uitgevouwen (`expandSummaryRelations`, zoals `runCPM` doet — op een MS Project-import is dat
 * de normale vorm). Alleen relaties tussen bladtaken blijven over. Externe links tellen als logica
 * aan die kant.
 */
export interface LogicIndex {
  /** Activiteiten: bladtaken zonder hammocks (`activityTasks`). */
  leaves: Task[];
  leafIds: Set<string>;
  byId: Map<string, Task>;
  /** Uitgevouwen relaties tussen bladtaken (ids kunnen synthetisch zijn: `originalSequenceId`). */
  relations: Sequence[];
  /** De gemodelleerde relaties op hun eigen id — voor de weergave en het relatietype. */
  originalSeqById: Map<string, Sequence>;
  hasPred: Set<string>;
  hasSucc: Set<string>;
}

export function buildLogicIndex(ctx: ReportContext): LogicIndex {
  const leaves = activityTasks(ctx.tasks);
  const leafIds = new Set(leaves.map(t => t.id));
  const byId = new Map(ctx.tasks.map(t => [t.id, t]));
  const { sequences: expanded } = expandSummaryRelations(ctx.tasks, ctx.sequences);
  const relations = expanded.filter(s => leafIds.has(s.predecessorId) && leafIds.has(s.successorId));
  const hasPred = new Set<string>();
  const hasSucc = new Set<string>();
  for (const s of relations) { hasSucc.add(s.predecessorId); hasPred.add(s.successorId); }
  for (const t of leaves) {
    for (const l of t.externalLinks ?? []) {
      if (l.direction === 'predecessor') hasPred.add(t.id); else hasSucc.add(t.id);
    }
  }
  return { leaves, leafIds, byId, relations, originalSeqById: new Map(ctx.sequences.map(s => [s.id, s])), hasPred, hasSucc };
}

/** DCMA-definitie (PAM 200.1 §4.5): constraints die de late datums vastzetten en dus de logica
 *  kunnen overstemmen — MSO, MFO, SNLT en FNLT. Een verplichte (`hard`) constraint telt altijd. */
const HARD_TYPES: ReadonlySet<ConstraintType> = new Set(['MSO', 'MFO', 'SNLT', 'FNLT']);

export function isHardConstraint(c: TaskConstraint | undefined): c is TaskConstraint {
  return !!c && (!!c.hard || HARD_TYPES.has(c.type));
}
