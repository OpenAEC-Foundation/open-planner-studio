// F3c deel 3: productie boekt op de gedeelde plaatsing (spec §3.11, §3.14). Deze check bewaakt de
// acceptatie-eisen van F3b (review #564 r1 en r2) op de echte productieroute: nivelleerder →
// `writeLevelingResult` → solver → belasting en histogram. Tot en met F3b bewaakte hij dat productie
// gelijk bleef aan de basis; die literals zijn nu vervangen door de doelwaarden (B1, B3) of, waar de
// motor van F3c deel 1 het doel nog niet haalt, vastgezet als tussenstand (B2, "F3c-motor → doel").
//  1. kandidaat = opgeslagen vertraging = toepassing in de solver (korte vrijdag, blokgrens ma 16:00);
//  2. de maat komt uit `taskCountsInWorkdays` (dagtaak onder OPS en onder P6);
//  3. WORKTIME met een verouderd einde plaatst met de actuele duur (8 u → 16 u, inzet 0,5);
//  4. een lopende taak heeft één gezaghebbende plaatsing, voor de boeking en voor het histogram;
//  5. bewaarde splits gaan niet opnieuw op actuals of kalendertijd.
// Daarnaast: de vraag per kandidaat (§3.11, regressie uit review ronde 2 punt 6) en de
// contourkoppeling over alle toewijzingen bij een resourcefilter (knownbugs 233).
// En de twee datagate-lezingen die F3c deel 3 toevoegt (verify:conventions): een handmatig geplande
// taak volgt haar eigen spanne (`manuallyScheduled` in `placementFollowsSpan`), en een opvolger leest
// de vertraging in minuten uit de werkkopie van de nivelleerder (`levelingDelayMinutes`).
import './domStub';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeTaskDates } from '@/state/migrations/minuteModel';
import { readIFC } from '@/services/ifc/ifcReader';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { computeResourceLoad, computeHistogramReport, type DailyLoad } from '@/engine/scheduler/ResourceLoad';
import { levelResources, type LevelingOptions } from '@/engine/scheduler/ResourceLeveler';
import { solveProject } from '@/engine/scheduler/solveProject';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { writeLevelingResult } from '@/utils/taskDefaults';
import { makeBands } from '@/utils/effectiveWorkTime';
import { legacyCpmOptions, opsSolveInput } from './legacySolveOptions';
import type { WorkCalendar } from '@/types/calendar';
import type { EffectiveSchedulingOptions } from '@/types/project';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';

const calendar: WorkCalendar = {
  id: 'cal', name: 'cal', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: makeBands([1, 2, 3, 4, 5], [{ start: 480, end: 960 }]),
};
// ma-do 07:00-15:00 (8 u), vr 07:00-13:00 (6 u); werktijd per dag 8 u.
const shortFriday: WorkCalendar = { ...calendar, workStartHour: 7, workEndHour: 15, workTime: {
  byWeekday: { ...makeBands([1, 2, 3, 4, 5], [{ start: 420, end: 900 }]).byWeekday, 5: [{ start: 420, end: 780 }] },
} };
const OPS = effectiveSchedulingOptions({});
const P6 = effectiveSchedulingOptions({ schedulingProfile: { baseId: 'p6', id: 'p6', name: '', overrides: {} } });
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
function reportLoad(tasks: Task[], assignments: ResourceAssignment[], cal: WorkCalendar, resources: Resource[] = [resource],
  window: { from?: string; to?: string } = {}, schedulingOptions: EffectiveSchedulingOptions = OPS): DailyLoad {
  const report = computeHistogramReport({ tasks, assignments, resources, calendar: cal, calendars: [],
    sequences: [], cpmResult: null, bucket: 'dag', schedulingOptions, ...window });
  return Object.fromEntries(report.resources.flatMap(r => r.buckets.filter(b => b.load > 0).map(b => [b.start, b.load])));
}
/** Productieroute: nivelleren met een poolgrootboek dat de boeking opschrijft, het voorstel
 *  toepassen met `writeLevelingResult` (zoals `applyLeveling`), opnieuw doorrekenen, en dan
 *  boeking, belasting en histogram naast elkaar leggen. */
