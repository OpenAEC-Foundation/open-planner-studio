import { Task, TaskConstraint } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import { Project } from '@/types/project';
import { holidayEndDate, WorkCalendar } from '@/types/calendar';
import { Baseline, BaselineTask } from '@/types/baseline';
import type { CustomTaskType } from '@/types/taskType';
import { projectFileBase } from '@/utils/documents';
import {
  effectiveCalendarByTask, minutesToClock, minutesToIsoDuration, taskDurationUnitForIo, taskMinutesForWrite,
} from '@/services/subdayIo';
import { effectiveWorkTimeBands, calendarForEngine } from '@/utils/effectiveWorkTime';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { matchContoursToAssignments, MSPDI_WORKCONTOUR_CONTOURED } from '@/engine/contour/contourEngine';
import { contourPeriodsToDayItems, minutesToMspdiValue } from '@/services/contourIo';
import { parseInstant, formatInstant } from '@/utils/dateUtils';

/**
 * MSPDI kent geen native onderscheid tussen "N werkdagen" en "N werkuren" als blijvende
 * rekenidentiteit: DurationFormat is alleen de MS Project-weergave-eenheid. Daarom gebruikt OPS
 * één namespaced custom task field als expliciete round-tripmarker. Text30 is bewust gekozen als
 * transportveld; de reader accepteert de waarde uitsluitend wanneer de projectdefinitie exact deze
 * OPS-naam draagt, zodat een vreemd bestand dat Text30 zelf gebruikt nooit per ongeluk matcht.
 */
export const OPS_DURATION_UNIT_FIELD_ID = '188743760';
export const OPS_DURATION_UNIT_FIELD_NAME = 'OPS_TaskDurationUnit';

const OPS_CUSTOM_TASK_TYPE_FIELD_ID = '188743731';
const OPS_CUSTOM_TASK_TYPE_MARKER = 'OpenPlannerStudio.CustomTaskType.v1';

