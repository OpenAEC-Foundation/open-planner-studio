/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 */
import type { Project } from '@/types/project';
import type {
  Task, TaskConstraint, TaskSplitGap, MspTaskType, TaskTimephasedContour, TimephasedContourPeriod,
} from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { effHoursPerDay, hourTaskScheduleDuration } from '@/utils/taskDuration';
import { resourceDrivesDuration, type Resource } from '@/types/resource';
import { hasMsProjectImportLoss, type ImportLabels, type ImportResult } from '@/services/importTypes';
import { generateId } from '@/utils/id';
import { formatDate, formatInstant, parseInstant, localTodayIso } from '@/utils/dateUtils';
import { normalizeImportedProgress, deriveImportedWorkRules, reconstructResourceIds } from '@/services/importNormalize';
import { emptyMissingScheduleDates, resolveMissingScheduleDates } from '@/services/importDates';
import { mspCodeToConstraint } from '@/services/msproject/mspdiReader';
import { statusDateFromXml, toXmlDateTime } from '@/services/xmlInterchange';
import { hasNonAnchorTime, isSubDayMinutes, milestoneKindAt } from '@/services/subdayIo';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { assignmentRemainingMinutes } from '@/engine/work/workTriangle';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { CfbFile } from './cfb';
import { assertReadable, detectApplicationVersion, Props } from './mppContainer';
import {
  FixedData, FixedMeta, Var2Data, VarMeta12,
  getInt, getShort, getTimestamp, getUnicodeString, getDurationTimeUnits,
} from './mppPrimitives';
import {
  TaskFieldId, AssignmentFieldId,
  createAssignmentFieldMap, createResourceFieldMap, createTaskFieldMap,
  fixedOffsetOf, fixed2OffsetOf, varDataKeyOf, type FieldMapTable,
} from './fieldMap14';
import { readCalendars, promoteCalendarsForHourMode, type CalendarReadResult } from './mppCalendars';
import { MAX_VAR_TEXT_BYTES, clampRemainingDurationTenths, clampManualDurationTenths, clampLevelingDelayTenths } from './limits';
import { readRelations, readResources, readAssignments, readAssignmentTimephasedRaw, decodeAssignmentUnits } from './mppEntities';
import { scanMppImportLoss } from './mppImportLoss';
import { collectValidTaskIndices } from './mppRecords';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { buildRecordedTime, leafRecordedTimes, recordedFloatDays, type RecordedTime } from '@/engine/scheduler/recordedDates';
import {
  decodeRegularTimephasedWork, decodePlannedRegularTimephasedWork,
  deriveSplitGapsFromPeriods, deriveTaskSplitGaps, shiftPeriods, hasAnyTimephasedData,
  type AssignmentTimephasedRaw, type TimephasedWorkPeriod,
} from './mppTimephased';
import { maxOf, minOf } from '@/utils/collections';

const PROPS_KEY_TITLE = 37748744;
const PROPS_KEY_PROJECT_START_DATE = 37748738;
const PROPS_KEY_PROJECT_FINISH_DATE = 37748739;
const PROPS_KEY_STATUS_DATE = 37748805;
const PROPS_KEY_MINUTES_PER_DAY = 37748765;
const PROPS_KEY_CRITICAL_SLACK_LIMIT = 37748756;
const MAX_CRITICAL_SLACK_LIMIT_DAYS = 36500;

export function mppTotalSlackTenths(started: boolean, startSlack: number | null, finishSlack: number | null): number | null {
  if (started) return finishSlack;
  if (startSlack === null || finishSlack === null) return null;
  return Math.min(startSlack, finishSlack);
}

export function criticalSlackLimitDaysOf(props: { getInt(key: number): number }): number {
  const days = props.getInt(PROPS_KEY_CRITICAL_SLACK_LIMIT);
  return Number.isInteger(days) && Math.abs(days) <= MAX_CRITICAL_SLACK_LIMIT_DAYS ? days : 0;
}

const TASK_FIXED_META_ITEM_SIZE = 47;
const TASK_FIXED2_META_ITEM_SIZES = [92, 93, 94, 95, 96];

export const MAX_OUTLINE_LEVEL = 256;

export function clampOutlineLevel(raw: number): number {
  return Math.min(Math.max(raw, 1), MAX_OUTLINE_LEVEL);
}

function isLegacyBitFlagVersion(applicationVersion: number | null): boolean {
  return (applicationVersion ?? 0) <= 14;
}

function milestoneBitFlag(applicationVersion: number | null): { offset: number; mask: number } {
  return isLegacyBitFlagVersion(applicationVersion)
    ? { offset: 8, mask: 0x20 }
    : { offset: 10, mask: 0x02 };
}

function taskModeBitFlag(applicationVersion: number | null): { offset: number; mask: number } {
  return isLegacyBitFlagVersion(applicationVersion)
    ? { offset: 8, mask: 0x08 }
    : { offset: 8, mask: 0x80 };
}

function effortDrivenBitFlag(applicationVersion: number | null): { offset: number; mask: number } {
  return isLegacyBitFlagVersion(applicationVersion)
    ? { offset: 11, mask: 0x10 }
    : { offset: 13, mask: 0x08 };
}

const MSP_TASK_TYPE_VALUES: readonly MspTaskType[] = ['FIXED_UNITS', 'FIXED_DURATION', 'FIXED_WORK'];
export function mspTaskTypeFromRaw(raw: number | null): MspTaskType | undefined {
  if (raw === null) return undefined;
  return MSP_TASK_TYPE_VALUES[raw] ?? 'FIXED_WORK';
}

function resolveScheduleField(manual: Date | null, scheduled: Date | null, isManual: boolean): Date | null {
  const overrideWithScheduled = manual === null || (scheduled !== null && !isManual);
  return overrideWithScheduled ? scheduled : manual;
}

interface RawTaskRecord {
  uniqueId: number;
  id: number;
  outlineLevel: number;
  storedWbs: string | null;
  task: Task;
}

interface HierarchyTaskLike {
  id: string;
  parentId: string | null;
  childIds: string[];
  wbsCode: string;
}

export function assignHierarchyAndWbs<T extends HierarchyTaskLike>(
  entries: { outlineLevel: number; storedWbs: string | null; task: T }[],
): void {
  const stack: { task: T; wbs: string; level: number; childCount: number }[] = [];
  let rootCount = 0;
  for (const rec of entries) {
    while (stack.length > 0 && stack[stack.length - 1].level >= rec.outlineLevel) stack.pop();
    const parent = stack[stack.length - 1];
    let generatedWbs: string;
    if (parent) {
      parent.childCount++;
      generatedWbs = `${parent.wbs}.${parent.childCount}`;
      rec.task.parentId = parent.task.id;
      parent.task.childIds.push(rec.task.id);
    } else {
      rootCount++;
      generatedWbs = `${rootCount}`;
    }
    rec.task.wbsCode = rec.storedWbs || generatedWbs;
    stack.push({ task: rec.task, wbs: generatedWbs, level: rec.outlineLevel, childCount: 0 });
  }
}


