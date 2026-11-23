import { minuteModelWriteView } from './minuteModelWrite';
import { MINUTE_MODEL_TIME_MODEL } from '@/state/migrations/minuteModel';
import { calendarExceptionKey } from './calendarExceptionKey';
import { IfcCalendarTimePrecisionError } from './ifcErrors';
import { ifcCalendarBandLayout, parseIfcClock } from './ifcClock';
import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { Resource } from '@/types/resource';
import { ResourceAssignment } from '@/types/resource';
import { Project, SchedulingOptions, SchedulingProfile, projectIfcSchema } from '@/types/project';
import { carriesProfile, schedulingProfileToJson } from '@/services/ifc/schedulingOptionsRead';
import { legacyOptionsBlobFor } from '@/services/ifc/schedulingProfileMigration';
import { holidayEndDate, WorkCalendar, type WorkTimeBands } from '@/types/calendar';
import { DEFAULT_CALENDAR_ID } from '@/engine/calendar/defaultCalendar';
import { ActivityCodeType, CustomFieldDef, CustomFieldType, CustomFieldValue } from '@/types/structure';
import { Baseline } from '@/types/baseline';
import type { CustomTaskType } from '@/types/taskType';
import { savedCustomTaskTypes } from '@/services/taskTypes/customTaskTypeRules';
import {
  canonicalizeBands, clockToMinutes, deriveHoursPerDay, hoursPerDayDiffers, effectiveCalendarByTask, minutesToClock, minutesToIsoDuration,
  taskMinutesForWrite,
} from '@/services/subdayIo';
import { effectiveWorkTimeBands } from '@/utils/effectiveWorkTime';
import type { ImportResult, RecordedSourceFormat } from '@/services/importTypes';
import type { ForeignSourceRecord } from './foreign/foreignSourceMark';
import {
  IFC_TIME_ANCHOR, FIELD_MEASURE, RESOURCE_TYPE_TO_IFC, COST_RESOURCE_OBJECT_TYPE,
} from './ifcConstants';
import { ACTIVITY_CODE_ID_SUFFIX, PSET, PROP, PER_TASK_PSETS, XER_ARCHIVE_CHUNK, xerArchiveChunkName, OPS_APP_VERSION, ifcStr, ifcJson, asciiJson, ifcTypedReal, stepReal, ifcDateValue } from './ifcPsets';
import { ifcSchemaQuestionFor } from './ifcSchemaQuestion';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { shownFinish, shownStart } from '@/utils/taskDates';
import { projectFileBase } from '@/utils/documents';
import {
  XER_SOURCE_ARCHIVE_CHUNK_BYTES, XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT,
  XER_SOURCE_ARCHIVE_COMPACT_STORAGE_SCHEMA_VERSION, XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_FORMAT,
  XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_SCHEMA_VERSION, type XerSourceArchive,
} from '@/services/xerSourceArchive';
import {
  ifcDurationExact, IFC_TASK_SLOTS, IFC_TASKTIME_SLOTS, type TaskTimeWriteCtx, type TaskWriteCtx, type WithheldTaskTimeField,
} from './ifcTaskSlots';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { groupBy } from '@/utils/collections';
import { effHoursPerDay } from '@/utils/taskDuration';
import {
  DAY_MEASURE_LAGS_PROP, ELAPSED_MINUTES_PER_DAY, EXACT_MINUTE_LAGS_PROP, dayMeasureRecord, dayTaskWritesMinutes, exactFloatRecord,
  exactMinutesRecord, isWholeDays, taskMinutesPerDay,
  type DayMeasureDurationKey, type DayMeasureRecord, type ExactFloatKey, type ExactFloatRecord,
  type ExactMinutesKey, type ExactMinutesRecord,
} from './dayMeasureIo';
import type { PerTaskWriteOptions } from './ifcPsets';

export const WRITER_ENTITY_TYPES: ReadonlySet<string> = new Set([
  'IFCPERSON', 'IFCORGANIZATION', 'IFCPERSONANDORGANIZATION', 'IFCAPPLICATION', 'IFCOWNERHISTORY',
  'IFCSIUNIT', 'IFCUNITASSIGNMENT', 'IFCCARTESIANPOINT', 'IFCAXIS2PLACEMENT3D', 'IFCGEOMETRICREPRESENTATIONCONTEXT',
  'IFCPROJECT', 'IFCWORKPLAN', 'IFCWORKSCHEDULE', 'IFCWORKCALENDAR', 'IFCWORKTIME', 'IFCRECURRENCEPATTERN',
  'IFCTIMEPERIOD', 'IFCTASK', 'IFCTASKTIME', 'IFCRELSEQUENCE', 'IFCLAGTIME',
  'IFCRELNESTS', 'IFCRELASSIGNSTOCONTROL', 'IFCRELASSIGNSTOPROCESS', 'IFCRELAGGREGATES', 'IFCRELDECLARES',
  'IFCRELDEFINESBYPROPERTIES', 'IFCPROPERTYSET', 'IFCPROPERTYSINGLEVALUE', 'IFCPROPERTYENUMERATEDVALUE',
  'IFCPROPERTYSETTEMPLATE', 'IFCSIMPLEPROPERTYTEMPLATE', 'IFCPROPERTYENUMERATION',
  ...Object.values(RESOURCE_TYPE_TO_IFC), 'IFCCONSTRUCTIONPRODUCTRESOURCE',
]);

export function ifcGuid(seed: string): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  let result = '';
  for (let i = 0; i < 22; i++) {
    const idx = Math.abs((hash * (i + 1) * 31 + i * 17) % chars.length);
    result += chars[idx];
    hash = ((hash << 3) ^ (hash >> 2) + i) | 0;
  }
  return result;
}

const IFC_GUID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

export function ifcGuid128(seed: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  const words = [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  const bit = (k: number) => (words[k >>> 5] >>> (31 - (k & 31))) & 1;
  let out = IFC_GUID_CHARS[(bit(0) << 1) | bit(1)];
  for (let c = 0; c < 21; c++) {
    let v = 0;
    for (let b = 0; b < 6; b++) v = (v << 1) | bit(2 + c * 6 + b);
    out += IFC_GUID_CHARS[v];
  }
  return out;
}

function ifcRequiredStr(s: string): string {
  return s ? ifcStr(s) : "''";
}

export function ifcDateTime(iso: string): string {
  if (!iso) return '$';
  if (iso.length === 10) return `'${iso}T${IFC_TIME_ANCHOR}'`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) return `'${iso}:00'`;
  return `'${iso}'`;
}

function ifcDateTimeHour(iso: string): string {
  if (!iso) return '$';
  if (iso.length === 10) return `'${iso}T00:00:00'`;
  if (iso.length === 16) return `'${iso}:00'`;
  return `'${iso}'`;
}

function taskDateTimeFormatter(task: Task): (iso: string) => string {
  return taskDurationUnit(task) === 'hours' ? ifcDateTimeHour : ifcDateTime;
}

function ifcDayNumber(days: number): string {
  if (!Number.isFinite(days) || Number.isInteger(days)) return `${days}`;
  return `${Math.round(days * 1e6) / 1e6}`;
}

function ifcDuration(days: number): string {
  if (days < 0) return `'-P0Y0M${ifcDayNumber(-days)}D'`;
  return `'P0Y0M${ifcDayNumber(days)}D'`;
}

function ifcDurationHour(minutes: number): string {
  return `'${minutesToIsoDuration(minutes)}'`;
}

function workControlArgs(a: {
  guid: string; ownerHistId: number; name: string; description: string;
  creationDate: string; predefinedType: 'PLANNED' | 'BASELINE';
  startTimeArg: string; finishTimeArg: string;
}): string {
  return [
    ifcStr(a.guid), `#${a.ownerHistId}`, ifcStr(a.name), ifcStr(a.description),
    '$',
    '$',
    ifcDateTime(a.creationDate),
    '$',
    '$',
    '$',
    '$',
    a.startTimeArg,
    a.finishTimeArg,
    `.${a.predefinedType}.`,
  ].join(',');
}

function baselineStart(b: Baseline): string {
  let first = '';
  for (const t of b.tasks ?? []) if (t.start && (!first || t.start < first)) first = t.start;
  return first;
}

export interface WriteContext {
  literalCalendarIds?: ReadonlySet<string>;
  milestonesAtDayEnd?: ReadonlySet<string>;
  lines: string[];
  nextId: number;
  idMap: Map<string, number>;
  guids: Map<string, string>;
  usedGuids: Set<string>;
  preservedGuids: ReadonlyMap<string, string>;
  reservedGuids: ReadonlySet<string>;
  auxSalt: string;
  merge?: WriterMergeIds;
}

export interface WriterMergeIds {
  readonly keep: ReadonlyMap<string, number>;
  readonly firstId: number;
  readonly reserved: ReadonlySet<number>;
  readonly projectSourceId?: number;
  readonly baselineHeads: ReadonlyMap<string, number>;
  readonly sourceTaskTimes?: ReadonlyMap<string, SourceTaskTime>;
  readonly sourceDayLagIds?: ReadonlySet<string>;
  readonly sourceBandCalendarIds?: ReadonlySet<string>;
  readonly sourceBaselineHeadGuids?: ReadonlyMap<string, string>;
}

export interface SourceTaskTime {
  readonly exactDays: ReadonlySet<DayMeasureDurationKey>;
  readonly exactFloat: ReadonlySet<'freeFloat' | 'totalFloat'>;
}

function guidOf(ctx: WriteContext, seed: string): string {
  return issueGuid(ctx, seed, `${ctx.auxSalt}/${seed}`);
}

function issueGuid(ctx: WriteContext, key: string, hashSeed: string): string {
  const cached = ctx.guids.get(key);
  if (cached !== undefined) return cached;
  const kept = ctx.preservedGuids.get(key);
  let guid: string;
  if (kept !== undefined && !ctx.usedGuids.has(kept)) {
    guid = kept;
  } else {
    guid = ifcGuid128(hashSeed);
    for (let n = 1; ctx.usedGuids.has(guid) || ctx.reservedGuids.has(guid); n++) guid = ifcGuid128(`${hashSeed}#dup${n}`);
  }
  ctx.guids.set(key, guid);
  ctx.usedGuids.add(guid);
  return guid;
}

export type IfcObjectKind = 'task' | 'res' | 'cal' | 'seq' | 'proj' | 'wp' | 'ws';

export function ifcObjectSeed(kind: IfcObjectKind, id: string): string {
  return `${kind}:${id}`;
}

function objectGuid(ctx: WriteContext, kind: IfcObjectKind, id: string): string {
  const key = ifcObjectSeed(kind, id);
  return issueGuid(ctx, key, kind === 'cal' && id === DEFAULT_CALENDAR_ID ? `${key}@${ctx.auxSalt}` : key);
}

function ref(ctx: WriteContext, key: string): string {
  const id = ctx.idMap.get(key);
  if (id === undefined) throw new Error(`IFC-verwijzing ontbreekt: ${key}`);
  return `#${id}`;
}

function optionalRef(ctx: WriteContext, key: string): string | null {
  const id = ctx.idMap.get(key);
  return id === undefined ? null : `#${id}`;
}

function allocId(ctx: WriteContext, key: string, baselineGuid?: string): number {
  const merge = ctx.merge;
  if (!merge) return ctx.nextId++;
  const kept = merge.keep.get(key) ?? (baselineGuid === undefined ? undefined : merge.baselineHeads.get(baselineGuid));
  if (kept !== undefined) return kept;
  let id = ctx.nextId++;
  while (merge.reserved.has(id)) id = ctx.nextId++;
  return id;
}

