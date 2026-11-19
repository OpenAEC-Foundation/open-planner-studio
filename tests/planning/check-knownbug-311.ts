// Knownbug 311: FF met negatieve kalenderlag mag niet vóór de finish-ondergrens eindigen.
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
    const expected = unit === 'ELAPSEDTIME' && lag < 0 ? '2026-06-08T07:00'
      : unit === 'ELAPSEDTIME' && lag === 1 ? '2026-06-09T16:00' : '2026-06-08T16:00';
    const aResult=pick('A'), bResult=pick('B');
    if (aResult.ef !== '2026-06-08T16:00' || bResult.ef !== expected) {
      throw new Error(`knownbug 311 ${profile} ${unit} ${lag}: ${JSON.stringify({aResult,bResult,expected})}`);
    }
    console.log('KNOWNBUG311_WINDOW', JSON.stringify({profile,unit,lag,A:aResult,B:bResult}));
  }
}

// Binnen een werkblok, op het begin en einde van de middagband en bij een afwijkende opvolgerkalender.
// Daarna een FS-opvolger en een harde MFO die vóór de relatiedruk blijft gelden.
for (const profile of ['ops','p6','msproject'] as const) {
  for (const [mins, expected] of [[-60,'2026-06-08T15:00'],[-180,'2026-06-08T13:00'],
    [-240,'2026-06-08T12:00']] as const) {
    const a=task('A',2880), b=task('B',1920), c=task('C',480);
    const links:Sequence[]=[
      {id:'ff',predecessorId:'A',successorId:'B',type:'FINISH_FINISH',lagDays:0,lagMinutes:mins,lagUnit:'ELAPSEDTIME'},
      {id:'fs',predecessorId:'B',successorId:'C',type:'FINISH_START',lagDays:0}];
    const r=new CPMSolver([a,b,c],links,cal,[],{projectStartDate:'2026-06-01',
      schedulingOptions:effectiveSchedulingOptions({schedulingProfile:builtInProfile(profile)})}).solve();
    const bt=r.tasks.get('B')!, ct=r.tasks.get('C')!;
    if (bt.earlyFinish !== expected || !ct.earlyStart || ct.earlyStart < bt.earlyFinish) {
      throw new Error(`311 band/keten ${profile} ${mins}: ${JSON.stringify({bt,ct,expected})}`);
    }
    console.log('OK 311 band/keten', profile, mins, bt.earlyFinish, ct.earlyStart);
  }
  {
    const a=task('A',2880), b=task('B',1920);
    const alt:WorkCalendar={...cal,id:'alt',holidays:[{name:'vrij',startDate:'2026-06-08',endDate:'2026-06-08'}]};
    b.calendarId=alt.id;
    const ff:Sequence={id:'ff',predecessorId:'A',successorId:'B',type:'FINISH_FINISH',lagDays:-2,lagUnit:'ELAPSEDTIME'};
    const r=new CPMSolver([a,b],[ff],cal,[alt],{projectStartDate:'2026-06-01',
      schedulingOptions:effectiveSchedulingOptions({schedulingProfile:builtInProfile(profile)})}).solve();
    const bt=r.tasks.get('B')!;
    if (bt.earlyFinish !== '2026-06-09T07:00') throw new Error(`311 kalender ${profile}: ${JSON.stringify(bt)}`);
    console.log('OK 311 eigen kalender',profile,bt.earlyFinish);
  }
  {
    const a=task('A',2880), b=task('B',1920);
    b.constraint={type:'MFO',date:'2026-06-05T16:00',hard:true};
    const ff:Sequence={id:'ff',predecessorId:'A',successorId:'B',type:'FINISH_FINISH',lagDays:-2,lagUnit:'ELAPSEDTIME'};
    const r=new CPMSolver([a,b],[ff],cal,[],{projectStartDate:'2026-06-01',
      schedulingOptions:effectiveSchedulingOptions({schedulingProfile:builtInProfile(profile)})}).solve();
    const bt=r.tasks.get('B')!;
    if (bt.earlyFinish !== '2026-06-05T16:00') throw new Error(`311 harde MFO ${profile}: ${JSON.stringify(bt)}`);
    console.log('OK 311 harde MFO',profile,bt.earlyFinish);
  }
}

for (const profile of ['ops','p6','msproject'] as const) {
  const a=task('A',2880), d=task('D',3840), b=task('B',1920);
  const links:Sequence[]=[
    {id:'ff1',predecessorId:'A',successorId:'B',type:'FINISH_FINISH',lagDays:-2,lagUnit:'ELAPSEDTIME'},
    {id:'ff2',predecessorId:'D',successorId:'B',type:'FINISH_FINISH',lagDays:0,lagUnit:'WORKTIME'}];
  const r=new CPMSolver([a,d,b],links,cal,[],{projectStartDate:'2026-06-01',
    schedulingOptions:effectiveSchedulingOptions({schedulingProfile:builtInProfile(profile)})}).solve();
  const bt=r.tasks.get('B')!, dt=r.tasks.get('D')!;
  if (bt.earlyFinish < dt.earlyFinish) throw new Error(`311 meerdere voorgangers ${profile}: ${JSON.stringify({bt,dt})}`);
  console.log('KNOWNBUG311_MULTIPLE',JSON.stringify({profile,B:bt,D:dt}));
}
