import { current, isDraft, original, type Draft } from 'immer';
import type { AppState } from './appStore';
import type { ResourceAssignment } from '@/types/resource';

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

/**
 * De index van de taak met dit id in `s.tasks`, gezocht op de BASIS van de producer. `findIndex` op
 * de draft maakt voor elk doorlopen element een Immer-proxy die bij het afronden weer doorlopen wordt:
 * per bewerking O(taken) aan proxies, in een bulkbewerking O(selectie × taken) (gemeten: 500 taken
 * in een project van 8000 kostte zo ~0,5 s extra). De basisplek geldt alleen als de draft daar nog
 * dezelfde taak heeft; anders — de producer verschoof de array al, de taak is in deze producer
 * toegevoegd, of `s` is geen draft — de gewone zoektocht op `s.tasks`. Aan het begin van een
 * producer is de draftvolgorde de basisvolgorde, dus dan is de uitkomst die van `findIndex`.
 */
export function taskIndexById(s: AppState, id: string): number {
  const base = originalAppState(s);
  if (base) {
    const i = base.tasks.findIndex((t) => t.id === id);
    if (i >= 0 && i < s.tasks.length && s.tasks[i].id === id) return i;
  }
  return s.tasks.findIndex((t) => t.id === id);
}

/**
 * De toewijzingen van één taak als DRAFT-objecten (een mutatie erop landt in de draft), in de volgorde
 * van `s.assignments` — wat `s.assignments.filter(a => a.taskId === taskId)` geeft, maar gezocht op de
 * basis van de producer, zonder een proxy per toewijzing (zelfde reden als {@link taskIndexById}).
 * Alleen exact zolang deze producer `s.assignments` niet heeft herschikt, toegevoegd of verwijderd —
 * de aanroeper gebruikt hem vóór zulke mutaties. Is de lengte veranderd, of staat er op een
 * basisplek een andere toewijzing, dan de gewone filter op de draft.
 */
export function taskAssignmentDrafts(s: AppState, taskId: string): ResourceAssignment[] {
  const base = originalAppState(s)?.assignments;
  if (base && base.length === s.assignments.length) {
    const out: ResourceAssignment[] = [];
    let intact = true;
    for (let i = 0; i < base.length && intact; i++) {
      if (base[i].taskId !== taskId) continue;
      const draft = s.assignments[i];
      if (draft.id === base[i].id && draft.taskId === taskId) out.push(draft);
      else intact = false;
    }
    if (intact) return out;
  }
  return s.assignments.filter((a) => a.taskId === taskId);
}