function readPercentComplete(data: Uint8Array, offset: number | null): number {
  if (offset === null || data.length < offset + 2) return 0;
  const raw = getShort(data, offset, 'TBkndTask percentComplete');
  return raw >= 0 && raw <= 100 ? raw : 0;
}

function readTimestampField(data: Uint8Array, offset: number | null, ctx: string): Date | null {
  if (offset === null || data.length < offset + 4) return null;
  return getTimestamp(data, offset, ctx);
}

function mppAnchorClock(cal: WorkCalendar): string {
  return `${String(cal.workStartHour).padStart(2, '0')}:00:00`;
}

export function countScheduleNotes(
  tasks: readonly Task[],
): { total: number; leveled: number; split: number; timephased: number } {
  let leveled = 0, split = 0, timephased = 0, total = 0;
  for (const task of tasks) {
    const isLeveled = task.levelingDelayMinutes != null;
    const isSplit = (task.splitGaps?.length ?? 0) > 0;
    const isTimephased = task.timephasedFinishFloor != null || task.timephasedDurationWalks != null;
    if (isLeveled) leveled++;
    if (isSplit) split++;
    if (isTimephased) timephased++;
    if (isLeveled || isSplit || isTimephased) total++;
  }
  return { total, leveled, split, timephased };
}

export interface ReadTasksContext {
  cfb: CfbFile;
  taskFieldMap: FieldMapTable;
  hoursPerDay: number;
  statusDate: string | undefined;
  applicationVersion: number | null;
  calResult: CalendarReadResult;
  projectStart?: string;
  criticalSlackLimitDays?: number;
}

export interface ReadTasksResult {
  tasks: Task[];
  taskIdByUniqueId: Map<number, string>;
  rawScans: readonly RawTaskScan[];
  startAnchor: string;
  recordedTimes: Record<string, RecordedTime>;
}

export interface RawTaskScan {
  uniqueId: number;
  id: number;
  outlineLevel: number;
  storedWbs: string | null;
  name: string;
  startTs: Date | null;
  finishTs: Date | null;
  durationRaw: number;
  isElapsedDuration: boolean;
  remainingDurationRaw: number | null;
  levelingDelayRaw: number;
  levelingDelayUnits: number | null;
  taskMode: MppTaskMode;
  manualStartTs: Date | null;
  manualFinishTs: Date | null;
  earlyStartTs: Date | null;
  earlyFinishTs: Date | null;
  lateStartTs: Date | null;
  lateFinishTs: Date | null;
  freeSlackRaw: number | null;
  startSlackRaw: number | null;
  finishSlackRaw: number | null;
  manualDurationRaw: number | null;
  manualDurationIsElapsed: boolean;
  isMilestone: boolean;
  constraintCode: number | null;
  constraintDateTs: Date | null;
  deadlineTs: Date | null;
  percentComplete: number;
  actualStartTs: Date | null;
  actualFinishTs: Date | null;
  resumeTs: Date | null;
  stopTs: Date | null;
  effCal: WorkCalendar;
  calendarOverride: WorkCalendar | null;
  mspTaskTypeRaw: number | null;
  effortDrivenRaw: boolean;
}

type MppTaskMode = 'AUTO_SCHEDULED' | 'MANUALLY_SCHEDULED';

