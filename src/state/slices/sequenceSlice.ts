import type { Sequence } from '@/types/sequence';
import { generateId } from '@/utils/id';
import { createSnapshot } from '../snapshot';
import type { AppSlice } from './types';

export interface SequenceSlice {
  sequences: Sequence[];
  addSequence: (seq: Omit<Sequence, 'id'>) => string;
  updateSequence: (id: string, updates: Partial<Pick<Sequence, 'type' | 'lagDays'>>) => void;
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

  updateSequence: (id, updates) =>
    set((s) => {
      const seq = s.sequences.find((e) => e.id === id);
      if (!seq) return;

      // Zou de wijziging een exact duplicaat maken van een andere relatie tussen
      // hetzelfde paar? Dan negeren — spiegelt de dedup-regel in addSequence.
      const next = { ...seq, ...updates };
      const clash = s.sequences.some(
        (e) =>
          e.id !== id &&
          e.predecessorId === next.predecessorId &&
          e.successorId === next.successorId &&
          e.type === next.type
      );
      if (clash) return;

      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      Object.assign(seq, updates);
      s.isDirty = true;
    }),

  removeSequence: (id) =>
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.sequences = s.sequences.filter(seq => seq.id !== id);
      s.isDirty = true;
    }),
});
