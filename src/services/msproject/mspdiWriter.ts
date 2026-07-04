import { Task } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar } from '@/types/calendar';
import { Baseline, BaselineTask } from '@/types/baseline';

// WorkContour-enum (fase 2.5, §8.3 — geverifieerd tegen de MSPDI-schemadocumentatie/MPXJ):
// 0=Flat, 1=BackLoaded, 2=FrontLoaded, 4=EarlyPeak, 5=LatePeak, 6=Bell. Index 3 en 7+
// (Contoured/varianten) worden niet gebruikt.
const CURVE_TO_WORKCONTOUR: Record<ResourceCurve, number> = {
  UNIFORM: 0,
  BACK_LOADED: 1,
  FRONT_LOADED: 2,
  EARLY_PEAK: 4,
  LATE_PEAK: 5,
  BELL: 6,
};

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

// MSPDI LagFormat (subset van DurationFormat): 7 = dagen, 8 = elapsed dagen (24/7),
// 19 = procent, 20 = elapsed procent. Bij procent staat LinkLag in tienden van een procent.
function lagFields(seq: Sequence, hoursPerDay: number): { linkLag: number; lagFormat: number } {
  const elapsed = seq.lagUnit === 'ELAPSEDTIME';
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    return { linkLag: Math.round(seq.lagPercent * 10), lagFormat: elapsed ? 20 : 19 };
  }
  if (elapsed) {
    // Elapsed dagen tellen 24 uur, onafhankelijk van de werkkalender.
    return { linkLag: seq.lagDays * 24 * 60 * 10, lagFormat: 8 };
  }
  return { linkLag: lagToTenthsOfMinutes(seq.lagDays, hoursPerDay), lagFormat: 7 };
}

function getOutlineLevel(wbs: string): number {
  if (!wbs) return 1;
  return wbs.split('.').length;
}

/** Schrijft één `<Calendar>`-blok (WeekDays + Exceptions) — hergebruikt voor de
 *  projectkalender (UID 1, `IsBaseCalendar`) én voor resource-kalenders (fase 2.5, §8.2). */
