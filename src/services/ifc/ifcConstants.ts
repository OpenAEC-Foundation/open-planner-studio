import type { CustomFieldType } from '@/types/structure';
import type { ResourceType } from '@/types/resource';

/**
 * Gedeelde IFC-constanten (audit-thema "reader↔writer-consts"). Deze paren waren voorheen aan
 * beide kanten los gedefinieerd en konden stil divergeren. Hier is telkens één kant autoritair;
 * de andere richting leiden we programmatisch af (of houden we expliciet waar dat echt niet kan).
 * Dit bestand importeert alleen uit `@/types` ⇒ geen import-cyclus met reader/writer.
 */

/** Fase 2.5-default voor `Task.priority` (0-1000, default 500). Reader leest 'm terug, writer
 *  schrijft alleen bij afwijking (golden-rule-guards). */
export const DEFAULT_PRIORITY = 500;

/** Synthetisch anker (tijd-van-de-dag) dat de DAG-schrijver op date-only datetimes plakt (§7.1).
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
 *  alias (herbruikbaar bekisting e.d., domeinrapport §8.A) — OPS schrijft die entiteit nooit
 *  zelf, maar accepteert 'm als `EQUIPMENT`. */
export const IFC_TO_RESOURCE_TYPE: Record<string, ResourceType> = (() => {
  const inv: Record<string, ResourceType> = { IFCCONSTRUCTIONPRODUCTRESOURCE: 'EQUIPMENT' };
  for (const [type, entity] of Object.entries(RESOURCE_TYPE_TO_IFC) as [ResourceType, string][]) {
    inv[entity] = type;
  }
  return inv;
})();
