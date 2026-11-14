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

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`selectie na inklappen/verwijderen: ${diffs.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`selectie na inklappen/verwijderen: ${checks} checks groen`);
