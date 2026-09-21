// splitEdit.ts — het ENE bewerkmodel voor gebruikerssplits (issue #146). Gantt, eigenschappenpaneel
// en MCP rekenen nooit zelf op `afterMinutes`/`gapMinutes`: de H1-as (elk gat telt mee in de
// aspositie van het volgende, zie `splitWalk.ts`) wordt hier één keer vertaald naar STUKKEN — een
// afwisselende lijst werk/pauze/werk in werkminuten — en weer terug. Puur: geen store, geen kalender.
//
// NIET-WÉLGEVORMDE lijsten (overlap, gat voorbij het werktotaal, ongesorteerd, niet-eindig) kan dit
// model niet dragen zonder data te vernietigen; `toSplitPieces` geeft dan `null` en de aanroeper
// behandelt de taak als alleen-lezen. Er wordt NOOIT stil genormaliseerd.
import type { TaskSplitGap } from '@/types/task';

export type SplitPiece =
  | { kind: 'work'; minutes: number }
  | { kind: 'gap'; minutes: number; source?: 'leveling' | 'user' };

const EPS = 1e-6;

export function isWellFormedSplit(gaps: readonly TaskSplitGap[] | undefined, totalWorkMinutes: number): boolean {
  if (!gaps || gaps.length === 0) return true;
  if (!(totalWorkMinutes > 0)) return false;
  let axis = 0;
  let work = 0;
  for (const g of gaps) {
    if (!Number.isFinite(g.afterMinutes) || !Number.isFinite(g.gapMinutes) || !(g.gapMinutes > 0)) return false;
    const segment = g.afterMinutes - axis;
    if (!(segment > EPS)) return false;                 // overlap, ongesorteerd of gat op positie 0
    work += segment;
    if (!(work < totalWorkMinutes - EPS)) return false; // gat op of voorbij het werktotaal
    axis = g.afterMinutes + g.gapMinutes;
  }
  return true;
}

export function toSplitPieces(gaps: readonly TaskSplitGap[] | undefined, totalWorkMinutes: number): SplitPiece[] | null {
  if (!isWellFormedSplit(gaps, totalWorkMinutes)) return null;
  const pieces: SplitPiece[] = [];
  let axis = 0;
  let work = 0;
  for (const g of gaps ?? []) {
    const segment = g.afterMinutes - axis;
    pieces.push({ kind: 'work', minutes: segment });
    pieces.push(g.source ? { kind: 'gap', minutes: g.gapMinutes, source: g.source } : { kind: 'gap', minutes: g.gapMinutes });
    work += segment;
    axis = g.afterMinutes + g.gapMinutes;
  }
  pieces.push({ kind: 'work', minutes: totalWorkMinutes - work });
  return pieces;
}

/** `original` (optioneel): de gatenlijst waaruit `pieces` kwam. Een ongewijzigd gat wordt dan met
 *  zijn OORSPRONKELIJKE getallen teruggegeven — `(a − b) + b` is in floats niet altijd `a`, en
 *  alleen-kijken mag een bestand nooit wijzigen. */
export function fromSplitPieces(pieces: readonly SplitPiece[], original?: readonly TaskSplitGap[]): { gaps: TaskSplitGap[]; totalWorkMinutes: number } {
  const gaps: TaskSplitGap[] = [];
  let axis = 0;
  let work = 0;
  for (const p of pieces) {
    if (p.kind === 'work') { axis += p.minutes; work += p.minutes; continue; }
    const o = original?.[gaps.length];
    const same = o && Math.abs(o.afterMinutes - axis) < EPS && Math.abs(o.gapMinutes - p.minutes) < EPS && o.source === p.source;
    if (same) { gaps.push({ ...o }); axis = o.afterMinutes + o.gapMinutes; continue; }
    gaps.push(p.source ? { afterMinutes: axis, gapMinutes: p.minutes, source: p.source } : { afterMinutes: axis, gapMinutes: p.minutes });
    axis += p.minutes;
  }
  return { gaps, totalWorkMinutes: work };
}
