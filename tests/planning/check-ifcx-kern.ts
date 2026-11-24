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
import { SELF_CHECK_RULES, selfCheckDifferences } from '@/services/ifc/ifcx/selfCheck';
import { buildIfcxDocument, serializeIfcx } from '@/services/ifc/ifcx/ifcxWriter';
import { readIfcxText } from '@/services/ifc/ifcx/ifcxReader';
import { HEADER_VALUE, OWN_ATTRIBUTE_VALUES } from '@/services/ifc/ifcx/ownAttributes';
import { IDENTITY_KINDS, intendedGlobalIds, type PlanningModel } from '@/services/ifc/ifcx/identity';
import { CONSISTENCY_RULES } from '@/services/ifc/ifcx/consistency';
import { globalIdKey, type IfcxObjectKind } from '@/services/ifc/ifcx/stepGlobalIds';
import {
  CALENDAR_DATE_FORM, FREE_TEXT_FORM, GLOBAL_ID_OUTSIDE_PATH_FORM, ISO_DATE_OR_MOMENT_OR_EMPTY_FORM, ISO_MOMENT_FORM,
  LOCAL_MOMENT_OR_EMPTY_FORM, NON_EMPTY_TEXT_FORM, VERSION_FORM, type IfcxValue,
} from '@/services/ifc/ifcx/fieldTable';
import {
  compactGlobalIdToUuid, isCompactGlobalId, nameBasedUuid, uuidToCompactGlobalId,
} from '@/services/ifc/ifcx/globalIdUuid';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { syncProjectCalendar } from '@/state/syncProjectCalendar';
import { buildWriteIFCInput, type IFCSaveSource } from '@/state/ifcSaveInput';
import { shownFinish, shownStart } from '@/utils/taskDates';

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
    assert.equal(planningCanon(back), planningCanon(viaApp));
    assert.deepEqual(plain(back.resourceCalendars), plain(viaApp.resourceCalendars));
    assert.deepEqual(plain(back.calendar), plain(viaApp.calendar));
    assert.equal(documentOf(text).data.filter(entry => 'openaec::planning::calendar' in entry.attributes).length,
      new Set([viaApp.calendar.id, ...(viaApp.resourceCalendars ?? []).map(calendar => calendar.id)]).size);
  });
}

test('een bibliotheekentry met het id van de projectkalender maar een andere inhoud wordt geweigerd', () => {
  const viaApp = saveInputViaApp(datePlan());
  const refusal = writeRefusal({ ...viaApp, resourceCalendars: (viaApp.resourceCalendars ?? []).map(calendar =>
    calendar.id === viaApp.calendar.id ? { ...calendar, hoursPerDay: calendar.hoursPerDay + 1 } : calendar) });
  assert.equal(refusal.code, 'inconsistent');
  assert.deepEqual(refusal.fields, ['resourceCalendars']);
});

function changedFixture(change: (document: ReturnType<typeof documentOf>, activities: { path: string; attributes: Record<string, Record<string, unknown>> }[]) => void): Uint8Array {
  const document = documentOf(goodText);
  change(document, document.data.filter(entry => 'openaec::planning::activity' in entry.attributes));
  return encode(JSON.stringify(document));
}

