import { Task, createDefaultTaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { ResourceAssignment } from '@/types/resource';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';
import { deriveWbsCodes, applyWbsNumbering, flattenOrder } from '@/utils/wbs';
import type { WbsTemplate } from '@/utils/wbsTemplates';
import { createSnapshot } from '../snapshot';
import type { AppSlice } from './types';

/**
 * Zelfstandige kopie van een takenselectie (incl. subtaken), de interne
 * relaties en resource-toewijzingen. Deep-cloned bij het kopiëren, zodat
 * plakken ook werkt nadat de originelen gewijzigd of verwijderd zijn.
 * App-state, géén projectdata: rondt niet door de IFC-laag en zit niet in
 * de undo/redo-snapshots.
 */
export interface TaskClipboard {
  tasks: Task[];
  sequences: Sequence[];
  assignments: ResourceAssignment[];
}

export interface TaskSlice {
  tasks: Task[];
  selectedTaskIds: string[];
  taskClipboard: TaskClipboard | null;
  addTask: (task: Partial<Task> & { name: string }) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newParentId: string | null) => void;
  selectTask: (id: string, multi?: boolean, range?: boolean) => void;
  selectTaskRange: (fromId: string, toId: string) => void;
  deselectAll: () => void;
  /** Kopieer de opgegeven takken (default: de huidige selectie) incl. subtaken naar het klembord. */
  copyTasks: (ids?: string[]) => void;
  /** Plak het klembord als nieuwe takken; geeft de nieuwe root-ids terug (leeg als er niets te plakken viel). */
  pasteTasks: () => string[];
  /** Hernummer alle WBS-codes uit de boompositie (1.2.3.4) — de expliciete variant van wbsAutoNumber. */
  renumberWbs: () => void;
  /** Inspringen (MSP Alt+Shift+→): elke taak wordt kind van zijn voorgaande zichtbare sibling. */
  indentTasks: (ids: string[]) => void;
  /** Uitspringen (MSP Alt+Shift+←): elke taak wordt sibling ná zijn huidige ouder. */
  outdentTasks: (ids: string[]) => void;
  /** Voeg een WBS-sjabloon in onder een ouder (null = rootniveau); geeft de nieuwe root-id terug. */
  insertWbsTemplate: (template: WbsTemplate, parentId: string | null) => string | null;
  /** Voortgang (fase 2.6): zet completion (0..1), dwingt de §3.2-invarianten af (auto-actualStart bij
   *  completion>0, remainingTime afgeleid, status). scheduleStale alleen als er een statusdatum is. */
  setTaskProgress: (taskId: string, completion: number) => void;
  /** Werkelijke start (fase 2.6). undefined = wissen. Retourneert false als de datum ná de
   *  statusdatum ligt (geweigerd, geen mutatie — de UI toont een toast). */
  setActualStart: (taskId: string, date: string | undefined) => boolean;
  /** Werkelijke einde (fase 2.6): zet completion=1 + status COMPLETED. undefined = wissen.
   *  Retourneert false als de datum ná de statusdatum ligt (geweigerd). */
  setActualFinish: (taskId: string, date: string | undefined) => boolean;
  /** Taak-kalender (fase 2.8a, §7.3): wijs een bibliotheek-kalender toe (undefined = projectkalender).
   *  Dwingt niets af — zet alleen `calendarId` + undo-snapshot + scheduleStale (datum-beïnvloedend). */
  setTaskCalendar: (taskId: string, calendarId: string | undefined) => void;
}

/**
 * Voortgang-invarianten (§3.2), toegepast op een task-draft ná elke progress-mutatie:
 * actualFinish ⇒ completion 1 + actualStart + COMPLETED; completion 1 ⇒ actualFinish (default =
 * statusdatum of vandaag); actualStart zonder finish ⇒ STARTED; niets ⇒ NOT_STARTED;
 * remainingTime = round(scheduleDuration × (1 − completion)).
 */
function applyProgressInvariants(task: Task, statusDate: string | undefined): void {
  const time = task.time;
  if (time.actualFinish) {
    time.completion = 1;
    if (!time.actualStart) time.actualStart = time.actualFinish;
    task.status = 'COMPLETED';
  } else if (time.completion >= 1) {
    time.actualFinish = statusDate || formatDate(new Date());
    if (!time.actualStart) time.actualStart = time.actualFinish;
    task.status = 'COMPLETED';
  } else if (time.actualStart) {
    task.status = 'STARTED';
  } else {
    task.status = 'NOT_STARTED';
  }
  time.remainingTime = Math.round(time.scheduleDuration * (1 - time.completion));
}

