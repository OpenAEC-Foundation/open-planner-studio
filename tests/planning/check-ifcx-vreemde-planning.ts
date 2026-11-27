import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentDataFromImport } from '@/services/documentData';
import { readIfcx, IfcxReadError } from '@/services/ifc/ifcx';
import { readForeignIfcxPlanning } from '@/services/ifc/ifcx/foreignPlanning';
import { uuidToCompactGlobalId } from '@/services/ifc/ifcx/identityPath';
import { ifcObjectSeed } from '@/services/ifc/ifcWriter';
import { MINUTE_MODEL_TIME_MODEL } from '@/state/migrations/minuteModel';
import { shownStart, shownFinish } from '@/utils/taskDates';
import { ATTRIBUTE } from '@/services/ifc/ifcx/profile';
import { loadStore } from './ifcAppRoute';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/ifcx/planningsimport');
const fixture = (name: string) => readFileSync(join(dir, name + '.ifcx'));
const read = (name: string) => readForeignIfcxPlanning(fixture(name));

for (const name of readdirSync(dir).filter(name => name.endsWith('.ifcx'))) {
  assert.throws(() => readIfcx(readFileSync(join(dir, name))), (e: unknown) => e instanceof IfcxReadError && e.code === 'foreign', name);
}

const work = read('werkpakketten');
const { planning, paths } = work;
assert.equal(work.planningContent, 'known');
assert.deepEqual(work.origin, { id: 'urn:voorbeeld:werkpakketten', author: 'Planbureau', hasOpsDocument: false });
assert.equal(planning.timeModel, MINUTE_MODEL_TIME_MODEL);
assert.equal(planning.recordedTimesOrigin, 'ifc');
assert.equal(paths.workplan.size, 0);
assert.equal(paths.calendar.size, 0);
assert.equal(planning.calendar.id, 'cal-default');
assert.deepEqual(planning.tasks.map(task => task.name), ['Hal', 'Stellen', 'Storten'], 'het naamveld gaat voor op het label');
const [parent, first, second] = planning.tasks;
assert.equal(parent.id, '0a97d170-1e63-55c0-a9d9-504b3a29eb98');
assert.equal(planning.ifcGlobalIds?.[ifcObjectSeed('task', parent.id)], uuidToCompactGlobalId(parent.id));
assert.deepEqual(parent.childIds, [first.id, second.id]);
assert.deepEqual([first.parentId, second.parentId], [parent.id, parent.id]);
assert.equal(planning.sequences.length, 1);
const [sequence] = planning.sequences;
assert.deepEqual([sequence.predecessorId, sequence.successorId, sequence.type, sequence.lagMinutes],
  [first.id, second.id, 'FINISH_START', -30]);
assert.equal(paths.sequence.get(sequence.id), '/planning/rel-1');
assert.deepEqual([...paths.task.values()], ['/planning/work-0', '/planning/work-1', '/planning/work-2']);
const loaded = documentDataFromImport(structuredClone(planning));
assert.equal(loaded.minuteModelPending, false);
assert.equal(loaded.importPristine, true);
for (const tasks of [planning.tasks, loaded.tasks]) {
  assert.deepEqual(tasks.map(t => [shownStart(t), shownFinish(t), t.time.scheduleDuration]), [
    ['2027-03-06T00:00', '2027-03-11T00:00', 5], ['2027-03-06T00:00', '2027-03-08T00:00', 2],
    ['2027-03-08T00:00', '2027-03-11T00:00', 3],
  ]);
  for (const task of tasks) {
    assert.equal(task.manuallyScheduled, true);
    assert.equal(task.time.durationType, 'ELAPSEDTIME');
    assert.deepEqual(planning.recordedFields?.[task.id], ['scheduleStart', 'scheduleFinish']);
  }
}
assert.deepEqual(work, readForeignIfcxPlanning(fixture('werkpakketten').toString('utf8')));

const { createAppStoreContext } = await loadStore();
const { store } = createAppStoreContext();
store.getState().openAsDocument(structuredClone(planning), { name: 'Werkpakketten', ref: null });
assert.equal(store.getState().project.id, planning.project.id);
const dates = (tasks: typeof planning.tasks) => tasks.map(t => [t.id, shownStart(t), shownFinish(t)]);
assert.deepEqual(dates(store.getState().tasks), dates(planning.tasks));
store.getState().runCPM();
assert.deepEqual(dates(store.getState().tasks), dates(planning.tasks));

