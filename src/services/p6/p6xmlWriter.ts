import { Task } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar } from '@/types/calendar';

function escapeXML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatP6DateTime(iso: string): string {
  if (!iso) return '';
  // P6 expects: 2026-03-09T08:00:00
  if (iso.length === 10) return `${iso}T08:00:00`;
  return iso;
}

function sequenceTypeToP6(type: SequenceType): string {
  switch (type) {
    case 'FINISH_START': return 'PR_FS';
    case 'FINISH_FINISH': return 'PR_FF';
    case 'START_START': return 'PR_SS';
    case 'START_FINISH': return 'PR_SF';
  }
}

function taskStatusToP6(task: Task): string {
  if (task.status === 'COMPLETED') return 'Completed';
  if (task.status === 'STARTED') return 'In Progress';
  return 'Not Started';
}

function taskTypeToP6(task: Task): string {
  if (task.isMilestone) {
    // Fase 2.4: de expliciete soort bepaalt het P6-activitytype; automatisch =>
    // Start Milestone (P6's eigen default bij import). De oude duur-check was
    // dode code: mijlpalen hebben altijd duur 0.
    return task.milestoneKind === 'FINISH' ? 'Finish Milestone' : 'Start Milestone';
  }
  if (task.childIds.length > 0) return 'WBS Summary';
  return 'Task Dependent';
}

function durationToP6Hours(days: number, hoursPerDay: number): number {
  return days * hoursPerDay;
}

