import type { Sequence } from '@/types/sequence';

export interface DirectedRelationEdge {
  predecessorId: string;
  successorId: string;
}

/**
 * Neutrale pure cyclusdetector voor iedere relationele schrijver. Retourneert één concrete kring
 * met dezelfde taak-id aan begin en einde, of `null` voor een acyclische graaf.
 */
export function detectCycleInEdges(edges: readonly DirectedRelationEdge[]): string[] | null {
  const successors = new Map<string, string[]>();
  const nodes = new Set<string>();
  for (const edge of edges) {
    nodes.add(edge.predecessorId);
    nodes.add(edge.successorId);
    const current = successors.get(edge.predecessorId);
    if (current) current.push(edge.successorId);
    else successors.set(edge.predecessorId, [edge.successorId]);
  }

  const color = new Map<string, 0 | 1 | 2>();
  for (const node of nodes) color.set(node, 0);

  for (const root of nodes) {
    if (color.get(root) !== 0) continue;
    color.set(root, 1);
    const stack: { node: string; nextSuccessor: number }[] = [{ node: root, nextSuccessor: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const adjacent = successors.get(frame.node) ?? [];
      if (frame.nextSuccessor >= adjacent.length) {
        color.set(frame.node, 2);
        stack.pop();
        continue;
      }

      const successor = adjacent[frame.nextSuccessor++];
      if (color.get(successor) === 1) {
        const cycleStart = stack.findIndex(candidate => candidate.node === successor);
        if (cycleStart < 0) throw new Error('Interne DFS-invariant geschonden: grijze knoop ontbreekt');
        return [...stack.slice(cycleStart).map(candidate => candidate.node), successor];
      }
      if ((color.get(successor) ?? 0) === 0) {
        color.set(successor, 1);
        stack.push({ node: successor, nextSuccessor: 0 });
      }
    }
  }
  return null;
}

function edgeKey(edge: DirectedRelationEdge): string {
  return `${edge.predecessorId}\0${edge.successorId}`;
}

/**
 * De kring die `after` TOEVOEGT ten opzichte van `before`: een kring door minstens één kant die in
 * `before` nog niet bestond (kanten tellen op voorganger→opvolger, type en lag doen niet mee).
 * Retourneert die kring als taak-id-lijst met dezelfde id aan begin en einde, geroteerd zodat hij
 * begint bij een nieuwe kant, of `null` wanneer elke kring van `after` al in `before` zat.
 *
 * Gedeeld door de twee schrijvers die een relatiegraaf wijzigen: het aanmaken van één relatie
 * (`relationCycle`, store-route) en de eindcontrole van het taakraster (`validateFinalRelationGraph`).
 * Een reeds bestaande kring (bv. uit een import) blokkeert daardoor geen bewerking die er niets
 * aan toevoegt — dat was precies de overblokkering van het raster.
 *
 * Kosten: de gewone weg is één DFS over `after`. Alleen als die een kring vindt volgt een DFS over
 * `before`; alleen als ook `before` al een kring had, volgt de (lineaire) SCC-zoektocht.
 */
export function detectIntroducedCycle(
  before: readonly DirectedRelationEdge[],
  after: readonly DirectedRelationEdge[],
): string[] | null {
  const cycle = detectCycleInEdges(after);
  if (!cycle) return null;
  const existing = new Set(before.map(edgeKey));
  // Was `before` acyclisch, dan bevat elke kring van `after` per definitie een nieuwe kant.
  if (!detectCycleInEdges(before)) return rotateToAddedEdge(cycle, existing);
  return cycleThroughAddedEdge(existing, after);
}

/** Laat een gevonden kring beginnen bij de voorganger van zijn eerste nieuwe kant. */
function rotateToAddedEdge(cycle: string[], existing: ReadonlySet<string>): string[] {
  const nodes = cycle.slice(0, -1);
  const start = nodes.findIndex((node, index) => !existing.has(edgeKey({
    predecessorId: node, successorId: cycle[index + 1],
  })));
  if (start <= 0) return cycle;
  const rotated = [...nodes.slice(start), ...nodes.slice(0, start)];
  return [...rotated, rotated[0]];
}

/**
 * `before` had zelf al een kring: zoek een kring die door een NIEUWE kant loopt. Een kant p→s ligt
 * op een kring precies dan als p en s in dezelfde sterk samenhangende component van `after` liggen;
 * het pad s→…→p erbij levert de concrete kring.
 */
function cycleThroughAddedEdge(
  existing: ReadonlySet<string>,
  after: readonly DirectedRelationEdge[],
): string[] | null {
  const added = after.filter(edge => !existing.has(edgeKey(edge)));
  if (added.length === 0) return null;
  const successors = successorMap(after);
  const component = stronglyConnectedComponents(successors);
  for (const edge of added) {
    if (edge.predecessorId === edge.successorId) return [edge.predecessorId, edge.predecessorId];
    if (component.get(edge.predecessorId) !== component.get(edge.successorId)) continue;
    const path = shortestPath(successors, edge.successorId, edge.predecessorId);
    if (path) return [edge.predecessorId, ...path];
  }
  return null;
}

function successorMap(edges: readonly DirectedRelationEdge[]): Map<string, string[]> {
  const successors = new Map<string, string[]>();
  for (const edge of edges) {
    if (!successors.has(edge.successorId)) successors.set(edge.successorId, []);
    const current = successors.get(edge.predecessorId);
    if (current) current.push(edge.successorId);
    else successors.set(edge.predecessorId, [edge.successorId]);
  }
  return successors;
}

/** Iteratieve Tarjan: component-index per knoop (geen recursie, dus geen stackgrens op grote graven). */
function stronglyConnectedComponents(successors: ReadonlyMap<string, readonly string[]>): Map<string, number> {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const component = new Map<string, number>();
  let nextIndex = 0;
  let nextComponent = 0;
  const visit = (node: string) => {
    index.set(node, nextIndex);
    low.set(node, nextIndex);
    nextIndex++;
    stack.push(node);
    onStack.add(node);
  };
  for (const root of successors.keys()) {
    if (index.has(root)) continue;
    visit(root);
    const work: { node: string; next: number }[] = [{ node: root, next: 0 }];
    while (work.length > 0) {
      const frame = work[work.length - 1];
      const adjacent = successors.get(frame.node) ?? [];
      if (frame.next < adjacent.length) {
        const successor = adjacent[frame.next++];
        if (!index.has(successor)) {
          visit(successor);
          work.push({ node: successor, next: 0 });
        } else if (onStack.has(successor)) {
          low.set(frame.node, Math.min(low.get(frame.node)!, index.get(successor)!));
        }
        continue;
      }
      if (low.get(frame.node) === index.get(frame.node)) {
        let member: string;
        do {
          member = stack.pop()!;
          onStack.delete(member);
          component.set(member, nextComponent);
        } while (member !== frame.node);
        nextComponent++;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent) low.set(parent.node, Math.min(low.get(parent.node)!, low.get(frame.node)!));
    }
  }
  return component;
}

/** Kortste pad `from` → `to` (breedte-eerst), inclusief beide eindpunten; `null` als er geen is. */
function shortestPath(
  successors: ReadonlyMap<string, readonly string[]>,
  from: string,
  to: string,
): string[] | null {
  const previous = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    if (node === to) {
      const path: string[] = [];
      for (let at: string | null = node; at !== null; at = previous.get(at) ?? null) path.push(at);
      return path.reverse();
    }
    for (const successor of successors.get(node) ?? []) {
      if (previous.has(successor)) continue;
      previous.set(successor, node);
      queue.push(successor);
    }
  }
  return null;
}

