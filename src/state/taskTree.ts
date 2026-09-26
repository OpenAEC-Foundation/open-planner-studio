// Boomprimitieven voor de takenhiërarchie.
//
// De hiërarchie heeft DRIE waarheidsbronnen die in de pas moeten blijven: `task.parentId`,
// `parent.childIds` (de zichtbare volgorde, zie `visibleRows.ts`) en de volgorde van de rauwe
// `s.tasks`-array (WBS-nummering, zie `utils/wbs.ts` `flattenOrder`). Elke mutatie moet ze alle drie
// kloppend achterlaten. Deze module is de gedeelde definitie, zodat geen callsite een guard mist die
// een andere wél heeft; als pure functies zijn ze headless te toetsen.
//
// Aangesloten: `taskSlice` (`applyTaskPlacement`, `moveTask`, `deleteTask`, `deleteTasksBulk`,
// `copyTasks`, de bulk-move), `selectionSlice` (kopiëren), `runtime/createMcpTransactions.ts`
// (aanmaken, verhangen, verwijderen) en `wbsTemplates`. De verwijderpaden delen `removeTaskSubtrees`,
// zodat ze niet uit elkaar lopen in wat ze opruimen. NIET aangesloten, bewust: de
// positie-herinvoeging bij `position` in `createMcpTransactions.ts` en `siblingIdsOf` in
// `engine/view/dropTarget.ts` (werkt op weergaverijen, niet op `tasks`).
// `tests/planning/check-task-tree.ts` bewaakt met een bron-assert dat `taskSlice` en `wbsTemplates`
// aangesloten blijven.
//
// WERKT OP IMMER-DRAFTS. Deze functies MUTEREN de meegegeven array/objecten. Dat is opzet: ze
// worden binnen `set((s) => ...)` aangeroepen, waar `s.tasks` een draft is. Ze doen bewust géén
// undo-snapshot, geen `applyWbsNumbering` en geen `finishMutation` — dat blijft de
// verantwoordelijkheid van de aanroepende actie, zodat één gebruikershandeling één undo-stap
// blijft.
//
// WAT HIER NIET IN HOORT: de rauwe-array-herordening. Die is per callsite anders (achteraan, bij
// een anker, op een expliciete positie) en zit in `applyTaskPlacement`; hem hierheen halen zou een
// functie met vier vlaggen opleveren in plaats van een primitieve. Eén uitzondering: `reparentTask`,
// de verhanging van de MCP-draft (`planner_move_task`); de store-`moveTask` (`moveTaskEdit` in
// `taskSlice.ts`) doet hetzelfde op zijn proefkopie en moet daarmee in de pas blijven.
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { ResourceAssignment } from '@/types/resource';

/**
 * Haalt `id` uit de `childIds` van zijn HUIDIGE ouder. Laat `task.parentId` met rust — de
 * aanroeper zet die zelf, meestal direct daarna. Doet niets als de taak geen ouder heeft of de
 * ouder niet (meer) bestaat.
 */
export function detachFromParent(tasks: Task[], id: string): void {
  const task = tasks.find(t => t.id === id);
  if (!task?.parentId) return;
  const parent = tasks.find(t => t.id === task.parentId);
  if (parent) parent.childIds = parent.childIds.filter(cid => cid !== id);
}

/**
 * Zet `id` in de `childIds` van `parentId` en zet `task.parentId`. `index` ontbreekt of valt buiten
 * bereik ⇒ achteraan (geklemd, niet afgekapt — een te grote index was anders een stille sprong).
 * `parentId === null` maakt de taak root: alleen `parentId` wordt gezet, er is geen lijst om in te
 * voegen.
 *
 * Roep hiervóór {@link detachFromParent} aan; deze functie haalt de taak NIET bij zijn oude ouder
 * weg. Die splitsing is bewust — een verplaatsing binnen dezelfde ouder moet eerst verwijderen en
 * dán invoegen, anders staat de taak er twee keer in.
 */
export function attachToParent(tasks: Task[], id: string, parentId: string | null, index?: number): void {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.parentId = parentId;
  if (parentId === null) return;
  const parent = tasks.find(t => t.id === parentId);
  if (!parent) return;
  const at = index === undefined
    ? parent.childIds.length
    : Math.max(0, Math.min(index, parent.childIds.length));
  parent.childIds.splice(at, 0, id);
}

/**
 * Is `candidateId` de taak `ancestorId` zelf, of een afstammeling ervan? Dit is de cyklusguard:
 * een taak onder zichzelf of onder een eigen kind hangen maakt een lus waar `flattenOrder` en de
 * rijenberekening niet uit komen.
 *
 * Loopt OMHOOG vanaf de kandidaat, met een bezocht-set. Die set is geen luxe: een bestand met een
 * al bestaande lus (bv. een IFC-import die `parentId` zonder cyklusguard zet) zou een naïeve lus
 * laten hangen in plaats van hem te melden.
 */
export function isSelfOrDescendant(tasks: Task[], candidateId: string, ancestorId: string): boolean {
  const bezocht = new Set<string>();
  let cur: Task | undefined = tasks.find(t => t.id === candidateId);
  while (cur && !bezocht.has(cur.id)) {
    if (cur.id === ancestorId) return true;
    bezocht.add(cur.id);
    cur = cur.parentId ? tasks.find(t => t.id === cur!.parentId) : undefined;
  }
  return false;
}

