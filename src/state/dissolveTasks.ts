import type { Sequence } from '@/types/sequence';
import type { ExternalLink, Task } from '@/types/task';
import { externalAnchorSideIsCompatible } from '@/engine/taskGrid/relationFormat';
import { relationAddVerdict } from '@/state/relationRules';
import { subtreeCollector } from '@/state/taskTree';
import { isSummaryTask } from '@/utils/taskHierarchy';

type Endpoint = ({ id: string; link?: undefined } | { id?: undefined; link: ExternalLink })
  & { via?: string; fs?: boolean };

export interface DissolvePlan {
  bridges: Omit<Sequence, 'id'>[];
  externalBridges: { taskId: string; link: Omit<ExternalLink, 'id'> }[];
  refused: string[];
}

export function planDissolve(
  tasks: readonly Task[],
  sequences: readonly Sequence[],
  rootIds: readonly string[],
): DissolvePlan {
  const byId = new Map(tasks.map(task => [task.id, task] as const));
  const collect = subtreeCollector([...tasks]);
  const removeIds = new Set<string>();
  for (const id of rootIds) if (byId.has(id)) for (const sub of collect(id)) removeIds.add(sub);

  const blockOf = (id: string): string => {
    let current = id;
    for (;;) {
      const parent = byId.get(current)?.parentId;
      if (!parent || !removeIds.has(parent)) return current;
      current = parent;
    }
  };

  const into = new Map<string, Endpoint[]>();
  const out = new Map<string, Endpoint[]>();
  const next = new Map<string, Set<string>>();
  const connect = (from: string, to: string) => {
    if (from === to) return;
    const set = next.get(from) ?? new Set<string>();
    set.add(to);
    next.set(from, set);
  };
  const push = (map: Map<string, Endpoint[]>, key: string, value: Endpoint) => {
    const list = map.get(key);
    const same = list?.find(e => e.id === value.id && e.link === value.link && e.via === value.via);
    if (same) same.fs ||= value.fs;
    else if (list) list.push(value);
    else map.set(key, [value]);
  };
  const isWithin = (id: string, ancestorId: string): boolean => {
    for (let p = byId.get(id)?.parentId; p; p = byId.get(p)?.parentId) if (p === ancestorId) return true;
    return false;
  };
  const blocks = [...removeIds].filter(id => blockOf(id) === id);
  const blocksUnder = new Map<string, string[]>();
  for (const block of blocks) {
    for (let via = byId.get(block)?.parentId; via; via = byId.get(via)?.parentId) {
      const list = blocksUnder.get(via);
      if (list) list.push(block);
      else blocksUnder.set(via, [block]);
    }
  }
  const side = (id: string): string[] => (removeIds.has(id) ? [blockOf(id)] : blocksUnder.get(id) ?? []);
  for (const seq of sequences) {
    const fromBlocks = side(seq.predecessorId);
    const toBlocks = side(seq.successorId);
    for (const from of fromBlocks) for (const to of toBlocks) connect(from, to);
    const fs = seq.type === 'FINISH_START';
    if (!removeIds.has(seq.predecessorId)) {
      const via = removeIds.has(seq.successorId) ? undefined : seq.successorId;
      for (const to of toBlocks) push(into, to, via ? { id: seq.predecessorId, via, fs } : { id: seq.predecessorId });
    }
    if (!removeIds.has(seq.successorId)) {
      const via = removeIds.has(seq.predecessorId) ? undefined : seq.predecessorId;
      for (const from of fromBlocks) push(out, from, via ? { id: seq.successorId, via, fs } : { id: seq.successorId });
    }
  }
  const pushExternal = (block: string, links: readonly ExternalLink[] | undefined, via?: string) => {
    for (const link of links ?? []) {
      push(link.direction === 'predecessor' ? into : out, block, via ? { link, via, fs: link.relType === 'FS' } : { link });
    }
  };
  for (const id of removeIds) pushExternal(blockOf(id), byId.get(id)?.externalLinks);
  for (const [via, under] of blocksUnder) for (const block of under) pushExternal(block, byId.get(via)?.externalLinks, via);

  const remainingTasks = tasks
    .filter(task => !removeIds.has(task.id))
    .map(task => (task.childIds.some(id => removeIds.has(id))
      ? { ...task, childIds: task.childIds.filter(id => !removeIds.has(id)) }
      : task));
  const remainingById = new Map(remainingTasks.map(task => [task.id, task] as const));
  const carries = (id: string): boolean => {
    const task = remainingById.get(id);
    return !!task && (!isSummaryTask(task) || task.childIds.some(carries));
  };
  const remaining: Sequence[] = sequences.filter(
    seq => !removeIds.has(seq.predecessorId) && !removeIds.has(seq.successorId),
  );
  const bridges: Omit<Sequence, 'id'>[] = [];
  const externalBridges: DissolvePlan['externalBridges'] = [];
  const refused: string[] = [];
  const name = (e: Endpoint) => (e.link
    ? `${e.link.sourceRef.projectName || e.link.sourceRef.projectId} / ${e.link.sourceRef.taskName || e.link.sourceRef.taskId}`
    : byId.get(e.id)?.name ?? '?');

  for (const block of blocks) {
    const predecessors = into.get(block) ?? [];
    const successors: (Endpoint & { block: string })[] = [];
    const seen = new Set<string>();
    const stack = [block];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const succ of out.get(current) ?? []) successors.push({ ...succ, block: current });
      for (const nb of next.get(current) ?? []) stack.push(nb);
    }
    const done = new Set<string>();
    for (const pred of predecessors) {
      for (const succ of successors) {
        if (pred.fs && succ.fs && succ.block === block
          && carries(isWithin(pred.via!, succ.via!) ? pred.via! : succ.via!)) continue;
        if (pred.fs && succ.id !== undefined && isWithin(succ.id, pred.via!)) continue;
        if (succ.fs && pred.id !== undefined && isWithin(pred.id, succ.via!)) continue;
        const key = `${pred.id ?? pred.link.id}|${succ.id ?? succ.link.id}`;
        if (done.has(key)) continue;
        done.add(key);
        if (pred.link && succ.link) continue;
        if (pred.link || succ.link) {
          const external = pred.link ? { taskId: succ.id!, link: pred.link } : { taskId: pred.id!, link: succ.link! };
          if (hasExternalFinishStart(byId.get(external.taskId), externalBridges, external.taskId, external.link)) continue;
          const bridge = externalBridge(external.link);
          if (bridge) externalBridges.push({ taskId: external.taskId, link: bridge });
          else refused.push(`${name(pred)} → ${name(succ)}`);
          continue;
        }
        const predecessorId = pred.id;
        const successorId = succ.id!;
        if (alreadyLinked(remaining, predecessorId, successorId)) continue;
        const bridge: Omit<Sequence, 'id'> = {
          predecessorId, successorId, type: 'FINISH_START', lagDays: 0,
        };
        const verdict = relationAddVerdict(remainingTasks, remaining, bridge);
        if (verdict.ok) {
          remaining.push({ ...bridge, id: `__dissolve-${bridges.length}` });
          bridges.push(bridge);
        } else {
          refused.push(`${name(pred)} → ${name(succ)}`);
        }
      }
    }
  }
  return { bridges, externalBridges, refused };
}

