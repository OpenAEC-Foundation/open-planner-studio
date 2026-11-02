// Kleine regressies op de echte nivelleerroute en de daaropvolgende solve.
import assert from 'node:assert/strict';
import { levelResources, LEVELER_TEST_HOOKS, type LevelingPoolLedger } from '@/engine/scheduler/ResourceLeveler';
import { solveProject } from '@/engine/scheduler/solveProject';
import { computeResourceLoad } from '@/engine/scheduler/ResourceLoad';
import { createDefaultTaskTime, writeLevelingResult } from '@/utils/taskDefaults';
import { makeBands } from '@/utils/effectiveWorkTime';
import { normalizeTaskDates } from '@/state/migrations/minuteModel';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Sequence } from '@/types/sequence';
import { neutralSolveOptions } from './neutralSolveOptions';

const calendar: WorkCalendar = {
  id: 'cal', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: makeBands([1, 2, 3, 4, 5], [{ start: 480, end: 960 }]),
};
const task = (id: string, start = '2026-06-01T08:00', duration = 1, extra: Partial<Task> = {}): Task => normalizeTaskDates({
  id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: createDefaultTaskTime(start, duration, 'days', calendar), ...extra,
}, { calendar, calendars: [] });
const res = (id: string): Resource => ({ id, name: id, type: 'LABOR', description: '', maxUnits: 1 });
const assign = (taskId: string, resourceId: string, unitsPerDay = 1): ResourceAssignment => ({
  id: `${taskId}-${resourceId}`, taskId, resourceId, unitsPerDay,
});
const sequence = (predecessorId: string, successorId: string): Sequence => ({
  id: `${predecessorId}-${successorId}`, predecessorId, successorId, type: 'FINISH_START', lagDays: 0,
});
const solve = (tasks: Task[], sequences: Sequence[] = []) => solveProject({
  tasks, sequences, calendar, calendars: [], ...neutralSolveOptions(),
});
function ledger(capacity: (iso: string) => number, poolOf: Record<string, string> = { r1: 'P', r2: 'P' }) {
  const booked = new Map<string, number>();
  const result: LevelingPoolLedger = {
    poolItemOf: id => poolOf[id] ?? null,
    residualOn: (id, iso) => Math.max(0, capacity(iso) - (booked.get(`${id}/${iso}`) ?? 0)),
    book: (id, iso, units) => booked.set(`${id}/${iso}`, (booked.get(`${id}/${iso}`) ?? 0) + units),
    horizonIso: null,
  };
  return { result, booked };
}

let failures = 0;
function check(name: string, run: () => void): void {
  try { run(); console.log(`OK ${name}`); }
  catch (error) { failures++; console.error(`XX ${name}: ${String(error)}`); }
}

check('349: gelijktijdige vraag van twee projectresources telt op hetzelfde poolitem op', () => {
  for (const allowSplits of [false, true]) {
    const tasks = [task('A')];
    const pool = ledger(() => 1);
    const result = levelResources(tasks, [], [res('r1'), res('r2')], [assign('A', 'r1'), assign('A', 'r2')],
      calendar, [], solve(tasks), { constrainToFloat: false, allowSplits, poolLedger: pool.result }, neutralSolveOptions());
    assert.deepEqual(result.unresolved.A, ['2026-06-01'], 'twee eenheden passen niet op capaciteit één');
    assert.equal(pool.booked.size, 0, 'een niet-plaatsbare taak boekt geen poolcapaciteit');
  }
  for (const [units, poolOf] of [[0.5, { r1: 'P', r2: 'P' }], [1, { r1: 'P', r2: 'Q' }]] as const) {
    const tasks = [task('A')];
    const pool = ledger(() => 1, poolOf);
    const result = levelResources(tasks, [], [res('r1'), res('r2')], [assign('A', 'r1', units), assign('A', 'r2', units)],
      calendar, [], solve(tasks), { constrainToFloat: false, poolLedger: pool.result }, neutralSolveOptions());
    assert.deepEqual(result.unresolved, {}, 'halve eenheden of aparte pools passen wel');
    assert([...pool.booked.values()].every(units => units <= 1));
  }
});

