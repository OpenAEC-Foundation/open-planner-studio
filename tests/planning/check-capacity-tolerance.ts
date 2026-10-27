// check-capacity-tolerance.ts — rekenruis in de belasting is geen overbezetting.
//
// Een taak met inzet 1 en opgeslagen restwerk van precies inzet × restduur (72 u over 9 dagen van
// 8 u) boekt door de omrekening minuten → eenheden → vormgewichten 1,0000000000000004 op een dag.
// Een strikte `load > capaciteit` meldde dan "1 resource(s) overbezet" in de statusbalk. Nu loopt
// elke vergelijking via `exceedsCapacity` (`capacityTolerance.ts`), met één marge van 1e-9.
//
// Groepen: (a) de helper zelf, met de grens van 1 minuut per dag; (b) `computeResourceLoad`
// (statusbalk, histogram, resourcepaneel); (c) `computeHistogramReport` (MCP-leestool en rapport);
// (d) de nivelleerder ziet geen fantoomconflict; (e) echte overbezetting van 1 minuut per dag telt.
//
// Draait via run.sh. Exit 0 = alles groen.

import { computeResourceLoad, computeHistogramReport } from '@/engine/scheduler/ResourceLoad';
import { CAPACITY_EPS, exceedsCapacity } from '@/engine/scheduler/capacityTolerance';
import { levelResources } from '@/engine/scheduler/ResourceLeveler';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { legacyCpmOptions } from './legacySolveOptions';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

const CAL: WorkCalendar = {
  id: 'cal-tol', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const MPD = 480;
// 9 werkdagen: ma 1 juni t/m do 11 juni 2026.
const START = '2026-06-01';
const FINISH = '2026-06-11';
const DAYS = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05',
  '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11'];

function dayTask(id: string, extra?: Partial<Task>): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 9,
      scheduleStart: START, scheduleFinish: FINISH,
      earlyStart: START, earlyFinish: FINISH, lateStart: START, lateFinish: FINISH,
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    ...extra,
  };
}
const res = (id: string, maxUnits = 1): Resource => ({ id, name: id, type: 'LABOR', description: '', maxUnits });
const assign = (id: string, taskId: string, resourceId: string, unitsPerDay: number, remainingWorkMinutes?: number): ResourceAssignment =>
  ({ id, taskId, resourceId, unitsPerDay, curve: 'UNIFORM', ...(remainingWorkMinutes !== undefined ? { remainingWorkMinutes } : {}) });

function stubCpmResult(projectEnd: string): CPMResult {
  return {
    tasks: new Map(), criticalPath: [], drivingSequenceIds: [], sequenceFreeFloat: {},
    truncatedLeadSequenceIds: [], violatedConstraintTaskIds: [], missedDeadlineTaskIds: [],
    outOfSequenceSequenceIds: [], nearCriticalTaskIds: [], criticalPaths: [], floatPathByTask: {},
    hammockNoFinishDriverTaskIds: [], projectEnd, projectDuration: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// (a) de helper: ruis telt niet, 1 minuut per dag wel (ook op een dag van 24 u).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- capacity-tolerance: helper --');
eq('marge is 1e-9', CAPACITY_EPS, 1e-9);
eq('1,0000000000000004 tegen 1 is geen overbezetting', exceedsCapacity(1.0000000000000004, 1), false);
eq('gelijk is geen overbezetting', exceedsCapacity(1, 1), false);
eq('1 minuut op een dag van 8 u is overbezetting', exceedsCapacity(1 + 1 / 480, 1), true);
eq('1 minuut op een dag van 24 u is overbezetting', exceedsCapacity(1 + 1 / 1440, 1), true);
eq('1 minuut op capaciteit 1000 (24-uursdag) is overbezetting', exceedsCapacity(1000 + 1 / 1440, 1000), true);
eq('belasting op capaciteit 0 is overbezetting', exceedsCapacity(1 / 1440, 0), true);

// ═══════════════════════════════════════════════════════════════════════════
// (b) computeResourceLoad: 72 u restwerk over 72 werkuren ⇒ geen overbezetting.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- capacity-tolerance: computeResourceLoad --');
const timmerman = res('r-tim', 1);
const taak = dayTask('t-ruis');
const ruisAssign = assign('a-ruis', 't-ruis', 'r-tim', 1, 9 * MPD);
{
  const r = computeResourceLoad([timmerman], [ruisAssign], [taak], CAL, [], effectiveSchedulingOptions({}));
  const loads = DAYS.map(d => r.load['r-tim']?.[d] ?? 0);
  // Voorwaarde: de ruis bestaat echt. Zonder ruis bewijst deze check niets.
  eq('voorwaarde: minstens één dag boekt strikt meer dan 1 (rekenruis)', loads.some(l => l > 1), true);
  eq('voorwaarde: de ruis is kleiner dan de marge', loads.every(l => l - 1 < CAPACITY_EPS), true);
  eq('geen overbezette dagen', r.overallocatedDays['r-tim'] ?? [], []);
  eq('geen overbezette resources (statusbalk)', Object.values(r.overallocatedDays).filter(d => d.length > 0).length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// (c) computeHistogramReport (MCP planner_resource_histogram + rapport): idem.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- capacity-tolerance: computeHistogramReport --');
{
  const rep = computeHistogramReport({
    tasks: [taak], sequences: [], assignments: [ruisAssign], resources: [timmerman],
    calendar: CAL, calendars: [], cpmResult: null, bucket: 'dag', schedulingOptions: effectiveSchedulingOptions({}),
  });
  const over = rep.resources.flatMap(r => r.buckets.flatMap(b => b.overallocatedDays));
  eq('histogramrapport: geen overbezette dagen', over, []);
}

// ═══════════════════════════════════════════════════════════════════════════
// (d) de nivelleerder ziet geen fantoomconflict.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- capacity-tolerance: nivelleren --');
{
  const result = levelResources(
    [taak], [], [timmerman], [ruisAssign], CAL, [], stubCpmResult(FINISH),
    { constrainToFloat: false }, legacyCpmOptions(),
  );
  eq('niets geschoven', Object.keys(result.shifts), []);
  eq('geen onopgelost conflict', Object.keys(result.unresolved), []);
}

// ═══════════════════════════════════════════════════════════════════════════
// (e) echte overbezetting van 1 minuut per dag telt nog.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- capacity-tolerance: echte overbezetting van 1 minuut per dag --');
{
  const klein = dayTask('t-klein');
  const assigns = [ruisAssign, assign('a-klein', 't-klein', 'r-tim', 1 / MPD, 9)];
  const r = computeResourceLoad([timmerman], assigns, [taak, klein], CAL, [], effectiveSchedulingOptions({}));
  eq('alle 9 dagen overbezet', r.overallocatedDays['r-tim'] ?? [], DAYS);
  const rep = computeHistogramReport({
    tasks: [taak, klein], sequences: [], assignments: assigns, resources: [timmerman],
    calendar: CAL, calendars: [], cpmResult: null, bucket: 'dag', schedulingOptions: effectiveSchedulingOptions({}),
  });
  eq('histogramrapport: alle 9 dagen overbezet',
    rep.resources.flatMap(x => x.buckets.flatMap(b => b.overallocatedDays)).sort(), DAYS);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  capacity-tolerance: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  capacity-tolerance: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
