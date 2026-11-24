import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readIFC } from '@/services/ifc/ifcReader';
import { ifcGuid, ifcGuid128, writeIFCForComparison, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { planningCanon } from '@/services/ifc/foreign/planningCanon';
import {
  classifyIfcx, readIfcx, writeIfcx, IfcxReadError, IfcxWriteRefusedError, type IfcxReadErrorCode,
} from '@/services/ifc/ifcx';
import { ifcxSchemaProblems } from '@/services/ifc/ifcx/schemaCheck';
import { buildIfcxDocument, serializeIfcx } from '@/services/ifc/ifcx/ifcxWriter';
import {
  compactGlobalIdToUuid, isCompactGlobalId, nameBasedUuid, uuidToCompactGlobalId,
} from '@/services/ifc/ifcx/globalIdUuid';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const examplesDir = join(root, 'public/examples');
const fixturesDir = join(root, 'tests/fixtures/ifcx/eigen');
const CLOCK = new Date('2026-11-24T08:00:00.000Z');
const encode = (text: string) => new TextEncoder().encode(text);

let passed = 0, failed = 0;
function test(name: string, action: () => void): void {
  try { action(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}: ${String(error instanceof Error ? error.stack ?? error.message : error).slice(0, 1500)}`); }
}

const NOT_IN_KERN_TASK_FIELDS = [
  'customTaskTypeId', 'levelingDelay', 'levelingDelayMinutes', 'levelingDelayElapsed', 'splitGaps', 'timephasedFinishFloor',
  'timephasedStartAnchor', 'timephasedDurationWalks', 'timephasedContours', 'mspTaskType', 'effortDriven', 'workRule',
  'p6DurationType', 'p6ActivityType', 'p6ProjectId', 'p6TaskId', 'p6ExplicitTargetWindow', 'p6CompletePctType',
  'p6ExpectedFinish', 'p6SuspendResume', 'color', 'activityCodes', 'customFields', 'constraint', 'constraint2', 'isHammock',
  'externalLinks', 'deadline', 'notes',
];
const NOT_IN_KERN_PROJECT_FIELDS = [
  'progressMode', 'schedulingOptions', 'schedulingProfile', 'defaultWorkRule', 'companyId', 'companyName', 'p6ProjectCode',
  'dependentProjectsFolder', 'anchorsFromOpenDocuments',
];

function without<T extends object>(object: T, keys: readonly string[]): T {
  const copy: Record<string, unknown> = { ...object };
  for (const key of keys) delete copy[key];
  return copy as T;
}

function kernOf(full: ImportResult): ImportResult {
  return {
    ...full, resources: [], assignments: [], baselines: [], activeBaselineId: null, comparedBaselineIds: [null, null],
    activityCodeTypes: [], customFieldDefs: [], customTaskTypes: [], ifcLiteralCalendarIds: undefined, libraryPool: undefined,
    project: without(full.project, NOT_IN_KERN_PROJECT_FIELDS),
    tasks: full.tasks.map(task => ({ ...without(task, NOT_IN_KERN_TASK_FIELDS), resourceIds: [],
      time: without(task.time, ['progressBeforeRecalculation']) })),
    sequences: full.sequences.map(sequence => without(sequence, ['p6StartAtPredecessorFinishBoundary'])),
  };
}

const plain = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

function assertSameDomain(back: ImportResult, input: ImportResult): void {
  assert.deepEqual(plain(back.project), plain(input.project), 'project');
  assert.deepEqual(plain(back.calendar), plain(input.calendar), 'projectkalender');
  assert.deepEqual(plain(back.resourceCalendars ?? []), plain(input.resourceCalendars ?? []), 'kalenders');
  assert.deepEqual(plain(back.tasks), plain(input.tasks), 'taken');
  assert.deepEqual(plain(back.sequences), plain(input.sequences), 'relaties');
}

function documentOf(text: string): { header: Record<string, unknown>; imports: unknown[]; schemas: Record<string, unknown>; data: { path: string; attributes: Record<string, Record<string, unknown>> }[] } {
  return JSON.parse(text);
}

function entryWith(document: ReturnType<typeof documentOf>, attribute: string, index = 0) {
  return document.data.filter(entry => attribute in entry.attributes)[index];
}

function readError(text: string | Uint8Array): IfcxReadError {
  try {
    readIfcx(typeof text === 'string' ? encode(text) : text);
  } catch (error) {
    if (error instanceof IfcxReadError) return error;
    throw error;
  }
  throw new Error('verwacht een weigering, maar de lezer las het bestand');
}

function writeRefusal(input: WriteIFCInput): IfcxWriteRefusedError {
  try {
    writeIfcx(input, CLOCK);
  } catch (error) {
    if (error instanceof IfcxWriteRefusedError) return error;
    throw error;
  }
  throw new Error('verwacht een weigering, maar de writer schreef');
}

const examples = readdirSync(examplesDir).filter(name => name.endsWith('.ifc')).sort();
const fullExamples = new Map(examples.map(name => [name, readIFC(readFileSync(join(examplesDir, name), 'utf8'))]));

test('er zijn acht voorbeelden', () => assert.equal(examples.length, 8));

for (const [name, full] of fullExamples) {
  test(`${name}: de kern gaat zonder verschil heen en terug`, () => {
    const kern = kernOf(full);
    const text = writeIfcx(kern, CLOCK);
    const back = readIfcx(encode(text));
    assert.equal(planningCanon(back), planningCanon(kern));
    assert.equal(writeIFCForComparison(back), writeIFCForComparison(kern), 'STEP → IFCX → STEP');
    assertSameDomain(back, kern);
    assert.equal(back.ifcxSharedDatesApplied, undefined);
    assert.deepEqual(ifcxSchemaProblems(JSON.parse(text)), []);
    const again = writeIfcx(back, CLOCK);
    assert.equal(again, text, 'openen, opslaan, heropenen, opslaan geeft dezelfde bytes');
    assert.equal(writeIfcx(kern, CLOCK), text, 'twee keer schrijven geeft dezelfde bytes');
  });

  test(`${name}: het volledige voorbeeld wordt geweigerd in plaats van verloren`, () => {
    const refusal = writeRefusal(full);
    assert.equal(refusal.code, 'unsupported');
    assert.ok(refusal.fields.length > 0);
  });
}

const kern03 = kernOf(fullExamples.get('03-kantoorgebouw-zuidas.ifc')!);

test('de kop heeft de vorm van §5.1 en geen imports of klasse', () => {
  const text = writeIfcx(kern03, CLOCK);
  const document = documentOf(text);
  const projectGuid = kern03.ifcGlobalIds![`proj:${kern03.project.id}`];
  assert.deepEqual(document.header, {
    id: `urn:openaec:planner:${compactGlobalIdToUuid(projectGuid)}`, ifcxVersion: 'ifcx_alpha', dataVersion: '1.0.0',
    author: kern03.project.author, timestamp: CLOCK.toISOString(),
  });
  assert.deepEqual(document.imports, []);
  assert.ok(!text.includes('bsi::ifc::class') && !text.includes('"children"') && !text.includes('"inherits"'));
  assert.equal(entryWith(document, 'openaec::ops::document').attributes['openaec::ops::document'].formatVersion, '1.0.0');
});

test('een taak uit STEP met OPS_TaskIdentity houdt haar interne id en GlobalId', () => {
  const task = kern03.tasks[1];
  const guid = kern03.ifcGlobalIds![`task:${task.id}`];
  assert.ok(guid && !task.id.includes(guid), 'het interne id is niet uit de GlobalId afgeleid');
  const document = documentOf(writeIfcx(kern03, CLOCK));
  const entry = document.data.find(item => item.path === compactGlobalIdToUuid(guid))!;
  assert.equal(entry.attributes['openaec::ops::task'].id, task.id);
  const back = readIfcx(encode(JSON.stringify(document)));
  assert.equal(back.tasks[1].id, task.id);
  assert.equal(back.ifcGlobalIds![`task:${task.id}`], guid);
  const viaStep = readIFC(writeIFCForComparison(back));
  assert.equal(viaStep.tasks[1].id, task.id);
  assert.equal(viaStep.ifcGlobalIds![`task:${task.id}`], guid);
});

function moment(day: number, clock: string): string {
  return `2027-06-${String(day).padStart(2, '0')}T${clock}`;
}

function dateCaseTask(id: string, start: string, finish: string, extra: Partial<Task> = {}): Task {
  return {
    id, name: `Taak ${id}`, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
    priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 1, scheduleStart: start, scheduleFinish: finish,
      earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish, freeFloat: 0, totalFloat: 0,
      isCritical: true, completion: 0, totalFloatMinutes: 0, freeFloatMinutes: 0,
    },
    ...extra,
  };
}

function datePlan(): ImportResult {
  const base = kernOf(fullExamples.get('10-villa-wassenaar.ifc')!);
  const tasks: Task[] = [
    dateCaseTask('binnen-een-dag', moment(1, '07:00'), moment(1, '16:00')),
    dateCaseTask('einde-middernacht', moment(1, '08:00'), moment(3, '00:00')),
    dateCaseTask('handmatig', moment(2, '09:30'), moment(4, '11:15'), { manuallyScheduled: true }),
    dateCaseTask('eindmijlpaal', moment(4, '16:00'), moment(4, '16:00'), { isMilestone: true, milestoneKind: 'FINISH',
      time: { ...dateCaseTask('', moment(4, '16:00'), moment(4, '16:00')).time, scheduleDuration: 0 } }),
  ];
  const sequences: Sequence[] = [
    { id: 'r1', predecessorId: 'binnen-een-dag', successorId: 'einde-middernacht', type: 'FINISH_START', lagDays: 0 },
    { id: 'r2', predecessorId: 'einde-middernacht', successorId: 'eindmijlpaal', type: 'START_START', lagDays: 0, lagMinutes: -90 },
    { id: 'r3', predecessorId: 'handmatig', successorId: 'eindmijlpaal', type: 'FINISH_FINISH', lagDays: 0, lagPercent: 7, lagUnit: 'ELAPSEDTIME' },
    { id: 'r4', predecessorId: 'binnen-een-dag', successorId: 'handmatig', type: 'START_FINISH', lagDays: 2.5 },
  ];
  return {
    project: { ...base.project, id: 'proj-datums', name: 'Datumgevallen', startDate: '2027-06-01', endDate: '2027-06-30T16:00' },
    calendar: base.calendar, resourceCalendars: [], tasks, sequences, resources: [], assignments: [],
  };
}

test('de datumgevallen van §10 hebben de vaste projectie en veranderen niet bij openen', () => {
  const plan = datePlan();
  const text = writeIfcx(plan, CLOCK);
  const document = documentOf(text);
  const span = (index: number) => {
    const activity = entryWith(document, 'openaec::planning::activity', index).attributes['openaec::planning::activity'];
    return [activity.start, activity.endExclusive];
  };
  assert.deepEqual(span(0), ['2027-06-01', '2027-06-02'], 'taak binnen één dag');
  assert.deepEqual(span(1), ['2027-06-01', '2027-06-03'], 'einde om 00:00');
  assert.deepEqual(span(2), ['2027-06-02', '2027-06-05'], 'handmatige taak');
  assert.deepEqual(span(3), ['2027-06-04', '2027-06-05'], 'eindmijlpaal');
  const back = readIfcx(encode(text));
  assertSameDomain(back, plan);
  assert.equal(back.ifcxSharedDatesApplied, undefined);
  assert.equal(back.tasks[2].manuallyScheduled, true);
  assert.equal(planningCanon(back), planningCanon(plan));
  const workplan = entryWith(document, 'openaec::planning::workplan').attributes;
  assert.equal(workplan['openaec::planning::workplan'].start, '2027-06-01');
  assert.equal(workplan['openaec::planning::workplan'].finish, '2027-06-30');
  assert.equal(workplan['openaec::ops::document'].endDate, '2027-06-30T16:00');
  assert.equal(workplan['openaec::ops::document'].startDate, undefined);
});

test('relaties dragen het lagtype en de lag als ISO 8601-duur of verhouding', () => {
  const document = documentOf(writeIfcx(datePlan(), CLOCK));
  const shared = (index: number) => entryWith(document, 'openaec::planning::sequence', index).attributes['openaec::planning::sequence'];
  const ops = (index: number) => entryWith(document, 'openaec::planning::sequence', index).attributes['openaec::ops::sequence'];
  assert.equal(shared(0).timeLag, 'P0D');
  assert.equal(shared(1).timeLag, '-PT90M');
  assert.equal(shared(1).sequenceType, 'START_START');
  assert.deepEqual(ops(1), { id: 'r2' }, 'de lag in minuten volgt uit de gedeelde duur, met teken');
  assert.equal(shared(2).timeLagRatio, 0.07);
  assert.equal(shared(2).lagDurationType, 'ELAPSEDTIME');
  assert.equal(ops(2).lagPercent, 7);
  assert.equal(shared(3).timeLag, 'P2.5D');
  assert.deepEqual(ops(3), { id: 'r4' });
});

test('een gedeelde datum die een ander programma veranderde, wint en maakt de taak handmatig', () => {
  const document = documentOf(writeIfcx(datePlan(), CLOCK));
  const activity = entryWith(document, 'openaec::planning::activity', 0).attributes['openaec::planning::activity'];
  activity.start = '2027-06-08';
  activity.endExclusive = '2027-06-10';
  const back = readIfcx(encode(JSON.stringify(document)));
  assert.equal(back.ifcxSharedDatesApplied, 1);
  const task = back.tasks[0];
  assert.equal(task.manuallyScheduled, true);
  assert.equal(task.time.scheduleStart, '2027-06-08T00:00');
  assert.equal(task.time.earlyStart, '2027-06-08T00:00');
  assert.equal(task.time.scheduleFinish, '2027-06-10T00:00');
  assert.equal(back.tasks[1].manuallyScheduled, undefined);
});

test('GlobalId en UUID zijn dezelfde 128 bits, heen en terug', () => {
  for (let i = 0; i < 2000; i++) {
    const guid = ifcGuid128(`seed-${i}`);
    assert.ok(isCompactGlobalId(guid));
    const uuid = compactGlobalIdToUuid(guid);
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.equal(uuidToCompactGlobalId(uuid), guid);
  }
  assert.equal(compactGlobalIdToUuid('0000000000000000000000'), '00000000-0000-0000-0000-000000000000');
  assert.equal(compactGlobalIdToUuid('3$$$$$$$$$$$$$$$$$$$$$'), 'ffffffff-ffff-ffff-ffff-ffffffffffff');
  assert.ok(!isCompactGlobalId('4' + '0'.repeat(21)));
  assert.ok(!isCompactGlobalId('kort'));
});

test('de naam-UUID is een UUID v5 met de vaste namespace van het profiel', () => {
  const namespace = 'fd4e93a2-de83-56ee-929c-defaa450b626';
  for (const name of ['zzzzzzzzzzzzzzzzzzzzzz', 'oude-guid', 'é ü 漢']) {
    const hash = createHash('sha1').update(Buffer.concat([Buffer.from(namespace.replace(/-/g, ''), 'hex'), Buffer.from(name, 'utf8')])).digest();
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = hash.subarray(0, 16).toString('hex');
    assert.equal(nameBasedUuid(name), `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`);
  }
  const urlNamespace = createHash('sha1').update(Buffer.concat([Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex'), Buffer.from('urn:openaec:planner')])).digest();
  assert.equal(urlNamespace.subarray(0, 4).toString('hex'), namespace.slice(0, 8), 'de namespace is UUID v5 van urn:openaec:planner');
});

test('een GlobalId zonder 128-bitsvorm krijgt een UUID v5 en blijft in openaec::ops:: staan', () => {
  const plan = datePlan();
  const oldGuid = ifcGuid('oude-taak');
  const odd = isCompactGlobalId(oldGuid) ? 'z' + oldGuid.slice(1) : oldGuid;
  const input: ImportResult = { ...plan, ifcGlobalIds: { 'task:handmatig': odd, 'seq:r1': 'geen-guid' } };
  const text = writeIfcx(input, CLOCK);
  const document = documentOf(text);
  const entry = document.data.find(item => item.path === nameBasedUuid(odd))!;
  assert.equal(entry.attributes['openaec::ops::task'].globalId, odd);
  const back = readIfcx(encode(text));
  assert.equal(back.ifcGlobalIds!['task:handmatig'], odd);
  assert.equal(back.ifcGlobalIds!['seq:r1'], 'geen-guid');
  assert.equal(writeIFCForComparison(back), writeIFCForComparison(input));
});

test('de volgorde onder een ouder komt terug met zo weinig mogelijk volgnummers', () => {
  const parent = kern03.tasks.find(task => task.childIds.length >= 4)!;
  const reversed = [...parent.childIds].reverse();
  const input: ImportResult = { ...kern03, tasks: kern03.tasks.map(task => task.id === parent.id ? { ...task, childIds: reversed } : task) };
  const text = writeIfcx(input, CLOCK);
  const back = readIfcx(encode(text));
  assert.deepEqual(back.tasks.find(task => task.id === parent.id)!.childIds, reversed);
  const places = documentOf(text).data.filter(entry => entry.attributes['openaec::ops::task']?.place !== undefined).length;
  assert.equal(places, reversed.length - 1);
  assert.equal(documentOf(writeIfcx(kern03, CLOCK)).data.filter(entry => entry.attributes['openaec::ops::task']?.place !== undefined).length, 0);
});

test('de eigen schemacontrole keurt een kapotte uitvoer af', () => {
  const good = JSON.parse(writeIfcx(datePlan(), CLOCK));
  assert.deepEqual(ifcxSchemaProblems(good), []);
  const broken = (change: (document: ReturnType<typeof documentOf>) => void) => {
    const document = structuredClone(good);
    change(document);
    return ifcxSchemaProblems(document);
  };
  assert.ok(broken(d => { entryWith(d, 'openaec::planning::activity').attributes['openaec::planning::activity'].priority = 'hoog'; }).length > 0);
  assert.ok(broken(d => { entryWith(d, 'openaec::ops::task').attributes['openaec::ops::task'].onbekend = 1; }).length > 0);
  assert.ok(broken(d => { delete d.schemas['openaec::planning::sequence']; }).length > 0);
  assert.ok(broken(d => { (d.schemas['openaec::planning::calendar'] as { value: { dataType: string } }).value.dataType = 'String'; }).length > 0);
  assert.ok(broken(d => { delete entryWith(d, 'openaec::ops::task').attributes['openaec::ops::task'].time; }).length > 0);
});

const goodText = writeIfcx(datePlan(), CLOCK);
const REFUSALS: readonly { name: string; code: IfcxReadErrorCode; change: (document: ReturnType<typeof documentOf>) => unknown }[] = [
  { name: 'een vreemde kop', code: 'foreign', change: d => { d.header.id = 'urn:ifccad:model:1'; } },
  { name: 'een onbekend kopveld', code: 'foreign', change: d => { d.header.openaecComposition = {}; } },
  { name: 'een onbekend attribuut', code: 'foreign', change: d => { entryWith(d, 'openaec::planning::activity').attributes['bsi::ifc::class'] = { code: 'IfcTask' }; } },
  { name: 'een onbekend eigen attribuut', code: 'newer-profile', change: d => { entryWith(d, 'openaec::planning::activity').attributes['openaec::ops::toekomst'] = {}; } },
  { name: 'children', code: 'foreign', change: d => { (entryWith(d, 'openaec::planning::activity') as Record<string, unknown>).children = {}; } },
  { name: 'inherits', code: 'foreign', change: d => { (entryWith(d, 'openaec::planning::activity') as Record<string, unknown>).inherits = {}; } },
  { name: 'imports', code: 'foreign', change: d => { d.imports.push({ uri: 'https://example.org/ander.ifcx' }); } },
  { name: 'een onbekend veld in openaec::ops::', code: 'newer-profile', change: d => { entryWith(d, 'openaec::ops::task').attributes['openaec::ops::task'].toekomst = 1; } },
  { name: 'een onbekend veld in openaec::planning::', code: 'foreign', change: d => { entryWith(d, 'openaec::planning::activity').attributes['openaec::planning::activity'].status = 'example'; } },
  { name: 'een ongeldige waarde', code: 'invalid', change: d => { entryWith(d, 'openaec::planning::activity').attributes['openaec::planning::activity'].start = '1 juni'; } },
  { name: 'een ongeldige verwijzing', code: 'invalid', change: d => {
    entryWith(d, 'openaec::planning::activity').attributes['openaec::planning::activity'].parent = entryWith(d, 'openaec::planning::sequence').path;
  } },
  { name: 'een andere ifcxVersion', code: 'version', change: d => { d.header.ifcxVersion = 'ifcx_beta'; } },
  { name: 'een hogere profielversie', code: 'newer-profile', change: d => { entryWith(d, 'openaec::ops::document').attributes['openaec::ops::document'].formatVersion = '2.0.0'; } },
  { name: 'twee bijdragen op één pad', code: 'foreign', change: d => { d.data.push(structuredClone(entryWith(d, 'openaec::planning::activity'))); } },
  { name: 'een pad dat geen UUID is', code: 'foreign', change: d => { entryWith(d, 'openaec::planning::sequence').path = '/planning/work-0'; } },
  { name: 'een tweede werkplan', code: 'foreign', change: d => {
    d.data.push({ ...structuredClone(entryWith(d, 'openaec::planning::workplan')), path: '00000000-0000-4000-8000-000000000001' });
  } },
  { name: 'een losse openaec::ops::task', code: 'foreign', change: d => { delete entryWith(d, 'openaec::ops::task').attributes['openaec::planning::activity']; } },
];

for (const refusal of REFUSALS) {
  test(`de lezer weigert ${refusal.name} met code ${refusal.code}`, () => {
    const document = documentOf(goodText);
    refusal.change(document);
    const bytes = encode(JSON.stringify(document));
    const error = readError(bytes);
    assert.equal(error.code, refusal.code, error.message);
    assert.equal(classifyIfcx(bytes), refusal.code === 'foreign' ? 'foreign' : 'unreadable');
  });
}

test('een ongeldige waarde noemt pad en veld', () => {
  const document = documentOf(goodText);
  const entry = entryWith(document, 'openaec::ops::task', 2);
  entry.attributes['openaec::ops::task'].time = { ...entry.attributes['openaec::ops::task'].time as object, freeFloat: 'veel' };
  const error = readError(JSON.stringify(document));
  assert.equal(error.code, 'invalid');
  assert.deepEqual(error.place, { path: entry.path, attribute: 'openaec::ops::task', field: 'time.freeFloat' });
});

test('wat geen IFCX is, heet not-ifcx', () => {
  for (const bytes of [encode('ISO-10303-21;\nHEADER;'), encode('[1,2]'), encode('{"header":{}}'), new Uint8Array([0xff, 0xfe, 0x00])]) {
    assert.equal(readError(bytes).code, 'not-ifcx');
    assert.equal(classifyIfcx(bytes), 'not-ifcx');
  }
  assert.equal(classifyIfcx(encode(goodText)), 'own');
});

test('de voorcontrole noemt wat deze versie van IFCX nog niet draagt', () => {
  const plan = datePlan();
  const refusal = writeRefusal({
    ...plan, project: { ...plan.project, schedulingOptions: { lagCalendar: '24hour' } },
    tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, constraint: { type: 'SNET', date: '2027-06-01' } } : task),
  });
  assert.equal(refusal.code, 'unsupported');
  assert.deepEqual([...refusal.fields].sort(), ['project.schedulingOptions', 'task.constraint']);
});

test('een relatie naar een taak die niet bestaat wordt geweigerd', () => {
  const plan = datePlan();
  const refusal = writeRefusal({ ...plan, sequences: [...plan.sequences, { id: 'los', predecessorId: 'weg', successorId: 'handmatig', type: 'FINISH_START', lagDays: 0 }] });
  assert.equal(refusal.code, 'unsupported');
  assert.deepEqual(refusal.fields, ['sequence.predecessorId']);
});

test('de zelfcontrole weigert wat de voorcontrole niet ziet', () => {
  const plan = datePlan();
  const odd = writeRefusal({ ...plan, tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, time: { ...task.time, lateStart: 'morgen' } } : task) });
  assert.equal(odd.code, 'self-check');
  const library = writeRefusal({ ...plan, resourceCalendars: [{ ...plan.calendar }] });
  assert.equal(library.code, 'self-check');
});

test('bekende grens 2220: bij een dubbele sleutel in een eigen bestand wint stil de laatste', () => {
  const doubled = goodText.replace('"name":"Taak binnen-een-dag"', '"name":"Oud","name":"Taak binnen-een-dag"');
  assert.notEqual(doubled, goodText);
  assert.equal(readIfcx(encode(doubled)).tasks[0].name, 'Taak binnen-een-dag');
});

test('bekende grens 2222: een kind dat haar ouder niet noemt, weigert de zelfcontrole', () => {
  const plan = datePlan();
  const refusal = writeRefusal({ ...plan, tasks: plan.tasks.map(task => task.id === 'binnen-een-dag' ? { ...task, childIds: ['handmatig'] } : task) });
  assert.equal(refusal.code, 'self-check');
});

const FIXTURES: readonly { file: string; input: () => ImportResult }[] = [
  { file: 'datumgevallen.ifcx', input: datePlan },
  { file: 'verbouwing-eengezinswoning-kern.ifcx', input: () => kernOf(fullExamples.get('showcase-verbouwing-eengezinswoning.ifc')!) },
];

for (const fixture of FIXTURES) {
  test(`voorbeeldbestand ${fixture.file} is wat de writer nu schrijft`, () => {
    const text = writeIfcx(fixture.input(), CLOCK);
    if (process.env.OPS_IFCX_FIXTURES_WRITE === '1') {
      mkdirSync(fixturesDir, { recursive: true });
      writeFileSync(join(fixturesDir, fixture.file), text);
    }
    const onDisk = readFileSync(join(fixturesDir, fixture.file), 'utf8');
    assert.equal(onDisk, text);
    assert.equal(writeIfcx(readIfcx(encode(onDisk)), CLOCK), onDisk);
    assert.equal(classifyIfcx(encode(onDisk)), 'own');
  });
}

function syntheticPlan(count: number): ImportResult {
  const base = kern03;
  const tasks: Task[] = [];
  const sequences: Sequence[] = [];
  let summary: Task | undefined;
  let previousLeaf: string | undefined;
  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor(i / 25) * 7 + (i % 25) % 5;
    const day = new Date(Date.UTC(2027, 0, 4 + dayOffset));
    const date = day.toISOString().slice(0, 10);
    if (i % 25 === 0) {
      summary = { ...dateCaseTask(`groep-${i}`, `${date}T07:00`, `${date}T16:00`), wbsCode: String(i / 25 + 1), name: `Groep ${i / 25 + 1}` };
      tasks.push(summary);
      previousLeaf = undefined;
      continue;
    }
    const leaf: Task = {
      ...dateCaseTask(`taak-${i}`, `${date}T07:00`, `${date}T16:00`), parentId: summary!.id, wbsCode: `${summary!.wbsCode}.${i % 25}`,
      description: i % 3 === 0 ? 'Bekisting, wapening en storten' : '',
    };
    leaf.time = { ...leaf.time, completion: i % 7 === 0 ? 0.4 : 0, totalFloat: i % 4, totalFloatMinutes: (i % 4) * 480, ...(i % 7 === 0 ? { actualStart: leaf.time.scheduleStart } : {}) };
    tasks.push(leaf);
    summary!.childIds.push(leaf.id);
    if (previousLeaf) sequences.push({ id: `rel-${i}`, predecessorId: previousLeaf, successorId: leaf.id, type: 'FINISH_START', lagDays: i % 10 === 0 ? 1 : 0 });
    previousLeaf = leaf.id;
  }
  return { ...base, ifcGlobalIds: {}, tasks, sequences };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const sizes = process.env.OPS_IFCX_MEASURE === '1' ? [1000, 5000, 10000] : [1000];
for (const size of sizes) {
  test(`meting: schrijven met zelfcontrole en teruglezen bij ${size} taken`, () => {
    const plan = syntheticPlan(size);
    const rounds = size > 1000 ? 3 : 5;
    const plainWrite: number[] = [], write: number[] = [], read: number[] = [], canon: number[] = [];
    let text = '';
    for (let round = 0; round < rounds; round++) {
      const t0 = performance.now();
      const unchecked = serializeIfcx(buildIfcxDocument(plan, CLOCK));
      const t1 = performance.now();
      text = writeIfcx(plan, CLOCK);
      const t2 = performance.now();
      const back = readIfcx(encode(text));
      const t3 = performance.now();
      planningCanon(back);
      const t4 = performance.now();
      assert.equal(unchecked, text);
      plainWrite.push(t1 - t0);
      write.push(t2 - t1);
      read.push(t3 - t2);
      canon.push(t4 - t3);
    }
    console.log(`   ${size} taken, ${(text.length / 1024 / 1024).toFixed(1)} MiB: schrijven zonder zelfcontrole ${median(plainWrite).toFixed(0)} ms, `
      + `writeIfcx met zelfcontrole ${median(write).toFixed(0)} ms, readIfcx ${median(read).toFixed(0)} ms, `
      + `één planningCanon ${median(canon).toFixed(0)} ms (mediaan van ${rounds})`);
  });
}

console.log(`IFCX-kern: ${passed} proeven geslaagd, ${failed} fouten`);
if (failed) process.exitCode = 1;
