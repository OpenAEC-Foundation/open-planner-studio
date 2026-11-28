import type {
  BuiltInProfileId, ConventionKey, LegacySchedulingOptions, Project, ProjectSchedulingOptions, SchedulingConventions,
  SchedulingOptions, SchedulingProfile,
} from '@/types/project';
import {
  CONVENTIONS, builtInProfile, conventionsFor, diffAgainstBase, isConventionKey, resolveConventions,
  type ConventionDescriptor,
} from '@/engine/scheduler/conventions/registry';

export const LEGACY_XER_ALWAYS_ON: ReadonlySet<ConventionKey> = new Set<ConventionKey>([
  'p6RelationFinishBoundary', 'p6BackwardLagFinishBoundary', 'p6CompletedDataDateWindow',
  'p6CompletedLoeActualFinish', 'p6OpenLoeTargetSpan',
  'p6UseRemainingStartForProgress',
]);

export const LEGACY_XER_ALSO_ON_X12: ReadonlySet<ConventionKey> = new Set<ConventionKey>([
  'p6CompletedPredecessorAtDataDate', 'p6FreeFloatOnOwnCalendar', 'p6CompletedRemainingLag',
  'p6CompletedOutOfSequenceWindow', 'p6CompletedPhysicalAtDataDate', 'p6InProgressStartLagElapsed',
  'p6FinishFinishStartMilestoneLateFinish', 'p6StartedTaskIgnoresPlannedStartFloor',
  'p6LateFinishOnOwnCalendar',
  'p6ProgressOverrideIgnoresStartedSuccessor',
  'p6FinishNotBeforeFinishFinishBound',
  'p6AlapPositionedFromSuccessors',
]);

export function legacyXerDefault(d: ConventionDescriptor): boolean {
  if (LEGACY_XER_ALWAYS_ON.has(d.id)) return d.builtIn.p6;
  if (LEGACY_XER_ALSO_ON_X12.has(d.id)) return d.builtIn.p6;
  return false;
}

export function optionKeysOnly(options: LegacySchedulingOptions | undefined): ProjectSchedulingOptions | undefined {
  if (!options) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (key === 'p6Source' || isConventionKey(key)) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? (out as ProjectSchedulingOptions) : undefined;
}

export function legacyOptionsToProfile(blob: LegacySchedulingOptions | undefined): {
  profile: SchedulingProfile;
  options: ProjectSchedulingOptions | undefined;
} {
  const options = optionKeysOnly(blob);
  if (!blob) return { profile: builtInProfile('ops'), options };
  if (blob.p6Source === 'XER') {
    const resolved = conventionsFor(d => {
      const value = blob[d.id];
      if (typeof value === 'boolean') return value;
      return legacyXerDefault(d);
    });
    return { profile: { ...builtInProfile('p6'), overrides: diffAgainstBase('p6', resolved) }, options };
  }
  const kept: Partial<SchedulingConventions> = {};
  for (const d of CONVENTIONS) {
    const value = blob[d.id];
    if (!d.gatedByP6Source && typeof value === 'boolean') kept[d.id] = value;
  }
  const baseId: BuiltInProfileId =
    kept.resumeFromActualElapsed === true && kept.unstartedIgnoresStatusDate === true ? 'msproject' : 'ops';
  return { profile: { ...builtInProfile(baseId), overrides: diffAgainstBase(baseId, kept) }, options };
}

export function legacyOptionsBlobFor(
  project: Pick<Project, 'schedulingProfile' | 'schedulingOptions'>,
): SchedulingOptions | undefined {
  const out: SchedulingOptions = { ...optionKeysOnly(project.schedulingOptions) };
  const conventions = resolveConventions(project.schedulingProfile);
  if (conventions.resumeFromActualElapsed) out.resumeFromActualElapsed = true;
  if (conventions.unstartedIgnoresStatusDate) out.unstartedIgnoresStatusDate = true;
  return Object.keys(out).length > 0 ? out : undefined;
}
