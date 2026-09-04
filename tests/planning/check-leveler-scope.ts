// check-leveler-scope.ts — B1c-plan-2 taak 3: `scopeTaskIds` begrenst WAT er genivelleerd wordt.
// Taken buiten de scope houden hun bestaande `levelingDelay` en tellen als VASTE LAST — precies wat
// de verdeler nodig heeft om per poolitem te nivelleren zonder de rest van het document te
// herschikken (spec §5, "scope-behoudend toepassen").
//
// Helperstijl gekopieerd uit `check-leveler-splits.ts` (task()/res()/assign()/stubCpmResult()).
//
// Draait via run.sh. Exit 0 = alles groen.

import { levelResources, type LevelingOptions } from '@/engine/scheduler/ResourceLeveler';
import { solveProject } from '@/engine/scheduler/solveProject';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';

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

/** Leaf-taak, zelfde veldvorm als `check-leveler-splits.ts`s `task()`. */
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

/** Zelfde precedent als `check-leveler-splits.ts`s `stubCpmResult` — `levelResources` gebruikt hem
 *  alleen als fallback (`projectEndBefore`/foutuitgang); de echte baseline/PF/proef-solves rekenen
 *  op eigen `CPMSolver`-runs. */
function stubCpmResult(projectEnd: string): CPMResult {
  return {
    tasks: new Map(), criticalPath: [], drivingSequenceIds: [], sequenceFreeFloat: {},
    truncatedLeadSequenceIds: [], violatedConstraintTaskIds: [], missedDeadlineTaskIds: [],
    outOfSequenceSequenceIds: [], nearCriticalTaskIds: [], criticalPaths: [], floatPathByTask: {},
    hammockNoFinishDriverTaskIds: [], projectEnd, projectDuration: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 1 (scope-behoud + de controle zonder scope): resource R (cap 1). Taak A (prio 500, 1 wd,
// ES ma 06-01) draagt AL `levelingDelay: 2` uit een eerdere nivellering ⇒ zij staat feitelijk op
// wo 06-03. Taak B (prio 500, 1 wd, aanmaakvolgorde ná A) heeft een SNET-constraint die haar EIGEN
// PF onvoorwaardelijk op wo 06-03 pint (onafhankelijk van A — geen relatie tussen A en B) — dat is
// de enige manier om B's ECHTE PF op dezelfde dag als A's VERSCHOVEN positie te krijgen; zonder
// constraint zou B's kale PF gewoon ma zijn (geen relatie met A) en zou er geen conflict optreden.
// Scope = alleen B.
// ═══════════════════════════════════════════════════════════════════════════
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
  const r = levelResources([taskA, taskB], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, scopedOpts);

  ok('A houdt haar delay: geen delay-vermelding voor A in het resultaat', r.delays['a'] === undefined);
  eq("B wijkt om A heen — A stond op 06-03, dus B krijgt delay 1", r.delays['b'], 1);
  ok('geen onopgeloste conflicten', Object.keys(r.unresolved).length === 0);

  // Controle: zonder scope-behoud zou A's delay in de baseline weggestript zijn (A start dan op
  // haar eigen kale PF, ma 06-01), en B (die via haar SNET nog steeds op wo 06-03 wil) botst dan
  // NERGENS met A — de twee zitten op verschillende dagen. Dat levert een AANTOONBAAR ander
  // resultaat op dan de scoped run hierboven; dat verschil IS de regressie die dit geval pint.
  const noScopeOpts: LevelingOptions = { constrainToFloat: false };
  const rNoScope = levelResources(
    [taskA, taskB], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, noScopeOpts,
  );
  ok('controle: zonder scope levert dezelfde fixture een ANDER (delay-vrij-baseline) antwoord',
    JSON.stringify(rNoScope.delays) !== JSON.stringify(r.delays));
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 2 (de spec-validatieplicht): `computePF` met behouden out-of-scope-delays. C (buiten
// scope, draagt AL `levelingDelay: 3`) → FS → D (binnen scope, geen eigen delay). D's PF (zoals
// `computePF` hem berekent op de `workTasks`-werkkopie) MOET C's door haar behouden delay
// VERSCHOVEN vroege eind volgen, niet C's ongenivelleerde (delay-vrije) vroege eind. D heeft geen
// resourceconflict nodig om dit te bewijzen: D krijgt een eigen resource-toewijzing op een
// ruime resource zodat ze door de eligibility-lus loopt (en `computePF` dus ECHT aangeroepen
// wordt) — de propagatie zelf komt uit de FS-relatie, niet uit resourcedruk.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-scope: computePF respecteert een behouden out-of-scope-delay (geval 2) --');
{
  const taskC = task('c', '2026-06-01', '2026-06-01', 1, { priority: 500, levelingDelay: 3 });
  // D's fixture-earlyStart is bewust een datum die NIET klopt met de geleverde planning (ma 06-01,
  // dezelfde als C's ongeschoven start) — zodat de `shifts`-vergelijking (`cur !== tr`) altijd een
  // echte wijziging ziet, ongeacht waar D in werkelijkheid landt.
  const taskD = task('d', '2026-06-01', '2026-06-01', 1, { priority: 500 });
  const sequences: Sequence[] = [
    { id: 'seq-cd', predecessorId: 'c', successorId: 'd', type: 'FINISH_START', lagDays: 0 },
  ];

  const resourceRoomy = res('r-scope2', 99);
  const assignments = [assign('d-r', 'd', 'r-scope2', 1)];
  const cpmResult = stubCpmResult('2026-06-01');

  const opts: LevelingOptions = { constrainToFloat: false, scopeTaskIds: ['d'] };
  const r2 = levelResources([taskC, taskD], sequences, [resourceRoomy], assignments, PROJECT_CAL, [], cpmResult, opts);

  eq('D krijgt geen eigen delay — ze heeft geen concurrent, alleen een verschoven voorganger',
    r2.delays['d'], undefined);
  ok("D's start verschuift t.o.v. haar (bewust foute) fixture-earlyStart", r2.shifts['d'] !== undefined);

  // Onafhankelijke referentie: draai `solveProject` op DEZELFDE relatie met C's `levelingDelay`
  // al gezet, en lees D's earlyStart daaruit — dat is precies wat een correcte `computePF` had
  // moeten opleveren (de propagatie via de FS-relatie, met C's behouden delay toegepast).
  const solvedTasks: Task[] = [
    { ...taskC, time: { ...taskC.time } },
    { ...taskD, time: { ...taskD.time } },
  ];
  const solved = solveProject({ tasks: solvedTasks, sequences, calendar: PROJECT_CAL, calendars: [] });
  ok('referentie-solve rekent zonder fout door', !solved.error);
  const expectedDStart = solvedTasks.find(t => t.id === 'd')!.time.earlyStart;

  eq('PF van D volgt de BEHOUDEN delay van C (spec-plicht: computePF met out-of-scope-delays)',
    r2.shifts['d']?.newStart, expectedDStart);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  leveler-scope: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  leveler-scope: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
