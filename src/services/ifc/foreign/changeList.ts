import type { UnusedKeysOfTask } from './ifcSource';

export const SINGLE_REFERENCES = 0;

export interface ForeignReferences {
  readonly stepIds: Int32Array;
  readonly groupStart: Int32Array;
  readonly groupSize: Int32Array;
  readonly targetStart: Int32Array;
  readonly targets: Int32Array;
}

export const emptyForeignReferences = (): ForeignReferences => ({
  stepIds: new Int32Array(0), groupStart: Int32Array.of(0), groupSize: new Int32Array(0),
  targetStart: Int32Array.of(0), targets: new Int32Array(0),
});

export interface ChangedForeignPiece {
  readonly kind: 'gewijzigd';
  readonly id: number;
  readonly oldBytes: Uint8Array;
  readonly newBytes: Uint8Array;
}

export interface DroppedForeignPiece {
  readonly kind: 'vervallen';
  readonly id: number;
  readonly oldBytes: Uint8Array;
  readonly unusedKeyOfTask?: number;
}

export interface RestoredForeignPiece {
  readonly kind: 'teruggezet';
  readonly id: number;
  readonly newBytes: Uint8Array;
}

export type ForeignChange = ChangedForeignPiece | DroppedForeignPiece | RestoredForeignPiece;

export const countedForeignChanges = (changes: readonly ForeignChange[] | undefined): number =>
  (changes ?? []).filter(change => change.kind !== 'teruggezet').length;

export interface DroppedUnusedKey {
  readonly taskStepId: number;
  readonly propertyStepId: number;
}

export interface ForeignRuleOutcome {
  readonly gone: ReadonlySet<number>;
  readonly dropped: ReadonlySet<number>;
  readonly trimmed: ReadonlyMap<number, ReadonlySet<number>>;
  readonly droppedUnusedKeys: readonly DroppedUnusedKey[];
}

export interface DomainObjectIds {
  readonly calendar: { readonly id: string };
  readonly tasks: readonly { readonly id: string }[];
  readonly resources: readonly { readonly id: string }[];
  readonly sequences: readonly { readonly id: string }[];
  readonly resourceCalendars?: readonly { readonly id: string }[];
}

type DeletableKind = 'task' | 'res' | 'seq' | 'cal';

interface SourceSeed {
  readonly kind: string;
  readonly id: string;
  readonly stepId: number;
}

const parsedSeeds = new WeakMap<Readonly<Record<string, number>>, readonly SourceSeed[]>();

function seedsOf(stepIds: Readonly<Record<string, number>>): readonly SourceSeed[] {
  let seeds = parsedSeeds.get(stepIds);
  if (!seeds) {
    seeds = Object.entries(stepIds).map(([seed, stepId]) => {
      const at = seed.indexOf(':');
      return { kind: seed.slice(0, at), id: seed.slice(at + 1), stepId };
    });
    parsedSeeds.set(stepIds, seeds);
  }
  return seeds;
}

const idsOf = (objects: readonly { readonly id: string }[]) => new Set(objects.map(object => object.id));

export function goneStepIds(stepIds: Readonly<Record<string, number>>, domain: DomainObjectIds): Set<number> {
  const present = new Map<string, ReadonlySet<string>>([
    ['task', idsOf(domain.tasks)], ['res', idsOf(domain.resources)], ['seq', idsOf(domain.sequences)],
    ['cal', idsOf([domain.calendar, ...(domain.resourceCalendars ?? [])])],
  ] satisfies [DeletableKind, ReadonlySet<string>][]);
  const kept = new Set<number>(), missing = new Set<number>();
  for (const { kind, id, stepId } of seedsOf(stepIds)) {
    const ids = present.get(kind);
    if (!ids || ids.has(id)) kept.add(stepId);
    else missing.add(stepId);
  }
  for (const stepId of kept) missing.delete(stepId);
  return missing;
}

