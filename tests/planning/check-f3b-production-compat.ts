// F3b blijft een voorbereidende kern: productie bewaart exact het gedrag van de integratiebasis.
// De literals zijn gemeten op f044aff35088055315862f89f6518e5e80eb218f, met de zes
// reviewgevallen uit ronde 1. Ze zijn GEEN orakel voor de toekomstige aansluiting in F3c.
import './domStub';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readIFC } from '@/services/ifc/ifcReader';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { computeResourceLoad, computeHistogramReport, type DailyLoad } from '@/engine/scheduler/ResourceLoad';
import { levelResources, type LevelingOptions } from '@/engine/scheduler/ResourceLeveler';
import { solveProject } from '@/engine/scheduler/solveProject';
import { makeBands } from '@/utils/effectiveWorkTime';
import { legacyCpmOptions, opsSolveInput } from './legacySolveOptions';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';

const calendar: WorkCalendar = {
  id: 'cal', name: 'cal', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: makeBands([1, 2, 3, 4, 5], [{ start: 480, end: 960 }]),
};
const shortFriday: WorkCalendar = { ...calendar, workStartHour: 7, workEndHour: 15, workTime: {
  byWeekday: { ...makeBands([1, 2, 3, 4, 5], [{ start: 420, end: 900 }]).byWeekday, 5: [{ start: 420, end: 780 }] },
} };
const resource = { id: 'r', name: 'r', type: 'LABOR' as const, description: '', maxUnits: 1 };
let checks = 0;
const failures: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (!isDeepStrictEqual(actual, expected)) failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
}
function task(id: string, start: string, finish: string, duration = 1,
  extra: Partial<Omit<Task, 'time'>> & { time?: Partial<Task['time']> } = {}): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: ['r'], ...extra,
    time: { durationType: 'WORKTIME', durationUnit: 'hours', scheduleDuration: duration,
      durationMinutes: duration * 480, scheduleStart: start, scheduleFinish: finish,
      earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish,
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0, ...extra.time },
  };
}
function assignment(taskId: string): ResourceAssignment {
  return { id: `a-${taskId}`, taskId, resourceId: 'r', unitsPerDay: 1 };
}
function reportLoad(tasks: Task[], assignments: ResourceAssignment[], cal: WorkCalendar, resources: Resource[] = [resource], window: { from?: string; to?: string } = {}): DailyLoad {
  const report = computeHistogramReport({ tasks, assignments, resources, calendar: cal, calendars: [],
    sequences: [], cpmResult: null, bucket: 'dag', ...window });
  return Object.fromEntries(report.resources.flatMap(r => r.buckets.filter(b => b.load > 0).map(b => [b.start, b.load])));
}
function levelFixture(label: string, source: Task[], cal: WorkCalendar, expected: {
  delays: Record<string, number>; load: DailyLoad; final: [string, string, string][];
}, options: Partial<LevelingOptions> = {}): void {
  const tasks = structuredClone(source);
  const assignments = tasks.map(t => assignment(t.id));
  const input = { tasks, sequences: [], calendar: cal, calendars: [] };
  const baseline = solveProject(opsSolveInput(input));
  eq(`${label}: oorspronkelijke doorrekening`, baseline.error, undefined);
  const booked: DailyLoad = {};
  const leveled = levelResources(tasks, [], [resource], assignments, cal, [], baseline, {
    constrainToFloat: false, ...options, poolLedger: {
      horizonIso: null, poolItemOf: () => 'r', residualOn: () => 100,
      book: (_id, iso, units) => { booked[iso] = (booked[iso] ?? 0) + units; },
    },
  }, legacyCpmOptions());
  const working = tasks.map(t => ({ ...t, levelingDelay: leveled.delays[t.id], splitGaps: leveled.gaps[t.id] ?? t.splitGaps }));
  const applied = solveProject(opsSolveInput({ ...input, tasks: working }));
  eq(`${label}: doorrekening na toepassen`, applied.error, undefined);
  eq(`${label}: vertragingen`, leveled.delays, expected.delays);
  eq(`${label}: onopgelost`, leveled.unresolved, {});
  eq(`${label}: geen nieuwe splits`, leveled.gaps, {});
  eq(`${label}: boeking`, booked, expected.load);
  eq(`${label}: belasting na solvertoepassing`, computeResourceLoad([resource], assignments, working, cal, []).load.r, expected.load);
  eq(`${label}: histogramrapport`, reportLoad(working, assignments, cal), expected.load);
  eq(`${label}: toegepaste momenten`, working.map(t => [t.id, t.time.earlyStart, t.time.earlyFinish]), expected.final);
}

