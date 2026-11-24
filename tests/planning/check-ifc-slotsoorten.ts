import { IFC_TO_RESOURCE_TYPE } from '@/services/ifc/ifcConstants';
import { lagValueSlot } from '@/services/ifc/ifcLagTimeSlots';
import { ABSENT_SLOT, SLOT_SOORTEN, type SlotSoort } from '@/services/ifc/ifcSlotSoort';
import { IFC_SLOT_TABLES, type IfcSlotTable } from '@/services/ifc/ifcSlotTables';
import { IFC_SCHEMA_TABLES, type IfcSchemaTable } from './ifcSchemaTable';

const fails: string[] = [];
let checks = 0;
const ok = (label: string, condition: boolean) => {
  checks++;
  if (!condition) fails.push(label);
};
const eq = (label: string, got: unknown, want: unknown) =>
  ok(`${label}: kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`, JSON.stringify(got) === JSON.stringify(want));

const PLANNING_ENTITY_TYPES = [
  'IFCTASK', 'IFCTASKTIME', 'IFCWORKPLAN', 'IFCWORKSCHEDULE', 'IFCWORKCALENDAR', 'IFCRELSEQUENCE', 'IFCLAGTIME',
  ...Object.keys(IFC_TO_RESOURCE_TYPE),
];
const ENTITIES_MISSING_FROM_SCHEMA_TABLE = ['IFCCONSTRUCTIONPRODUCTRESOURCE'];
const DESIGN_CONSTANT_REFERENCE_SLOTS = [
  'IfcWorkPlan.creators', 'IfcWorkSchedule (live).creators', 'IfcWorkSchedule (baseline).creators',
  'resources.usage', 'resources.baseCosts', 'resources.baseQuantity',
];

const tableNamed = (naam: string): IfcSlotTable => {
  const table = IFC_SLOT_TABLES.find(t => t.naam === naam);
  if (!table) throw new Error(`geen slottabel ${naam}`);
  return table;
};
const isSoort = (value: unknown): value is SlotSoort => (SLOT_SOORTEN as readonly unknown[]).includes(value);
const slotNameOf = (attribute: string) => {
  const name = attribute.slice(0, attribute.indexOf(':'));
  return name.charAt(0).toLowerCase() + name.slice(1);
};
const canHoldReference = (schema: IfcSchemaTable, attribute: string) => {
  const code = attribute.slice(attribute.indexOf(':') + 1);
  if (code.includes('#=')) return true;
  const select = /V=(\w+)/.exec(code)?.[1];
  return select !== undefined && schema.selects[select]?.refs === true;
};

for (const type of PLANNING_ENTITY_TYPES) {
  ok(`${type}: heeft een slottabel`, IFC_SLOT_TABLES.some(t => t.entities.includes(type)));
}
for (const table of IFC_SLOT_TABLES) {
  for (const type of table.entities) ok(`${table.naam}: ${type} is een planningstype`, PLANNING_ENTITY_TYPES.includes(type));
}

for (const table of IFC_SLOT_TABLES) {
  const keys = table.slots.map(slot => slot.key);
  ok(`${table.naam}: elke slotnaam staat er één keer in`, new Set(keys).size === keys.length);
  for (const slot of table.slots) {
    const at = `${table.naam}.${slot.key}`;
    ok(`${at}: heeft een soort (${SLOT_SOORTEN.join(', ')})`, isSoort(slot.soort));
    if (slot.soortVreemd !== undefined) {
      ok(`${at}: de soort bij vreemde herkomst is een soort en verschilt van die bij eigen herkomst`,
        isSoort(slot.soortVreemd) && slot.soortVreemd !== slot.soort);
    }
    if (slot.volgt !== undefined) {
      ok(`${at}: volgt een ander slot van dezelfde tabel`, keys.includes(slot.volgt) && slot.volgt !== slot.key);
    }
    if (slot.bronverwijzing !== undefined) ok(`${at}: bronverwijzing is true of afwezig`, slot.bronverwijzing === true);
  }
  if (keys.includes('ownerHistory')) {
    const ownerHistory = table.slots.find(slot => slot.key === 'ownerHistory')!;
    eq(`${table.naam}.ownerHistory: verwijzing bij eigen herkomst, constant met bronverwijzing bij vreemde`,
      [ownerHistory.soort, ownerHistory.soortVreemd, ownerHistory.bronverwijzing], ['verwijzing', 'constant', true]);
  }
}

const constantReferenceSlots = new Set<string>();
for (const [schemaId, schema] of Object.entries(IFC_SCHEMA_TABLES)) {
  for (const table of IFC_SLOT_TABLES) {
    for (const type of table.entities) {
      const attributes = schema.attributes[type];
      if (ENTITIES_MISSING_FROM_SCHEMA_TABLE.includes(type)) {
        ok(`${schemaId}: ${type} ontbreekt nog in de schematabel (staat hij er nu wel in, haal hem dan uit de uitzonderingen)`,
          attributes === undefined);
        continue;
      }
      if (!attributes) {
        ok(`${schemaId}: ${type} staat in de schematabel`, false);
        continue;
      }
      eq(`${schemaId} ${type}: de slots van ${table.naam} zijn de attributen van het schema, in hun volgorde`,
        table.slots.map(slot => slot.key), attributes.map(slotNameOf));
      table.slots.forEach((slot, index) => {
        const attribute = attributes[index];
        if (attribute === undefined) return;
        const at = `${schemaId} ${type}.${slot.key}`;
        const reference = canHoldReference(schema, attribute);
        const foreign = slot.soortVreemd ?? slot.soort;
        if (reference) {
          ok(`${at}: een slot dat volgens het schema een verwijzing kan dragen, is verwijzing of constant`,
            [slot.soort, foreign].every(soort => soort === 'verwijzing' || soort === 'constant'));
        }
        ok(`${at}: staat op de vaste lijst constante slots met een #-token precies als het bij vreemde herkomst constant is en volgens het schema een verwijzing kan dragen`,
          (slot.bronverwijzing === true) === (foreign === 'constant' && reference));
        if (slot.bronverwijzing) constantReferenceSlots.add(`${table.naam}.${slot.key}`);
      });
    }
  }
}
for (const name of DESIGN_CONSTANT_REFERENCE_SLOTS) {
  ok(`ontwerp §4.5: ${name} staat op de vaste lijst constante slots met een #-token`, constantReferenceSlots.has(name));
}

