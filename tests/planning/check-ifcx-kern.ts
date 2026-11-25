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
import { selfCheckDifferences } from '@/services/ifc/ifcx/selfCheck';
import { readIfcxText } from '@/services/ifc/ifcx/ifcxReader';
import { canonicalFor } from '@/services/ifc/ifcx/ownFile';
import { stepRoundtrip } from '@/services/ifc/ifcx/stepRoundtrip';
import { HEADER_VALUE } from '@/services/ifc/ifcx/ownAttributes';
import { ALL_MODEL_KEYS, NODES, OWN_ATTRIBUTE_VALUES, STEP_WRITER_INPUT_NOT_CARRIED } from '@/services/ifc/ifcx/nodes';
import { IDENTITY_KINDS, intendedGlobalIds, type PlanningModel } from '@/services/ifc/ifcx/identity';
import { TASK_TIME_FIELDS } from '@/services/ifc/ifcx/fields/taskFields';
import {
  CALENDAR_DATE_FORM, FREE_TEXT_FORM, ISO_DATE_OR_MOMENT_OR_EMPTY_FORM, ISO_MOMENT_FORM,
  LOCAL_MOMENT_OR_EMPTY, LOCAL_MOMENT_OR_EMPTY_FORM, NON_EMPTY_TEXT_FORM, VERSION_FORM, type IfcxField, type IfcxValue,
} from '@/services/ifc/ifcx/fieldTable';
import {
  compactGlobalIdToUuid, globalIdOfPath, isCompactGlobalId, isIdentityPath, pathOfGlobalId, uuidToCompactGlobalId,
} from '@/services/ifc/ifcx/identityPath';
import { OPS_NAMESPACE } from '@/services/ifc/ifcx/profile';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { syncProjectCalendar } from '@/state/syncProjectCalendar';
import { buildWriteIFCInput, type IFCSaveSource } from '@/state/ifcSaveInput';
import { freshPayload, payloadFromImport, type DocumentPayload } from '@/state/documentContract';

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
    activityCodeTypes: [], customFieldDefs: [], customTaskTypes: [], libraryPool: undefined,
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

const atLoad = (model: ImportResult) => plain(payloadFromImport(structuredClone(model), null)) as DocumentPayload;

function stepReopened(input: WriteIFCInput): ImportResult {
  const step = stepRoundtrip(input);
  return {
    ...step, ifcGlobalIds: { ...step.ifcGlobalIds, ...Object.fromEntries([...intendedGlobalIds(step)].filter(([seed]) => !step.ifcGlobalIds?.[seed])) },
  };
}


const READING_FACTS = ['recordedFields', 'recordedTimes', 'recordedTimesOrigin', 'recordedSourceFormat'] as const;
const readingFacts = (model: ImportResult) => Object.fromEntries(READING_FACTS.map(key => [key, model[key]])) as unknown as ImportResult;

function asStepDifferences(back: ImportResult, step: ImportResult): string[] {
  const facts = selfCheckDifferences(readingFacts(step), readingFacts(back), 10);
  if (facts.length > 0) return facts.map(difference => `model ${difference}`);
  return selfCheckDifferences(atLoad(step) as unknown as ImportResult, atLoad(back) as unknown as ImportResult, 10)
    .map(difference => `na de laadgrens ${difference}`);
}