function externalBridge(link: ExternalLink): Omit<ExternalLink, 'id'> | null {
  if (!externalAnchorSideIsCompatible(link.direction, link.relType, link.direction, 'FS')) return null;
  const next: Partial<ExternalLink> = { ...link, relType: 'FS', lagDays: 0 };
  delete next.id;
  delete next.lagMinutes;
  return next as Omit<ExternalLink, 'id'>;
}

function hasExternalFinishStart(
  task: Task | undefined,
  planned: DissolvePlan['externalBridges'],
  taskId: string,
  link: Pick<ExternalLink, 'direction' | 'sourceRef'>,
): boolean {
  const same = (other: Omit<ExternalLink, 'id'>) => other.direction === link.direction
    && other.relType === 'FS'
    && other.sourceRef.projectId === link.sourceRef.projectId
    && other.sourceRef.taskId === link.sourceRef.taskId;
  return (task?.externalLinks ?? []).some(same)
    || planned.some(p => p.taskId === taskId && same(p.link));
}

function alreadyLinked(sequences: readonly Sequence[], predecessorId: string, successorId: string): boolean {
  return sequences.some(seq => (
    seq.predecessorId === predecessorId
      && seq.successorId === successorId
      && seq.type === 'FINISH_START'
  ));
}

export function headerTransfers(
  tasks: readonly Task[],
  sequences: readonly Sequence[],
  summaryId: string,
): { relations: Omit<Sequence, 'id'>[]; first: string[]; last: string[] } {
  const byId = new Map(tasks.map(task => [task.id, task] as const));
  const summary = byId.get(summaryId);
  if (!summary) return { relations: [], first: [], last: [] };
  const inside = new Set(subtreeCollector([...tasks])(summaryId));
  inside.delete(summaryId);

  const leaves = new Map<string, string[]>();
  const leavesOf = (id: string): string[] => {
    const known = leaves.get(id);
    if (known) return known;
    const task = byId.get(id);
    const found = !isSummaryTask(task) ? [id] : (task?.childIds ?? []).flatMap(leavesOf);
    leaves.set(id, found);
    return found;
  };

  const hasPredecessor = new Set<string>();
  const hasSuccessor = new Set<string>();
  for (const seq of sequences) {
    if (!inside.has(seq.predecessorId) || !inside.has(seq.successorId)) continue;
    const from = leavesOf(seq.predecessorId);
    const to = leavesOf(seq.successorId);
    if (from.length === 0 || to.length === 0) continue;
    for (const leaf of from) hasSuccessor.add(leaf);
    for (const leaf of to) hasPredecessor.add(leaf);
  }
  const targets = (id: string, blocked: Set<string>): string[] => {
    const own = leavesOf(id);
    if (own.length === 0) return [];
    if (own.every(leaf => !blocked.has(leaf))) return [id];
    return (byId.get(id)?.childIds ?? []).flatMap(child => targets(child, blocked));
  };
  const first = summary.childIds.flatMap(id => targets(id, hasPredecessor));
  const last = summary.childIds.flatMap(id => targets(id, hasSuccessor));

  const relations: Omit<Sequence, 'id'>[] = [];
  for (const seq of sequences) {
    if (seq.successorId === summaryId && !inside.has(seq.predecessorId)) {
      for (const id of first) relations.push(withEndpoints(seq, seq.predecessorId, id));
    } else if (seq.predecessorId === summaryId && !inside.has(seq.successorId)) {
      for (const id of last) relations.push(withEndpoints(seq, id, seq.successorId));
    }
  }
  return { relations, first, last };
}

function withEndpoints(seq: Sequence, predecessorId: string, successorId: string): Omit<Sequence, 'id'> {
  const next: Partial<Sequence> = { ...seq, predecessorId, successorId };
  delete next.id;
  return next as Omit<Sequence, 'id'>;
}
