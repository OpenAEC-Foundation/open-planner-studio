// Tijdelijke diagnose knownbug 277; registreert uitkomsten zonder productcode of oracle-claim.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';
const bands=[{start:420,end:720},{start:780,end:960}], full=[{start:0,end:1440}];
const cal:WorkCalendar={id:'day',name:'day',description:'',workDays:[1,2,3,4,5],workStartHour:7,
 workEndHour:16,hoursPerDay:8,holidays:[],workTime:{byWeekday:{1:bands,2:bands,3:bands,4:bands,5:bands,6:[],7:[]}}};
const cal24:WorkCalendar={id:'all',name:'all',description:'',workDays:[1,2,3,4,5,6,7],workStartHour:0,
 workEndHour:24,hoursPerDay:24,holidays:[],workTime:{byWeekday:{1:full,2:full,3:full,4:full,5:full,6:full,7:full}}};
const task=(id:string,days:number):Task=>({id,name:id,description:'',wbsCode:'',taskType:'CONSTRUCTION',status:'NOT_STARTED',
 isMilestone:false,priority:500,parentId:null,childIds:[],resourceIds:[],time:createDefaultTaskTime('2026-06-01',days)});
for(const calendarForm of ['scalar','blocks'] as const) for(const profile of ['ops','p6','msproject'] as const) for(const kind of ['none','START','FINISH'] as const){
 const p=task('P',1);p.calendarId='all';p.time.durationUnit='hours';p.time.durationMinutes=1440;
 const r=task('R',1);const tasks=[p,r],links:Sequence[]=[];
 if(kind!=='none'){
   const m=task('M',0);m.calendarId='all';m.isMilestone=true;m.milestoneKind=kind;
   tasks.push(m);links.push({id:'fs',predecessorId:'P',successorId:'M',type:'FINISH_START',lagDays:0});
 }
 const all = calendarForm === 'scalar' ? { ...cal24, workTime: undefined } : cal24;
 const result=new CPMSolver(tasks,links,cal,[all],{projectStartDate:'2026-06-01',
  schedulingOptions:effectiveSchedulingOptions({schedulingProfile:builtInProfile(profile)})}).solve();
 const pick=(id:string)=>{const x=result.tasks.get(id);return x?{es:x.earlyStart,ef:x.earlyFinish,ls:x.lateStart,lf:x.lateFinish,tf:x.totalFloat,ff:x.freeFloat,crit:x.isCritical}:null;};
 console.log('KNOWNBUG277',JSON.stringify({calendarForm,profile,kind,P:pick('P'),R:pick('R'),M:pick('M')}));
}
