import { Task, TaskConstraint } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment, ResourceType, ResourceCurve } from '@/types/resource';
import {
  CONTOUR_SHAPE_VALUES, CURVE_TO_SHAPE, isFlatCurveValues, matchContoursToAssignments,
} from '@/engine/contour/contourEngine';
import { contourPeriodsToP6Spread } from '@/services/contourIo';
import { Project } from '@/types/project';
import { holidayEndDate, WorkCalendar } from '@/types/calendar';
import { effectiveCalendarByTask, minutesToClock, taskMinutesForWrite } from '@/services/subdayIo';
import { effectiveWorkTimeBands } from '@/utils/effectiveWorkTime';
import { projectFileBase } from '@/utils/documents';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import type { CustomTaskType } from '@/types/taskType';

const OPS_CUSTOM_TASK_TYPE_UDF_TITLE = 'OPS Custom Task Type';
const OPS_CUSTOM_TASK_TYPE_MARKER = 'OpenPlannerStudio.CustomTaskType.v1';
const OPS_CUSTOM_TASK_TYPE_UDF_OBJECT_ID = 900000001;

/** OPS-eigen, schema-native P6-UDF waarmee gemengde dag-/urentaken exact terugkomen. */
export const OPS_P6_DURATION_UNIT_UDF_TITLE = 'OPS_TaskDurationUnit';
export const OPS_P6_DURATION_UNIT_UDF_OBJECT_ID = 1;

// Curve-/contour-naammapping (fase 2.5, §8.3). Contour-engine (2026-09): de curve wordt sinds
// deze etappe SCHEMA-NATIEF geschreven — als `<ResourceCurve>`-object (21 waarden, MPXJ
// `XmlContextWriter.writeResourceCurves`) plus `<ResourceCurveObjectId>` op de toewijzing. De
// naam hieronder is alleen nog het `<Name>`-veld van dat object; het vroegere schrijven van de
// naam in `<PlannedCurve>` was een verkeerde lezing van het schema (dat element is een
// spreidingsstring, zie `contourIo.ts`) en is vervallen. LATE_PEAK heeft nu wél zijn eigen
// tabel (MSP's Late Peak) en hoeft niet meer tot 'Early Peak' te degraderen; de naam volgt MSP.
const P6_CURVE_TO_NAME: Record<ResourceCurve, string | undefined> = {
  UNIFORM: undefined,
  FRONT_LOADED: 'Front Loaded',
  BACK_LOADED: 'Back Loaded',
  BELL: 'Bell Shaped',
  EARLY_PEAK: 'Early Peak',
  LATE_PEAK: 'Late Peak',
  // Contour-UI (2026-09): de twee laatste MS Project-vormen. LET OP: dit is alleen het LABEL van het
  // `<ResourceCurve>`-object; de 21 waarden die de writer meeschrijft zijn de MS Project-tabel
  // (`CONTOUR_SHAPE_VALUES`), niet P6's eigen ingebouwde "Double Peak"/"Trapezoidal"-tabel — de
  // lezer matcht sowieso eerst op waarden, pas dan op naam.
  DOUBLE_PEAK: 'Double Peak',
  TURTLE: 'Turtle',
};

