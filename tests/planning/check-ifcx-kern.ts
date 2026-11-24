import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { readIFC } from '@/services/ifc/ifcReader';
import { ifcGuid, ifcGuid128, ifcObjectSeed, writeIFCForComparison, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { planProgressEntry } from '@/engine/progressEntry';
import {
  classifyIfcx, readIfcx, writeIfcx, IfcxReadError, IfcxWriteRefusedError, type IfcxReadErrorCode, type IfcxWriteRefusedCode,
} from '@/services/ifc/ifcx';
import { ifcxSchemaProblems } from '@/services/ifc/ifcx/schemaCheck';
import { SELF_CHECK_RULES, selfCheckDifferences } from '@/services/ifc/ifcx/selfCheck';
import { readIfcxText } from '@/services/ifc/ifcx/ifcxReader';
import { stepRoundtrip } from '@/services/ifc/ifcx/stepRoundtrip';
import { HEADER_VALUE, OWN_ATTRIBUTE_VALUES } from '@/services/ifc/ifcx/ownAttributes';
import { IDENTITY_KINDS, intendedGlobalIds, type PlanningModel } from '@/services/ifc/ifcx/identity';
import { CALENDAR_AREA, DOCUMENT_AREA, SEQUENCE_AREA, TASK_AREA } from '@/services/ifc/ifcx/fieldGroups';
import { TASK_TIME_FIELDS } from '@/services/ifc/ifcx/fields/taskFields';
import {
  CALENDAR_DATE_FORM, FREE_TEXT_FORM, GLOBAL_ID_OUTSIDE_PATH_FORM, ISO_DATE_OR_MOMENT_OR_EMPTY_FORM, ISO_MOMENT_FORM,
  LOCAL_MOMENT_OR_EMPTY_FORM, NON_EMPTY_TEXT_FORM, VERSION_FORM, type IfcxField, type IfcxValue,
} from '@/services/ifc/ifcx/fieldTable';
import {
  compactGlobalIdToUuid, isCompactGlobalId, nameBasedUuid, uuidToCompactGlobalId,
} from '@/services/ifc/ifcx/globalIdUuid';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { syncProjectCalendar } from '@/state/syncProjectCalendar';
import { buildWriteIFCInput, type IFCSaveSource } from '@/state/ifcSaveInput';

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
  const copy = { ...object } as Record<string, unknown>;
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

function domainOf(model: ImportResult): Record<string, unknown> {
  return plain({
    project: model.project, calendar: model.calendar, resourceCalendars: model.resourceCalendars ?? [],
    tasks: model.tasks, sequences: model.sequences, ifcGlobalIds: Object.fromEntries(intendedGlobalIds(model)),
  }) as Record<string, unknown>;
}

function assertAsStep(back: ImportResult, input: WriteIFCInput): void {
  const expected = domainOf(stepRoundtrip(input));
  const actual = domainOf(back);
  for (const key of Object.keys(expected)) assert.deepEqual(actual[key], expected[key], key);
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
  test(`${name}: de kern komt terug zoals de STEP-rondgang haar geeft (R1)`, () => {
    const kern = kernOf(full);
    const text = writeIfcx(kern, CLOCK);
    const back = readIfcx(encode(text));
    assertAsStep(back, kern);
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

test('de datumgevallen van §10 hebben de vaste projectie en komen terug zoals in STEP', () => {
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
  assertAsStep(back, plan);
  assert.equal(back.tasks[2].manuallyScheduled, true);
  const workplan = entryWith(document, 'openaec::planning::workplan').attributes;
  assert.equal(workplan['openaec::planning::workplan'].start, '2027-06-01');
  assert.equal(workplan['openaec::planning::workplan'].finish, '2027-06-30');
  assert.equal(workplan['openaec::ops::document'].endDate, '2027-06-30T16:00');
  assert.equal(workplan['openaec::ops::document'].startDate, '2027-06-01');
});

test('relaties dragen het lagtype en de lag als ISO 8601-duur of verhouding', () => {
  const plan = datePlan();
  const document = documentOf(writeIfcx(plan, CLOCK));
  const shared = (index: number) => entryWith(document, 'openaec::planning::sequence', index).attributes['openaec::planning::sequence'];
  const ops = (index: number) => entryWith(document, 'openaec::planning::sequence', index).attributes['openaec::ops::sequence'];
  const step = stepRoundtrip(plan).sequences;
  assert.equal(shared(0).timeLag, 'P0D');
  assert.equal(shared(1).timeLag, '-PT90M');
  assert.equal(shared(1).sequenceType, 'START_START');
  assert.equal(ops(1).lagMinutes, step[1].lagMinutes);
  assert.equal(shared(2).timeLagRatio, (step[2].lagPercent ?? 0) / 100);
  assert.equal(shared(2).lagDurationType, 'ELAPSEDTIME');
  assert.equal(ops(2).lagPercent, step[2].lagPercent);
  assert.equal(shared(3).timeLag, 'P2.5D');
  assert.equal(ops(3).lagDays, 2.5);
});

test('een gedeelde datum die een ander programma veranderde, opent niet en noemt veld en taak (§5.3 vervalt)', () => {
  const document = documentOf(writeIfcx(datePlan(), CLOCK));
  const entry = entryWith(document, 'openaec::planning::activity', 0);
  entry.attributes['openaec::planning::activity'].start = '2027-06-08';
  const error = readError(JSON.stringify(document));
  assert.equal(error.code, 'invalid');
  assert.deepEqual(error.place, { path: entry.path, attribute: 'openaec::planning::activity', field: 'start' });
  assert.match(error.message, /taak binnen-een-dag/);
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
  assertAsStep(back, input);
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

function saveInputViaApp(result: ImportResult): WriteIFCInput {
  const source = {
    ...result, calendars: [...(result.resourceCalendars ?? [])], minuteModelPending: false,
    ifcGlobalIds: result.ifcGlobalIds ?? null, ifcLiteralCalendarIds: null, ifcSource: null,
    activityCodeTypes: result.activityCodeTypes ?? [], customFieldDefs: result.customFieldDefs ?? [],
    customTaskTypes: result.customTaskTypes ?? [], baselines: result.baselines ?? [], activeBaselineId: result.activeBaselineId ?? null,
    comparedBaselineIds: result.comparedBaselineIds ?? [null, null],
  } as unknown as IFCSaveSource;
  syncProjectCalendar(source);
  return buildWriteIFCInput(source, 'planOnly');
}

for (const [name, input] of [...[...fullExamples].map(([file, full]) => [file, kernOf(full)] as const), ['datumgevallen', datePlan()] as const]) {
  test(`${name}: de projectkalender als cache en als bibliotheekentry, zoals de app haar doorgeeft`, () => {
    const viaApp = saveInputViaApp(input);
    assert.ok((viaApp.resourceCalendars ?? []).some(calendar => calendar.id === viaApp.project.calendarId), 'de bibliotheek draagt de projectkalender');
    const text = writeIfcx(viaApp, CLOCK);
    const back = readIfcx(encode(text));
    assertAsStep(back, viaApp);
    const step = stepRoundtrip(viaApp);
    assert.equal(documentOf(text).data.filter(entry => 'openaec::planning::calendar' in entry.attributes).length,
      new Set([step.calendar.id, ...(step.resourceCalendars ?? []).map(calendar => calendar.id)]).size);
  });
}


function changedFixture(change: (document: ReturnType<typeof documentOf>, activities: { path: string; attributes: Record<string, Record<string, unknown>> }[]) => void): Uint8Array {
  const document = documentOf(goodText);
  change(document, document.data.filter(entry => 'openaec::planning::activity' in entry.attributes));
  return encode(JSON.stringify(document));
}

const HEADER_AND_SCHEMA_REFUSALS: readonly { name: string; code: IfcxReadErrorCode; schema?: true; change: (document: ReturnType<typeof documentOf>) => void }[] = [
  { name: 'een afwijkend schema voor een eigen attribuut', code: 'invalid', schema: true, change: d => {
    (d.schemas['openaec::planning::activity'] as { value: { dataType: string } }).value.dataType = 'String';
  } },
  { name: 'een vreemd schema', code: 'foreign', schema: true, change: d => { d.schemas['ander::maatvoering::veld'] = { value: { dataType: 'String' } }; } },
  { name: 'een schema van een nieuwere Open Planner Studio', code: 'newer-profile', schema: true, change: d => { d.schemas['openaec::ops::toekomst'] = { value: { dataType: 'String' } }; } },
  { name: 'een ontbrekend schema', code: 'invalid', schema: true, change: d => { delete d.schemas['openaec::ops::sequence']; } },
  { name: 'ontbrekende schemas', code: 'invalid', schema: true, change: d => { delete (d as Partial<typeof d>).schemas; } },
  { name: 'ontbrekende imports', code: 'invalid', change: d => { delete (d as Partial<typeof d>).imports; } },
  { name: 'een kop zonder timestamp', code: 'invalid', change: d => { delete d.header.timestamp; } },
  { name: 'een kop zonder dataVersion', code: 'invalid', change: d => { delete d.header.dataVersion; } },
];

for (const refusal of HEADER_AND_SCHEMA_REFUSALS) {
  test(`de lezer weigert ${refusal.name} met code ${refusal.code}`, () => {
    const document = documentOf(goodText);
    refusal.change(document);
    const error = readError(JSON.stringify(document));
    assert.equal(error.code, refusal.code, error.message);
    if (refusal.schema) assert.ok(ifcxSchemaProblems(document).length > 0, 'ook de schemacontrole ziet het');
  });
}

test('dubbele interne id\'s worden bij lezen en bij schrijven geweigerd', () => {
  const error = readError(changedFixture((_document, [first, second]) => {
    second.attributes['openaec::ops::task'].id = first.attributes['openaec::ops::task'].id ?? first.path;
  }));
  assert.equal(error.code, 'invalid', error.message);
  assert.equal(error.place.field, 'task.id');
  const plan = datePlan();
  assert.deepEqual(writeRefusal({ ...plan, tasks: [...plan.tasks, { ...plan.tasks[0] }] }).fields, ['task.id']);
  assert.deepEqual(writeRefusal({ ...plan, sequences: [...plan.sequences, { ...plan.sequences[0] }] }).fields, ['sequence.id']);
  assert.equal(writeRefusal({ ...plan, tasks: [...plan.tasks, { ...plan.tasks[0] }] }).code, 'inconsistent');
});

test('de boom komt zoals in STEP uit de kinderlijsten: een kind dat niet bestaat valt weg, de ouder volgt uit de lijst', () => {
  const plan = datePlan();
  for (const input of [
    { ...plan, tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, isSummary: true, childIds: ['bestaat-niet'] } : task) },
    { ...plan, tasks: plan.tasks.map(task => task.id === 'binnen-een-dag' ? { ...task, childIds: ['handmatig'] } : task) },
    { ...plan, tasks: plan.tasks.map((task, index) => index === 1 ? { ...task, parentId: 'weg' } : task) },
  ]) assertAsStep(readIfcx(encode(writeIfcx(input, CLOCK))), input);
});

test('een relatie naar een taak die niet bestaat wordt geweigerd (regel C)', () => {
  const plan = datePlan();
  const relation = writeRefusal({ ...plan, sequences: [...plan.sequences, { id: 'los', predecessorId: 'weg', successorId: 'handmatig', type: 'FINISH_START', lagDays: 0 }] });
  assert.equal(relation.code, 'inconsistent');
  assert.deepEqual(relation.fields, ['sequence.predecessorId']);
  assert.match(relation.message, /sequence los verwijst met predecessorId naar weg/);
});

test('onmogelijke dagen en kloktijden worden geweigerd', () => {
  for (const change of [
    (_d: ReturnType<typeof documentOf>, [first]: { attributes: Record<string, Record<string, unknown>> }[]) => {
      first.attributes['openaec::planning::activity'].start = '2027-02-30';
    },
    (_d: ReturnType<typeof documentOf>, [first]: { attributes: Record<string, Record<string, unknown>> }[]) => {
      (first.attributes['openaec::ops::task'].time as Record<string, unknown>).lateStart = '2027-06-01T99:99';
    },
    (d: ReturnType<typeof documentOf>) => {
      const calendar = entryWith(d, 'openaec::planning::calendar').attributes['openaec::planning::calendar'];
      (calendar.exceptionTimes as { start: string }[])[0].start = '2027-13-01';
    },
  ]) {
    const error = readError(changedFixture(change));
    assert.equal(error.code, 'invalid', error.message);
  }
  const plan = datePlan();
  const odd = writeRefusal({ ...plan, tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, time: { ...task.time, lateStart: '2027-06-01T99:99' } } : task) });
  assert.equal(odd.code, 'invalid');
  assert.match(odd.message, /Opslaan als IFC weigert deze planning/);
  const zoned = { ...plan, tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, time: { ...task.time, lateStart: '2027-06-01T07:00+02:00' } } : task) };
  const zonedOutcome = attempt(() => writeIfcx(zoned, CLOCK));
  if (zonedOutcome.ok) assertAsStep(readIfcx(encode(zonedOutcome.value)), zoned);
  else assert.ok(zonedOutcome.error instanceof IfcxWriteRefusedError && zonedOutcome.error.code === 'invalid', String(zonedOutcome.error));
});

