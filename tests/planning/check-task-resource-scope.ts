// Issue #73 — één geselecteerde taak mag alleen haar eigen resources en toewijzingen
// doorgeven aan contextuele resourceweergaven. Zonder selectie moet de gewone projectscope
// behouden blijven; anders verdwijnt de ongefilterde weergave na deselecteren.
import { scopeTaskResources } from '@/utils/taskResourceScope';
import type { Resource, ResourceAssignment } from '@/types/resource';

let failures = 0;
const fail = (message: string) => { console.log(`   XX ${message}`); failures++; };
const ok = (condition: boolean, message: string) => { if (!condition) fail(message); };

const resources: Resource[] = [
  { id: 'r-a', name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 1 },
  { id: 'r-b', name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 },
  { id: 'r-c', name: 'Schilder', type: 'LABOR', description: '', maxUnits: 1 },
];
const assignments: ResourceAssignment[] = [
  { id: 'a-1', taskId: 'task-a', resourceId: 'r-a', unitsPerDay: 1 },
  { id: 'a-2', taskId: 'task-a', resourceId: 'r-b', unitsPerDay: 1 },
  { id: 'a-3', taskId: 'task-b', resourceId: 'r-b', unitsPerDay: 1 },
  { id: 'a-4', taskId: 'task-b', resourceId: 'r-c', unitsPerDay: 1 },
];

{
  const scope = scopeTaskResources(resources, assignments, ['task-a']);
  ok(scope.isFiltered, 'één taak activeert de contextuele resourcescope');
  ok(scope.resources.map(resource => resource.id).join(',') === 'r-a,r-b',
    `taak A toont uitsluitend haar resources, kreeg ${scope.resources.map(resource => resource.id).join(',')}`);
  ok(scope.assignments.map(assignment => assignment.id).join(',') === 'a-1,a-2',
    `taak A geeft uitsluitend haar toewijzingen door, kreeg ${scope.assignments.map(assignment => assignment.id).join(',')}`);
}

{
  const scope = scopeTaskResources(resources, assignments, ['task-a', 'task-b']);
  ok(scope.resources.map(resource => resource.id).join(',') === 'r-a,r-b,r-c',
    'meervoudselectie neemt de unie van de taakresources');
  ok(scope.assignments.length === 4, 'meervoudselectie behoudt alle toewijzingen van de geselecteerde taken');
}

{
  const scope = scopeTaskResources(resources, assignments, []);
  ok(!scope.isFiltered, 'lege selectie schakelt de contextuele scope uit');
  ok(scope.resources === resources, 'lege selectie houdt de oorspronkelijke resourceverzameling vast');
  ok(scope.assignments === assignments, 'lege selectie houdt de oorspronkelijke toewijzingen vast');
}

if (failures > 0) {
  console.log(`task-resource-scope: ${failures} faalregels`);
  process.exit(1);
}
console.log('task-resource-scope: alle controles groen');
