import { localTodayIso } from '@/utils/dateUtils';
import { withTaskTypeColors } from '@/services/taskTypes/customTaskTypeColors';
import type { Project } from '@/types/project';
import { resolveConventions } from '@/engine/scheduler/conventions/registry';
import type { WorkCalendar, Holiday, WorkTimeBands, WorkingException } from '@/types/calendar';
import type { Task, TaskTime, TaskConstraint, ExternalLink } from '@/types/task';
import { hourInputFinishFollowsEdits } from '@/utils/taskDefaults';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment, AvailabilityStep } from '@/types/resource';
import type { ImportResult } from '@/services/importTypes';
import type { RibbonTab } from '@/state/slices/types';
import type { CjkFontProvider } from '@/services/pdf/fontRegistry';
import type {
  ExtProject,
  ExtSchedulingOptions,
  ExtCalendar,
  ExtHoliday,
  ExtWorkingException,
  ExtWorkTimeBands,
  ExtTask,
  ExtTaskTime,
  ExtTaskConstraint,
  ExtExternalLink,
  ExtTaskNote,
  ExtSequence,
  ExtResource,
  ExtAvailabilityStep,
  ExtAssignment,
  ExtImportResult,
  ExtRibbonTab,
  ExtFontProvider,
} from './extTypes';

export const PUBLIC_SCHEDULING_OPTION_KEYS = [
  'lagCalendar', 'criticalDefinition', 'totalFloatMode', 'makeOpenEndedCritical', 'nearCriticalThreshold', 'floatPaths',
] as const satisfies readonly (keyof ExtSchedulingOptions)[];
const _publicOptionKeysComplete: [Exclude<keyof ExtSchedulingOptions, (typeof PUBLIC_SCHEDULING_OPTION_KEYS)[number]>] extends [never]
  ? true : never = true;
void _publicOptionKeysComplete;

export function publicSchedulingOptions(o: ExtSchedulingOptions): ExtSchedulingOptions {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_SCHEDULING_OPTION_KEYS) {
    const value = o[key];
    if (value !== undefined) out[key] = typeof value === 'object' && value !== null ? { ...value } : value;
  }
  return out as ExtSchedulingOptions;
}

function copyConstraint(c: TaskConstraint): ExtTaskConstraint {
  return { type: c.type, date: c.date, hard: c.hard };
}
function toIntConstraint(c: ExtTaskConstraint): TaskConstraint {
  return { type: c.type, date: c.date, hard: c.hard };
}

function copyExternalLink(l: ExternalLink): ExtExternalLink {
  return {
    id: l.id,
    direction: l.direction,
    relType: l.relType,
    lagDays: l.lagDays,
    lagMinutes: l.lagMinutes,
    anchorDate: l.anchorDate,
    sourceRef: { ...l.sourceRef },
    sourceMissing: l.sourceMissing,
  };
}
function toIntExternalLink(l: ExtExternalLink): ExternalLink {
  return {
    id: l.id,
    direction: l.direction,
    relType: l.relType,
    lagDays: l.lagDays,
    lagMinutes: l.lagMinutes,
    anchorDate: l.anchorDate,
    sourceRef: { ...l.sourceRef },
    sourceMissing: l.sourceMissing,
  };
}

function copyNote(n: { id: string; text: string; done: boolean }): ExtTaskNote {
  return { id: n.id, text: n.text, done: n.done };
}

function copyWorkTime(w: WorkTimeBands): ExtWorkTimeBands {
  const src = w.byWeekday;
  return {
    byWeekday: {
      1: src[1].map((b) => ({ start: b.start, end: b.end })),
      2: src[2].map((b) => ({ start: b.start, end: b.end })),
      3: src[3].map((b) => ({ start: b.start, end: b.end })),
      4: src[4].map((b) => ({ start: b.start, end: b.end })),
      5: src[5].map((b) => ({ start: b.start, end: b.end })),
      6: src[6].map((b) => ({ start: b.start, end: b.end })),
      7: src[7].map((b) => ({ start: b.start, end: b.end })),
    },
  };
}
function toIntWorkTime(w: ExtWorkTimeBands): WorkTimeBands {
  const src = w.byWeekday;
  return {
    byWeekday: {
      1: src[1].map((b) => ({ start: b.start, end: b.end })),
      2: src[2].map((b) => ({ start: b.start, end: b.end })),
      3: src[3].map((b) => ({ start: b.start, end: b.end })),
      4: src[4].map((b) => ({ start: b.start, end: b.end })),
      5: src[5].map((b) => ({ start: b.start, end: b.end })),
      6: src[6].map((b) => ({ start: b.start, end: b.end })),
      7: src[7].map((b) => ({ start: b.start, end: b.end })),
    },
  };
}