check('349: ook een onderbroken plaatsing telt de poolvraag per dag op', () => {
  const capacity = (iso: string) => ({ '2026-06-01': 2, '2026-06-02': 1, '2026-06-03': 2 }[iso] ?? 0);
  const pool = ledger(capacity);
  const tasks = [task('A', undefined, 2)];
  const result = levelResources(tasks, [], [res('r1'), res('r2')], [assign('A', 'r1'), assign('A', 'r2')],
    calendar, [], solve(tasks), { constrainToFloat: false, allowSplits: true, overrunCeilingDays: 1, poolLedger: pool.result },
    neutralSolveOptions());
  assert.deepEqual(result.unresolved, {}, 'maandag en woensdag bieden samen een passende plaatsing');
  assert(result.gaps.A?.length, 'dinsdag met slechts één vrije eenheid vereist een onderbreking');
  for (const [key, units] of pool.booked) assert(units <= capacity(key.split('/')[1]), `${key}: overboeking`);
});

check('350: een tussenstap zonder resource bewaakt de plaatsingsvolgorde tot na herberekenen', () => {
  for (const incremental of [false, true]) {
    LEVELER_TEST_HOOKS.incremental = incremental;
    try {
      const tasks = [task('A'), task('M'), task('B', undefined, 1, { priority: 1000 }),
        task('C', undefined, 1, { priority: 1000 }), task('D', '2026-06-04T08:00', 1, { priority: 400 })];
      const sequences = [sequence('A', 'M'), sequence('M', 'B')];
      const assignments = ['A', 'B', 'C', 'D'].map(id => assign(id, 'r1'));
      const pool = ledger(() => 1);
      const result = levelResources(tasks, sequences, [res('r1')], assignments, calendar, [], solve(tasks, sequences),
        { constrainToFloat: false, poolLedger: pool.result }, neutralSolveOptions());
      writeLevelingResult(tasks, result);
      const after = solve(tasks, sequences);
      assert.equal(after.error, undefined);
      assert.equal(tasks.find(t => t.id === 'B')!.time.earlyStart, '2026-06-04T08:00');
      assert.equal(tasks.find(t => t.id === 'D')!.time.earlyStart, '2026-06-05T08:00', 'D wijkt voor de werkelijk geplaatste B');
      assert.deepEqual(result.unresolved, {});
      assert([...pool.booked.values()].every(units => units <= 1));
      const histogram = computeResourceLoad([res('r1')], assignments, tasks, calendar, [], neutralSolveOptions().schedulingOptions);
      assert.deepEqual(histogram.overallocatedDays, {}, 'het echte histogram blijft na toepassen conflictvrij');
      for (const [iso, units] of Object.entries(histogram.load.r1)) {
        assert.equal(pool.booked.get(`P/${iso}`), units, `boeking en histogram komen overeen op ${iso}`);
      }
    } finally { LEVELER_TEST_HOOKS.incremental = true; }
  }
});

check('259: handmatige taken blijven vaste last en krijgen geen onwerkzame vertraging', () => {
  for (const priority of [100, 1000]) {
    const tasks = [task('Vast', undefined, 2, { manuallyScheduled: true, priority }),
      task('Vrij', undefined, 1, { priority: 900 })];
    const baseline = solve(tasks);
    const before = { ...tasks[0].time };
    const result = levelResources(tasks, [], [res('r1')], [assign('Vast', 'r1'), assign('Vrij', 'r1')],
      calendar, [], baseline, { constrainToFloat: false }, neutralSolveOptions());
    assert.equal(result.delays.Vast, undefined, 'de solver negeert vertraging op een handmatige taak');
    writeLevelingResult(tasks, result);
    solve(tasks);
    assert.equal(tasks[0].time.earlyStart, before.earlyStart);
    assert.equal(tasks[0].time.earlyFinish, before.earlyFinish);
    assert.equal(tasks[1].time.earlyStart, '2026-06-03T08:00', 'de verplaatsbare taak wijkt voor de vaste last');
    assert.deepEqual(result.unresolved, {});
  }
});

check('259: twee conflicterende handmatige taken blijven als conflict zichtbaar', () => {
  const tasks = [task('Vast1', undefined, 1, { manuallyScheduled: true }),
    task('Vast2', undefined, 1, { manuallyScheduled: true })];
  const result = levelResources(tasks, [], [res('r1')], [assign('Vast1', 'r1'), assign('Vast2', 'r1')],
    calendar, [], solve(tasks), { constrainToFloat: false }, neutralSolveOptions());
  assert.deepEqual(result.delays, {});
  assert.deepEqual(result.unresolved.Vast1, ['2026-06-01']);
  assert.deepEqual(result.unresolved.Vast2, ['2026-06-01']);
});

process.exitCode = failures > 0 ? 1 : 0;