test('projectmomenten, tekst, lege tijden, nul en kalenderblokken gaan precies heen en terug', () => {
  const plan = datePlan();
  const input: ImportResult = {
    ...plan,
    project: { ...plan.project, startDate: '2027-06-01T23:30-04:00', endDate: '2027-02-28', name: 'Béton 🧱 漢字' },
    calendar: {
      ...plan.calendar, description: 'Café 🧱', shift: 'THIRD', simpleBreakStartMinute: 0, simpleBreakDurationMinutes: 0,
      holidays: [{ name: 'Vrij', startDate: '2027-06-03', endDate: '' }],
      workingExceptions: [{ name: 'Één blok', startDate: '2027-06-05', endDate: '2027-06-05', bands: [{ start: 480, end: 600 }] }],
      workTime: { byWeekday: { 1: [{ start: 420, end: 960 }], 2: [{ start: 420, end: 960 }], 3: [{ start: 420, end: 960 }], 4: [{ start: 420, end: 960 }], 5: [{ start: 420, end: 960 }], 6: [], 7: [] } },
    },
    tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, time: { ...task.time, lateStart: '', actualStart: '', remainingMinutes: 0 } } : task),
    sequences: plan.sequences.map((sequence, index) => index === 0 ? { ...sequence, lagMinutes: 0 } : sequence),
  };
  assertAsStep(readIfcx(encode(writeIfcx(input, CLOCK))), input);
});

test('de writer weigert vóór het schrijven een tijd die de lezer niet aanvaardt', () => {
  const plan = datePlan();
  const odd = writeRefusal({ ...plan, tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, time: { ...task.time, lateStart: 'morgen' } } : task) });
  assert.equal(odd.code, 'invalid');
});

test('bekende grens 2220: bij een dubbele sleutel in een eigen bestand wint stil de laatste', () => {
  const doubled = goodText.replace('"name":"Taak binnen-een-dag"', '"name":"Oud","name":"Taak binnen-een-dag"');
  assert.notEqual(doubled, goodText);
  assert.equal(readIfcx(encode(doubled)).tasks[0].name, 'Taak binnen-een-dag');
});

test('een veld dat STEP niet bewaart, bewaart IFCX ook niet: geen fout (besluit 3 van Trias)', () => {
  const plan = datePlan();
  for (const input of [
    { ...plan, toekomstigVeld: 1 } as WriteIFCInput,
    { ...plan, calendar: { ...plan.calendar, holidays: plan.calendar.holidays.map((holiday, index) => index === 0 ? { ...holiday, bron: 'cao' } : holiday) } },
  ]) {
    const back = readIfcx(encode(writeIfcx(input, CLOCK)));
    assertAsStep(back, input);
    assert.ok(!('toekomstigVeld' in back) && !('bron' in back.calendar.holidays[0]));
  }
});

test('de zelfcontrole ziet een waarde die bij het teruglezen stil verandert', () => {
  const plan = datePlan();
  const text = writeIfcx(plan, CLOCK);
  const step = stepRoundtrip(plan);
  const reread = readIfcxText(text, false);
  assert.deepEqual(selfCheckDifferences(step, reread), []);
  const shifted = { ...reread, tasks: reread.tasks.map((task, index) => index === 1 ? { ...task, priority: task.priority + 1 } : task) };
  assert.deepEqual(selfCheckDifferences(step, shifted).map(difference => difference.slice(0, difference.indexOf(': '))), ['tasks[1].priority']);
  const reordered = { ...reread, sequences: [...reread.sequences].reverse() };
  assert.ok(selfCheckDifferences(step, reordered).length > 0, 'de volgorde telt mee');
});

