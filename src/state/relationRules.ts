import {
  relationCycle,
  relationStructureVerdict,
  type RelationEndpoints,
  type RelationRejection,
  type RelationVerdict,
  type TaskLookup,
} from '@/engine/scheduler/relationRules';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { Task } from '@/types/task';

// Compatibele publieke facade voor bestaande store/UI-aanroepers. De structurele domeinregels
// leven in de neutrale enginelaag, zodat grid, MCP en losse storeacties exact dezelfde grens delen.
export {
  isAncestorRelation,
  isSummaryTask,
  relationCycle,
  relationStructureVerdict,
  type RelationEndpoints,
  type RelationRejection,
  type RelationVerdict,
  type TaskLookup,
} from '@/engine/scheduler/relationRules';

/** Dedup-sleutel van een relatie: één relatie per (voorganger, opvolger, type) — dezelfde regel als
 *  de duplicaatcheck van `relationVerdict` hieronder. Meerdere typen tussen hetzelfde paar mogen. */
export function relationKey(relation: RelationEndpoints & { type: string }): string {
  return `${relation.predecessorId}|${relation.successorId}|${relation.type}`;
}

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

/** Weigergronden van {@link relationAddVerdict}: de lokale regels plus een kring. */
export type RelationAddRejection = RelationRejection | 'cycle';
export type RelationAddVerdict =
  | { ok: true }
  | { ok: false; reason: RelationRejection }
  | { ok: false; reason: 'cycle'; cycle: readonly string[] };

/**
 * De aanmaaktoets van de store-route (`addSequence`), waar de Gantt-sleep, de lintknop
 * "Geselecteerde taken koppelen", het relatiepaneel en de extensie-API samenkomen: eerst
 * `relationVerdict`, daarna of de relatie een kring zou sluiten (`relationCycle`, over de
 * geëxpandeerde bladgraaf en alleen voor de kring door deze relatie). Raster en MCP weigerden een
 * kring al vooraf; zonder deze toets zou de store-route "Relatie aangemaakt" melden en pas F5 vastlopen.
 *
 * Bewust NIET in `relationVerdict` zelf: die draait ook per relatie bij plakken/sjabloon invoegen
 * (`insertRemappedRelations`, waar een kopie van een acyclische tak geen kring kan maken) en in de
 * MCP-draft, die een eigen kring-precheck plus de rollback van de eindberekening als vangnet heeft.
 */
export function relationAddVerdict(
  tasks: readonly Task[],
  sequences: readonly Sequence[],
  relation: RelationEndpoints & { type: SequenceType },
): RelationAddVerdict {
  const byId = new Map(tasks.map(task => [task.id, task] as const));
  const local = relationVerdict(id => byId.get(id), sequences, relation);
  if (!local.ok) return local;
  const cycle = relationCycle(tasks, sequences, relation);
  return cycle ? { ok: false, reason: 'cycle', cycle } : { ok: true };
}
