import type { ExternalLink, Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { CPMResult } from './CPMSolver';
import { isLeafTask } from '@/utils/taskHierarchy';
import { taskDurationUnit } from './duration';

export const MAX_EXPANDED_RELATIONS = 50_000;

export interface ExpandSummaryRelationsResult {
  sequences: Sequence[];
  droppedSequenceIds: string[];
}

const NONE: string[] = [];

export function expandSummaryRelations(
  tasks: readonly Task[],
  sequences: readonly Sequence[],
  maxExpanded: number = MAX_EXPANDED_RELATIONS,
): ExpandSummaryRelationsResult {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const leafDescCache = new Map<string, string[]>();

  function leafDescendantsOf(rootId: string): string[] {
    const cached = leafDescCache.get(rootId);
    if (cached) return cached;
    const root = byId.get(rootId);
    if (!root) return NONE;
    if (isLeafTask(root)) {
      const self = [rootId];
      leafDescCache.set(rootId, self);
      return self;
    }
    const out: string[] = [];
    const visited = new Set<string>([rootId]);
    const stack: string[] = [...root.childIds];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const t = byId.get(id);
      if (!t) continue;
      if (isLeafTask(t)) {
        out.push(id);
      } else {
        stack.push(...t.childIds);
      }
    }
    leafDescCache.set(rootId, out);
    return out;
  }

  const usedIds = new Set(sequences.map((s) => s.id));
  let idCollisionWarned = false;

  const outSeqs: Sequence[] = [];
  const dropped: string[] = [];
  let budget = maxExpanded;
  let budgetExhausted = false;
  let leafEdges: { out: Map<string, Sequence[]>; inc: Map<string, Sequence[]> } | null = null;
  const edges = () => {
    if (leafEdges) return leafEdges;
    const out = new Map<string, Sequence[]>();
    const inc = new Map<string, Sequence[]>();
    for (const e of sequences) {
      const a = byId.get(e.predecessorId);
      const b = byId.get(e.successorId);
      if (!a || !b || !isLeafTask(a) || !isLeafTask(b)) continue;
      (out.get(a.id) ?? out.set(a.id, []).get(a.id)!).push(e);
      (inc.get(b.id) ?? inc.set(b.id, []).get(b.id)!).push(e);
    }
    leafEdges = { out, inc };
    return leafEdges;
  };

  for (const seq of sequences) {
    const predTask = byId.get(seq.predecessorId);
    const succTask = byId.get(seq.successorId);
    if (!predTask || !succTask) {
      outSeqs.push(seq);
      continue;
    }
    const predIsLeaf = isLeafTask(predTask);
    const succIsLeaf = isLeafTask(succTask);
    if (predIsLeaf && succIsLeaf) {
      outSeqs.push(seq);
      continue;
    }

    const predIds = predIsLeaf ? [predTask.id] : [...leafDescendantsOf(predTask.id)];
    const succIds = succIsLeaf ? [succTask.id] : [...leafDescendantsOf(succTask.id)];
    if (predIds.length === 0 || succIds.length === 0) {
      dropped.push(seq.id);
      continue;
    }

    const predSet = new Set(predIds);
    if (succIds.some((id) => predSet.has(id))) {
      dropped.push(seq.id);
      continue;
    }

    if (budgetExhausted) {
      dropped.push(seq.id);
      continue;
    }

    let size = predIds.length * succIds.length;
    if (size > budget) {
      const pruned = pruneDominated(seq, predIds, succIds, byId, edges());
      if (pruned) {
        const prunedSize = pruned.predIds.length * pruned.succIds.length;
        if (prunedSize <= budget) {
          predIds.splice(0, predIds.length, ...pruned.predIds);
          succIds.splice(0, succIds.length, ...pruned.succIds);
          size = prunedSize;
        }
      }
    }
    if (size > budget) {
      budgetExhausted = true;
      dropped.push(seq.id);
      console.warn(
        `expandSummaryRelations: MAX_EXPANDED_RELATIONS (${MAX_EXPANDED_RELATIONS}) bereikt bij ` +
        `relatie "${seq.id}" (${predIds.length}×${succIds.length}=${size} combinaties). Deze en alle ` +
        'volgende relaties die zelf óók expansie nodig hebben, worden genegeerd i.p.v. de solver ' +
        'te laten vastlopen/OOM\'en.',
      );
      continue;
    }

    let n = 0;
    for (const p of predIds) {
      for (const s of succIds) {
        let id = `${seq.id}::exp-${n}`;
        while (usedIds.has(id)) {
          if (!idCollisionWarned) {
            idCollisionWarned = true;
            console.warn(
              `expandSummaryRelations: id-botsing opgelost — een bestaande relatie-id viel samen met ` +
              `een gegenereerde synthetische id voor relatie "${seq.id}" (patroon "::exp-N"). Het ` +
              'tellersuffix is opgehoogd tot een vrije id; controleer desgewenst de bron-relatie-ids.',
            );
          }
          n++;
          id = `${seq.id}::exp-${n}`;
        }
        usedIds.add(id);
        n++;
        outSeqs.push({ ...seq, id, predecessorId: p, successorId: s });
      }
    }
    budget -= size;
  }

  return { sequences: outSeqs, droppedSequenceIds: dropped };
}


