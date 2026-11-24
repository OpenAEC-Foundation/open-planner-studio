import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readIFC } from '@/services/ifc/ifcReader';
import { ifcGuid128, writeIFCForComparison, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { planningCanon } from '@/services/ifc/foreign/planningCanon';
import {
  classifyIfcx, readIfcx, writeIfcx, IfcxReadError, IfcxWriteRefusedError, type IfcxReadErrorCode,
} from '@/services/ifc/ifcx';
import { ifcxSchemaProblems } from '@/services/ifc/ifcx/schemaCheck';
import { buildIfcxDocument, serializeIfcx } from '@/services/ifc/ifcx/ifcxWriter';
import { compactGlobalIdToUuid, nameBasedUuid } from '@/services/ifc/ifcx/globalIdUuid';
import { createAppStoreContext } from '@/state/appStore';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { reconstructResourceIds } from '@/services/importNormalize';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Baseline } from '@/types/baseline';

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

const FIELDS_FOR_F3_3_TASK = [
  'customTaskTypeId', 'levelingDelay', 'levelingDelayMinutes', 'levelingDelayElapsed', 'splitGaps', 'timephasedFinishFloor',
  'timephasedStartAnchor', 'timephasedDurationWalks', 'mspTaskType', 'effortDriven', 'workRule',
  'p6DurationType', 'p6ActivityType', 'p6ProjectId', 'p6TaskId', 'p6ExplicitTargetWindow', 'p6CompletePctType',
  'p6ExpectedFinish', 'p6SuspendResume', 'color', 'activityCodes', 'customFields', 'constraint', 'constraint2', 'isHammock',
  'externalLinks', 'deadline', 'notes',
];
const FIELDS_FOR_F3_3_PROJECT = [
  'progressMode', 'schedulingOptions', 'schedulingProfile', 'defaultWorkRule', 'companyId', 'companyName', 'p6ProjectCode',
  'dependentProjectsFolder', 'anchorsFromOpenDocuments',
];
const CARRIED_HERE = [
  'resources', 'assignments', 'baselines', 'activeBaselineId', 'comparedBaselineIds', 'task.resourceIds', 'task.timephasedContours',
];

function without<T extends object>(object: T, keys: readonly string[]): T {
  const copy = { ...object } as Record<string, unknown>;
  for (const key of keys) delete copy[key];
  return copy as T;
}

function withoutF3_3(full: ImportResult): ImportResult {
  return {
    ...full, activityCodeTypes: [], customFieldDefs: [], customTaskTypes: [], ifcLiteralCalendarIds: undefined, libraryPool: undefined,
    project: without(full.project, FIELDS_FOR_F3_3_PROJECT),
    tasks: full.tasks.map(task => ({ ...without(task, FIELDS_FOR_F3_3_TASK), time: without(task.time, ['progressBeforeRecalculation']) })),
    sequences: full.sequences.map(sequence => without(sequence, ['p6StartAtPredecessorFinishBoundary'])),
  };
}

const plain = (value: unknown) => JSON.parse(JSON.stringify(value ?? null)) as unknown;

function assertSameDomain(back: ImportResult, input: ImportResult): void {
  assert.deepEqual(plain(back.project), plain(input.project), 'project');
  assert.deepEqual(plain(back.calendar), plain(input.calendar), 'projectkalender');
  assert.deepEqual(plain(back.tasks), plain(input.tasks), 'taken');
  assert.deepEqual(plain(back.sequences), plain(input.sequences), 'relaties');
  assert.deepEqual(plain(back.resources), plain(input.resources), 'resources');
  assert.deepEqual(plain(back.assignments), plain(input.assignments), 'toewijzingen');
  assert.equal(JSON.stringify(back.baselines ?? []), JSON.stringify(input.baselines ?? []), 'baselines, met de volgorde van de velden');
  assert.equal(back.activeBaselineId ?? null, input.activeBaselineId ?? null, 'actieve baseline');
  assert.deepEqual(back.comparedBaselineIds ?? [null, null], input.comparedBaselineIds ?? [null, null], 'vergelijkingsbaselines');
}

type Document = {
  header: Record<string, unknown>; imports: unknown[]; schemas: Record<string, unknown>;
  data: { path: string; attributes: Record<string, Record<string, unknown>> }[];
};
const documentOf = (text: string): Document => JSON.parse(text);
const entriesWith = (document: Document, attribute: string) => document.data.filter(entry => attribute in entry.attributes);

function roundTrip(input: ImportResult): { text: string; back: ImportResult } {
  const text = writeIfcx(input, CLOCK);
  return { text, back: readIfcx(encode(text)) };
}

function assertRoundTrip(input: ImportResult): string {
  const { text, back } = roundTrip(input);
  assert.equal(planningCanon(back), planningCanon(input));
  assert.equal(writeIFCForComparison(back), writeIFCForComparison(input), 'STEP → IFCX → STEP');
  assertSameDomain(back, input);
  assert.deepEqual(ifcxSchemaProblems(JSON.parse(text)), []);
  assert.equal(writeIfcx(back, CLOCK), text, 'openen en opnieuw opslaan geeft dezelfde bytes');
  assert.equal(writeIfcx(input, CLOCK), text, 'twee keer schrijven geeft dezelfde bytes');
  assert.equal(classifyIfcx(encode(text)), 'own');
  return text;
}

