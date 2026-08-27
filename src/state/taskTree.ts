// Boomprimitieven voor de takenhiërarchie (K-item 35).
//
// HET PROBLEEM. De hiërarchie heeft DRIE waarheidsbronnen die met de hand in de pas gehouden
// worden: `task.parentId`, `parent.childIds` (de zichtbare volgorde, zie `visibleRows.ts`) en de
// volgorde van de rauwe `s.tasks`-array (WBS-nummering, zie `utils/wbs.ts` `flattenOrder`). Elke
// mutatie moet ze alle drie kloppend achterlaten, en dat gebeurde tot nu toe met overgetypte
// regels: `childIds.filter(c => c !== id)` stond vier keer, `childIds.splice(at, 0, id)` drie keer,
// en de recursieve afstammelingenverzamelaar vier keer — verspreid over `taskSlice.ts`,
// `mcpTransaction.ts` en `wbsTemplates.ts`.
//
// Die kopieën zijn niet identiek gebleven, en dat is het punt: elk van die plekken kan een guard
// missen die de andere wél heeft, zonder dat iets omvalt. Deze module is de gedeelde definitie, en
// omdat het pure functies zijn zijn ze headless te toetsen — precies wat de losse regels midden in
// een Immer-producer niet waren.
//
// STAND VAN DE CONSOLIDATIE (een eerdere versie van deze kop beweerde "maakt er één definitie
// van"; dat was toen niet waar en twee reviews wezen het aan). Aangesloten: `taskSlice`
// (`applyTaskPlacement`, `moveTask`, `deleteTask`, `copyTasks`, de bulk-move), `mcpTransaction`
// (aanmaken + verwijderen) en `wbsTemplates`. NIET aangesloten, bewust: de detach/attach in
// `mcpTransaction.ts` rond regel 320 en de sibling-hulpjes `siblingIdsOf` (`taskSlice.ts`) en de
// variant in `dropTarget.ts` — die laatste twee werken op andere invoer dan `siblingIds` hier.
// `tests/planning/check-task-tree.ts` bewaakt met een bron-assert dat de aangesloten plekken
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
// functie met vier vlaggen opleveren in plaats van een primitieve.
import type { Task } from '@/types/task';

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
 * Alle ids in de deelboom onder (en inclusief) `rootId`, in pre-order. Gebruikt door verwijderen,
 * kopiëren en het opslaan van een tak als sjabloon.
 *
 * Zelfde bezocht-bewaking als hierboven, en om dezelfde reden: een corrupte `childIds` die naar een
 * voorouder terugwijst zou anders oneindig doorlopen. De vier handgeschreven varianten die dit
 * verving hadden die bewaking géén van alle.
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

/**
 * De ids van de kinderen van `parentId`, in ZICHTBARE volgorde: `childIds` voor een echte ouder,
 * de rauwe array-volgorde voor de root (`parentId === null`). Dat verschil is geen slordigheid —
 * `visibleRows` leest voor niet-root-taken `childIds` en voor roots de array-volgorde.
 *
 * Neemt bewust een PARENT-id en niet een taak-id: dat is wat elke aanroeper nodig heeft (waar komt
 * deze taak tussen zijn buren te staan), en het werkt ook voor een ouder waarvan het kind nog niet
 * bestaat. Een eerdere versie nam een taak-id en had daardoor nul aanroepers — dode code die drie
 * testchecks bezighield.
 */
export function siblingIds(tasks: Task[], parentId: string | null): string[] {
  if (parentId === null) return tasks.filter(t => !t.parentId).map(t => t.id);
  return tasks.find(t => t.id === parentId)?.childIds ?? [];
}