export function readTasks(ctx: ReadTasksContext): ReadTasksResult {
  const { cfb, taskFieldMap, hoursPerDay, statusDate, applicationVersion, calResult } = ctx;
  const missingDates = emptyMissingScheduleDates();
  const criticalSlackLimitDays = ctx.criticalSlackLimitDays ?? 0;
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndTask', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndTask', 'FixedData']);
  const varMetaBytes = cfb.getStream(['   114', 'TBkndTask', 'VarMeta']);
  if (!fixedMetaBytes || !fixedDataBytes || !varMetaBytes) {
    throw new Error('MPP: "   114"/TBkndTask mist een vereiste stream (FixedMeta/FixedData/VarMeta)');
  }
  const var2DataBytes = cfb.getStream(['   114', 'TBkndTask', 'Var2Data']);

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, TASK_FIXED_META_ITEM_SIZE, 'TBkndTask/FixedMeta');
  const fixedData = FixedData.fromMeta(fixedMeta, fixedDataBytes, 0, 0, 'TBkndTask/FixedData');
  const varMeta = new VarMeta12(varMetaBytes, 'TBkndTask/VarMeta');
  const varData = new Var2Data(varMeta, var2DataBytes);

  const fixed2MetaBytes = cfb.getStream(['   114', 'TBkndTask', 'Fixed2Meta']);
  const fixed2DataBytes = cfb.getStream(['   114', 'TBkndTask', 'Fixed2Data']);
  let fixed2Meta: FixedMeta | null = null;
  let fixed2Data: FixedData | null = null;
  if (fixed2MetaBytes && fixed2DataBytes) {
    try {
      fixed2Meta = FixedMeta.withHeuristicItemSize(fixed2MetaBytes, fixedData, TASK_FIXED2_META_ITEM_SIZES, 'TBkndTask/Fixed2Meta');
      fixed2Data = FixedData.fromMeta(fixed2Meta, fixed2DataBytes, 0, 0, 'TBkndTask/Fixed2Data');
    } catch {
      fixed2Meta = null;
      fixed2Data = null;
    }
  }

  const uniqueIdOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.UniqueId);
  const idOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Id);
  const outlineLevelOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.OutlineLevel);
  const scheduledStartOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ScheduledStart);
  const scheduledFinishOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ScheduledFinish);
  const durationOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ScheduledDuration);
  const durationUnitsOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.DurationUnits);
  const remainingDurationOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.RemainingDuration);
  const constraintTypeOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ConstraintType);
  const constraintDateOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ConstraintDate);
  const deadlineOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Deadline);
  const percentCompleteOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.PercentComplete);
  const actualStartOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ActualStart);
  const actualFinishOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ActualFinish);
  const resumeOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Resume);
  const stopOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Stop);
  const calendarUniqueIdOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.CalendarUniqueId);
  const levelingDelayOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.LevelingDelay);
  const levelingDelayUnitsOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.LevelingDelayUnits);
  const manualStartOffset = fixed2OffsetOf(taskFieldMap, TaskFieldId.Start);
  const manualFinishOffset = fixed2OffsetOf(taskFieldMap, TaskFieldId.Finish);
  const manualDurationOffset = fixed2OffsetOf(taskFieldMap, TaskFieldId.ManualDuration);
  const manualDurationUnitsOffset = fixed2OffsetOf(taskFieldMap, TaskFieldId.ManualDurationUnits);
  const nameKey = varDataKeyOf(taskFieldMap, TaskFieldId.Name);
  const wbsKey = varDataKeyOf(taskFieldMap, TaskFieldId.Wbs);
  const mspTaskTypeOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Type);
  const earlyStartOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.EarlyStart);
  const earlyFinishOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.EarlyFinish);
  const lateStartOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.LateStart);
  const lateFinishOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.LateFinish);
  const freeSlackOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.FreeSlack);
  const startSlackOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.StartSlack);
  const finishSlackOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.FinishSlack);
  const slackAt = (data: Uint8Array, offset: number | null, ctx: string): number | null =>
    offset !== null && data.length >= offset + 4 ? getInt(data, offset, ctx) : null;

  if (uniqueIdOffset === null || idOffset === null || nameKey === null || scheduledStartOffset === null || scheduledFinishOffset === null) {
    throw new Error('MPP: taak-veldmap mist UNIQUE_ID/ID/NAME/SCHEDULED_START/SCHEDULED_FINISH — kan taken niet betrouwbaar lezen');
  }

  const validIndices = collectValidTaskIndices(fixedMeta, fixedData, varMeta, uniqueIdOffset);
  const { offset: msOffset, mask: msMask } = milestoneBitFlag(applicationVersion);
  const { offset: tmOffset, mask: tmMask } = taskModeBitFlag(applicationVersion);
  const { offset: edOffset, mask: edMask } = effortDrivenBitFlag(applicationVersion);

  const raws: RawTaskScan[] = [];
  for (const [uniqueId, index] of validIndices) {
    if (uniqueId === 0) continue;
    const data = fixedData.getByteArrayValue(index);
    if (!data) continue;
    const metaItem = fixedMeta.getByteArrayValue(index);

    const id = data.length >= idOffset + 4 ? getInt(data, idOffset, 'TBkndTask id') : uniqueId;
    const outlineLevelRaw = outlineLevelOffset !== null && data.length >= outlineLevelOffset + 2
      ? getShort(data, outlineLevelOffset, 'TBkndTask outlineLevel')
      : 1;
    const outlineLevel = clampOutlineLevel(outlineLevelRaw);

    const name = varData.getUnicodeString(uniqueId, nameKey, MAX_VAR_TEXT_BYTES, 'TBkndTask name') || 'Task';
    const storedWbs = wbsKey !== null ? varData.getUnicodeString(uniqueId, wbsKey, MAX_VAR_TEXT_BYTES, 'TBkndTask wbs') : null;

    const startTs = readTimestampField(data, scheduledStartOffset, 'TBkndTask scheduledStart');
    const finishTs = readTimestampField(data, scheduledFinishOffset, 'TBkndTask scheduledFinish');

    const durationRaw = durationOffset !== null && data.length >= durationOffset + 4
      ? getInt(data, durationOffset, 'TBkndTask duration')
      : 0;

    const durationUnitsRaw = durationUnitsOffset !== null && data.length >= durationUnitsOffset + 2
      ? getShort(data, durationUnitsOffset, 'TBkndTask durationUnits')
      : null;
    const isElapsedDuration = durationUnitsRaw !== null
      && getDurationTimeUnits(durationUnitsRaw).startsWith('elapsed');

    const remainingDurationRaw = remainingDurationOffset !== null && data.length >= remainingDurationOffset + 4
      ? clampRemainingDurationTenths(getInt(data, remainingDurationOffset, 'TBkndTask remainingDuration'))
      : null;

    const levelingDelayRaw = levelingDelayOffset !== null && data.length >= levelingDelayOffset + 4
      ? clampLevelingDelayTenths(getInt(data, levelingDelayOffset, 'TBkndTask levelingDelay'))
      : 0;
    const levelingDelayUnits = levelingDelayUnitsOffset !== null && data.length >= levelingDelayUnitsOffset + 2
      ? getShort(data, levelingDelayUnitsOffset, 'TBkndTask levelingDelayUnits')
      : null;

    const isMilestone = !!metaItem && metaItem.length >= msOffset + 4
      && (getInt(metaItem, msOffset, 'TBkndTask milestone-flag') & msMask) !== 0;

    const effortDrivenRaw = !!metaItem && metaItem.length >= edOffset + 4
      && (getInt(metaItem, edOffset, 'TBkndTask effortDriven-flag') & edMask) !== 0;
    const mspTaskTypeRaw = mspTaskTypeOffset !== null && data.length >= mspTaskTypeOffset + 2
      ? getShort(data, mspTaskTypeOffset, 'TBkndTask type')
      : null;

    const metaData2 = fixed2Meta?.getByteArrayValue(index) ?? null;
    const taskMode: MppTaskMode = metaData2 && metaData2.length > tmOffset && (metaData2[tmOffset] & tmMask) !== 0
      ? 'MANUALLY_SCHEDULED'
      : 'AUTO_SCHEDULED';

    const fixed2Record = fixed2Data?.getByteArrayValue(index) ?? null;
    const manualStartTs = fixed2Record ? readTimestampField(fixed2Record, manualStartOffset, 'TBkndTask/Fixed2Data manualStart') : null;
    const manualFinishTs = fixed2Record ? readTimestampField(fixed2Record, manualFinishOffset, 'TBkndTask/Fixed2Data manualFinish') : null;
    const manualDurationRaw = fixed2Record && manualDurationOffset !== null && fixed2Record.length >= manualDurationOffset + 4
      ? clampManualDurationTenths(getInt(fixed2Record, manualDurationOffset, 'TBkndTask/Fixed2Data manualDuration'))
      : null;
    const manualDurationUnitsRaw = fixed2Record && manualDurationUnitsOffset !== null && fixed2Record.length >= manualDurationUnitsOffset + 2
      ? getShort(fixed2Record, manualDurationUnitsOffset, 'TBkndTask/Fixed2Data manualDurationUnits')
      : null;
    const manualDurationIsElapsed = manualDurationUnitsRaw !== null
      && getDurationTimeUnits(manualDurationUnitsRaw).startsWith('elapsed');

    const constraintCode = constraintTypeOffset !== null && data.length >= constraintTypeOffset + 2
      ? getShort(data, constraintTypeOffset, 'TBkndTask constraintType')
      : null;
    const constraintDateTs = readTimestampField(data, constraintDateOffset, 'TBkndTask constraintDate');
    const deadlineTs = readTimestampField(data, deadlineOffset, 'TBkndTask deadline');
    const percentComplete = readPercentComplete(data, percentCompleteOffset);
    const actualStartTs = readTimestampField(data, actualStartOffset, 'TBkndTask actualStart');
    const actualFinishTs = readTimestampField(data, actualFinishOffset, 'TBkndTask actualFinish');
    const resumeTs = readTimestampField(data, resumeOffset, 'TBkndTask resume');
    const stopTs = readTimestampField(data, stopOffset, 'TBkndTask stop');

    const calendarUniqueIdRaw = calendarUniqueIdOffset !== null && data.length >= calendarUniqueIdOffset + 4
      ? getInt(data, calendarUniqueIdOffset, 'TBkndTask calendarUniqueId')
      : -1;
    const calendarOverride = calendarUniqueIdRaw >= 0 ? (calResult.calendarByUniqueId.get(calendarUniqueIdRaw) ?? null) : null;
    const effCal = calendarOverride ?? calResult.projectCalendar;

    raws.push({
      uniqueId, id, outlineLevel, storedWbs, name, startTs, finishTs, durationRaw, isElapsedDuration,
      remainingDurationRaw, levelingDelayRaw, levelingDelayUnits, taskMode, manualStartTs, manualFinishTs,
      manualDurationRaw, manualDurationIsElapsed, isMilestone, constraintCode, constraintDateTs, deadlineTs,
      percentComplete, actualStartTs, actualFinishTs, resumeTs, stopTs, effCal, calendarOverride,
      mspTaskTypeRaw, effortDrivenRaw,
      earlyStartTs: readTimestampField(data, earlyStartOffset, 'TBkndTask earlyStart'),
      earlyFinishTs: readTimestampField(data, earlyFinishOffset, 'TBkndTask earlyFinish'),
      lateStartTs: readTimestampField(data, lateStartOffset, 'TBkndTask lateStart'),
      lateFinishTs: readTimestampField(data, lateFinishOffset, 'TBkndTask lateFinish'),
      freeSlackRaw: slackAt(data, freeSlackOffset, 'TBkndTask freeSlack'),
      startSlackRaw: slackAt(data, startSlackOffset, 'TBkndTask startSlack'),
      finishSlackRaw: slackAt(data, finishSlackOffset, 'TBkndTask finishSlack'),
    });
  }

  const cSignalCals = new Set<WorkCalendar>();
  for (const raw of raws) {
    const cal = raw.effCal;
    const durMinutes = raw.durationRaw / 10;
    const durSignal = isSubDayMinutes(durMinutes, cal.hoursPerDay);
    const anchor = mppAnchorClock(cal);
    const dateSignal = [raw.startTs, raw.finishTs, raw.actualStartTs, raw.actualFinishTs]
      .some(ts => ts != null && hasNonAnchorTime(formatInstant(ts, 'hour'), anchor));
    if (durSignal || dateSignal) cSignalCals.add(cal);
  }
  const hourModeCals = promoteCalendarsForHourMode(calResult.calendarByUniqueId, cSignalCals, calResult.fileHoursPerDay);

  const taskIdByUniqueId = new Map<number, string>();
  const records: RawTaskRecord[] = [];
  const recordedTimes: Record<string, RecordedTime> = {};
  const runningAtFullIds = new Set<string>();
  for (const raw of raws) {
    const cal = raw.effCal;
    const isHour = hourModeCals.has(cal);

    const durationMinutes = raw.durationRaw / 10;
    const duration = hourTaskScheduleDuration(durationMinutes, cal);

    const remainingMinutes = raw.remainingDurationRaw !== null
      ? raw.remainingDurationRaw / 10
      : undefined;

    const formatField = (ts: Date | null): string | undefined =>
      ts ? (isHour ? formatInstant(ts, 'hour') : formatDate(ts)) : undefined;
    const isManual = raw.taskMode === 'MANUALLY_SCHEDULED';
    const resolvedStartTs = resolveScheduleField(raw.manualStartTs, raw.startTs, isManual);
    const resolvedFinishTs = resolveScheduleField(raw.manualFinishTs, raw.finishTs, isManual);
    const start = formatField(resolvedStartTs) ?? localTodayIso();
    const finish = formatField(resolvedFinishTs) ?? start;
    const actualStart = formatField(raw.actualStartTs);
    const actualFinish = formatField(raw.actualFinishTs);
    const resume = formatField(raw.resumeTs);
    const stop = formatField(raw.stopTs);

    let constraint: TaskConstraint | undefined;
    if (raw.constraintCode !== null) {
      const mapped = mspCodeToConstraint(raw.constraintCode);
      if (mapped) {
        const constraintDate = formatField(raw.constraintDateTs);
        constraint = {
          type: mapped.type,
          ...(mapped.hard ? { hard: true } : {}),
          ...(constraintDate ? { date: constraintDate } : {}),
        };
      }
    }
    const deadline = formatField(raw.deadlineTs);

    const milestoneAnchor = raw.finishTs ?? raw.startTs;
    const milestoneKind = raw.isMilestone && raw.durationRaw === 0 && isHour && milestoneAnchor
      ? milestoneKindAt(cal, milestoneAnchor)
      : undefined;

    const levelingDelayMinutes = raw.levelingDelayRaw !== 0
      ? Math.round(raw.levelingDelayRaw / 10)
      : undefined;
    const levelingDelayElapsed = raw.levelingDelayRaw !== 0 && raw.levelingDelayUnits !== null
      && getDurationTimeUnits(raw.levelingDelayUnits).startsWith('elapsed');

    const mspTaskType = mspTaskTypeFromRaw(raw.mspTaskTypeRaw);

    const task: Task = {
      id: generateId('task'),
      name: raw.name,
      description: '',
      wbsCode: '',
      taskType: 'CONSTRUCTION',
      status: 'NOT_STARTED',
      isMilestone: raw.isMilestone,
      ...(milestoneKind ? { milestoneKind } : {}),
      priority: 500,
      parentId: null,
      childIds: [],
      time: {
        durationType: raw.isElapsedDuration ? 'ELAPSEDTIME' : 'WORKTIME',
        durationUnit: 'hours',
        scheduleDuration: duration,
        durationMinutes,
        scheduleStart: start,
        scheduleFinish: finish,
        earlyStart: start,
        earlyFinish: finish,
        lateStart: start,
        lateFinish: finish,
        freeFloat: 0,
        totalFloat: 0,
        isCritical: false,
        actualStart,
        actualFinish,
        ...(resume != null ? { resume } : {}),
        ...(stop != null ? { stop } : {}),
        ...(remainingMinutes != null ? { remainingMinutes } : {}),
        completion: raw.percentComplete / 100,
      },
      resourceIds: [],
      ...(constraint ? { constraint } : {}),
      ...(deadline ? { deadline } : {}),
      ...(raw.calendarOverride ? { calendarId: raw.calendarOverride.id } : {}),
      ...(levelingDelayMinutes != null ? { levelingDelayMinutes } : {}),
      ...(levelingDelayElapsed ? { levelingDelayElapsed } : {}),
      ...(isManual ? { manuallyScheduled: true } : {}),
      ...(mspTaskType ? { mspTaskType } : {}),
      ...(raw.effortDrivenRaw ? { effortDriven: true } : {}),
    };
    if (!resolvedStartTs) missingDates.start.add(task.id);
    if (!resolvedFinishTs) missingDates.finish.add(task.id);
    records.push({ uniqueId: raw.uniqueId, id: raw.id, outlineLevel: raw.outlineLevel, storedWbs: raw.storedWbs, task });
    if (raw.actualFinishTs === null && (raw.remainingDurationRaw ?? 0) > 0) runningAtFullIds.add(task.id);
    taskIdByUniqueId.set(raw.uniqueId, task.id);

    {
      const slackDays = (tenths: number | null): number | undefined => {
        if (tenths === null) return undefined;
        return raw.isElapsedDuration
          ? recordedFloatDays(tenths / 10, 24 * 60)
          : recordedFloatDays(tenths / 10, (isHour ? effHoursPerDay(cal) : hoursPerDay) * 60);
      };
      const totalSlackRaw = mppTotalSlackTenths(raw.actualStartTs !== null, raw.startSlackRaw, raw.finishSlackRaw);
      const totalFloat = slackDays(totalSlackRaw);
      const completed = raw.actualFinishTs !== null || raw.percentComplete >= 100;
      const recorded = buildRecordedTime({
        start: formatField(raw.earlyStartTs) ?? formatField(resolvedStartTs),
        finish: formatField(raw.earlyFinishTs) ?? formatField(resolvedFinishTs),
        lateStart: formatField(raw.lateStartTs),
        lateFinish: formatField(raw.lateFinishTs),
        totalFloat,
        freeFloat: slackDays(raw.freeSlackRaw),
        isCritical: completed ? false : totalFloat === undefined ? undefined : totalFloat <= criticalSlackLimitDays,
      });
      if (recorded) recordedTimes[task.id] = recorded;
    }
  }

  records.sort((a, b) => a.id - b.id);
  assignHierarchyAndWbs(records);

  const tasks = records.map((r) => r.task);
  const startAnchor = resolveMissingScheduleDates(tasks, missingDates, ctx.projectStart ?? '',
    (task) => taskCalendar(task, calResult));
  normalizeImportedProgress(tasks, statusDate, runningAtFullIds);
  deriveImportedWorkRules(tasks);
  return {
    tasks, taskIdByUniqueId, startAnchor, recordedTimes,
    rawScans: raws,
  };
}

