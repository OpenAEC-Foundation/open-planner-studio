import { stepStringEnd, skipStepComment, unescapeStepQuotes } from './stepLexical';
import { parseIfcDuration } from './isoDuration';
import { ifcCalendarBandLayout, parseIfcClock } from './ifcClock';
import { ACTIVITY_CODE_ID_SUFFIX, milestoneWasAtDayEnd } from './ifcPsets';
import { calendarExceptionKey, calendarExceptionKeyFromClocks } from './calendarExceptionKey';
import { Task, TaskTime, TaskType, TASK_TYPES } from '@/types/task';
import { WORK_RULES, type WorkRule } from '@/types/workRule';
import { normalizeCurveValues } from '@/engine/contour/contourEngine';
import type { CustomTaskType, CustomTaskTypeDraft } from '@/types/taskType';
import { isTaskTypeColor, withTaskTypeColors } from '@/services/taskTypes/customTaskTypeColors';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { effHoursPerDay, hourTaskScheduleDuration } from '@/utils/taskDuration';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment, AvailabilityStep, ResourceCurve, isResourceCurve, clearCostResourceFields, normalizeAssignmentForResource, type ResourceType } from '@/types/resource';
import { Project, ProjectSchedulingOptions, SchedulingOptions, SchedulingProfile, isIfcSchemaId, type IfcSchemaId } from '@/types/project';
import { WorkCalendar, Holiday, CalendarGeneration, WorkingException, type WorkTimeBands } from '@/types/calendar';
import { DEFAULT_CALENDAR_ID, createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { HolidayCountry } from '@/engine/calendar/holidays';
import type { LibraryOrigin } from '@/types/library';
import { ActivityCodeType, CustomFieldDef, CustomFieldValue } from '@/types/structure';
import { Baseline, BaselineTask, normalizeComparedBaselines, type ComparedBaselineIds } from '@/types/baseline';
import { generateId } from '@/utils/id';
import { formatInstant, localTodayIso } from '@/utils/dateUtils';
import { ifcGuid, ifcGuid128, ifcObjectSeed } from './ifcWriter';
import { IfcParseError } from './ifcErrors';
import { decodeStepText } from './stepText';
import { IFC_BUILDING_MODEL_TYPES } from './ifcBuildingModelTypes';
import { indexOfStepDataSection, startsWithStepHeader, STEP_HEADER } from './stepDataSection';
import { stepFileGrammar } from './stepFileGrammar';
import { CALENDAR_SLOT, WORK_CONTROL_SLOT, workCalendarSlots, workControlSlots } from './ifcWorkControlSlots';
import { LAG_SLOT, lagValueSlot } from './ifcLagTimeSlots';
import { SEQUENCE_SLOT, lagTimeSlots } from './ifcSequenceSlots';
import { RESOURCE_SLOT } from './ifcResourceSlots';
import { cleanIfcSchemaName, ifcSchemaUnconfirmedOnRead } from './ifcSchemaQuestion';
import { parseForeignSourceFingerprint, parseForeignSourceTarget, type ForeignSourceRecord } from './foreign/foreignSourceMark';
import type { ImportLabels, ImportResult, RecordedSourceFormat, XerArchiveIssue, XerArchiveIssueCode } from '@/services/importTypes';
import {
  DEFAULT_PRIORITY, IFC_TIME_ANCHOR, MEASURE_TO_FIELD, IFC_TO_RESOURCE_TYPE, COST_RESOURCE_OBJECT_TYPE,
} from './ifcConstants';
import {
  OPS_LEGACY_LITERAL_APP_VERSION, PSET, PROP, PER_TASK_PSET_BY_NAME, XER_ARCHIVE_CHUNK, isXerArchiveChunkName, xerArchiveChunkName,
  type XerArchiveChunkPrefix, readDayMeasureDurations, readExactFloat, readExactMinutes, readIfcDate,
} from './ifcPsets';
import {
  DAY_MEASURE_LAGS_PROP, EXACT_MINUTE_LAGS_PROP, parseDayMeasureLags, taskMinutesPerDay,
  wholeFloatDays, type DayMeasureRecord, type ExactMinutesRecord,
} from './dayMeasureIo';
import {
  IFC_TASKTIME_SLOTS, ALL_RECORDED_SLOT_KEYS, TASK_SLOT, TASKTIME_SLOT, IFC_TASK_STATUS_RUNNING, taskSlots,
  type RecordedFieldKey, type TaskTimeReadHelpers,
} from './ifcTaskSlots';
import { normalizeImportedProgress, reconstructResourceIds } from '@/services/importNormalize';
import { reconcileP6SuspendResume } from '@/utils/p6SuspendResume';
import type { XerImportMetadata } from '@/services/importTypes';
import {
  bindXerImportMetadataToArchive, createXerSourceArchiveFromOwnedMetadata, decodeXerBase64Chunk,
  parseXerArchiveMetadataPayload, sha256Hex,
  XER_SOURCE_ARCHIVE_CHUNK_BYTES, XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT,
  XER_SOURCE_ARCHIVE_COMPACT_STORAGE_SCHEMA_VERSION, XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_FORMAT,
  XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_SCHEMA_VERSION,
  XER_SOURCE_ARCHIVE_SCHEMA_VERSION, type XerSourceArchive, type XerSourceArchiveBom,
  type XerSourceArchiveEncoding, type XerSourceArchiveNewline, type XerArchiveMetadataPayloadV1,
  type XerSourceReconstruction,
} from '@/services/xerSourceArchive';
import {
  MAX_PROFILE_JSON_LENGTH, profileAfterRead, sanitizeSchedulingOptions, sanitizeSchedulingProfile,
} from '@/services/ifc/schedulingOptionsRead';
import { optionKeysOnly } from '@/services/ifc/schedulingProfileMigration';
import { emptyMissingScheduleDates, importStatusDate, parseImportedInstant, resolveMissingScheduleDates } from '@/services/importDates';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { isDateOnly } from '@/engine/calendar/workdayRules';
import { seedScalarBands } from '@/utils/effectiveWorkTime';
import { hourRemainingDays } from '@/engine/taskMutationRules';
import {
  canonicalizeBands, clockToMinutes, firstBlockedDay, getCalendarBands, hasNonAnchorTime,
  isoDurationToMinutes, isSubDayMinutes, promoteHourCalendar, promoteHourCalendars,
  registerCalendarBands, workDayFromBlocks,
} from '@/services/subdayIo';

export type XerArchiveReconstructor = (bytes: Uint8Array) => XerSourceReconstruction;

export interface IfcReadOptions {
  projectTimestampFallback?: Pick<Project, 'createdAt' | 'modifiedAt'>;
  reconstructXerArchive?: XerArchiveReconstructor;
  resolveXerArchiveReference?: (sha256: string) => Uint8Array | undefined;
  literalStepIds?: ReadonlySet<string>;
  planningTaskStepIds?: ReadonlySet<string>;
  stepIdsOut?: Record<string, string>;
  projectDataInSettings?: boolean;
}

interface StepEntity {
  id: string;
  type: string;
  args: string[];
  raw: string;
}

const STEP_TERMINATOR = 'END-ISO-10303-21;';
const TERMINATOR_PROBE = 4096;

export function assertIfcIntegrity(content: string): void {
  let i = content.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (i < content.length && isSpaceCode(content.charCodeAt(i))) i++;
  if (!startsWithStepHeader(content, i)) {
    throw new IfcParseError(
      'not-step',
      `Geen IFC/STEP-bestand: de verplichte kop '${STEP_HEADER}' ontbreekt.`,
    );
  }
  if (!content.slice(-TERMINATOR_PROBE).toUpperCase().includes(STEP_TERMINATOR)) {
    throw new IfcParseError(
      'truncated',
      `Onvolledig IFC-bestand: de afsluitende '${STEP_TERMINATOR}' ontbreekt — ` +
      'de tekst is afgekapt (bijvoorbeeld door een crash tijdens het schrijven).',
    );
  }
}

export const DEFAULT_IMPORTED_PROJECT_NAME = 'Imported project';

export function readIFC(
  content: string,
  labels: ImportLabels = {},
  options: IfcReadOptions = {},
): ImportResult {
  assertIfcIntegrity(content);
  const buildingModel = () => new IfcParseError('building-model', labels.ifcBuildingModelUnsupported ??
    'This IFC file contains building model objects. Opening is blocked because saving would discard them. Edit the separate planning file and merge it with the building model afterwards.');
  const grammar = stepFileGrammar(content);
  if (grammar.model) throw buildingModel();
  const literalStrings = grammar.failed || grammar.literalStrings;
  const entities = parseSTEP(content, literalStrings);
  if (entities.some(entity => IFC_BUILDING_MODEL_TYPES.has(entity.type))) {
    throw buildingModel();
  }
  if (options.literalStepIds) {
    const literal = options.literalStepIds;
    decodeEntityStrings(entities.filter(e => !literal.has(e.id)), literalStrings);
  } else if (stringsAreStepEncoded(entities)) decodeEntityStrings(entities, literalStrings);
  const entityMap = new Map<string, StepEntity>();
  for (const e of entities) {
    entityMap.set(e.id, e);
  }

  const taskIdentityByStepId = extractTaskIdentityByStepId(entities, entityMap);

  const project = extractProject(entities, entityMap, labels, options);
  const fileSchemaName = readFileSchemaName(content, literalStrings);
  if (isIfcSchemaId(fileSchemaName)) project.ifcSchema = fileSchemaName;
  const archiveRead = readXerArchiveOrIssue(entities, entityMap, options);
  const xerSource = archiveRead.source;
  const xerSourceArchive = xerSource?.archive;
  const xerSourceProjectId = archiveRead.sourceProjectId;
  const xer = archiveRead.xer;
  const xerArchiveIssue = archiveRead.issue;
  const recordedTimes = xerSourceProjectId
    ? xerSource?.recordedTimesByProject[xerSourceProjectId]
    : undefined;
  const ownAuthored = isOpsAuthoredIfc(entities);
  const importPristine = ownAuthored ? extractImportPristine(entities, entityMap) : undefined;
  const recordedSourceFormat = ownAuthored ? extractRecordedSourceFormat(entities, entityMap) : undefined;
  const recoveryForeignSource = ownAuthored ? extractRecoveryForeignSource(entities, entityMap) : undefined;
  const calendar = extractCalendar(entities, entityMap);
  const baselineTaskStepIds = options.planningTaskStepIds
    ? tasksOutsideSelection(entities, options.planningTaskStepIds)
    : collectBaselineTaskStepIds(entities);
  const { tasks, taskStepIdMap, taskTimeEntities, recordedFields, runningStatusIds } = extractTasks(
    entities, entityMap, baselineTaskStepIds, taskIdentityByStepId, calendar.hoursPerDay,
  );
  const { boundaryGuids: p6BoundarySequenceGuids, dayMeasureLags, exactMinuteLags } = extractSequenceMeta(
    entities, entityMap, new Set(taskStepIdMap.keys()),
  );
  const guidLog: Record<string, string> = {};
  const stepLog: Record<string, string> | undefined = options.stepIdsOut ? {} : undefined;

  extractNesting(entities, entityMap, tasks, taskStepIdMap);
  const { resources, resourceStepIdMap, resourceGuidMap } = extractResources(entities, entityMap, guidLog);
  extractResourceMeta(entities, entityMap, resources, resourceStepIdMap, resourceGuidMap);
  extractCrewNesting(entities, resources, resourceStepIdMap);
  const { calendars: resourceCalendars, idByGuid: calendarIdByGuid } = extractCalendarLibrary(
    entities, entityMap, resources, resourceStepIdMap, tasks, taskStepIdMap, guidLog, stepLog,
  );
  const projectCalendarEntityForGuid = entities.find(e => e.type === 'IFCWORKCALENDAR');
  if (projectCalendarEntityForGuid) {
    calendarIdByGuid.set(stripQuotes(projectCalendarEntityForGuid.args[CALENDAR_SLOT.globalId] || ''), calendar.id);
    const projectCalendarGuid = ifcSlotText(projectCalendarEntityForGuid.args[CALENDAR_SLOT.globalId]);
    if (projectCalendarGuid) guidLog[ifcObjectSeed('cal', calendar.id)] = projectCalendarGuid;
  }
  applyHourModeIFC(tasks, calendar, resourceCalendars, taskTimeEntities);
  for (const cal of [calendar, ...resourceCalendars]) {
    if (cal.ifcTimePeriods?.[0]) cal.ifcTimePeriods[0].layout = ifcCalendarBandLayout(cal);
  }
  fillEmptyComputedDateSlots(tasks, taskTimeEntities, recordedFields);
  const assignments = extractAssignments(entities, entityMap, taskStepIdMap, resourceStepIdMap);
  normalizeCostResources(resources, assignments);
  reconstructResourceIds(tasks, assignments);
  const libraryPoolOut: { value: import('@/types/library').CompanyPool | undefined } = { value: undefined };
  const projectStartRecorded = { value: false };
  const ifcSchemaMarkers: IfcSchemaMarkers = { confirmed: false };
  const { activityCodeTypes, customFieldDefs } = extractStructure(
    entities, entityMap, project, tasks, taskStepIdMap, libraryPoolOut, projectStartRecorded, ifcSchemaMarkers,
    options.projectDataInSettings === true,
  );
  const ifcSchemaUnconfirmed = ifcSchemaUnconfirmedOnRead(fileSchemaName, ifcSchemaMarkers);
  if (ifcSchemaUnconfirmed) project.ifcSchemaUnconfirmed = ifcSchemaUnconfirmed;
  applyTaskTimeRecords(tasks, taskTimeEntities, calendar, resourceCalendars);
  for (const task of tasks) reconcileP6SuspendResume(task);
  const customTaskTypes = extractTaskTypeMeta(entities, entityMap, tasks, taskStepIdMap);
  extractTimephasedDurationWalksMeta(entities, entityMap, tasks, taskStepIdMap, calendarIdByGuid);
  remapContourResourceIds(tasks, resourceGuidMap, new Set(resources.map(r => r.id)));

  const { baselines, activeBaselineId, comparedBaselineIds, orphanGuids } = extractBaselines(entities, entityMap, taskStepIdMap);

  const schedulingOptions = extractSchedulingOptions(entities, entityMap);
  const sequences = extractSequences(
    entities, entityMap, taskStepIdMap, p6BoundarySequenceGuids, dayMeasureLags, exactMinuteLags, calendar.hoursPerDay, guidLog,
    stepLog,
    (predId, succId) => {
      const mode = schedulingOptions?.lagCalendar;
      if (mode === '24hour') return 24;
      const id = mode === 'successor' ? succId : predId;
      const task = tasks.find(t => t.id === id);
      return effHoursPerDay(mode === 'projectDefault' ? calendar : resolveCalendar(task?.calendarId, resourceCalendars, calendar));
    },
  );
  const schedulingProfile = profileAfterRead(extractSchedulingProfile(entities, entityMap), schedulingOptions);
  if (schedulingProfile) project.schedulingProfile = schedulingProfile;
  const projectOptions = optionKeysOnly(schedulingOptions);
  if (projectOptions) {
    remapLevelingResourceIds(projectOptions, resourceGuidMap, new Set(resources.map(r => r.id)));
    project.schedulingOptions = projectOptions;
  }

  if (project.startDate && !projectStartRecorded.value) {
    const earliestTaskStart = tasks
      .filter(t => (recordedFields[t.id] ?? []).includes('scheduleStart'))
      .map(t => (t.time.scheduleStart ?? '').slice(0, 10))
      .filter(Boolean)
      .sort()[0];
    if (earliestTaskStart && earliestTaskStart < project.startDate) project.startDate = earliestTaskStart;
  }
  const missingDates = emptyMissingScheduleDates();
  for (const t of tasks) {
    const present = recordedFields[t.id] ?? [];
    if (!present.includes('scheduleStart')) missingDates.start.add(t.id);
    if (!present.includes('scheduleFinish')) missingDates.finish.add(t.id);
  }
  const startAnchor = resolveMissingScheduleDates(tasks, missingDates, project.startDate,
    (task) => resolveCalendar(task.calendarId, resourceCalendars, calendar));
  if (!project.startDate && !projectStartRecorded.value) project.startDate = startAnchor;

  // Alleen bladtaken volgen de voortgang-invarianten — ná extractStructure zodat
  // project.statusDate (uit OPS_ProjectSettings) beschikbaar is als fallback voor een ontbrekend werkelijk einde bij openen.
  // `runningStatusIds`: taken met `IfcTask.Status` = 'STARTED' — een lopende taak op 100 % blijft
  // dan lopend (eigenaarsbesluit 2026-10-14). Oude bestanden (`$`) lezen als voorheen.
  normalizeImportedProgress(tasks.filter(isLeafTask), project.statusDate, runningStatusIds);
  for (const task of tasks) {
    if (!isSummaryTask(task)) continue;
    const t = task.time;
    task.status = t.actualFinish ? 'COMPLETED'
      : t.actualStart || t.completion > 0 ? 'STARTED' : 'NOT_STARTED';
  }

  const ifcGlobalIds = collectIfcGlobalIds(entities, entityMap, taskStepIdMap, project.id, guidLog);
  if (options.stepIdsOut && stepLog) {
    Object.assign(options.stepIdsOut, collectIfcStepIds(entities, taskStepIdMap, resourceStepIdMap, project.id, calendar.id, stepLog));
  }

  const timeModel = entities.filter(e => e.type === 'IFCPROPERTYSET' && stripQuotes(e.args[2] || '') === PSET.Project)
    .flatMap(e => parseRefs(e.args[4] || '').map(id => entityMap.get(id)))
    .filter((e): e is StepEntity => !!e && stripQuotes(e.args[0] || '') === PROP.Project.TimeModel)
    .map(e => parseTypedValue(e.args[2] || '')).find((value): value is string => typeof value === 'string');
  const ifcLiteralCalendarIds = [...new Set([calendar, ...resourceCalendars].filter(cal => literalTimeCalendars.has(cal)).map(cal => cal.id))];
  return {
    project, calendar, tasks, sequences, resources, assignments,
    ...(timeModel ? { timeModel } : {}),
    milestonesAtDayEnd: new Set(tasks.filter(milestoneWasAtDayEnd).map(task => task.id)),
    activityCodeTypes, customFieldDefs, customTaskTypes, resourceCalendars,
    baselines, activeBaselineId, comparedBaselineIds,
    libraryPool: libraryPoolOut.value,
    recordedFields,
    ...(recordedTimes ? { recordedTimes, recordedTimesOrigin: 'xer-archive' as const }
      : { recordedTimesOrigin: ownAuthored ? 'ifc-own' as const : 'ifc' as const }),
    ...(importPristine !== undefined ? { importPristine } : {}),
    ...(recordedSourceFormat ? { recordedSourceFormat } : {}),
    ...(recoveryForeignSource ? { recoveryForeignSource } : {}),
    ...(xerSourceArchive ? { xerSourceArchive } : {}),
    ...(xerSourceProjectId ? { xerSourceProjectId } : {}),
    ...(xer ? { xer, xerOrigin: 'xer-archive' as const } : {}),
    ...(xerArchiveIssue ? { xerArchiveIssue } : {}),
    ...(ifcGlobalIds ? { ifcGlobalIds } : {}),
    ...(Object.keys(orphanGuids).length > 0 ? { baselineOrphanGuids: orphanGuids } : {}),
    ...(ifcLiteralCalendarIds.length > 0 ? { ifcLiteralCalendarIds } : {}),
  };
}

function collectIfcGlobalIds(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
  projectId: string,
  guidLog: Record<string, string>,
): Record<string, string> | undefined {
  const out: Record<string, string> = { ...guidLog };
  for (const [stepId, taskId] of taskStepIdMap) {
    const guid = ifcSlotText(entityMap.get(stepId)?.args[TASK_SLOT.globalId]);
    if (guid) out[ifcObjectSeed('task', taskId)] = guid;
  }
  const proj = entities.find(e => e.type === 'IFCPROJECT');
  const projectGuid = proj ? ifcSlotText(proj.args[0]) : '';
  if (projectGuid) out[ifcObjectSeed('proj', projectId)] = projectGuid;
  const plan = entities.find(e => e.type === 'IFCWORKPLAN');
  const planGuid = plan ? ifcSlotText(plan.args[WORK_CONTROL_SLOT.globalId]) : '';
  if (planGuid) out[ifcObjectSeed('wp', projectId)] = planGuid;
  const schedule = entities.find(e => e.type === 'IFCWORKSCHEDULE' && !isBaselineSchedule(e));
  const scheduleGuid = schedule ? ifcSlotText(schedule.args[WORK_CONTROL_SLOT.globalId]) : '';
  if (scheduleGuid) out[ifcObjectSeed('ws', projectId)] = scheduleGuid;
  return Object.keys(out).length > 0 ? out : undefined;
}

function stableIdFromGuid(
  kind: 'res' | 'cal' | 'seq',
  prefix: string,
  entity: StepEntity,
  usedIds: Set<string>,
  guidLog: Record<string, string>,
  stepLog?: Record<string, string>,
): string {
  const guid = ifcSlotText(entity.args[0]);
  const base = guid ? `${prefix}-ifc-${guid}` : `${prefix}-ifc-step-${entity.id}`;
  let id = base;
  for (let duplicate = 2; usedIds.has(id); duplicate++) id = `${base}-dup-${duplicate}`;
  usedIds.add(id);
  if (guid) guidLog[ifcObjectSeed(kind, id)] = guid;
  if (stepLog) stepLog[ifcObjectSeed(kind, id)] = entity.id;
  return id;
}

function collectIfcStepIds(
  entities: StepEntity[],
  taskStepIdMap: ReadonlyMap<string, string>,
  resourceStepIdMap: ReadonlyMap<string, string>,
  projectId: string,
  projectCalendarId: string,
  stepLog: Readonly<Record<string, string>>,
): Record<string, string> {
  const out: Record<string, string> = { ...stepLog };
  for (const [stepId, taskId] of taskStepIdMap) out[ifcObjectSeed('task', taskId)] = stepId;
  for (const [stepId, resourceId] of resourceStepIdMap) out[ifcObjectSeed('res', resourceId)] = stepId;
  const calendar = entities.find(e => e.type === 'IFCWORKCALENDAR');
  if (calendar) out[ifcObjectSeed('cal', projectCalendarId)] = calendar.id;
  const proj = entities.find(e => e.type === 'IFCPROJECT');
  if (proj) out[ifcObjectSeed('proj', projectId)] = proj.id;
  const plan = entities.find(e => e.type === 'IFCWORKPLAN');
  if (plan) out[ifcObjectSeed('wp', projectId)] = plan.id;
  const schedule = entities.find(e => e.type === 'IFCWORKSCHEDULE' && !isBaselineSchedule(e));
  if (schedule) out[ifcObjectSeed('ws', projectId)] = schedule.id;
  return out;
}

function mappedResourceId(
  resourceGuidMap: Map<string, string>, resourceIds: ReadonlySet<string>, writtenId: string,
): string | undefined {
  if (resourceIds.has(writtenId)) return writtenId;
  return resourceGuidMap.get(ifcGuid128(ifcObjectSeed('res', writtenId))) ?? resourceGuidMap.get(ifcGuid(writtenId));
}

class XerArchiveInvalid extends Error {
  readonly code: XerArchiveIssueCode;
  constructor(code: XerArchiveIssueCode, message: string) {
    super(message);
    this.name = 'XerArchiveInvalid';
    this.code = code;
    Object.setPrototypeOf(this, XerArchiveInvalid.prototype);
  }
}

interface XerArchiveRead {
  source?: XerSourceReconstruction;
  sourceProjectId?: string;
  xer?: XerImportMetadata;
  issue?: XerArchiveIssue;
}

function readXerArchiveOrIssue(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  options: IfcReadOptions,
): XerArchiveRead {
  try {
    const source = extractXerSourceArchive(entities, entityMap, options);
    const sourceProjectId = extractXerSourceProjectId(entities, entityMap, source?.archive);
    const xer = extractXerImportMetadata(source?.archive, sourceProjectId);
    return { source, sourceProjectId, xer };
  } catch (error) {
    if (error instanceof IfcParseError) throw error;
    if (error instanceof XerArchiveInvalid) return { issue: { code: error.code, detail: capXerArchiveDetail(error.message) } };
    return {
      issue: {
        code: 'structure',
        detail: capXerArchiveDetail(
          `Ongeldig OPS_XerSourceArchive: onverwachte fout bij het lezen: ${error instanceof Error ? error.message : String(error)}`,
        ),
      },
    };
  }
}

const XER_ARCHIVE_DETAIL_MAX = 500;
function capXerArchiveDetail(detail: string): string {
  return detail.length <= XER_ARCHIVE_DETAIL_MAX ? detail : `${detail.slice(0, XER_ARCHIVE_DETAIL_MAX - 1)}…`;
}

function extractXerImportMetadata(
  archive: XerSourceArchive | undefined, sourceProjectId: string | undefined,
): XerImportMetadata | undefined {
  if (!archive || !sourceProjectId) return undefined;
  try {
    return bindXerImportMetadataToArchive(archive, sourceProjectId);
  } catch (error) {
    xerArchiveError(error instanceof Error ? error.message : 'selectorview is ongeldig', 'metadata-invalid');
  }
}

function extractXerSourceProjectId(
  entities: StepEntity[], entityMap: Map<string, StepEntity>, archive: XerSourceArchive | undefined,
): string | undefined {
  const props = archiveProps(entities, entityMap, PSET.XerDocument);
  if (!props) {
    if (archive) xerArchiveError('OPS_XerDocument-selector ontbreekt');
    return undefined;
  }
  if (!archive) xerArchiveError('OPS_XerDocument bestaat zonder OPS_XerSourceArchive', 'bytes-missing');
  if (JSON.stringify([...props.keys()]) !== JSON.stringify([PROP.XerDocument.ArchiveSha256, PROP.XerDocument.SourceProjectId])) {
    xerArchiveError('OPS_XerDocument-properties zijn niet exact en deterministisch geordend');
  }
  if (requiredString(props, PROP.XerDocument.ArchiveSha256) !== archive.sha256) xerArchiveError('selector ArchiveSha256 wijst niet naar het archief', 'hash-mismatch');
  return requiredString(props, PROP.XerDocument.SourceProjectId);
}

function xerArchiveError(message: string, code: XerArchiveIssueCode = 'structure'): never {
  throw new XerArchiveInvalid(code, `Ongeldig OPS_XerSourceArchive: ${message}`);
}

function archiveProps(entities: StepEntity[], entityMap: Map<string, StepEntity>, psetName: string): Map<string, unknown> | undefined {
  const sets = entities.filter(entity => entity.type === 'IFCPROPERTYSET' && stripQuotes(entity.args[2] || '') === psetName);
  if (sets.length === 0) return undefined;
  if (sets.length !== 1) xerArchiveError(`Pset '${psetName}' komt ${sets.length} keer voor`);
  const projects = entities.filter(entity => entity.type === 'IFCPROJECT');
  if (projects.length !== 1) xerArchiveError(`Pset '${psetName}' vereist exact één IFCPROJECT; gevonden: ${projects.length}`);
  const project = projects[0]!;
  const attachments = entities.filter(entity =>
    entity.type === 'IFCRELDEFINESBYPROPERTIES'
    && parseRef(entity.args[5] || '') === sets[0]!.id,
  );
  if (!project || attachments.length !== 1
    || JSON.stringify(parseRefs(attachments[0]!.args[4] || '')) !== JSON.stringify([project.id])) {
    xerArchiveError(`Pset '${psetName}' hangt niet één-op-één aan IFCPROJECT`);
  }
  const values = new Map<string, unknown>();
  for (const ref of parseRefs(sets[0]!.args[4] || '')) {
    const prop = entityMap.get(ref);
    if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') xerArchiveError(`property '${ref}' ontbreekt of is geen single value`);
    const name = stripQuotes(prop.args[0] || '');
    if (!name || values.has(name)) xerArchiveError(`property '${name || ref}' ontbreekt of is dubbel`);
    values.set(name, parseTypedValue(prop.args[2] || ''));
  }
  return values;
}

function validateArchivePropertyOrder(
  props: Map<string, unknown>, manifestNames: readonly string[], chunkCount: number, diagnosticsCount: number,
): void {
  assertSourceBytesPresent(props, chunkCount);
  const propertyBudget = props.size - manifestNames.length;
  if (propertyBudget < 0
    || chunkCount > propertyBudget
    || diagnosticsCount > propertyBudget - chunkCount) {
    xerArchiveError('chunkcounts overschrijden het werkelijk aanwezige propertybudget', 'truncated');
  }
  if (chunkCount + diagnosticsCount !== propertyBudget) {
    xerArchiveError('chunkcounts passen niet exact bij het werkelijk aanwezige propertybudget', 'truncated');
  }
  let position = 0;
  for (const actual of props.keys()) {
    let expected: string;
    if (position < manifestNames.length) {
      expected = manifestNames[position]!;
    } else if (position < manifestNames.length + chunkCount) {
      expected = xerArchiveChunkName(XER_ARCHIVE_CHUNK.bytes, position - manifestNames.length);
    } else {
      expected = xerArchiveChunkName(XER_ARCHIVE_CHUNK.diagnostics, position - manifestNames.length - chunkCount);
    }
    if (actual !== expected) xerArchiveError('properties zijn niet uniek en deterministisch geordend');
    position += 1;
  }
}

function validateCompactArchivePropertyOrder(
  props: Map<string, unknown>, manifestNames: readonly string[], chunkCount: number,
): void {
  assertSourceBytesPresent(props, chunkCount);
  const propertyBudget = props.size - manifestNames.length;
  if (propertyBudget < 0 || chunkCount !== propertyBudget) {
    xerArchiveError('chunkcount past niet exact bij het werkelijk aanwezige propertybudget', 'truncated');
  }
  let position = 0;
  for (const actual of props.keys()) {
    const expected = position < manifestNames.length
      ? manifestNames[position]!
      : xerArchiveChunkName(XER_ARCHIVE_CHUNK.bytes, position - manifestNames.length);
    if (actual !== expected) xerArchiveError('properties zijn niet uniek en deterministisch geordend');
    position += 1;
  }
}

function assertSourceBytesPresent(props: Map<string, unknown>, chunkCount: number): void {
  if (chunkCount === 0) return;
  for (const name of props.keys()) if (isXerArchiveChunkName(name, XER_ARCHIVE_CHUNK.bytes)) return;
  xerArchiveError(`manifest belooft ${chunkCount} bronchunk(s), maar er is er geen enkele aanwezig`, 'bytes-missing');
}

function nonNegativeSafeInteger(value: unknown, name: string, code: XerArchiveIssueCode = 'structure'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) xerArchiveError(`${name} is geen niet-negatief safe integer`, code);
  return value;
}

