// check-resource-load-reasons.ts (R1) — `computeResourceLoad` levert sinds deze wijziging naast
// `overallocatedDays` ook `overallocatedReasons`: per overbezette dag WAAROM die dag rood staat.
// Twee redenen, gescheiden getoetst zodat de één de ander niet kan maskeren:
//
//  - `non-working-day`: de RESOURCEkalender kent die dag geen werkdag (capaciteit 0), terwijl de
//    taak — op haar EIGEN (project-)kalender — die dag gewoon doorwerkt. Dit is het scenario uit
//    het docblok-punt 4 in `ResourceLoad.ts`: een taakkalender-/resourcekalender-mismatch, geen
//    "gewone" overvraag.
//  - `over-capacity`: de resource werkt die dag wél (kalender staat het toe), maar de gevraagde
//    inzet overschrijdt zijn capaciteit (>0) — het bestaande, ongewijzigde gedrag.
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
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

// Projectkalender: ma-vr, 8u/dag — zelfde vorm als `check-resource-load-splits.ts`s `PROJECT_CAL`.
const PROJECT_CAL: WorkCalendar = {
  id: 'cal-project', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

// Resourcekalender zonder woensdag: ma, di, do, vr (3 = woensdag is GEEN werkdag).
const NO_WEDNESDAY_CAL: WorkCalendar = {
  id: 'cal-no-wednesday', name: 'Zonder woensdag', description: '', workDays: [1, 2, 4, 5],
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

// ═══════════════════════════════════════════════════════════════════════════
// (a) non-working-day: resource met een kalender zonder woensdag, taak op de projectkalender
//     (ma-vr) over die woensdag heen.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- resource-load-reasons: non-working-day (resourcekalender kent de dag geen werkdag) --');
{
  // Taak T1: ma 2026-06-01 t/m vr 2026-06-05, 5 werkdagen op de PROJECTkalender (geen calendarId).
  const taskA = task('t-a', '2026-06-01', '2026-06-05', 5);
  // Resource A op haar eigen kalender (geen woensdag). unitsPerDay == maxUnits, dus op elke
  // ECHTE werkdag van de resource past de vraag exact — alleen woensdag (capaciteit 0) knapt.
  const resourceA = res('r-a', 1, { calendarId: 'cal-no-wednesday' });
  const assignments = [assign('a-a', 't-a', 'r-a', 1)];

  const result = computeResourceLoad([resourceA], assignments, [taskA], PROJECT_CAL, [NO_WEDNESDAY_CAL]);

  eq('woensdag 06-03 is de enige overbezette dag',
    result.overallocatedDays['r-a'], ['2026-06-03']);
  eq('reden op woensdag is non-working-day',
    result.overallocatedReasons['r-a']?.['2026-06-03'], 'non-working-day');
  eq('geen redenen op de andere (werkende) dagen',
    Object.keys(result.overallocatedReasons['r-a'] ?? {}), ['2026-06-03']);
  eq('capaciteit op woensdag is 0 (geen werkdag op de resourcekalender)',
    result.capacity['r-a']?.['2026-06-03'], 0);
  ok('load op woensdag > 0 (de taak werkt die dag gewoon door)',
    (result.load['r-a']?.['2026-06-03'] ?? 0) > 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// (b) over-capacity: resource op de projectkalender, dubbele inzet t.o.v. maxUnits.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- resource-load-reasons: over-capacity (inzet groter dan capaciteit > 0) --');
{
  const taskB = task('t-b', '2026-06-01', '2026-06-05', 5);
  // Resource B op de projectkalender (geen calendarId ⇒ valt terug op de projectkalender), maar de
  // toewijzing vraagt het dubbele van maxUnits: elke werkdag is dus over-capacity, nooit non-working.
  const resourceB = res('r-b', 1);
  const assignments = [assign('a-b', 't-b', 'r-b', 2)];

  const result = computeResourceLoad([resourceB], assignments, [taskB], PROJECT_CAL, []);

  const expectedDays = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];
  eq('alle vijf werkdagen zijn overbezet', result.overallocatedDays['r-b'], expectedDays);
  for (const iso of expectedDays) {
    eq(`reden op ${iso} is over-capacity`, result.overallocatedReasons['r-b']?.[iso], 'over-capacity');
  }
  ok('geen enkele dag met reden non-working-day',
    !Object.values(result.overallocatedReasons['r-b'] ?? {}).includes('non-working-day'));
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  resource-load-reasons: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  resource-load-reasons: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
