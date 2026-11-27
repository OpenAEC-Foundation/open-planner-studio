import type { AppStoreContext } from '@/state/appStore';
import type { NotificationSeverity } from '@/state/slices/types';
import { appLog } from '@/services/debug/appLog';
import type { ExtensionHostBinding } from './extensionApi';

export type ExtensionNotificationType = 'info' | 'warning' | 'error';

export const EXT_NOTIFY_MAX_PER_WINDOW = 3;
export const EXT_NOTIFY_WINDOW_MS = 10_000;
export const EXT_NOTIFY_MAX_LENGTH = 500;

export function extensionNotificationSeverity(type: ExtensionNotificationType): NotificationSeverity {
  return type === 'error' ? 'error' : 'info';
}

export interface ExtensionNotifierOptions {
  now?: () => number;
}

export function createExtensionNotifier(
  app: AppStoreContext,
  options: ExtensionNotifierOptions = {},
): ExtensionHostBinding['showNotification'] {
  const now = options.now ?? Date.now;
  const shown = new Map<string, number[]>();

  return (extensionId, message, type) => {
    const text = String(message);
    const kind: ExtensionNotificationType = type === 'error' || type === 'warning' ? type : 'info';
    const level = kind === 'error' ? 'error' : kind === 'warning' ? 'warn' : 'info';
    appLog.emit(level, `ext:${extensionId}`, text);

    const state = app.store.getState();
    const severity = extensionNotificationSeverity(kind);
    const dedupeKey = `ext:${extensionId}:${severity}:${text}`;
    const folds = state.ui.notifications.some((n) => n.dedupeKey === dedupeKey);
    if (!folds) {
      const t = now();
      const recent = (shown.get(extensionId) ?? []).filter((at) => t - at < EXT_NOTIFY_WINDOW_MS);
      if (recent.length >= EXT_NOTIFY_MAX_PER_WINDOW) {
        shown.set(extensionId, recent);
        appLog.emit('warn', `ext:${extensionId}`, 'melding onderdrukt (overspoel-bescherming)');
        return;
      }
      recent.push(t);
      shown.set(extensionId, recent);
    }

    const name = state.installedExtensions[extensionId]?.manifest.name ?? extensionId;
    state.notify({
      severity,
      messageKey: 'notifications.extensionMessage',
      params: {
        name,
        message: text.length > EXT_NOTIFY_MAX_LENGTH ? `${text.slice(0, EXT_NOTIFY_MAX_LENGTH)}…` : text,
      },
      dedupeKey,
    });
  };
}
