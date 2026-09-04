import type { Sequence } from '@/types/sequence';
import { generateId } from '@/utils/id';
import { relationVerdict } from '../relationRules';
import type { AppSliceFactory } from './types';

export interface SequenceSlice {
  sequences: Sequence[];
  /** Retourneert het nieuwe id, of `null` wanneer de relatie geweigerd is (duplicaat, zelfrelatie,
   *  onbekende taak, of een taak gekoppeld aan zijn eigen (voor)ouder-samenvatting — zie
   *  `relationRules.ts`). Een gewoon verzameltaak-eindpunt is sinds 2026-08-15 GEEN weigergrond
   *  meer: `runCPM`/`solveProject` rekenen zo'n relatie via `expandSummaryRelations` door naar de
   *  onderliggende bladtaken. */
  addSequence: (seq: Omit<Sequence, 'id'>) => string | null;
  /** Wijzig type/lag van een bestaande relatie. Geeft false terug wanneer de wijziging een
   *  duplicaat (zelfde voorganger+opvolger+type) zou opleveren en daarom genegeerd is. */
  updateSequence: (id: string, patch: Partial<Omit<Sequence, 'id' | 'predecessorId' | 'successorId'>>) => boolean;
  removeSequence: (id: string) => void;
}

export const createSequenceSlice: AppSliceFactory<SequenceSlice> = (runtime) => (set) => ({
  sequences: [],

  addSequence: (seq) => {
    const id = generateId('seq');
    let accepted = false;
    set((s) => {
      // Alle regels (dedup, zelfrelatie, onbekende taak, verzameltaak-eindpunt) staan in
      // relationRules.ts — één bron, gedeeld met mcpTransaction en de meldingswrapper.
      const lookup = (tid: string) => s.tasks.find((t) => t.id === tid);
      if (!relationVerdict(lookup, s.sequences, seq).ok) return; // geen snapshot, geen loze undo-stap (R3).
      runtime.beginUndoable(s); // snapshot pas ná de guard, vóór de mutatie (zie transaction.ts).
      s.sequences.push({ ...seq, id });
      runtime.finishMutation(s, { stale: true }); // nieuwe relatie (A6): planning verouderd tot F5.
      accepted = true;
    });
    return accepted ? id : null;
  },

  updateSequence: (id, patch) => {
    let applied = false;
    set((s) => {
      const seq = s.sequences.find(e => e.id === id);
      if (!seq) return;
      const nextType = patch.type ?? seq.type;
      // Zelfde duplicaat-regel als addSequence: één relatie per (voorganger, opvolger, type).
      const collides = nextType !== seq.type && s.sequences.some(
        e => e.id !== id && e.predecessorId === seq.predecessorId
          && e.successorId === seq.successorId && e.type === nextType
      );
      if (collides) return;
      runtime.beginUndoable(s);
      if (patch.type !== undefined) seq.type = patch.type;
      if ('lagDays' in patch) seq.lagDays = Number.isFinite(patch.lagDays) ? (patch.lagDays as number) : 0;
      // lagUnit/lagPercent/lagMinutes expliciet op undefined zetten = terug naar default
      // (werkdagen / vaste lag). lagMinutes was hier eerder afwezig (F1-bevinding): de UI zette
      // hem via een rauwe setState omheen, waardoor uren-lag de reguliere actie (en dus undo/
      // transactiebewaking) omzeilde. De solver leest lagPercent → lagMinutes → lagDays, dus een
      // ongefilterde `Number.isFinite`-guard i.p.v. `!in`-check zou een expliciete `undefined`
      // (= "wis de minuut-lag") laten staan; daarom net als lagUnit/lagPercent een kale
      // toewijzing, geen omzetting naar 0.
      if ('lagUnit' in patch) seq.lagUnit = patch.lagUnit;
      if ('lagPercent' in patch) seq.lagPercent = patch.lagPercent;
      if ('lagMinutes' in patch) seq.lagMinutes = patch.lagMinutes;
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
