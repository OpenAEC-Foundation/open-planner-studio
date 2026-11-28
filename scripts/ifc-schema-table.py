#!/usr/bin/env python3
"""Leidt de schematabellen van de IFC-schemapoort af uit de drie schema's die OPS schrijft.

    source /tmp/ifcvenv/bin/activate   # een venv met `pip install ifcopenshell` (getest: 0.9.0)
    python -I scripts/ifc-schema-table.py > tests/planning/ifcSchemaTable.ts

Bron: de EXPRESS-schema's IFC4X3_ADD2 (IFC 4.3.2.0, ISO 16739-1:2024; de standaard), IFC4X3 en IFC4
van buildingSMART, zoals IfcOpenShell ze meelevert (`ifcopenshell_wrapper.schema_by_name(...)`,
gecompileerd uit de officiële EXPRESS). Een project kan in elk van de drie worden opgeslagen
(`IFC_SCHEMAS` in src/types/project.ts). Het script leest per schema en per entiteit alle attributen
in STEP-volgorde (eerst die van de supertypen), met type en OPTIONAL-vlag, en schrijft daar één
TypeScript-module van met een tabel per schema.

Waarom per schema: de attribuutaantallen van de OPS-entiteiten zijn in de drie gelijk, maar de
toegestane enum-literals niet. IfcTaskTypeEnum kent bijvoorbeeld INSPECTION alleen in IFC 4.3; een
IFC4-bestand met `.INSPECTION.` is ongeldig. Ook enkele getypeerde waarden verschillen
(IFCURIREFERENCE mag in IFC4 en IFC4X3 niet in IfcValue staan, IFCCOUNTMEASURE is in IFC4 een NUMBER).

Waarom een gegenereerde tabel: CI draait geen Python. De poort `tests/planning/check-ifc-schema.ts`
toetst elke regel die de writer schrijft tegen deze tabel. Een nieuwe entiteit in de writer zet je
in `OPS_ENTITIES` hieronder en draai je dit script opnieuw; de poort weigert anders de entiteit.
"""
import ifcopenshell
import ifcopenshell.ifcopenshell_wrapper as w

# Volgorde: de standaard eerst, zoals `IFC_SCHEMAS` in src/types/project.ts.
SCHEMAS = ['IFC4X3_ADD2', 'IFC4X3', 'IFC4']

# Alle entiteiten die de OPS-writer kan schrijven (ifcWriter.ts, ifcPsets.ts, ifcTaskSlots.ts en
# RESOURCE_TYPE_TO_IFC in ifcConstants.ts). De poort scant de writerbronnen en eist dat elke
# `IFCxxx(`-token hier (of bij de getypeerde waarden) staat.
OPS_ENTITIES = [
    'IfcPerson', 'IfcOrganization', 'IfcPersonAndOrganization', 'IfcApplication', 'IfcOwnerHistory',
    'IfcSIUnit', 'IfcUnitAssignment', 'IfcCartesianPoint', 'IfcAxis2Placement3D',
    'IfcGeometricRepresentationContext', 'IfcProject',
    'IfcWorkPlan', 'IfcWorkSchedule', 'IfcWorkCalendar', 'IfcWorkTime', 'IfcRecurrencePattern',
    'IfcTimePeriod', 'IfcTask', 'IfcTaskTime', 'IfcRelSequence', 'IfcLagTime',
    'IfcLaborResource', 'IfcConstructionEquipmentResource', 'IfcConstructionMaterialResource',
    'IfcSubContractResource', 'IfcCrewResource',
    'IfcPropertySingleValue', 'IfcPropertyEnumeratedValue', 'IfcPropertyEnumeration', 'IfcPropertySet',
    'IfcSimplePropertyTemplate', 'IfcPropertySetTemplate',
    'IfcRelDefinesByProperties', 'IfcRelAggregates', 'IfcRelNests', 'IfcRelAssignsToControl',
    'IfcRelAssignsToProcess', 'IfcRelDeclares',
]

SIMPLE_KIND = {
    'string': 'S', 'real': 'R', 'integer': 'I', 'number': 'N', 'boolean': 'B', 'logical': 'L',
    'binary': 'X',
}

# Tekst-typen met een vaste vorm; de poort toetst die vorm (zie de legenda in de TS-module).
SHAPED_STRING_KIND = {
    'IfcGloballyUniqueId': 'G', 'IfcDateTime': 'DT', 'IfcDate': 'DA', 'IfcTime': 'TI', 'IfcDuration': 'DU',
}

# De functies hieronder lezen het schema dat `build` zet (één schema tegelijk).
schema = None
selects_used = {}
OPS_DECLS = []


def is_subtype(ent, base):
    """Is `ent` gelijk aan `base` of een subtype ervan (volgt de supertypeketen)?"""
    while ent is not None:
        if ent.name() == base.name():
            return True
        ent = ent.supertype()
    return False


def allowed_ops_entities(bases):
    """De OPS-entiteiten die een verwijzing naar een van `bases` mag aanwijzen (het type of een subtype).
    Alleen OPS-entiteiten: een andere entiteit in een OPS-bestand is voor de poort al een fout."""
    return sorted({d.name().upper() for d in OPS_DECLS for b in bases if is_subtype(d, b)})


