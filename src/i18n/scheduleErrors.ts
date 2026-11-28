import type { CPMResult, ScheduleErrorCode, ScheduleErrorInfo } from '@/engine/scheduler/CPMSolver';

export type ScheduleErrorKey = `scheduleErrors.${ScheduleErrorCode}`;

const CODES: Record<ScheduleErrorCode, true> = {
  cycle: true, noWorkingDays: true, invalidDayDuration: true, invalidHourDuration: true,
  hourTaskWithoutWorkHours: true, taskWithoutWorkHours: true, noWorkingHours: true, invalidStartDate: true,
};
export const SCHEDULE_ERROR_CODES = Object.keys(CODES) as ScheduleErrorCode[];

export function scheduleErrorMessage(info: ScheduleErrorInfo): { key: ScheduleErrorKey; params: Record<string, string> } {
  return {
    key: `scheduleErrors.${info.code}`,
    params: { task: info.taskName ?? '', path: (info.cycleNames ?? []).join(' → ') },
  };
}

export type ScheduleErrorT = (key: any, options?: any) => string;

export function scheduleErrorText(
  source: Pick<CPMResult, 'error' | 'errorInfo'> | null | undefined,
  t: ScheduleErrorT,
): string {
  if (!source) return '';
  if (source.errorInfo) {
    const { key, params } = scheduleErrorMessage(source.errorInfo);
    return t(key, params);
  }
  return source.error ?? '';
}