interface ReferenceIndex {
  readonly groupsOfTarget: ReadonlyMap<number, readonly number[]>;
  readonly pieceOfGroup: Int32Array;
}

const referenceIndexes = new WeakMap<ForeignReferences, ReferenceIndex>();

function referenceIndex(references: ForeignReferences): ReferenceIndex {
  const cached = referenceIndexes.get(references);
  if (cached) return cached;
  const { stepIds, groupStart, groupSize, targetStart, targets } = references;
  const groupsOfTarget = new Map<number, number[]>(), pieceOfGroup = new Int32Array(groupSize.length);
  for (let piece = 0; piece < stepIds.length; piece++) {
    for (let group = groupStart[piece]; group < groupStart[piece + 1]; group++) {
      pieceOfGroup[group] = piece;
      for (let k = targetStart[group]; k < targetStart[group + 1]; k++) {
        const groups = groupsOfTarget.get(targets[k]);
        if (groups) groups.push(group);
        else groupsOfTarget.set(targets[k], [group]);
      }
    }
  }
  const index = { groupsOfTarget, pieceOfGroup };
  referenceIndexes.set(references, index);
  return index;
}

export const NOTHING_GONE: ForeignRuleOutcome = { gone: new Set(), dropped: new Set(), trimmed: new Map(), droppedUnusedKeys: [] };

export function applyForeignRule(references: ForeignReferences, gone: ReadonlySet<number>,
  unusedKeys: readonly UnusedKeysOfTask[] = []): ForeignRuleOutcome {
  if (gone.size === 0) return NOTHING_GONE;
  const { stepIds, groupStart, groupSize, targetStart, targets } = references;
  const { groupsOfTarget, pieceOfGroup } = referenceIndex(references);
  const lost = new Int32Array(groupSize.length), droppedPiece = new Uint8Array(stepIds.length);
  const removed = new Set(gone), dropped = new Set<number>(), touched = new Set<number>();
  const queue = [...gone];
  while (queue.length > 0) {
    for (const group of groupsOfTarget.get(queue.pop()!) ?? []) {
      const piece = pieceOfGroup[group];
      touched.add(piece);
      lost[group]++;
      if (droppedPiece[piece] === 1 || (groupSize[group] !== SINGLE_REFERENCES && lost[group] < groupSize[group])) continue;
      droppedPiece[piece] = 1;
      dropped.add(stepIds[piece]);
      removed.add(stepIds[piece]);
      queue.push(stepIds[piece]);
    }
  }
  const trimmed = new Map<number, Set<number>>();
  for (const piece of [...touched].sort((a, b) => a - b)) {
    if (droppedPiece[piece] === 1) continue;
    const lostTargets = new Set<number>();
    for (let k = targetStart[groupStart[piece]]; k < targetStart[groupStart[piece + 1]]; k++) {
      if (removed.has(targets[k])) lostTargets.add(targets[k]);
    }
    trimmed.set(stepIds[piece], lostTargets);
  }
  const droppedUnusedKeys = unusedKeys.filter(keys => gone.has(keys.taskStepId))
    .flatMap(keys => keys.propertyStepIds.map(propertyStepId => ({ taskStepId: keys.taskStepId, propertyStepId })));
  return { gone, dropped, trimmed, droppedUnusedKeys };
}

const sameTargets = (a: ReadonlySet<number> | undefined, b: ReadonlySet<number>) =>
  a !== undefined && a.size === b.size && [...b].every(target => a.has(target));

export function newForeignChangeCount(before: ForeignRuleOutcome, after: ForeignRuleOutcome): number {
  let count = 0;
  for (const id of after.dropped) if (!before.dropped.has(id)) count++;
  for (const [id, lost] of after.trimmed) if (!sameTargets(before.trimmed.get(id), lost)) count++;
  const earlier = new Set(before.droppedUnusedKeys.map(key => key.propertyStepId));
  for (const key of after.droppedUnusedKeys) if (!earlier.has(key.propertyStepId)) count++;
  return count;
}
