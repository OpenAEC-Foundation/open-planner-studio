// Knownbug 155: compare identical clock lags on working-time and continuous tasks.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';

const bands = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const calendar: WorkCalendar = {
  id: 'c', name: 'c', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [] } },
};
function task(id: string, minutes: number): Task {
  const time = createDefaultTaskTime('2026-06-05T07:00', minutes / 480);
  time.durationUnit = 'hours';
  time.durationMinutes = minutes;
  return { id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [], time };
}
let cases = 0;
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const type of ['WORKTIME', 'ELAPSEDTIME'] as const) {
    for (const lagDays of [-1, 0, 1]) {
      const a = task('a', 480);
      const b = task('b', 480);
      b.time.durationType = type;
      const link: Sequence = { id: 'ab', type: 'FINISH_START', predecessorId: 'a', successorId: 'b',
        lagDays, lagUnit: 'ELAPSEDTIME' };
      const result = new CPMSolver([a, b], [link], calendar, [], {
        projectStartDate: '2026-06-05',
        schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(profile) }),
      }).solve();
      const ar = result.tasks.get('a'), br = result.tasks.get('b');
      if (result.error || !ar || !br) throw new Error('Knownbug 155: no result: ' + (result.error ?? profile));
      console.log('KNOWNBUG155', JSON.stringify({ profile, type, lagDays, predFinish: ar.earlyFinish,
        succStart: br.earlyStart, succFinish: br.earlyFinish, driving: result.drivingSequenceIds }));
      cases++;
    }
  }
}
console.log('KNOWNBUG155_SUMMARY', JSON.stringify({ cases }));
