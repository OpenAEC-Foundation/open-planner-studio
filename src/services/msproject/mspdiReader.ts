import { Task } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar, Holiday, createDefaultCalendar } from '@/types/calendar';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';

function getElementText(parent: Element, tagName: string): string {
  const el = parent.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() || '';
}

function getElementInt(parent: Element, tagName: string, fallback = 0): number {
  const text = getElementText(parent, tagName);
  const n = parseInt(text);
  return isNaN(n) ? fallback : n;
}

function parseMSPDate(s: string): string {
  if (!s) return formatDate(new Date());
  // MS Project format: 2026-03-09T08:00:00
  return s.substring(0, 10);
}

function parseMSPDuration(s: string): number {
  if (!s) return 0;
  // Format: PT40H0M0S or PT8H0M0S
  const hourMatch = s.match(/PT(\d+)H/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1]);
    return Math.round(hours / 8); // default 8h per day
  }
  const dayMatch = s.match(/P(\d+)D/);
  if (dayMatch) return parseInt(dayMatch[1]);
  return 0;
}

function mspTypeToSequenceType(type: number): SequenceType {
  switch (type) {
    case 0: return 'FINISH_FINISH';
    case 1: return 'FINISH_START';
    case 2: return 'START_FINISH';
    case 3: return 'START_START';
    default: return 'FINISH_START';
  }
}

function tenthsOfMinutesToDays(tenths: number, hoursPerDay: number): number {
  // tenths of minutes -> days
  const minutes = tenths / 10;
  const hours = minutes / 60;
  return Math.round(hours / hoursPerDay);
}

