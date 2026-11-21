import { useSyncExternalStore } from 'react';
import { reportSettingsSnapshot, subscribeReportSettings, type ReportSettings } from '@/utils/reportSettings';

/** De gedeelde rapportinstellingen (`ops-reportSettings`); schrijven gaat via `patchReportSettings`. */
export function useReportSettings(): ReportSettings {
  return useSyncExternalStore(subscribeReportSettings, reportSettingsSnapshot, reportSettingsSnapshot);
}