const facade = read('gevel');
const building = facade.planning;
const [wall, finish] = building.tasks;
const uuid = '9bd46d66-5fbe-45fd-a28a-14372a19bb00';
assert.deepEqual([wall.id, finish.id], [uuid, uuid + '-dup-2']);
assert.equal(facade.paths.task.get(wall.id), '/' + uuid);
assert.equal(facade.paths.task.get(finish.id), uuid);
assert.notEqual(building.ifcGlobalIds?.[ifcObjectSeed('task', wall.id)], building.ifcGlobalIds?.[ifcObjectSeed('task', finish.id)]);
assert.equal(building.project.name, 'Gevel');
assert.equal(facade.paths.workplan.get(building.project.id), '/werk');
assert.equal(building.calendar.name, 'Ploegweek');
assert.equal(building.calendar.shift, 'FIRST');
assert.equal(building.calendar.holidays[0].startDate, '2027-03-03');
assert.equal(facade.paths.calendar.get(building.project.calendarId), '/ploegweek');
assert.equal(facade.paths.calendar.get(wall.calendarId!), '/week');
assert.equal(building.resourceCalendars?.length, 1);
const [crew] = building.resources;
assert.equal(crew.type, 'CREW');
assert.equal(facade.paths.resource.get(crew.id), '/metselaars');
const [assignment] = building.assignments;
assert.deepEqual([assignment.taskId, assignment.resourceId, assignment.unitsPerDay], [wall.id, crew.id, 0.5]);
assert.deepEqual(wall.resourceIds, [crew.id]);
assert.equal(facade.paths.assignment.get(assignment.id), '/inzet');
const [baseline] = building.baselines!;
assert.equal(baseline.name, 'Contract');
assert.equal(baseline.projectEnd, '2027-03-05T00:00');
assert.equal(facade.baselineStarts.get(baseline.id), '2027-03-01');
assert.equal(facade.paths.baseline.get(baseline.id), '/nulmeting');
assert.deepEqual([...facade.elementLinks], [[wall.id, [{ direction: 'output', target: '/bouw/Muur-01', found: false }]]]);
assert.deepEqual(facade.leftBehind, {
  attributes: [], fields: [], workplans: ['/ander'], linkRelations: [{ relation: 'inspects', count: 1 }],
});

const extended = read('uitbreidingen');
assert.deepEqual(extended.leftBehind.attributes, [{ attribute: 'openaec::planning::weather', count: 2 }]);
assert.deepEqual(extended.leftBehind.fields, [{ attribute: ATTRIBUTE.activity, field: 'predecessor', count: 2 }]);
assert(!JSON.stringify(extended).includes('blijft-in-bron'));
assert.equal(extended.planning.tasks.length, 2);
assert.equal(extended.planning.sequences.length, 0);
assert.equal(read('oud-attribuut').planningContent, 'none');
assert.equal(read('oud-attribuut').planning.tasks.length, 0);
const source = JSON.parse(fixture('uitbreidingen').toString('utf8'));
for (const entry of source.data) delete entry.attributes[ATTRIBUTE.activity];
const unknown = readForeignIfcxPlanning(JSON.stringify(source));
assert.equal(unknown.planningContent, 'unknown-only');
assert.equal(unknown.planning.tasks.length, 0);
assert.deepEqual(unknown.leftBehind.attributes, extended.leftBehind.attributes);

