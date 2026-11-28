import type {
  BuiltInProfileId, ConventionKey, EffectiveSchedulingOptions, Project, ProjectOptionKey, ProjectSchedulingOptions, SchedulingConventions, SchedulingProfile,
} from '@/types/project';

export const BUILT_IN_PROFILE_IDS = ['p6', 'msproject', 'ops'] as const satisfies readonly BuiltInProfileId[];

export type ConventionTheme = 'completedWork' | 'relationsLag' | 'milestones' | 'float' | 'instants' | 'msproject' | 'durations';
export const CONVENTION_THEMES = [
  'completedWork', 'relationsLag', 'milestones', 'float', 'instants', 'msproject', 'durations',
] as const satisfies readonly ConventionTheme[];

export interface ConventionDescriptor {
  id: ConventionKey;
  kind: 'boolean';
  builtIn: Record<BuiltInProfileId, boolean>;
  group: 'A' | 'B' | 'C';
  theme: ConventionTheme;
  legacyValue: boolean;
  legacyFromBase?: true;
  gatedByP6Source: boolean;
  labelKey: string;
  since: string;
  requires?: ConventionRequires;
}

export interface ConventionRequires {
  hourPlanning?: true;
  xerOrigin?: true;
}

const HOUR = { hourPlanning: true } as const;
const XER = { xerOrigin: true } as const;
const HOUR_XER = { hourPlanning: true, xerOrigin: true } as const;
const CONVENTION_REQUIRES: Partial<Record<ConventionKey, ConventionRequires>> = {
  p6ZeroDurationUsesPlannedBoundary: HOUR,
  p6PreserveActualInstants: XER,
  p6PreserveZeroDurationConstraintInstants: HOUR,
  p6RelationFinishBoundary: HOUR_XER,
  p6BackwardLagFinishBoundary: HOUR,
  p6CompletedDataDateWindow: XER,
  p6CompletedLoeActualFinish: XER,
  p6OpenLoeTargetSpan: HOUR_XER,
  p6CompletedPredecessorAtDataDate: HOUR,
  p6FreeFloatOnOwnCalendar: HOUR,
  p6CompletedRemainingLag: HOUR_XER,
  p6CompletedOutOfSequenceWindow: HOUR_XER,
  p6CompletedPhysicalAtDataDate: HOUR_XER,
  p6InProgressStartLagElapsed: HOUR,
  p6FinishFinishStartMilestoneLateFinish: HOUR,
  p6LateFinishOnOwnCalendar: HOUR,
  p6FinishNotBeforeFinishFinishBound: HOUR,
  p6AlapPositionedFromSuccessors: HOUR,
};

const SINCE_X12_BROK2 = '2026-09-23';
const SINCE_X12_BROK3 = '2026-09-23';
const SINCE_X12_BROK4 = '2026-09-23';
const SINCE_X12_BROK6 = '2026-09-23';
const SINCE_X12_BROK8 = '2026-09-23';
const SINCE_X12_BROK10 = '2026-09-24';

const P6_ONLY = { p6: true, msproject: false, ops: false } as const;
const MSP_ONLY = { p6: false, msproject: true, ops: false } as const;
const NONE = { p6: false, msproject: false, ops: false } as const;
const SINCE = '2026-09-22';

function convention(
  id: ConventionKey, group: 'A' | 'B' | 'C', theme: ConventionTheme, builtIn: Record<BuiltInProfileId, boolean>,
  gatedByP6Source: boolean, since = SINCE,
): ConventionDescriptor {
  const requires = CONVENTION_REQUIRES[id];
  return {
    id, kind: 'boolean', builtIn, group, theme, legacyValue: builtIn.ops, gatedByP6Source,
    labelKey: `conventions.${id}`, since, ...(requires ? { requires } : {}),
  };
}

