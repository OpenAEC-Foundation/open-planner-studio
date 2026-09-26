import { Task, TaskConstraint } from '@/types/task';
import { isP6DialogDefaultLeveling } from '@/services/leveling/levelingInput';
import { resolveConventions } from '@/engine/scheduler/conventions/registry';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import { Project } from '@/types/project';
import { holidayEndDate, WorkCalendar } from '@/types/calendar';
import { Baseline, BaselineTask } from '@/types/baseline';
import type { CustomTaskType } from '@/types/taskType';
import { projectFileBase } from '@/utils/documents';
import {
  exportCalendarLayout, minutesToClock, minutesToIsoDuration, taskMinutesForWrite,
} from '@/services/subdayIo';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { encodeCustomTaskType, escapeXml, OPS_DURATION_UNIT_NAME, toXmlDateTime } from '@/services/xmlInterchange';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { effectiveWorkTimeBands, calendarForEngine } from '@/utils/effectiveWorkTime';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { matchContoursToAssignments, MSPDI_WORKCONTOUR_CONTOURED } from '@/engine/contour/contourEngine';
import { contourPeriodsToDayItems, countSplitTasksWithoutContour, minutesToMspdiValue } from '@/services/contourIo';
import { parseInstant, formatInstant } from '@/utils/dateUtils';
import { flattenOrder, taskDepths } from '@/utils/wbs';
import { invertRecord } from '@/utils/collections';
import { shownStart, shownFinish } from '@/utils/taskDates';
import { MSPDI_TASK_TYPE_CODE, mspFromWorkRule } from '@/engine/work/workRuleMapping';

/**
 * MSPDI kent geen native onderscheid tussen "N werkdagen" en "N werkuren" als blijvende
 * rekenidentiteit: DurationFormat is alleen de MS Project-weergave-eenheid. Daarom gebruikt OPS
 * één namespaced custom task field als expliciete round-tripmarker. Text30 is bewust gekozen als
 * transportveld; de reader accepteert de waarde uitsluitend wanneer de projectdefinitie exact deze
 * OPS-naam draagt, zodat een vreemd bestand dat Text30 zelf gebruikt nooit per ongeluk matcht.
 *
 * Text30 = 0x0B400000 + 336 = 188744016 (MPXJ `MPPTaskField`: FIELD_ARRAY[336] = TEXT30; MSPDI-
 * FieldID = TASK_FIELD_BASE | index, `FieldTypeHelper.getFieldID`). Eerdere OPS-versies schreven
 * 188743760 = index 80 = Flag9 — een ja/nee-veld met tekst "days"/"hours" erin. Nieuw schrijven gaat
 * naar Text30; de lezer accepteert het oude ID nog (`OPS_DURATION_UNIT_LEGACY_FIELD_ID`) zodat
 * eerder geëxporteerde bestanden hun duureenheid houden.
 */
export const OPS_DURATION_UNIT_FIELD_ID = '188744016';
export const OPS_DURATION_UNIT_LEGACY_FIELD_ID = '188743760';
export const OPS_DURATION_UNIT_FIELD_NAME = 'OPS_TaskDurationUnit';

/**
 * Soort mijlpaal (START/FINISH/AUTO) — MSPDI kent alleen `<Milestone>`, geen start/eind-anker. Zelfde
 * patroon als de duureenheid hierboven: één namespaced custom task field, alleen geldig wanneer de
 * projectdefinitie exact deze OPS-naam draagt (zonder marker kwam een eindmijlpaal na OPS → MSPDI →
 * OPS in dagmodus als "automatisch" terug en schoof hij een werkdag op). Transportveld Text29
 * (0x0B400000 + 335, MPXJ `MPPTaskField`). `AUTO` wordt expliciet geschreven zodat de lezer bij een
 * OPS-bestand geen soort afleidt die de bron niet had; een bestand zonder deze definitie (MS Project
 * zelf) volgt de gewone afleiding.
 */
export const OPS_MILESTONE_KIND_FIELD_ID = '188744015';
export const OPS_MILESTONE_KIND_FIELD_NAME = 'OPS_MilestoneKind';

/** MSPDI-transportveld (vrije ExtendedAttribute) voor de OPS-taaktypemarker; geëxporteerd voor de reader. */
export const OPS_CUSTOM_TASK_TYPE_FIELD_ID = '188743731';

// WorkContour-enum (MSPDI-schemadocumentatie/MPXJ): 0=Flat, 1=BackLoaded, 2=FrontLoaded,
// 3=DoublePeak, 4=EarlyPeak, 5=LatePeak, 6=Bell, 7=Turtle; 8 (Contoured) is geen vorm maar het signaal
// dat er `<TimephasedData>` meegaat. Alle acht vormen zijn een OPS-curve. Geëxporteerd zodat de reader
// de inverse gebruikt (MPXJ `WorkContour.getUniqueID() − 1`).
export const CURVE_TO_WORKCONTOUR: Record<ResourceCurve, number> = {
  UNIFORM: 0,
  BACK_LOADED: 1,
  FRONT_LOADED: 2,
  DOUBLE_PEAK: 3,
  EARLY_PEAK: 4,
  LATE_PEAK: 5,
  BELL: 6,
  TURTLE: 7,
};

// Inverse voor de reader (WorkContour-code → curve). Programmatisch afgeleid ⇒ kan niet
// divergeren van de schrijfrichting. De mapping is volledig bijectief (geen asymmetrie).
export const WORKCONTOUR_TO_CURVE: Record<number, ResourceCurve> = invertRecord(CURVE_TO_WORKCONTOUR);

