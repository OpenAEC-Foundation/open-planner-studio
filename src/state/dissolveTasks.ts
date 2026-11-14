// Dissolve (issue #887): een taak gaat weg en de keten blijft heel.
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
import type { ExternalLink, Task } from '@/types/task';
import { externalAnchorSideIsCompatible } from '@/engine/taskGrid/relationFormat';
import { relationAddVerdict } from '@/state/relationRules';
import { subtreeCollector } from '@/state/taskTree';
import { isSummaryTask } from '@/utils/taskHierarchy';

/**
 * Een voorganger of opvolger van een blok: een taak in dit project (`id`) of een externe relatie
 * (`link`, een taak in een ander project). `via` = de blijvende fase waarop de relatie ligt, `fs` =
 * die relatie is einde-begin.
 */
type Endpoint = ({ id: string; link?: undefined } | { id?: undefined; link: ExternalLink })
  & { via?: string; fs?: boolean };

export interface DissolvePlan {
  /** De nieuwe einde-begin-relaties, zonder id; de aanroeper geeft ze een id. */
  bridges: Omit<Sequence, 'id'>[];
  /** De nieuwe externe relaties (einde-begin zonder vertraging) per taak, zonder id. */
  externalBridges: { taskId: string; link: Omit<ExternalLink, 'id'> }[];
  /** Bruggen die de relatieregels weigeren (bv. naar een eigen kind, een kring, of een extern
   *  anker van de verkeerde kant), als "A → C". */
  refused: string[];
}

/**
 * Bepaal wat Dissolve op `rootIds` doet, op de bevroren state.
 *
 * Een samenvattingstaak met zijn tak telt als één blok: elke voorganger van buiten de tak (naar
 * de kopregel of naar een kind) gaat naar elke opvolger buiten de tak. Weggehaalde taken die
 * onderling gekoppeld zijn worden doorlopen, zodat A → B → C → D met B en C samen A → D geeft.
 * Losse weggehaalde taken worden niet aan elkaar geknoopt: B en D in A → B → C → D → E geeft
 * A → C en C → E, niet A → E.
 *
 * Een relatie op een fase die blijft geldt in de rekenkern voor elke taak eronder: A → P met B in
 * P is ook A → B. Zo'n voorganger of opvolger telt daarom mee (`via`); is de andere kant ook een
 * weggehaalde taak, of een fase met weggehaalde taken eronder, dan loopt de keten via die relatie door. Een brug is niet nodig als een
 * einde-begin op de fase de keten al draagt: naar een taak in die fase, of als beide kanten via
 * fasen boven hetzelfde blok lopen en er onder die fasen nog een echte taak overblijft. Een relatie
 * van een andere soort draagt de keten niet; dan komt de einde-begin ernaast (review #937 ronde 3).
 *
 * Een externe voorganger of opvolger (een taak in een ander project) telt ook mee: E ⇢ B → C wordt
 * E ⇢ C, en A → B ⇢ E wordt A ⇢ E (wrakko 2026-11-14, uit het besluit "elke voorganger naar elke
 * opvolger"). De nieuwe externe relatie houdt het anker en de bron van de oude. Het anker is de
 * datum van één kant van de brontaak; vraagt einde-begin de andere kant, dan weigert de app de
 * koppeling, net als bij kopiëren (`externalAnchorSideIsCompatible`).
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
  // stand "alleen de kopregel" heeft de store-actie de kopregels al met `headerTransfers` weggehaald.
  const blockOf = (id: string): string => {
    let current = id;
    for (;;) {
      const parent = byId.get(current)?.parentId;
      if (!parent || !removeIds.has(parent)) return current;
      current = parent;
    }
  };

  const into = new Map<string, Endpoint[]>(); // blok → voorgangers die blijven
  const out = new Map<string, Endpoint[]>(); // blok → opvolgers die blijven
  const next = new Map<string, Set<string>>(); // blok → blokken waar het naar wijst
  const connect = (from: string, to: string) => {
    if (from === to) return;
    const set = next.get(from) ?? new Set<string>();
    set.add(to);
    next.set(from, set);
  };
  const push = (map: Map<string, Endpoint[]>, key: string, value: Endpoint) => {
    const list = map.get(key);
    const same = list?.find(e => e.id === value.id && e.link === value.link && e.via === value.via);
    if (same) same.fs ||= value.fs; // een einde-begin naast een andere soort op dezelfde fase telt.
    else if (list) list.push(value);
    else map.set(key, [value]);
  };
  const isWithin = (id: string, ancestorId: string): boolean => {
    for (let p = byId.get(id)?.parentId; p; p = byId.get(p)?.parentId) if (p === ancestorId) return true;
    return false;
  };
  // Per blijvende fase de blokken eronder: een relatie op die fase geldt ook voor hen.
  const blocks = [...removeIds].filter(id => blockOf(id) === id);
  const blocksUnder = new Map<string, string[]>();
  for (const block of blocks) {
    for (let via = byId.get(block)?.parentId; via; via = byId.get(via)?.parentId) {
      const list = blocksUnder.get(via);
      if (list) list.push(block);
      else blocksUnder.set(via, [block]);
    }
  }
  // De blokken aan één kant van een relatie: het blok van een weggehaalde taak, of de blokken onder
  // een blijvende fase.
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
  // Externe relaties: van een weggehaalde taak, of van een blijvende fase boven een blok.
  const pushExternal = (block: string, links: readonly ExternalLink[] | undefined, via?: string) => {
    for (const link of links ?? []) {
      push(link.direction === 'predecessor' ? into : out, block, via ? { link, via, fs: link.relType === 'FS' } : { link });
    }
  };
  for (const id of removeIds) pushExternal(blockOf(id), byId.get(id)?.externalLinks);
  for (const [via, under] of blocksUnder) for (const block of under) pushExternal(block, byId.get(via)?.externalLinks, via);

  // De boom zoals hij na het weghalen is: ook `childIds` van een ouder die blijft, want de
  // kringtoets vouwt relaties op een fase uit over zijn kinderen.
  const remainingTasks = tasks
    .filter(task => !removeIds.has(task.id))
    .map(task => (task.childIds.some(id => removeIds.has(id))
      ? { ...task, childIds: task.childIds.filter(id => !removeIds.has(id)) }
      : task));
  const remainingById = new Map(remainingTasks.map(task => [task.id, task] as const));
  // Houdt de fase na het weghalen nog een echte taak? Anders draagt een relatie erop niets meer.
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
    // Alle opvolgers die je vanuit dit blok via weggehaalde taken bereikt.
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
        // Beide kanten via einde-begin op fasen boven hetzelfde blok: die fasen dragen de keten zelf,
        // zolang onder de diepste ervan een echte taak overblijft.
        if (pred.fs && succ.fs && succ.block === block
          && carries(isWithin(pred.via!, succ.via!) ? pred.via! : succ.via!)) continue;
        // Een einde-begin op de fase geldt al voor de taken erin.
        if (pred.fs && succ.id !== undefined && isWithin(succ.id, pred.via!)) continue;
        if (succ.fs && pred.id !== undefined && isWithin(pred.id, succ.via!)) continue;
        const key = `${pred.id ?? pred.link.id}|${succ.id ?? succ.link.id}`;
        if (done.has(key)) continue;
        done.add(key);
        if (pred.link && succ.link) continue; // beide kanten in een ander project: niets te koppelen.
        if (pred.link || succ.link) {
          const external = pred.link ? { taskId: succ.id!, link: pred.link } : { taskId: pred.id!, link: succ.link! };
          // Een bestaande einde-begin naar dezelfde brontaak blijft; dan is er niets te weigeren.
          if (hasExternalFinishStart(byId.get(external.taskId), externalBridges, external.taskId, external.link)) continue;
          const bridge = externalBridge(external.link);
          if (bridge) externalBridges.push({ taskId: external.taskId, link: bridge });
          else refused.push(`${name(pred)} → ${name(succ)}`);
          continue;
        }
        const predecessorId = pred.id;
        const successorId = succ.id!;
        // Een brug naar zichzelf (X → blok → X) weigert `relationAddVerdict`; zo komt hij in de melding.
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

/** De externe relatie als einde-begin zonder vertraging, of `null` als het anker de andere kant is. */
function externalBridge(link: ExternalLink): Omit<ExternalLink, 'id'> | null {
  if (!externalAnchorSideIsCompatible(link.direction, link.relType, link.direction, 'FS')) return null;
  const next: Partial<ExternalLink> = { ...link, relType: 'FS', lagDays: 0 };
  delete next.id;
  delete next.lagMinutes;
  return next as Omit<ExternalLink, 'id'>;
}