function copyHoliday(h: Holiday): ExtHoliday {
  return { name: h.name, startDate: h.startDate, endDate: h.endDate };
}
function toIntHoliday(h: ExtHoliday): Holiday {
  return { name: h.name, startDate: h.startDate, endDate: h.endDate };
}

function copyWorkingException(w: WorkingException): ExtWorkingException {
  return { name: w.name, startDate: w.startDate, endDate: w.endDate, ...(w.bands ? { bands: w.bands.map((b) => ({ start: b.start, end: b.end })) } : {}) };
}
function toIntWorkingException(w: ExtWorkingException): WorkingException {
  return { name: w.name, startDate: w.startDate, endDate: w.endDate, ...(w.bands ? { bands: w.bands.map((b) => ({ start: b.start, end: b.end })) } : {}) };
}

function copyAvailStep(s: AvailabilityStep): ExtAvailabilityStep {
  return { from: s.from, maxUnits: s.maxUnits };
}
function toIntAvailStep(s: ExtAvailabilityStep): AvailabilityStep {
  return { from: s.from, maxUnits: s.maxUnits };
}

export function toExtProject(p: Project): ExtProject {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    startDate: p.startDate,
    endDate: p.endDate,
    calendarId: p.calendarId,
    createdAt: p.createdAt,
    modifiedAt: p.modifiedAt,
    author: p.author,
    company: p.company,
    wbsAutoNumber: p.wbsAutoNumber,
    statusDate: p.statusDate,
    progressMode: p.progressMode,
    defaultTaskDurationUnit: p.defaultTaskDurationUnit,
    defaultWorkRule: p.defaultWorkRule,
    schedulingOptions: p.schedulingOptions ? publicSchedulingOptions(p.schedulingOptions) : undefined,
    schedulingProfile: {
      id: p.schedulingProfile?.id ?? 'ops',
      baseId: p.schedulingProfile?.baseId ?? 'ops',
      name: p.schedulingProfile?.name ?? '',
      conventions: { ...resolveConventions(p.schedulingProfile) },
    },
  };
}

export function fromExtProject(p: ExtProject): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    startDate: p.startDate,
    endDate: p.endDate,
    calendarId: p.calendarId,
    createdAt: p.createdAt,
    modifiedAt: p.modifiedAt,
    author: p.author,
    company: p.company,
    wbsAutoNumber: p.wbsAutoNumber,
    statusDate: p.statusDate,
    progressMode: p.progressMode,
    defaultTaskDurationUnit: p.defaultTaskDurationUnit,
    defaultWorkRule: p.defaultWorkRule,
    schedulingOptions: p.schedulingOptions ? publicSchedulingOptions(p.schedulingOptions) : undefined,
  };
}

export function toExtCalendar(c: WorkCalendar): ExtCalendar {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    workDays: [...c.workDays],
    workStartHour: c.workStartHour,
    workEndHour: c.workEndHour,
    hoursPerDay: c.hoursPerDay,
    simpleBreakStartMinute: c.simpleBreakStartMinute,
    simpleBreakDurationMinutes: c.simpleBreakDurationMinutes,
    holidays: c.holidays.map(copyHoliday),
    workTime: c.workTime ? copyWorkTime(c.workTime) : undefined,
    shift: c.shift,
    workingExceptions: c.workingExceptions ? c.workingExceptions.map(copyWorkingException) : undefined,
    p6Source: c.p6Source,
    p6NonWorkPenaltyDates: c.p6NonWorkPenaltyDates ? [...c.p6NonWorkPenaltyDates] : undefined,
  };
}

export function fromExtCalendar(c: ExtCalendar): WorkCalendar {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    workDays: [...c.workDays],
    workStartHour: c.workStartHour,
    workEndHour: c.workEndHour,
    hoursPerDay: c.hoursPerDay,
    simpleBreakStartMinute: c.simpleBreakStartMinute,
    simpleBreakDurationMinutes: c.simpleBreakDurationMinutes,
    holidays: c.holidays.map(toIntHoliday),
    workTime: c.workTime ? toIntWorkTime(c.workTime) : undefined,
    shift: c.shift,
    workingExceptions: c.workingExceptions ? c.workingExceptions.map(toIntWorkingException) : undefined,
  };
}

