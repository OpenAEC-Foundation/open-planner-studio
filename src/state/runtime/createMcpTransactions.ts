import { changesOnlyDateNeutralFields } from '../taskDateChanges';
import { beginRecordedDateEdit, endRecordedDateEdit, keepsRecordedDates, recordedDateRuleChange } from '../recordedDateEditGate';
import { assertMinuteModelTaskDates, normalizeTaskDates, normalizeTaskPatch } from '../migrations/minuteModel';
import type { AppState, AppStoreContext } from '../appStore';
import { attachToParent, isSelfOrDescendant, removeTaskSubtrees, reparentTask } from '@/state/taskTree';
import {
  applyPhaseTransitions, describePhaseRefusal, describePhaseTransitions, firstChildGains, planPhaseTransitions,
  type PhaseTransitionReport,
} from '../structuralTransition';
import { createSnapshot, documentDataChanged, restoreSnapshot, type Snapshot } from '../snapshot';
import { replaceSessionHistoryState } from '../sessionHistory';
import { relationVerdict } from '../relationRules';
import { generateId } from '@/utils/id';
import { localTodayIso } from '@/utils/dateUtils';
import {
  buildNewTask, createDefaultTaskTime, deriveScheduleDurationFromMinutes, mergeTaskTime, mergeTaskUpdate, taskTriggerChanges,
  taskCalendarHoursPerDay, taskWorkMinutesOf, invalidateForTimeBaseChange, clearLevelingGaps,
  writeLevelingResult, clearLevelingOutput,
  contourKeepsWork, hourInputFinishBasis, reconcileHourInputFinish, seedNewHourTaskFinish, type HourInputFinishBasis,
} from '@/utils/taskDefaults';
import { effHoursPerDay } from '@/utils/taskDuration';
import { newTaskTimeUnit, settleNewTaskMeasure } from '../newTaskMeasure';
import { sameValue } from '@/utils/sameValue';
import { applyWbsNumbering } from '@/utils/wbs';
import { assignInsertedWbsCodes } from '../insertedBranch';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { syncProjectCalendar } from '../syncProjectCalendar';
import { notifyTimephasedLoss, notifyLevelingDelayRounded } from '../timephasedLossNotice';
import { notifyWorkRuleDurationsChanged } from '../taskTypesNotice';
import { assignmentsByTask, tasksOnCalendar } from '../calendarTasks';
import type { McpTransactionLease } from './storeRuntime';
import type { DurationType, Task, TimephasedContourPeriod } from '@/types/task';
import {
  acceptedAssignmentPatch, acceptedCostAmount, acceptedCostResourcePatch, applyAssignmentCost, isCostAssignment,
  settleCostResourceFields,
  applyAssignmentPatch, contoursAfterEdit, insertAssignment, insertResource,
  purgeResource, relocateAssignment, removeAssignment,
} from '../assignmentMutations';
import { applyTaskSplits, taskSplitRefusal } from '../splitMutations';
import type { SplitPiece, SplitRefusal } from '@/engine/scheduler/splitEdit';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { isValidUnits, type Resource, type ResourceAssignment, type ResourceCurve } from '@/types/resource';
import type { Project } from '@/types/project';
import type { CustomTaskTypeDraft } from '@/types/taskType';
import { enteringDocument } from '@/services/taskTypes/customTaskTypeColors';
import type { LevelingResult } from '@/engine/scheduler/ResourceLeveler';
import { applyProjectPatch, type ClearableProjectKey, type ProjectPatchOutcome } from '../projectPatch';
import { customTaskTypeClashes } from '@/services/taskTypes/customTaskTypeRules';
import { isThenable } from '@/utils/guards';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { reconcileP6SuspendResume } from '@/utils/p6SuspendResume';
import {
  captureCalendarChange, captureTriangle, durationEditRefusal, planWorkEdit, commitTrianglePlan, settleEditedDuration,
  captureProgressWork, settleProgressWork, syncAssignmentWorkToContour,
  settleCalendarChange, settleDurationAftermath, settleDurationEdit, settleRuleChange,
  hourSourceOf, routeFixedWorkDurationToHours,
  type DurationEditProgress, type RecomputedRemainingWork,
} from '@/engine/work/workRuleApply';
import { remainingWorkRecomputedNotice } from '../remainingWorkNotice';
import type { WorkRule } from '@/types/workRule';
import { markDocumentEdited } from '@/state/documentEdited';

export type McpTransactionResult<T> =
  | {
    ok: true; value: T; timephasedGuidanceLost: number;
    remainingWorkRecomputed: readonly RecomputedRemainingWork[];
  }
  | { ok: false; error: string };

type Synchronous<T> = T extends PromiseLike<unknown> ? never : T;

export interface McpTransactions {
  run<T>(fn: () => Synchronous<T>): McpTransactionResult<T>;
  draft: McpDraft;
  isActive(): boolean;
}

export type BulkTaskItem = Partial<Task> & {
  name: string;
  tempId: string;
  position?: number;
};

