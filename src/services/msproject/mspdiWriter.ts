import { Task, TaskConstraint } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar } from '@/types/calendar';
import { Baseline, BaselineTask } from '@/types/baseline';
import {
  effectiveCalendarByTask, isHourCalendar, minutesToClock, minutesToIsoDuration, taskMinutesForWrite,
} from '@/services/subdayIo';

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
  // Fase 2.8b (§7.3): uur-instant `YYYY-MM-DDTHH:mm` (16 tekens) → vul aan tot seconden.
  if (iso.length === 16) return `${iso}:00`;
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

/**
 * Fase 2.9 (§6) — OPS-constraint → MSPDI `ConstraintType`-code (MS Learn: 0=ASAP, 1=ALAP,
 * 2=Must Start On, 3=Must Finish On, 4=SNET, 5=SNLT, 6=FNET, 7=FNLT). Retourneert `undefined`
 * voor ASAP (default ⇒ niets schrijven, byte-identiek).
 *
 * DE SOFT↔HARD-VAL (§6, mapping-tabel): MSPDI 2/3 zijn **hard** (Must). OPS' `MSO`/`MFO` zijn
 * **soft** (P6 Start On/Finish On) — die mogen dus NIET naar 2/3. Best-effort: soft `MSO` → `SNET`(4),
 * soft `MFO` → `FNET`(6) — de forward-ondergrens blijft behouden, de backward-bovengrens gaat verloren
 * (`softLoss`, gedocumenteerd + console-warn). OPS-HARD `MSO`/`MFO` → 2/3 (semantiek exact, geen verlies).
 */
