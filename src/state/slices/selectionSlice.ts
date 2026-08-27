// Selectie + klembord (K-item 35, tweede helft).
//
// Deze twee horen bij elkaar en niet bij `taskSlice`: het klembord werkt op de selectie, en beide
// zijn iets anders dan de taken zelf. Het onderscheid dat ze deelt is de UNDO-regel — selectie is
// GEEN documentdata en pusht dus nooit een undo-snapshot, terwijl plakken dat juist wél doet omdat
// het taken aanmaakt. Die regel stond eerder verspreid in commentaar tussen 1100 regels
// taakmutaties; hier is hij de reden dat het bestand bestaat.
//
// Documentcontract: `selectedTaskIds` is PER DOCUMENT (het reist mee bij een documentwissel,
// `snapshot: 'none'` — je selectie hoort niet in een undo-stap), `taskClipboard` is APP-GLOBAAL,
// zodat kopiëren en plakken tussen documenten werkt. Beide velden blijven op het top-level van
// `AppState` staan, dus `documentContract.ts` verandert niet mee: die leest `s.selectedTaskIds`,
// niet `s.selection.selectedTaskIds`.
import type { AppSliceFactory } from './types';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { ResourceAssignment } from '@/types/resource';
import { collectSubtreeIds } from '@/state/taskTree';
import { finishMutation } from '@/state/transaction';
import { deriveWbsCodes, applyWbsNumbering } from '@/utils/wbs';
import { generateId } from '@/utils/id';

export interface TaskClipboard {
  tasks: Task[];
  sequences: Sequence[];
  assignments: ResourceAssignment[];
}

export interface SelectionSlice {
  selectedTaskIds: string[];
  taskClipboard: TaskClipboard | null;

  /** Selecteer één taak. `multi` (Ctrl/Cmd) togglet, `range` (Shift) breidt uit vanaf de laatst
   *  geselecteerde. Geen undo: selectie is geen documentdata. */
  selectTask: (id: string, multi?: boolean, range?: boolean) => void;
  selectTaskRange: (fromId: string, toId: string) => void;
  deselectAll: () => void;
  /** Golf 1 (fase 2.10, Ctrl/Cmd+A): selecteer alle ZICHTBARE taken — leest `viewRows` (dezelfde
   *  zichtbaarheids-afleiding als de tabel/Gantt, respecteert dus ingeklapte groepen/summaries).
   *  Geen undo: selectie is geen documentdata. */
  selectAllTasks: () => void;
  /** Golf 4 (fase 2.10, box-selection): zet de selectie op precies `ids` (vervangen), of voeg ze
   *  toe aan de bestaande selectie (`additive`, Ctrl/Cmd tijdens het slepen). Geen undo. */
  selectTasks: (ids: string[], additive: boolean) => void;

  /** Kopieer de opgegeven takken (default: de huidige selectie) incl. subtaken naar het klembord. */
  copyTasks: (ids?: string[]) => void;
  /** Plak het klembord als nieuwe takken; geeft de nieuwe root-ids terug (leeg als er niets te
   *  plakken viel). Dit pusht WEL een undo-snapshot — er ontstaan taken. */
  pasteTasks: () => string[];
}

