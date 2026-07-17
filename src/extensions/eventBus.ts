/**
 * Re-export-shim. De feitelijke event-bus is verhuisd naar de neutrale module
 * `@/services/extensionEvents` (audit "Overig": ontkoppel `state → extensions`). Dit bestand blijft
 * bestaan zodat extensie-imports (`@/extensions/eventBus`) en de barrel (`index.ts`) ongewijzigd
 * werken. Nieuwe code — met name de store-slices — importeert rechtstreeks uit `@/services/extensionEvents`.
 */
export {
  subscribeExtensionEvent,
  unsubscribeExtensionEvent,
  emitExtensionEvent,
  HOST_EVENTS,
  type ExtEventListener,
  type HostEventName,
} from '@/services/extensionEvents';
