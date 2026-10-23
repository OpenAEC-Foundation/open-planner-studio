// F3c fixronde 1 (review #581 ronde 1, BLOKKEERT): één betekenis voor de split-as.
//
// `Task.splitGaps` (en een contour) liggen op de cumulatieve as van de taak, in de maat van de taak:
//  - urenmaat (een urentaak, of een dagtaak onder P6/MSP): werkminuten op de kalender;
//  - dagenmaat (OPS, §3.14): dagslots van `werktijd per dag × 60`; elke werkdag telt 1, hoe lang ook.
// Zo lezen de solver (`splitTotalSpanDays` + de dagenmaat-lopers), de Gantt (`computeSplitSegments` met
// `'workdays'`, knownbug 242) en de splitsbewerking (dagslotcontract) de as al. De gedeelde plaatsing
// (`workPlacement.ts`) liep de gaten van een dagenmaat-taak fysiek: een gat van 480 min op een korte
// vrijdag (6 u) liep dan door tot ma 09:00, en de belasting stond nog na het einde van de solver.
//
// De check meet per geval drie lezers tegen elkaar: het einde van de solver = het einde van de plaatsing,
// geen belasting na dat einde, en per dag dezelfde werkminuten als de Gantt-stukken.
// Draait via run.sh. Exit 0 = alles groen.

import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { solveProject } from '@/engine/scheduler/solveProject';
import { taskWorkPlacement, workPlacement } from '@/engine/scheduler/workPlacement';
import { computeSplitSegments } from '@/engine/scheduler/splitWalk';
import { assignmentLoadOnPlacement } from '@/engine/scheduler/ResourceLoad';
import { levelResources } from '@/engine/scheduler/ResourceLeveler';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { addCalendarDays, formatDate, parseInstant, utcDayStart } from '@/utils/dateUtils';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Task, TaskSplitGap } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { EffectiveSchedulingOptions } from '@/types/project';

let checks = 0;
const failures: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}
const r6 = (n: number): number => Math.round(n * 1e6) / 1e6;

// De kalender uit de review: ma–do 07–15 (8 u), vr 07–13 (6 u).
const long = [{ start: 420, end: 900 }];
const CAL: WorkCalendar = {
  id: 'kort-vr', name: 'kort-vr', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: { 1: long, 2: long, 3: long, 4: long, 5: [{ start: 420, end: 780 }], 6: [], 7: [] } },
};
const OPS = effectiveSchedulingOptions({});
const P6 = effectiveSchedulingOptions({ schedulingProfile: { baseId: 'p6', id: 'p6', name: 'P6', overrides: {} } });

function task(id: string, start: string, days: number, gaps?: TaskSplitGap[]): Task {
  return {
    id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: ['r'],
    time: { ...createDefaultTaskTime(start, days), durationUnit: 'days' },
    ...(gaps ? { splitGaps: gaps } : {}),
  };
}

/** Werkminuten per dag van de Gantt-stukken (`computeSplitSegments`). */
function segmentMinutesPerDay(eng: CalendarEngine, t: Task, measure: true | 'workdays'): Record<string, number> {
  const es = parseInstant(t.time.earlyStart!);
  const ef = parseInstant(t.time.earlyFinish!);
  const out: Record<string, number> = {};
  for (const s of computeSplitSegments(t.splitGaps, es, ef, measure, eng)) {
    for (let d = utcDayStart(s.start); d < s.end; d = addCalendarDays(d, 1)) {
      const next = addCalendarDays(d, 1);
      const a = new Date(Math.max(s.start.getTime(), d.getTime()));
      const b = new Date(Math.min(s.end.getTime(), next.getTime()));
      const m = b > a ? eng.workMinutesBetween(a, b) : 0;
      if (m > 0) out[formatDate(d)] = (out[formatDate(d)] ?? 0) + m;
    }
  }
  return out;
}

interface Expect { finish: string; days: Array<[string, number]> }