const precise = read('precieze-taken');
assert.equal(precise.origin.hasOpsDocument, true);
assert.equal(precise.planning.recordedTimesOrigin, 'ifc-own');
assert.equal(precise.planning.project.id, 'project-uit-bron');
assert.equal(precise.convertedToManual, 2);
const [summary, a, b, c] = precise.planning.tasks;
assert.deepEqual(summary.childIds, [b.id, a.id, c.id]);
assert.equal(c.id, b.id + '-dup-2');
assert.equal(summary.name, 'Pakket 0');
assert(!summary.manuallyScheduled);
const preciseStore = createAppStoreContext().store;
preciseStore.getState().openAsDocument(structuredClone(precise.planning), { name: 'Precieze taken', ref: null });
for (const tasks of [precise.planning.tasks, preciseStore.getState().tasks]) {
  assert(!tasks[0].manuallyScheduled);
  assert.deepEqual(tasks.map(shownStart), Array(4).fill('2027-03-01T07:00'));
  assert.deepEqual(tasks.map(shownFinish), ['2027-03-01T16:00', '2027-03-03T00:00', '2027-03-04T00:00', '2027-03-05T00:00']);
  assert(tasks.slice(1).every(task => task.manuallyScheduled && task.time.scheduleFinish === shownFinish(task)));
}
const scheduleOnly = JSON.parse(fixture('precieze-taken').toString('utf8'));
const summaryTime = scheduleOnly.data[1].attributes[ATTRIBUTE.opsTask].time;
summaryTime.earlyStart = '';
summaryTime.earlyFinish = '';
const scheduleOnlyStore = createAppStoreContext().store;
scheduleOnlyStore.getState().openAsDocument(readForeignIfcxPlanning(JSON.stringify(scheduleOnly)).planning, { name: 'Taakvensters', ref: null });
assert.deepEqual(dates(scheduleOnlyStore.getState().tasks), dates(precise.planning.tasks));
const changed = JSON.parse(fixture('precieze-taken').toString('utf8'));
const activity = changed.data[2].attributes[ATTRIBUTE.activity];
activity.start = '2027-02-28';
activity.endExclusive = '2027-03-02';
const changedStart = readForeignIfcxPlanning(JSON.stringify(changed)).planning.tasks[1];
assert.deepEqual([shownStart(changedStart), shownFinish(changedStart), changedStart.manuallyScheduled],
  ['2027-02-28T00:00', '2027-03-01T16:00', true]);

const variants = JSON.parse(fixture('gevel').toString('utf8'));
const entry = (attribute: string) => variants.data.find((n: { attributes: Record<string, unknown> }) => attribute in n.attributes);
delete entry(ATTRIBUTE.workplan).attributes[ATTRIBUTE.workplan].calendar;
const baselineNode = entry(ATTRIBUTE.baseline);
baselineNode.attributes[ATTRIBUTE.opsBaseline] = {
  tasks: [wall, finish].map(task => ({ task: facade.paths.task.get(task.id), start: '2027-03-01T07:00', finish: '2027-03-02T16:00', duration: 2 })),
};
const absent = '/verdwenen/' + uuid;
baselineNode.attributes[ATTRIBUTE.opsBaseline].tasks.push({ task: absent, start: '', finish: '', duration: 0 });
variants.data.push({ path: '/nieuwe-laag', attributes: { [ATTRIBUTE.activity]: { name: 'Aanvulling' } } },
  { path: '/nieuwe-laag', attributes: { 'openaec::label': 'Later label' } },
  { path: '/andere-laag/' + uuid, attributes: { [ATTRIBUTE.activity]: { name: 'Vrij UUID-achtervoegsel' } } });
const more = readForeignIfcxPlanning(JSON.stringify(variants));
assert.equal(more.paths.calendar.get('cal-default'), '/week');
const baselineRows = more.planning.baselines![0].tasks;
assert.deepEqual(baselineRows.slice(0, 2).map(row => row.taskId), [wall.id, finish.id]);
assert.equal(more.paths.task.get(baselineRows[2].taskId), absent);
assert.equal(more.planning.baselineOrphanGuids?.[baselineRows[2].taskId], uuidToCompactGlobalId(baselineRows[2].taskId));
const last = more.planning.tasks.at(-1)!;
assert.notEqual(last.id, uuid);
assert.notEqual(last.id, baselineRows[2].taskId);
assert.equal(more.planning.tasks.length, 4);

const badLink = entry(ATTRIBUTE.activity).attributes['openaec::links'][0];
badLink.target = '../muur';
assert.throws(() => readForeignIfcxPlanning(JSON.stringify(variants)), (e: unknown) => e instanceof IfcxReadError &&
  e.code === 'invalid' && e.place.path === '/' + uuid && e.place.field === '[0].target');

assert.throws(() => read('ongeldig-veld'), (error: unknown) => {
  assert(error instanceof IfcxReadError);
  assert.equal(error.code, 'invalid');
  assert.deepEqual(error.place, { path: '/planning/work-0', attribute: ATTRIBUTE.activity, field: 'start' });
  return true;
});
console.log('OK vreemde IFCX-planning, laadgrens, herkomst, identiteiten, brongegevens en eigen weigeringen');