export function toExtTaskTime(tt: TaskTime): ExtTaskTime {
  return {
    durationType: tt.durationType,
    durationUnit: tt.durationUnit,
    scheduleDuration: tt.scheduleDuration,
    durationMinutes: tt.durationMinutes,
    scheduleStart: tt.scheduleStart,
    scheduleFinish: tt.scheduleFinish,
    earlyStart: tt.earlyStart,
    earlyFinish: tt.earlyFinish,
    lateStart: tt.lateStart,
    lateFinish: tt.lateFinish,
    freeFloat: tt.freeFloat,
    totalFloat: tt.totalFloat,
    isCritical: tt.isCritical,
    interferingFloat: tt.interferingFloat,
    isNearCritical: tt.isNearCritical,
    floatPath: tt.floatPath,
    actualStart: tt.actualStart,
    actualFinish: tt.actualFinish,
    actualDuration: tt.actualDuration,
    remainingTime: tt.remainingTime,
    remainingMinutes: tt.remainingMinutes,
    completion: tt.completion,
    resume: tt.resume,
    stop: tt.stop,
  };
}

export function fromExtTaskTime(tt: ExtTaskTime): TaskTime {
  const start = tt.scheduleStart ?? localTodayIso();
  const finish = tt.scheduleFinish ?? start;
  return {
    durationType: tt.durationType ?? 'WORKTIME',
    durationUnit: tt.durationUnit ?? (tt.durationMinutes != null ? 'hours' : 'days'),
    scheduleDuration: tt.scheduleDuration ?? 0,
    durationMinutes: tt.durationMinutes,
    scheduleStart: start,
    scheduleFinish: finish,
    earlyStart: tt.earlyStart ?? start,
    earlyFinish: tt.earlyFinish ?? finish,
    lateStart: tt.lateStart ?? start,
    lateFinish: tt.lateFinish ?? finish,
    freeFloat: tt.freeFloat ?? 0,
    totalFloat: tt.totalFloat ?? 0,
    isCritical: tt.isCritical ?? false,
    interferingFloat: tt.interferingFloat,
    isNearCritical: tt.isNearCritical,
    floatPath: tt.floatPath,
    actualStart: tt.actualStart,
    actualFinish: tt.actualFinish,
    actualDuration: tt.actualDuration,
    remainingTime: tt.remainingTime,
    remainingMinutes: tt.remainingMinutes,
    completion: tt.completion ?? 0,
    resume: tt.resume,
    stop: tt.stop,
  };
}

export function toExtTask(t: Task, customTaskType?: { id: string; name: string }): ExtTask {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    wbsCode: t.wbsCode,
    taskType: t.taskType,
    ...(t.customTaskTypeId ? { customTaskType: customTaskType ? { id: customTaskType.id, name: customTaskType.name } : { id: t.customTaskTypeId } } : {}),
    status: t.status,
    isMilestone: t.isMilestone,
    milestoneKind: t.milestoneKind,
    mandatory: t.mandatory,
    priority: t.priority,
    levelingDelay: t.levelingDelay,
    levelingDelayMinutes: t.levelingDelayMinutes,
    levelingDelayElapsed: t.levelingDelayElapsed,
    splitGaps: t.splitGaps ? t.splitGaps.map(g => ({ ...g })) : undefined,
    manuallyScheduled: t.manuallyScheduled,
    mspTaskType: t.mspTaskType,
    effortDriven: t.effortDriven,
    workRule: t.workRule,
    p6DurationType: t.p6DurationType,
    p6ActivityType: t.p6ActivityType,
    p6ProjectId: t.p6ProjectId,
    p6TaskId: t.p6TaskId,
    p6ExplicitTargetWindow: t.p6ExplicitTargetWindow,
    p6CompletePctType: t.p6CompletePctType,
    p6ExpectedFinish: t.p6ExpectedFinish,
    p6SuspendResume: t.p6SuspendResume,
    timephasedContours: t.timephasedContours ? t.timephasedContours.map(c => ({ resourceUid: c.resourceUid, ...(c.resourceId !== undefined ? { resourceId: c.resourceId } : {}), periods: c.periods.map(p => ({ ...p })) })) : undefined,
    timephasedFinishFloor: t.timephasedFinishFloor,
    timephasedStartAnchor: t.timephasedStartAnchor,
    timephasedDurationWalks: t.timephasedDurationWalks ? t.timephasedDurationWalks.map(w => ({ ...w })) : undefined,
    parentId: t.parentId,
    childIds: [...t.childIds],
    isSummary: t.isSummary,
    time: toExtTaskTime(t.time),
    resourceIds: [...t.resourceIds],
    color: t.color,
    activityCodes: t.activityCodes ? { ...t.activityCodes } : undefined,
    customFields: t.customFields ? { ...t.customFields } : undefined,
    constraint: t.constraint ? copyConstraint(t.constraint) : undefined,
    constraint2: t.constraint2 ? copyConstraint(t.constraint2) : undefined,
    isHammock: t.isHammock,
    externalLinks: t.externalLinks ? t.externalLinks.map(copyExternalLink) : undefined,
    deadline: t.deadline,
    calendarId: t.calendarId,
    notes: t.notes ? t.notes.map(copyNote) : undefined,
  };
}

