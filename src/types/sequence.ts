export type SequenceType =
  | 'FINISH_START'
  | 'FINISH_FINISH'
  | 'START_START'
  | 'START_FINISH';

export type LagUnit = 'WORKTIME' | 'ELAPSEDTIME';

export interface Sequence {
  id: string;
  predecessorId: string;
  successorId: string;
  type: SequenceType;
  lagDays: number;
  lagMinutes?: number;
  lagUnit?: LagUnit;
  p6StartAtPredecessorFinishBoundary?: boolean;
  lagPercent?: number;
}

export const SEQUENCE_TYPE_OPTIONS: { value: SequenceType; label: string }[] = [
  { value: 'FINISH_START', label: 'FS' },
  { value: 'START_START', label: 'SS' },
  { value: 'FINISH_FINISH', label: 'FF' },
  { value: 'START_FINISH', label: 'SF' },
];