function requiredString(props: Map<string, unknown>, name: string, code: XerArchiveIssueCode = 'structure'): string {
  const value = props.get(name);
  if (typeof value !== 'string' || !value) xerArchiveError(`${name} ontbreekt of is geen tekenreeks`, code);
  return value;
}

function concatArchiveChunks(props: Map<string, unknown>, prefix: XerArchiveChunkPrefix, count: number, expectedLength: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  for (let index = 0; index < count; index++) {
    const name = xerArchiveChunkName(prefix, index);
    const raw = requiredString(props, name, 'truncated');
    if (index < count - 1 && raw.includes('=')) xerArchiveError(`${name} bevat verboden base64-padding vóór de laatste chunk`);
    let decoded: Uint8Array;
    try { decoded = decodeXerBase64Chunk(raw); } catch { xerArchiveError(`${name} bevat ongeldige base64`); }
    const expectedChunkLength = index === count - 1 ? expectedLength - index * XER_SOURCE_ARCHIVE_CHUNK_BYTES : XER_SOURCE_ARCHIVE_CHUNK_BYTES;
    if (decoded.length !== expectedChunkLength) xerArchiveError(`${name} heeft ${decoded.length} i.p.v. ${expectedChunkLength} bytes`, 'truncated');
    chunks.push(decoded);
  }
  for (const name of props.keys()) {
    if (!name.startsWith(prefix)) continue;
    if (name === `${prefix}Size` || name === `${prefix}Count`) continue;
    const suffix = name.slice(prefix.length);
    if (!/^\d{6}$/.test(suffix) || Number(suffix) >= count) xerArchiveError(`${name} ligt buiten de aaneengesloten chunkreeks`);
  }
  let output: Uint8Array;
  try { output = new Uint8Array(expectedLength); } catch { xerArchiveError('byteLength kan op dit platform niet worden gealloceerd'); }
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

const XA = PROP.XerSourceArchive;

function extractXerSourceArchive(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  options: IfcReadOptions,
): XerSourceReconstruction | undefined {
  const props = archiveProps(entities, entityMap, PSET.XerSourceArchive);
  if (!props) return undefined;
  const schemaVersion = nonNegativeSafeInteger(props.get(XA.SchemaVersion), XA.SchemaVersion, 'schema-version');
  if (schemaVersion === XER_SOURCE_ARCHIVE_COMPACT_STORAGE_SCHEMA_VERSION) {
    return extractCompactXerSourceArchive(props, options.reconstructXerArchive);
  }
  if (schemaVersion === XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_SCHEMA_VERSION) {
    return extractReferencedXerSourceArchive(props, options);
  }
  if (schemaVersion !== XER_SOURCE_ARCHIVE_SCHEMA_VERSION) xerArchiveError(`onbekend SchemaVersion ${schemaVersion}`, 'schema-version');
  if (requiredString(props, XA.Format, 'schema-version') !== 'primavera-p6-xer') xerArchiveError('Format is niet primavera-p6-xer', 'schema-version');
  const byteLength = nonNegativeSafeInteger(props.get(XA.ByteLength), XA.ByteLength);
  const chunkSize = nonNegativeSafeInteger(props.get(XA.ByteChunkSize), XA.ByteChunkSize);
  if (chunkSize !== XER_SOURCE_ARCHIVE_CHUNK_BYTES) xerArchiveError(`ByteChunkSize is niet ${XER_SOURCE_ARCHIVE_CHUNK_BYTES}`);
  const chunkCount = nonNegativeSafeInteger(props.get(XA.ByteChunkCount), XA.ByteChunkCount);
  if (chunkCount !== Math.ceil(byteLength / chunkSize)) xerArchiveError('ByteChunkCount past niet bij ByteLength', 'truncated');
  const diagnosticsLength = nonNegativeSafeInteger(props.get(XA.DiagnosticsByteLength), XA.DiagnosticsByteLength);
  const diagnosticsCount = nonNegativeSafeInteger(props.get(XA.DiagnosticsChunkCount), XA.DiagnosticsChunkCount);
  if (diagnosticsCount !== Math.ceil(diagnosticsLength / chunkSize)) xerArchiveError('DiagnosticsChunkCount past niet bij DiagnosticsByteLength', 'truncated');
  const manifestNames = [
    XA.SchemaVersion, XA.Format, XA.ByteLength, XA.Sha256, XA.Encoding, XA.Bom, XA.Newline,
    XA.ByteChunkSize, XA.ByteChunkCount, XA.DiagnosticsByteLength, XA.DiagnosticsSha256, XA.DiagnosticsChunkCount,
  ];
  validateArchivePropertyOrder(props, manifestNames, chunkCount, diagnosticsCount);
  const sourceBytes = concatArchiveChunks(props, XER_ARCHIVE_CHUNK.bytes, chunkCount, byteLength);
  const diagnosticBytes = concatArchiveChunks(props, XER_ARCHIVE_CHUNK.diagnostics, diagnosticsCount, diagnosticsLength);
  const sourceHash = requiredString(props, XA.Sha256);
  const diagnosticsHash = requiredString(props, XA.DiagnosticsSha256);
  if (!/^[0-9a-f]{64}$/.test(sourceHash) || sha256Hex(sourceBytes) !== sourceHash) xerArchiveError('Sha256 is ongeldig of past niet bij de bytes', 'hash-mismatch');
  if (!/^[0-9a-f]{64}$/.test(diagnosticsHash) || sha256Hex(diagnosticBytes) !== diagnosticsHash) xerArchiveError('DiagnosticsSha256 is ongeldig of past niet bij de diagnostics', 'hash-mismatch');
  let archiveMetadata: XerArchiveMetadataPayloadV1;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(diagnosticBytes));
    archiveMetadata = parseXerArchiveMetadataPayload(parsed);
  } catch (error) {
    if (error instanceof XerArchiveInvalid) throw error;
    xerArchiveError(`diagnostics/readmodel is ongeldig: ${error instanceof Error ? error.message : 'geen geldige JSON'}`, 'metadata-invalid');
  }
  const encoding = requiredString(props, XA.Encoding);
  const bom = requiredString(props, XA.Bom);
  const newline = requiredString(props, XA.Newline);
  if (!(['utf-8', 'utf-16le', 'utf-16be', 'windows-1252'] as readonly string[]).includes(encoding)) xerArchiveError('Encoding is onbekend', 'metadata-invalid');
  if (!(['none', 'utf-8', 'utf-16le', 'utf-16be'] as readonly string[]).includes(bom)) xerArchiveError('Bom is onbekend', 'metadata-invalid');
  if (!(['lf', 'crlf', 'cr', 'mixed', 'none'] as readonly string[]).includes(newline)) xerArchiveError('Newline is onbekend', 'metadata-invalid');
  try {
    return {
      archive: createXerSourceArchiveFromOwnedMetadata(sourceBytes, {
        schemaVersion,
        encoding: encoding as XerSourceArchiveEncoding,
        bom: bom as XerSourceArchiveBom,
        newline: newline as XerSourceArchiveNewline,
        diagnostics: archiveMetadata.diagnostics,
        readModel: archiveMetadata.readModel,
      }),
      recordedTimesByProject: {},
    };
  } catch (error) {
    xerArchiveError(`diagnostics/readmodel kon niet worden opgebouwd: ${error instanceof Error ? error.message : String(error)}`, 'metadata-invalid');
  }
}