export function fromExtTask(t: ExtTask): Task {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    wbsCode: t.wbsCode,
    taskType: t.taskType,
    ...(t.customTaskType?.id.trim() ? { customTaskTypeId: t.customTaskType.id.trim(), taskType: 'USERDEFINED' } : {}),
    status: t.status,
    isMilestone: t.isMilestone,
    milestoneKind: t.milestoneKind,
    mandatory: t.mandatory,
    priority: t.priority,
    levelingDelay: t.levelingDelay,
    levelingDelayMinutes: t.levelingDelayMinutes,
    levelingDelayElapsed: t.levelingDelayElapsed,
    splitGaps: t.splitGaps ? t.splitGaps.map(g => ({ ...g })) : undefined,
    manuallyScheduled: t.manuallyScheduled,
    mspTaskType: t.mspTaskType,
    effortDriven: t.effortDriven,
    workRule: t.workRule,
    timephasedContours: t.timephasedContours ? t.timephasedContours.map(c => ({ resourceUid: c.resourceUid, ...(c.resourceId !== undefined ? { resourceId: c.resourceId } : {}), periods: c.periods.map(p => ({ ...p })) })) : undefined,
    timephasedFinishFloor: t.timephasedFinishFloor,
    timephasedStartAnchor: t.timephasedStartAnchor,
    timephasedDurationWalks: t.timephasedDurationWalks ? t.timephasedDurationWalks.map(w => ({ ...w })) : undefined,
    parentId: t.parentId,
    childIds: [...t.childIds],
    isSummary: t.isSummary,
    time: fromExtTaskTime(t.time),
    resourceIds: [...t.resourceIds],
    color: t.color,
    activityCodes: t.activityCodes ? { ...t.activityCodes } : undefined,
    customFields: t.customFields ? { ...t.customFields } : undefined,
    constraint: t.constraint ? toIntConstraint(t.constraint) : undefined,
    constraint2: t.constraint2 ? toIntConstraint(t.constraint2) : undefined,
    isHammock: t.isHammock,
    externalLinks: t.externalLinks ? t.externalLinks.map(toIntExternalLink) : undefined,
    deadline: t.deadline,
    calendarId: t.calendarId,
    notes: t.notes ? t.notes.map(copyNote) : undefined,
  };
}

