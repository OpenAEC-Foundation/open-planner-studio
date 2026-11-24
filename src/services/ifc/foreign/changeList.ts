import type { UnusedKeysOfTask } from './ifcSource';

export const SINGLE_REFERENCES = 0;

export interface ForeignReferences {
  readonly stepIds: Int32Array;
  readonly groupStart: Int32Array;
  readonly groupSize: Int32Array;
  readonly targetStart: Int32Array;
  readonly targets: Int32Array;
}

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

export type ForeignChange = ChangedForeignPiece | DroppedForeignPiece;

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

function referrersOf(references: ForeignReferences): Map<number, number[]> {
  const { stepIds, groupStart, targetStart, targets } = references;
  const referrers = new Map<number, number[]>();
  for (let piece = 0; piece < stepIds.length; piece++) {
    for (let k = targetStart[groupStart[piece]]; k < targetStart[groupStart[piece + 1]]; k++) {
      const list = referrers.get(targets[k]);
      if (!list) referrers.set(targets[k], [piece]);
      else if (list[list.length - 1] !== piece) list.push(piece);
    }
  }
  return referrers;
}

export function applyForeignRule(references: ForeignReferences, gone: ReadonlySet<number>,
  unusedKeys: readonly UnusedKeysOfTask[] = []): ForeignRuleOutcome {
  const { stepIds, groupStart, groupSize, targetStart, targets } = references;
  const referrers = gone.size > 0 ? referrersOf(references) : new Map<number, number[]>();
  const removed = new Set(gone);
  const dropped = new Set<number>();
  const touched = new Set<number>();
  const queue: number[] = [];
  const reach = (target: number) => {
    for (const piece of referrers.get(target) ?? []) { touched.add(piece); queue.push(piece); }
  };
  const falls = (piece: number): boolean => {
    for (let group = groupStart[piece]; group < groupStart[piece + 1]; group++) {
      let lost = 0;
      for (let k = targetStart[group]; k < targetStart[group + 1]; k++) if (removed.has(targets[k])) lost++;
      if (lost > 0 && (groupSize[group] === SINGLE_REFERENCES || lost >= groupSize[group])) return true;
    }
    return false;
  };
  for (const target of gone) reach(target);
  while (queue.length > 0) {
    const piece = queue.pop()!;
    if (dropped.has(stepIds[piece]) || !falls(piece)) continue;
    dropped.add(stepIds[piece]);
    removed.add(stepIds[piece]);
    reach(stepIds[piece]);
  }
  const trimmed = new Map<number, Set<number>>();
  for (const piece of [...touched].sort((a, b) => a - b)) {
    if (dropped.has(stepIds[piece])) continue;
    const lost = new Set<number>();
    for (let k = targetStart[groupStart[piece]]; k < targetStart[groupStart[piece + 1]]; k++) {
      if (removed.has(targets[k])) lost.add(targets[k]);
    }
    if (lost.size > 0) trimmed.set(stepIds[piece], lost);
  }
  const droppedUnusedKeys = unusedKeys.filter(keys => gone.has(keys.taskStepId))
    .flatMap(keys => keys.propertyStepIds.map(propertyStepId => ({ taskStepId: keys.taskStepId, propertyStepId })));
  return { gone, dropped, trimmed, droppedUnusedKeys };
}

export function foreignChangeCount(outcome: ForeignRuleOutcome): number {
  return outcome.dropped.size + outcome.trimmed.size + outcome.droppedUnusedKeys.length;
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
