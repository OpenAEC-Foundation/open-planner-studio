import type { WriteIFCInput } from '../ifcWriter';
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';

type AllKeys<T, K extends readonly (keyof T)[]> = [Exclude<keyof T, K[number]>] extends [never]
  ? K : { readonly ontbrekendeSleutels: Exclude<keyof T, K[number]> };

function allKeysOf<T>() {
  return <const K extends readonly (keyof T)[]>(keys: K & AllKeys<T, K>): ReadonlySet<string> => new Set(keys.map(key => String(key)));
}

export const INPUT_KEYS = allKeysOf<WriteIFCInput>()([
  'timeModel', 'milestonesAtDayEnd', 'project', 'calendar', 'tasks', 'sequences', 'resources', 'assignments', 'resourceCalendars',
  'activityCodeTypes', 'customFieldDefs', 'customTaskTypes', 'baselines', 'activeBaselineId', 'comparedBaselineIds', 'libraryPool',
  'sourceScheduleNotes', 'recordedFields', 'recordedTimes', 'recordedTimesOrigin', 'importPristine', 'ifcGlobalIds',
  'baselineOrphanGuids', 'ifcLiteralCalendarIds', 'recordedSourceFormat', 'suggestedProfileId', 'xer', 'xerOrigin',
  'xerSourceArchive', 'ifcSource', 'ifcLegacySchemaLoss', 'recoveryForeignSource', 'xerSourceProjectId', 'xerArchiveIssue',
  'xerMissingPlannedStarts', 'p6xmlReport', 'msProjectReport', 'minuteModelPending', 'withheldTaskTimeFields', 'xerSourceArchiveStorage',
]);

export const PROJECT_KEYS = allKeysOf<Project>()([
  'id', 'name', 'description', 'startDate', 'endDate', 'calendarId', 'createdAt', 'modifiedAt', 'author', 'company',
  'defaultTaskDurationUnit', 'defaultWorkRule', 'wbsAutoNumber', 'statusDate', 'progressMode', 'schedulingOptions',
  'schedulingProfile', 'companyId', 'companyName', 'ifcSchema', 'ifcSchemaUnconfirmed', 'p6ProjectCode', 'dependentProjectsFolder',
  'anchorsFromOpenDocuments',
]);

export const CALENDAR_KEYS = allKeysOf<WorkCalendar>()([
  'id', 'name', 'description', 'workDays', 'workStartHour', 'workEndHour', 'hoursPerDay', 'simpleBreakStartMinute',
  'simpleBreakDurationMinutes', 'holidays', 'generation', 'workTime', 'ifcTimePeriods', 'shift', 'libraryOrigin',
  'workingExceptions', 'p6Source', 'p6NonWorkPenaltyDates', 'p6NonWorkPenaltyDatesState',
]);

export const TASK_KEYS = allKeysOf<Task>()([
  'id', 'name', 'description', 'wbsCode', 'taskType', 'customTaskTypeId', 'status', 'isMilestone', 'milestoneKind', 'mandatory',
  'priority', 'levelingDelay', 'levelingDelayMinutes', 'levelingDelayElapsed', 'splitGaps', 'timephasedFinishFloor',
  'timephasedStartAnchor', 'timephasedDurationWalks', 'timephasedContours', 'manuallyScheduled', 'mspTaskType', 'effortDriven',
  'workRule', 'p6DurationType', 'p6ActivityType', 'p6ProjectId', 'p6TaskId', 'p6ExplicitTargetWindow', 'p6CompletePctType',
  'p6ExpectedFinish', 'p6SuspendResume', 'isSummary', 'parentId', 'childIds', 'time', 'resourceIds', 'color', 'activityCodes',
  'customFields', 'constraint', 'constraint2', 'isHammock', 'externalLinks', 'deadline', 'calendarId', 'notes',
]);

export const TASK_TIME_KEYS = allKeysOf<TaskTime>()([
  'durationType', 'durationUnit', 'scheduleDuration', 'durationMinutes', 'scheduleStart', 'scheduleFinish', 'resume', 'stop',
  'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'freeFloat', 'totalFloat', 'totalFloatMinutes', 'freeFloatMinutes',
  'isCritical', 'interferingFloat', 'isNearCritical', 'floatPath', 'actualStart', 'actualFinish', 'actualDuration', 'remainingTime',
  'remainingMinutes', 'completion', 'progressBeforeRecalculation',
]);

export const SEQUENCE_KEYS = allKeysOf<Sequence>()([
  'id', 'predecessorId', 'successorId', 'type', 'lagDays', 'lagMinutes', 'lagUnit', 'p6StartAtPredecessorFinishBoundary', 'lagPercent',
]);
