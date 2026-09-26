import type { Task } from '@/types/task';
import type { ResourceAssignment } from '@/types/resource';
import { applyRemainingDuration, defaultActualFinish, defaultActualStart } from '@/engine/taskMutationRules';
import { orderActualsAfterDerivedFinish } from '@/engine/actualDatesOrder';
import { workRuleFromMsp, workRuleFromXerDurationType } from '@/engine/work/workRuleMapping';

/**
 * De WERKREGEL afleiden uit de bewaarde importvelden, één keer, in elke lezer die zulke velden zet
 * (.mpp, MSPDI, P6 XML, XER). De importvelden zelf blijven onaangeraakt; de regel is een
 * apart opgeslagen afgeleide, zodat een latere typewissel de herkomst niet vernietigt.
 *   - MSP: `mspTaskType` + `effortDriven` → `workRuleFromMsp` (Fixed Units ⇒ FIXED_RATE, Fixed
 *     Duration ± effort-driven ⇒ FIXED_DURATION_WORK/-RATE, Fixed Work ⇒ FIXED_WORK).
 *   - P6 (XER én PMXML, beide via `p6DurationType`): `workRuleFromXerDurationType`.
 * Een taak die al een `workRule` draagt (IFC) wordt niet overschreven; geen bron ⇒ geen veld.
 * Puur data — géén solverstap leest het; het gedrag komt in de bewerkingslaag.
 */
export function deriveImportedWorkRules(tasks: Task[]): void {
  for (const task of tasks) {
    if (task.workRule) continue;
    const rule = task.mspTaskType
      ? workRuleFromMsp(task.mspTaskType, task.effortDriven)
      : workRuleFromXerDurationType(task.p6DurationType);
    if (rule) task.workRule = rule;
  }
}

/**
 * Voortgang-invarianten toepassen op RAUW ingelezen taken (IFC/MSPDI/P6/CSV).
 *
 * Externe bestanden kunnen inconsistente combinaties bevatten (bv. een `actualFinish` zonder
 * `completion === 1`, of een `RemainingDuration` die niet strookt met het percentage). De store
 * dwingt deze invarianten normaal af in de progress-acties, maar de reader zet de velden
 * rauw. Deze helper normaliseert daarom bij het INLEZEN — één plek die álle load-paden dekt
 * (openFile, voorbeelden, recovery, IFC-panel-plak, extensie-API), omdat elke route door een
 * reader loopt.
 *
 * Golden rule: een taak ZONDER enig voortgangssignaal (geen actuals, completion 0) blijft
 * volledig ongemoeid — status NOT_STARTED, geen `remainingTime` gezet — zodat bestaande
 * bestanden ongewijzigd round-trippen. De restduur is afgeleid uit `completion`
 * (`applyRemainingDuration`): een afwijkende geïmporteerde dag-restduur wordt naar de afgeleide
 * genormaliseerd (gedocumenteerd verlies); vastgelegde restduur-minuten van een urentaak blijven
 * staan.
 */
export function normalizeImportedProgress(tasks: Task[], statusDate?: string): void {
  for (const task of tasks) {
    const t = task.time;

    // Completion klemmen op 0..1 (rauwe import kan buiten bereik liggen).
    if (!Number.isFinite(t.completion)) t.completion = 0;
    t.completion = Math.min(1, Math.max(0, t.completion));

    const hasProgress = !!(t.actualStart || t.actualFinish || t.completion > 0);
    if (!hasProgress) {
      // Geen voortgang: laat alle tracking-velden ongemoeid (byte-stabiliteit) en zet status.
      task.status = 'NOT_STARTED';
      continue;
    }

    // Voortgang-invarianten (spiegel van applyProgressInvariants, engine/taskMutationRules.ts). De
    // AF-default is niet gespiegeld maar GEDEELD (`defaultActualFinish`): statusdatum, anders de
    // eigen geplande finish — nooit de leesdatum.
    if (t.actualFinish) {
      t.completion = 1;
      if (!t.actualStart) t.actualStart = t.actualFinish;
      task.status = 'COMPLETED';
    } else if (t.completion >= 1) {
      t.completion = 1;
      // Zelfde volgorde en regels als de store (`setTaskProgress`): eerst de impliciete start (de
      // eigen geplande start, niet AS = AF — anders krimpt de voltooide balk), dan de AF-default.
      if (!t.actualStart) t.actualStart = defaultActualStart(t);
      t.actualFinish = defaultActualFinish(t, statusDate);
      // Geplande start ná de statusdatum ⇒ AS lag ná het afgeleide einde; zelfde regel als de store.
      orderActualsAfterDerivedFinish(t, statusDate);
      task.status = 'COMPLETED';
    } else {
      // In progress: actualStart gezet óf completion > 0 (impliciete start dekt het
      // solver-vangnet — hier NIET een actualStart verzinnen).
      task.status = 'STARTED';
    }

    // Restduur afgeleid met dezelfde regel als de store, in de vorm van de duur: een
    // dagtaak hele werkdagen (een geïmporteerde waarde wordt overschreven), een urentaak minuten plus
    // een onafgeronde werkdagfractie. Uitzondering: in het bestand vastgelegde restduur-MINUTEN
    // blijven staan (MSP's eigen exacte restduur bij een afgeronde voortgang).
    applyRemainingDuration(task, true);
  }
}

