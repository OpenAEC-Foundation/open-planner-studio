// Selectie + klembord.
//
// Deze twee horen bij elkaar en niet bij `taskSlice`: het klembord werkt op de selectie, en beide
// zijn iets anders dan de taken zelf. Het onderscheid dat ze deelt is de UNDO-regel — selectie is
// GEEN documentdata en pusht dus nooit een undo-snapshot, terwijl plakken dat juist wél doet omdat
// het taken aanmaakt. Die regel stond eerder verspreid in commentaar tussen 1100 regels
// taakmutaties; hier is hij de reden dat het bestand bestaat.
//
// Documentcontract: `selectedTaskIds` en `activeTaskId` zijn PER DOCUMENT (ze reizen mee bij een documentwissel,
// `snapshot: 'none'` — je selectie hoort niet in een undo-stap), `taskClipboard` is APP-GLOBAAL,
// zodat kopiëren en plakken tussen documenten werkt. Beide velden blijven op het top-level van
// `AppState` staan, dus `documentContract.ts` verandert niet mee: die leest `s.selectedTaskIds`,
// niet `s.selection.selectedTaskIds`.
import type { AppSliceFactory, SelectionAnchor } from './types';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { isCostResource, type ResourceAssignment } from '@/types/resource';
import type { TaskAssignmentResourceKind } from '@/types/taskGrid';
import { subtreeCollector } from '@/state/taskTree';
import { generateId } from '@/utils/id';
import {
  assignInsertedWbsCodes, insertRemappedRelations, normalizeInsertedBranch, notifyAssignmentsSkipped, notifyReferencesCleared,
  notifyRelationsSkipped,
} from '@/state/insertedBranch';
import {
  normalizeTaskRowCursor,
  uniqueTaskIds,
  type TaskRowCursor,
  type ViewRow,
} from '@/engine/view/visibleRows';

/**
 * Productiegrens tussen een occurrence-cursor en de domeinselectie. Alleen wanneer reconciliatie
 * werkelijk op een andere taak uitkomt, wordt de enkelvoudige taakselectie meegeschoven. Een
 * identieke occurrence met alleen een nieuwe absolute rijindex laat de selectie ongemoeid.
 */
export function reconcileTaskCursorSelection(
  rows: readonly ViewRow[],
  cursor: TaskRowCursor | null,
  selectTask: (taskId: string) => void,
): TaskRowCursor | null {
  const next = normalizeTaskRowCursor(rows, cursor);
  if (cursor !== null && next !== null && next.taskId !== cursor.taskId) selectTask(next.taskId);
  return next;
}

export interface TaskClipboard {
  tasks: Task[];
  sequences: Sequence[];
  assignments: ResourceAssignment[];
  /** Per resource van `assignments` de soort in het brondocument (issue #815). Het klembord is
   *  app-globaal: in het doel kan dezelfde id een ander type hebben. Plakken toetst de soort hiertegen,
   *  niet aan `costAmount` of `curve` (een kostentoewijzing kan zonder bedrag). Een resource die in de
   *  bron ontbrak, staat er niet in: die soort is onbekend en de toewijzing wordt niet geplakt. */
  resourceKinds: Record<string, TaskAssignmentResourceKind>;
  /** Kopieerde het raster (de kolommen) deze taken, dan de celtekst die het op het systeemklembord zette
   *  en de planning waaruit (issue #900). Zie `pastesGridTaskCopy`. */
  fromGrid?: { text: string; documentId: string };
}

const sameClipboardText = (text: string) => text.replace(/\r\n/g, '\n');

/**
 * Plakt het raster de taken in plaats van celwaarden? Alleen als de tekst op het systeemklembord nog
 * die van de laatste rasterkopie is EN het doel een andere planning is (issue #900). Binnen dezelfde
 * planning, en met tekst van buiten (Excel), blijft het raster celwaarden plakken.
 */
export function pastesGridTaskCopy(clip: TaskClipboard | null, text: string, documentId: string): boolean {
  return !!clip?.fromGrid && clip.fromGrid.documentId !== documentId
    && clip.fromGrid.text === sameClipboardText(text);
}

