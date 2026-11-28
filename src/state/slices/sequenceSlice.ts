import type { Sequence } from '@/types/sequence';
import { generateId } from '@/utils/id';
import { sameValue } from '@/utils/sameValue';
import { relationAddVerdict } from '../relationRules';
import type { AppSliceFactory } from './types';

export interface SequenceSlice {
  sequences: Sequence[];
  addSequence: (seq: Omit<Sequence, 'id'>) => string | null;
  updateSequence: (id: string, patch: Partial<Omit<Sequence, 'id' | 'predecessorId' | 'successorId'>>) => boolean;
  removeSequence: (id: string) => void;
}

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
    const current = get();
    if (!relationAddVerdict(current.tasks, current.sequences, seq).ok) return null;
    const id = generateId('seq');
    set((s) => {
      runtime.beginUndoable(s);
      s.sequences.push({ ...seq, id });
      runtime.finishMutation(s, { stale: true });
    });
    return id;
  },

  updateSequence: (id, patch) => {
    let applied = false;
    set((s) => {
      const seq = s.sequences.find(e => e.id === id);
      if (!seq) return;
      const next = patchedSequence(seq, patch);
      if (sameValue(seq, next)) {
        applied = true;
        return;
      }
      const collides = next.type !== seq.type && s.sequences.some(
        e => e.id !== id && e.predecessorId === seq.predecessorId
          && e.successorId === seq.successorId && e.type === next.type
      );
      if (collides) return;
      runtime.beginUndoable(s);
      Object.assign(seq, next);
      runtime.finishMutation(s, { stale: true });
      applied = true;
    });
    return applied;
  },

  removeSequence: (id) =>
    set((s) => {
      if (!s.sequences.some(seq => seq.id === id)) return;
      runtime.beginUndoable(s);
      s.sequences = s.sequences.filter(seq => seq.id !== id);
      runtime.finishMutation(s, { stale: true });
    }),
});
