import { useAppStore } from '@/state/appStore';
import { LayoutsNotSavedError, ignoreUnreadable } from '@/utils/settingsStore';

/**
 * Afwijzing van `updateLayouts`: de opslag was niet te lezen of nam de lijst niet aan, dus er is niets opgeslagen.
 * Zeg dat, zodat de planner het opnieuw kan proberen; zijn invoer blijft staan (knownbug 1362). Een andere fout gaat door.
 */
export function layoutsNotSaved(error: unknown): void {
  if (!(error instanceof LayoutsNotSavedError)) ignoreUnreadable(error);
  useAppStore.getState().notify({ severity: 'error', messageKey: 'notifications.layoutsNotSaved' });
}
