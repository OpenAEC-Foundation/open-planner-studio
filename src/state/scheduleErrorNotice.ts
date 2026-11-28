import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { scheduleErrorMessage } from '@/i18n/scheduleErrors';
import type { NotifyInput } from './slices/types';

export function scheduleFailedNotice(cpm: Pick<CPMResult, 'error' | 'errorInfo'> | null | undefined): NotifyInput | null {
  if (!cpm?.error) return null;
  const reason = cpm.errorInfo ? scheduleErrorMessage(cpm.errorInfo) : null;
  return {
    severity: 'error',
    messageKey: 'notifications.scheduleFailed',
    ...(reason ? { detailKey: reason.key, detailParams: reason.params } : { detail: cpm.error }),
    dedupeKey: 'cpm-error',
  };
}