export const CONVENTIONS: readonly ConventionDescriptor[] = [
  { ...convention('milestoneWithoutPredecessorAtDayEnd', 'C', 'milestones', { p6: false, msproject: false, ops: true }, false, '2026-10-23'), legacyFromBase: true },
  convention('preserveActualDatesInBackwardPass', 'A', 'completedWork', P6_ONLY, false),
  convention('clampNegativeFreeFloat', 'A', 'float', P6_ONLY, false),
  convention('p6ZeroDurationUsesPlannedBoundary', 'A', 'milestones', P6_ONLY, true),
  convention('p6UseTaskPlannedStartFloor', 'A', 'instants', P6_ONLY, true),
  convention('p6FinishMilestoneBoundaryWindow', 'A', 'milestones', NONE, true),
  convention('p6PreserveActualInstants', 'A', 'instants', P6_ONLY, true),
  convention('p6UseRemainingStartForProgress', 'A', 'completedWork', P6_ONLY, true),
  convention('p6PreserveZeroDurationConstraintInstants', 'A', 'instants', P6_ONLY, true),
  convention('resumeFromActualElapsed', 'A', 'msproject', MSP_ONLY, false),
  convention('unstartedIgnoresStatusDate', 'A', 'msproject', MSP_ONLY, false),
  convention('p6RelationFinishBoundary', 'B', 'relationsLag', P6_ONLY, true),
  convention('p6BackwardLagFinishBoundary', 'B', 'relationsLag', P6_ONLY, true),
  convention('p6CompletedDataDateWindow', 'B', 'completedWork', NONE, true),
  convention('p6CompletedLoeActualFinish', 'B', 'completedWork', NONE, true),
  convention('p6OpenLoeTargetSpan', 'B', 'milestones', P6_ONLY, true),
  convention('p6CompletedPredecessorAtDataDate', 'C', 'completedWork', NONE, false, SINCE_X12_BROK2),
  convention('p6FreeFloatOnOwnCalendar', 'C', 'float', P6_ONLY, false, SINCE_X12_BROK2),
  convention('p6CompletedRemainingLag', 'C', 'relationsLag', P6_ONLY, false, SINCE_X12_BROK2),
  convention('p6CompletedOutOfSequenceWindow', 'C', 'completedWork', NONE, false, SINCE_X12_BROK3),
  convention('p6CompletedPhysicalAtDataDate', 'C', 'completedWork', P6_ONLY, false, SINCE_X12_BROK3),
  convention('p6InProgressStartLagElapsed', 'C', 'relationsLag', P6_ONLY, false, SINCE_X12_BROK3),
  convention('p6FinishFinishStartMilestoneLateFinish', 'C', 'milestones', P6_ONLY, false, SINCE_X12_BROK4),
  convention('p6StartedTaskIgnoresPlannedStartFloor', 'C', 'completedWork', P6_ONLY, false, SINCE_X12_BROK4),
  convention('p6LateFinishOnOwnCalendar', 'C', 'float', P6_ONLY, false, SINCE_X12_BROK6),
  convention('p6ProgressOverrideIgnoresStartedSuccessor', 'C', 'completedWork', P6_ONLY, false, SINCE_X12_BROK8),
  convention('p6FinishNotBeforeFinishFinishBound', 'C', 'relationsLag', P6_ONLY, false, SINCE_X12_BROK8),
  convention('p6AlapPositionedFromSuccessors', 'C', 'float', P6_ONLY, false, SINCE_X12_BROK10),
  { ...convention('workdayDurationMeasure', 'C', 'durations', { p6: false, msproject: false, ops: true }, false, '2026-10-23'), legacyFromBase: true },
];

const _everyConventionNamed: Record<ConventionKey, true> = {
  milestoneWithoutPredecessorAtDayEnd: true,
  preserveActualDatesInBackwardPass: true, clampNegativeFreeFloat: true,
  p6ZeroDurationUsesPlannedBoundary: true, p6UseTaskPlannedStartFloor: true,
  p6FinishMilestoneBoundaryWindow: true, p6PreserveActualInstants: true,
  p6UseRemainingStartForProgress: true, p6PreserveZeroDurationConstraintInstants: true,
  resumeFromActualElapsed: true, unstartedIgnoresStatusDate: true,
  p6RelationFinishBoundary: true, p6BackwardLagFinishBoundary: true,
  p6CompletedDataDateWindow: true, p6CompletedLoeActualFinish: true, p6OpenLoeTargetSpan: true,
  p6CompletedPredecessorAtDataDate: true, p6FreeFloatOnOwnCalendar: true, p6CompletedRemainingLag: true,
  p6CompletedOutOfSequenceWindow: true, p6CompletedPhysicalAtDataDate: true, p6InProgressStartLagElapsed: true,
  p6FinishFinishStartMilestoneLateFinish: true, p6StartedTaskIgnoresPlannedStartFloor: true,
  p6LateFinishOnOwnCalendar: true, p6ProgressOverrideIgnoresStartedSuccessor: true,
  p6FinishNotBeforeFinishFinishBound: true, p6AlapPositionedFromSuccessors: true,
  workdayDurationMeasure: true,
};
export const CONVENTION_KEYS = Object.keys(_everyConventionNamed) as readonly ConventionKey[];
type Overlap = Extract<ProjectOptionKey, ConventionKey>;
const _disjoint: [Overlap] extends [never] ? true : Overlap = true;
void _disjoint;

