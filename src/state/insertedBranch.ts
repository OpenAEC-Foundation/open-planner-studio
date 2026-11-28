import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { NotifyInput } from './slices/types';
import { current, isDraft } from 'immer';
import { relationVerdict } from './relationRules';
import { generateId } from '@/utils/id';
import { applyWbsNumbering, deriveWbsCodes } from '@/utils/wbs';
import { refusalNotice, refusedNamesLine, refusedSetKey } from './refusalNotice';

function insertedTaskLookup(tasks: Task[]): (id: string) => Task | undefined {
  const view = isDraft(tasks) ? current(tasks) : tasks;
  const indices = new Map<string, number>();
  for (let i = 0; i < view.length; i++) {
    const id = view[i].id;
    if (!indices.has(id)) indices.set(id, i);
  }
  return id => {
    const index = indices.get(id);
    return index === undefined ? undefined : tasks[index];
  };
}

export function insertRemappedRelations(
  s: { tasks: Task[]; sequences: Sequence[] },
  relations: readonly Omit<Sequence, 'id'>[],
  idMap: ReadonlyMap<string, string>,
): string[] {
  const skipped: string[] = [];
  if (relations.length === 0) return skipped;
  const lookup = insertedTaskLookup(s.tasks);
  for (const relation of relations) {
    const candidate = {
      ...relation,
      predecessorId: idMap.get(relation.predecessorId)!,
      successorId: idMap.get(relation.successorId)!,
    };
    if (!relationVerdict(lookup, s.sequences, candidate).ok) {
      skipped.push(`${lookup(candidate.predecessorId)?.name ?? '?'} → ${lookup(candidate.successorId)?.name ?? '?'}`);
      continue;
    }
    s.sequences.push({ ...candidate, id: generateId('seq') });
  }
  return skipped;
}

interface InsertTargetDefinitions {
  tasks: Task[];
  calendar: { id: string };
  calendars: readonly { id: string }[];
  customTaskTypes: readonly { id: string }[];
  activityCodeTypes: readonly ActivityCodeType[];
  customFieldDefs: readonly CustomFieldDef[];
}

export function normalizeInsertedBranch(s: InsertTargetDefinitions, ids: Iterable<string>): number {
  const calendarIds = new Set([s.calendar.id, ...s.calendars.map(calendar => calendar.id)]);
  const taskTypeIds = new Set(s.customTaskTypes.map(type => type.id));
  const codeTypes = new Map(s.activityCodeTypes.map(type => [type.id, type] as const));
  const fieldIds = new Set(s.customFieldDefs.map(def => def.id));
  const lookup = insertedTaskLookup(s.tasks);
  let cleared = 0;
  for (const id of ids) {
    const task = lookup(id);
    if (!task) continue;
    if (task.calendarId !== undefined && !calendarIds.has(task.calendarId)) {
      delete task.calendarId;
      cleared++;
    }
    if (task.customTaskTypeId !== undefined && !taskTypeIds.has(task.customTaskTypeId)) {
      delete task.customTaskTypeId;
      cleared++;
    }
    if (task.activityCodes) {
      const kept = Object.entries(task.activityCodes).filter(([typeId, valueId]) =>
        codeTypes.get(typeId)?.values.some(value => value.id === valueId) === true);
      const dropped = Object.keys(task.activityCodes).length - kept.length;
      if (dropped > 0) {
        cleared += dropped;
        if (kept.length > 0) task.activityCodes = Object.fromEntries(kept);
        else delete task.activityCodes;
      }
    }
    if (task.customFields) {
      const kept = Object.entries(task.customFields).filter(([defId]) => fieldIds.has(defId));
      const dropped = Object.keys(task.customFields).length - kept.length;
      if (dropped > 0) {
        cleared += dropped;
        if (kept.length > 0) task.customFields = Object.fromEntries(kept);
        else delete task.customFields;
      }
    }
  }
  return cleared;
}

export function notifyReferencesCleared(notify: (n: NotifyInput) => void, count: number): void {
  if (count <= 0) return;
  notify({
    severity: 'info',
    messageKey: 'notifications.referencesClearedOnPaste',
    params: { count },
    dedupeKey: 'references-cleared-on-paste',
  });
}

export function notifyAssignmentsSkipped(notify: (n: NotifyInput) => void, count: number): void {
  if (count <= 0) return;
  notify({
    severity: 'info',
    messageKey: 'notifications.assignmentsSkippedOnPaste',
    params: { count },
    dedupeKey: 'assignments-skipped-on-paste',
  });
}

export function assignInsertedWbsCodes(
  s: { tasks: Task[]; project: { wbsAutoNumber?: boolean } },
  ids: Iterable<string>,
): void {
  if (s.project.wbsAutoNumber) {
    applyWbsNumbering(s.tasks);
    return;
  }
  const codes = deriveWbsCodes(s.tasks);
  const lookup = insertedTaskLookup(s.tasks);
  for (const id of ids) {
    const task = lookup(id);
    const code = codes.get(id);
    if (task && code !== undefined) task.wbsCode = code;
  }
}

export function notifyRelationsSkipped(
  notify: (n: NotifyInput) => void,
  skipped: readonly string[],
  dedupeKey: string,
): void {
  if (skipped.length === 0) return;
  notify(refusalNotice({
    messageKey: 'notifications.relationsSkippedOnInsert',
    params: { count: skipped.length },
    detailLines: refusedNamesLine(skipped, 'relations'),
    dedupeKey: refusedSetKey(dedupeKey, skipped),
  }));
}
