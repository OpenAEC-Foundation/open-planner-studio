import type { RecordedDatesState } from '@/engine/scheduler/recordedDates';

export function markScheduleStale(state: {
  scheduleStale: boolean;
  datesAsRecorded: boolean;
}): void {
  if (state.datesAsRecorded) return;
  state.scheduleStale = true;
}

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
