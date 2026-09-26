import type { CustomFieldType } from '@/types/structure';
import type { ResourceType } from '@/types/resource';
import { invertRecord } from '@/utils/collections';

/**
 * Gedeelde IFC-constanten voor reader en writer, zodat ze niet stil kunnen divergeren. Telkens is
 * één kant autoritair; de andere richting leiden we programmatisch af (of houden we expliciet waar
 * dat echt niet kan).
 * Dit bestand importeert alleen uit `@/types` en de bladmodule `@/utils/collections` ⇒ geen
 * import-cyclus met reader/writer.
 */

/** Default voor `Task.priority` (0-1000, default 500). Reader leest 'm terug, writer
 *  schrijft alleen bij afwijking (golden-rule-guards). */
export const DEFAULT_PRIORITY = 500;

/** Synthetisch anker (tijd-van-de-dag) dat de DAG-schrijver op date-only datetimes plakt.
 *  De reader herkent een afwijkende tijd-van-de-dag als sub-dag-signaal (discriminator c). */
export const IFC_TIME_ANCHOR = '07:00:00';

/** IFC-measure-type per custom-field-type (writer: `IfcSimplePropertyTemplate.PrimaryMeasureType`
 *  + het getypeerde `NominalValue`). Autoritair; de reader leidt de inverse hieruit af. */
export const FIELD_MEASURE: Record<CustomFieldType, string> = {
  text: 'IfcText',
  number: 'IfcReal',
  integer: 'IfcInteger',
  cost: 'IfcMonetaryMeasure',
  date: 'IfcDate',
  boolean: 'IfcBoolean',
};

/** Inverse van `FIELD_MEASURE` voor de reader (lowercase IFC-measure → custom-field-type),
 *  programmatisch afgeleid zodat writer en reader niet kunnen divergeren. `ifclabel` is een
 *  inkomende-alleen alias (de writer schrijft 'm nooit) die als `text` binnenkomt. */
export const MEASURE_TO_FIELD: Record<string, CustomFieldType> = (() => {
  const inv: Record<string, CustomFieldType> = { ifclabel: 'text' };
  for (const [field, measure] of Object.entries(FIELD_MEASURE) as [CustomFieldType, string][]) {
    inv[measure.toLowerCase()] = field;
  }
  return inv;
})();

/** Resource-type → IFC-entiteitnaam (writer). Autoritair; de reader leidt de inverse hieruit af. */
export const RESOURCE_TYPE_TO_IFC: Record<ResourceType, string> = {
  LABOR: 'IFCLABORRESOURCE',
  EQUIPMENT: 'IFCCONSTRUCTIONEQUIPMENTRESOURCE',
  MATERIAL: 'IFCCONSTRUCTIONMATERIALRESOURCE',
  SUBCONTRACTOR: 'IFCSUBCONTRACTRESOURCE',
  CREW: 'IFCCREWRESOURCE',
};

/** Inverse van `RESOURCE_TYPE_TO_IFC` voor de reader (IFC-entiteitnaam → resource-type),
 *  programmatisch afgeleid. Asymmetrie: `IFCCONSTRUCTIONPRODUCTRESOURCE` is een inkomende-alleen
 *  alias (herbruikbaar bekisting e.d.) — OPS schrijft die entiteit nooit
 *  zelf, maar accepteert 'm als `EQUIPMENT`. */
export const IFC_TO_RESOURCE_TYPE: Partial<Record<string, ResourceType>> = Object.assign(
  invertRecord(RESOURCE_TYPE_TO_IFC),
  { IFCCONSTRUCTIONPRODUCTRESOURCE: 'EQUIPMENT' as const },
);
