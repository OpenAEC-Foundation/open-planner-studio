import type { AppStoreContext } from '@/state/appStoreFactory';
import { isAutoCalcHeld } from '@/state/editHold';
import { createFailedSolveGate, type FailedSolveGate } from '@/state/failedSolveGate';

export interface FreshResult {
  recomputed: boolean;
  error?: string;
}

export function ensureFreshSchedule(app: AppStoreContext): FreshResult {
  const state = app.store.getState();
  if (!state.scheduleStale && state.cpmResult) {
    return { recomputed: false };
  }
  state.runCPM();
  const error = app.store.getState().cpmResult?.error;
  return error ? { recomputed: true, error } : { recomputed: true };
}

export interface ReadFreshResult extends FreshResult {
  datesAsRecorded?: true;
  heldByEdit?: true;
  failedSolveUnchanged?: true;
}

const failedSolveGates = new WeakMap<AppStoreContext, FailedSolveGate>();

function failedSolveBlocks(app: AppStoreContext): boolean {
  const state = app.store.getState();
  const known = failedSolveGates.get(app);
  if (known) return known.blocks(state);
  const gate = createFailedSolveGate({
    cpmResult: null, tasks: state.tasks, sequences: state.sequences,
    calendar: state.calendar, calendars: state.calendars, project: state.project,
  });
  failedSolveGates.set(app, gate);
  app.store.subscribe((next) => { gate.blocks(next); });
  return false;
}

export function ensureFreshScheduleForRead(app: AppStoreContext): ReadFreshResult {
  const state = app.store.getState();
  if (state.datesAsRecorded) return { recomputed: false, datesAsRecorded: true };
  if (!state.scheduleStale && state.cpmResult) return { recomputed: false };
  if (isAutoCalcHeld()) return { recomputed: false, heldByEdit: true };
  if (failedSolveBlocks(app)) {
    const error = state.cpmResult?.error;
    return error
      ? { recomputed: false, failedSolveUnchanged: true, error }
      : { recomputed: false, failedSolveUnchanged: true };
  }
  return ensureFreshSchedule(app);
}