const schemaPositions = (table: IfcSlotTable) => Object.fromEntries(table.slots.map((slot, index) => [slot.key, index]));
const LAG_SCHEMA_ARGS = ["'Lag'", '.PREDICTED.', '$', "IFCDURATION('P0Y0M2D')", '.WORKTIME.'];
const LAG_OLD_OPS_ARGS = ["'Lag'", '.PREDICTED.', '$', '.WORKTIME.', "'P0Y0M2D'"];
const dollars = (n: number) => Array.from({ length: n }, () => '$');
for (const table of IFC_SLOT_TABLES) {
  const args = table.naam === 'IfcLagTime' ? LAG_SCHEMA_ARGS : dollars(table.slots.length);
  eq(`${table.naam}: in de lay-out van het schema staat elk slot op zijn eigen plek`, table.positions(args), schemaPositions(table));
}

const withAt = (args: string[], index: number, value: string) => args.map((arg, i) => (i === index ? value : arg));
const OLD_LAYOUTS: { naam: string; vorm: string; args: string[]; want: Record<string, number> }[] = [
  { naam: 'IfcTask', vorm: 'oude OPS, 12 argumenten zonder WorkMethod', args: dollars(12),
    want: { status: 7, workMethod: ABSENT_SLOT, isMilestone: 8, priority: 9, taskTime: 10, predefinedType: 11 } },
  { naam: 'IfcWorkPlan', vorm: 'oude OPS, 15 argumenten', args: withAt(dollars(15), 14, '.PLANNED.'),
    want: { totalFloat: 10, startTime: 12, finishTime: 13, predefinedType: 14 } },
  { naam: 'IfcWorkSchedule (live)', vorm: 'oud bestand na MergeProjects, tekst op PredefinedType',
    args: withAt(dollars(14), 13, "'2026-01-01T00:00:00'"), want: { startTime: 12, finishTime: 13, predefinedType: 14 } },
  { naam: 'IfcWorkSchedule (baseline)', vorm: 'IFC2X3, enumeratie op 13', args: withAt(dollars(15), 13, '.BASELINE.'),
    want: { startTime: 11, finishTime: 12, predefinedType: 13 } },
  { naam: 'IfcWorkCalendar', vorm: 'oude OPS, 8 argumenten', args: dollars(8),
    want: { identification: ABSENT_SLOT, workingTimes: 5, exceptionTimes: 6, predefinedType: 7 } },
  { naam: 'IfcWorkCalendar', vorm: 'oud bestand na MergeProjects, lijst op Identification', args: withAt(dollars(9), 5, '(#7)'),
    want: { identification: ABSENT_SLOT, workingTimes: 5, exceptionTimes: 6, predefinedType: 7 } },
  { naam: 'resources', vorm: 'oude OPS, 9 argumenten', args: dollars(9),
    want: { usage: 7, baseCosts: ABSENT_SLOT, baseQuantity: ABSENT_SLOT, predefinedType: 8 } },
  { naam: 'IfcLagTime', vorm: 'oude OPS, verwisselde argumenten', args: LAG_OLD_OPS_ARGS, want: { durationType: 3, lagValue: 4 } },
];
for (const layout of OLD_LAYOUTS) {
  const table = tableNamed(layout.naam);
  const positions = table.positions(layout.args);
  const label = `${layout.naam} (${layout.vorm})`;
  eq(`${label}: de plekken`, Object.fromEntries(Object.keys(layout.want).map(key => [key, positions[key]])), layout.want);
  const present = table.slots.map(slot => positions[slot.key]).filter(position => position !== ABSENT_SLOT);
  ok(`${label}: elk slot heeft een plek of is afwezig`, table.slots.every(slot => Number.isInteger(positions[slot.key])
    && (positions[slot.key] === ABSENT_SLOT || positions[slot.key]! >= 0)));
  ok(`${label}: geen twee slots op dezelfde plek`, new Set(present).size === present.length);
}
for (const args of [LAG_SCHEMA_ARGS, LAG_OLD_OPS_ARGS]) {
  eq(`IfcLagTime ${args[3]}: lagValueSlot en de lay-out wijzen dezelfde plek aan`,
    lagValueSlot(args).arg, tableNamed('IfcLagTime').positions(args).lagValue);
}

if (fails.length > 0) {
  for (const fail of fails) console.log(`   XX ${fail}`);
  console.log(`XX check-ifc-slotsoorten: ${fails.length} fout(en) in ${checks} toetsen`);
  process.exit(1);
}
console.log(`   vaste lijst constante slots met een #-token: ${[...constantReferenceSlots].join(', ')}`);
console.log(`OK check-ifc-slotsoorten: ${checks} toetsen groen (${IFC_SLOT_TABLES.length} tabellen, ${IFC_SLOT_TABLES.reduce((n, t) => n + t.slots.length, 0)} slots)`);
