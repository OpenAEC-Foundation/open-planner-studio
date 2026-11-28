import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { legacyOptionsToProfile } from '@/services/ifc/schedulingProfileMigration';
import type { EffectiveSchedulingOptions, SchedulingOptions } from '@/types/project';
import type { CPMOptions } from '@/engine/scheduler/CPMSolver';

type LegacyBlob = SchedulingOptions & { p6Source?: 'XER' };

export function legacyEffective(blob: LegacyBlob | undefined): EffectiveSchedulingOptions {
  const { profile, options } = legacyOptionsToProfile(blob);
  return effectiveSchedulingOptions({ schedulingProfile: profile, schedulingOptions: options });
}

export function opsSolveInput<T extends object>(input: T): T & { schedulingOptions: EffectiveSchedulingOptions } {
  return { ...input, schedulingOptions: effectiveSchedulingOptions({}) };
}

export function legacyCpmOptions(
  opts: Omit<CPMOptions, 'schedulingOptions'> & { schedulingOptions?: LegacyBlob } = {},
): CPMOptions {
  return { ...opts, schedulingOptions: legacyEffective(opts.schedulingOptions) };
}
