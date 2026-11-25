import type { LagUnit, Sequence, SequenceType } from '@/types/sequence';
import { enumOf, NON_EMPTY_TEXT, objectOf, REAL, REFERENCE, type IfcxField, type IfcxValue, type SharedField } from '../fieldTable';

export interface SequenceWriteSource {
  readonly sequence: Sequence;
  readonly path: string;
  readonly predecessorPath: string;
  readonly successorPath: string;
  readonly shared: SharedLag;
}

export interface SequenceReadTarget {
  readonly sequence: Sequence;
  readonly path: string;
  predecessorPath: string;
  successorPath: string;
}

type SequenceField = IfcxField<SequenceWriteSource, SequenceReadTarget>;

export interface SharedLag {
  timeLag?: string;
  timeLagRatio?: number;
}

export const LAG_AMOUNT_UNITS = ['DAYS', 'MINUTES', 'PERCENT'] as const;
type LagAmountUnit = typeof LAG_AMOUNT_UNITS[number];

interface PreciseLag {
  readonly amount: number;
  readonly unit: LagAmountUnit;
}

const SEQUENCE_TYPE = enumOf(['FINISH_START', 'START_START', 'FINISH_FINISH', 'START_FINISH']);
const LAG_UNIT = enumOf(['WORKTIME', 'ELAPSEDTIME']);
const PLAIN_NUMBER = /^\d+(\.\d+)?$/;

const TIME_LAG: IfcxValue = {
  dataType: 'String', form: { name: 'ISO 8601-duur P<dagen>D of PT<minuten>M, met een minteken voor een lead', pattern: /^-?P(\d+(\.\d+)?D|T\d+(\.\d+)?M)$/ },
};

const LAG: IfcxValue = objectOf({ amount: { value: REAL }, unit: { value: enumOf(LAG_AMOUNT_UNITS) } });

function isoLag(amount: number, designator: 'D' | 'M'): string | undefined {
  const magnitude = String(Math.abs(amount));
  if (!PLAIN_NUMBER.test(magnitude)) return undefined;
  return `${amount < 0 ? '-' : ''}${designator === 'D' ? 'P' : 'PT'}${magnitude}${designator}`;
}

const finite = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value);

function preciseLagOf(sequence: Sequence): PreciseLag | undefined {
  if (finite(sequence.lagPercent)) return { amount: sequence.lagPercent, unit: 'PERCENT' };
  if (finite(sequence.lagMinutes)) return { amount: sequence.lagMinutes, unit: 'MINUTES' };
  return sequence.lagDays !== 0 ? { amount: sequence.lagDays, unit: 'DAYS' } : undefined;
}

export function sharedLagOf(sequence: Sequence): SharedLag {
  const lag = preciseLagOf(sequence);
  if (lag?.unit === 'PERCENT') return { timeLagRatio: lag.amount / 100 };
  const timeLag = isoLag(lag?.amount ?? 0, lag?.unit === 'MINUTES' ? 'M' : 'D');
  return timeLag ? { timeLag } : {};
}

function applyPreciseLag(sequence: Sequence, lag: PreciseLag | undefined): void {
  sequence.lagDays = lag?.unit === 'DAYS' ? lag.amount : 0;
  if (lag?.unit === 'MINUTES') sequence.lagMinutes = lag.amount;
  if (lag?.unit === 'PERCENT') sequence.lagPercent = lag.amount;
}

export const SEQUENCE_SHARED_FIELDS: readonly SharedField<SequenceWriteSource>[] = [
  { key: 'relatingProcess', value: REFERENCE, write: s => s.predecessorPath },
  { key: 'relatedProcess', value: REFERENCE, write: s => s.successorPath },
  { key: 'sequenceType', value: SEQUENCE_TYPE, write: s => s.sequence.type },
  { key: 'timeLag', value: TIME_LAG, optional: true, write: s => s.shared.timeLag },
  { key: 'timeLagRatio', value: REAL, optional: true, write: s => s.shared.timeLagRatio },
  { key: 'lagDurationType', value: LAG_UNIT, optional: true, write: s => s.sequence.lagUnit },
];

export const SEQUENCE_FIELDS: readonly SequenceField[] = [
  {
    key: 'id', value: NON_EMPTY_TEXT, optional: true,
    write: s => (s.sequence.id !== s.path ? s.sequence.id : undefined),
    read: (v, t) => { t.sequence.id = (v as string | undefined) ?? t.path; },
  },
  {
    key: 'predecessor', value: REFERENCE,
    write: s => s.predecessorPath,
    read: (v, t) => { t.predecessorPath = v as string; },
  },
  {
    key: 'successor', value: REFERENCE,
    write: s => s.successorPath,
    read: (v, t) => { t.successorPath = v as string; },
  },
  {
    key: 'type', value: SEQUENCE_TYPE,
    write: s => s.sequence.type,
    read: (v, t) => { t.sequence.type = v as SequenceType; },
  },
  {
    key: 'lagUnit', value: LAG_UNIT, optional: true,
    write: s => s.sequence.lagUnit,
    read: (v, t) => { if (v !== undefined) t.sequence.lagUnit = v as LagUnit; },
  },
  {
    key: 'lag', value: LAG, optional: true,
    write: s => preciseLagOf(s.sequence),
    read: (v, t) => applyPreciseLag(t.sequence, v as PreciseLag | undefined),
  },
];

export const SEQUENCE_KEYS_CARRIED: readonly (keyof Sequence)[] = [
  'id', 'predecessorId', 'successorId', 'type', 'lagDays', 'lagMinutes', 'lagUnit', 'lagPercent',
];

export function emptySequence(): Sequence {
  return { id: '', predecessorId: '', successorId: '', type: 'FINISH_START', lagDays: 0 };
}