export function writeP6XML(
  project: Project,
  calendar: WorkCalendar,
  tasks: Task[],
  sequences: Sequence[],
  _resources: Resource[],
  _assignments: ResourceAssignment[],
): string {
  const lines: string[] = [];
  const indent = (level: number) => '  '.repeat(level);

  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  lines.push('<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V23.12/API/BusinessObjects" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">');

  // Build object ID maps
  const taskObjMap = new Map<string, number>();
  let nextObjId = 1;
  for (const task of tasks) {
    taskObjMap.set(task.id, nextObjId++);
  }

  // WBS elements (parent tasks)
  const wbsTasks = tasks.filter(t => t.childIds.length > 0);
  const leafTasks = tasks.filter(t => t.childIds.length === 0);

  // Project
  lines.push(`${indent(1)}<Project>`);
  lines.push(`${indent(2)}<ObjectId>1</ObjectId>`);
  lines.push(`${indent(2)}<Id>${escapeXML(project.id)}</Id>`);
  lines.push(`${indent(2)}<Name>${escapeXML(project.name)}</Name>`);
  lines.push(`${indent(2)}<Description>${escapeXML(project.description)}</Description>`);
  lines.push(`${indent(2)}<PlannedStartDate>${formatP6DateTime(project.startDate)}</PlannedStartDate>`);
  if (project.endDate) {
    lines.push(`${indent(2)}<MustFinishByDate>${formatP6DateTime(project.endDate)}</MustFinishByDate>`);
  }
  lines.push(`${indent(2)}<Status>${project.endDate ? 'Active' : 'Planned'}</Status>`);
  lines.push(`${indent(1)}</Project>`);

  // Calendar
  lines.push(`${indent(1)}<Calendar>`);
  lines.push(`${indent(2)}<ObjectId>1</ObjectId>`);
  lines.push(`${indent(2)}<Name>${escapeXML(calendar.name)}</Name>`);
  lines.push(`${indent(2)}<Type>Global</Type>`);
  lines.push(`${indent(2)}<HoursPerDay>${calendar.hoursPerDay}</HoursPerDay>`);
  lines.push(`${indent(2)}<HoursPerWeek>${calendar.hoursPerDay * calendar.workDays.length}</HoursPerWeek>`);
  lines.push(`${indent(2)}<HoursPerMonth>${calendar.hoursPerDay * 20}</HoursPerMonth>`);
  lines.push(`${indent(1)}</Calendar>`);

  // WBS elements
  for (const wbsTask of wbsTasks) {
    const objId = taskObjMap.get(wbsTask.id)!;
    const parentObjId = wbsTask.parentId ? taskObjMap.get(wbsTask.parentId) : undefined;

    lines.push(`${indent(1)}<WBS>`);
    lines.push(`${indent(2)}<ObjectId>${objId}</ObjectId>`);
    lines.push(`${indent(2)}<Code>${escapeXML(wbsTask.wbsCode)}</Code>`);
    lines.push(`${indent(2)}<Name>${escapeXML(wbsTask.name)}</Name>`);
    lines.push(`${indent(2)}<ProjectObjectId>1</ProjectObjectId>`);
    if (parentObjId !== undefined) {
      lines.push(`${indent(2)}<ParentObjectId>${parentObjId}</ParentObjectId>`);
    }
    lines.push(`${indent(1)}</WBS>`);
  }

  // Activities (leaf tasks only in P6)
  for (const task of leafTasks) {
    const objId = taskObjMap.get(task.id)!;
    const wbsObjId = task.parentId ? taskObjMap.get(task.parentId) : undefined;

    lines.push(`${indent(1)}<Activity>`);
    lines.push(`${indent(2)}<ObjectId>${objId}</ObjectId>`);
    lines.push(`${indent(2)}<Id>${escapeXML(task.wbsCode || task.id)}</Id>`);
    lines.push(`${indent(2)}<Name>${escapeXML(task.name)}</Name>`);
    lines.push(`${indent(2)}<ProjectObjectId>1</ProjectObjectId>`);
    if (wbsObjId !== undefined) {
      lines.push(`${indent(2)}<WBSObjectId>${wbsObjId}</WBSObjectId>`);
    }
    lines.push(`${indent(2)}<Type>${taskTypeToP6(task)}</Type>`);
    lines.push(`${indent(2)}<Status>${taskStatusToP6(task)}</Status>`);
    lines.push(`${indent(2)}<PlannedDuration>${durationToP6Hours(task.time.scheduleDuration, calendar.hoursPerDay)}</PlannedDuration>`);
    lines.push(`${indent(2)}<PlannedStartDate>${formatP6DateTime(task.time.earlyStart || task.time.scheduleStart)}</PlannedStartDate>`);
    lines.push(`${indent(2)}<PlannedFinishDate>${formatP6DateTime(task.time.earlyFinish || task.time.scheduleFinish)}</PlannedFinishDate>`);
    if (task.time.completion > 0) {
      lines.push(`${indent(2)}<PhysicalPercentComplete>${Math.round(task.time.completion * 100)}</PhysicalPercentComplete>`);
    }
    if (task.description) {
      lines.push(`${indent(2)}<Description>${escapeXML(task.description)}</Description>`);
    }
    lines.push(`${indent(2)}<CalendarObjectId>1</CalendarObjectId>`);
    lines.push(`${indent(1)}</Activity>`);
  }

  // Relationships (sequences). P6 kent geen procent-lag en geen lag-eenheid per relatie
  // (de lag-kalender is in P6 een projectbrede scheduling-optie): procent-lag wordt hier
  // uitgebakken naar vaste uren op basis van de huidige voorgangerduur, en kalenderdag-lag
  // exporteert als gewone uren — beide met een waarschuwing in de log.
  const taskById = new Map(tasks.map(t => [t.id, t]));
  let relObjId = 1;
  for (const seq of sequences) {
    const predObjId = taskObjMap.get(seq.predecessorId);
    const succObjId = taskObjMap.get(seq.successorId);
    if (predObjId === undefined || succObjId === undefined) continue;

    let lagDays = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
    if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
      const pred = taskById.get(seq.predecessorId);
      const predDur = pred && !pred.isMilestone ? pred.time.scheduleDuration : 0;
      lagDays = Math.round((predDur * seq.lagPercent) / 100);
      console.warn(`P6-export: procent-lag (${seq.lagPercent}%) uitgebakken naar ${lagDays} dagen — P6 kent geen procent-lag.`);
    }
    if (seq.lagUnit === 'ELAPSEDTIME') {
      console.warn('P6-export: kalenderdag-lag geëxporteerd als gewone lag-uren — P6 heeft geen lag-eenheid per relatie.');
    }

    lines.push(`${indent(1)}<Relationship>`);
    lines.push(`${indent(2)}<ObjectId>${relObjId++}</ObjectId>`);
    lines.push(`${indent(2)}<PredecessorActivityObjectId>${predObjId}</PredecessorActivityObjectId>`);
    lines.push(`${indent(2)}<SuccessorActivityObjectId>${succObjId}</SuccessorActivityObjectId>`);
    lines.push(`${indent(2)}<Type>${sequenceTypeToP6(seq.type)}</Type>`);
    lines.push(`${indent(2)}<Lag>${durationToP6Hours(lagDays, calendar.hoursPerDay)}</Lag>`);
    lines.push(`${indent(2)}<ProjectObjectId>1</ProjectObjectId>`);
    lines.push(`${indent(1)}</Relationship>`);
  }

  lines.push('</APIBusinessObjects>');

  return lines.join('\n');
}
