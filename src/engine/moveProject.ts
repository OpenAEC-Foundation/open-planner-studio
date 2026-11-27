import type { Project } from '@/types/project';
import type { Task, TaskTime, TaskConstraint, ExternalLink } from '@/types/task';
import type { Resource, AvailabilityStep } from '@/types/resource';
import type { Baseline, BaselineTask } from '@/types/baseline';
import type { WorkCalendar } from '@/types/calendar';
import type { CustomFieldDef } from '@/types/structure';
import {
  parseInstant, formatInstant, addCalendarDays, diffDays, parseDate, type DateMode,
} from '@/utils/dateUtils';
import { reconcileP6SuspendResume } from '@/utils/p6SuspendResume';
import { isSummaryProgressDerived } from '@/engine/scheduler/summaryProgress';

type MoveVerdict = 'shift' | 'keep' | 'derived' | 'n/a';

const TASK_TIME_VERDICTS = {
  durationType: 'n/a',
  durationUnit: 'n/a',
  scheduleDuration: 'n/a',
  durationMinutes: 'n/a',
  scheduleStart: 'shift',
  scheduleFinish: 'shift',
  earlyStart: 'derived',
  earlyFinish: 'derived',
  lateStart: 'derived',
  lateFinish: 'derived',
  freeFloat: 'derived',
  totalFloat: 'derived',
  totalFloatMinutes: 'derived',
  freeFloatMinutes: 'derived',
  isCritical: 'derived',
  interferingFloat: 'derived',
  isNearCritical: 'derived',
  floatPath: 'derived',
  actualStart: 'shift',
  actualFinish: 'shift',
  resume: 'shift',
  stop: 'shift',
  actualDuration: 'n/a',
  remainingTime: 'n/a',
  remainingMinutes: 'n/a',
  completion: 'n/a',
  progressBeforeRecalculation: 'shift',
} satisfies Record<keyof TaskTime, MoveVerdict>;

const TASK_VERDICTS = {
  id: 'n/a', name: 'n/a', description: 'n/a', wbsCode: 'n/a', taskType: 'n/a', customTaskTypeId: 'n/a', status: 'n/a',
  isMilestone: 'n/a', milestoneKind: 'n/a', mandatory: 'n/a', priority: 'n/a',
  levelingDelay: 'n/a',
  levelingDelayMinutes: 'n/a',
  levelingDelayElapsed: 'n/a',
  splitGaps: 'n/a',
  manuallyScheduled: 'n/a',
  timephasedFinishFloor: 'shift',
  timephasedStartAnchor: 'shift',
  timephasedDurationWalks: 'shift',
  timephasedContours: 'n/a',
  mspTaskType: 'n/a',
  effortDriven: 'n/a',
  workRule: 'n/a',
  p6DurationType: 'n/a',
  p6ActivityType: 'n/a',
  p6ProjectId: 'n/a', p6TaskId: 'n/a', p6ExplicitTargetWindow: 'n/a', p6CompletePctType: 'n/a',
  p6ExpectedFinish: 'shift',
  p6SuspendResume: 'n/a',
  parentId: 'n/a', childIds: 'n/a', isSummary: 'n/a',
  time: 'shift',
  resourceIds: 'n/a', color: 'n/a', activityCodes: 'n/a',
  customFields: 'keep',
  constraint: 'shift',
  constraint2: 'shift',
  isHammock: 'n/a',
  externalLinks: 'keep',
  deadline: 'shift',
  calendarId: 'n/a',
  notes: 'n/a',
} satisfies Record<keyof Task, MoveVerdict>;

const TASK_CONSTRAINT_VERDICTS = {
  type: 'n/a',
  date: 'shift',
  hard: 'n/a',
} satisfies Record<keyof TaskConstraint, MoveVerdict>;

const EXTERNAL_LINK_VERDICTS = {
  id: 'n/a', direction: 'n/a', relType: 'n/a',
  lagDays: 'n/a', lagMinutes: 'n/a',
  anchorDate: 'keep',
  sourceRef: 'n/a',
  sourceMissing: 'n/a',
  sourceVersion: 'keep',
  anchorReadAt: 'keep',
} satisfies Record<keyof ExternalLink, MoveVerdict>;

const PROJECT_VERDICTS = {
  id: 'n/a', name: 'n/a', description: 'n/a',
  startDate: 'shift',
  endDate: 'shift',
  calendarId: 'n/a',
  createdAt: 'keep',
  modifiedAt: 'keep',
  author: 'n/a', company: 'n/a', wbsAutoNumber: 'n/a',
  statusDate: 'shift',
  progressMode: 'n/a', schedulingOptions: 'n/a', schedulingProfile: 'n/a',
  defaultTaskDurationUnit: 'n/a',
  defaultWorkRule: 'n/a',
  companyId: 'n/a', companyName: 'n/a',
  ifcSchema: 'n/a',
  ifcSchemaUnconfirmed: 'n/a',
  p6ProjectCode: 'n/a',
  dependentProjectsFolder: 'n/a',
  anchorsFromOpenDocuments: 'n/a',
} satisfies Record<keyof Project, MoveVerdict>;