const shownSpan = (task: Task) => projectSpanForCheck(shownStart(task), shownFinish(task));
function projectSpanForCheck(start: string, finish: string): [string, string] {
  return [start.slice(0, 10), finish.endsWith('T00:00') ? finish.slice(0, 10) : nextDay(finish.slice(0, 10))];
}
function nextDay(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

test('een verplaatste eendaagse taak krijgt het hele nieuwe venster', () => {
  const back = readIfcx(changedFixture((_document, [first]) => {
    Object.assign(first.attributes['openaec::planning::activity'], { start: '2027-06-08', endExclusive: '2027-06-09' });
  }));
  const task = back.tasks[0];
  assert.equal(task.time.scheduleStart, '2027-06-08T00:00');
  assert.equal(task.time.scheduleFinish, '2027-06-09T00:00');
  assert.deepEqual(shownSpan(task), ['2027-06-08', '2027-06-09']);
  assert.equal(task.manuallyScheduled, true);
  assert.equal(back.ifcxSharedDatesApplied, 1);
});

test('een verplaatst einde verandert de start niet', () => {
  const back = readIfcx(changedFixture((_document, [first]) => {
    first.attributes['openaec::planning::activity'].endExclusive = '2027-06-04';
  }));
  assert.equal(back.tasks[0].time.scheduleStart, '2027-06-01T07:00');
  assert.equal(back.tasks[0].time.scheduleFinish, '2027-06-04T00:00');
});

test('een gedeeld venster met een einde vóór de start of zonder één van beide wordt geweigerd', () => {
  for (const change of [
    (activity: Record<string, unknown>) => { activity.start = '2027-06-08'; },
    (activity: Record<string, unknown>) => { activity.endExclusive = '2027-06-01'; },
    (activity: Record<string, unknown>) => { delete activity.endExclusive; },
  ]) {
    const error = readError(changedFixture((_document, [first]) => change(first.attributes['openaec::planning::activity'])));
    assert.equal(error.code, 'invalid', error.message);
  }
});

test('een mijlpaal met een venster van meer dan één dag wordt geweigerd', () => {
  const error = readError(changedFixture((_document, activities) => {
    activities[3].attributes['openaec::planning::activity'].endExclusive = '2027-06-07';
  }));
  assert.equal(error.code, 'invalid', error.message);
});

test('de werkelijke start van een gestarte taak blijft staan; een veranderd einde wel toegepast (2221)', () => {
  const back = readIfcx(changedFixture((_document, [first]) => {
    Object.assign(first.attributes['openaec::planning::activity'], { start: '2027-06-02', endExclusive: '2027-06-04', completion: 0.5 });
    (first.attributes['openaec::ops::task'].time as Record<string, unknown>).actualStart = '2027-06-01T07:00';
  }));
  const task = back.tasks[0];
  assert.equal(task.time.actualStart, '2027-06-01T07:00');
  assert.equal(task.time.scheduleStart, '2027-06-01T07:00');
  assert.equal(task.time.scheduleFinish, '2027-06-04T00:00');
  assert.equal(back.ifcxSharedDatesApplied, 1);
  const onlyStart = readIfcx(changedFixture((_document, [first]) => {
    Object.assign(first.attributes['openaec::planning::activity'], { start: '2027-05-31', completion: 0.5 });
    (first.attributes['openaec::ops::task'].time as Record<string, unknown>).actualStart = '2027-06-01T07:00';
  }));
  assert.equal(onlyStart.ifcxSharedDatesApplied, undefined);
  assert.equal(onlyStart.tasks[0].time.scheduleStart, '2027-06-01T07:00');
  assert.equal(onlyStart.tasks[0].manuallyScheduled, undefined);
});

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

test('een kring van ouders wordt bij lezen en bij schrijven geweigerd', () => {
  const error = readError(changedFixture((_document, [first, second]) => {
    first.attributes['openaec::planning::activity'].parent = second.path;
    second.attributes['openaec::planning::activity'].parent = first.path;
  }));
  assert.equal(error.code, 'invalid', error.message);
  const plan = datePlan();
  const [a, b] = plan.tasks;
  const refusal = writeRefusal({ ...plan, tasks: [{ ...a, parentId: b.id, childIds: [b.id] }, { ...b, parentId: a.id, childIds: [a.id] }, ...plan.tasks.slice(2)] });
  assert.equal(refusal.code, 'inconsistent');
  assert.deepEqual(refusal.fields, ['task.parentId']);
});

test('dubbele interne id\'s worden bij lezen en bij schrijven geweigerd', () => {
  const error = readError(changedFixture((_document, [first, second]) => {
    second.attributes['openaec::ops::task'].id = first.attributes['openaec::ops::task'].id;
  }));
  assert.equal(error.code, 'invalid', error.message);
  assert.equal(error.place.field, 'task.id');
  const plan = datePlan();
  assert.deepEqual(writeRefusal({ ...plan, tasks: [...plan.tasks, { ...plan.tasks[0] }] }).fields, ['task.id']);
  assert.deepEqual(writeRefusal({ ...plan, sequences: [...plan.sequences, { ...plan.sequences[0] }] }).fields, ['sequence.id']);
  assert.equal(writeRefusal({ ...plan, tasks: [...plan.tasks, { ...plan.tasks[0] }] }).code, 'inconsistent');
});

test('een verzameltaak met een kind dat niet bestaat of haar ouder niet noemt wordt geweigerd (2222)', () => {
  const plan = datePlan();
  for (const tasks of [
    plan.tasks.map((task, index) => index === 0 ? { ...task, isSummary: true, childIds: ['bestaat-niet'] } : task),
    plan.tasks.map(task => task.id === 'binnen-een-dag' ? { ...task, childIds: ['handmatig'] } : task),
  ]) {
    const refusal = writeRefusal({ ...plan, tasks });
    assert.equal(refusal.code, 'inconsistent');
    assert.deepEqual(refusal.fields, ['task.childIds']);
  }
});

test('een ouder of relatie naar een taak die niet bestaat wordt geweigerd', () => {
  const plan = datePlan();
  const relation = writeRefusal({ ...plan, sequences: [...plan.sequences, { id: 'los', predecessorId: 'weg', successorId: 'handmatig', type: 'FINISH_START', lagDays: 0 }] });
  assert.equal(relation.code, 'inconsistent');
  assert.deepEqual(relation.fields, ['sequence.predecessorId']);
  const parent = writeRefusal({ ...plan, tasks: plan.tasks.map((task, index) => index === 1 ? { ...task, parentId: 'weg' } : task) });
  assert.equal(parent.code, 'inconsistent');
  assert.deepEqual(parent.fields, ['task.parentId']);
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
  assert.deepEqual(odd.fields, ['openaec::ops::task.time.lateStart']);
  const zoned = writeRefusal({ ...plan, tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, time: { ...task.time, lateStart: '2027-06-01T07:00+02:00' } } : task) });
  assert.equal(zoned.code, 'invalid');
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
  const back = readIfcx(encode(writeIfcx(input, CLOCK)));
  assertSameDomain(back, input);
  assert.equal(planningCanon(back), planningCanon(input));
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

test('werkplan en werkschema zonder GlobalId van 128 bits worden met hun eigen sleutel geweigerd', () => {
  const plan = datePlan();
  assert.deepEqual(writeRefusal({ ...plan, ifcGlobalIds: { [`wp:${plan.project.id}`]: 'oud' } }).fields, ['ifcGlobalIds.wp']);
  assert.deepEqual(writeRefusal({ ...plan, ifcGlobalIds: { [`ws:${plan.project.id}`]: 'oud' } }).fields, ['ifcGlobalIds.ws']);
});

test('de zelfcontrole weigert een veld dat ze niet kent, ook dieper in een object', () => {
  const plan = datePlan();
  const top = writeRefusal({ ...plan, toekomstigVeld: 1 } as WriteIFCInput);
  assert.equal(top.code, 'self-check');
  assert.deepEqual(top.fields, ['toekomstigVeld']);
  const nested = writeRefusal({ ...plan, calendar: { ...plan.calendar,
    holidays: plan.calendar.holidays.map((holiday, index) => index === 0 ? { ...holiday, bron: 'cao' } : holiday) } });
  assert.equal(nested.code, 'self-check');
  assert.deepEqual(nested.fields, ['calendar.holidays[0].bron']);
});

test('de zelfcontrole ziet het ontbrekende kind ook zonder de eigen weigering', () => {
  const plan = datePlan();
  const reread = readIfcx(encode(writeIfcx(plan, CLOCK)));
  const withMissingChild = { ...plan, tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, isSummary: true, childIds: ['bestaat-niet'] } : task) };
  const differences = selfCheckDifferences(withMissingChild, reread);
  assert.ok(differences.some(difference => difference.startsWith('tasks[0].childIds')), differences.join('; '));
});

