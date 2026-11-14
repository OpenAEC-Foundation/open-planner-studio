// Opheffen (Dissolve, issue #887): een taak gaat weg en de keten blijft heel.
//
// Eigenaarsbesluit 2026-11-14: A → B → C wordt A → C, en elke nieuwe relatie is einde-begin
// zonder vertraging, van elke voorganger naar elke opvolger. Wat weggaat volgt Verwijderen
// (`removeTaskSubtrees`): een samenvattingstaak neemt zijn hele tak mee, toewijzingen gaan mee weg.
//
// Een samenvattingstaak volgt de instelling `ui.dissolveSummaryMode` (eigenaarsbesluit
// 2026-11-14): de hele fase als één blok (`planDissolve`, standaard), of alleen de kopregel
// (`headerTransfers`). Deze module rekent alleen uit WELKE relaties er bij komen; de store-actie
// voert verhangen, verwijderen en de nieuwe relaties samen uit als één undo-stap.
import type { Sequence } from '@/types/sequence';
import type { Task } from '@/types/task';
import { relationAddVerdict } from '@/state/relationRules';
import { subtreeCollector } from '@/state/taskTree';

export interface DissolvePlan {
  /** Alle taken die weggaan (de opgegeven taken plus hun deelbomen). */
  removeIds: Set<string>;
  /** De nieuwe einde-begin-relaties, zonder id; de aanroeper geeft ze een id. */
  bridges: Omit<Sequence, 'id'>[];
  /** Bruggen die de relatieregels weigeren (bv. naar een eigen kind, of een kring), als "A → C". */
  refused: string[];
}

/**
 * Bepaal wat Opheffen van `rootIds` doet, op de bevroren state.
 *
 * Een samenvattingstaak met zijn tak telt als één blok: elke voorganger van buiten de tak (naar
 * de kopregel of naar een kind) gaat naar elke opvolger buiten de tak. Opgeheven taken die
 * onderling gekoppeld zijn worden doorlopen, zodat A → B → C → D met B en C samen A → D geeft.
 * Losse opgeheven taken worden niet aan elkaar geknoopt: B en D in A → B → C → D → E geeft
 * A → C en C → E, niet A → E.
 *
 * Een einde-begin die tussen voorganger en opvolger al bestaat blijft zoals ze is en geldt niet
 * als weigering (`alreadyLinked`). Weigeringen van `relationAddVerdict` komen in `refused`.
 */
export function planDissolve(
  tasks: readonly Task[],
  sequences: readonly Sequence[],
  rootIds: readonly string[],
): DissolvePlan {
  const byId = new Map(tasks.map(task => [task.id, task] as const));
  const collect = subtreeCollector([...tasks]);
  const removeIds = new Set<string>();
  for (const id of rootIds) if (byId.has(id)) for (const sub of collect(id)) removeIds.add(sub);

  // Stand "de hele fase" (`ui.dissolveSummaryMode`): de tak gaat weg zoals bij Verwijderen en telt
  // als één blok. Elk weggaand id hoort bij het blok van zijn hoogste weggaande voorouder. In de
  // stand "alleen de kopregel" heeft de store-actie de kopregels al met `headerTransfers` opgeheven.
  const blockOf = (id: string): string => {
    let current = id;
    for (;;) {
      const parent = byId.get(current)?.parentId;
      if (!parent || !removeIds.has(parent)) return current;
      current = parent;
    }
  };

  const into = new Map<string, string[]>(); // blok → voorgangers die blijven
  const out = new Map<string, string[]>(); // blok → opvolgers die blijven
  const next = new Map<string, Set<string>>(); // blok → blokken waar het naar wijst
  const push = (map: Map<string, string[]>, key: string, value: string) => {
    const list = map.get(key);
    if (!list) map.set(key, [value]);
    else if (!list.includes(value)) list.push(value);
  };
  for (const seq of sequences) {
    const fromGone = removeIds.has(seq.predecessorId);
    const toGone = removeIds.has(seq.successorId);
    if (!fromGone && toGone) push(into, blockOf(seq.successorId), seq.predecessorId);
    else if (fromGone && !toGone) push(out, blockOf(seq.predecessorId), seq.successorId);
    else if (fromGone && toGone) {
      const from = blockOf(seq.predecessorId);
      const to = blockOf(seq.successorId);
      if (from === to) continue;
      const set = next.get(from) ?? new Set<string>();
      set.add(to);
      next.set(from, set);
    }
  }

  // De boom zoals hij na het weghalen is: ook `childIds` van een ouder die blijft, want de
  // kringtoets vouwt relaties op een fase uit over zijn kinderen.
  const remainingTasks = tasks
    .filter(task => !removeIds.has(task.id))
    .map(task => (task.childIds.some(id => removeIds.has(id))
      ? { ...task, childIds: task.childIds.filter(id => !removeIds.has(id)) }
      : task));
  const remaining: Sequence[] = sequences.filter(
    seq => !removeIds.has(seq.predecessorId) && !removeIds.has(seq.successorId),
  );
  const bridges: Omit<Sequence, 'id'>[] = [];
  const refused: string[] = [];
  const name = (id: string) => byId.get(id)?.name ?? '?';

  for (const [block, predecessors] of into) {
    // Alle opvolgers die je vanuit dit blok via opgeheven taken bereikt.
    const successors: string[] = [];
    const seen = new Set<string>();
    const stack = [block];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const succ of out.get(current) ?? []) if (!successors.includes(succ)) successors.push(succ);
      for (const nb of next.get(current) ?? []) stack.push(nb);
    }
    for (const predecessorId of predecessors) {
      for (const successorId of successors) {
        if (predecessorId === successorId) continue;
        if (alreadyLinked(remaining, predecessorId, successorId)) continue;
        const bridge: Omit<Sequence, 'id'> = {
          predecessorId, successorId, type: 'FINISH_START', lagDays: 0,
        };
        const verdict = relationAddVerdict(remainingTasks, remaining, bridge);
        if (verdict.ok) {
          remaining.push({ ...bridge, id: `__dissolve-${bridges.length}` });
          bridges.push(bridge);
        } else {
          refused.push(`${name(predecessorId)} → ${name(successorId)}`);
        }
      }
    }
  }
  return { removeIds, bridges, refused };
}

