import { createSnapshot } from './snapshot';
import type { AppState } from './appStore';

/**
 * Transactie-helpers voor het muterende-actie-ritueel (audit P8, bevinding F4/A6).
 *
 * Vóór deze helpers werd het ritueel ~50× met de hand herhaald door `src/state/slices/` heen:
 *   - openen: `s.undoStack.push(createSnapshot(s)); s.redoStack = [];`
 *   - sluiten: `s.isDirty = true;` (vaak + `s.scheduleStale = true;`)
 * Handmatige herhaling laat divergentie insluipen op auteursgeheugen. Deze twee functies zetten het
 * ritueel op ÉÉN plek, terwijl het gedrag per actie EXACT gelijk blijft:
 *
 *   set((s) => {
 *     ...eventuele guard-returns (géén snapshot bij een no-op!)...
 *     beginUndoable(s);        // snapshot + redo-wis, ná de guards en vóór de mutatie
 *     ...mutatie...
 *     finishMutation(s, { stale: true });  // isDirty (+ optioneel scheduleStale)
 *   });
 *   get().recomputeViewRows();  // trailing recomputes blijven bewust expliciet (per-actie-specifiek)
 *
 * BEWUSTE ASYMMETRIEËN blijven uitdrukbaar:
 *   - "dirty zonder undo" (setProject/setCalendar/setStatusDate/… — bibliotheek-CRUD blijft wél
 *     undoable): roep alleen `finishMutation` aan, NIET `beginUndoable`.
 *   - "undo zonder stale" (WBS-nummering, structuur-CRUD, baselines): `finishMutation(s)` zonder
 *     `stale` laat `scheduleStale` bewust met rust.
 *
 * De trailing recomputes (`recomputeViewRows`/`recomputeResourceLoad`) blijven per actie expliciet
 * ná de `set()` staan: hun aanwezigheid, volgorde en conditie (bv. alleen bij `moved`) verschillen
 * per actie en horen bij de recipe, niet bij het generieke ritueel.
 */

/**
 * Open een ongedaan-maakbare mutatie: leg de huidige staat op de undo-stack en wis de redo-stack.
 * ROEP DIT AAN NÁ eventuele guard-returns en VÓÓR de mutatie — zo vervuilt een no-op de undo-stack
 * niet (bewust patroon door de hele state-laag: acties pushen de snapshot pas als er echt iets
 * verandert). `createSnapshot` leest de projectdata key-gedreven uit het documentcontract.
 */
export function beginUndoable(s: AppState): void {
  s.undoStack.push(createSnapshot(s));
  s.redoStack = [];
}

/**
 * Sluit een mutatie af: markeer het document als gewijzigd (`isDirty`) en — indien de mutatie
 * datum-beïnvloedend was (`stale: true`, A6) — de planning als verouderd. `stale` default `false`,
 * zodat puur niet-datum-rakende mutaties (WBS-nummering, structuur-CRUD, baselines) `scheduleStale`
 * bewust NIET zetten (gedocumenteerde asymmetrie).
 */
export function finishMutation(s: AppState, opts?: { stale?: boolean }): void {
  s.isDirty = true;
  if (opts?.stale) s.scheduleStale = true;
}
