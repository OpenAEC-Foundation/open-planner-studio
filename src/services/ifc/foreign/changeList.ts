import { ifcObjectSeed } from '../ifcWriter';
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

const DELETABLE_KINDS = ['task', 'res', 'seq', 'cal'] as const;

export function goneStepIds(stepIds: Readonly<Record<string, number>>, domain: DomainObjectIds): Set<number> {
  const present = new Set<string>([ifcObjectSeed('cal', domain.calendar.id)]);
  for (const task of domain.tasks) present.add(ifcObjectSeed('task', task.id));
  for (const resource of domain.resources) present.add(ifcObjectSeed('res', resource.id));
  for (const sequence of domain.sequences) present.add(ifcObjectSeed('seq', sequence.id));
  for (const calendar of domain.resourceCalendars ?? []) present.add(ifcObjectSeed('cal', calendar.id));
  const deletable = DELETABLE_KINDS.map(kind => ifcObjectSeed(kind, ''));
  const kept = new Set<number>(), missing = new Set<number>();
  for (const [seed, stepId] of Object.entries(stepIds)) {
    if (!deletable.some(prefix => seed.startsWith(prefix)) || present.has(seed)) kept.add(stepId);
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