function extractReferencedXerSourceArchive(
  props: Map<string, unknown>,
  options: IfcReadOptions,
): XerSourceReconstruction {
  if (requiredString(props, XA.Format, 'schema-version') !== 'primavera-p6-xer') xerArchiveError('Format is niet primavera-p6-xer', 'schema-version');
  if (requiredString(props, XA.StorageFormat, 'schema-version') !== XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_FORMAT) {
    xerArchiveError('StorageFormat is onbekend', 'schema-version');
  }
  const expected = [XA.SchemaVersion, XA.Format, XA.StorageFormat, XA.ByteLength, XA.Sha256];
  if (JSON.stringify([...props.keys()]) !== JSON.stringify(expected)) {
    xerArchiveError('properties van de archiefverwijzing zijn niet exact en deterministisch geordend');
  }
  const byteLength = nonNegativeSafeInteger(props.get(XA.ByteLength), XA.ByteLength);
  const sourceHash = requiredString(props, XA.Sha256);
  if (!/^[0-9a-f]{64}$/.test(sourceHash)) xerArchiveError('Sha256 is ongeldig', 'hash-mismatch');
  const sourceBytes = options.resolveXerArchiveReference?.(sourceHash);
  if (!sourceBytes) {
    xerArchiveError('de crashherstelopslag heeft geen archiefblob voor deze verwijzing', 'bytes-missing');
  }
  if (sourceBytes.byteLength !== byteLength) {
    xerArchiveError(`archiefblob heeft ${sourceBytes.byteLength} i.p.v. ${byteLength} bytes`, 'truncated');
  }
  if (sha256Hex(sourceBytes) !== sourceHash) xerArchiveError('archiefblob past niet bij Sha256', 'hash-mismatch');
  return reconstructVerifiedXerSource(sourceBytes, byteLength, sourceHash, options.reconstructXerArchive);
}

function extractCompactXerSourceArchive(
  props: Map<string, unknown>,
  reconstructXerArchive: XerArchiveReconstructor | undefined,
): XerSourceReconstruction {
  if (requiredString(props, XA.Format, 'schema-version') !== 'primavera-p6-xer') xerArchiveError('Format is niet primavera-p6-xer', 'schema-version');
  if (requiredString(props, XA.StorageFormat, 'schema-version') !== XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT) {
    xerArchiveError('StorageFormat is onbekend', 'schema-version');
  }
  const byteLength = nonNegativeSafeInteger(props.get(XA.ByteLength), XA.ByteLength);
  const chunkSize = nonNegativeSafeInteger(props.get(XA.ByteChunkSize), XA.ByteChunkSize);
  if (chunkSize !== XER_SOURCE_ARCHIVE_CHUNK_BYTES) xerArchiveError(`ByteChunkSize is niet ${XER_SOURCE_ARCHIVE_CHUNK_BYTES}`);
  const chunkCount = nonNegativeSafeInteger(props.get(XA.ByteChunkCount), XA.ByteChunkCount);
  if (chunkCount !== Math.ceil(byteLength / chunkSize)) xerArchiveError('ByteChunkCount past niet bij ByteLength', 'truncated');
  const manifestNames = [
    XA.SchemaVersion, XA.Format, XA.StorageFormat, XA.ByteLength, XA.Sha256, XA.ByteChunkSize, XA.ByteChunkCount,
  ];
  validateCompactArchivePropertyOrder(props, manifestNames, chunkCount);
  const sourceBytes = concatArchiveChunks(props, XER_ARCHIVE_CHUNK.bytes, chunkCount, byteLength);
  const sourceHash = requiredString(props, XA.Sha256);
  if (!/^[0-9a-f]{64}$/.test(sourceHash) || sha256Hex(sourceBytes) !== sourceHash) {
    xerArchiveError('Sha256 is ongeldig of past niet bij de bytes', 'hash-mismatch');
  }
  return reconstructVerifiedXerSource(sourceBytes, byteLength, sourceHash, reconstructXerArchive);
}

function reconstructVerifiedXerSource(
  sourceBytes: Uint8Array,
  byteLength: number,
  sourceHash: string,
  reconstructXerArchive: XerArchiveReconstructor | undefined,
): XerSourceReconstruction {
  if (!reconstructXerArchive) {
    throw new IfcParseError(
      'xer-source-archive',
      'Ongeldig OPS_XerSourceArchive: compacte bron vereist readIFCWithXerReconstruction; de lage ' +
      'synchrone readIFC-ingang laadt de XER-reader bewust niet zelf',
    );
  }
  let reconstruction: XerSourceReconstruction;
  try {
    reconstruction = reconstructXerArchive(sourceBytes);
  } catch (error) {
    xerArchiveError(`compacte bron kon niet worden gereconstrueerd: ${error instanceof Error ? error.message : String(error)}`, 'metadata-invalid');
  }
  const archive = reconstruction.archive;
  if (archive.sha256 !== sourceHash || archive.byteLength !== byteLength) {
    xerArchiveError('gereconstrueerd archief past niet bij de canonieke bronbytes', 'hash-mismatch');
  }
  return reconstruction;
}

const CH_QUOTE = 39;
const CH_SLASH = 47;
const CH_HASH = 35;
const CH_LPAREN = 40;
const CH_RPAREN = 41;
const CH_SEMI = 59;
const CH_EQ = 61;
const CH_E = 69;

function isWordCode(c: number): boolean {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
}
function isSpaceCode(c: number): boolean {
  return c === 32 || (c >= 9 && c <= 13);
}

function skipQuotedOrComment(text: string, i: number, literalStrings = false): number {
  if (text.charCodeAt(i) === CH_QUOTE) {
    const end = stepStringEnd(text, i, literalStrings);
    return end < 0 ? text.length : end + 1;
  }
  return skipStepComment(text, i);
}

function startsWithTokenCI(text: string, i: number, token: string): boolean {
  for (let k = 0; k < token.length; k++) {
    let c = text.charCodeAt(i + k);
    if (c >= 0x61 && c <= 0x7a) c -= 0x20;
    if (c !== token.charCodeAt(k)) return false;
  }
  return true;
}

function indexOfCode(text: string, token: string, from: number, literalStrings = false): number {
  const first = token.charCodeAt(0);
  for (let i = from; i < text.length;) {
    let c = text.charCodeAt(i);
    if (c === CH_QUOTE || c === CH_SLASH) {
      const skip = skipQuotedOrComment(text, i, literalStrings);
      if (skip >= 0) { i = skip; continue; }
    }
    if (c >= 0x61 && c <= 0x7a) c -= 0x20;
    if (c === first && startsWithTokenCI(text, i, token)) return i;
    i++;
  }
  return -1;
}

function stripStepComments(text: string, literalStrings: boolean): string {
  if (text.indexOf('/') < 0) return text;
  let out = '';
  let copiedFrom = 0;
  for (let i = 0; i < text.length;) {
    const c = text.charCodeAt(i);
    if (c === CH_QUOTE) { i = skipQuotedOrComment(text, i, literalStrings); continue; }
    const commentEnd = c === CH_SLASH ? skipStepComment(text, i) : -1;
    if (commentEnd >= 0) {
      out += text.slice(copiedFrom, i);
      i = commentEnd;
      copiedFrom = i;
      continue;
    }
    i++;
  }
  return out + text.slice(copiedFrom);
}

function readEntity(text: string, at: number, out: StepEntity[], literalStrings: boolean): number {
  const n = text.length;
  let i = at + 1;
  const idStart = i;
  while (i < n && isWordCode(text.charCodeAt(i))) i++;
  if (i === idStart) return -1;
  const id = text.slice(idStart, i);

  while (i < n && isSpaceCode(text.charCodeAt(i))) i++;
  if (text.charCodeAt(i) !== CH_EQ) return -1;
  i++;
  while (i < n && isSpaceCode(text.charCodeAt(i))) i++;

  const typeStart = i;
  while (i < n && isWordCode(text.charCodeAt(i))) i++;
  if (i === typeStart) return -1;
  const type = text.slice(typeStart, i);

  while (i < n && isSpaceCode(text.charCodeAt(i))) i++;
  if (text.charCodeAt(i) !== CH_LPAREN) return -1;
  const argsStart = i + 1;

  let depth = 0;
  let argsEnd = -1;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (c === CH_QUOTE || c === CH_SLASH) {
      const skip = skipQuotedOrComment(text, i, literalStrings);
      if (skip >= 0) { i = skip; continue; }
    }
    if (c === CH_LPAREN) depth++;
    else if (c === CH_RPAREN) {
      depth--;
      if (depth === 0) { argsEnd = i; i++; break; }
    }
    i++;
  }
  if (argsEnd < 0) return -1;

  while (i < n && isSpaceCode(text.charCodeAt(i))) i++;
  if (text.charCodeAt(i) !== CH_SEMI) return -1;
  i++;

  out.push({
    id,
    type: type.toUpperCase(),
    args: splitArgs(text.slice(argsStart, argsEnd), literalStrings),
    raw: text.slice(at, i),
  });
  return i;
}

function indexOfDataSection(content: string, literalStrings = false): number {
  return indexOfStepDataSection(content, literalStrings);
}

function parseSTEP(content: string, literalStrings: boolean): StepEntity[] {
  const entities: StepEntity[] = [];
  const dataAt = indexOfDataSection(content, literalStrings);
  if (dataAt < 0) {
    throw new IfcParseError(
      'no-data-section',
      "Onleesbaar IFC-bestand: de verplichte 'DATA;'-sectiegrens ontbreekt.",
    );
  }

  const clean = stripStepComments(content.slice(dataAt + 'DATA;'.length), literalStrings);

  for (let i = 0; i < clean.length;) {
    const c = clean.charCodeAt(i);
    if (c === CH_QUOTE) { i = skipQuotedOrComment(clean, i, literalStrings); continue; }
    if (c === CH_HASH) {
      const next = readEntity(clean, i, entities, literalStrings);
      i = next > 0 ? next : i + 1;
      continue;
    }
    if (c === CH_E && clean.startsWith('ENDSEC;', i)) break;
    i++;
  }

  return entities;
}

export function readFileSchemaName(content: string, literalStrings?: boolean): string | undefined {
  if (literalStrings === undefined) {
    const grammar = stepFileGrammar(content);
    literalStrings = grammar.failed || grammar.literalStrings;
  }
  const dataAt = indexOfDataSection(content, literalStrings);
  const header = dataAt >= 0 ? content.slice(0, dataAt) : content;
  let name: string | undefined;
  const at = indexOfCode(header, 'FILE_SCHEMA', 0, literalStrings);
  if (at >= 0) {
    const m = /^FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/i.exec(header.slice(at));
    name = m?.[1];
  }
  if (name === undefined) name = /^[ \t]*FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/im.exec(header)?.[1];
  return cleanIfcSchemaName(name);
}

export function readFileSchema(content: string): IfcSchemaId | undefined {
  const name = readFileSchemaName(content);
  return isIfcSchemaId(name) ? name : undefined;
}

function isBaselineSchedule(e: StepEntity): boolean {
  return (e.args[workControlSlots(e.args).predefinedType] || '').includes('BASELINE');
}

function splitArgs(argsStr: string, literalStrings = true): string[] {
  const args: string[] = [];
  let segStart = 0;
  let depth = 0;
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === "'") {
      i = skipQuotedOrComment(argsStr, i, literalStrings) - 1;
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
    } else if (ch === ',' && depth === 0) {
      args.push(argsStr.slice(segStart, i).trim());
      segStart = i + 1;
    }
  }
  const tail = argsStr.slice(segStart).trim();
  if (tail) args.push(tail);
  return args;
}

function stringsAreStepEncoded(entities: StepEntity[]): boolean {
  for (const e of entities) {
    if (e.type === 'IFCAPPLICATION' && stripQuotes(e.args[3] || '') === 'OPS') {
      return stripQuotes(e.args[1] || '') !== OPS_LEGACY_LITERAL_APP_VERSION;
    }
  }
  return !isOpsAuthoredIfc(entities);
}

function decodeEntityStrings(entities: StepEntity[], literalStrings: boolean): void {
  for (const e of entities) {
    const args = e.args;
    for (let k = 0; k < args.length; k++) {
      if (args[k].indexOf('\\') >= 0) args[k] = decodeQuotedSegments(args[k], literalStrings);
    }
  }
}