/** MSPDI `<Type>` van een PredecessorLink (0=FF, 1=FS, 2=SF, 3=SS); de reader leest de inverse. */
export const MSP_LINK_TYPE_CODE: Record<SequenceType, number> = {
  FINISH_FINISH: 0,
  FINISH_START: 1,
  START_FINISH: 2,
  START_START: 3,
};

/** Dagen → MSPDI-duur (`PT40H0M0S` voor 5 dagen × 8 u). Via minuten, zodat een kalender met een
 *  halve-uursdag (3 × 7,5 u) `PT22H30M0S` schrijft en niet `PT22.5H0M0S`. */
function durationToISO8601(days: number, hoursPerDay: number): string {
  return minutesToIsoDuration(days * hoursPerDay * 60);
}

/**
 * OPS-constraint → MSPDI `ConstraintType`-code (MS Learn: 0=ASAP, 1=ALAP, 2=Must Start On, 3=Must
 * Finish On, 4=SNET, 5=SNLT, 6=FNET, 7=FNLT). Retourneert `undefined` voor ASAP (default ⇒ niets
 * schrijven).
 *
 * DE SOFT↔HARD-VAL: MSPDI 2/3 zijn **hard** (Must). OPS' `MSO`/`MFO` zijn **soft** (P6 Start On/
 * Finish On) — die mogen dus NIET naar 2/3. Best-effort: soft `MSO` → `SNET`(4), soft `MFO` →
 * `FNET`(6) — de forward-ondergrens blijft, de backward-bovengrens gaat verloren (`softLoss`,
 * console-warn). OPS-HARD `MSO`/`MFO` → 2/3 (semantiek exact).
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

// MSPDI LagFormat (subset van DurationFormat): 6 = elapsed uren, 7 = dagen, 8 = elapsed dagen
// (24/7), 19 = procent, 20 = elapsed procent. Bij procent staat LinkLag in tienden van een procent,
// anders altijd in tienden van (werk- of klok)minuten — LagFormat is alleen de weergave-eenheid.
function lagFields(seq: Sequence, hoursPerDay: number): { linkLag: number; lagFormat: number } {
  const elapsed = seq.lagUnit === 'ELAPSEDTIME';
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    return { linkLag: Math.round(seq.lagPercent * 10), lagFormat: elapsed ? 20 : 19 };
  }
  // Uur-lag (`lagMinutes`, bron van waarheid) → tienden van minuten (minuut-precies). Werktijd:
  // LagFormat 7, dezelfde encoding als het dag-pad. Elapsed ("+3eu"): LagFormat 6 (elapsed uren)
  // met klokminuten. Deze tak staat bewust VÓÓR de elapsed-dag-tak: daar werd een elapsed-uur-lag
  // `lagDays × 24 × 60 × 10` = 0.
  if (typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes)) {
    return { linkLag: Math.round(seq.lagMinutes * 10), lagFormat: elapsed ? 6 : 7 };
  }
  if (elapsed) {
    // Elapsed dagen tellen 24 uur, onafhankelijk van de werkkalender.
    return { linkLag: seq.lagDays * 24 * 60 * 10, lagFormat: 8 };
  }
  return { linkLag: lagToTenthsOfMinutes(seq.lagDays, hoursPerDay), lagFormat: 7 };
}

/** Schrijft één `<Calendar>`-blok (WeekDays + Exceptions) — hergebruikt voor de
 *  projectkalender (UID 1, `IsBaseCalendar`) én voor resourcekalenders. */
