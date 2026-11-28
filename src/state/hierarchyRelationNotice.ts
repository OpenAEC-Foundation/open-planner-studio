import type { RelationTree } from '@/engine/scheduler/relationRules';
import type { Task } from '@/types/task';
import { cycleLabel } from './notificationLabels';
import { HIERARCHY_RELATIONS_HELP_ARTICLE_ID } from './helpArticles';
import { isAncestorRelation } from './relationRules';
import type { NotifyInput } from './slices/types';
import { refusalNotice } from './refusalNotice';

function ancestorRelationIds(state: RelationTree): Set<string> {
  if (state.sequences.length === 0) return new Set();
  const byId = new Map(state.tasks.map(task => [task.id, task] as const));
  const lookup = (id: string) => byId.get(id);
  return new Set(state.sequences.filter(sequence => isAncestorRelation(lookup, sequence)).map(sequence => sequence.id));
}

export function watchAncestorRelations(
  before: RelationTree,
): (after: RelationTree & { notify: (notification: NotifyInput) => void }) => void {
  const alreadyExcluded = ancestorRelationIds(before);
  return (after) => {
    if (after.tasks === before.tasks) return;
    let count = 0;
    for (const id of ancestorRelationIds(after)) if (!alreadyExcluded.has(id)) count++;
    if (count === 0) return;
    after.notify({
      severity: 'info',
      messageKey: 'notifications.relationsExcludedByHierarchy',
      params: { count },
      dedupeKey: 'relations-excluded-by-hierarchy',
      helpArticleId: HIERARCHY_RELATIONS_HELP_ARTICLE_ID,
    });
  };
}

export function notifyHierarchyCycle(
  state: { tasks: readonly Task[]; notify: (notification: NotifyInput) => void },
  cycle: readonly string[],
): void {
  state.notify(refusalNotice({
    messageKey: 'notifications.hierarchyCycle',
    params: { cycle: cycleLabel(state.tasks, cycle) },
    dedupeKey: 'hierarchy-cycle',
    helpArticleId: HIERARCHY_RELATIONS_HELP_ARTICLE_ID,
  }));
}