function decodeQuotedSegments(arg: string, literalStrings: boolean): string {
  let out = '';
  let i = 0;
  while (i < arg.length) {
    const open = arg.indexOf("'", i);
    if (open < 0) { out += arg.slice(i); break; }
    out += arg.slice(i, open + 1);
    const close = stepStringEnd(arg, open, literalStrings);
    const j = close < 0 ? arg.length : close;
    const body = arg.slice(open + 1, j);
    out += body.indexOf('\\') >= 0
      ? decodeStepText(unescapeStepQuotes(body, literalStrings)).replace(/'/g, "''")
      : body;
    if (j < arg.length) out += "'";
    i = j + 1;
  }
  return out;
}

export { decodeStepText } from './stepText';

function stripQuotes(s: string): string {
  if (s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

function ifcSlotText(s: string | undefined): string {
  if (!s || s === '$') return '';
  return stripQuotes(s);
}

function parseRef(s: string): string | null {
  const m = s.trim().match(/^#(\w+)$/);
  return m ? m[1] : null;
}

function parseRefs(s: string): string[] {
  const refs: string[] = [];
  const matches = s.matchAll(/#(\w+)/g);
  for (const m of matches) {
    refs.push(m[1]);
  }
  return refs;
}

function parseDateFromIFC(s: string): string {
  if (!s || s === '$') return localTodayIso();
  const clean = stripQuotes(s);
  return clean.substring(0, 10);
}

function parseDurationDays(s: string, hoursPerDay: number): number {
  if (!s || s === '$') return 0;
  const duration = parseIfcDuration(stripQuotes(s));
  return duration.days + (duration.timeMinutes ?? 0) / (hoursPerDay * 60);
}

function isoDurationLeadingDays(iso: string): number {
  return !iso || iso === '$' ? 0 : parseIfcDuration(iso).days;
}

function parseTaskType(s: string): TaskType {
  const clean = s.replace(/\./g, '').trim();
  return TASK_TYPES.includes(clean as TaskType) ? (clean as TaskType) : 'CONSTRUCTION';
}

function parseSequenceType(s: string): SequenceType {
  const clean = s.replace(/\./g, '').trim();
  const map: Record<string, SequenceType> = {
    'FINISH_START': 'FINISH_START',
    'START_START': 'START_START',
    'FINISH_FINISH': 'FINISH_FINISH',
    'START_FINISH': 'START_FINISH',
  };
  return map[clean] || 'FINISH_START';
}

function extractProject(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  labels: ImportLabels,
  options: IfcReadOptions,
): Project {
  const proj = entities.find(e => e.type === 'IFCPROJECT');
  const wp = entities.find(e => e.type === 'IFCWORKPLAN');
  const wpSlots = workControlSlots(wp?.args ?? []);
  const wpTime = (slot: number): string => {
    const raw = (wp?.args[slot] ?? '').trim();
    return raw.startsWith("'") ? raw : '';
  };
  const wpStart = wpTime(wpSlots.startTime);
  const wpFinish = wpTime(wpSlots.finishTime);
  const projectGlobalId = proj ? ifcSlotText(proj.args[0]) : '';

  let author = '';
  let company = '';
  const preferProjectOwner = options.planningTaskStepIds !== undefined;
  const ownOwner = (object: StepEntity | undefined): StepEntity | undefined => {
    const history = entityMap.get(parseRef(object?.args[1] ?? '') ?? '');
    if (history?.type !== 'IFCOWNERHISTORY') return undefined;
    const app = entityMap.get(parseRef(history.args[1] ?? '') ?? '');
    return app?.type === 'IFCAPPLICATION' && ifcSlotText(app.args[3]) === 'OPS' ? history : undefined;
  };
  const owner = (preferProjectOwner ? ownOwner(proj) ?? ownOwner(wp) : undefined)
    ?? entities.find(e => e.type === 'IFCOWNERHISTORY');
  if (owner) {
    const po = entityMap.get(parseRef(owner.args[0] || '') || '');
    if (po && po.type === 'IFCPERSONANDORGANIZATION') {
      const person = entityMap.get(parseRef(po.args[0] || '') || '');
      if (person && person.type === 'IFCPERSON') author = ifcSlotText(person.args[1]);
      const org = entityMap.get(parseRef(po.args[1] || '') || '');
      if (org && org.type === 'IFCORGANIZATION') company = ifcSlotText(org.args[1]);
    }
  }
  if (preferProjectOwner || options.projectDataInSettings === true) {
    for (const set of entities) {
      if (set.type !== 'IFCPROPERTYSET' || stripQuotes(set.args[2] || '') !== PSET.ProjectSettings) continue;
      for (const ref of parseRefs(set.args[4] || '')) {
        const prop = entityMap.get(ref);
        if (prop?.type !== 'IFCPROPERTYSINGLEVALUE') continue;
        const name = stripQuotes(prop.args[0] || '');
        if (name !== PROP.ProjectSettings.Author && name !== PROP.ProjectSettings.Organization) continue;
        const value = parseTypedValue(prop.args[2] || '');
        if (name === PROP.ProjectSettings.Author) author = typeof value === 'string' ? value : '';
        else company = typeof value === 'string' ? value : '';
      }
    }
  }

  return {
    id: projectGlobalId
      ? `proj-ifc-${projectGlobalId}`
      : `proj-ifc-step-${proj?.id ?? wp?.id ?? 'missing'}`,
    name: proj ? ifcSlotText(proj.args[2]) : (labels.importedProject || DEFAULT_IMPORTED_PROJECT_NAME),
    description: ifcSlotText(wp?.args[wpSlots.description]) || ifcSlotText(proj?.args[3]),
    startDate: ifcSlotText(wpStart) ? parseDateFromIFC(wpStart) : '',
    endDate: ifcSlotText(wpFinish) ? parseDateFromIFC(wpFinish) : '',
    calendarId: 'cal-default',
    createdAt: options.projectTimestampFallback?.createdAt ?? new Date().toISOString(),
    modifiedAt: options.projectTimestampFallback?.modifiedAt ?? new Date().toISOString(),
    author,
    company,
  };
}

function extractCalendar(entities: StepEntity[], entityMap: Map<string, StepEntity>): WorkCalendar {
  const cal = entities.find(e => e.type === 'IFCWORKCALENDAR');
  if (!cal) return createDefaultCalendar();
  return buildCalendarFromEntity(cal, entityMap, entities);
}

function applyHourModeIFC(
  tasks: Task[],
  projectCal: WorkCalendar,
  resourceCalendars: WorkCalendar[],
  taskTimeEntities: Map<string, StepEntity>,
): void {
  const libById = new Map(resourceCalendars.map(c => [c.id, c]));
  const effCalOf = (t: Task): WorkCalendar => (t.calendarId && libById.get(t.calendarId)) || projectCal;

  const subDayCals = new Set<WorkCalendar>();
  for (const t of tasks) {
    const e = taskTimeEntities.get(t.id);
    if (!e) continue;
    const effCal = effCalOf(t);
    const durMin = isoDurationToMinutes(stripQuotes(e.args[TASKTIME_SLOT.scheduleDuration] || ''));
    const durSignal = durMin != null && isSubDayMinutes(durMin, effCal.hoursPerDay);
    const dateSignal = [
      TASKTIME_SLOT.scheduleStart, TASKTIME_SLOT.scheduleFinish,
      TASKTIME_SLOT.earlyStart, TASKTIME_SLOT.earlyFinish,
      TASKTIME_SLOT.lateStart, TASKTIME_SLOT.lateFinish,
      TASKTIME_SLOT.actualStart, TASKTIME_SLOT.actualFinish,
    ].some(i => hasNonAnchorTime(stripQuotes(e.args[i] || ''), IFC_TIME_ANCHOR));
    if (durSignal || dateSignal) subDayCals.add(effCal);
  }

  promoteHourCalendars(
    [projectCal, ...resourceCalendars].filter(cal => !declaredScalarCalendars.has(cal)).map(cal => [cal, cal] as const),
    cal => subDayCals.has(cal),
    true,
  );

  for (const t of tasks) {
    const effCal = effCalOf(t);
    const minutePrecise = literalTimeCalendars.has(effCal) || !!effCal.workTime
      || (declaredScalarCalendars.has(effCal) && t.time.durationUnit === 'hours');
    if (!minutePrecise) {
      if (t.time.durationUnit === 'hours' && t.time.durationMinutes != null && effHoursPerDay(effCal) > 0) {
        t.time.scheduleDuration = hourTaskScheduleDuration(t.time.durationMinutes, effCal);
      }
      if (t.time.durationUnit === 'hours') readRemainingMinutes(t, taskTimeEntities.get(t.id));
      continue;
    }
    const e = taskTimeEntities.get(t.id);
    if (!e) continue;
    const durMin = isoDurationToMinutes(stripQuotes(e.args[TASKTIME_SLOT.scheduleDuration] || ''));
    if (t.time.durationUnit === 'hours') {
      const minutes = durMin != null ? durMin : (t.time.durationMinutes ?? 0);
      t.time.durationMinutes = minutes;
      if (effHoursPerDay(effCal) > 0) t.time.scheduleDuration = hourTaskScheduleDuration(minutes, effCal);
    } else {
      t.time.durationMinutes = undefined;
    }
    const toHour = (raw: string | undefined): string | undefined => {
      const q = stripQuotes(raw || '');
      if (!q || q === '$') return undefined;
      if (isDateOnly(q)) return q;
      return formatInstant(parseImportedInstant(q), 'hour');
    };
    const ss = toHour(e.args[TASKTIME_SLOT.scheduleStart]); if (ss) t.time.scheduleStart = ss;
    const sf = toHour(e.args[TASKTIME_SLOT.scheduleFinish]); if (sf) t.time.scheduleFinish = sf;
    const es = toHour(e.args[TASKTIME_SLOT.earlyStart]); if (es) t.time.earlyStart = es;
    const ef = toHour(e.args[TASKTIME_SLOT.earlyFinish]); if (ef) t.time.earlyFinish = ef;
    const ls = toHour(e.args[TASKTIME_SLOT.lateStart]); if (ls) t.time.lateStart = ls;
    const lf = toHour(e.args[TASKTIME_SLOT.lateFinish]); if (lf) t.time.lateFinish = lf;
    const as = toHour(e.args[TASKTIME_SLOT.actualStart]); if (as) t.time.actualStart = as;
    const af = toHour(e.args[TASKTIME_SLOT.actualFinish]); if (af) t.time.actualFinish = af;
    readRemainingMinutes(t, e);
  }
}

function applyTaskTimeRecords(
  tasks: Task[],
  taskTimeEntities: Map<string, StepEntity>,
  projectCal: WorkCalendar,
  resourceCalendars: WorkCalendar[],
): void {
  for (const task of tasks) {
    const e = taskTimeEntities.get(task.id);
    if (!e) continue;
    const t = task.time;
    const durations = readDayMeasureDurations(task);
    const effCal = resolveCalendar(task.calendarId, resourceCalendars, projectCal);
    const minutesPerDay = taskMinutesPerDay(task, effHoursPerDay(effCal));
    const slotDays = (index: number) => isoDurationLeadingDays(stripQuotes(e.args[index] || ''));
    const slotMinutes = (index: number) => {
      const minutes = isoDurationToMinutes(stripQuotes(e.args[index] || ''));
      const days = minutes === null ? 0 : slotDays(index);
      return minutes === null || days === 0 ? minutes : minutes + days * minutesPerDay;
    };
    if (t.durationUnit === 'hours' && slotDays(TASKTIME_SLOT.scheduleDuration) !== 0) {
      const minutes = slotMinutes(TASKTIME_SLOT.scheduleDuration)!;
      t.durationMinutes = minutes;
      if (effHoursPerDay(effCal) > 0) t.scheduleDuration = hourTaskScheduleDuration(minutes, effCal);
    }

    const durationRecord = durations?.ScheduleDuration;
    if (durationRecord && !task.isMilestone && slotMinutes(TASKTIME_SLOT.scheduleDuration) === durationRecord[1]) {
      t.durationUnit = 'days';
      t.scheduleDuration = durationRecord[0];
      delete t.durationMinutes;
    }

    const restMinutes = slotMinutes(TASKTIME_SLOT.remainingTime);
    if (t.durationUnit === 'hours' && restMinutes !== null && slotDays(TASKTIME_SLOT.remainingTime) !== 0) {
      t.remainingMinutes = restMinutes;
      t.remainingTime = hourRemainingDays(t, restMinutes);
    }
    const restRecord = durations?.RemainingTime;
    if (restMinutes !== null && t.durationUnit !== 'hours') {
      if (restRecord && restRecord[1] === restMinutes) t.remainingTime = restRecord[0];
      else if (minutesPerDay > 0) t.remainingTime = restMinutes / minutesPerDay;
      delete t.remainingMinutes;
    } else if (restMinutes !== null && restRecord && !durationRecord && restRecord[1] === restMinutes) {
      t.remainingTime = restRecord[0];
      delete t.remainingMinutes;
    }

    const exactMinutes = readExactMinutes(task);
    if (exactMinutes && t.durationUnit === 'hours') {
      const dur = exactMinutes.ScheduleDuration;
      if (dur && t.durationMinutes !== undefined && slotMinutes(TASKTIME_SLOT.scheduleDuration) === dur[1]) {
        t.durationMinutes = dur[0];
        if (effHoursPerDay(effCal) > 0) t.scheduleDuration = hourTaskScheduleDuration(dur[0], effCal);
      }
      const rest = exactMinutes.RemainingTime;
      if (rest && t.remainingMinutes !== undefined && restMinutes === rest[1]) {
        t.remainingMinutes = rest[0];
        t.remainingTime = hourRemainingDays(t, rest[0]);
      }
    }

    const actualMinutes = slotMinutes(TASKTIME_SLOT.actualDuration);
    const actualRecord = durations?.ActualDuration;
    if (actualMinutes !== null) {
      if (actualRecord && actualRecord[1] === actualMinutes) t.actualDuration = actualRecord[0];
      else if (minutesPerDay > 0) t.actualDuration = actualMinutes / minutesPerDay;
    }

    for (const [slot, field, minuteField] of [
      [TASKTIME_SLOT.totalFloat, 'totalFloat', 'totalFloatMinutes'],
      [TASKTIME_SLOT.freeFloat, 'freeFloat', 'freeFloatMinutes'],
    ] as const) {
      const minutes = slotMinutes(slot);
      if (minutes !== null && minutesPerDay > 0) {
        t[field] = minutes / minutesPerDay;
        t[minuteField] = minutes;
      }
    }

    const floats = readExactFloat(task);
    if (floats) {
      const exact = (key: 'TotalFloat' | 'FreeFloat', slot: number, apply: (days: number, minutes: number | null) => void) => {
        const record = floats[key];
        const raw = e.args[slot];
        if (!record || !raw || raw === '$' || isoDurationToMinutes(stripQuotes(raw)) !== null) return;
        apply(record[0], record[1]);
      };
      exact('TotalFloat', TASKTIME_SLOT.totalFloat, (days, minutes) => {
        if (t.totalFloat !== wholeFloatDays(days)) return;
        t.totalFloat = days;
        if (minutes !== null) t.totalFloatMinutes = minutes;
      });
      exact('FreeFloat', TASKTIME_SLOT.freeFloat, (days, minutes) => {
        if (t.freeFloat !== wholeFloatDays(days)) return;
        t.freeFloat = days;
        if (minutes !== null) t.freeFloatMinutes = minutes;
      });
    }
  }
}

function readRemainingMinutes(t: Task, e: StepEntity | undefined): void {
  const remMin = e ? isoDurationToMinutes(stripQuotes(e.args[TASKTIME_SLOT.remainingTime] || '')) : null;
  if (remMin == null) return;
  t.time.remainingMinutes = remMin;
  if (t.time.durationUnit === 'hours') t.time.remainingTime = hourRemainingDays(t.time, remMin);
}

function recordedSlotsOf(e: StepEntity): RecordedFieldKey[] {
  const out: RecordedFieldKey[] = [];
  for (const key of ALL_RECORDED_SLOT_KEYS) {
    const arg = e.args[TASKTIME_SLOT[key]];
    if (arg && arg !== '$') out.push(key);
  }
  return out;
}

function extractTaskIdentityByStepId(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const { pset, objectRefs } of propertySetRelations(entities, entityMap, PSET.TaskIdentity)) {
    let internalId: string | undefined;
    for (const propRef of parseRefs(pset.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE'
        || stripQuotes(prop.args[0] || '') !== PROP.TaskIdentity.InternalTaskId) continue;
      const value = parseTypedValue(prop.args[2] || '');
      if (isValidPersistedIfcId(value)) internalId = value;
    }
    if (!internalId) continue;
    for (const objectRef of objectRefs) {
      if (entityMap.get(objectRef)?.type === 'IFCTASK') out.set(objectRef, internalId);
    }
  }
  return out;
}

function isValidPersistedIfcId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256
    && !Array.from(value).some(character => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 31 || code === 127;
    });
}

function stableIfcTaskId(
  taskEntity: StepEntity,
  persistedIds: Map<string, string>,
  usedIds: Set<string>,
): string {
  const globalId = ifcSlotText(taskEntity.args[TASK_SLOT.globalId]);
  const base = persistedIds.get(taskEntity.id)
    ?? (globalId ? `task-ifc-${globalId}` : `task-ifc-step-${taskEntity.id}`);
  let id = base;
  for (let duplicate = 2; usedIds.has(id); duplicate++) id = `${base}-dup-${duplicate}`;
  usedIds.add(id);
  return id;
}

function extractTasks(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  baselineTaskStepIds: Set<string> = new Set(),
  persistedIds: Map<string, string> = new Map(),
  hoursPerDay = 8,
): {
  tasks: Task[]; taskStepIdMap: Map<string, string>; taskTimeEntities: Map<string, StepEntity>;
  recordedFields: Record<string, RecordedFieldKey[]>; runningStatusIds: Set<string>;
} {
  const taskEntities = entities.filter(e => e.type === 'IFCTASK' && !baselineTaskStepIds.has(e.id));
  const tasks: Task[] = [];
  const taskStepIdMap = new Map<string, string>();
  const taskTimeEntities = new Map<string, StepEntity>();
  const recordedFields: Record<string, RecordedFieldKey[]> = {};
  const usedIds = new Set<string>();
  const runningStatusIds = new Set<string>();

  for (const te of taskEntities) {
    const id = stableIfcTaskId(te, persistedIds, usedIds);
    taskStepIdMap.set(te.id, id);

    const slots = taskSlots(te.args);

    const taskTimeRef = parseRef(te.args[slots.taskTime] || '');
    const ttEntity = taskTimeRef ? entityMap.get(taskTimeRef) : undefined;
    const time = ttEntity ? parseTaskTime(ttEntity, hoursPerDay) : createDefaultTaskTime(localTodayIso(), 5);
    if (ttEntity) taskTimeEntities.set(id, ttEntity);
    recordedFields[id] = ttEntity ? recordedSlotsOf(ttEntity) : [];

    if (ifcSlotText(te.args[slots.status]) === IFC_TASK_STATUS_RUNNING) runningStatusIds.add(id);

    const isMilestone = te.args[slots.isMilestone]?.includes('T') || false;
    if (isMilestone) time.scheduleDuration = 0;

    const priorityRaw = (te.args[slots.priority] || '').trim();
    let priority = DEFAULT_PRIORITY;
    if (priorityRaw && priorityRaw !== '$') {
      const p = parseInt(priorityRaw, 10);
      priority = Number.isFinite(p) ? p : DEFAULT_PRIORITY;
    }

    tasks.push({
      id,
      name: ifcSlotText(te.args[slots.name]) || 'Naamloze taak',
      description: ifcSlotText(te.args[slots.description]),
      wbsCode: ifcSlotText(te.args[slots.identification]),
      taskType: te.args[slots.predefinedType] ? parseTaskType(te.args[slots.predefinedType]) : 'CONSTRUCTION',
      customTaskTypeId: undefined,
      status: 'NOT_STARTED',
      isMilestone,
      priority,
      parentId: null,
      childIds: [],
      time,
      resourceIds: [],
    });
  }

  return { tasks, taskStepIdMap, taskTimeEntities, recordedFields, runningStatusIds };
}

/** Lees de OPS-catalogus defensief. Zonder metadata blijft een extern/oud USERDEFINED-bestand
 * gewoon USERDEFINED; ObjectType wordt daarbij niet als id geraden. Een geldige `color` blijft precies
 * zoals ze in het bestand staat; zonder (oud bestand, andere schrijver) krijgt de definitie een vaste,
 * vrije kleur (`withTaskTypeColors`, #856), die het volgende opslaan meeschrijft. */
function extractTaskTypeMeta(
  entities: StepEntity[], entityMap: Map<string, StepEntity>, tasks: Task[], taskStepIdMap: Map<string, string>,
): CustomTaskType[] {
  let raw: unknown;
  for (const pset of entities) {
    if (pset.type !== 'IFCPROPERTYSET' || stripQuotes(pset.args[2] || '') !== PSET.TaskTypes) continue;
    for (const ref of parseRefs(pset.args[4] || '')) {
      const prop = entityMap.get(ref);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE' || stripQuotes(prop.args[0] || '') !== PROP.TaskTypes.TaskTypes) continue;
      raw = parseTypedValue(prop.args[2] || '');
    }
  }
  if (typeof raw !== 'string') return [];
  const definitions = readTaskTypeDefinitions(raw, entityMap, tasks, taskStepIdMap);
  return withTaskTypeColors(definitions);
}

function readTaskTypeDefinitions(
  raw: string, entityMap: Map<string, StepEntity>, tasks: Task[], taskStepIdMap: Map<string, string>,
): CustomTaskTypeDraft[] {
  try {
    const parsed = JSON.parse(raw) as { definitions?: unknown; taskTypeIds?: unknown };
    const definitions: CustomTaskTypeDraft[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    if (Array.isArray(parsed.definitions)) {
      for (const rawDefinition of parsed.definitions) {
        if (!rawDefinition || typeof rawDefinition !== 'object'
          || typeof (rawDefinition as CustomTaskType).id !== 'string'
          || typeof (rawDefinition as CustomTaskType).name !== 'string') continue;
        const color = (rawDefinition as { color?: unknown }).color;
        const definition: CustomTaskTypeDraft = {
          id: (rawDefinition as CustomTaskType).id.trim(),
          name: (rawDefinition as CustomTaskType).name.trim(),
          ...(isTaskTypeColor(color) ? { color } : {}),
        };
        const nameKey = definition.name.toLocaleLowerCase();
        if (!definition.id || !definition.name || seenIds.has(definition.id) || seenNames.has(nameKey)) continue;
        seenIds.add(definition.id);
        seenNames.add(nameKey);
        definitions.push(definition);
      }
    }
    if (!parsed.taskTypeIds || typeof parsed.taskTypeIds !== 'object') return definitions;
    const byStep = new Map<string, string>(taskStepIdMap);
    const byTaskId = new Map(tasks.map(t => [t.id, t]));
    for (const [stepId, entity] of entityMap) {
      if (entity.type !== 'IFCTASK') continue;
      const taskId = byStep.get(stepId);
      const typeId = (parsed.taskTypeIds as Record<string, unknown>)[stripQuotes(entity.args[0] || '')];
      const task = taskId ? byTaskId.get(taskId) : undefined;
      if (task && typeof typeId === 'string' && typeId.trim()) {
        task.taskType = 'USERDEFINED';
        task.customTaskTypeId = typeId.trim();
      }
    }
    return definitions;
  } catch { return []; }
}

function workTimeDateRange(wt: StepEntity): { startDate: string; endDate: string } | null {
  const start = optDate(wt.args[4]);
  const end = optDate(wt.args[5]);
  if (!start && !end) return null;
  return { startDate: start ?? end!, endDate: end ?? start! };
}

function fillEmptyComputedDateSlots(
  tasks: Task[],
  taskTimeEntities: Map<string, StepEntity>,
  recordedFields: Record<string, RecordedFieldKey[]>,
): void {
  for (const t of tasks) {
    if (!taskTimeEntities.has(t.id)) continue;
    const present = new Set(recordedFields[t.id] ?? []);
    if (!present.has('earlyStart')) t.time.earlyStart = t.time.scheduleStart;
    if (!present.has('earlyFinish')) t.time.earlyFinish = t.time.scheduleFinish;
    if (!present.has('lateStart')) t.time.lateStart = t.time.scheduleStart;
    if (!present.has('lateFinish')) t.time.lateFinish = t.time.scheduleFinish;
  }
}

function optDate(s: string | undefined): string | undefined {
  return s && s !== '$' ? parseDateFromIFC(s) : undefined;
}
function taskTimeReadHelpers(hoursPerDay: number): TaskTimeReadHelpers {
  return {
    parseDate: (arg) => parseDateFromIFC(arg || ''),
    parseDur: (arg) => parseDurationDays(arg || '', hoursPerDay),
    optDate,
    optDur: (s) => (s && s !== '$' ? parseDurationDays(s, hoursPerDay) : undefined),
  };
}

function parseTaskTime(e: StepEntity, hoursPerDay: number): TaskTime {
  const time = {} as TaskTime;
  const helpers = taskTimeReadHelpers(hoursPerDay);
  for (let i = 0; i < IFC_TASKTIME_SLOTS.length; i++) {
    IFC_TASKTIME_SLOTS[i].read?.(time, e.args[i], helpers);
  }
  const rawDuration = stripQuotes(e.args[TASKTIME_SLOT.scheduleDuration] || '');
  const hasTimeComponent = /^-?P[^T]*T/i.test(rawDuration);
  time.durationUnit = hasTimeComponent ? 'hours' : 'days';
  if (hasTimeComponent) {
    const minutes = isoDurationToMinutes(rawDuration);
    if (minutes != null) time.durationMinutes = minutes;
  }
  return time;
}

function extractSequences(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
  p6BoundarySequenceGuids: ReadonlySet<string>,
  dayMeasureLags: ReadonlyMap<string, DayMeasureRecord>,
  exactMinuteLags: ReadonlyMap<string, ExactMinutesRecord>,
  hoursPerDay: number,
  guidLog: Record<string, string>,
  stepLog: Record<string, string> | undefined,
  lagHoursPerDay: (predId: string, succId: string) => number,
): Sequence[] {
  const seqEntities = entities.filter(e => e.type === 'IFCRELSEQUENCE');
  const sequences: Sequence[] = [];
  const usedIds = new Set<string>();

  for (const se of seqEntities) {
    const predRef = parseRef(se.args[SEQUENCE_SLOT.relatingProcess] || '');
    const succRef = parseRef(se.args[SEQUENCE_SLOT.relatedProcess] || '');
    if (!predRef || !succRef) continue;

    const predId = taskStepIdMap.get(predRef);
    const succId = taskStepIdMap.get(succRef);
    if (!predId || !succId) continue;

    let lagDays = 0;
    let lagUnit: Sequence['lagUnit'];
    let lagPercent: number | undefined;
    let lagMinutes: number | undefined;
    const lagRef = parseRef(se.args[SEQUENCE_SLOT.timeLag] || '');
    if (lagRef) {
      const lagEntity = entityMap.get(lagRef);
      if (lagEntity && lagEntity.type === 'IFCLAGTIME') {
        const lagValue = lagValueSlot(lagEntity.args);
        const durType = (lagEntity.args[lagTimeSlots(lagEntity.args).durationType] || '').trim();
        if (lagValue.kind === LAG_SLOT.ratio) {
          lagPercent = Math.round(parseFloat(lagValue.text) * 100 * 1e6) / 1e6;
        } else {
          const raw = stripQuotes(lagValue.text);
          const timeMinutes = isoDurationToMinutes(raw);
          if (timeMinutes != null) {
            lagMinutes = timeMinutes + isoDurationLeadingDays(raw) * (/ELAPSEDTIME/i.test(durType) ? 1440 : lagHoursPerDay(predId, succId) * 60);
            lagDays = 0;
          } else {
            lagMinutes = undefined;
            lagDays = parseDurationDays(lagValue.text, hoursPerDay);
          }
        }
        if (/ELAPSEDTIME/i.test(durType)) lagUnit = 'ELAPSEDTIME';
      }
    }
    const dayRecord = dayMeasureLags.get(stripQuotes(se.args[SEQUENCE_SLOT.globalId] || ''));
    if (dayRecord && lagMinutes !== undefined && lagPercent === undefined && lagMinutes === dayRecord[1]) {
      lagDays = dayRecord[0];
      lagMinutes = undefined;
    }
    const exactRecord = exactMinuteLags.get(stripQuotes(se.args[SEQUENCE_SLOT.globalId] || ''));
    if (exactRecord && lagMinutes !== undefined && lagPercent === undefined && lagMinutes === exactRecord[1]) {
      lagMinutes = exactRecord[0];
    }

    const seq: Sequence = {
      id: stableIdFromGuid('seq', 'seq', se, usedIds, guidLog, stepLog),
      predecessorId: predId,
      successorId: succId,
      type: parseSequenceType(se.args[SEQUENCE_SLOT.sequenceType] || ''),
      lagDays,
    };
    if (lagUnit) seq.lagUnit = lagUnit;
    if (lagPercent !== undefined) seq.lagPercent = lagPercent;
    if (lagMinutes !== undefined) seq.lagMinutes = lagMinutes;
    if (p6BoundarySequenceGuids.has(stripQuotes(se.args[SEQUENCE_SLOT.globalId] || ''))) {
      seq.p6StartAtPredecessorFinishBoundary = true;
    }
    sequences.push(seq);
  }

  return sequences;
}

function extractSequenceMeta(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  liveTaskStepIds: ReadonlySet<string>,
): { boundaryGuids: Set<string>; dayMeasureLags: Map<string, DayMeasureRecord>; exactMinuteLags: Map<string, ExactMinutesRecord> } {
  const relevantScheduleIds = new Set<string>();
  for (const entity of entities) {
    if (entity.type === 'IFCRELNESTS') {
      const scheduleId = parseRef(entity.args[4] || '');
      const schedule = scheduleId ? entityMap.get(scheduleId) : undefined;
      if (schedule?.type === 'IFCWORKSCHEDULE' && !isBaselineSchedule(schedule)
        && parseRefs(entity.args[5] || '').some(id => liveTaskStepIds.has(id))) {
        relevantScheduleIds.add(scheduleId!);
      }
    } else if (entity.type === 'IFCRELASSIGNSTOCONTROL') {
      const scheduleId = parseRef(entity.args[6] || '');
      const schedule = scheduleId ? entityMap.get(scheduleId) : undefined;
      if (schedule?.type === 'IFCWORKSCHEDULE' && !isBaselineSchedule(schedule)
        && parseRefs(entity.args[4] || '').some(id => liveTaskStepIds.has(id))) {
        relevantScheduleIds.add(scheduleId!);
      }
    }
  }

  const accepted: Set<string>[] = [];
  const acceptedDayMeasure: Map<string, DayMeasureRecord>[] = [];
  const acceptedExactMinutes: Map<string, ExactMinutesRecord>[] = [];
  for (const { pset: entity, objectRefs: owners } of propertySetRelations(entities, entityMap, PSET.Sequences)) {
    if (owners.length !== 1 || !relevantScheduleIds.has(owners[0])) continue;
    for (const propRef of parseRefs(entity.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      const propName = stripQuotes(prop.args[0] || '');
      if (propName === DAY_MEASURE_LAGS_PROP) {
        const records = parseDayMeasureLags(parseTypedValue(prop.args[2] || ''));
        if (records) acceptedDayMeasure.push(records);
        continue;
      }
      if (propName === EXACT_MINUTE_LAGS_PROP) {
        const records = parseDayMeasureLags(parseTypedValue(prop.args[2] || ''));
        if (records) acceptedExactMinutes.push(records);
        continue;
      }
      if (propName !== PROP.Sequences.P6StartAtPredecessorFinishBoundarySequenceGuids) continue;
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string') continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every(value => typeof value === 'string' && value.length > 0)) {
          accepted.push(new Set(parsed));
        }
      } catch { }
    }
  }
  return {
    boundaryGuids: accepted.length === 1 ? accepted[0] : new Set(),
    dayMeasureLags: acceptedDayMeasure.length === 1 ? acceptedDayMeasure[0] : new Map(),
    exactMinuteLags: acceptedExactMinutes.length === 1 ? acceptedExactMinutes[0] : new Map(),
  };
}

function parseTypedValue(s: string): CustomFieldValue | undefined {
  const m = (s || '').trim().match(/^IFC\w+\s*\(([\s\S]*)\)$/i);
  if (!m) return undefined;
  const inner = m[1].trim();
  if (inner === '.T.') return true;
  if (inner === '.F.') return false;
  if (inner.startsWith("'")) return stripQuotes(inner);
  const n = parseFloat(inner);
  return Number.isFinite(n) ? n : undefined;
}

interface IfcSchemaMarkers {
  confirmed: boolean;
  unconfirmed?: string;
}

function extractStructure(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  project: Project,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
  libraryPoolOut: { value: import('@/types/library').CompanyPool | undefined },
  projectStartRecorded: { value: boolean },
  ifcSchemaMarkers: IfcSchemaMarkers,
  projectDataInSettings: boolean,
): { activityCodeTypes: ActivityCodeType[]; customFieldDefs: CustomFieldDef[] } {
  let activityCodeTypes: ActivityCodeType[] = [];
  let customFieldDefs: CustomFieldDef[] = [];

  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== PSET.StructureMeta) continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string') continue;
      try {
        const meta = JSON.parse(raw);
        if (Array.isArray(meta.activityCodeTypes)) activityCodeTypes = meta.activityCodeTypes;
        if (Array.isArray(meta.customFieldDefs)) customFieldDefs = meta.customFieldDefs;
      } catch { }
    }
  }

  if (activityCodeTypes.length === 0 && customFieldDefs.length === 0) {
    for (const e of entities) {
      if (e.type !== 'IFCPROPERTYSETTEMPLATE') continue;
      const setName = stripQuotes(e.args[2] || '');
      for (const tmplRef of parseRefs(e.args[6] || '')) {
        const tmpl = entityMap.get(tmplRef);
        if (!tmpl || tmpl.type !== 'IFCSIMPLEPROPERTYTEMPLATE') continue;
        const name = stripQuotes(tmpl.args[2] || '');
        const templateType = (tmpl.args[4] || '').replace(/\./g, '').trim();
        if (setName === PSET.CustomFields && templateType === 'P_SINGLEVALUE') {
          const measure = stripQuotes(tmpl.args[5] || '').toLowerCase();
          customFieldDefs.push({ id: generateId('cfd'), name, type: MEASURE_TO_FIELD[measure] ?? 'text' });
        } else if (setName === PSET.ActivityCodes && templateType === 'P_ENUMERATEDVALUE') {
          const enumEntity = entityMap.get(parseRef(tmpl.args[7] || '') || '');
          const values = enumEntity && enumEntity.type === 'IFCPROPERTYENUMERATION'
            ? splitArgs((enumEntity.args[1] || '').replace(/^\(|\)$/g, ''))
                .map(v => parseTypedValue(v))
                .filter((v): v is string => typeof v === 'string')
                .map(code => ({ id: generateId('acv'), code }))
            : [];
          activityCodeTypes.push({ id: generateId('act'), name, values });
        }
      }
    }
  }

  const typeByName = new Map(activityCodeTypes.map(t => [t.name, t]));
  const defByName = new Map(customFieldDefs.map(d => [d.name, d]));
  const taskById = new Map(tasks.map(t => [t.id, t]));

  for (const { pset, name: psetName, objectRefs } of propertySetRelations(entities, entityMap)) {
    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p);

    const perTask = PER_TASK_PSET_BY_NAME.get(psetName);
    if (perTask) {
      const singleValueProps = props
        .filter(p => p.type === 'IFCPROPERTYSINGLEVALUE')
        .map(p => ({ name: stripQuotes(p.args[0] || ''), value: parseTypedValue(p.args[2] || ''), raw: p.args[2] || '' }));
      for (const objRef of objectRefs) {
        const taskId = taskStepIdMap.get(objRef);
        const task = taskId ? taskById.get(taskId) : undefined;
        if (task) perTask.apply(task, singleValueProps);
      }
      continue;
    }

    if (psetName === PSET.Library) {
      for (const prop of props) {
        if (prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
        if (stripQuotes(prop.args[0] || '') !== PROP.Library.pool) continue;
        const v = parseTypedValue(prop.args[2] || '');
        if (typeof v === 'string' && v) {
          try {
            libraryPoolOut.value = JSON.parse(v) as import('@/types/library').CompanyPool;
          } catch { }
        }
      }
      continue;
    }

    if (psetName === PSET.ProjectSettings) {
      for (const prop of props) {
        if (prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
        const name = stripQuotes(prop.args[0] || '');
        const v = parseTypedValue(prop.args[2] || '');
        if (name === PROP.ProjectSettings.InternalProjectId) {
          if (isValidPersistedIfcId(v)) project.id = v;
        } else if (name === PROP.ProjectSettings.wbsAutoNumber) {
          if (typeof v === 'boolean') project.wbsAutoNumber = v;
        } else if (name === PROP.ProjectSettings.DefaultTaskDurationUnit) {
          if (v === 'days' || v === 'hours') project.defaultTaskDurationUnit = v;
        } else if (name === PROP.ProjectSettings.DefaultWorkRule) {
          if (typeof v === 'string' && (WORK_RULES as readonly string[]).includes(v)) project.defaultWorkRule = v as WorkRule;
        } else if (name === PROP.ProjectSettings.StatusDate) {
          if (typeof v === 'string' && v) project.statusDate = readIfcDate(prop.args[2] || '', v, importStatusDate);
        } else if (name === PROP.ProjectSettings.ProgressMode) {
          if (v === 'PROGRESS_OVERRIDE' || v === 'RETAINED_LOGIC') project.progressMode = v;
        } else if (name === PROP.ProjectSettings.ProjectStartDate || name === PROP.ProjectSettings.ProjectEndDate) {
          const date = typeof v !== 'string' ? '' : readIfcDate(prop.args[2] || '', v, (x) => x.substring(0, 10));
          if (name === PROP.ProjectSettings.ProjectStartDate) { project.startDate = date; projectStartRecorded.value = true; }
          else project.endDate = date;
        } else if (name === PROP.ProjectSettings.CreatedAt) {
          if (typeof v === 'string' && v) project.createdAt = v;
        } else if (name === PROP.ProjectSettings.ModifiedAt) {
          if (typeof v === 'string' && v) project.modifiedAt = v;
        } else if (name === PROP.ProjectSettings.CompanyId) {
          if (typeof v === 'string' && v) project.companyId = v;
        } else if (name === PROP.ProjectSettings.CompanyName) {
          if (typeof v === 'string' && v) project.companyName = v;
        } else if (name === PROP.ProjectSettings.IfcSchemaConfirmed) {
          if (v === true) ifcSchemaMarkers.confirmed = true;
        } else if (name === PROP.ProjectSettings.IfcSchemaUnconfirmed) {
          if (typeof v === 'string' && v) ifcSchemaMarkers.unconfirmed = v;
        } else if (name === PROP.ProjectSettings.P6ProjectCode) {
          if (typeof v === 'string' && v) project.p6ProjectCode = v;
        } else if (name === PROP.ProjectSettings.DependentProjectsFolder) {
          if (typeof v === 'string' && v) project.dependentProjectsFolder = v;
        } else if (name === PROP.ProjectSettings.AnchorsFromOpenDocuments) {
          if (v === true) project.anchorsFromOpenDocuments = true;
        } else if (projectDataInSettings && name === PROP.ProjectSettings.ProjectName) {
          project.name = typeof v === 'string' ? v : '';
        } else if (projectDataInSettings && name === PROP.ProjectSettings.ProjectDescription) {
          project.description = typeof v === 'string' ? v : '';
        }
      }
      continue;
    }

    if (psetName !== PSET.CustomFields && psetName !== PSET.ActivityCodes) continue;
    for (const objRef of objectRefs) {
      const taskId = taskStepIdMap.get(objRef);
      const task = taskId ? taskById.get(taskId) : undefined;
      if (!task) continue;
      const explicitValueIds = new Map<string, string>();
      if (psetName === PSET.ActivityCodes) {
        for (const prop of props) {
          const name = stripQuotes(prop.args[0] || '');
          if (prop.type !== 'IFCPROPERTYSINGLEVALUE' || !name.endsWith(ACTIVITY_CODE_ID_SUFFIX)) continue;
          const id = parseTypedValue(prop.args[2] || '');
          if (typeof id === 'string') explicitValueIds.set(name.slice(0, -ACTIVITY_CODE_ID_SUFFIX.length), id);
        }
      }
      for (const prop of props) {
        const name = stripQuotes(prop.args[0] || '');
        if (psetName === PSET.CustomFields && prop.type === 'IFCPROPERTYSINGLEVALUE') {
          const def = defByName.get(name);
          const parsed = parseTypedValue(prop.args[2] || '');
          const value = def?.type === 'date' && typeof parsed === 'string' ? readIfcDate(prop.args[2] || '', parsed) : parsed;
          if (def && value !== undefined) {
            task.customFields = { ...(task.customFields ?? {}), [def.id]: value };
          }
        } else if (psetName === PSET.ActivityCodes && prop.type === 'IFCPROPERTYENUMERATEDVALUE') {
          const type = typeByName.get(name);
          const codes = splitArgs((prop.args[2] || '').replace(/^\(|\)$/g, ''))
            .map(v => parseTypedValue(v))
            .filter((v): v is string => typeof v === 'string');
          const explicitId = explicitValueIds.get(name);
          const value = (explicitId !== undefined ? type?.values.find(v => v.id === explicitId && v.code === codes[0]) : undefined)
            ?? type?.values.find(v => v.code === codes[0]);
          if (type && value) {
            task.activityCodes = { ...(task.activityCodes ?? {}), [type.id]: value.id };
          }
        }
      }
    }
  }

  return { activityCodeTypes, customFieldDefs };
}