levelFixture('korte vrijdag: kandidaat en solvertoepassing', [
  task('fixed', '2026-06-03T14:00', '2026-06-04T15:00', 1.125, { priority: 1000 }),
  task('t', '2026-06-03T14:00', '2026-06-04T14:00', 1, { priority: 600 }),
  task('later', '2026-06-09T07:00', '2026-06-09T15:00'),
], shortFriday, {
  delays: { t: 1 }, load: { '2026-06-03': 1, '2026-06-04': 1, '2026-06-09': 1 },
  final: [['fixed', '2026-06-03T14:00', '2026-06-04T15:00'],
    ['t', '2026-06-04T14:00', '2026-06-08T08:00'], ['later', '2026-06-09T07:00', '2026-06-09T15:00']],
});
levelFixture('dagtaak met tijdstippen', [
  task('fixed', '2026-06-01T07:00', '2026-06-04T15:00', 4, { priority: 1000 }),
  task('t', '2026-06-01T07:00', '2026-06-01T15:00', 1, { time: { durationUnit: 'days', durationMinutes: undefined } }),
], shortFriday, {
  delays: { t: 4 }, load: { '2026-06-01': 1, '2026-06-02': 1, '2026-06-03': 1, '2026-06-04': 1, '2026-06-05': 1 },
  final: [['fixed', '2026-06-01T07:00', '2026-06-04T15:00'], ['t', '2026-06-05T07:00', '2026-06-05T13:00']],
});
levelFixture('blokgrens zonder capaciteitsdruk', [task('t', '2026-06-01T16:00', '2026-06-02T16:00')], calendar, {
  delays: {}, load: { '2026-06-01': 1 }, final: [['t', '2026-06-01T16:00', '2026-06-01T16:00']],
});
levelFixture('voltooide actualspanne met bewaarde split', [
  task('t', '2026-06-01T08:00', '2026-06-02T16:00', 2, { splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }],
    time: { actualStart: '2026-06-01T08:00', actualFinish: '2026-06-02T16:00', completion: 1 } }),
], calendar, { delays: {}, load: { '2026-06-01': 1, '2026-06-02': 1 },
  final: [['t', '2026-06-01T08:00', '2026-06-02T16:00']] });
// De basis boekt hier nog de nominale twee dagen. F3c moet later één gezaghebbend restvenster
// gebruiken; deze check bewaakt uitsluitend dat F3b het huidige productiegedrag niet omschakelt.
levelFixture('lopende taak met berekende spanne', [
  task('fixed', '2026-06-01T08:00', '2026-06-01T16:00', 2, {
    time: { actualStart: '2026-06-01T08:00', completion: 0.5, remainingMinutes: 480 } }),
  task('t', '2026-06-02T08:00', '2026-06-02T16:00'),
], calendar, { delays: { t: 1 }, load: { '2026-06-01': 1, '2026-06-02': 1, '2026-06-03': 1 },
  final: [['fixed', '2026-06-01T08:00', '2026-06-01T16:00'], ['t', '2026-06-03T08:00', '2026-06-03T16:00']] },
{ scopeTaskIds: ['t'] });

// Echte storehandelingen: 8 uur doorrekenen → 16 uur → inzet 0,5, zonder nieuwe F5.
const context = createAppStoreContext();
const store = context.store;
store.getState().newProject();
store.setState(s => { s.calendar = calendar; s.project.startDate = '2026-06-01'; });
const resourceId = store.getState().addResource({ name: 'r', type: 'LABOR', description: '', maxUnits: 1 });
const taskId = store.getState().addTask(task('t', '2026-06-01T08:00', '2026-06-01T16:00'));
store.getState().assignResource(taskId, resourceId, 1);
store.getState().runCPM();
eq('duurwijziging: vooraf berekend', store.getState().cpmResult?.error, undefined);
eq('duurwijziging: vooraf één dag belasting', store.getState().resourceLoadResult?.load[resourceId], { '2026-06-01': 1 });
const time = store.getState().tasks.find(t => t.id === taskId)!.time;
store.getState().updateTask(taskId, { time: { ...time, durationMinutes: 960, scheduleDuration: 2 } });
const storedAssignment = store.getState().assignments.find(a => a.taskId === taskId)!;
store.getState().updateAssignment(storedAssignment.id, { unitsPerDay: 0.5 });
const state = store.getState();
const changed = state.tasks.find(t => t.id === taskId)!;
eq('duurwijziging: planning verouderd', state.scheduleStale, true);
eq('duurwijziging: berekend einde nog maandag', changed.time.earlyFinish, '2026-06-01T16:00');
eq('duurwijziging: actuele duur 16 uur', changed.time.durationMinutes, 960);
eq('duurwijziging: belasting volgt actuele duur', state.resourceLoadResult?.load[resourceId], { '2026-06-01': 0.5, '2026-06-02': 0.5 });
// Het automatische rapportvenster volgt op de basis nog het oude earlyFinish. Met een
// expliciet venster tot dinsdag moet ook het rapport de volledige actuele duur verdelen.
eq('duurwijziging: standaard rapportvenster blijft maandag', reportLoad(state.tasks, state.assignments, state.calendar, state.resources),
  { '2026-06-01': 0.5 });
eq('duurwijziging: histogram volgt actuele duur binnen volledig venster',
  reportLoad(state.tasks, state.assignments, state.calendar, state.resources, { from: '2026-06-01', to: '2026-06-02' }),
  { '2026-06-01': 0.5, '2026-06-02': 0.5 });