test('de zelfcontrole ziet een waarde die bij het teruglezen stil verandert', () => {
  const plan = datePlan();
  const reread = readIfcx(encode(writeIfcx(plan, CLOCK)));
  assert.deepEqual(selfCheckDifferences(plan, reread), []);
  const shifted = { ...reread, tasks: reread.tasks.map((task, index) => index === 1 ? { ...task, priority: task.priority + 1 } : task) };
  assert.deepEqual(selfCheckDifferences(plan, shifted).map(difference => difference.slice(0, difference.indexOf(': '))), ['tasks[1].priority']);
  const reordered = { ...reread, sequences: [...reread.sequences].reverse() };
  assert.ok(selfCheckDifferences(plan, reordered).length > 0, 'de volgorde telt mee');
});

const SELF_CHECK_WITNESSES: Readonly<Record<string, () => WriteIFCInput>> = {
  'lijsten-van-de-lezer': () => without(datePlan(), ['activityCodeTypes', 'customFieldDefs', 'baselines', 'resources', 'assignments', 'resourceCalendars', 'activeBaselineId']),
  'lege-velden-die-deze-versie-niet-draagt': () => {
    const plan = datePlan();
    return { ...plan, libraryPool: null, tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, notes: [] } : task) } as unknown as WriteIFCInput;
  },
  schrijfroute: () => ({ ...datePlan(), writeMode: 'planOnly' } as WriteIFCInput),
  leesmeta: datePlan,
  bronidentiteit: () => ({ ...datePlan(), ifcSource: { herkomst: 'proef' } } as unknown as WriteIFCInput),
  archiefopslag: () => ({ ...datePlan(), xerSourceArchiveStorage: 'embedded' }),
  'nee-is-afwezig': () => ({ ...datePlan(), minuteModelPending: false }),
  globalids: datePlan,
  'gebruikte-taaktypes': () => ({ ...datePlan(), customTaskTypes: [{ id: 'ongebruikt', name: 'Ongebruikt', color: '#123456' }] }),
  'geen-vergelijking': datePlan,
};

