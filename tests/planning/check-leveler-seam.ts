// check-leveler-seam.ts — B1c-plan-2 taak 5: de meelezers van `capacityOf` stellen een EERLIJKE
// diagnose (spec §4, "De naad in de nivelleerder"). Drie gevallen, alle drie vóór deze ronde fout:
//  1. nul CAPACITEIT (een resource die werkt maar niets te bieden heeft) is geen kalender-mismatch.
//  2. een ECHTE kalender-mismatch (resource werkt niet op de dagen die de taak nodig heeft) blijft
//     wél CALENDAR_MISMATCH.
//  3. de conflictverzamelaar in `findSlot` mist de nul-guard die `fits` al had — een dag zonder
//     vraag (curve-nul) mag nooit als conflictdag verschijnen, ook niet als een ANDERE (pinned)
//     taak die dag toevallig overboekt.
//
// Helperstijl gekopieerd uit `check-leveler-splits.ts`/`check-leveler-scope.ts`/
// `check-leveler-ceiling.ts`.
//
// Draait via run.sh. Exit 0 = alles groen.

import { levelResources } from '@/engine/scheduler/ResourceLeveler';
import { distributeUnits } from '@/engine/scheduler/ResourceLoad';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
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
  id: 'cal-project-leveler-seam', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

// Werkt uitsluitend op zaterdag — voor geval 2 (echte kalender-mismatch).
const SATURDAY_ONLY_CAL: WorkCalendar = {
  id: 'cal-saturday-only-seam', name: 'zaterdag-alleen', description: '', workDays: [6],
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

function assign(
  id: string, taskId: string, resourceId: string, unitsPerDay: number, curve: ResourceCurve = 'UNIFORM',
): ResourceAssignment {
  return { id, taskId, resourceId, unitsPerDay, curve };
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
// Geval 1: nul CAPACITEIT is geen kalender-mismatch. Resource R op de gewone ma-vr-kalender, maar
// met `availabilitySteps` die `maxUnits` vanaf 06-01 op 0 zetten (en géén stap die 'm later weer
// optrekt — dus 0 blijft gelden over de volledige scanhorizon). De resource WERKT op die dagen
// (isResWorkDay), hij heeft alleen niets te bieden. `maxCapacityOf` blijft 1 (het hoogste punt over
// alle stappen, ook al geldt het nu niet meer) — dus geen INTRINSIC_OVERRUN. De scan loopt daardoor
// leeg: NO_WINDOW_IN_HORIZON, niet CALENDAR_MISMATCH.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-seam: nul capaciteit is geen kalender-mismatch (geval 1) --');
{
  const taskA = task('a1', '2026-06-01', '2026-06-01', 1, { priority: 500 });
  const resourceR = res('r-seam1', 1, { availabilitySteps: [{ from: '2026-06-01', maxUnits: 0 }] });
  const assignments = [assign('a1-r', 'a1', 'r-seam1', 1)];
  const cpmResult = stubCpmResult('2026-06-01');

  const r1 = levelResources(
    [taskA], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, { constrainToFloat: false },
  );
  ok('geen slot', (r1.unresolved['a1']?.length ?? 0) > 0);
  ok('reden is NIET CALENDAR_MISMATCH', r1.unresolvedReasons['a1'] !== 'CALENDAR_MISMATCH');
  eq('reden is de eerlijke horizon-uitputting', r1.unresolvedReasons['a1'], 'NO_WINDOW_IN_HORIZON');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 2: een ECHTE kalender-mismatch blijft CALENDAR_MISMATCH. Resource R op een kalender die
// alleen zaterdag werkt; taak A op de ma-vr-projectkalender (geen eigen `calendarId`) — geen enkele
// kandidaatdag van A is ooit een werkdag voor R.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-seam: een echte kalender-mismatch blijft herkend (geval 2) --');
{
  const taskA = task('a2', '2026-06-01', '2026-06-01', 1, { priority: 500 });
  const resourceR = res('r-seam2', 1, { calendarId: 'cal-saturday-only-seam' });
  const assignments = [assign('a2-r', 'a2', 'r-seam2', 1)];
  const cpmResult = stubCpmResult('2026-06-01');

  const r2 = levelResources(
    [taskA], [], [resourceR], assignments, PROJECT_CAL, [SATURDAY_ONLY_CAL], cpmResult,
    { constrainToFloat: false },
  );
  eq('echte mismatch blijft herkend', r2.unresolvedReasons['a2'], 'CALENDAR_MISMATCH');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 3: nul-guard in de conflictverzamelaar. Taak Y (6 werkdagen, BACK_LOADED-curve,
// unitsPerDay 1) heeft op haar EIGEN eerste dag (maandag) een curve-vraag van 0 — geverifieerd
// hieronder met `distributeUnits` zelf, niet aangenomen. Taak Z (vastgepind, priority 1000, dus
// ONVOORWAARDELIJK boekend — geen capaciteitscheck) claimt diezelfde maandag met 2 eenheden op een
// resource met capaciteit 1: een ECHTE overboeking, maar niet DOOR Y (die vraagt daar niets).
// Y kan nergens terecht (haar staartvraag van 2/dag past nooit binnen capaciteit 1) en valt terug
// op de conflictverzamelaar — die mag maandag NIET als conflictdag voor Y noemen: er is niets van Y
// te boeken, dus niets van Y dat kan botsen.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-seam: nul-guard in de conflictverzamelaar (geval 3) --');
{
  const curveArr = distributeUnits(1, 6, 'BACK_LOADED');
  ok('vooronderstelling: distributeUnits levert een 0 op de eerste dag (BACK_LOADED, 1/dag, 6 dagen)',
    curveArr[0] === 0);

  const taskZ = task('z5', '2026-06-01', '2026-06-01', 1, { priority: 1000 }); // vastgepind
  const taskY = task('y5', '2026-06-01', '2026-06-08', 6, { priority: 500 });

  const resourceR = res('r-seam3', 1);
  const assignments = [
    assign('z5-r', 'z5', 'r-seam3', 2), // pinned, boekt onvoorwaardelijk 2 eenheden op maandag — cap is 1
    assign('y5-r', 'y5', 'r-seam3', 1, 'BACK_LOADED'),
  ];
  const cpmResult = stubCpmResult('2026-06-08');

  const r3 = levelResources(
    [taskZ, taskY], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, { constrainToFloat: false },
  );

  ok('Y is onopgelost (haar staartvraag past nergens binnen capaciteit 1)',
    (r3.unresolved['y5']?.length ?? 0) > 0);
  ok('geen fantoom-conflictdag op maandag (Y vraagt daar 0) ondanks de echte overboeking dóór Z',
    !r3.unresolved['y5']?.includes('2026-06-01'));
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  leveler-seam: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  leveler-seam: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