export function parseProjectProperties(
  props: Props,
  labels: ImportLabels | undefined,
): { project: Project; hoursPerDay: number; calendarHoursPerDayOverride: number | null; projectStartFromFile: boolean } {
  const titleBytes = props.getByteArray(PROPS_KEY_TITLE);
  const name = (titleBytes ? getUnicodeString(titleBytes, 0, MAX_VAR_TEXT_BYTES, 'Props title') : '') || labels?.importedProject || 'MS Project Import';

  const startBytes = props.getByteArray(PROPS_KEY_PROJECT_START_DATE);
  const finishBytes = props.getByteArray(PROPS_KEY_PROJECT_FINISH_DATE);
  const startDate = startBytes && startBytes.length >= 4 ? getTimestamp(startBytes, 0, 'Props startDate') : null;
  const finishDate = finishBytes && finishBytes.length >= 4 ? getTimestamp(finishBytes, 0, 'Props finishDate') : null;

  const minutesPerDay = props.getInt(PROPS_KEY_MINUTES_PER_DAY);
  const minutesPerDayValid = minutesPerDay > 0 && minutesPerDay <= 1440;
  const hoursPerDay = minutesPerDayValid ? minutesPerDay / 60 : 8;

  const project: Project = {
    id: generateId('proj'),
    name,
    description: '',
    startDate: startDate ? formatDate(startDate) : localTodayIso(),
    endDate: finishDate ? formatDate(finishDate) : '',
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: '',
    company: '',
    schedulingProfile: builtInProfile('msproject'),
    schedulingOptions: { criticalDefinition: { mode: 'totalFloat', threshold: criticalSlackLimitDaysOf(props) } },
  };

  const statusBytes = props.getByteArray(PROPS_KEY_STATUS_DATE);
  const statusDate = statusBytes && statusBytes.length >= 4 ? getTimestamp(statusBytes, 0, 'Props statusDate') : null;
  if (statusDate) project.statusDate = statusDateFromXml(toXmlDateTime(formatInstant(statusDate, 'hour')), 'foreign');

  return {
    project, hoursPerDay, calendarHoursPerDayOverride: minutesPerDayValid ? hoursPerDay : null,
    projectStartFromFile: !!startDate,
  };
}

