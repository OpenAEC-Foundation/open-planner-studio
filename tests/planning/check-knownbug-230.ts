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
  const time = createDefaultTaskTime('2026-06-01T07:00', minutes / 480);
  time.durationUnit = 'hours';
  time.durationMinutes = minutes;
  return { id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [], time };
}
let cases = 0;
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const unit of ['days', 'hours'] as const) {
    for (const kind of ['START', 'FINISH'] as const) {
      for (const minutes of [1920, 420]) {
        const a = task('a', minutes);
        a.time.durationUnit = unit;
        if (unit === 'days') a.time.durationMinutes = undefined;
        const m = task('m', 0);
        m.isMilestone = true;
        m.milestoneKind = kind;
        const link: Sequence = { id: 'am', type: 'FINISH_FINISH', predecessorId: 'a',
          successorId: 'm', lagDays: 0, lagUnit: 'WORKTIME' };
        const result = new CPMSolver([a, m], [link], calendar, [], {
          projectStartDate: '2026-06-01',
          schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(profile) }),
        }).solve();
        const ar = result.tasks.get('a'), mr = result.tasks.get('m');
        if (result.error || !ar || !mr) throw new Error('Knownbug 230: no result: ' + (result.error ?? profile));
        console.log('KNOWNBUG230', JSON.stringify({ profile, unit, kind, minutes,
          a: { ef: ar.earlyFinish, lf: ar.lateFinish, tf: ar.totalFloatMinutes },
          m: { es: mr.earlyStart, lf: mr.lateFinish },
          driving: result.drivingSequenceIds, critical: result.criticalPath }));
        cases++;
      }
    }
  }
}
console.log('KNOWNBUG230_SUMMARY', JSON.stringify({ cases }));
