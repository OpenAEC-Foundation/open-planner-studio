import type { AppState } from './appStore';

// Compatibele importplek voor bestaand beleid en runtime-types. Alle mutable uitvoeringsmetadata
// leeft in de per-AppStoreContext-closure uit `createStoreRuntime`, nooit in deze module. Core
// callers krijgen hun runtime geïnjecteerd; alleen adapters aan de productrand binden appStoreContext.
export {
  MAX_UNDO,
  createStoreRuntime,
  type McpTransactionLease,
  type StoreRuntime,
} from './runtime/storeRuntime';

/**
 * Sluit een mutatie af: markeer het document als gewijzigd en eventueel de planning als verouderd.
 * Snapshotkeuze en suppressie horen bij de geïnjecteerde `StoreRuntime`; deze helper muteert alleen
 * de meegegeven state en blijft daardoor puur ten opzichte van uitvoeringsmetadata.
 */
export function finishMutation(state: AppState, opts?: { stale?: boolean }): void {
  state.isDirty = true;
  if (opts?.stale) state.scheduleStale = true;

  // Iedere datumrakende mutatie verlaat "datums zoals opgeslagen". De vooraf genomen snapshot
  // bevat de oude modus; undo herstelt modus en datums daardoor nog steeds als één handeling.
  if (opts?.stale && state.datesAsRecorded) {
    state.datesAsRecorded = false;
    state.recordedDates = null;
  }
}

/**
 * Markeer invoer voor een toekomstige berekening als verouderd zonder undo/dirty te introduceren.
 * In de modus "datums zoals opgeslagen" blijft de huidige weergave waar en verandert alleen wat
 * een latere expliciete berekening zou opleveren; daarom blijft de vlag daar bewust ongemoeid.
 */
export function markScheduleStale(state: {
  scheduleStale: boolean;
  datesAsRecorded: boolean;
}): void {
  if (state.datesAsRecorded) return;
  state.scheduleStale = true;
}