const SELF_CHECK_WITNESSES: Readonly<Record<string, () => WriteIFCInput>> = {
  leesmeta: datePlan,
  'nee-is-afwezig': () => ({ ...datePlan(), minuteModelPending: false }),
};

test('de lijst uitzonderingen van de zelfcontrole heeft voor elke regel een geval', () => {
  assert.deepEqual(SELF_CHECK_RULES.map(rule => rule.id).sort(), Object.keys(SELF_CHECK_WITNESSES).sort());
  const wrong: string[] = [];
  for (const rule of SELF_CHECK_RULES) {
    if (rule.reason.length <= 20) wrong.push(`${rule.id}: geen reden`);
    const outcome = attempt(() => {
      const input = SELF_CHECK_WITNESSES[rule.id]();
      const step = stepRoundtrip(input);
      const reread = readIfcxText(writeIfcx(input, CLOCK), false);
      return [selfCheckDifferences(step, reread), selfCheckDifferences(step, reread, SELF_CHECK_RULES.filter(other => other !== rule))];
    });
    if (!outcome.ok) wrong.push(`${rule.id}: ${String(outcome.error).slice(0, 200)}`);
    else if (outcome.value[0].length > 0) wrong.push(`${rule.id}: ${outcome.value[0].join('; ')}`);
    else if (outcome.value[1].length === 0) wrong.push(`${rule.id}: zonder de regel ziet de controle geen verschil`);
  }
  assert.deepEqual(wrong, []);
});

const FILLED_IS_REFUSED: Readonly<Record<string, () => WriteIFCInput>> = {
  'een openstaande omzetting': () => ({ ...datePlan(), minuteModelPending: true }),
  'een vergelijking met een baseline die er niet is': () => ({ ...datePlan(), comparedBaselineIds: ['b1', null] }),
  'een actieve baseline die er niet is': () => ({ ...datePlan(), activeBaselineId: 'b1' }),
  'een notitie op een taak': () => {
    const plan = datePlan();
    return { ...plan, tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, notes: [{ id: 'n1', text: 'Let op', done: false }] } : task) };
  },
};

test('wat STEP met inhoud bewaart en IFCX niet draagt, weigert de writer met unsupported; wat STEP laat vallen, laat IFCX ook vallen', () => {
  const wrong: string[] = [], outcomes: string[] = [];
  for (const [name, make] of Object.entries(FILLED_IS_REFUSED)) {
    const input = make();
    const outcome = attempt(() => writeIfcx(input, CLOCK));
    if (outcome.ok) {
      if (!isDeepStrictEqual(domainOf(readIfcx(encode(outcome.value))), domainOf(stepRoundtrip(input)))) wrong.push(`${name}: anders dan STEP`);
      outcomes.push(`${name}: STEP laat het vallen`);
    } else if (outcome.error instanceof IfcxWriteRefusedError && outcome.error.code === 'unsupported') {
      outcomes.push(`${name}: unsupported (${outcome.error.fields.join(', ')})`);
    } else wrong.push(`${name}: ${String(outcome.error)}`);
  }
  assert.deepEqual(wrong, []);
  assert.ok(outcomes.some(outcome => outcome.includes('unsupported')), outcomes.join('; '));
  console.log(`   ${outcomes.join('; ')}`);
});

test('een leeg onbekend veld laat STEP vallen en IFCX ook; een werktijd zonder dagen weigeren beide (ronde 1, blokkade 1)', () => {
  const plan = datePlan();
  for (const empty of [null, [], {}]) {
    for (const input of [
      { ...plan, toekomstigVeld: empty } as unknown as WriteIFCInput,
      { ...plan, calendar: { ...plan.calendar, holidays: plan.calendar.holidays.map((holiday, index) => index === 0 ? { ...holiday, bron: empty } : holiday) } } as unknown as WriteIFCInput,
    ]) assertAsStep(readIfcx(encode(writeIfcx(input, CLOCK))), input);
  }
  const workTime = { ...plan, calendar: { ...plan.calendar, workTime: {} } } as unknown as WriteIFCInput;
  assert.ok(!attempt(() => stepRoundtrip(workTime)).ok, 'STEP weigert');
  assert.equal(writeRefusal(workTime).code, 'invalid');
});

test('een gestarte taak die in de app vóór haar werkelijke start eindigt, schrijft en leest als in de app (ronde 2, blokkade 2)', () => {
  const plan = datePlan();
  const late = { ...plan, tasks: plan.tasks.map((task, index) => index === 0
    ? { ...task, time: { ...task.time, actualStart: '2027-06-03T07:00', completion: 0.5 } } : task) };
  const back = readIfcx(encode(writeIfcx(late, CLOCK)));
  assertAsStep(back, late);
  assert.equal(back.tasks[0].time.actualStart, '2027-06-03T07:00');
});


test('een dubbele GlobalId wordt bij lezen en bij schrijven geweigerd, nooit stil vervangen (blokkade 3)', () => {
  const compactOfFirst = readError(changedFixture((_document, [first, second]) => {
    second.attributes['openaec::ops::task'].globalId = uuidToCompactGlobalId(first.path);
  }));
  assert.equal(compactOfFirst.code, 'invalid', compactOfFirst.message);
  assert.equal(compactOfFirst.place.field, 'globalId');
  const wrongPath = readError(changedFixture((_document, [first]) => { first.attributes['openaec::ops::task'].globalId = 'oud-1'; }));
  assert.equal(wrongPath.code, 'invalid', wrongPath.message);
  assert.equal(wrongPath.place.field, 'globalId');
  const projectPath = readError(changedFixture((document, [first]) => {
    const oldPath = first.path;
    first.path = String(document.header.id).slice('urn:openaec:planner:'.length);
    for (const entry of document.data) {
      for (const attribute of Object.values(entry.attributes)) {
        for (const key of ['relatingProcess', 'relatedProcess', 'parent', 'predecessor', 'successor']) if (attribute[key] === oldPath) attribute[key] = first.path;
      }
    }
  }));
  assert.equal(projectPath.code, 'invalid', projectPath.message);
  assert.equal(projectPath.place.field, 'task.globalId');
  const plan = datePlan();
  const [first, second] = plan.tasks;
  const shared = ifcGuid128('gedeeld');
  const twoTasks = writeRefusal({ ...plan, ifcGlobalIds: { [`task:${first.id}`]: shared, [`task:${second.id}`]: shared } });
  assert.equal(twoTasks.code, 'inconsistent');
  assert.deepEqual(twoTasks.fields, ['task.globalId']);
  assert.match(twoTasks.message, new RegExp(`task ${second.id} heeft dezelfde GlobalId ${shared} als task ${first.id}`));
  const projectAndTask = writeRefusal({ ...plan, ifcGlobalIds: { [`proj:${plan.project.id}`]: shared, [`task:${first.id}`]: shared } });
  assert.deepEqual(projectAndTask.fields, ['task.globalId']);
});

function sequenceFixture(change: (sequence: Record<string, unknown>) => void): Uint8Array {
  const document = documentOf(goodText);
  change(entryWith(document, 'openaec::planning::sequence').attributes['openaec::planning::sequence']);
  return encode(JSON.stringify(document));
}

test('twee lagvormen of een oneindige lag openen niet; een oneindige lag schrijft zoals STEP haar teruggeeft (ronde 2, blokkade 4)', () => {
  for (const change of [
    (sequence: Record<string, unknown>) => { Object.assign(sequence, { timeLag: 'P2D', timeLagRatio: 0.5 }); },
    (sequence: Record<string, unknown>) => { delete sequence.timeLag; sequence.timeLagRatio = 1e308; },
  ]) {
    const error = readError(sequenceFixture(change));
    assert.equal(error.code, 'invalid', error.message);
    assert.ok(['timeLag', 'timeLagRatio'].includes(error.place.field ?? ''), error.message);
  }
  const infinite = readError(new TextDecoder().decode(sequenceFixture(sequence => { delete sequence.timeLag; sequence.timeLagRatio = 7; }))
    .replace('"timeLagRatio":7', '"timeLagRatio":1e999'));
  assert.equal(infinite.code, 'invalid', infinite.message);
  const plan = datePlan();
  const infiniteLag = { ...plan, sequences: plan.sequences.map((sequence, index) => index === 0 ? { ...sequence, lagDays: Infinity } : sequence) };
  assertAsStep(readIfcx(encode(writeIfcx(infiniteLag, CLOCK))), infiniteLag);
});

