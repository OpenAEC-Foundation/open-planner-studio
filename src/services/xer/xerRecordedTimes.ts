import type { RecordedTime } from '@/engine/scheduler/recordedDates';
import type { XerRow } from './xerTables';
import { sourceInstant } from './xerInstant';

export interface XerRecordedTimesCtx {
  numberOf: (row: XerRow, field: string) => number | null;
  effectiveCalendarOf: (row: XerRow) => { id: string; hourMode: boolean; minutesPerDay: number };
  taskIdOf: (row: XerRow) => string;
  criticalDefinition?: { mode: 'totalFloat' | 'longestPath'; thresholdHours?: number };
}

export const XER_RECORDED_OUTPUT_COLUMNS = [
  'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
  'total_float_hr_cnt', 'free_float_hr_cnt',
] as const;

function recordedIsCritical(
  totalFloatHours: number | null,
  definition: XerRecordedTimesCtx['criticalDefinition'],
): boolean | undefined {
  if (totalFloatHours === null) return undefined;
  if (definition?.mode === 'longestPath') return undefined;
  return totalFloatHours <= (definition?.thresholdHours ?? 0);
}

function hoursToDays(hours: number | null, minutesPerDay: number): number | undefined {
  if (hours === null || !(minutesPerDay > 0)) return undefined;
  const minutes = Math.round(hours * 60);
  return minutes / minutesPerDay;
}

export function readXerRecordedTimes(
  activityRows: readonly XerRow[],
  ctx: XerRecordedTimesCtx,
): Record<string, RecordedTime> {
  const times: Record<string, RecordedTime> = {};

  for (const row of activityRows) {
    const { hourMode, minutesPerDay } = ctx.effectiveCalendarOf(row);

    const start = sourceInstant(row.cells.early_start_date ?? '', hourMode);
    const finish = sourceInstant(row.cells.early_end_date ?? '', hourMode);
    if (start === undefined || finish === undefined) continue;

    const lateStart = sourceInstant(row.cells.late_start_date ?? '', hourMode);
    const lateFinish = sourceInstant(row.cells.late_end_date ?? '', hourMode);
    const totalFloatHours = ctx.numberOf(row, 'total_float_hr_cnt');
    const totalFloat = hoursToDays(totalFloatHours, minutesPerDay);
    const freeFloat = hoursToDays(ctx.numberOf(row, 'free_float_hr_cnt'), minutesPerDay);
    const isCritical = totalFloat === undefined ? undefined : recordedIsCritical(totalFloatHours, ctx.criticalDefinition);

    times[ctx.taskIdOf(row)] = {
      start,
      finish,
      ...(lateStart !== undefined ? { lateStart } : {}),
      ...(lateFinish !== undefined ? { lateFinish } : {}),
      ...(totalFloat !== undefined ? { totalFloat } : {}),
      ...(freeFloat !== undefined ? { freeFloat } : {}),
      ...(isCritical !== undefined ? { isCritical } : {}),
    };
  }

  return times;
}