function extractNesting(
  entities: StepEntity[],
  _entityMap: Map<string, StepEntity>,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
): void {
  const nestEntities = entities.filter(e => e.type === 'IFCRELNESTS');
  const taskById = new Map<string, Task>(tasks.map(t => [t.id, t]));
  const childIdsByParent = new Map<Task, Set<string>>();

  for (const ne of nestEntities) {
    const parentRef = parseRef(ne.args[4] || '');
    if (!parentRef) continue;
    const parentId = taskStepIdMap.get(parentRef);
    if (!parentId) continue;
    const parent = taskById.get(parentId);
    if (!parent) continue;

    let childIds = childIdsByParent.get(parent);
    if (!childIds) {
      childIds = new Set(parent.childIds);
      childIdsByParent.set(parent, childIds);
    }
    const childRefs = parseRefs(ne.args[5] || '');
    for (const childRef of childRefs) {
      const childId = taskStepIdMap.get(childRef);
      if (!childId) continue;
      const child = taskById.get(childId);
      if (!child) continue;
      child.parentId = parentId;
      if (!childIds.has(childId)) {
        childIds.add(childId);
        parent.childIds.push(childId);
      }
    }
  }
}

function extractResources(
  entities: StepEntity[],
  _entityMap: Map<string, StepEntity>,
  guidLog: Record<string, string>,
): { resources: Resource[]; resourceStepIdMap: Map<string, string>; resourceGuidMap: Map<string, string> } {
  const resources: Resource[] = [];
  const usedIds = new Set<string>();
  const resourceStepIdMap = new Map<string, string>();
  const resourceGuidMap = new Map<string, string>();

  for (const e of entities) {
    const mappedType = IFC_TO_RESOURCE_TYPE[e.type];
    if (!mappedType) continue;
    const resType: ResourceType = mappedType === 'MATERIAL'
      && ifcSlotText(e.args[RESOURCE_SLOT.objectType]) === COST_RESOURCE_OBJECT_TYPE
      && (e.args[RESOURCE_SLOT.predefinedType] ?? '').trim().toUpperCase() === '.USERDEFINED.'
      ? 'COST'
      : mappedType;

    const id = stableIdFromGuid('res', 'res', e, usedIds, guidLog);
    resourceStepIdMap.set(e.id, id);
    resourceGuidMap.set(stripQuotes(e.args[RESOURCE_SLOT.globalId] || ''), id);

    resources.push({
      id,
      name: ifcSlotText(e.args[RESOURCE_SLOT.name]) || 'Resource',
      type: resType,
      description: ifcSlotText(e.args[RESOURCE_SLOT.description]),
      maxUnits: 1,
    });
  }

  return { resources, resourceStepIdMap, resourceGuidMap };
}

