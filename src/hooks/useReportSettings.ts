import { useSyncExternalStore } from 'react';
import { reportSettingsSnapshot, subscribeReportSettings, type ReportSettings } from '@/utils/reportSettings';

export function useReportSettings(): ReportSettings {
  return useSyncExternalStore(subscribeReportSettings, reportSettingsSnapshot, reportSettingsSnapshot);
}
