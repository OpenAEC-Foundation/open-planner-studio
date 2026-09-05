/**
 * "Datums zoals opgeslagen" (issue #63, XER-etappeplan laag 3, T6) — de taaktabel-/eigenschappen-
 * paneelmarkering. Corpusloos, twee lagen:
 *
 *  1. `src/state/recordedDatesSelectors.ts` (`unrecordedAxes`/`recordedTaskMark`) als pure functie,
 *     los van de store en los van de taakgrid.
 *  2. De draadverbinding in `taskColumnRegistry.ts`: de nieuwe kolom `recorded.source`
 *     (`available` alleen met `ctx.recordedMark`) en de "niet vastgelegd"-tak op de vier bestaande
 *     late-/floatkolommen (`ctx.recordedUnrecordedAxes`).
 *
 * MUTATIEBEWIJS (handmatig geverifieerd, niet in deze suite herhaald): het verwijderen van de
 * `ctx.recordedUnrecordedAxes?.(task).includes(axis)`-tak uit `recordedAxisFormat`
 * (`taskColumnRegistry.ts`) laat de assertie "onvolledige late/floatas toont 'niet vastgelegd', niet
 * de rauwe `?? 0`-terugval" hieronder ROOD gaan — de kolom toont dan weer een verzonnen `0`.
 */
import type { Task } from '@/types/task';
import type { RecordedDatesState, RecordedTime } from '@/engine/scheduler/recordedDates';
import type { TaskColumnContext } from '@/types/taskGrid';
import { recordedTaskMark, unrecordedAxes } from '@/state/recordedDatesSelectors';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { buildTaskRelationIndex } from '@/engine/taskGrid/relationIndex';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

// ── unrecordedAxes ──────────────────────────────────────────────────────────────────────────
const fullRecord: RecordedTime = {
  start: '2026-01-01', finish: '2026-01-02',
  lateStart: '2026-01-01', lateFinish: '2026-01-02', totalFloat: 0, freeFloat: 0, isCritical: true,
};
eq('volledige vastlegging: geen enkele as ontbreekt', unrecordedAxes(fullRecord), []);
eq('geen vastlegging: lege lijst (geen "alle vier ontbreken"-verwarring bij de aanroeper)',
  unrecordedAxes(undefined), []);
eq('alleen lateStart ontbreekt', unrecordedAxes({ ...fullRecord, lateStart: undefined }), ['ls']);
eq('alleen lateFinish ontbreekt', unrecordedAxes({ ...fullRecord, lateFinish: undefined }), ['lf']);
eq('alleen totalFloat ontbreekt', unrecordedAxes({ ...fullRecord, totalFloat: undefined }), ['tf']);
eq('alleen freeFloat ontbreekt', unrecordedAxes({ ...fullRecord, freeFloat: undefined }), ['ff']);
eq('alle vier optionele assen ontbreken', unrecordedAxes({
  start: '2026-01-01', finish: '2026-01-02',
}), ['ls', 'lf', 'tf', 'ff']);

// ── recordedTaskMark ────────────────────────────────────────────────────────────────────────
function taskWith(time: Partial<Task['time']>): Task {
  return {
    id: 't-1', name: 'Taak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [],
    resourceIds: [], activityCodes: {}, customFields: {}, externalLinks: [], notes: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 1,
      scheduleStart: '2026-01-01', scheduleFinish: '2026-01-02',
      earlyStart: '2026-01-01', earlyFinish: '2026-01-02',
      lateStart: '2026-01-01', lateFinish: '2026-01-02',
      freeFloat: 0, totalFloat: 0, isCritical: true, completion: 0,
      ...time,
    },
  } as Task;
}

const recordedState = (times: Record<string, RecordedTime>): RecordedDatesState => (
  { times, total: Object.keys(times).length, shifted: 0 }
);

eq('geen vastlegging (recordedDates === null) ⇒ undefined, ongeacht datesAsRecorded',
  [recordedTaskMark(null, false, taskWith({})), recordedTaskMark(null, true, taskWith({}))],
  [undefined, undefined]);

eq('taak niet in de vastlegging ⇒ undefined',
  recordedTaskMark(recordedState({ 'ander-id': fullRecord }), false, taskWith({})), undefined);

