import { OWNER_HISTORY_SOORTEN, slotIndex, type SlotPositions, type SlotSpec } from './ifcSlotSoort';

const RELATION_GLOBAL_ID = { key: 'globalId', soort: 'afgeleid', soortVreemd: 'constant' } as const satisfies SlotSpec;
const RELATION_OWNER_HISTORY = { key: 'ownerHistory', ...OWNER_HISTORY_SOORTEN } as const satisfies SlotSpec;
const RELATION_NAME = { key: 'name', soort: 'constant' } as const satisfies SlotSpec;
const RELATION_DESCRIPTION = { key: 'description', soort: 'constant' } as const satisfies SlotSpec;

export const IFC_REL_NESTS_SLOTS = [
  RELATION_GLOBAL_ID,
  RELATION_OWNER_HISTORY,
  { key: 'name', soort: 'afgeleid', soortVreemd: 'constant' },
  RELATION_DESCRIPTION,
  { key: 'relatingObject', soort: 'verwijzing' },
  { key: 'relatedObjects', soort: 'verwijzing' },
] as const satisfies readonly SlotSpec[];

export const IFC_REL_AGGREGATES_SLOTS = [
  RELATION_GLOBAL_ID,
  RELATION_OWNER_HISTORY,
  RELATION_NAME,
  RELATION_DESCRIPTION,
  { key: 'relatingObject', soort: 'verwijzing' },
  { key: 'relatedObjects', soort: 'verwijzing' },
] as const satisfies readonly SlotSpec[];

export const IFC_REL_ASSIGNS_TO_CONTROL_SLOTS = [
  RELATION_GLOBAL_ID,
  RELATION_OWNER_HISTORY,
  RELATION_NAME,
  RELATION_DESCRIPTION,
  { key: 'relatedObjects', soort: 'verwijzing' },
  { key: 'relatedObjectsType', soort: 'constant' },
  { key: 'relatingControl', soort: 'verwijzing' },
] as const satisfies readonly SlotSpec[];

export const IFC_REL_ASSIGNS_TO_PROCESS_SLOTS = [
  RELATION_GLOBAL_ID,
  RELATION_OWNER_HISTORY,
  RELATION_NAME,
  RELATION_DESCRIPTION,
  { key: 'relatedObjects', soort: 'verwijzing' },
  { key: 'relatedObjectsType', soort: 'constant' },
  { key: 'relatingProcess', soort: 'verwijzing' },
  { key: 'quantityInProcess', soort: 'constant', bronverwijzing: true },
] as const satisfies readonly SlotSpec[];

export const IFC_REL_DECLARES_SLOTS = [
  RELATION_GLOBAL_ID,
  RELATION_OWNER_HISTORY,
  RELATION_NAME,
  RELATION_DESCRIPTION,
  { key: 'relatingContext', soort: 'verwijzing' },
  { key: 'relatedDefinitions', soort: 'verwijzing' },
] as const satisfies readonly SlotSpec[];

export const IFC_REL_DEFINES_BY_PROPERTIES_SLOTS = [
  RELATION_GLOBAL_ID,
  RELATION_OWNER_HISTORY,
  RELATION_NAME,
  RELATION_DESCRIPTION,
  { key: 'relatedObjects', soort: 'verwijzing' },
  { key: 'relatingPropertyDefinition', soort: 'verwijzing' },
] as const satisfies readonly SlotSpec[];

export function relationPositions(slots: readonly SlotSpec[]): () => SlotPositions<string> {
  const positions = slotIndex(slots);
  return () => positions;
}
