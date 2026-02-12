import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { Resource } from '@/types/resource';
import { ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar } from '@/types/calendar';

/** Generate a 22-character IFC GlobalId (simplified) */
function ifcGuid(seed: string): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  let result = '';
  for (let i = 0; i < 22; i++) {
    const idx = Math.abs((hash * (i + 1) * 31 + i * 17) % chars.length);
    result += chars[idx];
    hash = ((hash << 3) ^ (hash >> 2) + i) | 0;
  }
  return result;
}

function ifcStr(s: string): string {
  if (!s) return '$';
  return `'${s.replace(/'/g, "''")}'`;
}

function ifcDateTime(iso: string): string {
  if (!iso) return '$';
  // Ensure format: 'YYYY-MM-DDT07:00:00'
  if (iso.length === 10) return `'${iso}T07:00:00'`;
  return `'${iso}'`;
}

function ifcDuration(days: number): string {
  return `'P0Y0M${days}D'`;
}

function ifcBool(b: boolean): string {
  return b ? '.T.' : '.F.';
}

interface WriteContext {
  lines: string[];
  nextId: number;
  idMap: Map<string, number>; // our ID -> STEP #id
}

function ref(ctx: WriteContext, key: string): string {
  return `#${ctx.idMap.get(key) || 0}`;
}

function addLine(ctx: WriteContext, key: string, line: string): number {
  const id = ctx.nextId++;
  ctx.idMap.set(key, id);
  ctx.lines.push(`#${id}=${line}`);
  return id;
}

export function writeIFC(
  project: Project,
  calendar: WorkCalendar,
  tasks: Task[],
  sequences: Sequence[],
  resources: Resource[],
  assignments: ResourceAssignment[],
): string {
  const ctx: WriteContext = { lines: [], nextId: 1, idMap: new Map() };
  const now = new Date().toISOString().split('.')[0];

  // Header
  const header = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');",
    `FILE_NAME('${project.name}.ifc','${now}',('${project.author || 'Open Planner Studio'}'),('${project.company || 'OpenAEC Foundation'}'),'Open Planner Studio 0.1','Open Planner Studio','');`,
    "FILE_SCHEMA(('IFC4X3'));",
    'ENDSEC;',
    'DATA;',
    '',
  ].join('\n');

  // Owner history
  const personId = addLine(ctx, '_person', `IFCPERSON($,${ifcStr(project.author)},$,$,$,$,$,$)`);
  const orgId = addLine(ctx, '_org', `IFCORGANIZATION($,${ifcStr(project.company)},$,$,$)`);
  const personOrgId = addLine(ctx, '_personorg', `IFCPERSONANDORGANIZATION(#${personId},#${orgId},$)`);
  const appOrgId = addLine(ctx, '_apporg', `IFCORGANIZATION($,'OpenAEC Foundation',$,$,$)`);
  const appId = addLine(ctx, '_app', `IFCAPPLICATION(#${appOrgId},'0.1','Open Planner Studio','OPS')`);
  const ownerHistId = addLine(ctx, '_owner', `IFCOWNERHISTORY(#${personOrgId},#${appId},$,.NOCHANGE.,$,$,$,${Math.floor(Date.now() / 1000)})`);

  // Units
  const mId = addLine(ctx, '_m', `IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`);
  const sId = addLine(ctx, '_s', `IFCSIUNIT(*,.TIMEUNIT.,$,.SECOND.)`);
  const unitAssId = addLine(ctx, '_units', `IFCUNITASSIGNMENT((#${mId},#${sId}))`);

  // Context
  const ptId = addLine(ctx, '_pt', `IFCCARTESIANPOINT((0.,0.,0.))`);
  const axId = addLine(ctx, '_ax', `IFCAXIS2PLACEMENT3D(#${ptId},$,$)`);
  const ctxId = addLine(ctx, '_ctx', `IFCGEOMETRICREPRESENTATIONCONTEXT($,'Plan',3,1.0E-05,#${axId},$)`);

  // Project
  addLine(ctx, '_project', `IFCPROJECT(${ifcStr(ifcGuid(project.id))},#${ownerHistId},${ifcStr(project.name)},$,$,$,$,(#${ctxId}),#${unitAssId})`);

  // Calendar
  writeCalendar(ctx, calendar, ownerHistId);

  // Work plan & schedule
  const startDates = tasks.map(t => t.time.scheduleStart).filter(Boolean).sort();
  const endDates = tasks.map(t => t.time.scheduleFinish).filter(Boolean).sort();
  const planStart = startDates[0] || project.startDate;
  const planEnd = endDates[endDates.length - 1] || project.endDate;

  const workPlanId = addLine(ctx, '_workplan',
    `IFCWORKPLAN(${ifcStr(ifcGuid(project.id + '_wp'))},#${ownerHistId},${ifcStr(project.name)},$,$,$,${ifcDateTime(now)},$,$,$,$,$,${ifcDateTime(planStart)},${ifcDateTime(planEnd)},.PLANNED.)`);

  const workSchedId = addLine(ctx, '_worksched',
    `IFCWORKSCHEDULE(${ifcStr(ifcGuid(project.id + '_ws'))},#${ownerHistId},${ifcStr('Bouwplanning v1.0')},$,$,$,${ifcDateTime(now)},$,$,$,$,$,${ifcDateTime(planStart)},${ifcDateTime(planEnd)},.PLANNED.)`);

  addLine(ctx, '_agg_plan_sched',
    `IFCRELAGGREGATES(${ifcStr(ifcGuid('agg_ps'))},#${ownerHistId},$,$,#${workPlanId},(#${workSchedId}))`);

  // Tasks
  for (const task of tasks) {
    writeTask(ctx, task, ownerHistId);
  }

  // WBS nesting
  writeWBSNesting(ctx, tasks, ownerHistId);

  // Root tasks -> schedule nesting
  const rootTasks = tasks.filter(t => !t.parentId);
  if (rootTasks.length > 0) {
    const rootRefs = rootTasks.map(t => ref(ctx, `task_${t.id}`)).join(',');
    addLine(ctx, '_nest_sched',
      `IFCRELNESTS(${ifcStr(ifcGuid('nest_root'))},#${ownerHistId},'WBS Hoofd',$,#${workSchedId},(${rootRefs}))`);
  }

  // Sequences
  for (const seq of sequences) {
    writeSequence(ctx, seq, ownerHistId);
  }

  // Resources
  for (const res of resources) {
    writeResource(ctx, res, ownerHistId);
  }

  // Resource assignments
  writeAssignments(ctx, assignments, ownerHistId);

  // Tasks -> WorkSchedule control
  if (tasks.length > 0) {
    const allTaskRefs = tasks.map(t => ref(ctx, `task_${t.id}`)).join(',');
    addLine(ctx, '_ctrl',
      `IFCRELASSIGNSTOCONTROL(${ifcStr(ifcGuid('ctrl'))},#${ownerHistId},$,$,(${allTaskRefs}),$,#${workSchedId})`);
  }

  // Footer
  const footer = '\nENDSEC;\nEND-ISO-10303-21;\n';

  return header + ctx.lines.join('\n') + footer;
}

