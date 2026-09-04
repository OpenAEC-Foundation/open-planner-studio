/** Markeer invoer als verouderd zonder undo/dirty te introduceren. */
export function markScheduleStale(state: {
  scheduleStale: boolean;
  datesAsRecorded: boolean;
}): void {
  if (state.datesAsRecorded) return;
  state.scheduleStale = true;
}
