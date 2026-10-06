/**
 * Neutrale globale event-bus voor host↔extensie-lifecycle-events.
 *
 * Bewust een leaf-module in `src/services/` (niet in `src/extensions/`): zowel de scoped
 * extensie-API (`src/extensions/extensionApi`) als de store-slices (die host-events uitzenden)
 * putten hieruit. Zo ontstaat er GEEN waarde-import `state → extensions` (geen
 * tweerichtingskoppeling). `src/extensions/eventBus.ts` re-exporteert
 * deze module zodat bestaande extensie-imports (`@/extensions/eventBus`) ongewijzigd blijven werken.
 */

export type ExtEventListener = (data: unknown) => void;

const eventListeners = new Map<string, Set<ExtEventListener>>();

/** Abonneer op een event; geeft een unsubscribe-functie terug. */
export function subscribeExtensionEvent(event: string, listener: ExtEventListener): () => void {
  let set = eventListeners.get(event);
  if (!set) {
    set = new Set();
    eventListeners.set(event, set);
  }
  set.add(listener);
  return () => eventListeners.get(event)?.delete(listener);
}

export function unsubscribeExtensionEvent(event: string, listener: ExtEventListener): void {
  eventListeners.get(event)?.delete(listener);
}

/** Zend een event uit naar alle luisteraars; een fout in één luisteraar stopt de rest niet. */
export function emitExtensionEvent(event: string, data?: unknown): void {
  eventListeners.get(event)?.forEach((fn) => {
    try {
      fn(data);
    } catch (err) {
      console.error(`[extensies] listener voor "${event}" gooide een fout:`, err);
    }
  });
}

/**
 * Host-lifecycle-events die de app zélf op de bus zet. Extensies kunnen erop
 * abonneren via `api.events.on(...)` (permissie 'events' vereist) of de namen
 * opvragen via de SDK (`sdk.hostEvents`).
 */
export const HOST_EVENTS = {
  /** Een project is geladen (import, bestand openen, of api.data.loadProject). */
  projectLoaded: 'host:project-loaded',
  /** Een leeg project is aangemaakt. */
  projectNew: 'host:project-new',
  /** Het CPM-schema is (her)berekend. */
  scheduleCalculated: 'host:schedule-calculated',
  /**
   * De gebruiker vroeg de app een tutorial te starten (contract 1.4.0; nu: "Ja" op de tutorialvraag
   * na de eerste voltooide rondleiding). Data: {@link HostTutorialRequest}. GERICHT aan één extensie:
   * alleen de extensie met `extensionId` hoort te reageren, en `tutorialId` is een tutorialartikel
   * dat zij zelf via `api.help.registerArticles` registreerde. De host zendt pas uit als die
   * extensie actief is (haar `onLoad` is klaar), en kijkt daarna of er een begeleiding van haar loopt;
   * zo niet, dan valt hij terug op Help › Tutorials. Start dus SYNCHROON `api.help.startGuide(...)`
   * in de listener.
   */
  tutorialRequested: 'host:tutorial-requested',
} as const;

export type HostEventName = (typeof HOST_EVENTS)[keyof typeof HOST_EVENTS];

/** De data van `host:tutorial-requested` (zie {@link HOST_EVENTS}). */
export interface HostTutorialRequest {
  /** Het extensie-id waarvoor het verzoek bedoeld is; andere extensies negeren het. */
  extensionId: string;
  /** Id van een door die extensie geregistreerd tutorialartikel (`kind: 'tutorial'`). */
  tutorialId: string;
}