/**
 * Herbouw de parent-child-hiërarchie uit gepunte WBS-codes — gedeeld door de MSPDI- en
 * CSV-readers. Een taak met een punt in zijn `wbsCode` (bv.
 * `1.2.3`) hangt onder de taak met de code één niveau hoger (`1.2`), als die bestaat. Bouwt zijn
 * eigen `wbsCode → id`-map, muteert `parentId`/`childIds` in-place en dupliceert nooit een childId.
 */
export function rebuildWbsHierarchy(tasks: Task[]): void {
  const wbsToId = new Map<string, string>();
  for (const task of tasks) wbsToId.set(task.wbsCode, task.id);

  for (const task of tasks) {
    if (!task.wbsCode || !task.wbsCode.includes('.')) continue;
    const parts = task.wbsCode.split('.');
    parts.pop();
    const parentWbs = parts.join('.');
    const parentId = wbsToId.get(parentWbs);
    if (parentId) {
      task.parentId = parentId;
      const parent = tasks.find(t => t.id === parentId);
      if (parent && !parent.childIds.includes(task.id)) {
        parent.childIds.push(task.id);
      }
    }
  }
}

/**
 * Ouder per taak uit OUTLINE-NIVEAUS in documentvolgorde — de MS-Project-semantiek:
 * een taak hangt onder de dichtstbijzijnde VOORAFGAANDE taak met een lager niveau. `levels[i]` hoort
 * bij `tasks[i]`. Geeft `undefined` zodra één niveau ontbreekt of geen geheel getal ≥ 0 is; een
 * 0-gebaseerde reeks (sommige exporteurs tellen vanaf 0) wordt genormaliseerd naar 1-gebaseerd.
 * Een sprong van meer dan één niveau (1 → 3) is tolerant, zoals MS Project dat ook oplost.
 * PUUR: raakt de taken niet aan.
 */
function outlineParents(tasks: readonly Task[], levels: readonly (number | undefined)[]): Map<string, string | null> | undefined {
  if (levels.length !== tasks.length || tasks.length === 0) return undefined;
  if (!levels.every(l => l !== undefined && Number.isInteger(l) && l >= 0)) return undefined;
  const shift = Math.min(...(levels as number[])) === 0 ? 1 : 0;
  const parents = new Map<string, string | null>();
  const stack: { id: string; level: number }[] = [];
  for (let i = 0; i < tasks.length; i++) {
    const level = levels[i]! + shift;
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
    parents.set(tasks[i].id, stack[stack.length - 1]?.id ?? null);
    stack.push({ id: tasks[i].id, level });
  }
  return parents;
}

/**
 * Ouder per taak uit GEPUNTE WBS-codes (`1.2.3` hangt onder `1.2`), plus of die afleiding een
 * VOLLEDIGE boom oplevert: alle codes uniek, minstens één gepunte code, en elke gepunte code vindt
 * haar ouder. Alleen een volledige boom is bewijskrachtig genoeg om een outline-afleiding te
 * overstemmen (zie `rebuildImportedHierarchy`). PUUR.
 */
