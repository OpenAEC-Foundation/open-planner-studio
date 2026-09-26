import type { RecordedDatesState } from '@/engine/scheduler/recordedDates';

/** Markeer invoer als verouderd zonder undo/dirty te introduceren. */
export function markScheduleStale(state: {
  scheduleStale: boolean;
  datesAsRecorded: boolean;
}): void {
  if (state.datesAsRecorded) return;
  state.scheduleStale = true;
}

/** Een datum-rakende mutatie: verlaat "datums zoals opgeslagen" (de invoer wijkt nu af van het
 *  bestand) en markeer de planning als verouderd. De stale-tak van `finishMutation`, en de
 *  gridtransactie (die haar eigen history bijhoudt) gebruikt hem rechtstreeks. */
export function markDateMutation(state: {
  scheduleStale: boolean;
  datesAsRecorded: boolean;
  recordedDates: RecordedDatesState | null;
}): void {
  if (state.datesAsRecorded) {
    state.datesAsRecorded = false;
    state.recordedDates = null;
  }
  markScheduleStale(state);
}
