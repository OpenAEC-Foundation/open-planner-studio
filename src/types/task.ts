import type { CustomFieldValue } from '@/types/structure';
export type { CustomTaskType } from '@/types/taskType';

export type TaskType =
  | 'CONSTRUCTION'
  | 'INSTALLATION'
  | 'DEMOLITION'
  | 'LOGISTIC'
  | 'ATTENDANCE'
  | 'MOVE'
  | 'RENOVATION'
  | 'MAINTENANCE'
  | 'USERDEFINED';

const TASK_TYPE_TABLE = {
  CONSTRUCTION: true,
  INSTALLATION: true,
  DEMOLITION: true,
  LOGISTIC: true,
  ATTENDANCE: true,
  MOVE: true,
  RENOVATION: true,
  MAINTENANCE: true,
  USERDEFINED: true,
} satisfies Record<TaskType, true>;

export const TASK_TYPES = Object.keys(TASK_TYPE_TABLE) as TaskType[];

export type TaskStatus = 'NOT_STARTED' | 'STARTED' | 'COMPLETED';

export type ConstraintType = 'ASAP' | 'ALAP' | 'SNET' | 'SNLT' | 'FNET' | 'FNLT' | 'MSO' | 'MFO';

export interface TaskConstraint {
  type: ConstraintType;
  date?: string;
  hard?: boolean;
}

export interface ExternalLink {
  id: string;
  direction: 'predecessor' | 'successor';
  relType: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays?: number;
  lagMinutes?: number;
  anchorDate: string;
  sourceRef: { projectId: string; projectName?: string; taskId: string; taskName?: string; filePath?: string; siteFileId?: string };
  sourceMissing: boolean;
  sourceVersion?: string;
  anchorReadAt?: string;
}

export type DurationType = 'WORKTIME' | 'ELAPSEDTIME';

export type TaskDurationUnit = 'days' | 'hours';

export interface TaskSplitGap {
  afterMinutes: number;
  gapMinutes: number;
  source?: 'leveling' | 'user';
}

export interface TimephasedContourPeriod {
  afterMinutes: number;
  minutes: number;
  workMinutes: number;
  kind: 'actual' | 'remaining';
}

export interface TaskTimephasedContour {
  resourceUid: number | null;
  resourceId?: string;
  periods: TimephasedContourPeriod[];
}

export type MspTaskType = 'FIXED_UNITS' | 'FIXED_DURATION' | 'FIXED_WORK';

export type { WorkRule } from '@/types/workRule';

export type P6DurationType = 'DT_FixedDrtn' | 'DT_FixedDUR2' | 'DT_FixedRate' | 'DT_FixedQty';

export type P6CompletePctType = 'CP_Drtn' | 'CP_Phys' | 'CP_Units';

export type P6ActivityType = 'TT_Task' | 'TT_Rsrc' | 'TT_LOE' | 'TT_Mile' | 'TT_FinMile' | 'TT_WBS';

export type MilestoneKind = 'START' | 'FINISH';

export interface ProgressBeforeRecalculation {
  status: TaskStatus;
  completion: number;
  actualStart?: string;
  actualFinish?: string;
  remainingTime?: number;
  remainingMinutes?: number;
  splitGaps?: TaskSplitGap[];
}

export interface TaskTime {
  durationType: DurationType;
  durationUnit: TaskDurationUnit;
  scheduleDuration: number;
  durationMinutes?: number;
  scheduleStart: string;
  scheduleFinish: string;
  resume?: string;
  stop?: string;

  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  freeFloat: number;
  totalFloat: number;
  totalFloatMinutes?: number;
  freeFloatMinutes?: number;
  isCritical: boolean;
  interferingFloat?: number;
  isNearCritical?: boolean;
  floatPath?: number;

  actualStart?: string;
  actualFinish?: string;
  actualDuration?: number;
  remainingTime?: number;
  remainingMinutes?: number;
  completion: number;
  progressBeforeRecalculation?: ProgressBeforeRecalculation;
}