eq('buiten de modus, vroege datums identiek aan de vastlegging, volledige assen ⇒ undefined (niets te melden)',
  recordedTaskMark(
    recordedState({ 't-1': fullRecord }), false,
    taskWith({ earlyStart: fullRecord.start, earlyFinish: fullRecord.finish }),
  ), undefined);

eq('buiten de modus, vroege start wijkt af ⇒ deviates',
  recordedTaskMark(
    recordedState({ 't-1': fullRecord }), false,
    taskWith({ earlyStart: '2026-02-01', earlyFinish: fullRecord.finish }),
  ), 'deviates');

eq('buiten de modus, vroeg einde wijkt af ⇒ deviates',
  recordedTaskMark(
    recordedState({ 't-1': fullRecord }), false,
    taskWith({ earlyStart: fullRecord.start, earlyFinish: '2026-02-01' }),
  ), 'deviates');

eq('buiten de modus, identieke vroege datums maar onvolledige vastlegging ⇒ partly-unrecorded',
  recordedTaskMark(
    recordedState({ 't-1': { ...fullRecord, lateFinish: undefined } }), false,
    taskWith({ earlyStart: fullRecord.start, earlyFinish: fullRecord.finish }),
  ), 'partly-unrecorded');

eq('buiten de modus: deviates wint van partly-unrecorded wanneer beide gelden',
  recordedTaskMark(
    recordedState({ 't-1': { ...fullRecord, lateFinish: undefined } }), false,
    taskWith({ earlyStart: '2026-02-01', earlyFinish: fullRecord.finish }),
  ), 'deviates');

eq('IN de modus, volledige vastlegging ⇒ undefined ("wijkt af" is hier geen zinvol signaal)',
  recordedTaskMark(
    recordedState({ 't-1': fullRecord }), true,
    taskWith({ earlyStart: fullRecord.start, earlyFinish: fullRecord.finish }),
  ), undefined);

eq('IN de modus, ONVOLLEDIGE vastlegging ⇒ partly-unrecorded (eigenschap van het bestand, niet de weergavestand)',
  recordedTaskMark(
    recordedState({ 't-1': { ...fullRecord, totalFloat: undefined } }), true,
    taskWith({ earlyStart: fullRecord.start, earlyFinish: fullRecord.finish }),
  ), 'partly-unrecorded');

eq('IN de modus met een taak wier vroege datums (kunstmatig) toch afwijken ⇒ nooit deviates',
  recordedTaskMark(
    recordedState({ 't-1': fullRecord }), true,
    taskWith({ earlyStart: '2026-09-09', earlyFinish: fullRecord.finish }),
  ), undefined);

// ── Draadverbinding: taskColumnRegistry.ts ─────────────────────────────────────────────────
const registryInput = {
  projectId: 'project:1', activityCodeTypes: [], customFieldDefs: [], baselines: [],
};

function baseContext(overrides: Partial<TaskColumnContext> = {}): TaskColumnContext {
  const t = taskWith({});
  return {
    projectId: 'project:1',
    tasksById: new Map([[t.id, t]]),
    relationIndex: buildTaskRelationIndex([t], [], null),
    assignmentsByTaskId: new Map(),
    resourcesById: new Map(),
    baselinesById: new Map(),
    scheduleStale: false,
    ...overrides,
  };
}

const registryPlain = buildTaskColumnRegistry(registryInput);

ok('zonder ctx.recordedMark bestaat de kolom recorded.source niet in de gefilterde beschikbare set',
  !registryPlain.filter(c => c.available(baseContext())).some(c => c.id === 'recorded.source'));

const withMarkCtx = baseContext({
  recordedMark: () => 'deviates',
  recordedUnrecordedAxes: () => ['lf', 'tf'],
});
ok('mét ctx.recordedMark bestaat de kolom recorded.source wél in de gefilterde beschikbare set',
  registryPlain.filter(c => c.available(withMarkCtx)).some(c => c.id === 'recorded.source'));

const recordedSourceColumn = registryPlain.find(c => c.id === 'recorded.source')!;
ok('recorded.source-descriptor bestaat altijd in de ongefilterde registry (available bepaalt zichtbaarheid)',
  !!recordedSourceColumn);