const staleBooked: DailyLoad = {};
const staleLevel = levelResources(structuredClone(state.tasks), [], state.resources, state.assignments,
  state.calendar, [], state.cpmResult!, { constrainToFloat: false, poolLedger: {
    horizonIso: null, poolItemOf: () => 'r', residualOn: () => 100,
    book: (_id, iso, units) => { staleBooked[iso] = (staleBooked[iso] ?? 0) + units; },
  } }, legacyCpmOptions());
eq('duurwijziging: boeking volgt actuele duur', staleBooked, { '2026-06-01': 0.5, '2026-06-02': 0.5 });
eq('duurwijziging: geen vertraging', staleLevel.delays, {});
eq('duurwijziging: geen onopgelost conflict', staleLevel.unresolved, {});

// Hetzelfde uitzonderingscontract geldt voor kalendertijd, ook met een bewaard gat.
levelFixture('kalendertijd met bewaarde split', [task('t', '2026-06-01T08:00', '2026-06-02T08:00', 3, {
  time: { durationType: 'ELAPSEDTIME', durationMinutes: 1440 }, splitGaps: [{ afterMinutes: 120, gapMinutes: 240 }],
})], calendar, { delays: {}, load: { '2026-06-01': 1, '2026-06-02': 1 },
  final: [['t', '2026-06-01T08:00', '2026-06-02T08:00']] });

// Exacte belastingvingerafdrukken uit dezelfde basisrun, vóór en na Bereken. Dit bewaakt
// alle resources, dagen, uren en capaciteitsmeldingen van de acht meegeleverde IFC-bestanden.
// De check raadpleegt geen Git-ref en leest geen basiscode tijdens een normale test.
const exampleLoads: Record<string, readonly [string, string]> = {
  '03-kantoorgebouw-zuidas.ifc': ['d33fbb996b53968f478f57ac84c09605c7fea856feb76f89d6bf072be2743fb1', 'd33fbb996b53968f478f57ac84c09605c7fea856feb76f89d6bf072be2743fb1'],
  '05-brugvervanging-n279.ifc': ['b2883cfc921ebd7adf8fb33aee775c39e746a685d7620a7429631bbf0c393e97', 'b2883cfc921ebd7adf8fb33aee775c39e746a685d7620a7429631bbf0c393e97'],
  '08-zorgcentrum-de-linde.ifc': ['6f83e0166ef11f87211345896af693f606075ac41a1dc9fba05325d4766cd932', '6f83e0166ef11f87211345896af693f606075ac41a1dc9fba05325d4766cd932'],
  '10-villa-wassenaar.ifc': ['449147be5e5c43624639830eaa2f049e299db7eb9f49ae1732563b1128f9920f', '449147be5e5c43624639830eaa2f049e299db7eb9f49ae1732563b1128f9920f'],
  '15-datacentrum-agriport.ifc': ['298620a7dad7ba9abeda28a0624a49916cfc77ac6329e927a8782b0acc3fe571', '298620a7dad7ba9abeda28a0624a49916cfc77ac6329e927a8782b0acc3fe571'],
  'showcase-appartementencomplex.ifc': ['ee92327743eca8637c8070529f732acc77b57f8f8f2ae15880168cf21d88519c', 'ee92327743eca8637c8070529f732acc77b57f8f8f2ae15880168cf21d88519c'],
  'showcase-rijwoningen-de-akkers.ifc': ['df558399ad04fd94eccf2e490c13b3ed80e79845f8287b6817671b96302df6fa', 'e0996af3546c128ecdf4feb55574d499386797ed20d632e985ff143bbd2d4f89'],
  'showcase-verbouwing-eengezinswoning.ifc': ['371824e48d67593eb34f8fc533c5de2921e6ae2e8f4c34abe5da5b6abb2f518f', '371824e48d67593eb34f8fc533c5de2921e6ae2e8f4c34abe5da5b6abb2f518f'],
};
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
const examples = fileURLToPath(new URL('../../public/examples/', import.meta.url));
const files = readdirSync(examples).filter(f => f.endsWith('.ifc')).sort();
eq('voorbeelden: dezelfde acht bestanden', files, Object.keys(exampleLoads).sort());
for (const file of files) {
  const parsed = readIFC(readFileSync(`${examples}/${file}`, 'utf8'));
  const { tasks, assignments, resources, calendar: cal, resourceCalendars: calendars } = parsed;
  const before = computeResourceLoad(resources, assignments, tasks, cal, calendars ?? []);
  eq(`voorbeeld ${file}: vóór Bereken`, fingerprint(before), exampleLoads[file]?.[0]);
  const solved = solveProject(opsSolveInput({ tasks, sequences: parsed.sequences, calendar: cal, calendars: calendars ?? [] }));
  eq(`voorbeeld ${file}: doorrekening`, solved.error, undefined);
  const after = computeResourceLoad(resources, assignments, tasks, cal, calendars ?? []);
  eq(`voorbeeld ${file}: na Bereken`, fingerprint(after), exampleLoads[file]?.[1]);
}

for (const failure of failures) console.error(`XX ${failure}`);
console.log(`F3b productiecompatibiliteit: ${checks} controles, ${failures.length} afwijkingen`);
process.exit(failures.length ? 1 : 0);