function writeCalendar(ctx: WriteContext, cal: WorkCalendar, ownerHistId: number): number {
  // Work time recurrence (weekdays)
  const dayNums = cal.workDays.join(',');
  const startTime = `${String(cal.workStartHour).padStart(2, '0')}:00:00`;
  const endTime = `${String(cal.workEndHour).padStart(2, '0')}:00:00`;

  const timePeriodId = addLine(ctx, '_timeperiod', `IFCTIMEPERIOD('${startTime}','${endTime}')`);
  const recurrenceId = addLine(ctx, '_recurrence', `IFCRECURRENCEPATTERN(.WEEKLY.,$,(${dayNums}),$,$,$,$,(#${timePeriodId}))`);
  const workTimeId = addLine(ctx, '_worktime', `IFCWORKTIME('Standaard werkweek',.PREDICTED.,$,#${recurrenceId},$,$)`);

  // Holidays as exception times
  const holidayRefs: string[] = [];
  for (const holiday of cal.holidays) {
    const hId = addLine(ctx, `_holiday_${holiday.name}`,
      `IFCWORKTIME(${ifcStr(holiday.name)},.PREDICTED.,$,$,'${holiday.startDate}','${holiday.endDate}')`);
    holidayRefs.push(`#${hId}`);
  }

  const exceptStr = holidayRefs.length > 0 ? `(${holidayRefs.join(',')})` : '$';
  return addLine(ctx, '_calendar',
    `IFCWORKCALENDAR(${ifcStr(ifcGuid(cal.id))},#${ownerHistId},${ifcStr(cal.name)},${ifcStr(cal.description)},$,(#${workTimeId}),${exceptStr},.FIRSTSHIFT.)`);
}