function addLine(ctx: WriteContext, key: string, line: string, baselineGuid?: string): number {
  const id = allocId(ctx, key, baselineGuid);
  ctx.idMap.set(key, id);
  ctx.lines.push(`#${id}=${line};`);
  return id;
}

export type WriteIFCInput = ImportResult & {
  minuteModelPending?: boolean;
  withheldTaskTimeFields?: Readonly<Record<string, readonly WithheldTaskTimeField[]>>;
  xerSourceArchiveStorage?: 'embedded' | 'recovery-reference';
  recoveryForeignSource?: ForeignSourceRecord;
};

export function writeIFC(input: WriteIFCInput): string {
  return writeIFCWithChoices(input).content;
}

export function writeIFCForComparison(input: WriteIFCInput): string {
  return writeIfcParts(input, undefined, new Date('1970-01-01T00:00:00.000Z')).text;
}

export function writeIFCWithChoices(input: WriteIFCInput): { content: string; literalCalendarIds: string[] } {
  const { text, literalCalendarIds } = writeIfcParts(input);
  return { content: text, literalCalendarIds };
}

export function writeIfcMergeLines(input: WriteIFCInput, merge: WriterMergeIds, writtenAt?: Date): {
  lines: string[]; idMap: ReadonlyMap<string, number>; literalCalendarIds: readonly string[];
} {
  const { lines, idMap, literalCalendarIds } = writeIfcParts(input, merge, writtenAt);
  return { lines, idMap, literalCalendarIds };
}

function writeIfcParts(input: WriteIFCInput, merge?: WriterMergeIds, comparisonDate?: Date): {
  text: string; lines: string[]; idMap: ReadonlyMap<string, number>; literalCalendarIds: string[];
} {
  const {
    project, calendar, tasks: sourceTasks, sequences, resources, assignments,
    activityCodeTypes = [],
    customFieldDefs = [],
    customTaskTypes = [],
    resourceCalendars = [],
    baselines: sourceBaselines = [],
    activeBaselineId = null,
    comparedBaselineIds = undefined,
    libraryPool = undefined,
    xerSourceArchive = undefined,
    xer = undefined,
    xerSourceProjectId = undefined,
    importPristine = undefined,
    withheldTaskTimeFields = undefined,
    recordedSourceFormat = undefined,
    ifcGlobalIds = undefined,
    ifcLiteralCalendarIds = undefined,
    xerSourceArchiveStorage = 'embedded',
    recoveryForeignSource = undefined,
  } = input;
  const writeView = minuteModelWriteView({ tasks: sourceTasks, calendar, resourceCalendars, baselines: sourceBaselines }, {
    ...(ifcLiteralCalendarIds ? { keepLiteralCalendarIds: ifcLiteralCalendarIds } : {}),
    ...(merge?.sourceTaskTimes ? {
      sourceDurationTaskIds: new Set([...merge.sourceTaskTimes].filter(([, t]) => t.exactDays.has('ScheduleDuration')).map(([id]) => id)),
    } : {}),
    ...(merge?.sourceBandCalendarIds ? { sourceBandCalendarIds: merge.sourceBandCalendarIds } : {}),
  });
  const { tasks, baselines } = writeView;
  const preservedGuids = new Map(Object.entries(ifcGlobalIds ?? {}));
  for (const [baselineId, guid] of merge?.sourceBaselineHeadGuids ?? []) preservedGuids.set('baseline_ws_' + baselineId, guid);
  const ctx: WriteContext = {
    literalCalendarIds: writeView.literalCalendarIds, milestonesAtDayEnd: writeView.atDayEnd,
    lines: [], nextId: merge?.firstId ?? 1, idMap: new Map(), guids: new Map(), usedGuids: new Set(),
    preservedGuids, reservedGuids: new Set(preservedGuids.values()), auxSalt: project.id,
    ...(merge ? { merge } : {}),
  };
  const now = (comparisonDate ?? new Date()).toISOString().split('.')[0];

  // eslint-disable-next-line no-control-regex
  const headerText = (s: string) => s.replace(/[\u0000-\u001F\u007F]+/g, ' ');
  const headerFileName = projectFileBase(headerText(project.name)) + '.ifc';
  const header = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');",
    `FILE_NAME(${ifcStr(headerFileName)},${ifcStr(now)},(${ifcStr(headerText(project.author || 'Open Planner Studio'))}),(${ifcStr(headerText(project.company || 'OpenAEC Foundation'))}),'Open Planner Studio 0.1','Open Planner Studio','');`,
    `FILE_SCHEMA(('${projectIfcSchema(project)}'));`,
    'ENDSEC;',
    'DATA;',
    '',
  ].join('\n');

  const personId = addLine(ctx, '_person', `IFCPERSON($,${ifcRequiredStr(project.author)},$,$,$,$,$,$)`);
  const orgId = addLine(ctx, '_org', `IFCORGANIZATION($,${ifcRequiredStr(project.company)},$,$,$)`);
  const personOrgId = addLine(ctx, '_personorg', `IFCPERSONANDORGANIZATION(#${personId},#${orgId},$)`);
  const appOrgId = addLine(ctx, '_apporg', `IFCORGANIZATION($,'OpenAEC Foundation',$,$,$)`);
  const appId = addLine(ctx, '_app', `IFCAPPLICATION(#${appOrgId},${ifcStr(OPS_APP_VERSION)},'Open Planner Studio','OPS')`);
  const ownerHistId = addLine(ctx, '_owner', `IFCOWNERHISTORY(#${personOrgId},#${appId},$,.NOCHANGE.,$,$,$,${Math.floor((comparisonDate?.getTime() ?? Date.now()) / 1000)})`);

  if (merge?.projectSourceId !== undefined) {
    ctx.idMap.set('_project', merge.projectSourceId);
  } else {
    const mId = addLine(ctx, '_m', `IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`);
    const sId = addLine(ctx, '_s', `IFCSIUNIT(*,.TIMEUNIT.,$,.SECOND.)`);
    const unitAssId = addLine(ctx, '_units', `IFCUNITASSIGNMENT((#${mId},#${sId}))`);

    const ptId = addLine(ctx, '_pt', `IFCCARTESIANPOINT((0.,0.,0.))`);
    const axId = addLine(ctx, '_ax', `IFCAXIS2PLACEMENT3D(#${ptId},$,$)`);
    const ctxId = addLine(ctx, '_ctx', `IFCGEOMETRICREPRESENTATIONCONTEXT($,'Plan',3,1.0E-05,#${axId},$)`);

    addLine(ctx, '_project', `IFCPROJECT(${ifcStr(objectGuid(ctx, 'proj', project.id))},#${ownerHistId},${ifcRequiredStr(project.name)},${ifcStr(project.description)},$,$,$,(#${ctxId}),#${unitAssId})`);
  }
  if (!input.minuteModelPending) {
    const prop = addLine(ctx, '_time_model', `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Project.TimeModel)},$,IFCLABEL(${ifcStr(MINUTE_MODEL_TIME_MODEL)}),$)`);
    const pset = addLine(ctx, '_time_model_pset', `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'time_model'))},#${ownerHistId},${ifcStr(PSET.Project)},$,(#${prop}))`);
    addLine(ctx, '_time_model_rel', `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'time_model_rel'))},#${ownerHistId},$,$,(${ref(ctx, '_project')}),#${pset})`);
  }
  writeXerSourceArchive(ctx, ownerHistId, xerSourceArchive, xer?.sourceProjectId ?? xerSourceProjectId, xerSourceArchiveStorage);
  if (recoveryForeignSource) {
    const props = [
      addLine(ctx, '_recovery_foreign_sha', `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.RecoveryForeignSource.Sha256)},$,IFCTEXT(${ifcStr(recoveryForeignSource.sha256)}),$)`),
      addLine(ctx, '_recovery_foreign_len', `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.RecoveryForeignSource.ByteLength)},$,IFCINTEGER(${recoveryForeignSource.byteLength}),$)`),
    ];
    const target = recoveryForeignSource.target;
    if (target?.filePath) {
      props.push(addLine(ctx, '_recovery_foreign_path', `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.RecoveryForeignSource.SourcePath)},$,IFCTEXT(${ifcStr(target.filePath)}),$)`));
    }
    if (target?.siteFileId) {
      props.push(addLine(ctx, '_recovery_foreign_site', `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.RecoveryForeignSource.SourceSiteFileId)},$,IFCTEXT(${ifcStr(target.siteFileId)}),$)`));
    }
    const pset = addLine(ctx, '_recovery_foreign_pset', `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'recovery_foreign'))},#${ownerHistId},${ifcStr(PSET.RecoveryForeignSource)},$,(${props.map(p => `#${p}`).join(',')}))`);
    addLine(ctx, '_recovery_foreign_rel', `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'recovery_foreign_rel'))},#${ownerHistId},$,$,(${ref(ctx, '_project')}),#${pset})`);
  }

  const effCalByTask = effectiveCalendarByTask(tasks, calendar, resourceCalendars);
  const hourTaskCalendarIds = merge?.sourceBandCalendarIds?.size
    ? new Set([...writeView.literalCalendarIds, ...merge.sourceBandCalendarIds])
    : writeView.literalCalendarIds;
  const projectCalWritten = writeCalendar(ctx, calendar, ownerHistId, '_calendar', hourTaskCalendarIds.has(calendar.id));
  writeCalendarGenerationMeta(ctx, calendar, ownerHistId, projectCalWritten);

  const taskSpans = tasks.map(task => {
    const dt = taskDateTimeFormatter(task);
    const iso = (value: string | undefined): string => value ? dt(value).slice(1, -1) : '';
    const normalized: Task = { ...task, time: { ...task.time,
      scheduleStart: iso(task.time.scheduleStart), scheduleFinish: iso(task.time.scheduleFinish),
      earlyStart: iso(task.time.earlyStart), earlyFinish: iso(task.time.earlyFinish),
      actualStart: iso(task.time.actualStart), actualFinish: iso(task.time.actualFinish),
    } };
    return { start: dt(shownStart(normalized)), finish: dt(shownFinish(normalized)) };
  });
  const startArgs = taskSpans.map(span => span.start).filter(arg => arg !== '$').sort();
  const endArgs = taskSpans.map(span => span.finish).filter(arg => arg !== '$').sort();

  const workControlStartArg = startArgs[0] || ifcDateTime(project.startDate || now);
  const workControlFinishArg = endArgs[endArgs.length - 1] || ifcDateTime(project.endDate);
  const workPlanId = addLine(ctx, '_workplan', `IFCWORKPLAN(${workControlArgs({
    guid: objectGuid(ctx, 'wp', project.id), ownerHistId, name: project.name, description: project.description,
    creationDate: now, startTimeArg: workControlStartArg, finishTimeArg: workControlFinishArg, predefinedType: 'PLANNED',
  })})`);

  const workSchedId = addLine(ctx, '_worksched', `IFCWORKSCHEDULE(${workControlArgs({
    guid: objectGuid(ctx, 'ws', project.id), ownerHistId, name: 'Construction schedule v1.0', description: '',
    creationDate: now, startTimeArg: workControlStartArg, finishTimeArg: workControlFinishArg, predefinedType: 'PLANNED',
  })})`);

  const baselineSchedRefs: string[] = [];
  for (const b of baselines) {
    const start = baselineStart(b);
    const guid = guidOf(ctx, 'baseline_ws_' + b.id);
    const bId = addLine(ctx, `_baseline_ws_${b.id}`, `IFCWORKSCHEDULE(${workControlArgs({
      guid, ownerHistId, name: b.name, description: '',
      creationDate: b.createdAt || now, startTimeArg: start ? ifcDateTime(start) : workControlStartArg,
      finishTimeArg: ifcDateTime(b.projectEnd),
      predefinedType: 'BASELINE',
    })})`, guid);
    baselineSchedRefs.push(`#${bId}`);
  }

  const schedRefs = [`#${workSchedId}`, ...baselineSchedRefs].join(',');
  addLine(ctx, '_agg_plan_sched',
    `IFCRELAGGREGATES(${ifcStr(guidOf(ctx, 'agg_ps'))},#${ownerHistId},$,$,#${workPlanId},(${schedRefs}))`);

  const taskRecords = new Map<string, PerTaskWriteOptions>();
  for (const task of tasks) {
    const effCal = effCalByTask.get(task.id) ?? calendar;
    taskRecords.set(task.id, writeTask(
      ctx, task, ownerHistId, project.statusDate, effHoursPerDay(effCal),
      customTaskTypes.find(type => type.id === task.customTaskTypeId)?.name,
      withheldTaskTimeFields?.[task.id],
    ));
  }

  writeWBSNesting(ctx, tasks, ownerHistId);

  const rootTasks = tasks.filter(t => !t.parentId);
  if (rootTasks.length > 0) {
    const rootRefs = rootTasks.map(t => ref(ctx, `task_${t.id}`)).join(',');
    addLine(ctx, '_nest_sched',
      `IFCRELNESTS(${ifcStr(guidOf(ctx, 'nest_root'))},#${ownerHistId},'WBS Hoofd',$,#${workSchedId},(${rootRefs}))`);
  }

  const dayMeasureLags: [string, DayMeasureRecord][] = [];
  const exactMinuteLags: [string, ExactMinutesRecord][] = [];
  for (const seq of sequences) {
    const { record, exactMinutes } = writeSequence(ctx, seq, ownerHistId,
      lagMinutesPerDay(seq, project.schedulingOptions?.lagCalendar, calendar, effCalByTask));
    if (record) dayMeasureLags.push([objectGuid(ctx, 'seq', seq.id), record]);
    if (exactMinutes) exactMinuteLags.push([objectGuid(ctx, 'seq', seq.id), exactMinutes]);
  }
  writeSequenceMeta(ctx, workSchedId, sequences, dayMeasureLags, exactMinuteLags, ownerHistId);

  for (const res of resources) {
    writeResource(ctx, res, ownerHistId);
  }
  writeResourceMeta(ctx, resources, ownerHistId);
  writeCrewNesting(ctx, resources, ownerHistId);
  writeCalendarLibrary(
    ctx, resources, tasks,
    resourceCalendars.filter(c => c.id !== project.calendarId),
    ownerHistId,
    hourTaskCalendarIds,
  );

  writeAssignments(ctx, assignments, ownerHistId);
  writeAssignmentMeta(ctx, tasks, assignments, ownerHistId);
  writeTimephasedMeta(ctx, tasks, assignments, ownerHistId);
  writeTimephasedDurationWalksMeta(ctx, tasks, ownerHistId);

  if (tasks.length > 0) {
    const allTaskRefs = tasks.map(t => ref(ctx, `task_${t.id}`)).join(',');
    addLine(ctx, '_ctrl',
      `IFCRELASSIGNSTOCONTROL(${ifcStr(guidOf(ctx, 'ctrl'))},#${ownerHistId},$,$,(${allTaskRefs}),$,#${workSchedId})`);
  }

  writeStructure(ctx, project, tasks, activityCodeTypes, customFieldDefs, ownerHistId);
  writeTaskTypeMeta(ctx, tasks, customTaskTypes, ownerHistId);
  writeLibraryPool(ctx, ownerHistId, libraryPool);

  emitPerTaskPsets(ctx, tasks, ownerHistId, taskRecords);
  writeBaselineMeta(ctx, workSchedId, baselines, activeBaselineId, comparedBaselineIds, ownerHistId);
  writeSchedulingOptionsMeta(ctx, workSchedId, legacyOptionsBlobFor(project), ownerHistId);
  writeSchedulingProfileMeta(ctx, workSchedId, project.schedulingProfile, ownerHistId);
  writeImportProvenanceMeta(ctx, workSchedId, importPristine === true, recordedSourceFormat, ownerHistId);

  const literalCalendarIds = [...new Set([calendar, ...resourceCalendars].map(cal => cal.id))].filter(id => writeView.literalCalendarIds.has(id));
  if (merge) return { text: '', lines: ctx.lines, idMap: ctx.idMap, literalCalendarIds };

  const footer = '\nENDSEC;\nEND-ISO-10303-21;\n';

  return { text: header + ctx.lines.join('\n') + footer, lines: ctx.lines, idMap: ctx.idMap, literalCalendarIds };
}

