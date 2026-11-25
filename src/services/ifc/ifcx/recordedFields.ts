import type { Task } from '@/types/task';
import { ALL_RECORDED_SLOT_KEYS, type RecordedFieldKey } from '../ifcTaskSlots';

function hasValue(task: Task, key: RecordedFieldKey): boolean {
  const value = task.time[key];
  return typeof value === 'string' ? value !== '' : value !== undefined;
}

export function recordedFieldsOf(task: Task, unrecorded: readonly RecordedFieldKey[]): RecordedFieldKey[] {
  return ALL_RECORDED_SLOT_KEYS.filter(key => hasValue(task, key) && !unrecorded.includes(key));
}

export function unrecordedOf(task: Task, recorded: readonly RecordedFieldKey[] | undefined): RecordedFieldKey[] {
  return recorded === undefined ? [] : ALL_RECORDED_SLOT_KEYS.filter(key => hasValue(task, key) && !recorded.includes(key));
}