/**
 * Transitieve sluitingen over het relatienetwerk voor path tracing (MSP "Task Path" /
 * P6 "Trace Logic"): alle (in)directe voorgangers en opvolgers van een taak, plus de
 * deelverzamelingen die uitsluitend via DRIVING relaties bereikbaar zijn (de ketens die
 * de planning werkelijk bepalen). Pure functie over de store-data; gedeeld door de
 * renderer en eventuele tabelfilters.
 */
export interface TraceResult {
  predecessors: Set<string>;
  drivingPredecessors: Set<string>;
  successors: Set<string>;
  drivenSuccessors: Set<string>;
}

type Edge = { other: string; seqId: string };

function walk(startId: string, edges: Map<string, Edge[]>, allowedSeqIds?: Set<string>): Set<string> {
  const reached = new Set<string>();
  const seen = new Set<string>([startId]);
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const e of edges.get(id) ?? []) {
      if (allowedSeqIds && !allowedSeqIds.has(e.seqId)) continue;
      if (seen.has(e.other)) continue;
      seen.add(e.other);
      reached.add(e.other);
      stack.push(e.other);
    }
  }
  return reached;
}

export function traceFrom(
  taskId: string,
  sequences: Sequence[],
  drivingSeqIds?: Set<string>,
): TraceResult {
  const up = new Map<string, Edge[]>();
  const down = new Map<string, Edge[]>();
  for (const q of sequences) {
    if (!down.has(q.predecessorId)) down.set(q.predecessorId, []);
    down.get(q.predecessorId)!.push({ other: q.successorId, seqId: q.id });
    if (!up.has(q.successorId)) up.set(q.successorId, []);
    up.get(q.successorId)!.push({ other: q.predecessorId, seqId: q.id });
  }
  return {
    predecessors: walk(taskId, up),
    drivingPredecessors: drivingSeqIds ? walk(taskId, up, drivingSeqIds) : new Set<string>(),
    successors: walk(taskId, down),
    drivenSuccessors: drivingSeqIds ? walk(taskId, down, drivingSeqIds) : new Set<string>(),
  };
}