// Inkomende richting (P6-curvenaam → OPS-curve), gebruikt door de reader. BEWUST ASYMMETRISCH,
// dus NIET afleidbaar uit P6_CURVE_TO_NAME: (1) P6's default-naam 'Linear' → UNIFORM (de writer
// schrijft UNIFORM juist als afwezig element, niet als 'Linear'); (2) 'Early Peak' is bij het
// schrijven de dubbel-bezette bestemming van zowel EARLY_PEAK als LATE_PEAK (lossy, §8.4) — bij
// het lezen kiezen we EARLY_PEAK. Beide richtingen staan hier bewust naast elkaar.
export const P6_NAME_TO_CURVE: Record<string, ResourceCurve> = {
  'Linear': 'UNIFORM',
  'Front Loaded': 'FRONT_LOADED',
  'Back Loaded': 'BACK_LOADED',
  'Bell Shaped': 'BELL',
  'Early Peak': 'EARLY_PEAK',
  'Late Peak': 'LATE_PEAK',
  'Double Peak': 'DOUBLE_PEAK',
  'Turtle': 'TURTLE',
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
  if (isSummaryTask(task)) return 'WBS Summary';
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
function writeStandardWorkWeek(
  lines: string[], indent: (level: number) => string, cal: WorkCalendar, includeEffectiveScalarBands = false,
): void {
  const workTime = cal.workTime ?? (includeEffectiveScalarBands ? effectiveWorkTimeBands(cal) : undefined);
  lines.push(`${indent(2)}<StandardWorkWeek>`);
  for (let day = 1; day <= 7; day++) {
    lines.push(`${indent(3)}<StandardWorkHour>`);
    lines.push(`${indent(4)}<DayOfWeek>${P6_DAY_NAMES[day]}</DayOfWeek>`);
    if (workTime) {
      // Fase 2.8b (§7.2): UUR-kalender ⇒ ALLE banden van deze weekdag als aparte <WorkTime>-blokken
      // (pauze/split-shift/nachtploeg). Een wrap-band (`end > 1440`) emitteert het eind als
      // tijd-van-de-dag (`end % 1440`, via `minutesToClock`), waaruit de reader de wrap herkent.
      for (const b of workTime.byWeekday[day as 1] ?? []) {
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
 *  feestdagen ⇒ geen element.
 *
 *  T13 (§T2-afwijking, LAAG-7-afnemer): `cal.workingExceptions` (fase 3.8, T2/T3 — dag-uitzonderingen
 *  die een dag WERKEND maken) wordt hier bewust NIET geschreven. `<HolidayOrException>` heeft in het
 *  P6-XML-schema geen `DayWorking`-achtig veld (alleen `Name`/`Date`/`FinishDate`, geverifieerd tegen
 *  `p6xmlReader.ts`'s `parseP6HolidayOrExceptions` — die leest elk element onvoorwaardelijk als
 *  NIET-werkend, er is geen tegenhanger van MSPDI's `DayWorking=1`-vlag). Een P6-conforme "werkende
 *  uitzondering" bestaat structureel niet in dit schema; P6 zelf modelleert een ingeroosterde
 *  extra werkdag door de datum aan `<StandardWorkWeek>` toe te voegen (een project-brede
 *  weekpatroon-wijziging, geen per-datum-uitzondering) — dat is een fundamenteel ander model dan
 *  `WorkingException` en NIET veilig automatisch te vertalen (het zou het hele weekpatroon voor
 *  ALLE datums wijzigen, niet alleen de ene). Zie de `console.warn` in `writeP6XML` hieronder en
 *  `docs/library.md`/T16 (gidsupdate) voor de gebruikersvoorlichting. */
function writeHolidayOrExceptions(lines: string[], indent: (level: number) => string, cal: WorkCalendar): void {
  if (cal.holidays.length === 0) return;
  lines.push(`${indent(2)}<HolidayOrExceptions>`);
  for (const h of cal.holidays) {
    lines.push(`${indent(3)}<HolidayOrException>`);
    lines.push(`${indent(4)}<Name>${escapeXML(h.name)}</Name>`);
    lines.push(`${indent(4)}<Date>${formatP6DateTime(h.startDate)}</Date>`);
    lines.push(`${indent(4)}<FinishDate>${formatP6DateTime(holidayEndDate(h))}</FinishDate>`);
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
  customTaskTypes: readonly CustomTaskType[] = [],
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

  // Fase 2.10 (item 1): taak-aantekeningen zijn in P6-XML niet uitdrukbaar ⇒ weggelaten (blijven
  // in-app), exact het externalLinks/hammock-weglaten-met-warn-patroon hierboven.
  const noteCount = tasks.reduce((n, t) => n + (t.notes?.length ?? 0), 0);
  if (noteCount > 0) {
    console.warn(`P6-export: ${noteCount} taak-aantekening(en) weggelaten — niet uitdrukbaar in P6-XML (§6).`);
  }

  // H5 (eindreview T16c): P6 kent per activity geen "24/7, negeer de kalender"-duurtype (elke
  // activity rekent tegen een kalender — geen ELAPSEDTIME-equivalent geverifieerd in het P6-XML-
  // schema, zelfde UNVERIFIED-voorzichtigheid als de scheduling-opties hierboven); een taak met
  // ELAPSEDTIME-duur (T8, bv. uit een `.mpp`-import) exporteert daarom stil als gewone werktijd-duur
  // ⇒ weggelaten-met-warn, exact het hammock-/externalLinks-patroon hierboven.
  const elapsedTaskCount = tasks.filter(t => t.time.durationType === 'ELAPSEDTIME').length;
  if (elapsedTaskCount > 0) {
    console.warn(`P6-export: ${elapsedTaskCount} taak/taken met ELAPSEDTIME-duur (24/7-klokrekenen) geëxporteerd als gewone werktijd-duur — geen P6-equivalent (§6).`);
  }

  // T13 (§T2-afwijking, LAAG-7-afnemer): werkende uitzonderingen (fase 3.8, T2/T3) — zie de
  // uitgebreide toelichting bij `writeHolidayOrExceptions` hierboven voor WAAROM dit structureel
  // niet uitdrukbaar is in het P6-XML-schema (geen `DayWorking`-vlag op `<HolidayOrException>`).
  // Geteld over de projectkalender ÉN alle bibliotheekkalenders die daadwerkelijk geschreven worden.
  const workingExcCount = [calendar, ...resourceCalendars].reduce((n, c) => n + (c.workingExceptions?.length ?? 0), 0);
  if (workingExcCount > 0) {
    console.warn(`P6-export: ${workingExcCount} werkende kalenderuitzondering(en) weggelaten — niet uitdrukbaar in P6-XML (geen DayWorking-vlag op HolidayOrException, §6).`);
  }

  // Z14 (etappe "nul afwijkingen") — vier nieuwe velden zonder geverifieerde P6-representatie:
  // exact het hammock-/externalLinks-patroon hierboven (weglaten-met-warn i.p.v. gokken op een
  // UNVERIFIED P6-veldnaam).
  const manualCount = tasks.filter(t => t.manuallyScheduled).length;
  if (manualCount > 0) {
    console.warn(`P6-export: ${manualCount} handmatig geplande taak/taken geëxporteerd als gewone taak met berekende datums — geen geverifieerd P6-equivalent (§6).`);
  }
  const levelingPrecisionCount = tasks.filter(t => t.levelingDelayMinutes != null).length;
  if (levelingPrecisionCount > 0) {
    console.warn(`P6-export: ${levelingPrecisionCount} taak/taken met sub-dag-nivelleervertraging (levelingDelayMinutes) weggelaten — niet uitdrukbaar in P6-XML (§6).`);
  }
  // Contour-engine (2026-09): gecontoureerde toewijzingen (`Task.timephasedContours`) gaan sinds
  // deze etappe schema-natief mee als `<PlannedCurve>`/`<RemainingCurve>`/`<ActualCurve>`-
  // spreiding (zie de toewijzingensectie) en de lezer leest ze terug. Alleen een gesplitste taak
  // ZONDER contour (bv. een nivelleergat) heeft geen per-toewijzing-verdeling om te schrijven —
  // die blijft een warn (P6 kent een onderbreking alleen als spreiding van een toewijzing).
  const contouredTaskIds = new Set(tasks.filter(t => t.timephasedContours && t.timephasedContours.length > 0).map(t => t.id));
  const splitWithoutContour = tasks.filter(t => t.splitGaps && t.splitGaps.length > 0 && !contouredTaskIds.has(t.id)).length;
  if (splitWithoutContour > 0) {
    console.warn(`P6-export: ${splitWithoutContour} gesplitste taak/taken zonder contourdata weggelaten — alleen contouren (uit .mpp/MSPDI/P6) worden als spreiding geschreven (§6).`);
  }
  const resumeStopCount = tasks.filter(t => t.time.resume || t.time.stop).length;
  if (resumeStopCount > 0) {
    console.warn(`P6-export: ${resumeStopCount} taak/taken met resume/stop (uit-volgorde-hervatting) weggelaten — niet uitdrukbaar in P6-XML (§6).`);
  }

  // X9-besluit: deze adapter is doelbewust asymmetrisch met XER. Een XER-import bewaart zijn
  // P6-velden en exacte bron alleen via IFC; dit XML-profiel claimt daarvoor geen equivalent.
  // TODO(X9/P6XML): pas na een gevalideerde Oracle-schema-/corpusmapping eventueel individuele
  // DurationType/ActivityType/progressvelden lezen/schrijven, met een nieuwe parity-test.

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
  const hourTaskCalendarIds = new Set(tasks.flatMap((task) => {
    const calendarId = task.time.durationUnit === 'hours' ? effCalByTask.get(task.id)?.id : undefined;
    return calendarId ? [calendarId] : [];
  }));

  // WBS elements (parent tasks)
  const wbsTasks = tasks.filter(isSummaryTask);
  const leafTasks = tasks.filter(isLeafTask);

  // Project
  lines.push(`${indent(1)}<Project>`);
  lines.push(`${indent(2)}<ObjectId>1</ObjectId>`);
  lines.push(`${indent(2)}<Id>${escapeXML(project.id)}</Id>`);
  // Zelfde afweging als in mspdiWriter: een leeg <Name> gaf P6 een naamloos project, terwijl de
  // projectnaam in P6 juist een dragend, verplicht ingevuld veld is. Dezelfde neutrale,
  // taalonafhankelijke terugval als de bestandsnaam en de STEP-header.
  lines.push(`${indent(2)}<Name>${escapeXML(projectFileBase(project.name))}</Name>`);
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

  // P6 heeft geen native dag/uur-vlag per activity: PlannedDuration zelf staat altijd in uren.
  // Een Text-UDF is wel een officiële uitbreidingsroute. De reader vertrouwt deze waarden alleen
  // wanneer ook deze exacte definitie aanwezig is; vreemde/legacy P6 houdt zo de oude
  // kalenderprecisie-classificatie.
  lines.push(`${indent(1)}<UDFType>`);
  lines.push(`${indent(2)}<ObjectId>${OPS_P6_DURATION_UNIT_UDF_OBJECT_ID}</ObjectId>`);
  lines.push(`${indent(2)}<SubjectArea>Activity</SubjectArea>`);
  lines.push(`${indent(2)}<Title>${OPS_P6_DURATION_UNIT_UDF_TITLE}</Title>`);
  lines.push(`${indent(2)}<DataType>Text</DataType>`);
  lines.push(`${indent(1)}</UDFType>`);

  // Calendar
  lines.push(`${indent(1)}<Calendar>`);
  lines.push(`${indent(2)}<ObjectId>1</ObjectId>`);
  lines.push(`${indent(2)}<Name>${escapeXML(calendar.name)}</Name>`);
  lines.push(`${indent(2)}<Type>Global</Type>`);
  lines.push(`${indent(2)}<HoursPerDay>${calendar.hoursPerDay}</HoursPerDay>`);
  lines.push(`${indent(2)}<HoursPerWeek>${calendar.hoursPerDay * calendar.workDays.length}</HoursPerWeek>`);
  lines.push(`${indent(2)}<HoursPerMonth>${calendar.hoursPerDay * 20}</HoursPerMonth>`);
  writeStandardWorkWeek(lines, indent, calendar, hourTaskCalendarIds.has(calendar.id));
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
    writeStandardWorkWeek(lines, indent, cal, hourTaskCalendarIds.has(cal.id));
    writeHolidayOrExceptions(lines, indent, cal);
    lines.push(`${indent(1)}</Calendar>`);
  }

  // Contour-engine (2026-09) — `<ResourceCurve>`-catalogus (schema-volgorde: ná Calendar, vóór
  // Resource — MPXJ `APIBusinessObjects` propOrder). Eén object per UNIEKE 21-waardenlijst die een
  // toewijzing gebruikt: `curveValues` (exacte P6-/MSPDI-data) of anders de tabel van `curve`.
  const curveObjIdByKey = new Map<string, number>();
  const curveDefs: { objId: number; name: string; values: readonly number[] }[] = [];
  const curveObjIdFor = (a: ResourceAssignment): number | undefined => {
    const values = a.curveValues ?? (a.curve && a.curve !== 'UNIFORM' ? CONTOUR_SHAPE_VALUES[CURVE_TO_SHAPE[a.curve]] : undefined);
    if (!values || isFlatCurveValues(values)) return undefined;
    const key = values.map(v => String(v)).join(',');
    let objId = curveObjIdByKey.get(key);
    if (objId === undefined) {
      objId = curveDefs.length + 1;
      curveObjIdByKey.set(key, objId);
      const name = (a.curve ? P6_CURVE_TO_NAME[a.curve] : undefined) ?? `Curve ${objId}`;
      curveDefs.push({ objId, name, values });
    }
    return objId;
  };
  const curveObjIdByAssignment = new Map<string, number>();
  for (const a of assignments) {
    const objId = curveObjIdFor(a);
    if (objId !== undefined) curveObjIdByAssignment.set(a.id, objId);
  }
  for (const def of curveDefs) {
    lines.push(`${indent(1)}<ResourceCurve>`);
    lines.push(`${indent(2)}<Name>${escapeXML(def.name)}</Name>`);
    lines.push(`${indent(2)}<ObjectId>${def.objId}</ObjectId>`);
    lines.push(`${indent(2)}<Values>`);
    def.values.forEach((v, i) => {
      lines.push(`${indent(3)}<Value${i * 5}>${v}</Value${i * 5}>`);
    });
    lines.push(`${indent(2)}</Values>`);
    lines.push(`${indent(1)}</ResourceCurve>`);
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
    const isHour = task.time.durationUnit === 'hours';
    const effHpd = effCal?.hoursPerDay ?? calendar.hoursPerDay;
    const plannedDur = isHour ? taskMinutesForWrite(task, effHpd) / 60 : durationToP6Hours(task.time.scheduleDuration, effHpd);
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

  // P6 PMXML modelleert UDF-definities en -waarden als losse top-level objecten. De activity houdt
  // dus geen verzonnen genest element; ForeignObjectId koppelt de vrije tekst aan de taak. Andere
  // clients mogen dit veld negeren zonder dat we een verkeerd native P6-activitytype claimen.
  const customTasks = leafTasks.filter(task => task.customTaskTypeId);
  if (customTasks.length > 0) {
    lines.push(`${indent(1)}<UDFType>`);
    lines.push(`${indent(2)}<ObjectId>${OPS_CUSTOM_TASK_TYPE_UDF_OBJECT_ID}</ObjectId>`);
    lines.push(`${indent(2)}<SubjectArea>Activity</SubjectArea>`);
    lines.push(`${indent(2)}<Title>${OPS_CUSTOM_TASK_TYPE_UDF_TITLE}</Title>`);
    lines.push(`${indent(2)}<DataType>Text</DataType>`);
    lines.push(`${indent(1)}</UDFType>`);
    for (const task of customTasks) {
      const type = customTaskTypes.find(candidate => candidate.id === task.customTaskTypeId);
      const value = JSON.stringify({ ops: OPS_CUSTOM_TASK_TYPE_MARKER, id: task.customTaskTypeId, ...(type ? { name: type.name } : {}) });
      lines.push(`${indent(1)}<UDFValue>`);
      lines.push(`${indent(2)}<ForeignObjectId>${taskObjMap.get(task.id)}</ForeignObjectId>`);
      lines.push(`${indent(2)}<UDFTypeObjectId>${OPS_CUSTOM_TASK_TYPE_UDF_OBJECT_ID}</UDFTypeObjectId>`);
      lines.push(`${indent(2)}<Text>${escapeXML(value)}</Text>`);
      lines.push(`${indent(1)}</UDFValue>`);
    }
  }

  // De duurwaarde in P6 is altijd uren. Deze officiële Activity-Text-UDF bewaart daarom apart
  // of OPS de taak als werkdag of als exacte werkuren moet herlezen.
  for (const task of leafTasks) {
    const foreignObjectId = taskObjMap.get(task.id)!;
    lines.push(`${indent(1)}<UDFValue>`);
    lines.push(`${indent(2)}<ProjectObjectId>1</ProjectObjectId>`);
    lines.push(`${indent(2)}<ForeignObjectId>${foreignObjectId}</ForeignObjectId>`);
    lines.push(`${indent(2)}<UDFTypeObjectId>${OPS_P6_DURATION_UNIT_UDF_OBJECT_ID}</UDFTypeObjectId>`);
    lines.push(`${indent(2)}<Text>${task.time.durationUnit}</Text>`);
    lines.push(`${indent(1)}</UDFValue>`);
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
  // Contour-engine (2026-09): contour-koppeling per taak voor de spreidingsstrings
  // (`contourPeriodsToP6Spread`, anker = taakstart, zie hieronder).
  const assignmentsByTask = new Map<string, ResourceAssignment[]>();
  for (const a of assignments) {
    const list = assignmentsByTask.get(a.taskId) ?? [];
    list.push(a);
    assignmentsByTask.set(a.taskId, list);
  }
  const contourMatchCache = new Map<string, ReturnType<typeof matchContoursToAssignments>>();
  const contourOf = (task: Task, a: ResourceAssignment) => {
    if (!task.timephasedContours || task.timephasedContours.length === 0) return undefined;
    let m = contourMatchCache.get(task.id);
    if (!m) {
      m = matchContoursToAssignments(task.timephasedContours, assignmentsByTask.get(task.id) ?? [a]);
      contourMatchCache.set(task.id, m);
    }
    return m.get(a.id);
  };

  let asgnObjId = 1;
  for (const a of assignments) {
    const actObjId = taskObjMap.get(a.taskId);
    const resObjId = resObjMap.get(a.resourceId);
    if (actObjId === undefined || resObjId === undefined) continue;
    const task = taskById.get(a.taskId);
    const contour = task ? contourOf(task, a) : undefined;
    const taskStartIso = task ? (task.time.earlyStart || task.time.scheduleStart) : '';
    const taskFinishIso = task ? (task.time.earlyFinish || task.time.scheduleFinish) : '';
    // Spreidingsstrings (MPXJ `TimephasedHelper.write`): actual/remaining apart, en `PlannedCurve`
    // als de volledige as. Alle drie ankeren op de TAAKSTART, en de bijbehorende ankervelden
    // (`PlannedStartDate`/`RemainingStartDate`/`ActualStartDate`) worden meegeschreven — zonder
    // anker leest P6/MPXJ de spreiding niet.
    const actualPeriods = contour ? contour.periods.filter(p => p.kind === 'actual') : [];
    const remainingPeriods = contour ? contour.periods.filter(p => p.kind === 'remaining') : [];
    const actualSpread = actualPeriods.length > 0 ? contourPeriodsToP6Spread(actualPeriods) : null;
    const remainingSpread = remainingPeriods.length > 0 ? contourPeriodsToP6Spread(remainingPeriods) : null;
    const plannedSpread = contour ? contourPeriodsToP6Spread(contour.periods) : null;
    const anchorIso = taskStartIso ? formatP6DateTime(taskStartIso) : '';
    const curveObjId = curveObjIdByAssignment.get(a.id);

    // Elementvolgorde volgt het PMXML-schema (MPXJ `ResourceAssignmentType` propOrder).
    lines.push(`${indent(1)}<ResourceAssignment>`);
    lines.push(`${indent(2)}<ActivityObjectId>${actObjId}</ActivityObjectId>`);
    if (actualSpread && anchorIso) {
      lines.push(`${indent(2)}<ActualCurve>${escapeXML(actualSpread)}</ActualCurve>`);
      lines.push(`${indent(2)}<ActualStartDate>${anchorIso}</ActualStartDate>`);
    }
    lines.push(`${indent(2)}<ObjectId>${asgnObjId++}</ObjectId>`);
    if (plannedSpread && anchorIso) {
      lines.push(`${indent(2)}<PlannedCurve>${escapeXML(plannedSpread)}</PlannedCurve>`);
      if (taskFinishIso) lines.push(`${indent(2)}<PlannedFinishDate>${formatP6DateTime(taskFinishIso)}</PlannedFinishDate>`);
      lines.push(`${indent(2)}<PlannedStartDate>${anchorIso}</PlannedStartDate>`);
    }
    // PlannedUnitsPerTime: fractie, 1.0 = 100% (L2-fix — zelfde semantiek en MPXJ-bron als
    // MaxUnitsPerTime hierboven; PmxmlUnitsHelper schaalt MPXJ-percentages /100 naar het
    // bestand). Ons `unitsPerDay` is al een fractie, dus 1:1.
    lines.push(`${indent(2)}<PlannedUnitsPerTime>${a.unitsPerDay}</PlannedUnitsPerTime>`);
    if (remainingSpread && anchorIso) {
      lines.push(`${indent(2)}<RemainingCurve>${escapeXML(remainingSpread)}</RemainingCurve>`);
      lines.push(`${indent(2)}<RemainingStartDate>${anchorIso}</RemainingStartDate>`);
    }
    if (curveObjId !== undefined) {
      lines.push(`${indent(2)}<ResourceCurveObjectId>${curveObjId}</ResourceCurveObjectId>`);
    }
    lines.push(`${indent(2)}<ResourceObjectId>${resObjId}</ResourceObjectId>`);
    lines.push(`${indent(1)}</ResourceAssignment>`);
  }

  lines.push('</APIBusinessObjects>');

  return lines.join('\n');
}