function writeTask(ctx: WriteContext, task: Task, ownerHistId: number): void {
  const t = task.time;
  const taskTimeId = addLine(ctx, `tasktime_${task.id}`,
    `IFCTASKTIME(${ifcStr(task.name + ' Time')},.PREDICTED.,$,.${t.durationType}.,${ifcDuration(t.scheduleDuration)},${ifcDateTime(t.scheduleStart)},${ifcDateTime(t.scheduleFinish)},${ifcDateTime(t.earlyStart)},${ifcDateTime(t.earlyFinish)},${ifcDateTime(t.lateStart)},${ifcDateTime(t.lateFinish)},${ifcDuration(t.freeFloat)},${ifcDuration(t.totalFloat)},${ifcBool(t.isCritical)},$,$,$,$,$,${t.completion.toFixed(1)})`);

  const ifcTaskType = `.${task.taskType}.`;
  addLine(ctx, `task_${task.id}`,
    `IFCTASK(${ifcStr(ifcGuid(task.id))},#${ownerHistId},${ifcStr(task.name)},${ifcStr(task.description)},$,${ifcStr(task.wbsCode)},$,$,${ifcBool(task.isMilestone)},$,#${taskTimeId},${ifcTaskType})`);
}

function writeWBSNesting(ctx: WriteContext, tasks: Task[], ownerHistId: number): void {
  for (const task of tasks) {
    if (task.childIds.length === 0) continue;
    const childRefs = task.childIds
      .map(cid => ref(ctx, `task_${cid}`))
      .filter(r => r !== '#0')
      .join(',');
    if (childRefs) {
      addLine(ctx, `nest_${task.id}`,
        `IFCRELNESTS(${ifcStr(ifcGuid('nest_' + task.id))},#${ownerHistId},${ifcStr('WBS ' + task.name)},$,${ref(ctx, `task_${task.id}`)},( ${childRefs}))`);
    }
  }
}

function writeSequence(ctx: WriteContext, seq: Sequence, ownerHistId: number): void {
  let lagRef = '$';
  if (seq.lagDays !== 0) {
    const lagId = addLine(ctx, `lag_${seq.id}`,
      `IFCLAGTIME('Lag',.PREDICTED.,$,.WORKTIME.,${ifcDuration(Math.abs(seq.lagDays))})`);
    lagRef = `#${lagId}`;
  }

  addLine(ctx, `seq_${seq.id}`,
    `IFCRELSEQUENCE(${ifcStr(ifcGuid(seq.id))},#${ownerHistId},$,$,${ref(ctx, `task_${seq.predecessorId}`)},${ref(ctx, `task_${seq.successorId}`)},${lagRef},.${seq.type}.,$)`);
}

function writeResource(ctx: WriteContext, res: Resource, ownerHistId: number): void {
  let entity: string;
  switch (res.type) {
    case 'LABOR':
      entity = `IFCLABORRESOURCE(${ifcStr(ifcGuid(res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,.USERDEFINED.)`;
      break;
    case 'EQUIPMENT':
      entity = `IFCCONSTRUCTIONEQUIPMENTRESOURCE(${ifcStr(ifcGuid(res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,.USERDEFINED.)`;
      break;
    case 'SUBCONTRACTOR':
      entity = `IFCSUBCONTRACTRESOURCE(${ifcStr(ifcGuid(res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,.USERDEFINED.)`;
      break;
    default:
      entity = `IFCCONSTRUCTIONMATERIALRESOURCE(${ifcStr(ifcGuid(res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,.USERDEFINED.)`;
  }
  addLine(ctx, `res_${res.id}`, entity);
}

function writeAssignments(ctx: WriteContext, assignments: ResourceAssignment[], ownerHistId: number): void {
  // Group assignments by task
  const byTask = new Map<string, string[]>();
  for (const a of assignments) {
    const resRef = ref(ctx, `res_${a.resourceId}`);
    if (resRef === '#0') continue;
    if (!byTask.has(a.taskId)) byTask.set(a.taskId, []);
    byTask.get(a.taskId)!.push(resRef);
  }

  for (const [taskId, resRefs] of byTask) {
    const taskRef = ref(ctx, `task_${taskId}`);
    if (taskRef === '#0') continue;
    addLine(ctx, `assign_${taskId}`,
      `IFCRELASSIGNSTOPROCESS(${ifcStr(ifcGuid('assign_' + taskId))},#${ownerHistId},$,$,(${resRefs.join(',')}),$,${taskRef},$)`);
  }
}
