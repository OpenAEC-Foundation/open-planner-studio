import { Task, TaskConstraint, ConstraintType, createDefaultTaskTime } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment, ResourceType } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar, Holiday, WorkTimeBands, createDefaultCalendar } from '@/types/calendar';
import { generateId } from '@/utils/id';
import { formatDate, formatInstant, parseInstant } from '@/utils/dateUtils';
import { normalizeImportedProgress } from '@/services/importNormalize';
import type { ImportResult } from '@/services/importTypes';
import { P6_DAY_NAMES, P6_NAME_TO_CURVE } from './p6xmlWriter';
import {
  canonicalizeBands, clockToMinutes, deriveHoursPerDay, hasNonAnchorTime, isSubDayMinutes, workDaysFromBands,
} from '@/services/subdayIo';

/** Synthetisch anker dat de DAG-schrijver op date-only datetimes plakt (§7.3). */
const P6_TIME_ANCHOR = '08:00:00';

/** Gecanonicaliseerde banden per gelezen kalender + afwijking (a/b), voor de uur-modus-beslissing. */
const p6BandRegistry = new WeakMap<WorkCalendar, { canonical: WorkTimeBands; deviates: boolean }>();

// P6_NAME_TO_CURVE (P6-curvenaam → OPS-curve) wordt nu uit p6xmlWriter geïmporteerd, waar beide
// (bewust asymmetrische) richtingen naast elkaar staan (spiegel van P6_DAY_NAMES-patroon).

// P6 onderscheidt Nonlabor niet verder in Equipment/Subcontractor — invulling §8.1:
// zonder verdere hint komt Nonlabor terug als EQUIPMENT (geaccepteerd verlies, §8.4).
function resourceTypeFromP6(p6Type: string): ResourceType {
  if (p6Type === 'Material') return 'MATERIAL';
  if (p6Type === 'Nonlabor') return 'EQUIPMENT';
  return 'LABOR';
}

function getElementText(parent: Element, tagName: string): string {
  // Look for direct children only to avoid picking up nested elements
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === tagName || child.tagName === tagName) {
      return child.textContent?.trim() || '';
    }
  }
  return '';
}

function getElementInt(parent: Element, tagName: string, fallback = 0): number {
  const text = getElementText(parent, tagName);
  const n = parseInt(text);
  return isNaN(n) ? fallback : n;
}

function getElementFloat(parent: Element, tagName: string, fallback = 0): number {
  const text = getElementText(parent, tagName);
  const n = parseFloat(text);
  return isNaN(n) ? fallback : n;
}

function parseP6Date(s: string): string {
  if (!s) return formatDate(new Date());
  return s.substring(0, 10);
}

function p6TypeToSequenceType(type: string): SequenceType {
  switch (type) {
    case 'PR_FS': return 'FINISH_START';
    case 'PR_FF': return 'FINISH_FINISH';
    case 'PR_SS': return 'START_START';
    case 'PR_SF': return 'START_FINISH';
    default: return 'FINISH_START';
  }
}

function p6HoursToDays(hours: number, hoursPerDay: number): number {
  if (hoursPerDay <= 0) hoursPerDay = 8;
  return Math.round(hours / hoursPerDay);
}

/**
 * Fase 2.9 (§6) — P6 `CS_*`-code → OPS-constraint (spiegel van `p6ConstraintCode` in de writer).
 * De harde `CS_MANDSTART`/`CS_MANDFIN` komen terug als `MSO`/`MFO` mét `hard:true`; de soft-typen
 * als hun OPS-equivalent. Onbekende code ⇒ `undefined` (veld gewoon afwezig, dag-modus-analoog).
 */
