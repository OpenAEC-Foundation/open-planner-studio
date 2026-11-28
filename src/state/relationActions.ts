import { useAppStore, type AppState } from '@/state/appStore';
import { uniqueTaskIds, type ViewRow } from '@/engine/view/visibleRows';
import { relationAddVerdict, type RelationAddRejection } from '@/state/relationRules';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { NotificationMessageKey, RelationAssignDirection } from '@/state/slices/types';
import { cycleLabel } from '@/state/notificationLabels';
import { refusalNotice } from '@/state/refusalNotice';
import { withTransaction } from '@/state/batchTransaction';

const REJECTION_MESSAGE: Record<RelationAddRejection, NotificationMessageKey> = {
  duplicate: 'notifications.relationDuplicate',
  ancestor: 'notifications.relationAncestorEndpoint',
  cycle: 'notifications.relationCycle',
  self: 'notifications.relationDuplicate',
  'unknown-task': 'notifications.relationDuplicate',
};

export function createRelationWithFeedback(
  predecessorId: string,
  successorId: string,
  type: SequenceType = 'FINISH_START',
): string | null {
  return createRelationDraftWithFeedback({ predecessorId, successorId, type, lagDays: 0 });
}

export function createRelationDraftWithFeedback(relation: Omit<Sequence, 'id'>): string | null {
  const st = useAppStore.getState();
  const verdict = relationAddVerdict(st.tasks, st.sequences, relation);
  if (!verdict.ok) {
    st.notify(refusalNotice({
      messageKey: REJECTION_MESSAGE[verdict.reason],
      ...(verdict.reason === 'cycle'
        ? { params: { cycle: cycleLabel(st.tasks, verdict.cycle) } }
        : {}),
      dedupeKey: `relation-rejected-${verdict.reason}`,
    }));
    return null;
  }

  return st.addSequence(relation);
}

export function createRelationsWithFeedback(relations: readonly Omit<Sequence, 'id'>[]): (string | null)[] {
  if (relations.length <= 1) return relations.map(createRelationDraftWithFeedback);
  const st = useAppStore.getState();
  const anyAllowed = relations.some(rel => relationAddVerdict(st.tasks, st.sequences, rel).ok);
  if (!anyAllowed) return relations.map(createRelationDraftWithFeedback);
  return withTransaction(() => relations.map(createRelationDraftWithFeedback), 'Relaties toevoegen');
}

export function selectionInView(state: Pick<AppState, 'selectedTaskIds' | 'viewRows'>): boolean {
  const visible = new Set(uniqueTaskIds(state.viewRows));
  return state.selectedTaskIds.every(taskId => visible.has(taskId));
}

export function chainOrder(rows: readonly ViewRow[], taskIds: readonly string[]): string[] | null {
  const chosen = new Set(taskIds);
  const span = new Map<string, { first: number; last: number }>();
  rows.forEach((row, position) => {
    for (const taskId of uniqueTaskIds([row])) {
      if (!chosen.has(taskId)) continue;
      const seen = span.get(taskId);
      if (seen) seen.last = position; else span.set(taskId, { first: position, last: position });
    }
  });
  const ordered = [...span];
  return ordered.every(([, at], index) => index === 0 || ordered[index - 1][1].last < at.first)
    ? ordered.map(([taskId]) => taskId)
    : null;
}

export function linkTasksInChain(taskIds: readonly string[]): (string | null)[] {
  const st = useAppStore.getState();
  const ordered = chainOrder(st.viewRows, taskIds);
  if (!ordered) {
    st.notify(refusalNotice({
      messageKey: 'notifications.relationChainOrderUnclear',
      dedupeKey: 'relation-chain-order-unclear',
    }));
    return [];
  }
  return createRelationsWithFeedback(ordered.slice(1).map((successorId, index) => ({
    predecessorId: ordered[index],
    successorId,
    type: 'FINISH_START' as const,
    lagDays: 0,
  })));
}

export function requestRelationAssign(taskId: string, direction: RelationAssignDirection, rowKey?: string): void {
  const st = useAppStore.getState();
  if (!st.tasks.some(task => task.id === taskId)) return;
  const alreadySelected = st.activeTaskId === taskId && st.selectedTaskIds.length === 1 && st.selectedTaskIds[0] === taskId;
  if (rowKey !== undefined) st.selectTask(taskId, false, false, { rowKey });
  else if (!alreadySelected) st.selectTask(taskId, false);
  st.setUI({ showPropertiesPanel: true, pendingRelationAssign: { taskId, direction } });
}
