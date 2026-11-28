// Bron: MPXJ `XmlProjectReader`, `XmlProjectWriter` en `DurationTypeHelper` als referentie voor percentages en labels (LGPL-2.1, github.com/joniles/mpxj).
import { nameWithProjectCode } from '@/utils/projectCodeName';
import { P6XmlImportError } from './p6xmlErrors';
import { p6ConstraintFromCodeOrLabel } from './p6ConstraintTypes';
import { Task, TaskConstraint, ConstraintType } from '@/types/task';
import type { P6ActivityType, P6CompletePctType, P6DurationType } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { effHoursPerDay } from '@/utils/taskDuration';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment, ResourceType, ResourceCurve } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar, Holiday, WorkingException } from '@/types/calendar';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { parseInstant, localTodayIso, parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';
import { UNNAMED_HOLIDAY_NAME, UNNAMED_WORKING_EXCEPTION_NAME } from '@/services/calendarRecurrence';
import {
  OPS_DAY_MEASURE_DURATIONS_NAME, OPS_DAY_MEASURE_LAGS_NAME, OPS_EXACT_MINUTES_NAME, OPS_LAG_CALENDAR_NAME,
  dayMeasureMinutesPerDay, lagFromRecord, lagRecordHolds, lagRecordKey, lagWorkMinutesPerDay,
  parseFieldRecords, parseLagCalendarOption, parseLagRecords, readMeasure, type LagRecord,
} from '@/services/xmlDayMeasure';
import { normalizeImportedProgress, deriveImportedWorkRules, reconstructResourceIds } from '@/services/importNormalize';
import { flattenOrder } from '@/utils/wbs';
import { emptyMissingScheduleDates, isoDatePrefixOrToday, parseImportedInstant, resolveMissingScheduleDates } from '@/services/importDates';
import { childElementNames, childElements, directChildText, startsWithNames, toInt, toFloat } from '@/services/xmlDom';
import type { ImportResult, OpenedImport, P6XmlEmptyReason, P6XmlImportReport } from '@/services/importTypes';
import type { Baseline } from '@/types/baseline';
import { baselineTasksFromSource } from '@/services/importBaselines';
import type { CustomTaskTypeDraft } from '@/types/taskType';
import { withTaskTypeColors } from '@/services/taskTypes/customTaskTypeColors';
import type { TaskTimephasedContour } from '@/types/task';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { deriveP6XmlScheduleOptions, P6XML_PROFILE_ID } from './p6xmlScheduleOptions';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { calendarForEngine, seedScalarBands } from '@/utils/effectiveWorkTime';
import { isFlatCurveValues, matchCurveValues, normalizeCurveValues } from '@/engine/contour/contourEngine';
import { attachContours, axisOffsetMinutes, collectContour, p6SpreadToContourPeriods } from '@/services/contourIo';
import { importedAssignmentRate, importedWorkFields, workRuleFromXerDurationType } from '@/engine/work/workRuleMapping';
import { DEFAULT_WORK_RULE } from '@/types/workRule';
import { taskWorkMinutes } from '@/engine/contour/contourEngine';
import { buildRecordedTime, recordedFloatDays, type RecordedTime } from '@/engine/scheduler/recordedDates';
import {
  OPS_CUSTOM_TASK_TYPE_UDF_TITLE,
  P6_DAY_NAMES,
  OPS_DESCRIPTION_TOPIC_NAME,
  P6_LINK_TYPE,
  P6_NAME_TO_CURVE,
  isOpsInternalProjectId,
  isLegacyOpsProjectId,
} from './p6xmlWriter';
import { invertRecord } from '@/utils/collections';
import {
  decodeCustomTaskType, isTaskDurationUnit, OPS_DURATION_UNIT_NAME, OPS_LITERAL_CALENDARS_NAME, parseLiteralCalendars,
  statusDateFromXml, xmlTaskDate, xmlTimeRule, xmlTimeSignal, type XmlTimeRule,
} from '@/services/xmlInterchange';
import {
  canonicalizeBands, clockToMinutes, isSubDayMinutes, opsDayWithBreak,
  promoteHourCalendars, registerCalendarBands, sameBlocks, sixDecimalHoursToMinutes,
} from '@/services/subdayIo';

function resourceTypeFromP6(p6Type: string): ResourceType {
  if (p6Type === 'Material') return 'MATERIAL';
  if (p6Type === 'Nonlabor') return 'EQUIPMENT';
  return 'LABOR';
}

function getElementText(parent: Element, tagName: string): string {
  return directChildText(parent, tagName);
}

function getElementInt(parent: Element, tagName: string, fallback = 0): number {
  return toInt(getElementText(parent, tagName), fallback);
}

function getElementFloat(parent: Element, tagName: string, fallback = 0): number {
  return toFloat(getElementText(parent, tagName), fallback);
}

function parseP6Date(s: string): string {
  return isoDatePrefixOrToday(s);
}

function p6PercentToPercent(raw: number, legacyOpsPercent: boolean): number {
  if (legacyOpsPercent || raw > 1) return raw;
  return raw * 100;
}

const P6_XML_PERCENT_TYPE: Readonly<Record<string, P6CompletePctType>> = {
  Physical: 'CP_Phys',
  Duration: 'CP_Drtn',
  Units: 'CP_Units',
  Scope: 'CP_Drtn',
};

const P6_XML_ACTIVITY_TYPE: Readonly<Record<string, P6ActivityType>> = {
  'Task Dependent': 'TT_Task',
  'Resource Dependent': 'TT_Rsrc',
  'Level of Effort': 'TT_LOE',
  'Start Milestone': 'TT_Mile',
  'Finish Milestone': 'TT_FinMile',
  'WBS Summary': 'TT_WBS',
};

function optionalFloat(parent: Element, tagName: string): number | null {
  const raw = getElementText(parent, tagName).trim();
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function p6ActivityCompletionPercent(actEl: Element, writtenByOps: boolean): number {
  const status = writtenByOps ? '' : getElementText(actEl, 'Status').trim();
  if (status === 'Completed') return 100;
  if (status === 'Not Started') return 0;
  const label = getElementText(actEl, 'PercentCompleteType').trim();
  const legacyOpsPercent = writtenByOps && !label;
  const type: P6CompletePctType = label ? P6_XML_PERCENT_TYPE[label] ?? 'CP_Drtn' : 'CP_Phys';
  if (label && !P6_XML_PERCENT_TYPE[label]) {
    console.warn(`P6-XML-import: onbekende <PercentCompleteType>-waarde '${label}' — Duration aangenomen.`);
  }
  const pct = (tag: string): number | null => {
    const raw = optionalFloat(actEl, tag);
    return raw == null ? null : p6PercentToPercent(raw, legacyOpsPercent);
  };
  if (type === 'CP_Phys') return pct('PhysicalPercentComplete') ?? 0;
  if (type === 'CP_Units') return pct('UnitsPercentComplete') ?? 0;
  const scope = label === 'Scope' ? pct('ScopePercentComplete') : null;
  if (scope != null) return scope;
  const duration = pct('DurationPercentComplete');
  if (duration != null) return duration;
  const remaining = optionalFloat(actEl, 'RemainingDuration');
  const planned = optionalFloat(actEl, 'PlannedDuration');
  return remaining != null && planned != null && planned > 0
    ? Math.max(0, Math.min(100, (1 - remaining / planned) * 100))
    : 0;
}

const P6_LEGACY_SEQUENCE_TYPE: Readonly<Record<string, SequenceType>> = {
  PR_FS: 'FINISH_START',
  PR_FF: 'FINISH_FINISH',
  PR_SS: 'START_START',
  PR_SF: 'START_FINISH',
};

const SEQUENCE_TYPE_BY_P6: Partial<Record<string, SequenceType>> = {
  ...P6_LEGACY_SEQUENCE_TYPE,
  ...invertRecord(P6_LINK_TYPE),
};

const P6_DURATION_FIELDS = { duration: 'PlannedDuration', remaining: 'RemainingDuration' } as const;

function p6ConstraintFromXml(raw: string, tag: string): { type: ConstraintType; hard?: boolean } | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  const known = p6ConstraintFromCodeOrLabel(value);
  if (known) return known;
  console.warn(`P6-XML-import: onbekende <${tag}>-waarde '${value}' — constraint blijft afwezig.`);
  return undefined;
}

const P6_XML_DURATION_TYPE_BY_LABEL: Readonly<Record<string, P6DurationType>> = {
  'Fixed Duration and Units': 'DT_FixedDUR2',
  'Fixed Duration and Units/Time': 'DT_FixedDrtn',
  'Fixed Units/Time': 'DT_FixedRate',
  'Fixed Units': 'DT_FixedQty',
};

function p6DurationTypeFromXml(raw: string): P6DurationType | undefined {
  const label = raw.trim();
  if (!label) return undefined;
  const known = P6_XML_DURATION_TYPE_BY_LABEL[label];
  if (known) return known;
  console.warn(`P6-XML-import: onbekende <DurationType>-waarde '${label}' — p6DurationType blijft afwezig.`);
  return undefined;
}

export function parseP6StandardWorkWeek(calEl: Element, alwaysLastMinute = false): {
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
    if (dayEl.localName !== 'StandardWorkHours' && dayEl.localName !== 'StandardWorkHour') continue;
    const dayName = getElementText(dayEl, 'DayOfWeek');
    const isoDay = P6_DAY_NAMES.indexOf(dayName);
    const wts = dayEl.getElementsByTagName('WorkTime');
    const dayBands: { start: number; end: number }[] = [];
    for (let k = 0; k < wts.length; k++) {
      const wt = wts[k];
      const s = clockToMinutes(getElementText(wt, 'Start'));
      const e = p6FinishClockToMinutes(getElementText(wt, 'Finish'), alwaysLastMinute);
      if (s == null || e == null) continue;
      dayBands.push({ start: s, end: e });
    }
    if (dayBands.length === 0 || isoDay <= 0) continue;
    workStartHour = Math.floor(dayBands[0].start / 60);
    workEndHour = Math.floor(dayBands[dayBands.length - 1].end / 60);
    workDays.push(isoDay);
    rawByWeekday[isoDay as 1] = dayBands;
  }
  return { workDays, workStartHour, workEndHour, rawByWeekday };
}