function assertAsStep(back: ImportResult, input: WriteIFCInput): void {
  assert.deepEqual(asStepDifferences(back, stepReopened(input)), []);
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
    id: `urn:openaec:planner:${pathOfGlobalId(projectGuid)}`, ifcxVersion: 'ifcx_alpha', dataVersion: '1.0.0',
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
  const entry = document.data.find(item => item.path === pathOfGlobalId(guid))!;
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
  assert.equal(ops(0).lag, undefined);
  assert.equal(shared(1).timeLag, '-PT90M');
  assert.equal(shared(1).sequenceType, 'START_START');
  assert.deepEqual(ops(1).lag, { amount: step[1].lagMinutes, unit: 'MINUTES' });
  assert.equal(shared(2).timeLagRatio, (step[2].lagPercent ?? 0) / 100);
  assert.equal(shared(2).lagDurationType, 'ELAPSEDTIME');
  assert.deepEqual(ops(2).lag, { amount: step[2].lagPercent, unit: 'PERCENT' });
  assert.equal(shared(3).timeLag, 'P2.5D');
  assert.deepEqual(ops(3).lag, { amount: 2.5, unit: 'DAYS' });
  for (let index = 0; index < 4; index++) {
    assert.deepEqual(Object.keys(ops(index)).filter(key => key.startsWith('lag')).sort(), index === 0 ? [] : index === 2 ? ['lag', 'lagUnit'] : ['lag']);
  }
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

function oldNameBasedGlobalId(text: string): string {
  const namespace = 'fd4e93a2-de83-56ee-929c-defaa450b626';
  const hash = createHash('sha1').update(Buffer.concat([Buffer.from(namespace.replace(/-/g, ''), 'hex'), Buffer.from(text, 'utf8')])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return uuidToCompactGlobalId(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`);
}

function pathIdentities(): string[] {
  const out = new Set<string>(['', 'oud-1', 'oude-guid', 'review-legacy-global-id', 'é ü 漢', '🧱', 't-', 't-0041', '0'.repeat(22), '3' + '$'.repeat(21),
    '4' + '0'.repeat(21), '0'.repeat(21), '0'.repeat(23), 'zzzzzzzzzzzzzzzzzzzzzz', '\u0000', 'a\ud800b', '00000000-0000-4000-8000-000000000001']);
  for (let i = 0; i < 1500; i++) {
    const text = `oude-guid-${i}`;
    out.add(text);
    out.add(oldNameBasedGlobalId(text));
    out.add(ifcGuid128(`seed-${i}`));
    out.add(ifcGuid(`kort-${i}`));
    out.add(pathOfGlobalId(ifcGuid128(`pad-${i}`)));
  }
  return [...out];
}

test('padvorm: twee verschillende GlobalIds krijgen nooit hetzelfde pad en het pad geeft de GlobalId terug (R3)', () => {
  const owners = new Map<string, string>();
  const wrong: string[] = [];
  const identities = pathIdentities();
  const all = new Set(identities);
  let collisionsBefore = 0;
  for (const globalId of identities) {
    const path = pathOfGlobalId(globalId);
    const owner = owners.get(path);
    if (owner !== undefined && owner !== globalId) wrong.push(`${JSON.stringify(owner)} en ${JSON.stringify(globalId)} op ${path}`);
    owners.set(path, globalId);
    if (!isIdentityPath(path) || globalIdOfPath(path) !== globalId) wrong.push(`${JSON.stringify(globalId)} → ${path} → ${JSON.stringify(globalIdOfPath(path))}`);
    if (!isCompactGlobalId(globalId) && all.has(oldNameBasedGlobalId(globalId))) collisionsBefore++;
  }
  assert.deepEqual(wrong, []);
  assert.ok(collisionsBefore >= 1500, `de verzameling bevat de paren die onder de oude afbeelding botsten (${collisionsBefore})`);
  for (const path of ['', 'geen-pad', 't-004', 't-00G1', 't-00A1', 'T-0041', `t-${[...'0'.repeat(22)].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}`,
    '00000000-0000-4000-8000-00000000000G', '00000000-0000-4000-8000-00000000000A', '00000000-0000-4000-8000-0000000000001']) {
    assert.equal(globalIdOfPath(path), undefined, path);
  }
  assert.equal(globalIdOfPath('t-'), '', 'de lege tekst heeft het pad t-');
  for (const path of owners.keys()) assert.equal(pathOfGlobalId(globalIdOfPath(path)!), path);
});

test('padvorm: een compacte GlobalId wordt haar UUID, andere tekst t- met vier hexcijfers per teken', () => {
  const guid = ifcGuid128('taak');
  assert.equal(pathOfGlobalId(guid), compactGlobalIdToUuid(guid));
  assert.equal(pathOfGlobalId('oud-1'), 't-006f00750064002d0031');
  assert.equal(pathOfGlobalId('é'), 't-00e9');
});

test('een GlobalId zonder 128-bitsvorm krijgt een tekstpad en geen apart veld', () => {
  const plan = datePlan();
  const oldGuid = ifcGuid('oude-taak');
  const odd = isCompactGlobalId(oldGuid) ? 'z' + oldGuid.slice(1) : oldGuid;
  const input: ImportResult = { ...plan, ifcGlobalIds: { 'task:handmatig': odd, 'seq:r1': 'geen-guid' } };
  const text = writeIfcx(input, CLOCK);
  const document = documentOf(text);
  const entry = document.data.find(item => item.path === pathOfGlobalId(odd))!;
  assert.match(entry.path, /^t-/);
  assert.ok(!('globalId' in entry.attributes['openaec::ops::task']));
  const back = readIfcx(encode(text));
  assert.equal(back.ifcGlobalIds!['task:handmatig'], odd);
  assert.equal(back.ifcGlobalIds![`seq:${back.sequences[0].id}`], 'geen-guid');
  assertAsStep(back, input);
});

test('ronde 5, blokkade 3: een oude tekst-GlobalId en de compacte GlobalId van haar oude UUID v5 slaan allebei op', () => {
  const legacy = 'review-legacy-global-id';
  const compact = oldNameBasedGlobalId(legacy);
  assert.equal(compact, '2kQYLmYGPONRDhJ87YhMzT');
  const plan = saveInputViaApp(datePlan());
  const input = { ...plan, ifcGlobalIds: { ...plan.ifcGlobalIds, 'task:binnen-een-dag': legacy, 'task:einde-middernacht': compact } };
  const back = readIfcx(encode(writeIfcx(input, CLOCK)));
  assertAsStep(back, input);
  assert.equal(back.ifcGlobalIds!['task:binnen-een-dag'], legacy);
  assert.equal(back.ifcGlobalIds!['task:einde-middernacht'], compact);
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

const NOT_CARRIED_YET = [
  'resources', 'assignments', 'activityCodeTypes', 'customFieldDefs', 'customTaskTypes', 'baselines', 'activeBaselineId',
  'comparedBaselineIds', 'libraryPool', 'sourceScheduleNotes', 'recordedTimes', 'baselineOrphanGuids', 'recordedSourceFormat',
  'suggestedProfileId', 'xer', 'xerOrigin', 'xerSourceArchive', 'ifcSource', 'ifcLegacySchemaLoss', 'recoveryForeignSource',
  'xerSourceProjectId', 'xerArchiveIssue', 'xerMissingPlannedStarts', 'p6xmlReport', 'msProjectReport', 'withheldTaskTimeFields',
  'xerSourceArchiveStorage',
];

test('R1 volledig: elk veld dat de STEP-lezer naast het model teruggeeft, is ingedeeld; wat IFCX nog niet draagt, weigert de writer', () => {
  assert.deepEqual([...STEP_WRITER_INPUT_NOT_CARRIED].sort(), [...NOT_CARRIED_YET].sort());
  const carried = new Set(NODES.flatMap(node => node.modelKeys));
  const known = new Set<string>(ALL_MODEL_KEYS);
  const unclassified = new Set<string>();
  for (const model of [...fullExamples.values(), stepRoundtrip(maximalPlan()), stepRoundtrip(variantPlan())]) {
    for (const key of Object.keys(model)) if (!known.has(key)) unclassified.add(key);
  }
  assert.deepEqual([...unclassified], [], 'een veld van de STEP-lezer dat nergens is ingedeeld');
  for (const key of ['timeModel', 'milestonesAtDayEnd', 'recordedFields', 'recordedTimesOrigin', 'importPristine', 'ifcLiteralCalendarIds', 'minuteModelPending']) {
    assert.ok(carried.has(key as never), `${key} hoort bij een node`);
  }
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
  { name: 'een pad dat geen identiteitspad is', code: 'foreign', change: d => { entryWith(d, 'openaec::planning::sequence').path = '/planning/work-0'; } },
  { name: 'een tekstpad van een compacte GlobalId', code: 'foreign', change: d => {
    const entry = entryWith(d, 'openaec::planning::sequence');
    entry.path = `t-${[...uuidToCompactGlobalId(entry.path)].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}`;
  } },
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
  assert.match(refusal.message, /task\.constraint \(taak binnen-een-dag\)/);
  assert.match(refusal.message, /project\.schedulingOptions \(het project\)/);
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
  const step = stepReopened(plan);
  const reread = readIfcxText(text, false);
  assert.deepEqual(selfCheckDifferences(step, reread), []);
  const shifted = { ...reread, tasks: reread.tasks.map((task, index) => index === 1 ? { ...task, priority: task.priority + 1 } : task) };
  assert.deepEqual(selfCheckDifferences(step, shifted).map(difference => difference.slice(0, difference.indexOf(': '))), ['tasks[1].priority']);
  const reordered = { ...reread, sequences: [...reread.sequences].reverse() };
  assert.ok(selfCheckDifferences(step, reordered).length > 0, 'de volgorde telt mee');
});

const FILLED_IS_REFUSED: Readonly<Record<string, () => WriteIFCInput>> = {
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
  [VERSION_FORM.name]: ['een', '1.0'],
  'ISO 8601-duur P<dagen>D of PT<minuten>M, met een minteken voor een lead': ['P2', 'PT', '2D'],
  'urn:openaec:planner:<pad van het project>': ['urn:openaec:planner:geen-pad', 'urn:openaec:planner:00000000-0000-4000-8000-00000000000A',
    `urn:openaec:planner:t-${[...'0'.repeat(22)].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}`],
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
    case 'Reference': return ['geen-pad', 5, `t-${[...'0'.repeat(22)].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}`];
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
  const empty = dateCaseTask('leeg', moment(6, '07:00'), moment(6, '16:00'));
  empty.time = { ...empty.time, earlyStart: '', earlyFinish: '', lateStart: '', lateFinish: '' };
  const done = dateCaseTask('klaar', moment(1, '07:00'), moment(1, '16:00'));
  done.time = { ...done.time, actualStart: moment(1, '07:00'), actualFinish: moment(1, '16:00'), completion: 1 };
  const tasks = [parent, ...viaApp.tasks.map(task => task.id === 'binnen-een-dag' ? { ...task, parentId: 'fase' }
    : task.id === 'eindmijlpaal' ? { ...task, mandatory: true } : task), full, loose, done, empty];
  return {
    ...viaApp,
    importPristine: true,
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

function payloadPlan(change: (payload: DocumentPayload) => void): WriteIFCInput {
  const payload = freshPayload();
  payload.calendar.holidays = [];
  payload.calendars = payload.calendars.map(calendar => (calendar.id === payload.calendar.id ? payload.calendar : calendar));
  change(payload);
  return buildWriteIFCInput(payload as unknown as IFCSaveSource, 'planOnly');
}

function d7Plan(): WriteIFCInput {
  return payloadPlan(payload => {
    const milestone = dateCaseTask('mijlpaal', '2026-06-01T16:00', '2026-06-01T16:00', { isMilestone: true });
    milestone.time.scheduleDuration = 0;
    payload.tasks = [milestone];
  });
}

function literalPlan(): WriteIFCInput {
  return payloadPlan(payload => {
    payload.tasks = [dateCaseTask('dag', '2026-06-01T07:00', '2026-06-01T16:00')];
    payload.ifcLiteralCalendarIds = [payload.calendar.id];
  });
}

function pendingPlan(): WriteIFCInput {
  return payloadPlan(payload => {
    payload.tasks = [dateCaseTask('oud', '2026-06-01', '2026-06-01')];
    payload.minuteModelPending = true;
  });
}

const loadPlans = () => [d7Plan(), literalPlan(), pendingPlan()];

function absentPlan(): WriteIFCInput {
  return payloadPlan(payload => {
    const dag = dateCaseTask('dag', '2027-06-01T07:00', '2027-06-01T16:00');
    dag.time = { ...dag.time, lateStart: '', lateFinish: '' };
    const mijlpaal = dateCaseTask('mijlpaal', '2027-06-02T07:00', '2027-06-02T07:00', { isMilestone: true });
    mijlpaal.time = { ...mijlpaal.time, scheduleDuration: 0, earlyStart: '', earlyFinish: '' };
    payload.tasks = [dag, mijlpaal];
  });
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
  const documents = [maximalPlan(), variantPlan(), datePlan(), ...loadPlans(), ...[...fullExamples.values()].map(kernOf)].map(input => documentOf(writeIfcx(input, CLOCK)));
  const missing: string[] = [], wrongReader: string[] = [], wrongWriter: string[] = [];
  const outcomes = {
    'de writer weigert om dit veld': 0, 'de writer weigert in hetzelfde attribuut, waar de STEP-rondgang de waarde neerzette': 0,
    'opslaan als IFC weigert de planning': 0, 'de writer weigert zijn eigen uitvoer, omdat STEP de planning bij een tweede rondgang anders schrijft': 0,
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
          if (refusal instanceof IfcxWriteRefusedError && refusal.code === 'self-check') {
            outcomes['de writer weigert zijn eigen uitvoer, omdat STEP de planning bij een tweede rondgang anders schrijft']++;
            console.log(`     ${shown}: de writer weigert zijn eigen uitvoer op ${refusal.fields.join(', ')}`);
          }
          else if (!(refusal instanceof IfcxWriteRefusedError) || refusal.code !== 'invalid') wrongWriter.push(`${shown}: ${String(refusal)}`);
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
    for (const difference of asStepDifferences(own.value, stepReopened(input)).slice(0, 3)) wrong.push(`${entry.name}: ${difference}`);
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

test('punt 8 (ronde 4, 5 en 6): een bestand met lege vroege datums schrijft de eigen schrijver niet, dus het opent niet: taak en veld', () => {
  const document = documentOf(writeIfcx(datePlan(), CLOCK));
  const entry = entryWith(document, 'openaec::ops::task');
  Object.assign(entry.attributes['openaec::ops::task'].time as Record<string, unknown>, { earlyStart: '', earlyFinish: '', lateStart: '', lateFinish: '' });
  const error = readError(JSON.stringify(document));
  assert.equal(error.code, 'invalid', error.message);
  assert.deepEqual(error.place, { path: entry.path, attribute: 'openaec::ops::task', field: 'time.earlyStart' });
  assert.match(error.message, /taak binnen-een-dag/);
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
  assert.ok(document.data.some(entry => entry.path === pathOfGlobalId('oud-schema') && 'openaec::planning::schedule' in entry.attributes));
  entryWith(document, 'openaec::ops::document').attributes['openaec::ops::document'].scheduleGlobalId = 'ander-schema';
  const error = readError(JSON.stringify(document));
  assert.equal(error.code, 'newer-profile', error.message);
  assert.equal(error.place.field, 'scheduleGlobalId');
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
  for (const [shared, precise] of [[{ timeLagRatio: 0.25 }, { lag: { amount: 8, unit: 'DAYS' } }], [{ timeLag: 'P8D' }, { lag: { amount: 25, unit: 'PERCENT' } }]] as const) {
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
  assert.equal(back.sequences[0].lagDays, 0);
});

test('ronde 5, blokkade 2: acht dagen naast 25 % lag kan de precieze kant niet meer dragen', () => {
  const plan = saveInputViaApp(datePlan());
  const input = { ...plan, sequences: plan.sequences.map((sequence, index) => index === 0 ? { ...sequence, lagDays: 0, lagPercent: 25 } : sequence) };
  const document = documentOf(writeIfcx(input, CLOCK));
  const entry = entryWith(document, 'openaec::ops::sequence');
  assert.deepEqual(entry.attributes['openaec::ops::sequence'].lag, { amount: 25, unit: 'PERCENT' });
  entry.attributes['openaec::ops::sequence'].lagDays = 8;
  const error = readError(JSON.stringify(document));
  assert.equal(error.code, 'newer-profile', error.message);
  assert.deepEqual(error.place, { path: entry.path, attribute: 'openaec::ops::sequence', field: 'lagDays' });
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

test('ronde 5, blokkade 1 en R1 volledig: na de laadgrens geeft IFCX hetzelfde als STEP, voor de D7-mijlpaal, een letterlijke kalender en een oude planning', () => {
  const cases: readonly [string, WriteIFCInput, (payload: DocumentPayload) => unknown, unknown][] = [
    ['de D7-mijlpaal', d7Plan(), payload => [payload.tasks[0].time.earlyStart, payload.tasks[0].time.earlyFinish], ['2026-06-01T16:00', '2026-06-01T16:00']],
    ['de letterlijke kalender', literalPlan(), payload => payload.ifcLiteralCalendarIds, ['cal-default']],
    ['de oude planning', pendingPlan(), payload => [payload.minuteModelPending, payload.tasks[0].time.scheduleStart], [true, '2026-06-01T07:00']],
  ];
  for (const [name, input, pick, expected] of cases) {
    const step = payloadFromImport(stepRoundtrip(input), null);
    const own = payloadFromImport(readIfcx(encode(writeIfcx(input, CLOCK))), null);
    assert.deepEqual(plain(pick(step)), expected, `${name}: STEP`);
    assert.deepEqual(plain(pick(own)), expected, `${name}: IFCX`);
    assert.deepEqual(plain(own), plain(step), `${name}: de hele planning na de laadgrens`);
  }
  const d7 = documentOf(writeIfcx(d7Plan(), CLOCK));
  assert.equal(entryWith(d7, 'openaec::ops::task').attributes['openaec::ops::task'].atDayEnd, true);
  const pending = documentOf(writeIfcx(pendingPlan(), CLOCK));
  assert.ok(!('timeModel' in entryWith(pending, 'openaec::ops::document').attributes['openaec::ops::document']));
});

test('R0: twee bibliotheekrijen met het id van de projectkalender weigert de writer; één rij is de projectkalender zelf (vervolg ronde 5)', () => {
  const plan = saveInputViaApp(datePlan());
  const row = (plan.resourceCalendars ?? []).find(calendar => calendar.id === plan.calendar.id)!;
  const refusal = writeRefusal({ ...plan, resourceCalendars: [...(plan.resourceCalendars ?? []), structuredClone(row)] });
  assert.equal(refusal.code, 'inconsistent');
  assert.deepEqual(refusal.fields, ['calendar.id']);
  assert.match(refusal.message, new RegExp(`Twee kalenders in de bibliotheek hebben het id ${row.id}`));
  assertAsStep(readIfcx(encode(writeIfcx(plan, CLOCK))), plan);
});

type Document = ReturnType<typeof documentOf>;
type Entry = Document['data'][number];

function r4Plans(): WriteIFCInput[] {
  return [maximalPlan(), variantPlan(), datePlan(), ...loadPlans(), absentPlan()];
}

function publicRouteProblems(name: string, input: WriteIFCInput, text: string): string[] {
  const back = attempt(() => readIfcx(encode(text)));
  if (!back.ok) return [`${name}: opent niet: ${String(back.error).slice(0, 200)}`];
  const problems: string[] = [];
  const differences = selfCheckDifferences(canonicalFor(input), back.value, 3);
  if (differences.length > 0) problems.push(`${name}: niet de canonieke planning: ${differences.join('; ')}`);
  const asStep = asStepDifferences(back.value, stepReopened(input));
  if (asStep.length > 0) problems.push(`${name}: anders dan het STEP-bestand na openen: ${asStep.slice(0, 3).join('; ')}`);
  if (writeIfcx(back.value, CLOCK) !== text) problems.push(`${name}: writeIfcx(readIfcx(b)) geeft andere bytes`);
  return problems;
}

test('R4, richting 1: elk bestand dat writeIfcx schrijft, opent, geeft precies de geschreven planning terug, en opnieuw opslaan geeft dezelfde bytes', () => {
  const wrong: string[] = [];
  const inputs: [string, WriteIFCInput][] = [
    ...[...fullExamples].flatMap(([name, full]) => [[name, kernOf(full)], [`${name} via de app`, saveInputViaApp(kernOf(full))]] as [string, WriteIFCInput][]),
    ...r4Plans().map((plan, index) => [`proefplanning ${index}`, plan] as [string, WriteIFCInput]),
    ...STEP_CASES.filter(entry => !entry.refusedBy).map(entry => [entry.name, entry.input()] as [string, WriteIFCInput]),
  ];
  let written = 0;
  for (const [name, input] of inputs) {
    const text = attempt(() => writeIfcx(input, CLOCK));
    if (!text.ok) {
      if (text.error instanceof IfcxWriteRefusedError && text.error.code === 'self-check') wrong.push(`${name}: de schrijver weigert zijn eigen uitvoer: ${text.error.message.slice(0, 200)}`);
      continue;
    }
    written++;
    wrong.push(...publicRouteProblems(name, input, text.value));
  }
  assert.deepEqual(wrong, []);
  assert.ok(written >= 30, `${written} bestanden`);
  console.log(`   ${written} geschreven bestanden, elk geopend, gelijk aan de geschreven planning en byte voor byte opnieuw geschreven`);
});

function kindsPlan(pending: boolean): WriteIFCInput {
  return payloadPlan(payload => {
    const fase = dateCaseTask('fase', '2027-06-01T07:00', '2027-06-04T16:00', { isSummary: true, childIds: ['dag', 'uur', 'mijlpaal'] });
    const dag = dateCaseTask('dag', '2027-06-01T07:00', '2027-06-01T16:00', { parentId: 'fase' });
    const uur = dateCaseTask('uur', '2027-06-02T07:00', '2027-06-02T11:00', { parentId: 'fase' });
    uur.time = { ...uur.time, durationUnit: 'hours', durationMinutes: 240, scheduleDuration: 4 / 9 };
    const mijlpaal = dateCaseTask('mijlpaal', '2027-06-04T16:00', '2027-06-04T16:00', { parentId: 'fase', isMilestone: true, milestoneKind: 'FINISH' });
    mijlpaal.time.scheduleDuration = 0;
    payload.tasks = [fase, dag, uur, mijlpaal];
    payload.sequences = [
      { id: 'r1', predecessorId: 'dag', successorId: 'uur', type: 'FINISH_START', lagDays: 0 },
      { id: 'r2', predecessorId: 'uur', successorId: 'mijlpaal', type: 'FINISH_START', lagDays: 0 },
    ];
    payload.minuteModelPending = pending;
  });
}

const NOT_CANONICAL: readonly (readonly [string, (day: string) => string])[] = [
  ['een dag zonder tijd', day => day],
  ['een lege waarde', () => ''],
  ['vóór de werkdag', day => `${day}T05:00`],
  ['na de werkdag', day => `${day}T22:30`],
];

test('R5 is niet te halen voor een pauze buiten de werkdag: STEP houdt haar bij de eerste rondgang en laat haar bij de tweede vallen; de writer weigert met self-check', () => {
  const plan = maximalPlan();
  const input: WriteIFCInput = { ...plan, resourceCalendars: plan.resourceCalendars!.map(calendar => (calendar.simpleBreakStartMinute === undefined ? calendar : { ...calendar, simpleBreakStartMinute: 1 })) };
  const breakOf = (model: ImportResult) => (model.resourceCalendars ?? []).filter(calendar => calendar.simpleBreakDurationMinutes !== undefined).map(calendar => [calendar.simpleBreakStartMinute, calendar.simpleBreakDurationMinutes]);
  const once = stepRoundtrip(input);
  assert.deepEqual(breakOf(once), [[1, 30]]);
  assert.deepEqual(breakOf(stepRoundtrip(canonicalFor(input))), []);
  const refusal = attempt(() => writeIfcx(input, CLOCK));
  assert.ok(!refusal.ok && refusal.error instanceof IfcxWriteRefusedError && refusal.error.code === 'self-check', String(refusal.ok ? 'geschreven' : refusal.error));
  assert.match(refusal.error.message, /simpleBreakStartMinute: 1 → afwezig/);
  const inside = { ...plan, resourceCalendars: plan.resourceCalendars!.map(calendar => (calendar.simpleBreakStartMinute === undefined ? calendar : { ...calendar, simpleBreakStartMinute: 600 })) };
  assert.deepEqual(breakOf(readIfcx(encode(writeIfcx(inside, CLOCK)))), [[600, 30]]);
});

test('R5, richting 1: voor elke planning die de schrijver aanvaardt, opent readIfcx(writeIfcx(x)) als de canonieke planning, ook als x niet canoniek is', () => {
  const fields = TASK_TIME_FIELDS.filter(field => field.value === LOCAL_MOMENT_OR_EMPTY).map(field => field.key as keyof Task['time']);
  const accepted = new Map<string, number>();
  const wrong: string[] = [];
  let cases = 0, written = 0;
  const run = (name: string, input: WriteIFCInput, keys: readonly string[]) => {
    cases++;
    const text = attempt(() => writeIfcx(input, CLOCK));
    if (!text.ok) {
      if (text.error instanceof IfcxWriteRefusedError && text.error.code === 'self-check') wrong.push(`${name}: de schrijver weigert zijn eigen uitvoer: ${text.error.message.slice(0, 200)}`);
      return;
    }
    written++;
    const problems = publicRouteProblems(name, input, text.value);
    wrong.push(...problems);
    if (problems.length === 0) for (const key of keys) accepted.set(key, (accepted.get(key) ?? 0) + 1);
  };
  for (const pending of [false, true]) {
    const base = kindsPlan(pending);
    for (const task of base.tasks) {
      for (const field of fields) {
        for (const [form, valueOf] of NOT_CANONICAL) {
          const day = String(task.time[field] || task.time.scheduleStart).slice(0, 10);
          const input = { ...base, tasks: base.tasks.map(other => (other.id === task.id ? { ...other, time: { ...other.time, [field]: valueOf(day) } } : other)) };
          run(`${pending ? 'vóór het minutenmodel, ' : ''}${task.id}.${field}: ${form}`, input,
            [`taak ${task.id}`, `veld ${field}`, `vorm ${form}`, pending ? 'vóór het minutenmodel' : 'minutenmodel']);
        }
      }
    }
  }
  for (const [index, plan] of r4Plans().entries()) run(`proefplanning ${index}`, plan, ['datumfixture']);
  const needed = [
    ...['fase', 'dag', 'uur', 'mijlpaal'].map(id => `taak ${id}`), ...fields.map(field => `veld ${field}`),
    ...NOT_CANONICAL.map(([form]) => `vorm ${form}`), 'vóór het minutenmodel', 'minutenmodel', 'datumfixture',
  ];
  for (const line of wrong.slice(0, 30)) console.error(`   ${line}`);
  assert.deepEqual(wrong, []);
  assert.deepEqual(needed.filter(key => !accepted.get(key)), [], 'elke taaksoort, elk tijdveld en elke vorm heeft een geschreven en geopend geval');
  console.log(`   ${cases} gevallen, ${written} geschreven; elk opent als de canonieke planning, gelijk aan het STEP-bestand na openen, en writeIfcx(readIfcx(b)) geeft dezelfde bytes`);
});

test('ronde 6: een dagtaak met een tweede duur of restduur, een project op het lege pad, een werkelijk einde met 50 % en lege vroege datums openen niet', () => {
  const text = writeIfcx(datePlan(), CLOCK);
  const cases: readonly [string, (document: Document) => Entry | undefined, (entry: Entry | undefined) => object][] = [
    ['blokkade 1: durationMinutes naast een dagduur', document => {
      const entry = entryWith(document, 'openaec::ops::task');
      (entry.attributes['openaec::ops::task'].time as Record<string, unknown>).durationMinutes = 9999;
      return entry;
    }, entry => ({ path: entry!.path, attribute: 'openaec::ops::task', field: 'time.durationMinutes' })],
    ['blokkade 1: remainingMinutes naast een restduur in dagen', document => {
      const entry = entryWith(document, 'openaec::ops::task');
      Object.assign(entry.attributes['openaec::ops::task'].time as Record<string, unknown>, { remainingTime: 0.5, remainingMinutes: 999 });
      return entry;
    }, entry => ({ path: entry!.path, attribute: 'openaec::ops::task', field: 'time.remainingMinutes' })],
    ['blokkade 2: het project op het lege tekstpad', document => { document.header.id = 'urn:openaec:planner:t-'; return undefined; }, () => ({ field: 'header.id' })],
    ['blokkade 3: werkelijk einde met 50 %', document => {
      const entry = entryWith(document, 'openaec::ops::task');
      const time = entry.attributes['openaec::ops::task'].time as Record<string, unknown>;
      Object.assign(time, { actualStart: time.scheduleStart, actualFinish: time.scheduleFinish });
      entry.attributes['openaec::ops::task'].completion = 0.5;
      entry.attributes['openaec::planning::activity'].completion = 0.5;
      return entry;
    }, entry => ({ path: entry!.path, attribute: 'openaec::ops::task', field: 'completion' })],
  ];
  for (const [name, change, place] of cases) {
    const document = documentOf(text);
    const entry = change(document);
    const error = readError(JSON.stringify(document));
    assert.equal(error.code, 'invalid', `${name}: ${error.message}`);
    assert.deepEqual(error.place, place(entry), `${name}: ${error.message}`);
    assert.match(error.message, entry ? /taak binnen-een-dag/ : /Het project/, name);
  }
  const plan = datePlan();
  const emptyGlobalIds = { ...plan, ifcGlobalIds: { 'proj:proj-datums': '', 'wp:proj-datums': '', 'task:handmatig': '', 'seq:r1': '' } };
  const back = readIfcx(encode(writeIfcx(emptyGlobalIds, CLOCK)));
  assert.ok(Object.values(back.ifcGlobalIds ?? {}).every(globalId => globalId !== ''), 'een lege GlobalId schrijft de schrijver als de afgeleide');
  assertAsStep(back, emptyGlobalIds);
});

test('een schrijfweigering om een waarde buiten haar domein noemt het object (vervolg ronde 6)', () => {
  const refusal = writeRefusal(withCalendar(calendar => ({ ...calendar, generation: { ruleSetId: 'XX' as never, generatedFromYear: 2027, generatedToYear: 2028 } })));
  assert.equal(refusal.code, 'invalid', refusal.message);
  assert.match(refusal.message, /^kalender \S+: openaec::ops::calendar: /);
  assert.deepEqual(refusal.fields, ['openaec::ops::calendar.generation.ruleSetId']);
});

test('R4 en R5 zijn één functie: writeIfcx en readIfcx gaan door dezelfde canonieke planning; de schrijver toetst zich met de publieke lezer; alleen ownFile.ts roept de rondgang, de projectie en de laadgrens aan', () => {
  const dir = join(root, 'src/services/ifc/ifcx');
  const sources = readdirSync(dir).filter(name => name.endsWith('.ts')).map(name => [name, readFileSync(join(dir, name), 'utf8')] as const);
  const callers = (call: string, definedIn?: string) => sources.filter(([name, text]) => name !== definedIn && text.includes(`${call}(`)).map(([name]) => name);
  const source = (file: string) => sources.find(([name]) => name === file)![1];
  assert.deepEqual(callers('stepRoundtrip', 'stepRoundtrip.ts'), ['ownFile.ts']);
  assert.deepEqual(callers('composeIfcxDocument', 'projection.ts'), ['ownFile.ts']);
  assert.deepEqual(callers('payloadFromImport'), ['ownFile.ts']);
  assert.deepEqual(callers('buildWriteIFCInput'), ['ownFile.ts']);
  assert.deepEqual(callers('ownFileFor', 'ownFile.ts').sort(), ['ifcxReader.ts', 'ifcxWriter.ts']);
  assert.deepEqual([...source('ownFile.ts').matchAll(/^export (?:function|const) (\w+)/gm)].map(match => match[1]).sort(),
    ['canonicalFor', 'canonicalPlanning', 'ownFileFor']);
  assert.match(source('ifcxReader.ts'), /const planning = canonicalPlanning\(read\);\n\s+const own = writerRefusal\(\(\) => ownFileFor\(planning,/);
  assert.match(source('ifcxWriter.ts'), /const canonical = canonicalFor\(given\);\n\s+const \{ document \} = ownFileFor\(canonical, writtenAt\);/);
  assert.match(source('ifcxWriter.ts'), /readIfcx\(new TextEncoder\(\)\.encode\(text\)\)/);
  assert.doesNotMatch(source('ifcxWriter.ts'), /readIfcxText/);
});

interface R4Place { readonly attribute: string; readonly steps: readonly string[]; readonly spec: IfcxValue; readonly optional: boolean }

function r4PlacesOf(attribute: string, spec: IfcxValue, steps: readonly string[] = [], optional = false): R4Place[] {
  const own = steps.length > 0 ? [{ attribute, steps, spec, optional }] : [];
  if (spec.dataType === 'Object') {
    return [...own, ...Object.entries(spec.members).flatMap(([key, member]) => r4PlacesOf(attribute, member.value, [...steps, key], member.optional === true))];
  }
  if (spec.dataType === 'Array') return [...own, ...r4PlacesOf(attribute, spec.item, [...steps, '0'], true)];
  return own;
}

const placeKey = (place: Pick<R4Place, 'attribute' | 'steps'>) => `${place.attribute}.${place.steps.join('.')}`;

function containerOf(root: unknown, steps: readonly string[]): Record<string, unknown> | undefined {
  let at = root;
  for (const step of steps.slice(0, -1)) {
    if (typeof at !== 'object' || at === null || !(step in at)) return undefined;
    at = (at as Record<string, unknown>)[step];
  }
  return typeof at === 'object' && at !== null ? at as Record<string, unknown> : undefined;
}

const FORM_SAMPLES: Readonly<Record<string, readonly unknown[]>> = {
  [FREE_TEXT_FORM.name]: ['anders', 'nog anders'],
  [NON_EMPTY_TEXT_FORM.name]: ['anders', 'nog-anders'],
  [CALENDAR_DATE_FORM.name]: ['2027-06-09', '2027-06-10'],
  [LOCAL_MOMENT_OR_EMPTY_FORM.name]: ['2027-06-09T08:00', '2027-06-10', ''],
  [ISO_DATE_OR_MOMENT_OR_EMPTY_FORM.name]: ['2027-06-09T08:00', '2027-06-10', ''],
  [VERSION_FORM.name]: ['1.0.1', '1.0.0'],
  'ISO 8601-duur P<dagen>D of PT<minuten>M, met een minteken voor een lead': ['P3D', '-PT45M'],
};

function madeValue(spec: IfcxValue, current: unknown, paths: readonly string[]): unknown {
  switch (spec.dataType) {
    case 'String': case 'DateTime': {
      const samples = FORM_SAMPLES[spec.form.name];
      assert.ok(samples, `de vorm "${spec.form.name}" heeft geen geldige proefwaarde in de eigenschapsproef`);
      return samples.find(value => value !== current);
    }
    case 'Real': {
      const next = (typeof current === 'number' ? current : 0) + 0.25;
      return spec.max !== undefined && next > spec.max ? spec.min ?? 0 : next;
    }
    case 'Integer': {
      const next = (typeof current === 'number' ? current : spec.min ?? 0) + 1;
      return spec.max !== undefined && next > spec.max ? spec.min ?? 0 : next;
    }
    case 'Boolean': return current !== true;
    case 'Enum': return spec.options.find(option => option !== current);
    case 'Reference': return paths.find(path => path !== current);
    case 'Array': return Array.isArray(current) && current.length > 0 ? current.slice(0, -1) : [madeValue(spec.item, undefined, paths)];
    case 'Object': return Object.fromEntries(Object.entries(spec.members).filter(([, member]) => !member.optional)
      .map(([key, member]) => [key, madeValue(member.value, undefined, paths)]));
  }
}

type Change = { readonly keys: readonly string[]; readonly label: string; readonly apply: (document: Document) => void };

function setAt(entry: Entry, place: R4Place, value: unknown): void {
  const holder = containerOf(entry.attributes[place.attribute], place.steps)!;
  holder[place.steps[place.steps.length - 1]] = value;
}

function removeAt(entry: Entry, place: R4Place): void {
  const holder = containerOf(entry.attributes[place.attribute], place.steps)!;
  const key = place.steps[place.steps.length - 1];
  if (Array.isArray(holder)) holder.splice(Number(key), 1); else delete holder[key];
}

const SAME_FACT: readonly (readonly [string, string, string])[] = [
  ['openaec::ops::task', 'name', 'name'], ['openaec::ops::task', 'description', 'description'], ['openaec::ops::task', 'wbsCode', 'identification'],
  ['openaec::ops::task', 'priority', 'priority'], ['openaec::ops::task', 'completion', 'completion'], ['openaec::ops::task', 'isMilestone', 'isMilestone'],
  ['openaec::ops::task', 'durationType', 'durationType'], ['openaec::ops::task', 'taskType', 'predefinedType'],
  ['openaec::ops::calendar', 'name', 'name'], ['openaec::ops::calendar', 'description', 'description'],
  ['openaec::ops::document', 'name', 'name'], ['openaec::ops::document', 'description', 'description'],
];
const SHARED_OF: Readonly<Record<string, string>> = {
  'openaec::ops::task': 'openaec::planning::activity', 'openaec::ops::calendar': 'openaec::planning::calendar', 'openaec::ops::document': 'openaec::planning::workplan',
};

function changesFor(document: Document, index: number, placesByAttribute: ReadonlyMap<string, readonly R4Place[]>): Change[] {
  const entry = document.data[index];
  const paths = document.data.map(item => item.path);
  const at = (d: Document) => d.data[index];
  const present: R4Place[] = [], absent: R4Place[] = [];
  for (const name of Object.keys(entry.attributes)) {
    for (const place of placesByAttribute.get(name) ?? []) {
      const holder = containerOf(entry.attributes[name], place.steps);
      if (!holder) continue;
      if (place.steps[place.steps.length - 1] in holder) present.push(place); else if (place.optional && !Array.isArray(holder)) absent.push(place);
    }
  }
  const valueAt = (place: R4Place) => containerOf(entry.attributes[place.attribute], place.steps)![place.steps[place.steps.length - 1]];
  const out: Change[] = [];
  for (const place of present) {
    const other = madeValue(place.spec, valueAt(place), paths);
    if (other !== undefined) out.push({ keys: [placeKey(place)], label: `${placeKey(place)} wordt ${JSON.stringify(other)}`, apply: d => setAt(at(d), place, structuredClone(other)) });
    if (place.optional) out.push({ keys: [placeKey(place)], label: `${placeKey(place)} weg`, apply: d => removeAt(at(d), place) });
    const value = valueAt(place);
    if (Array.isArray(value) && value.length > 0) {
      out.push({ keys: [placeKey(place)], label: `${placeKey(place)} met een element erbij`, apply: d => { (containerOf(at(d).attributes[place.attribute], place.steps)![place.steps[place.steps.length - 1]] as unknown[]).push(structuredClone(value[value.length - 1])); } });
    }
  }
  for (const place of absent) {
    const added = madeValue(place.spec, undefined, paths);
    out.push({ keys: [placeKey(place)], label: `${placeKey(place)} erbij als ${JSON.stringify(added)}`, apply: d => setAt(at(d), place, structuredClone(added)) });
  }
  const leaves = present.filter(place => !['Object', 'Array'].includes(place.spec.dataType) && !place.steps.includes('0'));
  const combined = (group: readonly R4Place[]): Change => {
    const values = group.map(place => madeValue(place.spec, valueAt(place), paths));
    return {
      keys: group.map(placeKey), label: `samen: ${group.map((place, i) => `${placeKey(place)} wordt ${JSON.stringify(values[i])}`).join(', ')}`,
      apply: d => group.forEach((place, i) => { if (values[i] !== undefined) setAt(at(d), place, structuredClone(values[i])); }),
    };
  };
  for (let i = 0; i + 1 < leaves.length; i += 2) out.push(combined([leaves[i], leaves[i + 1]]));
  for (let i = 0; i + 2 < leaves.length; i += 3) out.push(combined([leaves[i], leaves[i + 1], leaves[i + 2]]));
  for (const [precise, preciseField, sharedField] of SAME_FACT) {
    const shared = SHARED_OF[precise];
    if (!entry.attributes[precise] || !entry.attributes[shared]) continue;
    const place = (placesByAttribute.get(precise) ?? []).find(item => item.steps.length === 1 && item.steps[0] === preciseField)!;
    const value = madeValue(place.spec, entry.attributes[precise][preciseField], paths);
    out.push({
      keys: [placeKey(place), `${shared}.${sharedField}`], label: `${precise}.${preciseField} en ${shared}.${sharedField} samen ${JSON.stringify(value)}`,
      apply: d => { at(d).attributes[precise][preciseField] = value; at(d).attributes[shared][sharedField] = value; },
    });
  }
  for (const name of Object.keys(entry.attributes).filter(attribute => attribute.startsWith(OPS_NAMESPACE))) {
    const foreignPlace = [...placesByAttribute].filter(([other]) => other !== name && other.startsWith(OPS_NAMESPACE))
      .flatMap(([, places]) => places).find(place => place.steps.length === 1 && !(place.steps[0] in entry.attributes[name]));
    if (foreignPlace) {
      const value = madeValue(foreignPlace.spec, undefined, paths);
      out.push({ keys: [`${name}.vreemd`], label: `${name} met het veld ${foreignPlace.steps[0]} van ${foreignPlace.attribute}`, apply: d => { at(d).attributes[name][foreignPlace.steps[0]] = value; } });
    }
  }
  out.push({ keys: ['object.weg'], label: `object ${entry.path} weg`, apply: d => { d.data.splice(index, 1); } });
  out.push({ keys: ['object.erbij'], label: `een kopie van ${entry.path} erbij`, apply: d => { d.data.splice(index + 1, 0, { ...structuredClone(entry), path: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` }); } });
  const textPath = `t-${[...`pad-${index}`].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}`;
  out.push({
    keys: ['object.pad'], label: `${entry.path} op het pad ${textPath}, met de verwijzingen mee`,
    apply: d => {
      const old = d.data[index].path;
      const json = JSON.stringify(d).split(`"${old}"`).join(`"${textPath}"`).split(`urn:openaec:planner:${old}"`).join(`urn:openaec:planner:${textPath}"`);
      Object.assign(d, JSON.parse(json));
    },
  });
  return out;
}

