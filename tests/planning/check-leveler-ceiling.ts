// check-leveler-ceiling.ts — B1c-plan-2 taak 4: het uitloop-plafond (`overrunCeilingDays`) als
// per-taak-venster `lateStart + N`, berekend op de VERSE baseline (die B1c-plan-2 taak 3's
// scope-behouden delays al meeneemt). Drie gevallen (spec §4/§6):
//  1. plafond 0 gedraagt zich als `constrainToFloat: true` — allebei vertalen naar hetzelfde
//     venster (`ls`), dus byte-identiek resultaat op dezelfde fixture.
//  2. plafond N laat precies N werkdagen uitloop toe — het venster is `lateStart + N` en niet
//     ruimer.
//  3. een deadline die `lateStart` VÓÓR de precedence-feasible start duwt maakt elk plafond
//     onbereikbaar — dat krijgt een eigen reden (`CEILING_UNREACHABLE`), geen generiek
//     capaciteitstekort.
//
// Helperstijl gekopieerd uit `check-leveler-splits.ts`/`check-leveler-scope.ts`.
//
// Draait via run.sh. Exit 0 = alles groen.

import { levelResources } from '@/engine/scheduler/ResourceLeveler';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Task } from '@/types/task';
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
  id: 'cal-project-leveler-ceiling', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
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

