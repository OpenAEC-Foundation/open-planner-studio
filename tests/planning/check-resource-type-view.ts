// Groeperen en sorteren op Resourcetype (issue #173): het scherm moet de tweelaagse indeling van het
// rapport Resourcediagram kunnen nabouwen — eerst een band per resourcetype in de VASTE volgorde van
// dat rapport (arbeid, ploeg, onderaannemer, materieel, materiaal), daaronder per resource. Een taak
// met resources van twee typen staat, net als bij groeperen op resource, onder beide typebanden.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { computeViewRows, type ViewContext, type ViewRow, type ViewRowOpts } from '@/engine/view/visibleRows';
import { RESOURCE_TYPE_BAND_ORDER as REPORT_ORDER } from '@/engine/reports/resourceGantt';
import { RESOURCE_TYPE_BAND_ORDER } from '@/engine/view/filterEval';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { GroupLevel, SortLevel } from '@/types/view';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const task = (id: string): Task => ({ id, name: id, wbsCode: id, parentId: null, childIds: [] } as unknown as Task);
const res = (id: string, name: string, type: Resource['type']): Resource =>
  ({ id, name, type, description: '', maxUnits: 1 });
const asg = (taskId: string, resourceId: string): ResourceAssignment =>
  ({ taskId, resourceId } as unknown as ResourceAssignment);

const resources = [
  res('r-kraan', 'Kraan', 'EQUIPMENT'),
  res('r-beton', 'Beton', 'MATERIAL'),
  res('r-jan', 'Jan', 'LABOR'),
  res('r-ploeg', 'Ploeg', 'CREW'),
];
// t-graven: materieel; t-storten: arbeid + materiaal; t-ploeg: ploeg; t-leeg: niets.
const assignments = [
  asg('t-graven', 'r-kraan'),
  asg('t-storten', 'r-beton'), asg('t-storten', 'r-jan'),
  asg('t-ploeg', 'r-ploeg'),
];
const tasks = ['t-graven', 't-storten', 't-ploeg', 't-leeg'].map(task);
const ctx: ViewContext = {
  activityCodeTypes: [], customFieldDefs: [], resources, assignments, noneLabel: '(geen)',
  resourceTypeLabels: { LABOR: 'Arbeid', CREW: 'Ploeg', SUBCONTRACTOR: 'Onderaannemer', EQUIPMENT: 'Materieel', MATERIAL: 'Materiaal' },
};
const opts = (group: GroupLevel[], sort: SortLevel[] = []): ViewRowOpts => ({
  filter: null, group, sort, collapsedTaskIds: new Set(), collapsedGroupKeys: new Set(),
});
const outline = (rows: ViewRow[]) => rows.map(row => (row.kind === 'group'
  ? `${'  '.repeat(row.depth)}[${row.label}]`
  : `${'  '.repeat(row.depth)}${row.task.id}`));

console.log('-- resourcetype: één laag --');
eq('typebanden in de vaste rapportvolgorde, "(geen)" achteraan; een taak met twee typen onder beide',
  outline(computeViewRows(tasks, opts([{ field: { src: 'resourceType' }, dir: 'asc' }]), ctx)),
  ['[Arbeid]', '  t-storten', '[Ploeg]', '  t-ploeg', '[Materieel]', '  t-graven', '[Materiaal]', '  t-storten', '[(geen)]', '  t-leeg']);
eq('aflopend keert de typevolgorde om; "(geen)" blijft achteraan',
  outline(computeViewRows(tasks, opts([{ field: { src: 'resourceType' }, dir: 'desc' }]), ctx))
    .filter(line => line.startsWith('[')),
  ['[Materiaal]', '[Materieel]', '[Ploeg]', '[Arbeid]', '[(geen)]']);

console.log('-- resourcetype → resource: de indeling van het rapport Resourcediagram --');
eq('twee lagen: type, daaronder de resources van dat type',
  outline(computeViewRows(tasks, opts([
    { field: { src: 'resourceType' }, dir: 'asc' },
    { field: { src: 'resource' }, dir: 'asc' },
  ]), ctx)).filter(line => line.trimStart().startsWith('[')),
  ['[Arbeid]', '  [Jan]', '[Ploeg]', '  [Ploeg]', '[Materieel]', '  [Kraan]', '[Materiaal]', '  [Beton]', '[(geen)]', '  [(geen)]']);

eq('omgekeerd: onder een resourceband alleen het type van díé resource',
  outline(computeViewRows(tasks, opts([
    { field: { src: 'resource' }, dir: 'asc' },
    { field: { src: 'resourceType' }, dir: 'asc' },
  ]), ctx)).filter(line => line.trimStart().startsWith('[')),
  ['[Beton]', '  [Materiaal]', '[Jan]', '  [Arbeid]', '[Kraan]', '  [Materieel]', '[Ploeg]', '  [Ploeg]', '[(geen)]', '  [(geen)]']);

console.log('-- sorteren op resourcetype --');
eq('sorteert in de bandvolgorde (arbeid eerst), niet alfabetisch; zonder resource achteraan',
  computeViewRows(tasks, opts([], [{ field: { src: 'resourceType' }, dir: 'asc' }]), ctx)
    .map(row => (row.kind === 'task' ? row.task.id : '')),
  ['t-storten', 't-ploeg', 't-graven', 't-leeg']);

console.log('-- één bron voor de typevolgorde --');
eq('scherm en rapport delen dezelfde volgorde', REPORT_ORDER, RESOURCE_TYPE_BAND_ORDER);

eq('zonder vertaalde labels valt de bandkop terug op de typenaam',
  outline(computeViewRows([task('t-graven')], opts([{ field: { src: 'resourceType' }, dir: 'asc' }]),
    { ...ctx, resourceTypeLabels: undefined }))[0], '[EQUIPMENT]');

if (diffs.length === 0) { console.log(`OK  resource-type-view: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  resource-type-view: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
