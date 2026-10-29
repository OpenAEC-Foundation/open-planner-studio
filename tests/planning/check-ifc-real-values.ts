// Knownbugs 107/108: geldige REAL-literals, positieve Completion en verliesvrij heropenen.
// De basisfix staat sinds PR #344 op main; deze batterij bewaakt alle betrokken writerpaden,
// inclusief de aanwezigheidsregistratie en de exponentgrenzen van JavaScript-getallen.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { stepReal, ifcTypedReal } from '@/services/ifc/ifcPsets';
import { ALL_RECORDED_SLOT_KEYS, TASKTIME_SLOT, ifcCompletionReal } from '@/services/ifc/ifcTaskSlots';
import { IFC_SCHEMAS } from '@/types/project';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { checkIfcSchema, parseStep } from './ifcSchemaCheck';

let checks = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) failures.push(label);
}
function eq(label: string, got: unknown, want: unknown): void {
  ok(`${label}: kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`, JSON.stringify(got) === JSON.stringify(want));
}

const realForm = /^[+-]?\d+\.\d*(E[+-]?\d+)?$/;
const numbers = [0, -0, 8, -8, 8.25, 1 / 3, 0.30000000000000004, 1e-7, 1e21, Number.MIN_VALUE, Number.MAX_VALUE];
for (const n of numbers) {
  const literal = stepReal(n);
  ok(`STEP-REAL ${n}: punt en geldige exponent`, literal !== undefined && realForm.test(literal));
  eq(`STEP-REAL ${n}: exacte getalswaarde`, Number(literal), n);
}
eq('geheel getal met punt', stepReal(8), '8.');
eq('kleine exponent met punt en hoofdletter', stepReal(1e-7), '1.E-7');
for (const n of numbers.filter(n => n > 0)) {
  const literal = ifcCompletionReal(n);
  ok(`Completion ${n}: geldige REAL, ook als toFixed een exponent geeft`, realForm.test(literal));
  eq(`Completion ${n}: exacte getalswaarde`, Number(literal), n);
}
eq('Completion met heel percentage behoudt twee decimalen', ifcCompletionReal(1), '1.00');
for (const n of [NaN, Infinity, -Infinity]) {
  eq(`niet-eindig ${n}: geen REAL`, stepReal(n), undefined);
  for (const type of ['IFCREAL', 'IFCMONETARYMEASURE'] as const) {
    eq(`niet-eindig ${n}: ${type} NominalValue ontbreekt`, ifcTypedReal(type, n), '$');
  }
}

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const base = readIFC(readFileSync(join(root, 'examples', 'showcase-appartementencomplex.ifc'), 'utf8'));
const makeTask = (id: string, completion: number | undefined): Task => ({
  id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: { ...createDefaultTaskTime('2026-10-05', 2), completion: completion as number },
});
const progress = [0, -0, undefined, -0.5, NaN, Infinity, -Infinity, 0.38, 0.955, 1 / 3, 1e-7, 1e-21, Number.MIN_VALUE, 1];
const tasks = progress.map((n, i) => makeTask(`completion-${i}`, n));
tasks[0].customFields = { num: 8, cost: 120, text: "Café 'IFCREAL(8)' \\ pad" };
tasks[1].customFields = { num: 0, cost: 0 };
tasks[2].customFields = { num: 1e-7, cost: 1e21 };
tasks[3].customFields = { num: 1 / 3, cost: -8.25 };
tasks[4].customFields = { num: NaN, cost: Infinity };
const fixture = {
  project: base.project,
  calendar: {
    ...base.calendar, workStartHour: 7, workEndHour: 17, hoursPerDay: 8,
    workTime: { byWeekday: { 1: [{ start: 420, end: 1020 }], 2: [{ start: 480, end: 1020 }],
      3: [{ start: 420, end: 1020 }], 4: [{ start: 420, end: 1020 }], 5: [{ start: 420, end: 1020 }], 6: [], 7: [] } },
  },
  tasks,
  sequences: [{ id: 'ratio', predecessorId: tasks[0].id, successorId: tasks[1].id, type: 'FINISH_START' as const, lagDays: 0, lagPercent: 100 }],
  resources: [
    { id: 'resource', name: 'Resource', type: 'LABOR' as const, description: '', maxUnits: 8, costPerHour: 120 },
    { id: 'zero', name: 'Nul', type: 'LABOR' as const, description: '', maxUnits: 0, costPerHour: 0 },
    { id: 'invalid', name: 'Niet-eindig', type: 'LABOR' as const, description: '', maxUnits: Infinity, costPerHour: NaN },
    { id: 'default', name: 'Standaard', type: 'LABOR' as const, description: '', maxUnits: 1 },
  ],
  assignments: [],
  customFieldDefs: [{ id: 'num', name: 'Getal', type: 'number' as const },
    { id: 'cost', name: 'Kosten', type: 'cost' as const }, { id: 'text', name: 'Tekst', type: 'text' as const }],
};
const outDir = process.env.OPS_IFC_REAL_OUT;
if (outDir) mkdirSync(outDir, { recursive: true });
for (const schema of IFC_SCHEMAS) {
  const input = { ...fixture, project: { ...fixture.project, ifcSchema: schema } };
  const text = writeIFC(input);
  if (outDir) writeFileSync(join(outDir, `real-${schema}.ifc`), text);
  const parsed = parseStep(text);
  const times = parsed.filter(e => e.type === 'IFCTASKTIME');
  eq(`${schema}: alle Completion-slots getoetst`, times.length, progress.length);
  progress.forEach((n, i) => {
    const value = times[i]?.args[TASKTIME_SLOT.completion];
    const positive = n !== undefined && Number.isFinite(n) && n > 0;
    ok(`${schema}: Completion ${n} is positief of $`, positive ? value?.k === 'real' && value.n === n && value.n > 0 : value?.k === 'null');
  });
  const properties = parsed.filter(e => e.type === 'IFCPROPERTYSINGLEVALUE');
  for (const [name, type, n] of [
    ['Getal', 'IFCREAL', 8], ['Kosten', 'IFCMONETARYMEASURE', 120], ['HoursPerDay', 'IFCREAL', 8],
    ['WorkStartHour', 'IFCREAL', 7], ['WorkEndHour', 'IFCREAL', 17], ['MaxUnits', 'IFCREAL', 8],
    ['CostPerHour', 'IFCMONETARYMEASURE', 120],
  ] as const) {
    ok(`${schema}: ${name} is een getypte REAL met punt`, properties.some(e => {
      const [prop, , val] = e.args;
      return prop.k === 'str' && prop.raw === `'${name}'` && val.k === 'typed'
        && val.type === type && val.value.k === 'real' && val.value.n === n;
    }));
  }
  const lag = parsed.find(e => e.type === 'IFCLAGTIME')?.args[3];
  ok(`${schema}: procentlag is ook een REAL`, lag?.k === 'typed' && lag.type === 'IFCRATIOMEASURE' && lag.value.k === 'real' && lag.value.n === 1);
  eq(`${schema}: schemageldigheid`, checkIfcSchema(schema, text, undefined, schema).failures, []);

  const back = readIFC(text);
  const again = readIFC(writeIFC(back));
  for (const [round, r] of [back, again].entries()) {
    eq(`${schema}/${round}: gekozen schema behouden`, r.project.ifcSchema, schema);
    progress.forEach((n, i) => {
      const t = r.tasks.find(t => t.id === tasks[i].id);
      const expected = n !== undefined && Number.isFinite(n) && n > 0 ? n : 0;
      eq(`${schema}/${round}: Completion ${n} heropent exact`, t?.time.completion, expected);
      eq(`${schema}/${round}: status ${n}`, t?.status, expected === 1 ? 'COMPLETED' : expected > 0 ? 'STARTED' : 'NOT_STARTED');
    });
    for (let i = 0; i < 4; i++) eq(`${schema}/${round}: eigen velden ${i}`, r.tasks[i].customFields, tasks[i].customFields);
    eq(`${schema}/${round}: niet-eindige eigen velden ontbreken`, r.tasks[4].customFields, undefined);
    eq(`${schema}/${round}: nulwaarden van resource blijven aanwezig`,
      r.resources.find(r => r.name === 'Nul')?.costPerHour, 0);
    eq(`${schema}/${round}: nulcapaciteit blijft aanwezig`, r.resources.find(r => r.name === 'Nul')?.maxUnits, 0);
    eq(`${schema}/${round}: resourcecapaciteit`, r.resources.find(r => r.name === 'Resource')?.maxUnits, 8);
    eq(`${schema}/${round}: resourcetarief`, r.resources.find(r => r.name === 'Resource')?.costPerHour, 120);
    eq(`${schema}/${round}: niet-eindige capaciteit valt terug`, r.resources.find(r => r.name === 'Niet-eindig')?.maxUnits, 1);
    eq(`${schema}/${round}: niet-eindig tarief ontbreekt`, r.resources.find(r => r.name === 'Niet-eindig')?.costPerHour, undefined);
    eq(`${schema}/${round}: ontbrekend tarief blijft afwezig`, r.resources.find(r => r.name === 'Standaard')?.costPerHour, undefined);
    eq(`${schema}/${round}: kalender scalars`, [r.calendar.hoursPerDay, r.calendar.workStartHour, r.calendar.workEndHour], [8, 7, 17]);
  }
  // Completion behoort niet tot de negen vastgelegde datum-/rekenslots. $ en het oude 0.00
  // moeten dus dezelfde presence opleveren; ook een achtergehouden rekenslot blijft afwezig.
  const legacy = text.replace(/(IFCTASKTIME\([^\n]*,)\$\);/g, (_match, prefix: string) => `${prefix}0.00);`);
  ok(`${schema}: oude nulnotatie daadwerkelijk ingevoegd`, legacy !== text);
  eq(`${schema}: $ en oude 0.00 geven dezelfde aanwezigheid`, readIFC(legacy).recordedFields, back.recordedFields);
  eq(`${schema}: nul-Completion wist geen vastgelegde slots`, [...(back.recordedFields?.[tasks[0].id] ?? [])].sort(), [...ALL_RECORDED_SLOT_KEYS].sort());
  const withheld = readIFC(writeIFC({ ...input, withheldTaskTimeFields: { [tasks[0].id]: ['lateStart', 'totalFloat'] } }));
  eq(`${schema}: nul-Completion verandert achtergehouden slots niet`, [...(withheld.recordedFields?.[tasks[0].id] ?? [])].sort(),
    ALL_RECORDED_SLOT_KEYS.filter(k => k !== 'lateStart' && k !== 'totalFloat').sort());
}

if (failures.length) {
  console.log(`XX  ifc-real-values: ${failures.length} afwijkingen (${checks} checks)`);
  for (const f of failures) console.log(`   - ${f}`);
  process.exit(1);
}
console.log(`OK  ifc-real-values: ${checks} checks groen`);
