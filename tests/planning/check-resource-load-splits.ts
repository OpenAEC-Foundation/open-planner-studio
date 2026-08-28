// check-resource-load-splits.ts — computeResourceLoad wordt split- en taakkalender-bewust
// (B1c-W0.1). Twee groepen:
//
// (a) Splits: pauzedagen dragen geen last. `computeResourceLoad` mapte de curve-array vóór deze
//     wijziging op AANEENGESLOTEN werkdagen van de projectkalender tussen earlyStart/earlyFinish
//     (`enumerateWorkDays`) — dat slaat de `splitGaps`-pauzedagen van de taak zelf niet over, dus
//     een gesplitste taak boekte ten onrechte op de pauzedag. Referentiegeval identiek aan
//     `check-split-walk.ts`: taak 06-01..06-05, twee gaten van 1 werkdag na resp. dag 1 en
//     aspositie 1440 ⇒ de taak werkt op 06-01/06-03/06-05, niet op 06-02/06-04.
//
// (b) Taakkalender: de dag-mapping moet de kalender van de TAAK volgen (dezelfde engine als de CPM-
//     duur/splits, `CPMSolver.calendarFor`/`resolveCalendar`), niet onvoorwaardelijk de project-
//     kalender. Een taak op een 6-daagse kalender (zaterdag werkdag) moet dus ook op zaterdag boeken.
//
// Draait via run.sh. Exit 0 = alles groen.

import { computeResourceLoad } from '@/engine/scheduler/ResourceLoad';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

// Projectkalender: ma-vr, 8u/dag — zelfde vorm als `check-split-walk.ts`s `DAY_CAL`.
const PROJECT_CAL: WorkCalendar = {
  id: 'cal-project', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

/** Leaf-taak met doorgerekende datums (earlyStart/earlyFinish sturen de dag-mapping), zelfde
 *  veldvorm als `tests/library/check-occupancy.ts`s `task()`. */
function task(id: string, earlyStart: string, earlyFinish: string, durationDays: number, extra?: Partial<Task>): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', scheduleDuration: durationDays,
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

// ═══════════════════════════════════════════════════════════════════════════
// (a) Splits: pauzedagen dragen geen last.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- resource-load-splits: splits slaan pauzedagen over --');
{
  const taskA = task('t-a', '2026-06-01', '2026-06-05', 3, {
    splitGaps: [
      { afterMinutes: 480, gapMinutes: 480 },
      { afterMinutes: 1440, gapMinutes: 480 },
    ],
  });
  const resourceR = res('r-a', 1);
  const assignments = [assign('a-a', 't-a', 'r-a', 1)];

  const result = computeResourceLoad([resourceR], assignments, [taskA], PROJECT_CAL, []);
  const daily = result.load['r-a'] ?? {};

  eq('06-01 belast met 1', daily['2026-06-01'], 1);
  eq('06-03 belast met 1', daily['2026-06-03'], 1);
  eq('06-05 belast met 1', daily['2026-06-05'], 1);
  eq('06-02 (pauzedag) draagt geen last', daily['2026-06-02'], undefined);
  eq('06-04 (pauzedag) draagt geen last', daily['2026-06-04'], undefined);
  eq('geen extra dagen dan de drie werkdagen', Object.keys(daily).sort(), ['2026-06-01', '2026-06-03', '2026-06-05']);
}

// ═══════════════════════════════════════════════════════════════════════════
// (b) Taakkalender: de last volgt de kalender van de taak, niet de projectkalender.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- resource-load-splits: taak met eigen (6-daagse) kalender --');
{
  // 6-daagse kalender: ma-za werkdagen (za = 6 is werkdag, zo = 7 is vrij).
  const SIX_DAY_CAL: WorkCalendar = {
    id: 'cal-six-day', name: 'zesdaags', description: '', workDays: [1, 2, 3, 4, 5, 6],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  };
  // Taak B: 3 werkdagen vanaf vrijdag 2026-06-05 op de 6-daagse kalender ⇒ vr 06-05, za 06-06
  // (projectkalender zou hier overslaan), ma 06-08 (zondag 06-07 is vrij ook op de 6-daagse
  // kalender). earlyFinish ruim genomen zodat de projectkalender-mapping (als de fix zou
  // ontbreken) niet toevallig dezelfde dagen zou opleveren.
  const taskB = task('t-b', '2026-06-05', '2026-06-09', 3, { calendarId: 'cal-six-day' });
  const resourceR = res('r-b', 1);
  const assignments = [assign('a-b', 't-b', 'r-b', 1)];

  const result = computeResourceLoad([resourceR], assignments, [taskB], PROJECT_CAL, [SIX_DAY_CAL]);
  const daily = result.load['r-b'] ?? {};

  eq('vr 06-05 belast met 1', daily['2026-06-05'], 1);
  eq('za 06-06 (werkdag op de taakkalender) belast met 1', daily['2026-06-06'], 1);
  eq('ma 06-08 belast met 1', daily['2026-06-08'], 1);
  eq('di 06-09 draagt geen last (duur al verbruikt)', daily['2026-06-09'], undefined);
  eq('zo 06-07 draagt geen last (vrij, ook op de taakkalender)', daily['2026-06-07'], undefined);
  eq('geen extra dagen dan de drie werkdagen', Object.keys(daily).sort(), ['2026-06-05', '2026-06-06', '2026-06-08']);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  resource-load-splits: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  resource-load-splits: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