export interface OpenMppProject {
  cfb: CfbFile;
  projectProps: Props;
  applicationVersion: number | null;
}

export function openMppProject(bytes: Uint8Array): OpenMppProject {
  const cfb = new CfbFile(bytes);
  assertReadable(cfb);

  const applicationVersion = detectApplicationVersion(cfb);

  const projectPropsBytes = cfb.getStream(['   114', 'Props']);
  if (!projectPropsBytes) {
    throw new Error('MPP: "   114"/Props ontbreekt — geen geldig MPP14-bestand');
  }
  const projectProps = new Props(projectPropsBytes, '   114/Props');

  return { cfb, projectProps, applicationVersion };
}

const Z4_ASSIGNMENT_FIXED_META_ITEM_SIZE = 34;
const Z4_ASSIGNMENT_FIXED_DATA_ITEM_SIZE = 110;

interface AssignmentUidLink {
  taskId: string;
  assignmentStart: Date | null;
  assignmentResume: Date | null;
  assignmentFinish: Date | null;
  resourceUid: number | null;
  units: number | null;
}

export function buildAssignmentUidLinks(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
): Map<number, AssignmentUidLink> {
  try {
    return buildAssignmentUidLinksUnsafe(cfb, assignmentFieldMap, taskIdByUniqueId);
  } catch {
    return new Map();
  }
}

