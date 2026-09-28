/**
 * `api.ui.showNotification` → het ene meldingenkanaal van de app (`notify` in de store,
 * gerenderd door `NotificationHost`), plus een regel in de debuglog (`appLog`).
 *
 * Bewust een factory over een expliciet meegegeven `AppStoreContext` en géén import van de
 * app-singleton: de loader bindt hem aan `appStoreContext`, een headless host of test aan zijn
 * eigen context (zie de eigendomstabel in `.claude/rules/state.md`).
 *
 * De tekst komt van de extensie en wordt niet vertaald: hij gaat als parameter `message` in de
 * vaste sleutel `notifications.extensionMessage`, samen met de naam van de extensie. i18next
 * interpoleert zonder escaping en React zet het resultaat als tekstnode neer, dus HTML of
 * Markdown in de tekst verschijnt letterlijk en wordt nooit geïnterpreteerd.
 */
import type { AppStoreContext } from '@/state/appStore';
import type { NotificationSeverity } from '@/state/slices/types';
import { appLog } from '@/services/debug/appLog';
import type { ExtensionHostBinding } from './extensionApi';

export type ExtensionNotificationType = 'info' | 'warning' | 'error';

/** Overspoel-bescherming: zoveel nieuwe meldingen mag één extensie tonen per venster. */
export const EXT_NOTIFY_MAX_PER_WINDOW = 3;
export const EXT_NOTIFY_WINDOW_MS = 10_000;
/** Bovengrens voor de getoonde tekst; de debuglog krijgt de volledige tekst. */
export const EXT_NOTIFY_MAX_LENGTH = 500;

/**
 * Het kanaal kent twee niveaus: `error` blijft staan tot wegklikken, `info` verdwijnt na 5 s.
 * Een waarschuwing volgt de app zelf (verlies-/afwijkingswaarschuwingen zijn daar ook `info`).
 */
export function extensionNotificationSeverity(type: ExtensionNotificationType): NotificationSeverity {
  return type === 'error' ? 'error' : 'info';
}

export interface ExtensionNotifierOptions {
  /** Klok voor het overspoelvenster; injecteerbaar voor tests. */
  now?: () => number;
}

export function createExtensionNotifier(
  app: AppStoreContext,
  options: ExtensionNotifierOptions = {},
): ExtensionHostBinding['showNotification'] {
  const now = options.now ?? Date.now;
  // Per extensie de tijdstippen van de getoonde (niet samengevouwen) meldingen binnen het venster.
  const shown = new Map<string, number[]>();

  return (extensionId, message, type) => {
    const text = String(message);
    const kind: ExtensionNotificationType = type === 'error' || type === 'warning' ? type : 'info';
    const level = kind === 'error' ? 'error' : kind === 'warning' ? 'warn' : 'info';
    // De debuglog krijgt elke aanroep, ook een die hieronder niet als melding verschijnt.
    appLog.emit(level, `ext:${extensionId}`, text);

    const state = app.store.getState();
    const severity = extensionNotificationSeverity(kind);
    // Dezelfde tekst vouwt via het kanaal samen tot één melding met een teller.
    const dedupeKey = `ext:${extensionId}:${severity}:${text}`;
    const folds = state.ui.notifications.some((n) => n.dedupeKey === dedupeKey);
    if (!folds) {
      // Een extensie mag de gebruiker niet bestoken en de stapel (max. 3) niet vullen ten koste van appmeldingen: max. 3 nieuwe per 10 s.
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
