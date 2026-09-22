// Testhulp (rekenprofielen C1): een oude SchedulingOptions-blob (evt. met p6Source en conventiesleutels)
// omzetten naar solverinvoer via EXACT de migratie die een IFC-bestand krijgt (baan A; M1.3 bewijst
// gelijkheid met de oude motorvertaling).
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { legacyOptionsToProfile } from '@/services/ifc/schedulingProfileMigration';
import type { EffectiveSchedulingOptions, SchedulingOptions } from '@/types/project';
import type { CPMOptions } from '@/engine/scheduler/CPMSolver';

type LegacyBlob = SchedulingOptions & { p6Source?: 'XER' };

export function legacyEffective(blob: LegacyBlob | undefined): EffectiveSchedulingOptions {
  const { profile, options } = legacyOptionsToProfile(blob);
  return effectiveSchedulingOptions({ schedulingProfile: profile, schedulingOptions: options });
}

/** Een `solveProject`-invoer die vóór de rekenprofielen GEEN `schedulingOptions` meegaf: nu expliciet
 *  de OPS-conventies zonder projectopties (`effectiveSchedulingOptions({})`) — byte-identiek. */
export function opsSolveInput<T extends object>(input: T): T & { schedulingOptions: EffectiveSchedulingOptions } {
  return { ...input, schedulingOptions: effectiveSchedulingOptions({}) };
}

/** Solver-opties zoals de tests ze vóór de rekenprofielen schreven — `schedulingOptions` als kale
 *  (legacy-)blob of afwezig — omgezet naar geldige `CPMOptions` via `legacyEffective`. Een blob
 *  zonder conventiesleutels geeft exact `effectiveSchedulingOptions({ schedulingOptions: blob })`. */
export function legacyCpmOptions(
  opts: Omit<CPMOptions, 'schedulingOptions'> & { schedulingOptions?: LegacyBlob } = {},
): CPMOptions {
  return { ...opts, schedulingOptions: legacyEffective(opts.schedulingOptions) };
}