function buildAssignmentUidLinksUnsafe(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
): Map<number, AssignmentUidLink> {
  const label = '"   114"/TBkndAssn';
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndAssn', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndAssn', 'FixedData']);
  if (!fixedMetaBytes || !fixedDataBytes) return new Map();

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, Z4_ASSIGNMENT_FIXED_META_ITEM_SIZE, `${label}/FixedMeta`);
  const fixedData = FixedData.withoutMeta(Z4_ASSIGNMENT_FIXED_DATA_ITEM_SIZE, fixedDataBytes, `${label}/FixedData`);

  const uniqueIdOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.UniqueId);
  const taskUidOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.TaskUniqueId);
  if (uniqueIdOffset === null || taskUidOffset === null) return new Map();
  const startOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.Start);
  const resumeOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.Resume);
  const finishOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.Finish);
  const resourceUidOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.ResourceUniqueId);
  const unitsOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.Units);

  const result = new Map<number, AssignmentUidLink>();
  const itemCount = fixedMeta.getItemCount();
  for (let index = 0; index < itemCount; index++) {
    const meta = fixedMeta.getByteArrayValue(index);
    if (!meta || meta.length < 8 || meta[0] !== 0) continue;
    const offset = getInt(meta, 4, `${label}/FixedMeta offset`);
    const dataIndex = fixedData.getIndexFromOffset(offset);
    if (dataIndex === -1) continue;
    const data = fixedData.getByteArrayValue(dataIndex);
    if (!data || data.length < Math.max(uniqueIdOffset, taskUidOffset) + 4) continue;
    const uid = getInt(data, uniqueIdOffset, `${label}/FixedData uniqueId`);
    const taskUid = getInt(data, taskUidOffset, `${label}/FixedData taskUid`);
    const taskId = taskIdByUniqueId.get(taskUid);
    if (!taskId) continue;
    const assignmentStart = startOffset !== null && startOffset >= 0 && data.length >= startOffset + 4
      ? getTimestamp(data, startOffset, `${label}/FixedData start`)
      : null;
    const assignmentResume = resumeOffset !== null && resumeOffset >= 0 && data.length >= resumeOffset + 4
      ? getTimestamp(data, resumeOffset, `${label}/FixedData resume`)
      : null;
    const assignmentFinish = finishOffset !== null && finishOffset >= 0 && data.length >= finishOffset + 4
      ? getTimestamp(data, finishOffset, `${label}/FixedData finish`)
      : null;
    const resourceUid = resourceUidOffset !== null && resourceUidOffset >= 0 && data.length >= resourceUidOffset + 4
      ? getInt(data, resourceUidOffset, `${label}/FixedData resourceUid`)
      : null;
    const units = unitsOffset !== null && unitsOffset >= 0 ? decodeAssignmentUnits(data, unitsOffset) : null;
    result.set(uid, { taskId, assignmentStart, assignmentResume, assignmentFinish, resourceUid, units });
  }
  return result;
}

function taskCalendar(task: Task, calResult: CalendarReadResult): WorkCalendar {
  if (!task.calendarId || task.calendarId === calResult.projectCalendar.id) return calResult.projectCalendar;
  return calResult.resourceCalendars.find((c) => c.id === task.calendarId) ?? calResult.projectCalendar;
}

function computeShiftedAssignmentPeriods(
  raw: AssignmentTimephasedRaw,
  link: AssignmentUidLink,
  engine: CalendarEngine,
  taskStart: Date,
): { actualPeriods: readonly TimephasedWorkPeriod[]; remainingPeriods: readonly TimephasedWorkPeriod[] } | null {
  const assignmentStartShift = engine.isHourMode && link.assignmentStart
    ? Math.max(0, engine.workMinutesBetween(taskStart, link.assignmentStart))
    : 0;

  const actualPeriodsRaw = raw.actualRegularWork
    ? decodeRegularTimephasedWork(raw.actualRegularWork, taskStart)
    : [];
  const remainingPeriodsRaw = raw.remainingRegularWork
    ? decodePlannedRegularTimephasedWork(raw.remainingRegularWork, taskStart)
    : [];
  if (actualPeriodsRaw.length === 0 && remainingPeriodsRaw.length === 0) return null;

  const actualPeriods = shiftPeriods(actualPeriodsRaw, assignmentStartShift);

  let remainingShift = assignmentStartShift;
  if (actualPeriods.length > 0) {
    remainingShift = engine.isHourMode && link.assignmentResume
      ? Math.max(0, engine.workMinutesBetween(taskStart, link.assignmentResume))
      : maxOf(actualPeriods.map((p) => p.elapsedWorkMinutesEnd));
  }
  const remainingPeriods = shiftPeriods(remainingPeriodsRaw, remainingShift);

  return { actualPeriods, remainingPeriods };
}

function* shiftedAssignmentPeriods(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  tasks: readonly Task[],
  calResult: CalendarReadResult,
): Generator<{ link: AssignmentUidLink } & NonNullable<ReturnType<typeof computeShiftedAssignmentPeriods>>> {
  const rawByUid = readAssignmentTimephasedRaw(cfb, assignmentFieldMap);
  if (rawByUid.size === 0) return;
  const linkByUid = buildAssignmentUidLinks(cfb, assignmentFieldMap, taskIdByUniqueId);
  if (linkByUid.size === 0) return;

  const taskById = new Map(tasks.map((t) => [t.id, t] as const));
  const engineByCalendarId = new Map<string, CalendarEngine>();
  const engineFor = (cal: WorkCalendar): CalendarEngine => {
    let engine = engineByCalendarId.get(cal.id);
    if (!engine) {
      engine = new CalendarEngine(cal);
      engineByCalendarId.set(cal.id, engine);
    }
    return engine;
  };

  for (const [uid, raw] of rawByUid) {
    const link = linkByUid.get(uid);
    if (!link) continue;
    const task = taskById.get(link.taskId);
    if (!task?.time?.scheduleStart) continue;
    if (isSummaryTask(task)) continue;
    const shifted = computeShiftedAssignmentPeriods(
      raw, link, engineFor(taskCalendar(task, calResult)), parseInstant(task.time.scheduleStart),
    );
    if (shifted) yield { link, ...shifted };
  }
}

export function deriveSplitGapsForTasks(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  tasks: readonly Task[],
  calResult: CalendarReadResult,
): Map<string, TaskSplitGap[]> {
  const gapsByAssignmentPerTask = new Map<string, TaskSplitGap[][]>();
  for (const { link, actualPeriods, remainingPeriods } of shiftedAssignmentPeriods(
    cfb, assignmentFieldMap, taskIdByUniqueId, tasks, calResult,
  )) {
    const gaps = deriveSplitGapsFromPeriods([...actualPeriods, ...remainingPeriods]);
    const list = gapsByAssignmentPerTask.get(link.taskId) ?? [];
    list.push(gaps);
    gapsByAssignmentPerTask.set(link.taskId, list);
  }

  const result = new Map<string, TaskSplitGap[]>();
  for (const [taskId, gapsByAssignment] of gapsByAssignmentPerTask) {
    const combined = deriveTaskSplitGaps(gapsByAssignment);
    if (combined.length > 0) result.set(taskId, combined);
  }
  return result;
}