test('ongeldige projectdatums, voortgang en kop worden bij schrijven en bij lezen geweigerd (blokkade 5)', () => {
  const plan = datePlan();
  const cases: [WriteIFCInput, string][] = [
    [{ ...plan, project: { ...plan.project, startDate: '2027-02-30T99:99' } }, 'openaec::ops::document.startDate'],
    [{ ...plan, project: { ...plan.project, statusDate: '2027-02-30' } }, 'openaec::ops::document.statusDate'],
  ];
  for (const [input, field] of cases) {
    const outcome = attempt(() => writeIfcx(input, CLOCK));
    const step = attempt(() => stepRoundtrip(input));
    if (outcome.ok) {
      assert.ok(step.ok, `${field}: STEP weigert, IFCX niet`);
      assertAsStep(readIfcx(encode(outcome.value)), input);
    } else {
      assert.ok(outcome.error instanceof IfcxWriteRefusedError && outcome.error.code === 'invalid', `${field}: ${String(outcome.error)}`);
    }
  }
  const overFull = { ...plan, tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, time: { ...task.time, completion: 1.5 } } : task) };
  assert.equal(readIfcx(encode(writeIfcx(overFull, CLOCK))).tasks[0].time.completion, 1, 'de writer klemt de voortgang zoals de STEP-lezer');
  try {
    writeIfcx(plan, new Date('gisteren'));
    assert.fail('verwacht een weigering');
  } catch (error) {
    assert.ok(error instanceof IfcxWriteRefusedError && error.code === 'invalid', String(error));
    assert.deepEqual(error.fields, ['header.timestamp']);
  }
  const header = documentOf(goodText);
  header.header.timestamp = 'gisteren';
  const stamp = readError(JSON.stringify(header));
  assert.equal(stamp.code, 'invalid');
  assert.equal(stamp.place.field, 'header.timestamp');
  const completion = readError(changedFixture((_document, [first]) => { first.attributes['openaec::planning::activity'].completion = 1.5; }));
  assert.equal(completion.code, 'invalid');
  assert.equal(completion.place.field, 'completion');
});

test('een kaal einde telt tot het eind van die dag, zoals finishInstant (vervolg 6)', () => {
  const plan = datePlan();
  const input = { ...plan, tasks: [...plan.tasks, dateCaseTask('kaal-einde', '2027-06-01', '2027-06-02')] };
  const text = writeIfcx(input, CLOCK);
  const activity = documentOf(text).data.find(entry => entry.attributes['openaec::planning::activity']?.name === 'Taak kaal-einde')!
    .attributes['openaec::planning::activity'];
  assert.deepEqual([activity.start, activity.endExclusive], ['2027-06-01', '2027-06-03']);
  assertAsStep(readIfcx(encode(text)), input);
});

const INFINITE = '__oneindig__';
const FORM_COUNTEREXAMPLES: Readonly<Record<string, readonly unknown[]>> = {
  [FREE_TEXT_FORM.name]: [],
  [NON_EMPTY_TEXT_FORM.name]: [''],
  [CALENDAR_DATE_FORM.name]: ['2027-02-30', '2027-06-01T07:00', 'morgen'],
  [LOCAL_MOMENT_OR_EMPTY_FORM.name]: ['2027-02-30', '2027-06-01T99:99', '2027-06-01T07:00+02:00', 'morgen'],
  [ISO_DATE_OR_MOMENT_OR_EMPTY_FORM.name]: ['2027-02-30T99:99', '2027-02-30', 'gisteren'],
  [ISO_MOMENT_FORM.name]: ['', 'gisteren', '2027-02-30'],
  [GLOBAL_ID_OUTSIDE_PATH_FORM.name]: ['', ifcGuid128('botsing')],
  [VERSION_FORM.name]: ['een', '1.0'],
  'ISO 8601-duur P<dagen>D of PT<minuten>M, met een minteken voor een lead': ['P2', 'PT', '2D'],
  'urn:openaec:planner:<project-uuid>': ['urn:openaec:planner:geen-uuid'],
};

function counterexamplesOf(spec: IfcxValue): readonly unknown[] {
  const bounds = (step: number) => 'min' in spec || 'max' in spec
    ? [...(spec.min !== undefined ? [spec.min - step] : []), ...(spec.max !== undefined ? [spec.max + step] : [])] : [];
  switch (spec.dataType) {
    case 'String': case 'DateTime': {
      const own = FORM_COUNTEREXAMPLES[spec.form.name];
      assert.ok(own, `de vorm "${spec.form.name}" heeft tegenvoorbeelden in deze proef`);
      return [5, ...own];
    }
    case 'Real': return ['1', INFINITE, ...bounds(0.5)];
    case 'Integer': return [1.5, '1', ...bounds(1)];
    case 'Boolean': return ['ja'];
    case 'Enum': return ['ONBEKEND'];
    case 'Reference': return ['geen-uuid', 5];
    case 'Array': return ['geen lijst'];
    case 'Object': return ['geen object'];
  }
}

interface ValuePlace { readonly steps: readonly string[]; readonly spec: IfcxValue }

function placesOf(spec: IfcxValue, steps: readonly string[] = []): ValuePlace[] {
  const own = { steps, spec };
  if (spec.dataType === 'Array') return [own, ...placesOf(spec.item, [...steps, '0'])];
  if (spec.dataType === 'Object') return [own, ...Object.entries(spec.members).flatMap(([key, member]) => placesOf(member.value, [...steps, key]))];
  return [own];
}

function holderOf(root: unknown, steps: readonly string[]): Record<string, unknown> | undefined {
  let at = root;
  for (const step of steps.slice(0, -1)) {
    if (typeof at !== 'object' || at === null || !(step in at)) return undefined;
    at = (at as Record<string, unknown>)[step];
  }
  return typeof at === 'object' && at !== null && steps[steps.length - 1] in at ? at as Record<string, unknown> : undefined;
}

function textWith(document: unknown, holder: Record<string, unknown>, key: string, value: unknown): string {
  const previous = holder[key];
  holder[key] = value;
  const text = JSON.stringify(document).replace(`"${INFINITE}"`, '1e999');
  holder[key] = previous;
  return text;
}

function maximalPlan(): WriteIFCInput {
  const viaApp = saveInputViaApp(datePlan());
  const extra = { ...structuredClone(viaApp.calendar), id: 'ploegendienst', name: 'Ploegendienst', simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 30 };
  delete extra.workTime;
  const parent = dateCaseTask('fase', moment(1, '07:00'), moment(9, '16:00'), {
    isSummary: true, childIds: ['vol', 'binnen-een-dag'], description: 'Fase', wbsCode: '1', priority: 700, status: 'STARTED',
  });
  const full = dateCaseTask('vol', moment(2, '07:00'), moment(3, '16:00'), {
    parentId: 'fase', calendarId: 'ploegendienst', milestoneKind: 'START', mandatory: true, manuallyScheduled: true, taskType: 'MOVE',
  });
  full.time = {
    ...full.time, durationType: 'ELAPSEDTIME', completion: 0.5, actualStart: moment(2, '07:00'), actualFinish: '', resume: moment(3, '07:00'),
    stop: moment(2, '16:00'), durationMinutes: 960, interferingFloat: 1, isNearCritical: true, floatPath: 2, actualDuration: 1,
    remainingTime: 1, remainingMinutes: 480, durationUnit: 'hours',
  };
  const loose = dateCaseTask('los', moment(5, '07:00'), moment(5, '16:00'), { calendarId: 'bestaat-niet-als-kalender' });
  const done = dateCaseTask('klaar', moment(1, '07:00'), moment(1, '16:00'));
  done.time = { ...done.time, actualStart: moment(1, '07:00'), actualFinish: moment(1, '16:00'), completion: 1 };
  const tasks = [parent, ...viaApp.tasks.map(task => task.id === 'binnen-een-dag' ? { ...task, parentId: 'fase' }
    : task.id === 'eindmijlpaal' ? { ...task, mandatory: true } : task), full, loose, done];
  return {
    ...viaApp,
    project: { ...viaApp.project, statusDate: '2027-06-02', createdAt: '2027-05-01T08:00:00Z', modifiedAt: '2027-05-02T08:00:00Z' },
    resourceCalendars: [...(viaApp.resourceCalendars ?? []), extra],
    tasks,
    sequences: [...viaApp.sequences, { id: 'r5', predecessorId: 'vol', successorId: 'los', type: 'FINISH_START', lagDays: 1, lagMinutes: 30 },
      { id: 'r6', predecessorId: 'handmatig', successorId: 'los', type: 'FINISH_START', lagDays: 0, lagPercent: 10, lagMinutes: 15 }],
    ifcGlobalIds: {
      [`task:vol`]: 'oud-vol', [`seq:r5`]: 'oud-r5', [`cal:ploegendienst`]: 'oud-ploeg', [`proj:${viaApp.project.id}`]: 'oud-proj',
      [`wp:${viaApp.project.id}`]: 'oud-werkplan', [`ws:${viaApp.project.id}`]: 'oud-schema',
    },
  };
}