/** Wat er in de tijdlijn is aangeklikt (review #1004): de rij, en bij een groepsruitje (#868) zijn
 *  leden. Zonder `taskIds` alleen de taak zelf. */
export interface SelectedRow { rowKey?: string; taskIds?: readonly string[] }

/**
 * Shift-klik in de tijdlijn: de taken van het anker (`ui.selectionAnchor`) tot de aangeklikte rij,
 * over de rijen OP HET SCHERM (filter, sortering, groepering, ingeklapte fasen), net als Shift in de
 * takenlijst. Van de eindrijen tellen alleen de gekozen taken (anker, aangeklikt); liggen ze op één rij
 * (een mijlpalenreeks), dan alles daartussen in de volgorde van de rij. `null` als een van beide rijen
 * niet (meer) op het scherm staat.
 */
function shiftRange(
  rows: readonly ViewRow[],
  anchor: SelectionAnchor,
  clickedId: string,
  clicked: readonly string[],
  clickedRowKey: string | undefined,
): string[] | null {
  const idsAt = (index: number) => uniqueTaskIds([rows[index]]);
  const toIdx = rows.findIndex((row, index) => (clickedRowKey === undefined || row.rowKey === clickedRowKey)
    && idsAt(index).includes(clickedId));
  const fromIdx = rows.findIndex((row, index) => row.rowKey === anchor.rowKey
    && anchor.taskIds.some(taskId => idsAt(index).includes(taskId)));
  if (toIdx < 0 || fromIdx < 0) return null;
  if (fromIdx === toIdx) {
    const ids = idsAt(toIdx);
    const marks = [...anchor.taskIds, ...clicked].map(taskId => ids.indexOf(taskId)).filter(index => index >= 0);
    return ids.slice(Math.min(...marks), Math.max(...marks) + 1);
  }
  const fromIds = idsAt(fromIdx).filter(taskId => anchor.taskIds.includes(taskId));
  const toIds = idsAt(toIdx).filter(taskId => clicked.includes(taskId));
  const between = uniqueTaskIds(rows.slice(Math.min(fromIdx, toIdx) + 1, Math.max(fromIdx, toIdx)));
  return [...new Set(fromIdx < toIdx ? [...fromIds, ...between, ...toIds] : [...toIds, ...between, ...fromIds])];
}

/** Het anker voor Shift: `ui.selectionAnchor` als die rij nog op het scherm staat, anders de actieve
 *  taak (of de laatst gekozen) op haar eerste rij. */
function currentAnchor(s: {
  viewRows: readonly ViewRow[]; selectedTaskIds: readonly string[]; activeTaskId: string | null;
  ui: { selectionAnchor: SelectionAnchor | null };
}): SelectionAnchor {
  const anchor = s.ui.selectionAnchor;
  if (anchor && s.viewRows.some(row => row.rowKey === anchor.rowKey
    && anchor.taskIds.some(taskId => uniqueTaskIds([row]).includes(taskId)))) return anchor;
  const taskId = s.activeTaskId !== null && s.selectedTaskIds.includes(s.activeTaskId)
    ? s.activeTaskId
    : s.selectedTaskIds[s.selectedTaskIds.length - 1];
  const rowKey = s.viewRows.find(row => uniqueTaskIds([row]).includes(taskId))?.rowKey ?? '';
  return { rowKey, taskIds: [taskId] };
}

export interface SelectionSlice {
  selectedTaskIds: string[];
  /** Taak van de actieve cel/klik. Kan bewust buiten de meervoudige selectie vallen wanneer de
   * gebruiker die taak met Ctrl/Cmd uit de set togglet; het eigenschappenpaneel blijft hem volgen. */
  activeTaskId: string | null;
  taskClipboard: TaskClipboard | null;

