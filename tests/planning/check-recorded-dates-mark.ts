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
import { recordedGridBinding, recordedTaskMark, unrecordedAxes } from '@/state/recordedDatesSelectors';
import { useAppStore } from '@/state/appStore';
import { readIFC } from '@/services/ifc/ifcReader';
import { externIfc } from '../fixtures/recordedDatesIfc';
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

// Critreview laag 3, bevinding 1: BUITEN de modus staat onze eigen, zojuist berekende late-/
// spelinguitvoer op het scherm. "Deels niet vastgelegd" gaat over wat er getoond wordt, niet over
// het bestand — dus geen markering, en (zie de bindingsectie onderaan) al helemaal geen verbergen.
eq('buiten de modus, identieke vroege datums maar onvolledige vastlegging ⇒ undefined',
  recordedTaskMark(
    recordedState({ 't-1': { ...fullRecord, lateFinish: undefined } }), false,
    taskWith({ earlyStart: fullRecord.start, earlyFinish: fullRecord.finish }),
  ), undefined);

eq('buiten de modus blijft "wijkt af" wél gelden bij een onvolledige vastlegging',
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

// ── recordedGridBinding: de POORT tussen documentstate en de taakgrid-naad ──────────────────
// Critreview laag 3, bevinding 1 (BEVESTIGD, regressie op de bestaande #63-route): de naad hing op
// `recordedDates !== null`, dus in de AANBOD-stand verving de tabel echte CPM-uitvoer door "Niet
// vastgelegd" — permanent, want in die stand wist zelfs F5 de vastlegging niet.
{
  const recorded = recordedState({ 't-1': { start: '2026-01-01', finish: '2026-01-02' } });

  const aanbod = recordedGridBinding(recorded, false);
  ok('aanbodstand: de kolom recorded.source blijft bestaan (markering náást de waarde)',
    aanbod.recordedMark !== undefined);
  // `ok(... === undefined)` en niet `eq(..., undefined)`: `JSON.stringify` van een FUNCTIE is óók
  // `undefined`, dus een eq-vergelijking hier zou een aanwezige naad niet van een afwezige kunnen
  // onderscheiden — de assertie zou vacuüm zijn (gemeten tijdens het mutatiebewijs).
  ok('aanbodstand: GEEN onvastgelegde-assennaad — de late-/floatkolommen tonen de echte berekening',
    aanbod.recordedUnrecordedAxes === undefined);

  const modus = recordedGridBinding(recorded, true);
  ok('modus: de onvastgelegde-assennaad bestaat wél', modus.recordedUnrecordedAxes !== undefined);
  eq('modus: en noemt de vier assen die het bestand niet vastlegde',
    modus.recordedUnrecordedAxes?.(taskWith({})), ['ls', 'lf', 'tf', 'ff']);

  const zonder = recordedGridBinding(null, false);
  ok('geen vastlegging: beide naden ontbreken (byte-identiek aan een document van vóór T6)',
    zonder.recordedMark === undefined && zonder.recordedUnrecordedAxes === undefined);
}

// ── Einde-tot-eind door de ECHTE store: een gewone IFC in de aanbodstand ─────────────────────
// Geen synthetische context maar de documentstate zoals `applyLoadedProject` hem achterlaat, door
// dezelfde binding en dezelfde kolomdescriptor. Dit is de case die de review miste: de bedrading
// vanuit het rasteroppervlak werd nergens getoetst.
// MUTATIEBEWIJS: zet de poort in `recordedGridBinding` terug op `recorded ? … : undefined` ⇒ de
// twee `lateStart`/`totalFloat`-asserties hieronder slaan ROOD ("Niet vastgelegd" i.p.v. de waarde).
{
  const S = () => useAppStore.getState();
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('mark')), { filePath: null, recompute: true });
  ok('voorwaarde: de gewone IFC-fixture staat in de AANBOD-stand (aanbod gevuld, modus uit)',
    S().recordedDates !== null && S().datesAsRecorded === false);

  const binding = recordedGridBinding(S().recordedDates, S().datesAsRecorded);
  const storeTask = S().tasks.find(t => t.wbsCode === '1.1')!;
  ok('voorwaarde: het bestand legde de vier optionele assen NIET vast (anders bewijst dit niets)',
    unrecordedAxes(S().recordedDates!.times[storeTask.id]).length === 4);

  const ctx = baseContext({
    tasksById: new Map(S().tasks.map(t => [t.id, t])),
    relationIndex: buildTaskRelationIndex(S().tasks, S().sequences, S().cpmResult),
    ...binding,
    labelForText: key => ({ 'recordedDates.notRecorded': 'Niet vastgelegd' }[key] ?? key),
  });
  eq('aanbodstand door de echte store: lateStart toont de BEREKENDE datum, niet "Niet vastgelegd"',
    lateStartCol.format(lateStartCol.read(storeTask, ctx), storeTask, ctx), storeTask.time.lateStart);
  eq('aanbodstand door de echte store: totalFloat toont de BEREKENDE speling, niet "Niet vastgelegd"',
    totalFloatCol.format(totalFloatCol.read(storeTask, ctx), storeTask, ctx),
    String(storeTask.time.totalFloat));

  // Tegenproef op hetzelfde document: zodra de gebruiker "Opgeslagen datums tonen" kiest, IS de
  // "niet vastgelegd"-tekst juist het eerlijke antwoord — het bestand zei daar niets.
  S().showRecordedDates();
  ok('voorwaarde: showRecordedDates zet de modus aan', S().datesAsRecorded === true);
  const modusCtx = baseContext({
    tasksById: new Map(S().tasks.map(t => [t.id, t])),
    relationIndex: buildTaskRelationIndex(S().tasks, S().sequences, S().cpmResult),
    ...recordedGridBinding(S().recordedDates, S().datesAsRecorded),
    labelForText: key => ({ 'recordedDates.notRecorded': 'Niet vastgelegd' }[key] ?? key),
  });
  const modusTask = S().tasks.find(t => t.wbsCode === '1.1')!;
  eq('IN de modus: lateStart toont wél "Niet vastgelegd" (het bestand gaf die as niet)',
    lateStartCol.format(lateStartCol.read(modusTask, modusCtx), modusTask, modusCtx), 'Niet vastgelegd');
}

if (diffs.length > 0) {
  console.error(`XX recorded-dates-mark: ${diffs.length}/${checks} checks gefaald`);
  for (const diff of diffs) console.error(`   ${diff}`);
  process.exit(1);
}
console.log(`OK recorded-dates-mark: ${checks}/${checks} checks groen`);