export const isOffInEveryBuiltIn = (d: ConventionDescriptor): boolean =>
  BUILT_IN_PROFILE_IDS.every(id => !d.builtIn[id]);

const CONVENTION_KEY_SET: ReadonlySet<string> = new Set(CONVENTION_KEYS);
export const isConventionKey = (key: string): key is ConventionKey => CONVENTION_KEY_SET.has(key);
export const isBuiltInProfileId = (value: unknown): value is BuiltInProfileId =>
  typeof value === 'string' && (BUILT_IN_PROFILE_IDS as readonly string[]).includes(value);

export function conventionsFor(pick: (d: ConventionDescriptor) => boolean): SchedulingConventions {
  const out: Partial<SchedulingConventions> = {};
  for (const d of CONVENTIONS) out[d.id] = pick(d);
  return out as SchedulingConventions;
}

export function builtInConventions(baseId: BuiltInProfileId): SchedulingConventions {
  return conventionsFor(d => d.builtIn[baseId]);
}

export function legacyConventions(): SchedulingConventions {
  return conventionsFor(d => d.legacyValue);
}

export function builtInProfile(id: BuiltInProfileId): SchedulingProfile {
  return { baseId: id, id, name: '', overrides: {} };
}

export function displayNameKey(id: BuiltInProfileId): string {
  return `profiles.builtIn.${id}`;
}

export function resolveConventions(profile: SchedulingProfile | undefined): SchedulingConventions {
  const out = builtInConventions(profile?.baseId ?? 'ops');
  const overrides = profile?.overrides;
  if (overrides) {
    for (const key of CONVENTION_KEYS) {
      const value = overrides[key];
      if (typeof value === 'boolean') out[key] = value;
    }
  }
  return out;
}

export function diffAgainstBase(
  baseId: BuiltInProfileId, conventions: Partial<SchedulingConventions>,
): Partial<SchedulingConventions> {
  const base = builtInConventions(baseId);
  const out: Partial<SchedulingConventions> = {};
  for (const key of CONVENTION_KEYS) {
    const value = conventions[key];
    if (typeof value === 'boolean' && value !== base[key]) out[key] = value;
  }
  return out;
}

export function isDefaultProfile(profile: SchedulingProfile | undefined): boolean {
  if (!profile) return true;
  const overrides = profile.overrides as Partial<Record<string, unknown>>;
  return profile.id === 'ops' && profile.baseId === 'ops'
    && CONVENTION_KEYS.every(key => typeof overrides[key] !== 'boolean');
}

export function p6OptionDefaults(): {
  lagCalendar: 'predecessor';
  criticalDefinition: { mode: 'totalFloat'; thresholdHours: number };
  totalFloatMode: 'finish';
  makeOpenEndedCritical: boolean;
  useExpectedFinishDates: boolean;
  p6CompletedLateFromRemainingWindow: boolean;
  startToStartLagFrom: 'earlyStart';
} {
  return {
    lagCalendar: 'predecessor',
    criticalDefinition: { mode: 'totalFloat', thresholdHours: 0 },
    totalFloatMode: 'finish',
    makeOpenEndedCritical: false,
    useExpectedFinishDates: true,
    p6CompletedLateFromRemainingWindow: true,
    startToStartLagFrom: 'earlyStart',
  };
}

export function defaultOptionsFor(baseId: BuiltInProfileId): ProjectSchedulingOptions {
  switch (baseId) {
    case 'p6': {
      const d = p6OptionDefaults();
      return {
        lagCalendar: d.lagCalendar, criticalDefinition: d.criticalDefinition, totalFloatMode: d.totalFloatMode,
        makeOpenEndedCritical: d.makeOpenEndedCritical, startToStartLagFrom: d.startToStartLagFrom,
      };
    }
    case 'msproject':
    case 'ops':
      return {};
  }
}

export function switchProfile(profile: SchedulingProfile | undefined, newBaseId: BuiltInProfileId): SchedulingProfile {
  const keep = !profile || isBuiltInProfileId(profile.id);
  return { ...builtInProfile(newBaseId), overrides: keep && profile ? { ...profile.overrides } : {} };
}

export function effectiveSchedulingOptions(
  project: Pick<Project, 'schedulingProfile' | 'schedulingOptions'>,
): EffectiveSchedulingOptions {
  return { ...project.schedulingOptions, ...resolveConventions(project.schedulingProfile) };
}