export function fromExtTaskInput(
  input: Partial<ExtTask> & { name: string },
): Partial<Task> & { name: string } {
  const out: Partial<Task> & { name: string } = { name: input.name };
  if (input.id !== undefined) out.id = input.id;
  if (input.description !== undefined) out.description = input.description;
  if (input.wbsCode !== undefined) out.wbsCode = input.wbsCode;
  if (input.taskType !== undefined) {
    out.taskType = input.taskType;
    if (input.taskType !== 'USERDEFINED') out.customTaskTypeId = undefined;
  }
  if (input.customTaskType?.id) {
    out.taskType = 'USERDEFINED';
    out.customTaskTypeId = input.customTaskType.id.trim();
  }
  if (input.status !== undefined) out.status = input.status;
  if (input.isMilestone !== undefined) out.isMilestone = input.isMilestone;
  if (input.milestoneKind !== undefined) out.milestoneKind = input.milestoneKind;
  if (input.mandatory !== undefined) out.mandatory = input.mandatory;
  if (input.priority !== undefined) out.priority = input.priority;
  if (input.levelingDelay !== undefined) out.levelingDelay = input.levelingDelay;
  if (input.levelingDelayMinutes !== undefined) out.levelingDelayMinutes = input.levelingDelayMinutes;
  if (input.levelingDelayElapsed !== undefined) out.levelingDelayElapsed = input.levelingDelayElapsed;
  if (input.splitGaps !== undefined) out.splitGaps = input.splitGaps.map(g => ({ ...g }));
  if (input.manuallyScheduled !== undefined) out.manuallyScheduled = input.manuallyScheduled;
  if (input.parentId !== undefined) out.parentId = input.parentId;
  if (input.childIds !== undefined) out.childIds = [...input.childIds];
  if (input.isSummary !== undefined) out.isSummary = input.isSummary;
  if (input.time !== undefined) out.time = fromExtTaskTime(input.time);
  if (input.resourceIds !== undefined) out.resourceIds = [...input.resourceIds];
  if (input.color !== undefined) out.color = input.color;
  if (input.activityCodes !== undefined) out.activityCodes = { ...input.activityCodes };
  if (input.customFields !== undefined) out.customFields = { ...input.customFields };
  if (input.constraint !== undefined) out.constraint = toIntConstraint(input.constraint);
  if (input.constraint2 !== undefined) out.constraint2 = toIntConstraint(input.constraint2);
  if (input.isHammock !== undefined) out.isHammock = input.isHammock;
  if (input.externalLinks !== undefined) out.externalLinks = input.externalLinks.map(toIntExternalLink);
  if (input.deadline !== undefined) out.deadline = input.deadline;
  if (input.calendarId !== undefined) out.calendarId = input.calendarId;
  if (input.notes !== undefined) out.notes = input.notes.map(copyNote);
  return out;
}

export function fromExtTaskAddInput(
  input: Partial<ExtTask> & { name: string },
): Partial<Task> & { name: string } {
  const out = fromExtTaskInput(input);
  if (!input.time || !out.time || input.time.scheduleFinish !== undefined || out.time.durationUnit !== 'hours') return out;
  const probe = { childIds: [], status: 'NOT_STARTED', ...out, time: out.time } as Task;
  if (!hourInputFinishFollowsEdits(probe)) return out;
  const time: Partial<TaskTime> = { ...out.time };
  delete time.scheduleFinish;
  delete time.earlyFinish;
  delete time.lateFinish;
  out.time = time as TaskTime;
  return out;
}

function fromExtTaskTimePatch(tt: Partial<ExtTaskTime>): Partial<TaskTime> {
  const out: Partial<TaskTime> = {};
  if ('durationType' in tt) out.durationType = tt.durationType;
  if ('scheduleDuration' in tt) out.scheduleDuration = tt.scheduleDuration;
  if ('durationMinutes' in tt) out.durationMinutes = tt.durationMinutes;
  if ('scheduleStart' in tt) out.scheduleStart = tt.scheduleStart;
  if ('scheduleFinish' in tt) out.scheduleFinish = tt.scheduleFinish;
  if ('earlyStart' in tt) out.earlyStart = tt.earlyStart;
  if ('earlyFinish' in tt) out.earlyFinish = tt.earlyFinish;
  if ('lateStart' in tt) out.lateStart = tt.lateStart;
  if ('lateFinish' in tt) out.lateFinish = tt.lateFinish;
  if ('freeFloat' in tt) out.freeFloat = tt.freeFloat;
  if ('totalFloat' in tt) out.totalFloat = tt.totalFloat;
  if ('isCritical' in tt) out.isCritical = tt.isCritical;
  if ('interferingFloat' in tt) out.interferingFloat = tt.interferingFloat;
  if ('isNearCritical' in tt) out.isNearCritical = tt.isNearCritical;
  if ('floatPath' in tt) out.floatPath = tt.floatPath;
  if ('actualStart' in tt) out.actualStart = tt.actualStart;
  if ('actualFinish' in tt) out.actualFinish = tt.actualFinish;
  if ('actualDuration' in tt) out.actualDuration = tt.actualDuration;
  if ('remainingTime' in tt) out.remainingTime = tt.remainingTime;
  if ('remainingMinutes' in tt) out.remainingMinutes = tt.remainingMinutes;
  if ('completion' in tt) out.completion = tt.completion;
  if ('resume' in tt) out.resume = tt.resume;
  if ('stop' in tt) out.stop = tt.stop;
  return out;
}

