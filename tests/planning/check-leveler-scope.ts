import { levelResources, type LevelingOptions } from '@/engine/scheduler/ResourceLeveler';
import { solveProject } from '@/engine/scheduler/solveProject';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { legacyCpmOptions, opsSolveInput } from './legacySolveOptions';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

const PROJECT_CAL: WorkCalendar = {
  id: 'cal-project-leveler-scope', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

function task(id: string, earlyStart: string, earlyFinish: string, durationDays: number, extra?: Partial<Task>): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: durationDays,
      scheduleStart: earlyStart, scheduleFinish: earlyFinish,
      earlyStart, earlyFinish, lateStart: earlyStart, lateFinish: earlyFinish,
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    ...extra,
  };
}

function res(id: string, maxUnits = 1, extra?: Partial<Resource>): Resource {
  return { id, name: id, type: 'LABOR', description: '', maxUnits, ...extra };
}

function assign(id: string, taskId: string, resourceId: string, unitsPerDay: number): ResourceAssignment {
  return { id, taskId, resourceId, unitsPerDay, curve: 'UNIFORM' };
}

function stubCpmResult(projectEnd: string): CPMResult {
  return {
    tasks: new Map(), criticalPath: [], drivingSequenceIds: [], sequenceFreeFloat: {},
    truncatedLeadSequenceIds: [], violatedConstraintTaskIds: [], missedDeadlineTaskIds: [],
    outOfSequenceSequenceIds: [], nearCriticalTaskIds: [], criticalPaths: [], floatPathByTask: {},
    hammockNoFinishDriverTaskIds: [], projectEnd, projectDuration: 0,
  };
}

console.log('-- leveler-scope: scope-behoud, delay buiten scope blijft vaste last (geval 1) --');
{
  const taskA = task('a', '2026-06-01', '2026-06-01', 1, { priority: 500, levelingDelay: 2 });
  const taskB = task('b', '2026-06-03', '2026-06-03', 1, {
    priority: 500,
    constraint: { type: 'SNET', date: '2026-06-03' },
  });

  const resourceR = res('r-scope1', 1);
  const assignments = [assign('a-r', 'a', 'r-scope1', 1), assign('b-r', 'b', 'r-scope1', 1)];
  const cpmResult = stubCpmResult('2026-06-03');

  const scopedOpts: LevelingOptions = { constrainToFloat: false, scopeTaskIds: ['b'] };
  const r = levelResources([taskA, taskB], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, scopedOpts, legacyCpmOptions());

  ok('A houdt haar delay: geen delay-vermelding voor A in het resultaat', r.delays['a'] === undefined);
  eq("B wijkt om A heen — A stond op 06-03, dus B krijgt delay 1", r.delays['b'], 1);
  ok('geen onopgeloste conflicten', Object.keys(r.unresolved).length === 0);

  const noScopeOpts: LevelingOptions = { constrainToFloat: false };
  const rNoScope = levelResources(
    [taskA, taskB], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, noScopeOpts, legacyCpmOptions(),
  );
  ok('controle: zonder scope levert dezelfde fixture een ANDER (delay-vrij-baseline) antwoord',
    JSON.stringify(rNoScope.delays) !== JSON.stringify(r.delays));
}

console.log('-- leveler-scope: computePF respecteert een behouden out-of-scope-delay (geval 2) --');
{
  const taskC = task('c', '2026-06-01', '2026-06-01', 1, { priority: 500, levelingDelay: 3 });
  const taskD = task('d', '2026-06-01', '2026-06-01', 1, { priority: 500 });
  const sequences: Sequence[] = [
    { id: 'seq-cd', predecessorId: 'c', successorId: 'd', type: 'FINISH_START', lagDays: 0 },
  ];

  const resourceRoomy = res('r-scope2', 99);
  const assignments = [assign('d-r', 'd', 'r-scope2', 1)];
  const cpmResult = stubCpmResult('2026-06-01');

  const opts: LevelingOptions = { constrainToFloat: false, scopeTaskIds: ['d'] };
  const r2 = levelResources([taskC, taskD], sequences, [resourceRoomy], assignments, PROJECT_CAL, [], cpmResult, opts, legacyCpmOptions());

  eq('D krijgt geen eigen delay — ze heeft geen concurrent, alleen een verschoven voorganger',
    r2.delays['d'], undefined);
  ok("D's start verschuift t.o.v. haar (bewust foute) fixture-earlyStart", r2.shifts['d'] !== undefined);

  const solvedTasks: Task[] = [
    { ...taskC, time: { ...taskC.time } },
    { ...taskD, time: { ...taskD.time } },
  ];
  const solved = solveProject(opsSolveInput({ tasks: solvedTasks, sequences, calendar: PROJECT_CAL, calendars: [] }));
  ok('referentie-solve rekent zonder fout door', !solved.error);
  const expectedDStart = solvedTasks.find(t => t.id === 'd')!.time.earlyStart;

  eq('PF van D volgt de BEHOUDEN delay van C (spec-plicht: computePF met out-of-scope-delays)',
    r2.shifts['d']?.newStart, expectedDStart);
}

if (diffs.length === 0) {
  console.log(`OK  leveler-scope: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  leveler-scope: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