function p6CodeToConstraint(code: string): { type: ConstraintType; hard?: boolean } | undefined {
  switch (code) {
    case 'CS_MSO': return { type: 'MSO' };
    case 'CS_MSOA': return { type: 'SNET' };
    case 'CS_MSOB': return { type: 'SNLT' };
    case 'CS_MEO': return { type: 'MFO' };
    case 'CS_MEOA': return { type: 'FNET' };
    case 'CS_MEOB': return { type: 'FNLT' };
    case 'CS_ALAP': return { type: 'ALAP' };
    case 'CS_MANDSTART': return { type: 'MSO', hard: true };
    case 'CS_MANDFIN': return { type: 'MFO', hard: true };
    default: return undefined;
  }
}

/** Werkweek teruglezen (fase 2.8a, §8.3, spiegel van `writeStandardWorkWeek`): per
 *  `<StandardWorkHour>` de dagnaam terugmappen naar een ISO-dagnummer via `P6_DAY_NAMES`; een dag
 *  telt als werkdag zodra hij een `<WorkTime>`-blok heeft. `workStartHour`/`workEndHour` komen van
 *  het LAATST gevonden werktijdblok (één scalar per kalender, bestaande aanname). Golden rule:
 *  geen `<StandardWorkWeek>` (ander tool / oud bestand) ⇒ lege workDays, aanroeper valt terug op
 *  de `createDefaultCalendar()`-defaults. */
function parseP6StandardWorkWeek(calEl: Element): {
  workDays: number[]; workStartHour?: number; workEndHour?: number;
  rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>>;
} {
  const wwEl = calEl.getElementsByTagName('StandardWorkWeek')[0];
  const workDays: number[] = [];
  let workStartHour: number | undefined;
  let workEndHour: number | undefined;
  const rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  if (!wwEl) return { workDays, rawByWeekday };

  for (let i = 0; i < wwEl.children.length; i++) {
    const dayEl = wwEl.children[i];
    if (dayEl.localName !== 'StandardWorkHour' && dayEl.tagName !== 'StandardWorkHour') continue;
    const dayName = getElementText(dayEl, 'DayOfWeek');
    const isoDay = P6_DAY_NAMES.indexOf(dayName); // index == ISO-dagnummer (array begint met '' op 0)
    // Fase 2.8b (§7.2): ALLE <WorkTime>-banden van deze dag lezen (nu las de reader alleen het
    // láátste blok als scalar). Elke band → minuten-vanaf-middernacht.
    const wts = dayEl.getElementsByTagName('WorkTime');
    const dayBands: { start: number; end: number }[] = [];
    for (let k = 0; k < wts.length; k++) {
      const wt = wts[k];
      const s = clockToMinutes(getElementText(wt, 'Start'));
      const e = clockToMinutes(getElementText(wt, 'Finish'));
      if (s == null || e == null) continue;
      dayBands.push({ start: s, end: e });
      // Scalar (laatst gevonden blok, bestaand gedrag) voor het dag-pad.
      workStartHour = Math.floor(s / 60);
      workEndHour = Math.floor(e / 60);
    }
    if (dayBands.length === 0 || isoDay <= 0) continue;
    workDays.push(isoDay);
    rawByWeekday[isoDay as 1] = dayBands;
  }
  return { workDays, workStartHour, workEndHour, rawByWeekday };
}

/** Canonicaliseer de rauwe banden en registreer ze + de afwijking (a/b) op de kalender (§7.2). */
function registerP6Bands(cal: WorkCalendar, rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>>): void {
  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  p6BandRegistry.set(cal, { canonical: bands, deviates });
}

/** Feestdagen/exceptions teruglezen (fase 2.8a, §8.3, spiegel van `writeHolidayOrExceptions`). */
function parseP6HolidayOrExceptions(calEl: Element): Holiday[] {
  const hoEl = calEl.getElementsByTagName('HolidayOrExceptions')[0];
  if (!hoEl) return [];
  const holidays: Holiday[] = [];
  for (let i = 0; i < hoEl.children.length; i++) {
    const hEl = hoEl.children[i];
    if (hEl.localName !== 'HolidayOrException' && hEl.tagName !== 'HolidayOrException') continue;
    const date = getElementText(hEl, 'Date');
    if (!date) continue;
    const name = getElementText(hEl, 'Name') || 'Feestdag';
    const finishDate = getElementText(hEl, 'FinishDate') || date;
    holidays.push({ name, startDate: parseP6Date(date), endDate: parseP6Date(finishDate) });
  }
  return holidays;
}

