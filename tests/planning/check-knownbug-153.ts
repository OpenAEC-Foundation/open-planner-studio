import './domStub';
import { createAppStoreContext } from '@/state/appStore';
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

function equal(label:string, got:unknown, want:unknown){
 if(JSON.stringify(got)!==JSON.stringify(want)){errors++;console.error('XX',label,JSON.stringify({got,want}));}
}
for(const profile of ['ops','p6','msproject'] as const){
 const opts={projectStartDate:'2026-06-01',schedulingOptions:effectiveSchedulingOptions({schedulingProfile:builtInProfile(profile)})};
 const m={...task('M',0,'2026-06-01T16:00'),milestoneKind:'FINISH' as const};
 const b=task('B',2,'2026-06-01T07:00');b.time.durationUnit='hours';b.time.durationMinutes=960;
 for(const type of ['FINISH_START','START_START'] as const){
  const r=new CPMSolver([m,b],[{...sf,type}],cal,[],opts).solve();
  equal(`${profile} ${type} blijft na de eindmijlpaal`,r.tasks.get('B')!.earlyStart,'2026-06-02T07:00');
 }
 const later=new CPMSolver([m,b],[sf],cal,[],{...opts,projectStartDate:'2026-06-02'}).solve();
 equal(`${profile} latere projectstart wint`,later.tasks.get('B')!.earlyStart,'2026-06-02T07:00');
 const holiday:WorkCalendar={...cal,holidays:[{name:'Vrij',startDate:'2026-06-08',endDate:'2026-06-08'}]};
 const friday={...m,time:{...m.time,scheduleStart:'2026-06-05T16:00'}};
 const after=new CPMSolver([friday,b],[sf],holiday,[],{...opts,projectStartDate:'2026-06-05'}).solve();
 equal(`${profile} SF weekend en vrije maandag`,[after.tasks.get('B')!.earlyStart,after.tasks.get('B')!.earlyFinish],['2026-06-05T07:00','2026-06-09T16:00']);
}

for(const profile of ['ops','p6','msproject'] as const){
 const {store}=createAppStoreContext();const S=store.getState;
 S().setCalendar(cal); S().setProject({startDate:'2026-06-01',schedulingProfile:builtInProfile(profile)});
 const m=S().addTask({name:'M',isMilestone:true,milestoneKind:'FINISH'});
 const b=S().addTask({name:'B'});
 const tm=S().tasks.find(t=>t.id===m)!,tb=S().tasks.find(t=>t.id===b)!;
 S().updateTask(m,{time:{...tm.time,scheduleStart:'2026-06-01T16:00',scheduleDuration:0}});
 S().updateTask(b,{time:{...tb.time,scheduleStart:'2026-06-01T07:00',durationUnit:'hours',durationMinutes:960,scheduleDuration:2}});
 S().addSequence({predecessorId:m,successorId:b,type:'START_FINISH',lagDays:0}); S().runCPM();
 const t=S().tasks.find(x=>x.id===b)!.time;
 equal(`${profile} SF via store`,[t.earlyStart,t.earlyFinish],['2026-06-01T07:00','2026-06-02T16:00']);
}

for(const profile of ['ops','p6','msproject'] as const){
 const opts={projectStartDate:'2026-06-01',schedulingOptions:effectiveSchedulingOptions({schedulingProfile:builtInProfile(profile)})};
 const m={...task('M',0,'2026-06-01T16:00'),milestoneKind:'FINISH' as const};
 const b=task('B',2,'2026-06-01T07:00');b.time.durationUnit='hours';b.time.durationMinutes=960;
 const root=task('R',1,'2026-06-01T07:00');
 const r=new CPMSolver([m,b,root],[sf],cal,[],opts).solve();
 equal(`${profile} tweede wortel`,[r.tasks.get('B')!.earlyStart,r.tasks.get('B')!.earlyFinish],['2026-06-01T07:00','2026-06-02T16:00']);
 for(const id of ['M','B','R']){ const x=r.tasks.get(id)!;
  equal(`${profile} ${id} laat niet vóór vroeg`,x.lateStart>=x.earlyStart && x.lateFinish>=x.earlyFinish && x.totalFloat>=0,true);
 }
 const start={...m,milestoneKind:'START' as const};
 const rs=new CPMSolver([start,b],[sf],cal,[],opts).solve();
 equal(`${profile} START valt buiten de eindmijlpaalcorrectie`,rs.tasks.get('B')!.earlyStart,'2026-06-02T07:00');
 const other:WorkCalendar={...cal,id:'other',workStartHour:8,workEndHour:17,workTime:{byWeekday:{
  1:[{start:480,end:720},{start:780,end:1020}],2:[{start:480,end:720},{start:780,end:1020}],3:[{start:480,end:720},{start:780,end:1020}],4:[{start:480,end:720},{start:780,end:1020}],5:[{start:480,end:720},{start:780,end:1020}],6:[],7:[]}}};
 const own={...b,calendarId:'other'};
 const mixed=new CPMSolver([m,own],[sf],cal,[other],opts).solve();
 equal(`${profile} eigen opvolgerkalender`,[mixed.tasks.get('B')!.earlyStart,mixed.tasks.get('B')!.earlyFinish],['2026-06-01T08:00','2026-06-02T17:00']);
}

console.log(`Knownbug 153: ${errors} fouten`); process.exitCode=errors?1:0;