function readError(text: string): IfcxReadError {
  try {
    readIfcx(encode(text));
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

test('alle acht voorbeelden hebben resources, drie hebben een baseline', () => {
  assert.equal(examples.length, 8);
  assert.ok([...fullExamples.values()].every(full => full.resources.length > 0 && full.assignments.length > 0));
  assert.deepEqual([...fullExamples].filter(([, full]) => (full.baselines ?? []).length > 0).map(([name]) => name), [
    'showcase-appartementencomplex.ifc', 'showcase-rijwoningen-de-akkers.ifc', 'showcase-verbouwing-eengezinswoning.ifc',
  ]);
});

function stepBaselineGuids(stepText: string): string[] {
  return stepText.split('\n').filter(line => line.includes('IFCWORKSCHEDULE(') && line.includes('.BASELINE.'))
    .map(line => /IFCWORKSCHEDULE\('([^']+)'/.exec(line)![1]);
}

for (const [name, full] of fullExamples) {
  test(`${name}: resources, toewijzingen en baselines gaan zonder verschil heen en terug`, () => {
    const input = withoutF3_3(full);
    assert.ok(input.resources.length > 0);
    const document = documentOf(assertRoundTrip(input));
    assert.equal(entriesWith(document, 'openaec::planning::resource').length, input.resources.length);
    assert.equal(entriesWith(document, 'openaec::planning::assignment').length, input.assignments.length);
    assert.equal(entriesWith(document, 'openaec::planning::baseline').length, (input.baselines ?? []).length);
  });

  test(`${name}: elk pad is de UUID van de GlobalId die de STEP-writer geeft`, () => {
    const input = withoutF3_3(full);
    const document = documentOf(writeIfcx(input, CLOCK));
    const stepText = writeIFCForComparison(input);
    const viaStep = readIFC(stepText);
    const resourcePaths = entriesWith(document, 'openaec::planning::resource').map(entry => entry.path);
    assert.deepEqual(resourcePaths, viaStep.resources.map(resource => compactGlobalIdToUuid(resource.id.replace(/^res-ifc-/, ''))));
    const baselinePaths = entriesWith(document, 'openaec::planning::baseline').map(entry => entry.path);
    assert.deepEqual(baselinePaths, stepBaselineGuids(stepText).map(compactGlobalIdToUuid));
  });

  test(`${name}: het volledige voorbeeld wordt nog geweigerd, alleen om wat F3-3 draagt`, () => {
    const refusal = writeRefusal(full);
    assert.equal(refusal.code, 'unsupported');
    assert.ok(refusal.fields.length > 0);
    for (const field of refusal.fields) {
      assert.ok(!CARRIED_HERE.includes(field) && !/^(resource|assignment|baseline)\./.test(field), `${field} hoort bij F3-2`);
    }
  });
}

function task(id: string, start: string, finish: string, extra: Partial<Task> = {}): Task {
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

const CURVE_21 = [0, 1.3, 2.5, 3.8, 5.1, 7.6, 10.1, 7.6, 5.1, 3.8, 2.5, 2.5, 2.5, 3.8, 5.1, 7.6, 10.1, 7.6, 5.1, 3.8, 2.5];

function fullPlan(): ImportResult {
  const base = withoutF3_3(fullExamples.get('10-villa-wassenaar.ifc')!);
  const libraryCalendar = { ...base.calendar, id: 'libcal', name: 'Nachtploeg', hoursPerDay: 7 };
  const tasks: Task[] = [
    task('t-a', '2027-06-01T07:00', '2027-06-03T16:00', { resourceIds: ['r-mem', 'r-cost'] }),
    task('t-b', '2027-06-04T07:00', '2027-06-04T16:00', { resourceIds: ['r-eq', 'r-mat', 'r-oud'] }),
    task('t-m', '2027-06-04T16:00', '2027-06-04T16:00', { isMilestone: true, milestoneKind: 'FINISH', resourceIds: ['r-cost'] }),
  ];
  tasks[0].timephasedContours = [
    { resourceUid: 7, resourceId: 'r-mem', periods: [
      { afterMinutes: 0, minutes: 480, workMinutes: 480, kind: 'actual' },
      { afterMinutes: 480, minutes: 960, workMinutes: 0, kind: 'remaining' },
    ] },
    { resourceUid: null, resourceId: 'r-verwijderd', periods: [] },
    { resourceUid: null, periods: [{ afterMinutes: 0, minutes: 60, workMinutes: 30.5, kind: 'remaining' }] },
  ];
  const sequences: Sequence[] = [
    { id: 'r1', predecessorId: 't-a', successorId: 't-b', type: 'FINISH_START', lagDays: 0 },
    { id: 'r2', predecessorId: 't-b', successorId: 't-m', type: 'FINISH_FINISH', lagDays: 0 },
  ];
  const resources: Resource[] = [
    { id: 'r-crew', name: 'Ploeg Alpha', type: 'CREW', description: 'Hoofdploeg', maxUnits: 1 },
    {
      id: 'r-mem', name: 'Timmerman Jan', type: 'LABOR', description: 'Ervaren timmerman', costPerHour: 42.5, availability: 0.9,
      maxUnits: 3, calendarId: 'libcal', availabilitySteps: [{ from: '2027-07-06', maxUnits: 3 }, { from: '2027-06-20', maxUnits: 2 }],
      unitOfMeasure: 'uur', parentId: 'r-crew', color: '#0EA5E9',
      libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-res1', poolVersion: 4, syncedHash: 'abc123' },
    },
    { id: 'r-eq', name: 'Torenkraan', type: 'EQUIPMENT', description: '', maxUnits: 2, calendarId: base.calendar.id },
    { id: 'r-mat', name: 'Beton C30', type: 'MATERIAL', description: 'Stortbeton', maxUnits: 1, unitOfMeasure: '' },
    { id: 'r-sub', name: 'Installateur BV', type: 'SUBCONTRACTOR', description: 'Onderaannemer', maxUnits: 0.5, parentId: undefined },
    { id: 'r-cost', name: 'Leges vergunning', type: 'COST', description: 'Vast bedrag', maxUnits: 1 },
  ];
  const assignments: ResourceAssignment[] = [
    {
      id: 'a1', taskId: 't-a', resourceId: 'r-mem', unitsPerDay: 2, curve: 'BELL', plannedUnitsPerDay: 1.111,
      workWindowStart: '2027-06-01', workWindowFinish: '2027-06-03T16:00', curveValues: CURVE_21,
      plannedWorkMinutes: 9600, actualWorkMinutes: 4800, remainingWorkMinutes: 7200.5, costAmount: 99,
    },
    { id: 'a2', taskId: 't-a', resourceId: 'r-mem', unitsPerDay: 1, curve: 'UNIFORM' },
    { id: 'a3', taskId: 't-b', resourceId: 'r-eq', unitsPerDay: 1, curve: undefined },
    { id: 'a4', taskId: 't-a', resourceId: 'r-cost', unitsPerDay: 1, costAmount: 1250.55 },
    { id: 'a5', taskId: 't-m', resourceId: 'r-cost', unitsPerDay: 1, costAmount: 0 },
    { id: 'a6', taskId: 't-b', resourceId: 'r-mat', unitsPerDay: 0.5, remainingWorkMinutes: 1e21, actualWorkMinutes: -5 },
  ];
  const baselines: Baseline[] = [
    {
      id: 'bl-1', name: 'Nulmeting', createdAt: '2027-05-01T09:00:00.000Z',
      tasks: [
        { taskId: 't-a', start: '2027-06-01T07:00', finish: '2027-06-03T16:00', duration: 3, isMilestone: false, milestoneKind: 'START' },
        { taskId: 't-m', start: '2027-06-04T16:00', finish: '2027-06-04T16:00', duration: 0, isMilestone: true, milestoneKind: 'FINISH' },
        { taskId: 't-weg', start: '2027-05-20', finish: '', duration: 2.5, isMilestone: false },
        { taskId: '', start: '', finish: '', duration: 0, isMilestone: false },
      ],
      projectEnd: '2027-06-04T16:00', projectDuration: 4,
    },
    {
      id: 'xer-baseline:1:2', sourceProjectId: '2', name: 'P6-baseline', createdAt: '',
      tasks: [{ taskId: 't-b', sourceTaskId: 'src-1', sourceTaskCode: 'A1000', start: '2027-06-04T07:00', finish: '2027-06-04T16:00', duration: 1, isMilestone: false }],
      projectEnd: '', projectDuration: 0,
    },
    {
      id: 'bl-3', name: 'Derde', createdAt: '2027-05-03T09:00:00.000Z',
      tasks: [
        { taskId: 't-weg', start: '2027-05-21', finish: '2027-05-22', duration: 1, isMilestone: false },
        { taskId: 't-oud', start: '2027-05-23', finish: '2027-05-24', duration: 1, isMilestone: false },
      ],
      projectEnd: '2027-05-24', projectDuration: 2,
    },
  ];
  return {
    project: { ...base.project, id: 'proj-resources', name: 'Resourcegevallen' },
    calendar: base.calendar, resourceCalendars: [libraryCalendar], tasks, sequences, resources, assignments, baselines,
    activeBaselineId: 'bl-1', comparedBaselineIds: [null, 'bl-3'],
    ifcGlobalIds: { 'task:t-weg': ifcGuid128('een andere seed'), 'task:t-oud': 'oude-guid-van-t-oud' },
  };
}

test('alle velden van resources, toewijzingen en baselines gaan zonder verschil heen en terug', () => {
  assertRoundTrip(fullPlan());
});

test('de gedeelde velden hebben de vaste vorm en openaec::ops:: draagt alleen wat afwijkt', () => {
  const plan = fullPlan();
  const document = documentOf(writeIfcx(plan, CLOCK));
  const taskPath = (id: string) => entriesWith(document, 'openaec::planning::activity')[plan.tasks.findIndex(t => t.id === id)].path;
  const resources = entriesWith(document, 'openaec::planning::resource');
  const resourcePath = (id: string) => resources[plan.resources.findIndex(r => r.id === id)].path;
  const [projectCalendar, libraryCalendar] = entriesWith(document, 'openaec::planning::calendar').map(entry => entry.path);
  const member = resources[1].attributes;
  assert.deepEqual(member['openaec::planning::resource'], {
    name: 'Timmerman Jan', description: 'Ervaren timmerman', subtype: 'IfcLaborResource', crew: resourcePath('r-crew'),
    calendar: libraryCalendar, maxUnits: 3, costPerHour: 42.5, unitOfMeasure: 'uur',
  });
  assert.deepEqual(member['openaec::ops::resource'], {
    id: 'r-mem', availability: 0.9, availabilitySteps: [{ from: '2027-07-06', maxUnits: 3 }, { from: '2027-06-20', maxUnits: 2 }],
    color: '#0EA5E9', libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-res1', poolVersion: 4, syncedHash: 'abc123' },
  });
  assert.equal(resources[2].attributes['openaec::planning::resource'].calendar, projectCalendar, 'de projectkalender als pad');
  assert.deepEqual(resources[5].attributes['openaec::planning::resource'], { name: 'Leges vergunning', description: 'Vast bedrag', subtype: 'IfcConstructionMaterialResource' });
  assert.deepEqual(resources[5].attributes['openaec::ops::resource'], { id: 'r-cost', type: 'COST' });

  const assignments = entriesWith(document, 'openaec::planning::assignment');
  assert.deepEqual(assignments[0].attributes['openaec::planning::assignment'], {
    relatingProcess: taskPath('t-a'), relatedResource: resourcePath('r-mem'), unitsPerDay: 2, plannedUnitsPerDay: 1.111,
    scheduleContour: 'BELL', scheduleWork: 'PT9600M', actualWork: 'PT4800M', remainingWork: 'PT7200.5M', costAmount: 99,
  });
  assert.deepEqual(assignments[0].attributes['openaec::ops::assignment'], {
    id: 'a1', curveValues: CURVE_21, workWindowStart: '2027-06-01', workWindowFinish: '2027-06-03T16:00',
  });
  assert.equal(assignments[2].attributes['openaec::planning::assignment'].scheduleContour, undefined);
  assert.deepEqual(assignments[5].attributes['openaec::ops::assignment'], { id: 'a6', actualWorkMinutes: -5, remainingWorkMinutes: 1e21 },
    'werk dat geen ISO-duur kan zijn, staat precies in openaec::ops::');

  const opsTask = (id: string) => entriesWith(document, 'openaec::planning::activity')[plan.tasks.findIndex(t => t.id === id)].attributes['openaec::ops::task'];
  assert.equal(opsTask('t-a').resourceIds, undefined, 'de resources van een taak volgen uit haar toewijzingen');
  assert.deepEqual(opsTask('t-b').resourceIds, ['r-eq', 'r-mat', 'r-oud'], 'een afwijkende lijst staat er letterlijk');
  assert.deepEqual(opsTask('t-a').timephasedContours, [
    { resourceUid: 7, resourceId: 'r-mem', periods: plan.tasks[0].timephasedContours![0].periods },
    { resourceId: 'r-verwijderd', periods: [] },
    { periods: plan.tasks[0].timephasedContours![2].periods },
  ]);

  const baselines = entriesWith(document, 'openaec::planning::baseline');
  const first = baselines[0].attributes;
  const orphanPath = compactGlobalIdToUuid(plan.ifcGlobalIds!['task:t-weg']);
  assert.deepEqual(first['openaec::planning::baseline'], {
    name: 'Nulmeting', creationDate: '2027-05-01T09:00:00.000Z', finish: '2027-06-04',
    tasks: [
      { task: taskPath('t-a'), start: '2027-06-01T07:00', finish: '2027-06-03T16:00', duration: 3, milestoneKind: 'START' },
      { task: taskPath('t-m'), start: '2027-06-04T16:00', finish: '2027-06-04T16:00', duration: 0, isMilestone: true, milestoneKind: 'FINISH' },
      { task: orphanPath, start: '2027-05-20', finish: '', duration: 2.5 },
      { start: '', finish: '', duration: 0 },
    ],
  });
  assert.deepEqual(first['openaec::ops::baseline'], {
    id: 'bl-1', projectEnd: '2027-06-04T16:00', projectDuration: 4, active: true, taskIds: [{ task: orphanPath, id: 't-weg' }],
  });
  assert.deepEqual(baselines[1].attributes['openaec::planning::baseline'], {
    name: 'P6-baseline',
    tasks: [{ task: taskPath('t-b'), start: '2027-06-04T07:00', finish: '2027-06-04T16:00', duration: 1, sourceTaskId: 'src-1', sourceTaskCode: 'A1000' }],
  });
  assert.deepEqual(baselines[1].attributes['openaec::ops::baseline'], { id: 'xer-baseline:1:2', sourceProjectId: '2' });
  const third = baselines[2].attributes['openaec::ops::baseline'];
  assert.equal(third.comparedSlot, 2);
  assert.deepEqual(third.taskIds, [
    { task: orphanPath, id: 't-weg' },
    { task: nameBasedUuid(plan.ifcGlobalIds!['task:t-oud']), id: 't-oud', globalId: plan.ifcGlobalIds!['task:t-oud'] },
  ]);
});

test('een verwijderde baselinetaak houdt haar id en GlobalId, ook na opnieuw opslaan', () => {
  const plan = fullPlan();
  const { text, back } = roundTrip(plan);
  assert.equal(back.ifcGlobalIds!['task:t-weg'], plan.ifcGlobalIds!['task:t-weg']);
  assert.equal(back.ifcGlobalIds!['task:t-oud'], plan.ifcGlobalIds!['task:t-oud']);
  assert.equal(writeIfcx(back, CLOCK), text);
  const fresh = { ...plan, ifcGlobalIds: {} };
  const freshBack = roundTrip(fresh).back;
  assert.equal(freshBack.ifcGlobalIds!['task:t-weg'], undefined, 'een afgeleide GlobalId komt niet in ifcGlobalIds');
  assert.equal(freshBack.baselines![0].tasks[2].taskId, 't-weg');
});

test('een baselinetaak die in STEP al verwijderd was, gaat via IFCX terug naar STEP', () => {
  const plan = fullPlan();
  const viaStep = withoutF3_3(readIFC(writeIFCForComparison(plan)));
  assert.ok(viaStep.baselines!.some(b => b.tasks.some(row => row.taskId === 't-weg')), 'STEP houdt de weesrij');
  assertRoundTrip(viaStep);
});

test('een resource krijgt bij een gedeelde bewaarde GlobalId voorrang op een bibliotheekkalender, zoals in STEP', () => {
  const plan = fullPlan();
  const shared = ifcGuid128('gedeeld');
  const input: ImportResult = { ...plan, ifcGlobalIds: { ...plan.ifcGlobalIds, 'res:r-eq': shared, 'cal:libcal': shared } };
  const document = buildIfcxDocument(input, CLOCK);
  const stepText = writeIFCForComparison(input);
  const stepGuid = (pattern: RegExp) => pattern.exec(stepText)![1];
  const equipment = stepGuid(/IFCCONSTRUCTIONEQUIPMENTRESOURCE\('([^']+)'/);
  const library = stepGuid(/IFCWORKCALENDAR\('([^']+)',#\d+,'Nachtploeg'/);
  assert.equal(equipment, shared);
  assert.notEqual(library, shared);
  const resourcePaths = document.data.filter(entry => 'openaec::planning::resource' in entry.attributes).map(entry => entry.path);
  const calendarPaths = document.data.filter(entry => 'openaec::planning::calendar' in entry.attributes).map(entry => entry.path);
  assert.equal(resourcePaths[2], compactGlobalIdToUuid(equipment));
  assert.equal(calendarPaths[1], compactGlobalIdToUuid(library));
});

function appPlan(): ImportResult {
  const { store } = createAppStoreContext();
  const S = () => store.getState();
  S().newProject();
  const ruwbouw = S().addTask({ name: 'Ruwbouw' });
  const afbouw = S().addTask({ name: 'Afbouw' });
  const oplevering = S().addTask({ name: 'Oplevering', isMilestone: true });
  S().runCPM();
  const ploeg = S().addResource({ name: 'Ploeg', type: 'CREW', description: '', maxUnits: 1 });
  const timmerman = S().addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 2, costPerHour: 45 });
  const leges = S().addResource({ name: 'Leges', type: 'COST', description: '', maxUnits: 1 });
  S().updateResource(timmerman, { parentId: ploeg });
  S().assignResource(ruwbouw, timmerman, 1.5);
  S().assignResource(afbouw, timmerman, 1, 'BELL');
  S().assignResource(oplevering, leges, 1, undefined, 2500);
  const eerste = S().saveBaseline('Eerste');
  S().saveBaseline('Tweede');
  S().toggleComparedBaseline(eerste);
  S().deleteTask(afbouw);
  const input = buildWriteIFCInput(S(), 'planOnly');
  assert.ok(input.baselines!.some(b => b.tasks.some(row => row.taskId === afbouw)), 'de baseline houdt de verwijderde taak');
  const libraryCalendars = (input.resourceCalendars ?? []).filter(calendar => calendar.id !== input.calendar.id);
  assert.deepEqual((input.resourceCalendars ?? []).filter(calendar => calendar.id === input.calendar.id), [input.calendar]);
  return { ...withoutF3_3(input), resourceCalendars: libraryCalendars };
}

test('een planning uit de app zelf, met ploeg, kosten, twee baselines en een verwijderde taak', () => {
  const input = appPlan();
  assert.ok(input.tasks.some(t => t.resourceIds.length > 0), 'de store houdt de resources per taak bij');
  const derived = input.tasks.map(t => ({ ...t, resourceIds: [] as string[] }));
  reconstructResourceIds(derived, input.assignments);
  assert.deepEqual(derived.map(t => t.resourceIds), input.tasks.map(t => t.resourceIds), 'de store leidt ze af zoals de lezer');
  const document = documentOf(assertRoundTrip(input));
  assert.ok(entriesWith(document, 'openaec::ops::task').every(entry => entry.attributes['openaec::ops::task'].resourceIds === undefined));
});

const WRITE_REFUSALS: readonly { name: string; change: (plan: ImportResult) => ImportResult; fields: string[] }[] = [
  { name: 'een toewijzing aan een taak die niet bestaat', fields: ['assignment.taskId'],
    change: p => ({ ...p, assignments: [...p.assignments, { id: 'los', taskId: 'weg', resourceId: 'r-mem', unitsPerDay: 1 }] }) },
  { name: 'een toewijzing van een resource die niet bestaat', fields: ['assignment.resourceId'],
    change: p => ({ ...p, assignments: [...p.assignments, { id: 'los', taskId: 't-a', resourceId: 'weg', unitsPerDay: 1 }] }) },
  { name: 'een ploeg die niet bestaat', fields: ['resource.parentId'],
    change: p => ({ ...p, resources: p.resources.map(r => r.id === 'r-sub' ? { ...r, parentId: 'weg' } : r) }) },
  { name: 'een resourcekalender die niet bestaat', fields: ['resource.calendarId'],
    change: p => ({ ...p, resources: p.resources.map(r => r.id === 'r-sub' ? { ...r, calendarId: 'weg' } : r) }) },
  { name: 'twee resources met hetzelfde id', fields: ['resource.id'],
    change: p => ({ ...p, resources: [...p.resources, { ...p.resources[0] }] }) },
  { name: 'twee toewijzingen met hetzelfde id', fields: ['assignment.id'],
    change: p => ({ ...p, assignments: [...p.assignments, { ...p.assignments[2] }] }) },
  { name: 'twee baselines met hetzelfde id', fields: ['baseline.id'],
    change: p => ({ ...p, baselines: [...p.baselines!, { ...p.baselines![2], name: 'Kopie' }] }) },
  { name: 'een actieve baseline die niet bestaat', fields: ['activeBaselineId'],
    change: p => ({ ...p, activeBaselineId: 'weg' }) },
  { name: 'een vergelijking met de actieve baseline', fields: ['comparedBaselineIds'],
    change: p => ({ ...p, comparedBaselineIds: ['bl-1', null] }) },
  { name: 'een vergelijking met een baseline die niet bestaat', fields: ['comparedBaselineIds'],
    change: p => ({ ...p, comparedBaselineIds: [null, 'weg'] }) },
  { name: 'een onbekend veld op een resource, toewijzing, baseline of baselinetaak',
    fields: ['assignment.extra', 'baseline.extra', 'baseline.tasks.extra', 'resource.extra'],
    change: p => ({
      ...p, resources: p.resources.map((r, i) => i === 0 ? { ...r, extra: 1 } as Resource : r),
      assignments: p.assignments.map((a, i) => i === 0 ? { ...a, extra: 1 } as ResourceAssignment : a),
      baselines: p.baselines!.map((b, i) => i === 0 ? { ...b, extra: 1, tasks: b.tasks.map((row, j) => j === 0 ? { ...row, extra: 1 } : row) } as Baseline : b),
    }) },
];

for (const refusal of WRITE_REFUSALS) {
  test(`de writer weigert ${refusal.name}`, () => {
    const error = writeRefusal(refusal.change(fullPlan()));
    assert.equal(error.code, 'unsupported', error.message);
    assert.deepEqual([...error.fields].sort(), refusal.fields);
  });
}

const goodText = writeIfcx(fullPlan(), CLOCK);
const first = (document: Document, attribute: string) => entriesWith(document, attribute)[0];
const opsOf = (document: Document, planning: string, ops: string, index = 0) => entriesWith(document, planning)[index].attributes[ops];

const READ_REFUSALS: readonly { name: string; code: IfcxReadErrorCode; change: (document: Document) => void }[] = [
  { name: 'een toewijzing die naar een resource wijst als taak', code: 'invalid', change: d => {
    first(d, 'openaec::planning::assignment').attributes['openaec::planning::assignment'].relatingProcess = first(d, 'openaec::planning::resource').path;
  } },
  { name: 'een toewijzing zonder resource', code: 'invalid', change: d => {
    delete first(d, 'openaec::planning::assignment').attributes['openaec::planning::assignment'].relatedResource;
  } },
  { name: 'een ploeg die naar een taak wijst', code: 'invalid', change: d => {
    entriesWith(d, 'openaec::planning::resource')[1].attributes['openaec::planning::resource'].crew = first(d, 'openaec::planning::activity').path;
  } },
  { name: 'een onbekend soort resource', code: 'invalid', change: d => {
    first(d, 'openaec::planning::resource').attributes['openaec::planning::resource'].subtype = 'IfcRobotResource';
  } },
  { name: 'een kostenresource die geen materiaal is', code: 'invalid', change: d => {
    entriesWith(d, 'openaec::planning::resource')[5].attributes['openaec::planning::resource'].subtype = 'IfcLaborResource';
  } },
  { name: 'een onbekend veld in openaec::planning::resource', code: 'foreign', change: d => {
    first(d, 'openaec::planning::resource').attributes['openaec::planning::resource'].vendorCost = 3;
  } },
  { name: 'een onbekend veld in openaec::ops::assignment', code: 'newer-profile', change: d => {
    opsOf(d, 'openaec::planning::assignment', 'openaec::ops::assignment').toekomst = 1;
  } },
  { name: 'een losse openaec::ops::baseline', code: 'foreign', change: d => {
    delete first(d, 'openaec::planning::baseline').attributes['openaec::planning::baseline'];
  } },
  { name: 'een baselinetaak met een pad dat geen UUID is', code: 'invalid', change: d => {
    (first(d, 'openaec::planning::baseline').attributes['openaec::planning::baseline'].tasks as Record<string, unknown>[])[0].task = 'taak-1';
  } },
  { name: 'een baselinetaak die naar een resource wijst', code: 'invalid', change: d => {
    (first(d, 'openaec::planning::baseline').attributes['openaec::planning::baseline'].tasks as Record<string, unknown>[])[0].task = first(d, 'openaec::planning::resource').path;
  } },
  { name: 'een eigen id voor een levende baselinetaak', code: 'invalid', change: d => {
    const tasks = first(d, 'openaec::planning::baseline').attributes['openaec::planning::baseline'].tasks as Record<string, unknown>[];
    (opsOf(d, 'openaec::planning::baseline', 'openaec::ops::baseline').taskIds as unknown[]).push({ task: tasks[0].task, id: 'anders' });
  } },
  { name: 'twee actieve baselines', code: 'invalid', change: d => { opsOf(d, 'openaec::planning::baseline', 'openaec::ops::baseline', 1).active = true; } },
  { name: 'twee baselines op één vergelijkingsplaats', code: 'invalid', change: d => {
    opsOf(d, 'openaec::planning::baseline', 'openaec::ops::baseline', 1).comparedSlot = 2;
  } },
  { name: 'de actieve baseline ook als vergelijking', code: 'invalid', change: d => { opsOf(d, 'openaec::planning::baseline', 'openaec::ops::baseline').comparedSlot = 1; } },
  { name: 'twee resources met hetzelfde id', code: 'invalid', change: d => {
    opsOf(d, 'openaec::planning::resource', 'openaec::ops::resource', 1).id = 'r-crew';
  } },
  { name: 'twee toewijzingen met hetzelfde id', code: 'invalid', change: d => {
    opsOf(d, 'openaec::planning::assignment', 'openaec::ops::assignment', 1).id = 'a1';
  } },
  { name: 'twee baselines met hetzelfde id', code: 'invalid', change: d => {
    opsOf(d, 'openaec::planning::baseline', 'openaec::ops::baseline', 1).id = 'bl-1';
  } },
  { name: 'een werkduur die geen ISO-duur in minuten is', code: 'invalid', change: d => {
    first(d, 'openaec::planning::assignment').attributes['openaec::planning::assignment'].scheduleWork = 'P2D';
  } },
];

for (const refusal of READ_REFUSALS) {
  test(`de lezer weigert ${refusal.name} met code ${refusal.code}`, () => {
    const document = documentOf(goodText);
    refusal.change(document);
    const error = readError(JSON.stringify(document));
    assert.equal(error.code, refusal.code, error.message);
  });
}

test('bekende grens 2225: een baseline met de velden in een andere volgorde weigert de zelfcontrole', () => {
  const plan = fullPlan();
  const [{ id, name, ...rest }, ...others] = plan.baselines!;
  const refusal = writeRefusal({ ...plan, baselines: [{ name, id, ...rest }, ...others] });
  assert.equal(refusal.code, 'self-check');
});

test('bekende grens 2226: een resource en een kalender met dezelfde bewaarde GlobalId weigert de zelfcontrole', () => {
  const plan = fullPlan();
  const shared = ifcGuid128('gedeeld');
  const refusal = writeRefusal({ ...plan, ifcGlobalIds: { ...plan.ifcGlobalIds, 'res:r-eq': shared, 'cal:libcal': shared } });
  assert.equal(refusal.code, 'self-check');
});

function withFixedAssignmentIds(plan: ImportResult): ImportResult {
  return { ...plan, assignments: plan.assignments.map((assignment, index) => ({ ...assignment, id: `asgn-${index + 1}` })) };
}

const FIXTURES: readonly { file: string; input: () => ImportResult }[] = [
  { file: 'resources-alle-velden.ifcx', input: fullPlan },
  { file: 'verbouwing-eengezinswoning-resources.ifcx', input: () => withFixedAssignmentIds(withoutF3_3(fullExamples.get('showcase-verbouwing-eengezinswoning.ifc')!)) },
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
  const base = withoutF3_3(fullExamples.get('03-kantoorgebouw-zuidas.ifc')!);
  const resources: Resource[] = Array.from({ length: 40 }, (_, i) => ({
    id: `res-${i}`, name: `Resource ${i}`, type: i % 10 === 0 ? 'CREW' : i % 7 === 0 ? 'MATERIAL' : 'LABOR', description: '',
    maxUnits: 1 + (i % 3), ...(i % 10 !== 0 ? { parentId: `res-${Math.floor(i / 10) * 10}`, costPerHour: 40 + i } : {}),
  }));
  const tasks: Task[] = [];
  const sequences: Sequence[] = [];
  const assignments: ResourceAssignment[] = [];
  let summary: Task | undefined;
  let previousLeaf: string | undefined;
  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor(i / 25) * 7 + (i % 25) % 5;
    const date = new Date(Date.UTC(2027, 0, 4 + dayOffset)).toISOString().slice(0, 10);
    if (i % 25 === 0) {
      summary = { ...task(`groep-${i}`, `${date}T07:00`, `${date}T16:00`), wbsCode: String(i / 25 + 1), name: `Groep ${i / 25 + 1}` };
      tasks.push(summary);
      previousLeaf = undefined;
      continue;
    }
    const leaf: Task = { ...task(`taak-${i}`, `${date}T07:00`, `${date}T16:00`), parentId: summary!.id, wbsCode: `${summary!.wbsCode}.${i % 25}` };
    const first = resources[1 + (i % 39)], second = resources[1 + ((i * 7) % 39)];
    assignments.push({ id: `asgn-${i}-a`, taskId: leaf.id, resourceId: first.id, unitsPerDay: 1, ...(i % 4 === 0 ? { curve: 'BELL' } : {}) });
    if (i % 2 === 0 && second.id !== first.id) assignments.push({ id: `asgn-${i}-b`, taskId: leaf.id, resourceId: second.id, unitsPerDay: 0.5 });
    tasks.push(leaf);
    summary!.childIds.push(leaf.id);
    if (previousLeaf) sequences.push({ id: `rel-${i}`, predecessorId: previousLeaf, successorId: leaf.id, type: 'FINISH_START', lagDays: 0 });
    previousLeaf = leaf.id;
  }
  reconstructResourceIds(tasks, assignments);
  const leaves = tasks.filter(t => t.parentId !== null);
  const baselines: Baseline[] = [{
    id: 'baseline-meting', name: 'Meting', createdAt: '2026-12-01T09:00:00.000Z',
    tasks: leaves.map(t => ({ taskId: t.id, start: t.time.scheduleStart, finish: t.time.scheduleFinish, duration: 1, isMilestone: false })),
    projectEnd: leaves[leaves.length - 1].time.scheduleFinish, projectDuration: 100,
  }];
  return { ...base, ifcGlobalIds: {}, tasks, sequences, resources, assignments, baselines, activeBaselineId: 'baseline-meting' };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const sizes = process.env.OPS_IFCX_MEASURE === '1' ? [1000, 5000, 10000] : [1000];
for (const size of sizes) {
  test(`meting: schrijven met zelfcontrole en teruglezen bij ${size} taken met resources, toewijzingen en een baseline`, () => {
    const plan = syntheticPlan(size);
    const rounds = size > 1000 ? 3 : 5;
    const plainWrite: number[] = [], write: number[] = [], read: number[] = [];
    let text = '';
    for (let round = 0; round < rounds; round++) {
      const t0 = performance.now();
      const unchecked = serializeIfcx(buildIfcxDocument(plan, CLOCK));
      const t1 = performance.now();
      text = writeIfcx(plan, CLOCK);
      const t2 = performance.now();
      readIfcx(encode(text));
      const t3 = performance.now();
      assert.equal(unchecked, text);
      plainWrite.push(t1 - t0);
      write.push(t2 - t1);
      read.push(t3 - t2);
    }
    console.log(`   ${size} taken, ${plan.assignments.length} toewijzingen, ${(text.length / 1024 / 1024).toFixed(1)} MiB: `
      + `schrijven zonder zelfcontrole ${median(plainWrite).toFixed(0)} ms, writeIfcx met zelfcontrole ${median(write).toFixed(0)} ms, `
      + `readIfcx ${median(read).toFixed(0)} ms (mediaan van ${rounds})`);
  });
}

console.log(`IFCX-resources: ${passed} proeven geslaagd, ${failed} fouten`);
if (failed) process.exitCode = 1;