// WorkContour-enum (fase 2.5, §8.3 — geverifieerd tegen de MSPDI-schemadocumentatie/MPXJ):
// 0=Flat, 1=BackLoaded, 2=FrontLoaded, 3=DoublePeak, 4=EarlyPeak, 5=LatePeak, 6=Bell, 7=Turtle;
// 8 (Contoured) is geen vorm maar het signaal dat er `<TimephasedData>` meegaat. Sinds de
// contour-UI-etappe (2026-09) zijn alle acht vormen een OPS-curve. Geëxporteerd zodat de reader de
// inverse gebruikt; gelijk aan `contourEngine.ts`'s `CONTOUR_SHAPE_MSPDI_CODE` via `CURVE_TO_SHAPE`.
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
export const WORKCONTOUR_TO_CURVE: Record<number, ResourceCurve> = (() => {
  const inv: Record<number, ResourceCurve> = {};
  for (const [curve, code] of Object.entries(CURVE_TO_WORKCONTOUR) as [ResourceCurve, number][]) {
    inv[code] = curve;
  }
  return inv;
})();

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
  includeEffectiveScalarBands = false,
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
      lines.push(`${indent(7)}<ToTime>${String(cal.workEndHour).padStart(2, '0')}:00:00</ToTime>`);
      lines.push(`${indent(6)}</WorkingTime>`);
      lines.push(`${indent(5)}</WorkingTimes>`);
    }
    lines.push(`${indent(4)}</WeekDay>`);
  }

  lines.push(`${indent(3)}</WeekDays>`);

  // T13 (§T2-afwijking, LAAG-7-afnemer): vóór deze taak schreef alleen `cal.holidays` naar
  // `<Exceptions>` — `cal.workingExceptions` (T2/T3) verdween stil bij export, ook al kan
  // `mspdiReader.ts` (T4) ze prima terug inlezen (`readRawMspdiExceptions`, `DayWorking=1` +
  // `<WorkingTimes>`). Spiegelt die lezer exact: `DayWorking=1`, banden als `<WorkingTime>`-blokken
  // wanneer aanwezig (afwezig/leeg ⇒ geen `<WorkingTimes>`-element — de lezer se banden-optioneel-
  // fallback-keten (`types/calendar.ts`'s `WorkingException.bands`-doc) vangt dat dan zelf op).
  const workingExceptions = cal.workingExceptions ?? [];
  if (cal.holidays.length > 0 || workingExceptions.length > 0) {
    lines.push(`${indent(3)}<Exceptions>`);
    for (const h of cal.holidays) {
      lines.push(`${indent(4)}<Exception>`);
      lines.push(`${indent(5)}<EnteredByOccurrences>0</EnteredByOccurrences>`);
      lines.push(`${indent(5)}<TimePeriod>`);
      lines.push(`${indent(6)}<FromDate>${formatMSPDateTime(h.startDate)}</FromDate>`);
      lines.push(`${indent(6)}<ToDate>${formatMSPDateTime(holidayEndDate(h))}</ToDate>`);
      lines.push(`${indent(5)}</TimePeriod>`);
      lines.push(`${indent(5)}<Name>${escapeXML(h.name)}</Name>`);
      lines.push(`${indent(5)}<Type>1</Type>`);
      lines.push(`${indent(5)}<DayWorking>0</DayWorking>`);
      lines.push(`${indent(4)}</Exception>`);
    }
    for (const we of workingExceptions) {
      lines.push(`${indent(4)}<Exception>`);
      lines.push(`${indent(5)}<EnteredByOccurrences>0</EnteredByOccurrences>`);
      lines.push(`${indent(5)}<TimePeriod>`);
      lines.push(`${indent(6)}<FromDate>${formatMSPDateTime(we.startDate)}</FromDate>`);
      lines.push(`${indent(6)}<ToDate>${formatMSPDateTime(we.endDate)}</ToDate>`);
      lines.push(`${indent(5)}</TimePeriod>`);
      lines.push(`${indent(5)}<Name>${escapeXML(we.name)}</Name>`);
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

  // Z14 (etappe "nul afwijkingen"): MSPDI kent native <Manual>, <LevelingDelay>/<LevelingDelayFormat>
  // en <TimephasedData>, maar onze LEZER leest geen van drieën. Exact hetzelfde ELAPSEDTIME/
  // <DurationFormat>-precedent hierboven: native schrijven zonder terug te lezen is een stille
  // semantiek-omklap en dus erger dan verlies — hier dus BEWUST alleen warnen, geen elementen
  // schrijven. Native MSPDI-ondersteuning voor deze drie is een TODO voor een latere taak.
  const manualCount = tasks.filter(t => t.manuallyScheduled).length;
  if (manualCount > 0) {
    console.warn(`MSPDI-export: ${manualCount} handmatig geplande taak/taken geëxporteerd zonder native <Manual> — MSPDI-lezer kent dat element nog niet (§6).`);
  }
  const levelingPrecisionCount = tasks.filter(t => t.levelingDelayMinutes != null).length;
  if (levelingPrecisionCount > 0) {
    console.warn(`MSPDI-export: ${levelingPrecisionCount} taak/taken met sub-dag-nivelleervertraging (levelingDelayMinutes) geëxporteerd zonder native <LevelingDelay>/<LevelingDelayFormat> — MSPDI-lezer kent die elementen nog niet (§6).`);
  }
  // Contour-engine (2026-09): gecontoureerde toewijzingen (`Task.timephasedContours`) gaan sinds
  // deze etappe NATIEF mee als `<TimephasedData>` (zie de toewijzingensectie hieronder) en de lezer
  // leest ze terug — de O4-warn van Z14 is daarmee voor contouren vervallen. Een gesplitste taak
  // ZONDER contour (bv. een nivelleergat, `splitGaps` met `source: 'leveling'`) heeft geen
  // per-toewijzing-verdeling om te schrijven; die blijft een warn (MSP kent een split alleen als
  // timephased-vorm van een toewijzing).
  const contouredTaskIds = new Set(tasks.filter(t => t.timephasedContours && t.timephasedContours.length > 0).map(t => t.id));
  const splitWithoutContour = tasks.filter(t => t.splitGaps && t.splitGaps.length > 0 && !contouredTaskIds.has(t.id)).length;
  if (splitWithoutContour > 0) {
    console.warn(`MSPDI-export: ${splitWithoutContour} gesplitste taak/taken zonder contourdata geëxporteerd zonder native <TimephasedData> — alleen contouren (uit .mpp/MSPDI/P6) worden als tijdgefaseerde verdeling geschreven (§6).`);
  }
  // Z12-herwerk/Z14: MSP's eigen resume/stop-instanten (uit-volgorde-hervatting). MSPDI kent native
  // <Resume>/<Stop>, maar onze lezer leest ze (nog) niet terug — zelfde conservatieve keuze.
  const resumeStopCount = tasks.filter(t => t.time.resume || t.time.stop).length;
  if (resumeStopCount > 0) {
    console.warn(`MSPDI-export: ${resumeStopCount} taak/taken met resume/stop (uit-volgorde-hervatting) geëxporteerd zonder native <Resume>/<Stop> — MSPDI-lezer kent die elementen nog niet (§6).`);
  }

  // Fase 2.6 (§9.1): alleen de ACTIEVE baseline gaat naar MSPDI-slot 0 (Baseline Number 0).
  // De overige OPS-baselines verliezen we bewust (extra slots 1-10 = latere uitbreiding).
  const activeBaseline = baselines.find(b => b.id === activeBaselineId) ?? null;
  const baselineByTask = new Map<string, BaselineTask>(
    (activeBaseline?.tasks ?? []).map(bt => [bt.taskId, bt]),
  );

  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  lines.push('<Project xmlns="http://schemas.microsoft.com/project">');

  // Project properties.
  // Een naamloos project leverde hier een LEEG <Name>/<Title> op — MS Project importeert dan een
  // project zonder naam, en de gebruiker ziet in Projectgegevens (en op elke afdruk met een
  // projectnaamveld) een leeg vak. Beide elementen zijn in MSPDI weliswaar optioneel, maar
  // weglaten lost het niet op: het project blijft naamloos. Vandaar dezelfde neutrale,
  // TAALONAFHANKELIJKE terugval als de bestandsnaam en de STEP-header (`projectFileBase`), zodat
  // één begrip ook één waarde houdt. Bewust géén vertaalde terugval: uitwisselingsdata gaat naar
  // een ander systeem en een andere gebruiker; een Nederlandse of Japanse tekst in een MSPDI-veld
  // is daar geen hulp.
  const exportName = projectFileBase(project.name);
  lines.push(`${indent(1)}<Name>${escapeXML(exportName)}</Name>`);
  lines.push(`${indent(1)}<Title>${escapeXML(exportName)}</Title>`);
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

  // Expliciete OPS-taakeenheid voor een verliesvrije eigen MSPDI-round-trip. Buitenlandse/legacy-
  // bestanden zonder deze definitie blijven aan de leeskant exact de oude kalenderregel volgen.
  lines.push(`${indent(1)}<ExtendedAttributes>`);
  lines.push(`${indent(2)}<ExtendedAttribute>`);
  lines.push(`${indent(3)}<FieldID>${OPS_DURATION_UNIT_FIELD_ID}</FieldID>`);
  lines.push(`${indent(3)}<FieldName>${OPS_DURATION_UNIT_FIELD_NAME}</FieldName>`);
  lines.push(`${indent(3)}<Alias>${OPS_DURATION_UNIT_FIELD_NAME}</Alias>`);
  lines.push(`${indent(2)}</ExtendedAttribute>`);
  lines.push(`${indent(1)}</ExtendedAttributes>`);

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
    // T9 (Opus-review N1): geen MSPDI-equivalent voor deze MPP-eigen hervattingsconventie (zie
    // `SchedulingOptions.resumeFromActualElapsed`, `CPMSolver.ts`) — zonder deze warn zou
    // .mpp → MSPDI-export → herimport het veld geruisloos laten vallen en de gefixte datums van T9
    // stil weer laten verschuiven bij die herimport.
    if (so.resumeFromActualElapsed) lost.push('resumeFromActualElapsed');
    // B1 (eindreview T16c, dossier (c)4-herdiagnose): idem — geen MSPDI-equivalent voor de
    // niet-gestart-vloer-uitzondering (`SchedulingOptions.unstartedIgnoresStatusDate`); zonder deze
    // warn zou dezelfde .mpp → MSPDI-export → herimport-route de niet-gestarte taken van een
    // statusdatum-project weer stil ~jaren vooruit klemmen.
    if (so.unstartedIgnoresStatusDate) lost.push('unstartedIgnoresStatusDate');
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
  const hourTaskCalendarIds = new Set(tasks.flatMap((task) => {
    const calendarId = taskDurationUnitForIo(task) === 'hours' ? effCalByTask.get(task.id)?.id : undefined;
    return calendarId ? [calendarId] : [];
  }));

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
  lines.push(`${indent(3)}<Name>${escapeXML(exportName)}</Name>`);
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
    const effHpd = effCal?.hoursPerDay ?? calendar.hoursPerDay;
    const isHourTask = taskDurationUnitForIo(task) === 'hours';
    const durationTag = isHourTask
      ? minutesToIsoDuration(taskMinutesForWrite(task, effHpd))
      : durationToISO8601(task.time.scheduleDuration, calendar.hoursPerDay);
    const durationFormat = isHourTask
      ? (task.time.durationType === 'ELAPSEDTIME' ? 6 : 5)
      : (task.time.durationType === 'ELAPSEDTIME' ? 8 : 7);

    lines.push(`${indent(2)}<Task>`);
    lines.push(`${indent(3)}<UID>${uid}</UID>`);
    lines.push(`${indent(3)}<ID>${uid}</ID>`);
    lines.push(`${indent(3)}<Name>${escapeXML(task.name)}</Name>`);
    lines.push(`${indent(3)}<Duration>${durationTag}</Duration>`);
    lines.push(`${indent(3)}<DurationFormat>${durationFormat}</DurationFormat>`);
    lines.push(`${indent(3)}<Start>${formatMSPDateTime(task.time.earlyStart || task.time.scheduleStart)}</Start>`);
    lines.push(`${indent(3)}<Finish>${formatMSPDateTime(task.time.earlyFinish || task.time.scheduleFinish)}</Finish>`);
    lines.push(`${indent(3)}<WBS>${escapeXML(task.wbsCode)}</WBS>`);
    lines.push(`${indent(3)}<OutlineLevel>${getOutlineLevel(task.wbsCode)}</OutlineLevel>`);
    lines.push(`${indent(3)}<Summary>${isSummary ? 1 : 0}</Summary>`);
    lines.push(`${indent(3)}<Milestone>${isMilestone ? 1 : 0}</Milestone>`);
    // T14b-vervolg (spec-review-bevinding): `completion` ongeguard vermenigvuldigen gaf `NaN` in de
    // export zodra een taak (buiten de TS-typechecker om, extensie-/MCP-rand) toch met een
    // `undefined` completion binnenkwam — dezelfde diepteverdediging als de IFC-writer
    // (`ifcTaskSlots.ts`, `(w.task.time.completion ?? 0).toFixed(1)`), hier voor MSPDI.
    lines.push(`${indent(3)}<PercentComplete>${Math.round((task.time.completion ?? 0) * 100)}</PercentComplete>`);
    // Actuals (fase 2.6, §9.1) — alleen wanneer gezet (golden rule). RemainingDuration afgeleid.
    if (task.time.actualStart) {
      lines.push(`${indent(3)}<ActualStart>${formatMSPDateTime(task.time.actualStart)}</ActualStart>`);
    }
    if (task.time.actualFinish) {
      lines.push(`${indent(3)}<ActualFinish>${formatMSPDateTime(task.time.actualFinish)}</ActualFinish>`);
    }
    if (isHourTask && task.time.remainingMinutes != null) {
      lines.push(`${indent(3)}<RemainingDuration>${minutesToIsoDuration(task.time.remainingMinutes)}</RemainingDuration>`);
    } else if (task.time.remainingTime != null) {
      lines.push(`${indent(3)}<RemainingDuration>${durationToISO8601(task.time.remainingTime, calendar.hoursPerDay)}</RemainingDuration>`);
    }
    // ?? i.p.v. || : priority 0 is een geldige waarde (laagste, levelt als eerste weg).
    lines.push(`${indent(3)}<Priority>${Number.isFinite(task.priority) ? task.priority : 500}</Priority>`);
    if (task.customTaskTypeId) {
      const type = customTaskTypes.find(candidate => candidate.id === task.customTaskTypeId);
      // MSPDI vrije tekst-uitbreiding: vreemde clients negeren dit; OPS leest hem terug zonder
      // de native MSP Task Type (resource-inspanning) te misbruiken.
      const value = JSON.stringify({ ops: OPS_CUSTOM_TASK_TYPE_MARKER, id: task.customTaskTypeId, ...(type ? { name: type.name } : {}) });
      lines.push(`${indent(3)}<ExtendedAttribute><FieldID>${OPS_CUSTOM_TASK_TYPE_FIELD_ID}</FieldID><Value>${escapeXML(value)}</Value></ExtendedAttribute>`);
    }
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
    lines.push(`${indent(3)}<ExtendedAttribute>`);
    lines.push(`${indent(4)}<FieldID>${OPS_DURATION_UNIT_FIELD_ID}</FieldID>`);
    lines.push(`${indent(4)}<Value>${isHourTask ? 'hours' : 'days'}</Value>`);
    lines.push(`${indent(3)}</ExtendedAttribute>`);
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
    // Contour-engine (2026-09): contour-koppeling per taak + kalender-engine per taakkalender.
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
      // Contour-engine (2026-09): de contour van déze toewijzing (gekoppeld via `resourceId`).
      const taskContour = task ? contourOf(task, a) : undefined;
      const dayItems = task && taskContour && (task.time.earlyStart || task.time.scheduleStart)
        ? contourPeriodsToDayItems(
          engineForTask(task), resolveCalendar(task.calendarId, resourceCalendars, calendar),
          parseInstant(task.time.earlyStart || task.time.scheduleStart), taskContour.periods,
        )
        : [];

      const uid = asgnUid++;
      lines.push(`${indent(2)}<Assignment>`);
      lines.push(`${indent(3)}<UID>${uid}</UID>`);
      lines.push(`${indent(3)}<TaskUID>${taskUid}</TaskUID>`);
      lines.push(`${indent(3)}<ResourceUID>${resUid}</ResourceUID>`);
      lines.push(`${indent(3)}<Units>${a.unitsPerDay}</Units>`);
      // Werk: bij een contour de SOM van de dagverdeling (de echte werkinhoud), anders duur × units.
      const contourWorkMinutes = dayItems.reduce((n, d) => n + d.workMinutes, 0);
      lines.push(`${indent(3)}<Work>${dayItems.length > 0 ? minutesToMspdiValue(contourWorkMinutes) : durationToISO8601(workDays, calendar.hoursPerDay)}</Work>`);
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
        lines.push(`${indent(4)}<Start>${formatMSPDateTime(formatInstant(d.start, 'hour'))}</Start>`);
        lines.push(`${indent(4)}<Finish>${formatMSPDateTime(formatInstant(d.finish, 'hour'))}</Finish>`);
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