function writeXerSourceArchive(
  ctx: WriteContext, ownerHistId: number, archive: XerSourceArchive | undefined, sourceProjectId: string | undefined,
  storage: 'embedded' | 'recovery-reference',
): void {
  if (!archive) return;
  if (!sourceProjectId) throw new Error('XER-bronarchief kan niet zonder OPS_XerDocument-selector worden opgeslagen.');
  if (!archive.diagnostics.documentViews[sourceProjectId]) {
    throw new Error('XER-bronarchief kan niet zonder geldige OPS_XerDocument-selector worden opgeslagen.');
  }
  const props: number[] = [];
  const property = (name: string, value: string) => props.push(addLine(ctx, `xerarchive_prop_${name}`, `IFCPROPERTYSINGLEVALUE(${ifcStr(name)},$,${value},$)`));
  if (storage === 'recovery-reference') {
    property(PROP.XerSourceArchive.SchemaVersion, `IFCINTEGER(${XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_SCHEMA_VERSION})`);
    property(PROP.XerSourceArchive.Format, `IFCLABEL(${ifcStr(archive.format)})`);
    property(PROP.XerSourceArchive.StorageFormat, `IFCLABEL(${ifcStr(XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_FORMAT)})`);
    property(PROP.XerSourceArchive.ByteLength, `IFCINTEGER(${archive.byteLength})`);
    property(PROP.XerSourceArchive.Sha256, `IFCTEXT(${ifcStr(archive.sha256)})`);
  } else {
    property(PROP.XerSourceArchive.SchemaVersion, `IFCINTEGER(${XER_SOURCE_ARCHIVE_COMPACT_STORAGE_SCHEMA_VERSION})`);
    property(PROP.XerSourceArchive.Format, `IFCLABEL(${ifcStr(archive.format)})`);
    property(PROP.XerSourceArchive.StorageFormat, `IFCLABEL(${ifcStr(XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT)})`);
    property(PROP.XerSourceArchive.ByteLength, `IFCINTEGER(${archive.byteLength})`);
    property(PROP.XerSourceArchive.Sha256, `IFCTEXT(${ifcStr(archive.sha256)})`);
    property(PROP.XerSourceArchive.ByteChunkSize, `IFCINTEGER(${XER_SOURCE_ARCHIVE_CHUNK_BYTES})`);
    property(PROP.XerSourceArchive.ByteChunkCount, `IFCINTEGER(${archive.byteChunks.length})`);
    archive.byteChunks.forEach((chunk, index) => property(xerArchiveChunkName(XER_ARCHIVE_CHUNK.bytes, index), `IFCTEXT(${ifcStr(chunk)})`));
  }
  const setId = addLine(ctx, 'pset_xerarchive', `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_xerarchive'))},#${ownerHistId},${ifcStr(PSET.XerSourceArchive)},$,(${props.map(id => `#${id}`).join(',')}))`);
  addLine(ctx, 'rel_xerarchive', `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_xerarchive'))},#${ownerHistId},$,$,(${ref(ctx, '_project')}),#${setId})`);
  const selectorProps: number[] = [];
  const selector = (name: string, value: string) => selectorProps.push(addLine(ctx, `xerdoc_prop_${name}`, `IFCPROPERTYSINGLEVALUE(${ifcStr(name)},$,${value},$)`));
  selector(PROP.XerDocument.ArchiveSha256, `IFCTEXT(${ifcStr(archive.sha256)})`);
  selector(PROP.XerDocument.SourceProjectId, `IFCTEXT(${ifcStr(sourceProjectId)})`);
  const selectorSet = addLine(ctx, 'pset_xerdocument', `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_xerdocument'))},#${ownerHistId},${ifcStr(PSET.XerDocument)},$,(${selectorProps.map(id => `#${id}`).join(',')}))`);
  addLine(ctx, 'rel_xerdocument', `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_xerdocument'))},#${ownerHistId},$,$,(${ref(ctx, '_project')}),#${selectorSet})`);
}

function writeTaskTypeMeta(
  ctx: WriteContext, tasks: Task[], customTaskTypes: CustomTaskType[], ownerHistId: number,
): void {
  if (!tasks.some(t => t.customTaskTypeId)) return;
  const definitions = savedCustomTaskTypes(tasks, customTaskTypes);
  const taskTypeIds: Record<string, string> = {};
  for (const task of tasks) if (task.customTaskTypeId) taskTypeIds[objectGuid(ctx, 'task', task.id)] = task.customTaskTypeId;
  const value = JSON.stringify({ definitions, taskTypeIds });
  const propId = addLine(ctx, '_ps_tasktypes_json',
    `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.TaskTypes.TaskTypes)},$,IFCTEXT(${ifcStr(asciiJson(value))}),$)`);
  const setId = addLine(ctx, '_pset_tasktypes',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_tasktypes'))},#${ownerHistId},${ifcStr(PSET.TaskTypes)},$,(#${propId}))`);
  addLine(ctx, '_rel_tasktypes',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_tasktypes'))},#${ownerHistId},$,$,(#${ctx.idMap.get('_project')}),#${setId})`);
}

function ifcTypedValue(type: CustomFieldType, value: CustomFieldValue): string {
  switch (type) {
    case 'text': return `IFCTEXT(${ifcRequiredStr(String(value))})`;
    case 'number': return ifcTypedReal('IFCREAL', Number(value));
    case 'integer': return `IFCINTEGER(${Math.round(Number(value))})`;
    case 'cost': return ifcTypedReal('IFCMONETARYMEASURE', Number(value));
    case 'date': return ifcDateValue(String(value));
    case 'boolean': return `IFCBOOLEAN(${value ? '.T.' : '.F.'})`;
    default: {
      const _exhaustive: never = type;
      throw new Error(`Onbekend custom-field-type: ${String(_exhaustive)}`);
    }
  }
}

function writeStructure(
  ctx: WriteContext,
  project: Project,
  tasks: Task[],
  activityCodeTypes: ActivityCodeType[],
  customFieldDefs: CustomFieldDef[],
  ownerHistId: number,
): void {
  const projRef = ref(ctx, '_project');
  const relDefines = (key: string, objRef: string, setId: number) =>
    addLine(ctx, key,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, key))},#${ownerHistId},$,$,(${objRef}),#${setId})`);

  const projSettingProps: number[] = [];
  projSettingProps.push(addLine(ctx, '_ps_projectid',
    `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.InternalProjectId)},$,IFCTEXT(${ifcStr(project.id)}),$)`));
  if (project.wbsAutoNumber !== undefined) {
    projSettingProps.push(addLine(ctx, '_ps_wbsauto',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.wbsAutoNumber)},$,IFCBOOLEAN(${project.wbsAutoNumber ? '.T.' : '.F.'}),$)`));
  }
  if (project.defaultTaskDurationUnit) {
    projSettingProps.push(addLine(ctx, '_ps_defaultdurationunit',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.DefaultTaskDurationUnit)},$,IFCLABEL(${ifcStr(project.defaultTaskDurationUnit)}),$)`));
  }
  if (project.defaultWorkRule) {
    projSettingProps.push(addLine(ctx, '_ps_defaultworkrule',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.DefaultWorkRule)},$,IFCLABEL(${ifcStr(project.defaultWorkRule)}),$)`));
  }
  if (project.statusDate) {
    projSettingProps.push(addLine(ctx, '_ps_statusdate',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.StatusDate)},$,${ifcDateValue(project.statusDate)},$)`));
  }
  if (project.progressMode && project.progressMode !== 'RETAINED_LOGIC') {
    projSettingProps.push(addLine(ctx, '_ps_progressmode',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.ProgressMode)},$,IFCLABEL(${ifcStr(project.progressMode)}),$)`));
  }
  const contractDateProp = (key: string, name: string, value: string): number =>
    addLine(ctx, key,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(name)},$,${value ? ifcDateValue(value) : '$'},$)`);
  projSettingProps.push(contractDateProp('_ps_projstart', PROP.ProjectSettings.ProjectStartDate, project.startDate));
  projSettingProps.push(contractDateProp('_ps_projend', PROP.ProjectSettings.ProjectEndDate, project.endDate));

  if (project.createdAt) {
    projSettingProps.push(addLine(ctx, '_ps_createdat',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.CreatedAt)},$,IFCTEXT(${ifcStr(project.createdAt)}),$)`));
  }
  if (project.modifiedAt) {
    projSettingProps.push(addLine(ctx, '_ps_modifiedat',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.ModifiedAt)},$,IFCTEXT(${ifcStr(project.modifiedAt)}),$)`));
  }
  if (project.companyId) {
    projSettingProps.push(addLine(ctx, '_ps_companyid',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.CompanyId)},$,IFCTEXT(${ifcStr(project.companyId)}),$)`));
  }
  if (project.companyName) {
    projSettingProps.push(addLine(ctx, '_ps_companyname',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.CompanyName)},$,IFCTEXT(${ifcStr(project.companyName)}),$)`));
  }
  const schemaQuestion = ifcSchemaQuestionFor(project);
  projSettingProps.push(schemaQuestion
    ? addLine(ctx, '_ps_ifcschemaunconfirmed',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.IfcSchemaUnconfirmed)},$,IFCLABEL(${ifcStr(schemaQuestion.fileSchema)}),$)`)
    : addLine(ctx, '_ps_ifcschemaconfirmed',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.IfcSchemaConfirmed)},$,IFCBOOLEAN(.T.),$)`));
  if (project.p6ProjectCode) {
    projSettingProps.push(addLine(ctx, '_ps_p6projectcode',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.P6ProjectCode)},$,IFCTEXT(${ifcStr(project.p6ProjectCode)}),$)`));
  }
  if (project.dependentProjectsFolder) {
    projSettingProps.push(addLine(ctx, '_ps_dependentfolder',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.DependentProjectsFolder)},$,IFCTEXT(${ifcStr(project.dependentProjectsFolder)}),$)`));
  }
  if (ctx.merge?.projectSourceId !== undefined) {
    const projectData: [string, string, string][] = [
      ['_ps_projectname', PROP.ProjectSettings.ProjectName, project.name],
      ['_ps_projectdescription', PROP.ProjectSettings.ProjectDescription, project.description],
      ['_ps_author', PROP.ProjectSettings.Author, project.author],
      ['_ps_organization', PROP.ProjectSettings.Organization, project.company],
    ];
    for (const [key, name, value] of projectData) {
      projSettingProps.push(addLine(ctx, key,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(name)},$,${value ? `IFCTEXT(${ifcStr(value)})` : '$'},$)`));
    }
  }
  if (project.anchorsFromOpenDocuments) {
    projSettingProps.push(addLine(ctx, '_ps_anchorsfromopen',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ProjectSettings.AnchorsFromOpenDocuments)},$,IFCBOOLEAN(.T.),$)`));
  }
  if (projSettingProps.length > 0) {
    const setId = addLine(ctx, '_pset_projset',
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_projset'))},#${ownerHistId},${ifcStr(PSET.ProjectSettings)},$,(${projSettingProps.map(i => `#${i}`).join(',')}))`);
    relDefines('_rel_projset', projRef, setId);
  }

  if (activityCodeTypes.length === 0 && customFieldDefs.length === 0) return;

  const metaJson = JSON.stringify({ activityCodeTypes, customFieldDefs });
  const metaPropId = addLine(ctx, '_ps_structmeta',
    `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.StructureMeta.structure)},$,IFCTEXT(${ifcStr(asciiJson(metaJson))}),$)`);
  const metaSetId = addLine(ctx, '_pset_structmeta',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_structmeta'))},#${ownerHistId},${ifcStr(PSET.StructureMeta)},$,(#${metaPropId}))`);
  relDefines('_rel_structmeta', projRef, metaSetId);

  const templateIds: number[] = [];
  if (customFieldDefs.length > 0) {
    const fieldTmplRefs = customFieldDefs.map(def => {
      const id = addLine(ctx, `_cft_${def.id}`,
        `IFCSIMPLEPROPERTYTEMPLATE(${ifcStr(guidOf(ctx, 'cft_' + def.id))},#${ownerHistId},${ifcStr(def.name)},$,.P_SINGLEVALUE.,${ifcStr(FIELD_MEASURE[def.type])},$,$,$,$,$,$)`);
      return `#${id}`;
    });
    templateIds.push(addLine(ctx, '_psett_fields',
      `IFCPROPERTYSETTEMPLATE(${ifcStr(guidOf(ctx, 'psett_fields'))},#${ownerHistId},${ifcStr(PSET.CustomFields)},$,.PSET_OCCURRENCEDRIVEN.,'IfcTask',(${fieldTmplRefs.join(',')}))`));
  }
  if (activityCodeTypes.length > 0) {
    const codeTmplRefs = activityCodeTypes.map(t => {
      const labels = t.values.map(v => `IFCLABEL(${ifcRequiredStr(v.code)})`).join(',');
      const enumRef = t.values.length > 0
        ? `#${addLine(ctx, `_acte_${t.id}`, `IFCPROPERTYENUMERATION(${ifcRequiredStr(t.name)},(${labels}),$)`)}`
        : '$';
      const id = addLine(ctx, `_actt_${t.id}`,
        `IFCSIMPLEPROPERTYTEMPLATE(${ifcStr(guidOf(ctx, 'actt_' + t.id))},#${ownerHistId},${ifcStr(t.name)},$,.P_ENUMERATEDVALUE.,$,$,${enumRef},$,$,$,$)`);
      return `#${id}`;
    });
    templateIds.push(addLine(ctx, '_psett_codes',
      `IFCPROPERTYSETTEMPLATE(${ifcStr(guidOf(ctx, 'psett_codes'))},#${ownerHistId},${ifcStr(PSET.ActivityCodes)},$,.PSET_OCCURRENCEDRIVEN.,'IfcTask',(${codeTmplRefs.join(',')}))`));
  }
  if (templateIds.length > 0) {
    addLine(ctx, '_decl_templates',
      `IFCRELDECLARES(${ifcStr(guidOf(ctx, 'decl_templates'))},#${ownerHistId},$,$,${projRef},(${templateIds.map(i => `#${i}`).join(',')}))`);
  }

  const typeById = new Map(activityCodeTypes.map(t => [t.id, t]));
  const defById = new Map(customFieldDefs.map(d => [d.id, d]));
  for (const task of tasks) {
    const fieldEntries = Object.entries(task.customFields ?? {}).filter(([defId]) => defById.has(defId));
    if (fieldEntries.length > 0) {
      const propRefs = fieldEntries.map(([defId, value]) => {
        const def = defById.get(defId)!;
        const id = addLine(ctx, `_cfv_${task.id}_${defId}`,
          `IFCPROPERTYSINGLEVALUE(${ifcRequiredStr(def.name)},$,${ifcTypedValue(def.type, value)},$)`);
        return `#${id}`;
      });
      const setId = addLine(ctx, `_pset_cf_${task.id}`,
        `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_cf_' + task.id))},#${ownerHistId},${ifcStr(PSET.CustomFields)},$,(${propRefs.join(',')}))`);
      relDefines(`_rel_cf_${task.id}`, ref(ctx, `task_${task.id}`), setId);
    }

    const codeEntries = Object.entries(task.activityCodes ?? {}).filter(([typeId, valueId]) => {
      const t = typeById.get(typeId);
      return !!t && t.values.some(v => v.id === valueId);
    });
    if (codeEntries.length > 0) {
      const propRefs = codeEntries.flatMap(([typeId, valueId]) => {
        const t = typeById.get(typeId)!;
        const v = t.values.find(x => x.id === valueId)!;
        const id = addLine(ctx, `_acv_${task.id}_${typeId}`,
          `IFCPROPERTYENUMERATEDVALUE(${ifcRequiredStr(t.name)},$,(IFCLABEL(${ifcRequiredStr(v.code)})),$)`);
        const refs = [`#${id}`];
        if (t.values.some(x => x.id !== v.id && x.code === v.code)) {
          refs.push(`#${addLine(ctx, `_acid_${task.id}_${typeId}`,
            `IFCPROPERTYSINGLEVALUE(${ifcRequiredStr(t.name + ACTIVITY_CODE_ID_SUFFIX)},$,IFCTEXT(${ifcStr(v.id)}),$)`)}`);
        }
        return refs;
      });
      const setId = addLine(ctx, `_pset_ac_${task.id}`,
        `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_ac_' + task.id))},#${ownerHistId},${ifcStr(PSET.ActivityCodes)},$,(${propRefs.join(',')}))`);
      relDefines(`_rel_ac_${task.id}`, ref(ctx, `task_${task.id}`), setId);
    }
  }
}

function writeLibraryPool(
  ctx: WriteContext,
  ownerHistId: number,
  pool: import('@/types/library').CompanyPool | undefined,
): void {
  if (!pool) return;
  const projRef = ref(ctx, '_project');
  const json = JSON.stringify(pool);
  const propId = addLine(ctx, '_ps_library',
    `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Library.pool)},$,IFCTEXT(${ifcStr(asciiJson(json))}),$)`);
  const setId = addLine(ctx, '_pset_library',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_library'))},#${ownerHistId},${ifcStr(PSET.Library)},$,(#${propId}))`);
  addLine(ctx, '_rel_library',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_library'))},#${ownerHistId},$,$,(${projRef}),#${setId})`);
}

function emitPerTaskPsets(
  ctx: WriteContext, tasks: Task[], ownerHistId: number, taskRecords: ReadonlyMap<string, PerTaskWriteOptions>,
): void {
  for (const desc of PER_TASK_PSETS) {
    for (const task of tasks) {
      const specs = desc.write(task, {
        atDayEnd: ctx.milestonesAtDayEnd?.has(task.id) === true,
        ...taskRecords.get(task.id),
      });
      if (!specs || specs.length === 0) continue;
      const propRefs = specs.map((s, i) =>
        `#${addLine(ctx, `_prop_${desc.name}_${task.id}_${i}`,
          `IFCPROPERTYSINGLEVALUE(${ifcStr(s.name)},$,${s.value},$)`)}`);
      const setId = addLine(ctx, `_pset_${desc.name}_${task.id}`,
        `IFCPROPERTYSET(${ifcStr(guidOf(ctx, desc.psetSeed + task.id))},#${ownerHistId},${ifcStr(desc.name)},$,(${propRefs.join(',')}))`);
      addLine(ctx, `_rel_${desc.name}_${task.id}`,
        `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, desc.relSeed + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
    }
  }
}

function writeBaselineMeta(
  ctx: WriteContext,
  workSchedId: number,
  baselines: Baseline[],
  activeBaselineId: string | null,
  comparedBaselineIds: readonly (string | null)[] | undefined,
  ownerHistId: number,
): void {
  if (baselines.length === 0) return;
  const json = JSON.stringify(baselines);
  const props: number[] = [];
  props.push(addLine(ctx, '_ps_baselines_json',
    `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Baselines.Baselines)},$,IFCTEXT(${ifcStr(asciiJson(json))}),$)`));
  const baselineTaskGuids: Record<string, string> = {};
  for (const b of baselines) {
    for (const bt of b.tasks ?? []) {
      if (bt.taskId) baselineTaskGuids[bt.taskId] = objectGuid(ctx, 'task', bt.taskId);
    }
  }
  if (Object.keys(baselineTaskGuids).length > 0) {
    props.push(addLine(ctx, '_ps_baselines_guids',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Baselines.TaskGuids)},$,IFCTEXT(${ifcJson(baselineTaskGuids)}),$)`));
  }
  if (activeBaselineId) {
    props.push(addLine(ctx, '_ps_baselines_active',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Baselines.ActiveBaselineId)},$,IFCTEXT(${ifcStr(activeBaselineId)}),$)`));
  }
  if (comparedBaselineIds?.some(id => !!id)) {
    props.push(addLine(ctx, '_ps_baselines_compared',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Baselines.ComparedBaselineIds)},$,IFCTEXT(${ifcJson([comparedBaselineIds[0] ?? null, comparedBaselineIds[1] ?? null])}),$)`));
  }
  const setId = addLine(ctx, '_pset_baselines',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_baselines'))},#${ownerHistId},${ifcStr(PSET.Baselines)},$,(${props.map(i => `#${i}`).join(',')}))`);
  addLine(ctx, '_rel_baselines',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_baselines'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

function writeSchedulingOptionsMeta(
  ctx: WriteContext,
  workSchedId: number,
  options: SchedulingOptions | undefined,
  ownerHistId: number,
): void {
  if (!options || Object.keys(options).length === 0) return;
  const json = JSON.stringify(options);
  const propId = addLine(ctx, '_ps_schedopts',
    `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.SchedulingOptions.SchedulingOptions)},$,IFCTEXT(${ifcStr(asciiJson(json))}),$)`);
  const setId = addLine(ctx, '_pset_schedopts',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_schedopts'))},#${ownerHistId},${ifcStr(PSET.SchedulingOptions)},$,(#${propId}))`);
  addLine(ctx, '_rel_schedopts',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_schedopts'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

export function writeSchedulingProfileMeta(
  ctx: WriteContext,
  workSchedId: number,
  profile: SchedulingProfile | undefined,
  ownerHistId: number,
): void {
  if (!carriesProfile(profile)) return;
  const json = JSON.stringify(schedulingProfileToJson(profile));
  const propId = addLine(ctx, '_ps_schedprofile',
    `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.SchedulingProfile.SchedulingProfile)},$,IFCTEXT(${ifcStr(asciiJson(json))}),$)`);
  const setId = addLine(ctx, '_pset_schedprofile',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_schedprofile'))},#${ownerHistId},${ifcStr(PSET.SchedulingProfile)},$,(#${propId}))`);
  addLine(ctx, '_rel_schedprofile',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_schedprofile'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

function writeImportProvenanceMeta(
  ctx: WriteContext,
  workSchedId: number,
  importPristine: boolean,
  sourceFormat: RecordedSourceFormat | undefined,
  ownerHistId: number,
): void {
  if (!importPristine && !sourceFormat) return;
  const propIds: number[] = [];
  if (importPristine) {
    propIds.push(addLine(ctx, '_ps_importprov',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ImportProvenance.UnchangedSinceImport)},$,IFCBOOLEAN(.T.),$)`));
  }
  if (sourceFormat) {
    propIds.push(addLine(ctx, '_ps_importprov_source',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.ImportProvenance.SourceFormat)},$,IFCLABEL(${ifcStr(sourceFormat)}),$)`));
  }
  const setId = addLine(ctx, '_pset_importprov',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_importprov'))},#${ownerHistId},${ifcStr(PSET.ImportProvenance)},$,(${propIds.map(id => `#${id}`).join(',')}))`);
  addLine(ctx, '_rel_importprov',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_importprov'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

function shiftToPredefinedType(shift: WorkCalendar['shift']): string {
  switch (shift) {
    case 'SECOND': return '.SECONDSHIFT.';
    case 'THIRD': return '.THIRDSHIFT.';
    case 'USERDEFINED': return '.USERDEFINED.';
    default: return '.FIRSTSHIFT.';
  }
}

interface WriteCalendarResult {
  calStepId: number;
  workingExceptionStepIds: number[];
  readerScalarHours: { start: number; end: number } | undefined;
  materializedScalarBands: boolean;
  scalarPeriodReadsAsHour: boolean;
  perDayWeek: boolean;
  readerHourCalendarHoursPerDay: number | undefined;
}

interface WeekBandGroup {
  days: number[];
  bands: ReadonlyArray<{ start: number; end: number }>;
}

const ISO_DAY_LABEL: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

function weekBandGroups(workDays: readonly number[], workTime: WorkTimeBands, cal: WorkCalendar): WeekBandGroup[] {
  const ownBands = (day: number) => (day >= 1 && day <= 7 ? workTime.byWeekday[day as 1] : undefined) ?? [];
  const firstDayBands = workDays.length > 0 ? ownBands(workDays[0]) : [];
  const groups: WeekBandGroup[] = [];
  const byKey = new Map<string, WeekBandGroup>();
  for (const day of workDays) {
    const own = ownBands(day);
    const bands = own.length > 0 ? own : firstDayBands;
    const key = [...bands].sort((a, b) => a.start - b.start || a.end - b.end)
      .map((b, i) => `${b.start}-${b.end}:${JSON.stringify(cal.ifcTimePeriods?.filter(p => p.binding === `week:${day}:${i}`).map(p => [p.startText, p.endText]))}`).join(',');
    let group = byKey.get(key);
    if (!group) {
      group = { days: [], bands };
      byKey.set(key, group);
      groups.push(group);
    }
    group.days.push(day);
  }
  return groups;
}

function calendarClock(minutes: number, endOfDay = false): string {
  const text = minutesToClock(minutes, endOfDay);
  const parsed = parseIfcClock(text);
  const normalized = minutes % 1440 < 0 ? minutes % 1440 + 1440 : minutes % 1440;
  if (!Number.isFinite(normalized)) throw new IfcCalendarTimePrecisionError(minutes);
  if (parsed && normalized === parsed.minutes % 1440) return text;
  const whole = Math.floor(normalized);
  let seconds = String((normalized - whole) * 60);
  if (seconds.includes('e')) {
    const [coefficient, exponent] = seconds.split('e');
    const digits = coefficient.replace('.', '');
    const point = (coefficient.indexOf('.') < 0 ? coefficient.length : coefficient.indexOf('.')) + Number(exponent);
    seconds = point <= 0 ? `0.${'0'.repeat(-point)}${digits}`
      : point >= digits.length ? digits + '0'.repeat(point - digits.length)
        : `${digits.slice(0, point)}.${digits.slice(point)}`;
  }
  const [ss, fraction] = seconds.split('.');
  const exact = `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}:${ss.padStart(2, '0')}${fraction ? `.${fraction}` : ''}`;
  if (parseIfcClock(exact)?.minutes !== normalized) {
    throw new IfcCalendarTimePrecisionError(minutes);
  }
  return exact;
}

function calendarPeriodClocks(cal: WorkCalendar, band: { start: number; end: number }, binding: string, scalarSides: readonly ('start' | 'end')[] = []): [string, string] {
  const source = cal.ifcTimePeriods?.find(p => p.binding === binding);
  const scalarSource = cal.ifcTimePeriods?.find(p => p.binding === 'scalar');
  const SOURCE_PERIOD_TOLERANCE_MINUTES = 1e-9;
  const clock = (side: 'start' | 'end'): string => {
    const original = scalarSides.includes(side) ? scalarSource ?? source : source;
    const text = original?.[side === 'start' ? 'startText' : 'endText'];
    if (original && text) {
      const unchanged = scalarSides.includes(side) && scalarSource !== undefined
        ? original[side === 'start' ? 'scalarStart' : 'scalarEnd'] === cal[side === 'start' ? 'workStartHour' : 'workEndHour']
        : original[side] === band[side];
      const samePeriod = original.scalarStart !== undefined && original.scalarEnd !== undefined
        && band.start === original.scalarStart * 60 && band.end === original.scalarEnd * 60;
      if (unchanged) {
        if (side === 'start' || samePeriod) return text;
        const start = parseIfcClock(writtenStart)?.minutes ?? clockToMinutes(writtenStart);
        const end = parseIfcClock(text)?.minutes ?? clockToMinutes(text);
        if (start !== null && end !== null) {
          const period = canonicalizeBands({ 1: [{ start, end }] }).bands.byWeekday[1][0];
          if (Math.abs((period.end - period.start) - (band.end - band.start)) <= SOURCE_PERIOD_TOLERANCE_MINUTES) return text;
        }
      }
      if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) throw new IfcCalendarTimePrecisionError(band[side]);
    }
    return calendarClock(band[side], side === 'end');
  };
  const writtenStart = clock('start');
  return [writtenStart, clock('end')];
}

function writeCalendar(
  ctx: WriteContext,
  cal: WorkCalendar,
  ownerHistId: number,
  key: string = '_calendar',
  includeEffectiveScalarBands = false,
): WriteCalendarResult {
  const originalLayout = cal.ifcTimePeriods?.[0]?.layout;
  if (originalLayout !== undefined && originalLayout !== ifcCalendarBandLayout(cal)) {
    const protectedSource = cal.ifcTimePeriods?.find(p => [p.startText, p.endText].some((text, side) => {
      if (!text) return false;
      const clock = parseIfcClock(text);
      if (!clock || /(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) return true;
      if (clock.legacyBand || /[.e]/i.test(text.split(':')[0])) return false;
      return clock.preserve && calendarClock(clock.minutes, side === 1) !== text;
    }));
    if (protectedSource) throw new IfcCalendarTimePrecisionError(protectedSource.start);
  }
  let firstPeriod: [string, string] | undefined;
  let multiplePeriods = false;
  let perDayWeek = false;
  let scalarPeriodReadsAsHour = false;
  const workTime = cal.workTime ?? (includeEffectiveScalarBands ? effectiveWorkTimeBands(cal) : undefined);
  const groups = workTime ? weekBandGroups(cal.workDays, workTime, cal) : [];
  const workTimeIds: number[] = [];
  const clocks = (band: { start: number; end: number }, day: number, i: number, count: number) => calendarPeriodClocks(cal, band, !cal.workTime && cal.ifcTimePeriods?.some(p => p.binding === 'scalar') ? 'scalar-derived' : `week:${day}:${i}`, !cal.workTime ? [
    ...(i === 0 && band.start === cal.workStartHour * 60 ? ['start' as const] : []),
    ...(i === count - 1 && band.end === cal.workEndHour * 60 ? ['end' as const] : []),
  ] : []);
  const writePeriod = (values: [string, string], periodKey: string) => {
    const [start, end] = values;
    return addLine(ctx, periodKey, `IFCTIMEPERIOD(${ifcStr(start)},${ifcStr(end)})`);
  };
  const writeWeek = (days: readonly number[], bands: WeekBandGroup['bands'], label: string): number => {
    const ids = bands.map((b, i) => writePeriod(clocks(b, days[0], i, bands.length), '_timeperiod'));
    if (!firstPeriod && bands[0]) {
      firstPeriod = clocks(bands[0], days[0], 0, bands.length);
      multiplePeriods = bands.length > 1;
    }
    const recurrenceId = addLine(ctx, '_recurrence',
      `IFCRECURRENCEPATTERN(.WEEKLY.,$,(${days.join(',')}),$,$,$,$,(${ids.map((i) => `#${i}`).join(',')}))`);
    return addLine(ctx, '_worktime', `IFCWORKTIME(${ifcStr(label)},.PREDICTED.,$,#${recurrenceId},$,$)`);
  };
  if (groups.length > 1) {
    const written = groups.filter((g) => g.bands.length > 0);
    perDayWeek = written.length > 1;
    for (const group of written) {
      const label = `Standard work week (${group.days.map((d) => ISO_DAY_LABEL[d] ?? String(d)).join(', ')})`;
      workTimeIds.push(writeWeek(group.days, group.bands, label));
    }
  } else {
    const dayNums = cal.workDays.join(',');
    let timePeriodRefs: string;
    if (workTime) {
      const firstDay = cal.workDays[0] as 1 | 2 | 3 | 4 | 5 | 6 | 7 | undefined;
      const bands = (firstDay && workTime.byWeekday[firstDay]) || [];
      const ids = bands.map((b, i) => writePeriod(clocks(b, firstDay!, i, bands.length), '_timeperiod'));
      timePeriodRefs = ids.map((i) => `#${i}`).join(',');
      if (bands[0]) {
        firstPeriod = clocks(bands[0], firstDay!, 0, bands.length);
        multiplePeriods = bands.length > 1;
        }
    } else {
      const scalarBand = { start: cal.workStartHour * 60, end: cal.workEndHour * 60 };
      const [startTime, endTime] = calendarPeriodClocks(cal, scalarBand, 'scalar', ['start', 'end']);
      const timePeriodId = writePeriod([startTime, endTime], '_timeperiod');
      timePeriodRefs = `#${timePeriodId}`;
      firstPeriod = [startTime, endTime];
      const s = clockToMinutes(startTime);
      const e = clockToMinutes(endTime);
      scalarPeriodReadsAsHour = parseIfcClock(startTime)?.legacyBand === true
        || parseIfcClock(endTime)?.legacyBand === true
        || (s != null && e != null && canonicalizeBands({ 1: [{ start: s, end: e }] }).deviates);
    }
    const recurrenceId = addLine(ctx, '_recurrence',
      `IFCRECURRENCEPATTERN(.WEEKLY.,$,${dayNums ? `(${dayNums})` : '$'},$,$,$,$,${timePeriodRefs ? `(${timePeriodRefs})` : '$'})`);
    workTimeIds.push(addLine(ctx, '_worktime', `IFCWORKTIME('Standard work week',.PREDICTED.,$,#${recurrenceId},$,$)`));
  }

  const holidayRefs: string[] = [];
  for (const holiday of cal.holidays) {
    const hId = addLine(ctx, `_holiday_${holiday.name}`,
      `IFCWORKTIME(${ifcStr(holiday.name)},.PREDICTED.,$,$,'${holiday.startDate}','${holidayEndDate(holiday)}')`);
    holidayRefs.push(`#${hId}`);
  }

  const workingExceptionRefs: string[] = [];
  const workingExceptionStepIds: number[] = [];
  for (const exc of cal.workingExceptions ?? []) {
    const bandIds = (exc.bands ?? []).map((b, i) => writePeriod(calendarPeriodClocks(cal, b, `exception:${JSON.stringify([exc.startDate, exc.endDate, exc.name])}:${i}`), '_excband'));
    const bandRefs = bandIds.length > 0 ? `(${bandIds.map((i) => `#${i}`).join(',')})` : '$';
    const excRecId = addLine(ctx, '_excrecurrence', `IFCRECURRENCEPATTERN(.DAILY.,$,$,$,$,$,$,${bandRefs})`);
    const wId = addLine(ctx, `_workexc_${exc.name}`,
      `IFCWORKTIME(${ifcStr(exc.name)},.PREDICTED.,$,#${excRecId},'${exc.startDate}','${exc.endDate}')`);
    workingExceptionRefs.push(`#${wId}`);
    workingExceptionStepIds.push(wId);
  }

  const allExceptionRefs = [...holidayRefs, ...workingExceptionRefs];
  const exceptStr = allExceptionRefs.length > 0 ? `(${allExceptionRefs.join(',')})` : '$';
  const objectType = cal.shift === 'USERDEFINED' ? ifcStr('USERDEFINED') : '$';
  const calStepId = addLine(ctx, key,
    `IFCWORKCALENDAR(${ifcStr(objectGuid(ctx, 'cal', cal.id))},#${ownerHistId},${ifcStr(cal.name)},${ifcStr(cal.description)},${objectType},$,(${workTimeIds.map((i) => `#${i}`).join(',')}),${exceptStr},${shiftToPredefinedType(cal.shift)})`);
  return {
    calStepId,
    workingExceptionStepIds,
    readerScalarHours: firstPeriod
      ? {
        start: multiplePeriods ? Math.floor(parseFloat(firstPeriod[0].split(':')[0])) : parseFloat(firstPeriod[0].split(':')[0]),
        end: parseFloat(firstPeriod[1].split(':')[0]),
      }
      : undefined,
    materializedScalarBands: !cal.workTime && workTime !== undefined,
    scalarPeriodReadsAsHour,
    perDayWeek,
    readerHourCalendarHoursPerDay: cal.workTime ? writtenWeekHoursPerDay(groups) : undefined,
  };
}

function writtenWeekHoursPerDay(groups: readonly WeekBandGroup[]): number {
  const byWeekday: Record<number, WeekBandGroup['bands']> = {};
  for (const group of groups) for (const day of group.days) byWeekday[day] = group.bands;
  return deriveHoursPerDay({ byWeekday } as WorkTimeBands, NaN);
}

function writeCalendarGenerationMeta(
  ctx: WriteContext,
  cal: WorkCalendar,
  ownerHistId: number,
  written: WriteCalendarResult,
): void {
  const {
    calStepId, workingExceptionStepIds, readerScalarHours, materializedScalarBands, perDayWeek,
    readerHourCalendarHoursPerDay, scalarPeriodReadsAsHour,
  } = written;
  const markScalar = materializedScalarBands || scalarPeriodReadsAsHour;
  const literalTimes = ctx.literalCalendarIds?.has(cal.id) === true;
  const gen = cal.generation;
  const derivedHoursPerDay = cal.workTime
    ? readerHourCalendarHoursPerDay
    : cal.workEndHour - cal.workStartHour;
  const needsHoursPerDayOverride = hoursPerDayDiffers(cal.hoursPerDay, derivedHoursPerDay);
  const hasWorkingExceptions = workingExceptionStepIds.length > 0;
  const hasP6Source = cal.p6Source === 'XER';
  const hasRejectedPenaltyDiagnostic = cal.p6NonWorkPenaltyDatesState === 'REJECTED';
  const hasSimpleBreak = !cal.workTime
    && (cal.simpleBreakStartMinute !== undefined || cal.simpleBreakDurationMinutes !== undefined);
  const isHourCalendar = cal.workTime !== undefined;
  const needsWorkStartHour = Number.isFinite(cal.workStartHour)
    && (perDayWeek || readerScalarHours?.start !== cal.workStartHour);
  const needsWorkEndHour = Number.isFinite(cal.workEndHour)
    && (perDayWeek || readerScalarHours?.end !== cal.workEndHour);
  if (!gen && !cal.libraryOrigin && !needsHoursPerDayOverride && !hasWorkingExceptions
    && !hasSimpleBreak && !isHourCalendar && !markScalar && !needsWorkStartHour && !needsWorkEndHour
    && !hasP6Source && !hasRejectedPenaltyDiagnostic && !literalTimes) return;
  const props: number[] = [];
  if (literalTimes) props.push(addLine(ctx, `_opscal_literal_${cal.id}`, `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.LiteralTimes)},$,IFCBOOLEAN(.T.),$)`));
  if (gen) {
    props.push(addLine(ctx, `_opscal_ruleset_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.RuleSetId)},$,IFCLABEL(${ifcStr(gen.ruleSetId)}),$)`));
    if (gen.region) {
      props.push(addLine(ctx, `_opscal_region_${cal.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.Region)},$,IFCLABEL(${ifcStr(gen.region)}),$)`));
    }
    if (gen.breakChoice) {
      props.push(addLine(ctx, `_opscal_break_${cal.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.BreakChoice)},$,IFCLABEL(${ifcStr(gen.breakChoice)}),$)`));
    }
    props.push(addLine(ctx, `_opscal_from_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.GeneratedFromYear)},$,IFCINTEGER(${gen.generatedFromYear}),$)`));
    props.push(addLine(ctx, `_opscal_to_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.GeneratedToYear)},$,IFCINTEGER(${gen.generatedToYear}),$)`));
  }
  if (cal.libraryOrigin) {
    props.push(addLine(ctx, `_opscal_lo_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.LibraryOrigin)},$,IFCTEXT(${ifcJson(cal.libraryOrigin)}),$)`));
  }
  if (needsHoursPerDayOverride) {
    props.push(addLine(ctx, `_opscal_hpd_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.HoursPerDay)},$,${ifcTypedReal('IFCREAL', cal.hoursPerDay)},$)`));
  }
  if (needsWorkStartHour) {
    props.push(addLine(ctx, `_opscal_workstart_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.WorkStartHour)},$,${ifcTypedReal('IFCREAL', cal.workStartHour)},$)`));
  }
  if (needsWorkEndHour) {
    props.push(addLine(ctx, `_opscal_workend_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.WorkEndHour)},$,${ifcTypedReal('IFCREAL', cal.workEndHour)},$)`));
  }
  if (hasSimpleBreak) {
    if (cal.simpleBreakStartMinute !== undefined) {
      props.push(addLine(ctx, `_opscal_breakstart_${cal.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.SimpleBreakStart)},$,IFCINTEGER(${cal.simpleBreakStartMinute}),$)`));
    }
    if (cal.simpleBreakDurationMinutes !== undefined) {
      props.push(addLine(ctx, `_opscal_breakduration_${cal.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.SimpleBreakDuration)},$,IFCINTEGER(${cal.simpleBreakDurationMinutes}),$)`));
    }
  }
  if (isHourCalendar) {
    props.push(addLine(ctx, `_opscal_hourmode_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.IsHourCalendar)},$,IFCBOOLEAN(.T.),$)`));
  } else if (markScalar) {
    props.push(addLine(ctx, `_opscal_hourmode_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.IsHourCalendar)},$,IFCBOOLEAN(.F.),$)`));
  }
  if (hasWorkingExceptions) {
    props.push(addLine(ctx, `_opscal_wexckeys_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.WorkingExceptionKeysV1)},$,IFCTEXT(${ifcJson((cal.workingExceptions ?? []).map(calendarExceptionKey))}),$)`));
    const idJson = JSON.stringify(workingExceptionStepIds.map(String));
    props.push(addLine(ctx, `_opscal_wexc_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.WorkingExceptionIds)},$,IFCTEXT(${ifcStr(asciiJson(idJson))}),$)`));
  }
  if (hasP6Source) {
    props.push(addLine(ctx, `_opscal_p6source_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.P6Source)},$,IFCLABEL('XER'),$)`));
  }
  if (hasP6Source) {
    props.push(addLine(ctx, `_opscal_p6penalty_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.P6NonWorkPenaltyDates)},$,IFCTEXT(${ifcJson(cal.p6NonWorkPenaltyDates ?? [])}),$)`));
  }
  if (hasRejectedPenaltyDiagnostic) {
    props.push(addLine(ctx, `_opscal_p6penaltystate_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.P6NonWorkPenaltyDatesState)},$,IFCLABEL('REJECTED'),$)`));
  }
  const setId = addLine(ctx, `_pset_opscal_${cal.id}`,
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_opscal_' + cal.id))},#${ownerHistId},${ifcStr(PSET.Calendar)},$,(${props.map(i => `#${i}`).join(',')}))`);
  addLine(ctx, `_rel_opscal_${cal.id}`,
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_opscal_' + cal.id))},#${ownerHistId},$,$,(#${calStepId}),#${setId})`);
}

function writeCalendarLibrary(
  ctx: WriteContext,
  resources: Resource[],
  tasks: Task[],
  calendars: WorkCalendar[],
  ownerHistId: number,
  hourTaskCalendarIds: Set<string>,
): void {
  if (calendars.length === 0) return;
  const resourcesByCalendar = groupBy(resources, r => r.calendarId);
  const tasksByCalendar = groupBy(tasks, t => t.calendarId);
  for (const cal of calendars) {
    const written = writeCalendar(ctx, cal, ownerHistId, `calendar_${cal.id}`, hourTaskCalendarIds.has(cal.id));
    const { calStepId } = written;
    writeCalendarGenerationMeta(ctx, cal, ownerHistId, written);

    if (Number.isNaN(cal.id)) continue;

    const resRefs = (resourcesByCalendar.get(cal.id) ?? [])
      .map(r => optionalRef(ctx, `res_${r.id}`))
      .filter((r): r is string => r !== null);
    if (resRefs.length > 0) {
      addLine(ctx, `resctrl_${cal.id}`,
        `IFCRELASSIGNSTOCONTROL(${ifcStr(guidOf(ctx, 'resctrl_' + cal.id))},#${ownerHistId},$,$,(${resRefs.join(',')}),$,#${calStepId})`);
    }

    const taskRefs = (tasksByCalendar.get(cal.id) ?? [])
      .map(t => optionalRef(ctx, `task_${t.id}`))
      .filter((r): r is string => r !== null);
    if (taskRefs.length > 0) {
      addLine(ctx, `taskctrl_${cal.id}`,
        `IFCRELASSIGNSTOCONTROL(${ifcStr(guidOf(ctx, 'taskctrl_' + cal.id))},#${ownerHistId},$,$,(${taskRefs.join(',')}),$,#${calStepId})`);
    }
  }
}

function writeTask(
  ctx: WriteContext, task: Task, ownerHistId: number, statusDate: string | undefined,
  workHoursPerDay: number, customTaskTypeLabel?: string,
  withheld?: readonly WithheldTaskTimeField[],
): PerTaskWriteOptions {
  const t = task.time;
  const isHour = taskDurationUnit(task) === 'hours';
  const source = ctx.merge?.sourceTaskTimes?.get(task.id);
  const exactDays = isHour ? undefined : source?.exactDays;
  const sourceFloat = source?.exactFloat;
  const sourceDays = exactDays?.has('ScheduleDuration') === true;
  const dt = taskDateTimeFormatter(task);
  const minutesPerDay = taskMinutesPerDay(task, workHoursPerDay);
  const dayMeasureDurations: { [K in DayMeasureDurationKey]?: DayMeasureRecord } = {};
  const daysAsMinutes = (key: DayMeasureDurationKey, days: number): string => {
    const record = dayMeasureRecord(days, minutesPerDay);
    dayMeasureDurations[key] = record;
    return ifcDurationHour(record[1]);
  };
  const daysField = (key: DayMeasureDurationKey, days: number): string =>
    exactDays?.has(key) ? ifcDurationExact(days) : isWholeDays(days) ? ifcDuration(days) : daysAsMinutes(key, days);
  const exactMinutes: { [K in ExactMinutesKey]?: ExactMinutesRecord } = {};
  const hourMinutes = (key: ExactMinutesKey, minutes: number): string => {
    const record = exactMinutesRecord(minutes);
    if (record) exactMinutes[key] = record;
    return ifcDurationHour(minutes);
  };
  const dayAsMinutes = !isHour && !sourceDays && dayTaskWritesMinutes(task);
  const schedDurArg = isHour
    ? hourMinutes('ScheduleDuration', taskMinutesForWrite(task, workHoursPerDay))
    : sourceDays ? ifcDurationExact(t.scheduleDuration)
    : dayAsMinutes ? daysAsMinutes('ScheduleDuration', t.scheduleDuration) : ifcDuration(t.scheduleDuration);
  const hasActuals = !!(t.actualStart || t.actualFinish);
  const statusTimeArg = hasActuals && statusDate ? dt(statusDate) : '$';
  const actualDurationArg = t.actualDuration != null ? daysField('ActualDuration', t.actualDuration) : '$';
  const actualStartArg = t.actualStart ? dt(t.actualStart) : '$';
  const actualFinishArg = t.actualFinish ? dt(t.actualFinish) : '$';
  const remainingArg = isHour && t.remainingMinutes != null
    ? hourMinutes('RemainingTime', t.remainingMinutes)
    : t.remainingTime == null ? '$'
    : dayAsMinutes ? daysAsMinutes('RemainingTime', t.remainingTime) : daysField('RemainingTime', t.remainingTime);
  const exactFloat: { [K in ExactFloatKey]?: ExactFloatRecord } = {};
  const withheldSet = new Set(withheld ?? []);
  if (!sourceFloat?.has('totalFloat') && !withheldSet.has('totalFloat')) {
    const record = exactFloatRecord(t.totalFloat, t.totalFloatMinutes);
    if (record) exactFloat.TotalFloat = record;
  }
  if (!sourceFloat?.has('freeFloat') && !withheldSet.has('freeFloat')) {
    const record = exactFloatRecord(t.freeFloat, t.freeFloatMinutes);
    if (record) exactFloat.FreeFloat = record;
  }

  const ttCtx: TaskTimeWriteCtx = {
    task, dt, ifcDuration, schedDurArg, statusTimeArg,
    actualDurationArg, actualStartArg, actualFinishArg, remainingArg,
    ...(sourceFloat?.size ? { exactFloat: sourceFloat } : {}),
    ...(withheld && withheld.length > 0 ? { withheld: new Set(withheld) } : {}),
  };
  const taskTimeId = addLine(ctx, `tasktime_${task.id}`,
    `IFCTASKTIME(${IFC_TASKTIME_SLOTS.map(s => s.write(ttCtx)).join(',')})`);

  const taskCtx: TaskWriteCtx = {
    task, ownerHistId, guidArg: ifcStr(objectGuid(ctx, 'task', task.id)), taskTimeId, customTaskTypeLabel,
  };
  addLine(ctx, `task_${task.id}`,
    `IFCTASK(${IFC_TASK_SLOTS.map(s => s.write(taskCtx)).join(',')})`);
  return {
    ...(Object.keys(dayMeasureDurations).length > 0 ? { dayMeasureDurations } : {}),
    ...(Object.keys(exactFloat).length > 0 ? { exactFloat } : {}),
    ...(Object.keys(exactMinutes).length > 0 ? { exactMinutes } : {}),
  };
}

function writeWBSNesting(ctx: WriteContext, tasks: Task[], ownerHistId: number): void {
  for (const task of tasks) {
    if (!isSummaryTask(task)) continue;
    const childRefs = task.childIds
      .map(cid => optionalRef(ctx, `task_${cid}`))
      .filter((r): r is string => r !== null)
      .join(',');
    if (childRefs) {
      addLine(ctx, `nest_${task.id}`,
        `IFCRELNESTS(${ifcStr(guidOf(ctx, 'nest_' + task.id))},#${ownerHistId},${ifcStr('WBS ' + task.name)},$,${ref(ctx, `task_${task.id}`)},( ${childRefs}))`);
    }
  }
}

function ifcLagValue(seq: Sequence, minutesPerDay: number, sourceDays = false): { value: string; record?: DayMeasureRecord; exactMinutes?: ExactMinutesRecord } {
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    return { value: `IFCRATIOMEASURE(${stepReal(seq.lagPercent / 100)!})` };
  }
  if (typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes)) {
    const exactMinutes = exactMinutesRecord(seq.lagMinutes);
    return { value: `IFCDURATION('${minutesToIsoDuration(seq.lagMinutes)}')`, ...(exactMinutes ? { exactMinutes } : {}) };
  }
  const d = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
  if (sourceDays) return { value: d < 0 ? `IFCDURATION('-P${-d}D')` : `IFCDURATION('P${d}D')` };
  if (!isWholeDays(d)) {
    const record = dayMeasureRecord(d, minutesPerDay);
    return { value: `IFCDURATION('${minutesToIsoDuration(record[1])}')`, record };
  }
  return { value: d < 0 ? `IFCDURATION('-P${ifcDayNumber(-d)}D')` : `IFCDURATION('P${ifcDayNumber(d)}D')` };
}

function lagMinutesPerDay(
  seq: Sequence,
  lagCalendar: NonNullable<Project['schedulingOptions']>['lagCalendar'],
  projectCalendar: WorkCalendar,
  effCalByTask: ReadonlyMap<string, WorkCalendar>,
): number {
  if (seq.lagUnit === 'ELAPSEDTIME' || lagCalendar === '24hour') return ELAPSED_MINUTES_PER_DAY;
  const cal = lagCalendar === 'projectDefault' ? projectCalendar
    : lagCalendar === 'successor' ? effCalByTask.get(seq.successorId) ?? projectCalendar
    : effCalByTask.get(seq.predecessorId) ?? projectCalendar;
  return effHoursPerDay(cal) * 60;
}

function writeSequence(ctx: WriteContext, seq: Sequence, ownerHistId: number, minutesPerDay: number):
  { record?: DayMeasureRecord; exactMinutes?: ExactMinutesRecord } {
  let lagRef = '$';
  let record: DayMeasureRecord | undefined;
  let exactMinutes: ExactMinutesRecord | undefined;
  const hasPercent = typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent);
  const hasMinutes = typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes) && seq.lagMinutes !== 0;
  if (seq.lagDays !== 0 || hasPercent || hasMinutes) {
    const durationType = seq.lagUnit === 'ELAPSEDTIME' ? 'ELAPSEDTIME' : 'WORKTIME';
    const lag = ifcLagValue(seq, minutesPerDay, ctx.merge?.sourceDayLagIds?.has(seq.id) === true);
    record = lag.record;
    exactMinutes = lag.exactMinutes;
    const lagId = addLine(ctx, `lag_${seq.id}`,
      `IFCLAGTIME('Lag',.PREDICTED.,$,${lag.value},.${durationType}.)`);
    lagRef = `#${lagId}`;
  }

  addLine(ctx, `seq_${seq.id}`,
    `IFCRELSEQUENCE(${ifcStr(objectGuid(ctx, 'seq', seq.id))},#${ownerHistId},$,$,${ref(ctx, `task_${seq.predecessorId}`)},${ref(ctx, `task_${seq.successorId}`)},${lagRef},.${seq.type}.,$)`);
  return { ...(record ? { record } : {}), ...(exactMinutes ? { exactMinutes } : {}) };
}

function writeSequenceMeta(
  ctx: WriteContext,
  workSchedId: number,
  sequences: readonly Sequence[],
  dayMeasureLags: readonly (readonly [string, DayMeasureRecord])[],
  exactMinuteLags: readonly (readonly [string, ExactMinutesRecord])[],
  ownerHistId: number,
): void {
  const boundarySequenceGuids = sequences
    .filter(sequence => sequence.p6StartAtPredecessorFinishBoundary === true)
    .map(sequence => objectGuid(ctx, 'seq', sequence.id));
  const propIds: number[] = [];
  if (boundarySequenceGuids.length > 0) {
    propIds.push(addLine(ctx, '_ps_seq_boundary',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Sequences.P6StartAtPredecessorFinishBoundarySequenceGuids)},$,IFCTEXT(${ifcJson(boundarySequenceGuids)}),$)`));
  }
  if (dayMeasureLags.length > 0) {
    propIds.push(addLine(ctx, '_ps_seq_daymeasure',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(DAY_MEASURE_LAGS_PROP)},$,IFCTEXT(${ifcJson(Object.fromEntries(dayMeasureLags))}),$)`));
  }
  if (exactMinuteLags.length > 0) {
    propIds.push(addLine(ctx, '_ps_seq_exactminutes',
      `IFCPROPERTYSINGLEVALUE(${ifcStr(EXACT_MINUTE_LAGS_PROP)},$,IFCTEXT(${ifcJson(Object.fromEntries(exactMinuteLags))}),$)`));
  }
  if (propIds.length === 0) return;
  const setId = addLine(ctx, '_pset_sequences',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_sequences'))},#${ownerHistId},${ifcStr(PSET.Sequences)},$,(${propIds.map(id => `#${id}`).join(',')}))`);
  addLine(ctx, '_rel_sequences',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_sequences'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

function writeResource(ctx: WriteContext, res: Resource, ownerHistId: number): void {
  const entityName = RESOURCE_TYPE_TO_IFC[res.type] ?? 'IFCCONSTRUCTIONMATERIALRESOURCE';
  const entity = res.type === 'COST'
    ? `${entityName}(${ifcStr(objectGuid(ctx, 'res', res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},${ifcStr(COST_RESOURCE_OBJECT_TYPE)},$,$,$,$,$,.USERDEFINED.)`
    : `${entityName}(${ifcStr(objectGuid(ctx, 'res', res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,$,$,.NOTDEFINED.)`;
  addLine(ctx, `res_${res.id}`, entity);
}

function writeResourceMeta(ctx: WriteContext, resources: Resource[], ownerHistId: number): void {
  for (const res of resources) {
    const props: string[] = [];
    if (res.maxUnits !== 1) {
      const id = addLine(ctx, `_resmu_${res.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Resource.MaxUnits)},$,${ifcTypedReal('IFCREAL', res.maxUnits)},$)`);
      props.push(`#${id}`);
    }
    if (res.costPerHour !== undefined) {
      const id = addLine(ctx, `_resch_${res.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Resource.CostPerHour)},$,${ifcTypedReal('IFCMONETARYMEASURE', res.costPerHour)},$)`);
      props.push(`#${id}`);
    }
    if (res.unitOfMeasure) {
      const id = addLine(ctx, `_resuom_${res.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Resource.UnitOfMeasure)},$,IFCLABEL(${ifcStr(res.unitOfMeasure)}),$)`);
      props.push(`#${id}`);
    }
    if (res.color) {
      const id = addLine(ctx, `_rescol_${res.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Resource.Color)},$,IFCTEXT(${ifcStr(res.color)}),$)`);
      props.push(`#${id}`);
    }
    if (res.availabilitySteps && res.availabilitySteps.length > 0) {
      const encoded = [...res.availabilitySteps]
        .sort((a, b) => a.from.localeCompare(b.from))
        .map(s => `${s.from}:${s.maxUnits}`)
        .join(';');
      const id = addLine(ctx, `_resas_${res.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Resource.AvailabilitySteps)},$,IFCTEXT(${ifcStr(encoded)}),$)`);
      props.push(`#${id}`);
    }
    if (res.parentId) {
      const id = addLine(ctx, `_respg_${res.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Resource.ParentGuid)},$,IFCTEXT(${ifcStr(objectGuid(ctx, 'res', res.parentId))}),$)`);
      props.push(`#${id}`);
    }
    if (res.libraryOrigin) {
      const id = addLine(ctx, `_reslo_${res.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Resource.LibraryOrigin)},$,IFCTEXT(${ifcJson(res.libraryOrigin)}),$)`);
      props.push(`#${id}`);
    }
    if (props.length === 0) continue;
    const setId = addLine(ctx, `_pset_res_${res.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_res_' + res.id))},#${ownerHistId},${ifcStr(PSET.Resource)},$,(${props.join(',')}))`);
    addLine(ctx, `_rel_res_${res.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_res_' + res.id))},#${ownerHistId},$,$,(${ref(ctx, `res_${res.id}`)}),#${setId})`);
  }
}

function writeCrewNesting(ctx: WriteContext, resources: Resource[], ownerHistId: number): void {
  const crews = resources.filter(r => r.type === 'CREW');
  if (crews.length === 0) return;
  const resourcesByParent = groupBy(resources, r => r.parentId);
  for (const crew of crews) {
    if (Number.isNaN(crew.id)) continue;
    const memberRefs = (resourcesByParent.get(crew.id) ?? [])
      .map(r => optionalRef(ctx, `res_${r.id}`))
      .filter((r): r is string => r !== null);
    if (memberRefs.length === 0) continue;
    addLine(ctx, `nest_res_${crew.id}`,
      `IFCRELNESTS(${ifcStr(guidOf(ctx, 'nest_res_' + crew.id))},#${ownerHistId},${ifcStr('Ploeg ' + crew.name)},$,${ref(ctx, `res_${crew.id}`)},(${memberRefs.join(',')}))`);
  }
}

function writtenAssignmentsByTask(ctx: WriteContext, assignments: ResourceAssignment[]): Map<string, ResourceAssignment[]> {
  return groupBy(assignments.filter(a => optionalRef(ctx, `res_${a.resourceId}`) !== null), a => a.taskId);
}

function writeAssignments(ctx: WriteContext, assignments: ResourceAssignment[], ownerHistId: number): void {
  for (const [taskId, list] of writtenAssignmentsByTask(ctx, assignments)) {
    const taskRef = optionalRef(ctx, `task_${taskId}`);
    if (taskRef === null) continue;
    const resRefs = list.map(a => ref(ctx, `res_${a.resourceId}`));
    addLine(ctx, `assign_${taskId}`,
      `IFCRELASSIGNSTOPROCESS(${ifcStr(guidOf(ctx, 'assign_' + taskId))},#${ownerHistId},$,$,(${resRefs.join(',')}),$,${taskRef},$)`);
  }
}

function writeAssignmentMeta(
  ctx: WriteContext,
  tasks: Task[],
  assignments: ResourceAssignment[],
  ownerHistId: number,
): void {
  const byTask = writtenAssignmentsByTask(ctx, assignments);
  for (const task of tasks) {
    const list = byTask.get(task.id);
    if (!list) continue;
    const props = list.map((a, index) => {
      const resGuid = objectGuid(ctx, 'res', a.resourceId);
      const propName = `${resGuid}#${index}`;
      const val = `${a.unitsPerDay}|${a.curve ?? 'UNIFORM'}`;
      const propId = addLine(ctx, `_asgn_${task.id}_${a.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(propName)},$,IFCTEXT(${ifcStr(val)}),$)`);
      return `#${propId}`;
    });
    const setId = addLine(ctx, `_pset_asgn_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_asgn_' + task.id))},#${ownerHistId},${ifcStr(PSET.Assignments)},$,(${props.join(',')}))`);
    addLine(ctx, `_rel_asgn_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_asgn_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}

function writeTimephasedMeta(
  ctx: WriteContext,
  tasks: Task[],
  assignments: ResourceAssignment[],
  ownerHistId: number,
): void {
  const byTask = writtenAssignmentsByTask(ctx, assignments);
  for (const task of tasks) {
    const list = byTask.get(task.id);
    if (!list) continue;
    const windows: Record<string, {
      workWindowStart?: string; workWindowFinish?: string; curveValues?: number[];
      plannedWorkMinutes?: number; actualWorkMinutes?: number; remainingWorkMinutes?: number;
      plannedUnitsPerDay?: number; costAmount?: number;
    }> = {};
    list.forEach((a, index) => {
      if (a.workWindowStart === undefined && a.workWindowFinish === undefined && a.curveValues === undefined
        && a.plannedWorkMinutes === undefined && a.actualWorkMinutes === undefined && a.remainingWorkMinutes === undefined
        && a.plannedUnitsPerDay === undefined && a.costAmount === undefined) return;
      const resGuid = objectGuid(ctx, 'res', a.resourceId);
      const propName = `${resGuid}#${index}`;
      windows[propName] = {
        ...(a.workWindowStart !== undefined ? { workWindowStart: a.workWindowStart } : {}),
        ...(a.workWindowFinish !== undefined ? { workWindowFinish: a.workWindowFinish } : {}),
        ...(a.curveValues !== undefined ? { curveValues: [...a.curveValues] } : {}),
        ...(a.plannedWorkMinutes !== undefined ? { plannedWorkMinutes: a.plannedWorkMinutes } : {}),
        ...(a.actualWorkMinutes !== undefined ? { actualWorkMinutes: a.actualWorkMinutes } : {}),
        ...(a.remainingWorkMinutes !== undefined ? { remainingWorkMinutes: a.remainingWorkMinutes } : {}),
        ...(a.plannedUnitsPerDay !== undefined ? { plannedUnitsPerDay: a.plannedUnitsPerDay } : {}),
        ...(a.costAmount !== undefined ? { costAmount: a.costAmount } : {}),
      };
    });
    if (Object.keys(windows).length === 0) continue;
    const propId = addLine(ctx, `_ps_tp_${task.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Timephased.Windows)},$,IFCTEXT(${ifcJson(windows)}),$)`);
    const setId = addLine(ctx, `_pset_tp_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_tp_' + task.id))},#${ownerHistId},${ifcStr(PSET.Timephased)},$,(#${propId}))`);
    addLine(ctx, `_rel_tp_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_tp_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}

function writeTimephasedDurationWalksMeta(
  ctx: WriteContext,
  tasks: Task[],
  ownerHistId: number,
): void {
  for (const task of tasks) {
    const walks = task.timephasedDurationWalks;
    if (!walks || walks.length === 0) continue;
    const json = walks.map(w => ({
      anchor: w.anchor,
      resourceCalendarGuid: objectGuid(ctx, 'cal', w.resourceCalendarId),
      ...(w.workMinutes !== undefined ? { workMinutes: w.workMinutes } : {}),
    }));
    const propId = addLine(ctx, `_ps_tpdw_${task.id}`,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.DurationWalks.DurationWalks)},$,IFCTEXT(${ifcJson(json)}),$)`);
    const setId = addLine(ctx, `_pset_tpdw_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_tpdw_' + task.id))},#${ownerHistId},${ifcStr(PSET.DurationWalks)},$,(#${propId}))`);
    addLine(ctx, `_rel_tpdw_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_tpdw_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}
