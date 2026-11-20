// Knownbug 146: measure the predecessor's late finish separately from total float.
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
  for (const [aMinutes, bMinutes] of [[300, 300], [480, 480], [420, 420]]) {
    for (const lagMinutes of [0, -60, 60]) {
      const link: Sequence = { id: 'ab', type: 'FINISH_FINISH', predecessorId: 'a', successorId: 'b',
        lagDays: lagMinutes / 480, lagMinutes, lagUnit: 'WORKTIME' };
      const res = new CPMSolver([task('a', aMinutes), task('b', bMinutes)], [link], calendar, [], {
        projectStartDate: '2026-06-05',
        schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(profile) }),
      }).solve();
      const a = res.tasks.get('a'), b = res.tasks.get('b');
      if (res.error || !a || !b) throw new Error('Knownbug 146: no result: ' + (res.error ?? profile));
      console.log('KNOWNBUG146', JSON.stringify({ profile, aMinutes, bMinutes, lagMinutes,
        a: { es: a.earlyStart, ef: a.earlyFinish, ls: a.lateStart, lf: a.lateFinish, tf: a.totalFloatMinutes },
        b: { es: b.earlyStart, ef: b.earlyFinish, ls: b.lateStart, lf: b.lateFinish, tf: b.totalFloatMinutes } }));
      cases++;
    }
  }
}
console.log('KNOWNBUG146_SUMMARY', JSON.stringify({ cases }));