function extractResourceMeta(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  resources: Resource[],
  resourceStepIdMap: Map<string, string>,
  resourceGuidMap: Map<string, string>,
): void {
  const resourceById = new Map(resources.map(r => [r.id, r]));
  for (const { pset, objectRefs } of propertySetRelations(entities, entityMap, PSET.Resource)) {
    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');

    for (const objRef of objectRefs) {
      const resId = resourceStepIdMap.get(objRef);
      const res = resId ? resourceById.get(resId) : undefined;
      if (!res) continue;

      for (const prop of props) {
        const name = stripQuotes(prop.args[0] || '');
        const value = parseTypedValue(prop.args[2] || '');
        if (name === PROP.Resource.MaxUnits && typeof value === 'number') {
          res.maxUnits = value;
        } else if (name === PROP.Resource.CostPerHour && typeof value === 'number') {
          res.costPerHour = value;
        } else if (name === PROP.Resource.UnitOfMeasure && typeof value === 'string') {
          res.unitOfMeasure = value;
        } else if (name === PROP.Resource.Color && typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)) {
          res.color = value;
        } else if (name === PROP.Resource.AvailabilitySteps && typeof value === 'string') {
          const steps: AvailabilityStep[] = value
            .split(';')
            .map(pair => {
              const [from, maxUnitsStr] = pair.split(':');
              return { from: (from || '').trim(), maxUnits: parseFloat(maxUnitsStr) };
            })
            .filter(s => s.from && Number.isFinite(s.maxUnits));
          if (steps.length > 0) res.availabilitySteps = steps;
        } else if (name === PROP.Resource.ParentGuid && typeof value === 'string' && !res.parentId) {
          const parentId = resourceGuidMap.get(value);
          if (parentId) res.parentId = parentId;
        } else if (name === PROP.Resource.LibraryOrigin && typeof value === 'string' && value && !res.libraryOrigin) {
          try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed.companyId === 'string' && typeof parsed.libraryItemId === 'string'
                && typeof parsed.poolVersion === 'number') {
              if ('syncedHash' in parsed && typeof parsed.syncedHash !== 'string') delete parsed.syncedHash;
              res.libraryOrigin = parsed;
            }
          } catch { }
        }
      }
    }
  }
}

function extractCrewNesting(
  entities: StepEntity[],
  resources: Resource[],
  resourceStepIdMap: Map<string, string>,
): void {
  const resourceById = new Map(resources.map(r => [r.id, r]));
  for (const ne of entities) {
    if (ne.type !== 'IFCRELNESTS') continue;
    const parentRef = parseRef(ne.args[4] || '');
    if (!parentRef) continue;
    const parentId = resourceStepIdMap.get(parentRef);
    if (!parentId) continue;

    const childRefs = parseRefs(ne.args[5] || '');
    for (const childRef of childRefs) {
      const childId = resourceStepIdMap.get(childRef);
      const child = childId ? resourceById.get(childId) : undefined;
      if (child) child.parentId = parentId;
    }
  }
}

function parseIntList(s: string): number[] {
  const inner = (s || '').trim().replace(/^\(|\)$/g, '');
  if (!inner) return [];
  return inner.split(',').map(x => parseInt(x.trim(), 10)).filter(Number.isFinite);
}

interface PropertySetRelation {
  pset: StepEntity;
  name: string;
  objectRefs: readonly string[];
}

interface PropertySetIndex {
  all: PropertySetRelation[];
  byName: Map<string, PropertySetRelation[]>;
  calendarsByTarget: Map<string, PropertySetRelation[]>;
}

const propertySetRelationIndex = new WeakMap<StepEntity[], PropertySetIndex>();
function propertySets(entities: StepEntity[], entityMap: Map<string, StepEntity>): PropertySetIndex {
  let index = propertySetRelationIndex.get(entities);
  if (!index) {
    index = { all: [], byName: new Map(), calendarsByTarget: new Map() };
    for (const rel of entities) {
      if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
      const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
      if (!pset || pset.type !== 'IFCPROPERTYSET') continue;
      const entry = { pset, name: stripQuotes(pset.args[2] || ''), objectRefs: parseRefs(rel.args[4] || '') };
      index.all.push(entry);
      let named = index.byName.get(entry.name);
      if (!named) { named = []; index.byName.set(entry.name, named); }
      named.push(entry);
      if (entry.name === PSET.Calendar) {
        for (const target of new Set(entry.objectRefs)) {
          let targets = index.calendarsByTarget.get(target);
          if (!targets) { targets = []; index.calendarsByTarget.set(target, targets); }
          targets.push(entry);
        }
      }
    }
    propertySetRelationIndex.set(entities, index);
  }
  return index;
}

function propertySetRelations(
  entities: StepEntity[], entityMap: Map<string, StepEntity>, name?: string,
): readonly PropertySetRelation[] {
  const index = propertySets(entities, entityMap);
  return name === undefined ? index.all : index.byName.get(name) ?? [];
}

function* opsCalendarPsetProps(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): Generator<StepEntity[]> {
  for (const { pset } of propertySets(entities, entityMap).calendarsByTarget.get(calStepId) ?? []) {
    yield parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');
  }
}

function extractCalendarGeneration(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): CalendarGeneration | undefined {
  for (const props of opsCalendarPsetProps(calStepId, entities, entityMap)) {
    let ruleSetId: HolidayCountry | undefined;
    let region: string | undefined;
    let breakChoice: CalendarGeneration['breakChoice'];
    let generatedFromYear: number | undefined;
    let generatedToYear: number | undefined;
    for (const prop of props) {
      const name = stripQuotes(prop.args[0] || '');
      const value = parseTypedValue(prop.args[2] || '');
      if (name === PROP.Calendar.RuleSetId && typeof value === 'string') ruleSetId = value as HolidayCountry;
      else if (name === PROP.Calendar.Region && typeof value === 'string') region = value;
      else if (name === PROP.Calendar.BreakChoice && typeof value === 'string') breakChoice = value as CalendarGeneration['breakChoice'];
      else if (name === PROP.Calendar.GeneratedFromYear && typeof value === 'number') generatedFromYear = value;
      else if (name === PROP.Calendar.GeneratedToYear && typeof value === 'number') generatedToYear = value;
    }
    if (!ruleSetId || generatedFromYear === undefined || generatedToYear === undefined) continue;

    return {
      ruleSetId,
      ...(region ? { region } : {}),
      ...(breakChoice ? { breakChoice } : {}),
      generatedFromYear,
      generatedToYear,
    };
  }
  return undefined;
}

function extractCalendarLibraryOrigin(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): LibraryOrigin | undefined {
  for (const props of opsCalendarPsetProps(calStepId, entities, entityMap)) {
    for (const prop of props) {
      if (stripQuotes(prop.args[0] || '') !== PROP.Calendar.LibraryOrigin) continue;
      const value = parseTypedValue(prop.args[2] || '');
      if (typeof value !== 'string' || !value) continue;
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed.companyId === 'string' && typeof parsed.libraryItemId === 'string'
            && typeof parsed.poolVersion === 'number') {
          if ('syncedHash' in parsed && typeof parsed.syncedHash !== 'string') delete parsed.syncedHash;
          return parsed as LibraryOrigin;
        }
      } catch { }
    }
  }
  return undefined;
}

function extractCalendarHoursPerDay(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): number | undefined {
  for (const props of opsCalendarPsetProps(calStepId, entities, entityMap)) {
    for (const prop of props) {
      if (stripQuotes(prop.args[0] || '') !== PROP.Calendar.HoursPerDay) continue;
      const value = parseTypedValue(prop.args[2] || '');
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    }
  }
  return undefined;
}

function extractCalendarSimpleBreak(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): Pick<WorkCalendar, 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'> {
  const result: Pick<WorkCalendar, 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'> = {};
  for (const props of opsCalendarPsetProps(calStepId, entities, entityMap)) {
    for (const prop of props) {
      const value = parseTypedValue(prop.args[2] || '');
      if (typeof value !== 'number' || !Number.isInteger(value)) continue;
      if (stripQuotes(prop.args[0] || '') === PROP.Calendar.SimpleBreakStart) result.simpleBreakStartMinute = value;
      if (stripQuotes(prop.args[0] || '') === PROP.Calendar.SimpleBreakDuration) result.simpleBreakDurationMinutes = value;
    }
  }
  return result;
}

function extractCalendarHourMeta(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): { hourMode?: boolean; literalTimes?: boolean } & Partial<Pick<WorkCalendar, 'workStartHour' | 'workEndHour'>> {
  const result: { hourMode?: boolean; literalTimes?: boolean } & Partial<Pick<WorkCalendar, 'workStartHour' | 'workEndHour'>> = {};
  for (const props of opsCalendarPsetProps(calStepId, entities, entityMap)) {
    for (const prop of props) {
      const name = stripQuotes(prop.args[0] || '');
      const value = parseTypedValue(prop.args[2] || '');
      if (name === PROP.Calendar.LiteralTimes && value === true) result.literalTimes = true;
      else if (name === PROP.Calendar.IsHourCalendar && typeof value === 'boolean') result.hourMode = value;
      else if (name === PROP.Calendar.WorkStartHour && typeof value === 'number' && value >= 0 && value <= 24) {
        result.workStartHour = value;
      } else if (name === PROP.Calendar.WorkEndHour && typeof value === 'number' && value >= 0 && value <= 24) {
        result.workEndHour = value;
      }
    }
  }
  return result;
}

function legacyScalarFromEffectiveBands(
  periods: { start: number; end: number }[],
  calendar: WorkCalendar,
  hoursPerDayProp: number | undefined,
): Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'hoursPerDay'> | undefined {
  const hasSimpleBreak = calendar.simpleBreakStartMinute !== undefined
    || calendar.simpleBreakDurationMinutes !== undefined;
  if (hoursPerDayProp === undefined && !hasSimpleBreak) return undefined;
  if (periods.length !== 2) return undefined;
  const bands = canonicalizeBands({ 1: periods }).bands.byWeekday[1];
  const start = bands[0].start;
  const end = bands[bands.length - 1].end;
  if (end > 24 * 60) return undefined;
  const hoursPerDay = hoursPerDayProp ?? (end - start) / 60;
  const reseeded = seedScalarBands(
    start, end, hoursPerDay, calendar.simpleBreakStartMinute, calendar.simpleBreakDurationMinutes,
  );
  if (JSON.stringify(reseeded) !== JSON.stringify(bands)) return undefined;
  return { workStartHour: start / 60, workEndHour: end / 60, hoursPerDay };
}

const declaredScalarCalendars = new WeakSet<WorkCalendar>();
const literalTimeCalendars = new WeakSet<WorkCalendar>();

