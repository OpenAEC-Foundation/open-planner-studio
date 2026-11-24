import type { Task } from '@/types/task';
import { ALL_RECORDED_SLOT_KEYS, type RecordedFieldKey } from '../ifcTaskSlots';

export function recordedFieldsOf(task: Task): RecordedFieldKey[] {
  return ALL_RECORDED_SLOT_KEYS.filter(key => {
    const value = task.time[key];
    return typeof value === 'string' ? value !== '' : value !== undefined;
  });
}