function mspConstraintCode(c: TaskConstraint): { code: number; softLoss?: boolean } | undefined {
  switch (c.type) {
    case 'ASAP': return undefined;
    case 'ALAP': return { code: 1 };
    case 'SNET': return { code: 4 };
    case 'SNLT': return { code: 5 };
    case 'FNET': return { code: 6 };
    case 'FNLT': return { code: 7 };
    case 'MSO': return c.hard ? { code: 2 } : { code: 4, softLoss: true };
    case 'MFO': return c.hard ? { code: 3 } : { code: 6, softLoss: true };
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
  // Fase 2.8b (§7.3): uur-lag (`lagMinutes`, bron van waarheid) → tienden-van-minuten (`minuten × 10`,
  // minuut-precies); LagFormat 7 (werktijd-minuten), dezelfde encoding als het dag-pad.
  if (typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes)) {
    return { linkLag: Math.round(seq.lagMinutes * 10), lagFormat: 7 };
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

    // Fase 2.8b (§7.3): UUR-kalender ⇒ ALLE banden van deze weekdag als aparte <WorkingTime>-blokken;
    // een wrap-band emitteert het eind als tijd-van-de-dag (`end % 1440`).
    const hourBands = cal.workTime ? (cal.workTime.byWeekday[day as 1] ?? []) : null;
    const dayWorking = hourBands ? hourBands.length > 0 : isWorkDay;
    lines.push(`${indent(4)}<WeekDay>`);
    lines.push(`${indent(5)}<DayType>${mspDay}</DayType>`);
    lines.push(`${indent(5)}<DayWorking>${dayWorking ? 1 : 0}</DayWorking>`);
    if (hourBands) {
      if (hourBands.length > 0) {
        lines.push(`${indent(5)}<WorkingTimes>`);
        for (const b of hourBands) {
          lines.push(`${indent(6)}<WorkingTime>`);
          lines.push(`${indent(7)}<FromTime>${minutesToClock(b.start)}</FromTime>`);
          lines.push(`${indent(7)}<ToTime>${minutesToClock(b.end)}</ToTime>`);
          lines.push(`${indent(6)}</WorkingTime>`);
        }
        lines.push(`${indent(5)}</WorkingTimes>`);
      }
    } else if (isWorkDay) {
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

  // Fase 2.9 (§4.5/§6): externe (cross-project) dependencies zijn in MSPDI niet uitdrukbaar buiten de
  // master/subproject-context ⇒ weggelaten (ghost-weergave blijft in-app). Één warn.
  const extLinkCount = tasks.reduce((n, t) => n + (t.externalLinks?.length ?? 0), 0);
  if (extLinkCount > 0) {
    console.warn(`MSPDI-export: ${extLinkCount} externe (cross-project) dependency(s) weggelaten — niet uitdrukbaar in MSPDI (§6).`);
  }

  // Fase 2.9 (§6): soft↔hard-val — soft MSO/MFO degradeert naar SNET/FNET (MSPDI 2/3 is hard).
  const softLossCount = tasks.filter(t =>
    t.constraint && !t.constraint.hard && (t.constraint.type === 'MSO' || t.constraint.type === 'MFO')).length;
  if (softLossCount > 0) {
    console.warn(`MSPDI-export: ${softLossCount} soft Start On/Finish On-constraint(s) gedegradeerd naar SNET/FNET — MSPDI-code 2/3 is HARD (Must), backward-bovengrens gaat verloren (§6).`);
  }
  // Secundaire constraint: MSPDI kent één ConstraintType-element ⇒ niet uitdrukbaar (bron: MS Learn).
  const secondaryCount = tasks.filter(t => t.constraint2).length;
  if (secondaryCount > 0) {
    console.warn(`MSPDI-export: ${secondaryCount} secundaire constraint(s) weggelaten — MSPDI kent maar één ConstraintType-element (§6).`);
  }
  // Hammock/LOE: geen native MSPDI-representatie ⇒ als gewone taak met berekende datums + warn (§6).
  const hammockCount = tasks.filter(t => t.isHammock).length;
  if (hammockCount > 0) {
    console.warn(`MSPDI-export: ${hammockCount} hammock/LOE-taak/-taken geëxporteerd als gewone taak met berekende datums — MSPDI kent geen native LOE (§6).`);
  }

  // Fase 2.10 (item 1): MSPDI kent een native <Notes>-element, maar dat is BEWUST niet gebruikt
  // (lossy voor onze checklist-vorm met done-vlaggen + parse-complexiteit) — weggelaten-met-warn,
  // exact het externalLinks/hammock-patroon. Native mapping is een latere interop-optie (TODO §3.8).
  const noteCount = tasks.reduce((n, t) => n + (t.notes?.length ?? 0), 0);
  if (noteCount > 0) {
    console.warn(`MSPDI-export: ${noteCount} taak-aantekening(en) weggelaten — MSPDI's native <Notes>-element is bewust niet gebruikt (lossy voor de checklist-vorm, §6).`);
  }

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

  // Scheduling-options (fase 2.9, §6): alleen wat MSPDI native kan. `CriticalSlackLimit` (dagen) draagt
  // een triviale kritiek-drempel (`criticalDefinition.mode==='totalFloat'` met een niet-negatieve
  // integer-drempel); al het overige (longest-path, fractionele/uur-drempel, lag-kalender, float-paths,
  // near-critical, TF-modus) is niet native uitdrukbaar ⇒ weggelaten + warn. De VOLLE set round-trippt
  // wél via IFC OPS_SchedulingOptions. Golden rule: geen schedulingOptions ⇒ geen element.
  const so = project.schedulingOptions;
  if (so) {
    const cd = so.criticalDefinition;
    if (cd && cd.mode === 'totalFloat' && typeof cd.threshold === 'number'
      && Number.isInteger(cd.threshold) && cd.threshold >= 0) {
      lines.push(`${indent(1)}<CriticalSlackLimit>${cd.threshold}</CriticalSlackLimit>`);
    } else if (cd) {
      console.warn(`MSPDI-export: kritiek-definitie (${cd.mode}${cd.threshold != null ? `, drempel ${cd.threshold}` : ''}) niet uitdrukbaar als CriticalSlackLimit — weggelaten (§6).`);
    }
    const lost: string[] = [];
    if (so.lagCalendar && so.lagCalendar !== 'predecessor') lost.push('lagCalendar');
    if (so.totalFloatMode && so.totalFloatMode !== 'smallest') lost.push('totalFloatMode');
    if (so.makeOpenEndedCritical) lost.push('makeOpenEndedCritical');
    if (so.nearCriticalThreshold != null) lost.push('nearCriticalThreshold');
    if (so.floatPaths?.enabled) lost.push('floatPaths');
    if (lost.length > 0) {
      console.warn(`MSPDI-export: scheduling-opties ${lost.join('/')} niet native uitdrukbaar — weggelaten, alleen via IFC OPS_SchedulingOptions (§6).`);
    }
  }

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

  // Fase 2.8b (§7.3): effectieve kalender per taak → uur- vs dag-modus.
  const effCalByTask = effectiveCalendarByTask(tasks, calendar, libraryCalendars);

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

    // Fase 2.8b (§7.3): uur-taak ⇒ Duration als `PT{h}H{m}M0S` uit de minuten; dag-taak ⇒ het
    // bestaande `PT{dagen×hpd}H0M0S`-pad (byte-identiek).
    const effCal = effCalByTask.get(task.id);
    const isHour = isHourCalendar(effCal);
    const effHpd = effCal?.hoursPerDay ?? calendar.hoursPerDay;
    const durationTag = isHour
      ? minutesToIsoDuration(taskMinutesForWrite(task, effHpd))
      : durationToISO8601(task.time.scheduleDuration, calendar.hoursPerDay);

    lines.push(`${indent(2)}<Task>`);
    lines.push(`${indent(3)}<UID>${uid}</UID>`);
    lines.push(`${indent(3)}<ID>${uid}</ID>`);
    lines.push(`${indent(3)}<Name>${escapeXML(task.name)}</Name>`);
    lines.push(`${indent(3)}<Duration>${durationTag}</Duration>`);
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
    if (isHour && task.time.remainingMinutes != null) {
      lines.push(`${indent(3)}<RemainingDuration>${minutesToIsoDuration(task.time.remainingMinutes)}</RemainingDuration>`);
    } else if (task.time.remainingTime != null) {
      lines.push(`${indent(3)}<RemainingDuration>${durationToISO8601(task.time.remainingTime, calendar.hoursPerDay)}</RemainingDuration>`);
    }
    // ?? i.p.v. || : priority 0 is een geldige waarde (laagste, levelt als eerste weg).
    lines.push(`${indent(3)}<Priority>${Number.isFinite(task.priority) ? task.priority : 500}</Priority>`);
    // Datum-constraint (fase 2.9, §6): primair als MSPDI ConstraintType/ConstraintDate. ASAP ⇒ niets
    // (golden rule). Secundair is niet uitdrukbaar (één element, gewaarschuwd hierboven). Soft MSO/MFO
    // degradeert naar SNET/FNET (soft↔hard-val, gewaarschuwd hierboven).
    if (task.constraint) {
      const mapped = mspConstraintCode(task.constraint);
      if (mapped) {
        lines.push(`${indent(3)}<ConstraintType>${mapped.code}</ConstraintType>`);
        // ConstraintDate vereist behalve bij 0/1 (ASAP/ALAP); ALAP (1) draagt geen datum.
        if (mapped.code !== 1 && task.constraint.date) {
          lines.push(`${indent(3)}<ConstraintDate>${formatMSPDateTime(task.constraint.date)}</ConstraintDate>`);
        }
      }
    }
    // Zachte deadline (fase 2.9, §6): MSPDI kent een native <Deadline> op de taak (verschuift balken
    // niet — begrenst total slack). Golden rule: geen deadline ⇒ geen element.
    if (task.deadline) {
      lines.push(`${indent(3)}<Deadline>${formatMSPDateTime(task.deadline)}</Deadline>`);
    }
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
