import { CONVENTIONS, diffAgainstBase, resolveConventions } from '@/engine/scheduler/conventions/registry';
import type { ConventionKey, SchedulingProfile } from '@/types/project';

export const P6_SOURCE_GATED_CONVENTIONS: readonly ConventionKey[] =
  CONVENTIONS.filter(c => c.gatedByP6Source || c.group === 'C').map(c => c.id);

export function withoutP6Semantics(target: { project: { schedulingProfile?: SchedulingProfile } }): void {
  const current = target.project.schedulingProfile;
  const baseId = current?.baseId ?? 'ops';
  const values = resolveConventions(current);
  for (const key of P6_SOURCE_GATED_CONVENTIONS) values[key] = false;
  target.project.schedulingProfile = {
    baseId, id: 'test-p6-semantiek-uit', name: 'test: P6-semantiek uit', overrides: diffAgainstBase(baseId, values),
  };
}

export function setConvention(
  target: { project: { schedulingProfile?: SchedulingProfile } }, key: ConventionKey, value: boolean,
): void {
  const current = target.project.schedulingProfile;
  const baseId = current?.baseId ?? 'ops';
  const values = resolveConventions(current);
  values[key] = value;
  target.project.schedulingProfile = {
    baseId, id: current?.id ?? baseId, name: current?.name ?? '', overrides: diffAgainstBase(baseId, values),
  };
}

export function p6SemanticsOff(project: { schedulingProfile?: SchedulingProfile }): boolean {
  const values = resolveConventions(project.schedulingProfile);
  return P6_SOURCE_GATED_CONVENTIONS.every(key => values[key] === false);
}
