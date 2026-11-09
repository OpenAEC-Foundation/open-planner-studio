// Het ene meldingenkanaal (`ui.notifications`) met de wachtrij van keuzes (`ui.waitingNotifications`, review #860).
// Bladmodule: importeert alleen types, zodat elke slice en elk hulpmiddel haar zonder kring kan gebruiken.
import type { AppNotification, UIState } from './slices/types';

/** Hoeveel meldingen er tegelijk staan. */
export const MAX_NOTIFICATIONS = 3;

type NotificationLists = Pick<UIState, 'notifications' | 'waitingNotifications'>;

/** Er is ruimte in de stapel: wachtende keuzes (`holdUntilRoom`) verschijnen, oudste eerst. */
export function showWaitingNotifications(ui: NotificationLists): void {
  while (ui.notifications.length < MAX_NOTIFICATIONS && ui.waitingNotifications.length > 0) {
    ui.notifications.push(ui.waitingNotifications.shift()!);
  }
}

/** Haalt de zichtbare meldingen weg waarvoor `remove` waar is, en vult de stapel daarna aan uit de wachtrij. Elke
 *  plek die meldingen wist, loopt hierdoor; anders bleef een keuze wachten terwijl er ruimte was. */
export function removeNotifications(ui: NotificationLists, remove: (n: AppNotification) => boolean): void {
  if (ui.notifications.some(remove)) ui.notifications = ui.notifications.filter(n => !remove(n));
  showWaitingNotifications(ui);
}
