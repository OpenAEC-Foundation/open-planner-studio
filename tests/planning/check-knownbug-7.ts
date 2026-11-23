// Diagnose knownbug 7: meet afgeleide hammockduur zonder finish-driver.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

const base: WorkCalendar = { id: 'c', name: 'c', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [] };
const bands = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const banded: WorkCalendar = { ...base, workTime: { byWeekday: {
  1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [],
} } };
let errors = 0;
for (const [label, cal] of [['dag', base], ['banden', banded]] as const) {
  for (const profile of ['ops', 'p6', 'msproject'] as const) {
    const task: Task = { id: 'h', name: 'h', description: '', wbsCode: '', taskType: 'CONSTRUCTION',
      status: 'NOT_STARTED', isMilestone: false, isHammock: true, priority: 500, parentId: null,
      childIds: [], resourceIds: [], time: createDefaultTaskTime('2026-06-01T07:00', 3) };
    for (let n = 1; n <= 2; n++) {
      const result = new CPMSolver([task], [], cal, [], { projectStartDate: '2026-06-01',
        schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(profile) }) }).solve();
      const row = result.tasks.get('h');
      const ok = result.hammockNoFinishDriverTaskIds.includes('h')
        && row?.earlyStart === row?.earlyFinish && task.time.scheduleDuration === 0
        && (task.time.durationMinutes === undefined || task.time.durationMinutes === 0);
      console.log('KNOWNBUG7', JSON.stringify({label, profile, n, ok, row, time: task.time}));
      if (!ok) errors++;
    }
  }
}
if (errors) throw new Error(`knownbug 7: ${errors} afwijkingen`);