export function fromExtTaskUpdates(updates: Partial<ExtTask>): Partial<Task> {
  const out: Partial<Task> = {};
  if (updates.name !== undefined) out.name = updates.name;
  if (updates.description !== undefined) out.description = updates.description;
  if (updates.wbsCode !== undefined) out.wbsCode = updates.wbsCode;
  if (updates.taskType !== undefined) {
    out.taskType = updates.taskType;
    if (updates.taskType !== 'USERDEFINED') out.customTaskTypeId = undefined;
  }
  if (updates.customTaskType?.id) {
    out.taskType = 'USERDEFINED';
    out.customTaskTypeId = updates.customTaskType.id.trim();
  }
  if (updates.status !== undefined) out.status = updates.status;
  if (updates.isMilestone !== undefined) out.isMilestone = updates.isMilestone;
  if (updates.milestoneKind !== undefined) out.milestoneKind = updates.milestoneKind;
  if (updates.mandatory !== undefined) out.mandatory = updates.mandatory;
  if (updates.priority !== undefined) out.priority = updates.priority;
  if (updates.levelingDelay !== undefined) out.levelingDelay = updates.levelingDelay;
  if (updates.levelingDelayMinutes !== undefined) out.levelingDelayMinutes = updates.levelingDelayMinutes;
  if (updates.levelingDelayElapsed !== undefined) out.levelingDelayElapsed = updates.levelingDelayElapsed;
  if (updates.splitGaps !== undefined) out.splitGaps = updates.splitGaps.map(g => ({ ...g }));
  if (updates.manuallyScheduled !== undefined) out.manuallyScheduled = updates.manuallyScheduled;
  if (updates.parentId !== undefined) out.parentId = updates.parentId;
  if (updates.childIds !== undefined) out.childIds = [...updates.childIds];
  if (updates.isSummary !== undefined) out.isSummary = updates.isSummary;
  if (updates.time !== undefined) out.time = fromExtTaskTimePatch(updates.time) as TaskTime;
  if (updates.resourceIds !== undefined) out.resourceIds = [...updates.resourceIds];
  if (updates.color !== undefined) out.color = updates.color;
  if (updates.activityCodes !== undefined) out.activityCodes = { ...updates.activityCodes };
  if (updates.customFields !== undefined) out.customFields = { ...updates.customFields };
  if (updates.constraint !== undefined) out.constraint = toIntConstraint(updates.constraint);
  if (updates.constraint2 !== undefined) out.constraint2 = toIntConstraint(updates.constraint2);
  if (updates.isHammock !== undefined) out.isHammock = updates.isHammock;
  if (updates.externalLinks !== undefined) out.externalLinks = updates.externalLinks.map(toIntExternalLink);
  if (updates.deadline !== undefined) out.deadline = updates.deadline;
  if (updates.calendarId !== undefined) out.calendarId = updates.calendarId;
  if (updates.notes !== undefined) out.notes = updates.notes.map(copyNote);
  return out;
}

export function toExtSequence(s: Sequence): ExtSequence {
  return {
    id: s.id,
    predecessorId: s.predecessorId,
    successorId: s.successorId,
    type: s.type,
    lagDays: s.lagDays,
    lagMinutes: s.lagMinutes,
    lagUnit: s.lagUnit,
    lagPercent: s.lagPercent,
    p6StartAtPredecessorFinishBoundary: s.p6StartAtPredecessorFinishBoundary,
  };
}

export function fromExtSequence(s: ExtSequence): Sequence {
  return {
    id: s.id,
    predecessorId: s.predecessorId,
    successorId: s.successorId,
    type: s.type,
    lagDays: s.lagDays,
    lagMinutes: s.lagMinutes,
    lagUnit: s.lagUnit,
    lagPercent: s.lagPercent,
  };
}

export function fromExtSequenceInput(seq: Omit<ExtSequence, 'id'>): Omit<Sequence, 'id'> {
  return {
    predecessorId: seq.predecessorId,
    successorId: seq.successorId,
    type: seq.type,
    lagDays: seq.lagDays,
    lagMinutes: seq.lagMinutes,
    lagUnit: seq.lagUnit,
    lagPercent: seq.lagPercent,
  };
}

export function toExtResource(r: Resource): ExtResource {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description,
    color: r.color,
    costPerHour: r.costPerHour,
    maxUnits: r.maxUnits,
    calendarId: r.calendarId,
    availabilitySteps: r.availabilitySteps ? r.availabilitySteps.map(copyAvailStep) : undefined,
    unitOfMeasure: r.unitOfMeasure,
    parentId: r.parentId,
  };
}