  /** Selecteer een taak. `multi` (Ctrl/Cmd) togglet, `range` (Shift) breidt uit vanaf het anker
   *  (`shiftRange`). `row` is wat er in de tijdlijn is aangeklikt: dezelfde taak kan in meer rijen
   *  staan (groeperen op resource), en een groepsruitje (#868) kiest al zijn leden (`row.taskIds`).
   *  Met `row.rowKey` wordt die rij de cursorrij (`ui.gridActiveRowKey`) en, zonder Shift, het anker.
   *  Geen undo: selectie is geen documentdata. */
  selectTask: (id: string, multi?: boolean, range?: boolean, row?: SelectedRow) => void;
  deselectAll: () => void;
  /** Ctrl/Cmd+A: selecteer alle ZICHTBARE taken — leest `viewRows` (dezelfde
   *  zichtbaarheids-afleiding als de tabel/Gantt, respecteert dus ingeklapte groepen/summaries).
   *  Geen undo: selectie is geen documentdata. */
  selectAllTasks: () => void;
  /** Box-selectie: zet de selectie op precies `ids` (vervangen), of voeg ze
   *  toe aan de bestaande selectie (`additive`, Ctrl/Cmd tijdens het slepen). Met `anchor` (het kader in
   *  de tijdlijn: de bovenste taakrij) wordt dat het anker en de cursorrij. Geen undo. */
  selectTasks: (ids: string[], additive: boolean, activeTaskId?: string | null, anchor?: SelectionAnchor) => void;

  /** Kopieer de opgegeven takken (default: de huidige selectie) incl. subtaken naar het klembord.
   *  `gridText`: de celtekst als het raster kopieert (zie `TaskClipboard.fromGrid`). */
  copyTasks: (ids?: string[], gridText?: string) => void;
  /** Plak het klembord als nieuwe takken; geeft de nieuwe root-ids terug (leeg als er niets te
   *  plakken viel). Dit pusht WEL een undo-snapshot — er ontstaan taken. */
  pasteTasks: () => string[];
}

