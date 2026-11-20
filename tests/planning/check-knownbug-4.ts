// Knownbug 4: meet projectstart, taakanker en harde finish-pin afzonderlijk.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';

const calendar: WorkCalendar = { id: 'c', name: 'c', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [] };
const scheduled = '2026-06-15T08:00';
const projectStart = '2026-06-08';
function task(id: string, hours: boolean): Task {
  const time = createDefaultTaskTime(scheduled, 1);
  time.durationUnit = hours ? 'hours' : 'days';
  time.durationMinutes = hours ? 480 : undefined;
  return { id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [], time };
}

const link: Sequence = { id: 'ab', type: 'FINISH_START', predecessorId: 'a',
  successorId: 'b', lagDays: 0, lagUnit: 'WORKTIME' };
let cases = 0;
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const hours of [false, true]) {
    for (const linked of [false, true]) {
      for (const mode of ['voor-harde', 'voor-zachte', 'na-harde', 'geen'] as const) {
        const b = task('b', hours);
        const date = mode === 'na-harde' ? '2026-06-17T16:00' : '2026-06-02T16:00';
        if (mode !== 'geen') b.constraint = { type: 'MFO', date, hard: mode !== 'voor-zachte' };
        const res = new CPMSolver(linked ? [task('a', hours), b] : [b], linked ? [link] : [], calendar, [], {
          projectStartDate: projectStart,
          schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(profile) }),
        }).solve();
        const row = res.tasks.get(b.id);
        if (res.error || !row) throw new Error('Knownbug 4: geen resultaat: ' + (res.error ?? b.id));
        console.log('KNOWNBUG4', JSON.stringify({ profile, hours, linked, mode, projectStart,
          date: b.constraint?.date, es: row.earlyStart, ef: row.earlyFinish, tf: row.totalFloat,
          beforeProject: row.earlyStart.slice(0, 10) < projectStart,
          violations: res.violatedConstraintTaskIds }));
        cases++;
      }
    }
  }
}
console.log('KNOWNBUG4_SUMMARY', JSON.stringify({ cases }));
