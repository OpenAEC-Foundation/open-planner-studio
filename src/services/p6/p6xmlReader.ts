import { Task, createDefaultTaskTime } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment, ResourceType, ResourceCurve } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar, Holiday, createDefaultCalendar } from '@/types/calendar';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';
import { normalizeImportedProgress } from '@/services/importNormalize';
import { P6_DAY_NAMES } from './p6xmlWriter';

// Omgekeerde curve-/contour-naammapping (spiegel van p6xmlWriter's P6_CURVE_TO_NAME, §8.3).
const P6_NAME_TO_CURVE: Record<string, ResourceCurve> = {
  'Linear': 'UNIFORM',
  'Front Loaded': 'FRONT_LOADED',
  'Back Loaded': 'BACK_LOADED',
  'Bell Shaped': 'BELL',
  'Early Peak': 'EARLY_PEAK',
};

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

/** Werkweek teruglezen (fase 2.8a, §8.3, spiegel van `writeStandardWorkWeek`): per
 *  `<StandardWorkHour>` de dagnaam terugmappen naar een ISO-dagnummer via `P6_DAY_NAMES`; een dag
 *  telt als werkdag zodra hij een `<WorkTime>`-blok heeft. `workStartHour`/`workEndHour` komen van
 *  het LAATST gevonden werktijdblok (één scalar per kalender, bestaande aanname). Golden rule:
 *  geen `<StandardWorkWeek>` (ander tool / oud bestand) ⇒ lege workDays, aanroeper valt terug op
 *  de `createDefaultCalendar()`-defaults. */
function parseP6StandardWorkWeek(calEl: Element): { workDays: number[]; workStartHour?: number; workEndHour?: number } {
  const wwEl = calEl.getElementsByTagName('StandardWorkWeek')[0];
  const workDays: number[] = [];
  let workStartHour: number | undefined;
  let workEndHour: number | undefined;
  if (!wwEl) return { workDays };

  for (let i = 0; i < wwEl.children.length; i++) {
    const dayEl = wwEl.children[i];
    if (dayEl.localName !== 'StandardWorkHour' && dayEl.tagName !== 'StandardWorkHour') continue;
    const dayName = getElementText(dayEl, 'DayOfWeek');
    const isoDay = P6_DAY_NAMES.indexOf(dayName); // index == ISO-dagnummer (array begint met '' op 0)
    const wt = dayEl.getElementsByTagName('WorkTime')[0];
    if (!wt || isoDay <= 0) continue;
    workDays.push(isoDay);
    const start = getElementText(wt, 'Start');
    const finish = getElementText(wt, 'Finish');
    const startHour = parseInt(start.split(':')[0], 10);
    const finishHour = parseInt(finish.split(':')[0], 10);
    if (Number.isFinite(startHour)) workStartHour = startHour;
    if (Number.isFinite(finishHour)) workEndHour = finishHour;
  }
  return { workDays, workStartHour, workEndHour };
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

export function readP6XML(content: string): {
  project: Project;
  calendar: WorkCalendar;
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  resourceCalendars: WorkCalendar[];
} {
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
    const plannedStart = parseP6Date(getElementText(actEl, 'PlannedStartDate'));
    const plannedFinish = parseP6Date(getElementText(actEl, 'PlannedFinishDate'));
    const percentComplete = getElementFloat(actEl, 'PhysicalPercentComplete');
    const description = getElementText(actEl, 'Description');
    const wbsObjId = getElementInt(actEl, 'WBSObjectId', -1);
    // Taak-kalender (fase 2.8a, §8.3): effectieve <CalendarObjectId> → task.calendarId. ObjectId 1
    // (of ontbrekend, legacy-bestanden) = projectkalender ⇒ undefined (bestaande conventie).
    const calObjId = getElementInt(actEl, 'CalendarObjectId', 1);
    const taskCalendarId = calObjId > 1 ? calObjIdToId.get(calObjId) : undefined;

    // Actuals (fase 2.6, §9.2) — leeg ⇒ undefined (invarianten via normalizeImportedProgress).
    const actualStartRaw = getElementText(actEl, 'ActualStartDate');
    const actualFinishRaw = getElementText(actEl, 'ActualFinishDate');
    const remainingRaw = getElementText(actEl, 'RemainingDuration');
    const actualStart = actualStartRaw ? parseP6Date(actualStartRaw) : undefined;
    const actualFinish = actualFinishRaw ? parseP6Date(actualFinishRaw) : undefined;
    const remainingTime = remainingRaw ? p6HoursToDays(parseFloat(remainingRaw), hoursPerDay) : undefined;

    const durationDays = p6HoursToDays(plannedDuration, hoursPerDay);
    const isMilestone = p6Type.includes('Milestone');
    // Fase 2.4: P6 onderscheidt Start/Finish Milestone — bewaar de soort expliciet.
    const milestoneKind = !isMilestone ? undefined
      : p6Type.includes('Finish') ? 'FINISH' as const
      : 'START' as const;

    let status: 'NOT_STARTED' | 'STARTED' | 'COMPLETED' = 'NOT_STARTED';
    if (p6Status === 'Completed' || percentComplete >= 100) status = 'COMPLETED';
    else if (p6Status === 'In Progress' || percentComplete > 0) status = 'STARTED';

    const parentId = wbsObjId >= 0 ? wbsObjIdToId.get(wbsObjId) || null : null;

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
      time: {
        durationType: 'WORKTIME',
        scheduleDuration: durationDays,
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
        completion: percentComplete / 100,
      },
      resourceIds: [],
      ...(taskCalendarId ? { calendarId: taskCalendarId } : {}),
    };

    leafTasks.push(task);

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

    sequences.push({
      id: generateId('seq'),
      predecessorId: predId,
      successorId: succId,
      type: p6TypeToSequenceType(p6Type),
      lagDays: p6HoursToDays(lagHours, hoursPerDay),
    });
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

  const holidays = parseP6HolidayOrExceptions(calEl);
  if (holidays.length > 0) calendar.holidays = holidays;

  return calendar;
}
