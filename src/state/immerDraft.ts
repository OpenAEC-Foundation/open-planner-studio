import { current, isDraft, original, type Draft } from 'immer';
import type { AppState } from './appStore';

/**
 * DE ENIGE PLEK waar app-state de Immer-typegrens oversteekt.
 *
 * Immer typeert `isDraft()` als `(value: any) => boolean` — dat is géén TypeScript type guard, dus
 * ná de runtimecontrole staat er voor de compiler nog altijd gewone `AppState`. Tegelijk verlangen
 * `current()` en `original()` sinds Immer 11.1.x expliciet een `Draft<T>` in plaats van een kale
 * `T`. En `Draft<AppState>` maakt élk veld schrijfbaar — óók de bewust `readonly` niet-lege
 * deltatuple van een session-history-event (`SessionHistoryEvent.deltas`). Gewone `AppState` is
 * daarmee terecht niet meer structureel toewijsbaar aan `Draft<AppState>`: een vastgelegd
 * history-event hóórt niet in-place muteerbaar te zijn, dus dat `readonly` blijft staan.
 *
 * De vernauwing hoort dus hier — direct achter de runtimecontrole die hem waarmaakt — en niet in het
 * domeinmodel. `isAppStateDraft` levert de type guard die Immer zelf niet geeft; de expliciete
 * type-argumenten op `original`/`current` leggen vast dat er PLAIN `AppState` uit komt, onder zowel
 * de oude als de nieuwe Immer-signatuur. Zo ontsnapt er nooit een (na afloop van zijn producer
 * ingetrokken) draft naar de aanroeper.
 */
function isAppStateDraft(state: AppState): state is AppState & Draft<AppState> {
  return isDraft(state);
}

/**
 * De basisstaat van de producer waar deze draft bij hoort — de toestand van vóór de mutaties van
 * die producer — of `null` wanneer `state` geen draft is. Zie `createSnapshot` voor waarom een
 * snapshot juist die basis leest.
 */
export function originalAppState(state: AppState): AppState | null {
  if (!isAppStateDraft(state)) return null;
  return original<AppState>(state) ?? null;
}

/**
 * Een plain momentopname van de draft INCLUSIEF de mutaties die deze producer tot nu toe deed.
 * Plain (niet-draft) state komt ongewijzigd terug, dus dit kopieert niets extra's.
 */
export function currentAppState(state: AppState): AppState {
  if (!isAppStateDraft(state)) return state;
  return current<AppState>(state);
}
