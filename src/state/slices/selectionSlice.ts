import type { AppSliceFactory, SelectionAnchor, StoredSelectionAnchor } from './types';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { isCostResource, type ResourceAssignment } from '@/types/resource';
import type { TaskAssignmentResourceKind } from '@/types/taskGrid';
import { subtreeCollector } from '@/state/taskTree';
import { generateId } from '@/utils/id';
import { baseList } from '@/state/immerDraft';
import {
  assignInsertedWbsCodes, insertRemappedRelations, normalizeInsertedBranch, notifyAssignmentsSkipped, notifyReferencesCleared,
  notifyRelationsSkipped,
} from '@/state/insertedBranch';
import {
  milestonesInDrawnOrder,
  normalizeTaskRowCursor,
  uniqueTaskIds,
  type TaskRowCursor,
  type ViewRow,
} from '@/engine/view/visibleRows';

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
  resourceKinds: Record<string, TaskAssignmentResourceKind>;
  fromGrid?: { text: string; documentId: string };
}

const sameClipboardText = (text: string) => text.replace(/\r\n/g, '\n');

export function pastesGridTaskCopy(clip: TaskClipboard | null, text: string, documentId: string): boolean {
  return !!clip?.fromGrid && clip.fromGrid.documentId !== documentId
    && clip.fromGrid.text === sameClipboardText(text);
}

export interface SelectedRow { rowKey?: string; taskIds?: readonly string[] }

function shiftRange(
  rows: readonly ViewRow[],
  anchor: SelectionAnchor,
  clickedId: string,
  clicked: readonly string[],
  clickedRowKey: string | undefined,
): string[] | null {
  const idsAt = (index: number) => uniqueTaskIds([rows[index]]);
  const drawnIdsAt = (index: number) => {
    const row = rows[index];
    return row.kind === 'milestones' ? milestonesInDrawnOrder(row.tasks).map(task => task.id) : idsAt(index);
  };
  const toIdx = rows.findIndex((row, index) => (clickedRowKey === undefined || row.rowKey === clickedRowKey)
    && idsAt(index).includes(clickedId));
  const fromIdx = rows.findIndex(row => row.rowKey === anchor.rowKey);
  if (toIdx < 0 || fromIdx < 0) return null;
  if (fromIdx === toIdx) {
    const ids = drawnIdsAt(toIdx);
    const marks = [...anchor.taskIds, ...clicked].map(taskId => ids.indexOf(taskId)).filter(index => index >= 0);
    return ids.slice(Math.min(...marks), Math.max(...marks) + 1);
  }
  const fromIds = idsAt(fromIdx).filter(taskId => anchor.taskIds.includes(taskId));
  const toIds = idsAt(toIdx).filter(taskId => clicked.includes(taskId));
  const between = uniqueTaskIds(rows.slice(Math.min(fromIdx, toIdx) + 1, Math.max(fromIdx, toIdx)));
  return [...new Set(fromIdx < toIdx ? [...fromIds, ...between, ...toIds] : [...toIds, ...between, ...fromIds])];
}

interface AnchorState {
  selectedTaskIds: readonly string[];
  ui: { selectionAnchor: StoredSelectionAnchor | null };
}

export function liveSelectionAnchor(s: AnchorState): StoredSelectionAnchor | null {
  const anchor = s.ui.selectionAnchor;
  return anchor && baseList(anchor.selection) === baseList(s.selectedTaskIds) ? anchor : null;
}

function rememberAnchor(s: AnchorState, anchor: SelectionAnchor | null, selection: readonly string[]): void {
  s.ui.selectionAnchor = anchor
    ? { rowKey: anchor.rowKey, taskIds: [...anchor.taskIds], selection }
    : null;
}

type ShiftState = AnchorState & {
  viewRows: readonly ViewRow[]; activeTaskId: string | null; ui: { gridActiveRowKey: string | null };
};

export function shiftAnchor(s: ShiftState): SelectionAnchor | null {
  const anchor = liveSelectionAnchor(s);
  if (anchor && s.viewRows.some(row => row.rowKey === anchor.rowKey
    && anchor.taskIds.some(taskId => uniqueTaskIds([row]).includes(taskId)))) return anchor;
  const taskId = s.activeTaskId !== null && s.selectedTaskIds.includes(s.activeTaskId)
    ? s.activeTaskId
    : s.selectedTaskIds[s.selectedTaskIds.length - 1];
  if (taskId === undefined) return null;
  const holds = (row: ViewRow) => uniqueTaskIds([row]).includes(taskId);
  const row = s.viewRows.find(candidate => candidate.rowKey === s.ui.gridActiveRowKey && holds(candidate))
    ?? s.viewRows.find(holds);
  return row ? { rowKey: row.rowKey, taskIds: [taskId] } : null;
}

export interface SelectionSlice {
  selectedTaskIds: string[];
  activeTaskId: string | null;
  taskClipboard: TaskClipboard | null;