/**
 * KEUZEPUNT 2, bestaande relatie tussen voorganger en opvolger (ligt bij de eigenaar, 2026-11-14).
 * Nu: alleen een einde-begin telt als "al gekoppeld"; die blijft zoals ze is, met haar vertraging.
 * Een relatie van een ander type blijft ook staan en de einde-begin komt ernaast. Kiest de eigenaar
 * "bij elke bestaande relatie komt er niets bij", dan vervalt hier de typevoorwaarde.
 */
function alreadyLinked(sequences: readonly Sequence[], predecessorId: string, successorId: string): boolean {
  return sequences.some(seq => (
    seq.predecessorId === predecessorId
      && seq.successorId === successorId
      && seq.type === 'FINISH_START'
  ));
}

/**
 * Stand "alleen de kopregel": de relaties van samenvattingstaak `summaryId` zelf, overgezet naar
 * haar directe subtaken, met soort en vertraging. Een relatie op een fase geldt in de rekenkern
 * voor elke subtaak; overzetten naar de begin- en eindsubtaken houdt de planning gelijk zolang de
 * fase intern aaneengeschakeld is, zonder een pijl naar elke subtaak. Een beginsubtaak heeft
 * binnen de fase geen voorganger, een eindsubtaak geen opvolger (over hun hele deelboom gemeten).
 */
export function headerTransfers(
  tasks: readonly Task[],
  sequences: readonly Sequence[],
  summaryId: string,
): Omit<Sequence, 'id'>[] {
  const summary = tasks.find(task => task.id === summaryId);
  if (!summary) return [];
  const collect = subtreeCollector([...tasks]);
  const childOf = new Map<string, string>(); // taak in de fase → directe subtaak waaronder ze valt
  for (const childId of summary.childIds) for (const id of collect(childId)) childOf.set(id, childId);

  const hasPredecessor = new Set<string>();
  const hasSuccessor = new Set<string>();
  for (const seq of sequences) {
    const from = childOf.get(seq.predecessorId);
    const to = childOf.get(seq.successorId);
    if (from && to && from !== to) {
      hasSuccessor.add(from);
      hasPredecessor.add(to);
    }
  }
  const begin = summary.childIds.filter(id => !hasPredecessor.has(id));
  const end = summary.childIds.filter(id => !hasSuccessor.has(id));

  const out: Omit<Sequence, 'id'>[] = [];
  for (const seq of sequences) {
    if (seq.successorId === summaryId && !childOf.has(seq.predecessorId)) {
      for (const childId of begin) out.push(withEndpoints(seq, seq.predecessorId, childId));
    } else if (seq.predecessorId === summaryId && !childOf.has(seq.successorId)) {
      for (const childId of end) out.push(withEndpoints(seq, childId, seq.successorId));
    }
  }
  return out;
}

/** Een kopie van `seq` met andere eindpunten en zonder id. */
function withEndpoints(seq: Sequence, predecessorId: string, successorId: string): Omit<Sequence, 'id'> {
  const next: Partial<Sequence> = { ...seq, predecessorId, successorId };
  delete next.id;
  return next as Omit<Sequence, 'id'>;
}
