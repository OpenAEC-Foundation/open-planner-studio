import { levelResources, type LevelingOptions } from '@/engine/scheduler/ResourceLeveler';
import { solveProject } from '@/engine/scheduler/solveProject';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Task } from '@/types/task';
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
  id: 'cal-project-leveler', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

const SIX_DAY_CAL: WorkCalendar = {
  id: 'cal-six-day-leveler', name: 'zesdaags', description: '', workDays: [1, 2, 3, 4, 5, 6],
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

const LEVEL_OPTS: LevelingOptions = { constrainToFloat: false };

console.log('-- leveler-splits: gesplitste taak boekt alleen haar echte werkdagen (geval 1) --');
{
  const taskA = task('a', '2026-06-01', '2026-06-05', 3, {
    priority: 600,
    splitGaps: [
      { afterMinutes: 480, gapMinutes: 480 },
      { afterMinutes: 1440, gapMinutes: 480 },
    ],
  });
  const taskB = task('b', '2026-06-02', '2026-06-02', 1, { priority: 500 });

  const resourceR = res('r1', 1);
  const assignments = [assign('a-r1', 'a', 'r1', 1), assign('b-r1', 'b', 'r1', 1)];

  const cpmResult = stubCpmResult('2026-06-05');
  const r1 = levelResources(
    [taskA, taskB], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('taak B hoeft niet te wijken: het gat van A is echt vrij', r1.delays['b'], undefined);
  eq('taak A zelf heeft ook geen delay (ze plaatst op haar eigen PF)', r1.delays['a'], undefined);
  ok('geen onopgeloste conflicten', Object.keys(r1.unresolved).length === 0);
}

console.log('-- leveler-splits: delay op de taakkalender, met capaciteitsdruk (geval 2) --');
{
  const taskD = task('d', '2026-06-05', '2026-06-05', 1, { priority: 900 });
  const taskC = task('c', '2026-06-05', '2026-06-05', 1, { priority: 100, calendarId: 'cal-six-day-leveler' });

  const resourceR = res('r2', 1, { calendarId: 'cal-six-day-leveler' });
  const assignments = [assign('d-r2', 'd', 'r2', 1), assign('c-r2', 'c', 'r2', 1)];

  const cpmResult = stubCpmResult('2026-06-05');
  const r2 = levelResources(
    [taskD, taskC], [], [resourceR], assignments, PROJECT_CAL, [SIX_DAY_CAL], cpmResult, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('D (hoogste prioriteit) plaatst op haar eigen PF, geen delay', r2.delays['d'], undefined);
  eq('C wijkt met delay 1 — de kandidaat-scan vindt zaterdag (C.EIGEN werkdag) als eerstvolgende vrije dag',
    r2.delays['c'], 1);
  ok('geen onopgeloste conflicten', Object.keys(r2.unresolved).length === 0);

  const solvedTasks: Task[] = [
    { ...taskD, time: { ...taskD.time }, levelingDelay: r2.delays['d'] },
    { ...taskC, time: { ...taskC.time }, levelingDelay: r2.delays['c'] },
  ];
  const solved = solveProject(opsSolveInput({
    tasks: solvedTasks, sequences: [], calendar: PROJECT_CAL, calendars: [SIX_DAY_CAL],
  }));
  ok('solveProject rekent zonder fout door', !solved.error);
  const cResult = solvedTasks.find(t => t.id === 'c')!;
  eq("C's earlyStart landt op zaterdag 2026-06-06 — de dag die de preview-boeking beloofde",
    cResult.time.earlyStart, "2026-06-06T08:00");
}

console.log('-- leveler-splits: ELAPSEDTIME-taak boekt spanne-geklemd, niet als werkdagen-telling (geval 3) --');
{
  const taskEBase = task('e', '2026-06-05', '2026-06-07', 2, { priority: 900 });
  const taskE: Task = { ...taskEBase, time: { ...taskEBase.time, durationType: 'ELAPSEDTIME' } };
  const taskF = task('f', '2026-06-08', '2026-06-08', 1, { priority: 100 });

  const resourceR = res('r3', 1);
  const assignments = [
    assign('e-r3', 'e', 'r3', 1),
    assign('f-r3', 'f', 'r3', 1),
  ];

  const cpmResult = stubCpmResult('2026-06-08');
  const r3 = levelResources(
    [taskE, taskF], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('E plaatst op haar eigen PF, geen delay (hoogste prioriteit, geen concurrent)', r3.delays['e'], undefined);
  eq('F hoeft niet te wijken: E boekt spanne-geklemd (alleen vrijdag), niet als werkdagen-telling — maandag blijft vrij',
    r3.delays['f'], undefined);
  ok('geen onopgeloste conflicten', Object.keys(r3.unresolved).length === 0);
}

console.log('-- leveler-splits: ELAPSEDTIME-delay in kalenderdagen + waarneembare boeking (geval 4) --');
{
  const taskD = task('d4', '2026-06-05', '2026-06-05', 1, { priority: 900 });
  const taskEBase = task('e4', '2026-06-05', '2026-06-09', 4, { priority: 100 });
  const taskE: Task = { ...taskEBase, time: { ...taskEBase.time, durationType: 'ELAPSEDTIME' } };
  const taskG = task('g4', '2026-06-08', '2026-06-08', 1, { priority: 10 });

  const resourceR = res('r4', 1);
  const assignments = [
    assign('d4-r4', 'd4', 'r4', 1),
    assign('e4-r4', 'e4', 'r4', 1),
    assign('g4-r4', 'g4', 'r4', 1),
  ];

  const cpmResult = stubCpmResult('2026-06-09');
  const r4 = levelResources(
    [taskD, taskE, taskG], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('D (hoogste prioriteit) plaatst op haar eigen PF, geen delay', r4.delays['d4'], undefined);
  eq('E wijkt met delay 1 — kale KALENDERdag vr→za (elke kalenderdag is een geldige ELAPSEDTIME-kandidaat, C1/C2)',
    r4.delays['e4'], 1);
  ok('G moet wijken: E boekt maandag daadwerkelijk (waarneembare boeking, dekking geval 4)',
    (r4.delays['g4'] ?? 0) > 0);
  ok('geen onopgeloste conflicten', Object.keys(r4.unresolved).length === 0);

  const solvedTasks: Task[] = [
    { ...taskD, time: { ...taskD.time }, levelingDelay: r4.delays['d4'] },
    { ...taskE, time: { ...taskE.time }, levelingDelay: r4.delays['e4'] },
  ];
  const solved = solveProject(opsSolveInput({
    tasks: solvedTasks, sequences: [], calendar: PROJECT_CAL, calendars: [],
  }));
  ok('solveProject rekent zonder fout door', !solved.error);
  const eResult = solvedTasks.find(t => t.id === 'e4')!;
  eq("E's earlyStart landt op zaterdag 2026-06-06 — de dag waarop bookDemandAt haar al boekte",
    eResult.time.earlyStart, "2026-06-06T00:00");
}

console.log('-- leveler-splits: 6-daagse taak zonder capaciteitsdruk ⇒ geen spookvertraging (geval 5, C1) --');
{
  const taskH = task('h5', '2026-06-06', '2026-06-06', 1, {
    priority: 500, calendarId: 'cal-six-day-leveler',
  });
  const resourceR = res('r5', 1, { calendarId: 'cal-six-day-leveler' });
  const assignments = [assign('h5-r5', 'h5', 'r5', 1)];

  const cpmResult = stubCpmResult('2026-06-06');
  const r5 = levelResources(
    [taskH], [], [resourceR], assignments, PROJECT_CAL, [SIX_DAY_CAL], cpmResult, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('geen enkele taak krijgt een delay — de taak plaatst meteen op haar eigen (weekend-)PF', r5.delays, {});
  ok('geen onopgeloste conflicten', Object.keys(r5.unresolved).length === 0);
}

console.log('-- leveler-splits: vastgepinde 6-daagse taak, PF in het weekend ⇒ geen delay (geval 6, C2) --');
{
  const taskP = task('p6', '2026-06-06', '2026-06-06', 1, {
    priority: 1000, calendarId: 'cal-six-day-leveler',
  });
  const resourceR = res('r6', 1);
  const assignments = [assign('p6-r6', 'p6', 'r6', 1)];

  const cpmResult = stubCpmResult('2026-06-06');
  const r6 = levelResources(
    [taskP], [], [resourceR], assignments, PROJECT_CAL, [SIX_DAY_CAL], cpmResult, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('vastgepinde taak krijgt geen delay — snapt op haar EIGEN kalender-as, niet de projectkalender', r6.delays, {});
  eq('vastgepinde zaterdagtaak meldt ontbrekende resourcecapaciteit', r6.unresolved, { p6: ['2026-06-06'] });
}

console.log('-- leveler-splits: gesplitste taak op een afwijkende (zesdaagse) kalender boekt correct (geval 7) --');
{
  const taskS = task('s7', '2026-06-04', '2026-06-08', 3, {
    priority: 900, calendarId: 'cal-six-day-leveler',
    splitGaps: [{ afterMinutes: 960, gapMinutes: 480 }],
  });
  const taskConflictMonday = task('t7-mon', '2026-06-08', '2026-06-08', 1, { priority: 100 });
  const taskFreeSaturday = task('t7-sat', '2026-06-06', '2026-06-06', 1, {
    priority: 50, calendarId: 'cal-six-day-leveler',
  });

  const resourceR = res('r7', 1, { calendarId: 'cal-six-day-leveler' });
  const assignments = [
    assign('s7-r7', 's7', 'r7', 1),
    assign('t7-mon-r7', 't7-mon', 'r7', 1),
    assign('t7-sat-r7', 't7-sat', 'r7', 1),
  ];

  const cpmResult = stubCpmResult('2026-06-08');
  const r7 = levelResources(
    [taskS, taskConflictMonday, taskFreeSaturday], [], [resourceR], assignments,
    PROJECT_CAL, [SIX_DAY_CAL], cpmResult, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('S plaatst op haar eigen PF, geen delay (hoogste prioriteit)', r7.delays['s7'], undefined);
  ok('de concurrent op MAANDAG moet wijken — S bezet daar echt (haar derde werkdag op de zesdaagse as)',
    (r7.delays['t7-mon'] ?? 0) > 0);
  eq('de concurrent op ZATERDAG hoeft niet te wijken — dat is S\'s eigen pauzedag, niet een geboekte dag',
    r7.delays['t7-sat'], undefined);
}

console.log('-- leveler-splits: verse baseline-spanne wint van een stale opgeslagen spanne (geval 8, I3/probe F) --');
{
  const taskGBase = task('g8', '2026-06-01', '2026-06-01', 5, { priority: 500 });
  const taskG: Task = { ...taskGBase, time: { ...taskGBase.time, durationType: 'ELAPSEDTIME' } };
  const taskConflict = task('t8-conflict', '2026-06-03', '2026-06-03', 1, { priority: 900 });

  const resourceR = res('r8', 1);
  const assignments = [assign('g8-r8', 'g8', 'r8', 1), assign('t8-r8', 't8-conflict', 'r8', 1)];

  const cpmResult = stubCpmResult('2026-06-06');
  const r8 = levelResources(
    [taskG, taskConflict], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('de concurrent (hoogste prioriteit) plaatst op haar eigen PF, geen delay', r8.delays['t8-conflict'], undefined);
  eq('G ziet het conflict op 06-03 ONDANKS de stale opgeslagen spanne — verse baseline wint (I3)',
    r8.delays['g8'], 3);
  ok('geen onopgeloste conflicten', Object.keys(r8.unresolved).length === 0);
}

console.log('-- leveler-splits: lege earlyStart/earlyFinish crashen niet (geval 9, I4/probe G) --');
{
  const taskKBase = task('k9', '2026-06-01', '2026-06-01', 2, { priority: 500 });
  const taskK: Task = {
    ...taskKBase,
    time: { ...taskKBase.time, durationType: 'ELAPSEDTIME', earlyStart: '', earlyFinish: '' },
  };
  const resourceR = res('r9', 1);
  const assignments = [assign('k9-r9', 'k9', 'r9', 1)];

  const cpmResult = stubCpmResult('2026-06-02');
  let threw: unknown;
  let r9: ReturnType<typeof levelResources> | undefined;
  try {
    r9 = levelResources([taskK], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS, legacyCpmOptions());
  } catch (e) {
    threw = e;
  }
  ok('levelResources crasht niet op lege earlyStart/earlyFinish', threw === undefined);
  ok('resultaat komt terug (geen exceptie onderweg gesmoord)', r9 !== undefined);
}

console.log('-- leveler-splits: leeg kandidaatvenster telt niet als passend (geval 10, L1/probe L) --');
{
  const taskD = task('d10', '2026-06-05', '2026-06-05', 1, { priority: 900 });
  const taskEBase = task('e10', '2026-06-05', '2026-06-05', 1, { priority: 100 });
  const taskE: Task = { ...taskEBase, time: { ...taskEBase.time, durationType: 'ELAPSEDTIME' } };
  const taskF = task('f10', '2026-06-08', '2026-06-08', 1, { priority: 10 });

  const resourceR = res('r10', 1);
  const assignments = [
    assign('d10-r10', 'd10', 'r10', 1),
    assign('e10-r10', 'e10', 'r10', 1),
    assign('f10-r10', 'f10', 'r10', 1),
  ];

  const cpmResult = stubCpmResult('2026-06-08');
  const r10 = levelResources(
    [taskD, taskE, taskF], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('D plaatst op haar eigen PF, geen delay', r10.delays['d10'], undefined);
  eq('E slaat het lege weekend-venster over: delay 3 (vr→ma), niet de vals-vrije 1 (vr→za)',
    r10.delays['e10'], 3);
  eq('E: de vertraging in minuten is kalendertijd (3 × 1440)', r10.delayMinutes?.['e10'], 4320);
  ok('F moet wijken: E\'s vraag staat echt in het grootboek (op maandag), niet spoorloos verdwenen',
    (r10.delays['f10'] ?? 0) > 0);
  ok('geen onopgeloste conflicten', Object.keys(r10.unresolved).length === 0);
}

console.log('-- leveler-splits: taak op ruimere kalender dan haar resource krijgt een echte, capaciteit-gedreven delay (geval 11, L5) --');
{
  const taskMov = task('mov11', '2026-06-06', '2026-06-06', 1, {
    priority: 500, calendarId: 'cal-six-day-leveler',
  });
  const resourceR = res('r11', 1);
  const assignments = [assign('mov11-r11', 'mov11', 'r11', 1)];

  const cpmResult = stubCpmResult('2026-06-06');
  const r11 = levelResources(
    [taskMov], [], [resourceR], assignments, PROJECT_CAL, [SIX_DAY_CAL], cpmResult, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('MOV wijkt met delay 1 — echte capaciteitsdruk (resource kan zaterdag niet werken), geen axis-spook',
    r11.delays['mov11'], 1);
  ok('geen onopgeloste conflicten', Object.keys(r11.unresolved).length === 0);
}

console.log('-- leveler-splits: voltooide taak is onverplaatsbaar, boekt als vaste last (geval 12) --');
{
  const h1aBase = task('h1a', '2026-06-01', '2026-06-01', 1, { priority: 100 });
  const h1a: Task = {
    ...h1aBase,
    time: { ...h1aBase.time, completion: 1, actualStart: '2026-06-01T08:00', actualFinish: '2026-06-01T16:00' },
  };
  const h2a = task('h2a', '2026-06-01', '2026-06-01', 1, { priority: 900 });

  const resourceRA = res('r12a', 1);
  const assignmentsA = [assign('h1a-r12a', 'h1a', 'r12a', 1), assign('h2a-r12a', 'h2a', 'r12a', 1)];

  const cpmResultA = stubCpmResult('2026-06-01');
  const r12a = levelResources(
    [h1a, h2a], [], [resourceRA], assignmentsA, PROJECT_CAL, [], cpmResultA, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('H1 (voltooid, LAGE prioriteit) krijgt NOOIT een levelingDelay — negeert de prioriteitsstrijd volledig',
    r12a.delays['h1a'], undefined);
  ok('H2 (hoge prioriteit) wijkt écht: H1\'s boeking is een vaste last, waarneembaar via een echte delay ondanks haar hogere prioriteit',
    (r12a.delays['h2a'] ?? 0) > 0);
  ok('sub-geval A is volledig opgelost — geen onopgeloste conflicten', Object.keys(r12a.unresolved).length === 0);

  const h1bBase = task('h1b', '2026-06-01', '2026-06-01', 1, { priority: 100 });
  const h1b: Task = {
    ...h1bBase,
    time: { ...h1bBase.time, completion: 1, actualStart: '2026-06-01T08:00', actualFinish: '2026-06-01T16:00' },
  };
  const h3 = task('h3', '2026-06-01', '2026-06-01', 1, { priority: 900 });

  const resourceRB = res('r12b', 1);
  const assignmentsB = [assign('h1b-r12b', 'h1b', 'r12b', 1), assign('h3-r12b', 'h3', 'r12b', 1)];

  const cpmResultB = stubCpmResult('2026-06-01');
  const SMOOTH_OPTS: LevelingOptions = { constrainToFloat: true };
  const r12b = levelResources(
    [h1b, h3], [], [resourceRB], assignmentsB, PROJECT_CAL, [], cpmResultB, SMOOTH_OPTS, legacyCpmOptions(),
  );

  eq('H1b (voltooid) krijgt NOOIT een levelingDelay, ook niet in smoothing-modus', r12b.delays['h1b'], undefined);
  eq('H3 krijgt geen delay (bleef op haar eigen PF staan — het venster liet geen slot toe)',
    r12b.delays['h3'], undefined);
  eq('ALLEEN H3 belandt in unresolved — H1b doet niet mee aan de eligibility-lus en kan er dus nooit in staan',
    Object.keys(r12b.unresolved).sort(), ['h3']);
}

console.log('-- leveler-splits: taak IN UITVOERING is onverplaatsbaar, boekt als vaste last (geval 13, W1/probe M) --');
{
  const bABase = task('b13a', '2026-06-01', '2026-06-01', 1, { priority: 100 });
  const b13a: Task = {
    ...bABase,
    time: { ...bABase.time, completion: 0.5, actualStart: '2026-06-01T08:00' },
  };
  const z13a = task('z13a', '2026-06-01', '2026-06-01', 1, { priority: 900 });

  const resourceRA = res('r13a', 1);
  const assignmentsA = [assign('b13a-r13a', 'b13a', 'r13a', 1), assign('z13a-r13a', 'z13a', 'r13a', 1)];

  const cpmResultA = stubCpmResult('2026-06-01');
  const r13a = levelResources(
    [b13a, z13a], [], [resourceRA], assignmentsA, PROJECT_CAL, [], cpmResultA, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('B (in uitvoering, LAGE prioriteit) krijgt NOOIT een levelingDelay', r13a.delays['b13a'], undefined);
  ok('Z (hoge prioriteit) wijkt écht: B\'s boeking is een vaste last, ondanks haar hogere prioriteit',
    (r13a.delays['z13a'] ?? 0) > 0);
  ok('sub-geval A is volledig opgelost — geen onopgeloste conflicten', Object.keys(r13a.unresolved).length === 0);

  const bBBase = task('b13b', '2026-06-01', '2026-06-01', 1, { priority: 100 });
  const b13b: Task = {
    ...bBBase,
    time: { ...bBBase.time, completion: 0.5, actualStart: '2026-06-01T08:00' },
  };
  const z13b = task('z13b', '2026-06-01', '2026-06-01', 1, { priority: 900 });

  const resourceRB = res('r13b', 1);
  const assignmentsB = [assign('b13b-r13b', 'b13b', 'r13b', 1), assign('z13b-r13b', 'z13b', 'r13b', 1)];

  const cpmResultB = stubCpmResult('2026-06-01');
  const SMOOTH_OPTS13: LevelingOptions = { constrainToFloat: true };
  const r13b = levelResources(
    [b13b, z13b], [], [resourceRB], assignmentsB, PROJECT_CAL, [], cpmResultB, SMOOTH_OPTS13, legacyCpmOptions(),
  );

  eq('B (in uitvoering) krijgt NOOIT een levelingDelay, ook niet in smoothing-modus', r13b.delays['b13b'], undefined);
  eq('Z krijgt geen delay (bleef op haar eigen PF staan — het venster liet geen slot toe)',
    r13b.delays['z13b'], undefined);
  eq('ALLEEN Z belandt in unresolved — B doet niet mee aan de eligibility-lus en kan er dus nooit in staan',
    Object.keys(r13b.unresolved).sort(), ['z13b']);
}

console.log('-- leveler-splits: meerdaagse voltooide taak over een feestdagenblok (geval 14, W2/probe N2) --');
{
  const HOLIDAY_CAL: WorkCalendar = {
    id: 'cal-holiday-leveler', name: 'feestdagen', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
    holidays: [{ name: 'blokvakantie', startDate: '2026-05-05', endDate: '2026-05-06' }],
  };
  const h1Base = task('h1-n2', '2026-04-29', '2026-05-04', 5, { priority: 500 });
  const h1n2: Task = {
    ...h1Base,
    time: { ...h1Base.time, completion: 1, actualStart: '2026-04-29T08:00', actualFinish: '2026-05-04T16:00' },
  };
  const tPhantom = task('t14-phantom', '2026-05-07', '2026-05-07', 1, { priority: 500 });
  const tReal = task('t14-real', '2026-05-04', '2026-05-04', 1, { priority: 500 });

  const resourceR = res('r14', 1);
  const assignments = [
    assign('h1-n2-r14', 'h1-n2', 'r14', 1),
    assign('t14-phantom-r14', 't14-phantom', 'r14', 1),
    assign('t14-real-r14', 't14-real', 'r14', 1),
  ];

  const cpmResult = stubCpmResult('2026-05-07');
  const r14 = levelResources(
    [h1n2, tPhantom, tReal], [], [resourceR], assignments, HOLIDAY_CAL, [], cpmResult, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('H1 (voltooid, meerdaags) krijgt NOOIT een levelingDelay', r14.delays['h1-n2'], undefined);
  eq('concurrent op de FANTOOMDAG 05-07 hoeft niet te wijken — H1 boekt daar niets (fix)',
    r14.delays['t14-phantom'], undefined);
  ok('concurrent op de ECHTE laatste werkdag 05-04 moet wél wijken — H1 bezet die dag echt',
    (r14.delays['t14-real'] ?? 0) > 0);
}

console.log('-- leveler-splits: memoisatie van occurrenceFor sleutelt op (taak, startdag) (geval 15, L3) --');
{
  const taskX = task('x15', '2026-06-01', '2026-06-01', 1, { priority: 900 });
  const taskY = task('y15', '2026-06-01', '2026-06-03', 3, { priority: 500 });
  const taskZ = task('z15', '2026-06-02', '2026-06-02', 1, { priority: 100 });

  const resourceRX = res('rx-15', 1);
  const resourceRY = res('ry-15', 1);
  const assignments = [
    assign('x15-r', 'x15', 'rx-15', 1),
    assign('y15-r', 'y15', 'ry-15', 1),
    assign('z15-r', 'z15', 'ry-15', 1),
  ];
  const cpmResult = stubCpmResult('2026-06-03');
  const tasksList: Task[] = [taskX, taskY, taskZ];
  const resourcesList: Resource[] = [resourceRX, resourceRY];
  const run = levelResources(
    tasksList, [], resourcesList, assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS, legacyCpmOptions(),
  );

  eq('memo-zuiverheid: Z wijkt 2 dagen om Y se ECHTE (3-daagse) bezetting van ry heen',
    run.delays, { z15: 2 });
  eq('memo-zuiverheid: Z se nieuwe start is 06-04, ná Y se volledige occurrence',
    run.shifts['z15']?.newStart, "2026-06-04T08:00");
  eq('memo-zuiverheid: geen onopgeloste conflicten', run.unresolved, {});
}

if (diffs.length === 0) {
  console.log(`OK  leveler-splits: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  leveler-splits: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
