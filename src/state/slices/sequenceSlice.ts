import type { Sequence } from '@/types/sequence';
import { generateId } from '@/utils/id';
import { createSnapshot } from '../snapshot';
import type { AppSlice } from './types';

export interface SequenceSlice {
  sequences: Sequence[];
  addSequence: (seq: Omit<Sequence, 'id'>) => string;
  removeSequence: (id: string) => void;
}

export const createSequenceSlice: AppSlice<SequenceSlice> = (set) => ({
  sequences: [],

  addSequence: (seq) => {
    const id = generateId('seq');
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      // Voorkom exacte duplicaten, maar sta wél meerdere relatietypes tussen hetzelfde paar toe
      // (bv. SS+FF als overlap/ladder-koppeling) — type meewegen, anders verdwijnt de 2e relatie stil.
      const exists = s.sequences.some(
        e => e.predecessorId === seq.predecessorId && e.successorId === seq.successorId && e.type === seq.type
      );
      if (!exists) {
        s.sequences.push({ ...seq, id });
        s.isDirty = true;
      }
    });
    return id;
  },

  removeSequence: (id) =>
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.sequences = s.sequences.filter(seq => seq.id !== id);
      s.isDirty = true;
    }),
});
