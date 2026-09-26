// De gedeelde staart van "een tak invoegen": plakken (`selectionSlice.pasteTasks`) en een
// WBS-sjabloon invoegen (`taskSlice.insertWbsTemplate`). Beide maken eerst hun eigen taken aan met
// verse ids en eindigen daarna identiek: interne relaties opnieuw aanleggen, WBS-codes toekennen en
// melden hoeveel relaties er niet door de relatieregels kwamen.
//
// Werkt op Immer-drafts (binnen de producer van de aanroeper, na diens `beginUndoable`); de melding
// hoort BUITEN de producer (`notify` doet zelf een `set()`).
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { NotifyInput } from './slices/types';
import { relationVerdict } from './relationRules';
import { generateId } from '@/utils/id';
import { applyWbsNumbering, deriveWbsCodes } from '@/utils/wbs';

/**
 * Legt `relations` opnieuw aan tussen de nieuwe ids uit `idMap` (bron-id → nieuw id). Een spread
 * houdt de optionele lag-velden (lagUnit/lagPercent/…) vast.
 *
 * `relationVerdict` is de bron van de regel, niet alleen de reguliere add-route (`addSequence`): een
 * gekopieerde tak of een sjabloon (app-data uit `localStorage`) kan een relatie dragen die nooit via
 * die route is aangemaakt (bv. een IFC-import schrijft rechtstreeks naar `s.sequences`). De lookup
 * wijst naar `s.tasks` MÉT de zojuist ingevoegde taken, dus de toets ziet de boom zoals hij na het
 * invoegen is — inclusief een voorouderconflict door de invoegplek zelf. De duplicaatcheck loopt
 * tegen `s.sequences` zoals die tot nu toe is opgebouwd, net als `addSequence` per aanroep doet.
 *
 * @returns het aantal overgeslagen relaties.
 */
export function insertRemappedRelations(
  s: { tasks: Task[]; sequences: Sequence[] },
  relations: readonly Omit<Sequence, 'id'>[],
  idMap: ReadonlyMap<string, string>,
): number {
  let skipped = 0;
  const lookup = (tid: string) => s.tasks.find(t => t.id === tid);
  for (const relation of relations) {
    const candidate = {
      ...relation,
      predecessorId: idMap.get(relation.predecessorId)!,
      successorId: idMap.get(relation.successorId)!,
    };
    if (!relationVerdict(lookup, s.sequences, candidate).ok) { skipped++; continue; }
    s.sequences.push({ ...candidate, id: generateId('seq') });
  }
  return skipped;
}

/**
 * WBS-codes voor zojuist ingevoegde taken: bij auto-nummering de hele boom, anders alleen de
 * ingevoegde ids een afgeleide code — anders dupliceren ze de code van hun bron letterlijk of
 * blijven ze leeg (lege codes breken de CSV/MSP-export en -herimport, die op dotted codes koppelen).
 */
export function assignInsertedWbsCodes(
  s: { tasks: Task[]; project: { wbsAutoNumber?: boolean } },
  ids: Iterable<string>,
): void {
  if (s.project.wbsAutoNumber) {
    applyWbsNumbering(s.tasks);
    return;
  }
  const codes = deriveWbsCodes(s.tasks);
  for (const id of ids) {
    const task = s.tasks.find(t => t.id === id);
    const code = codes.get(id);
    if (task && code !== undefined) task.wbsCode = code;
  }
}

/** De melding na het invoegen als er relaties zijn overgeslagen; `dedupeKey` per invoegroute. */
export function notifyRelationsSkipped(
  notify: (n: NotifyInput) => void,
  count: number,
  dedupeKey: string,
): void {
  if (count <= 0) return;
  notify({
    severity: 'info',
    messageKey: 'notifications.relationsSkippedOnInsert',
    params: { count },
    dedupeKey,
  });
}
