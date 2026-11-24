import type { LagUnit, SequenceType } from '@/types/sequence';
import { LAG_SLOT, lagValueSlot } from './ifcLagTimeSlots';
import { OWNER_HISTORY_SOORTEN, slotIndex, type SlotPositions, type WriteSlot } from './ifcSlotSoort';

export interface SequenceWriteCtx {
  guidArg: string;
  ownerHistId: number;
  relatingProcessArg: string;
  relatedProcessArg: string;
  timeLagArg: string;
  sequenceType: SequenceType;
}

const SEQUENCE_TABLE = [
  { key: 'globalId', soort: 'domein', write: (w) => w.guidArg },
  { key: 'ownerHistory', ...OWNER_HISTORY_SOORTEN, write: (w) => `#${w.ownerHistId}` },
  { key: 'name', soort: 'constant', write: () => '$' },
  { key: 'description', soort: 'constant', write: () => '$' },
  { key: 'relatingProcess', soort: 'verwijzing', write: (w) => w.relatingProcessArg },
  { key: 'relatedProcess', soort: 'verwijzing', write: (w) => w.relatedProcessArg },
  { key: 'timeLag', soort: 'verwijzing', write: (w) => w.timeLagArg },
  { key: 'sequenceType', soort: 'domein', write: (w) => `.${w.sequenceType}.` },
  { key: 'userDefinedSequenceType', soort: 'constant', volgt: 'sequenceType', write: () => '$' },
] as const satisfies readonly WriteSlot<SequenceWriteCtx>[];

export type SequenceSlotKey = (typeof SEQUENCE_TABLE)[number]['key'];

export const IFC_SEQUENCE_SLOTS: readonly WriteSlot<SequenceWriteCtx, SequenceSlotKey>[] = SEQUENCE_TABLE;

export const SEQUENCE_SLOT = slotIndex(IFC_SEQUENCE_SLOTS);

export interface LagTimeWriteCtx {
  lagValueArg: string;
  durationType: LagUnit;
}

const LAG_TIME_TABLE = [
  { key: 'name', soort: 'constant', write: () => "'Lag'" },
  { key: 'dataOrigin', soort: 'constant', write: () => '.PREDICTED.' },
  { key: 'userDefinedDataOrigin', soort: 'constant', write: () => '$' },
  { key: 'lagValue', soort: 'domein', write: (w) => w.lagValueArg },
  { key: 'durationType', soort: 'domein', write: (w) => `.${w.durationType}.` },
] as const satisfies readonly WriteSlot<LagTimeWriteCtx>[];

export type LagTimeSlotKey = (typeof LAG_TIME_TABLE)[number]['key'];

export const IFC_LAG_TIME_SLOTS: readonly WriteSlot<LagTimeWriteCtx, LagTimeSlotKey>[] = LAG_TIME_TABLE;

export const LAG_TIME_SLOT = slotIndex(IFC_LAG_TIME_SLOTS);

const LEGACY_OPS_LAG_TIME_SLOT: SlotPositions<LagTimeSlotKey> = {
  ...LAG_TIME_SLOT, lagValue: LAG_TIME_SLOT.durationType, durationType: LAG_TIME_SLOT.lagValue,
};

export function lagTimeSlots(args: readonly string[]): SlotPositions<LagTimeSlotKey> {
  return lagValueSlot(args).kind === LAG_SLOT.oud ? LEGACY_OPS_LAG_TIME_SLOT : LAG_TIME_SLOT;
}
