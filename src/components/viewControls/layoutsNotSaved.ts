import { useAppStore } from '@/state/appStore';
import { LayoutsNotSavedError, ignoreUnreadable } from '@/utils/settingsStore';

export function layoutsNotSaved(error: unknown): void {
  if (!(error instanceof LayoutsNotSavedError)) ignoreUnreadable(error);
  useAppStore.getState().notify({ severity: 'error', messageKey: 'notifications.layoutsNotSaved' });
}