function variantPlan(): WriteIFCInput {
  const plan = datePlan();
  const day = [{ start: 420, end: 960 }];
  return {
    ...plan,
    project: { ...plan.project, startDate: '2027-06-01T07:00', author: '', calendarId: 'elders', ifcSchemaUnconfirmed: 'IFC2X3' },
    calendar: {
      ...plan.calendar, shift: 'THIRD', workDays: [1, 2, 3, 4, 5, 6, 7],
      workingExceptions: [{ name: 'Zaterdag', startDate: '2027-06-05', endDate: '2027-06-05', bands: [{ start: 480, end: 600 }] }],
      workTime: { byWeekday: { 1: day, 2: day, 3: day, 4: day, 5: day, 6: [{ start: 480, end: 720 }], 7: [{ start: 480, end: 600 }] } },
      generation: { ruleSetId: 'NL', region: 'Noord-Holland', breakChoice: 'noord', generatedFromYear: 2027, generatedToYear: 2028 },
    } as WriteIFCInput['calendar'],
  };
}

function fieldPathOf(spec: IfcxValue, steps: readonly string[]): string {
  let path = '';
  let at: IfcxValue = spec;
  for (const step of steps) {
    if (at.dataType === 'Array') { path += `[${step}]`; at = at.item; continue; }
    if (at.dataType === 'Object') { path += path ? `.${step}` : step; at = at.members[step].value; }
  }
  return path;
}

test('elk veld in de veldtabel wordt met elk tegenvoorbeeld van zijn vorm geweigerd, door de lezer en de writer (regel A, B)', () => {
  const documents = [maximalPlan(), variantPlan(), datePlan(), ...[...fullExamples.values()].map(kernOf)].map(input => documentOf(writeIfcx(input, CLOCK)));
  const missing: string[] = [], wrongReader: string[] = [], wrongWriter: string[] = [];
  const outcomes = {
    'de writer weigert om dit veld': 0, 'de writer weigert in hetzelfde attribuut, waar de STEP-rondgang de waarde neerzette': 0,
    'opslaan als IFC weigert de planning': 0,
    'de ongetoetste lezer maakt er geen planning van': 0, 'de planning draagt de waarde niet': 0,
  };
  const withoutPlace = (field: string) => field.replace(/\[\d+\]/g, '[]');
  const under = (field: string, base: string) => {
    const [one, other] = [withoutPlace(field), withoutPlace(base)];
    return one === other || one.startsWith(`${other}.`) || one.startsWith(`${other}[`);
  };
  const check = (label: string, spec: IfcxValue, locate: (document: ReturnType<typeof documentOf>) => readonly unknown[], expected: (error: IfcxReadError) => boolean) => {
    for (const { steps, spec: value } of placesOf(spec).slice(1)) {
      const where = `${label}.${fieldPathOf(spec, steps)}`;
      let found: { document: ReturnType<typeof documentOf>; holder: Record<string, unknown> } | undefined;
      for (const document of documents) {
        const holder = locate(document).map(root => holderOf(root, steps)).find(Boolean);
        if (holder) { found = { document, holder }; break; }
      }
      if (!found) { missing.push(where); continue; }
      for (const bad of counterexamplesOf(value)) {
        const text = textWith(found.document, found.holder, steps[steps.length - 1], bad);
        const shown = `${where} = ${JSON.stringify(bad)}`;
        let error: IfcxReadError | undefined;
        try { readIfcxText(text); } catch (thrown) { if (thrown instanceof IfcxReadError) error = thrown; }
        if (!error || !expected(error)) { wrongReader.push(`${shown}: ${error?.message ?? 'gelezen'}`); continue; }
        let model: ImportResult;
        try { model = readIfcxText(text, false); } catch { outcomes['de ongetoetste lezer maakt er geen planning van']++; continue; }
        let written: string;
        try {
          written = writeIfcx(model, CLOCK);
        } catch (refusal) {
          if (!(refusal instanceof IfcxWriteRefusedError) || refusal.code !== 'invalid') wrongWriter.push(`${shown}: ${String(refusal)}`);
          else if (refusal.fields.some(field => under(field, where))) outcomes['de writer weigert om dit veld']++;
          else if (refusal.fields.some(field => field.startsWith(`${label}.`))) {
            outcomes['de writer weigert in hetzelfde attribuut, waar de STEP-rondgang de waarde neerzette']++;
            console.log(`     ${shown}: geweigerd op ${refusal.fields.join(', ')}`);
          }
          else if (refusal.fields.length === 1 && refusal.fields[0] === 'planning') outcomes['opslaan als IFC weigert de planning']++;
          else wrongWriter.push(`${shown}: ${String(refusal)} (${refusal.fields.join(', ')})`);
          continue;
        }
        const carried = locate(documentOf(written)).map(root => holderOf(root, steps))
          .some(holder => holder && isDeepStrictEqual(plain(holder[steps[steps.length - 1]]), plain(bad)));
        if (carried) wrongWriter.push(`${shown}: de writer schreef de waarde`);
        else outcomes['de planning draagt de waarde niet']++;
      }
    }
  };
  for (const [name, spec] of OWN_ATTRIBUTE_VALUES) {
    check(name, spec, document => document.data.map(item => item.attributes[name]).filter(Boolean),
      error => error.code === 'invalid' && error.place.attribute === name);
  }
  check('header', HEADER_VALUE, document => [document.header], error => ['invalid', 'foreign', 'version'].includes(error.code));
  assert.deepEqual(missing, [], 'elk veld staat in een van de proefplanningen');
  assert.deepEqual(wrongReader, [], 'de lezer weigert elk tegenvoorbeeld als invalid');
  assert.deepEqual(wrongWriter, [], 'de writer weigert om precies dat veld, of de planning draagt de waarde niet');
  assert.ok(outcomes['de writer weigert om dit veld'] > 0);
  console.log(`   ${Object.entries(outcomes).map(([reason, count]) => `${reason}: ${count}`).join('; ')}`);
});

type ObjectList = (model: WriteIFCInput) => { id: string }[] | undefined;
const IDENTITY_LISTS: Readonly<Record<string, ObjectList | null>> = {
  proj: null, wp: null, ws: null,
  cal: model => model.resourceCalendars,
  task: model => model.tasks,
  seq: model => model.sequences,
};

test('R0: dubbel id, dubbele GlobalId, relatie zonder doel en een taak onder twee ouders weigert de writer met inconsistent en de namen', () => {
  assert.deepEqual(IDENTITY_KINDS.map(kind => kind.kind).sort(), Object.keys(IDENTITY_LISTS).sort());
  const base = maximalPlan();
  const intended = intendedGlobalIds(base);
  for (const spec of IDENTITY_KINDS) {
    const objects = spec.objects(base as PlanningModel);
    const [object] = objects;
    const list = IDENTITY_LISTS[spec.kind];
    if (list) {
      const model = structuredClone(base);
      const items = list(model)!;
      const copy = structuredClone(items[items.length - 1]);
      items.push(copy);
      const refusal = writeRefusal(model);
      assert.equal(refusal.code, 'inconsistent', spec.kind);
      assert.ok(refusal.fields.includes(`${spec.area}.id`), `${spec.kind}: ${refusal.fields.join(', ')}`);
      assert.ok(refusal.message.includes(`het id ${copy.id}`), refusal.message);
    }
    for (const other of IDENTITY_KINDS) {
      if (other === spec) continue;
      const [target] = other.objects(base as PlanningModel);
      const shared = intended.get(ifcObjectSeed(other.kind, target.id))!;
      const refusal = writeRefusal({ ...base, ifcGlobalIds: { ...base.ifcGlobalIds, [ifcObjectSeed(spec.kind, object.id)]: shared } });
      assert.equal(refusal.code, 'inconsistent', `${spec.kind} ↔ ${other.kind}`);
      assert.ok(refusal.fields.some(field => field.endsWith('.globalId')), `${spec.kind} ↔ ${other.kind}: ${refusal.fields.join(', ')}`);
      assert.ok(refusal.message.includes(shared) && refusal.message.includes(`${spec.area} ${object.id}`) && refusal.message.includes(`${other.area} ${target.id}`), refusal.message);
    }
    for (const reference of new Set(objects.flatMap(item => item.references.map(ref => ref.field)))) {
      const model = structuredClone(base);
      const owner = list!(model)![0] as unknown as Record<string, unknown>;
      owner[reference] = 'bestaat-niet';
      const refusal = writeRefusal(model);
      assert.equal(refusal.code, 'inconsistent', `${spec.kind}.${reference}`);
      assert.ok(refusal.fields.includes(`${spec.area}.${reference}`), `${spec.kind}.${reference}: ${refusal.fields.join(', ')}`);
      assert.ok(refusal.message.includes(`${spec.area} ${owner.id} verwijst met ${reference} naar bestaat-niet`), refusal.message);
    }
  }
  const twoParents = withTask(withPhase(saveInputViaApp(datePlan())), 'binnen-een-dag', task => ({ ...task, isSummary: true, childIds: ['handmatig'] }));
  const refusal = writeRefusal(twoParents);
  assert.equal(refusal.code, 'inconsistent');
  assert.deepEqual(refusal.fields, ['task.childIds']);
  assert.match(refusal.message, /Taak handmatig staat in de kinderlijst van twee ouders: fase en binnen-een-dag/);
});

