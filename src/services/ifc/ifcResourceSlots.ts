import type { Resource } from '@/types/resource';
import { ifcStr } from './ifcPsets';
import { COST_RESOURCE_OBJECT_TYPE } from './ifcConstants';
import { ABSENT_SLOT, OWNER_HISTORY_SOORTEN, slotIndex, type SlotPositions, type WriteSlot } from './ifcSlotSoort';

export interface ResourceWriteCtx {
  resource: Resource;
  ownerHistId: number;
  guidArg: string;
}

const isCostResource = (w: ResourceWriteCtx) => w.resource.type === 'COST';

const RESOURCE_TABLE = [
  { key: 'globalId', soort: 'domein', write: (w) => w.guidArg },
  { key: 'ownerHistory', ...OWNER_HISTORY_SOORTEN, write: (w) => `#${w.ownerHistId}` },
  { key: 'name', soort: 'domein', write: (w) => ifcStr(w.resource.name) },
  { key: 'description', soort: 'domein', write: (w) => ifcStr(w.resource.description) },
  {
    key: 'objectType', soort: 'domein', volgt: 'predefinedType',
    write: (w) => (isCostResource(w) ? ifcStr(COST_RESOURCE_OBJECT_TYPE) : '$'),
  },
  { key: 'identification', soort: 'constant', write: () => '$' },
  { key: 'longDescription', soort: 'constant', write: () => '$' },
  { key: 'usage', soort: 'constant', bronverwijzing: true, write: () => '$' },
  { key: 'baseCosts', soort: 'constant', bronverwijzing: true, write: () => '$' },
  { key: 'baseQuantity', soort: 'constant', bronverwijzing: true, write: () => '$' },
  { key: 'predefinedType', soort: 'domein', write: (w) => (isCostResource(w) ? '.USERDEFINED.' : '.NOTDEFINED.') },
] as const satisfies readonly WriteSlot<ResourceWriteCtx>[];

export type ResourceSlotKey = (typeof RESOURCE_TABLE)[number]['key'];

export const IFC_RESOURCE_SLOTS: readonly WriteSlot<ResourceWriteCtx, ResourceSlotKey>[] = RESOURCE_TABLE;

export const RESOURCE_SLOT = slotIndex(IFC_RESOURCE_SLOTS);

export const LEGACY_OPS_RESOURCE_ARITY = 9;

const LEGACY_OPS_RESOURCE_SLOT: SlotPositions<ResourceSlotKey> = {
  ...RESOURCE_SLOT, baseCosts: ABSENT_SLOT, baseQuantity: ABSENT_SLOT, predefinedType: 8,
};

export function resourceSlots(args: readonly string[]): SlotPositions<ResourceSlotKey> {
  return args.length === LEGACY_OPS_RESOURCE_ARITY ? LEGACY_OPS_RESOURCE_SLOT : RESOURCE_SLOT;
}
