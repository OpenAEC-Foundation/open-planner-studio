import { castDraft } from 'immer';
import { markDocumentUnsaved } from '../documentEdited';
import { capturePayload } from '../documentContract';
import { minuteModelTransition, minuteModelNotice, recordMinuteModelTransition } from '../minuteModelTransition';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { RecordedDatesState } from '@/engine/scheduler/recordedDates';
import { cloneTasksForSolve, solveProject } from '@/engine/scheduler/solveProject';
import type { TaskTime } from '@/types/task';
import { solveInputFor, solveOptionsFor } from '@/engine/scheduler/solveInput';
import { expandSummaryRelations, leafTasksForSolve } from '@/engine/scheduler/expandSummaryRelations';
import { computeReliableResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import {
  levelResources as computeLeveling,
  type LevelingInput,
  type LevelingOptions,
  type LevelingResult,
} from '@/engine/scheduler/ResourceLeveler';
import { markScheduleStale } from '../transaction';
import { restoreSnapshot, createSnapshot } from '../snapshot';
import {
  SCHEDULE_SHIFT_NOTICE_KEY, canUndoScheduleShift, previousSolveBasis, scheduleShiftNotice,
  type ScheduleShift,
} from '../scheduleShift';
import { buildShiftReport } from '@/engine/scheduler/shiftExplanation';
import { scheduleFailedNotice } from '../scheduleErrorNotice';
import { HOST_EVENTS } from '@/services/extensionEvents';
import { notifyLevelingDelayRounded } from '../timephasedLossNotice';
import { clearLevelingOutput, hasLevelingOutput, writeLevelingResult } from '@/utils/taskDefaults';
import type { AppSliceFactory } from './types';

function sameTaskTime(a: TaskTime, b: TaskTime): boolean {
  const keys = Object.keys(a) as (keyof TaskTime)[];
  return keys.length === Object.keys(b).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(b, key) && (a[key] === b[key] || Object.is(a[key], b[key])));
}

export interface ScheduleSlice {
  cpmResult: CPMResult | null;
  resourceLoadResult: ResourceLoadResult | null;
  scheduleStale: boolean;
  recordedDates: RecordedDatesState | null;
  datesAsRecorded: boolean;
  minuteModelPending: boolean;
  scheduleShift: ScheduleShift | null;
  runCPM: (options?: { withinEvent?: boolean; traceDateDrivers?: boolean }) => void;
  recalculate: () => void;
  undoScheduleShift: () => void;
  recomputeResourceLoad: () => void;
  levelResources: (options: LevelingOptions) => LevelingResult;
  levelingInput: (options: LevelingOptions) => LevelingInput | null;
  applyLeveling: (
    write: Pick<LevelingResult, 'delays' | 'gaps' | 'delayMinutes'>,
    opts?: { scopeTaskIds?: string[] },
  ) => void;
  clearLeveling: () => void;
}

