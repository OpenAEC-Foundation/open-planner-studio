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

function formatMSPDateTime(iso: string): string {
  if (!iso) return '';
  // MS Project expects: 2026-03-09T08:00:00
  if (iso.length === 10) return `${iso}T08:00:00`;
  return iso;
}

function durationToISO8601(days: number, hoursPerDay: number): string {
  // MS Project uses PT format: PT40H0M0S for 5 days * 8h
  const totalHours = days * hoursPerDay;
  return `PT${totalHours}H0M0S`;
}

function sequenceTypeToMSP(type: SequenceType): number {
  switch (type) {
    case 'FINISH_FINISH': return 0;
    case 'FINISH_START': return 1;
    case 'START_FINISH': return 2;
    case 'START_START': return 3;
  }
}

function lagToTenthsOfMinutes(lagDays: number, hoursPerDay: number): number {
  // MS Project stores lag in tenths of minutes
  return lagDays * hoursPerDay * 60 * 10;
}

function getOutlineLevel(wbs: string): number {
  if (!wbs) return 1;
  return wbs.split('.').length;
}

export function writeMSPDI(
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
  lines.push('<Project xmlns="http://schemas.microsoft.com/project">');

  // Project properties
  lines.push(`${indent(1)}<Name>${escapeXML(project.name)}</Name>`);
  lines.push(`${indent(1)}<Title>${escapeXML(project.name)}</Title>`);
  lines.push(`${indent(1)}<Author>${escapeXML(project.author)}</Author>`);
  lines.push(`${indent(1)}<Company>${escapeXML(project.company)}</Company>`);
  lines.push(`${indent(1)}<CreationDate>${formatMSPDateTime(project.createdAt.substring(0, 10))}</CreationDate>`);
  lines.push(`${indent(1)}<StartDate>${formatMSPDateTime(project.startDate)}</StartDate>`);
  if (project.endDate) {
    lines.push(`${indent(1)}<FinishDate>${formatMSPDateTime(project.endDate)}</FinishDate>`);
  }
  lines.push(`${indent(1)}<ScheduleFromStart>1</ScheduleFromStart>`);
  lines.push(`${indent(1)}<MinutesPerDay>${calendar.hoursPerDay * 60}</MinutesPerDay>`);
  lines.push(`${indent(1)}<MinutesPerWeek>${calendar.hoursPerDay * calendar.workDays.length * 60}</MinutesPerWeek>`);
  lines.push(`${indent(1)}<DaysPerMonth>20</DaysPerMonth>`);

  // Calendars
  lines.push(`${indent(1)}<Calendars>`);
  lines.push(`${indent(2)}<Calendar>`);
  lines.push(`${indent(3)}<UID>1</UID>`);
  lines.push(`${indent(3)}<Name>${escapeXML(calendar.name)}</Name>`);
  lines.push(`${indent(3)}<IsBaseCalendar>1</IsBaseCalendar>`);
  lines.push(`${indent(3)}<WeekDays>`);

  for (let day = 1; day <= 7; day++) {
    const isWorkDay = calendar.workDays.includes(day);
    // MS Project uses 1=Sunday, 2=Monday, ..., 7=Saturday
    // Our format: 1=Monday, ..., 7=Sunday (ISO)
    // Convert: ISO 1(Mon)->MSP 2, ISO 7(Sun)->MSP 1
    const mspDay = day === 7 ? 1 : day + 1;

    lines.push(`${indent(4)}<WeekDay>`);
    lines.push(`${indent(5)}<DayType>${mspDay}</DayType>`);
    lines.push(`${indent(5)}<DayWorking>${isWorkDay ? 1 : 0}</DayWorking>`);
    if (isWorkDay) {
      lines.push(`${indent(5)}<WorkingTimes>`);
      lines.push(`${indent(6)}<WorkingTime>`);
      lines.push(`${indent(7)}<FromTime>${String(calendar.workStartHour).padStart(2, '0')}:00:00</FromTime>`);
      lines.push(`${indent(7)}<ToTime>${String(calendar.workEndHour).padStart(2, '0')}:00:00</ToTime>`);
      lines.push(`${indent(6)}</WorkingTime>`);
      lines.push(`${indent(5)}</WorkingTimes>`);
    }
    lines.push(`${indent(4)}</WeekDay>`);
  }

  lines.push(`${indent(3)}</WeekDays>`);

  // Holidays as exceptions
  if (calendar.holidays.length > 0) {
    lines.push(`${indent(3)}<Exceptions>`);
    for (let i = 0; i < calendar.holidays.length; i++) {
      const h = calendar.holidays[i];
      lines.push(`${indent(4)}<Exception>`);
      lines.push(`${indent(5)}<EnteredByOccurrences>0</EnteredByOccurrences>`);
      lines.push(`${indent(5)}<TimePeriod>`);
      lines.push(`${indent(6)}<FromDate>${formatMSPDateTime(h.startDate)}</FromDate>`);
      lines.push(`${indent(6)}<ToDate>${formatMSPDateTime(h.endDate)}</ToDate>`);
      lines.push(`${indent(5)}</TimePeriod>`);
      lines.push(`${indent(5)}<Name>${escapeXML(h.name)}</Name>`);
      lines.push(`${indent(5)}<Type>1</Type>`);
      lines.push(`${indent(5)}<DayWorking>0</DayWorking>`);
      lines.push(`${indent(4)}</Exception>`);
    }
    lines.push(`${indent(3)}</Exceptions>`);
  }

  lines.push(`${indent(2)}</Calendar>`);
  lines.push(`${indent(1)}</Calendars>`);

  // Build task UID map
  const taskUidMap = new Map<string, number>();
  // UID 0 is reserved for summary project task
  for (let i = 0; i < tasks.length; i++) {
    taskUidMap.set(tasks[i].id, i + 1);
  }

  // Tasks
  lines.push(`${indent(1)}<Tasks>`);

  // Project summary task (UID 0)
  lines.push(`${indent(2)}<Task>`);
  lines.push(`${indent(3)}<UID>0</UID>`);
  lines.push(`${indent(3)}<ID>0</ID>`);
  lines.push(`${indent(3)}<Name>${escapeXML(project.name)}</Name>`);
  lines.push(`${indent(3)}<OutlineLevel>0</OutlineLevel>`);
  lines.push(`${indent(3)}<Summary>1</Summary>`);
  lines.push(`${indent(2)}</Task>`);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const uid = i + 1;
    const isSummary = task.childIds.length > 0;
    const isMilestone = task.isMilestone || task.time.scheduleDuration === 0;

    lines.push(`${indent(2)}<Task>`);
    lines.push(`${indent(3)}<UID>${uid}</UID>`);
    lines.push(`${indent(3)}<ID>${uid}</ID>`);
    lines.push(`${indent(3)}<Name>${escapeXML(task.name)}</Name>`);
    lines.push(`${indent(3)}<Duration>${durationToISO8601(task.time.scheduleDuration, calendar.hoursPerDay)}</Duration>`);
    lines.push(`${indent(3)}<Start>${formatMSPDateTime(task.time.earlyStart || task.time.scheduleStart)}</Start>`);
    lines.push(`${indent(3)}<Finish>${formatMSPDateTime(task.time.earlyFinish || task.time.scheduleFinish)}</Finish>`);
    lines.push(`${indent(3)}<WBS>${escapeXML(task.wbsCode)}</WBS>`);
    lines.push(`${indent(3)}<OutlineLevel>${getOutlineLevel(task.wbsCode)}</OutlineLevel>`);
    lines.push(`${indent(3)}<Summary>${isSummary ? 1 : 0}</Summary>`);
    lines.push(`${indent(3)}<Milestone>${isMilestone ? 1 : 0}</Milestone>`);
    lines.push(`${indent(3)}<PercentComplete>${Math.round(task.time.completion * 100)}</PercentComplete>`);
    lines.push(`${indent(3)}<Priority>${task.priority || 500}</Priority>`);
    lines.push(`${indent(3)}<CalendarUID>1</CalendarUID>`);
    if (task.description) {
      lines.push(`${indent(3)}<Notes>${escapeXML(task.description)}</Notes>`);
    }

    // Predecessor links embedded in task
    const taskSeqs = sequences.filter(s => s.successorId === task.id);
    if (taskSeqs.length > 0) {
      for (const seq of taskSeqs) {
        const predUid = taskUidMap.get(seq.predecessorId);
        if (predUid === undefined) continue;
        lines.push(`${indent(3)}<PredecessorLink>`);
        lines.push(`${indent(4)}<PredecessorUID>${predUid}</PredecessorUID>`);
        lines.push(`${indent(4)}<Type>${sequenceTypeToMSP(seq.type)}</Type>`);
        lines.push(`${indent(4)}<LinkLag>${lagToTenthsOfMinutes(seq.lagDays, calendar.hoursPerDay)}</LinkLag>`);
        lines.push(`${indent(4)}<LagFormat>7</LagFormat>`);
        lines.push(`${indent(3)}</PredecessorLink>`);
      }
    }

    lines.push(`${indent(2)}</Task>`);
  }

  lines.push(`${indent(1)}</Tasks>`);

  lines.push('</Project>');

  return lines.join('\n');
}