function measureCase(label: string, profile: 'ops' | 'p6', t: Task, expected: Expect): void {
  const options: EffectiveSchedulingOptions = profile === 'ops' ? OPS : P6;
  const result = solveProject({ tasks: [t], sequences: [], calendar: CAL, calendars: [], schedulingOptions: options });
  eq(`${label} [${profile}]: geen solverfout`, result.error ?? null, null);
  const eng = new CalendarEngine(CAL);
  const recipe = taskWorkPlacement(t, eng, options);
  if (!recipe) { eq(`${label} [${profile}]: plaatsing`, null, 'plaatsing'); return; }
  const placed = workPlacement(eng, recipe);
  const ef = parseInstant(t.time.earlyFinish!);
  eq(`${label} [${profile}]: einde solver`, t.time.earlyFinish, expected.finish);
  eq(`${label} [${profile}]: einde plaatsing = einde solver`, placed.finish.getTime(), ef.getTime());
  eq(`${label} [${profile}]: geen belasting na het einde`,
    placed.days.filter(d => d.iso > formatDate(ef)).map(d => d.iso), []);
  eq(`${label} [${profile}]: dagen en deel per dag`, placed.days.map(d => [d.iso, r6(d.share)]), expected.days);
  const total = placed.days.reduce((sum, d) => sum + d.share, 0);
  eq(`${label} [${profile}]: het werk blijft ${t.time.scheduleDuration} d`,
    r6(profile === 'ops' ? total : total * 480 / 480), r6(profile === 'ops' ? t.time.scheduleDuration
      : placed.days.reduce((sum, d) => sum + d.minutes, 0) / 480));
  const perDay = Object.fromEntries(placed.days.map(d => [d.iso, d.minutes]));
  eq(`${label} [${profile}]: werkminuten per dag = Gantt-stukken`, perDay,
    segmentMinutesPerDay(eng, t, profile === 'ops' ? 'workdays' : true));
}

// ── Geval 1: het geval uit de review. 3 d vanaf do 4 jun 07:00, gat van 480 min na 480 min. ──────
// Dagenmaat: 480 min = één werkdag, dus de pauze is de hele vrijdag; einde di 9 jun 15:00.
// Urenmaat (P6): 480 werkminuten pauze = vr 6 u + ma 2 u; einde wo 10 jun 09:00.
measureCase('gat 480 na 480', 'ops', task('g1', '2026-06-04T07:00', 3, [{ afterMinutes: 480, gapMinutes: 480 }]), {
  finish: '2026-06-09T15:00', days: [['2026-06-04', 1], ['2026-06-08', 1], ['2026-06-09', 1]],
});
measureCase('gat 480 na 480', 'p6', task('g1', '2026-06-04T07:00', 3, [{ afterMinutes: 480, gapMinutes: 480 }]), {
  finish: '2026-06-10T09:00', days: [['2026-06-04', 1], ['2026-06-08', 0.75], ['2026-06-09', 1], ['2026-06-10', 0.25]],
});

// ── Geval 2: een gat van vier uur (review). Dagenmaat: 240 min = een halve werkdag; op de korte vrijdag
// is dat 3 u (07–10), daarna 3 u werk (een halve dag). Einde di 11:00 (3,5 werkdagen vanaf do 07:00). ──
measureCase('gat 240 na 480', 'ops', task('g2', '2026-06-04T07:00', 3, [{ afterMinutes: 480, gapMinutes: 240 }]), {
  finish: '2026-06-09T11:00',
  days: [['2026-06-04', 1], ['2026-06-05', 0.5], ['2026-06-08', 1], ['2026-06-09', 0.5]],
});
measureCase('gat 240 na 480', 'p6', task('g2', '2026-06-04T07:00', 3, [{ afterMinutes: 480, gapMinutes: 240 }]), {
  finish: '2026-06-09T13:00',
  days: [['2026-06-04', 1], ['2026-06-05', 0.25], ['2026-06-08', 1], ['2026-06-09', 0.75]],
});

// ── Geval 3: start op de korte vrijdag (probe van de review). 1 d, gat van 240 na 120. Dagenmaat: een
// kwart dag werk (vr 07:00–08:30), een halve dag pauze (tot 11:30), een kwart dag werk (tot 13:00) en de
// laatste halve dag op maandag tot 11:00. ──────────────────────────────────────────────────────────
measureCase('vrijdag: gat 240 na 120', 'ops', task('g3', '2026-06-05T07:00', 1, [{ afterMinutes: 120, gapMinutes: 240 }]), {
  finish: '2026-06-08T11:00', days: [['2026-06-05', 0.5], ['2026-06-08', 0.5]],
});
measureCase('vrijdag: gat 240 na 120', 'p6', task('g3', '2026-06-05T07:00', 1, [{ afterMinutes: 120, gapMinutes: 240 }]), {
  finish: '2026-06-08T13:00', days: [['2026-06-05', 0.25], ['2026-06-08', 0.75]],
});

// ── Geval 4: twee gaten en een start midden op de dag. 3 d vanaf wo 3 jun 11:00. De as in dagslots:
// werk 0–240 (wo 11–15, een halve dag), gat 240–960 (heel do en vr 07–10), werk 960–1440 (vr 10–13 en
// ma 07–11), gat 1440–1680 (ma 11–15), werk 1680–2400 (heel di en wo 07–11). Samen 5 werkdagen vanaf
// wo 11:00: einde wo 10 jun 11:00. ──────────────────────────────────────────────────────────────────
measureCase('twee gaten vanaf wo 11:00', 'ops', task('g4', '2026-06-03T11:00', 3,
  [{ afterMinutes: 240, gapMinutes: 720 }, { afterMinutes: 1440, gapMinutes: 240 }]), {
  finish: '2026-06-10T11:00',
  days: [['2026-06-03', 0.5], ['2026-06-05', 0.5], ['2026-06-08', 0.5], ['2026-06-09', 1], ['2026-06-10', 0.5]],
});

