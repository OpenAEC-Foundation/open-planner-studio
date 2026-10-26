// De herbruikbare PF-pass moet per wijziging dezelfde starts geven als een verse forward-pass.
// Inclusief teruggenomen delays/gaten, samenvallende wijzigingen, late takken vóór vroege takken,
// voortgangsvensters en alle profielen. De kostentoets telt kalenderwerk i.p.v. wandkloktijd.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { levelResources, LEVELER_TEST_HOOKS, type LevelingPoolLedger } from '@/engine/scheduler/ResourceLeveler';
import { applyCpmResult } from '@/engine/scheduler/applyCpmResult';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource } from '@/types/resource';
import type { BuiltInProfileId } from '@/types/project';

let checks = 0;
const failures: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}
const calendar: WorkCalendar = {
  id: 'cal', name: 'dag', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const band = [{ start: 480, end: 960 }];
const hour: WorkCalendar = { ...calendar, workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } } };
function task(i: number, hours = false): Task {
  return {
    id: `t${i}`, name: `t${i}`, description: '', wbsCode: String(i), taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: { ...createDefaultTaskTime('2026-06-01', hours ? 16 : 2, hours ? 'hours' : 'days'), scheduleDuration: 2 },
  };
}
function relation(from: number, to: number, type: Sequence['type'] = 'FINISH_START', lagDays = 0): Sequence {
  return { id: `s${from}-${to}`, predecessorId: `t${from}`, successorId: `t${to}`, type, lagDays };
}
for (const baseId of ['ops', 'msproject', 'p6'] as const satisfies readonly BuiltInProfileId[]) {
  for (const hours of [false, true]) {
    const cal = hours ? hour : calendar;
    const tasks = Array.from({ length: 9 }, (_, i) => task(i, hours));
    // Twee takken met een samenkomst, plus een dubbele relatie en een geïsoleerde taak.
    const sequences = [relation(0, 1), relation(1, 2, 'START_START', -1), relation(2, 3),
      relation(0, 4), relation(4, 5, 'FINISH_FINISH', 1), relation(5, 6, 'START_FINISH'),
      relation(3, 7), relation(6, 7), { ...relation(3, 7), id: 'dubbel' }];
    tasks[2].time.actualStart = '2026-06-01';
    tasks[2].time.actualFinish = '2026-06-02';
    tasks[2].time.completion = 1;
    tasks[5].time.actualStart = '2026-06-01';
    tasks[5].time.completion = 0.5;
    const options = solveOptionsFor({ endDate: '', startDate: '2026-06-01', statusDate: '2026-06-03',
      schedulingProfile: { baseId, id: baseId, name: '', overrides: {
        p6CompletedDataDateWindow: true, p6CompletedOutOfSequenceWindow: true,
      } } });
    const forward = new CPMSolver(tasks, sequences, cal, [cal], options).createLevelingForwardPass();
    if (!forward) throw new Error('geldige DAG afgewezen');
    const verify = (label: string) => {
      const expected = new CPMSolver(tasks, sequences, cal, [cal], options).solveEarlyStarts();
      // Bewust niet topologisch opvragen: ook een uitgestelde vroege tak moet later vers zijn.
      for (const i of [8, 6, 1, 7, 0, 5, 2, 4, 3]) {
        eq(`${baseId}/${hours}/${label}/t${i}`, forward.earlyStart(`t${i}`), expected?.get(`t${i}`));
      }
    };
    verify('basis');
    for (const i of [0, 4, 1, 4, 8]) {
      tasks[i].levelingDelay = (tasks[i].levelingDelay ?? 0) + 3;
      forward.markChanged(`t${i}`);
    }
    verify('gebundelde delays');
    tasks[4].splitGaps = [{ afterMinutes: 480, gapMinutes: 960, source: 'leveling' }];
    forward.markChanged('t4');
    verify('gat');
    tasks[0].levelingDelay = undefined;
    tasks[4].levelingDelay = undefined;
    tasks[4].splitGaps = undefined;
    forward.markChanged('t0');
    forward.markChanged('t4');
    forward.markChanged('t4');
    forward.markChanged('onbekend');
    verify('teruggenomen');
    eq('onbekende taak', forward.earlyStart('onbekend'), undefined);
    tasks[0].constraint = { type: 'ALAP' };
    eq('ALAP blijft volledige solve', new CPMSolver(tasks, sequences, cal, [cal], options).createLevelingForwardPass(), null);
    tasks[0].constraint = undefined;
    tasks[0].isHammock = true;
    eq('hammock blijft volledige solve', new CPMSolver(tasks, sequences, cal, [cal], options).createLevelingForwardPass(), null);
  }
}
// Review P2: een voltooidvenster uit de resultaatpass is geen rauwe forward-start. Zonder
// actualFinish blijft deze taak actief, zodat zowel het voorstel als de poolboeking die start nodig
// hebben. De prefix dwingt óók een gewijzigde PF vóór die taak af (na de luie sessie-initialisatie).
for (const prefix of [false, true]) {
  for (const actualStart of ['2026-06-01T08:00', undefined]) {
    const a = task(0, true), b = task(1, true);
    a.id = 'a'; a.priority = 900;
    b.id = 'b'; b.priority = 100;
    for (const t of [a, b]) t.time = { ...createDefaultTaskTime('2026-06-01T08:00', 16, 'hours', hour), scheduleDuration: 2 };
    Object.assign(a, { p6ProjectId: 'p', p6TaskId: 'a', p6ExplicitTargetWindow: true,
      p6CompletePctType: 'CP_Drtn', p6DurationType: 'DT_FixedDUR2', p6ActivityType: 'TT_Task' });
    a.time.completion = 1;
    a.time.actualStart = actualStart;
    const tasks = [a, b];
    if (prefix) {
      const pinned = task(2, true), delayed = task(3, true);
      pinned.priority = 1000;
      delayed.priority = 950;
      tasks.unshift(pinned, delayed);
    }
    const options = solveOptionsFor({ startDate: '2026-06-01', endDate: '', statusDate: '2026-06-10T08:00',
      schedulingProfile: { baseId: 'p6', id: 'p6', name: '', overrides: {
        p6CompletedDataDateWindow: true, p6CompletedOutOfSequenceWindow: true,
      } } });
    const resource: Resource = { id: 'r', name: 'r', type: 'LABOR', description: '', maxUnits: 1 };
    const assignments = tasks.map(t => ({ id: `a-${t.id}`, taskId: t.id, resourceId: 'r', unitsPerDay: 1 }));
    const cpm = new CPMSolver(tasks, [], hour, [hour], options).solve();
    applyCpmResult(tasks, cpm, { projectCalendar: hour, calendars: [hour] });
    const run = (incremental: boolean) => {
      const bookings: Array<[string, string, number]> = [];
      const ledger: LevelingPoolLedger = { poolItemOf: () => 'pool', residualOn: () => 100,
        horizonIso: null, book: (pool, iso, units) => { bookings.push([pool, iso, units]); } };
      LEVELER_TEST_HOOKS.incremental = incremental;
      try {
        const result = levelResources(structuredClone(tasks), [], [resource], assignments,
          hour, [hour], cpm, { constrainToFloat: false, poolLedger: ledger }, options);
        return { result, bookings };
      } finally { LEVELER_TEST_HOOKS.incremental = true; }
    };
    const reference = run(false), fast = run(true);
    eq(`P2 voorstel prefix=${prefix}/actualStart=${actualStart}`, fast.result, reference.result);
    eq(`P2 poolboekingen prefix=${prefix}/actualStart=${actualStart}`, fast.bookings, reference.bookings);
    if (!prefix) {
      eq('P2 verwachte vertraging', fast.result.delays, { b: 2 });
      eq('P2 eerste boeking op statusdatum', fast.bookings[0], ['pool', '2026-06-10', 1]);
    }
    eq('voltooid zonder einde vereist volledige solve',
      new CPMSolver(tasks, [], hour, [hour], options).createLevelingForwardPass(), null);
  }
}
function calendarWork(n: number): number {
  const tasks = Array.from({ length: n }, (_, i) => task(i));
  const sequences = tasks.slice(1).map((_, i) => relation(i, i + 1));
  const options = solveOptionsFor({ endDate: '', startDate: '2026-06-01' });
  // F3 (alleen uren §3.14): een dagtaak loopt in het OPS-profiel met de dagenmaat-loper
  // (`addMeasuredWorkdaysChecked`); tel beide lopers, zodat de kostentoets kalenderwerk blijft meten.
  const original = CalendarEngine.prototype.addWorkDaysChecked;
  const originalMeasured = CalendarEngine.prototype.addMeasuredWorkdaysChecked;
  let calls = 0;
  CalendarEngine.prototype.addWorkDaysChecked = function (...args) { calls++; return original.apply(this, args); };
  CalendarEngine.prototype.addMeasuredWorkdaysChecked = function (...args) { calls++; return originalMeasured.apply(this, args); };
  try {
    const forward = new CPMSolver(tasks, sequences, calendar, [calendar], options).createLevelingForwardPass();
    if (!forward) throw new Error('keten afgewezen');
    for (let i = 0; i < n - 1; i++) {
      tasks[i].levelingDelay = 1;
      forward.markChanged(tasks[i].id);
      forward.earlyStart(tasks[i + 1].id);
    }
    return calls;
  } finally {
    CalendarEngine.prototype.addWorkDaysChecked = original;
    CalendarEngine.prototype.addMeasuredWorkdaysChecked = originalMeasured;
  }
}
const small = calendarWork(100), large = calendarWork(200);
checks++;
if (small === 0 || large > small * 2.1) failures.push(`kalenderwerk groeit sterker dan lineair: ${small} -> ${large}`);
console.log(`${failures.length ? 'XX' : 'OK'}  leveler-forward: ${checks} checks; kalenderwerk 100/200: ${small}/${large}`);
for (const failure of failures.slice(0, 10)) console.log(`   ${failure}`);
process.exit(failures.length ? 1 : 0);
