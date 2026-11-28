import './domStub';
import { useAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

const S = () => useAppStore.getState();
let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

function build(): Record<string, string> {
  S().newProject();
  const ids: Record<string, string> = {};
  const add = (name: string, parent: string | null) => {
    ids[name] = S().addTask({
      name, isMilestone: false, parentId: parent ? ids[parent] : null,
      time: createDefaultTaskTime('2026-06-01', 1),
    });
  };
  add('P', null); add('a', 'P'); add('b', 'P'); add('c', 'P');
  add('Q', null); add('d', 'Q'); add('Q1', 'Q'); add('e', 'Q1');
  add('f', null);
  S().expandTasks();
  return ids;
}
const nameOf = (id: string | null) => S().tasks.find(t => t.id === id)?.name ?? null;
const sel = () => ({ selected: S().selectedTaskIds.map(nameOf), active: nameOf(S().activeTaskId) });
const visible = () => S().viewRows.flatMap(r => r.kind === 'task' ? [r.task.name] : []);

let ids = build();
eq('uitgangspunt: alles zichtbaar', visible(), ['P', 'a', 'b', 'c', 'Q', 'd', 'Q1', 'e', 'f']);
S().selectTask(ids.b);
S().toggleCollapse(ids.P);
eq('inklappen P met b geselecteerd ⇒ P', sel(), { selected: ['P'], active: 'P' });
S().toggleCollapse(ids.P);
eq('uitklappen laat P geselecteerd', sel(), { selected: ['P'], active: 'P' });

S().selectTask(ids.e);
S().toggleCollapse(ids.Q);
eq('inklappen Q met e geselecteerd ⇒ Q', sel(), { selected: ['Q'], active: 'Q' });

ids = build();
S().selectTask(ids.f);
S().toggleCollapse(ids.P);
eq('inklappen P met f geselecteerd ⇒ f blijft', sel(), { selected: ['f'], active: 'f' });

ids = build();
S().selectTasks([ids.a, ids.f, ids.c], false, ids.c);
S().toggleCollapse(ids.P);
eq('a, f, c met P ingeklapt ⇒ P, f; actief P', sel(), { selected: ['P', 'f'], active: 'P' });

ids = build();
S().selectTask(ids.e);
S().collapseAll();
eq('alles inklappen met e geselecteerd ⇒ Q', sel(), { selected: ['Q'], active: 'Q' });
ids = build();
S().selectTask(ids.d);
S().collapseTasks([ids.Q]);
eq('collapseTasks([Q]) met d geselecteerd ⇒ Q', sel(), { selected: ['Q'], active: 'Q' });

ids = build();
S().selectTask(ids.b);
S().deleteTask(ids.b);
eq('b verwijderd ⇒ c (eronder)', sel(), { selected: ['c'], active: 'c' });

ids = build();
S().selectTask(ids.f);
S().deleteTask(ids.f);
eq('laatste rij f verwijderd ⇒ e (erboven)', sel(), { selected: ['e'], active: 'e' });

ids = build();
S().selectTask(ids.P);
S().deleteTask(ids.P);
eq('P met kinderen verwijderd ⇒ Q', sel(), { selected: ['Q'], active: 'Q' });

ids = build();
S().selectTasks([ids.b, ids.c, ids.d], false, ids.b);
S().deleteTasksBulk(S().selectedTaskIds);
eq('b, c, d verwijderd ⇒ Q', sel(), { selected: ['Q'], active: 'Q' });

ids = build();
S().selectTasks([ids.a, ids.f], false, ids.a);
S().deleteTask(ids.a);
eq('a verwijderd uit {a, f} ⇒ f', sel(), { selected: ['f'], active: 'f' });

ids = build();
S().selectTask(ids.c);
S().deleteTask(ids.a);
eq('a verwijderd met c geselecteerd ⇒ c', sel(), { selected: ['c'], active: 'c' });

S().newProject();
const only = S().addTask({ name: 'x', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
S().selectTask(only);
S().deleteTask(only);
eq('enige taak verwijderd ⇒ leeg', sel(), { selected: [], active: null });

{
  S().newProject();
  const add = (name: string, parentId: string | null = null) => S().addTask({
    name, isMilestone: false, parentId, time: createDefaultTaskTime('2026-06-01', 1),
  });
  add('match A');
  const p = add('P');
  const b = add('match B', p);
  add('C', p);
  S().setFilter({ kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'contains', value: 'match' });
  eq('filter: zichtbaar match A, P, match B', visible(), ['match A', 'P', 'match B']);
  S().selectTask(b);
  S().deleteTask(b);
  eq('filter: na verwijderen zichtbaar alleen match A', visible(), ['match A']);
  eq('filter: selectie op de zichtbare buur match A, niet op de verborgen P', sel(), { selected: ['match A'], active: 'match A' });
  S().setFilter(null);
}

{
  S().newProject();
  const add = (name: string) => S().addTask({
    name, isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1),
  });
  const a = add('A');
  const b = add('B');
  const c = add('C');
  const r1 = S().addResource({ name: 'R1', type: 'LABOR', description: '', maxUnits: 1 });
  const r2 = S().addResource({ name: 'R2', type: 'LABOR', description: '', maxUnits: 1 });
  S().assignResource(a, r1, 1);
  S().assignResource(a, r2, 1);
  S().assignResource(b, r1, 1);
  S().assignResource(c, r2, 1);
  S().setGroup([{ field: { src: 'resource' }, dir: 'asc' }]);
  eq('groep: A onder R1 en onder R2', visible(), ['A', 'B', 'A', 'C']);
  const rowsOfA = S().viewRows.filter(row => row.kind === 'task' && row.task.id === a).map(row => row.rowKey);
  S().selectTask(a);
  S().setUI({ gridActiveRowKey: rowsOfA[1] });
  S().deleteTasksBulk([a]);
  eq('groep: A onder R2 verwijderd ⇒ C (eronder in R2), niet B in R1', sel(), { selected: ['C'], active: 'C' });
  S().setGroup([]);
}

{
  S().newProject();
  const add = (name: string) => S().addTask({
    name, isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1),
  });
  const a = add('A');
  const c = add('C');
  for (const name of ['R1', 'R2', 'R3', 'R4']) {
    const r = S().addResource({ name, type: 'LABOR', description: '', maxUnits: 1 });
    S().assignResource(a, r, 1);
    S().assignResource(c, r, 1);
  }
  S().setGroup([{ field: { src: 'resource' }, dir: 'asc' }]);
  const keysOf = (id: string) => S().viewRows.filter(row => row.kind === 'task' && row.task.id === id).map(row => row.rowKey);
  const rowsOfA = keysOf(a);
  const rowsOfC = keysOf(c);
  eq('vier groepen: A en C elk vier keer', [rowsOfA.length, rowsOfC.length], [4, 4]);
  S().selectTask(a);
  S().setUI({ gridActiveRowKey: rowsOfA[2] });
  S().deleteTasksBulk([a]);
  eq('vier groepen: A onder R3 verwijderd ⇒ C', sel(), { selected: ['C'], active: 'C' });
  eq('vier groepen: de buurrij is C onder R3', S().ui.gridActiveRowKey, rowsOfC[2]);
  S().setGroup([]);
}

{
  S().newProject();
  const add = (name: string) => S().addTask({
    name, isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1),
  });
  add('A');
  const b = add('B');
  const c = add('C');
  S().setGroup([{ field: { src: 'builtin', key: 'wbsCode' }, dir: 'asc' }]);
  eq('WBS-groep: A, B, C', visible(), ['A', 'B', 'C']);
  S().selectTask(b);
  S().setUI({ gridActiveRowKey: S().viewRows.find(row => row.kind === 'task' && row.task.id === b)!.rowKey });
  S().deleteTasksBulk([b]);
  eq('WBS-groep: B verwijderd ⇒ C (eronder), niet A', sel(), { selected: ['C'], active: 'C' });
  eq('WBS-groep: de buurrij is de actuele rij van C',
    S().ui.gridActiveRowKey, S().viewRows.find(row => row.kind === 'task' && row.task.id === c)?.rowKey ?? null);
  S().setGroup([]);
}

