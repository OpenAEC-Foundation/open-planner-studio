// Dissolve (issue #887) — headless tegen de echte store.
//
// Eigenaarsbesluit 2026-11-14: Dissolve staat naast Verwijderen. De taak gaat weg en de keten
// blijft heel: A → B → C wordt A → C. De nieuwe relatie is altijd einde-begin zonder vertraging,
// van elke voorganger naar elke opvolger. Verder volgt Dissolve Verwijderen: toewijzingen gaan mee
// weg, een samenvattingstaak neemt zijn hele tak mee, en één Ctrl+Z zet alles terug.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domShim';
import fs from 'node:fs';
import path from 'node:path';
import { useAppStore } from '@/state/appStore';
import { contextMenuBulk } from '@/components/canvas/contextMenuScope';
import { RIBBON_TABS, type RibbonGroupSpec } from '@/components/layout/Ribbon/ribbonConfig';
import type { SequenceType } from '@/types/sequence';
import { flattenOrder } from '@/utils/wbs';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const FS: SequenceType = 'FINISH_START';

/** Vers project met taken op naam; geeft naam → id. */
function plan(names: string[]): Record<string, string> {
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  const ids: Record<string, string> = {};
  for (const name of names) ids[name] = S().addTask({ name });
  return ids;
}

function link(ids: Record<string, string>, from: string, to: string, type: SequenceType = FS, lagDays = 0): void {
  const id = S().addSequence({ predecessorId: ids[from], successorId: ids[to], type, lagDays });
  if (!id) throw new Error(`relatie ${from} → ${to} geweigerd in de opzet`);
}

/** Alle relaties als "A>C FS 0", gesorteerd: zo leest een verwachting als een planning. */
function relations(): string[] {
  const name = (id: string) => S().tasks.find(t => t.id === id)?.name ?? '?';
  const short: Record<SequenceType, string> = {
    FINISH_START: 'FS', START_START: 'SS', FINISH_FINISH: 'FF', START_FINISH: 'SF',
  };
  return S().sequences
    .map(s => `${name(s.predecessorId)}>${name(s.successorId)} ${short[s.type]} ${s.lagDays}`)
    .sort();
}

const names = () => S().tasks.map(t => t.name).sort();
const appliedEvents = () => S().historyEvents.filter(event => event.state === 'applied').length;

