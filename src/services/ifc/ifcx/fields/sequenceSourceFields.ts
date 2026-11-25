import type { Sequence } from '@/types/sequence';
import { BOOLEAN, type IfcxField } from '../fieldTable';
import { passthroughField } from './passthroughFields';
import type { SequenceReadTarget, SequenceWriteSource } from './sequenceFields';

export const SEQUENCE_SOURCE_FIELDS: readonly IfcxField<SequenceWriteSource, SequenceReadTarget>[] = [
  passthroughField<SequenceWriteSource, SequenceReadTarget, boolean>(
    'p6StartAtPredecessorFinishBoundary', BOOLEAN, source => source.sequence.p6StartAtPredecessorFinishBoundary,
    (target, stored) => { target.sequence.p6StartAtPredecessorFinishBoundary = stored; },
  ),
];

export const SEQUENCE_SOURCE_KEYS_CARRIED = SEQUENCE_SOURCE_FIELDS.map(field => field.key as keyof Sequence);
