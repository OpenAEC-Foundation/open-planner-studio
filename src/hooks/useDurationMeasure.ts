import { useAppStore } from '@/state/appStore';
import type { DurationDisplay } from '@/types/view';
import { effectiveDurationDisplay, profileCountsWorkdays } from '@/utils/taskDuration';

export function useProfileCountsWorkdays(): boolean {
  return useAppStore(s => profileCountsWorkdays(s.project));
}

export function useEffectiveDurationDisplay(): DurationDisplay {
  const countsWorkdays = useProfileCountsWorkdays();
  const display = useAppStore(s => s.ui.durationDisplay);
  return effectiveDurationDisplay(display, countsWorkdays);
}
