// Knownbug 144: kalendertijd gebruikt een exclusief eindmoment, ook voor FS en FNLT.
import './domStub';
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';
const calendar: WorkCalendar = { id: 'c', name: 'c', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [] };
const make = (id: string, start: string): Task => ({ id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [], time: createDefaultTaskTime(start, 1, 'days') });
const fs: Sequence = { id: 'fs', predecessorId: 'A', successorId: 'B', type: 'FINISH_START', lagDays: 0 };
let errors = 0;
function eq(label: string, got: unknown, want: unknown) {
 if (JSON.stringify(got) !== JSON.stringify(want)) { errors++; console.error(`XX ${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`); }
}
for (const profile of ['ops', 'p6', 'msproject'] as const) for (const start of ['2026-06-01', '2026-06-01T00:00', '2026-06-01T07:00']) {
 const a = make('A', start); a.time.durationType = 'ELAPSEDTIME';
 const opts = { projectStartDate: '2026-06-01', schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(profile) }) };
 const chain = new CPMSolver([a, make('B', start)], [fs], calendar, [], opts).solve();
 const finish = start.endsWith('T07:00') ? '2026-06-02T07:00' : '2026-06-02T00:00';
 eq(`${profile}, ${start}: 24 uur en opvolger niet een dag te laat`, [chain.tasks.get('A')!.earlyFinish, chain.tasks.get('B')!.earlyStart], [finish, '2026-06-02T07:00']);
 const exact = new CPMSolver([{ ...a, constraint: { type: 'FNLT', date: finish } }], [], calendar, [], opts).solve();
 eq(`${profile}, ${start}: FNLT op exact eindmoment geeft geen negatieve speling of schending`, [exact.tasks.get('A')!.totalFloat, exact.violatedConstraintTaskIds], [0, []]);
 // D2: een kale einddatum is het einde van de werkdag (16:00), niet het einde van de kalenderdag.
 const earlier = new CPMSolver([{ ...a, constraint: { type: 'FNLT', date: '2026-06-01' } }], [], calendar, [], opts).solve();
 eq(`${profile}, ${start}: FNLT ma 16:00 wordt wél overschreden`, [earlier.tasks.get('A')!.totalFloat < 0, earlier.violatedConstraintTaskIds], [true, ['A']]);
}
console.log(`Knownbug 144: ${errors} fouten`); process.exitCode = errors ? 1 : 0;
