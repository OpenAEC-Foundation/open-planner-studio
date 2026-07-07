import { Task, TaskConstraint } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment, ResourceType, ResourceCurve } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar } from '@/types/calendar';
import { effectiveCalendarByTask, isHourCalendar, minutesToClock, taskMinutesForWrite } from '@/services/subdayIo';

// Curve-/contour-naammapping (fase 2.5, §8.3): P6 kent geen `LATE_PEAK`-curve — beste
// benadering is 'Early Peak' (gedocumenteerd verlies, zie verliesmatrix §8.4). UNIFORM wordt
// nooit geschreven als expliciet `<PlannedCurve>`-element: 'Linear' is P6's eigen default.
const P6_CURVE_TO_NAME: Record<ResourceCurve, string | undefined> = {
  UNIFORM: undefined,
  FRONT_LOADED: 'Front Loaded',
  BACK_LOADED: 'Back Loaded',
  BELL: 'Bell Shaped',
  EARLY_PEAK: 'Early Peak',
  LATE_PEAK: 'Early Peak',
};

function resourceTypeToP6(type: ResourceType): 'Labor' | 'Nonlabor' | 'Material' {
  switch (type) {
    case 'LABOR':
    case 'CREW':
      return 'Labor';
    case 'MATERIAL':
      return 'Material';
    case 'EQUIPMENT':
    case 'SUBCONTRACTOR':
      return 'Nonlabor';
  }
}

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
  // Fase 2.8b (§7.3): uur-instant `YYYY-MM-DDTHH:mm` (16 tekens) → vul aan tot seconden.
  if (iso.length === 16) return `${iso}:00`;
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

/**
 * Fase 2.9 (§6) — OPS-constraint → P6 `CS_*`-code (Rapport B §1/§8.3). Soft-typen mappen
 * 1-op-1 op P6's soft constraints (`CS_MSO/MSOA/MSOB/MEO/MEOA/MEOB/ALAP`); de logica-brekende
 * harde MSO/MFO-pin op `CS_MANDSTART`/`CS_MANDFIN` (semantiek exact gescheiden, P6 kent soft én
 * hard native). `ASAP` ⇒ geen constraint (leeg veld) ⇒ `undefined`.
 * De P6-XML-elementnamen (`PrimaryConstraintType` etc.) volgen de MPXJ-PMXML-conventie
 * (github.com/joniles/mpxj — PrimaveraPMFileWriter); het domeinrapport verifieerde de XER-
 * kolomnamen (`cstr_type`), niet de PMXML-elementnamen — die zijn dus MPXJ-conventie (medium).
 */