type Attempt<T> = { ok: true; value: T } | { ok: false; error: unknown };
function attempt<T>(action: () => T): Attempt<T> {
  try { return { ok: true, value: action() }; } catch (error) { return { ok: false, error }; }
}

function withTask(plan: WriteIFCInput, id: string, change: (task: Task) => Task): WriteIFCInput {
  return { ...plan, tasks: plan.tasks.map(task => (task.id === id ? change(task) : task)) };
}

function withTime(plan: WriteIFCInput, id: string, time: Partial<Task['time']>): WriteIFCInput {
  return withTask(plan, id, task => ({ ...task, time: { ...task.time, ...time } }));
}

function withPhase(plan: WriteIFCInput): WriteIFCInput {
  const phase = dateCaseTask('fase', moment(2, '09:30'), moment(4, '11:15'), { isSummary: true, childIds: ['handmatig'] });
  const changed = withTask(plan, 'handmatig', task => ({ ...task, parentId: 'fase' }));
  return { ...changed, tasks: [phase, ...changed.tasks] };
}

function withCalendar(change: (calendar: WriteIFCInput['calendar']) => WriteIFCInput['calendar']): WriteIFCInput {
  const plan = datePlan();
  return saveInputViaApp({ ...plan, calendar: change(plan.calendar) });
}

function weekBands(day: { start: number; end: number }[]) {
  const work = [{ start: 420, end: 960 }];
  return { byWeekday: { 1: day, 2: work, 3: work, 4: work, 5: work, 6: [], 7: [] } };
}

function progressBeforeRecalculation(): WriteIFCInput {
  const plan = datePlan();
  const task = plan.tasks[0];
  const entry = planProgressEntry(task, { field: 'completion', value: 0.5 }, { statusDate: '2027-06-02', calendar: plan.calendar });
  assert.ok(entry.ok && entry.change, 'de voortgangsinvoer geeft een wijziging');
  return saveInputViaApp({ ...plan, tasks: plan.tasks.map(item => (item.id === task.id ? entry.change!.task : item)) });
}

interface StepCase {
  readonly name: string;
  readonly input: () => WriteIFCInput;
  readonly refusedBy?: { readonly code: IfcxWriteRefusedCode; readonly rule: string };
}

const appPlan = () => saveInputViaApp(datePlan());

const STEP_CASES: readonly StepCase[] = [
  ...[...fullExamples].map(([name, full]) => ({ name, input: () => saveInputViaApp(kernOf(full)) })),
  { name: 'ronde 3: 50 % voortgang ingevoerd vóór F5', input: progressBeforeRecalculation },
  { name: 'ronde 3: een vrije periode van 3 tot en met 2 juni', input: () => withCalendar(calendar => ({
    ...calendar, holidays: [...calendar.holidays, { name: 'Omgekeerd', startDate: '2027-06-03', endDate: '2027-06-02' }] })) },
  { name: 'ronde 3: een werkblok van 960 tot 420', input: () => withCalendar(calendar => ({ ...calendar, workTime: weekBands([{ start: 960, end: 420 }]) })) },
  { name: 'ronde 3: een nachtdienst van 1320 tot 1800', input: () => withCalendar(calendar => ({ ...calendar, workTime: weekBands([{ start: 1320, end: 1800 }]) })) },
  { name: 'ronde 3: feestdagen gemaakt voor de jaren 2028 tot 2027', input: () => withCalendar(calendar => ({
    ...calendar, generation: { ruleSetId: 'NL', generatedFromYear: 2028, generatedToYear: 2027 } })) },
  { name: 'ronde 3: een bladtaak met een werkelijk einde en 50 %', input: () => withTime(appPlan(), 'binnen-een-dag', {
    actualStart: moment(1, '07:00'), actualFinish: moment(1, '16:00'), completion: 0.5 }) },
  { name: 'ronde 3 en 2224: omgekeerde werkelijke datums', input: () => withTime(appPlan(), 'binnen-een-dag', {
    actualStart: moment(3, '07:00'), actualFinish: moment(2, '16:00'), completion: 1 }) },
  { name: 'ronde 3: een relatie van een bladtaak naar zichzelf', input: () => {
    const plan = appPlan();
    return { ...plan, sequences: [...plan.sequences, { id: 'zelf', predecessorId: 'binnen-een-dag', successorId: 'binnen-een-dag', type: 'FINISH_START', lagDays: 0 }] };
  } },
  { name: 'ronde 3: een relatie tussen een fase en haar eigen kind', input: () => {
    const plan = withPhase(appPlan());
    return { ...plan, sequences: [...plan.sequences, { id: 'fase-kind', predecessorId: 'fase', successorId: 'handmatig', type: 'START_START', lagDays: 0 }] };
  } },
  { name: 'ronde 2: een gestarte taak die vóór F5 eindigt vóór haar werkelijke start', input: () => withTime(appPlan(), 'binnen-een-dag', {
    actualStart: moment(3, '07:00'), completion: 0.5 }) },
  { name: 'ronde 1: een verzameltaak met een kind dat niet bestaat', input: () => {
    const plan = withPhase(appPlan());
    return withTask(plan, 'fase', task => ({ ...task, childIds: [...task.childIds, 'bestaat-niet'] }));
  } },
  { name: 'ronde 1: een kind dat haar ouder niet noemt', input: () => withTask(withPhase(appPlan()), 'handmatig', task => ({ ...task, parentId: null })) },
  { name: 'ronde 1: een kring in de ouders', input: () => {
    const plan = appPlan();
    return withTask(withTask(plan, 'binnen-een-dag', task => ({ ...task, parentId: 'einde-middernacht', childIds: ['einde-middernacht'] })),
      'einde-middernacht', task => ({ ...task, parentId: 'binnen-een-dag', childIds: ['binnen-een-dag'] }));
  } },
  { name: 'ronde 1: een bibliotheekentry van de projectkalender met een andere inhoud', input: () => {
    const plan = appPlan();
    return { ...plan, resourceCalendars: (plan.resourceCalendars ?? []).map(calendar =>
      calendar.id === plan.calendar.id ? { ...calendar, hoursPerDay: calendar.hoursPerDay + 1 } : calendar) };
  } },
  { name: 'ronde 1: een ouder die niet bestaat', input: () => withTask(appPlan(), 'handmatig', task => ({ ...task, parentId: 'weg' })) },
  { name: 'een taak in de kinderlijst van twee ouders (vroeger knownbug 2222)', refusedBy: { code: 'inconsistent', rule: 'R0' }, input: () => withTask(withPhase(appPlan()), 'binnen-een-dag', task => ({ ...task, isSummary: true, childIds: ['handmatig'] })) },
  { name: 'ronde 1: een relatie naar een taak die niet bestaat', refusedBy: { code: 'inconsistent', rule: 'C' }, input: () => {
    const plan = appPlan();
    return { ...plan, sequences: [...plan.sequences, { id: 'los', predecessorId: 'weg', successorId: 'handmatig', type: 'FINISH_START', lagDays: 0 }] };
  } },
  { name: 'ronde 1: twee taken met hetzelfde id', refusedBy: { code: 'inconsistent', rule: 'C' }, input: () => {
    const plan = appPlan();
    return { ...plan, tasks: [...plan.tasks, { ...plan.tasks[0] }] };
  } },
  { name: 'ronde 2: twee taken met dezelfde GlobalId', refusedBy: { code: 'inconsistent', rule: 'C' }, input: () => {
    const plan = appPlan();
    const shared = ifcGuid128('gedeeld');
    return { ...plan, ifcGlobalIds: { ...plan.ifcGlobalIds, [`task:${plan.tasks[0].id}`]: shared, [`task:${plan.tasks[1].id}`]: shared } };
  } },
  { name: 'ronde 1: een dag die niet bestaat (STEP maakt er 2 maart van)', input: () => withTime(appPlan(), 'binnen-een-dag', { lateStart: '2027-02-30T07:00' }) },
  { name: 'ronde 2: voortgang boven 100 %', input: () => withTime(appPlan(), 'binnen-een-dag', { completion: 1.5 }) },
  { name: 'ronde 2: een projectstart die niet bestaat', refusedBy: { code: 'invalid', rule: 'A' }, input: () => {
    const plan = appPlan();
    return { ...plan, project: { ...plan.project, startDate: '2027-02-30T99:99' } };
  } },
  { name: 'ronde 2: een oneindige lag (STEP maakt er 0 van)', input: () => {
    const plan = appPlan();
    return { ...plan, sequences: plan.sequences.map((sequence, index) => (index === 0 ? { ...sequence, lagDays: Infinity } : sequence)) };
  } },
  { name: 'ronde 3: een feestdagenset die niet bestaat', refusedBy: { code: 'invalid', rule: 'A' }, input: () => withCalendar(calendar => ({
    ...calendar, generation: { ruleSetId: 'XX' as never, generatedFromYear: 2027, generatedToYear: 2028 } })) },
];