export const createSelectionSlice: AppSliceFactory<SelectionSlice> = (runtime) => (set, get) => ({
  selectedTaskIds: [],
  taskClipboard: null,

  selectTask: (id, multi = false, range = false) =>
    set((s) => {
      if (range && s.selectedTaskIds.length > 0) {
        // Shift+click: select range from last selected to clicked task
        const lastSelected = s.selectedTaskIds[s.selectedTaskIds.length - 1];
        const flatIds = s.tasks.map(t => t.id);
        const fromIdx = flatIds.indexOf(lastSelected);
        const toIdx = flatIds.indexOf(id);
        if (fromIdx >= 0 && toIdx >= 0) {
          const start = Math.min(fromIdx, toIdx);
          const end = Math.max(fromIdx, toIdx);
          const rangeIds = flatIds.slice(start, end + 1);
          // Merge with existing selection (union)
          const merged = new Set([...s.selectedTaskIds, ...rangeIds]);
          s.selectedTaskIds = Array.from(merged);
        } else {
          s.selectedTaskIds = [id];
        }
      } else if (multi) {
        const idx = s.selectedTaskIds.indexOf(id);
        if (idx >= 0) {
          s.selectedTaskIds.splice(idx, 1);
        } else {
          s.selectedTaskIds.push(id);
        }
      } else {
        s.selectedTaskIds = [id];
      }
    }),

  selectTaskRange: (fromId, toId) =>
    set((s) => {
      const flatIds = s.tasks.map(t => t.id);
      const fromIdx = flatIds.indexOf(fromId);
      const toIdx = flatIds.indexOf(toId);
      if (fromIdx >= 0 && toIdx >= 0) {
        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);
        s.selectedTaskIds = flatIds.slice(start, end + 1);
      }
    }),

  deselectAll: () =>
    set((s) => {
      s.selectedTaskIds = [];
    }),

  selectAllTasks: () =>
    set((s) => {
      s.selectedTaskIds = s.viewRows
        .filter((row): row is Extract<typeof row, { kind: 'task' }> => row.kind === 'task')
        .map((row) => row.task.id);
    }),

  selectTasks: (ids, additive) =>
    set((s) => {
      if (!additive) {
        s.selectedTaskIds = [...ids];
        return;
      }
      const merged = new Set([...s.selectedTaskIds, ...ids]);
      s.selectedTaskIds = Array.from(merged);
    }),

  copyTasks: (ids) =>
    set((s) => {
      const sourceIds = ids ?? s.selectedTaskIds;
      if (sourceIds.length === 0) return;

      // Selectie uitbreiden met alle (klein)kinderen, net als bij verwijderen.
      const idSet = new Set<string>(sourceIds.flatMap(sid => collectSubtreeIds(s.tasks, sid)));

      const tasks = s.tasks.filter(t => idSet.has(t.id));
      if (tasks.length === 0) return;

      // Alleen relaties waarvan beide uiteinden mee gekopieerd worden.
      const sequences = s.sequences.filter(
        seq => idSet.has(seq.predecessorId) && idSet.has(seq.successorId),
      );
      const assignments = s.assignments.filter(a => idSet.has(a.taskId));

      // Deep-clone: het klembord blijft geldig na latere edits/undo van de bron.
      s.taskClipboard = JSON.parse(JSON.stringify({ tasks, sequences, assignments }));
    }),

  pasteTasks: () => {
    const newRootIds: string[] = [];
    set((s) => {
      const clip = s.taskClipboard;
      if (!clip || clip.tasks.length === 0) return;

      runtime.beginUndoable(s);

      const copiedIds = new Set(clip.tasks.map(t => t.id));
      const resourceExists = new Set(s.resources.map(r => r.id));

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
          // Verweesde resourceverwijzingen overslaan.
          resourceIds: src.resourceIds.filter(r => resourceExists.has(r)),
        };
        s.tasks.push(task);
      }

      // Nieuwe roots aan de doelouder hangen.
      if (targetParentId) {
        const parent = s.tasks.find(t => t.id === targetParentId);
        if (parent) parent.childIds.push(...newRootIds);
      }

      // Interne relaties opnieuw aanmaken met de nieuwe ids. Spread behoudt óók de
      // optionele lag-velden (lagUnit/lagPercent) — die vielen hier eerder stil weg.
      for (const seq of clip.sequences) {
        s.sequences.push({
          ...seq,
          id: generateId('seq'),
          predecessorId: idMap.get(seq.predecessorId)!,
          successorId: idMap.get(seq.successorId)!,
        });
      }

      // Resource-toewijzingen opnieuw aanmaken (resources die niet meer bestaan overslaan).
      // Spread behoudt óók het optionele curve-veld — net als bij sequences hierboven.
      for (const a of clip.assignments) {
        if (!resourceExists.has(a.resourceId)) continue;
        s.assignments.push({
          ...a,
          id: generateId('asgn'),
          taskId: idMap.get(a.taskId)!,
        });
      }

      // WBS: geplakte takken zouden anders de codes van hun bron letterlijk dupliceren.
      // Auto-nummering ⇒ hele boom; anders alleen de geplakte tak een afgeleide code geven.
      if (s.project.wbsAutoNumber) {
        applyWbsNumbering(s.tasks);
      } else {
        const codes = deriveWbsCodes(s.tasks);
        for (const newId of idMap.values()) {
          const t = s.tasks.find(x => x.id === newId);
          const code = codes.get(newId);
          if (t && code !== undefined) t.wbsCode = code;
        }
      }

      s.selectedTaskIds = newRootIds;
      finishMutation(s, { stale: true }); // geplakte taken (A6): planning verouderd tot F5.
    });
    get().recomputeViewRows();
    return newRootIds;
  },
});