function levelFixture(label: string, source: Task[], cal: WorkCalendar, expected: {
  delays: Record<string, number>; delayMinutes: Record<string, number>; load: DailyLoad; final: [string, string, string][];
}, options: Partial<LevelingOptions> = {}, profile: EffectiveSchedulingOptions = OPS, sequences: Sequence[] = []): void {
  const tasks = structuredClone(source);
  const assignments = tasks.map(t => assignment(t.id));
  const input = { tasks, sequences, calendar: cal, calendars: [], schedulingOptions: profile };
  const baseline = solveProject(input);
  eq(`${label}: oorspronkelijke doorrekening`, baseline.error, undefined);
  const booked: DailyLoad = {};
  const leveled = levelResources(tasks, sequences, [resource], assignments, cal, [], baseline, {
    constrainToFloat: false, ...options, poolLedger: {
      horizonIso: null, poolItemOf: () => 'r', residualOn: () => 100,
      book: (_id, iso, units) => { booked[iso] = (booked[iso] ?? 0) + units; },
    },
  }, { schedulingOptions: profile });
  const working = structuredClone(tasks);
  writeLevelingResult(working, leveled, options.scopeTaskIds);
  const applied = solveProject({ ...input, tasks: working });
  eq(`${label}: doorrekening na toepassen`, applied.error, undefined);
  eq(`${label}: vertragingen`, leveled.delays, expected.delays);
  eq(`${label}: vertraging in werkminuten`, leveled.delayMinutes, expected.delayMinutes);
  eq(`${label}: geschreven minuten`, Object.fromEntries(working.filter(t => t.levelingDelayMinutes !== undefined)
    .map(t => [t.id, t.levelingDelayMinutes])), expected.delayMinutes);
  eq(`${label}: onopgelost`, leveled.unresolved, {});
  eq(`${label}: geen nieuwe splits`, leveled.gaps, {});
  eq(`${label}: boeking`, booked, expected.load);
  eq(`${label}: belasting na solvertoepassing`,
    computeResourceLoad([resource], assignments, working, cal, [], profile).load.r, expected.load);
  eq(`${label}: histogramrapport`, reportLoad(working, assignments, cal, [resource], {}, profile), expected.load);
  eq(`${label}: toegepaste momenten`, working.map(t => [t.id, t.time.earlyStart, t.time.earlyFinish]), expected.final);
}

