import { levelResources } from '@/engine/scheduler/ResourceLeveler';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { makeBands } from '@/utils/effectiveWorkTime';
import type { Task, TaskConstraint, TaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Holiday, WorkCalendar, WorkTimeBands } from '@/types/calendar';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}
function ok(label: string, cond: boolean): void { checks++; if (!cond) diffs.push(label); }

const B = (start: number, end: number) => ({ start, end });
function calendar(id: string, workTime: WorkTimeBands, holidays: Holiday[] = []): WorkCalendar {
  return {
    id, name: id, description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16,
    hoursPerDay: 8, holidays, workTime,
  };
}
const WEEK = calendar('week', makeBands([1, 2, 3, 4, 5], [B(480, 960)]));
const options = solveOptionsFor({ startDate: '2026-06-01', endDate: '' });

function time(extra: Partial<TaskTime>): TaskTime {
  return {
    durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 1,
    scheduleStart: '2026-06-01', scheduleFinish: '2026-06-01', earlyStart: '2026-06-01', earlyFinish: '2026-06-01',
    lateStart: '2026-06-01', lateFinish: '2026-06-01', freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    ...extra,
  };
}
function task(id: string, t: Partial<TaskTime>, extra: Partial<Task> = {}): Task {
  return {
    id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
    priority: 500, parentId: null, childIds: [], resourceIds: [], time: time(t), ...extra,
  };
}
const KRAAN: Resource = { id: 'kraan', name: 'Kraan', description: '', type: 'EQUIPMENT', maxUnits: 1 };

function level(cal: WorkCalendar, leaves: Task[]): { starts: string[]; unresolved: number } {
  const tasks = leaves.map(t => ({ ...t, resourceIds: ['kraan'] }));
  const assignments: ResourceAssignment[] = tasks.map(t => ({ id: 'a' + t.id, taskId: t.id, resourceId: 'kraan', unitsPerDay: 1 }));
  const base = solveProject({ tasks, sequences: [], calendar: cal, calendars: [], ...options });
  if (base.error) throw new Error(JSON.stringify(base.error));
  const r = levelResources(tasks, [], [KRAAN], assignments, cal, [], base, { constrainToFloat: false }, options);
  const starts = tasks.map(t => r.shifts[t.id]?.newStart ?? base.tasks.get(t.id)?.earlyStart ?? '?').sort();
  return { starts, unresolved: Object.keys(r.unresolved).length };
}

console.log('-- leveler-candidate-axis: kalenderwerk bij oplopende capaciteitsdruk --');
function calendarWork(n: number): number {
  const leaves = Array.from({ length: n }, (_, i) => task(`t${i}`, {}, { resourceIds: ['kraan'] }));
  const tasks = [task('start', { scheduleDuration: 0 }, { isMilestone: true }), ...leaves, task('end', { scheduleDuration: 0 }, { isMilestone: true })];
  const sequences: Sequence[] = leaves.flatMap(t => [
    { id: `in-${t.id}`, predecessorId: 'start', successorId: t.id, type: 'FINISH_START', lagDays: 0 },
    { id: `out-${t.id}`, predecessorId: t.id, successorId: 'end', type: 'FINISH_START', lagDays: 0 },
  ]);
  const assignments: ResourceAssignment[] = leaves.map(t => ({ id: `a-${t.id}`, taskId: t.id, resourceId: 'kraan', unitsPerDay: 1 }));
  const base = solveProject({ tasks, sequences, calendar: WEEK, calendars: [], ...options });
  if (base.error) throw new Error(JSON.stringify(base.error));
  const proto = CalendarEngine.prototype as unknown as { findContaining: (...args: unknown[]) => unknown };
  const original = proto.findContaining;
  let calls = 0;
  proto.findContaining = function (this: unknown, ...args: unknown[]) { calls++; return original.apply(this, args); };
  try {
    const r = levelResources(tasks, sequences, [KRAAN], assignments, WEEK, [], base, { constrainToFloat: false }, options);
    eq(`waaier ${n}: alles opgelost`, Object.keys(r.unresolved).length, 0);
    eq(`waaier ${n}: n − 1 taken plus het einde verschoven`, Object.keys(r.shifts).length, n);
  } finally {
    proto.findContaining = original;
  }
  return calls;
}
{
  const small = calendarWork(60);
  const large = calendarWork(120);
  ok(`kalenderwerk groeit sterker dan kwadratisch: ${small} → ${large} (factor ${(large / small).toFixed(2)}, grens 5)`,
    small > 0 && large <= small * 5);
  console.log(`   kalenderwerk 60/120 taken: ${small} → ${large} (factor ${(large / small).toFixed(2)})`);
}

console.log('-- leveler-candidate-axis: korte vrijdag, nachtdienst en feestdag --');
const snet = (date: string): { constraint: TaskConstraint } => ({ constraint: { type: 'SNET', date } });
const hourTask = (minutes: number) => ({ durationUnit: 'hours' as const, durationMinutes: minutes, scheduleDuration: minutes / 480 });

{
  const cal = calendar('korte-vrijdag', { byWeekday: { 1: [B(480, 960)], 2: [B(480, 960)], 3: [B(480, 960)], 4: [B(480, 960)], 5: [B(480, 840)], 6: [], 7: [] } });
  const leaves = ['A', 'B', 'C', 'D'].map(id => task(id, hourTask(480), snet('2026-06-03T14:00')));
  const r = level(cal, leaves);
  eq('korte vrijdag: starts', r.starts, ['2026-06-03T14:00', '2026-06-04T14:00', '2026-06-08T08:00', '2026-06-09T14:00']);
  eq('korte vrijdag: niets onopgelost', r.unresolved, 0);
}

{
  const cal = calendar('nacht', makeBands([1, 2, 3, 4, 5], [B(1320, 1800)]));
  const leaves = ['A', 'B', 'C', 'D', 'E', 'F'].map(id => task(id, hourTask(480)));
  const r = level(cal, leaves);
  eq('nachtdienst: starts', r.starts,
    ['2026-06-01T22:00', '2026-06-02T22:00', '2026-06-03T22:00', '2026-06-04T22:00', '2026-06-05T22:00', '2026-06-08T22:00']);
  eq('nachtdienst: niets onopgelost', r.unresolved, 0);
}

{
  const cal = calendar('feestdag', makeBands([1, 2, 3, 4, 5], [B(480, 960)]),
    [{ name: 'feestdag', startDate: '2026-06-03', endDate: '2026-06-03' }]);
  const leaves = ['A', 'B', 'C'].map(id => task(id, hourTask(480), snet('2026-06-02T12:00')));
  const r = level(cal, leaves);
  eq('feestdag: starts', r.starts, ['2026-06-02T12:00', '2026-06-02T12:00', '2026-06-05T12:00']);
  eq('feestdag: niets onopgelost', r.unresolved, 0);
}

if (diffs.length === 0) { console.log(`OK  leveler-candidate-axis: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  leveler-candidate-axis: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
