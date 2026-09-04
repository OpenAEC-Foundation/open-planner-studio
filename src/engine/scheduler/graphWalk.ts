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
