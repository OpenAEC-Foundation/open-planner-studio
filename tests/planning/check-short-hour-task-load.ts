// check-short-hour-task-load.ts — een urentaak korter dan één werkdag draagt belasting.
//
// `distributeUnits` gaf voor een duur strikt tussen 0 en 1 werkdag een LEGE array terug. Een
// urentaak van 5 uur op een 8-urige dag (`scheduleDuration` 0,625) boekte daardoor niets in het
// histogram, telde niet mee voor overbezetting en bestond niet voor de nivelleerder — tenzij de
// toewijzing toevallig opgeslagen werk of een eigen contour had (die lagen in `assignmentDayUnits`
// boekten wél 0,625). Nu valt het hele werk op die ene dag, als fractie: inzet × duur.
//
// Drie groepen: (a) `distributeUnits` zelf, (b) `computeResourceLoad` (histogram + overbezetting),
// (c) `levelResources` ziet het conflict tussen twee korte urentaken en lost het op.
//
// Draait via run.sh. Exit 0 = alles groen.

import { distributeUnits, computeResourceLoad } from '@/engine/scheduler/ResourceLoad';
import { levelResources } from '@/engine/scheduler/ResourceLeveler';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
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

const PROJECT_CAL: WorkCalendar = {
  id: 'cal-short-hours', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

/** Urentaak van `minutes` werkminuten die op één dag valt (8-urige dag ⇒ duur = minuten / 480). */
function hourTask(id: string, day: string, minutes: number, extra?: Partial<Task>): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'hours', durationMinutes: minutes,
      scheduleDuration: minutes / 480,
      scheduleStart: day, scheduleFinish: day,
      earlyStart: day, earlyFinish: day, lateStart: day, lateFinish: day,
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    ...extra,
  };
}

function res(id: string, maxUnits = 1): Resource {
  return { id, name: id, type: 'EQUIPMENT', description: '', maxUnits };
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
// (a) distributeUnits: 0 < D < 1 ⇒ één slot met inzet × D; D = 0 blijft leeg.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- short-hour-task-load: distributeUnits --');
eq('5 uur op een 8-urige dag, inzet 1 ⇒ [0,625]', distributeUnits(1, 0.625), [0.625]);
eq('4 uur, inzet 2 ⇒ [1]', distributeUnits(2, 0.5), [1]);
eq('de curve maakt voor één slot niets uit (BELL)', distributeUnits(1, 0.625, 'BELL'), [0.625]);
eq('de curve maakt voor één slot niets uit (TURTLE)', distributeUnits(1, 0.625, 'TURTLE'), [0.625]);
eq('fractionele inzet blijft exact (0,5 × 0,25)', distributeUnits(0.5, 0.25), [0.125]);
eq('D = 1 ongewijzigd', distributeUnits(1, 1), [1]);
eq('D = 0 (mijlpaal) levert niets', distributeUnits(1, 0), []);

// ═══════════════════════════════════════════════════════════════════════════
// (b) computeResourceLoad: de korte urentaak staat in het histogram en telt mee voor overbezetting.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- short-hour-task-load: histogram en overbezetting --');
{
  const kraan = res('r-kraan', 1);
  const vloer = hourTask('t-vloer', '2026-06-01', 300);
  const r1 = computeResourceLoad([kraan], [assign('a-vloer', 't-vloer', 'r-kraan', 1)], [vloer], PROJECT_CAL, []);
  eq('één taak van 5 u boekt 0,625 op zijn dag', r1.load['r-kraan']?.['2026-06-01'], 0.625);
  eq('en boekt op geen andere dag', Object.keys(r1.load['r-kraan'] ?? {}), ['2026-06-01']);
  eq('onder de capaciteit: geen overbezetting', r1.overallocatedDays['r-kraan'] ?? [], []);

  const trap = hourTask('t-trap', '2026-06-01', 300);
  const r2 = computeResourceLoad(
    [kraan],
    [assign('a-vloer', 't-vloer', 'r-kraan', 1), assign('a-trap', 't-trap', 'r-kraan', 1)],
    [vloer, trap], PROJECT_CAL, [],
  );
  eq('twee taken van 5 u op dezelfde dag tellen op tot 1,25', r2.load['r-kraan']?.['2026-06-01'], 1.25);
  eq('en de kraan is die dag overbezet', r2.overallocatedDays['r-kraan'] ?? [], ['2026-06-01']);
}

// ═══════════════════════════════════════════════════════════════════════════
// (c) levelResources: het conflict tussen twee korte urentaken wordt gezien en opgelost.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- short-hour-task-load: nivelleren --');
{
  const kraan = res('r-kraan-lvl', 1);
  const a = hourTask('t-a', '2026-06-01', 300, { priority: 900 });
  const b = hourTask('t-b', '2026-06-01', 300, { priority: 100 });
  const result = levelResources(
    [a, b], [], [kraan],
    [assign('a-a', 't-a', 'r-kraan-lvl', 1), assign('a-b', 't-b', 'r-kraan-lvl', 1)],
    PROJECT_CAL, [], stubCpmResult('2026-06-05'),
    { constrainToFloat: false }, legacyCpmOptions(),
  );
  eq('de taak met de lage prioriteit schuift één werkdag op', result.shifts['t-b']?.delta, 1);
  eq('de taak met de hoge prioriteit blijft staan', result.shifts['t-a']?.delta ?? 0, 0);
  eq('er blijft geen onopgelost conflict over', Object.keys(result.unresolved), []);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  short-hour-task-load: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  short-hour-task-load: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