const task = taskWith({});
eq('recorded.source toont de vertaalde badge voor "deviates"',
  recordedSourceColumn.format(recordedSourceColumn.read(task, withMarkCtx), task, {
    ...withMarkCtx, labelForText: key => ({ 'recordedDates.markDeviates': 'Wijkt af' }[key] ?? key),
  }), 'Wijkt af');
eq('recorded.source toont de vertaalde badge voor "partly-unrecorded"',
  recordedSourceColumn.format('partly-unrecorded', task, {
    ...withMarkCtx, labelForText: key => ({ 'recordedDates.markPartlyUnrecorded': 'Deels niet vastgelegd' }[key] ?? key),
  }), 'Deels niet vastgelegd');
eq('recorded.source toont een streepje zonder markering',
  recordedSourceColumn.format(undefined, task, withMarkCtx), '—');
eq('recorded.source valt terug op de Engelse sleutelnaam zonder labelForText (nooit een lege cel)',
  recordedSourceColumn.format('deviates', task, { ...withMarkCtx, labelForText: undefined }), 'deviates');

// De vier late-/floatkolommen: alleen de assen die `recordedUnrecordedAxes` noemt tonen "niet
// vastgelegd"; de rest blijft de gewone geformatteerde waarde (byte-identiek aan vóór T6).
const lateStartCol = registryPlain.find(c => c.id === 'task.time.lateStart')!;
const lateFinishCol = registryPlain.find(c => c.id === 'task.time.lateFinish')!;
const totalFloatCol = registryPlain.find(c => c.id === 'task.time.totalFloat')!;
const freeFloatCol = registryPlain.find(c => c.id === 'task.time.freeFloat')!;

const axisCtx = baseContext({
  recordedMark: () => undefined,
  recordedUnrecordedAxes: () => ['lf', 'tf'],
  labelForText: key => ({ 'recordedDates.notRecorded': 'Niet vastgelegd' }[key] ?? key),
});

eq('lateStart is NIET in de onvastgelegde-assenlijst ⇒ gewoon geformatteerd, geen "niet vastgelegd"',
  lateStartCol.format(lateStartCol.read(task, axisCtx), task, axisCtx), task.time.lateStart);
eq('lateFinish IS in de onvastgelegde-assenlijst ⇒ "niet vastgelegd" i.p.v. de rauwe (`?? rec.start`) waarde',
  lateFinishCol.format(lateFinishCol.read(task, axisCtx), task, axisCtx), 'Niet vastgelegd');
eq('totalFloat IS in de onvastgelegde-assenlijst ⇒ "niet vastgelegd" i.p.v. een verzonnen 0',
  totalFloatCol.format(totalFloatCol.read(task, axisCtx), task, axisCtx), 'Niet vastgelegd');
eq('freeFloat is NIET in de onvastgelegde-assenlijst ⇒ gewoon het getal 0, geen "niet vastgelegd"',
  freeFloatCol.format(freeFloatCol.read(task, axisCtx), task, axisCtx), '0');

// Zonder de naad (ctx.recordedUnrecordedAxes ontbreekt, zoals op elk niet-XER-document) blijft
// het gedrag van vóór T6 volledig intact — dit is de "geen regressie op bestaande documenten"-poort.
const noAxisCtx = baseContext();
eq('zonder recordedUnrecordedAxes: totalFloat toont gewoon het getal, geen "niet vastgelegd"',
  totalFloatCol.format(totalFloatCol.read(task, noAxisCtx), task, noAxisCtx), '0');
eq('zonder recordedUnrecordedAxes: lateFinish toont gewoon de datum',
  lateFinishCol.format(lateFinishCol.read(task, noAxisCtx), task, noAxisCtx), task.time.lateFinish);

if (diffs.length > 0) {
  console.error(`XX recorded-dates-mark: ${diffs.length}/${checks} checks gefaald`);
  for (const diff of diffs) console.error(`   ${diff}`);
  process.exit(1);
}
console.log(`OK recorded-dates-mark: ${checks}/${checks} checks groen`);
