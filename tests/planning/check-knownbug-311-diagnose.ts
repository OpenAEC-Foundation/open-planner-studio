// Tijdelijke diagnose knownbug 311; logt alleen, geen verwachte datumconventie opgelegd.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';
const bands = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const cal: WorkCalendar = { id:'c', name:'c', description:'', workDays:[1,2,3,4,5], workStartHour:7,
  workEndHour:16, hoursPerDay:8, holidays:[], workTime:{byWeekday:{1:bands,2:bands,3:bands,4:bands,5:bands,6:[],7:[]}} };
const task = (id:string, mins:number):Task => {
  const t:Task = {id,name:id,description:'',wbsCode:'',taskType:'CONSTRUCTION',status:'NOT_STARTED',
    isMilestone:false,priority:500,parentId:null,childIds:[],resourceIds:[],
    time:createDefaultTaskTime('2026-06-01T07:00',mins/480)};
  t.time.durationUnit='hours'; t.time.durationMinutes=mins; return t;
};
for (const profile of ['ops','p6','msproject'] as const) {
  for (const [unit, lag] of [['ELAPSEDTIME',-2],['ELAPSEDTIME',-1],['ELAPSEDTIME',0],
    ['ELAPSEDTIME',1],['WORKTIME',0]] as const) {
    const a=task('A',2880), b=task('B',1920);
    const ff:Sequence={id:'ff',predecessorId:'A',successorId:'B',type:'FINISH_FINISH',lagDays:lag,lagUnit:unit};
    const r=new CPMSolver([a,b],[ff],cal,[],{projectStartDate:'2026-06-01',
      schedulingOptions:effectiveSchedulingOptions({schedulingProfile:builtInProfile(profile)})}).solve();
    const pick=(id:string)=>{const t=r.tasks.get(id)!;return {es:t.earlyStart,ef:t.earlyFinish,ls:t.lateStart,lf:t.lateFinish,tf:t.totalFloat,ff:t.freeFloat};};
    console.log('KNOWNBUG311',JSON.stringify({profile,unit,lag,A:pick('A'),B:pick('B')}));
  }
}