function p6ConstraintCode(c: TaskConstraint): string | undefined {
  switch (c.type) {
    case 'ASAP': return undefined;
    case 'ALAP': return 'CS_ALAP';
    case 'SNET': return 'CS_MSOA';
    case 'SNLT': return 'CS_MSOB';
    case 'FNET': return 'CS_MEOA';
    case 'FNLT': return 'CS_MEOB';
    case 'MSO': return c.hard ? 'CS_MANDSTART' : 'CS_MSO';
    case 'MFO': return c.hard ? 'CS_MANDFIN' : 'CS_MEO';
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

// ISO-dagnummer (1=maandag..7=zondag) -> P6/Engelse dagnaam. Geëxporteerd zodat de reader
// (spiegel-mapping, fase 2.8a §8.3) de naam terug naar een ISO-dagnummer kan resolven.
export const P6_DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Werkweek (fase 2.8a, §8.3): `<StandardWorkWeek>` met per dag een `<StandardWorkHour>` — alleen
 *  werkdagen (`cal.workDays`) krijgen een `<WorkTime>`-blok, niet-werkdagen blijven leeg (P6 leest
 *  afwezigheid van `WorkTime` als niet-werkend). Altijd geschreven (geen golden-rule-gate: er
 *  zijn geen bestaande P6-golden-bestanden om te breken, en dit was tot nu toe een gat, §8.4). */
function writeStandardWorkWeek(lines: string[], indent: (level: number) => string, cal: WorkCalendar): void {
  lines.push(`${indent(2)}<StandardWorkWeek>`);
  for (let day = 1; day <= 7; day++) {
    lines.push(`${indent(3)}<StandardWorkHour>`);
    lines.push(`${indent(4)}<DayOfWeek>${P6_DAY_NAMES[day]}</DayOfWeek>`);
    if (cal.workTime) {
      // Fase 2.8b (§7.2): UUR-kalender ⇒ ALLE banden van deze weekdag als aparte <WorkTime>-blokken
      // (pauze/split-shift/nachtploeg). Een wrap-band (`end > 1440`) emitteert het eind als
      // tijd-van-de-dag (`end % 1440`, via `minutesToClock`), waaruit de reader de wrap herkent.
      for (const b of cal.workTime.byWeekday[day as 1] ?? []) {
        lines.push(`${indent(4)}<WorkTime>`);
        lines.push(`${indent(5)}<Start>${minutesToClock(b.start)}</Start>`);
        lines.push(`${indent(5)}<Finish>${minutesToClock(b.end)}</Finish>`);
        lines.push(`${indent(4)}</WorkTime>`);
      }
    } else if (cal.workDays.includes(day)) {
      lines.push(`${indent(4)}<WorkTime>`);
      lines.push(`${indent(5)}<Start>${String(cal.workStartHour).padStart(2, '0')}:00:00</Start>`);
      lines.push(`${indent(5)}<Finish>${String(cal.workEndHour).padStart(2, '0')}:00:00</Finish>`);
      lines.push(`${indent(4)}</WorkTime>`);
    }
    lines.push(`${indent(3)}</StandardWorkHour>`);
  }
  lines.push(`${indent(2)}</StandardWorkWeek>`);
}

/** Feestdagen/exceptions (fase 2.8a, §8.3): `<HolidayOrExceptions>` — golden rule: geen
 *  feestdagen ⇒ geen element. */
function writeHolidayOrExceptions(lines: string[], indent: (level: number) => string, cal: WorkCalendar): void {
  if (cal.holidays.length === 0) return;
  lines.push(`${indent(2)}<HolidayOrExceptions>`);
  for (const h of cal.holidays) {
    lines.push(`${indent(3)}<HolidayOrException>`);
    lines.push(`${indent(4)}<Name>${escapeXML(h.name)}</Name>`);
    lines.push(`${indent(4)}<Date>${formatP6DateTime(h.startDate)}</Date>`);
    lines.push(`${indent(4)}<FinishDate>${formatP6DateTime(h.endDate)}</FinishDate>`);
    lines.push(`${indent(3)}</HolidayOrException>`);
  }
  lines.push(`${indent(2)}</HolidayOrExceptions>`);
}

export function writeP6XML(
  project: Project,
  calendar: WorkCalendar,
  tasks: Task[],
  sequences: Sequence[],
  resources: Resource[],
  assignments: ResourceAssignment[],
  resourceCalendars: WorkCalendar[] = [],
): string {
  const lines: string[] = [];
  const indent = (level: number) => '  '.repeat(level);

  // Fase 2.9 (§4.5/§6): externe (cross-project) dependencies zijn in P6-XML niet uitdrukbaar buiten de
  // (uitgestelde) master/subproject-context ⇒ weggelaten (de ghost-weergave blijft in-app). Één warn.
  const extLinkCount = tasks.reduce((n, t) => n + (t.externalLinks?.length ?? 0), 0);
  if (extLinkCount > 0) {
    console.warn(`P6-export: ${extLinkCount} externe (cross-project) dependency(s) weggelaten — niet uitdrukbaar in P6-XML (§6).`);
  }

  // Fase 2.9 (§6): P6 kent native LOE-activity's, maar de exacte `task_type`-code is UNVERIFIED in
  // het domeinrapport ⇒ NIET gokken: een hammock exporteert als gewone taak met de berekende datums
  // (de span leeft al in early/late-start/finish). Eén warn.
  const hammockCount = tasks.filter(t => t.isHammock).length;
  if (hammockCount > 0) {
    console.warn(`P6-export: ${hammockCount} hammock/LOE-taak/-taken geëxporteerd als gewone taak met berekende datums — P6 native LOE-type UNVERIFIED, niet gegokt (§6).`);
  }

  // Fase 2.9 (§6): scheduling-options native P6 SCHEDOPTIONS is aspiratie (velden UNVERIFIED) ⇒ niet
  // geschreven; alleen een warn wanneer een niet-lege optie-set verloren gaat (de volle set round-trippt
  // wél via IFC OPS_SchedulingOptions).
  if (project.schedulingOptions && Object.keys(project.schedulingOptions).length > 0) {
    console.warn('P6-export: scheduling-opties niet geëxporteerd — P6 SCHEDOPTIONS-mapping UNVERIFIED (aspiratie, §6).');
  }

  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  lines.push('<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V23.12/API/BusinessObjects" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">');

  // Build object ID maps
  const taskObjMap = new Map<string, number>();
  let nextObjId = 1;
  for (const task of tasks) {
    taskObjMap.set(task.id, nextObjId++);
  }

  // Resource- en resource-kalender-ObjectIds: eigen, aparte teller-ruimtes (net als
  // Relationship hieronder al een eigen `relObjId`-teller heeft — ObjectId-uniciteit is in
  // echte P6-XML per entiteitstype, niet globaal over het bestand).
  const resObjMap = new Map<string, number>();
  let nextResObjId = 1;
  for (const res of resources) {
    resObjMap.set(res.id, nextResObjId++);
  }
  // `resourceCalendars` is sinds 2.8a de VOLLE bibliotheek (incl. de §4.3-gemigreerde
  // projectkalender-entry) — die entry uitsluiten voorkomt een dubbele ObjectId-1-kalender.
  const libraryCalendars = resourceCalendars.filter(c => c.id !== calendar.id);
  const calObjMap = new Map<string, number>();
  calObjMap.set(calendar.id, 1); // projectkalender, zie hieronder <Calendar><ObjectId>1</ObjectId>
  let nextCalObjId = 2;
  for (const cal of libraryCalendars) {
    calObjMap.set(cal.id, nextCalObjId++);
  }

  // Fase 2.8b (§7.2): effectieve kalender per taak → uur- vs dag-modus.
  const effCalByTask = effectiveCalendarByTask(tasks, calendar, libraryCalendars);

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
  // Data date (fase 2.6, §9.2) — P6's peildatum. Alleen wanneer gezet (golden rule).
  if (project.statusDate) {
    lines.push(`${indent(2)}<DataDate>${formatP6DateTime(project.statusDate)}</DataDate>`);
  }
  lines.push(`${indent(1)}</Project>`);

  // Calendar
  lines.push(`${indent(1)}<Calendar>`);
  lines.push(`${indent(2)}<ObjectId>1</ObjectId>`);
  lines.push(`${indent(2)}<Name>${escapeXML(calendar.name)}</Name>`);
  lines.push(`${indent(2)}<Type>Global</Type>`);
  lines.push(`${indent(2)}<HoursPerDay>${calendar.hoursPerDay}</HoursPerDay>`);
  lines.push(`${indent(2)}<HoursPerWeek>${calendar.hoursPerDay * calendar.workDays.length}</HoursPerWeek>`);
  lines.push(`${indent(2)}<HoursPerMonth>${calendar.hoursPerDay * 20}</HoursPerMonth>`);
  writeStandardWorkWeek(lines, indent, calendar);
  writeHolidayOrExceptions(lines, indent, calendar);
  lines.push(`${indent(1)}</Calendar>`);

  // Bibliotheek-kalenders (fase 2.5/2.8a, §8.1/§8.3) — zelfde element als de projectkalender maar
  // met Type="Resource" en een eigen ObjectId; komen ná de projectkalender zodat de eerste
  // <Calendar> in het bestand altijd de projectkalender blijft (bestaande reader-aanname).
  for (const cal of libraryCalendars) {
    const objId = calObjMap.get(cal.id)!;
    lines.push(`${indent(1)}<Calendar>`);
    lines.push(`${indent(2)}<ObjectId>${objId}</ObjectId>`);
    lines.push(`${indent(2)}<Name>${escapeXML(cal.name)}</Name>`);
    lines.push(`${indent(2)}<Type>Resource</Type>`);
    lines.push(`${indent(2)}<HoursPerDay>${cal.hoursPerDay}</HoursPerDay>`);
    lines.push(`${indent(2)}<HoursPerWeek>${cal.hoursPerDay * cal.workDays.length}</HoursPerWeek>`);
    lines.push(`${indent(2)}<HoursPerMonth>${cal.hoursPerDay * 20}</HoursPerMonth>`);
    writeStandardWorkWeek(lines, indent, cal);
    writeHolidayOrExceptions(lines, indent, cal);
    lines.push(`${indent(1)}</Calendar>`);
  }

  // Resources (fase 2.5, §8.1)
  for (const res of resources) {
    const objId = resObjMap.get(res.id)!;
    lines.push(`${indent(1)}<Resource>`);
    lines.push(`${indent(2)}<ObjectId>${objId}</ObjectId>`);
    lines.push(`${indent(2)}<Id>${escapeXML(res.id)}</Id>`);
    lines.push(`${indent(2)}<Name>${escapeXML(res.name)}</Name>`);
    lines.push(`${indent(2)}<ResourceType>${resourceTypeToP6(res.type)}</ResourceType>`);
    const calObjId = (res.calendarId && calObjMap.get(res.calendarId)) || 1;
    lines.push(`${indent(2)}<CalendarObjectId>${calObjId}</CalendarObjectId>`);
    // MaxUnitsPerTime: in P6-XML een dimensieloze FRACTIE (1.0 = 100% = één volle eenheid),
    // GEEN uren/dag (L2-fix — geverifieerd tegen MPXJ: XmlContextWriter.writeResource schrijft
    // `getDefaultUnits() / 100.0`, en MPXJ-intern is 100 = 100%, dus 1.0 in het bestand = 100%;
    // bron: github.com/joniles/mpxj — org/mpxj/primavera/XmlContextWriter.java,
    // PmxmlUnitsHelper.java + AbstractUnitsHelper.getPercentage). Ons `maxUnits` is al een
    // fractie (1 = één persoon/stuk), dus 1:1 wegschrijven.
    lines.push(`${indent(2)}<MaxUnitsPerTime>${res.maxUnits}</MaxUnitsPerTime>`);
    if (res.type === 'MATERIAL' && res.unitOfMeasure) {
      lines.push(`${indent(2)}<UnitOfMeasureAbbreviation>${escapeXML(res.unitOfMeasure)}</UnitOfMeasureAbbreviation>`);
    }
    if (res.parentId && resObjMap.has(res.parentId)) {
      lines.push(`${indent(2)}<ParentObjectId>${resObjMap.get(res.parentId)}</ParentObjectId>`);
    }
    lines.push(`${indent(1)}</Resource>`);
  }

  // ResourceRates (fase 2.5, M4-fix): P6-XML draagt het tarief NIET op <Resource> zelf maar
  // in aparte top-level <ResourceRate>-elementen (siblings van <Resource> onder
  // APIBusinessObjects), met ResourceObjectId + PricePerUnit (tarief per uur) + EffectiveDate
  // — zo schrijft MPXJ het ook (XmlContextWriter.writeResourceRates: EffectiveDate,
  // MaxUnitsPerTime, ObjectId, PricePerUnit(1-5), ResourceObjectId; bron:
  // github.com/joniles/mpxj). OPS heeft één vlak tarief (§8.4), dus één rate-rij per
  // resource, effectief vanaf de projectstart.
  let rateObjId = 1;
  for (const res of resources) {
    if (res.costPerHour === undefined) continue;
    const rateResObjId = resObjMap.get(res.id)!;
    lines.push(`${indent(1)}<ResourceRate>`);
    lines.push(`${indent(2)}<ObjectId>${rateObjId++}</ObjectId>`);
    lines.push(`${indent(2)}<ResourceObjectId>${rateResObjId}</ResourceObjectId>`);
    lines.push(`${indent(2)}<EffectiveDate>${formatP6DateTime(project.startDate)}</EffectiveDate>`);
    lines.push(`${indent(2)}<PricePerUnit>${res.costPerHour}</PricePerUnit>`);
    lines.push(`${indent(1)}</ResourceRate>`);
  }

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
    // Fase 2.8b (§7.2): uur-taak ⇒ PlannedDuration in fractionele uren uit de minuten (geen
    // dag-afronding); dag-taak ⇒ het bestaande `dagen × hpd`-pad (byte-identiek).
    const effCal = effCalByTask.get(task.id);
    const isHour = isHourCalendar(effCal);
    const effHpd = effCal?.hoursPerDay ?? calendar.hoursPerDay;
    const plannedDur = isHour ? taskMinutesForWrite(task, effHpd) / 60 : durationToP6Hours(task.time.scheduleDuration, calendar.hoursPerDay);
    lines.push(`${indent(2)}<PlannedDuration>${plannedDur}</PlannedDuration>`);
    lines.push(`${indent(2)}<PlannedStartDate>${formatP6DateTime(task.time.earlyStart || task.time.scheduleStart)}</PlannedStartDate>`);
    lines.push(`${indent(2)}<PlannedFinishDate>${formatP6DateTime(task.time.earlyFinish || task.time.scheduleFinish)}</PlannedFinishDate>`);
    if (task.time.completion > 0) {
      lines.push(`${indent(2)}<PhysicalPercentComplete>${Math.round(task.time.completion * 100)}</PhysicalPercentComplete>`);
    }
    // Actuals (fase 2.6, §9.2) — alleen wanneer gezet (golden rule). RemainingDuration in uren.
    if (task.time.actualStart) {
      lines.push(`${indent(2)}<ActualStartDate>${formatP6DateTime(task.time.actualStart)}</ActualStartDate>`);
    }
    if (task.time.actualFinish) {
      lines.push(`${indent(2)}<ActualFinishDate>${formatP6DateTime(task.time.actualFinish)}</ActualFinishDate>`);
    }
    if (isHour && task.time.remainingMinutes != null) {
      lines.push(`${indent(2)}<RemainingDuration>${task.time.remainingMinutes / 60}</RemainingDuration>`);
    } else if (task.time.remainingTime != null) {
      lines.push(`${indent(2)}<RemainingDuration>${durationToP6Hours(task.time.remainingTime, calendar.hoursPerDay)}</RemainingDuration>`);
    }
    if (task.description) {
      lines.push(`${indent(2)}<Description>${escapeXML(task.description)}</Description>`);
    }
    // Datum-constraints (fase 2.9, §6): primair + secundair als P6 `CS_*`-codes. ASAP ⇒ leeg (geen
    // element, golden rule). Secundair is altijd soft (P6 native `SecondaryConstraintType`).
    if (task.constraint) {
      const code = p6ConstraintCode(task.constraint);
      if (code) {
        lines.push(`${indent(2)}<PrimaryConstraintType>${code}</PrimaryConstraintType>`);
        if (task.constraint.date) {
          lines.push(`${indent(2)}<PrimaryConstraintDate>${formatP6DateTime(task.constraint.date)}</PrimaryConstraintDate>`);
        }
      }
    }
    if (task.constraint2) {
      const code2 = p6ConstraintCode(task.constraint2);
      if (code2) {
        lines.push(`${indent(2)}<SecondaryConstraintType>${code2}</SecondaryConstraintType>`);
        if (task.constraint2.date) {
          lines.push(`${indent(2)}<SecondaryConstraintDate>${formatP6DateTime(task.constraint2.date)}</SecondaryConstraintDate>`);
        }
      }
    }
    // Taak-kalender (fase 2.8a, §8.3): effectieve kalender-ObjectId i.p.v. het oude hardcoded 1
    // (projectkalender). Onbekende/verwijderde calendarId valt terug op 1 (golden rule).
    const taskCalObjId = (task.calendarId && calObjMap.get(task.calendarId)) || 1;
    lines.push(`${indent(2)}<CalendarObjectId>${taskCalObjId}</CalendarObjectId>`);
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

    // Fase 2.8b (§7.2): uur-lag (`lagMinutes`, bron van waarheid) als fractionele uren, mits geen
    // procent-lag (die is al uitgebakken). Anders het bestaande `lagDays × hpd`-uren-pad.
    const hourLag = typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes)
      && !(typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent));
    const lagHours = hourLag ? seq.lagMinutes! / 60 : durationToP6Hours(lagDays, calendar.hoursPerDay);

    lines.push(`${indent(1)}<Relationship>`);
    lines.push(`${indent(2)}<ObjectId>${relObjId++}</ObjectId>`);
    lines.push(`${indent(2)}<PredecessorActivityObjectId>${predObjId}</PredecessorActivityObjectId>`);
    lines.push(`${indent(2)}<SuccessorActivityObjectId>${succObjId}</SuccessorActivityObjectId>`);
    lines.push(`${indent(2)}<Type>${sequenceTypeToP6(seq.type)}</Type>`);
    lines.push(`${indent(2)}<Lag>${lagHours}</Lag>`);
    lines.push(`${indent(2)}<ProjectObjectId>1</ProjectObjectId>`);
    lines.push(`${indent(1)}</Relationship>`);
  }

  // ResourceAssignments (fase 2.5, §8.1): alleen leaf-taken kunnen assignments dragen
  // (§2.4), dus taskObjMap/leafTasks dekt alle mogelijke ActivityObjectId's.
  let asgnObjId = 1;
  for (const a of assignments) {
    const actObjId = taskObjMap.get(a.taskId);
    const resObjId = resObjMap.get(a.resourceId);
    if (actObjId === undefined || resObjId === undefined) continue;

    lines.push(`${indent(1)}<ResourceAssignment>`);
    lines.push(`${indent(2)}<ObjectId>${asgnObjId++}</ObjectId>`);
    lines.push(`${indent(2)}<ActivityObjectId>${actObjId}</ActivityObjectId>`);
    lines.push(`${indent(2)}<ResourceObjectId>${resObjId}</ResourceObjectId>`);
    // PlannedUnitsPerTime: fractie, 1.0 = 100% (L2-fix — zelfde semantiek en MPXJ-bron als
    // MaxUnitsPerTime hierboven; PmxmlUnitsHelper schaalt MPXJ-percentages /100 naar het
    // bestand). Ons `unitsPerDay` is al een fractie, dus 1:1.
    lines.push(`${indent(2)}<PlannedUnitsPerTime>${a.unitsPerDay}</PlannedUnitsPerTime>`);
    const curveName = a.curve ? P6_CURVE_TO_NAME[a.curve] : undefined;
    if (curveName) {
      if (a.curve === 'LATE_PEAK') {
        console.warn("P6-export: LATE_PEAK-curve heeft geen P6-equivalent — geëxporteerd als 'Early Peak' (beste benadering).");
      }
      lines.push(`${indent(2)}<PlannedCurve>${escapeXML(curveName)}</PlannedCurve>`);
    }
    lines.push(`${indent(1)}</ResourceAssignment>`);
  }

  lines.push('</APIBusinessObjects>');

  return lines.join('\n');
}
