// Deelgevallen van knownbug 2: werkelijke minuten en speling op gesplitste werkdagen.
// De oorspronkelijke fixture is onbekend; dit sluit de melding niet uit.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';
const bands = [{start:420,end:720},{start:780,end:960}];
const cal: WorkCalendar={id:'c',name:'c',description:'',workDays:[1,2,3,4,5],workStartHour:7,workEndHour:16,hoursPerDay:8,holidays:[],workTime:{byWeekday:{1:bands,2:bands,3:bands,4:bands,5:bands,6:[],7:[]}}};
const task=(id:string,d:number):Task=>({id,name:id,description:'',wbsCode:'',taskType:'CONSTRUCTION',status:'NOT_STARTED',isMilestone:false,priority:500,parentId:null,childIds:[],resourceIds:[],time:createDefaultTaskTime('2026-06-01T07:00',d)});
const fs:Sequence={id:'fs',predecessorId:'A',successorId:'B',type:'FINISH_START',lagDays:0};
let errors=0;
for(const profile of ['ops','p6','msproject'] as const) for(const mins of [240,480,720]){
 const a=task('A',mins/480);a.time.durationUnit='hours';a.time.durationMinutes=mins;
 const b=task('B',2);
 const result=new CPMSolver([a,b],[fs],cal,[],{projectStartDate:'2026-06-01',schedulingOptions:effectiveSchedulingOptions({schedulingProfile:builtInProfile(profile)})}).solve();
 const pick=(id:string)=>{const t=result.tasks.get(id)!;return {es:t.earlyStart,ef:t.earlyFinish,ls:t.lateStart,lf:t.lateFinish,tf:t.totalFloat,ff:t.freeFloat};};
 const aResult=pick('A'), bResult=pick('B');
 const expected=mins===240 ? ['2026-06-01T11:00','2026-06-03T11:00'] : mins===480 ? ['2026-06-02T07:00','2026-06-03T16:00'] : ['2026-06-02T11:00','2026-06-04T11:00'];
 const got=[bResult.es,bResult.ef];
 if(JSON.stringify(got)!==JSON.stringify(expected) || aResult.tf!==0 || bResult.tf!==0){errors++;console.error('XX',JSON.stringify({profile,mins,got,expected,A:aResult,B:bResult}));}
}

console.log(`Knownbug 2 deelgevallen: ${errors} fouten`); process.exitCode=errors?1:0;