// Eis 1, korte vrijdag (B1, §3.11 + eis 1). `fixed` bezet wo 14-15 (0,125) en heel do. `t` (8 u) past
// niet op wo 14:00. Kandidaat k slaat k werkdagen over, elk met zijn eigen werkminuten: wo (480) geeft
// do 14:00, botst; wo + do (960) geeft do 14:00 + 480 = do 15:00 + vr 6 u + ma 1 u = ma 08:00. Daar past
// `t` (ma 0,875 + di 0,125). De solver telt dezelfde 960 minuten op en landt op ma 08:00: kandidaat =
// opgeslagen vertraging = toepassing. `later` (lagere prioriteit) wijkt daarna één werkdag (480).
// Gevolg van de regel: de vrije vrijdagochtend is geen kandidaat. Vóór F3c: hele dagen, vertraging 1
// zonder minuten, en een boeking die niet gelijk was aan het histogram.
levelFixture('korte vrijdag: kandidaat en solvertoepassing', [
  task('fixed', '2026-06-03T14:00', '2026-06-04T15:00', 1.125, { priority: 1000 }),
  task('t', '2026-06-03T14:00', '2026-06-04T14:00', 1, { priority: 600 }),
  task('later', '2026-06-09T07:00', '2026-06-09T15:00'),
], shortFriday, {
  delays: { t: 2, later: 1 }, delayMinutes: { t: 960, later: 480 },
  load: { '2026-06-03': 0.125, '2026-06-04': 1, '2026-06-08': 0.875, '2026-06-09': 0.125, '2026-06-10': 1 },
  final: [['fixed', '2026-06-03T14:00', '2026-06-04T15:00'],
    ['t', '2026-06-08T08:00', '2026-06-09T08:00'], ['later', '2026-06-10T07:00', '2026-06-10T15:00']],
});
// Dezelfde korte vrijdag, nu met een opvolger `s` (FS) van `t` op dezelfde resource. De PF van `s` komt
// uit de werkkopie van de nivelleerder; daar staat de vertraging van `t` óók in minuten (960), net als
// straks in de solver. Dus `t` ma 08:00 → di 08:00 en `s` vanaf di 08:00: di 0,125 + 0,875 = 1, past.
// Stond in de werkkopie alleen `levelingDelay` (2 werkdagen, `addWorkingDaysSigned`), dan las de lus
// een andere PF voor `s` dan de solver na toepassen, en liepen boeking en histogram uiteen.
levelFixture('korte vrijdag: opvolger leest de vertraging in minuten', [
  task('fixed', '2026-06-03T14:00', '2026-06-04T15:00', 1.125, { priority: 1000 }),
  task('t', '2026-06-03T14:00', '2026-06-04T14:00', 1, { priority: 600 }),
  task('s', '2026-06-04T14:00', '2026-06-08T08:00'),
], shortFriday, {
  delays: { t: 2 }, delayMinutes: { t: 960 },
  load: { '2026-06-03': 0.125, '2026-06-04': 1, '2026-06-08': 0.875, '2026-06-09': 1, '2026-06-10': 0.125 },
  final: [['fixed', '2026-06-03T14:00', '2026-06-04T15:00'],
    ['t', '2026-06-08T08:00', '2026-06-09T08:00'], ['s', '2026-06-09T08:00', '2026-06-10T08:00']],
}, {}, OPS, [{ id: 'ts', predecessorId: 't', successorId: 's', type: 'FS', lagDays: 0 }]);
// Eis 2, dagtaak onder OPS (dagenmaat): 1 werkdag is op vrijdag de hele korte dag (vr 07:00-13:00 = 1).
// Alleen de minuten zijn nieuw (B1, §3.11): ma, di, wo en do overgeslagen = 4 × 480.
levelFixture('dagtaak met tijdstippen', [
  task('fixed', '2026-06-01T07:00', '2026-06-04T15:00', 4, { priority: 1000 }),
  task('t', '2026-06-01T07:00', '2026-06-01T15:00', 1, { time: { durationUnit: 'days', durationMinutes: undefined } }),
], shortFriday, {
  delays: { t: 4 }, delayMinutes: { t: 1920 },
  load: { '2026-06-01': 1, '2026-06-02': 1, '2026-06-03': 1, '2026-06-04': 1, '2026-06-05': 1 },
  final: [['fixed', '2026-06-01T07:00', '2026-06-04T15:00'], ['t', '2026-06-05T07:00', '2026-06-05T13:00']],
});
// Eis 2, dezelfde dagtaak onder P6 (urenmaat, `workdayDurationMeasure` uit): 1 d = 480 werkminuten,
// dus vr 0,75 + ma 0,25 (B1, §3.14). De maat komt uit `taskCountsInWorkdays`, niet uit een tijdstip.
// Het solvereinde vr 13:00 is een tussenstand (B2, F3c-motor → doel ma 09:00): de motor leest de
// conventie nog niet. De belasting volgt al de urenmaat.
levelFixture('dagtaak onder de urenmaat (P6)', [
  task('fixed', '2026-06-01T07:00', '2026-06-04T15:00', 4, { priority: 1000 }),
  task('t', '2026-06-01T07:00', '2026-06-01T15:00', 1, { time: { durationUnit: 'days', durationMinutes: undefined } }),
], shortFriday, {
  delays: { t: 4 }, delayMinutes: { t: 1920 },
  load: { '2026-06-01': 1, '2026-06-02': 1, '2026-06-03': 1, '2026-06-04': 1, '2026-06-05': 0.75, '2026-06-08': 0.25 },
  final: [['fixed', '2026-06-01T07:00', '2026-06-04T15:00'], ['t', '2026-06-05T07:00', '2026-06-05T13:00']],
}, {}, P6);
// Eis 1, blokgrens ma 16:00 zonder capaciteitsdruk. De 8 werkuren liggen op dinsdag: boeking,
// belasting en histogram geven di 1 (B1, §3.11; vóór F3c ma 1). De solvermomenten ma 16:00 → ma 16:00
// zijn een tussenstand (B2, F3c-motor → doel: het einde na de 8 werkuren, di 16:00).
levelFixture('blokgrens zonder capaciteitsdruk', [task('t', '2026-06-01T16:00', '2026-06-02T16:00')], calendar, {
  delays: {}, delayMinutes: {}, load: { '2026-06-02': 1 }, final: [['t', '2026-06-01T16:00', '2026-06-01T16:00']],
});
// Eis 5: een voltooide taak volgt haar actualspanne; het bewaarde gat gaat er niet opnieuw in.
levelFixture('voltooide actualspanne met bewaarde split', [
  task('t', '2026-06-01T08:00', '2026-06-02T16:00', 2, { splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }],
    time: { actualStart: '2026-06-01T08:00', actualFinish: '2026-06-02T16:00', completion: 1 } }),
], calendar, { delays: {}, delayMinutes: {}, load: { '2026-06-01': 1, '2026-06-02': 1 },
  final: [['t', '2026-06-01T08:00', '2026-06-02T16:00']] });
