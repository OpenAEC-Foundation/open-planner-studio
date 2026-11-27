import type { Task, TaskConstraint, ConstraintType } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { effectiveExternalLinks, expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { type ReportContext, activityTasks } from './reportCommon';

export interface LogicIndex {
  leaves: Task[];
  leafIds: Set<string>;
  byId: Map<string, Task>;
  relations: Sequence[];
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
  const externalLinksOf = effectiveExternalLinks(ctx.tasks);
  for (const t of leaves) {
    for (const l of externalLinksOf(t)) {
      if (l.direction === 'predecessor') hasPred.add(t.id); else hasSucc.add(t.id);
    }
  }
  return { leaves, leafIds, byId, relations, originalSeqById: new Map(ctx.sequences.map(s => [s.id, s])), hasPred, hasSucc };
}

const HARD_TYPES: ReadonlySet<ConstraintType> = new Set(['MSO', 'MFO', 'SNLT', 'FNLT']);

export function isHardConstraint(c: TaskConstraint | undefined): c is TaskConstraint {
  return !!c && (!!c.hard || HARD_TYPES.has(c.type));
}
