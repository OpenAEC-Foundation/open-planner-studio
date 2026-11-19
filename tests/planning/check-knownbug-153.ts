// Knownbug 153: de projectvloer van een eindmijlpaal hoort bij haar eigen werkdag.
import './domStub';
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';
const bands = [{start:420,end:720},{start:780,end:960}];
const cal: WorkCalendar={id:'c',name:'c',description:'',workDays:[1,2,3,4,5],workStartHour:7,workEndHour:16,hoursPerDay:8,holidays:[],workTime:{byWeekday:{1:bands,2:bands,3:bands,4:bands,5:bands,6:[],7:[]}}};
const task=(id:string,d:number,start:string):Task=>({id,name:id,description:'',wbsCode:'',taskType:'CONSTRUCTION',status:'NOT_STARTED',isMilestone:d===0,priority:500,parentId:null,childIds:[],resourceIds:[],time:createDefaultTaskTime(start,d)});
const sf:Sequence={id:'sf',predecessorId:'M',successorId:'B',type:'START_FINISH',lagDays:0};
let errors=0;
for(const profile of ['ops','p6','msproject'] as const) for(const measure of ['days','hours'] as const){
 const m={...task('M',0,'2026-06-01T16:00'),milestoneKind:'FINISH' as const}; const b=task('B',2,'2026-06-01T07:00'); if(measure==='hours'){b.time.durationUnit='hours';b.time.durationMinutes=960;}
 const result=new CPMSolver([m,b],[sf],cal,[],{projectStartDate:'2026-06-01',schedulingOptions:effectiveSchedulingOptions({schedulingProfile:builtInProfile(profile)})}).solve();
 const pick=(id:string)=>{const t=result.tasks.get(id)!;return {es:t.earlyStart,ef:t.earlyFinish,ls:t.lateStart,lf:t.lateFinish,tf:t.totalFloat,ff:t.freeFloat};};
 const got=[pick('M').es,pick('B').es,pick('B').ef]; const want=['2026-06-01T16:00','2026-06-01T07:00','2026-06-02T16:00'];
 if(JSON.stringify(got)!==JSON.stringify(want)){errors++;console.error('XX',profile,measure,JSON.stringify({got,want}));}
}

console.log(`Knownbug 153: ${errors} fouten`); process.exitCode=errors?1:0;