// Eis 4 (B1): de lopende taak `fixed` plant de solver op ma 08:00-16:00. Boeking en histogram nemen
// diezelfde spanne (ma 1), dus `t` past op dinsdag zonder vertraging. Vóór F3c boekte de
// nivelleerder de nominale twee dagen (ma + di) en schoof `t` onnodig naar woensdag.
levelFixture('lopende taak met berekende spanne', [
  task('fixed', '2026-06-01T08:00', '2026-06-01T16:00', 2, {
    time: { actualStart: '2026-06-01T08:00', completion: 0.5, remainingMinutes: 480 } }),
  task('t', '2026-06-02T08:00', '2026-06-02T16:00'),
], calendar, { delays: {}, delayMinutes: {}, load: { '2026-06-01': 1, '2026-06-02': 1 },
  final: [['fixed', '2026-06-01T08:00', '2026-06-01T16:00'], ['t', '2026-06-02T08:00', '2026-06-02T16:00']] },
{ scopeTaskIds: ['t'] });

// Vraag per kandidaat (§3.11, review ronde 2 punt 6; regressie uit de opdracht). `blok` bezet vr
// (0,75), `last` ma 07:00-09:00 (0,25). `t` (8 u, inzet 1) wil vr 07:00. Vanaf vr: vr 0,75 + ma 0,25,
// botst op vr. Vr overslaan (360) geeft vr 13:00, een blokeinde, dus ma 07:00 (N2). Vanaf ma 07:00:
// ma 1 + bestaande 0,25 = 1,25 > 1, dus geweigerd. Met de oude vorm
// (de vraag van de eerste kandidaat verschoven: ma 0,75 + di 0,25) keurde de toets ma 1,0 goed,
// terwijl de geplaatste taak 1,25 boekt. Eerste passende kandidaat: di 07:00 (vr + ma overgeslagen,
// 360 + 480 = 840 minuten). Na toepassen zijn boeking en histogram per dag gelijk.
levelFixture('vraag per kandidaat: ma 07:00 geweigerd', [
  task('blok', '2026-06-05T07:00', '2026-06-05T13:00', 0.75, { priority: 1000 }),
  task('last', '2026-06-08T07:00', '2026-06-08T09:00', 0.25, { priority: 1000 }),
  task('t', '2026-06-05T07:00', '2026-06-08T09:00', 1, { priority: 500 }),
], shortFriday, {
  delays: { t: 2 }, delayMinutes: { t: 840 },
  load: { '2026-06-05': 0.75, '2026-06-08': 0.25, '2026-06-09': 1 },
  final: [['blok', '2026-06-05T07:00', '2026-06-05T13:00'], ['last', '2026-06-08T07:00', '2026-06-08T09:00'],
    ['t', '2026-06-09T07:00', '2026-06-09T15:00']],
});