test('de lijst uitzonderingen van de zelfcontrole heeft voor elke regel een geval', () => {
  assert.deepEqual(SELF_CHECK_RULES.map(rule => rule.id).sort(), Object.keys(SELF_CHECK_WITNESSES).sort());
  for (const rule of SELF_CHECK_RULES) {
    assert.ok(rule.reason.length > 20, `${rule.id} heeft een reden`);
    const input = SELF_CHECK_WITNESSES[rule.id]();
    const reread = readIfcx(encode(writeIfcx(input, CLOCK)));
    assert.deepEqual(selfCheckDifferences(input, reread), [], rule.id);
    assert.ok(selfCheckDifferences(input, reread, SELF_CHECK_RULES.filter(other => other !== rule)).length > 0, `zonder ${rule.id} ziet de controle een verschil`);
  }
});

const FILLED_IS_REFUSED: Readonly<Record<string, () => WriteIFCInput>> = {
  'nee-is-afwezig': () => ({ ...datePlan(), minuteModelPending: true }),
  'geen-vergelijking': () => ({ ...datePlan(), comparedBaselineIds: ['b1', null] }),
  'lijsten-van-de-lezer': () => ({ ...datePlan(), activeBaselineId: 'b1' }),
  'lege-velden-die-deze-versie-niet-draagt': () => {
    const plan = datePlan();
    return { ...plan, tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, notes: [{ id: 'n1', text: 'Let op', done: false }] } : task) };
  },
};

test('wat een regel als leeg gelijkstelt aan afwezig, wordt met inhoud geweigerd', () => {
  for (const [id, input] of Object.entries(FILLED_IS_REFUSED)) {
    assert.ok(SELF_CHECK_RULES.some(rule => rule.id === id), id);
    assert.ok(['unsupported', 'inconsistent'].includes(writeRefusal(input()).code), id);
  }
});