  selectTask: (id: string, multi?: boolean, range?: boolean, row?: SelectedRow) => void;
  deselectAll: () => void;
  selectAllTasks: () => void;
  selectTasks: (ids: string[], additive: boolean, activeTaskId?: string | null, anchor?: SelectionAnchor) => void;

  copyTasks: (ids?: string[], gridText?: string) => void;
  pasteTasks: () => string[];
}

export const createSelectionSlice: AppSliceFactory<SelectionSlice> = (runtime) => (set, get) => ({
  selectedTaskIds: [],
  activeTaskId: null,
  taskClipboard: null,

  selectTask: (id, multi = false, range = false, row) =>
    set((s) => {
      const clicked = row?.taskIds ?? [id];
      const anchor = range ? shiftAnchor(s) : null;
      const rangeIds = anchor ? shiftRange(s.viewRows, anchor, id, clicked, row?.rowKey) : null;
      s.activeTaskId = id;
      if (row?.rowKey !== undefined) s.ui.gridActiveRowKey = row.rowKey;
      if (anchor && rangeIds) {
        const next = [...rangeIds];
        s.selectedTaskIds = next;
        rememberAnchor(s, anchor, next);
        return;
      }
      const next = !(multi && !range) ? [...clicked]
        : clicked.every(taskId => s.selectedTaskIds.includes(taskId))
          ? s.selectedTaskIds.filter(taskId => !clicked.includes(taskId))
          : [...s.selectedTaskIds, ...clicked.filter(taskId => !s.selectedTaskIds.includes(taskId))];
      s.selectedTaskIds = next;
      rememberAnchor(s, row?.rowKey !== undefined ? { rowKey: row.rowKey, taskIds: clicked } : null, next);
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
      const uniqueIds = [...new Set(ids)];
      const nextSelectedTaskIds = additive ? Array.from(new Set([...s.selectedTaskIds, ...uniqueIds])) : uniqueIds;
      const nextActiveTaskId = activeTaskId !== undefined
        ? activeTaskId
        : !additive ? (uniqueIds[0] ?? null)
        : uniqueIds.length > 0 ? uniqueIds[uniqueIds.length - 1] : s.activeTaskId;
      const unchanged = s.activeTaskId === nextActiveTaskId
        && s.selectedTaskIds.length === nextSelectedTaskIds.length
        && s.selectedTaskIds.every((id, index) => id === nextSelectedTaskIds[index]);
      if (!unchanged) {
        s.selectedTaskIds = nextSelectedTaskIds;
        s.activeTaskId = nextActiveTaskId;
      }
      rememberAnchor(s, anchor ?? null, unchanged ? baseList(s.selectedTaskIds) : nextSelectedTaskIds);
    }),

  copyTasks: (ids, gridText) =>
    set((s) => {
      const sourceIds = ids ?? s.selectedTaskIds;
      if (sourceIds.length === 0) return;

      const collect = subtreeCollector(s.tasks);
      const idSet = new Set<string>(sourceIds.flatMap(sid => collect(sid)));

      const tasks = s.tasks.filter(t => idSet.has(t.id));
      if (tasks.length === 0) return;

      const sequences = s.sequences.filter(
        seq => idSet.has(seq.predecessorId) && idSet.has(seq.successorId),
      );
      const assignments = s.assignments.filter(a => idSet.has(a.taskId));
      const usedResourceIds = new Set(assignments.map(a => a.resourceId));
      const resourceKinds: Record<string, TaskAssignmentResourceKind> = {};
      for (const r of s.resources) if (usedResourceIds.has(r.id)) resourceKinds[r.id] = isCostResource(r) ? 'cost' : 'work';

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
      const fitting: ResourceAssignment[] = [];
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

      const anchor = s.selectedTaskIds.length > 0
        ? s.tasks.find(t => t.id === s.selectedTaskIds[0])
        : undefined;
      const targetParentId = anchor ? anchor.parentId : null;

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
          resourceIds: src.resourceIds.filter(r => targetById.has(r) && !skippedResourceIds.get(src.id)?.has(r)),
        };
        s.tasks.push(task);
      }

      if (targetParentId) {
        const parent = s.tasks.find(t => t.id === targetParentId);
        if (parent) parent.childIds.push(...newRootIds);
      }

      skippedRelations = insertRemappedRelations(s, clip.sequences, idMap);

      for (const a of fitting) {
        s.assignments.push({
          ...a,
          id: generateId('asgn'),
          taskId: idMap.get(a.taskId)!,
        });
      }

      clearedReferences = normalizeInsertedBranch(s, idMap.values());

      assignInsertedWbsCodes(s, idMap.values());

      s.selectedTaskIds = newRootIds;
      s.activeTaskId = newRootIds[0] ?? null;
      runtime.finishMutation(s, { stale: true });
    });
    get().recomputeViewRows();
    notifyRelationsSkipped(get().notify, skippedRelations, 'relations-skipped-on-paste');
    notifyReferencesCleared(get().notify, clearedReferences);
    notifyAssignmentsSkipped(get().notify, skippedAssignments);
    return newRootIds;
  },
});
