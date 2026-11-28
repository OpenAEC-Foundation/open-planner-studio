import type { CustomFieldType } from '@/types/structure';
import type { ResourceType } from '@/types/resource';
import { invertRecord } from '@/utils/collections';

export const DEFAULT_PRIORITY = 500;

export const IFC_TIME_ANCHOR = '07:00:00';

export const MINUTE_MODEL_TIME_MODEL = 'MINUTES-1';

export const FIELD_MEASURE: Record<CustomFieldType, string> = {
  text: 'IfcText',
  number: 'IfcReal',
  integer: 'IfcInteger',
  cost: 'IfcMonetaryMeasure',
  date: 'IfcDate',
  boolean: 'IfcBoolean',
};

export const MEASURE_TO_FIELD: Record<string, CustomFieldType> = (() => {
  const inv: Record<string, CustomFieldType> = { ifclabel: 'text' };
  for (const [field, measure] of Object.entries(FIELD_MEASURE) as [CustomFieldType, string][]) {
    inv[measure.toLowerCase()] = field;
  }
  return inv;
})();

export const RESOURCE_TYPE_TO_IFC: Record<ResourceType, string> = {
  LABOR: 'IFCLABORRESOURCE',
  EQUIPMENT: 'IFCCONSTRUCTIONEQUIPMENTRESOURCE',
  MATERIAL: 'IFCCONSTRUCTIONMATERIALRESOURCE',
  SUBCONTRACTOR: 'IFCSUBCONTRACTRESOURCE',
  CREW: 'IFCCREWRESOURCE',
  COST: 'IFCCONSTRUCTIONMATERIALRESOURCE',
};

export const COST_RESOURCE_OBJECT_TYPE = 'COST';

export const IFC_TO_RESOURCE_TYPE: Partial<Record<string, ResourceType>> = Object.assign(
  invertRecord(Object.fromEntries(Object.entries(RESOURCE_TYPE_TO_IFC).filter(([type]) => type !== 'COST')) as Record<string, string>),
  { IFCCONSTRUCTIONPRODUCTRESOURCE: 'EQUIPMENT' as const },
) as Partial<Record<string, ResourceType>>;