test('de zelfcontrole weigert een onbekend veld ook als het leeg is, bovenin en dieper (blokkade 1)', () => {
  const plan = datePlan();
  for (const empty of [null, [], {}]) {
    const top = writeRefusal({ ...plan, toekomstigVeld: empty } as unknown as WriteIFCInput);
    assert.equal(top.code, 'self-check', JSON.stringify(empty));
    assert.deepEqual(top.fields, ['toekomstigVeld']);
    const nested = writeRefusal({ ...plan, calendar: { ...plan.calendar,
      holidays: plan.calendar.holidays.map((holiday, index) => index === 0 ? { ...holiday, bron: empty } : holiday) } } as unknown as WriteIFCInput);
    assert.equal(nested.code, 'self-check', JSON.stringify(empty));
    assert.deepEqual(nested.fields, ['calendar.holidays[0].bron']);
  }
  const workTime = writeRefusal({ ...plan, calendar: { ...plan.calendar, workTime: {} } } as unknown as WriteIFCInput);
  assert.equal(workTime.code, 'invalid');
});

function startedFixture(window: { start: string; endExclusive: string }): Uint8Array {
  return changedFixture((_document, [first]) => {
    Object.assign(first.attributes['openaec::planning::activity'], { ...window, completion: 0.5 });
    (first.attributes['openaec::ops::task'].time as Record<string, unknown>).actualStart = '2027-06-01T07:00';
  });
}

test('een gedeeld venster dat een gestarte taak vóór haar werkelijke start laat eindigen, wordt geweigerd (blokkade 2)', () => {
  const error = readError(startedFixture({ start: '2027-05-28', endExclusive: '2027-05-29' }));
  assert.equal(error.code, 'invalid', error.message);
  assert.equal(error.place.field, 'task.time');
  assert.equal(readError(startedFixture({ start: '2027-05-31', endExclusive: '2027-06-01' })).place.field, 'task.time');
  assert.equal(readIfcx(startedFixture({ start: '2027-05-31', endExclusive: '2027-06-03' })).tasks[0].time.scheduleFinish, '2027-06-03T00:00');
  const plan = datePlan();
  const late = { ...plan, tasks: plan.tasks.map((task, index) => index === 0
    ? { ...task, time: { ...task.time, actualStart: '2027-06-03T07:00', completion: 0.5 } } : task) };
  const back = readIfcx(encode(writeIfcx(late, CLOCK)));
  assertSameDomain(back, late);
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
        for (const key of ['relatingProcess', 'relatedProcess', 'parent']) if (attribute[key] === oldPath) attribute[key] = first.path;
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
  const projectAndTask = writeRefusal({ ...plan, ifcGlobalIds: { [`proj:${plan.project.id}`]: shared, [`task:${first.id}`]: shared } });
  assert.deepEqual(projectAndTask.fields, ['task.globalId']);
});

function sequenceFixture(change: (sequence: Record<string, unknown>) => void): Uint8Array {
  const document = documentOf(goodText);
  change(entryWith(document, 'openaec::planning::sequence').attributes['openaec::planning::sequence']);
  return encode(JSON.stringify(document));
}

test('twee lagvormen of een oneindige lag worden bij lezen en bij schrijven geweigerd (blokkade 4)', () => {
  const both = readError(sequenceFixture(sequence => { Object.assign(sequence, { timeLag: 'P2D', timeLagRatio: 0.5 }); }));
  assert.equal(both.code, 'invalid', both.message);
  assert.equal(both.place.field, 'timeLagRatio');
  const huge = readError(sequenceFixture(sequence => { delete sequence.timeLag; sequence.timeLagRatio = 1e308; }));
  assert.equal(huge.code, 'invalid', huge.message);
  assert.equal(huge.place.field, 'sequence.lag');
  const infinite = readError(new TextDecoder().decode(sequenceFixture(sequence => { delete sequence.timeLag; sequence.timeLagRatio = 7; }))
    .replace('"timeLagRatio":7', '"timeLagRatio":1e999'));
  assert.equal(infinite.code, 'invalid', infinite.message);
  const plan = datePlan();
  const refusal = writeRefusal({ ...plan, sequences: plan.sequences.map((sequence, index) => index === 0 ? { ...sequence, lagDays: Infinity } : sequence) });
  assert.equal(refusal.code, 'inconsistent');
  assert.deepEqual(refusal.fields, ['sequence.lag']);
});

