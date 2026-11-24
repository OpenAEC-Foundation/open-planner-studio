import type { LagUnit, Sequence, SequenceType } from '@/types/sequence';
import { enumOf, REAL, REFERENCE, TEXT, type IfcxField, type IfcxValue } from '../fieldTable';
import type { IfcxIdentity } from '../globalIdUuid';

export interface SequenceWriteSource {
  readonly sequence: Sequence;
  readonly identity: IfcxIdentity;
  readonly predecessorPath: string;
  readonly successorPath: string;
}

export interface SequenceReadTarget {
  readonly sequence: Sequence;
  readonly path: string;
  globalIdOutsidePath?: string;
  predecessorPath: string;
  successorPath: string;
  shared: SharedLag;
}

type SequenceField = IfcxField<SequenceWriteSource, SequenceReadTarget>;

export interface SharedLag {
  timeLag?: string;
  timeLagRatio?: number;
}

export interface LagFromShared {
  readonly lagDays: number;
  readonly lagMinutes?: number;
  readonly lagPercent?: number;
}

const PLAIN_NUMBER = /^\d+(\.\d+)?$/;
const DAYS_LAG = /^(-?)P(\d+(?:\.\d+)?)D$/;
const MINUTES_LAG = /^(-?)PT(\d+(?:\.\d+)?)M$/;

const TIME_LAG: IfcxValue = {
  dataType: 'String', form: { name: 'ISO 8601-duur P<dagen>D of PT<minuten>M, met een minteken voor een lead', pattern: /^-?P(\d+(\.\d+)?D|T\d+(\.\d+)?M)$/ },
};

function isoLag(amount: number, designator: 'D' | 'M'): string | undefined {
  const magnitude = String(Math.abs(amount));
  if (!PLAIN_NUMBER.test(magnitude)) return undefined;
  return `${amount < 0 ? '-' : ''}${designator === 'D' ? 'P' : 'PT'}${magnitude}${designator}`;
}

const finite = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value);

export function sharedLagOf(sequence: Sequence): SharedLag {
  if (finite(sequence.lagPercent)) return { timeLagRatio: sequence.lagPercent / 100 };
  const timeLag = finite(sequence.lagMinutes) ? isoLag(sequence.lagMinutes, 'M') : isoLag(sequence.lagDays, 'D');
  return timeLag ? { timeLag } : {};
}

export function lagFromShared(shared: SharedLag): LagFromShared {
  if (shared.timeLagRatio !== undefined) return { lagDays: 0, lagPercent: shared.timeLagRatio * 100 };
  const minutes = shared.timeLag ? MINUTES_LAG.exec(shared.timeLag) : null;
  if (minutes) return { lagDays: 0, lagMinutes: (minutes[1] ? -1 : 1) * Number(minutes[2]) };
  const days = shared.timeLag ? DAYS_LAG.exec(shared.timeLag) : null;
  return { lagDays: days ? (days[1] ? -1 : 1) * Number(days[2]) : 0 };
}

function unlessDerived<K extends keyof LagFromShared>(source: SequenceWriteSource, key: K): Sequence[K] | undefined {
  const value = source.sequence[key];
  return value !== lagFromShared(sharedLagOf(source.sequence))[key] ? value : undefined;
}

export const SEQUENCE_PLANNING_FIELDS: readonly SequenceField[] = [
  {
    key: 'relatingProcess', value: REFERENCE,
    write: s => s.predecessorPath,
    read: (v, t) => { t.predecessorPath = v as string; },
  },
  {
    key: 'relatedProcess', value: REFERENCE,
    write: s => s.successorPath,
    read: (v, t) => { t.successorPath = v as string; },
  },
  {
    key: 'sequenceType', value: enumOf(['FINISH_START', 'START_START', 'FINISH_FINISH', 'START_FINISH']),
    write: s => s.sequence.type,
    read: (v, t) => { t.sequence.type = v as SequenceType; },
  },
  {
    key: 'timeLag', value: TIME_LAG, optional: true,
    write: s => sharedLagOf(s.sequence).timeLag,
    read: (v, t) => { if (v !== undefined) t.shared.timeLag = v as string; },
  },
  {
    key: 'timeLagRatio', value: REAL, optional: true,
    write: s => sharedLagOf(s.sequence).timeLagRatio,
    read: (v, t) => { if (v !== undefined) t.shared.timeLagRatio = v as number; },
  },
  {
    key: 'lagDurationType', value: enumOf(['WORKTIME', 'ELAPSEDTIME']), optional: true,
    write: s => s.sequence.lagUnit,
    read: (v, t) => { if (v !== undefined) t.sequence.lagUnit = v as LagUnit; },
  },
];

export const SEQUENCE_OPS_FIELDS: readonly SequenceField[] = [
  {
    key: 'id', value: TEXT, optional: true,
    write: s => (s.sequence.id !== s.identity.path ? s.sequence.id : undefined),
    read: (v, t) => { t.sequence.id = (v as string | undefined) ?? t.path; },
  },
  {
    key: 'globalId', value: TEXT, optional: true,
    write: s => s.identity.globalIdOutsidePath,
    read: (v, t) => { t.globalIdOutsidePath = v as string | undefined; },
  },
  {
    key: 'lagDays', value: REAL, optional: true,
    write: s => unlessDerived(s, 'lagDays'),
    read: (v, t) => { t.sequence.lagDays = (v as number | undefined) ?? lagFromShared(t.shared).lagDays; },
  },
  {
    key: 'lagMinutes', value: REAL, optional: true,
    write: s => unlessDerived(s, 'lagMinutes'),
    read: (v, t) => {
      const value = (v as number | undefined) ?? lagFromShared(t.shared).lagMinutes;
      if (value !== undefined) t.sequence.lagMinutes = value;
    },
  },
  {
    key: 'lagPercent', value: REAL, optional: true,
    write: s => unlessDerived(s, 'lagPercent'),
    read: (v, t) => {
      const value = (v as number | undefined) ?? lagFromShared(t.shared).lagPercent;
      if (value !== undefined) t.sequence.lagPercent = value;
    },
  },
];

export const SEQUENCE_KEYS_CARRIED: readonly (keyof Sequence)[] = [
  'id', 'predecessorId', 'successorId', 'type', 'lagDays', 'lagMinutes', 'lagUnit', 'lagPercent',
];

export function emptySequence(): Sequence {
  return { id: '', predecessorId: '', successorId: '', type: 'FINISH_START', lagDays: 0 };
}