{
  S().newProject();
  const add = (name: string) => S().addTask({
    name, isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1),
  });
  const ids3 = [add('A'), add('B'), add('C')];
  const [, b, c] = ids3;
  for (const name of ['R1', 'R2']) {
    const r = S().addResource({ name, type: 'LABOR', description: '', maxUnits: 1 });
    for (const id of ids3) S().assignResource(id, r, 1);
  }
  S().setGroup([{ field: { src: 'resource' }, dir: 'asc' }, { field: { src: 'builtin', key: 'wbsCode' }, dir: 'asc' }]);
  const firstC = S().viewRows.findIndex(row => row.kind === 'task' && row.task.id === c);
  const band = S().viewRows[firstC - 1];
  if (band.kind === 'group') S().setCollapsedGroupKey(band.key, true);
  const rowsOf = (id: string) => S().viewRows.filter(row => row.kind === 'task' && row.task.id === id).map(row => row.rowKey);
  eq('Resource → WBS: C alleen nog onder R2 zichtbaar', rowsOf(c).length, 1);
  const cUnderR2Before = JSON.parse(rowsOf(c)[0]).groupPath[0];
  S().selectTask(b);
  S().setUI({ gridActiveRowKey: rowsOf(b)[1] });
  S().deleteTasksBulk([b]);
  eq('Resource → WBS: B verwijderd ⇒ C', sel(), { selected: ['C'], active: 'C' });
  const chosen = S().ui.gridActiveRowKey;
  eq('Resource → WBS: de buurrij blijft in de groep van de cursor (R2)',
    chosen ? JSON.parse(chosen).groupPath[0] : null, cUnderR2Before);
  S().setGroup([]);
}

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`selectie na inklappen/verwijderen: ${diffs.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`selectie na inklappen/verwijderen: ${checks} checks groen`);