function extractCalendarExceptionMetadata(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): {
  workingExceptionIds?: Set<string>;
  workingExceptionKeys?: Set<string>;
  p6Source?: 'XER';
  p6NonWorkPenaltyDates?: string[];
  p6NonWorkPenaltyDatesState?: import('@/types/calendar').P6NonWorkPenaltyDatesState;
} {
  for (const props of opsCalendarPsetProps(calStepId, entities, entityMap)) {
    const result: {
      workingExceptionIds?: Set<string>;
      workingExceptionKeys?: Set<string>;
      p6Source?: 'XER';
      p6NonWorkPenaltyDates?: string[];
      p6NonWorkPenaltyDatesState?: import('@/types/calendar').P6NonWorkPenaltyDatesState;
    } = {};
    let p6SourceSeen = false;
    let rejectedDiagnosticSeen = false;
    let penaltyState: import('@/types/calendar').P6NonWorkPenaltyDatesState = 'ABSENT';
    let candidatePenaltyDates: string[] | undefined;
    for (const prop of props) {
      const name = stripQuotes(prop.args[0] || '');
      if (name !== PROP.Calendar.WorkingExceptionIds && name !== PROP.Calendar.WorkingExceptionKeysV1 && name !== PROP.Calendar.P6Source
        && name !== PROP.Calendar.P6NonWorkPenaltyDates && name !== PROP.Calendar.P6NonWorkPenaltyDatesState) continue;
      if (name === PROP.Calendar.WorkingExceptionKeysV1) result.workingExceptionKeys = new Set();
      const value = parseTypedValue(prop.args[2] || '');
      if (typeof value !== 'string' || !value) continue;
      if (name === PROP.Calendar.P6NonWorkPenaltyDatesState) {
        if (value === 'REJECTED') rejectedDiagnosticSeen = true;
        continue;
      }
      if (name === PROP.Calendar.P6Source) {
        if (value === 'XER') p6SourceSeen = true;
        continue;
      }
      try {
        const parsed = JSON.parse(value);
        if (name === PROP.Calendar.WorkingExceptionKeysV1
          && Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
          result.workingExceptionKeys = new Set(parsed);
        } else if (name === PROP.Calendar.WorkingExceptionIds
          && Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
          result.workingExceptionIds = new Set(parsed);
        } else if (name === PROP.Calendar.P6NonWorkPenaltyDates && Array.isArray(parsed)) {
          const dates = parsed.filter((candidate): candidate is string => {
            if (typeof candidate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return false;
            const date = new Date(`${candidate}T00:00:00Z`);
            return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate;
          });
          if (dates.length === parsed.length) {
            candidatePenaltyDates = [...new Set(dates)];
            penaltyState = candidatePenaltyDates.length === 0 ? 'VALID_EMPTY' : 'VALID_VALUES';
          } else {
            penaltyState = 'REJECTED';
          }
        } else if (name === PROP.Calendar.P6NonWorkPenaltyDates) {
          penaltyState = 'REJECTED';
        }
      } catch {
        if (name === PROP.Calendar.P6NonWorkPenaltyDates) penaltyState = 'REJECTED';
      }
    }
    if (!rejectedDiagnosticSeen && p6SourceSeen
      && (penaltyState === 'VALID_EMPTY' || penaltyState === 'VALID_VALUES')) {
      result.p6Source = 'XER';
      result.p6NonWorkPenaltyDates = candidatePenaltyDates ?? [];
      result.p6NonWorkPenaltyDatesState = penaltyState;
    } else if (rejectedDiagnosticSeen || p6SourceSeen) {
      result.p6NonWorkPenaltyDatesState = rejectedDiagnosticSeen ? 'REJECTED' : penaltyState;
    }
    return result;
  }
  return {};
}

function unionPeriods(list: ReadonlyArray<{ start: number; end: number }>): { start: number; end: number }[] {
  const sorted = list
    .map(p => ({ start: p.start, end: p.end <= p.start ? p.end + 24 * 60 : p.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: { start: number; end: number }[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && p.start < last.end) last.end = Math.max(last.end, p.end);
    else out.push({ ...p });
  }
  return out;
}

function buildCalendarFromEntity(
  cal: StepEntity,
  entityMap: Map<string, StepEntity>,
  entities: StepEntity[],
): WorkCalendar {
  const calendar = createDefaultCalendar();
  const calSlots = workCalendarSlots(cal.args);
  calendar.name = ifcSlotText(cal.args[calSlots.name]) || calendar.name;
  calendar.description = ifcSlotText(cal.args[calSlots.description]);
  Object.assign(calendar, extractCalendarSimpleBreak(cal.id, entities, entityMap));
  const hourMeta = extractCalendarHourMeta(cal.id, entities, entityMap);

  const workTimeRefs = parseRefs(cal.args[calSlots.workingTimes] || '');
  const recurrences: StepEntity[] = [];
  const datedRecurrences: StepEntity[] = [];
  for (const wtRef of workTimeRefs) {
    const wt = entityMap.get(wtRef);
    if (!wt || wt.type !== 'IFCWORKTIME') continue;
    const recurrenceRef = parseRef(wt.args[3] || '');
    if (!recurrenceRef) continue;
    const rec = entityMap.get(recurrenceRef);
    if (!rec || rec.type !== 'IFCRECURRENCEPATTERN') continue;
    (workTimeDateRange(wt) ? datedRecurrences : recurrences).push(rec);
  }
  if (recurrences.length === 0 && datedRecurrences.length > 0) recurrences.push(datedRecurrences[0]);
  const weekRecurrences = recurrences.filter(rec => parseIntList(rec.args[2] || '').length > 0);
  const sourcePeriods: (NonNullable<WorkCalendar['ifcTimePeriods']>[number] & { days: readonly number[] })[] = [];
  let secondPrecisionWeek = false;
  let legacyBandWeek = false;
  const readPeriod = (tp: StepEntity, days: readonly number[] = [], binding = ''): { start: number; end: number } | null => {
    const startText = stripQuotes(tp.args[0] || '');
    const endText = stripQuotes(tp.args[1] || '');
    const start = parseIfcClock(startText);
    const end = parseIfcClock(endText);
    const s = start?.minutes ?? clockToMinutes(startText);
    const e = end?.minutes ?? clockToMinutes(endText);
    if (s == null || e == null) return null;
    if (days.length > 0 && (start?.hasSeconds || end?.hasSeconds)) secondPrecisionWeek = true;
    if (days.length > 0 && (start?.legacyBand || end?.legacyBand)) legacyBandWeek = true;
    if (!start || !end || start.preserve || end.preserve || start.hasSeconds || end.hasSeconds) {
      const source = { start: s, end: e <= s ? e + 1440 : e, startText, endText, days, binding };
      if (!sourcePeriods.some(p => JSON.stringify(p) === JSON.stringify(source))) sourcePeriods.push(source);
    }
    return { start: s, end: e };
  };
  const readPeriods = (timePeriodRefs: string[], days: readonly number[]): { start: number; end: number }[] => {
    const out: { start: number; end: number }[] = [];
    for (const tpRef of timePeriodRefs) {
      const tp = entityMap.get(tpRef);
      if (!tp || tp.type !== 'IFCTIMEPERIOD') continue;
      const period = readPeriod(tp, days);
      if (period) out.push(period);
    }
    return out;
  };
  let periods: { start: number; end: number }[] = [];
  const rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  const perDayWeek = weekRecurrences.length > 1;
  if (perDayWeek) {
    const listsByDay = new Map<number, { start: number; end: number }[][]>();
    for (const rec of weekRecurrences) {
      const recPeriods = readPeriods(parseRefs(rec.args[7] || ''), parseIntList(rec.args[2] || ''));
      for (const d of parseIntList(rec.args[2] || '')) {
        if (d < 1 || d > 7) continue;
        const lists = listsByDay.get(d) ?? [];
        lists.push(recPeriods);
        listsByDay.set(d, lists);
      }
    }
    const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
    for (const [d, lists] of listsByDay) {
      const dayPeriods = lists.length === 1 ? lists[0].map(p => ({ ...p })) : unionPeriods(lists.flat());
      byWeekday[d as 1] = dayPeriods;
      rawByWeekday[d as 1] = dayPeriods;
    }
    const unionDays = [...listsByDay.keys()].sort((a, b) => a - b);
    if (unionDays.length > 0) calendar.workDays = unionDays;
    periods = (firstBlockedDay({ byWeekday }) ?? []).map(p => ({ ...p }));
    if (periods.length === 1) {
      const startHour = periods[0].start / 60;
      const endHour = periods[0].end / 60;
      calendar.workStartHour = startHour;
      calendar.workEndHour = endHour;
      if (endHour > startHour) calendar.hoursPerDay = endHour - startHour;
    }
  } else if (recurrences.length > 0) {
    const rec = recurrences[0];
    const workDays = parseIntList(rec.args[2] || '');
    if (workDays.length > 0) calendar.workDays = workDays;

    const timePeriodRefs = parseRefs(rec.args[7] || '');
    periods = readPeriods(timePeriodRefs, workDays.length > 0 ? workDays : calendar.workDays);
    if (timePeriodRefs.length === 1 && periods.length === 1) {
      const startHour = periods[0].start / 60;
      const endHour = periods[0].end / 60;
      calendar.workStartHour = startHour;
      calendar.workEndHour = endHour;
      if (endHour > startHour) calendar.hoursPerDay = endHour - startHour;
    }
    const days = (workDays.length > 0 ? workDays : calendar.workDays).filter(d => d >= 1 && d <= 7);
    for (const d of days) rawByWeekday[d as 1] = periods.map(p => ({ ...p }));
  } else {
    for (const d of calendar.workDays.filter(d => d >= 1 && d <= 7)) rawByWeekday[d as 1] = [];
  }
  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  const blocked = periods.length > 1 ? workDayFromBlocks(periods) : undefined;
  const netHours = blocked && hourMeta.hourMode !== false ? blocked.netHours : undefined;
  if (blocked) {
    calendar.workStartHour = blocked.startHour;
    calendar.workEndHour = blocked.endHour;
    calendar.hoursPerDay = netHours ?? (blocked.endHour > blocked.startHour ? blocked.endHour - blocked.startHour : calendar.hoursPerDay);
  }
  if (hourMeta.workStartHour !== undefined || hourMeta.workEndHour !== undefined) {
    if (hourMeta.workStartHour !== undefined) calendar.workStartHour = hourMeta.workStartHour;
    if (hourMeta.workEndHour !== undefined) calendar.workEndHour = hourMeta.workEndHour;
    if (netHours !== undefined) calendar.hoursPerDay = netHours;
    else if (calendar.workEndHour > calendar.workStartHour) {
      calendar.hoursPerDay = calendar.workEndHour - calendar.workStartHour;
    }
  }

  registerCalendarBands(calendar, { canonical: bands, deviates });

  const predef = (cal.args[calSlots.predefinedType] || '').toUpperCase();
  if (predef.includes('SECONDSHIFT')) calendar.shift = 'SECOND';
  else if (predef.includes('THIRDSHIFT')) calendar.shift = 'THIRD';
  else if (predef.includes('USERDEFINED')) calendar.shift = 'USERDEFINED';

  const calendarExceptionMetadata = extractCalendarExceptionMetadata(cal.id, entities, entityMap);
  const workingExceptionIds = calendarExceptionMetadata.workingExceptionIds;
  const exceptionRefs = parseRefs(cal.args[calSlots.exceptionTimes] || '');
  const holidays: Holiday[] = [];
  const workingExceptions: WorkingException[] = [];
  for (const ref of exceptionRefs) {
    const wt = entityMap.get(ref);
    if (!wt || wt.type !== 'IFCWORKTIME') continue;
    const range = workTimeDateRange(wt);
    if (!range) continue;
    const bands: { start: number; end: number }[] = [];
    const sourceClocks: [string, string][] = [];
    const excRecRef = parseRef(wt.args[3] || '');
    if (excRecRef) {
      const excRec = entityMap.get(excRecRef);
      if (excRec && excRec.type === 'IFCRECURRENCEPATTERN') {
        for (const bRef of parseRefs(excRec.args[7] || '')) {
          const tp = entityMap.get(bRef);
          if (!tp || tp.type !== 'IFCTIMEPERIOD') continue;
          const period = readPeriod(tp, [], `exception:${JSON.stringify([range.startDate, range.endDate, ifcSlotText(wt.args[0]) || 'Werkende uitzondering'])}:${bands.length}`);
          if (period) {
            bands.push({ start: period.start, end: period.end <= period.start ? period.end + 1440 : period.end });
            sourceClocks.push([stripQuotes(tp.args[0] || ''), stripQuotes(tp.args[1] || '')]);
          }
        }
      }
    }
    const stableKeys = calendarExceptionMetadata.workingExceptionKeys;
    const recurrence = excRecRef ? entityMap.get(excRecRef) : undefined;
    const identity = { name: ifcSlotText(wt.args[0]), ...range, bands };
    const isWorking = stableKeys !== undefined
      ? recurrence?.type === 'IFCRECURRENCEPATTERN' && recurrence.args[0] === '.DAILY.'
        && (stableKeys.has(calendarExceptionKey(identity))
          || stableKeys.has(calendarExceptionKeyFromClocks(identity, sourceClocks)))
      : workingExceptionIds?.has(ref);
    if (!isWorking) {
      holidays.push({ name: ifcSlotText(wt.args[0]) || 'Feestdag', ...range });
      continue;
    }
    workingExceptions.push({
      name: ifcSlotText(wt.args[0]) || 'Werkende uitzondering',
      ...range,
      ...(bands.length > 0 ? { bands } : {}),
    });
  }
  calendar.holidays = holidays;
  if (workingExceptions.length > 0) calendar.workingExceptions = workingExceptions;
  if (calendarExceptionMetadata.p6Source === 'XER') {
    calendar.p6Source = 'XER';
    calendar.p6NonWorkPenaltyDates = calendarExceptionMetadata.p6NonWorkPenaltyDates ?? [];
  }
  if (calendarExceptionMetadata.p6NonWorkPenaltyDatesState) {
    calendar.p6NonWorkPenaltyDatesState = calendarExceptionMetadata.p6NonWorkPenaltyDatesState;
  }

  delete calendar.generation;
  if (hourMeta.literalTimes) literalTimeCalendars.add(calendar);
  calendar.generation = extractCalendarGeneration(cal.id, entities, entityMap);
  calendar.libraryOrigin = extractCalendarLibraryOrigin(cal.id, entities, entityMap);

  const hpdOverride = extractCalendarHoursPerDay(cal.id, entities, entityMap);
  if (hpdOverride != null) calendar.hoursPerDay = hpdOverride;
  const scalarSeconds = secondPrecisionWeek && !legacyBandWeek && hourMeta.hourMode !== true
    && periods.length === 1 && !perDayWeek && !deviates;
  if (scalarSeconds) {
    if (hpdOverride == null && calendar.simpleBreakDurationMinutes === undefined) calendar.simpleBreakDurationMinutes = 0;
    declaredScalarCalendars.add(calendar);
  } else if (hourMeta.hourMode === true || ((secondPrecisionWeek || legacyBandWeek) && hourMeta.hourMode !== false)) {
    promoteHourCalendar(calendar, getCalendarBands(calendar), true, true);
    if (hpdOverride != null) calendar.hoursPerDay = hpdOverride;
  } else if (hourMeta.hourMode === false) {
    declaredScalarCalendars.add(calendar);
  } else if (hourMeta.workStartHour === undefined && hourMeta.workEndHour === undefined) {
    const legacy = legacyScalarFromEffectiveBands(periods, calendar, hpdOverride);
    if (legacy) {
      Object.assign(calendar, legacy);
      declaredScalarCalendars.add(calendar);
    }
  }

  const bound: NonNullable<WorkCalendar['ifcTimePeriods']> = [];
  for (const [day, list] of Object.entries(bands.byWeekday)) {
    list.forEach((band, index) => {
      const origins = sourcePeriods.filter(p => p.days.includes(Number(day)));
      const start = origins.find(p => p.start === band.start);
      const end = origins.find(p => p.end === band.end);
      if (start || end) bound.push({
        binding: `week:${day}:${index}`, start: band.start, end: band.end,
        startText: start?.startText ?? '', endText: end?.endText ?? '',
      });
    });
  }
  for (const source of sourcePeriods.filter(p => p.binding)) {
    const { days: _, ...record } = source;
    bound.push(record);
  }
  if (!calendar.workTime && periods.length === 1 && !perDayWeek) {
    const first = periods[0];
    const source = sourcePeriods.find(p => p.days.length > 0 && p.start === first.start);
    if (source) bound.push({
      binding: 'scalar', start: source.start, end: source.end,
      startText: source.startText, endText: source.endText,
      scalarStart: calendar.workStartHour, scalarEnd: calendar.workEndHour,
    });
  }
  if (bound.length > 0) calendar.ifcTimePeriods = bound;

  return calendar;
}

function extractCalendarLibrary(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  resources: Resource[],
  resourceStepIdMap: Map<string, string>,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
  guidLog: Record<string, string>,
  stepLog?: Record<string, string>,
): { calendars: WorkCalendar[]; idByGuid: Map<string, string> } {
  const projectCalendarEntity = entities.find(e => e.type === 'IFCWORKCALENDAR');
  const usedIds = new Set<string>([DEFAULT_CALENDAR_ID]);
  const resourceById = new Map(resources.map(r => [r.id, r]));
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const calendars: WorkCalendar[] = [];
  const calByStepId = new Map<string, WorkCalendar>();
  const idByGuid = new Map<string, string>();

  for (const ce of entities) {
    if (ce.type !== 'IFCRELASSIGNSTOCONTROL') continue;
    const controlRef = parseRef(ce.args[6] || '');
    if (!controlRef) continue;
    const controlEntity = entityMap.get(controlRef);
    if (!controlEntity || controlEntity.type !== 'IFCWORKCALENDAR') continue;
    if (projectCalendarEntity && controlRef === projectCalendarEntity.id) continue;

    let cal = calByStepId.get(controlRef);
    if (!cal) {
      cal = buildCalendarFromEntity(controlEntity, entityMap, entities);
      cal.id = stableIdFromGuid('cal', 'rescal', controlEntity, usedIds, guidLog, stepLog);
      calByStepId.set(controlRef, cal);
      calendars.push(cal);
      idByGuid.set(stripQuotes(controlEntity.args[CALENDAR_SLOT.globalId] || ''), cal.id);
    }

    const relatedRefs = parseRefs(ce.args[4] || '');
    for (const r of relatedRefs) {
      const resId = resourceStepIdMap.get(r);
      if (resId) {
        const res = resourceById.get(resId);
        if (res) res.calendarId = cal.id;
        continue;
      }
      const taskId = taskStepIdMap.get(r);
      if (taskId) {
        const task = taskById.get(taskId);
        if (task) task.calendarId = cal.id;
      }
    }
  }

  for (const ce of entities) {
    if (ce.type !== 'IFCWORKCALENDAR') continue;
    if (projectCalendarEntity && ce.id === projectCalendarEntity.id) continue;
    if (calByStepId.has(ce.id)) continue;
    const cal = buildCalendarFromEntity(ce, entityMap, entities);
    cal.id = stableIdFromGuid('cal', 'rescal', ce, usedIds, guidLog, stepLog);
    calByStepId.set(ce.id, cal);
    calendars.push(cal);
    idByGuid.set(stripQuotes(ce.args[CALENDAR_SLOT.globalId] || ''), cal.id);
  }

  return { calendars, idByGuid };
}

interface AssignmentMeta {
  unitsPerDay: number;
  curve?: ResourceCurve;
}

interface WindowMeta {
  workWindowStart?: string;
  workWindowFinish?: string;
  curveValues?: number[];
  plannedWorkMinutes?: number;
  actualWorkMinutes?: number;
  remainingWorkMinutes?: number;
  plannedUnitsPerDay?: number;
  costAmount?: number;
}

function workMinutesOf(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
}

interface TaskAssignmentMeta {
  queues: Map<string, AssignmentMeta[]>;
  legacy: Map<string, AssignmentMeta>;
}

function extractAssignments(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
  resourceStepIdMap: Map<string, string>,
): ResourceAssignment[] {
  const metaByTask = new Map<string, TaskAssignmentMeta>();
  const windowsByTask = new Map<string, Map<string, WindowMeta[]>>();
  for (const { pset, name: psetName, objectRefs } of propertySetRelations(entities, entityMap)) {

    if (psetName === PSET.Timephased) {
      const windowProp = parseRefs(pset.args[4] || '')
        .map(r => entityMap.get(r))
        .find((p): p is StepEntity =>
          !!p && p.type === 'IFCPROPERTYSINGLEVALUE' && stripQuotes(p.args[0] || '') === PROP.Timephased.Windows);
      const raw = windowProp ? parseTypedValue(windowProp.args[2] || '') : undefined;
      if (typeof raw !== 'string' || !raw) continue;
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { continue; }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      const indexed: { guid: string; index: number; meta: WindowMeta }[] = [];
      for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
        const m = key.match(/^(.+)#(\d+)$/);
        if (!m || !val || typeof val !== 'object') continue;
        const vv = val as Record<string, unknown>;
        const curveValues = normalizeCurveValues(vv.curveValues);
        const planned = workMinutesOf(vv.plannedWorkMinutes);
        const actual = workMinutesOf(vv.actualWorkMinutes);
        const remaining = workMinutesOf(vv.remainingWorkMinutes);
        const plannedUnits = workMinutesOf(vv.plannedUnitsPerDay);
        const costAmount = workMinutesOf(vv.costAmount);
        const meta: WindowMeta = {
          ...(typeof vv.workWindowStart === 'string' ? { workWindowStart: vv.workWindowStart } : {}),
          ...(typeof vv.workWindowFinish === 'string' ? { workWindowFinish: vv.workWindowFinish } : {}),
          ...(curveValues ? { curveValues } : {}),
          ...(planned !== undefined ? { plannedWorkMinutes: planned } : {}),
          ...(actual !== undefined ? { actualWorkMinutes: actual } : {}),
          ...(remaining !== undefined ? { remainingWorkMinutes: remaining } : {}),
          ...(plannedUnits !== undefined ? { plannedUnitsPerDay: plannedUnits } : {}),
          ...(costAmount !== undefined ? { costAmount } : {}),
        };
        if (Object.keys(meta).length === 0) continue;
        indexed.push({ guid: m[1], index: parseInt(m[2], 10), meta });
      }
      indexed.sort((a, b) => a.index - b.index);
      for (const objRef of objectRefs) {
        let taskWindows = windowsByTask.get(objRef);
        if (!taskWindows) { taskWindows = new Map(); windowsByTask.set(objRef, taskWindows); }
        for (const { guid, meta } of indexed) {
          let queue = taskWindows.get(guid);
          if (!queue) { queue = []; taskWindows.set(guid, queue); }
          queue.push(meta);
        }
      }
      continue;
    }

    if (psetName !== PSET.Assignments) continue;

    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');

    for (const objRef of objectRefs) {
      let taskMeta = metaByTask.get(objRef);
      if (!taskMeta) {
        taskMeta = { queues: new Map(), legacy: new Map() };
        metaByTask.set(objRef, taskMeta);
      }
      const indexed: { guid: string; index: number; meta: AssignmentMeta }[] = [];
      for (const prop of props) {
        const propName = stripQuotes(prop.args[0] || '');
        const value = parseTypedValue(prop.args[2] || '');
        if (typeof value !== 'string') continue;
        const [unitsRaw, curveRaw] = value.split('|');
        const unitsPerDay = parseFloat(unitsRaw);
        const curve = isResourceCurve(curveRaw) ? curveRaw : undefined;
        const meta: AssignmentMeta = { unitsPerDay: Number.isFinite(unitsPerDay) ? unitsPerDay : 1, curve };
        const m = propName.match(/^(.+)#(\d+)$/);
        if (m) {
          indexed.push({ guid: m[1], index: parseInt(m[2], 10), meta });
        } else {
          taskMeta.legacy.set(propName, meta);
        }
      }
      indexed.sort((a, b) => a.index - b.index);
      for (const { guid, meta } of indexed) {
        let queue = taskMeta.queues.get(guid);
        if (!queue) { queue = []; taskMeta.queues.set(guid, queue); }
        queue.push(meta);
      }
    }
  }

  const assignEntities = entities.filter(e => e.type === 'IFCRELASSIGNSTOPROCESS');
  const assignments: ResourceAssignment[] = [];

  for (const ae of assignEntities) {
    const taskRef = parseRef(ae.args[6] || '');
    if (!taskRef) continue;
    const taskId = taskStepIdMap.get(taskRef);
    if (!taskId) continue;
    const taskMeta = metaByTask.get(taskRef);

    const resRefs = parseRefs(ae.args[4] || '');
    for (const resRef of resRefs) {
      const resId = resourceStepIdMap.get(resRef);
      if (!resId) continue;

      const resEntity = entityMap.get(resRef);
      const resGuid = resEntity ? stripQuotes(resEntity.args[RESOURCE_SLOT.globalId] || '') : '';
      const meta = taskMeta?.queues.get(resGuid)?.shift() ?? taskMeta?.legacy.get(resGuid);
      const window = windowsByTask.get(taskRef)?.get(resGuid)?.shift();

      assignments.push({
        id: generateId('asgn'),
        taskId,
        resourceId: resId,
        unitsPerDay: meta?.unitsPerDay ?? 1,
        ...(window?.plannedUnitsPerDay !== undefined ? { plannedUnitsPerDay: window.plannedUnitsPerDay } : {}),
        ...(meta?.curve && meta.curve !== 'UNIFORM' ? { curve: meta.curve } : {}),
        ...(window?.workWindowStart !== undefined ? { workWindowStart: window.workWindowStart } : {}),
        ...(window?.workWindowFinish !== undefined ? { workWindowFinish: window.workWindowFinish } : {}),
        ...(window?.curveValues !== undefined ? { curveValues: window.curveValues } : {}),
        ...(window?.plannedWorkMinutes !== undefined ? { plannedWorkMinutes: window.plannedWorkMinutes } : {}),
        ...(window?.actualWorkMinutes !== undefined ? { actualWorkMinutes: window.actualWorkMinutes } : {}),
        ...(window?.remainingWorkMinutes !== undefined ? { remainingWorkMinutes: window.remainingWorkMinutes } : {}),
        ...(window?.costAmount !== undefined ? { costAmount: window.costAmount } : {}),
      });
    }
  }

  return assignments;
}

function normalizeCostResources(resources: Resource[], assignments: ResourceAssignment[]): void {
  const byId = new Map(resources.map(r => [r.id, r]));
  for (const r of resources) if (r.type === 'COST') clearCostResourceFields(r);
  for (const a of assignments) normalizeAssignmentForResource(a, byId.get(a.resourceId));
}

function remapContourResourceIds(
  tasks: Task[], resourceGuidMap: Map<string, string>, resourceIds: ReadonlySet<string>,
): void {
  for (const task of tasks) {
    if (!task.timephasedContours) continue;
    for (const contour of task.timephasedContours) {
      if (contour.resourceId === undefined) continue;
      const mapped = mappedResourceId(resourceGuidMap, resourceIds, contour.resourceId);
      if (mapped) contour.resourceId = mapped;
    }
  }
}

function remapLevelingResourceIds(
  options: ProjectSchedulingOptions, resourceGuidMap: Map<string, string>, resourceIds: ReadonlySet<string>,
): void {
  for (const entry of options.leveling?.resources ?? []) {
    const mapped = mappedResourceId(resourceGuidMap, resourceIds, entry.resourceId);
    if (mapped) entry.resourceId = mapped;
  }
}


function tasksOutsideSelection(entities: StepEntity[], selected: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  for (const e of entities) if (e.type === 'IFCTASK' && !selected.has(e.id)) out.add(e.id);
  return out;
}

function collectBaselineTaskStepIds(entities: StepEntity[]): Set<string> {
  const baselineSchedIds = new Set<string>();
  const liveSchedIds = new Set<string>();
  for (const e of entities) {
    if (e.type === 'IFCWORKSCHEDULE') (isBaselineSchedule(e) ? baselineSchedIds : liveSchedIds).add(e.id);
  }
  const taskStepIds = new Set<string>();
  if (baselineSchedIds.size === 0 || liveSchedIds.size === 0) return taskStepIds;

  const baselineRoots: string[] = [];
  const liveRoots: string[] = [];
  const nestedUnder = new Map<string, string[]>();
  for (const e of entities) {
    if (e.type === 'IFCRELNESTS') {
      const relating = parseRef(e.args[4] || '');
      if (!relating) continue;
      const related = parseRefs(e.args[5] || '');
      if (baselineSchedIds.has(relating)) baselineRoots.push(...related);
      else if (liveSchedIds.has(relating)) liveRoots.push(...related);
      else nestedUnder.set(relating, [...(nestedUnder.get(relating) ?? []), ...related]);
    } else if (e.type === 'IFCRELASSIGNSTOCONTROL') {
      const control = parseRef(e.args[6] || '');
      if (!control) continue;
      const related = parseRefs(e.args[4] || '');
      if (baselineSchedIds.has(control)) baselineRoots.push(...related);
      else if (liveSchedIds.has(control)) liveRoots.push(...related);
    }
  }
  const tree = (roots: string[]): Set<string> => {
    const seen = new Set<string>();
    const todo = [...roots];
    while (todo.length > 0) {
      const id = todo.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      todo.push(...(nestedUnder.get(id) ?? []));
    }
    return seen;
  };
  const live = tree(liveRoots);
  if (live.size === 0) return taskStepIds;
  for (const id of tree(baselineRoots)) if (!live.has(id)) taskStepIds.add(id);
  return taskStepIds;
}

function extractBaselines(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
): { baselines: Baseline[]; activeBaselineId: string | null; comparedBaselineIds: ComparedBaselineIds;
  orphanGuids: Record<string, string> } {
  const guidToTaskId = new Map<string, string>();
  for (const e of entities) {
    if (e.type !== 'IFCTASK') continue;
    const newId = taskStepIdMap.get(e.id);
    if (newId) guidToTaskId.set(stripQuotes(e.args[TASK_SLOT.globalId] || ''), newId);
  }

  let baselines: Baseline[] = [];
  let activeBaselineId: string | null = null;
  let comparedRaw: unknown = null;
  let taskGuids: Record<string, string> | null = null;

  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== PSET.Baselines) continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      const name = stripQuotes(prop.args[0] || '');
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string') continue;
      if (name === PROP.Baselines.Baselines) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) baselines = parsed as Baseline[];
        } catch { }
      } else if (name === PROP.Baselines.ActiveBaselineId) {
        activeBaselineId = raw;
      } else if (name === PROP.Baselines.ComparedBaselineIds) {
        try { comparedRaw = JSON.parse(raw); } catch { }
      } else if (name === PROP.Baselines.TaskGuids) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            taskGuids = parsed as Record<string, string>;
          }
        } catch { }
      }
    }
  }

  const orphanGuids: Record<string, string> = {};
  for (const b of baselines) {
    if (!Array.isArray(b.tasks)) { b.tasks = []; continue; }
    for (const bt of b.tasks as BaselineTask[]) {
      const guid = taskGuids?.[bt.taskId] ?? ifcGuid(bt.taskId);
      const remapped = guidToTaskId.get(guid);
      if (remapped) bt.taskId = remapped;
      else orphanGuids[bt.taskId] = guid;
    }
  }

  if (activeBaselineId && !baselines.some(b => b.id === activeBaselineId)) {
    activeBaselineId = baselines.length ? baselines[baselines.length - 1].id : null;
  }

  const comparedBaselineIds = normalizeComparedBaselines(
    Array.isArray(comparedRaw) ? comparedRaw.map(v => (typeof v === 'string' ? v : null)) : null,
    baselines, activeBaselineId,
  );

  return { baselines, activeBaselineId, comparedBaselineIds, orphanGuids };
}