function getAllByLocalName(doc: Document, localName: string): Element[] {
  const results: Element[] = [];
  const root = doc.documentElement;
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    if (child.localName === localName) {
      results.push(child);
    }
  }
  return results;
}

export function readP6XML(content: string): ImportResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');

  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Invalid XML: ' + parserError.textContent);
  }

  // Parse calendar first for hoursPerDay
  const calendar = parseCalendar(doc);
  const hoursPerDay = calendar.hoursPerDay;

  // Resource-kalenders (fase 2.5, §8.1): elke <Calendar> met Type=Resource, behalve de eerste
  // (die is altijd de projectkalender, zelfde aanname als de bestaande parseCalendar).
  const calElements = getAllByLocalName(doc, 'Calendar');
  const calObjIdToId = new Map<number, string>();
  const resourceCalendars: WorkCalendar[] = [];
  for (let i = 1; i < calElements.length; i++) {
    const calEl = calElements[i];
    if (getElementText(calEl, 'Type') !== 'Resource') continue;
    const objId = getElementInt(calEl, 'ObjectId', -1);
    if (objId < 0) continue;
    const cal = createDefaultCalendar();
    // P6 kent geen regelset-herkomst (verliesmatrix §8.4) — createDefaultCalendar() zet 'm altijd;
    // een uit P6 gelezen kalender is dat niet.
    delete cal.generation;
    cal.id = generateId('rescal');
    cal.name = getElementText(calEl, 'Name') || cal.name;
    const hpd = getElementFloat(calEl, 'HoursPerDay');
    if (hpd > 0) cal.hoursPerDay = hpd; // authoritatief — StandardWorkWeek-uren overschrijven dit niet
    const ww = parseP6StandardWorkWeek(calEl);
    if (ww.workDays.length > 0) cal.workDays = ww.workDays.sort((a, b) => a - b);
    if (ww.workStartHour !== undefined) cal.workStartHour = ww.workStartHour;
    if (ww.workEndHour !== undefined) cal.workEndHour = ww.workEndHour;
    registerP6Bands(cal, ww.rawByWeekday);
    const holidays = parseP6HolidayOrExceptions(calEl);
    if (holidays.length > 0) cal.holidays = holidays;
    calObjIdToId.set(objId, cal.id);
    resourceCalendars.push(cal);
  }

  // Resources (fase 2.5, §8.1)
  const resourceElements = getAllByLocalName(doc, 'Resource');
  const resources: Resource[] = [];
  const resObjIdToId = new Map<number, string>();
  const pendingParents: { resId: string; parentObjId: number }[] = [];

  for (const resEl of resourceElements) {
    const objId = getElementInt(resEl, 'ObjectId', -1);
    if (objId < 0) continue;
    const id = generateId('res');
    resObjIdToId.set(objId, id);

    const name = getElementText(resEl, 'Name') || 'Resource';
    const p6Type = getElementText(resEl, 'ResourceType');
    const maxUnitsPerTime = getElementFloat(resEl, 'MaxUnitsPerTime');
    const calObjId = getElementInt(resEl, 'CalendarObjectId', -1);
    const unitOfMeasure = getElementText(resEl, 'UnitOfMeasureAbbreviation');
    const parentObjId = getElementInt(resEl, 'ParentObjectId', -1);

    const resource: Resource = {
      id,
      name,
      type: resourceTypeFromP6(p6Type),
      description: '',
      // MaxUnitsPerTime is in P6-XML een dimensieloze fractie (1.0 = 100%), geen uren/dag
      // (L2-fix — spiegel van p6xmlWriter, MPXJ-bron aldaar), dus 1:1 overnemen.
      maxUnits: maxUnitsPerTime > 0 ? maxUnitsPerTime : 1,
    };
    if (unitOfMeasure) resource.unitOfMeasure = unitOfMeasure;
    if (calObjId >= 0 && calObjIdToId.has(calObjId)) resource.calendarId = calObjIdToId.get(calObjId);
    resources.push(resource);
    if (parentObjId >= 0) pendingParents.push({ resId: id, parentObjId });
  }
  for (const { resId, parentObjId } of pendingParents) {
    const parentId = resObjIdToId.get(parentObjId);
    if (!parentId) continue;
    const resource = resources.find(r => r.id === resId);
    if (resource) resource.parentId = parentId;
  }

  // ResourceRates (fase 2.5, M4-fix): top-level <ResourceRate>-elementen (siblings van
  // <Resource>, spiegel van p6xmlWriter) — PricePerUnit is het uurtarief. Meerdere rijen
  // per resource (effective-dated staffel, P6-native): de rij met de vroegste EffectiveDate
  // wint als ons ene vlakke `costPerHour` (staffels zijn buiten scope, §1/§8.4).
  const rateElements = getAllByLocalName(doc, 'ResourceRate');
  const earliestRate = new Map<string, { effective: string; price: number }>();
  for (const rateEl of rateElements) {
    const rateResObjId = getElementInt(rateEl, 'ResourceObjectId', -1);
    const resId = resObjIdToId.get(rateResObjId);
    if (!resId) continue;
    const priceText = getElementText(rateEl, 'PricePerUnit');
    const price = parseFloat(priceText);
    if (!priceText || !Number.isFinite(price)) continue;
    const effective = getElementText(rateEl, 'EffectiveDate'); // '' sorteert vóór elke datum
    const current = earliestRate.get(resId);
    if (!current || effective < current.effective) {
      earliestRate.set(resId, { effective, price });
    }
  }
  for (const [resId, rate] of earliestRate) {
    const resource = resources.find(r => r.id === resId);
    if (resource) resource.costPerHour = rate.price;
  }

  // Parse project
  const project = parseProject(doc);

  // Parse WBS elements
  const wbsElements = getAllByLocalName(doc, 'WBS');
  const wbsObjIdToId = new Map<number, string>();
  const wbsTasks: Task[] = [];

  for (const wbsEl of wbsElements) {
    const objId = getElementInt(wbsEl, 'ObjectId', -1);
    if (objId < 0) continue;

    const id = generateId('task');
    wbsObjIdToId.set(objId, id);

    const code = getElementText(wbsEl, 'Code');
    const name = getElementText(wbsEl, 'Name') || 'WBS';

    wbsTasks.push({
      id,
      name,
      description: '',
      wbsCode: code,
      taskType: 'CONSTRUCTION',
      status: 'NOT_STARTED',
      isMilestone: false,
      priority: 500,
      parentId: null, // resolved later
      childIds: [],
      time: createDefaultTaskTime(project.startDate, 0),
      resourceIds: [],
    });
  }

  // Resolve WBS parent-child
  for (const wbsEl of wbsElements) {
    const objId = getElementInt(wbsEl, 'ObjectId', -1);
    const parentObjId = getElementInt(wbsEl, 'ParentObjectId', -1);
    if (parentObjId < 0 || objId < 0) continue;

    const childId = wbsObjIdToId.get(objId);
    const parentId = wbsObjIdToId.get(parentObjId);
    if (childId && parentId) {
      const child = wbsTasks.find(t => t.id === childId);
      const parent = wbsTasks.find(t => t.id === parentId);
      if (child && parent) {
        child.parentId = parentId;
        if (!parent.childIds.includes(childId)) {
          parent.childIds.push(childId);
        }
      }
    }
  }

  // Parse activities
  const activityElements = getAllByLocalName(doc, 'Activity');
  const actObjIdToId = new Map<number, string>();
  const leafTasks: Task[] = [];
  const taskHourById = new Map<string, boolean>(); // taak-id → uur-modus (voor lag-eenheid, §7.2)

  // Fase 2.8b (§7.2): uur-modus-beslissing per kalender (discriminator a/b/c) vóór het bouwen van de
  // taken. `calById` mapt zowel de projectkalender als de bibliotheek-kalenders; `effCalIdOf` geeft
  // per activity de effectieve kalender-id (CalendarObjectId 1/ontbrekend = projectkalender).
  const calById = new Map<string, WorkCalendar>();
  calById.set(calendar.id, calendar);
  for (const c of resourceCalendars) calById.set(c.id, c);
  const effCalIdOf = (calObjId: number): string => (calObjId > 1 && calObjIdToId.get(calObjId)) || calendar.id;

  const cSignalCalIds = new Set<string>();
  for (const actEl of activityElements) {
    const calId = effCalIdOf(getElementInt(actEl, 'CalendarObjectId', 1));
    const cal = calById.get(calId);
    if (!cal) continue;
    const durHours = getElementFloat(actEl, 'PlannedDuration');
    const durSignal = durHours > 0 && isSubDayMinutes(Math.round(durHours * 60), cal.hoursPerDay);
    const dateSignal = hasNonAnchorTime(getElementText(actEl, 'PlannedStartDate'), P6_TIME_ANCHOR)
      || hasNonAnchorTime(getElementText(actEl, 'PlannedFinishDate'), P6_TIME_ANCHOR);
    if (durSignal || dateSignal) cSignalCalIds.add(calId);
  }
  const hourModeCalIds = new Set<string>();
  for (const [id, cal] of calById) {
    const info = p6BandRegistry.get(cal);
    if (!((info?.deviates ?? false) || cSignalCalIds.has(id))) continue;
    hourModeCalIds.add(id);
    if (cal.workTime) continue;
    const bands = info && workDaysFromBands(info.canonical).length > 0 ? info.canonical : synthP6BandsFromScalar(cal);
    cal.workTime = bands;
    const wd = workDaysFromBands(bands);
    if (wd.length > 0) cal.workDays = wd;
    cal.hoursPerDay = deriveHoursPerDay(bands, cal.hoursPerDay);
  }

  for (const actEl of activityElements) {
    const objId = getElementInt(actEl, 'ObjectId', -1);
    if (objId < 0) continue;

    const id = generateId('task');
    actObjIdToId.set(objId, id);

    const actId = getElementText(actEl, 'Id');
    const name = getElementText(actEl, 'Name') || 'Activity';
    const p6Type = getElementText(actEl, 'Type');
    const p6Status = getElementText(actEl, 'Status');
    const plannedDuration = getElementFloat(actEl, 'PlannedDuration');
    const plannedStartRaw = getElementText(actEl, 'PlannedStartDate');
    const plannedFinishRaw = getElementText(actEl, 'PlannedFinishDate');
    const percentComplete = getElementFloat(actEl, 'PhysicalPercentComplete');
    const description = getElementText(actEl, 'Description');
    const wbsObjId = getElementInt(actEl, 'WBSObjectId', -1);
    // Taak-kalender (fase 2.8a, §8.3): effectieve <CalendarObjectId> → task.calendarId. ObjectId 1
    // (of ontbrekend, legacy-bestanden) = projectkalender ⇒ undefined (bestaande conventie).
    const calObjId = getElementInt(actEl, 'CalendarObjectId', 1);
    const taskCalendarId = calObjId > 1 ? calObjIdToId.get(calObjId) : undefined;

    // Fase 2.8b (§7.2): uur- vs dag-modus voor deze taak.
    const effCalId = effCalIdOf(calObjId);
    const isHour = hourModeCalIds.has(effCalId);
    const effHpd = calById.get(effCalId)?.hoursPerDay ?? hoursPerDay;
    // Datum-parser: uur ⇒ echte tijd (`parseInstant`+`formatInstant`), dag ⇒ tijd-strippen.
    const parseP6Instant = (raw: string): string => raw ? formatInstant(parseInstant(raw), 'hour') : parseP6Date(raw);
    const plannedStart = isHour ? parseP6Instant(plannedStartRaw) : parseP6Date(plannedStartRaw);
    const plannedFinish = isHour ? parseP6Instant(plannedFinishRaw) : parseP6Date(plannedFinishRaw);

    // Actuals (fase 2.6, §9.2) — leeg ⇒ undefined (invarianten via normalizeImportedProgress).
    const actualStartRaw = getElementText(actEl, 'ActualStartDate');
    const actualFinishRaw = getElementText(actEl, 'ActualFinishDate');
    const remainingRaw = getElementText(actEl, 'RemainingDuration');
    const actualStart = actualStartRaw ? (isHour ? parseP6Instant(actualStartRaw) : parseP6Date(actualStartRaw)) : undefined;
    const actualFinish = actualFinishRaw ? (isHour ? parseP6Instant(actualFinishRaw) : parseP6Date(actualFinishRaw)) : undefined;
    // RemainingDuration: uur ⇒ minuten (`uren × 60`, geen afronding, §7.2); dag ⇒ het bestaande pad.
    const remainingMinutes = isHour && remainingRaw ? Math.round(parseFloat(remainingRaw) * 60) : undefined;
    const remainingTime = !isHour && remainingRaw ? p6HoursToDays(parseFloat(remainingRaw), hoursPerDay) : undefined;

    // Duur: uur ⇒ minuten (`uren × 60`) als bron van waarheid; dag ⇒ `Math.round(uren/hpd)` (bestaand).
    const durationMinutes = isHour ? Math.round(plannedDuration * 60) : undefined;
    const durationDays = isHour ? (effHpd > 0 ? durationMinutes! / (effHpd * 60) : 0) : p6HoursToDays(plannedDuration, hoursPerDay);
    const isMilestone = p6Type.includes('Milestone');
    // Fase 2.4: P6 onderscheidt Start/Finish Milestone — bewaar de soort expliciet.
    const milestoneKind = !isMilestone ? undefined
      : p6Type.includes('Finish') ? 'FINISH' as const
      : 'START' as const;

    let status: 'NOT_STARTED' | 'STARTED' | 'COMPLETED' = 'NOT_STARTED';
    if (p6Status === 'Completed' || percentComplete >= 100) status = 'COMPLETED';
    else if (p6Status === 'In Progress' || percentComplete > 0) status = 'STARTED';

    const parentId = wbsObjId >= 0 ? wbsObjIdToId.get(wbsObjId) || null : null;

    // Datum-constraints (fase 2.9, §6): primair + secundair uit de `CS_*`-codes. Secundair is altijd
    // soft (P6-invariant) ⇒ `hard` wordt gedropt. Datum: uur ⇒ echte tijd, dag ⇒ tijd-strippen.
    const parseCstrDate = (raw: string): string => isHour ? parseP6Instant(raw) : parseP6Date(raw);
    let constraint: TaskConstraint | undefined;
    const primCode = getElementText(actEl, 'PrimaryConstraintType');
    if (primCode) {
      const mapped = p6CodeToConstraint(primCode);
      if (mapped) {
        const cdateRaw = getElementText(actEl, 'PrimaryConstraintDate');
        constraint = {
          type: mapped.type,
          ...(mapped.hard ? { hard: true } : {}),
          ...(cdateRaw ? { date: parseCstrDate(cdateRaw) } : {}),
        };
      }
    }
    let constraint2: TaskConstraint | undefined;
    const secCode = getElementText(actEl, 'SecondaryConstraintType');
    if (secCode) {
      const mapped2 = p6CodeToConstraint(secCode);
      if (mapped2) {
        const cdate2Raw = getElementText(actEl, 'SecondaryConstraintDate');
        constraint2 = {
          type: mapped2.type,
          ...(cdate2Raw ? { date: parseCstrDate(cdate2Raw) } : {}),
        };
      }
    }

    const task: Task = {
      id,
      name,
      description,
      wbsCode: actId,
      taskType: 'CONSTRUCTION',
      status,
      isMilestone,
      ...(milestoneKind ? { milestoneKind } : {}),
      priority: 500,
      parentId,
      childIds: [],
      ...(constraint ? { constraint } : {}),
      ...(constraint2 ? { constraint2 } : {}),
      time: {
        durationType: 'WORKTIME',
        scheduleDuration: durationDays,
        ...(durationMinutes != null ? { durationMinutes } : {}),
        scheduleStart: plannedStart,
        scheduleFinish: plannedFinish,
        earlyStart: plannedStart,
        earlyFinish: plannedFinish,
        lateStart: plannedStart,
        lateFinish: plannedFinish,
        freeFloat: 0,
        totalFloat: 0,
        isCritical: false,
        actualStart,
        actualFinish,
        remainingTime,
        ...(remainingMinutes != null ? { remainingMinutes } : {}),
        completion: percentComplete / 100,
      },
      resourceIds: [],
      ...(taskCalendarId ? { calendarId: taskCalendarId } : {}),
    };

    leafTasks.push(task);
    taskHourById.set(id, isHour);

    // Add to parent's children
    if (parentId) {
      const parent = wbsTasks.find(t => t.id === parentId);
      if (parent && !parent.childIds.includes(id)) {
        parent.childIds.push(id);
      }
    }
  }

  // Combine tasks: WBS (summary) + leaf activities
  const tasks = [...wbsTasks, ...leafTasks];

  // Voortgang-invarianten op de rauw ingelezen actuals (§3.2/§15.6).
  normalizeImportedProgress(tasks, project.statusDate);

  // Parse relationships
  const relElements = getAllByLocalName(doc, 'Relationship');
  const sequences: Sequence[] = [];

  for (const relEl of relElements) {
    const predObjId = getElementInt(relEl, 'PredecessorActivityObjectId', -1);
    const succObjId = getElementInt(relEl, 'SuccessorActivityObjectId', -1);
    if (predObjId < 0 || succObjId < 0) continue;

    const predId = actObjIdToId.get(predObjId);
    const succId = actObjIdToId.get(succObjId);
    if (!predId || !succId) continue;

    const p6Type = getElementText(relEl, 'Type');
    const lagHours = getElementFloat(relEl, 'Lag');

    // Fase 2.8b (§7.2): een uur-opvolger ⇒ lag minuut-precies (`uren × 60`, geen dag-afronding);
    // anders het bestaande dag-pad.
    const lagHourMode = taskHourById.get(succId) ?? false;
    const seq: Sequence = {
      id: generateId('seq'),
      predecessorId: predId,
      successorId: succId,
      type: p6TypeToSequenceType(p6Type),
      lagDays: lagHourMode ? 0 : p6HoursToDays(lagHours, hoursPerDay),
    };
    if (lagHourMode) seq.lagMinutes = Math.round(lagHours * 60);
    sequences.push(seq);
  }

  // ResourceAssignments (fase 2.5, §8.1)
  const asgnElements = getAllByLocalName(doc, 'ResourceAssignment');
  const assignments: ResourceAssignment[] = [];
  for (const asgnEl of asgnElements) {
    const actObjId = getElementInt(asgnEl, 'ActivityObjectId', -1);
    const resObjId = getElementInt(asgnEl, 'ResourceObjectId', -1);
    if (actObjId < 0 || resObjId < 0) continue;
    const taskId = actObjIdToId.get(actObjId);
    const resourceId = resObjIdToId.get(resObjId);
    if (!taskId || !resourceId) continue;

    const plannedUnitsPerTime = getElementFloat(asgnEl, 'PlannedUnitsPerTime');
    const curveName = getElementText(asgnEl, 'PlannedCurve');
    const curve = P6_NAME_TO_CURVE[curveName];

    assignments.push({
      id: generateId('asgn'),
      taskId,
      resourceId,
      // PlannedUnitsPerTime is een fractie (1.0 = 100%), geen uren/dag (L2-fix,
      // spiegel van p6xmlWriter) — 1:1 overnemen.
      unitsPerDay: plannedUnitsPerTime > 0 ? plannedUnitsPerTime : 1,
      ...(curve && curve !== 'UNIFORM' ? { curve } : {}),
    });
  }

  return {
    project,
    calendar,
    tasks,
    sequences,
    resources,
    assignments,
    resourceCalendars,
  };
}