// ── 1) A → B → C wordt A → C ─────────────────────────────────────────────────
{
  const ids = plan(['A', 'B', 'C']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  S().runCPM();
  const before = appliedEvents();
  S().dissolveTasksBulk([ids.B]);
  eq('01 B is weg', names(), ['A', 'C']);
  eq('02 A → C einde-begin zonder vertraging', relations(), ['A>C FS 0']);
  eq('03 één undo-stap', appliedEvents(), before + 1);
  eq('04 planning verouderd', S().scheduleStale, true);
  eq('05 document gewijzigd', S().isDirty, true);
  S().undo();
  eq('06 undo: B terug', names(), ['A', 'B', 'C']);
  eq('07 undo: oude relaties terug, de nieuwe weg', relations(), ['A>B FS 0', 'B>C FS 0']);
  S().redo();
  eq('08 redo: weer A → C', relations(), ['A>C FS 0']);
}

// ── 2) elke voorganger naar elke opvolger, soort en vertraging vervallen ────
{
  const ids = plan(['A1', 'A2', 'B', 'C1', 'C2']);
  link(ids, 'A1', 'B', 'START_START', 2);
  link(ids, 'A2', 'B', FS, 3);
  link(ids, 'B', 'C1', 'FINISH_FINISH', -1);
  link(ids, 'B', 'C2');
  S().dissolveTasksBulk([ids.B]);
  eq('09 vier nieuwe einde-begin-relaties zonder vertraging', relations(),
    ['A1>C1 FS 0', 'A1>C2 FS 0', 'A2>C1 FS 0', 'A2>C2 FS 0']);
}

// ── 3) bestaande relatie tussen voorganger en opvolger ──────────────────────
// Eigenaarsbesluit 2026-11-14 (`alreadyLinked`): bij een andere soort komt einde-begin erbij.
{
  const ids = plan(['A', 'B', 'C']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  link(ids, 'A', 'C', FS, 5);
  S().dissolveTasksBulk([ids.B]);
  eq('10 bestaande einde-begin blijft zoals ze is, geen tweede', relations(), ['A>C FS 5']);
  eq('11 geen weigering gemeld voor een relatie die er al was',
    S().ui.notifications.filter(n => n.messageKey === 'notifications.relationsSkippedOnDissolve').length, 0);
}
{
  const ids = plan(['A', 'B', 'C']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  link(ids, 'A', 'C', 'START_START', 2);
  S().dissolveTasksBulk([ids.B]);
  eq('12 andere soort tussen A en C: einde-begin komt erbij', relations(), ['A>C FS 0', 'A>C SS 2']);
}

// ── 4) een selectie werkt als geheel ────────────────────────────────────────
{
  const ids = plan(['A', 'B', 'C', 'D']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  link(ids, 'C', 'D');
  const before = appliedEvents();
  S().dissolveTasksBulk([ids.B, ids.C]);
  eq('13 B en C samen: A → D', relations(), ['A>D FS 0']);
  eq('14 één undo-stap voor de hele selectie', appliedEvents(), before + 1);
}
{
  const ids = plan(['A', 'B', 'C', 'D', 'E']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  link(ids, 'C', 'D');
  link(ids, 'D', 'E');
  S().dissolveTasksBulk([ids.B, ids.D]);
  eq('15 losse taken B en D: A → C en C → E, niet A → E', relations(), ['A>C FS 0', 'C>E FS 0']);
}

// ── 5) toewijzingen gaan mee weg, net als bij Verwijderen ───────────────────
{
  const ids = plan(['A', 'B', 'C']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  const res = S().addResource({ name: 'Timmerman', type: 'LABOR' } as Parameters<ReturnType<typeof S>['addResource']>[0]);
  S().assignResource(ids.B, res, 1);
  S().assignResource(ids.C, res, 1);
  S().dissolveTasksBulk([ids.B]);
  eq('16 toewijzing van B weg, die van C blijft', S().assignments.map(a => a.taskId), [ids.C]);
  eq('17 resource zelf blijft', S().resources.some(r => r.id === res), true);
  S().undo();
  eq('18 undo: toewijzing van B terug', S().assignments.map(a => a.taskId).sort(), [ids.B, ids.C].sort());
}

// ── 6) geen voorganger of geen opvolger: gewoon weg ─────────────────────────
{
  const ids = plan(['A', 'B', 'C']);
  link(ids, 'A', 'B');
  S().dissolveTasksBulk([ids.B]);
  eq('19 eindtaak zonder opvolger: B weg, geen nieuwe relatie', [names(), relations()], [['A', 'C'], []]);
}

// ── 7) niets te doen ⇒ geen undo-stap ───────────────────────────────────────
{
  plan(['A']);
  const before = appliedEvents();
  S().dissolveTasksBulk([]);
  S().dissolveTasksBulk(['bestaat-niet']);
  eq('20 leeg of onbekend: geen undo-stap', appliedEvents(), before);
}

// ── 8) samenvattingstaak: de hele tak gaat weg en telt als één blok ─────────
// Standaardstand van de instelling `dissolveSummaryMode` (eigenaarsbesluit 2026-11-14).
{
  const ids = plan(['A', 'A2', 'F', 'B1', 'B2', 'C', 'C2']);
  S().moveTask(ids.B1, ids.F, 0);
  S().moveTask(ids.B2, ids.F, 1);
  link(ids, 'A', 'B1');
  link(ids, 'B1', 'B2');
  link(ids, 'B2', 'C');
  link(ids, 'A2', 'F');
  link(ids, 'F', 'C2');
  S().dissolveTasksBulk([ids.F]);
  eq('21 fase en kinderen weg', names(), ['A', 'A2', 'C', 'C2']);
  eq('22 elke voorganger van de tak naar elke opvolger van de tak', relations(),
    ['A2>C FS 0', 'A2>C2 FS 0', 'A>C FS 0', 'A>C2 FS 0']);
}

// ── 9) een brug die een kring zou sluiten: weigering, de rest gaat door ───
{
  // Fase F met losse kinderen B1 en B2: X → B1, B2 → Y en Y → X is geen kring. Met Dissolve als blok
  // zou X → Y er wel een sluiten; die brug komt er niet, B2 → Z wel.
  const ids = plan(['X', 'Y', 'Z', 'F', 'B1', 'B2']);
  S().moveTask(ids.B1, ids.F, 0);
  S().moveTask(ids.B2, ids.F, 1);
  link(ids, 'Y', 'X');
  link(ids, 'X', 'B1');
  link(ids, 'B2', 'Y');
  link(ids, 'B2', 'Z');
  S().dissolveTasksBulk([ids.F]);
  eq('23 alleen de toegestane brug', relations(), ['X>Z FS 0', 'Y>X FS 0']);
  const notice = S().ui.notifications.find(n => n.messageKey === 'notifications.relationsSkippedOnDissolve');
  eq('24 weigering gemeld met aantal', notice?.params, { count: 1 });
  eq('25 weigering noemt de relatie', notice?.detailLines?.[0]?.params, { names: 'X → Y' });
}

// ── 11) instelling: alleen de kopregel van een samenvattingstaak ────────────
// Eigenaarsbesluit 2026-11-14: een instelling met twee standen, standaard de hele fase. In de
// stand "alleen de kopregel" schuiven de subtaken een niveau omhoog, op de plek van de kopregel,
// en gaan de relaties van de kopregel over naar de begin- en eindsubtaken, met soort en vertraging
// (begin = zonder voorganger binnen de fase, eind = zonder opvolger binnen de fase).
const order = () => flattenOrder(S().tasks).map(t => t.name);
const parentName = (name: string) => {
  const task = S().tasks.find(t => t.name === name);
  return S().tasks.find(t => t.id === task?.parentId)?.name ?? null;
};
eq('33 standaard: de hele fase', S().ui.dissolveSummaryMode, 'branch');
S().setUI({ dissolveSummaryMode: 'header' });
{
  const ids = plan(['A', 'G', 'F', 'B1', 'B2', 'B3', 'H', 'C']);
  S().moveTask(ids.F, ids.G, 0);
  S().moveTask(ids.H, ids.G, 1);
  S().moveTask(ids.B1, ids.F, 0);
  S().moveTask(ids.B2, ids.F, 1);
  S().moveTask(ids.B3, ids.F, 2);
  link(ids, 'A', 'F', 'START_START', 2);
  link(ids, 'F', 'C');
  link(ids, 'B1', 'B2');
  link(ids, 'B2', 'C', FS, 4);
  const res = S().addResource({ name: 'Timmerman', type: 'LABOR' } as Parameters<ReturnType<typeof S>['addResource']>[0]);
  S().assignResource(ids.B1, res, 1);
  const before = appliedEvents();
  S().dissolveTasksBulk([ids.F]);
  eq('34 alleen de kopregel weg', names(), ['A', 'B1', 'B2', 'B3', 'C', 'G', 'H']);
  eq('35 subtaken schuiven op de plek van de kopregel', order(), ['A', 'G', 'B1', 'B2', 'B3', 'H', 'C']);
  eq('36 subtaken hangen nu onder de ouder van de kopregel', ['B1', 'B2', 'B3'].map(parentName), ['G', 'G', 'G']);
  eq('37 relaties van de kopregel naar begin- en eindsubtaken, met soort en vertraging', relations(), [
    'A>B1 SS 2', 'A>B3 SS 2',
    'B1>B2 FS 0', 'B2>C FS 4', 'B3>C FS 0',
  ]);
  // B2 → C einde-begin +4 bestond al: de overgezette einde-begin is dan een duplicaat en vervalt.
  eq('38 toewijzing van een subtaak blijft', S().assignments.map(a => a.taskId), [ids.B1]);
  eq('39 één undo-stap', appliedEvents(), before + 1);
  S().undo();
  eq('40 undo: fase terug met haar subtaken', ['B1', 'B2', 'B3'].map(parentName), ['F', 'F', 'F']);
  eq('41 undo: relaties terug', relations(), ['A>F SS 2', 'B1>B2 FS 0', 'B2>C FS 4', 'F>C FS 0']);
}
{
  // Een fase op het hoogste niveau, een subfase als begin- en eindsubtaak, en een gewone taak in
  // dezelfde selectie: die laatste krijgt gewoon Dissolve.
  const ids = plan(['A', 'F', 'S', 'S1', 'X', 'C', 'D']);
  S().moveTask(ids.S, ids.F, 0);
  S().moveTask(ids.S1, ids.S, 0);
  link(ids, 'A', 'F');
  link(ids, 'F', 'C');
  link(ids, 'C', 'X');
  link(ids, 'X', 'D');
  S().dissolveTasksBulk([ids.F, ids.X]);
  eq('42 fase op het hoogste niveau: subfase wordt een fase op het hoogste niveau', parentName('S'), null);
  eq('43 subfase op de plek van de kopregel', order(), ['A', 'S', 'S1', 'C', 'D']);
  eq('44 subfase krijgt de relaties, de gewone taak wordt overbrugd', relations(),
    ['A>S FS 0', 'C>D FS 0', 'S>C FS 0']);
}
{
  // Een gewone taak in de stand "alleen de kopregel": geen verschil.
  const ids = plan(['A', 'B', 'C']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  S().dissolveTasksBulk([ids.B]);
  eq('45 gewone taak: zoals altijd', relations(), ['A>C FS 0']);
}
S().setUI({ dissolveSummaryMode: 'branch' });
{
  const registry = fs.readFileSync(path.join(process.cwd(), 'src/utils/settingsRegistry.ts'), 'utf8');
  eq('46 instelling wordt bewaard', /key: 'dissolveSummaryMode', field: 'dissolveSummaryMode'/.test(registry), true);
  const panel = fs.readFileSync(path.join(process.cwd(), 'src/components/settings/SettingsPanelContent.tsx'), 'utf8');
  eq('47 instelling staat in het gedeelde paneel', /saveDissolveSummaryMode/.test(panel) && /settings\.dissolveSummaryMode/.test(panel), true);
}

// ── 10) opdracht, lint en rechtsklikmenu ────────────────────────────────────
{
  const ids = plan(['A', 'B', 'C', 'D']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  link(ids, 'C', 'D');
  S().selectTask(ids.B, false);
  S().selectTask(ids.C, true);
  contextMenuBulk.dissolve(ids.C);
  eq('29 rechtsklik binnen de selectie heft de hele selectie op', relations(), ['A>D FS 0']);
}
{
  const groups: RibbonGroupSpec[] = Object.values(RIBBON_TABS).flat();
  const ids = JSON.stringify(groups.filter(g => g.id === 'edit'));
  eq('30 lint: Dissolve in de groep Bewerken', ids.includes('"dissolve"'), true);
  const ribbon = fs.readFileSync(path.join(process.cwd(), 'src/components/layout/Ribbon/ribbonConfig.tsx'), 'utf8');
  eq('30b lintknop: uit zonder selectie, heft de selectie op',
    /disabled: !hasSelection,\s*onClick: \(\) => \{\s*const s = useAppStore\.getState\(\);\s*s\.dissolveTasksBulk\(s\.selectedTaskIds\)/.test(ribbon), true);
  const menu = fs.readFileSync(path.join(process.cwd(), 'src/components/canvas/ContextMenu.tsx'), 'utf8');
  eq('31 rechtsklikmenu kent Dissolve', /context\.dissolve/.test(menu) && /onDissolve/.test(menu), true);
  for (const file of ['src/components/canvas/GanttCanvas.tsx', 'src/components/task-grid/FullTaskGrid.tsx']) {
    const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    eq(`32 ${file} hangt Dissolve aan de gedeelde route`, /contextMenuBulk\.dissolve/.test(src), true);
  }
}

if (diffs.length > 0) {
  console.error(`XX check-dissolve-tasks: ${diffs.length} van ${checks} checks rood`);
  for (const d of diffs) console.error(`XX ${d}`);
  process.exit(1);
}
console.log(`check-dissolve-tasks: alle ${checks} checks groen`);
