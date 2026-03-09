import { Task, createDefaultTaskTime } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar, createDefaultCalendar } from '@/types/calendar';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';

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
      priority: 0,
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

    const durationDays = p6HoursToDays(plannedDuration, hoursPerDay);
    const isMilestone = p6Type.includes('Milestone');

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
      priority: 0,
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
        completion: percentComplete / 100,
      },
      resourceIds: [],
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

  return {
    project,
    calendar,
    tasks,
    sequences,
    resources: [],
    assignments: [],
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

  return {
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
}

function parseCalendar(doc: Document): WorkCalendar {
  const calElements = getAllByLocalName(doc, 'Calendar');
  if (calElements.length === 0) return createDefaultCalendar();

  const calEl = calElements[0];
  const calendar = createDefaultCalendar();
  calendar.name = getElementText(calEl, 'Name') || calendar.name;

  const hpd = getElementFloat(calEl, 'HoursPerDay');
  if (hpd > 0) calendar.hoursPerDay = hpd;

  return calendar;
}