export const createSelectionSlice: AppSliceFactory<SelectionSlice> = (runtime) => (set, get) => ({
  selectedTaskIds: [],
  activeTaskId: null,
  taskClipboard: null,

  selectTask: (id, multi = false, range = false, row) =>
    set((s) => {
      const clicked = row?.taskIds ?? [id];
      const rangeIds = range && s.selectedTaskIds.length > 0
        ? shiftRange(s.viewRows, currentAnchor(s), id, clicked, row?.rowKey)
        : null;
      s.activeTaskId = id;
      if (row?.rowKey !== undefined) s.ui.gridActiveRowKey = row.rowKey;
      if (rangeIds) {
        // Vereniging met de bestaande selectie, het bereik in de volgorde van het scherm — ook als je
        // naar boven selecteert. De volgorde telt: koppelen als keten (issue #1000) volgt haar.
        // Eerder aangeklikte taken buiten het bereik blijven vooraan. Het anker blijft staan.
        const inRange = new Set(rangeIds);
        s.selectedTaskIds = [...s.selectedTaskIds.filter(taskId => !inRange.has(taskId)), ...rangeIds];
        return;
      }
      // Een klik zonder (bruikbaar) Shift is het nieuwe anker, ook bij uitvinken met Ctrl. Zonder rij
      // valt Shift terug op de actieve taak (`currentAnchor`).
      s.ui.selectionAnchor = row?.rowKey !== undefined ? { rowKey: row.rowKey, taskIds: [...clicked] } : null;
      if (multi && !range) {
        // Een groepsruitje gaat samen aan of uit.
        if (clicked.every(taskId => s.selectedTaskIds.includes(taskId))) {
          s.selectedTaskIds = s.selectedTaskIds.filter(taskId => !clicked.includes(taskId));
        } else {
          s.selectedTaskIds.push(...clicked.filter(taskId => !s.selectedTaskIds.includes(taskId)));
        }
      } else {
        s.selectedTaskIds = [...clicked];
      }
    }),

  deselectAll: () =>
    set((s) => {
      s.selectedTaskIds = [];
      s.activeTaskId = null;
      s.ui.selectionAnchor = null;
    }),

  selectAllTasks: () =>
    set((s) => {
      s.selectedTaskIds = uniqueTaskIds(s.viewRows);
      if (!s.activeTaskId || !s.selectedTaskIds.includes(s.activeTaskId)) {
        s.activeTaskId = s.selectedTaskIds[0] ?? null;
      }
    }),

  selectTasks: (ids, additive, activeTaskId, anchor) =>
    set((s) => {
      if (anchor) {
        s.ui.selectionAnchor = { rowKey: anchor.rowKey, taskIds: [...anchor.taskIds] };
        s.ui.gridActiveRowKey = anchor.rowKey;
      }
      const uniqueIds = [...new Set(ids)];
      if (!additive) {
        const nextActiveTaskId = activeTaskId === undefined ? (uniqueIds[0] ?? null) : activeTaskId;
        const unchanged = s.activeTaskId === nextActiveTaskId
          && s.selectedTaskIds.length === uniqueIds.length
          && s.selectedTaskIds.every((id, index) => id === uniqueIds[index]);
        if (unchanged) return;
        s.selectedTaskIds = uniqueIds;
        s.activeTaskId = nextActiveTaskId;
        return;
      }
      const merged = new Set([...s.selectedTaskIds, ...uniqueIds]);
      const nextSelectedTaskIds = Array.from(merged);
      const nextActiveTaskId = activeTaskId !== undefined
        ? activeTaskId
        : uniqueIds.length > 0 ? uniqueIds[uniqueIds.length - 1] : s.activeTaskId;
      const unchanged = s.activeTaskId === nextActiveTaskId
        && s.selectedTaskIds.length === nextSelectedTaskIds.length
        && s.selectedTaskIds.every((id, index) => id === nextSelectedTaskIds[index]);
      if (unchanged) return;
      s.selectedTaskIds = nextSelectedTaskIds;
      s.activeTaskId = nextActiveTaskId;
    }),

  copyTasks: (ids, gridText) =>
    set((s) => {
      const sourceIds = ids ?? s.selectedTaskIds;
      if (sourceIds.length === 0) return;

      // Selectie uitbreiden met alle (klein)kinderen, net als bij verwijderen.
      const collect = subtreeCollector(s.tasks); // één index voor alle bronnen
      const idSet = new Set<string>(sourceIds.flatMap(sid => collect(sid)));

      const tasks = s.tasks.filter(t => idSet.has(t.id));
      if (tasks.length === 0) return;

      // Alleen relaties waarvan beide uiteinden mee gekopieerd worden.
      const sequences = s.sequences.filter(
        seq => idSet.has(seq.predecessorId) && idSet.has(seq.successorId),
      );
      const assignments = s.assignments.filter(a => idSet.has(a.taskId));
      const usedResourceIds = new Set(assignments.map(a => a.resourceId));
      const resourceKinds: Record<string, TaskAssignmentResourceKind> = {};
      for (const r of s.resources) if (usedResourceIds.has(r.id)) resourceKinds[r.id] = isCostResource(r) ? 'cost' : 'work';

      // Deep-clone: het klembord blijft geldig na latere edits/undo van de bron.
      s.taskClipboard = JSON.parse(JSON.stringify({ tasks, sequences, assignments, resourceKinds }));
      if (gridText !== undefined) {
        s.taskClipboard!.fromGrid = { text: sameClipboardText(gridText), documentId: s.activeDocumentId };
      }
    }),

  pasteTasks: () => {
    const newRootIds: string[] = [];
    let skippedRelations: string[] = [];
    let clearedReferences = 0;
    let skippedAssignments = 0;
    set((s) => {
      const clip = s.taskClipboard;
      if (!clip || clip.tasks.length === 0) return;

      runtime.beginUndoable(s);

      const copiedIds = new Set(clip.tasks.map(t => t.id));
      const targetById = new Map(s.resources.map(r => [r.id, r] as const));
      const taskById = new Map(clip.tasks.map(t => [t.id, t] as const));
      // Een toewijzing past alleen als de soort (kosten of werk) van de bronresource bekend is en gelijk
      // aan die van de doelresource, en een mijlpaal draagt alleen kosten (issue #815). Anders overslaan
      // en melden, zoals een verwijzing die in het doel niet bestaat. Een resource die in het doel niet
      // bestaat, valt stil weg (het oude gedrag).
      const fitting: ResourceAssignment[] = [];
      // Per bron-taak de resources van een overgeslagen toewijzing: die gaan ook uit `resourceIds`.
      const skippedResourceIds = new Map<string, Set<string>>();
      for (const a of clip.assignments) {
        const target = targetById.get(a.resourceId);
        if (!target) continue;
        const targetIsCost = isCostResource(target);
        const sourceKind = clip.resourceKinds?.[a.resourceId];
        if (sourceKind === (targetIsCost ? 'cost' : 'work') && (targetIsCost || !taskById.get(a.taskId)?.isMilestone)) {
          fitting.push(a);
          continue;
        }
        skippedAssignments++;
        const ids = skippedResourceIds.get(a.taskId) ?? new Set<string>();
        ids.add(a.resourceId);
        skippedResourceIds.set(a.taskId, ids);
      }

      // Geplakte roots komen als sibling van de (eerst) geselecteerde taak;
      // zonder selectie op rootniveau.
      const anchor = s.selectedTaskIds.length > 0
        ? s.tasks.find(t => t.id === s.selectedTaskIds[0])
        : undefined;
      const targetParentId = anchor ? anchor.parentId : null;

      // Verse id voor elke gekopieerde taak.
      const idMap = new Map<string, string>();
      for (const t of clip.tasks) idMap.set(t.id, generateId('task'));

      for (const src of clip.tasks) {
        const newId = idMap.get(src.id)!;
        const parentInClip = !!src.parentId && copiedIds.has(src.parentId);
        if (!parentInClip) newRootIds.push(newId);

        const task: Task = {
          ...JSON.parse(JSON.stringify(src)),
          id: newId,
          parentId: parentInClip ? idMap.get(src.parentId!)! : targetParentId,
          childIds: src.childIds.filter(c => copiedIds.has(c)).map(c => idMap.get(c)!),
          // Verweesde resourceverwijzingen overslaan, en de resources van overgeslagen toewijzingen.
          resourceIds: src.resourceIds.filter(r => targetById.has(r) && !skippedResourceIds.get(src.id)?.has(r)),
        };
        s.tasks.push(task);
      }

      // Nieuwe roots aan de doelouder hangen.
      if (targetParentId) {
        const parent = s.tasks.find(t => t.id === targetParentId);
        if (parent) parent.childIds.push(...newRootIds);
      }

      // Interne relaties opnieuw aanmaken met de nieuwe ids, getoetst aan de relatieregels —
      // zonder die toets zou plakken een spookrelatie (bv. uit een IFC-import) eeuwig laten
      // voortleven. Zie `insertRemappedRelations`.
      skippedRelations = insertRemappedRelations(s, clip.sequences, idMap);

      // Resource-toewijzingen opnieuw aanmaken (resources die niet meer bestaan of niet passen overslaan).
      // Spread behoudt óók het optionele curve-veld — net als bij sequences hierboven.
      for (const a of fitting) {
        s.assignments.push({
          ...a,
          id: generateId('asgn'),
          taskId: idMap.get(a.taskId)!,
        });
      }

      // Het klembord is app-globaal: kalenders, eigen taaktypes, activiteitscodes en eigen velden
      // uit een ander document bestaan hier misschien niet — die verwijzingen leegmaken en melden.
      clearedReferences = normalizeInsertedBranch(s, idMap.values());

      // WBS: geplakte takken zouden anders de codes van hun bron letterlijk dupliceren.
      assignInsertedWbsCodes(s, idMap.values());

      s.selectedTaskIds = newRootIds;
      s.activeTaskId = newRootIds[0] ?? null;
      runtime.finishMutation(s, { stale: true }); // geplakte taken: planning verouderd tot F5.
    });
    get().recomputeViewRows();
    // Ná `set()`: `get().notify(...)` binnen een actieve producer aanroepen kan niet.
    notifyRelationsSkipped(get().notify, skippedRelations, 'relations-skipped-on-paste');
    notifyReferencesCleared(get().notify, clearedReferences);
    notifyAssignmentsSkipped(get().notify, skippedAssignments);
    return newRootIds;
  },
});
