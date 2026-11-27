import { createDefaultCalendar, DEFAULT_CALENDAR_ID } from '@/engine/calendar/defaultCalendar';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { emptyMissingScheduleDates, resolveMissingScheduleDates } from '@/services/importDates';
import { reconstructResourceIds } from '@/services/importNormalize';
import { generateId } from '@/utils/id';
import type { TaskElementLinks } from '../foreign/elementLinks';
import { MINUTE_MODEL_TIME_MODEL } from '../ifcConstants';
import { DOCUMENT_FIELDS, emptyProject, type DocumentReadTarget } from './fields/documentFields';
import { emptyStructure } from './fields/structureFields';
import type { IfcxImportResult } from './ifcxReader';
import type { NodeKind } from './nodes';
import { ATTRIBUTE } from './profile';
import { uuidOfSourcePath } from './pathUuid';
import { invalidField, readPlanningSource, type ForeignPlanningLoss } from './foreignPlanningSource';
import {
  PlanningIdentities, readAssignment, readBaseline, readCalendar, readResources, readSequence, sharedMoment, supplied,
} from './foreignPlanningObjects';
import { readTasks } from './foreignPlanningTasks';

export interface ForeignIfcxPlanning {
  planning: IfcxImportResult;
  paths: Readonly<Record<NodeKind, ReadonlyMap<string, string>>>;
  elementLinks: TaskElementLinks;
  baselineStarts: ReadonlyMap<string, string>;
  planningContent: 'known' | 'unknown-only' | 'none';
  leftBehind: ForeignPlanningLoss;
  origin: { author?: string; id?: string; hasOpsDocument: boolean };
  convertedToManual: number;
}

