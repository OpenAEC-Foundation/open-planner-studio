export interface HistoryEventStatus {
  id: string;
  state: 'applied' | 'undone';
}

export interface RecordedDatesObservation {
  documentId: string;
  inMode: boolean;
  scheduleStale: boolean;
  history: readonly HistoryEventStatus[];
}

export function restoredFromHistory(
  prev: readonly HistoryEventStatus[],
  next: readonly HistoryEventStatus[],
): boolean {
  if (prev === next) return false;
  const before = new Map(prev.map(event => [event.id, event.state]));
  return next.some(event => {
    const state = before.get(event.id);
    return state !== undefined && state !== event.state;
  });
}

export function leftRecordedDatesMode(
  prev: RecordedDatesObservation,
  next: RecordedDatesObservation,
): boolean {
  if (next.documentId !== prev.documentId) return false;
  if (!prev.inMode || next.inMode) return false;
  return !restoredFromHistory(prev.history, next.history);
}

export function needsExitRecompute(
  scheduledForDocumentId: string,
  now: RecordedDatesObservation,
): boolean {
  if (now.documentId !== scheduledForDocumentId) return false;
  if (now.inMode) return false;
  return now.scheduleStale;
}
