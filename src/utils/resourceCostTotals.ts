import { isCostResource, type Resource, type ResourceAssignment } from '@/types/resource';

/**
 * De kolom "Totaal" van het resourcepaneel, per resource-id. Een werk- of materiaalresource: belaste
 * uren (van de taakkalender, `ResourceLoadResult.hours`) × tarief. Een kostenresource (#815): de som van
 * de bedragen op zijn toewijzingen. Geen tarief, geen belasting of geen bedrag ⇒ `undefined` ("—").
 */
export function resourceCostTotals(
  resources: readonly Resource[],
  assignments: readonly ResourceAssignment[],
  hours: Readonly<Record<string, number>> | undefined,
): Record<string, number | undefined> {
  const map: Record<string, number | undefined> = {};
  const costSums = new Map<string, number>();
  for (const a of assignments) {
    if (a.costAmount === undefined) continue;
    costSums.set(a.resourceId, (costSums.get(a.resourceId) ?? 0) + a.costAmount);
  }
  for (const r of resources) {
    if (isCostResource(r)) { map[r.id] = costSums.get(r.id); continue; }
    const h = hours?.[r.id];
    map[r.id] = h === undefined || r.costPerHour == null ? undefined : h * r.costPerHour;
  }
  return map;
}