export function readForeignIfcxPlanning(input: string | Uint8Array): ForeignIfcxPlanning {
  const { header, nodes, leftBehind, planningContent } = readPlanningSource(input);
  const of = (attribute: string) => nodes.filter(node => node.attributes.has(attribute));
  const ids = new PlanningIdentities();
  const [workplan, ...otherPlans] = of(ATTRIBUTE.workplan);
  leftBehind.workplans = otherPlans.map(node => node.path);
  const shared = workplan?.attributes.get(ATTRIBUTE.workplan);
  const ops = workplan?.attributes.get(ATTRIBUTE.document);
  const project = emptyProject();
  const document: DocumentReadTarget = {
    project, projectPath: '', calendarPath: '', structure: emptyStructure(), literalCalendarPaths: [],
    minuteModelPending: false, importPristine: false, removedTasks: {}, comparedBaselinePaths: [],
  };
  if (ops) supplied(DOCUMENT_FIELDS, ops, document);
  if (shared) {
    supplied(DOCUMENT_FIELDS, shared, document);
    project.startDate = sharedMoment(shared.start, project.startDate);
    project.endDate = sharedMoment(shared.finish, project.endDate);
  }
  for (const key of ['author', 'id']) {
    if (header[key] !== undefined && typeof header[key] !== 'string') invalidField({ field: 'header.' + key }, 'Verwacht tekst');
  }
  const headerId = header.id as string | undefined;
  project.id = workplan ? ids.add('workplan', workplan.path, ops?.projectId as string | undefined)
    : headerId ? uuidOfSourcePath(headerId) : generateId('proj');
  const schedule = of(ATTRIBUTE.schedule).find(node => node.attributes.get(ATTRIBUTE.schedule)?.workplan === workplan?.path);
  if (schedule) ids.add('schedule', schedule.path, project.id);

  const calendarNodes = of(ATTRIBUTE.calendar);
  const calendarPath = document.calendarPath || calendarNodes[0]?.path;
  const defaults = createDefaultCalendar();
  if (calendarPath) ids.add('calendar', calendarPath, DEFAULT_CALENDAR_ID);
  const calendars = calendarNodes.map(node => readCalendar(node, node.path === calendarPath, defaults, ids));
  const calendar = calendars.find(cal => cal.id === DEFAULT_CALENDAR_ID) ?? defaults;
  if (document.calendarPath && !calendarNodes.some(node => node.path === calendarPath)) {
    invalidField({ path: workplan.path, attribute: ATTRIBUTE.workplan, field: 'calendar' }, 'Projectkalender ontbreekt');
  }
  project.calendarId = calendar.id;
  const resourceCalendars = calendars.filter(cal => cal !== calendar);
  const { tasks, recordedFields, elementLinks, convertedToManual } = readTasks(of(ATTRIBUTE.activity), ids, calendar, resourceCalendars);
  const missing = emptyMissingScheduleDates();
  for (const task of tasks) {
    if (!task.time.scheduleStart) missing.start.add(task.id);
    if (!task.time.scheduleFinish) missing.finish.add(task.id);
  }
  const anchor = resolveMissingScheduleDates(tasks, missing, project.startDate, task => resolveCalendar(task.calendarId, resourceCalendars, calendar));
  if (!project.startDate) project.startDate = anchor;
  for (const task of tasks) {
    const time = task.time;
    if (missing.start.has(task.id) && !time.scheduleStart.includes('T')) {
      const inferred = time.scheduleStart;
      time.scheduleStart = inferred + 'T00:00';
      if (time.earlyStart === inferred) time.earlyStart = time.scheduleStart;
      if (time.lateStart === inferred) time.lateStart = time.scheduleStart;
    }
    if (missing.finish.has(task.id) && !time.scheduleFinish.includes('T')) {
      const inferred = time.scheduleFinish;
      time.scheduleFinish = inferred ? inferred + 'T00:00' : time.scheduleStart;
      if (time.earlyFinish === inferred) time.earlyFinish = time.scheduleFinish;
      if (time.lateFinish === inferred) time.lateFinish = time.scheduleFinish;
    }
  }

  const sequences = of(ATTRIBUTE.sequence).map(node => readSequence(node, ids));
  const resources = readResources(of(ATTRIBUTE.resource), ids);
  const assignments = of(ATTRIBUTE.assignment).map(node => readAssignment(node, ids));
  reconstructResourceIds(tasks, assignments);
  const baselineStarts = new Map<string, string>();
  const baselines = of(ATTRIBUTE.baseline).map(node => readBaseline(node, ids, baselineStarts, document.removedTasks));
  const baselineId = (path: string | undefined, field: string) =>
    path === undefined ? null : ids.reference('baseline', path, workplan, ATTRIBUTE.document, field);
  const [first, second] = document.comparedBaselinePaths;
  return {
    planning: {
      project, calendar, resourceCalendars, tasks, sequences, resources, assignments, baselines,
      ...document.structure, timeModel: MINUTE_MODEL_TIME_MODEL, recordedFields,
      recordedTimesOrigin: ops ? 'ifc-own' : 'ifc', ifcGlobalIds: ids.globalIds,
      ...(ops ? { importPristine: document.importPristine, recordedSourceFormat: document.recordedSourceFormat ?? 'ifc' } : {}),
      activeBaselineId: baselineId(document.activeBaselinePath, 'activeBaseline'),
      comparedBaselineIds: [baselineId(first, 'comparedBaselines.1'), baselineId(second, 'comparedBaselines.2')],
      ...(Object.keys(document.removedTasks).length ? { baselineOrphanGuids: document.removedTasks } : {}),
      ...(document.literalCalendarPaths.length ? { ifcLiteralCalendarIds: document.literalCalendarPaths.map(path =>
        ids.reference('calendar', path, workplan, ATTRIBUTE.document, 'literalCalendars')) } : {}),
    },
    paths: ids.paths, elementLinks, baselineStarts, planningContent, leftBehind, convertedToManual,
    origin: { ...(typeof header.author === 'string' ? { author: header.author } : {}), ...(headerId !== undefined ? { id: headerId } : {}),
      hasOpsDocument: ops !== undefined },
  };
}
