import {
  relationStructureVerdict,
  type RelationEndpoints,
  type RelationVerdict,
  type TaskLookup,
} from '@/engine/scheduler/relationRules';
import type { Sequence, SequenceType } from '@/types/sequence';

// Compatibele publieke facade voor bestaande store/UI-aanroepers. De structurele domeinregels
// leven in de neutrale enginelaag, zodat grid, MCP en losse storeacties exact dezelfde grens delen.
export {
  isAncestorRelation,
  isSummaryTask,
  relationStructureVerdict,
  type RelationEndpoints,
  type RelationRejection,
  type RelationVerdict,
  type TaskLookup,
} from '@/engine/scheduler/relationRules';

/** Lokale add-check: structurele regels eerst, daarna alleen een exact typed duplicaat. */
export function relationVerdict(
  lookup: TaskLookup,
  sequences: readonly Sequence[],
  relation: RelationEndpoints & { type: SequenceType },
): RelationVerdict {
  const structure = relationStructureVerdict(lookup, relation);
  if (!structure.ok) return structure;
  const exists = sequences.some(sequence => (
    sequence.predecessorId === relation.predecessorId
      && sequence.successorId === relation.successorId
      && sequence.type === relation.type
  ));
  return exists ? { ok: false, reason: 'duplicate' } : { ok: true };
}