const RESOURCE_VERDICTS = {
  id: 'n/a', name: 'n/a', type: 'n/a', description: 'n/a', costPerHour: 'n/a',
  availability: 'n/a', maxUnits: 'n/a', calendarId: 'n/a',
  availabilitySteps: 'shift',
  unitOfMeasure: 'n/a', parentId: 'n/a',
  color: 'n/a',
  libraryOrigin: 'n/a',
} satisfies Record<keyof Resource, MoveVerdict>;

const AVAILABILITY_STEP_VERDICTS = {
  from: 'shift',
  maxUnits: 'n/a',
} satisfies Record<keyof AvailabilityStep, MoveVerdict>;

const BASELINE_VERDICTS = {
  id: 'n/a', name: 'n/a',
  sourceProjectId: 'n/a',
  createdAt: 'keep',
  tasks: 'shift',
  projectEnd: 'shift',
  projectDuration: 'n/a',
} satisfies Record<keyof Baseline, MoveVerdict>;

const BASELINE_TASK_VERDICTS = {
  taskId: 'n/a', sourceTaskId: 'n/a', sourceTaskCode: 'n/a',
  start: 'shift', finish: 'shift',
  duration: 'n/a', isMilestone: 'n/a', milestoneKind: 'n/a',
} satisfies Record<keyof BaselineTask, MoveVerdict>;

void TASK_TIME_VERDICTS; void TASK_VERDICTS; void TASK_CONSTRAINT_VERDICTS;
void EXTERNAL_LINK_VERDICTS; void PROJECT_VERDICTS; void RESOURCE_VERDICTS;
void AVAILABILITY_STEP_VERDICTS; void BASELINE_VERDICTS; void BASELINE_TASK_VERDICTS;

export interface MoveProjectOptions {
  shiftBaselines?: boolean;
}

export function shiftIso(iso: string, deltaDays: number): string;
export function shiftIso(iso: string | undefined, deltaDays: number): string | undefined;
export function shiftIso(iso: string | undefined, deltaDays: number): string | undefined {
  if (!iso) return iso;
  if (!Number.isFinite(deltaDays) || deltaDays === 0) return iso;
  const mode: DateMode = iso.includes('T') ? 'hour' : 'day';
  const d = parseInstant(iso);
  if (isNaN(d.getTime())) return iso;
  return formatInstant(addCalendarDays(d, deltaDays), mode);
}

export function computeMoveDelta(currentStart: string | undefined, newStart: string | undefined): number {
  if (!currentStart || !newStart) return NaN;
  const d = diffDays(currentStart, newStart);
  return Number.isFinite(d) ? d : NaN;
}

function isUsableIso(iso: string | undefined): iso is string {
  return !!iso && !isNaN(parseInstant(iso).getTime());
}

function shiftConstraint(c: TaskConstraint | undefined, delta: number): TaskConstraint | undefined {
  if (!c) return c;
  if (c.date === undefined) return { ...c };
  return { ...c, date: shiftIso(c.date, delta) };
}

export function shiftTask(task: Task, delta: number): Task {
  const t = task.time;
  const next: Task = {
    ...task,
    time: {
      ...t,
      scheduleStart: shiftIso(t.scheduleStart, delta),
      scheduleFinish: shiftIso(t.scheduleFinish, delta),
      actualStart: shiftIso(t.actualStart, delta),
      actualFinish: shiftIso(t.actualFinish, delta),
      resume: shiftIso(t.resume, delta),
      stop: shiftIso(t.stop, delta),
      ...(t.progressBeforeRecalculation && { progressBeforeRecalculation: {
        ...t.progressBeforeRecalculation,
        actualStart: shiftIso(t.progressBeforeRecalculation.actualStart, delta),
        actualFinish: shiftIso(t.progressBeforeRecalculation.actualFinish, delta),
      } }),
    },
  };
  if (task.constraint) next.constraint = shiftConstraint(task.constraint, delta);
  if (task.constraint2) next.constraint2 = shiftConstraint(task.constraint2, delta);
  if (task.deadline !== undefined) next.deadline = shiftIso(task.deadline, delta);
  if (task.p6ExpectedFinish !== undefined) {
    next.p6ExpectedFinish = shiftIso(task.p6ExpectedFinish, delta);
  }
  if (task.timephasedFinishFloor !== undefined) {
    next.timephasedFinishFloor = shiftIso(task.timephasedFinishFloor, delta);
  }
  if (task.timephasedStartAnchor !== undefined) {
    next.timephasedStartAnchor = shiftIso(task.timephasedStartAnchor, delta);
  }
  if (task.timephasedDurationWalks) {
    next.timephasedDurationWalks = task.timephasedDurationWalks.map((w) => ({
      ...w, anchor: shiftIso(w.anchor, delta),
    }));
  }
  reconcileP6SuspendResume(next);
  return next;
}

