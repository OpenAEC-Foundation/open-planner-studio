// Tijdelijke diagnose: zijn fasegrenzen zichtbaar in de berekende planning?
import { solveProject } from '@/engine/scheduler/solveProject';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
const calendar:WorkCalendar={id:'c',name:'c',description:'',workDays:[1,2,3,4,5],workStartHour:8,workEndHour:16,hoursPerDay:8,holidays:[]};
const task=(id:string,extra:Partial<Task>={}):Task=>({id,name:id,description:'',wbsCode:'',taskType:'CONSTRUCTION',status:'NOT_STARTED',isMilestone:false,priority:500,parentId:null,childIds:[],resourceIds:[],time:createDefaultTaskTime('2026-06-01',2,'days'),...extra});
for(const kind of ['none','phase','leaf'] as const){
 const patch:Partial<Task>={constraint:{type:'SNET',date:'2026-06-10'},deadline:'2026-06-01'};
 const tasks=[task('F',{childIds:['A'],...(kind==='phase'?patch:{})}),task('A',{parentId:'F',...(kind==='leaf'?patch:{})})];
 const result=solveProject({tasks,sequences:[],calendar,calendars:[],schedulingOptions:effectiveSchedulingOptions({}),projectStartDate:'2026-06-01'});
 console.log('KNOWNBUG3',JSON.stringify({kind,error:result.error,tasks:tasks.map(t=>({id:t.id,constraint:t.constraint,deadline:t.deadline,earlyStart:t.time.earlyStart,earlyFinish:t.time.earlyFinish,totalFloat:t.time.totalFloat}))}));
}