// Knownbugs 233 in de nivelleerder: een resourcefilter mag de contourkoppeling niet veranderen. De taak
// heeft twee toewijzingen en één oude contour zonder `resourceId`. Over alle toewijzingen hoort die
// contour bij geen van beide (`matchContoursToAssignments`); het histogram toont dus 1 per resource.
// Koppelde de nivelleerder alleen de gefilterde toewijzing, dan kreeg r1 de contour (2) en botste hij.
{
  const r1 = { ...resource, id: 'r1', name: 'r1' };
  const r2 = { ...resource, id: 'r2', name: 'r2' };
  const tasks = [task('k', '2026-06-01T08:00', '2026-06-01T16:00', 1, { resourceIds: ['r1', 'r2'],
    timephasedContours: [{ resourceUid: null, periods: [{ afterMinutes: 0, minutes: 480, workMinutes: 960, kind: 'remaining' }] }] })];
  const assignments: ResourceAssignment[] = [
    { id: 'a-k1', taskId: 'k', resourceId: 'r1', unitsPerDay: 1 },
    { id: 'a-k2', taskId: 'k', resourceId: 'r2', unitsPerDay: 1 },
  ];
  const input = { tasks, sequences: [], calendar, calendars: [], schedulingOptions: OPS };
  const baseline = solveProject(input);
  const booked: Record<string, DailyLoad> = {};
  const leveled = levelResources(tasks, [], [r1, r2], assignments, calendar, [], baseline, {
    constrainToFloat: false, resourceIds: ['r1'], poolLedger: {
      horizonIso: null, poolItemOf: id => id, residualOn: () => 100,
      book: (id, iso, units) => { (booked[id] ??= {})[iso] = ((booked[id] ??= {})[iso] ?? 0) + units; },
    },
  }, { schedulingOptions: OPS });
  eq('resourcefilter + oude contour: geen vertraging', leveled.delays, {});
  eq('resourcefilter + oude contour: geen conflict', leveled.unresolved, {});
  eq('resourcefilter + oude contour: boeking r1 zonder contour', booked, { r1: { '2026-06-01': 1 } });
  eq('resourcefilter + oude contour: histogram gelijk aan de boeking',
    computeResourceLoad([r1, r2], assignments, tasks, calendar, [], OPS).load, { r1: { '2026-06-01': 1 }, r2: { '2026-06-01': 1 } });
}

// Knownbugs 143 (B3): een urentaak die midden op een dag begint, boekt op de juiste dagen. Kalender ma-vr
// 07-12 + 13-16, urentaak 24 u van wo 3 jun 11:00 tot ma 8 jun 11:00, inzet 1 ⇒ wo 0,5, do 1, vr 1,
// ma 0,5. Vóór F3c: wo 1, do 1, vr 1 en niets op maandag.
{
  const lunch: WorkCalendar = { ...calendar, workStartHour: 7, workEndHour: 16,
    workTime: makeBands([1, 2, 3, 4, 5], [{ start: 420, end: 720 }, { start: 780, end: 960 }]) };
  const t = task('t', '2026-06-03T11:00', '2026-06-08T11:00', 3);
  const want = { '2026-06-03': 0.5, '2026-06-04': 1, '2026-06-05': 1, '2026-06-08': 0.5 };
  eq('knownbugs 143: belasting', computeResourceLoad([resource], [assignment('t')], [t], lunch, [], OPS).load.r, want);
  eq('knownbugs 143: histogramrapport', reportLoad([t], [assignment('t')], lunch), want);
}

