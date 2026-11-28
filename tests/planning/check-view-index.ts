import './domStub';
import { resourceNames, resourceCellValue, type ViewContext } from '@/engine/view/filterEval';
import { useAppStore } from '@/state/appStore';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const task = (id: string): Task => ({ id } as unknown as Task);
const res = (id: string, name: string): Resource =>
  ({ id, name, type: 'LABOR', description: '', maxUnits: 1 });
const asg = (taskId: string, resourceId: string): ResourceAssignment =>
  ({ taskId, resourceId } as unknown as ResourceAssignment);

const ctxWith = (resources: Resource[], assignments: ResourceAssignment[]): ViewContext => ({
  activityCodeTypes: [], customFieldDefs: [], resources, assignments, noneLabel: '(geen)',
});

function oldResourceNames(t: Task, ctx: ViewContext): string[] {
  return ctx.assignments
    .filter(a => a.taskId === t.id)
    .map(a => ctx.resources.find(r => r.id === a.resourceId)?.name)
    .filter((n): n is string => !!n);
}

const resources = [res('r1', 'Timmerman'), res('r2', 'Kraan'), res('r3', 'Metselaar')];
const assignments = [
  asg('t1', 'r2'),
  asg('t1', 'r1'),
  asg('t2', 'r3'),
  asg('t3', 'weg'),
  asg('t1', 'r1'),
];
const ctx = ctxWith(resources, assignments);

for (const id of ['t1', 't2', 't3', 't4']) {
  eq(`01.${id} identiek aan de implementatie van vóór de index`,
    resourceNames(task(id), ctx), oldResourceNames(task(id), ctx));
}
eq('02 volgorde volgt de assignments, niet de resources', resourceNames(task('t1'), ctx), ['Kraan', 'Timmerman', 'Timmerman']);
eq('03 verdwenen resource valt weg, geen lege string', resourceNames(task('t3'), ctx), []);
eq('04 taak zonder toewijzingen', resourceNames(task('t4'), ctx), []);
eq('05 de cel-weergave hangt op dezelfde join', resourceCellValue(task('t1'), ctx), 'Kraan, Timmerman, Timmerman');

{
  const ctx2 = ctxWith(resources, [asg('t1', 'r3')]);
  eq('06 een nieuwe context ziet de nieuwe toewijzingen', resourceNames(task('t1'), ctx2), ['Metselaar']);
  eq('07 en de oude context is ongemoeid', resourceNames(task('t1'), ctx), ['Kraan', 'Timmerman', 'Timmerman']);
}
{
  const ctx3 = ctxWith([res('r1', 'Timmerman-NIEUW'), res('r2', 'Kraan'), res('r3', 'Metselaar')], assignments);
  eq('08 een nieuwe context ziet een hernoemde resource',
    resourceNames(task('t1'), ctx3), ['Kraan', 'Timmerman-NIEUW', 'Timmerman-NIEUW']);
}
{
  const ctx4 = ctxWith(resources, assignments);
  const eerste = resourceNames(task('t1'), ctx4);
  for (let i = 0; i < 5; i++) resourceNames(task('t1'), ctx4);
  eq('09 herhaald aanroepen op dezelfde context geeft hetzelfde', resourceNames(task('t1'), ctx4), eerste);
}

{
  const S = () => useAppStore.getState();
  S().newProject();
  const rA = S().addResource({ name: 'Ploeg A', type: 'CREW', description: '', maxUnits: 4 });
  const rB = S().addResource({ name: 'Ploeg B', type: 'CREW', description: '', maxUnits: 4 });
  const t1 = S().addTask({ name: 'Fundering' });
  const t2 = S().addTask({ name: 'Ruwbouw' });
  S().assignResource(t1, rA, 1);
  S().assignResource(t2, rB, 1);
  S().setGroup([{ field: { src: 'resource' }, dir: 'asc' }]);
  S().recomputeViewRows();
  const banden = S().viewRows.filter(r => r.kind === 'group').map(r => (r as { label: string }).label);
  eq('10 store: de resource-groepsrijen komen uit de geïndexeerde join', banden.sort(), ['Ploeg A', 'Ploeg B']);

  S().assignResource(t1, rB, 1);
  S().recomputeViewRows();
  const na = S().viewRows.filter(r => r.kind === 'group').map(r => (r as { label: string }).label).sort();
  eq('11 store: een nieuwe toewijzing is meteen zichtbaar (geen verouderde index)', na, ['Ploeg A', 'Ploeg B']);
  const rowsA = S().viewRows.filter(r => r.kind === 'task').length;
  checks++;
  if (rowsA < 3) diffs.push(`12 store: taak met twee resources hoort in béíde groepen te staan (kreeg ${rowsA} taakrijen)`);
}

if (diffs.length === 0) {
  console.log(`OK  view-index: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  view-index: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