function parseProject(doc: Document): Project {
  const projElements = getAllByLocalName(doc, 'Project');
  const projEl = projElements[0];

  if (!projEl) {
    return {
      id: generateId('proj'),
      name: 'P6 Import',
      description: '',
      startDate: formatDate(new Date()),
      endDate: '',
      calendarId: 'cal-default',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      author: '',
      company: '',
    };
  }

  const project: Project = {
    id: generateId('proj'),
    name: getElementText(projEl, 'Name') || 'P6 Import',
    description: getElementText(projEl, 'Description'),
    startDate: parseP6Date(getElementText(projEl, 'PlannedStartDate')),
    endDate: parseP6Date(getElementText(projEl, 'MustFinishByDate')),
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: '',
    company: '',
  };
  // Data date (fase 2.6, §9.2) → project.statusDate. Alleen wanneer aanwezig.
  const dataDateRaw = getElementText(projEl, 'DataDate');
  if (dataDateRaw) project.statusDate = parseP6Date(dataDateRaw);
  return project;
}

/** Enkelband-kalender uit de scalar `workStartHour/EndHour` (fallback bij (c)-promotie zonder banden). */
function synthP6BandsFromScalar(cal: WorkCalendar): WorkTimeBands {
  const raw: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  const band = { start: cal.workStartHour * 60, end: cal.workEndHour * 60 };
  for (const wd of cal.workDays) if (wd >= 1 && wd <= 7) raw[wd as 1] = [{ ...band }];
  return canonicalizeBands(raw).bands;
}