// Eis 3: echte storehandelingen: 8 uur doorrekenen → 16 uur → inzet 0,5, zonder nieuwe F5.
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
// B3 (knownbugs 234): het automatische rapportvenster eindigde op het oude earlyFinish (ma), zodat
// di 0,5 ontbrak. Het venster loopt nu ook over de belaste dagen.
eq('duurwijziging: standaard rapportvenster toont ook dinsdag', reportLoad(state.tasks, state.assignments, state.calendar, state.resources),
  { '2026-06-01': 0.5, '2026-06-02': 0.5 });
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

// Eis 5 voor kalendertijd, ook met een bewaard gat (B1, §3.11): de spanne ma 08:00 → di 08:00 bevat
// alleen de werktijd van maandag. Vóór F3c telde de dagenlijst ma..di inclusief (ma 1 + di 1).
levelFixture('kalendertijd met bewaarde split', [task('t', '2026-06-01T08:00', '2026-06-02T08:00', 3, {
  time: { durationType: 'ELAPSEDTIME', durationMinutes: 1440 }, splitGaps: [{ afterMinutes: 120, gapMinutes: 240 }],
})], calendar, { delays: {}, delayMinutes: {}, load: { '2026-06-01': 1 },
  final: [['t', '2026-06-01T08:00', '2026-06-02T08:00']] });

// Handmatig gepland (`placementFollowsSpan`): de solver houdt de eigen start en het eigen einde aan,
// los van de duur (`CPMSolver`, tak "Handmatig gepland"). De balk loopt ma 08:00 → wo 16:00; boeking,
// belasting en histogram volgen die spanne: elke werkdag inzet × deel (ma, di, wo 1). Liep de
// plaatsing de duur van 8 u af vanaf de start, dan kwam alleen maandag in beeld (mutatiebewijs).
levelFixture('handmatig gepland volgt de eigen spanne', [task('t', '2026-06-01T08:00', '2026-06-03T16:00', 1, {
  manuallyScheduled: true,
})], calendar, { delays: {}, delayMinutes: {}, load: { '2026-06-01': 1, '2026-06-02': 1, '2026-06-03': 1 },
  final: [['t', '2026-06-01T08:00', '2026-06-03T16:00']] });

