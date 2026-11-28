import { levelResources, type LevelingOptions } from '@/engine/scheduler/ResourceLeveler';
import { enumerateTaskWorkDays } from '@/engine/scheduler/splitWalk';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDate } from '@/utils/dateUtils';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { legacyCpmOptions } from './legacySolveOptions';

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
  id: 'cal-project-splitmode', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const projEng = new CalendarEngine(PROJECT_CAL);

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

function blocker(id: string, resourceId: string): { t: Task; a: ResourceAssignment } {
  return {
    t: task(id, '2026-06-01', '2026-06-04', 3, {
      priority: 900,
      splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }],
    }),
    a: assign(`${id}-r`, id, resourceId, 1),
  };
}

const LEVEL_OPTS_OFF: LevelingOptions = { constrainToFloat: false };
const CEILING = 3;

console.log('-- leveler-splitmode: uit=uitloop, aan=onderbreking (geval 1) --');
{
  const taskAPlain = task('a1', '2026-06-01', '2026-06-03', 3, { priority: 900 });
  const taskBOff = task('b1', '2026-06-01', '2026-06-02', 2, { priority: 100 });
  const resourceOff = res('r-split1-off', 1);
  const assignmentsOff = [
    assign('a1-r', 'a1', 'r-split1-off', 1),
    assign('b1-r', 'b1', 'r-split1-off', 1),
  ];
  const rOff = levelResources(
    [taskAPlain, taskBOff], [], [resourceOff], assignmentsOff, PROJECT_CAL, [], stubCpmResult('2026-06-03'),
    LEVEL_OPTS_OFF, legacyCpmOptions(),
  );
  eq('zonder onderbrekingen: B loopt uit (start do, delay 3)', rOff.delays['b1'], 3);
  eq('zonder onderbrekingen: geen gaten geschreven', rOff.gaps['b1'], undefined);

  const blk1 = blocker('a1s', 'r-split1-on');
  const taskBOn = task('b1s', '2026-06-01', '2026-06-02', 2, {
    priority: 100, deadline: '2026-06-02',
  });
  const resourceOn = res('r-split1-on', 1);
  const assignmentsOn = [blk1.a, assign('b1s-r', 'b1s', 'r-split1-on', 1)];
  const rOn = levelResources(
    [blk1.t, taskBOn], [], [resourceOn], assignmentsOn, PROJECT_CAL, [], stubCpmResult('2026-06-04'),
    { constrainToFloat: false, overrunCeilingDays: CEILING, allowSplits: true }, legacyCpmOptions(),
  );
  eq('met onderbrekingen: B start op de eerste vrije dag (di, delay 1)', rOn.delays['b1s'], 1);
  ok('met onderbrekingen: B krijgt precies één leveling-gat',
    rOn.gaps['b1s']?.length === 1 && rOn.gaps['b1s'][0].source === 'leveling');
  eq('gaten reproduceren de echte geboekte werkdagen (di, vr)',
    enumerateTaskWorkDays(rOn.gaps['b1s'], projEng, '2026-06-02', 2),
    ['2026-06-02', '2026-06-05']);

  eq('projectEndAfter houdt rekening met de opgerekte spanne van B (via het gat)',
    rOn.projectEndAfter, "2026-06-05T16:00");
}

console.log('-- leveler-splitmode: v1-grens — completion>0 en ELAPSEDTIME (geval 3) --');
{
  const blk3 = blocker('x3', 'r-split3');
  const taskCDone = task('cdone3', '2026-06-01', '2026-06-02', 2, {
    priority: 100, deadline: '2026-06-02',
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 2,
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-02',
      earlyStart: '2026-06-01', earlyFinish: '2026-06-02',
      lateStart: '2026-06-01', lateFinish: '2026-06-02',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 1,
    },
  });
  const resource3 = res('r-split3', 1);
  const assignments3 = [blk3.a, assign('cdone3-r', 'cdone3', 'r-split3', 1)];
  const r3 = levelResources(
    [blk3.t, taskCDone], [], [resource3], assignments3, PROJECT_CAL, [], stubCpmResult('2026-06-04'),
    { constrainToFloat: false, overrunCeilingDays: CEILING, allowSplits: true }, legacyCpmOptions(),
  );
  eq('completion > 0 ⇒ geen leveling-gaten, alleen (evt. onopgeloste) uitloop', r3.gaps['cdone3'], undefined);

  const blk4 = blocker('x4', 'r-split4');
  const taskE = task('e4', '2026-06-01', '2026-06-02', 2, {
    priority: 100, deadline: '2026-06-02',
    time: {
      durationType: 'ELAPSEDTIME', durationUnit: 'days', scheduleDuration: 2,
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-02',
      earlyStart: '2026-06-01', earlyFinish: '2026-06-02',
      lateStart: '2026-06-01', lateFinish: '2026-06-02',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
  });
  const resource4 = res('r-split4', 1);
  const assignments4 = [blk4.a, assign('e4-r', 'e4', 'r-split4', 1)];
  const r4 = levelResources(
    [blk4.t, taskE], [], [resource4], assignments4, PROJECT_CAL, [], stubCpmResult('2026-06-04'),
    { constrainToFloat: false, overrunCeilingDays: CEILING, allowSplits: true }, legacyCpmOptions(),
  );
  eq('ELAPSEDTIME ⇒ geen leveling-gaten', r4.gaps['e4'], undefined);
}