function writeCalendarBlock(
  lines: string[],
  indent: (level: number) => string,
  cal: WorkCalendar,
  uid: number,
  isBaseCalendar: boolean,
  includeEffectiveScalarBands = false,
): void {
  lines.push(`${indent(2)}<Calendar>`);
  lines.push(`${indent(3)}<UID>${uid}</UID>`);
  lines.push(`${indent(3)}<Name>${escapeXml(cal.name)}</Name>`);
  lines.push(`${indent(3)}<IsBaseCalendar>${isBaseCalendar ? 1 : 0}</IsBaseCalendar>`);
  lines.push(`${indent(3)}<WeekDays>`);

  for (let day = 1; day <= 7; day++) {
    const isWorkDay = cal.workDays.includes(day);
    const mspDay = day === 7 ? 1 : day + 1;

    // UUR-kalender ⇒ ALLE banden van deze weekdag als aparte <WorkingTime>-blokken; een wrap-band
    // emitteert het eind als tijd-van-de-dag (`end % 1440`).
    const workTime = cal.workTime ?? (includeEffectiveScalarBands ? effectiveWorkTimeBands(cal) : undefined);
    const hourBands = workTime ? (workTime.byWeekday[day as 1] ?? []) : null;
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
      // Via `minutesToClock`: een 24/7-dagkalender (`workEndHour` 24) wordt `00:00:00` — een geldige
      // kloktijd (middernacht), zoals MS Project's eigen "24 Hours"-kalender — en niet `24:00:00`.
      lines.push(`${indent(7)}<ToTime>${minutesToClock(cal.workEndHour * 60)}</ToTime>`);
      lines.push(`${indent(6)}</WorkingTime>`);
      lines.push(`${indent(5)}</WorkingTimes>`);
    }
    lines.push(`${indent(4)}</WeekDay>`);
  }

  lines.push(`${indent(3)}</WeekDays>`);

  // Werkende uitzonderingen spiegelen `readRawMspdiExceptions` in mspdiReader.ts: `DayWorking=1`,
  // banden als `<WorkingTime>`-blokken wanneer aanwezig (afwezig/leeg ⇒ geen `<WorkingTimes>`; de
  // fallbackketen van `WorkingException.bands` in `types/calendar.ts` vangt dat bij het lezen op).
  const workingExceptions = cal.workingExceptions ?? [];
  if (cal.holidays.length > 0 || workingExceptions.length > 0) {
    lines.push(`${indent(3)}<Exceptions>`);
    for (const h of cal.holidays) {
      lines.push(`${indent(4)}<Exception>`);
      lines.push(`${indent(5)}<EnteredByOccurrences>0</EnteredByOccurrences>`);
      lines.push(`${indent(5)}<TimePeriod>`);
      lines.push(`${indent(6)}<FromDate>${toXmlDateTime(h.startDate)}</FromDate>`);
      lines.push(`${indent(6)}<ToDate>${toXmlDateTime(holidayEndDate(h))}</ToDate>`);
      lines.push(`${indent(5)}</TimePeriod>`);
      lines.push(`${indent(5)}<Name>${escapeXml(h.name)}</Name>`);
      lines.push(`${indent(5)}<Type>1</Type>`);
      lines.push(`${indent(5)}<DayWorking>0</DayWorking>`);
      lines.push(`${indent(4)}</Exception>`);
    }
    for (const we of workingExceptions) {
      lines.push(`${indent(4)}<Exception>`);
      lines.push(`${indent(5)}<EnteredByOccurrences>0</EnteredByOccurrences>`);
      lines.push(`${indent(5)}<TimePeriod>`);
      lines.push(`${indent(6)}<FromDate>${toXmlDateTime(we.startDate)}</FromDate>`);
      lines.push(`${indent(6)}<ToDate>${toXmlDateTime(we.endDate)}</ToDate>`);
      lines.push(`${indent(5)}</TimePeriod>`);
      lines.push(`${indent(5)}<Name>${escapeXml(we.name)}</Name>`);
      lines.push(`${indent(5)}<Type>1</Type>`);
      lines.push(`${indent(5)}<DayWorking>1</DayWorking>`);
      if (we.bands && we.bands.length > 0) {
        lines.push(`${indent(5)}<WorkingTimes>`);
        for (const b of we.bands) {
          lines.push(`${indent(6)}<WorkingTime>`);
          lines.push(`${indent(7)}<FromTime>${minutesToClock(b.start)}</FromTime>`);
          lines.push(`${indent(7)}<ToTime>${minutesToClock(b.end)}</ToTime>`);
          lines.push(`${indent(6)}</WorkingTime>`);
        }
        lines.push(`${indent(5)}</WorkingTimes>`);
      }
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
  customTaskTypes: readonly CustomTaskType[] = [],
): string {
  const lines: string[] = [];
  const indent = (level: number) => '  '.repeat(level);

  // MS Project reconstrueert de hiërarchie uit `<OutlineLevel>` + DOCUMENTVOLGORDE — het `<WBS>`-veld
  // is daarbij alleen tekst. Beide komen dus uit de echte boom: diepte-eerst geordend (ouders vóór
  // hun kinderen, zoals het taakraster flattent) en het niveau uit de ouderketen. Niet uit
  // `wbsCode`: een IFC-import draagt de vrije `IfcTask.Identification` als code en kan "samenvattingen
  // eerst, dan bladen" geordend zijn. De UID-toekenning hieronder volgt deze volgorde.
  tasks = [...flattenOrder(tasks)];
  const depthById = taskDepths(tasks);

  // Externe (cross-project) dependencies zijn in MSPDI niet uitdrukbaar buiten de
  // master/subproject-context ⇒ weggelaten (ghost-weergave blijft in-app). Één warn.
  const extLinkCount = tasks.reduce((n, t) => n + (t.externalLinks?.length ?? 0), 0);
  if (extLinkCount > 0) {
    console.warn(`MSPDI-export: ${extLinkCount} externe (cross-project) dependency(s) weggelaten — niet uitdrukbaar in MSPDI (§6).`);
  }

  // Soft↔hard-val — soft MSO/MFO degradeert naar SNET/FNET (MSPDI 2/3 is hard).
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
  // Hammock/LOE: geen native MSPDI-representatie ⇒ als gewone taak met berekende datums + warn.
  const hammockCount = tasks.filter(t => t.isHammock).length;
  if (hammockCount > 0) {
    console.warn(`MSPDI-export: ${hammockCount} hammock/LOE-taak/-taken geëxporteerd als gewone taak met berekende datums — MSPDI kent geen native LOE (§6).`);
  }

  // MSPDI kent een native <Notes>-element, maar dat is BEWUST niet gebruikt (lossy voor onze
  // checklist-vorm met done-vlaggen) — weggelaten-met-warn, zoals externalLinks/hammock.
  const noteCount = tasks.reduce((n, t) => n + (t.notes?.length ?? 0), 0);
  if (noteCount > 0) {
    console.warn(`MSPDI-export: ${noteCount} taak-aantekening(en) weggelaten — MSPDI's native <Notes>-element is bewust niet gebruikt (lossy voor de checklist-vorm, §6).`);
  }

  // MSPDI kent native <Manual> en <LevelingDelay>/<LevelingDelayFormat>, maar onze LEZER leest ze
  // niet. Native schrijven zonder terug te lezen is een stille semantiek-omklap bij een round-trip
  // (zie het ELAPSEDTIME/<DurationFormat>-geval hierboven) — daarom alleen warnen.
  const manualCount = tasks.filter(t => t.manuallyScheduled).length;
  if (manualCount > 0) {
    console.warn(`MSPDI-export: ${manualCount} handmatig geplande taak/taken geëxporteerd zonder native <Manual> — MSPDI-lezer kent dat element nog niet (§6).`);
  }
  const levelingPrecisionCount = tasks.filter(t => t.levelingDelayMinutes != null).length;
  if (levelingPrecisionCount > 0) {
    console.warn(`MSPDI-export: ${levelingPrecisionCount} taak/taken met sub-dag-nivelleervertraging (levelingDelayMinutes) geëxporteerd zonder native <LevelingDelay>/<LevelingDelayFormat> — MSPDI-lezer kent die elementen nog niet (§6).`);
  }
  // Gecontoureerde toewijzingen (`Task.timephasedContours`) gaan NATIEF mee als `<TimephasedData>`
  // (zie de toewijzingensectie) en de lezer leest ze terug. Een gesplitste taak ZONDER contour (bv.
  // een nivelleergat, `splitGaps` met `source: 'leveling'`) heeft geen per-toewijzingverdeling om te
  // schrijven; die blijft een warn (MSP kent een split alleen als timephased-vorm van een toewijzing).
  const splitWithoutContour = countSplitTasksWithoutContour(tasks);
  if (splitWithoutContour > 0) {
    console.warn(`MSPDI-export: ${splitWithoutContour} onderbroken taak/taken zonder urenverdeling geëxporteerd ZONDER hun onderbrekingen (gebruikers-, nivelleer- of importsplits) — alleen een contour wordt als <TimephasedData> geschreven (§6; de gebruiker krijgt een melding via exportAs).`);
  }
  // MSP's eigen resume/stop-instanten (uit-volgorde-hervatting). MSPDI kent native <Resume>/<Stop>,
  // maar onze lezer leest ze niet terug — zelfde conservatieve keuze.
  const resumeStopCount = tasks.filter(t => t.time.resume || t.time.stop).length;
  if (resumeStopCount > 0) {
    console.warn(`MSPDI-export: ${resumeStopCount} taak/taken met resume/stop (uit-volgorde-hervatting) geëxporteerd zonder native <Resume>/<Stop> — MSPDI-lezer kent die elementen nog niet (§6).`);
  }

  // Alleen de ACTIEVE baseline gaat naar MSPDI-slot 0 (Baseline Number 0); de overige
  // OPS-baselines gaan bewust verloren.
  const activeBaseline = baselines.find(b => b.id === activeBaselineId) ?? null;
  const baselineByTask = new Map<string, BaselineTask>(
    (activeBaseline?.tasks ?? []).map(bt => [bt.taskId, bt]),
  );

  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  lines.push('<Project xmlns="http://schemas.microsoft.com/project">');

  // Project properties.
  // Een naamloos project krijgt dezelfde neutrale, TAALONAFHANKELIJKE terugval als de bestandsnaam en
  // de STEP-header (`projectFileBase`): een leeg <Name>/<Title> geeft in MS Project een naamloos
  // project, en weglaten lost dat niet op. Bewust geen vertaalde terugval: uitwisselingsdata gaat naar
  // een ander systeem en een andere gebruiker.
  const exportName = projectFileBase(project.name);
  lines.push(`${indent(1)}<Name>${escapeXml(exportName)}</Name>`);
  lines.push(`${indent(1)}<Title>${escapeXml(exportName)}</Title>`);
  lines.push(`${indent(1)}<Author>${escapeXml(project.author)}</Author>`);
  lines.push(`${indent(1)}<Company>${escapeXml(project.company)}</Company>`);
  lines.push(`${indent(1)}<CreationDate>${toXmlDateTime(project.createdAt.substring(0, 10))}</CreationDate>`);
  lines.push(`${indent(1)}<StartDate>${toXmlDateTime(project.startDate)}</StartDate>`);
  if (project.endDate) {
    lines.push(`${indent(1)}<FinishDate>${toXmlDateTime(project.endDate)}</FinishDate>`);
  }
  // Statusdatum — P6 data date → MSPDI <StatusDate>. Alleen wanneer gezet.
  if (project.statusDate) {
    lines.push(`${indent(1)}<StatusDate>${toXmlDateTime(project.statusDate)}</StatusDate>`);
  }
  lines.push(`${indent(1)}<ScheduleFromStart>1</ScheduleFromStart>`);
  lines.push(`${indent(1)}<MinutesPerDay>${calendar.hoursPerDay * 60}</MinutesPerDay>`);
  lines.push(`${indent(1)}<MinutesPerWeek>${calendar.hoursPerDay * calendar.workDays.length * 60}</MinutesPerWeek>`);
  lines.push(`${indent(1)}<DaysPerMonth>20</DaysPerMonth>`);

  // Expliciete OPS-taakeenheid voor een verliesvrije eigen MSPDI-round-trip. Bestanden zonder deze
  // definitie volgen aan de leeskant de kalenderregel.
  lines.push(`${indent(1)}<ExtendedAttributes>`);
  lines.push(`${indent(2)}<ExtendedAttribute>`);
  lines.push(`${indent(3)}<FieldID>${OPS_DURATION_UNIT_FIELD_ID}</FieldID>`);
  lines.push(`${indent(3)}<FieldName>${OPS_DURATION_UNIT_NAME}</FieldName>`);
  lines.push(`${indent(3)}<Alias>${OPS_DURATION_UNIT_NAME}</Alias>`);
  lines.push(`${indent(2)}</ExtendedAttribute>`);
  lines.push(`${indent(2)}<ExtendedAttribute>`);
  lines.push(`${indent(3)}<FieldID>${OPS_MILESTONE_KIND_FIELD_ID}</FieldID>`);
  lines.push(`${indent(3)}<FieldName>${OPS_MILESTONE_KIND_FIELD_NAME}</FieldName>`);
  lines.push(`${indent(3)}<Alias>${OPS_MILESTONE_KIND_FIELD_NAME}</Alias>`);
  lines.push(`${indent(2)}</ExtendedAttribute>`);
  lines.push(`${indent(1)}</ExtendedAttributes>`);

  // Scheduling-options: alleen wat MSPDI native kan. `CriticalSlackLimit` (dagen) draagt een triviale
  // kritiek-drempel (`criticalDefinition.mode==='totalFloat'` met een niet-negatieve integer-drempel);
  // al het overige (longest-path, fractionele/uur-drempel, lag-kalender, float-paths, near-critical,
  // TF-modus) is niet native uitdrukbaar ⇒ weggelaten + warn. De volle set round-tript via IFC
  // OPS_SchedulingOptions. Golden rule: geen schedulingOptions ⇒ geen element.
  const so = project.schedulingOptions;
  const lost: string[] = [];
  if (so) {
    const cd = so.criticalDefinition;
    if (cd && cd.mode === 'totalFloat' && typeof cd.threshold === 'number'
      && Number.isInteger(cd.threshold) && cd.threshold >= 0) {
      lines.push(`${indent(1)}<CriticalSlackLimit>${cd.threshold}</CriticalSlackLimit>`);
    } else if (cd) {
      console.warn(`MSPDI-export: kritiek-definitie (${cd.mode}${cd.threshold != null ? `, drempel ${cd.threshold}` : ''}) niet uitdrukbaar als CriticalSlackLimit — weggelaten (§6).`);
    }
    if (so.lagCalendar && so.lagCalendar !== 'predecessor') lost.push('lagCalendar');
    if (so.totalFloatMode && so.totalFloatMode !== 'smallest') lost.push('totalFloatMode');
    if (so.makeOpenEndedCritical) lost.push('makeOpenEndedCritical');
    if (so.nearCriticalThreshold != null) lost.push('nearCriticalThreshold');
    if (so.floatPaths?.enabled) lost.push('floatPaths');
    if (so.startToStartLagFrom === 'actualStart') lost.push('startToStartLagFrom');
    // Nivelleerinstellingen (fundament, alleen data): MSPDI heeft geen P6-prioriteitslijst of
    // -resourcelijst; het blok round-tript alleen via IFC. Alleen melden als het afwijkt van de
    // P6-dialoogdefaults: acht van de twaalf openbare OZB-projecten dragen precies die defaults, en een
    // melding over iets wat een ontvanger toch al aanneemt is ruis die de echte meldingen verdringt.
    if (so.leveling && !isP6DialogDefaultLeveling(so.leveling)) lost.push('leveling');
  }
  // De twee MPP-eigen conventies staan in het rekenprofiel (MS Project-profiel), niet in
  // `schedulingOptions`. MSPDI heeft er geen equivalent voor; zonder warn zou .mpp → MSPDI-export →
  // herimport ze stil laten vallen en datums laten verschuiven (hervatting van restwerk, resp. het
  // naar de statusdatum klemmen van niet-gestarte taken).
  const conventions = resolveConventions(project.schedulingProfile);
  if (conventions.resumeFromActualElapsed) lost.push('resumeFromActualElapsed');
  if (conventions.unstartedIgnoresStatusDate) lost.push('unstartedIgnoresStatusDate');
  if (lost.length > 0) {
    console.warn(`MSPDI-export: scheduling-opties ${lost.join('/')} niet native uitdrukbaar — weggelaten, alleen via IFC OPS_SchedulingOptions (§6).`);
  }

  // Calendars: UID 1 = projectkalender (basiskalender); overige bibliotheekkalenders krijgen UID 2,
  // 3, ... — dezelfde `writeCalendarBlock` parametrisch hergebruikt.
  const {
    libraryCalendars, calendarNumber: calUidMap, effCalByTask, hourTaskCalendarIds,
  } = exportCalendarLayout(tasks, calendar, resourceCalendars);

  lines.push(`${indent(1)}<Calendars>`);
  writeCalendarBlock(lines, indent, calendar, 1, true, hourTaskCalendarIds.has(calendar.id));
  for (const cal of libraryCalendars) {
    writeCalendarBlock(lines, indent, cal, calUidMap.get(cal.id)!, false, hourTaskCalendarIds.has(cal.id));
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
  lines.push(`${indent(3)}<Name>${escapeXml(exportName)}</Name>`);
  lines.push(`${indent(3)}<OutlineLevel>0</OutlineLevel>`);
  lines.push(`${indent(3)}<Summary>1</Summary>`);
  lines.push(`${indent(2)}</Task>`);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const uid = i + 1;
    const isSummary = isSummaryTask(task);
    // Een samenvattingstaak is nooit een mijlpaal, ook niet met duur 0 (bv. een IFC met `$`-duur op
    // de samenvatting). MS Project rekent haar duur uit de kinderen; `Milestone=1` maakte er anders
    // een ruit van zonder duur.
    const isMilestone = !isSummary && (task.isMilestone || task.time.scheduleDuration === 0);

    // Uur-taak ⇒ Duration als `PT{h}H{m}M0S` uit de minuten; dag-taak ⇒ `PT{dagen×hpd}H0M0S`. De hpd
    // is die van de EFFECTIEVE (taak-)kalender, niet de projectkalender: een OPS-dagduur is N werkdagen
    // van de kalender waarin de taak rekent, en `readMSPDI` deelt bij het teruglezen ook door `effHpd`
    // (met de projectkalender kwam een 7-daagse 24/7-taak als 2,33 dagen terug).
    const effCal = effCalByTask.get(task.id);
    const effHpd = effCal?.hoursPerDay ?? calendar.hoursPerDay;
    const isHourTask = taskDurationUnit(task) === 'hours';
    const durationTag = isHourTask
      ? minutesToIsoDuration(taskMinutesForWrite(task, effHpd))
      : durationToISO8601(task.time.scheduleDuration, effHpd);
    const durationFormat = isHourTask
      ? (task.time.durationType === 'ELAPSEDTIME' ? 6 : 5)
      : (task.time.durationType === 'ELAPSEDTIME' ? 8 : 7);

    lines.push(`${indent(2)}<Task>`);
    lines.push(`${indent(3)}<UID>${uid}</UID>`);
    lines.push(`${indent(3)}<ID>${uid}</ID>`);
    lines.push(`${indent(3)}<Name>${escapeXml(task.name)}</Name>`);
    // <Type> (0/1/2) en <EffortDriven> uit de werkregel; een bewaard MSP-`effortDriven` wint
    // (`mspFromWorkRule`). Zonder werkregel valt een taak met alleen bewaarde MSP-velden op die velden
    // terug; zonder beide schrijft de export niets — MS Project neemt dan zijn default (Fixed Units).
    const mspType = task.workRule
      ? mspFromWorkRule(task.workRule, task.mspTaskType ? (task.effortDriven ?? false) : undefined)
      : task.mspTaskType ? { type: task.mspTaskType, effortDriven: task.effortDriven ?? false } : undefined;
    if (mspType && !isSummary) {
      lines.push(`${indent(3)}<Type>${MSPDI_TASK_TYPE_CODE[mspType.type]}</Type>`);
    }
    lines.push(`${indent(3)}<Duration>${durationTag}</Duration>`);
    lines.push(`${indent(3)}<DurationFormat>${durationFormat}</DurationFormat>`);
    if (mspType && !isSummary) {
      lines.push(`${indent(3)}<EffortDriven>${mspType.effortDriven ? 1 : 0}</EffortDriven>`);
    }
    lines.push(`${indent(3)}<Start>${toXmlDateTime(shownStart(task))}</Start>`);
    lines.push(`${indent(3)}<Finish>${toXmlDateTime(shownFinish(task))}</Finish>`);
    lines.push(`${indent(3)}<WBS>${escapeXml(task.wbsCode)}</WBS>`);
    lines.push(`${indent(3)}<OutlineLevel>${depthById.get(task.id) ?? 1}</OutlineLevel>`);
    lines.push(`${indent(3)}<Summary>${isSummary ? 1 : 0}</Summary>`);
    lines.push(`${indent(3)}<Milestone>${isMilestone ? 1 : 0}</Milestone>`);
    // `completion ?? 0`: een taak die buiten de typechecker om (extensie-/MCP-rand) zonder completion
    // binnenkomt gaf anders `NaN`; zelfde verdediging als de IFC-writer (`ifcTaskSlots.ts`).
    lines.push(`${indent(3)}<PercentComplete>${Math.round((task.time.completion ?? 0) * 100)}</PercentComplete>`);
    // Actuals — alleen wanneer gezet (golden rule). RemainingDuration afgeleid.
    if (task.time.actualStart) {
      lines.push(`${indent(3)}<ActualStart>${toXmlDateTime(task.time.actualStart)}</ActualStart>`);
    }
    if (task.time.actualFinish) {
      lines.push(`${indent(3)}<ActualFinish>${toXmlDateTime(task.time.actualFinish)}</ActualFinish>`);
    }
    if (isHourTask && task.time.remainingMinutes != null) {
      lines.push(`${indent(3)}<RemainingDuration>${minutesToIsoDuration(task.time.remainingMinutes)}</RemainingDuration>`);
    } else if (task.time.remainingTime != null) {
      lines.push(`${indent(3)}<RemainingDuration>${durationToISO8601(task.time.remainingTime, effHpd)}</RemainingDuration>`);
    }
    // ?? i.p.v. || : priority 0 is een geldige waarde (laagste, levelt als eerste weg).
    lines.push(`${indent(3)}<Priority>${Number.isFinite(task.priority) ? task.priority : 500}</Priority>`);
    if (task.customTaskTypeId) {
      // MSPDI vrije tekst-uitbreiding: vreemde clients negeren dit; OPS leest hem terug zonder
      // de native MSP Task Type (resource-inspanning) te misbruiken.
      const value = encodeCustomTaskType(task.customTaskTypeId, customTaskTypes);
      lines.push(`${indent(3)}<ExtendedAttribute><FieldID>${OPS_CUSTOM_TASK_TYPE_FIELD_ID}</FieldID><Value>${escapeXml(value)}</Value></ExtendedAttribute>`);
    }
    // Datumconstraint: primair als MSPDI ConstraintType/ConstraintDate. ASAP ⇒ niets. Secundair is
    // niet uitdrukbaar (één element, gewaarschuwd hierboven). Soft MSO/MFO degradeert naar SNET/FNET.
    if (task.constraint) {
      const mapped = mspConstraintCode(task.constraint);
      if (mapped) {
        lines.push(`${indent(3)}<ConstraintType>${mapped.code}</ConstraintType>`);
        // ConstraintDate vereist behalve bij 0/1 (ASAP/ALAP); ALAP (1) draagt geen datum.
        if (mapped.code !== 1 && task.constraint.date) {
          lines.push(`${indent(3)}<ConstraintDate>${toXmlDateTime(task.constraint.date)}</ConstraintDate>`);
        }
      }
    }
    // Zachte deadline: MSPDI kent een native <Deadline> op de taak (verschuift balken niet — begrenst
    // total slack). Golden rule: geen deadline ⇒ geen element.
    if (task.deadline) {
      lines.push(`${indent(3)}<Deadline>${toXmlDateTime(task.deadline)}</Deadline>`);
    }
    // Taakkalender: MSPDI ondersteunt taakkalenders native via dit element. Onbekende/verwijderde
    // calendarId valt terug op 1 (projectkalender), zelfde patroon als de resource-CalendarUID.
    const taskCalUid = (task.calendarId && calUidMap.get(task.calendarId)) || 1;
    lines.push(`${indent(3)}<CalendarUID>${taskCalUid}</CalendarUID>`);
    lines.push(`${indent(3)}<ExtendedAttribute>`);
    lines.push(`${indent(4)}<FieldID>${OPS_DURATION_UNIT_FIELD_ID}</FieldID>`);
    lines.push(`${indent(4)}<Value>${isHourTask ? 'hours' : 'days'}</Value>`);
    lines.push(`${indent(3)}</ExtendedAttribute>`);
    if (isMilestone) {
      // Zelfde regel als de IFC-pset `OPS_Milestone`: alleen een echte mijlpaal draagt een soort.
      const kind = task.isMilestone && (task.milestoneKind === 'START' || task.milestoneKind === 'FINISH')
        ? task.milestoneKind : 'AUTO';
      lines.push(`${indent(3)}<ExtendedAttribute>`);
      lines.push(`${indent(4)}<FieldID>${OPS_MILESTONE_KIND_FIELD_ID}</FieldID>`);
      lines.push(`${indent(4)}<Value>${kind}</Value>`);
      lines.push(`${indent(3)}</ExtendedAttribute>`);
    }
    if (task.description) {
      lines.push(`${indent(3)}<Notes>${escapeXml(task.description)}</Notes>`);
    }
    // Baseline 0 — Start/Finish/Duration uit de actieve OPS-baseline.
    const bt = baselineByTask.get(task.id);
    if (bt) {
      lines.push(`${indent(3)}<Baseline>`);
      lines.push(`${indent(4)}<Number>0</Number>`);
      lines.push(`${indent(4)}<Start>${toXmlDateTime(bt.start)}</Start>`);
      lines.push(`${indent(4)}<Finish>${toXmlDateTime(bt.finish)}</Finish>`);
      // Dezelfde `effHpd` als <Duration> — anders staat naast een taakduur van 168 u een baseline van
      // 56 u en verzint MS Project 112 u afwijking.
      lines.push(`${indent(4)}<Duration>${durationToISO8601(bt.duration, effHpd)}</Duration>`);
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
        lines.push(`${indent(4)}<Type>${MSP_LINK_TYPE_CODE[seq.type]}</Type>`);
        lines.push(`${indent(4)}<LinkLag>${linkLag}</LinkLag>`);
        lines.push(`${indent(4)}<LagFormat>${lagFormat}</LagFormat>`);
        lines.push(`${indent(3)}</PredecessorLink>`);
      }
    }

    lines.push(`${indent(2)}</Task>`);
  }

  lines.push(`${indent(1)}</Tasks>`);

  // Resources
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
    lines.push(`${indent(3)}<Name>${escapeXml(res.name)}</Name>`);
    // Type: 1=Work (LABOR/EQUIPMENT/CREW/SUBCONTRACTOR), 0=Material.
    lines.push(`${indent(3)}<Type>${res.type === 'MATERIAL' ? 0 : 1}</Type>`);
    lines.push(`${indent(3)}<MaxUnits>${res.maxUnits}</MaxUnits>`);
    if (res.type === 'MATERIAL' && res.unitOfMeasure) {
      lines.push(`${indent(3)}<MaterialLabel>${escapeXml(res.unitOfMeasure)}</MaterialLabel>`);
    }
    lines.push(`${indent(3)}<CalendarUID>${calUid}</CalendarUID>`);
    if (res.costPerHour !== undefined) {
      lines.push(`${indent(3)}<StandardRate>${res.costPerHour}</StandardRate>`);
    }
    lines.push(`${indent(2)}</Resource>`);
  }
  lines.push(`${indent(1)}</Resources>`);

  // Assignments: Work = duur x unitsPerDay x hoursPerDay, PT-formaat (dezelfde
  // durationToISO8601-helper als taakduur).
  if (assignments.length > 0) {
    lines.push(`${indent(1)}<Assignments>`);
    let asgnUid = 1;
    // Contourkoppeling per taak + kalender-engine per taakkalender.
    const assignmentsByTask = new Map<string, ResourceAssignment[]>();
    for (const a of assignments) {
      const list = assignmentsByTask.get(a.taskId) ?? [];
      list.push(a);
      assignmentsByTask.set(a.taskId, list);
    }
    const contourMatchCache = new Map<string, Map<string, import('@/types/task').TaskTimephasedContour>>();
    const contourOf = (task: Task, a: ResourceAssignment) => {
      if (!task.timephasedContours || task.timephasedContours.length === 0) return undefined;
      let m = contourMatchCache.get(task.id);
      if (!m) {
        m = matchContoursToAssignments(task.timephasedContours, assignmentsByTask.get(task.id) ?? [a]);
        contourMatchCache.set(task.id, m);
      }
      return m.get(a.id);
    };
    const engineCache = new Map<string, CalendarEngine>();
    const engineForTask = (task: Task): CalendarEngine => {
      const key = task.calendarId ?? '';
      let eng = engineCache.get(key);
      if (!eng) {
        eng = new CalendarEngine(calendarForEngine(resolveCalendar(task.calendarId, resourceCalendars, calendar)));
        engineCache.set(key, eng);
      }
      return eng;
    };
    for (const a of assignments) {
      const taskUid = taskUidMap.get(a.taskId);
      const resUid = resUidMap.get(a.resourceId);
      if (taskUid === undefined || resUid === undefined) continue;
      const task = tasks.find(t => t.id === a.taskId);
      const workDays = (task?.time.scheduleDuration ?? 0) * a.unitsPerDay;
      // Werk in uren van de TAAK-kalender, consistent met <Duration> — anders leest MS Project
      // Duration 168 u / Work 56 u / Units 100% en herrekent de eenheden naar 33%.
      const workHpd = task ? (effCalByTask.get(task.id)?.hoursPerDay ?? calendar.hoursPerDay) : calendar.hoursPerDay;
      // De contour van déze toewijzing (gekoppeld via `resourceId`).
      const taskContour = task ? contourOf(task, a) : undefined;
      const dayItems = task && taskContour && shownStart(task)
        ? contourPeriodsToDayItems(
          engineForTask(task), resolveCalendar(task.calendarId, resourceCalendars, calendar),
          parseInstant(shownStart(task)), taskContour.periods,
        )
        : [];

      const uid = asgnUid++;
      lines.push(`${indent(2)}<Assignment>`);
      lines.push(`${indent(3)}<UID>${uid}</UID>`);
      lines.push(`${indent(3)}<TaskUID>${taskUid}</TaskUID>`);
      lines.push(`${indent(3)}<ResourceUID>${resUid}</ResourceUID>`);
      // Verricht en resterend werk alleen wanneer het veld er is (schemavolgorde: ActualWork en
      // RemainingWork vóór Units, zie de MSPDI-Assignment-structuur).
      if (a.actualWorkMinutes !== undefined) {
        lines.push(`${indent(3)}<ActualWork>${minutesToMspdiValue(a.actualWorkMinutes)}</ActualWork>`);
      }
      if (a.remainingWorkMinutes !== undefined) {
        lines.push(`${indent(3)}<RemainingWork>${minutesToMspdiValue(a.remainingWorkMinutes)}</RemainingWork>`);
      }
      lines.push(`${indent(3)}<Units>${a.unitsPerDay}</Units>`);
      // Werk: het opgeslagen begrote werk als dat er is; anders bij een contour de SOM van de
      // dagverdeling (de echte werkinhoud), anders duur × units.
      const contourWorkMinutes = dayItems.reduce((n, d) => n + d.workMinutes, 0);
      // Zonder `remainingWorkMinutes` is het restant afgeleid, dus dan ook het totaal: alléén
      // verricht werk mag `<Work>` niet tot het verrichte deel laten krimpen.
      const plannedWork = a.plannedWorkMinutes
        ?? (a.remainingWorkMinutes !== undefined
          ? (a.actualWorkMinutes ?? 0) + a.remainingWorkMinutes
          : undefined);
      lines.push(`${indent(3)}<Work>${plannedWork !== undefined
        ? minutesToMspdiValue(plannedWork)
        : dayItems.length > 0 ? minutesToMspdiValue(contourWorkMinutes) : durationToISO8601(workDays, workHpd)}</Work>`);
      // WorkContour 8 = Contoured zodra er een echte verdeling meegaat (MPXJ `WorkContour.CONTOURED`).
      const contour = dayItems.length > 0 ? MSPDI_WORKCONTOUR_CONTOURED : CURVE_TO_WORKCONTOUR[a.curve ?? 'UNIFORM'];
      if (contour !== 0) {
        lines.push(`${indent(3)}<WorkContour>${contour}</WorkContour>`);
      }
      // `<TimephasedData>` per werkdag (Type 2 = verricht, 1 = resterend; Unit 2 = dag-item; Value =
      // ISO-8601-duur) — spiegelt MPXJ `MSPDIWriter.writeAssignmentTimephasedWorkData`.
      for (const d of dayItems) {
        lines.push(`${indent(3)}<TimephasedData>`);
        lines.push(`${indent(4)}<Type>${d.kind === 'actual' ? 2 : 1}</Type>`);
        lines.push(`${indent(4)}<UID>${uid}</UID>`);
        lines.push(`${indent(4)}<Start>${toXmlDateTime(formatInstant(d.start, 'hour'))}</Start>`);
        lines.push(`${indent(4)}<Finish>${toXmlDateTime(formatInstant(d.finish, 'hour'))}</Finish>`);
        lines.push(`${indent(4)}<Unit>2</Unit>`);
        lines.push(`${indent(4)}<Value>${minutesToMspdiValue(d.workMinutes)}</Value>`);
        lines.push(`${indent(3)}</TimephasedData>`);
      }
      lines.push(`${indent(2)}</Assignment>`);
    }
    lines.push(`${indent(1)}</Assignments>`);
  }

  lines.push('</Project>');

  return lines.join('\n');
}