test('R1: voor de voorbeelden en de gevallen uit eerdere rondes geeft IFCX heen en terug wat de STEP-rondgang geeft, of beide weigeren', () => {
  const wrong: string[] = [];
  for (const entry of STEP_CASES) {
    const input = entry.input();
    const before = structuredClone(input);
    const step = attempt(() => stepRoundtrip(input));
    const own = attempt(() => readIfcx(encode(writeIfcx(input, CLOCK))));
    try { assert.deepEqual(input, before); } catch { wrong.push(`${entry.name}: writeIfcx veranderde de invoer`); }
    if (entry.refusedBy) {
      const code = own.ok ? 'geschreven' : own.error instanceof IfcxWriteRefusedError ? own.error.code : String(own.error);
      if (code !== entry.refusedBy.code) wrong.push(`${entry.name}: verwacht ${entry.refusedBy.code} (regel ${entry.refusedBy.rule}), kreeg ${code}`);
      continue;
    }
    if (!step.ok) {
      if (own.ok || !(own.error instanceof IfcxWriteRefusedError) || own.error.code !== 'invalid') {
        wrong.push(`${entry.name}: STEP weigert (${String(step.error)}), IFCX ${own.ok ? 'niet' : String(own.error)}`);
      }
      continue;
    }
    if (!own.ok) { wrong.push(`${entry.name}: ${String(own.error).slice(0, 300)}`); continue; }
    const expected = domainOf(step.value), actual = domainOf(own.value);
    for (const key of Object.keys(expected)) {
      if (!isDeepStrictEqual(actual[key], expected[key])) wrong.push(`${entry.name}: ${key} verschilt van STEP`);
    }
  }
  assert.deepEqual(wrong, []);
});

test('ronde 3, de groene mutatie: een werkblok van 960 tot 420 zonder bibliotheek, rechtstreeks op readIfcx(...).calendar', () => {
  const plan = datePlan();
  const input: WriteIFCInput = { ...plan, resourceCalendars: [], calendar: { ...plan.calendar, workTime: weekBands([{ start: 960, end: 420 }]) } };
  assert.deepEqual(plain(readIfcx(encode(writeIfcx(input, CLOCK))).calendar), plain(stepRoundtrip(input).calendar));
});

function readOutcome(bytes: Uint8Array): IfcxReadError | ReturnType<typeof readIfcx> {
  try { return readIfcx(bytes); } catch (error) { if (error instanceof IfcxReadError) return error; throw error; }
}

function otherValue(document: ReturnType<typeof documentOf>, name: string, field: string, value: unknown): unknown {
  for (const entry of document.data) {
    const other = entry.attributes[name]?.[field];
    if (other !== undefined && !isDeepStrictEqual(other, value)) return structuredClone(other);
  }
  if (typeof value === 'string') return `${value}x`;
  if (typeof value === 'number') return value + 1;
  if (typeof value === 'boolean') return !value;
  if (Array.isArray(value)) return value.length > 1 ? [...value].reverse() : [];
  return {};
}

type Mutation = readonly [string, (holder: Record<string, unknown>, key: string) => void];
function mutationsOf(value: unknown, other: unknown): Mutation[] {
  return [
    ['een andere waarde', (holder, key) => { holder[key] = other; }],
    ['weggelaten', (holder, key) => { delete holder[key]; }],
    ...(Array.isArray(value) && value.length > 0
      ? [['een element erbij', (holder: Record<string, unknown>, key: string) => { (holder[key] as unknown[]).push(structuredClone(value[value.length - 1])); }] as const]
      : []),
  ];
}

test('R2: elk gedeeld veld dat de writer schreef, veranderd, weggelaten of met een element erbij, opent niet: invalid, met veld en object', () => {
  const wrong: string[] = [];
  let count = 0;
  for (const plan of [maximalPlan(), variantPlan(), datePlan()]) {
    const text = writeIfcx(plan, CLOCK);
    const document = documentOf(text);
    const expectRefusal = (label: string, change: (copy: ReturnType<typeof documentOf>) => void, place: { path?: string; attribute?: string; field: string }) => {
      const copy = documentOf(text);
      change(copy);
      count++;
      const outcome = readOutcome(encode(JSON.stringify(copy)));
      const right = outcome instanceof IfcxReadError && outcome.code === 'invalid' && outcome.place.path === place.path
        && outcome.place.attribute === place.attribute
        && (outcome.place.field === place.field || outcome.place.field?.startsWith(`${place.field}.`) || outcome.place.field?.startsWith(`${place.field}[`));
      if (!right) wrong.push(`${label}: ${outcome instanceof IfcxReadError ? `${outcome.code} ${JSON.stringify(outcome.place)}` : 'geopend'}`);
    };
    document.data.forEach((entry, index) => {
      for (const [name, value] of Object.entries(entry.attributes)) {
        if (!name.startsWith('openaec::planning::')) continue;
        for (const field of Object.keys(value)) {
          for (const [label, change] of mutationsOf(value[field], otherValue(document, name, field, value[field]))) {
            expectRefusal(`${name}.${field} op ${entry.path}: ${label}`, copy => change(copy.data[index].attributes[name], field), { path: entry.path, attribute: name, field });
          }
        }
      }
    });
    for (const [label, change] of mutationsOf(document.header.author, 'Iemand anders')) {
      expectRefusal(`header.author: ${label}`, copy => change(copy.header, 'author'), { field: 'header.author' });
    }
    assert.ok(!(readOutcome(encode(text)) instanceof IfcxReadError), 'het onveranderde bestand opent');
  }
  assert.deepEqual(wrong, []);
  console.log(`   ${count} veranderde bestanden, elk geweigerd`);
});

test('punt 8: een bestand dat R2 doorstaat maar geen dekpunt van de STEP-rondgang is, opent zoals STEP het zou openen', () => {
  const document = documentOf(writeIfcx(datePlan(), CLOCK));
  const time = entryWith(document, 'openaec::ops::task').attributes['openaec::ops::task'].time as Record<string, unknown>;
  Object.assign(time, { earlyStart: '', earlyFinish: '', lateStart: '', lateFinish: '' });
  const text = JSON.stringify(document);
  const read = readIfcxText(text, false);
  assert.equal(read.tasks[0].time.earlyStart, '', 'het bestand draagt lege vroege datums');
  const back = readIfcx(encode(text));
  assert.notEqual(back.tasks[0].time.earlyStart, '', 'openen geeft wat de STEP-rondgang geeft');
  assert.deepEqual(domainOf(back), domainOf(stepRoundtrip(read)));
});

