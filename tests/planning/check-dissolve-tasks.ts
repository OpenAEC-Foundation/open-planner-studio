// Opheffen (Dissolve, issue #887) — headless tegen de echte store.
//
// Eigenaarsbesluit 2026-11-14: Opheffen staat naast Verwijderen. De taak gaat weg en de keten
// blijft heel: A → B → C wordt A → C. De nieuwe relatie is altijd einde-begin zonder vertraging,
// van elke voorganger naar elke opvolger. Verder volgt Opheffen Verwijderen: toewijzingen gaan mee
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
// Keuzepunt 2 (`alreadyLinked`), ligt bij de eigenaar: check 12 volgt de aanbeveling.
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
// Keuzepunt 1 (`blockOf`), ligt bij de eigenaar: checks 21 en 22 volgen de aanbeveling.
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
  // Fase F met losse kinderen B1 en B2: X → B1, B2 → Y en Y → X is geen kring. Als blok opgeheven
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
  eq('30 lint: Opheffen in de groep Bewerken', ids.includes('"dissolve"'), true);
  const ribbon = fs.readFileSync(path.join(process.cwd(), 'src/components/layout/Ribbon/ribbonConfig.tsx'), 'utf8');
  eq('30b lintknop: uit zonder selectie, heft de selectie op',
    /disabled: !hasSelection,\s*onClick: \(\) => \{\s*const s = useAppStore\.getState\(\);\s*s\.dissolveTasksBulk\(s\.selectedTaskIds\)/.test(ribbon), true);
  const menu = fs.readFileSync(path.join(process.cwd(), 'src/components/canvas/ContextMenu.tsx'), 'utf8');
  eq('31 rechtsklikmenu kent Opheffen', /context\.dissolve/.test(menu) && /onDissolve/.test(menu), true);
  for (const file of ['src/components/canvas/GanttCanvas.tsx', 'src/components/task-grid/FullTaskGrid.tsx']) {
    const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    eq(`32 ${file} hangt Opheffen aan de gedeelde route`, /contextMenuBulk\.dissolve/.test(src), true);
  }
}

if (diffs.length > 0) {
  console.error(`XX check-dissolve-tasks: ${diffs.length} van ${checks} checks rood`);
  for (const d of diffs) console.error(`XX ${d}`);
  process.exit(1);
}
console.log(`check-dissolve-tasks: alle ${checks} checks groen`);
