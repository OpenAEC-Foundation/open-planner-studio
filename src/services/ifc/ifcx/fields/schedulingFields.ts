import type {
  BuiltInProfileId, ConventionKey, LevelingSettings, Project, ProjectOptionKey, SchedulingOptions,
} from '@/types/project';
import { arrayOf, BOOLEAN, objectOf, REAL, TEXT, type IfcxField, type IfcxMember } from '../fieldTable';
import { enumOfTable, optional, passthroughField, required } from './passthroughFields';
import type { DocumentReadTarget, DocumentWriteSource } from './documentFields';

type DocumentField = IfcxField<DocumentWriteSource, DocumentReadTarget>;
type Choice<K extends keyof SchedulingOptions> = Extract<NonNullable<SchedulingOptions[K]>, string>;

const LAG_CALENDARS = { predecessor: true, successor: true, '24hour': true, projectDefault: true } satisfies Record<Choice<'lagCalendar'>, true>;
const TOTAL_FLOAT_MODES = { start: true, finish: true, smallest: true } satisfies Record<Choice<'totalFloatMode'>, true>;
const START_TO_START_LAG_FROM = { earlyStart: true, actualStart: true } satisfies Record<Choice<'startToStartLagFrom'>, true>;
const CRITICAL_MODES = { totalFloat: true, longestPath: true } satisfies Record<NonNullable<SchedulingOptions['criticalDefinition']>['mode'], true>;
const FLOAT_PATH_METHODS = { FREE_FLOAT: true, TOTAL_FLOAT: true } satisfies Record<NonNullable<SchedulingOptions['floatPaths']>['method'], true>;
const LEVELING_DIRECTIONS = { ASC: true, DESC: true } satisfies Record<NonNullable<LevelingSettings['priority']>[number]['direction'], true>;
const BUILT_IN_PROFILES = { p6: true, msproject: true, ops: true } satisfies Record<BuiltInProfileId, true>;

const LEVELING = objectOf({
  preserveScheduledDates: optional(BOOLEAN),
  levelAllResources: optional(BOOLEAN),
  priority: optional(arrayOf(objectOf({ field: required(TEXT), direction: required(enumOfTable(LEVELING_DIRECTIONS)) }))),
  resources: optional(arrayOf(objectOf({ resourceId: required(TEXT), maxUnitsPerHour: optional(REAL) }))),
} satisfies Record<keyof LevelingSettings, IfcxMember>);

const PROJECT_OPTIONS = objectOf({
  lagCalendar: optional(enumOfTable(LAG_CALENDARS)),
  criticalDefinition: optional(objectOf({
    mode: required(enumOfTable(CRITICAL_MODES)), threshold: optional(REAL), thresholdHours: optional(REAL),
  })),
  totalFloatMode: optional(enumOfTable(TOTAL_FLOAT_MODES)),
  makeOpenEndedCritical: optional(BOOLEAN),
  useExpectedFinishDates: optional(BOOLEAN),
  useProjectEndDateForFloat: optional(BOOLEAN),
  nearCriticalThreshold: optional(REAL),
  floatPaths: optional(objectOf({
    enabled: required(BOOLEAN), method: required(enumOfTable(FLOAT_PATH_METHODS)), maxPaths: required(REAL),
  })),
  p6CompletedLateFromRemainingWindow: optional(BOOLEAN),
  startToStartLagFrom: optional(enumOfTable(START_TO_START_LAG_FROM)),
  leveling: optional(LEVELING),
} satisfies Record<ProjectOptionKey, IfcxMember>);

const CONVENTION_OVERRIDES = {
  milestoneWithoutPredecessorAtDayEnd: optional(BOOLEAN),
  preserveActualDatesInBackwardPass: optional(BOOLEAN),
  clampNegativeFreeFloat: optional(BOOLEAN),
  p6ZeroDurationUsesPlannedBoundary: optional(BOOLEAN),
  p6UseTaskPlannedStartFloor: optional(BOOLEAN),
  p6FinishMilestoneBoundaryWindow: optional(BOOLEAN),
  p6PreserveActualInstants: optional(BOOLEAN),
  p6PreserveZeroDurationConstraintInstants: optional(BOOLEAN),
  p6UseRemainingStartForProgress: optional(BOOLEAN),
  resumeFromActualElapsed: optional(BOOLEAN),
  unstartedIgnoresStatusDate: optional(BOOLEAN),
  p6RelationFinishBoundary: optional(BOOLEAN),
  p6BackwardLagFinishBoundary: optional(BOOLEAN),
  p6CompletedDataDateWindow: optional(BOOLEAN),
  p6CompletedLoeActualFinish: optional(BOOLEAN),
  p6OpenLoeTargetSpan: optional(BOOLEAN),
  p6CompletedPredecessorAtDataDate: optional(BOOLEAN),
  p6FreeFloatOnOwnCalendar: optional(BOOLEAN),
  p6CompletedRemainingLag: optional(BOOLEAN),
  p6CompletedOutOfSequenceWindow: optional(BOOLEAN),
  p6CompletedPhysicalAtDataDate: optional(BOOLEAN),
  p6InProgressStartLagElapsed: optional(BOOLEAN),
  p6FinishFinishStartMilestoneLateFinish: optional(BOOLEAN),
  p6StartedTaskIgnoresPlannedStartFloor: optional(BOOLEAN),
  p6LateFinishOnOwnCalendar: optional(BOOLEAN),
  p6ProgressOverrideIgnoresStartedSuccessor: optional(BOOLEAN),
  p6FinishNotBeforeFinishFinishBound: optional(BOOLEAN),
  p6AlapPositionedFromSuccessors: optional(BOOLEAN),
  workdayDurationMeasure: optional(BOOLEAN),
} satisfies Record<ConventionKey, IfcxMember>;

const PROFILE = objectOf({
  baseId: required(enumOfTable(BUILT_IN_PROFILES)),
  id: required(TEXT),
  name: required(TEXT),
  overrides: required(objectOf(CONVENTION_OVERRIDES)),
} satisfies Record<keyof NonNullable<Project['schedulingProfile']>, IfcxMember>);

export const SCHEDULING_FIELDS: readonly DocumentField[] = [
  passthroughField<DocumentWriteSource, DocumentReadTarget, Project['schedulingOptions']>(
    'schedulingOptions', PROJECT_OPTIONS, source => source.project.schedulingOptions,
    (target, stored) => { target.project.schedulingOptions = stored; },
  ),
  passthroughField<DocumentWriteSource, DocumentReadTarget, Project['schedulingProfile']>(
    'schedulingProfile', PROFILE, source => source.project.schedulingProfile,
    (target, stored) => { target.project.schedulingProfile = stored; },
  ),
];

export const SCHEDULING_KEYS_CARRIED: readonly (keyof Project)[] = ['schedulingOptions', 'schedulingProfile'];
