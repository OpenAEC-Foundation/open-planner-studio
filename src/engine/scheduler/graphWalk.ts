import type { Sequence } from '@/types/sequence';

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