function wbsParents(tasks: readonly Task[]): { parents: Map<string, string | null>; complete: boolean } {
  const wbsToId = new Map<string, string>();
  let unique = true;
  for (const t of tasks) {
    if (wbsToId.has(t.wbsCode)) unique = false;
    wbsToId.set(t.wbsCode, t.id);
  }
  const parents = new Map<string, string | null>();
  let dotted = 0;
  let resolved = 0;
  for (const t of tasks) {
    let parent: string | null = null;
    if (t.wbsCode && t.wbsCode.includes('.')) {
      dotted++;
      const parts = t.wbsCode.split('.');
      parts.pop();
      const p = wbsToId.get(parts.join('.'));
      if (p && p !== t.id) { parent = p; resolved++; }
    }
    parents.set(t.id, parent);
  }
  return { parents, complete: unique && dotted > 0 && resolved === dotted };
}

function applyParents(tasks: Task[], parents: Map<string, string | null>): void {
  const byId = new Map(tasks.map(t => [t.id, t]));
  for (const t of tasks) {
    const p = parents.get(t.id) ?? null;
    if (!p) continue;
    const parent = byId.get(p);
    if (!parent) continue;
    t.parentId = p;
    if (!parent.childIds.includes(t.id)) parent.childIds.push(t.id);
  }
}

/** Welke bron de boom leverde — voor tests en meldingen. */
export type ImportedHierarchySource = 'outline' | 'wbs';

/**
 * Herbouw de parent-child-hiërarchie van een geïmporteerde takenlijst.
 * Twee bronnen: de outline-niveaus (`<OutlineLevel>` in MSPDI, de 'Outline Level'-kolom in CSV) en de
 * gepunte WBS-codes. Beslisregel:
 *
 *  1. Leveren de gepunte codes een VOLLEDIGE boom (`wbsParents.complete`) die de outline-afleiding
 *     ergens tegenspreekt, dan wint de WBS. Dat is het geval van onze eigen oudere exports:
 *     die schreven `<OutlineLevel>` uit `wbsCode.split('.').length` in store-volgorde ("samenvattingen
 *     eerst, dan bladen") — het niveau staat er, maar de VOLGORDE klopt niet, dus de outline-stack
 *     hangt de bladen onder de laatste samenvatting terwijl de codes de boom exact beschrijven. Die
 *     bestanden hebben gebruikers liggen; ze moeten blijven lezen zoals ze altijd lazen.
 *  2. Anders wint de outline zodra hij bruikbaar is: dat is wat MS Project zelf bedoelt, en het enige
 *     dat klopt zodra de WBS vrije tekst (`T107`, `A-1`) of een eigen masker is.
 *  3. Zonder bruikbare outline: de gepunte-WBS-afleiding zoals altijd (ook een gedeeltelijke).
 *
 * Een bestand van MS Project zelf (outline-nummer = standaard-WBS) of een huidige export (boom-
 * volgorde) valt in 1 en 2 op hetzelfde uit; de regel doet alleen iets bij een echte tegenspraak.
 * Muteert `parentId`/`childIds` in-place; geeft de gebruikte bron terug.
 */
export function rebuildImportedHierarchy(tasks: Task[], levels: readonly (number | undefined)[]): ImportedHierarchySource {
  const outline = outlineParents(tasks, levels);
  const wbs = wbsParents(tasks);
  const outlineUsable = outline !== undefined;
  const conflict = outlineUsable && wbs.complete
    && tasks.some(t => (outline.get(t.id) ?? null) !== (wbs.parents.get(t.id) ?? null));
  if (outlineUsable && !conflict) {
    applyParents(tasks, outline);
    return 'outline';
  }
  rebuildWbsHierarchy(tasks);
  return 'wbs';
}

/**
 * `task.resourceIds` reconstrueren uit de assignments. De bestanden slaan de
 * taak↔resource-koppeling uitsluitend op via de toewijzingen (IFC: IFCRELASSIGNSTOPROCESS +
 * OPS_Assignments); `resourceIds` is een afgeleide projectie daarvan en wordt NIET los bewaard (geen
 * dubbele opslag/waarheid). Gedeeld door de lezers die toewijzingen kennen. Volgorde is deterministisch: eerste-zien in de
 * assignments-volgorde, met deduplicatie (één resource kan meerdere assignments op één taak hebben).
 */
export function reconstructResourceIds(tasks: Task[], assignments: ResourceAssignment[]): void {
  const byTask = new Map<string, string[]>();
  for (const a of assignments) {
    let list = byTask.get(a.taskId);
    if (!list) { list = []; byTask.set(a.taskId, list); }
    if (!list.includes(a.resourceId)) list.push(a.resourceId);
  }
  for (const t of tasks) {
    const ids = byTask.get(t.id);
    if (ids) t.resourceIds = ids;
  }
}