/**
 * De verhanging van de MCP-draft (`planner_move_task`), gelijk aan `moveTaskEdit` in
 * `taskSlice.ts`: `id` onder `newParentId` (null = wortel), op `position` binnen de nieuwe ouder of
 * — zonder positie — achteraan, in `childIds` ÉN in de rauwe array. WBS-nummering (`flattenOrder`)
 * leest de RAUWE array-volgorde en negeert `childIds`; de zichtbare volgorde van niet-wortels leest
 * juist `childIds` (`visibleRows.ts`). Daarom moet de invoegplek op beide plekken kloppen — ook
 * zonder `position` (anders volgt het WBS-nummer de oude array-positie terwijl de taak zichtbaar
 * achteraan verschijnt). Nakomelingen blijven staan waar ze staan; `flattenOrder` herbouwt de boom
 * uit `parentId`. Geen guards: de aanroeper toetst bestaan en cykel vooraf.
 */
export function reparentTask(tasks: Task[], id: string, newParentId: string | null, position?: number): void {
  detachFromParent(tasks, id);
  attachToParent(tasks, id, newParentId, position);
  // Rauwe array: haal de taak eruit en zet hem terug zó dat hij — gerekend over alléén zijn siblings
  // (taken met dezelfde parentId, in array-volgorde) — op index `position` (of achteraan) staat.
  const fromIdx = tasks.findIndex(t => t.id === id);
  if (fromIdx < 0) return;
  const [moved] = tasks.splice(fromIdx, 1);
  const sibIdx: number[] = [];
  tasks.forEach((t, i) => { if (t.parentId === newParentId) sibIdx.push(i); });
  const at = position === undefined
    ? sibIdx.length
    : Math.max(0, Math.min(position, sibIdx.length)); // klem naar [0, aantal siblings]
  let insertAt: number;
  if (at < sibIdx.length) {
    insertAt = sibIdx[at];                       // vóór de huidige `at`-de sibling
  } else if (sibIdx.length > 0) {
    insertAt = sibIdx[sibIdx.length - 1] + 1;    // achter de laatste sibling
  } else if (newParentId) {
    const p = tasks.findIndex(t => t.id === newParentId);
    insertAt = p >= 0 ? p + 1 : tasks.length;    // enig kind: vlak achter de ouder
  } else {
    insertAt = tasks.length;                     // enige wortel: achteraan
  }
  tasks.splice(insertAt, 0, moved);
}

/**
 * Alle ids in de deelboom onder (en inclusief) `rootId`, in pre-order. Gebruikt door verwijderen,
 * kopiëren en het opslaan van een tak als sjabloon.
 *
 * Zelfde bezocht-bewaking als hierboven, en om dezelfde reden: een corrupte `childIds` die naar een
 * voorouder terugwijst zou anders oneindig doorlopen.
 */
export function collectSubtreeIds(tasks: Task[], rootId: string): string[] {
  const out: string[] = [];
  const bezocht = new Set<string>();
  const walk = (id: string) => {
    if (bezocht.has(id)) return;
    bezocht.add(id);
    out.push(id);
    const t = tasks.find(x => x.id === id);
    if (t) for (const cid of t.childIds) walk(cid);
  };
  walk(rootId);
  return out;
}

/** Minimale state-vorm voor {@link removeTaskSubtrees} (subset van AppState). */
interface TaskRemovalState {
  tasks: Task[];
  sequences: Sequence[];
  assignments: ResourceAssignment[];
  selectedTaskIds: string[];
  activeTaskId: string | null;
}

/**
 * Verwijdert de deelbomen onder (en inclusief) `rootIds`: haalt elke wortel bij zijn ouder weg en
 * ruimt taken, relaties met een verwijderd eindpunt, toewijzingen en de selectie op; wees de actieve
 * taak naar een verwijderde taak, dan wordt de eerste resterende selectie actief. Retourneert
 * alle verwijderde ids. `rootIds` moeten bestaan (de aanroeper guardt, vóór zijn snapshot); een
 * wortel die zelf in de deelboom van een andere zit, is geen probleem.
 */
export function removeTaskSubtrees(s: TaskRemovalState, rootIds: readonly string[]): Set<string> {
  const removeIds = new Set<string>();
  for (const id of rootIds) {
    detachFromParent(s.tasks, id);
    for (const subtreeId of collectSubtreeIds(s.tasks, id)) removeIds.add(subtreeId);
  }
  s.tasks = s.tasks.filter(t => !removeIds.has(t.id));
  s.sequences = s.sequences.filter(seq => !removeIds.has(seq.predecessorId) && !removeIds.has(seq.successorId));
  s.assignments = s.assignments.filter(a => !removeIds.has(a.taskId));
  s.selectedTaskIds = s.selectedTaskIds.filter(sid => !removeIds.has(sid));
  if (s.activeTaskId && removeIds.has(s.activeTaskId)) s.activeTaskId = s.selectedTaskIds[0] ?? null;
  return removeIds;
}

/**
 * De ids van de kinderen van `parentId`, in ZICHTBARE volgorde: `childIds` voor een echte ouder,
 * de rauwe array-volgorde voor de root (`parentId === null`). Dat verschil is geen slordigheid —
 * `visibleRows` leest voor niet-root-taken `childIds` en voor roots de array-volgorde.
 *
 * Neemt bewust een PARENT-id en niet een taak-id: dat is wat elke aanroeper nodig heeft (waar komt
 * deze taak tussen zijn buren te staan), en het werkt ook voor een ouder waarvan het kind nog niet
 * bestaat.
 */
export function siblingIds(tasks: Task[], parentId: string | null): string[] {
  if (parentId === null) return tasks.filter(t => !t.parentId).map(t => t.id);
  return tasks.find(t => t.id === parentId)?.childIds ?? [];
}