function parseCalendar(doc: Document): WorkCalendar {
  const calElements = getAllByLocalName(doc, 'Calendar');
  if (calElements.length === 0) return createDefaultCalendar();

  const calEl = calElements[0];
  const calendar = createDefaultCalendar();
  calendar.name = getElementText(calEl, 'Name') || calendar.name;
  // P6 kent geen regelset-herkomst (verliesmatrix §8.4) — createDefaultCalendar() zet 'm altijd;
  // een uit P6 gelezen kalender is dat niet.
  delete calendar.generation;

  const hpd = getElementFloat(calEl, 'HoursPerDay');
  if (hpd > 0) calendar.hoursPerDay = hpd; // authoritatief — StandardWorkWeek-uren overschrijven dit niet

  // Werkweek + feestdagen (fase 2.8a, §8.3) — golden rule: geen <StandardWorkWeek>/
  // <HolidayOrExceptions> (ander tool / oud bestand) ⇒ createDefaultCalendar()-defaults blijven staan.
  const ww = parseP6StandardWorkWeek(calEl);
  if (ww.workDays.length > 0) calendar.workDays = ww.workDays.sort((a, b) => a - b);
  if (ww.workStartHour !== undefined) calendar.workStartHour = ww.workStartHour;
  if (ww.workEndHour !== undefined) calendar.workEndHour = ww.workEndHour;
  registerP6Bands(calendar, ww.rawByWeekday);

  const holidays = parseP6HolidayOrExceptions(calEl);
  if (holidays.length > 0) calendar.holidays = holidays;

  return calendar;
}