export const createTaskSlice: AppSlice<TaskSlice> = (set, get) => ({
  tasks: [],
  selectedTaskIds: [],
  taskClipboard: null,

  addTask: (partial) => {
    const id = generateId('task');
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      const now = s.project.startDate || formatDate(new Date());
      const task: Task = {
        id,
        name: partial.name,
        description: partial.description || '',
        wbsCode: partial.wbsCode || '',
        taskType: partial.taskType || 'CONSTRUCTION',
        status: partial.status || 'NOT_STARTED',
        isMilestone: partial.isMilestone || false,
        milestoneKind: partial.milestoneKind,
        mandatory: partial.mandatory,
        // ?? i.p.v. || : priority 0 is een geldige waarde (laagste, levelt als eerste weg) en
        // mag niet stilzwijgend naar de default 500 vallen.
        priority: partial.priority ?? 500,
        parentId: partial.parentId || null,
        childIds: [],
        time: partial.time || createDefaultTaskTime(now, partial.isMilestone ? 0 : 5),
        resourceIds: partial.resourceIds || [],
        color: partial.color,
        constraint: partial.constraint,
        // Fase 2.9 (§3.1/§4.3): secundaire constraint doorgeven zodat de solver hem als tweede
        // grens meerekent. Afwezig ⇒ undefined ⇒ byte-identiek default-document.
        constraint2: partial.constraint2,
        // Fase 2.9 (§3.2/§4.4): hammock/LOE-vlag doorgeven zodat de solver de afgeleide-span-tak
        // draait. Afwezig ⇒ undefined ⇒ byte-identiek default-document.
        isHammock: partial.isHammock,
        deadline: partial.deadline,
        calendarId: partial.calendarId,
      };

      s.tasks.push(task);

      // Add to parent's children
      if (task.parentId) {
        const parent = s.tasks.find(t => t.id === task.parentId);
        if (parent) parent.childIds.push(id);
      }

      // WBS-code: bij auto-nummering de hele boom bijwerken; anders alleen deze taak een
      // afgeleide code geven wanneer de aanroeper er geen meegaf (lege codes breken de
      // CSV/MSP-export en -herimport, die op dotted codes koppelen).
      if (s.project.wbsAutoNumber) {
        applyWbsNumbering(s.tasks);
      } else if (!partial.wbsCode) {
        task.wbsCode = deriveWbsCodes(s.tasks).get(id) ?? '';
      }

      s.isDirty = true;
      s.scheduleStale = true; // nieuwe taak (A6): planning verouderd tot F5.
    });
    get().recomputeViewRows();
    return id;
  },

  updateTask: (id, updates) => {
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      const idx = s.tasks.findIndex(t => t.id === id);
      if (idx >= 0) {
        Object.assign(s.tasks[idx], updates);
        s.isDirty = true;
        // Datum-rakende mutatie (duur/start/constraint/mijlpaal → planning verouderd tot F5, A6).
        s.scheduleStale = true;
      }
    });
    get().recomputeViewRows();
  },

  setTaskCalendar: (taskId, calendarId) => {
    set((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.calendarId === calendarId) return; // no-op: geen snapshot, geen stale
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      task.calendarId = calendarId; // undefined = projectkalender
      s.isDirty = true;
      s.scheduleStale = true; // taak-kalender-toewijzing is datum-beïnvloedend (§5.4).
    });
    get().recomputeViewRows();
  },

  deleteTask: (id) => {
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      // Remove from parent
      const task = s.tasks.find(t => t.id === id);
      if (task?.parentId) {
        const parent = s.tasks.find(t => t.id === task.parentId);
        if (parent) {
          parent.childIds = parent.childIds.filter(cid => cid !== id);
        }
      }

      // Remove child tasks recursively
      const removeIds = new Set<string>();
      const collectChildren = (taskId: string) => {
        removeIds.add(taskId);
        const t = s.tasks.find(tt => tt.id === taskId);
        if (t) t.childIds.forEach(collectChildren);
      };
      collectChildren(id);

      s.tasks = s.tasks.filter(t => !removeIds.has(t.id));
      s.sequences = s.sequences.filter(
        seq => !removeIds.has(seq.predecessorId) && !removeIds.has(seq.successorId)
      );
      s.assignments = s.assignments.filter(a => !removeIds.has(a.taskId));
      s.selectedTaskIds = s.selectedTaskIds.filter(sid => !removeIds.has(sid));
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      s.isDirty = true;
      s.scheduleStale = true; // datum-rakende mutatie (A6): planning verouderd tot F5.
    });
    get().recomputeViewRows();
  },

  moveTask: (id, newParentId) => {
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      const task = s.tasks.find(t => t.id === id);
      if (!task) return;

      // Remove from old parent
      if (task.parentId) {
        const oldParent = s.tasks.find(t => t.id === task.parentId);
        if (oldParent) {
          oldParent.childIds = oldParent.childIds.filter(c => c !== id);
        }
      }

      // Add to new parent
      task.parentId = newParentId;
      if (newParentId) {
        const newParent = s.tasks.find(t => t.id === newParentId);
        if (newParent) newParent.childIds.push(id);
      }

      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      s.isDirty = true;
      s.scheduleStale = true; // datum-rakende mutatie (A6): planning verouderd tot F5.
    });
    get().recomputeViewRows();
  },

  indentTasks: (ids) => {
    set((s) => {
      // Kandidaat-ouder = de voorgaande sibling in de weergavevolgorde (flattenOrder).
      // Geen voorgaande sibling => no-op voor die taak. De subboom lift mee via parentId.
      // Binnen een meervoudige selectie springt een aaneengesloten blok als geheel in:
      // geselecteerde voorgaande siblings worden overgeslagen als kandidaat-ouder,
      // anders nest het blok trapsgewijs in elkaar.
      const selected = new Set(ids);
      let changed = false;
      let snapshotPushed = false;
      const order = flattenOrder(s.tasks).map(t => t.id);
      for (const id of order) {
        if (!selected.has(id)) continue;
        const task = s.tasks.find(t => t.id === id);
        if (!task) continue;
        const idx = order.indexOf(id);
        let newParentId: string | null = null;
        for (let i = idx - 1; i >= 0; i--) {
          const cand = s.tasks.find(t => t.id === order[i]);
          if (!cand) continue;
          if (cand.parentId === task.parentId && !selected.has(cand.id)) {
            newParentId = cand.id;
            break;
          }
          // Voorbij het bereik van dezelfde ouder (omhoog de boom uit): stoppen.
          if (cand.id === task.parentId) break;
        }
        if (!newParentId) continue;
        if (!snapshotPushed) {
          s.undoStack.push(createSnapshot(s));
          s.redoStack = [];
          snapshotPushed = true;
        }
        if (task.parentId) {
          const oldParent = s.tasks.find(t => t.id === task.parentId);
          if (oldParent) oldParent.childIds = oldParent.childIds.filter(c => c !== id);
        }
        task.parentId = newParentId;
        const newParent = s.tasks.find(t => t.id === newParentId);
        if (newParent) newParent.childIds.push(id);
        changed = true;
      }
      if (!changed) return;
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      s.isDirty = true;
      s.scheduleStale = true; // datum-rakende mutatie (A6): planning verouderd tot F5.
    });
    get().recomputeViewRows();
  },

  outdentTasks: (ids) => {
    set((s) => {
      // Diepste taken eerst zodat een geselecteerde ouder+kind-combinatie niet dubbelt.
      const order = flattenOrder(s.tasks).map(t => t.id);
      const sorted = [...ids].sort((a, b) => order.indexOf(b) - order.indexOf(a));
      let changed = false;
      let snapshotPushed = false;
      for (const id of sorted) {
        const task = s.tasks.find(t => t.id === id);
        if (!task || !task.parentId) continue;
        const parent = s.tasks.find(t => t.id === task.parentId);
        if (!parent) continue;
        if (!snapshotPushed) {
          s.undoStack.push(createSnapshot(s));
          s.redoStack = [];
          snapshotPushed = true;
        }
        parent.childIds = parent.childIds.filter(c => c !== id);
        task.parentId = parent.parentId;
        if (parent.parentId) {
          const grandParent = s.tasks.find(t => t.id === parent.parentId);
          if (grandParent) grandParent.childIds.push(id);
        }
        changed = true;
      }
      if (!changed) return;
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      s.isDirty = true;
      s.scheduleStale = true; // datum-rakende mutatie (A6): planning verouderd tot F5.
    });
    get().recomputeViewRows();
  },

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

  copyTasks: (ids) =>
    set((s) => {
      const sourceIds = ids ?? s.selectedTaskIds;
      if (sourceIds.length === 0) return;

      // Selectie uitbreiden met alle (klein)kinderen, net als bij verwijderen.
      const idSet = new Set<string>();
      const collect = (taskId: string) => {
        if (idSet.has(taskId)) return;
        idSet.add(taskId);
        const t = s.tasks.find(tt => tt.id === taskId);
        if (t) t.childIds.forEach(collect);
      };
      sourceIds.forEach(collect);

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

      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

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
      s.isDirty = true;
      s.scheduleStale = true; // geplakte taken (A6): planning verouderd tot F5.
    });
    get().recomputeViewRows();
    return newRootIds;
  },

  renumberWbs: () => {
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      applyWbsNumbering(s.tasks);
      s.isDirty = true;
    });
    get().recomputeViewRows();
  },

  insertWbsTemplate: (template, parentId) => {
    if (template.tasks.length === 0) return null;
    let newRootId: string | null = null;
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      const startDate = s.project.startDate || formatDate(new Date());
      const idMap = new Map<string, string>();
      for (const tt of template.tasks) idMap.set(tt.id, generateId('task'));

      for (const tt of template.tasks) {
        const id = idMap.get(tt.id)!;
        const parent = tt.parentId ? idMap.get(tt.parentId)! : parentId;
        if (tt.parentId === null) newRootId = id;
        s.tasks.push({
          id,
          name: tt.name,
          description: tt.description,
          wbsCode: '',
          taskType: tt.taskType,
          status: 'NOT_STARTED',
          isMilestone: tt.isMilestone,
          priority: 500,
          parentId: parent ?? null,
          childIds: template.tasks.filter(c => c.parentId === tt.id).map(c => idMap.get(c.id)!),
          time: createDefaultTaskTime(startDate, tt.isMilestone ? 0 : tt.durationDays),
          resourceIds: [],
        });
      }
      if (parentId && newRootId) {
        const parent = s.tasks.find(t => t.id === parentId);
        if (parent) parent.childIds.push(newRootId);
      }
      for (const q of template.sequences) {
        s.sequences.push({
          ...q,
          id: generateId('seq'),
          predecessorId: idMap.get(q.predecessorId)!,
          successorId: idMap.get(q.successorId)!,
        });
      }

      // WBS-codes: auto ⇒ hele boom; anders alleen de ingevoegde tak afleiden.
      if (s.project.wbsAutoNumber) {
        applyWbsNumbering(s.tasks);
      } else {
        const codes = deriveWbsCodes(s.tasks);
        for (const id of idMap.values()) {
          const task = s.tasks.find(t2 => t2.id === id);
          const code = codes.get(id);
          if (task && code !== undefined) task.wbsCode = code;
        }
      }

      if (newRootId) s.selectedTaskIds = [newRootId];
      s.isDirty = true;
      s.scheduleStale = true; // ingevoegd WBS-sjabloon (A6): planning verouderd tot F5.
    });
    get().recomputeViewRows();
    return newRootId;
  },

  setTaskProgress: (taskId, raw) => {
    set((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      const completion = Math.max(0, Math.min(1, raw));
      task.time.completion = completion;
      // §3.2: completion>0 zonder actualStart ⇒ auto actualStart (MSP-conventie: % ⇒ gestart).
      if (completion > 0 && !task.time.actualStart) {
        task.time.actualStart = task.time.earlyStart || task.time.scheduleStart;
      }
      // Voortgang teruggedraaid onder 100% ⇒ een verouderd actualFinish laten vallen.
      if (completion < 1) task.time.actualFinish = undefined;
      applyProgressInvariants(task, s.project.statusDate);
      s.isDirty = true;
      if (s.project.statusDate) s.scheduleStale = true; // alleen datum-beïnvloedend mét statusdatum.
    });
    get().recomputeViewRows();
  },

  setActualStart: (taskId, date) => {
    let accepted = true;
    set((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) return;
      // Actuals liggen nooit ná de statusdatum: weigeren i.p.v. stil klemmen (§3.2, BESLIST).
      if (date && s.project.statusDate && date > s.project.statusDate) { accepted = false; return; }
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      task.time.actualStart = date || undefined;
      applyProgressInvariants(task, s.project.statusDate);
      s.isDirty = true;
      if (s.project.statusDate) s.scheduleStale = true;
    });
    get().recomputeViewRows();
    return accepted;
  },

  setActualFinish: (taskId, date) => {
    let accepted = true;
    set((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (date && s.project.statusDate && date > s.project.statusDate) { accepted = false; return; }
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      task.time.actualFinish = date || undefined;
      // Finish wissen terwijl de taak op 100% stond ⇒ terug naar in-uitvoering (anders re-default
      // de invariant meteen een nieuw actualFinish en is wissen onmogelijk).
      if (!date && task.time.completion >= 1) task.time.completion = 0;
      applyProgressInvariants(task, s.project.statusDate);
      s.isDirty = true;
      if (s.project.statusDate) s.scheduleStale = true;
    });
    get().recomputeViewRows();
    return accepted;
  },
});