export function deriveTimephasedContoursForTasks(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  tasks: readonly Task[],
  calResult: CalendarReadResult,
  resourceIdByUniqueId?: ReadonlyMap<number, string>,
): Map<string, TaskTimephasedContour[]> {
  const contoursByTask = new Map<string, TaskTimephasedContour[]>();
  const toContourPeriods = (
    periods: readonly TimephasedWorkPeriod[],
    kind: 'actual' | 'remaining',
  ): TimephasedContourPeriod[] => periods.map((p) => ({
    afterMinutes: p.elapsedWorkMinutesStart,
    minutes: p.elapsedWorkMinutesEnd - p.elapsedWorkMinutesStart,
    workMinutes: p.workMinutes,
    kind,
  }));

  for (const { link, actualPeriods, remainingPeriods } of shiftedAssignmentPeriods(
    cfb, assignmentFieldMap, taskIdByUniqueId, tasks, calResult,
  )) {
    const periods: TimephasedContourPeriod[] = [
      ...toContourPeriods(actualPeriods, 'actual'),
      ...toContourPeriods(remainingPeriods, 'remaining'),
    ];
    const list = contoursByTask.get(link.taskId) ?? [];
    const resourceId = link.resourceUid !== null ? resourceIdByUniqueId?.get(link.resourceUid) : undefined;
    list.push({ resourceUid: link.resourceUid, ...(resourceId ? { resourceId } : {}), periods });
    contoursByTask.set(link.taskId, list);
  }
  return contoursByTask;
}

export interface TimephasedWindowResult {
  finishFloor: Date | null;
  startAnchor: Date | null;
  durationWalks: { anchor: Date; resourceCalendarId: string; workMinutes?: number }[];
}

function sortedRanges(list: readonly { startDate: string; endDate: string }[] | undefined): string {
  if (!list || list.length === 0) return '[]';
  const sorted = [...list].sort((x, y) => x.startDate.localeCompare(y.startDate) || x.endDate.localeCompare(y.endDate));
  return JSON.stringify(sorted.map((h) => [h.startDate, h.endDate]));
}

function calendarBandsDiffer(a: WorkCalendar, b: WorkCalendar): boolean {
  if (!a.workTime || !b.workTime) return false;
  return JSON.stringify(a.workTime.byWeekday) !== JSON.stringify(b.workTime.byWeekday);
}

function calendarDiffersIncludingExceptions(a: WorkCalendar, b: WorkCalendar): boolean {
  if (calendarBandsDiffer(a, b)) return true;
  if (!a.workTime || !b.workTime) return false;
  if (sortedRanges(a.holidays) !== sortedRanges(b.holidays)) return true;
  if (sortedRanges(a.workingExceptions) !== sortedRanges(b.workingExceptions)) return true;
  return false;
}

function roundToMspDurationResolution(minutes: number): number {
  return Math.round(minutes * 10) / 10;
}

export function decodeAssignmentWorkMinutes(
  raw: AssignmentTimephasedRaw, taskStart: Date, assignmentFinish: Date | null,
): number | null {
  const actual = raw.actualRegularWork ? decodeRegularTimephasedWork(raw.actualRegularWork, taskStart) : [];
  const referenceFinish = assignmentFinish ?? new Date(taskStart.getTime() + 60_000);
  const remaining = raw.remainingRegularWork
    ? decodePlannedRegularTimephasedWork(raw.remainingRegularWork, taskStart, referenceFinish)
    : [];
  const total = actual.reduce((sum, p) => sum + p.workMinutes, 0)
    + remaining.reduce((sum, p) => sum + p.workMinutes, 0);
  return total > 0 ? total : null;
}

export function deriveTimephasedWindowsForTasks(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  tasks: readonly Task[],
  calResult: CalendarReadResult,
  resourceIdByUniqueId: ReadonlyMap<number, string>,
  resources: readonly Resource[],
  costResourceIds: ReadonlySet<string> = new Set(),
): Map<string, TimephasedWindowResult> {
  const rawByUid = readAssignmentTimephasedRaw(cfb, assignmentFieldMap);
  if (rawByUid.size === 0) return new Map();

  const linkByUid = buildAssignmentUidLinks(cfb, assignmentFieldMap, taskIdByUniqueId);
  if (linkByUid.size === 0) return new Map();

  const taskById = new Map(tasks.map((t) => [t.id, t] as const));
  const resourceById = new Map(resources.map((r) => [r.id, r] as const));
  const finishesByTask = new Map<string, Date[]>();
  const startsByTask = new Map<string, Date[]>();
  const durationWalksByTask = new Map<string, {
    anchor: Date; resourceCalendarId: string; workMinutes: number | null; units: number | null; drivesDuration: boolean;
  }[]>();
  const layer4ActivatedTasks = new Set<string>();

  for (const [uid, raw] of rawByUid) {
    const link = linkByUid.get(uid);
    if (!link) continue;
    const task = taskById.get(link.taskId);
    if (!task || isSummaryTask(task)) continue;
    if (!task.time.scheduleStart) continue;
    const completion = task.time.completion ?? 0;

    if (completion === 0) {
      const taskStart = parseInstant(task.time.scheduleStart);
      const actualPeriods = raw.actualRegularWork
        ? decodeRegularTimephasedWork(raw.actualRegularWork, taskStart)
        : [];
      const remainingPeriods = raw.remainingRegularWork
        ? decodePlannedRegularTimephasedWork(raw.remainingRegularWork, taskStart)
        : [];
      const hasGenuinePeriod = actualPeriods.length > 0 || remainingPeriods.length > 0;

      if (hasGenuinePeriod) {
        if (link.assignmentFinish) {
          const list = finishesByTask.get(link.taskId) ?? [];
          list.push(link.assignmentFinish);
          finishesByTask.set(link.taskId, list);
        }
        if (link.assignmentStart) {
          const list = startsByTask.get(link.taskId) ?? [];
          list.push(link.assignmentStart);
          startsByTask.set(link.taskId, list);
        }
        continue;
      }
    }

    if (!hasAnyTimephasedData(raw)) continue;
    if (!link.assignmentStart || link.resourceUid === null) continue;
    const resourceId = resourceIdByUniqueId.get(link.resourceUid);
    const resource = resourceId ? resourceById.get(resourceId) : null;
    const resCal = resource?.calendarId
      ? calResult.resourceCalendars.find((c) => c.id === resource.calendarId)
      : null;
    if (!resCal) continue;
    const taskCal = taskCalendar(task, calResult);
    const activates = calendarDiffersIncludingExceptions(resCal, taskCal);
    if (activates) layer4ActivatedTasks.add(link.taskId);
    const walkList = durationWalksByTask.get(link.taskId) ?? [];
    const workMinutes = decodeAssignmentWorkMinutes(raw, parseInstant(task.time.scheduleStart), link.assignmentFinish);
    walkList.push({
      anchor: link.assignmentStart, resourceCalendarId: resCal.id, workMinutes, units: link.units,
      drivesDuration: !!resource && resourceDrivesDuration(resource) && !costResourceIds.has(resource.id),
    });
    durationWalksByTask.set(link.taskId, walkList);
  }

  const result = new Map<string, TimephasedWindowResult>();
  for (const [taskId, finishes] of finishesByTask) {
    const finishFloor = new Date(maxOf(finishes.map((d) => d.getTime())));
    const starts = startsByTask.get(taskId);
    const startAnchor = starts ? new Date(minOf(starts.map((d) => d.getTime()))) : null;
    result.set(taskId, { finishFloor, startAnchor, durationWalks: [] });
  }
  for (const [taskId, walks] of durationWalksByTask) {
    if (result.has(taskId)) continue;
    if (walks.length === 1 && layer4ActivatedTasks.has(taskId)) {
      const startAnchor = new Date(minOf(walks.map((w) => w.anchor.getTime())));
      result.set(taskId, {
        finishFloor: null, startAnchor,
        durationWalks: walks.map((w) => ({ anchor: w.anchor, resourceCalendarId: w.resourceCalendarId })),
      });
    } else if (walks.length > 1) {
      const driving = walks.filter((w) => w.drivesDuration);
      const ownMinutes = driving.map((w) => (w.workMinutes === null || w.units === null ? null
        : assignmentRemainingMinutes({ id: '', unitsPerDay: w.units, remainingWorkMinutes: w.workMinutes, drivesDuration: true }, 0)));
      if (driving.length >= 1 && ownMinutes.every((m) => m !== null)) {
        const startAnchor = new Date(minOf(walks.map((w) => w.anchor.getTime())));
        result.set(taskId, {
          finishFloor: null, startAnchor,
          durationWalks: driving.map((w, i) => ({
            anchor: w.anchor, resourceCalendarId: w.resourceCalendarId,
            workMinutes: roundToMspDurationResolution(ownMinutes[i]!),
          })),
        });
      }
    }
  }
  return result;
}

