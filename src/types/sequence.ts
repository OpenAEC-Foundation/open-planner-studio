export type SequenceType =
  | 'FINISH_START'
  | 'FINISH_FINISH'
  | 'START_START'
  | 'START_FINISH';

export interface Sequence {
  id: string;
  predecessorId: string;
  successorId: string;
  type: SequenceType;
  lagDays: number; // positive = lag, negative = lead
}

export const SEQUENCE_LABELS: Record<SequenceType, string> = {
  FINISH_START: 'ES (Eind-Start)',
  FINISH_FINISH: 'EE (Eind-Eind)',
  START_START: 'SS (Start-Start)',
  START_FINISH: 'SE (Start-Eind)',
};
