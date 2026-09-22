// Rekenprofielen C4 — de nabootsing van het oude `delete project.schedulingOptions.p6Source`.
//
// Vóór de rekenprofielen zette het weghalen van p6Source ALLE p6Source-gepoorte conventies uit
// (`gatedByP6Source`: A15–A20 en B1–B5); de niet-gepoorte (A12, A13, A22, A23) bleven staan. Precies
// dat doet deze helper, als een expliciet profiel — NIET "ops met dezelfde overrides" (spec v3.1 §7).
// De projectopties blijven ongemoeid (A21 werkt in de motor alleen via de B3/B4-keten en valt daarmee
// vanzelf stil).
import { CONVENTIONS, diffAgainstBase, resolveConventions } from '@/engine/scheduler/conventions/registry';
import type { ConventionKey, SchedulingProfile } from '@/types/project';

export const P6_SOURCE_GATED_CONVENTIONS: readonly ConventionKey[] =
  CONVENTIONS.filter(c => c.gatedByP6Source).map(c => c.id);

export function withoutP6Semantics(target: { project: { schedulingProfile?: SchedulingProfile } }): void {
  const current = target.project.schedulingProfile;
  const baseId = current?.baseId ?? 'ops';
  const values = resolveConventions(current);
  for (const key of P6_SOURCE_GATED_CONVENTIONS) values[key] = false;
  target.project.schedulingProfile = {
    baseId, id: 'test-p6-semantiek-uit', name: 'test: P6-semantiek uit', overrides: diffAgainstBase(baseId, values),
  };
}

/** Eén conventie expliciet zetten op het bestaande profiel (vervangt `schedulingOptions.<vlag> = x`). */
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

/** Voor asserties die vroeger `schedulingOptions?.p6Source` lazen: staat alle P6-semantiek uit? */
export function p6SemanticsOff(project: { schedulingProfile?: SchedulingProfile }): boolean {
  const values = resolveConventions(project.schedulingProfile);
  return P6_SOURCE_GATED_CONVENTIONS.every(key => values[key] === false);
}