export type McpDurationProgressOutcome =
  | { refused: Extract<DurationEditProgress, { refused: true }> }
  | { progress: Extract<DurationEditProgress, { refused: false }> }
  | null;

function createMcpDraft(
  context: AppStoreContext,
  activeLease: () => McpTransactionLease,
) {
  const { store, runtime } = context;
  const recordTimephasedLoss = (taskId: string): void => {
    runtime.recordMcpTimephasedLoss(activeLease(), taskId);
  };
  const recordRecomputedWork = (items: readonly RecomputedRemainingWork[]): void => {
    runtime.recordMcpRecomputedWork(activeLease(), items);
  };

  const afterTriangleDurationChange = (
    s: { calendars: WorkCalendar[]; calendar: WorkCalendar; project: Pick<Project, 'defaultWorkRule'>; resources: Resource[] },
    task: Task,
    oldWorkMinutes: number,
    finishBasis: HourInputFinishBasis,
  ): void => {
    if (settleDurationAftermath(task, s, oldWorkMinutes, finishBasis)) recordTimephasedLoss(task.id);
  };

  const rawDraft = {
  addTask(partial: Partial<Task> & { name: string }): string {
    const id = generateId('task');
    store.setState((s) => {
      const now = s.project.startDate || localTodayIso();
      const parentId = partial.parentId ?? null;
      const parentTask = parentId !== null ? s.tasks.find((t) => t.id === parentId) : undefined;
      if (parentId !== null && !parentTask) {
        throw new Error(`draft.addTask: unknown parentId '${parentId}'`);
      }
      const newCalendar = resolveCalendar(partial.calendarId, s.calendars, s.calendar);
      const time = mergeTaskTime(createDefaultTaskTime(now, partial.isMilestone ? 0 : 5, newTaskTimeUnit(s.project), newCalendar), partial.time);
      deriveScheduleDurationFromMinutes(time, effHoursPerDay(newCalendar));
      const task = buildNewTask(partial, {
        id, parentId, parentTask, constructionMode: s.ui.constructionMode, time,
      });
      const madeHours = settleNewTaskMeasure(task, s.project, partial.time?.durationUnit !== undefined,
        taskCalendarHoursPerDay(task, s.calendars, s.calendar));
      seedNewHourTaskFinish(task, madeHours ? undefined : partial.time, resolveCalendar(task.calendarId, s.calendars, s.calendar));
      if (partial.workRule !== undefined) s.taskTypesVisible = true;

      s.tasks.push(normalizeTaskDates(task, s));
      if (parentId) attachToParent(s.tasks, id, parentId);

      if (s.project.wbsAutoNumber || !partial.wbsCode) assignInsertedWbsCodes(s, [id]);

      markDocumentEdited(s);
    });
    return id;
  },

  addTasks(items: BulkTaskItem[], phaseReport?: PhaseTransitionReport[]): Map<string, string> {
    const leafIdsBefore = new Set(store.getState().tasks.filter((t) => t.childIds.length === 0).map((t) => t.id));

    const tempIds = new Set<string>();
    for (const item of items) {
      if (tempIds.has(item.tempId)) {
        throw new Error(`draft.addTasks: duplicate tempId '${item.tempId}' within the call`);
      }
      tempIds.add(item.tempId);
    }

    const existingIds = new Set(store.getState().tasks.map((t) => t.id));
    for (const item of items) {
      const p = item.parentId ?? null;
      if (p !== null && !existingIds.has(p) && !tempIds.has(p)) {
        throw new Error(
          `draft.addTasks: unknown parentId '${p}' (no existing task id and no tempId from the call)`,
        );
      }
    }

    for (const item of items) {
      if (item.isMilestone && item.time && item.time.scheduleDuration > 0) {
        throw new Error(
          `draft.addTasks: milestone '${item.tempId}' may not have a duration > 0 (scheduleDuration=${item.time.scheduleDuration})`,
        );
      }
    }

    const byTempId = new Map(items.map((it) => [it.tempId, it]));
    const visitState = new Map<string, 1 | 2>();
    const sorted: BulkTaskItem[] = [];
    const visit = (item: BulkTaskItem) => {
      const st = visitState.get(item.tempId);
      if (st === 2) return;
      if (st === 1) throw new Error(`draft.addTasks: loop in tempId parents around '${item.tempId}'`);
      visitState.set(item.tempId, 1);
      const p = item.parentId ?? null;
      if (p !== null && tempIds.has(p)) visit(byTempId.get(p)!);
      visitState.set(item.tempId, 2);
      sorted.push(item);
    };
    for (const item of items) visit(item);

    const idMap = new Map<string, string>();
    for (const item of sorted) {
      const { tempId, position: _position, parentId, ...taskFields } = item;
      const rawParent = parentId ?? null;
      const resolvedParent =
        rawParent !== null && idMap.has(rawParent) ? idMap.get(rawParent)! : rawParent;
      const realId = rawDraft.addTask({ ...taskFields, parentId: resolvedParent });
      idMap.set(tempId, realId);
    }

    const positioned = items.filter((it) => it.position !== undefined);
    if (positioned.length > 0) {
    store.setState((s) => {
        for (const item of positioned) {
          const id = idMap.get(item.tempId)!;
          const task = s.tasks.find((t) => t.id === id);
          if (!task) continue;
          const pos = item.position!;

          if (task.parentId) {
            const parent = s.tasks.find((t) => t.id === task.parentId);
            if (!parent) continue;
            const curChild = parent.childIds.indexOf(id);
            if (curChild >= 0) parent.childIds.splice(curChild, 1);
            const clamped = Math.max(0, Math.min(pos, parent.childIds.length));
            parent.childIds.splice(clamped, 0, id);
            const curArr = s.tasks.findIndex((t) => t.id === id);
            const [obj] = s.tasks.splice(curArr, 1);
            const nextId = parent.childIds[clamped + 1];
            let insertAt: number;
            if (nextId !== undefined) {
              insertAt = s.tasks.findIndex((t) => t.id === nextId);
            } else {
              const prevId = parent.childIds[clamped - 1];
              insertAt =
                prevId !== undefined
                  ? s.tasks.findIndex((t) => t.id === prevId) + 1
                  : s.tasks.findIndex((t) => t.id === task.parentId) + 1;
            }
            s.tasks.splice(insertAt, 0, obj);
          } else {
            const curArr = s.tasks.findIndex((t) => t.id === id);
            const [obj] = s.tasks.splice(curArr, 1);
            const rootIds = s.tasks.filter((t) => !t.parentId).map((t) => t.id);
            const clamped = Math.max(0, Math.min(pos, rootIds.length));
            const nextRootId = rootIds[clamped];
            const insertAt =
              nextRootId !== undefined ? s.tasks.findIndex((t) => t.id === nextRootId) : s.tasks.length;
            s.tasks.splice(insertAt, 0, obj);
          }
        }
        if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
        markDocumentEdited(s);
      });
    }

    store.setState((s) => {
      const gains = s.tasks
        .filter((t) => leafIdsBefore.has(t.id) && t.childIds.length > 0)
        .map((t) => ({ phaseId: t.id, childIds: [...t.childIds] }));
      if (gains.length === 0) return;
      const plan = planPhaseTransitions(s, gains);
      if (!plan.ok) throw new Error(describePhaseRefusal(s, plan.refusal));
      for (const lostId of applyPhaseTransitions(s, plan.transitions)) recordTimephasedLoss(lostId);
      phaseReport?.push(...describePhaseTransitions(s, plan.transitions));
    });

    return idMap;
  },

  moveTask(id: string, newParentId: string | null, position?: number): PhaseTransitionReport[] {
    let reports: PhaseTransitionReport[] = [];
    store.setState((s) => {
      if (!s.tasks.some((t) => t.id === id)) throw new Error(`draft.moveTask: unknown task '${id}'`);
      if (newParentId !== null) {
        if (!s.tasks.some((t) => t.id === newParentId)) throw new Error(`draft.moveTask: unknown parent '${newParentId}'`);
        if (isSelfOrDescendant(s.tasks, newParentId, id)) {
          throw new Error(`draft.moveTask: '${id}' cannot go under itself or one of its own descendants`);
        }
      }
      const plan = planPhaseTransitions(s, firstChildGains(s.tasks, [{ childId: id, parentId: newParentId }]));
      if (!plan.ok) throw new Error(describePhaseRefusal(s, plan.refusal));
      reparentTask(s.tasks, id, newParentId, position);
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      for (const lostId of applyPhaseTransitions(s, plan.transitions)) recordTimephasedLoss(lostId);
      reports = describePhaseTransitions(s, plan.transitions);
      markDocumentEdited(s);
    });
    return reports;
  },

  addSequence(seq: Omit<Sequence, 'id'>): string | null {
    const id = generateId('seq');
    let result: string | null = null;
    store.setState((s) => {
      const lookup = (tid: string) => s.tasks.find((t) => t.id === tid);
      if (!relationVerdict(lookup, s.sequences, seq).ok) return;
      s.sequences.push({ ...seq, id });
      markDocumentEdited(s);
      result = id;
    });
    return result;
  },

  updateTaskFields(id: string, updates: Partial<Task>): McpDurationProgressOutcome {
    let outcome: McpDurationProgressOutcome = null;
    store.setState((s) => {
      const idx = s.tasks.findIndex((t) => t.id === id);
      if (idx < 0) return;
      const task = s.tasks[idx];
      const next = normalizeTaskDates(mergeTaskUpdate(task, updates), s);
      if (updates.time && routeFixedWorkDurationToHours(next, task.time, next.time, s.project.defaultWorkRule,
        taskCalendarHoursPerDay(next, s.calendars, s.calendar))) {
        updates = { ...updates, time: { ...updates.time, ...hourSourceOf(next.time) } };
      }
      updates = normalizeTaskPatch(updates, next);
      if (sameValue(task, next)) return;
      const dateNeutralPatch = changesOnlyDateNeutralFields(task, next);
      if (taskTriggerChanges(task, next).timeBase) {
        const refusal = durationEditRefusal(task, next.time, taskCalendarHoursPerDay(next, s.calendars, s.calendar));
        if (refusal) { outcome = { refused: refusal }; return; }
      }
      const { time, workRule, calendarId, ...rest } = updates;
      const finishBasis = hourInputFinishBasis(task);
      const calendarChanged = 'calendarId' in updates && task.calendarId !== calendarId;
      let lost = false;
      if (calendarChanged) {
        const before = captureCalendarChange(task, s.assignments, s);
        task.calendarId = calendarId;
        lost = settleCalendarChange(task, s.assignments, before, s).timephasedLost;
      }
      const afterRest = mergeTaskUpdate(task, time ? { ...rest, time } : rest);
      const changes = taskTriggerChanges(task, afterRest);
      const contourHpd = taskCalendarHoursPerDay(task, s.calendars, s.calendar);
      const triangle = changes.timeBase ? captureTriangle(task, s.assignments, s) : null;
      const progressWork = time ? captureProgressWork(task, s) : null;
      const timeBefore = { ...task.time };
      Object.assign(task, rest);
      if (time) task.time = afterRest.time;
      if (changes.timeBase) {
        const duration = settleEditedDuration(task, timeBefore, contourHpd, {
          statusDate: s.project.statusDate,
          calendar: resolveCalendar(task.calendarId, s.calendars, s.calendar),
          workdayDurationMeasure: effectiveSchedulingOptions(s.project).workdayDurationMeasure === true,
          keepWork: contourKeepsWork(task, s.project.defaultWorkRule),
        });
        if (duration.progress && !duration.progress.refused) outcome = { progress: duration.progress };
        lost = duration.timephasedLost || lost;
        recordRecomputedWork(settleDurationEdit(task, triangle).recomputedWork);
      }
      settleProgressWork(task, s.assignments, progressWork);
      if ('workRule' in updates && task.workRule !== workRule) {
        recordedDateRuleChange(context, task, dateNeutralPatch, () => settleRuleChange(task, s.assignments, s, workRule));
        if (workRule !== undefined) s.taskTypesVisible = true;
      }
      reconcileP6SuspendResume(task);
      if (calendarChanged) lost = invalidateForTimeBaseChange(task) || lost;
      if (lost) recordTimephasedLoss(id);
      if (changes.levelingGaps || calendarChanged) clearLevelingGaps(task);
      reconcileHourInputFinish(task, finishBasis, resolveCalendar(task.calendarId, s.calendars, s.calendar));
      Object.assign(task, normalizeTaskDates(task, s));
      markDocumentEdited(s);
    });
    return outcome;
  },

  patchTaskFields(
    id: string,
    top: Partial<Task>,
    timePatch?: { scheduleDuration?: number; durationUnit?: 'days' | 'hours'; durationMinutes?: number; durationType?: DurationType; clearDurationMinutes?: boolean },
    deferCompletion?: boolean,
  ): McpDurationProgressOutcome {
    let outcome: McpDurationProgressOutcome = null;
    store.setState((s) => {
      const idx = s.tasks.findIndex((t) => t.id === id);
      if (idx < 0) return;
      const task = s.tasks[idx];
      let tp = timePatch;
      const patchTime = (base: Task['time']): Task['time'] => {
        const time = { ...base };
        if (!tp) return time;
        if (tp.scheduleDuration !== undefined) time.scheduleDuration = tp.scheduleDuration;
        if (tp.durationUnit !== undefined) time.durationUnit = tp.durationUnit;
        if (tp.durationMinutes !== undefined) time.durationMinutes = tp.durationMinutes;
        if (tp.durationType !== undefined) time.durationType = tp.durationType;
        if (tp.clearDurationMinutes) delete time.durationMinutes;
        return time;
      };
      const next = normalizeTaskDates({ ...task, ...top, time: patchTime(top.time ?? task.time) }, s);
      if (routeFixedWorkDurationToHours(next, task.time, next.time, s.project.defaultWorkRule,
        taskCalendarHoursPerDay(next, s.calendars, s.calendar))) {
        tp = { ...tp, ...hourSourceOf(next.time), clearDurationMinutes: false };
      }
      top = normalizeTaskPatch(top, next);
      if (sameValue(task, next)) return;
      const dateNeutralPatch = changesOnlyDateNeutralFields(task, next);
      if (taskTriggerChanges(task, next).timeBase) {
        const refusal = durationEditRefusal(task, next.time, taskCalendarHoursPerDay(next, s.calendars, s.calendar));
        if (refusal) { outcome = { refused: refusal }; return; }
      }
      const { workRule, calendarId, ...topRest } = top;
      const finishBasis = hourInputFinishBasis(task);
      const calendarChanged = 'calendarId' in top && task.calendarId !== calendarId;
      let lost = false;
      if (calendarChanged) {
        const before = captureCalendarChange(task, s.assignments, s);
        task.calendarId = calendarId;
        lost = settleCalendarChange(task, s.assignments, before, s).timephasedLost;
      }
      const patchedTime = patchTime(topRest.time ?? task.time);
      const changes = taskTriggerChanges(task, { ...task, ...topRest, time: patchedTime });
      const contourHpd = taskCalendarHoursPerDay(task, s.calendars, s.calendar);
      const triangle = changes.timeBase ? captureTriangle(task, s.assignments, s) : null;
      const timeBefore = { ...task.time };
      Object.assign(task, topRest);
      task.time = patchedTime;
      if (changes.timeBase) {
        const duration = settleEditedDuration(task, timeBefore, contourHpd, {
          statusDate: s.project.statusDate,
          calendar: resolveCalendar(task.calendarId, s.calendars, s.calendar),
          workdayDurationMeasure: effectiveSchedulingOptions(s.project).workdayDurationMeasure === true,
          keepWork: contourKeepsWork(task, s.project.defaultWorkRule),
          deferCompletion,
        });
        if (duration.progress && !duration.progress.refused) outcome = { progress: duration.progress };
        lost = duration.timephasedLost || lost;
        recordRecomputedWork(settleDurationEdit(task, triangle).recomputedWork);
      }
      if ('workRule' in top && task.workRule !== workRule) {
        recordedDateRuleChange(context, task, dateNeutralPatch, () => settleRuleChange(task, s.assignments, s, workRule));
        if (workRule !== undefined) s.taskTypesVisible = true;
      }
      reconcileP6SuspendResume(task);
      if (calendarChanged) lost = invalidateForTimeBaseChange(task) || lost;
      if (lost) recordTimephasedLoss(id);
      if (changes.levelingGaps || calendarChanged) clearLevelingGaps(task);
      reconcileHourInputFinish(task, finishBasis, resolveCalendar(task.calendarId, s.calendars, s.calendar));
      Object.assign(task, normalizeTaskDates(task, s));
      markDocumentEdited(s);
    });
    return outcome;
  },

  setTaskSplits(taskId: string, pieces: SplitPiece[] | null): SplitRefusal | null {
    let refusal: SplitRefusal | null = null;
    store.setState((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error(`draft.setTaskSplits: unknown taskId '${taskId}'`);
      const hoursPerDay = taskCalendarHoursPerDay(task, s.calendars, s.calendar);
      refusal = taskSplitRefusal(task, pieces, hoursPerDay);
      if (refusal) return;
      const outcome = applyTaskSplits(s, task, pieces, hoursPerDay);
      if (outcome.timephasedLost) recordTimephasedLoss(taskId);
      recordRecomputedWork(outcome.recomputedWork);
      markDocumentEdited(s);
    });
    return refusal;
  },

  ensureCustomTaskType(type: CustomTaskTypeDraft): void {
    store.setState((s) => {
      const normalized = { id: type.id.trim(), name: type.name.trim() };
      if (!normalized.id || !normalized.name) throw new Error('draft.ensureCustomTaskType: id and name must not be empty');
      const { sameId, sameNameOtherId } = customTaskTypeClashes(s.customTaskTypes, normalized);
      if (sameId) {
        if (sameId.name !== normalized.name) throw new Error(`draft.ensureCustomTaskType: id '${normalized.id}' already has name '${sameId.name}'`);
        return;
      }
      if (sameNameOtherId) throw new Error(`draft.ensureCustomTaskType: name '${normalized.name}' already has id '${sameNameOtherId.id}'`);
      s.customTaskTypes.push(enteringDocument(normalized, s.customTaskTypes));
      markDocumentEdited(s);
    });
  },

  deleteTask(id: string): void {
    store.setState((s) => {
      if (!s.tasks.some((t) => t.id === id)) return;
      removeTaskSubtrees(s, [id]);
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      markDocumentEdited(s);
    });
  },

  addCalendar(cal: Omit<WorkCalendar, 'id'>): string {
    const id = generateId('cal');
    store.setState((s) => {
      s.calendars.push({ ...cal, id });
      syncProjectCalendar(s);
      markDocumentEdited(s);
    });
    return id;
  },

  updateCalendar(id: string, updates: Partial<WorkCalendar>): void {
    let changed = 0;
    store.setState((s) => {
      const idx = s.calendars.findIndex((c) => c.id === id);
      if (idx < 0) throw new Error(`draft.updateCalendar: unknown calendar id '${id}'`);
      const byTask = assignmentsByTask(s.assignments);
      const affected = tasksOnCalendar(s, id).map((task) => ({ task, before: captureCalendarChange(task, byTask.get(task.id) ?? [], s) }));
      Object.assign(s.calendars[idx], updates);
      syncProjectCalendar(s);
      for (const { task, before } of affected) {
        const settled = settleCalendarChange(task, byTask.get(task.id) ?? [], before, s);
        if (settled.durationChanged) changed++;
        if (settled.timephasedLost) recordTimephasedLoss(task.id);
      }
      markDocumentEdited(s);
    });
    if (changed > 0) notifyWorkRuleDurationsChanged(context.store.getState().notify, changed);
  },

  addResource(res: Omit<Resource, 'id'>): string {
    const id = generateId('res');
    store.setState((s) => {
      if (!isValidUnits(res.maxUnits)) {
        throw new Error(`draft.addResource: invalid maxUnits ${String(res.maxUnits)} (strictly positive required)`);
      }
      insertResource(s, res, id);
      markDocumentEdited(s);
    });
    return id;
  },

  updateResource(id: string, updates: Partial<Resource>): void {
    store.setState((s) => {
      const idx = s.resources.findIndex((r) => r.id === id);
      if (idx < 0) throw new Error(`draft.updateResource: unknown resource id '${id}'`);
      if ('maxUnits' in updates && !isValidUnits(updates.maxUnits)) {
        throw new Error(`draft.updateResource: invalid maxUnits ${String(updates.maxUnits)} (strictly positive required)`);
      }
      const { refused } = acceptedCostResourcePatch(s, s.resources[idx], updates);
      if (refused.length > 0) throw new Error(`draft.updateResource: refused for a COST resource (${refused.join(', ')})`);
      const target = s.resources[idx] as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) delete target[key];
        else target[key] = value;
      }
      settleCostResourceFields(s.resources[idx]);
      markDocumentEdited(s);
    });
  },

  removeResource(id: string): {
    removedAssignmentIds: string[];
    affectedTaskIds: string[];
    orphanedCrewMemberIds: string[];
  } {
    const report = { removedAssignmentIds: [] as string[], affectedTaskIds: [] as string[], orphanedCrewMemberIds: [] as string[] };
    store.setState((s) => {
      if (!s.resources.some((r) => r.id === id)) {
        throw new Error(`draft.removeResource: unknown resource id '${id}'`);
      }
      const doomed = s.assignments.filter((a) => a.resourceId === id);
      report.removedAssignmentIds = doomed.map((a) => String(a.id));
      report.affectedTaskIds = [...new Set(doomed.map((a) => String(a.taskId)))];
      report.orphanedCrewMemberIds = s.resources.filter((r) => r.parentId === id).map((r) => String(r.id));

      for (const lostTaskId of purgeResource(s, id, 'delete').lostTaskIds) recordTimephasedLoss(lostTaskId);
      markDocumentEdited(s);
    });
    return report;
  },

  assignResource(taskId: string, resourceId: string, unitsPerDay: number, curve?: ResourceCurve, costAmount?: number): string {
    const id = generateId('asgn');
    store.setState((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error(`draft.assignResource: unknown taskId '${taskId}'`);
      const cost = isCostAssignment(s, { resourceId });
      if (isSummaryTask(task) || (task.isMilestone && !cost)) {
        throw new Error(`draft.assignResource: cannot assign a resource to a milestone/summary task '${taskId}'`);
      }
      if (!isValidUnits(unitsPerDay)) {
        throw new Error(`draft.assignResource: invalid unitsPerDay ${String(unitsPerDay)} (strictly positive required)`);
      }
      const amount = cost ? acceptedCostAmount(costAmount) : undefined;
      if (amount === false || (!cost && costAmount !== undefined)) {
        throw new Error(`draft.assignResource: costAmount ${String(costAmount)} refused (only on a COST resource, finite and >= 0)`);
      }
      const assignment: ResourceAssignment = cost
        ? { id, taskId, resourceId, unitsPerDay: 1, ...(amount !== undefined ? { costAmount: amount } : {}) }
        : { id, taskId, resourceId, unitsPerDay, curve };
      for (const lostTaskId of insertAssignment(s, task, assignment).lostTaskIds) {
        recordTimephasedLoss(lostTaskId);
      }
      markDocumentEdited(s);
    });
    return id;
  },

  updateAssignment(assignmentId: string, updates: Partial<Pick<ResourceAssignment, 'unitsPerDay' | 'curve'>>): void {
    store.setState((s) => {
      const idx = s.assignments.findIndex((a) => a.id === assignmentId);
      if (idx < 0) throw new Error(`draft.updateAssignment: unknown assignmentId '${assignmentId}'`);
      if (isCostAssignment(s, s.assignments[idx])) {
        throw new Error(`draft.updateAssignment: assignment '${assignmentId}' is on a COST resource (no unitsPerDay or curve)`);
      }
      const patch = acceptedAssignmentPatch(updates);
      if (!patch) return;
      for (const lostTaskId of applyAssignmentPatch(s, s.assignments[idx], patch).lostTaskIds) recordTimephasedLoss(lostTaskId);
      markDocumentEdited(s);
    });
  },

  setAssignmentWork(assignmentId: string, remainingWorkMinutes: number): void {
    store.setState((s) => {
      const a = s.assignments.find((x) => x.id === assignmentId);
      if (!a) throw new Error(`draft.setAssignmentWork: unknown assignmentId '${assignmentId}'`);
      if (isCostAssignment(s, a)) throw new Error(`draft.setAssignmentWork: assignment '${assignmentId}' is on a COST resource (no work)`);
      const task = s.tasks.find((t) => t.id === a.taskId);
      if (!task) throw new Error(`draft.setAssignmentWork: assignment '${assignmentId}' without a task`);
      const oldWorkMinutes = taskWorkMinutesOf(task, taskCalendarHoursPerDay(task, s.calendars, s.calendar));
      const finishBasis = hourInputFinishBasis(task);
      const plan = planWorkEdit(task, s.assignments, s, assignmentId, remainingWorkMinutes);
      if (!plan) {
        throw new Error(`draft.setAssignmentWork: work ${String(remainingWorkMinutes)} refused (strictly positive required; the work rule does not apply to milestones, hammocks, summary tasks or ELAPSEDTIME tasks)`);
      }
      if (commitTrianglePlan(task, s.assignments, plan).durationChanged) afterTriangleDurationChange(s, task, oldWorkMinutes, finishBasis);
      s.taskTypesVisible = true;
      markDocumentEdited(s);
    });
  },

  setTaskWorkRule(taskId: string, rule: WorkRule | undefined): void {
    store.setState((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error(`draft.setTaskWorkRule: unknown taskId '${taskId}'`);
      if (task.workRule === rule) return;
      recordedDateRuleChange(context, task, true, () => settleRuleChange(task, s.assignments, s, rule));
      if (rule !== undefined) s.taskTypesVisible = true;
      markDocumentEdited(s);
    });
  },

  setAssignmentContour(assignmentId: string, periods: TimephasedContourPeriod[] | null): void {
    store.setState((s) => {
      const a = s.assignments.find((x) => x.id === assignmentId);
      if (!a) throw new Error(`draft.setAssignmentContour: unknown assignmentId '${assignmentId}'`);
      const task = s.tasks.find((t) => t.id === a.taskId);
      if (!task) throw new Error(`draft.setAssignmentContour: assignment '${assignmentId}' without a task`);
      const edit = contoursAfterEdit(s, task, a, periods);
      if (!edit) return;
      task.timephasedContours = edit.contours;
      syncAssignmentWorkToContour(a, periods);
      markDocumentEdited(s);
    });
  },

  moveAssignment(assignmentId: string, newTaskId: string): void {
    store.setState((s) => {
      const assignment = s.assignments.find((a) => a.id === assignmentId);
      if (!assignment) throw new Error(`draft.moveAssignment: unknown assignmentId '${assignmentId}'`);
      const newTask = s.tasks.find((t) => t.id === newTaskId);
      if (!newTask) throw new Error(`draft.moveAssignment: unknown taskId '${newTaskId}'`);
      if (isSummaryTask(newTask) || (newTask.isMilestone && !isCostAssignment(s, assignment))) {
        throw new Error(`draft.moveAssignment: target task '${newTaskId}' is a milestone/summary task`);
      }
      const alreadyOnTarget = s.assignments.some(
        (a) => a.taskId === newTaskId && a.resourceId === assignment.resourceId,
      );
      if (alreadyOnTarget) {
        throw new Error(`draft.moveAssignment: resource '${assignment.resourceId}' is already assigned to task '${newTaskId}'`);
      }

      for (const lostTaskId of relocateAssignment(s, assignment, newTask).lostTaskIds) recordTimephasedLoss(lostTaskId);
      markDocumentEdited(s);
    });
  },

  setAssignmentCost(assignmentId: string, amount: number | undefined): void {
    store.setState((s) => {
      const a = s.assignments.find((x) => x.id === assignmentId);
      if (!a) throw new Error(`draft.setAssignmentCost: unknown assignmentId '${assignmentId}'`);
      if (!isCostAssignment(s, a)) throw new Error(`draft.setAssignmentCost: assignment '${assignmentId}' is not on a COST resource`);
      const accepted = acceptedCostAmount(amount);
      if (accepted === false) throw new Error(`draft.setAssignmentCost: invalid amount ${String(amount)} (finite and >= 0 required)`);
      if (applyAssignmentCost(a, accepted)) markDocumentEdited(s);
    });
  },

  unassignResource(assignmentId: string): void {
    store.setState((s) => {
      const removed = s.assignments.find((a) => a.id === assignmentId);
      if (!removed) throw new Error(`draft.unassignResource: unknown assignmentId '${assignmentId}'`);
      for (const lostTaskId of removeAssignment(s, removed).lostTaskIds) recordTimephasedLoss(lostTaskId);
      markDocumentEdited(s);
    });
  },

  applyLeveling(write: Pick<LevelingResult, 'delays' | 'gaps' | 'delayMinutes'>, opts?: { scopeTaskIds?: string[] }): void {
    let roundedCount = 0;
    store.setState((s) => {
      roundedCount = writeLevelingResult(s.tasks, write, opts?.scopeTaskIds);
      markDocumentEdited(s);
    });
    if (roundedCount > 0) {
      const state = store.getState();
      notifyLevelingDelayRounded(state.notify, state.activeDocumentId, roundedCount);
    }
  },

  clearLeveling(): void {
    let roundedCount = 0;
    store.setState((s) => {
      for (const task of s.tasks) {
        if (clearLevelingOutput(task)) roundedCount++;
      }
      markDocumentEdited(s);
    });
    if (roundedCount > 0) {
      const state = store.getState();
      notifyLevelingDelayRounded(state.notify, state.activeDocumentId, roundedCount);
    }
  },

  setProject(updates: Partial<Project>, clear: readonly ClearableProjectKey[] = []): ProjectPatchOutcome {
    let outcome: ProjectPatchOutcome = { clampedAnchors: 0, measureChangedTaskIds: [] };
    store.setState((s) => {
      outcome = applyProjectPatch(s, updates, clear);
      markDocumentEdited(s);
    });
    return outcome;
  },
  };

  const draft = new Proxy(rawDraft, {
    get(target, property) {
      const value = Reflect.get(target, property);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        activeLease();
        return Reflect.apply(value, target, args);
      };
    },
  }) as typeof rawDraft;

  return draft;
}