function followsLogic(t: Task): boolean {
  if (t.manuallyScheduled || t.isHammock || t.isMilestone) return false;
  if (t.time.actualStart || t.time.actualFinish || (t.time.completion ?? 0) > 0) return false;
  if (!(t.time.scheduleDuration > 0)) return false;
  const c = t.constraint?.type;
  return c !== 'MSO' && c !== 'MFO';
}

function nonNegativeLag(e: Sequence): boolean {
  return e.lagDays >= 0 && (e.lagMinutes ?? 0) >= 0 && (e.lagPercent ?? 0) >= 0;
}

function wholeDayLag(e: Sequence): boolean {
  return !e.lagMinutes && e.lagUnit !== 'ELAPSEDTIME';
}

function pruneDominated(
  rel: Sequence,
  predIds: readonly string[],
  succIds: readonly string[],
  byId: ReadonlyMap<string, Task>,
  edges: { out: ReadonlyMap<string, Sequence[]>; inc: ReadonlyMap<string, Sequence[]> },
): { predIds: string[]; succIds: string[] } | null {
  if (rel.lagPercent !== undefined && rel.lagPercent !== 0) return null;
  if (!wholeDayLag(rel)) return null;
  let unit: 'days' | 'hours' | null = null;
  for (const id of [...predIds, ...succIds]) {
    const t = byId.get(id)!;
    if (t.time.durationType === 'ELAPSEDTIME') return null;
    const u = taskDurationUnit(t);
    if (unit !== null && u !== unit) return null;
    unit = u;
  }
  const eligible = (a: Task, b: Task) => followsLogic(a) && followsLogic(b) && (a.calendarId ?? '') === (b.calendarId ?? '');

  const predSet = new Set(predIds);
  const keepPred = predIds.filter((id) => {
    const p = byId.get(id)!;
    return !(edges.out.get(id) ?? []).some((e) => {
      if (!predSet.has(e.successorId) || !nonNegativeLag(e) || !wholeDayLag(e)) return false;
      return e.type === 'FINISH_START' && eligible(p, byId.get(e.successorId)!);
    });
  });
  const succSet = new Set(succIds);
  const keepSucc = succIds.filter((id) => {
    const q = byId.get(id)!;
    return !(edges.inc.get(id) ?? []).some((e) => {
      if (!succSet.has(e.predecessorId) || !nonNegativeLag(e) || !wholeDayLag(e)) return false;
      return e.type === 'FINISH_START' && eligible(byId.get(e.predecessorId)!, q);
    });
  });
  return { predIds: keepPred, succIds: keepSucc };
}

const SYNTHETIC_SUFFIX = /::exp-\d+$/;

export function originalSequenceId(id: string): string {
  return id.replace(SYNTHETIC_SUFFIX, '');
}

function dedupOriginal(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const orig = originalSequenceId(id);
    if (!seen.has(orig)) {
      seen.add(orig);
      out.push(orig);
    }
  }
  return out;
}

export function foldSyntheticSequenceIds(result: CPMResult): void {
  result.drivingSequenceIds = dedupOriginal(result.drivingSequenceIds);
  result.truncatedLeadSequenceIds = dedupOriginal(result.truncatedLeadSequenceIds);
  result.outOfSequenceSequenceIds = dedupOriginal(result.outOfSequenceSequenceIds);
  if (result.droppedSequenceIds) {
    result.droppedSequenceIds = dedupOriginal(result.droppedSequenceIds);
  }

  const foldedFreeFloat: Record<string, number> = {};
  for (const [id, freeFloat] of Object.entries(result.sequenceFreeFloat)) {
    const orig = originalSequenceId(id);
    foldedFreeFloat[orig] = orig in foldedFreeFloat
      ? Math.min(foldedFreeFloat[orig], freeFloat)
      : freeFloat;
  }
  result.sequenceFreeFloat = foldedFreeFloat;
}

export function leafTasksForSolve(tasks: readonly Task[]): Task[] {
  return tasks.filter(isLeafTask).map(withInheritedExternalLinks(tasks));
}

export function effectiveExternalLinks(tasks: readonly Task[]): (task: Task) => readonly ExternalLink[] {
  const inherit = withInheritedExternalLinks(tasks);
  return (task) => inherit(task).externalLinks ?? [];
}

function withInheritedExternalLinks(tasks: readonly Task[]): (task: Task) => Task {
  if (!tasks.some(t => !isLeafTask(t) && (t.externalLinks?.length ?? 0) > 0)) return task => task;
  const byId = new Map(tasks.map(t => [t.id, t] as const));
  return (task) => {
    const inherited: ExternalLink[] = [];
    const visited = new Set<string>([task.id]);
    let parentId = task.parentId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      if (parent.externalLinks?.length) inherited.push(...parent.externalLinks);
      parentId = parent.parentId;
    }
    if (inherited.length === 0) return task;
    return { ...task, externalLinks: [...(task.externalLinks ?? []), ...inherited] };
  };
}
