// Knownbug 4: documenteer dat een harde MFO vóór de projectstart kan uitkomen.
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
        const beforeProject = row.earlyStart.slice(0, 10) < projectStart;
        const details = JSON.stringify({ profile, hours, linked, mode, es: row.earlyStart, ef: row.earlyFinish });
        if (beforeProject !== (mode === 'voor-harde')) throw new Error('Knownbug 4: ' + details);
        if ((mode === 'voor-harde' || mode === 'na-harde') && row.earlyFinish !== date) {
          throw new Error('Harde MFO is verplaatst: ' + details);
        }
        if (linked && mode === 'voor-harde' && !res.violatedConstraintTaskIds.includes(b.id)) {
          throw new Error('De relatie botst met de harde MFO, maar er is geen waarschuwing: ' + details);
        }
        // Geen assert over afwezigheid van een projectstartwaarschuwing bij een worteltaak:
        // het toevoegen van zo'n waarschuwing moet deze test niet breken.
        cases++;
      }
    }
  }
}
console.log('KNOWNBUG4_SUMMARY', JSON.stringify({ cases }));
