import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import { ifcGuid128, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import type { Resource } from '@/types/resource';

/** Geordende randgevallen: leden vóór hun ploeg, lege/speciale sleutels en onbekende ouders. */
export function crewEdgeResources(duplicates = false): Resource[] {
  const resource = (id: string, name: string, type: Resource['type'], parentId?: string): Resource => ({
    id, name, type, parentId, description: `Omschrijving ${name}`, maxUnits: 2.5,
    costPerHour: 42.75, availability: 0.9, unitOfMeasure: 'uur', color: '#0EA5E9',
    availabilitySteps: [{ from: '2026-01-05', maxUnits: 3 }, { from: '2026-02-02', maxUnits: 2 }],
    libraryOrigin: { companyId: 'c-crew', libraryItemId: `item-${id}`, poolVersion: 7, syncedHash: 'bronhash' },
  });
  const a = resource('__proto__', 'Alfa', 'CREW');
  const a1 = resource('a1', 'Alfa een', 'LABOR', a.id);
  const a2 = resource('a2', 'Alfa twee', 'MATERIAL', a.id);
  const rows = [
    resource('b1', 'Beta een', 'EQUIPMENT', 'constructor'), a2,
    resource('constructor', 'Beta', 'CREW'), resource('empty', 'Zonder leden', 'CREW'), a, a1,
    resource('', 'Lege sleutel', 'CREW'), resource('e1', 'Lid lege sleutel', 'SUBCONTRACTOR', ''),
    resource('orphan', 'Onbekende ouder', 'LABOR', 'ontbreekt'), resource('free', 'Zonder ouder', 'LABOR'),
  ];
  // De oude schrijver dedupliceert NIETS: laatste STEP-ref per id, alle lijstvoorkomens blijven.
  if (duplicates) rows.push({ ...a1, name: 'Alfa een laatste' }, a2, { ...a, name: 'Alfa laatste' });
  return rows;
}

/** Volledige writerinvoer met 100 taken; uitsluitend de resourceschalen variëren. */
export function ifcCrewIndexFixture(size: number, crewCount: number): WriteIFCInput {
  const data = generateBenchmarkProject(100, { seed: 0x1fc, resourceCount: 0 });
  const resources: Resource[] = Array.from({ length: size }, (_, i) => ({
    id: `res-${i}`, name: `Resource ${i}`, description: `Meetresource ${i}`,
    type: i < crewCount ? 'CREW' : i % 2 ? 'LABOR' : 'EQUIPMENT',
    maxUnits: 1 + i % 3, costPerHour: 35 + i % 17,
    ...(i >= crewCount && crewCount > 0 ? { parentId: `res-${(i - crewCount) % crewCount}` } : {}),
    color: '#0EA5E9', libraryOrigin: { companyId: 'c-crew', libraryItemId: `item-${i}`, poolVersion: 7, syncedHash: 'bronhash' },
  }));
  return {
    ...data, resources,
    assignments: data.tasks.filter(t => t.childIds.length === 0).map((t, i) => ({
      id: `assignment-${i}`, taskId: t.id, resourceId: resources[i % size].id, unitsPerDay: 1,
    })),
    ifcGlobalIds: { 'res:res-0': ifcGuid128('bewaard-bron-id') },
    importPristine: true, recordedSourceFormat: 'mspdi',
  };
}