/** Heeft de taak (of een eerdere brug) al een externe einde-begin naar dezelfde brontaak? */
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

/**
 * Bestaande relatie tussen voorganger en opvolger (eigenaarsbesluit 2026-11-14): alleen een
 * einde-begin telt als "al gekoppeld"; die blijft zoals ze is, met haar vertraging. Een relatie van
 * een andere soort blijft ook staan en de einde-begin komt ernaast, want via de weggehaalde taak moest
 * de opvolger wachten tot de voorganger klaar was.
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
 * haar eerste en laatste subtaken, met soort en vertraging (eigenaarsbesluit 2026-11-14). Een
 * relatie op een fase geldt in de rekenkern voor elke taak eronder; overzetten naar de eerste en
 * laatste houdt de planning gelijk zolang de fase intern aaneengeschakeld is, zonder een pijl naar
 * elke subtaak.
 *
 * Eerste en laatste worden op de echte taken (bladtaken) bepaald, want daar rekent de solver mee:
 * een bladtaak is eerste als ze binnen de fase geen voorganger heeft, laatste als ze er geen
 * opvolger heeft. Een relatie op een subfase telt daarbij voor al haar bladtaken. Daarna wordt het
 * weer leesbaar gemaakt: staan alle bladtaken van een subtaak aan die kant, dan krijgt die subtaak
 * de relatie als geheel; anders gaat de relatie naar de subtaken daarbinnen die het wel zijn. Een
 * lege WBS-fase (`isSummary` zonder kinderen) heeft geen bladtaken en telt niet mee, net als in de
 * rekenkern. `first` en `last` gebruikt de store-actie ook voor de externe relaties van de kopregel.
 */
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
    if (from.length === 0 || to.length === 0) continue; // de rekenkern laat zo'n relatie ook vallen.
    for (const leaf of from) hasSuccessor.add(leaf);
    for (const leaf of to) hasPredecessor.add(leaf);
  }
  // De hoogste subtaken waarvan alle bladtaken aan deze kant staan.
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

/** Een kopie van `seq` met andere eindpunten en zonder id. */
function withEndpoints(seq: Sequence, predecessorId: string, successorId: string): Omit<Sequence, 'id'> {
  const next: Partial<Sequence> = { ...seq, predecessorId, successorId };
  delete next.id;
  return next as Omit<Sequence, 'id'>;
}