function extractTimephasedDurationWalksMeta(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
  calendarIdByGuid: ReadonlyMap<string, string>,
): void {
  const taskById = new Map(tasks.map(t => [t.id, t]));

  for (const { pset, objectRefs } of propertySetRelations(entities, entityMap, PSET.DurationWalks)) {
    const prop = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .find((p): p is StepEntity =>
        !!p && p.type === 'IFCPROPERTYSINGLEVALUE' && stripQuotes(p.args[0] || '') === PROP.DurationWalks.DurationWalks);
    const raw = prop ? parseTypedValue(prop.args[2] || '') : undefined;
    if (typeof raw !== 'string' || !raw) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { continue; }
    if (!Array.isArray(parsed)) continue;
    const isValidWalk = (w: unknown): w is { anchor: string; resourceCalendarGuid: string; workMinutes?: number } =>
      !!w && typeof w === 'object'
      && typeof (w as { anchor?: unknown }).anchor === 'string'
      && typeof (w as { resourceCalendarGuid?: unknown }).resourceCalendarGuid === 'string'
      && ((w as { workMinutes?: unknown }).workMinutes === undefined || typeof (w as { workMinutes?: unknown }).workMinutes === 'number');
    if (parsed.length === 0 || !parsed.every(isValidWalk)) continue;
    const walks = (parsed as { anchor: string; resourceCalendarGuid: string; workMinutes?: number }[])
      .map(w => ({
        anchor: w.anchor, resourceCalendarId: calendarIdByGuid.get(w.resourceCalendarGuid),
        ...(w.workMinutes !== undefined ? { workMinutes: w.workMinutes } : {}),
      }))
      .filter((w): w is { anchor: string; resourceCalendarId: string; workMinutes?: number } => w.resourceCalendarId !== undefined);
    if (walks.length === 0) continue;
    for (const objRef of objectRefs) {
      const taskId = taskStepIdMap.get(objRef);
      const task = taskId ? taskById.get(taskId) : undefined;
      if (task) task.timephasedDurationWalks = walks;
    }
  }
}

export function readSchedulingProfile(content: string): SchedulingProfile | undefined {
  const grammar = stepFileGrammar(content);
  const entities = parseSTEP(content, grammar.failed || grammar.literalStrings);
  const entityMap = new Map<string, StepEntity>();
  for (const e of entities) entityMap.set(e.id, e);
  return extractSchedulingProfile(entities, entityMap);
}

function extractSchedulingProfile(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): SchedulingProfile | undefined {
  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== PSET.SchedulingProfile) continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      if (stripQuotes(prop.args[0] || '') !== PROP.SchedulingProfile.SchedulingProfile) continue;
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string' || !raw || raw.length > MAX_PROFILE_JSON_LENGTH) continue;
      try {
        return sanitizeSchedulingProfile(JSON.parse(raw));
      } catch { }
    }
  }
  return undefined;
}

function isOpsAuthoredIfc(entities: StepEntity[]): boolean {
  for (const e of entities) {
    if (e.type === 'IFCAPPLICATION' && stripQuotes(e.args[3] || '') === 'OPS') return true;
    if (e.type === 'IFCPROPERTYSET' && stripQuotes(e.args[2] || '').startsWith('OPS_')) return true;
  }
  return false;
}

function extractImportPristine(entities: StepEntity[], entityMap: Map<string, StepEntity>): boolean {
  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== PSET.ImportProvenance) continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      if (stripQuotes(prop.args[0] || '') !== PROP.ImportProvenance.UnchangedSinceImport) continue;
      return (prop.args[2] || '').replace(/\s+/g, '').toUpperCase() === 'IFCBOOLEAN(.T.)';
    }
  }
  return false;
}

function extractRecoveryForeignSource(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): ForeignSourceRecord | undefined {
  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== PSET.RecoveryForeignSource) continue;
    let sha256: unknown;
    let byteLength: unknown;
    let filePath: unknown;
    let siteFileId: unknown;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      const name = stripQuotes(prop.args[0] || '');
      if (name === PROP.RecoveryForeignSource.Sha256) sha256 = parseTypedValue(prop.args[2] || '');
      else if (name === PROP.RecoveryForeignSource.ByteLength) byteLength = parseTypedValue(prop.args[2] || '');
      else if (name === PROP.RecoveryForeignSource.SourcePath) filePath = parseTypedValue(prop.args[2] || '');
      else if (name === PROP.RecoveryForeignSource.SourceSiteFileId) siteFileId = parseTypedValue(prop.args[2] || '');
    }
    const fingerprint = parseForeignSourceFingerprint(sha256, byteLength);
    if (!fingerprint) return undefined;
    const target = parseForeignSourceTarget({ filePath, siteFileId });
    return target && (target.filePath || target.siteFileId) ? { ...fingerprint, target } : fingerprint;
  }
  return undefined;
}

function extractRecordedSourceFormat(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): RecordedSourceFormat | undefined {
  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== PSET.ImportProvenance) continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      if (stripQuotes(prop.args[0] || '') !== PROP.ImportProvenance.SourceFormat) continue;
      const m = /^IFCLABEL\('([a-z0-9]+)'\)$/i.exec((prop.args[2] || '').trim());
      const v = m?.[1];
      return v === 'xer' || v === 'p6xml' || v === 'mspdi' || v === 'mpp' || v === 'ifc' ? v : undefined;
    }
  }
  return undefined;
}

function extractSchedulingOptions(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): SchedulingOptions | undefined {
  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== PSET.SchedulingOptions) continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      if (stripQuotes(prop.args[0] || '') !== PROP.SchedulingOptions.SchedulingOptions) continue;
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string' || !raw) continue;
      try {
        return sanitizeSchedulingOptions(JSON.parse(raw));
      } catch { }
    }
  }
  return undefined;
}
