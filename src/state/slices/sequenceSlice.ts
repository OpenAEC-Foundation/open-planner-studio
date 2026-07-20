import type { Sequence } from '@/types/sequence';
import { generateId } from '@/utils/id';
import { beginUndoable, finishMutation } from '../transaction';
import type { AppSlice } from './types';

export interface SequenceSlice {
  sequences: Sequence[];
  addSequence: (seq: Omit<Sequence, 'id'>) => string;
  /** Wijzig type/lag van een bestaande relatie. Geeft false terug wanneer de wijziging een
   *  duplicaat (zelfde voorganger+opvolger+type) zou opleveren en daarom genegeerd is. */
  updateSequence: (id: string, patch: Partial<Omit<Sequence, 'id' | 'predecessorId' | 'successorId'>>) => boolean;
  removeSequence: (id: string) => void;
}

export const createSequenceSlice: AppSlice<SequenceSlice> = (set) => ({
  sequences: [],

  addSequence: (seq) => {
    const id = generateId('seq');
    set((s) => {
      // Voorkom exacte duplicaten, maar sta wél meerdere relatietypes tussen hetzelfde paar toe
      // (bv. SS+FF als overlap/ladder-koppeling) — type meewegen, anders verdwijnt de 2e relatie stil.
      const exists = s.sequences.some(
        e => e.predecessorId === seq.predecessorId && e.successorId === seq.successorId && e.type === seq.type
      );
      if (exists) return; // afgewezen duplicaat: geen snapshot, geen loze undo-stap (R3).
      beginUndoable(s); // snapshot pas ná de guard, vóór de mutatie (zie transaction.ts).
      s.sequences.push({ ...seq, id });
      finishMutation(s, { stale: true }); // nieuwe relatie (A6): planning verouderd tot F5.
    });
    return id;
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
      beginUndoable(s);
      if (patch.type !== undefined) seq.type = patch.type;
      if ('lagDays' in patch) seq.lagDays = Number.isFinite(patch.lagDays) ? (patch.lagDays as number) : 0;
      // lagUnit/lagPercent expliciet op undefined zetten = terug naar default (werkdagen / vaste lag).
      if ('lagUnit' in patch) seq.lagUnit = patch.lagUnit;
      if ('lagPercent' in patch) seq.lagPercent = patch.lagPercent;
      finishMutation(s, { stale: true }); // relatie-wijziging (A6): planning verouderd tot F5.
      applied = true;
    });
    return applied;
  },

  removeSequence: (id) =>
    set((s) => {
      beginUndoable(s);
      s.sequences = s.sequences.filter(seq => seq.id !== id);
      finishMutation(s, { stale: true }); // verwijderde relatie (A6): planning verouderd tot F5.
    }),
});