function registerP6Bands(
  cal: WorkCalendar,
  rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>>,
  writtenByOps: boolean,
  fileHoursPerDay: number,
): void {
  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  const dayWithBreak = writtenByOps ? opsDayWithBreak(bands) : undefined;
  const netHours = dayWithBreak
    ? ((dayWithBreak[0].end - dayWithBreak[0].start) + (dayWithBreak[1].end - dayWithBreak[1].start)) / 60
    : undefined;
  const keepDay = dayWithBreak !== undefined && netHours !== undefined
    && (fileHoursPerDay <= 0 || Math.abs(fileHoursPerDay - netHours) < 1e-9);
  if (keepDay) {
    const [first, second] = dayWithBreak;
    cal.workStartHour = first.start / 60;
    cal.workEndHour = second.end / 60;
    cal.hoursPerDay = netHours;
    if (!sameBlocks(seedScalarBands(first.start, second.end, netHours), dayWithBreak)) {
      cal.simpleBreakStartMinute = first.end;
      cal.simpleBreakDurationMinutes = second.start - first.end;
    }
  }
  registerCalendarBands(cal, { canonical: bands, deviates: deviates && !keepDay });
}

function parseP6HolidayOrExceptions(calEl: Element, alwaysLastMinute = false): { holidays: Holiday[]; workingExceptions: WorkingException[] } {
  const holidays: Holiday[] = [];
  const workingExceptions: WorkingException[] = [];
  const hoEl = calEl.getElementsByTagName('HolidayOrExceptions')[0];
  if (!hoEl) return { holidays, workingExceptions };
  for (let i = 0; i < hoEl.children.length; i++) {
    const hEl = hoEl.children[i];
    if (hEl.localName !== 'HolidayOrException' && hEl.tagName !== 'HolidayOrException') continue;
    const date = getElementText(hEl, 'Date');
    if (!date) continue;
    const finishDate = getElementText(hEl, 'FinishDate') || date;
    const startDate = parseP6Date(date);
    const endDate = parseP6Date(finishDate);
    const bands: { start: number; end: number }[] = [];
    for (const wt of childElements(hEl, 'WorkTime')) {
      const s = clockToMinutes(getElementText(wt, 'Start'));
      const e = p6FinishClockToMinutes(getElementText(wt, 'Finish'), alwaysLastMinute);
      if (s == null || e == null) continue;
      bands.push({ start: s, end: e <= s ? e + 1440 : e });
    }
    const wholeDayOff = bands.length === 1 && bands[0].start === 0 && bands[0].end === 1440;
    if (bands.length === 0 || wholeDayOff) {
      holidays.push({ name: getElementText(hEl, 'Name') || UNNAMED_HOLIDAY_NAME, startDate, endDate });
    } else {
      bands.sort((a, b) => a.start - b.start);
      for (let k = bands.length - 1; k > 0; k--) {
        if (bands[k].start <= bands[k - 1].end) {
          bands[k - 1] = { start: bands[k - 1].start, end: Math.max(bands[k - 1].end, bands[k].end) };
          bands.splice(k, 1);
        }
      }
      workingExceptions.push({ name: getElementText(hEl, 'Name') || UNNAMED_WORKING_EXCEPTION_NAME, startDate, endDate, bands });
    }
  }
  return { holidays, workingExceptions };
}

function p6FinishClockToMinutes(clock: string, lastMinute = false): number | null {
  const minutes = clockToMinutes(clock);
  if (minutes == null) return null;
  return lastMinute || minutes === 1439 ? minutes + 1 : minutes;
}

export function p6FinishUsesLastMinute(root: Element, writtenByOps: boolean): boolean {
  if (writtenByOps && root.getElementsByTagName('StandardWorkHours').length > 0) return true;
  const finishes = root.getElementsByTagName('Finish');
  for (let i = 0; i < finishes.length; i++) {
    const el = finishes[i];
    if (el.parentElement?.localName !== 'WorkTime') continue;
    const minutes = clockToMinutes(el.textContent?.trim() ?? '');
    if (minutes == null || minutes === 1439) continue;
    if (minutes % 5 !== 0) return true;
  }
  return false;
}

function mergeConsecutiveDays<T extends { name: string; startDate: string; endDate: string; bands?: { start: number; end: number }[] }>(items: readonly T[]): T[] {
  const sorted = [...items].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const out: T[] = [];
  for (const item of sorted) {
    const last = out[out.length - 1];
    const lastEnd = last ? last.endDate || last.startDate : '';
    if (last && last.name === item.name && JSON.stringify(last.bands) === JSON.stringify(item.bands)
      && formatDate(addCalendarDays(parseDate(lastEnd), 1)) === item.startDate) {
      out[out.length - 1] = { ...last, endDate: item.endDate || item.startDate };
    } else {
      out.push({ ...item });
    }
  }
  return out;
}

