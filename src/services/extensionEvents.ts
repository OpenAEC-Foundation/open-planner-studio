export type ExtEventListener = (data: unknown) => void;

const eventListeners = new Map<string, Set<ExtEventListener>>();

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

export function emitExtensionEvent(event: string, data?: unknown): void {
  eventListeners.get(event)?.forEach((fn) => {
    try {
      fn(data);
    } catch (err) {
      console.error(`[extensies] listener voor "${event}" gooide een fout:`, err);
    }
  });
}

export const HOST_EVENTS = {
  projectLoaded: 'host:project-loaded',
  projectNew: 'host:project-new',
  scheduleCalculated: 'host:schedule-calculated',
  tutorialRequested: 'host:tutorial-requested',
} as const;

export type HostEventName = (typeof HOST_EVENTS)[keyof typeof HOST_EVENTS];

export interface HostTutorialRequest {
  extensionId: string;
  tutorialId: string;
}
