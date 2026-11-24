export type ProgressMode = 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE';

export interface LevelingPriorityKey {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface LevelingResourceSetting {
  resourceId: string;
  maxUnitsPerHour?: number;
}

export interface LevelingSettings {
  preserveScheduledDates?: boolean;
  levelAllResources?: boolean;
  priority?: LevelingPriorityKey[];
  resources?: LevelingResourceSetting[];
}

export interface SchedulingOptions {
  milestoneWithoutPredecessorAtDayEnd?: boolean;
  lagCalendar?: 'predecessor' | 'successor' | '24hour' | 'projectDefault';
  criticalDefinition?: {
    mode: 'totalFloat' | 'longestPath';
    threshold?: number;
    thresholdHours?: number;
  };
  totalFloatMode?: 'start' | 'finish' | 'smallest';
  makeOpenEndedCritical?: boolean;
  useExpectedFinishDates?: boolean;
  preserveActualDatesInBackwardPass?: boolean;
  clampNegativeFreeFloat?: boolean;
  p6ZeroDurationUsesPlannedBoundary?: boolean;
  p6UseTaskPlannedStartFloor?: boolean;
  p6FinishMilestoneBoundaryWindow?: boolean;
  p6PreserveActualInstants?: boolean;
  p6UseRemainingStartForProgress?: boolean;
  p6PreserveZeroDurationConstraintInstants?: boolean;
  useProjectEndDateForFloat?: boolean;
  nearCriticalThreshold?: number;
  floatPaths?: { enabled: boolean; method: 'FREE_FLOAT' | 'TOTAL_FLOAT'; maxPaths: number };
  resumeFromActualElapsed?: boolean;
  unstartedIgnoresStatusDate?: boolean;
  p6CompletedLateFromRemainingWindow?: boolean;
  startToStartLagFrom?: 'earlyStart' | 'actualStart';
  leveling?: LevelingSettings;

  p6RelationFinishBoundary?: boolean;
  p6BackwardLagFinishBoundary?: boolean;
  p6CompletedDataDateWindow?: boolean;
  p6CompletedLoeActualFinish?: boolean;
  p6OpenLoeTargetSpan?: boolean;

  p6CompletedPredecessorAtDataDate?: boolean;
  p6FreeFloatOnOwnCalendar?: boolean;
  p6CompletedRemainingLag?: boolean;
  p6CompletedOutOfSequenceWindow?: boolean;
  p6CompletedPhysicalAtDataDate?: boolean;
  p6InProgressStartLagElapsed?: boolean;
  p6FinishFinishStartMilestoneLateFinish?: boolean;
  p6StartedTaskIgnoresPlannedStartFloor?: boolean;
  p6LateFinishOnOwnCalendar?: boolean;
  p6ProgressOverrideIgnoresStartedSuccessor?: boolean;
  p6FinishNotBeforeFinishFinishBound?: boolean;
  p6AlapPositionedFromSuccessors?: boolean;
  workdayDurationMeasure?: boolean;
}

export type ConventionKey =
  | 'milestoneWithoutPredecessorAtDayEnd'
  | 'preserveActualDatesInBackwardPass'
  | 'clampNegativeFreeFloat'
  | 'p6ZeroDurationUsesPlannedBoundary'
  | 'p6UseTaskPlannedStartFloor'
  | 'p6FinishMilestoneBoundaryWindow'
  | 'p6PreserveActualInstants'
  | 'p6PreserveZeroDurationConstraintInstants'
  | 'p6UseRemainingStartForProgress'
  | 'resumeFromActualElapsed'
  | 'unstartedIgnoresStatusDate'
  | 'p6RelationFinishBoundary'
  | 'p6BackwardLagFinishBoundary'
  | 'p6CompletedDataDateWindow'
  | 'p6CompletedLoeActualFinish'
  | 'p6OpenLoeTargetSpan'
  | 'p6CompletedPredecessorAtDataDate'
  | 'p6FreeFloatOnOwnCalendar'
  | 'p6CompletedRemainingLag'
  | 'p6CompletedOutOfSequenceWindow'
  | 'p6CompletedPhysicalAtDataDate'
  | 'p6InProgressStartLagElapsed'
  | 'p6FinishFinishStartMilestoneLateFinish'
  | 'p6StartedTaskIgnoresPlannedStartFloor'
  | 'p6LateFinishOnOwnCalendar'
  | 'p6ProgressOverrideIgnoresStartedSuccessor'
  | 'p6FinishNotBeforeFinishFinishBound'
  | 'p6AlapPositionedFromSuccessors'
  | 'workdayDurationMeasure';

export type ProjectOptionKey = Exclude<keyof SchedulingOptions, ConventionKey>;

export type ProjectSchedulingOptions = Pick<SchedulingOptions, ProjectOptionKey>;

export type SchedulingConventions = Required<Pick<SchedulingOptions, ConventionKey>>;

export type LegacySchedulingOptions = SchedulingOptions & { p6Source?: 'XER' };

export type EffectiveSchedulingOptions = ProjectSchedulingOptions & SchedulingConventions;

export type BuiltInProfileId = 'p6' | 'msproject' | 'ops';

export interface SchedulingProfile {
  baseId: BuiltInProfileId;
  id: string;
  name: string;
  overrides: Partial<SchedulingConventions>;
}

export const IFC_SCHEMAS = ['IFC4X3_ADD2', 'IFC4X3', 'IFC4'] as const;
export type IfcSchemaId = typeof IFC_SCHEMAS[number];
export const DEFAULT_IFC_SCHEMA: IfcSchemaId = 'IFC4X3_ADD2';

export function isIfcSchemaId(value: unknown): value is IfcSchemaId {
  return typeof value === 'string' && (IFC_SCHEMAS as readonly string[]).includes(value);
}

export function projectIfcSchema(project: Pick<Project, 'ifcSchema'>): IfcSchemaId {
  return isIfcSchemaId(project.ifcSchema) ? project.ifcSchema : DEFAULT_IFC_SCHEMA;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  calendarId: string;
  createdAt: string;
  modifiedAt: string;
  author: string;
  company: string;
  defaultTaskDurationUnit?: import('@/types/task').TaskDurationUnit;
  defaultWorkRule?: import('@/types/workRule').WorkRule;
  wbsAutoNumber?: boolean;
  statusDate?: string;
  progressMode?: ProgressMode;
  schedulingOptions?: ProjectSchedulingOptions;
  schedulingProfile?: SchedulingProfile;
  companyId?: string;
  companyName?: string;
  ifcSchema?: IfcSchemaId;
  ifcSchemaUnconfirmed?: string;
  p6ProjectCode?: string;
  dependentProjectsFolder?: string;
  anchorsFromOpenDocuments?: boolean;
}

export interface ProjectStats {
  totalTasks: number;
  totalMilestones: number;
  criticalPathLength: number;
  totalFloat: number;
  percentComplete: number;
}