const LEGACY_OPS_PROJECT_FIELDS = ['ObjectId', 'Id', 'Name', 'Description', 'PlannedStartDate', 'MustFinishByDate', 'Status', 'DataDate'];

export function isLegacyOpsP6Xml(root: Element): boolean {
  if (root.localName !== 'APIBusinessObjects') return false;
  const projects = childElements(root, 'Project');
  if (projects.length !== 1 || directChildText(projects[0], 'ObjectId') !== '1') return false;
  const fields = childElementNames(projects[0]);
  let next = 0;
  for (const field of fields) {
    next = LEGACY_OPS_PROJECT_FIELDS.indexOf(field, next);
    if (next < 0) return false;
    next++;
  }
  if (!startsWithNames(fields, ['ObjectId', 'Id', 'Name'])
    || !['Description', 'PlannedStartDate', 'Status'].every(field => fields.includes(field))) return false;
  return childElements(root, 'Activity').every(act => directChildText(act, 'ProjectObjectId') === '1'
    && startsWithNames(childElementNames(act), ['ObjectId', 'Id', 'Name', 'ProjectObjectId']));
}

interface P6XmlScope {
  root: Element;
  project: Element | null;
  projectObjectId: number | null;
  ownsUnassigned: boolean;
}

const PROJECT_OBJECT_TAGS = new Set(['WBS', 'Activity', 'Relationship', 'ResourceAssignment', 'ActivityNote', 'UDFValue']);

function scopedElements(scope: P6XmlScope, localName: string): Element[] {
  const results: Element[] = [];
  for (const el of childElements(scope.root, localName)) {
    const owner = getElementInt(el, 'ProjectObjectId', -1);
    if (owner >= 0 && scope.projectObjectId != null && owner !== scope.projectObjectId) continue;
    if (owner < 0 && !scope.ownsUnassigned && PROJECT_OBJECT_TAGS.has(localName)) continue;
    results.push(el);
  }
  if (scope.project) results.push(...childElements(scope.project, localName));
  return results;
}

function scopeOf(root: Element, project: Element | null): P6XmlScope {
  const objId = project ? getElementInt(project, 'ObjectId', -1) : -1;
  const ownsUnassigned = !project
    || (project.localName === 'Project' && childElements(root, 'Project').length === 1);
  return { root, project, projectObjectId: objId >= 0 ? objId : null, ownsUnassigned };
}

function hasActivities(scope: P6XmlScope): boolean {
  return scopedElements(scope, 'Activity').length > 0;
}

function parseP6XmlDocument(content: string): Element {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');

  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Invalid XML: ' + parserError.textContent);
  }
  return doc.documentElement;
}

interface P6XmlProjectRead {
  result: ImportResult;
  crossProjectRelations: Set<string>;
  activitiesRead: number;
}

function emptyReasonOf(root: Element): P6XmlEmptyReason {
  const activities: Element[] = [];
  for (const project of childElements(root, 'Project')) {
    activities.push(...childElements(project, 'Activity'));
  }
  activities.push(...childElements(root, 'Activity'));
  if (activities.length === 0) return 'no-activities';
  if (activities.some(el => childElements(el, 'task_code').length > 0
    || childElements(el, 'task_name').length > 0)) return 'xer-columns';
  return 'no-object-ids';
}

export function readP6XMLDocuments(content: string): OpenedImport {
  const results = readAllP6XmlProjects(content, true);
  if (results.length === 1) return results[0];
  let active = 0;
  results.forEach((result, i) => {
    if (leafCount(result) > leafCount(results[active])) active = i;
  });
  return { kind: 'multi-document', results, activeDocumentIndex: active };
}

export function readP6XML(content: string): ImportResult {
  return readAllP6XmlProjects(content)[0];
}

function leafCount(result: ImportResult): number {
  return result.tasks.filter(t => t.childIds.length === 0).length;
}

function readAllP6XmlProjects(content: string, throwWhenEmpty = false): ImportResult[] {
  const root = parseP6XmlDocument(content);
  const projects = childElements(root, 'Project');
  const nonEmpty = projects.map(project => scopeOf(root, project)).filter(hasActivities);
  const scopes = nonEmpty.length > 0 ? nonEmpty : [scopeOf(root, projects[0] ?? null)];
  const reads = scopes.map(readP6XmlProject);

  const baselineElements = childElements(root, 'BaselineProject');
  let baselinesMaterialized = 0;
  const usedBaselines = new Set<Element>();
  let danglingBaselineReferences = 0;
  reads.forEach((read, i) => {
    const owner = scopes[i];
    if (owner.projectObjectId == null || !owner.project) return;
    const currentObjId = getElementInt(owner.project, 'CurrentBaselineProjectObjectId', -1);
    if (currentObjId >= 0 && !baselineElements.some(el => getElementInt(el, 'ObjectId', -1) === currentObjId)) {
      danglingBaselineReferences++;
    }
    const own = baselineElements.filter(el => getElementInt(el, 'OriginalProjectObjectId', -1) === owner.projectObjectId);
    if (own.length === 0) return;
    own.forEach(el => usedBaselines.add(el));
    const baselines = own.map(el => p6BaselineFrom(root, el, owner.projectObjectId!, read.result));
    read.result.baselines = [...(read.result.baselines ?? []), ...baselines];
    read.result.activeBaselineId = baselines.find(b => b.sourceProjectId === String(currentObjId))?.id ?? null;
    baselinesMaterialized += baselines.length;
  });
  danglingBaselineReferences += baselineElements.filter(el => !usedBaselines.has(el)).length;
  const unassignedActivities = projects.length > 1
    ? childElements(root, 'Activity').filter(el => getElementInt(el, 'ProjectObjectId', -1) < 0).length
    : 0;

  const crossProjectRelations = new Set(reads.flatMap(read => [...read.crossProjectRelations]));
  const anyActivity = reads.some(read => read.activitiesRead > 0);
  const report: P6XmlImportReport = {
    projectsSeen: projects.length,
    documentsOpened: reads.length,
    emptyProjectsSkipped: nonEmpty.length > 0 ? projects.length - nonEmpty.length : 0,
    baselinesMaterialized,
    crossProjectRelations: crossProjectRelations.size,
    danglingBaselineReferences,
    unassignedActivities,
  };
  if (!anyActivity && throwWhenEmpty) throw new P6XmlImportError(emptyReasonOf(root));
  for (const read of reads) read.result.p6xmlReport = { ...report };
  return reads.map(read => read.result);
}

function p6BaselineFrom(root: Element, el: Element, ownerObjId: number, owner: ImportResult): Baseline {
  const objId = getElementInt(el, 'ObjectId', -1);
  const source = readP6XmlProject(scopeOf(root, el)).result;
  const { tasks, projectEnd } = baselineTasksFromSource(owner.tasks, source.tasks);
  const name = getElementText(el, 'Name');
  const code = getElementText(el, 'Id');
  return {
    id: `p6xml-baseline:${ownerObjId}:${objId}`,
    sourceProjectId: String(objId),
    name: p6ProjectName(name, code) || String(objId),
    createdAt: getElementText(el, 'LastBaselineUpdateDate') || owner.project.modifiedAt || owner.project.createdAt,
    tasks,
    projectEnd,
    projectDuration: 0,
  };
}

