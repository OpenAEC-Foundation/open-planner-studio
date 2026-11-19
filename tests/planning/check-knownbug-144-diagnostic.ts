// Tijdelijke diagnose: observed values only, niet mergen.
import './domStub';
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';
const calendar: WorkCalendar = { id: 'c', name: 'c', description: '', workDays: [1,2,3,4,5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [] };
const make = (id: string, start: string): Task => ({ id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [], time: createDefaultTaskTime(start, 1, 'days') });
const fs: Sequence = { id:'fs', predecessorId:'A', successorId:'B', type:'FINISH_START', lagDays:0 };
for (const profile of ['ops','p6','msproject'] as const) for (const start of ['2026-06-01','2026-06-01T00:00','2026-06-01T07:00']) {
 const a = make('A',start); a.time.durationType = 'ELAPSEDTIME';
 const opts = { projectStartDate:'2026-06-01', schedulingOptions:effectiveSchedulingOptions({schedulingProfile:builtInProfile(profile)}) };
 const chain = new CPMSolver([a,make('B',start)],[fs],calendar,[],opts).solve();
 const constrained = new CPMSolver([{...a,constraint:{type:'FNLT',date:'2026-06-01'}}],[],calendar,[],opts).solve();
 const pick = (r: any) => ({ES:r.earlyStart,EF:r.earlyFinish,LS:r.lateStart,LF:r.lateFinish,TF:r.totalFloat,FF:r.freeFloat});
 console.log('KNOWNBUG144',JSON.stringify({profile,start,A:pick(chain.tasks.get('A')),B:pick(chain.tasks.get('B')),FNLT:pick(constrained.tasks.get('A')),violations:constrained.violatedConstraintTaskIds}));
}