function writeCalendarBlock(
  lines: string[],
  indent: (level: number) => string,
  cal: WorkCalendar,
  uid: number,
  isBaseCalendar: boolean,
): void {
  lines.push(`${indent(2)}<Calendar>`);
  lines.push(`${indent(3)}<UID>${uid}</UID>`);
  lines.push(`${indent(3)}<Name>${escapeXML(cal.name)}</Name>`);
  lines.push(`${indent(3)}<IsBaseCalendar>${isBaseCalendar ? 1 : 0}</IsBaseCalendar>`);
  lines.push(`${indent(3)}<WeekDays>`);

  for (let day = 1; day <= 7; day++) {
    const isWorkDay = cal.workDays.includes(day);
    const mspDay = day === 7 ? 1 : day + 1;

    lines.push(`${indent(4)}<WeekDay>`);
    lines.push(`${indent(5)}<DayType>${mspDay}</DayType>`);
    lines.push(`${indent(5)}<DayWorking>${isWorkDay ? 1 : 0}</DayWorking>`);
    if (isWorkDay) {
      lines.push(`${indent(5)}<WorkingTimes>`);
      lines.push(`${indent(6)}<WorkingTime>`);
      lines.push(`${indent(7)}<FromTime>${String(cal.workStartHour).padStart(2, '0')}:00:00</FromTime>`);
      lines.push(`${indent(7)}<ToTime>${String(cal.workEndHour).padStart(2, '0')}:00:00</ToTime>`);
      lines.push(`${indent(6)}</WorkingTime>`);
      lines.push(`${indent(5)}</WorkingTimes>`);
    }
    lines.push(`${indent(4)}</WeekDay>`);
  }

  lines.push(`${indent(3)}</WeekDays>`);

  if (cal.holidays.length > 0) {
    lines.push(`${indent(3)}<Exceptions>`);
    for (const h of cal.holidays) {
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
}

export function writeMSPDI(
  project: Project,
  calendar: WorkCalendar,
  tasks: Task[],
  sequences: Sequence[],
  resources: Resource[],
  assignments: ResourceAssignment[],
  resourceCalendars: WorkCalendar[] = [],
  baselines: Baseline[] = [],
  activeBaselineId: string | null = null,
): string {
  const lines: string[] = [];
  const indent = (level: number) => '  '.repeat(level);

  // Fase 2.6 (§9.1): alleen de ACTIEVE baseline gaat naar MSPDI-slot 0 (Baseline Number 0).
  // De overige OPS-baselines verliezen we bewust (extra slots 1-10 = latere uitbreiding).
  const activeBaseline = baselines.find(b => b.id === activeBaselineId) ?? null;
  const baselineByTask = new Map<string, BaselineTask>(
    (activeBaseline?.tasks ?? []).map(bt => [bt.taskId, bt]),
  );

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
  // Statusdatum (fase 2.6, §9.1) — P6 data date → MSPDI <StatusDate>. Alleen wanneer gezet.
  if (project.statusDate) {
    lines.push(`${indent(1)}<StatusDate>${formatMSPDateTime(project.statusDate)}</StatusDate>`);
  }
  lines.push(`${indent(1)}<ScheduleFromStart>1</ScheduleFromStart>`);
  lines.push(`${indent(1)}<MinutesPerDay>${calendar.hoursPerDay * 60}</MinutesPerDay>`);
  lines.push(`${indent(1)}<MinutesPerWeek>${calendar.hoursPerDay * calendar.workDays.length * 60}</MinutesPerWeek>`);
  lines.push(`${indent(1)}<DaysPerMonth>20</DaysPerMonth>`);

  // Calendars: UID 1 = projectkalender (basiskalender); overige bibliotheek-kalenders (fase 2.5,
  // §8.2) krijgen UID 2, 3, ... — dezelfde `writeCalendarBlock` parametrisch hergebruikt.
  // `resourceCalendars` is sinds 2.8a de VOLLE bibliotheek (incl. de §4.3-gemigreerde
  // projectkalender-entry) — die entry uitsluiten voorkomt een dubbele UID-1-kalender.
  const libraryCalendars = resourceCalendars.filter(c => c.id !== calendar.id);
  const calUidMap = new Map<string, number>();
  calUidMap.set(calendar.id, 1);
  let nextCalUid = 2;
  for (const cal of libraryCalendars) {
    calUidMap.set(cal.id, nextCalUid++);
  }

  lines.push(`${indent(1)}<Calendars>`);
  writeCalendarBlock(lines, indent, calendar, 1, true);
  for (const cal of libraryCalendars) {
    writeCalendarBlock(lines, indent, cal, calUidMap.get(cal.id)!, false);
  }
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
    // Actuals (fase 2.6, §9.1) — alleen wanneer gezet (golden rule). RemainingDuration afgeleid.
    if (task.time.actualStart) {
      lines.push(`${indent(3)}<ActualStart>${formatMSPDateTime(task.time.actualStart)}</ActualStart>`);
    }
    if (task.time.actualFinish) {
      lines.push(`${indent(3)}<ActualFinish>${formatMSPDateTime(task.time.actualFinish)}</ActualFinish>`);
    }
    if (task.time.remainingTime != null) {
      lines.push(`${indent(3)}<RemainingDuration>${durationToISO8601(task.time.remainingTime, calendar.hoursPerDay)}</RemainingDuration>`);
    }
    // ?? i.p.v. || : priority 0 is een geldige waarde (laagste, levelt als eerste weg).
    lines.push(`${indent(3)}<Priority>${Number.isFinite(task.priority) ? task.priority : 500}</Priority>`);
    // Taak-kalender (fase 2.8a, §8.3): MSPDI ondersteunt taak-kalenders native via dit element —
    // effectieve UID i.p.v. het oude hardcoded 1 (projectkalender). Onbekende/verwijderde
    // calendarId valt terug op 1 (golden rule: geen eigen kalender ⇒ projectkalender-UID, zelfde
    // patroon als de resource-CalendarUID hieronder).
    const taskCalUid = (task.calendarId && calUidMap.get(task.calendarId)) || 1;
    lines.push(`${indent(3)}<CalendarUID>${taskCalUid}</CalendarUID>`);
    if (task.description) {
      lines.push(`${indent(3)}<Notes>${escapeXML(task.description)}</Notes>`);
    }
    // Baseline 0 (fase 2.6, §9.1) — Start/Finish/Duration uit de actieve OPS-baseline.
    const bt = baselineByTask.get(task.id);
    if (bt) {
      lines.push(`${indent(3)}<Baseline>`);
      lines.push(`${indent(4)}<Number>0</Number>`);
      lines.push(`${indent(4)}<Start>${formatMSPDateTime(bt.start)}</Start>`);
      lines.push(`${indent(4)}<Finish>${formatMSPDateTime(bt.finish)}</Finish>`);
      lines.push(`${indent(4)}<Duration>${durationToISO8601(bt.duration, calendar.hoursPerDay)}</Duration>`);
      lines.push(`${indent(3)}</Baseline>`);
    }

    // Predecessor links embedded in task
    const taskSeqs = sequences.filter(s => s.successorId === task.id);
    if (taskSeqs.length > 0) {
      for (const seq of taskSeqs) {
        const predUid = taskUidMap.get(seq.predecessorId);
        if (predUid === undefined) continue;
        const { linkLag, lagFormat } = lagFields(seq, calendar.hoursPerDay);
        lines.push(`${indent(3)}<PredecessorLink>`);
        lines.push(`${indent(4)}<PredecessorUID>${predUid}</PredecessorUID>`);
        lines.push(`${indent(4)}<Type>${sequenceTypeToMSP(seq.type)}</Type>`);
        lines.push(`${indent(4)}<LinkLag>${linkLag}</LinkLag>`);
        lines.push(`${indent(4)}<LagFormat>${lagFormat}</LagFormat>`);
        lines.push(`${indent(3)}</PredecessorLink>`);
      }
    }

    lines.push(`${indent(2)}</Task>`);
  }

  lines.push(`${indent(1)}</Tasks>`);

  // Resources (fase 2.5, §8.2)
  const resUidMap = new Map<string, number>();
  let nextResUid = 1;
  for (const res of resources) {
    resUidMap.set(res.id, nextResUid++);
  }

  lines.push(`${indent(1)}<Resources>`);
  for (const res of resources) {
    const uid = resUidMap.get(res.id)!;
    const calUid = (res.calendarId && calUidMap.get(res.calendarId)) || 1;
    lines.push(`${indent(2)}<Resource>`);
    lines.push(`${indent(3)}<UID>${uid}</UID>`);
    lines.push(`${indent(3)}<Name>${escapeXML(res.name)}</Name>`);
    // Type: 1=Work (LABOR/EQUIPMENT/CREW/SUBCONTRACTOR), 0=Material.
    lines.push(`${indent(3)}<Type>${res.type === 'MATERIAL' ? 0 : 1}</Type>`);
    lines.push(`${indent(3)}<MaxUnits>${res.maxUnits}</MaxUnits>`);
    if (res.type === 'MATERIAL' && res.unitOfMeasure) {
      lines.push(`${indent(3)}<MaterialLabel>${escapeXML(res.unitOfMeasure)}</MaterialLabel>`);
    }
    lines.push(`${indent(3)}<CalendarUID>${calUid}</CalendarUID>`);
    if (res.costPerHour !== undefined) {
      lines.push(`${indent(3)}<StandardRate>${res.costPerHour}</StandardRate>`);
    }
    lines.push(`${indent(2)}</Resource>`);
  }
  lines.push(`${indent(1)}</Resources>`);

  // Assignments (fase 2.5, §8.2): Work = duur x unitsPerDay x hoursPerDay, PT-formaat
  // (hergebruik van dezelfde durationToISO8601-helper als taakduur).
  if (assignments.length > 0) {
    lines.push(`${indent(1)}<Assignments>`);
    let asgnUid = 1;
    for (const a of assignments) {
      const taskUid = taskUidMap.get(a.taskId);
      const resUid = resUidMap.get(a.resourceId);
      if (taskUid === undefined || resUid === undefined) continue;
      const task = tasks.find(t => t.id === a.taskId);
      const workDays = (task?.time.scheduleDuration ?? 0) * a.unitsPerDay;

      lines.push(`${indent(2)}<Assignment>`);
      lines.push(`${indent(3)}<UID>${asgnUid++}</UID>`);
      lines.push(`${indent(3)}<TaskUID>${taskUid}</TaskUID>`);
      lines.push(`${indent(3)}<ResourceUID>${resUid}</ResourceUID>`);
      lines.push(`${indent(3)}<Units>${a.unitsPerDay}</Units>`);
      lines.push(`${indent(3)}<Work>${durationToISO8601(workDays, calendar.hoursPerDay)}</Work>`);
      const contour = CURVE_TO_WORKCONTOUR[a.curve ?? 'UNIFORM'];
      if (contour !== 0) {
        lines.push(`${indent(3)}<WorkContour>${contour}</WorkContour>`);
      }
      lines.push(`${indent(2)}</Assignment>`);
    }
    lines.push(`${indent(1)}</Assignments>`);
  }

  lines.push('</Project>');

  return lines.join('\n');
}