test('ongeldige projectdatums, voortgang en kop worden bij schrijven en bij lezen geweigerd (blokkade 5)', () => {
  const plan = datePlan();
  const cases: [WriteIFCInput, string][] = [
    [{ ...plan, project: { ...plan.project, startDate: '2027-02-30T99:99' } }, 'openaec::ops::document.startDate'],
    [{ ...plan, project: { ...plan.project, statusDate: '2027-02-30' } }, 'openaec::ops::document.statusDate'],
    [{ ...plan, tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, time: { ...task.time, completion: 1.5 } } : task) }, 'openaec::planning::activity.completion'],
  ];
  for (const [input, field] of cases) {
    const refusal = writeRefusal(input);
    assert.equal(refusal.code, 'invalid', field);
    assert.deepEqual(refusal.fields, [field]);
  }
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
  const back = readIfcx(encode(text));
  assert.equal(back.ifcxSharedDatesApplied, undefined);
  assertSameDomain(back, input);
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
  'ISO 8601-duur PT<minuten>M': ['PT', 'P2D', '-PT5M'],
  'UUID in kleine letters': ['taak-1', '0123ABCD-0000-4000-8000-000000000000'],
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
  const extra = { ...structuredClone(viaApp.calendar), id: 'ploegendienst', name: 'Ploegendienst' };
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
  const tasks = [parent, ...viaApp.tasks.map(task => task.id === 'binnen-een-dag' ? { ...task, parentId: 'fase' } : task), full, loose];
  return {
    ...viaApp,
    project: { ...viaApp.project, statusDate: '2027-06-02', createdAt: '2027-05-01T08:00:00Z', modifiedAt: '2027-05-02T08:00:00Z' },
    resourceCalendars: [...(viaApp.resourceCalendars ?? []), extra],
    tasks,
    sequences: [...viaApp.sequences, { id: 'r5', predecessorId: 'vol', successorId: 'los', type: 'FINISH_START', lagDays: 1, lagMinutes: 30 },
      { id: 'r6', predecessorId: 'handmatig', successorId: 'los', type: 'FINISH_START', lagDays: 0, lagPercent: 10, lagMinutes: 15 }],
    ifcGlobalIds: { [`task:vol`]: 'oud-vol', [`seq:r5`]: 'oud-r5', [`cal:ploegendienst`]: 'oud-ploeg', [`proj:${viaApp.project.id}`]: 'oud-proj' },
  };
}

function variantPlan(): WriteIFCInput {
  const plan = datePlan();
  const day = [{ start: 420, end: 960 }];
  return {
    ...plan,
    project: { ...plan.project, startDate: '2027-06-01T07:00', author: '', calendarId: 'elders', ifcSchemaUnconfirmed: 'IFC2X3' },
    calendar: {
      ...plan.calendar, shift: 'THIRD', simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 30,
      workingExceptions: [{ name: 'Zaterdag', startDate: '2027-06-05', endDate: '2027-06-05', bands: [{ start: 480, end: 600 }] }],
      workTime: { byWeekday: { 1: day, 2: day, 3: day, 4: day, 5: day, 6: [{ start: 480, end: 720 }], 7: [{ start: 480, end: 600 }] } },
      generation: { ruleSetId: 'NL', region: 'Noord-Holland', breakChoice: 'noord', generatedFromYear: 2027, generatedToYear: 2028 },
    } as WriteIFCInput['calendar'],
  };
}