export type TaskTimeInput = Pick<
  TaskTime,
  'durationType' | 'durationUnit' | 'scheduleDuration' | 'durationMinutes' | 'scheduleStart' | 'scheduleFinish'
  | 'resume' | 'stop'
>;

export type TaskTimeComputed = Pick<
  TaskTime,
  'earlyStart' | 'earlyFinish' | 'lateStart' | 'lateFinish' | 'freeFloat' | 'totalFloat' | 'isCritical'
>;

export type TaskTimeAnalysis = Pick<
  TaskTime,
  'interferingFloat' | 'isNearCritical' | 'floatPath' | 'totalFloatMinutes' | 'freeFloatMinutes'
>;

export type TaskTimeTracking = Pick<
  TaskTime,
  'actualStart' | 'actualFinish' | 'actualDuration' | 'remainingTime' | 'remainingMinutes' | 'completion'
  | 'progressBeforeRecalculation'
>;

type _TaskTimeRoleKeys =
  | keyof TaskTimeInput
  | keyof TaskTimeComputed
  | keyof TaskTimeAnalysis
  | keyof TaskTimeTracking;

type _UncategorizedTaskTimeField = Exclude<keyof TaskTime, _TaskTimeRoleKeys>;

type _OverlappingRole =
  | (keyof TaskTimeInput & keyof TaskTimeComputed)
  | (keyof TaskTimeInput & keyof TaskTimeAnalysis)
  | (keyof TaskTimeInput & keyof TaskTimeTracking)
  | (keyof TaskTimeComputed & keyof TaskTimeAnalysis)
  | (keyof TaskTimeComputed & keyof TaskTimeTracking)
  | (keyof TaskTimeAnalysis & keyof TaskTimeTracking);

type _Expect<T extends true> = T;
type _IsNever<T> = [T] extends [never] ? true : false;
const _assertTaskTimeComplete: _Expect<_IsNever<_UncategorizedTaskTimeField>> = true;
const _assertTaskTimeDisjoint: _Expect<_IsNever<_OverlappingRole>> = true;
void _assertTaskTimeComplete;
void _assertTaskTimeDisjoint;

export interface Task {
  id: string;
  name: string;
  description: string;
  wbsCode: string;
  taskType: TaskType;
  customTaskTypeId?: string;
  status: TaskStatus;
  isMilestone: boolean;
  milestoneKind?: MilestoneKind;
  mandatory?: boolean;
  priority: number;
  levelingDelay?: number;
  levelingDelayMinutes?: number;
  levelingDelayElapsed?: boolean;
  splitGaps?: TaskSplitGap[];
  timephasedFinishFloor?: string;
  timephasedStartAnchor?: string;
  timephasedDurationWalks?: { anchor: string; resourceCalendarId: string; workMinutes?: number }[];
  timephasedContours?: TaskTimephasedContour[];
  manuallyScheduled?: boolean;
  mspTaskType?: MspTaskType;
  effortDriven?: boolean;
  workRule?: import('@/types/workRule').WorkRule;
  p6DurationType?: P6DurationType;
  p6ActivityType?: P6ActivityType;
  p6ProjectId?: string;
  p6TaskId?: string;
  p6ExplicitTargetWindow?: boolean;
  p6CompletePctType?: P6CompletePctType;
  p6ExpectedFinish?: string;
  p6SuspendResume?: boolean;
  isSummary?: boolean;
  parentId: string | null;
  childIds: string[];
  time: TaskTime;
  resourceIds: string[];
  color?: string;
  activityCodes?: Record<string, string>;
  customFields?: Record<string, CustomFieldValue>;
  constraint?: TaskConstraint;
  constraint2?: TaskConstraint;
  isHammock?: boolean;
  externalLinks?: ExternalLink[];
  deadline?: string;
  calendarId?: string;
  notes?: { id: string; text: string; done: boolean }[];
}

export type TaskNote = NonNullable<Task['notes']>[number];
export type TimephasedDurationWalk = NonNullable<Task['timephasedDurationWalks']>[number];
export type ExternalSourceRef = ExternalLink['sourceRef'];

