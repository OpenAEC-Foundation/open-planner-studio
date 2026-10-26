import type { AppState } from './appStore';
import type { NotifyInput } from './slices/types';
import { snapshotOfPayload } from './snapshot';
import { recordSessionHistoryDeltas } from './sessionHistory';
import type { DocumentPayload } from './documentContract';
import type { RecordedDates, RecordedTime } from '@/engine/scheduler/recordedDates';
import { applyRecordedTimesToTasks, shiftedTaskIds } from '@/engine/scheduler/recordedDates';
import { cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import { DayClockCache, normalizeTaskDate, taskDateContext } from './migrations/minuteModel';
import { shownStart, shownFinish } from '@/utils/taskDates';
import { parseInstant } from '@/utils/dateUtils';
import { markDocumentUnsaved } from './documentEdited';

/** Normaliseer ook het bronorakel: het wordt later rechtstreeks in TaskTime geschreven. */
export function normalizeRecordedTimes(payload: Pick<DocumentPayload, 'tasks' | 'calendar' | 'calendars'>,
  recorded: RecordedDates): RecordedDates {
  const clocks = new DayClockCache(payload.calendar, payload.calendars);
  const times: Record<string, RecordedTime> = {};
  for (const task of payload.tasks) {
    const rec = recorded.times[task.id];
    if (!rec) continue;
    const ctx = taskDateContext(task, clocks);
    const norm = (value: string, field: Parameters<typeof normalizeTaskDate>[1]) => normalizeTaskDate(value, field, ctx) ?? value;
    times[task.id] = {
      ...rec, start: norm(rec.start, 'earlyStart'), finish: norm(rec.finish, 'earlyFinish'),
      ...(rec.lateStart ? { lateStart: norm(rec.lateStart, 'lateStart') } : {}),
      ...(rec.lateFinish ? { lateFinish: norm(rec.lateFinish, 'lateFinish') } : {}),
      ...(rec.summaryProgress ? { summaryProgress: { ...rec.summaryProgress,
        ...(rec.summaryProgress.actualStart ? { actualStart: norm(rec.summaryProgress.actualStart, 'actualStart') } : {}),
        ...(rec.summaryProgress.actualFinish ? { actualFinish: norm(rec.summaryProgress.actualFinish, 'actualFinish') } : {}),
      } } : {}),
    };
  }
  return { times, total: Object.keys(times).length };
}

/** Vastlegging van het getoonde document vóór een berekening buiten de laadroute. */
export function currentRecordedTimes(payload: Pick<DocumentPayload, 'tasks'>): RecordedDates {
  const times: Record<string, RecordedTime> = {};
  for (const t of payload.tasks) {
    times[t.id] = { start: shownStart(t), finish: shownFinish(t),
      lateStart: t.time.lateStart, lateFinish: t.time.lateFinish,
      totalFloat: t.time.totalFloat, freeFloat: t.time.freeFloat, isCritical: t.time.isCritical };
  }
  return { times, total: payload.tasks.length };
}

/** Eén B5-protocol voor laden, F5 en berekeningen binnen een omvattende bewerking.
 * De aanroeper publiceert after en registreert, indien nodig, beide snapshots in één event.
 * Bij een mislukte solve blijft de omzetting open. */
export function minuteModelTransition(input: DocumentPayload, computed: DocumentPayload,
  recorded?: RecordedDates) {
  if (!input.minuteModelPending || computed.cpmResult?.error || computed.datesAsRecorded) {
    return { before: input, after: computed, shifted: [] as string[], maxWorkdays: 0 };
  }
  const normalized = normalizeRecordedTimes(input, recorded ?? currentRecordedTimes(input));
  const shifted = shiftedTaskIds(computed.tasks, normalized.times);
  const after = { ...computed, minuteModelPending: false };
  if (shifted.length === 0) return { before: input, after, shifted, maxWorkdays: 0 };
  const tasks = cloneTasksForSolve(input.tasks);
  const cpmResult = applyRecordedTimesToTasks(tasks, normalized.times, input.calendar, input.calendars);
  const before: DocumentPayload = { ...input, tasks, cpmResult, scheduleStale: false, datesAsRecorded: true,
    recordedDates: { ...normalized, shifted: shifted.length, shiftedTaskIds: shifted, origin: 'ifc-own' } };
  const clocks = new DayClockCache(input.calendar, input.calendars);
  const byId = new Map(computed.tasks.map(t => [t.id, t]));
  let maxWorkdays = 0;
  for (const id of shifted) {
    const task = byId.get(id)!;
    const rec = normalized.times[id];
    const clock = clocks.calendarClock(task.calendarId);
    if (clock.kind !== 'blocks') continue;
    for (const [oldDate, newDate] of [[rec.start, shownStart(task)], [rec.finish, shownFinish(task)]]) {
      const a = parseInstant(oldDate), b = parseInstant(newDate);
      const days = Math.abs(clock.engine.workMinutesBetween(a, b)) / (clock.engine.hoursPerDay * 60);
      if (Number.isFinite(days)) maxWorkdays = Math.max(maxWorkdays, days);
    }
  }
  markDocumentUnsaved(after);
  return { before, after, shifted, maxWorkdays: Math.round(maxWorkdays * 10) / 10 };
}

export type MinuteModelTransition = ReturnType<typeof minuteModelTransition>;

export function recordMinuteModelTransition(state: AppState, transition: MinuteModelTransition,
  documentId = state.activeDocumentId): void {
  if (transition.shifted.length === 0) return;
  recordSessionHistoryDeltas(state, 'Omzetting naar minuten', [{
    kind: 'document-data', documentId, before: snapshotOfPayload(transition.before),
    after: snapshotOfPayload(transition.after), nonEdit: true,
  }]);
}

export function minuteModelNotice(transition: MinuteModelTransition): NotifyInput | undefined {
  if (transition.shifted.length === 0) return undefined;
  return { severity: 'info', messageKey: 'notifications.minuteModelConverted',
    params: { count: transition.shifted.length, document: transition.after.project.name },
    numberParams: { days: transition.maxWorkdays }, sticky: true };
}
