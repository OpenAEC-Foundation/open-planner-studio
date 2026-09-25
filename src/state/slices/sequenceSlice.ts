import type { Sequence } from '@/types/sequence';
import { generateId } from '@/utils/id';
import { sameValue } from '@/utils/sameValue';
import { relationAddVerdict } from '../relationRules';
import type { AppSliceFactory } from './types';

export interface SequenceSlice {
  sequences: Sequence[];
  /** Retourneert het nieuwe id, of `null` wanneer de relatie geweigerd is (duplicaat, zelfrelatie,
   *  onbekende taak, een taak gekoppeld aan zijn eigen (voor)ouder-samenvatting, of een relatie die
   *  een kring zou sluiten — zie `relationAddVerdict` in `relationRules.ts`). Een gewoon
   *  verzameltaak-eindpunt is sinds 2026-08-15 GEEN weigergrond meer: `runCPM`/`solveProject`
   *  rekenen zo'n relatie via `expandSummaryRelations` door naar de onderliggende bladtaken. */
  addSequence: (seq: Omit<Sequence, 'id'>) => string | null;
  /** Wijzig type/lag van een bestaande relatie. Geeft false terug wanneer de relatie onbekend is of
   *  de wijziging een duplicaat (zelfde voorganger+opvolger+type) zou opleveren en daarom genegeerd
   *  is. Verandert de patch per saldo niets (structureel, `sameValue` — zoals `updateTask`), dan is
   *  hij een no-op: geen undo-stap, geen `isDirty`, geen verouderde planning; de relatie staat dan al
   *  zoals gevraagd, dus het antwoord is `true`. */
  updateSequence: (id: string, patch: Partial<Omit<Sequence, 'id' | 'predecessorId' | 'successorId'>>) => boolean;
  removeSequence: (id: string) => void;
}

/**
 * De relatie zoals `updateSequence` haar achterlaat — één plek voor de patchregels, zodat de
 * no-op-vergelijking en de mutatie niet uit elkaar kunnen lopen: `type` alleen als hij is
 * meegegeven, `lagDays` genormaliseerd naar een eindig getal.
 *
 * lagUnit/lagPercent/lagMinutes expliciet op undefined zetten = terug naar default (werkdagen /
 * vaste lag). lagMinutes was hier eerder afwezig (F1-bevinding): de UI zette hem via een rauwe
 * setState omheen, waardoor uren-lag de reguliere actie (en dus undo/transactiebewaking) omzeilde.
 * De solver leest lagPercent → lagMinutes → lagDays, dus een ongefilterde `Number.isFinite`-guard
 * i.p.v. `!in`-check zou een expliciete `undefined` (= "wis de minuut-lag") laten staan; daarom net
 * als lagUnit/lagPercent een kale toewijzing, geen omzetting naar 0.
 */
function patchedSequence(
  seq: Sequence,
  patch: Partial<Omit<Sequence, 'id' | 'predecessorId' | 'successorId'>>,
): Sequence {
  const next: Sequence = { ...seq };
  if (patch.type !== undefined) next.type = patch.type;
  if ('lagDays' in patch) next.lagDays = Number.isFinite(patch.lagDays) ? (patch.lagDays as number) : 0;
  if ('lagUnit' in patch) next.lagUnit = patch.lagUnit;
  if ('lagPercent' in patch) next.lagPercent = patch.lagPercent;
  if ('lagMinutes' in patch) next.lagMinutes = patch.lagMinutes;
  return next;
}

export const createSequenceSlice: AppSliceFactory<SequenceSlice> = (runtime) => (set, get) => ({
  sequences: [],

  addSequence: (seq) => {
    // Alle regels (dedup, zelfrelatie, onbekende taak, voorouder-eindpunt, kring) staan in
    // relationRules.ts — één bron, gedeeld met de meldingswrapper (`relationActions.ts`). Getoetst
    // tegen de bevroren state vóór de producer: de kringtoets loopt over de hele relatiegraaf en
    // hoeft niet door Immer-proxies te lezen.
    const current = get();
    if (!relationAddVerdict(current.tasks, current.sequences, seq).ok) return null; // geen snapshot, geen loze undo-stap (R3).
    const id = generateId('seq');
    set((s) => {
      runtime.beginUndoable(s); // snapshot pas ná de guard, vóór de mutatie (zie transaction.ts).
      s.sequences.push({ ...seq, id });
      runtime.finishMutation(s, { stale: true }); // nieuwe relatie (A6): planning verouderd tot F5.
    });
    return id;
  },

  updateSequence: (id, patch) => {
    let applied = false;
    set((s) => {
      const seq = s.sequences.find(e => e.id === id);
      if (!seq) return;
      const next = patchedSequence(seq, patch);
      // Per saldo niets gewijzigd — het lag-veld in het eigenschappenpaneel commit bij elke blur,
      // ook als de gebruiker alleen in- en uitklikte (audit taakmutaties, bevinding 9) — ⇒ net als
      // `updateTask`: geen snapshot, geen isDirty, geen stale.
      if (sameValue(seq, next)) {
        applied = true;
        return;
      }
      // Zelfde duplicaat-regel als addSequence: één relatie per (voorganger, opvolger, type).
      const collides = next.type !== seq.type && s.sequences.some(
        e => e.id !== id && e.predecessorId === seq.predecessorId
          && e.successorId === seq.successorId && e.type === next.type
      );
      if (collides) return;
      runtime.beginUndoable(s);
      Object.assign(seq, next);
      runtime.finishMutation(s, { stale: true }); // relatie-wijziging (A6): planning verouderd tot F5.
      applied = true;
    });
    return applied;
  },

  removeSequence: (id) =>
    set((s) => {
      if (!s.sequences.some(seq => seq.id === id)) return; // onbekend id: geen snapshot, geen loze undo-stap.
      runtime.beginUndoable(s);
      s.sequences = s.sequences.filter(seq => seq.id !== id);
      runtime.finishMutation(s, { stale: true }); // verwijderde relatie (A6): planning verouderd tot F5.
    }),
});