export function readMSPDI(content: string): {
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

  const root = doc.documentElement;

  // Parse project
  const project = parseProject(root);
  const calendar = parseCalendar(root);
  const hoursPerDay = calendar.hoursPerDay;

  // Parse tasks
  const taskElements = root.getElementsByTagName('Task');
  const tasks: Task[] = [];
  const uidToId = new Map<number, string>();
  const uidToWbs = new Map<number, string>();
  const pendingLinks: { successorId: string; predUid: number; type: number; lag: number }[] = [];

  for (let i = 0; i < taskElements.length; i++) {
    const te = taskElements[i];
    // Skip if this is nested inside another element (like PredecessorLink)
    if (te.parentElement?.tagName !== 'Tasks') continue;

    const uid = getElementInt(te, 'UID', -1);
    if (uid < 0) continue;

    // Skip project summary task (UID 0)
    const outlineLevel = getElementInt(te, 'OutlineLevel', 1);
    if (uid === 0 && outlineLevel === 0) continue;

    const id = generateId('task');
    uidToId.set(uid, id);

    const name = getElementText(te, 'Name') || 'Task';
    const wbs = getElementText(te, 'WBS') || `${uid}`;
    uidToWbs.set(uid, wbs);
    const durationStr = getElementText(te, 'Duration');
    const duration = parseMSPDuration(durationStr);
    const start = parseMSPDate(getElementText(te, 'Start'));
    const finish = parseMSPDate(getElementText(te, 'Finish'));
    const isMilestone = getElementInt(te, 'Milestone') === 1;
    const percentComplete = getElementInt(te, 'PercentComplete');
    const priority = getElementInt(te, 'Priority', 500);
    const description = getElementText(te, 'Notes');

    let status: 'NOT_STARTED' | 'STARTED' | 'COMPLETED' = 'NOT_STARTED';
    if (percentComplete >= 100) status = 'COMPLETED';
    else if (percentComplete > 0) status = 'STARTED';

    tasks.push({
      id,
      name,
      description,
      wbsCode: wbs,
      taskType: 'CONSTRUCTION',
      status,
      isMilestone,
      priority,
      parentId: null,
      childIds: [],
      time: {
        durationType: 'WORKTIME',
        scheduleDuration: duration,
        scheduleStart: start,
        scheduleFinish: finish,
        earlyStart: start,
        earlyFinish: finish,
        lateStart: start,
        lateFinish: finish,
        freeFloat: 0,
        totalFloat: 0,
        isCritical: false,
        completion: percentComplete / 100,
      },
      resourceIds: [],
    });

    // Parse predecessor links within task element
    const predLinks = te.getElementsByTagName('PredecessorLink');
    for (let j = 0; j < predLinks.length; j++) {
      const pl = predLinks[j];
      const predUid = getElementInt(pl, 'PredecessorUID', -1);
      const linkType = getElementInt(pl, 'Type', 1);
      const linkLag = getElementInt(pl, 'LinkLag', 0);
      if (predUid >= 0) {
        pendingLinks.push({
          successorId: id,
          predUid,
          type: linkType,
          lag: linkLag,
        });
      }
    }
  }

  // Rebuild parent-child hierarchy from WBS codes
  const wbsToId = new Map<string, string>();
  for (const task of tasks) {
    wbsToId.set(task.wbsCode, task.id);
  }

  for (const task of tasks) {
    if (!task.wbsCode || !task.wbsCode.includes('.')) continue;
    const parts = task.wbsCode.split('.');
    parts.pop();
    const parentWbs = parts.join('.');
    const parentId = wbsToId.get(parentWbs);
    if (parentId) {
      task.parentId = parentId;
      const parent = tasks.find(t => t.id === parentId);
      if (parent && !parent.childIds.includes(task.id)) {
        parent.childIds.push(task.id);
      }
    }
  }

  // Resolve sequences
  const sequences: Sequence[] = [];
  for (const link of pendingLinks) {
    const predId = uidToId.get(link.predUid);
    if (!predId) continue;
    sequences.push({
      id: generateId('seq'),
      predecessorId: predId,
      successorId: link.successorId,
      type: mspTypeToSequenceType(link.type),
      lagDays: tenthsOfMinutesToDays(link.lag, hoursPerDay),
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

function parseProject(root: Element): Project {
  return {
    id: generateId('proj'),
    name: getElementText(root, 'Name') || getElementText(root, 'Title') || 'MS Project Import',
    description: '',
    startDate: parseMSPDate(getElementText(root, 'StartDate')),
    endDate: parseMSPDate(getElementText(root, 'FinishDate')),
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: getElementText(root, 'Author'),
    company: getElementText(root, 'Company'),
  };
}

function parseCalendar(root: Element): WorkCalendar {
  const calElements = root.getElementsByTagName('Calendar');
  if (calElements.length === 0) return createDefaultCalendar();

  const cal = calElements[0];
  const calName = getElementText(cal, 'Name') || 'Imported Calendar';
  const calendar = createDefaultCalendar();
  calendar.name = calName;

  // Parse work days from WeekDay elements
  const weekDays = cal.getElementsByTagName('WeekDay');
  const workDays: number[] = [];

  for (let i = 0; i < weekDays.length; i++) {
    const wd = weekDays[i];
    // Only process direct children of WeekDays
    if (wd.parentElement?.tagName !== 'WeekDays') continue;

    const dayType = getElementInt(wd, 'DayType');
    const dayWorking = getElementInt(wd, 'DayWorking');

    if (dayWorking === 1 && dayType >= 1 && dayType <= 7) {
      // Convert MSP day (1=Sun, 2=Mon, ..., 7=Sat) to ISO (1=Mon, ..., 7=Sun)
      const isoDay = dayType === 1 ? 7 : dayType - 1;
      workDays.push(isoDay);
    }
  }

  if (workDays.length > 0) {
    calendar.workDays = workDays.sort((a, b) => a - b);
  }

  // Parse working times for start/end hours
  const workingTimes = cal.getElementsByTagName('WorkingTime');
  if (workingTimes.length > 0) {
    const fromTime = getElementText(workingTimes[0], 'FromTime');
    const toTime = getElementText(workingTimes[0], 'ToTime');
    if (fromTime) {
      const h = parseInt(fromTime.split(':')[0]);
      if (!isNaN(h)) calendar.workStartHour = h;
    }
    if (toTime) {
      const h = parseInt(toTime.split(':')[0]);
      if (!isNaN(h)) calendar.workEndHour = h;
    }
    calendar.hoursPerDay = calendar.workEndHour - calendar.workStartHour;
    if (calendar.hoursPerDay <= 0) calendar.hoursPerDay = 8;
  }

  // Parse exceptions (holidays)
  const exceptions = cal.getElementsByTagName('Exception');
  const holidays: Holiday[] = [];
  for (let i = 0; i < exceptions.length; i++) {
    const exc = exceptions[i];
    const dayWorking = getElementInt(exc, 'DayWorking');
    if (dayWorking === 0) {
      const name = getElementText(exc, 'Name') || 'Holiday';
      const timePeriods = exc.getElementsByTagName('TimePeriod');
      if (timePeriods.length > 0) {
        const fromDate = parseMSPDate(getElementText(timePeriods[0], 'FromDate'));
        const toDate = parseMSPDate(getElementText(timePeriods[0], 'ToDate'));
        holidays.push({ name, startDate: fromDate, endDate: toDate });
      }
    }
  }
  if (holidays.length > 0) {
    calendar.holidays = holidays;
  }

  // Parse minutes per day from project level
  const minutesPerDay = getElementInt(root, 'MinutesPerDay');
  if (minutesPerDay > 0) {
    calendar.hoursPerDay = minutesPerDay / 60;
  }

  return calendar;
}