test('R4, richting 2: elk bestand dat readIfcx aanvaardt, is wat de eigen schrijver voor de gelezen planning schrijft; elke andere mutatie weigert met object en veld', () => {
  const placesByAttribute = new Map([...OWN_ATTRIBUTE_VALUES].map(([name, spec]) => [name as string, r4PlacesOf(name, spec)]));
  const executed = new Map<string, { refused: number; accepted: number }>();
  for (const places of placesByAttribute.values()) for (const place of places) executed.set(placeKey(place), { refused: 0, accepted: 0 });
  const wrong: string[] = [];
  const tally = { geweigerd: 0, 'aanvaard en zo geschreven': 0 };
  for (const text of r4Plans().map(plan => writeIfcx(plan, CLOCK))) {
    const base = documentOf(text);
    const seen = new Map<string, number>();
    base.data.forEach((entry, index) => {
      const kind = Object.keys(entry.attributes).sort().join('+');
      const count = seen.get(kind) ?? 0;
      seen.set(kind, count + 1);
      if (count >= 3) return;
      for (const change of changesFor(base, index, placesByAttribute)) {
        const document = documentOf(text);
        change.apply(document);
        if (isDeepStrictEqual(document, base)) continue;
        const outcome = readOutcome(encode(JSON.stringify(document)));
        let verdict: 'refused' | 'accepted' | undefined;
        if (outcome instanceof IfcxReadError) {
          const named = outcome.place.path !== undefined || outcome.place.field?.startsWith('header.') === true
            || /\b(taak|kalender|kalenders|relatie|werkplan|werkplannen|werkschema|project|task|sequence|calendar)\b/i.test(outcome.message);
          const located = outcome.place.field !== undefined || outcome.place.path !== undefined;
          if (named && located) verdict = 'refused';
          else wrong.push(`${change.label} op ${entry.path}: geweigerd zonder object en veld: ${outcome.code} ${JSON.stringify(outcome.place)} ${outcome.message.slice(0, 160)}`);
        } else {
          const rewritten = documentOf(writeIfcx(outcome, new Date(String(document.header.timestamp))));
          if (isDeepStrictEqual(rewritten, document)) verdict = 'accepted';
          else wrong.push(`${change.label} op ${entry.path}: aanvaard, maar de eigen schrijver schrijft voor die planning iets anders`);
        }
        if (!verdict) continue;
        tally[verdict === 'refused' ? 'geweigerd' : 'aanvaard en zo geschreven']++;
        for (const key of change.keys) {
          const counts = executed.get(key) ?? { refused: 0, accepted: 0 };
          counts[verdict]++;
          executed.set(key, counts);
        }
      }
    });
  }
  const unexercised = [...executed].filter(([, counts]) => counts.refused + counts.accepted === 0).map(([key]) => key);
  for (const line of wrong.slice(0, 30)) console.error(`   ${line}`);
  assert.deepEqual(wrong, []);
  assert.deepEqual(unexercised, [], 'elk veld en elke vorm heeft een uitgevoerde mutatie');
  console.log(`   ${tally.geweigerd + tally['aanvaard en zo geschreven']} mutaties: ${Object.entries(tally).map(([reason, count]) => `${reason} ${count}`).join(', ')}`);
  const byAttribute = new Map<string, string[]>();
  for (const [key, counts] of executed) {
    const attribute = key.split('.')[0];
    const list = byAttribute.get(attribute) ?? [];
    list.push(`${key.slice(attribute.length + 1)} ${counts.refused}/${counts.accepted}`);
    byAttribute.set(attribute, list);
  }
  for (const [attribute, list] of byAttribute) console.log(`   ${attribute} (geweigerd/aanvaard): ${list.join(', ')}`);
});

const FIELD_TABLES: readonly [string, IfcxField<never, never>[]][] = [
  ...NODES.flatMap(node => node.attributes.filter(attribute => attribute.name.startsWith(OPS_NAMESPACE))
    .map(attribute => [attribute.name, attribute.fields as unknown as IfcxField<never, never>[]] as [string, IfcxField<never, never>[]])),
  ['openaec::ops::task.time', TASK_TIME_FIELDS as unknown as IfcxField<never, never>[]],
];

test('elk precies veld draagt iets: zonder dat veld weigert writeIfcx, in de zelfcontrole of de waardetoets (besluit 3, ronde 4 blokkade 6)', () => {
  const plans = [maximalPlan(), variantPlan(), datePlan(), ...loadPlans()];
  const written = plans.map(plan => documentOf(writeIfcx(plan, CLOCK)));
  const wrong: string[] = [];
  let count = 0;
  assert.equal(FIELD_TABLES.length, 5);
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