export type McpDraft = ReturnType<typeof createMcpDraft>;

export function createMcpTransactions(context: AppStoreContext): McpTransactions {
  const { store, runtime } = context;
  let currentLease: McpTransactionLease | null = null;

  const requireCurrentLease = (): McpTransactionLease => {
    if (!currentLease) {
      throw new Error('MCP draft requires an active run on the same factory object');
    }
    return currentLease;
  };

  const draft = createMcpDraft(context, requireCurrentLease);

  const run: McpTransactions['run'] = <T>(
    fn: () => Synchronous<T>,
  ): McpTransactionResult<T> => {
    const lease = runtime.enterMcpTransaction();
    currentLease = lease;

    try {
      const initial = store.getState();
      const snapshot: Snapshot = createSnapshot(initial);
      beginRecordedDateEdit(context, snapshot);
      const documentId = initial.activeDocumentId;
      const previousHistory = initial.historyEvents;
      const previousSequence = initial.nextHistorySequence;
      const previousViewRows = initial.viewRows;
      const previousResourceLoad = initial.resourceLoadResult;
      const previousDirty = initial.isDirty;
      const previousPristine = initial.importPristine;
      const prevNotifications = initial.ui.notifications;

      const restoreDocument = (state: AppState): void => {
        restoreSnapshot(state, snapshot, { markDirty: false, clearImportPristine: false });
        state.viewRows = previousViewRows;
        state.resourceLoadResult = previousResourceLoad;
        state.isDirty = previousDirty;
        state.importPristine = previousPristine;
      };

      const rollback = (error: string): { ok: false; error: string } => {
        store.setState((state) => {
          restoreDocument(state);
          replaceSessionHistoryState(state, previousHistory, previousSequence);
          state.ui.notifications = prevNotifications;
        });
        runtime.resetUndoCoalescing();
        return { ok: false, error };
      };

      let value: T;
      let dataChanged = false;
      try {
        value = fn() as T;
        if (isThenable(value)) {
          throw new Error('MCP transaction callback must be strictly synchronous and may not return a Promise/thenable');
        }
        if (import.meta.env?.DEV) assertMinuteModelTaskDates(store.getState().tasks);
        dataChanged = documentDataChanged(snapshot, createSnapshot(store.getState()));

        if (dataChanged && !keepsRecordedDates(context)) {
          store.getState().runCPM({ withinEvent: true });
          store.getState().recomputeViewRows();
          store.getState().recomputeResourceLoad();
        }
      } catch (error) {
        return rollback(error instanceof Error ? error.message : String(error));
      }

      if (!dataChanged) {
        store.setState(restoreDocument);
        runtime.resetUndoCoalescing();
        return { ok: true, value, timephasedGuidanceLost: 0, remainingWorkRecomputed: [] };
      }

      const cpm = store.getState().cpmResult;
      if (cpm?.error) return rollback(cpm.error);

      runtime.resetUndoCoalescing();
      store.setState((state) => {
        runtime.recordDocumentDataHistory(state, snapshot, documentId, 'MCP-bewerking');
        markDocumentEdited(state);
      });
      const lostCount = runtime.countMcpTimephasedLoss(lease);
      if (lostCount > 0) {
        const state = store.getState();
        notifyTimephasedLoss(state.notify, state.activeDocumentId, lostCount);
      }
      const remainingWorkRecomputed = [...runtime.mcpRecomputedWork(lease)];
      const workNotice = remainingWorkRecomputedNotice(remainingWorkRecomputed);
      if (workNotice) store.getState().notify(workNotice);
      return { ok: true, value, timephasedGuidanceLost: lostCount, remainingWorkRecomputed };
    } finally {
      endRecordedDateEdit(context);
      currentLease = null;
      runtime.exitMcpTransaction(lease);
    }
  };

  return { run, draft, isActive: () => currentLease !== null };
}