export function fromExtResource(r: ExtResource): Resource {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description,
    color: r.color,
    costPerHour: r.costPerHour,
    maxUnits: r.maxUnits,
    calendarId: r.calendarId,
    availabilitySteps: r.availabilitySteps ? r.availabilitySteps.map(toIntAvailStep) : undefined,
    unitOfMeasure: r.unitOfMeasure,
    parentId: r.parentId,
  };
}

export function toExtAssignment(a: ResourceAssignment): ExtAssignment {
  return {
    id: a.id,
    taskId: a.taskId,
    resourceId: a.resourceId,
    unitsPerDay: a.unitsPerDay,
    curve: a.curve,
    workWindowStart: a.workWindowStart,
    workWindowFinish: a.workWindowFinish,
    curveValues: a.curveValues ? [...a.curveValues] : undefined,
    plannedWorkMinutes: a.plannedWorkMinutes,
    actualWorkMinutes: a.actualWorkMinutes,
    remainingWorkMinutes: a.remainingWorkMinutes,
    costAmount: a.costAmount,
  };
}

export function fromExtAssignment(a: ExtAssignment): ResourceAssignment {
  return {
    id: a.id,
    taskId: a.taskId,
    resourceId: a.resourceId,
    unitsPerDay: a.unitsPerDay,
    curve: a.curve,
    workWindowStart: a.workWindowStart,
    workWindowFinish: a.workWindowFinish,
    curveValues: a.curveValues ? [...a.curveValues] : undefined,
    plannedWorkMinutes: a.plannedWorkMinutes,
    actualWorkMinutes: a.actualWorkMinutes,
    remainingWorkMinutes: a.remainingWorkMinutes,
    costAmount: a.costAmount,
  };
}

export function fromExtImportResult(r: ExtImportResult): ImportResult {
  const catalog = new Map<string, { id: string; name: string }>();
  const names = new Map<string, string>();
  const addType = (raw: { id: string; name: string }, source: string) => {
    const type = { id: raw.id.trim(), name: raw.name.trim() };
    if (!type.id || !type.name) throw new Error(`${source}: customTaskType vereist een niet-lege id en naam`);
    const byId = catalog.get(type.id);
    if (byId && byId.name !== type.name) throw new Error(`${source}: customTaskType-id '${type.id}' heeft conflicterende namen`);
    const nameKey = type.name.toLocaleLowerCase();
    const byName = names.get(nameKey);
    if (byName && byName !== type.id) throw new Error(`${source}: customTaskType-naam '${type.name}' heeft conflicterende ids`);
    catalog.set(type.id, type);
    names.set(nameKey, type.id);
  };
  for (const type of r.customTaskTypes ?? []) addType(type, 'ExtImportResult.customTaskTypes');
  for (const task of r.tasks) {
    if (task.customTaskType?.name) addType(
      { id: task.customTaskType.id, name: task.customTaskType.name },
      `ExtImportResult.tasks['${task.id}']`,
    );
  }
  return {
    project: fromExtProject(r.project),
    calendar: fromExtCalendar(r.calendar),
    tasks: r.tasks.map(fromExtTask),
    sequences: r.sequences.map(fromExtSequence),
    resources: r.resources.map(fromExtResource),
    assignments: r.assignments.map(fromExtAssignment),
    customTaskTypes: withTaskTypeColors([...catalog.values()]),
  };
}

const RIBBON_TAB_MAP: Record<ExtRibbonTab, RibbonTab> = {
  file: 'file',
  start: 'start',
  planning: 'planning',
  resources: 'resources',
  relations: 'table',
  beeld: 'beeld',
  instellingen: 'instellingen',
  table: 'table',
  ifc: 'ifc',
  report: 'report',
  ai: 'ai',
};

export function fromExtRibbonTab(tab: ExtRibbonTab): RibbonTab {
  return RIBBON_TAB_MAP[tab];
}

export function fromExtFontProvider(p: ExtFontProvider): CjkFontProvider {
  const out: CjkFontProvider = {
    id: p.id,
    covers: (codepoint: number) => p.covers(codepoint),
    getRegularBytes: () => p.getRegularBytes(),
  };
  if (p.getBoldBytes) {
    const bold = p.getBoldBytes.bind(p);
    out.getBoldBytes = () => bold();
  }
  return out;
}