export function readMPP(bytes: Uint8Array, labels?: ImportLabels): ImportResult {
  const { cfb, projectProps, applicationVersion } = openMppProject(bytes);

  const { project, hoursPerDay, calendarHoursPerDayOverride, projectStartFromFile } = parseProjectProperties(projectProps, labels);

  const taskFieldMap = createTaskFieldMap(projectProps);

  const calResult = readCalendars(cfb, projectProps, applicationVersion, calendarHoursPerDayOverride);
  const calendar = calResult.projectCalendar;
  project.calendarId = calendar.id;

  const { tasks, taskIdByUniqueId, startAnchor, recordedTimes } = readTasks({
    cfb, taskFieldMap, hoursPerDay, statusDate: project.statusDate, applicationVersion, calResult,
    projectStart: projectStartFromFile ? project.startDate : '',
    criticalSlackLimitDays: criticalSlackLimitDaysOf(projectProps),
  });
  if (!projectStartFromFile) project.startDate = startAnchor;

  const sequences = readRelations(cfb, applicationVersion, taskIdByUniqueId);

  const resourceFieldMap = createResourceFieldMap(projectProps);
  const { resources, resourceIdByUniqueId, costResourceIds } = readResources(cfb, resourceFieldMap, applicationVersion, calResult, labels);

  const assignmentFieldMap = createAssignmentFieldMap(projectProps);
  const assignments = readAssignments(cfb, assignmentFieldMap, taskIdByUniqueId, resourceIdByUniqueId);

  reconstructResourceIds(tasks, assignments);

  const splitGapsByTaskId = deriveSplitGapsForTasks(cfb, assignmentFieldMap, taskIdByUniqueId, tasks, calResult);
  for (const task of tasks) {
    const gaps = splitGapsByTaskId.get(task.id);
    if (gaps) task.splitGaps = gaps;
  }

  const contoursByTaskId = deriveTimephasedContoursForTasks(cfb, assignmentFieldMap, taskIdByUniqueId, tasks, calResult, resourceIdByUniqueId);
  for (const task of tasks) {
    const contours = contoursByTaskId.get(task.id);
    if (contours && contours.length > 0) task.timephasedContours = contours;
  }

  const timephasedWindowByTaskId = deriveTimephasedWindowsForTasks(
    cfb, assignmentFieldMap, taskIdByUniqueId, tasks, calResult, resourceIdByUniqueId, resources, costResourceIds,
  );
  for (const task of tasks) {
    const window = timephasedWindowByTaskId.get(task.id);
    if (!window) continue;
    if (window.finishFloor) task.timephasedFinishFloor = formatInstant(window.finishFloor, 'hour');
    if (window.startAnchor) task.timephasedStartAnchor = formatInstant(window.startAnchor, 'hour');
    if (window.durationWalks.length > 0) {
      task.timephasedDurationWalks = window.durationWalks.map((w) => ({
        anchor: formatInstant(w.anchor, 'hour'), resourceCalendarId: w.resourceCalendarId,
        ...(w.workMinutes !== undefined ? { workMinutes: w.workMinutes } : {}),
      }));
    }
    if (task.timephasedFinishFloor) {
      for (const assignment of assignments) {
        if (assignment.taskId !== task.id) continue;
        assignment.workWindowFinish = task.timephasedFinishFloor;
        if (task.timephasedStartAnchor) assignment.workWindowStart = task.timephasedStartAnchor;
      }
    }
  }

  const scheduleNotes = countScheduleNotes(tasks);
  const msProjectReport = scanMppImportLoss({
    cfb, taskFieldMap, resourceFieldMap, assignmentFieldMap,
    taskUniqueIds: new Set(taskIdByUniqueId.keys()),
    resourceUniqueIds: new Set(resourceIdByUniqueId.keys()),
  });

  return {
    project,
    calendar,
    tasks,
    sequences,
    resources,
    assignments,
    resourceCalendars: calResult.resourceCalendars,
    suggestedProfileId: 'msproject',
    ...(scheduleNotes.total > 0 ? { sourceScheduleNotes: scheduleNotes } : {}),
    ...(hasMsProjectImportLoss(msProjectReport) ? { msProjectReport } : {}),
    ...(() => {
      const leafTimes = leafRecordedTimes(tasks, recordedTimes);
      return Object.keys(leafTimes).length > 0 ? { recordedTimes: leafTimes, recordedTimesOrigin: 'mpp' as const } : {};
    })(),
  };
}
