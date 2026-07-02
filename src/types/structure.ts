/**
 * Fase 2.2 — structuurdefinities op projectniveau (zie
 * docs/superpowers/specs/2026-07-02-wbs-structuur-design.md).
 *
 * Activity codes volgen het P6-model: een projectgebonden lijst code-TYPES
 * (dimensies zoals "Locatie", "Discipline"), elk met platte WAARDEN; een taak
 * draagt per type maximaal één waarde (invariant — houdt groeperen
 * welgedefinieerd en is P6-compatibel). Custom fields zijn getypeerde
 * gebruikersvelden (P6 UDF-vorm); enumeraties horen bij activity codes, niet
 * hier. Beide round-trippen door IFC via pset-templates + OPS_-psets.
 */

export interface ActivityCodeValue {
  id: string;
  /** Korte code zoals planners die tikken/filteren (bv. "B1", "RUW"). */
  code: string;
  description?: string;
  /** Bandkleur in groeperingsweergaven (CSS-kleur). */
  color?: string;
}

export interface ActivityCodeType {
  id: string;
  name: string;
  values: ActivityCodeValue[];
}

export type CustomFieldType = 'text' | 'number' | 'integer' | 'cost' | 'date' | 'boolean';

export interface CustomFieldDef {
  id: string;
  name: string;
  type: CustomFieldType;
}

export type CustomFieldValue = string | number | boolean;