test('ronde 4, blokkade 1: werkplan en werkschema met een oude GlobalId slaan op en komen terug zoals in STEP', () => {
  const plan = datePlan();
  const input: ImportResult = { ...plan, ifcGlobalIds: { [`wp:${plan.project.id}`]: 'oud-werkplan', [`ws:${plan.project.id}`]: 'oud-schema' } };
  const text = writeIfcx(input, CLOCK);
  const back = readIfcx(encode(text));
  assertAsStep(back, input);
  assert.equal(back.ifcGlobalIds![`wp:${back.project.id}`], 'oud-werkplan');
  assert.equal(back.ifcGlobalIds![`ws:${back.project.id}`], 'oud-schema');
  const document = documentOf(text);
  entryWith(document, 'openaec::ops::document').attributes['openaec::ops::document'].scheduleGlobalId = 'ander-schema';
  const error = readError(JSON.stringify(document));
  assert.equal(error.code, 'invalid', error.message);
  assert.equal(error.place.field, 'globalId');
});

test('ronde 4, blokkade 2: de projectkalender heeft één verwijzing; een tweede of een andere opent niet', () => {
  const text = writeIfcx(maximalPlan(), CLOCK);
  const calendars = documentOf(text).data.filter(entry => 'openaec::planning::calendar' in entry.attributes);
  assert.ok(calendars.length >= 2);
  const withId = documentOf(text);
  entryWith(withId, 'openaec::ops::document').attributes['openaec::ops::document'].calendarId = 'ploegendienst';
  assert.ok(readOutcome(encode(JSON.stringify(withId))) instanceof IfcxReadError, 'een tweede verwijzing opent niet');
  const elsewhere = documentOf(text);
  const workplan = entryWith(elsewhere, 'openaec::ops::document');
  const ops = workplan.attributes['openaec::ops::document'];
  ops.calendar = calendars.find(entry => entry.path !== ops.calendar)!.path;
  const error = readError(JSON.stringify(elsewhere));
  assert.equal(error.code, 'invalid', error.message);
  assert.ok(error.place.path !== undefined && error.place.field !== undefined, error.message);
});

test('ronde 4, blokkade 3: een gedeeld venster naast een werkelijk einde opent niet; dezelfde planning via de writer opent zoals in STEP', () => {
  for (const endExclusive of ['2027-06-02', '2027-06-04']) {
    const error = readError(changedFixture((_document, [first]) => {
      Object.assign(first.attributes['openaec::planning::activity'], { endExclusive, completion: 0.5 });
      Object.assign(first.attributes['openaec::ops::task'].time as Record<string, unknown>, { actualStart: '2027-06-01T07:00', actualFinish: '2027-06-07T16:00' });
    }));
    assert.equal(error.code, 'invalid', error.message);
    assert.match(error.message, /taak binnen-een-dag/);
  }
  const input = withTime(appPlan(), 'binnen-een-dag', { actualStart: '2027-06-01T07:00', actualFinish: '2027-06-07T16:00', completion: 0.5 });
  const back = readIfcx(encode(writeIfcx(input, CLOCK)));
  assertAsStep(back, input);
  const task = back.tasks.find(item => item.id === 'binnen-een-dag')!;
  assert.equal(task.time.completion, 1);
  assert.equal(task.time.actualFinish, '2027-06-07T16:00');
});

test('ronde 4, blokkade 4: een gedeeld percentage naast een precieze lag in dagen opent niet; de writer schrijft wat STEP teruggeeft', () => {
  for (const [shared, precise] of [[{ timeLagRatio: 0.25 }, { lagDays: 8 }], [{ timeLag: 'P8D' }, { lagPercent: 25 }]] as const) {
    const document = documentOf(goodText);
    const entry = entryWith(document, 'openaec::planning::sequence');
    delete entry.attributes['openaec::planning::sequence'].timeLag;
    Object.assign(entry.attributes['openaec::planning::sequence'], shared);
    Object.assign(entry.attributes['openaec::ops::sequence'], precise);
    const error = readError(JSON.stringify(document));
    assert.equal(error.code, 'invalid', error.message);
    assert.equal(error.place.path, entry.path);
  }
  const plan = appPlan();
  const input = { ...plan, sequences: plan.sequences.map((sequence, index) => index === 0 ? { ...sequence, lagDays: 8, lagPercent: 25 } : sequence) };
  const back = readIfcx(encode(writeIfcx(input, CLOCK)));
  assertAsStep(back, input);
  assert.equal(back.sequences[0].lagPercent, 25);
  assert.equal(back.sequences[0].lagDays, stepRoundtrip(input).sequences[0].lagDays);
});

test('ronde 4, blokkade 5: lege vroege en late datums en de uurmaat komen terug zoals STEP ze bij openen invult', () => {
  const empty = withTime(appPlan(), 'binnen-een-dag', { earlyStart: '', earlyFinish: '', lateStart: '', lateFinish: '' });
  const back = readIfcx(encode(writeIfcx(empty, CLOCK)));
  assertAsStep(back, empty);
  const task = back.tasks.find(item => item.id === 'binnen-een-dag')!;
  assert.ok(task.time.earlyStart !== '' && task.time.lateFinish !== '', 'STEP vult ze in');
  const hours = withTime(appPlan(), 'binnen-een-dag', { durationMinutes: 480, scheduleDuration: 480 / 540, remainingMinutes: 360, remainingTime: 360 / 540 });
  assertAsStep(readIfcx(encode(writeIfcx(hours, CLOCK))), hours);
});

test('ronde 4, blokkade 6: onbekende leden van werkblokken laat STEP vallen en IFCX ook (besluit 3 van Trias)', () => {
  const plan = datePlan();
  const week = weekBands([{ start: 420, end: 960 }]);
  const workTime = { nieuw: true, byWeekday: { ...week.byWeekday, 1: [{ start: 420, end: 960, nieuweInformatie: 'waarde' }] } };
  const extra = { ...structuredClone(plan.calendar), id: 'bibliotheek', name: 'Bibliotheek', workTime };
  const input = { ...plan, calendar: { ...plan.calendar, workTime }, resourceCalendars: [extra] } as unknown as WriteIFCInput;
  const back = readIfcx(encode(writeIfcx(input, CLOCK)));
  assertAsStep(back, input);
  assert.ok(!JSON.stringify(back).includes('nieuweInformatie'));
});

const FIELD_TABLES: readonly [string, IfcxField<never, never>[]][] = [
  ['openaec::ops::document', DOCUMENT_AREA.ops as unknown as IfcxField<never, never>[]],
  ['openaec::ops::calendar', CALENDAR_AREA.ops as unknown as IfcxField<never, never>[]],
  ['openaec::ops::task', TASK_AREA.ops as unknown as IfcxField<never, never>[]],
  ['openaec::ops::task.time', TASK_TIME_FIELDS as unknown as IfcxField<never, never>[]],
  ['openaec::ops::sequence', SEQUENCE_AREA.ops as unknown as IfcxField<never, never>[]],
];

test('elk precies veld draagt iets: zonder dat veld weigert writeIfcx, in de zelfcontrole of de waardetoets (besluit 3, ronde 4 blokkade 6)', () => {
  const plans = [maximalPlan(), variantPlan(), datePlan()];
  const written = plans.map(plan => documentOf(writeIfcx(plan, CLOCK)));
  const wrong: string[] = [];
  let count = 0;
  for (const [label, table] of FIELD_TABLES) {
    const [attribute, nested] = label.split('.');
    for (let index = 0; index < table.length; index++) {
      const field = table[index];
      const at = written.findIndex(document => document.data.some(entry => {
        const value = entry.attributes[attribute];
        const holder = nested ? value?.[nested] as Record<string, unknown> | undefined : value;
        return holder !== undefined && field.key in holder;
      }));
      if (at < 0) { wrong.push(`${label}.${field.key}: geen proefplanning draagt het veld`); continue; }
      table.splice(index, 1);
      try {
        const outcome = attempt(() => writeIfcx(plans[at], CLOCK));
        count++;
        if (outcome.ok || !(outcome.error instanceof IfcxWriteRefusedError) || !['self-check', 'invalid'].includes(outcome.error.code)) {
          wrong.push(`${label}.${field.key}: ${outcome.ok ? 'geschreven' : String(outcome.error).slice(0, 200)}`);
        }
      } finally {
        table.splice(index, 0, field);
      }
    }
  }
  assert.deepEqual(wrong, []);
  console.log(`   ${count} precieze velden, elk nodig`);
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

console.log(`IFCX-kern: ${passed} proeven geslaagd, ${failed} fouten`);
if (failed) process.exitCode = 1;
