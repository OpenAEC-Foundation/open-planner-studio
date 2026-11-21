import type { AppState } from '@/state/appStore';
import { knownDrivingSequenceIds } from '@/engine/scheduler/drivingInfo';

export type RelationStepDirection = 'predecessor' | 'successor';

/**
 * Waar de pijlen in het relatiepaneel heen gaan (issue #888, eigenaarsbesluiten 2026-11-14): links naar
 * een voorganger, rechts naar een opvolger, zodat je met een paar klikken het kritieke pad afloopt.
 *
 * Eén regel voor beide richtingen, voor het geval er meer dan één relatie is:
 *   1. de relatie met de kleinste vrije speling (sturend = 0, dus de sturende voorganger, of de opvolger
 *      die deze taak stuurt);
 *   2. bij gelijke vrije speling de taak met de kleinste totale speling (het meest kritiek);
 *   3. daarna de laagste WBS-code.
 * Weet de app niets over vrije speling (nog niet berekend, een fout, of "Datums zoals opgeslagen"),
 * dan beslissen alleen stap 2 en 3. Een relatie die na de laatste berekening is gelegd heeft nog
 * geen vrije speling en komt achter de relaties die er wel een hebben.
 *
 * @returns de id van de doeltaak, of `null` als er in die richting geen relatie is.
 */
export function relationStepTarget(
  state: Pick<AppState, 'tasks' | 'sequences' | 'cpmResult'>,
  taskId: string,
  direction: RelationStepDirection,
): string | null {
  const tasksById = new Map(state.tasks.map(task => [task.id, task] as const));
  const freeFloatKnown = knownDrivingSequenceIds(state.cpmResult) !== undefined;
  const candidates = state.sequences.flatMap(seq => {
    const otherId = direction === 'predecessor'
      ? (seq.successorId === taskId ? seq.predecessorId : undefined)
      : (seq.predecessorId === taskId ? seq.successorId : undefined);
    const other = otherId === undefined ? undefined : tasksById.get(otherId);
    if (!other) return [];
    const freeFloat = freeFloatKnown ? state.cpmResult?.sequenceFreeFloat[seq.id] : undefined;
    return [{
      id: other.id,
      freeFloat: freeFloat ?? Infinity,
      totalFloat: other.time?.totalFloat ?? Infinity,
      wbs: other.wbsCode,
    }];
  });
  candidates.sort((a, b) => (a.freeFloat - b.freeFloat)
    || (a.totalFloat - b.totalFloat)
    || a.wbs.localeCompare(b.wbs, undefined, { numeric: true }));
  return candidates[0]?.id ?? null;
}