def simple_kind(t):
    """Kind van een named/simple type; volgt type-declaraties naar het onderliggende simple type."""
    if isinstance(t, w.simple_type):
        return SIMPLE_KIND[t.declared_type()]
    if isinstance(t, w.named_type):
        return simple_kind(t.declared_type())
    if isinstance(t, w.type_declaration):
        return simple_kind(t.declared_type())
    raise ValueError(f'geen simple type: {t}')


def flatten_select(sel, out_types, flags):
    for m in sel.select_list():
        if isinstance(m, w.entity):
            flags['refs'] = True
            flags['entities'].append(m)
        elif isinstance(m, w.select_type):
            flatten_select(m, out_types, flags)
        elif isinstance(m, w.type_declaration):
            out_types[m.name().upper()] = type_decl_kind(m)
        elif isinstance(m, w.enumeration_type):
            flags['enums'] = True
        else:
            raise ValueError(m)


def aggregate_code(agg):
    """`SET1:#` = SET met minimaal 1 element van type `#`; LIST/ARRAY/BAG idem."""
    return f"{agg.type_of_aggregation_string().upper()}{agg.bound1()}:{kind_of(agg.type_of_element())}"


def type_decl_kind(td):
    if td.name() in SHAPED_STRING_KIND:
        return SHAPED_STRING_KIND[td.name()]
    inner = td.declared_type()
    if isinstance(inner, w.aggregation_type):
        return aggregate_code(inner)
    kind = simple_kind(inner)
    # IfcPositive…Measure/IfcPositiveInteger: WHERE-regel `SELF > 0` op het type zelf.
    if td.name().startswith('IfcPositive') and kind in ('R', 'I'):
        return kind + '+'
    return kind


def kind_of(t):
    """Compacte typecode van een attribuut- of elementtype (legenda in de TS-module)."""
    if isinstance(t, w.named_type):
        d = t.declared_type()
        if isinstance(d, w.entity):
            return '#=' + '|'.join(allowed_ops_entities([d]))
        if isinstance(d, w.enumeration_type):
            return 'E=' + '|'.join(d.enumeration_items())
        if isinstance(d, w.select_type):
            if d.name() not in selects_used:
                types, flags = {}, {'refs': False, 'enums': False, 'entities': []}
                flatten_select(d, types, flags)
                selects_used[d.name()] = (types, flags)
            return 'V=' + d.name()
        if isinstance(d, w.type_declaration):
            return type_decl_kind(d)
        raise ValueError(d)
    if isinstance(t, w.aggregation_type):
        return aggregate_code(t)
    if isinstance(t, w.simple_type):
        return simple_kind(t)
    raise ValueError(t)



def ts_list(items, indent):
    """Namen in rijen van vier, zoals de rest van de module."""
    rows = [', '.join(items[i:i + 4]) for i in range(0, len(items), 4)]
    pad = ' ' * indent
    return '' if not rows else f'\n{pad}  ' + f',\n{pad}  '.join(rows) + f',\n{pad}'


def build(schema_name):
    """De TypeScript-tekst van de tabel van één schema (de waarde in IFC_SCHEMA_TABLES)."""
    global schema, OPS_DECLS
    schema = w.schema_by_name(schema_name)
    selects_used.clear()
    OPS_DECLS = [schema.declaration_by_name(n) for n in OPS_ENTITIES]

    lines = []
    for name in OPS_ENTITIES:
        ent = schema.declaration_by_name(name)
        specs = []
        for attr, is_derived in zip(ent.all_attributes(), ent.derived()):
            if is_derived:
                specs.append(f"'{attr.name()}:*'")
                continue
            code = kind_of(attr.type_of_attribute())
            specs.append(f"'{attr.name()}:{code}{'?' if attr.optional() else ''}'")
        lines.append(f"      {name.upper()}: [\n        " + ',\n        '.join(specs) + ',\n      ],')

    select_lines = []
    typed_kinds = {}
    for sel, (types, flags) in sorted(selects_used.items()):
        typed_kinds.update(types)
        names = ts_list([repr(t) for t in sorted(types)], 8)
        ents = ts_list([repr(e) for e in allowed_ops_entities(flags['entities'])], 8)
        select_lines.append(
            f"      {sel}: {{\n        refs: {'true' if flags['refs'] else 'false'},\n"
            f"        entities: [{ents}],\n        types: [{names}],\n      }},")
    typed_lines = [f"      {k}: '{v}'," for k, v in sorted(typed_kinds.items())]
    nl = chr(10)
    return f"""  {schema_name}: {{
    attributes: {{
{nl.join(lines)}
    }},
    selects: {{
{nl.join(select_lines)}
    }},
    typedValueKind: {{
{nl.join(typed_lines)}
    }},
  }},"""


tables = [build(name) for name in SCHEMAS]
schema_union = ' | '.join(f"'{n}'" for n in SCHEMAS)

print(f"""export type IfcSchemaTableId = {schema_union};

export interface IfcSchemaTable {{
  attributes: Record<string, readonly string[]>;
  selects: Record<string, {{ refs: boolean; entities: readonly string[]; types: readonly string[] }}>;
  typedValueKind: Record<string, string>;
}}

export const IFC_SCHEMA_TABLES: Record<IfcSchemaTableId, IfcSchemaTable> = {{
{chr(10).join(tables)}
}};""")