console.log('-- leveler-splitmode: uur-modus is split-eligible (geval 3b) --');
{
  const blk5 = blocker('x5', 'r-split5');
  const taskH = task('h5', '2026-06-01', '2026-06-02', 2, {
    priority: 100, deadline: '2026-06-02',
    time: {
      durationType: 'WORKTIME', durationUnit: 'hours', scheduleDuration: 2, durationMinutes: 960,
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-02',
      earlyStart: '2026-06-01', earlyFinish: '2026-06-02',
      lateStart: '2026-06-01', lateFinish: '2026-06-02',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
  });
  const resource5 = res('r-split5', 1);
  const assignments5 = [blk5.a, assign('h5-r', 'h5', 'r-split5', 1)];
  const r5 = levelResources(
    [blk5.t, taskH], [], [resource5], assignments5, PROJECT_CAL, [], stubCpmResult('2026-06-04'),
    { constrainToFloat: false, overrunCeilingDays: CEILING, allowSplits: true }, legacyCpmOptions(),
  );
  ok('uur-modus krijgt precies één leveling-gat (een hele werkdag pauze)',
    r5.gaps['h5']?.length === 1 && r5.gaps['h5'][0].source === 'leveling');
  eq('uur-modus: gaten reproduceren de echte geboekte werkdagen (di, vr)',
    enumerateTaskWorkDays(r5.gaps['h5'], projEng, '2026-06-02', 2),
    ['2026-06-02', '2026-06-05']);
  eq('uur-modus: delay is 1 werkdag (start op di)', r5.delays['h5'], 1);
}

console.log('-- leveler-splitmode: importsplit blijft, leveling-gat komt erbij (geval 4) --');
{
  const blk6 = blocker('x6', 'r-split6');
  const taskF = task('f6', '2026-06-01', '2026-06-02', 2, {
    priority: 100, deadline: '2026-06-02',
    splitGaps: [{ afterMinutes: 5000, gapMinutes: 100 }],
  });
  const resource6 = res('r-split6', 1);
  const assignments6 = [blk6.a, assign('f6-r', 'f6', 'r-split6', 1)];
  const r6 = levelResources(
    [blk6.t, taskF], [], [resource6], assignments6, PROJECT_CAL, [], stubCpmResult('2026-06-04'),
    { constrainToFloat: false, overrunCeilingDays: CEILING, allowSplits: true }, legacyCpmOptions(),
  );
  ok('importsplit blijft, leveling-gat komt erbij',
    r6.gaps['f6']?.filter(g => g.source === undefined).length === 1);
  ok('en er komt precies één NIEUW leveling-gat bij',
    r6.gaps['f6']?.filter(g => g.source === 'leveling').length === 1);
}

console.log('-- leveler-splitmode: eigen onderbreking ⇒ niet opknippen (geval 5) --');
{
  const blk8 = blocker('x8', 'r-split8');
  const USER_GAP = { afterMinutes: 480, gapMinutes: 480, source: 'user' as const };
  const taskU = task('u8', '2026-06-01', '2026-06-02', 2, {
    priority: 100, deadline: '2026-06-02',
    splitGaps: [USER_GAP],
  });
  const resource8 = res('r-split8', 1);
  const assignments8 = [blk8.a, assign('u8-r', 'u8', 'r-split8', 1)];
  const r8 = levelResources(
    [blk8.t, taskU], [], [resource8], assignments8, PROJECT_CAL, [], stubCpmResult('2026-06-04'),
    { constrainToFloat: false, overrunCeilingDays: CEILING, allowSplits: true }, legacyCpmOptions(),
  );
  eq('eigen onderbreking ⇒ geen enkel leveling-gat',
    (r8.gaps['u8'] ?? []).filter(g => g.source === 'leveling').length, 0);
  eq('en het gebruikersgat zelf is ongewijzigd', taskU.splitGaps, [USER_GAP]);
}

console.log('-- B1c-plan3 taak 1: scatter-randen --');

{
  const blk = blocker('x7', 'r-split7');
  const taskZ = task('z7', '2026-06-01', '2026-06-01', 0.5, {
    priority: 100, deadline: '2026-06-01',
  });
  const resource7 = res('r-split7', 1);
  const assignments7 = [blk.a, assign('z7-r', 'z7', 'r-split7', 1)];
  const rEmpty = levelResources(
    [blk.t, taskZ], [], [resource7], assignments7, PROJECT_CAL, [], stubCpmResult('2026-06-04'),
    { constrainToFloat: false, overrunCeilingDays: CEILING, allowSplits: true }, legacyCpmOptions(),
  );
  ok('lege scatter levert nooit een Invalid Date als start',
    !isNaN(parseDate(rEmpty.shifts['z7']?.newStart ?? '2026-06-01').getTime()));
  eq('lege scatter schrijft geen gaten', rEmpty.gaps['z7'], undefined);
}

{
  const N = 20;
  const tasksN: Task[] = [];
  const resourcesN: Resource[] = [];
  const assignsN: ResourceAssignment[] = [];
  for (let i = 0; i < N; i++) {
    tasksN.push(task(`nw${i}`, '2026-06-01', '2026-06-02', 2, { priority: 100 }));
    resourcesN.push(res(`r-nw${i}`, 1, { availabilitySteps: [{ from: '2026-06-01', maxUnits: 0 }] }));
    assignsN.push(assign(`nw${i}-a`, `nw${i}`, `r-nw${i}`, 1));
  }
  const t0 = Date.now();
  const rNoWindow = levelResources(
    tasksN, [], resourcesN, assignsN, PROJECT_CAL, [], stubCpmResult('2026-06-02'),
    { constrainToFloat: false, allowSplits: true }, legacyCpmOptions(),
  );
  const elapsedMs = Date.now() - t0;
  eq('geen eindeloze scatter-scan: eerlijke horizon-reden', rNoWindow.unresolvedReasons['nw0'], 'NO_WINDOW_IN_HORIZON');
  ok('en hij is niet meer traag', elapsedMs < 2000);
}

{
  const blockerTask = task('blk7h', '2026-06-01', '2026-06-03', 2, {
    priority: 900,
    splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }],
  });
  const blockerAssign = assign('blk7h-r', 'blk7h', 'r-split7h', 1);
  const taskH = task('h7', '2026-06-01', '2026-06-02', 2.5, {
    priority: 100, deadline: '2026-06-05',
    time: {
      durationType: 'WORKTIME', durationUnit: 'hours', scheduleDuration: 2.5, durationMinutes: 1200,
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-02',
      earlyStart: '2026-06-01', earlyFinish: '2026-06-02',
      lateStart: '2026-06-01', lateFinish: '2026-06-02',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
  });
  const hAssign = assign('h7-r', 'h7', 'r-split7h', 1);
  const resource7h = res('r-split7h', 1);
  const rFrac = levelResources(
    [blockerTask, taskH], [], [resource7h], [blockerAssign, hAssign], PROJECT_CAL, [], stubCpmResult('2026-06-03'),
    { constrainToFloat: false, overrunCeilingDays: 2, allowSplits: true }, legacyCpmOptions(),
  );
  eq('fractionele uur-modus: drie curve-slots, dus drie werkdagen',
    enumerateTaskWorkDays(rFrac.gaps['h7'], projEng, rFrac.shifts['h7']?.newStart ?? '2026-06-01', 3),
    ['2026-06-02', '2026-06-04', '2026-06-05']);
  ok('en precies één leveling-gat (na di, wo overslaand — zie de afwijking hierboven)',
    rFrac.gaps['h7']?.filter(g => g.source === 'leveling').length === 1);
}

{
  const hz = task('hz', '2026-06-01', '2026-06-05', 5, { priority: 100 });
  const anchor = task('hz-anchor', '2026-07-15', '2026-07-15', 1, {
    priority: 900, constraint: { type: 'SNET', date: '2026-07-15' },
  });
  const resourceHz = res('r-hz', 1, { availabilitySteps: [{ from: '2026-06-01', maxUnits: 0 }] });
  const rHorizon = levelResources(
    [hz, anchor], [], [resourceHz], [assign('hz-a', 'hz', 'r-hz', 1)],
    PROJECT_CAL, [], stubCpmResult('2026-07-15'),
    { constrainToFloat: true, allowSplits: true }, legacyCpmOptions(),
  );
  eq('scatter die op de horizon vastloopt ⇒ NO_WINDOW_IN_HORIZON',
    rHorizon.unresolvedReasons['hz'], 'NO_WINDOW_IN_HORIZON');
  eq('en er is niets geplaatst', rHorizon.gaps['hz'], undefined);
}

if (diffs.length === 0) {
  console.log(`OK  leveler-splitmode: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  leveler-splitmode: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