// ── Geval 5: een contour ligt op dezelfde as. Dagenmaat, 2 d vanaf de korte vrijdag, zonder gaten:
// periode 1 (as 0–480, 240 werkminuten) is de hele vrijdag, periode 2 (as 480–960, 720) de maandag. ──
{
  const t = task('c1', '2026-06-05T07:00', 2);
  t.timephasedContours = [{ resourceId: 'r', resourceUid: null, periods: [
    { afterMinutes: 0, minutes: 480, workMinutes: 240, kind: 'remaining' },
    { afterMinutes: 480, minutes: 480, workMinutes: 720, kind: 'remaining' },
  ] }];
  solveProject({ tasks: [t], sequences: [], calendar: CAL, calendars: [], schedulingOptions: OPS });
  const eng = new CalendarEngine(CAL);
  const placed = workPlacement(eng, taskWorkPlacement(t, eng, OPS)!);
  const a = { id: 'a', taskId: t.id, resourceId: 'r', unitsPerDay: 1 };
  eq('contour op de dagslot-as: vr 0,5 en ma 1,5',
    assignmentLoadOnPlacement(t, a, placed.days, eng, t.timephasedContours[0]).map(r6), [0.5, 1.5]);
}

// ── Geval 6: de nivelleerder pauzeert een dagenmaat-taak één hele werkdag (één dagslot), ook op de korte
// vrijdag. Een blokker met hoge prioriteit bezet vr en di (een importsplit slaat maandag over: 1 d werk,
// 1 d pauze, 1 d werk). B (2 d vanaf do, deadline op haar vroege einde, plafond 3) past nergens
// aaneengesloten en wordt onderbroken: do werken, vr pauze, ma werken. ────────────────────────────────
{
  const blocker = task('blk', '2026-06-05T07:00', 2, [{ afterMinutes: 480, gapMinutes: 480 }]);
  blocker.priority = 900;
  const b = task('b', '2026-06-04T07:00', 2);
  b.priority = 100;
  const tasks = [blocker, b];
  solveProject({ tasks, sequences: [], calendar: CAL, calendars: [], schedulingOptions: OPS });
  eq('blokker: vr werken, ma pauze, di werken (einde di 15:00)', blocker.time.earlyFinish, '2026-06-09T15:00');
  b.deadline = b.time.earlyFinish;
  const stub: CPMResult = {
    tasks: new Map(), criticalPath: [], drivingSequenceIds: [], sequenceFreeFloat: {},
    truncatedLeadSequenceIds: [], violatedConstraintTaskIds: [], missedDeadlineTaskIds: [],
    outOfSequenceSequenceIds: [], nearCriticalTaskIds: [], criticalPaths: [], floatPathByTask: {},
    hammockNoFinishDriverTaskIds: [], projectEnd: blocker.time.earlyFinish!, projectDuration: 0,
  };
  const leveled = levelResources(
    tasks, [], [{ id: 'r', name: 'r', type: 'LABOR', description: '', maxUnits: 1 }],
    [{ id: 'ab', taskId: 'blk', resourceId: 'r', unitsPerDay: 1, curve: 'UNIFORM' },
      { id: 'bb', taskId: 'b', resourceId: 'r', unitsPerDay: 1, curve: 'UNIFORM' }],
    CAL, [], stub, { constrainToFloat: false, overrunCeilingDays: 3, allowSplits: true }, { schedulingOptions: OPS },
  );
  eq('nivelleren: geen onopgelost conflict', leveled.unresolved, {});
  eq('nivelleren: B krijgt één pauze van één dagslot na één dag werk',
    leveled.gaps['b']?.map(g => [g.afterMinutes, g.gapMinutes, g.source]), [[480, 480, 'leveling']]);
  const bLeveled = task('b', '2026-06-04T07:00', 2, leveled.gaps['b']);
  measureCase('nivelleerpauze op de korte vrijdag', 'ops', bLeveled, {
    finish: '2026-06-08T15:00', days: [['2026-06-04', 1], ['2026-06-08', 1]],
  });
  eq('nivelleren: projecteinde na = einde blokker', leveled.projectEndAfter, '2026-06-09T15:00');
}

for (const f of failures) console.error(`XX ${f}`);
console.log(`Split-as solver = plaatsing: ${checks} checks, ${failures.length} afwijkingen`);
process.exit(failures.length ? 1 : 0);