// Exacte belastingvingerafdrukken van de acht meegeleverde IFC-bestanden, vóór en na Bereken: alle
// resources, dagen, uren en capaciteitsmeldingen. De check raadpleegt geen Git-ref en leest geen
// basiscode tijdens een normale test. Gemeten op F3c deel 3 (basis 295ef76d1 + F2 3c2ca60fe); per dag
// verklaard tegen dezelfde stand zonder F3c deel 3:
//  - 05 (na): "Drive sheet piling" (10 d) start wo 08:36 ⇒ wo 0,8 en 0,2 op een elfde dag;
//  - 08 (na): "Ground floor load-bearing structure" (12 d) start ma 14:24 ⇒ ma 0,2 en 0,8 op vr 2 apr;
//  - 10 (na): "Ground floor masonry" (12 d) start di 08:36 ⇒ di 0,8 en 0,6 (= 3 × 0,2) op een extra dag;
//    B2 (F3c-motor → doel): de belasting volgt de dagenloper vanaf een start midden op de dag (§3.14);
//    de motor zet het einde en daarmee de start van de opvolgers nog op hele dagen;
//  - rijwoningen (vóór en na): voltooide taken waarvan de actualspanne afwijkt van `scheduleDuration`
//    (bijv. "Ground floor masonry — House 1": 6 d, spanne 7 werkdagen; "Pour foundation beams": 5 d,
//    spanne 2 werkdagen, FRONT_LOADED). De basis liet dagen buiten de dagslots weg; nu krijgt elke
//    werkdag van de gezaghebbende spanne inzet × deel, in de vorm van de curve. B1 (§3.11, eis 4/5).
//    Na Bereken ook "Painting — House 1" (4 d, BACK_LOADED, start 08:36): B2 zoals hierboven.
//    Data (scripts/showcases.ts, RUWBOUW_PROGRESS): het metselwerk van woning 2 en 3 start één dag
//    later (04-16 en 04-26), zoals woning 4 al deed. Op de oude data stond de metselploeg op 04-15 en
//    04-23 twee keer geboekt op VOLTOOID werk (verify:examples rood). Per dag t.o.v. de oude data:
//    "Masonry crew" 04-15 en 04-23 2 → 1 (geen overbelasting meer), "Bricklayers" 04-15 4 → 2 en
//    04-23 6 → 4; vóór en na Bereken gelijk. Geen andere resource of dag verandert.
const exampleLoads: Record<string, readonly [string, string]> = {
  '03-kantoorgebouw-zuidas.ifc': ['d33fbb996b53968f478f57ac84c09605c7fea856feb76f89d6bf072be2743fb1', 'd33fbb996b53968f478f57ac84c09605c7fea856feb76f89d6bf072be2743fb1'],
  '05-brugvervanging-n279.ifc': ['b2883cfc921ebd7adf8fb33aee775c39e746a685d7620a7429631bbf0c393e97', '1905b396cb2d82587c141bef37ffd91718ab4c798f7192021f3de663c6da871a'],
  // B7: alleen de exacte procentlag wijzigt dit berekende voorbeeld; de oude afronding herstelt de oude hash.
  '08-zorgcentrum-de-linde.ifc': ['6f83e0166ef11f87211345896af693f606075ac41a1dc9fba05325d4766cd932', '86ecb1461c5fae82f1af179f8b7e70b4689225fb08289386efb4378c34e9dd10'],
  '10-villa-wassenaar.ifc': ['449147be5e5c43624639830eaa2f049e299db7eb9f49ae1732563b1128f9920f', 'd07a2bdcec17bc0963147a2309cf4ddaa157f605252eb0307b4b03648f06cb52'],
  '15-datacentrum-agriport.ifc': ['298620a7dad7ba9abeda28a0624a49916cfc77ac6329e927a8782b0acc3fe571', '298620a7dad7ba9abeda28a0624a49916cfc77ac6329e927a8782b0acc3fe571'],
  'showcase-appartementencomplex.ifc': ['ee92327743eca8637c8070529f732acc77b57f8f8f2ae15880168cf21d88519c', 'ee92327743eca8637c8070529f732acc77b57f8f8f2ae15880168cf21d88519c'],
  'showcase-rijwoningen-de-akkers.ifc': ['2ed597066a34b234b509ddb1435e9a655685dc46a17488312b4ac3ff8b59753a', 'f541c279e83e7d2892976f212bbd99737847af3bedc6d32c1e44e9058b6c7871'],
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
  // D1/D2: de productieroute normaliseert de bron vóór de solvergrens.
  const normalized = tasks.map(t => normalizeTaskDates(t, { calendar: cal, calendars: calendars ?? [] }));
  const solved = solveProject(opsSolveInput({ tasks: normalized, sequences: parsed.sequences, calendar: cal, calendars: calendars ?? [] }));
  eq(`voorbeeld ${file}: doorrekening`, solved.error, undefined);
  const after = computeResourceLoad(resources, assignments, normalized, cal, calendars ?? []);
  eq(`voorbeeld ${file}: na Bereken`, fingerprint(after), exampleLoads[file]?.[1]);
}

for (const failure of failures) console.error(`XX ${failure}`);
console.log(`F3c productieroute belasting: ${checks} controles, ${failures.length} afwijkingen`);
process.exit(failures.length ? 1 : 0);
