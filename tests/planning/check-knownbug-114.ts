import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';

const calendar: WorkCalendar = { id: 'c', name: 'c', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [] };
const start = '2026-06-01T08:00';
const dataDate = '2026-06-03T08:00';
function create(id: string, days: number): Task {
  const time = createDefaultTaskTime(start, days);
  time.durationUnit = 'hours';
  time.durationMinutes = days * 480;
  return { id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [], time };
}
const link: Sequence = { id: 'ab', type: 'FINISH_START', predecessorId: 'a',
  successorId: 'b', lagDays: 0, lagUnit: 'WORKTIME' };
let cases = 0;
for (const profile of ['p6', 'ops'] as const) {
  for (const [label, pct, remaining, actualFinish, source] of [
    ['duration-100', 1, 0, undefined, 'CP_Drtn'],
    ['physical-100', 1, 960, undefined, 'CP_Phys'],
    ['physical-90', 0.9, 960, undefined, 'CP_Phys'],
    ['completed', 1, 0, '2026-06-02T16:00', 'CP_Drtn'],
  ] as const) {
    const a = create('a', 10);
    const b = create('b', 1);
    a.status = actualFinish ? 'COMPLETED' : 'STARTED';
    a.time.actualStart = start;
    a.time.actualFinish = actualFinish;
    a.time.completion = pct;
    a.time.remainingTime = remaining / 480;
    a.time.remainingMinutes = remaining;
    a.p6ProjectId = 'project';
    a.p6TaskId = 'a';
    a.p6ActivityType = 'TT_Task';
    a.p6CompletePctType = source;
    const res = new CPMSolver([a, b], [link], calendar, [], {
      projectStartDate: '2026-06-01', dataDate,
      schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(profile) }),
    }).solve();
    const ra = res.tasks.get('a'), rb = res.tasks.get('b');
    if (res.error || !ra || !rb) throw new Error('Knownbug 114: geen resultaat: ' + (res.error ?? label));
    console.log('KNOWNBUG114', JSON.stringify({ profile, label, dataDate, pct, remaining, actualFinish,
      a: { es: ra.earlyStart, ef: ra.earlyFinish, ls: ra.lateStart, lf: ra.lateFinish },
      bStart: rb.earlyStart }));
    cases++;
  }
}
console.log('KNOWNBUG114_SUMMARY', JSON.stringify({ cases }));
