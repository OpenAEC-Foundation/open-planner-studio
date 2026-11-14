// Selectie na in-/uitklappen en verwijderen (issue #899) — headless tegen de ECHTE store.
//
// Melding: klapt de planner een samenvatting in of verwijdert hij een taak, dan sprong de selectie
// naar de bovenste rij. Afspraak:
//  - Inklappen verbergt een geselecteerde taak ⇒ de selectie gaat naar de zichtbare ouder (de
//    ingeklapte samenvatting), zodat je op dezelfde plek blijft. Een taak die al onzichtbaar was
//    (filter) blijft ongemoeid.
//  - Verwijderen van de hele selectie ⇒ de taak die nu op dezelfde plek staat (eronder); was het de
//    laatste rij, dan de taak erboven. Dat is dezelfde regel als de celcursor van het raster
//    (`reconcileGridSelection`: de oude positie op de dichtstbijzijnde rij).
//
// Draait via run.sh. Exit 0 = alles groen.
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

/** Fase P (a, b, c), fase Q (d, met subfase Q1 (e)), losse taak f. Geeft naam → id. */
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

// ── 1) Inklappen van de ouder van de geselecteerde taak ⇒ de ouder wordt geselecteerd. ──
let ids = build();
eq('uitgangspunt: alles zichtbaar', visible(), ['P', 'a', 'b', 'c', 'Q', 'd', 'Q1', 'e', 'f']);
S().selectTask(ids.b);
S().toggleCollapse(ids.P);
eq('inklappen P met b geselecteerd ⇒ P', sel(), { selected: ['P'], active: 'P' });
S().toggleCollapse(ids.P);
eq('uitklappen laat P geselecteerd', sel(), { selected: ['P'], active: 'P' });

// Diep verborgen: e onder Q1 onder Q; Q inklappen ⇒ Q (de zichtbare voorouder), niet Q1.
S().selectTask(ids.e);
S().toggleCollapse(ids.Q);
eq('inklappen Q met e geselecteerd ⇒ Q', sel(), { selected: ['Q'], active: 'Q' });

// Inklappen van een fase ELDERS laat de selectie staan.
ids = build();
S().selectTask(ids.f);
S().toggleCollapse(ids.P);
eq('inklappen P met f geselecteerd ⇒ f blijft', sel(), { selected: ['f'], active: 'f' });

// Meervoudige selectie: verborgen leden vallen samen op hun ouder, zichtbare blijven; volgorde stabiel.
ids = build();
S().selectTasks([ids.a, ids.f, ids.c], false, ids.c);
S().toggleCollapse(ids.P);
eq('a, f, c met P ingeklapt ⇒ P, f; actief P', sel(), { selected: ['P', 'f'], active: 'P' });

// Alles inklappen (lint/contextmenu) loopt via collapseTasks: dezelfde regel.
ids = build();
S().selectTask(ids.e);
S().collapseAll();
eq('alles inklappen met e geselecteerd ⇒ Q', sel(), { selected: ['Q'], active: 'Q' });
ids = build();
S().selectTask(ids.d);
S().collapseTasks([ids.Q]);
eq('collapseTasks([Q]) met d geselecteerd ⇒ Q', sel(), { selected: ['Q'], active: 'Q' });

// ── 2) Verwijderen ⇒ de taak op dezelfde plek (eronder), anders erboven. ──
ids = build();
S().selectTask(ids.b);
S().deleteTask(ids.b);
eq('b verwijderd ⇒ c (eronder)', sel(), { selected: ['c'], active: 'c' });

ids = build();
S().selectTask(ids.f);
S().deleteTask(ids.f);
eq('laatste rij f verwijderd ⇒ e (erboven)', sel(), { selected: ['e'], active: 'e' });

// Een samenvatting met kinderen: de hele boom gaat weg, de volgende zichtbare rij is Q.
ids = build();
S().selectTask(ids.P);
S().deleteTask(ids.P);
eq('P met kinderen verwijderd ⇒ Q', sel(), { selected: ['Q'], active: 'Q' });

// Bulk (Delete-toets/lint): b, c en d over een fasegrens ⇒ de eerste overgebleven rij onder b: Q
// (die staat na het verwijderen direct onder a).
ids = build();
S().selectTasks([ids.b, ids.c, ids.d], false, ids.b);
S().deleteTasksBulk(S().selectedTaskIds);
eq('b, c, d verwijderd ⇒ Q', sel(), { selected: ['Q'], active: 'Q' });

// Blijft er een deel van de selectie over, dan blijft dat deel staan (geen buurtaak erbij).
ids = build();
S().selectTasks([ids.a, ids.f], false, ids.a);
S().deleteTask(ids.a);
eq('a verwijderd uit {a, f} ⇒ f', sel(), { selected: ['f'], active: 'f' });

// Verwijderen van een taak die NIET geselecteerd is, laat de selectie staan.
ids = build();
S().selectTask(ids.c);
S().deleteTask(ids.a);
eq('a verwijderd met c geselecteerd ⇒ c', sel(), { selected: ['c'], active: 'c' });

// De enige taak verwijderd ⇒ lege selectie (niets om naartoe te gaan).
S().newProject();
const only = S().addTask({ name: 'x', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
S().selectTask(only);
S().deleteTask(only);
eq('enige taak verwijderd ⇒ leeg', sel(), { selected: [], active: null });

// ── 3) Review #947: de buur moet NA het verwijderen zichtbaar zijn, niet alleen nog bestaan. ──
// Filter "naam bevat match": zichtbaar zijn match A, P (als ouder van match B) en match B. Na het
// verwijderen van B valt P weg (C past niet). De selectie mag dus niet op de verborgen P landen —
// een tweede Verwijderen zou P met het verborgen kind C wissen.
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

// ── 4) Review #947: in een groepering staat een taak meer dan eens. Vertrekpunt is de rij van de
// celcursor (ui.gridActiveRowKey), niet het eerste voorkomen van het taak-id. ──
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
  // De cursor staat op A onder R2 (tweede voorkomen).
  S().selectTask(a);
  S().setUI({ gridActiveRowKey: rowsOfA[1] });
  S().deleteTasksBulk([a]);
  eq('groep: A onder R2 verwijderd ⇒ C (eronder in R2), niet B in R1', sel(), { selected: ['C'], active: 'C' });
  S().setGroup([]);
}

// ── 5) Review #947 ronde 3: A en C allebei onder R1–R4. Verdwijnt A uit alle vier de groepen, dan
// schuift de oude cursorplek een groep op. De store geeft daarom de gekozen buurRIJ door
// (ui.gridActiveRowKey), niet alleen de taak: C onder R3, niet C onder R4. ──
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

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`selectie na inklappen/verwijderen: ${diffs.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`selectie na inklappen/verwijderen: ${checks} checks groen`);
