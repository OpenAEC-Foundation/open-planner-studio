import type { Task } from '@/types/task';
import { sameValue } from '@/utils/sameValue';
const DATE_NEUTRAL_TASK_FIELDS: ReadonlySet<string> = new Set([
  'name', 'description', 'wbsCode', 'color', 'notes', 'activityCodes', 'customFields',
  'taskType', 'customTaskTypeId', 'workRule',
]);

export function changesOnlyDateNeutralFields(before: Task, after: Task): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof Task>;
  for (const key of keys) {
    if (sameValue(before[key], after[key])) continue;
    if (!DATE_NEUTRAL_TASK_FIELDS.has(key)) return false;
  }
  return true;
}

/** Snapshot plus laatst verantwoorde brugwaarden. De echte undo-snapshot blijft onaangeroerd. */
