import { useAppStore } from '@/state/appStore';
import type { DurationDisplay } from '@/types/view';
import { effectiveDurationDisplay, profileCountsWorkdays } from '@/utils/taskDuration';

/**
 * React-hooks rond de maat van een duur (spec "alleen uren" §3.12, B8 en B9). De pure regels staan in
 * `@/utils/taskDuration`; deze hooks lezen het rekenprofiel en Duurweergave reactief uit de store.
 */

/** Telt het rekenprofiel een dagenmaat in werkdagen? Aan ⇒ "d" is de dagenmaat (B8). */
export function useProfileCountsWorkdays(): boolean {
  return useAppStore(s => profileCountsWorkdays(s.project));
}

/** De Duurweergave die schermen en afdruk gebruiken: `'auto'` in een profiel met de dagenmaat (B9). */
export function useEffectiveDurationDisplay(): DurationDisplay {
  const countsWorkdays = useProfileCountsWorkdays();
  const display = useAppStore(s => s.ui.durationDisplay);
  return effectiveDurationDisplay(display, countsWorkdays);
}