// ═══════════════════════════════════════════════════════════════════════════
// Geval 1: plafond 0 == constrainToFloat. Beide vertalen naar hetzelfde venster (`baseLs`), dus
// dezelfde fixture met de twee optie-vormen moet byte-identiek uitkomen — INCLUSIEF de reden, dus
// de fixture moet zelf géén onopgelost conflict opleveren (`ceilingSet` en `constrainToFloat`
// wijzen bij een onopgelost conflict bewust NAAR VERSCHILLENDE redenen — CEILING_TOO_TIGHT resp.
// INSUFFICIENT_CAPACITY/NO_WINDOW_IN_HORIZON, spec-taxonomie taak 4/5 — dat is geen inconsistentie
// in de PLAATSING, alleen in de reden-toeschrijving bij een NIET-geplaatste taak; dit geval bewijst
// de plaatsings-equivalentie, geval 2/3 hieronder bewijzen de reden-taxonomie afzonderlijk).
// Fixture: resource R (cap 1), taak X (prio 900, 1 wd, ma) bezet maandag, taak Y (prio 100, 1 wd,
// wil ma) moet naar dinsdag wijken. Taak Z (ongerelateerd, 5 wd, geen resource) rekt Y's EIGEN
// float op tot vrijdag, zodat de verschuiving naar dinsdag ruim binnen beide vensters past.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-ceiling: plafond 0 gedraagt zich als constrainToFloat (geval 1) --');
{
  const taskX = task('x', '2026-06-01', '2026-06-01', 1, { priority: 900 });
  const taskY = task('y', '2026-06-01', '2026-06-01', 1, { priority: 100 });
  const taskZ = task('z', '2026-06-01', '2026-06-05', 5, { priority: 500 }); // rekt Y's float op
  const resourceR = res('r-ceiling1', 1);
  const assignments = [assign('x-r', 'x', 'r-ceiling1', 1), assign('y-r', 'y', 'r-ceiling1', 1)];
  const cpmResult = stubCpmResult('2026-06-05');

  const rCeiling0 = levelResources(
    [taskX, taskY, taskZ], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult,
    { constrainToFloat: false, overrunCeilingDays: 0 },
  );
  const rConstrainFloat = levelResources(
    [taskX, taskY, taskZ], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult,
    { constrainToFloat: true },
  );

  ok('vooronderstelling: Y verschuift daadwerkelijk (geen triviale no-op)', rCeiling0.delays['y'] === 1);
  ok('vooronderstelling: geen onopgelost conflict (anders test dit geval de reden-taxonomie, niet de plaatsing)',
    Object.keys(rCeiling0.unresolved).length === 0);
  eq('plafond 0 gedraagt zich als constrainToFloat', JSON.stringify(rCeiling0), JSON.stringify(rConstrainFloat));
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 2: plafond N laat precies N werkdagen uitloop toe. Resource R (cap 1); taak A (prio 900,
// 3 wd, ma-wo) bezet alle drie de dagen; taak B (prio 100, 1 wd, ES ma) draagt een deadline op
// haar EIGEN vroege finish (ma) — dat pint haar `lateFinish`/`lateStart` op ma (float 0), zonder
// een tweede taak nodig te hebben. B moet 3 werkdagen wijken (ma → do) om A te ontlopen.
//   - plafond 2 ⇒ venster = lateStart + 2 = wo: past NIET (do ligt erna) ⇒ CEILING_TOO_TIGHT.
//   - plafond 3 ⇒ venster = lateStart + 3 = do: past PRECIES.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-ceiling: plafond N laat precies N werkdagen uitloop toe (geval 2) --');
{
  const taskA = task('a2', '2026-06-01', '2026-06-03', 3, { priority: 900 });
  const taskB = task('b2', '2026-06-01', '2026-06-01', 1, { priority: 100, deadline: '2026-06-01' });
  const resourceR = res('r-ceiling2', 1);
  const assignments = [assign('a2-r', 'a2', 'r-ceiling2', 1), assign('b2-r', 'b2', 'r-ceiling2', 1)];
  const cpmResult = stubCpmResult('2026-06-03');

  const r2 = levelResources(
    [taskA, taskB], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult,
    { constrainToFloat: false, overrunCeilingDays: 2 },
  );
  ok('plafond 2 ⇒ B onopgelost', (r2.unresolved['b2']?.length ?? 0) > 0);
  eq('plafond 2 ⇒ reden CEILING_TOO_TIGHT', r2.unresolvedReasons['b2'], 'CEILING_TOO_TIGHT');

  const r3 = levelResources(
    [taskA, taskB], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult,
    { constrainToFloat: false, overrunCeilingDays: 3 },
  );
  eq('plafond 3 ⇒ B past precies (delay 3)', r3.delays['b2'], 3);
  ok('plafond 3 ⇒ geen onopgelost conflict', Object.keys(r3.unresolved).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 3: een deadline ver in het verleden duwt taak C's `lateStart` ver VÓÓR haar
// precedence-feasible start — zelfs een "ruim" plafond (5 werkdagen) reikt dan niet tot haar PF.
// Om de scan daadwerkelijk te laten zoeken (i.p.v. meteen op haar eigen PF te passen — de
// PF-dag zelf wordt altijd geprobeerd, ongeacht het venster) bezet taak D (hogere prioriteit)
// C's PF-dag eerst: C moet dus VERDER zoeken, en die zoektocht loopt onmiddellijk tegen het
// (allang gepasseerde) plafond-venster aan.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-ceiling: onbereikbaar plafond door een deadline (geval 3) --');
{
  const taskD = task('d3', '2026-06-01', '2026-06-01', 1, { priority: 900 });
  const taskC = task('c3', '2026-06-01', '2026-06-01', 1, { priority: 100, deadline: '2026-04-01' });
  const resourceR = res('r-ceiling3', 1);
  const assignments = [assign('d3-r', 'd3', 'r-ceiling3', 1), assign('c3-r', 'c3', 'r-ceiling3', 1)];
  const cpmResult = stubCpmResult('2026-06-01');

  const r4 = levelResources(
    [taskD, taskC], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult,
    { constrainToFloat: false, overrunCeilingDays: 5 },
  );
  eq('D (hoogste prioriteit) plaatst op haar eigen PF, geen delay', r4.delays['d3'], undefined);
  eq('onbereikbaar plafond door constraint ⇒ eigen reden', r4.unresolvedReasons['c3'], 'CEILING_UNREACHABLE');
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  leveler-ceiling: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  leveler-ceiling: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