test('elk veld in de veldtabel wordt met elk tegenvoorbeeld van zijn vorm geweigerd, door de lezer en de writer (regel A, B)', () => {
  const documents = [maximalPlan(), variantPlan(), datePlan(), ...[...fullExamples.values()].map(kernOf)].map(input => documentOf(writeIfcx(input, CLOCK)));
  documents.push(documentOf(readFileSync(join(fixturesDir, 'resources-alle-velden.ifcx'), 'utf8')));
  const missing: string[] = [], wrongReader: string[] = [], wrongWriter: string[] = [];
  let readerCases = 0, writerRefusals = 0, writerUnreachable = 0;
  const check = (label: string, spec: IfcxValue, locate: (document: ReturnType<typeof documentOf>) => readonly unknown[], expected: (error: IfcxReadError) => boolean) => {
    for (const { steps, spec: value } of placesOf(spec).slice(1)) {
      const where = `${label}.${steps.join('.')}`;
      let found: { document: ReturnType<typeof documentOf>; holder: Record<string, unknown> } | undefined;
      for (const document of documents) {
        const holder = locate(document).map(root => holderOf(root, steps)).find(Boolean);
        if (holder) { found = { document, holder }; break; }
      }
      if (!found) { missing.push(where); continue; }
      for (const bad of counterexamplesOf(value)) {
        const text = textWith(found.document, found.holder, steps[steps.length - 1], bad);
        let error: IfcxReadError | undefined;
        try { readIfcxText(text); } catch (thrown) { if (thrown instanceof IfcxReadError) error = thrown; }
        if (!error || !expected(error)) { wrongReader.push(`${where} = ${JSON.stringify(bad)}: ${error?.message ?? 'gelezen'}`); continue; }
        readerCases++;
        let model: ImportResult;
        try { model = readIfcxText(text, false); } catch { writerUnreachable++; continue; }
        try {
          readIfcx(encode(writeIfcx(model, CLOCK)));
        } catch (refusal) {
          if (refusal instanceof IfcxWriteRefusedError && refusal.code !== 'self-check') writerRefusals++;
          else wrongWriter.push(`${where} = ${JSON.stringify(bad)}: ${String(refusal)}`);
        }
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
  assert.deepEqual(wrongWriter, [], 'de writer weigert getypeerd vóór de zelfcontrole');
  assert.ok(writerRefusals > 0);
  console.log(`   ${readerCases} tegenvoorbeelden door de lezer, ${writerRefusals} weigeringen van de writer, ${writerUnreachable} niet als planning te maken`);
});

type ObjectList = (model: WriteIFCInput) => { id: string }[] | undefined;
const IDENTITY_LISTS: Readonly<Record<string, ObjectList | null>> = {
  proj: null, wp: null, ws: null,
  cal: model => model.resourceCalendars,
  task: model => model.tasks,
  seq: model => model.sequences,
  res: model => model.resources,
  assignment: model => model.assignments,
  baseline: model => model.baselines,
  baselineTask: null,
};

test('elke soort met een identiteit: dubbel id, dubbele GlobalId en een verwijzing zonder doel worden geweigerd (regel C)', () => {
  assert.deepEqual(IDENTITY_KINDS.map(kind => kind.kind).sort(), Object.keys(IDENTITY_LISTS).sort());
  const withResources = readIfcx(encode(readFileSync(join(fixturesDir, 'resources-alle-velden.ifcx'), 'utf8')));
  for (const spec of IDENTITY_KINDS) {
    const base: WriteIFCInput = spec.objects(maximalPlan() as PlanningModel).length > 0 ? maximalPlan() : withResources;
    const objects = spec.objects(base as PlanningModel);
    const list = IDENTITY_LISTS[spec.kind];
    if (list) {
      const model = structuredClone(base);
      const items = list(model)!;
      items.push(structuredClone(items[items.length - 1]));
      const refusal = writeRefusal(model);
      assert.equal(refusal.code, 'inconsistent', spec.kind);
      assert.ok(refusal.fields.includes(`${spec.area}.id`), `${spec.kind}: ${refusal.fields.join(', ')}`);
    }
    for (const other of IDENTITY_KINDS) {
      if (other === spec) continue;
      const pair = other.objects(base as PlanningModel).length > 0 ? base : withResources;
      const [own] = spec.objects(pair as PlanningModel);
      const [target] = other.objects(pair as PlanningModel);
      const shared = intendedGlobalIds(pair).get(globalIdKey(other.globalIdKind ?? other.kind as IfcxObjectKind, target.id))!;
      const refusal = writeRefusal({ ...pair, ifcGlobalIds: { ...pair.ifcGlobalIds,
        [globalIdKey(spec.globalIdKind ?? spec.kind as IfcxObjectKind, own.id)]: shared } });
      assert.equal(refusal.code, 'inconsistent', `${spec.kind} ↔ ${other.kind}`);
      assert.ok(refusal.fields.some(field => field.endsWith('.globalId')), `${spec.kind} ↔ ${other.kind}: ${refusal.fields.join(', ')}`);
    }
    const tested = new Set<string>();
    for (const [owning, reference] of objects.flatMap(item => item.references.map(ref => [item, ref] as const))) {
      if (tested.has(reference.field)) continue;
      tested.add(reference.field);
      const model = structuredClone(base);
      const owner = list!(model)!.find(item => item.id === owning.id) as unknown as Record<string, unknown>;
      owner[reference.field] = Array.isArray(owner[reference.field]) ? ['bestaat-niet'] : 'bestaat-niet';
      const refusal = writeRefusal(model);
      assert.equal(refusal.code, 'inconsistent', `${spec.kind}.${reference.field}`);
      assert.ok(refusal.fields.includes(`${spec.area}.${reference.field}`), `${spec.kind}.${reference.field}: ${refusal.fields.join(', ')}`);
    }
  }
});

const RULE_CASES: Readonly<Record<string, () => IfcxReadError | IfcxWriteRefusedError>> = {
  identiteit: () => { const plan = datePlan(); return writeRefusal({ ...plan, tasks: [...plan.tasks, { ...plan.tasks[0] }] }); },
  boom: () => {
    const plan = datePlan();
    const [a, b] = plan.tasks;
    return writeRefusal({ ...plan, tasks: [{ ...a, parentId: b.id, childIds: [b.id] }, { ...b, parentId: a.id, childIds: [a.id] }, ...plan.tasks.slice(2)] });
  },
  venster: () => readError(startedFixture({ start: '2027-05-28', endExclusive: '2027-05-29' })),
  'lag-eindig': () => readError(sequenceFixture(sequence => { delete sequence.timeLag; sequence.timeLagRatio = 1e308; })),
  'projectkalender-in-bibliotheek': () => {
    const viaApp = saveInputViaApp(datePlan());
    return writeRefusal({ ...viaApp, resourceCalendars: (viaApp.resourceCalendars ?? []).map(calendar =>
      calendar.id === viaApp.calendar.id ? { ...calendar, hoursPerDay: calendar.hoursPerDay + 1 } : calendar) });
  },
  'een-lagvorm': () => readError(sequenceFixture(sequence => { Object.assign(sequence, { timeLag: 'P2D', timeLagRatio: 0.5 }); })),
  baselinekeuze: () => writeRefusal({ ...datePlan(), activeBaselineId: 'bestaat-niet' }),
  kosten: () => writeRefusal({ ...datePlan(), resources: [{ id: 'leges', name: 'Leges', type: 'COST', description: '', maxUnits: 2 }] }),
  'gedeeld-venster': () => readError(changedFixture((_document, [first]) => { first.attributes['openaec::planning::activity'].endExclusive = '2027-05-01'; })),
};

test('elke regel over meer velden heeft een reden en een geval dat hij weigert (regel E)', () => {
  assert.deepEqual(CONSISTENCY_RULES.map(rule => rule.id).sort(), Object.keys(RULE_CASES).sort());
  for (const rule of CONSISTENCY_RULES) {
    assert.ok(rule.reason.length > 20, rule.id);
    assert.ok((rule.onPlanning === undefined) !== (rule.onAttribute === undefined), `${rule.id} kijkt naar de planning of naar één attribuut`);
    const refusal = RULE_CASES[rule.id]();
    assert.ok(refusal instanceof IfcxReadError ? refusal.code === 'invalid' : refusal.code === 'inconsistent', `${rule.id}: ${refusal.message}`);
  }
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
