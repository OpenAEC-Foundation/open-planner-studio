import type { RecordedDatesState, RecordedTime } from '@/engine/scheduler/recordedDates';
import type { Task } from '@/types/task';
import type { RecordedTaskAxis, RecordedTaskMark } from '@/types/taskGrid';

export type { RecordedTaskAxis, RecordedTaskMark };

export function unrecordedAxes(rec: RecordedTime | undefined): readonly RecordedTaskAxis[] {
  if (!rec) return [];
  const axes: RecordedTaskAxis[] = [];
  if (rec.lateStart === undefined) axes.push('ls');
  if (rec.lateFinish === undefined) axes.push('lf');
  if (rec.totalFloat === undefined) axes.push('tf');
  if (rec.freeFloat === undefined) axes.push('ff');
  return axes;
}

export type UnrecordedExportField = 'lateStart' | 'lateFinish' | 'totalFloat' | 'freeFloat' | 'isCritical';

export function unrecordedExportFields(rec: RecordedTime | undefined): readonly UnrecordedExportField[] {
  if (!rec) return [];
  const fields: UnrecordedExportField[] = [];
  if (rec.lateStart === undefined) fields.push('lateStart');
  if (rec.lateFinish === undefined) fields.push('lateFinish');
  if (rec.totalFloat === undefined) fields.push('totalFloat');
  if (rec.freeFloat === undefined) fields.push('freeFloat');
  if (rec.isCritical === undefined) fields.push('isCritical');
  return fields;
}

export function unrecordedExportGate(
  recorded: RecordedDatesState | null,
  datesAsRecorded: boolean,
): ((task: Task) => readonly UnrecordedExportField[]) | undefined {
  if (!recorded || !datesAsRecorded) return undefined;
  return task => unrecordedExportFields(recorded.times[task.id]);
}

export function recordedTaskMark(
  recorded: RecordedDatesState | null,
  datesAsRecorded: boolean,
  task: Task,
): RecordedTaskMark {
  const rec = datesAsRecorded ? recorded?.times[task.id] : undefined;
  if (!rec) return undefined;
  return unrecordedAxes(rec).length > 0 ? 'partly-unrecorded' : undefined;
}

export function recordedNoticeState(
  recorded: RecordedDatesState | null,
  datesAsRecorded: boolean,
  task: Task,
): 'active' | RecordedTaskMark {
  if (!datesAsRecorded || !recorded?.times[task.id]) return undefined;
  return recordedTaskMark(recorded, datesAsRecorded, task) ?? 'active';
}

export function recordedTaskWillShift(
  recorded: RecordedDatesState | null,
  datesAsRecorded: boolean,
  taskId: string,
): boolean | undefined {
  if (!datesAsRecorded || !recorded?.shiftedTaskIds) return undefined;
  return recorded.shiftedTaskIds.includes(taskId);
}

export function recordedGridBinding(
  recorded: RecordedDatesState | null,
  datesAsRecorded: boolean,
): {
  recordedMark: ((task: Task) => RecordedTaskMark) | undefined;
  recordedUnrecordedAxes: ((task: Task) => readonly RecordedTaskAxis[]) | undefined;
} {
  return {
    recordedMark: recorded && datesAsRecorded ? (task => recordedTaskMark(recorded, datesAsRecorded, task)) : undefined,
    recordedUnrecordedAxes: recorded && datesAsRecorded
      ? (task => unrecordedAxes(recorded.times[task.id]))
      : undefined,
  };
}