export const createScheduleSlice: AppSliceFactory<ScheduleSlice> = (runtime) => (set, get) => ({
  cpmResult: null,
  resourceLoadResult: null,
  scheduleStale: false,
  recordedDates: null,
  datesAsRecorded: false,
  minuteModelPending: false,
  scheduleShift: null,

  recomputeResourceLoad: () => {
    const s = get();
    const result = computeReliableResourceLoad(
      s.cpmResult, s.resources, s.assignments, s.tasks, s.calendar, s.calendars, effectiveSchedulingOptions(s.project),
    );
    set((st) => { st.resourceLoadResult = result; });
  },

  runCPM: (options) => {
    const before = get();
    const tasks = cloneTasksForSolve(before.tasks);
    const input = solveInputFor(before.project, tasks, before.sequences, before.calendar, before.calendars);
    const result = solveProject({ ...input, traceDateDrivers: options?.traceDateDrivers }, before.tasks);
    const resourceLoad = computeReliableResourceLoad(
      result, before.resources, before.assignments, tasks, before.calendar, before.calendars, input.schedulingOptions,
    );

    const computed = { ...capturePayload(before), tasks, cpmResult: result, resourceLoadResult: resourceLoad,
      scheduleStale: false, datesAsRecorded: false, recordedDates: null };
    const conversion = minuteModelTransition(capturePayload(before), computed);
    const ownConversionEvent = conversion.shifted.length > 0 && !options?.withinEvent;
    set((s) => {
      const refreshPreviousEventAfter = !ownConversionEvent && s.scheduleStale && !s.datesAsRecorded;
      let openedHistory = false;
      if (s.datesAsRecorded && !ownConversionEvent) {
        runtime.beginUndoable(s);
        openedHistory = true;
        s.datesAsRecorded = false;
        s.recordedDates = null;
      }
      s.scheduleStale = false;
      if (result.error) {
        s.cpmResult = result;
        s.resourceLoadResult = null;
        if (openedHistory) runtime.finishUndoable(s, { nonEdit: true });
        else if (refreshPreviousEventAfter) runtime.refreshLatestDocumentDataHistoryAfter(s);
        markScheduleStale(s);
        return;
      }

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        if (!sameTaskTime(task.time, before.tasks[i].time)) Object.assign(s.tasks[i].time, task.time);
        if (task.status !== before.tasks[i].status) s.tasks[i].status = task.status;
      }
      s.cpmResult = result;
      s.minuteModelPending = conversion.after.minuteModelPending;
      s.datesAsRecorded = false;
      s.recordedDates = null;
      if (conversion.shifted.length > 0) markDocumentUnsaved(s);
      s.resourceLoadResult = resourceLoad;
      if (ownConversionEvent) recordMinuteModelTransition(s, conversion);
      else if (openedHistory) runtime.finishUndoable(s, { nonEdit: true });
      else if (refreshPreviousEventAfter) runtime.refreshLatestDocumentDataHistoryAfter(s);
    });
    const conversionNotice = minuteModelNotice(conversion);
    if (conversionNotice) get().notify(conversionNotice);

    get().recomputeViewRows();

    const failed = scheduleFailedNotice(get().cpmResult);
    if (failed) get().notify(failed);

    const cpm = get().cpmResult;
    runtime.emitHostEvent(HOST_EVENTS.scheduleCalculated, {
      hasError: !!cpm?.error,
      error: cpm?.error ?? null,
      criticalTasks: get().tasks.filter((t) => t.time.isCritical).length,
    });
  },

  recalculate: () => {
    const before = get();
    if (before.ui.autoCalcCPM) {
      before.runCPM();
      return;
    }
    const basis = previousSolveBasis(before);
    before.runCPM({ traceDateDrivers: true });
    const after = get();
    if (!after.cpmResult || after.cpmResult.error) {
      set((s) => {
        s.scheduleShift = null;
        s.ui.notifications = s.ui.notifications.filter(n => n.dedupeKey !== SCHEDULE_SHIFT_NOTICE_KEY);
      });
      return;
    }
    const report = buildShiftReport({
      tasksBefore: before.tasks,
      tasksAfter: after.tasks,
      result: after.cpmResult,
      previousProjectEnd: before.cpmResult && !before.cpmResult.error ? before.cpmResult.projectEnd : undefined,
      calendar: after.calendar,
      calendars: after.calendars,
      assignments: after.assignments,
      statusDate: after.project.statusDate,
      basis,
    });
    if (report.tasks.length === 0 && !before.scheduleStale && !before.datesAsRecorded) return;
    const historyEventId = after.historyEvents.find(event => event.sequence === before.nextHistorySequence)?.id ?? null;
    set((s) => {
      s.scheduleShift = {
        documentId: s.activeDocumentId,
        report,
        before: castDraft(createSnapshot(before)),
        beforeResourceLoad: before.resourceLoadResult,
        after: castDraft(createSnapshot(after)),
        historyEventId,
        refreshedHistoryEvent: historyEventId === null && before.scheduleStale && !before.datesAsRecorded,
      };
      if (report.tasks.length === 0) {
        s.ui.notifications = s.ui.notifications.filter(n => n.dedupeKey !== SCHEDULE_SHIFT_NOTICE_KEY);
      }
    });
    if (report.tasks.length > 0) get().notify(scheduleShiftNotice(report));
  },

  undoScheduleShift: () => {
    const current = get();
    const shift = current.scheduleShift;
    if (!shift || !canUndoScheduleShift(current)) return;
    if (shift.historyEventId !== null) current.undoHistoryEvent(shift.historyEventId);
    else {
      set((s) => {
        restoreSnapshot(s, shift.before, { clearImportPristine: false });
        s.resourceLoadResult = shift.beforeResourceLoad;
        markScheduleStale(s);
        if (shift.refreshedHistoryEvent) runtime.refreshLatestDocumentDataHistoryAfter(s);
      });
    }
    set((s) => {
      s.scheduleShift = null;
      s.ui.showScheduleShiftPanel = false;
      s.ui.notifications = s.ui.notifications.filter(n => n.dedupeKey !== SCHEDULE_SHIFT_NOTICE_KEY);
    });
    get().recomputeViewRows();
  },

  levelingInput: (options) => {
    const s = get();
    const cpm = s.cpmResult;
    if (!cpm || cpm.error) return null;
    const leafTasks = leafTasksForSolve(s.tasks);
    const { sequences: expandedSequences } = expandSummaryRelations(s.tasks, s.sequences);
    return [
      leafTasks, expandedSequences, s.resources, s.assignments, s.calendar, s.calendars, cpm, options,
      solveOptionsFor(s.project),
    ];
  },

  levelResources: (options) => {
    const input = get().levelingInput(options);
    if (!input) {
      const end = get().cpmResult?.projectEnd ?? '';
      return { delays: {}, unresolved: {}, unresolvedReasons: {}, shifts: {}, projectEndBefore: end, projectEndAfter: end, gaps: {} };
    }
    return computeLeveling(...input);
  },

  applyLeveling: (write, opts) => {
    let roundedCount = 0;
    set((s) => {
      runtime.beginUndoable(s);
      roundedCount = writeLevelingResult(s.tasks, write, opts?.scopeTaskIds);
      runtime.finishMutation(s, { stale: true });
    });
    if (roundedCount > 0) {
      notifyLevelingDelayRounded(get().notify, get().activeDocumentId, roundedCount);
    }
    get().runCPM({ withinEvent: true });
  },

  clearLeveling: () => {
    let changed = false;
    let roundedCount = 0;
    set((s) => {
      if (!s.tasks.some(hasLevelingOutput)) return;
      runtime.beginUndoable(s);
      for (const task of s.tasks) {
        if (clearLevelingOutput(task)) roundedCount++;
      }
      runtime.finishMutation(s, { stale: true });
      changed = true;
    });
    if (roundedCount > 0) {
      notifyLevelingDelayRounded(get().notify, get().activeDocumentId, roundedCount);
    }
    if (changed) get().runCPM({ withinEvent: true });
  },
});