export function shiftProjectDates(project: Project, delta: number): Project {
  const next: Project = {
    ...project,
    startDate: shiftIso(project.startDate, delta),
    endDate: shiftIso(project.endDate, delta),
  };
  if (project.statusDate !== undefined) next.statusDate = shiftIso(project.statusDate, delta);
  return next;
}

export function shiftResource(resource: Resource, delta: number): Resource {
  if (!resource.availabilitySteps?.length) return { ...resource };
  return {
    ...resource,
    availabilitySteps: resource.availabilitySteps.map((s) => ({ ...s, from: shiftIso(s.from, delta) })),
  };
}

export function shiftBaseline(baseline: Baseline, delta: number): Baseline {
  return {
    ...baseline,
    projectEnd: shiftIso(baseline.projectEnd, delta),
    tasks: baseline.tasks.map((bt) => ({
      ...bt,
      start: shiftIso(bt.start, delta),
      finish: shiftIso(bt.finish, delta),
    })),
  };
}

export interface MoveImpact {
  taskCount: number;
  constraintCount: number;
  hardPinCount: number;
  deadlineCount: number;
  actualCount: number;
  externalLinkCount: number;
  availabilityStepCount: number;
  dateCustomFieldCount: number;
  baselineCount: number;
}

export function computeMoveImpact(
  tasks: Task[],
  resources: Resource[],
  baselines: Baseline[],
  customFieldDefs: CustomFieldDef[],
): MoveImpact {
  const dateDefIds = new Set(customFieldDefs.filter((d) => d.type === 'date').map((d) => d.id));
  const impact: MoveImpact = {
    taskCount: 0, constraintCount: 0, hardPinCount: 0, deadlineCount: 0, actualCount: 0,
    externalLinkCount: 0, availabilityStepCount: 0, dateCustomFieldCount: 0,
    baselineCount: baselines.length,
  };
  for (const t of tasks) {
    const hasConstraintDate = isUsableIso(t.constraint?.date) || isUsableIso(t.constraint2?.date);
    const hasDeadline = isUsableIso(t.deadline);
    const hasActual = !isSummaryProgressDerived(t)
      && (isUsableIso(t.time.actualStart) || isUsableIso(t.time.actualFinish));
    const links = t.externalLinks?.filter((l) => isUsableIso(l.anchorDate)) ?? [];
    if (
      isUsableIso(t.time.scheduleStart) || isUsableIso(t.time.scheduleFinish) ||
      hasConstraintDate || hasDeadline || hasActual
    ) impact.taskCount++;
    if (hasConstraintDate) impact.constraintCount++;
    if (t.constraint?.hard === true) impact.hardPinCount++;
    if (hasDeadline) impact.deadlineCount++;
    if (hasActual) impact.actualCount++;
    impact.externalLinkCount += links.length;
    for (const defId of dateDefIds) {
      const v = t.customFields?.[defId];
      if (v !== undefined && v !== null && v !== '') impact.dateCustomFieldCount++;
    }
  }
  for (const r of resources) {
    impact.availabilityStepCount += r.availabilitySteps?.length ?? 0;
  }
  return impact;
}

export interface HolidayGapCalendar {
  name: string;
  from: number;
  to: number;
  year: number;
}

export function computeHolidayGaps(
  calendars: WorkCalendar[],
  newStartIso: string,
  newEndIso: string,
): HolidayGapCalendar[] {
  const yearOf = (iso: string): number | null => {
    if (!iso) return null;
    const d = parseDate(iso);
    return isNaN(d.getTime()) ? null : d.getUTCFullYear();
  };
  const startYear = yearOf(newStartIso);
  const endYear = yearOf(newEndIso) ?? startYear;
  if (startYear === null || endYear === null) return [];

  const seen = new Set<string>();
  const gaps: HolidayGapCalendar[] = [];
  for (const cal of calendars) {
    if (!cal?.generation) continue;
    if (seen.has(cal.id)) continue;
    seen.add(cal.id);
    const { generatedFromYear: from, generatedToYear: to } = cal.generation;
    if (endYear > to) gaps.push({ name: cal.name, from, to, year: endYear });
    else if (startYear < from) gaps.push({ name: cal.name, from, to, year: startYear });
  }
  return gaps;
}