function readP6XmlProject(scope: P6XmlScope): P6XmlProjectRead {
  const durationUnitUdfIds = new Set<number>();
  for (const udfType of scopedElements(scope, 'UDFType')) {
    if (getElementText(udfType, 'SubjectArea') !== 'Activity') continue;
    if (getElementText(udfType, 'DataType') !== 'Text') continue;
    if (getElementText(udfType, 'Title') !== OPS_DURATION_UNIT_NAME) continue;
    const objectId = getElementInt(udfType, 'ObjectId', -1);
    if (objectId >= 0) durationUnitUdfIds.add(objectId);
  }
  const writtenByOps = durationUnitUdfIds.size > 0;
  const literalCalendarUdfIds = new Set(scopedElements(scope, 'UDFType')
    .filter(el => getElementText(el, 'SubjectArea') === 'Project' && getElementText(el, 'DataType') === 'Text'
      && getElementText(el, 'Title') === OPS_LITERAL_CALENDARS_NAME)
    .map(el => getElementInt(el, 'ObjectId', -1))
    .filter(objectId => objectId >= 0));
  const timeRule = xmlTimeRule(writtenByOps || isLegacyOpsP6Xml(scope.root), literalCalendarUdfIds.size > 0);
  const literalCalendarUdf = scope.project && literalCalendarUdfIds.size > 0
    ? childElements(scope.project, 'UDF').find(el => literalCalendarUdfIds.has(getElementInt(el, 'TypeObjectId', -1)))
    : undefined;
  const literalCalendarObjIds = literalCalendarUdf ? parseLiteralCalendars(getElementText(literalCalendarUdf, 'TextValue')) : null;
  const recordUdfIds = (title: string): Set<number> => new Set(scopedElements(scope, 'UDFType')
    .filter(el => getElementText(el, 'SubjectArea') === 'Activity' && getElementText(el, 'DataType') === 'Text'
      && getElementText(el, 'Title') === title)
    .map(el => getElementInt(el, 'ObjectId', -1))
    .filter(id => id >= 0));
  const dayMeasureDurationUdfIds = recordUdfIds(OPS_DAY_MEASURE_DURATIONS_NAME);
  const exactMinutesUdfIds = recordUdfIds(OPS_EXACT_MINUTES_NAME);
  const dayMeasureLagUdfIds = recordUdfIds(OPS_DAY_MEASURE_LAGS_NAME);
  const workdayIsWorkTime = dayMeasureDurationUdfIds.size > 0;
  const lastMinute = p6FinishUsesLastMinute(scope.root, writtenByOps);

  const calElements = scopedElements(scope, 'Calendar');
  const defaultCalObjId = scope.project ? getElementInt(scope.project, 'ActivityDefaultCalendarObjectId', -1) : -1;
  const projectCalEl = calElements.find(el => defaultCalObjId >= 0 && getElementInt(el, 'ObjectId', -1) === defaultCalObjId)
    ?? calElements[0];
  const calendar = projectCalEl ? readP6Calendar(projectCalEl, lastMinute, writtenByOps) : createDefaultCalendar();
  const fileHoursPerDay = new Map<WorkCalendar, number>();
  const noteFileHoursPerDay = (cal: WorkCalendar, calEl: Element): void => {
    const fileHpd = getElementFloat(calEl, 'HoursPerDay');
    if (fileHpd > 0) fileHoursPerDay.set(cal, fileHpd);
  };
  if (projectCalEl) noteFileHoursPerDay(calendar, projectCalEl);
  const projectCalObjId = projectCalEl ? getElementInt(projectCalEl, 'ObjectId', -1) : -1;

  const activityElements = scopedElements(scope, 'Activity');
  const resourceElements = scopedElements(scope, 'Resource');
  const referencedCalObjIds = new Set<number>(
    [...activityElements, ...resourceElements].map(el => getElementInt(el, 'CalendarObjectId', -1)),
  );
  const calObjIdToId = new Map<number, string>();
  const resourceCalendars: WorkCalendar[] = [];
  for (const calEl of calElements) {
    if (calEl === projectCalEl) continue;
    const objId = getElementInt(calEl, 'ObjectId', -1);
    if (objId < 0 || objId === projectCalObjId || calObjIdToId.has(objId)) continue;
    if (getElementText(calEl, 'Type') !== 'Resource' && !referencedCalObjIds.has(objId)) continue;
    const cal = readP6Calendar(calEl, lastMinute, writtenByOps);
    noteFileHoursPerDay(cal, calEl);
    cal.id = generateId('rescal');
    calObjIdToId.set(objId, cal.id);
    resourceCalendars.push(cal);
  }

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

  const rateElements = scopedElements(scope, 'ResourceRate');
  const earliestRate = new Map<string, { effective: string; price: number }>();
  for (const rateEl of rateElements) {
    const rateResObjId = getElementInt(rateEl, 'ResourceObjectId', -1);
    const resId = resObjIdToId.get(rateResObjId);
    if (!resId) continue;
    const priceText = getElementText(rateEl, 'PricePerUnit');
    const price = parseFloat(priceText);
    if (!priceText || !Number.isFinite(price)) continue;
    const effective = getElementText(rateEl, 'EffectiveDate');
    const current = earliestRate.get(resId);
    if (!current || effective < current.effective) {
      earliestRate.set(resId, { effective, price });
    }
  }
  for (const [resId, rate] of earliestRate) {
    const resource = resources.find(r => r.id === resId);
    if (resource) resource.costPerHour = rate.price;
  }

  const project = parseProject(scope.project, timeRule);
  const scheduleOptionsEl = scopedElements(scope, 'ScheduleOptions')[0];
  const derivedSchedule = deriveP6XmlScheduleOptions({
    project: field => (scope.project ? getElementText(scope.project, field) : ''),
    schedule: scheduleOptionsEl ? field => getElementText(scheduleOptionsEl, field) : null,
  }, {
    taskCount: activityElements.length,
    hasUsableProjectEnd: !!project.endDate || activityElements.some(el => getElementText(el, 'PlannedFinishDate') !== ''),
  });
  project.progressMode = derivedSchedule.progressMode;
  project.schedulingOptions = derivedSchedule.schedulingOptions;
  project.schedulingProfile = builtInProfile(P6XML_PROFILE_ID);
  const p6ProjectId = String(scope.projectObjectId ?? 1);
  const inheritsDefaultDurationType = new Set<string>();
  const projectDefaultDurationType = scope.project
    ? p6DurationTypeFromXml(getElementText(scope.project, 'ActivityDefaultDurationType')) : undefined;
  const projectDefaultWorkRule = writtenByOps ? workRuleFromXerDurationType(projectDefaultDurationType) : undefined;
  if (projectDefaultWorkRule && projectDefaultWorkRule !== DEFAULT_WORK_RULE) project.defaultWorkRule = projectDefaultWorkRule;
  const lagCalendarUdfIds = new Set(scopedElements(scope, 'UDFType')
    .filter(el => getElementText(el, 'SubjectArea') === 'Project' && getElementText(el, 'DataType') === 'Text'
      && getElementText(el, 'Title') === OPS_LAG_CALENDAR_NAME)
    .map(el => getElementInt(el, 'ObjectId', -1))
    .filter(objectId => objectId >= 0));
  const lagCalendarUdf = scope.project && lagCalendarUdfIds.size > 0
    ? childElements(scope.project, 'UDF').find(el => lagCalendarUdfIds.has(getElementInt(el, 'TypeObjectId', -1)))
    : undefined;
  const lagCalendarOption = lagCalendarUdf ? parseLagCalendarOption(getElementText(lagCalendarUdf, 'TextValue')) : undefined;
  if (lagCalendarOption) project.schedulingOptions = { ...project.schedulingOptions, lagCalendar: lagCalendarOption };
  const effCalByTaskId = new Map<string, WorkCalendar>();
  const projEl = scope.project;
  const projectStartRaw = projEl ? getElementText(projEl, 'PlannedStartDate') : '';
  const missingDates = emptyMissingScheduleDates();

  const wbsElements = scopedElements(scope, 'WBS');
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
      parentId: null,
      childIds: [],
      time: createDefaultTaskTime(project.startDate, 0),
      resourceIds: [],
    });
    if (!projectStartRaw) { missingDates.start.add(id); missingDates.finish.add(id); }
  }

  const seqNrByObjId = new Map<number, number>();
  for (const wbsEl of wbsElements) {
    const objId = getElementInt(wbsEl, 'ObjectId', -1);
    const raw = getElementText(wbsEl, 'SequenceNumber');
    if (objId >= 0 && raw) { const n = toInt(raw, NaN); if (Number.isFinite(n)) seqNrByObjId.set(objId, n); }
  }
  if (seqNrByObjId.size > 0) {
    const idToObjId = new Map<string, number>([...wbsObjIdToId].map(([o, id]) => [id, o]));
    const indexOf = new Map(wbsTasks.map((t, i) => [t.id, i]));
    wbsTasks.sort((a, b) => {
      const sa = seqNrByObjId.get(idToObjId.get(a.id)!);
      const sb = seqNrByObjId.get(idToObjId.get(b.id)!);
      if (sa !== undefined && sb !== undefined && sa !== sb) return sa - sb;
      return indexOf.get(a.id)! - indexOf.get(b.id)!;
    });
  }

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

  const actObjIdToId = new Map<number, string>();
  const leafTasks: Task[] = [];
  const customTaskTypes = new Map<string, CustomTaskTypeDraft>();

  const udfEntries: { activityObjId: number; typeObjId: number; text: string }[] = [];
  for (const udfValue of scopedElements(scope, 'UDFValue')) {
    udfEntries.push({
      activityObjId: getElementInt(udfValue, 'ForeignObjectId', -1),
      typeObjId: getElementInt(udfValue, 'UDFTypeObjectId', -1),
      text: getElementText(udfValue, 'Text') || getElementText(udfValue, 'TextValue'),
    });
  }
  for (const actEl of activityElements) {
    const activityObjId = getElementInt(actEl, 'ObjectId', -1);
    for (const udf of childElements(actEl, 'UDF')) {
      udfEntries.push({ activityObjId, typeObjId: getElementInt(udf, 'TypeObjectId', -1), text: getElementText(udf, 'TextValue') });
    }
  }
  const opsUdfTypeIds = new Set<number>();
  for (const udfType of scopedElements(scope, 'UDFType')) {
    if (getElementText(udfType, 'Title') !== OPS_CUSTOM_TASK_TYPE_UDF_TITLE) continue;
    const objectId = getElementInt(udfType, 'ObjectId', -1);
    if (objectId >= 0) opsUdfTypeIds.add(objectId);
  }
  const customTaskTypeByActivityObjectId = new Map<number, { id: string; name?: string }>();
  for (const entry of udfEntries) {
    if (!opsUdfTypeIds.has(entry.typeObjId)) continue;
    const parsed = decodeCustomTaskType(entry.text);
    if (entry.activityObjId >= 0 && parsed && !customTaskTypeByActivityObjectId.has(entry.activityObjId)) {
      customTaskTypeByActivityObjectId.set(entry.activityObjId, parsed);
    }
  }

  const explicitUnitByActivityObjectId = new Map<number, 'days' | 'hours'>();
  for (const entry of udfEntries) {
    if (!durationUnitUdfIds.has(entry.typeObjId)) continue;
    if (entry.activityObjId >= 0 && isTaskDurationUnit(entry.text)) {
      explicitUnitByActivityObjectId.set(entry.activityObjId, entry.text);
    }
  }
  const recordTextByActivity = (ids: ReadonlySet<number>): Map<number, string> => {
    const out = new Map<number, string>();
    for (const entry of udfEntries) {
      if (ids.has(entry.typeObjId) && entry.activityObjId >= 0 && !out.has(entry.activityObjId)) out.set(entry.activityObjId, entry.text);
    }
    return out;
  };
  const dayMeasureDurationText = recordTextByActivity(dayMeasureDurationUdfIds);
  const exactMinutesText = recordTextByActivity(exactMinutesUdfIds);
  const dayMeasureLagText = recordTextByActivity(dayMeasureLagUdfIds);

  const descriptionTopicIds = new Set(scopedElements(scope, 'NotebookTopic')
    .filter(el => getElementText(el, 'Name') === OPS_DESCRIPTION_TOPIC_NAME)
    .map(el => getElementInt(el, 'ObjectId', -1)));
  const noteByActivityObjId = new Map<number, string>();
  for (const noteEl of scopedElements(scope, 'ActivityNote')) {
    if (!descriptionTopicIds.has(getElementInt(noteEl, 'NotebookTopicObjectId', -1))) continue;
    const actObjId = getElementInt(noteEl, 'ActivityObjectId', -1);
    if (actObjId >= 0 && !noteByActivityObjId.has(actObjId)) noteByActivityObjId.set(actObjId, getElementText(noteEl, 'Note'));
  }

  const calById = new Map<string, WorkCalendar>([calendar, ...resourceCalendars].map(c => [c.id, c]));
  const effCalIdOf = (calObjId: number): string => calObjIdToId.get(calObjId) ?? calendar.id;
  const literalCalIds = timeRule === 'opsLiteral' && literalCalendarObjIds
    ? new Set([...literalCalendarObjIds].flatMap(objId => objId === projectCalObjId ? [calendar.id]
      : calObjIdToId.has(objId) ? [calObjIdToId.get(objId)!] : []))
    : null;

  const actualDateRaw = (actEl: Element, field: 'ActualStartDate' | 'ActualFinishDate'): string =>
    !writtenByOps && getElementText(actEl, 'Status').trim() === 'Not Started' ? '' : getElementText(actEl, field);

  const cSignalCalIds = new Set<string>();
  for (const actEl of activityElements) {
    const calId = effCalIdOf(getElementInt(actEl, 'CalendarObjectId', -1));
    const cal = calById.get(calId);
    if (!cal) continue;
    const durHours = getElementFloat(actEl, 'PlannedDuration');
    const durSignal = durHours > 0 && isSubDayMinutes(Math.round(durHours * 60), cal.hoursPerDay);
    const dateSignal = literalCalIds ? literalCalIds.has(calId) : [
      getElementText(actEl, 'PlannedStartDate'),
      getElementText(actEl, 'PlannedFinishDate'),
      actualDateRaw(actEl, 'ActualStartDate'),
      actualDateRaw(actEl, 'ActualFinishDate'),
    ].some(xmlTimeSignal);
    if (durSignal || dateSignal) cSignalCalIds.add(calId);
  }
  const hourModeCalIds = promoteHourCalendars(calById, id => cSignalCalIds.has(id), false);
  for (const id of hourModeCalIds) {
    const promoted = calById.get(id);
    if (!promoted) continue;
    delete promoted.simpleBreakStartMinute;
    delete promoted.simpleBreakDurationMinutes;
  }
  for (const [cal, fileHpd] of fileHoursPerDay) cal.hoursPerDay = fileHpd;

  const recordedTimes: Record<string, RecordedTime> = {};
  const runningAtFullIds = new Set<string>();

  for (const actEl of activityElements) {
    const objId = getElementInt(actEl, 'ObjectId', -1);
    if (objId < 0) continue;

    const id = generateId('task');
    actObjIdToId.set(objId, id);

    const actId = getElementText(actEl, 'Id');
    const name = getElementText(actEl, 'Name') || 'Activity';
    const p6Type = getElementText(actEl, 'Type');
    const p6DurationType = p6DurationTypeFromXml(getElementText(actEl, 'DurationType'));
    const plannedDuration = getElementFloat(actEl, 'PlannedDuration');
    const plannedStartRaw = getElementText(actEl, 'PlannedStartDate');
    const plannedFinishRaw = getElementText(actEl, 'PlannedFinishDate');
    const percentComplete = p6ActivityCompletionPercent(actEl, writtenByOps);
    const description = noteByActivityObjId.get(objId) ?? getElementText(actEl, 'Description');
    const customTaskType = customTaskTypeByActivityObjectId.get(objId);
    if (customTaskType?.name && !customTaskTypes.has(customTaskType.id)) {
      customTaskTypes.set(customTaskType.id, { id: customTaskType.id, name: customTaskType.name });
    }
    const wbsObjId = getElementInt(actEl, 'WBSObjectId', -1);
    const calObjId = getElementInt(actEl, 'CalendarObjectId', -1);
    const taskCalendarId = calObjIdToId.get(calObjId);

    const effCalId = effCalIdOf(calObjId);
    const explicitUnit = explicitUnitByActivityObjectId.get(objId);
    const isHour = explicitUnit !== 'days';
    const hourDates = hourModeCalIds.has(effCalId);
    const effCal = calById.get(effCalId) ?? calendar;
    effCalByTaskId.set(id, effCal);
    const effHpd = effCal.hoursPerDay;
    const parseTaskDate = (raw: string): string | undefined => xmlTaskDate(raw, timeRule, hourDates);
    const sourceStart = parseTaskDate(plannedStartRaw);
    const sourceFinish = parseTaskDate(plannedFinishRaw);
    const plannedStart = sourceStart ?? localTodayIso();
    const plannedFinish = sourceFinish ?? localTodayIso();
    if (sourceStart === undefined) missingDates.start.add(id);
    if (sourceFinish === undefined) missingDates.finish.add(id);

    {
      const recordedDate = (raw: string): string | undefined => xmlTaskDate(raw, timeRule, hourDates);
      const floatDays = (raw: string): number | undefined => {
        if (!raw) return undefined;
        const hours = Number.parseFloat(raw);
        return Number.isFinite(hours)
          ? recordedFloatDays(hours * 60, effHoursPerDay(effCal) * 60)
          : undefined;
      };
      const criticalRaw = getElementText(actEl, 'IsCritical');
      const recorded = buildRecordedTime({
        start: recordedDate(getElementText(actEl, 'EarlyStartDate')) ?? recordedDate(getElementText(actEl, 'StartDate')),
        finish: recordedDate(getElementText(actEl, 'EarlyFinishDate')) ?? recordedDate(getElementText(actEl, 'FinishDate')),
        lateStart: recordedDate(getElementText(actEl, 'LateStartDate')),
        lateFinish: recordedDate(getElementText(actEl, 'LateFinishDate')),
        totalFloat: floatDays(getElementText(actEl, 'TotalFloat')),
        freeFloat: floatDays(getElementText(actEl, 'FreeFloat')),
        isCritical: criticalRaw === 'true' || criticalRaw === '1' ? true
          : criticalRaw === 'false' || criticalRaw === '0' ? false : undefined,
      });
      if (recorded) recordedTimes[id] = recorded;
    }

    const actualStartRaw = actualDateRaw(actEl, 'ActualStartDate');
    const actualFinishRaw = actualDateRaw(actEl, 'ActualFinishDate');
    const remainingRaw = getElementText(actEl, 'RemainingDuration');
    const actualStart = parseTaskDate(actualStartRaw);
    const actualFinish = parseTaskDate(actualFinishRaw);
    const dayHoursPerDay = workdayIsWorkTime ? dayMeasureMinutesPerDay(effCal, false) / 60 : effHpd;
    const markerUnit = isHour ? 'hours' : 'days';
    const remainingHours = remainingRaw ? parseFloat(remainingRaw) : NaN;
    const hasRemaining = Number.isFinite(remainingHours);
    const measure = readMeasure({
      unit: markerUnit,
      durationMinutes: plannedDuration * 60,
      remainingMinutes: hasRemaining ? remainingHours * 60 : undefined,
      minutesPerDay: (dayHoursPerDay > 0 ? dayHoursPerDay : 8) * 60,
      calendar: effCal,
      dayRecords: markerUnit === 'days' ? parseFieldRecords(dayMeasureDurationText.get(objId), P6_DURATION_FIELDS) : {},
      exactRecords: markerUnit === 'hours' ? parseFieldRecords(exactMinutesText.get(objId), P6_DURATION_FIELDS) : {},
    });
    const remainingMinutes = measure.remainingMinutes;
    const remainingTime = measure.remainingTime;
    const durationMinutes = measure.durationMinutes;
    const durationDays = measure.scheduleDuration;
    const isMilestone = p6Type.includes('Milestone');
    const p6ActivityType: P6ActivityType = P6_XML_ACTIVITY_TYPE[p6Type.trim()] ?? 'TT_Task';
    const completePctLabel = getElementText(actEl, 'PercentCompleteType').trim();
    const completePctType = completePctLabel ? P6_XML_PERCENT_TYPE[completePctLabel] ?? 'CP_Drtn' : undefined;
    const expectedFinish = parseTaskDate(getElementText(actEl, 'ExpectedFinishDate'));
    const milestoneKind = !isMilestone ? undefined
      : p6Type.includes('Finish') ? 'FINISH' as const
      : 'START' as const;

    const parentId = wbsObjId >= 0 ? wbsObjIdToId.get(wbsObjId) || null : null;

    let constraint: TaskConstraint | undefined;
    const primCode = getElementText(actEl, 'PrimaryConstraintType');
    if (primCode) {
      const mapped = p6ConstraintFromXml(primCode, 'PrimaryConstraintType');
      if (mapped) {
        const cdate = parseTaskDate(getElementText(actEl, 'PrimaryConstraintDate'));
        constraint = {
          type: mapped.type,
          ...(mapped.hard ? { hard: true } : {}),
          ...(cdate ? { date: cdate } : {}),
        };
      }
    }
    let constraint2: TaskConstraint | undefined;
    const secCode = getElementText(actEl, 'SecondaryConstraintType');
    if (secCode) {
      const mapped2 = p6ConstraintFromXml(secCode, 'SecondaryConstraintType');
      if (mapped2) {
        const cdate2 = parseTaskDate(getElementText(actEl, 'SecondaryConstraintDate'));
        constraint2 = {
          type: mapped2.type,
          ...(cdate2 ? { date: cdate2 } : {}),
        };
      }
    }

    const task: Task = {
      id,
      name,
      description,
      wbsCode: actId,
      taskType: customTaskType ? 'USERDEFINED' : 'CONSTRUCTION',
      ...(customTaskType ? { customTaskTypeId: customTaskType.id } : {}),
      ...(p6DurationType ?? projectDefaultDurationType
        ? { p6DurationType: p6DurationType ?? projectDefaultDurationType } : {}),
      p6ActivityType,
      p6ProjectId,
      p6TaskId: String(objId),
      ...(sourceStart !== undefined && sourceFinish !== undefined ? { p6ExplicitTargetWindow: true } : {}),
      ...(completePctType ? { p6CompletePctType: completePctType } : {}),
      ...(expectedFinish ? { p6ExpectedFinish: expectedFinish } : {}),
      ...(p6ActivityType === 'TT_LOE' ? { isHammock: true } : {}),
      status: 'NOT_STARTED',
      isMilestone,
      ...(milestoneKind ? { milestoneKind } : {}),
      priority: 500,
      parentId,
      childIds: [],
      ...(constraint ? { constraint } : {}),
      ...(constraint2 ? { constraint2 } : {}),
      time: {
        durationType: measure.durationType ?? 'WORKTIME',
        durationUnit: measure.durationUnit,
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
    if (!p6DurationType && projectDefaultDurationType) inheritsDefaultDurationType.add(id);
    const running = writtenByOps
      ? !actualFinish && (getElementText(actEl, 'Status').trim() === 'In Progress'
        || (remainingMinutes ?? 0) > 0 || (remainingTime ?? 0) > 0)
      : getElementText(actEl, 'Status').trim() === 'In Progress';
    if (running) runningAtFullIds.add(id);

    if (parentId) {
      const parent = wbsTasks.find(t => t.id === parentId);
      if (parent && !parent.childIds.includes(id)) {
        parent.childIds.push(id);
      }
    }
  }

  const tasks = [...flattenOrder([...wbsTasks, ...leafTasks])];

  if (projectStartRaw && hourModeCalIds.has(calendar.id)) {
    project.startDate = xmlTaskDate(projectStartRaw, timeRule, true) ?? project.startDate;
  }
  project.startDate = resolveMissingScheduleDates(tasks, missingDates, projectStartRaw ? project.startDate : '',
    (task) => resolveCalendar(task.calendarId, resourceCalendars, calendar));

  normalizeImportedProgress(tasks, project.statusDate, runningAtFullIds);
  deriveImportedWorkRules(tasks);
  if (writtenByOps) {
    for (const task of leafTasks) if (inheritsDefaultDurationType.has(task.id)) delete task.workRule;
  }

  const relElements = scopedElements(scope, 'Relationship');
  const sequences: Sequence[] = [];

  const crossProjectRelations = new Set<string>();
  const ownProjectObjId = scope.projectObjectId;
  const lagKeyOf = (relEl: Element): string => lagRecordKey(getElementInt(relEl, 'PredecessorActivityObjectId', -1),
    SEQUENCE_TYPE_BY_P6[getElementText(relEl, 'Type')] ?? 'FINISH_START');
  const lagKeyCount = new Map<string, number>();
  for (const relEl of relElements) {
    const key = `${getElementInt(relEl, 'SuccessorActivityObjectId', -1)}>${lagKeyOf(relEl)}`;
    lagKeyCount.set(key, (lagKeyCount.get(key) ?? 0) + 1);
  }
  const lagRecordsBySuccessor = new Map<number, Map<string, LagRecord>>();
  const lagRecordOf = (relEl: Element, succObjId: number): LagRecord | undefined => {
    if (lagKeyCount.get(`${succObjId}>${lagKeyOf(relEl)}`) !== 1) return undefined;
    let records = lagRecordsBySuccessor.get(succObjId);
    if (!records) {
      records = parseLagRecords(dayMeasureLagText.get(succObjId));
      lagRecordsBySuccessor.set(succObjId, records);
    }
    return records.get(lagKeyOf(relEl));
  };
  const leafById = new Map(leafTasks.map(task => [task.id, task] as const));
  const boundaryEngines = new Map<string, CalendarEngine>();
  for (const relEl of relElements) {
    const predObjId = getElementInt(relEl, 'PredecessorActivityObjectId', -1);
    const succObjId = getElementInt(relEl, 'SuccessorActivityObjectId', -1);
    if (predObjId < 0 || succObjId < 0) continue;

    const predId = actObjIdToId.get(predObjId);
    const succId = actObjIdToId.get(succObjId);
    if (!predId || !succId) {
      const predProj = getElementInt(relEl, 'PredecessorProjectObjectId', -1);
      const succProj = getElementInt(relEl, 'SuccessorProjectObjectId', -1);
      if (ownProjectObjId != null && ((predProj >= 0 && predProj !== ownProjectObjId)
        || (succProj >= 0 && succProj !== ownProjectObjId))) {
        crossProjectRelations.add(getElementText(relEl, 'ObjectId') || `${predObjId}>${succObjId}`);
      }
      continue;
    }

    const p6Type = getElementText(relEl, 'Type');
    const lagHours = getElementFloat(relEl, 'Lag');

    const record = lagRecordOf(relEl, succObjId);
    const seq: Sequence = {
      id: generateId('seq'),
      predecessorId: predId,
      successorId: succId,
      type: SEQUENCE_TYPE_BY_P6[p6Type] ?? 'FINISH_START',
      lagDays: 0,
    };
    const predTask = leafById.get(predId);
    const succTask = leafById.get(succId);
    if (predTask && succTask && seq.type === 'FINISH_START' && sixDecimalHoursToMinutes(lagHours) === 0) {
      const predCalendar = effCalByTaskId.get(predId) ?? calendar;
      let engine = boundaryEngines.get(predCalendar.id);
      if (!engine) { engine = new CalendarEngine(calendarForEngine(predCalendar)); boundaryEngines.set(predCalendar.id, engine); }
      const predFinish = parseInstant(predTask.time.scheduleFinish);
      const finishMinute = predFinish.getUTCHours() * 60 + predFinish.getUTCMinutes();
      if (engine.isHourMode && predFinish.getTime() === parseInstant(succTask.time.scheduleStart).getTime()
        && engine.effectiveBandsOn(predFinish).some(band => band.end === finishMinute)) {
        seq.p6StartAtPredecessorFinishBoundary = true;
      }
    }
    if (lagRecordHolds(record, lagHours * 60, lagWorkMinutesPerDay(seq, project.schedulingOptions?.lagCalendar, calendar, effCalByTaskId))) {
      Object.assign(seq, lagFromRecord(record));
    } else {
      seq.lagMinutes = sixDecimalHoursToMinutes(lagHours);
    }
    sequences.push(seq);
  }

  const curveByObjId = new Map<number, { name: string; values: number[] }>();
  for (const curveEl of scopedElements(scope, 'ResourceCurve')) {
    const objId = getElementInt(curveEl, 'ObjectId', -1);
    if (objId < 0) continue;
    const valuesEl = curveEl.getElementsByTagName('Values')[0];
    if (!valuesEl) continue;
    const raw: number[] = [];
    for (let pct = 0; pct <= 100; pct += 5) raw.push(getElementFloat(valuesEl, `Value${pct}`, NaN));
    const values = normalizeCurveValues(raw);
    if (!values) continue;
    curveByObjId.set(objId, { name: getElementText(curveEl, 'Name'), values });
  }

  const taskById = new Map(tasks.map(t => [t.id, t] as const));
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
  const contoursByTaskId = new Map<string, TaskTimephasedContour[]>();

  const resourceById = new Map(resources.map(r => [r.id, r] as const));
  const asgnElements = scopedElements(scope, 'ResourceAssignment');
  const assignments: ResourceAssignment[] = [];
  for (const asgnEl of asgnElements) {
    const actObjId = getElementInt(asgnEl, 'ActivityObjectId', -1);
    const resObjId = getElementInt(asgnEl, 'ResourceObjectId', -1);
    if (actObjId < 0 || resObjId < 0) continue;
    const taskId = actObjIdToId.get(actObjId);
    const resourceId = resObjIdToId.get(resObjId);
    if (!taskId || !resourceId) continue;

    const plannedUnitsPerTime = getElementFloat(asgnEl, 'PlannedUnitsPerTime');

    const plannedCurveRaw = getElementText(asgnEl, 'PlannedCurve');
    const curveObjId = getElementInt(asgnEl, 'ResourceCurveObjectId', -1);
    const catalogCurve = curveObjId >= 0 ? curveByObjId.get(curveObjId) : undefined;
    let curve: ResourceCurve | undefined;
    let curveValues: number[] | undefined;
    if (catalogCurve && !isFlatCurveValues(catalogCurve.values)) {
      curve = matchCurveValues(catalogCurve.values) ?? P6_NAME_TO_CURVE[catalogCurve.name];
      curveValues = catalogCurve.values;
    } else if (plannedCurveRaw && plannedCurveRaw.indexOf(':') === -1) {
      curve = P6_NAME_TO_CURVE[plannedCurveRaw];
    }

    const unitsMinutes = (tag: string): number | undefined => {
      const raw = getElementText(asgnEl, tag);
      if (!raw.trim()) return undefined;
      const hours = parseFloat(raw);
      return Number.isFinite(hours) ? hours * 60 : undefined;
    };
    const remainingMinutes = unitsMinutes('RemainingUnits');
    const remainingRateRaw = getElementText(asgnEl, 'RemainingUnitsPerTime');
    const remainingRate = remainingRateRaw.trim() ? parseFloat(remainingRateRaw) : undefined;
    const plannedRate = plannedUnitsPerTime > 0 ? plannedUnitsPerTime
      : remainingRate !== undefined && Number.isFinite(remainingRate) && remainingRate > 0 ? remainingRate : 1;
    const isMaterial = resourceById.get(resourceId)?.type === 'MATERIAL';
    const { unitsPerDay, plannedUnitsPerDay } = isMaterial
      ? { unitsPerDay: plannedRate, plannedUnitsPerDay: undefined }
      : importedAssignmentRate(plannedRate, remainingRate, remainingMinutes);
    const workTask = taskById.get(taskId);
    const derivedWork = workTask ? taskWorkMinutes(workTask.time, engineForTask(workTask).hoursPerDay) * unitsPerDay : 0;
    const workFields = importedWorkFields({
      plannedMinutes: unitsMinutes('PlannedUnits'),
      actualMinutes: unitsMinutes('ActualUnits'),
      remainingMinutes,
    }, derivedWork);
    assignments.push({
      id: generateId('asgn'),
      taskId,
      resourceId,
      unitsPerDay,
      ...(plannedUnitsPerDay !== undefined ? { plannedUnitsPerDay } : {}),
      ...(curve && curve !== 'UNIFORM' ? { curve } : {}),
      ...(curveValues ? { curveValues } : {}),
      ...workFields,
    });

    const task = taskById.get(taskId);
    if (task && task.time.scheduleStart && task.childIds.length === 0) {
      const engine = engineForTask(task);
      const taskStart = parseInstant(task.time.scheduleStart);
      const anchorOffset = (tag: string): number => {
        const raw = getElementText(asgnEl, tag);
        return raw ? axisOffsetMinutes(engine, taskStart, parseImportedInstant(raw), false) : 0;
      };
      const actualSpread = getElementText(asgnEl, 'ActualCurve');
      const remainingSpread = getElementText(asgnEl, 'RemainingCurve');
      let periods = [
        ...p6SpreadToContourPeriods(actualSpread, anchorOffset('ActualStartDate'), 'actual'),
        ...p6SpreadToContourPeriods(remainingSpread, anchorOffset('RemainingStartDate'), 'remaining'),
      ];
      if (periods.length === 0 && plannedCurveRaw.indexOf(':') >= 0) {
        periods = p6SpreadToContourPeriods(plannedCurveRaw, anchorOffset('PlannedStartDate'), 'remaining');
      }
      if (periods.length > 1 && periods.some(p => p.workMinutes > 0)) {
        collectContour(contoursByTaskId, taskId, { resourceUid: null, resourceId, periods });
      }
    }
  }
  attachContours(taskById, contoursByTaskId);
  reconstructResourceIds(tasks, assignments);

  const result: ImportResult = {
    project,
    calendar,
    tasks,
    sequences,
    resources,
    assignments,
    resourceCalendars,
    customTaskTypes: withTaskTypeColors([...customTaskTypes.values()]),
    suggestedProfileId: P6XML_PROFILE_ID,
    ...(Object.keys(recordedTimes).length > 0 ? { recordedTimes, recordedTimesOrigin: 'p6xml' as const } : {}),
  };
  return { result, crossProjectRelations, activitiesRead: leafTasks.length };
}

function p6ProjectCode(id: string): string {
  const code = id.trim();
  return isOpsInternalProjectId(code) || isLegacyOpsProjectId(code) ? '' : code;
}

function p6ProjectName(name: string, id: string): string {
  return nameWithProjectCode(name.trim(), p6ProjectCode(id));
}

function parseProject(projEl: Element | null, timeRule: XmlTimeRule): Project {

  if (!projEl) {
    return {
      id: generateId('proj'),
      name: 'P6 Import',
      description: '',
      startDate: localTodayIso(),
      endDate: '',
      calendarId: 'cal-default',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      author: '',
      company: '',
    };
  }

  const mustFinishRaw = getElementText(projEl, 'MustFinishByDate');
  const code = p6ProjectCode(getElementText(projEl, 'Id'));
  const project: Project = {
    id: generateId('proj'),
    name: getElementText(projEl, 'Name').trim() || code || 'P6 Import',
    description: getElementText(projEl, 'Description'),
    startDate: parseP6Date(getElementText(projEl, 'PlannedStartDate')),
    endDate: mustFinishRaw ? parseP6Date(mustFinishRaw) : '',
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: '',
    company: '',
  };
  if (code) project.p6ProjectCode = code;
  const dataDateRaw = getElementText(projEl, 'DataDate');
  if (dataDateRaw) project.statusDate = statusDateFromXml(dataDateRaw, timeRule);
  return project;
}

function readP6Calendar(calEl: Element, lastMinute = false, writtenByOps = false): WorkCalendar {
  const calendar = createDefaultCalendar();
  calendar.name = getElementText(calEl, 'Name') || calendar.name;
  delete calendar.generation;

  const hpd = getElementFloat(calEl, 'HoursPerDay');
  if (hpd > 0) calendar.hoursPerDay = hpd;

  const ww = parseP6StandardWorkWeek(calEl, lastMinute);
  if (ww.workDays.length > 0) calendar.workDays = ww.workDays.sort((a, b) => a - b);
  if (ww.workStartHour !== undefined) calendar.workStartHour = ww.workStartHour;
  if (ww.workEndHour !== undefined) calendar.workEndHour = ww.workEndHour;
  registerP6Bands(calendar, ww.rawByWeekday, writtenByOps, hpd);

  if (ww.workDays.length > 0) calendar.holidays = [];
  const { holidays, workingExceptions } = parseP6HolidayOrExceptions(calEl, lastMinute);
  const workingDates = new Set(workingExceptions.map(w => w.startDate));
  const offDays = holidays.filter(h => !(h.startDate === h.endDate && workingDates.has(h.startDate)));
  if (offDays.length > 0) calendar.holidays = mergeConsecutiveDays(offDays);
  if (workingExceptions.length > 0) calendar.workingExceptions = mergeConsecutiveDays(workingExceptions);

  return calendar;
}
