import { changesOnlyDateNeutralFields } from '../taskDateChanges';
import { normalizeTaskDates, normalizeTaskPatch } from '../migrations/minuteModel';
import { isElapsedTask } from '@/engine/scheduler/duration';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { Task, type ExternalLink } from '@/types/task';
import { currentAppState, originalAppState, taskAssignmentDrafts, taskIndexById } from '@/state/immerDraft';
import { carryLiveProgressPlan, liveProgressPlannedDates, progressPlacementForBatch, progressPlannedDates } from '@/state/progressPlannedDates';
import { type SplitPiece, type SplitRefusal } from '@/engine/scheduler/splitEdit';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { applyTaskSplits, taskSplitRefusal } from '@/state/splitMutations';
import {
  buildNewTask, createDefaultTaskTime, deriveScheduleDurationFromMinutes, mergeTaskTime, clearTimephasedWindow,
  mergeTaskUpdate, taskTriggerChanges, invalidateForTimeBaseChange, clearLevelingGaps,
  taskCalendarHoursPerDay,
  contourKeepsWork, hourInputFinishBasis, reconcileHourInputFinish, seedNewHourTaskFinish,
} from '@/utils/taskDefaults';
import { sameValue } from '@/utils/sameValue';
import { generateId } from '@/utils/id';
import { parseDate, localTodayIso } from '@/utils/dateUtils';
import { reconcileP6SuspendResume } from '@/utils/p6SuspendResume';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { ancestorIds, applyWbsNumbering, flattenOrder } from '@/utils/wbs';
import { applyProgressInvariants, type PlannedProgressDates } from '@/engine/taskMutationRules';
import {
  actualStartQuestionFor, hasRecordedProgress, planProgressEntry, progressEntryStatusDate,
  type ProgressEdit, type ProgressEntryContext, type ProgressEntryPlan, type ProgressEntryResult,
} from '@/engine/progressEntry';
import { durationBelowDoneWorkNotice, statusDateSetTodayNotice } from '@/state/progressEntryNotice';
import type { WbsTemplate } from '@/utils/wbsTemplates';
import {
  detachFromParent, attachToParent, isSelfOrDescendant, removeTaskSubtrees, siblingIds,
} from '@/state/taskTree';
import { selectNeighbourAfterRemoval } from '@/state/selectionAfterRowChange';
import { hasMilestoneBlockingAssignments, milestoneRefusal } from '@/engine/taskMilestoneTransition';
import { refusalNotice, refusedNamesLine, refusedSetKey } from '@/state/refusalNotice';
import { headerTransfers, planDissolve } from '@/state/dissolveTasks';
import { relationAddVerdict } from '@/state/relationRules';
import {
  applyPhaseTransitions, firstChildGains, milestoneRefusalNotices, phaseAssignmentQuestion, phaseRefusalNotice,
  phaseTransitionNotices, planPhaseTransitions, type PendingChild, type PhaseAssignmentChoice,
  type PhaseAssignmentMode, type PhaseGain, type PhaseTransition,
} from '@/state/structuralTransition';
import { assignInsertedWbsCodes, insertRemappedRelations, notifyRelationsSkipped } from '@/state/insertedBranch';
import { notifyHierarchyCycle, watchAncestorRelations } from '@/state/hierarchyRelationNotice';
import {
  hierarchyChangeVerdict, NO_HIERARCHY_CHANGE, type HierarchyChangeVerdict, type HierarchyEdit,
} from '@/state/hierarchyChange';
import type { RelationTree } from '@/engine/scheduler/relationRules';
import { notifyTimephasedLoss } from '../timephasedLossNotice';
import {
  captureCalendarChange, captureTriangle, durationEditRefusal, settleCalendarChange, settleEditedDuration,
  settleDurationEdit, settleRuleChange, captureProgressWork, settleProgressWork, type RecomputedRemainingWork,
  hourSourceOf, routeFixedWorkDurationToHours,
} from '@/engine/work/workRuleApply';
import { mergeStepRecomputedWork, remainingWorkRecomputedNotice } from '../remainingWorkNotice';
import { newTaskTimeUnit, settleNewTaskMeasure } from '../newTaskMeasure';
import type { WorkRule } from '@/types/workRule';
import type { AppSlice, AppSliceFactory, NotifyInput, PhaseAssignmentQuestion, SiblingDirection } from './types';
import type { AppState } from '../appStore';
import type { StoreRuntime } from '../runtime/storeRuntime';
import { effHoursPerDay } from '@/utils/taskDuration';
import { buildTaskEditPlanEnvironment } from '../gridTransaction';
import { planTaskCellEdits } from '@/engine/taskGrid/taskEditPlan';
import { buildProgressImportPlan } from '@/services/progressImport';
import type { ProgressConflictChoices, ProgressImportPlan, ProgressOverrides, ProgressRow } from '@/services/progressImport';
import type { ProgressPlanDeps } from '@/services/progressImport';

export interface PhaseAssignmentOptions {
  phaseAssignments?: PhaseAssignmentMode;
  answered?: boolean;
}

export interface TaskSlice {
  tasks: Task[];
  addTask: (task: Partial<Task> & {
    name: string;
    position?: { anchorId: string; where: 'above' | 'below' };
  }, opts?: PhaseAssignmentOptions) => string;
  updateTask: (id: string, updates: Partial<Task>, opts?: { coalesceKey?: string }) => void;
  setTaskWorkRule: (id: string, rule: WorkRule | undefined) => void;
  deleteTask: (id: string) => void;
  deleteTasksBulk: (ids: readonly string[]) => void;
  dissolveTasksBulk: (ids: readonly string[]) => void;
  moveTask: (id: string, newParentId: string | null, position?: number, opts?: PhaseAssignmentOptions) => void;
  moveTaskTo: (id: string, target: { parentId: string | null; childIndex: number }, opts?: PhaseAssignmentOptions) => void;
  moveTasksTo: (ids: string[], target: { parentId: string | null; childIndex: number }, opts?: PhaseAssignmentOptions) => void;
  reorderSibling: (taskId: string, direction: SiblingDirection) => void;
  renumberWbs: () => void;
  indentTasks: (ids: string[], opts?: PhaseAssignmentOptions) => void;
  outdentTasks: (ids: string[], opts?: PhaseAssignmentOptions) => void;
  insertWbsTemplate: (template: WbsTemplate, parentId: string | null, opts?: PhaseAssignmentOptions) => string | null;
  askPhaseAssignmentQuestion: (
    question: PhaseAssignmentQuestion,
    onChoice: (choice: PhaseAssignmentChoice) => void,
    recheck: () => PhaseAssignmentQuestion | null,
  ) => void;
  answerPhaseAssignmentQuestion: (choice: PhaseAssignmentChoice | null) => void;
  setTaskProgress: (taskId: string, completion: number, opts?: { coalesceKey?: string }) => boolean;
  setActualStart: (taskId: string, date: string | undefined, opts?: { coalesceKey?: string }) => boolean;
  setActualFinish: (taskId: string, date: string | undefined, opts?: { coalesceKey?: string }) => boolean;
  enterTaskProgress: (
    taskId: string,
    edit: ProgressEdit,
    opts: { today: string; actualStart?: string; coalesceKey?: string; plannedDates?: () => PlannedProgressDates | undefined },
  ) => ProgressEntryResult;
  setTaskSplits: (
    taskId: string,
    pieces: SplitPiece[] | null,
    opts?: { coalesceKey?: string },
  ) => SplitRefusal | null;
  setTaskCalendar: (taskId: string, calendarId: string | undefined) => void;
  addExternalLink: (taskId: string, link: Omit<ExternalLink, 'id'>) => string;
  updateExternalLink: (taskId: string, linkId: string, link: Omit<ExternalLink, 'id'>) => boolean;
  removeExternalLink: (taskId: string, linkId: string) => void;
  previewProgressImport: (
    rows: readonly ProgressRow[],
    overrides?: ProgressOverrides,
    opts?: ProgressImportEntryOptions,
  ) => ProgressImportPlan;
  applyProgressImport: (
    rows: readonly ProgressRow[],
    overrides?: ProgressOverrides,
    opts?: ProgressImportEntryOptions,
  ) => ProgressImportPlan;
}

export interface ProgressImportEntryOptions {
  today?: string;
  conflictChoices?: ProgressConflictChoices;
}

function progressImportDeps(s: AppState, today: string | undefined): ProgressPlanDeps {
  const statusDate = progressEntryStatusDate(s.project.statusDate, today);
  const baseDates = progressPlannedDates(s);
  return {
    preparePlacement: ids => progressPlacementForBatch(s, ids, statusDate),
    planEdits: (task, edits, plannedDates = baseDates) => {
      const environment = { ...buildTaskEditPlanEnvironment(s, task), plannedDates };
      const planned = planTaskCellEdits(task, edits, statusDate ? { ...environment, statusDate } : environment);
      if (!planned.ok || !today) return planned;
      const wrote = (columnId: string) => edits.some(edit => String(edit.columnId) === columnId && !!edit.value);
      const question = actualStartQuestionFor(task, planned.value.task, statusDate, {
        actualStart: wrote('task.time.actualStart'),
        actualFinish: wrote('task.time.actualFinish'),
      }, isElapsedTask(task) ? undefined : resolveCalendar(task.calendarId, s.calendars, s.calendar),
      wrote('task.time.completion') ? () => plannedDates(task)?.earlyStart : undefined);
      if (!question) return planned;
      return {
        ok: false,
        errors: [{
          code: 'actualStartRequired',
          messageKey: 'taskGrid.validation.actualStartRequired',
          taskId: task.id,
          value: { statusDate: question.statusDate, latest: question.latest },
        }],
      };
    },
  };
}

function sameExternalLink(left: ExternalLink, right: ExternalLink): boolean {
  return left.id === right.id
    && left.direction === right.direction
    && left.relType === right.relType
    && left.lagDays === right.lagDays
    && left.lagMinutes === right.lagMinutes
    && left.anchorDate === right.anchorDate
    && left.sourceMissing === right.sourceMissing
    && left.sourceRef.projectId === right.sourceRef.projectId
    && left.sourceRef.projectName === right.sourceRef.projectName
    && left.sourceRef.taskId === right.sourceRef.taskId
    && left.sourceRef.taskName === right.sourceRef.taskName
    && left.sourceRef.filePath === right.sourceRef.filePath
    && left.sourceRef.siteFileId === right.sourceRef.siteFileId
    && left.sourceVersion === right.sourceVersion
    && left.anchorReadAt === right.anchorReadAt;
}

interface TaskPlacement {
  parentId: string | null;
  index: number;
  siblingIdsAfterRemoval: string[];
}

function planTaskPlacement(
  tasks: Task[],
  id: string,
  target: { parentId: string | null; childIndex: number },
  opts: { rejectNoOp: boolean },
): TaskPlacement | null {
  const task = tasks.find(t => t.id === id);
  if (!task) return null;

  const newParentId = target.parentId;
  if (newParentId !== null && !tasks.some(t => t.id === newParentId)) return null;

  if (newParentId !== null && isSelfOrDescendant(tasks, newParentId, id)) return null;

  const oldParentId = task.parentId;
  const oldParent = oldParentId ? tasks.find(t => t.id === oldParentId) : undefined;
  const newParent = newParentId ? tasks.find(t => t.id === newParentId) : undefined;

  const siblingIdsAfterRemoval = newParent
    ? newParent.childIds.filter(cid => cid !== id)
    : tasks.filter(t => !t.parentId && t.id !== id).map(t => t.id);
  const index = Math.max(0, Math.min(target.childIndex, siblingIdsAfterRemoval.length));

  if (opts.rejectNoOp && newParentId === oldParentId) {
    const curIdx = oldParent
      ? oldParent.childIds.indexOf(id)
      : tasks.filter(t => !t.parentId).map(t => t.id).indexOf(id);
    if (index === curIdx) return null;
  }

  return { parentId: newParentId, index, siblingIdsAfterRemoval };
}

function applyTaskPlacement(tasks: Task[], id: string, plan: TaskPlacement): void {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  detachFromParent(tasks, id);
  attachToParent(tasks, id, plan.parentId, plan.index);

  const rawIdx = tasks.findIndex(t => t.id === id);
  const [node] = tasks.splice(rawIdx, 1);
  if (plan.index >= plan.siblingIdsAfterRemoval.length) {
    const lastSiblingId = plan.siblingIdsAfterRemoval[plan.siblingIdsAfterRemoval.length - 1];
    const lastSiblingRawIdx = lastSiblingId ? tasks.findIndex(t => t.id === lastSiblingId) : -1;
    if (lastSiblingRawIdx >= 0) tasks.splice(lastSiblingRawIdx + 1, 0, node);
    else tasks.push(node);
  } else {
    const anchorId = plan.siblingIdsAfterRemoval[plan.index];
    const anchorRawIdx = tasks.findIndex(t => t.id === anchorId);
    if (anchorRawIdx >= 0) tasks.splice(anchorRawIdx, 0, node);
    else tasks.push(node);
  }
}

function dissolveSummaryHeader(s: AppState, id: string): string[] {
  const before = currentAppState(s);
  const transfers = headerTransfers(before.tasks, before.sequences, id);
  const summary = s.tasks.find(task => task.id === id);
  if (!summary) return [];
  for (const link of summary.externalLinks ?? []) {
    const targets = link.direction === 'predecessor' ? transfers.first : transfers.last;
    for (const targetId of targets) {
      const target = s.tasks.find(task => task.id === targetId);
      if (!target) continue;
      target.externalLinks = [...(target.externalLinks ?? []), { ...link, id: generateId('extlink') }];
      Object.assign(target, normalizeTaskDates(target, s));
    }
  }
  const parentId = summary.parentId ?? null;
  const siblings = parentId
    ? (s.tasks.find(task => task.id === parentId)?.childIds ?? [])
    : s.tasks.filter(task => !task.parentId).map(task => task.id);
  let childIndex = siblings.indexOf(id) + 1;
  for (const childId of [...summary.childIds]) {
    const plan = planTaskPlacement(s.tasks, childId, { parentId, childIndex }, { rejectNoOp: false });
    if (!plan) continue;
    applyTaskPlacement(s.tasks, childId, plan);
    childIndex += 1;
  }
  removeTaskSubtrees(s, [id]);

  const after = currentAppState(s);
  const sequences = [...after.sequences];
  const name = (taskId: string) => after.tasks.find(task => task.id === taskId)?.name ?? '?';
  const refused: string[] = [];
  for (const relation of transfers.relations) {
    const verdict = relationAddVerdict(after.tasks, sequences, relation);
    if (verdict.ok) {
      const added = { ...relation, id: generateId('seq') };
      sequences.push(added);
      s.sequences.push(added);
    } else if (verdict.reason !== 'duplicate') {
      refused.push(`${name(relation.predecessorId)} → ${name(relation.successorId)}`);
    }
  }
  return refused;
}

function moveTaskEdit(id: string, newParentId: string | null, position?: number): HierarchyEdit {
  return (tasks) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return NO_HIERARCHY_CHANGE;
    if (newParentId != null && isSelfOrDescendant(tasks, newParentId, id)) return NO_HIERARCHY_CHANGE;
    const oldParentId = task.parentId;

    detachFromParent(tasks, id);

    attachToParent(tasks, id, newParentId, position);
    const fromIdx = tasks.findIndex(t => t.id === id);
    const [moved] = tasks.splice(fromIdx, 1);
    const sibIdx: number[] = [];
    tasks.forEach((t, i) => { if (t.parentId === newParentId) sibIdx.push(i); });
    const at = position === undefined
      ? sibIdx.length
      : Math.max(0, Math.min(position, sibIdx.length));
    let insertAt: number;
    if (at < sibIdx.length) {
      insertAt = sibIdx[at];
    } else if (sibIdx.length > 0) {
      insertAt = sibIdx[sibIdx.length - 1] + 1;
    } else if (newParentId) {
      const p = tasks.findIndex(t => t.id === newParentId);
      insertAt = p >= 0 ? p + 1 : tasks.length;
    } else {
      insertAt = tasks.length;
    }
    tasks.splice(insertAt, 0, moved);
    return { changed: true, reparented: newParentId !== oldParentId };
  };
}

function moveTaskToEdit(id: string, target: { parentId: string | null; childIndex: number }): HierarchyEdit {
  return (tasks) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return NO_HIERARCHY_CHANGE;
    const oldParentId = task.parentId;
    const plan = planTaskPlacement(tasks, id, target, { rejectNoOp: true });
    if (!plan) return NO_HIERARCHY_CHANGE;
    applyTaskPlacement(tasks, id, plan);
    return { changed: true, reparented: plan.parentId !== oldParentId };
  };
}

function moveTasksToEdit(ids: string[], target: { parentId: string | null; childIndex: number }): HierarchyEdit {
  return (tasks) => {
    const geselecteerd = new Set(ids.filter(id => tasks.some(t => t.id === id)));
    const parentOf = (id: string) => tasks.find(t => t.id === id)?.parentId;
    const heeftGeselecteerdeVoorouder = (id: string): boolean => {
      for (const voorouder of ancestorIds(id, parentOf)) if (geselecteerd.has(voorouder)) return true;
      return false;
    };
    const teVerplaatsen = [...geselecteerd].filter(id => !heeftGeselecteerdeVoorouder(id));
    if (teVerplaatsen.length === 0) return NO_HIERARCHY_CHANGE;

    const order = flattenOrder(tasks).map(t => t.id);
    const gesorteerd = teVerplaatsen.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    if (target.parentId !== null) {
      const groep = new Set(gesorteerd);
      if (groep.has(target.parentId)) return NO_HIERARCHY_CHANGE;
      for (const voorouder of ancestorIds(target.parentId, parentOf)) if (groep.has(voorouder)) return NO_HIERARCHY_CHANGE;
    }

    let changed = false;
    let reparented = false;
    let vorigeId: string | null = null;
    for (const id of gesorteerd) {
      const task = tasks.find(t => t.id === id);
      if (!task) continue;

      let childIndex = target.childIndex;
      if (vorigeId !== null) {
        const siblingsZonderId = siblingIds(tasks, target.parentId).filter(x => x !== id);
        const vorigeIdx = siblingsZonderId.indexOf(vorigeId);
        childIndex = vorigeIdx >= 0 ? vorigeIdx + 1 : siblingsZonderId.length;
      }

      const oudeOuder = task.parentId;
      const plan = planTaskPlacement(tasks, id, { parentId: target.parentId, childIndex }, { rejectNoOp: false });
      if (!plan) continue;

      const curIdx = siblingIds(tasks, oudeOuder).indexOf(id);
      if (plan.parentId !== oudeOuder || plan.index !== curIdx) {
        applyTaskPlacement(tasks, id, plan);
        changed = true;
        if (plan.parentId !== oudeOuder) reparented = true;
      }
      vorigeId = id;
    }
    return { changed, reparented };
  };
}

function indentEdit(ids: string[]): HierarchyEdit {
  return (tasks) => {
    const selected = new Set(ids);
    let changed = false;
    const order = flattenOrder(tasks).map(t => t.id);
    const byId = new Map<string, Task>();
    for (const task of tasks) if (!byId.has(task.id)) byId.set(task.id, task);
    const previousSibling = new Map<string | null, { id: string; index: number }>();
    const visitedAt = new Map<string | null, number>();
    for (let index = 0; index < order.length; index++) {
      const id = order[index];
      const task = byId.get(id);
      if (!task) continue;
      const parentIndex = visitedAt.get(task.parentId) ?? -1;
      visitedAt.set(id, index);
      if (!selected.has(id)) {
        previousSibling.set(task.parentId, { id, index });
        continue;
      }
      const candidate = previousSibling.get(task.parentId);
      if (!candidate?.id || candidate.index < parentIndex) continue;
      detachFromParent(tasks, id, byId);
      attachToParent(tasks, id, candidate.id, undefined, byId);
      changed = true;
    }
    return { changed, reparented: changed };
  };
}

function outdentEdit(ids: string[]): HierarchyEdit {
  return (tasks) => {
    const order = flattenOrder(tasks).map(t => t.id);
    const sorted = [...ids].sort((a, b) => order.indexOf(b) - order.indexOf(a));
    let changed = false;
    for (const id of sorted) {
      const task = tasks.find(t => t.id === id);
      if (!task || !task.parentId) continue;
      const parent = tasks.find(t => t.id === task.parentId);
      if (!parent) continue;

      const parentSiblingIds = parent.parentId
        ? (tasks.find(t => t.id === parent.parentId)?.childIds ?? [])
        : tasks.filter(t => !t.parentId).map(t => t.id);
      const parentIdx = parentSiblingIds.indexOf(parent.id);
      const childIndex = parentIdx >= 0 ? parentIdx + 1 : parentSiblingIds.length;

      const plan = planTaskPlacement(
        tasks, id, { parentId: parent.parentId, childIndex }, { rejectNoOp: false },
      );
      if (!plan) continue;
      applyTaskPlacement(tasks, id, plan);
      changed = true;
    }
    return { changed, reparented: changed };
  };
}

export function moveTaskVerdict(
  state: RelationTree,
  id: string,
  newParentId: string | null,
  position?: number,
): HierarchyChangeVerdict {
  return hierarchyChangeVerdict(state, moveTaskEdit(id, newParentId, position));
}

export function phaseAssignmentQuestionForTaskDialog(
  state: Pick<AppState, 'tasks' | 'resources' | 'assignments'>,
  taskId: string | null,
  parentId: string | null,
  draft: PendingChild,
): PhaseAssignmentQuestion | null {
  if (taskId === null) {
    const childId = 'nieuwe-taak';
    return phaseAssignmentQuestion(
      state, firstChildGains(state.tasks, [{ childId, parentId }]), new Map([[childId, draft]]),
    );
  }
  return phaseAssignmentQuestion(
    state, hierarchyPhaseGains(state.tasks, moveTaskEdit(taskId, parentId)), new Map([[taskId, draft]]),
  );
}

type SliceSet = Parameters<AppSlice<TaskSlice>>[0];
type SliceGet = Parameters<AppSlice<TaskSlice>>[1];

function applyHierarchyEdit(
  runtime: StoreRuntime,
  set: SliceSet,
  get: SliceGet,
  edit: HierarchyEdit,
  staleWhen: 'always' | 'on-reparent',
  opts: PhaseAssignmentOptions | undefined,
  ask: AskPhaseAssignments,
): void {
  const before = get();
  const verdict = hierarchyChangeVerdict(before, edit);
  if (!verdict.ok) {
    notifyHierarchyCycle(before, verdict.cycle);
    return;
  }
  if (!verdict.changed) return;
  const mode = opts?.phaseAssignments ?? 'ask';
  const gains = hierarchyPhaseGains(before.tasks, edit);
  if (mode === 'ask') {
    const question = phaseAssignmentQuestion(before, gains);
    if (question) {
      ask(
        question,
        choice => applyHierarchyEdit(runtime, set, get, edit, staleWhen, { phaseAssignments: choice, answered: true }, ask),
        () => phaseAssignmentQuestion(get(), hierarchyPhaseGains(get().tasks, edit)),
      );
      return;
    }
  }
  const phasePlan = planPhaseTransitions(before, gains, undefined, mode === 'ask' ? 'move' : mode);
  if (!phasePlan.ok) {
    get().notify(phaseRefusalNotice(before, phasePlan.refusal));
    return;
  }
  const outcome = emptyOutcome();
  const reportAncestorRelations = watchAncestorRelations(before);
  set((s) => {
    runtime.beginUndoable(s);
    edit(s.tasks);
    if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
    settlePhaseTransitions(s, phasePlan.transitions, outcome, opts);
    runtime.finishMutation(s, { stale: staleWhen === 'always' || verdict.reparented });
  });
  finishStructural(get, outcome);
  reportAncestorRelations(get());
  get().recomputeViewRows();
}

function hierarchyPhaseGains(tasks: readonly Task[], edit: HierarchyEdit): PhaseGain[] {
  const trial = tasks.map(task => ({ ...task, childIds: [...task.childIds] }));
  edit(trial);
  const hadChildren = new Map(tasks.map(task => [task.id, task.childIds.length > 0]));
  return trial
    .filter(task => hadChildren.get(task.id) === false && task.childIds.length > 0)
    .map(task => ({ phaseId: task.id, childIds: [...task.childIds] }));
}

export { applyProgressInvariants };

export function planStoredProgressEdit(
  state: Pick<AppState, 'project' | 'calendar' | 'calendars'>,
  task: Task, edit: ProgressEdit, ctx: Omit<ProgressEntryContext, 'statusDate' | 'calendar'>,
): ProgressEntryPlan {
  const plan = planProgressEntry(task, edit, { ...ctx, statusDate: state.project.statusDate,
    calendar: resolveCalendar(task.calendarId, state.calendars, state.calendar) });
  if (!plan.ok || !plan.change) return plan;
  const normalized = normalizeTaskDates(plan.change.task, state);
  if (sameValue(task, normalized) && !plan.change.statusDateToday) return { ok: true, change: null };
  clearLevelingGaps(normalized);
  return { ok: true, change: { ...plan.change, task: normalized } };
}

function commitProgressEdit(
  runtime: StoreRuntime,
  s: AppState,
  taskId: string,
  edit: ProgressEdit,
  ctx: Omit<ProgressEntryContext, 'statusDate'>,
  opts: { coalesceKey?: string } | undefined,
): ProgressEntryResult & { statusDateToday?: string } {
  const index = taskIndexById(s, taskId);
  const task = s.tasks[index] as Task | undefined;
  if (!task) return { ok: true };
  if (isSummaryTask(task)) return { ok: false, reason: 'summaryTask' };
  const base = originalAppState(s);
  const plannedDates = ctx.plannedDates
    ?? (() => base ? liveProgressPlannedDates(base)(task) : progressPlannedDates(s)(task));
  const plan = planStoredProgressEdit(s, task, edit, { ...ctx, plannedDates });
  if (!plan.ok) return plan;
  if (!plan.change) return { ok: true };
  runtime.beginUndoable(s, opts);
  const progressWork = captureProgressWork(task, s);
  const { task: updated, statusDateToday } = plan.change;
  if (statusDateToday) {
    s.project.statusDate = statusDateToday;
    s.project.modifiedAt = new Date().toISOString();
  }
  task.time = updated.time;
  task.status = updated.status;
  if (task.splitGaps !== updated.splitGaps) task.splitGaps = updated.splitGaps;
  settleProgressWork(task, taskAssignmentDrafts(s, task.id), progressWork);
  runtime.finishMutation(s, { stale: true });
  return statusDateToday ? { ok: true, statusDateToday } : { ok: true };
}

interface StructuralOutcome {
  notices: NotifyInput[];
  lostSteering: number;
  assignmentsMoved: boolean;
}

type AskPhaseAssignments = (
  question: PhaseAssignmentQuestion,
  onChoice: (choice: PhaseAssignmentChoice) => void,
  recheck: () => PhaseAssignmentQuestion | null,
) => void;
const emptyOutcome = (): StructuralOutcome => ({ notices: [], lostSteering: 0, assignmentsMoved: false });

function settlePhaseTransitions(
  s: AppState,
  transitions: readonly PhaseTransition[],
  outcome: StructuralOutcome,
  opts: PhaseAssignmentOptions | undefined,
): void {
  if (transitions.length === 0) return;
  outcome.lostSteering += applyPhaseTransitions(s, transitions).length;
  outcome.notices.push(...phaseTransitionNotices(s, transitions, { announceMoves: !opts?.answered }));
  if (transitions.some(t => t.assignmentIds.length > 0)) outcome.assignmentsMoved = true;
}

function notifyRecomputedWork(
  runtime: StoreRuntime,
  get: () => AppState,
  fresh: readonly RecomputedRemainingWork[],
  coalesceKey: string | undefined,
): void {
  if (!coalesceKey) {
    const notice = remainingWorkRecomputedNotice(fresh);
    if (notice) get().notify(notice);
    return;
  }
  const carried = runtime.coalescedRecomputedWork(coalesceKey);
  if (carried.length === 0 && fresh.length === 0) return;
  const s = get();
  const { items, notify } = mergeStepRecomputedWork(carried, fresh,
    (id) => s.assignments.find((a) => a.id === id)?.remainingWorkMinutes);
  runtime.setCoalescedRecomputedWork(coalesceKey, items);
  const notice = remainingWorkRecomputedNotice(notify, { dedupeKey: `remaining-work:${coalesceKey}` });
  if (notice) s.notify(notice);
}

function finishStructural(get: () => AppState, outcome: StructuralOutcome): void {
  for (const notice of outcome.notices) get().notify(notice);
  if (outcome.lostSteering > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, outcome.lostSteering);
  if (outcome.assignmentsMoved) get().recomputeResourceLoad();
}

export const createTaskSlice: AppSliceFactory<TaskSlice> = (runtime) => (set, get) => {
  let pendingPhaseChoice: ((choice: PhaseAssignmentChoice) => void) | null = null;
  let recheckPhaseQuestion: (() => PhaseAssignmentQuestion | null) | null = null;
  const askPhaseAssignments: AskPhaseAssignments = (question, onChoice, recheck) => {
    pendingPhaseChoice = onChoice;
    recheckPhaseQuestion = recheck;
    set((s) => { s.ui.pendingPhaseAssignmentQuestion = question; });
  };

  const writeProgress = (
    taskId: string, edit: ProgressEdit, ctx: Omit<ProgressEntryContext, 'statusDate'>,
    opts?: { coalesceKey?: string },
  ): ProgressEntryResult => {
    const before = get();
    let result: ReturnType<typeof commitProgressEdit> = { ok: true };
    set(s => { result = commitProgressEdit(runtime, s, taskId, edit, ctx, opts); });
    if (!result.ok) return result;
    get().recomputeViewRows();
    if (result.statusDateToday) {
      get().notify(statusDateSetTodayNotice(result.statusDateToday, get().ui.dateNotation));
    }
    carryLiveProgressPlan(before, get(), taskId);
    return { ok: true };
  };

  return {
  tasks: [],

  askPhaseAssignmentQuestion: askPhaseAssignments,

  answerPhaseAssignmentQuestion: (choice) => {
    const asked = get().ui.pendingPhaseAssignmentQuestion;
    if (asked === null) return;
    const run = pendingPhaseChoice;
    const recheck = recheckPhaseQuestion;
    pendingPhaseChoice = null;
    recheckPhaseQuestion = null;
    set((s) => { s.ui.pendingPhaseAssignmentQuestion = null; });
    if (choice === null || !run) return;
    if (JSON.stringify(recheck?.() ?? null) !== JSON.stringify(asked)) {
      get().notify(refusalNotice({ messageKey: 'notifications.phaseQuestionOutdated', dedupeKey: 'phase-question-outdated' }));
      return;
    }
    run(choice);
  },

  addTask: (partial, opts) => {
    const id = generateId('task');
    const outcome = emptyOutcome();
    const mode = opts?.phaseAssignments ?? 'ask';
    const asked: { question: PhaseAssignmentQuestion | null } = { question: null };
    let refused = false;
    const recheck = () => {
      const st = get();
      const anchor = partial.position ? st.tasks.find(t => t.id === partial.position!.anchorId) : undefined;
      const parentId = anchor ? anchor.parentId : (partial.parentId || null);
      return phaseAssignmentQuestion(st, firstChildGains(st.tasks, [{ childId: id, parentId }]), new Map([[id, {
        name: partial.name, isMilestone: !!partial.isMilestone, hasChildren: false,
      }]]));
    };
    set((s) => {
      const anchorTask = partial.position
        ? s.tasks.find(t => t.id === partial.position!.anchorId)
        : undefined;
      const parentId = anchorTask ? anchorTask.parentId : (partial.parentId || null);
      const parentTask = parentId ? s.tasks.find(t => t.id === parentId) : undefined;

      const pending = new Map<string, PendingChild>([[id, {
        name: partial.name, isMilestone: !!partial.isMilestone, hasChildren: false,
      }]]);
      const gains = firstChildGains(s.tasks, [{ childId: id, parentId }]);
      if (mode === 'ask') {
        asked.question = phaseAssignmentQuestion(s, gains, pending);
        if (asked.question) return;
      }
      const phasePlan = planPhaseTransitions(s, gains, pending, mode === 'ask' ? 'move' : mode);
      if (!phasePlan.ok) {
        outcome.notices.push(phaseRefusalNotice(s, phasePlan.refusal, pending));
        refused = true;
        return;
      }

      runtime.beginUndoable(s);

      const now = s.project.startDate || localTodayIso();
      const effectiveNewTaskCalendar = resolveCalendar(partial.calendarId, s.calendars, s.calendar);
      const initialTime = mergeTaskTime(createDefaultTaskTime(
        now,
        partial.isMilestone ? 0 : 5,
        newTaskTimeUnit(s.project),
        effectiveNewTaskCalendar,
      ), partial.time);
      deriveScheduleDurationFromMinutes(initialTime, effHoursPerDay(effectiveNewTaskCalendar));

      const task = buildNewTask(partial, {
        id, parentId, parentTask, constructionMode: s.ui.constructionMode, time: initialTime,
      });
      const madeHours = settleNewTaskMeasure(task, s.project, partial.time?.durationUnit !== undefined, effHoursPerDay(effectiveNewTaskCalendar));
      seedNewHourTaskFinish(task, madeHours ? undefined : partial.time, effectiveNewTaskCalendar);
      Object.assign(task, normalizeTaskDates(task, s));
      if (partial.workRule !== undefined) s.taskTypesVisible = true;

      if (anchorTask) {
        const anchorIdx = s.tasks.findIndex(t => t.id === anchorTask.id);
        const insertAt = partial.position!.where === 'above' ? anchorIdx : anchorIdx + 1;
        s.tasks.splice(insertAt, 0, task);
      } else {
        s.tasks.push(task);
      }

      if (task.parentId) {
        const parent = s.tasks.find(t => t.id === task.parentId);
        if (parent) {
          if (anchorTask) {
            const anchorChildIdx = parent.childIds.indexOf(anchorTask.id);
            const insertAt = anchorChildIdx >= 0
              ? (partial.position!.where === 'above' ? anchorChildIdx : anchorChildIdx + 1)
              : parent.childIds.length;
            parent.childIds.splice(insertAt, 0, id);
          } else {
            parent.childIds.push(id);
          }
        }
      }

      if (s.project.wbsAutoNumber || !partial.wbsCode) assignInsertedWbsCodes(s, [id]);

      settlePhaseTransitions(s, phasePlan.transitions, outcome, opts);
      runtime.finishMutation(s, { stale: true });
    });
    if (asked.question) {
      askPhaseAssignments(asked.question, (choice) => {
        get().addTask(partial, { phaseAssignments: choice, answered: true });
      }, recheck);
      return '';
    }
    finishStructural(get, outcome);
    if (refused) return '';
    get().recomputeViewRows();
    return id;
  },

  updateTask: (id, updates, opts) => {
    let lostTimephasedGuidance = false;
    let refusedNotices: NotifyInput[] = [];
    let recomputedWork: RecomputedRemainingWork[] = [];
    set((s) => {
      const idx = taskIndexById(s, id);
      if (idx < 0) return;
      const task = s.tasks[idx];
      if (updates.time && 'scheduleStart' in updates.time && isNaN(parseDate(updates.time.scheduleStart ?? '').getTime())) {
        updates = { ...updates, time: { ...updates.time, scheduleStart: task.time.scheduleStart } };
      }
      if (updates.isMilestone === true && !task.isMilestone) {
        const refusal = milestoneRefusal({
          hasChildren: isSummaryTask(task),
          hasAssignments: hasMilestoneBlockingAssignments(id, s.assignments, s.resources),
        });
        if (refusal) {
          refusedNotices = milestoneRefusalNotices([{ id: task.id, name: task.name, refusal }]);
          return;
        }
      }
      const next = normalizeTaskDates(mergeTaskUpdate(task, updates), s);
      if (updates.time && routeFixedWorkDurationToHours(next, task.time, next.time, s.project.defaultWorkRule,
        taskCalendarHoursPerDay(next, s.calendars, s.calendar))) {
        updates = { ...updates, time: { ...updates.time, ...hourSourceOf(next.time) } };
      }
      updates = normalizeTaskPatch(updates, next);
      if (sameValue(task, next)) return;
      let keepsRecordedMode = s.datesAsRecorded && changesOnlyDateNeutralFields(task, next);
      if (taskTriggerChanges(task, next).timeBase) {
        const refusal = durationEditRefusal(task, next.time, taskCalendarHoursPerDay(next, s.calendars, s.calendar));
        if (refusal) {
          refusedNotices = [durationBelowDoneWorkNotice(task)];
          return;
        }
      }
      runtime.beginUndoable(s, opts);
      const { time, workRule, calendarId, ...rest } = updates;
      const finishBasis = hourInputFinishBasis(task);
      const calendarChanged = 'calendarId' in updates && task.calendarId !== calendarId;
      if (calendarChanged) {
        const before = captureCalendarChange(task, s.assignments, s);
        task.calendarId = calendarId;
        lostTimephasedGuidance = settleCalendarChange(task, s.assignments, before, s).timephasedLost;
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
        lostTimephasedGuidance = duration.timephasedLost || lostTimephasedGuidance;
        recomputedWork = settleDurationEdit(task, triangle).recomputedWork;
      }
      settleProgressWork(task, s.assignments, progressWork);
      if ('workRule' in updates && task.workRule !== workRule) {
        if (settleRuleChange(task, s.assignments, s, workRule).durationUnitChanged) keepsRecordedMode = false;
        if (workRule !== undefined) s.taskTypesVisible = true;
      }
      reconcileP6SuspendResume(task);
      if (calendarChanged) {
        lostTimephasedGuidance = invalidateForTimeBaseChange(task) || lostTimephasedGuidance;
      }
      if (changes.levelingGaps || calendarChanged) clearLevelingGaps(task);
      reconcileHourInputFinish(task, finishBasis, resolveCalendar(task.calendarId, s.calendars, s.calendar));
      Object.assign(task, normalizeTaskDates(task, s));
      runtime.finishMutation(s, { stale: !keepsRecordedMode });
    });
    for (const notice of refusedNotices) get().notify(notice);
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    notifyRecomputedWork(runtime, get, recomputedWork, opts?.coalesceKey);
    get().recomputeViewRows();
  },

  setTaskWorkRule: (id, rule) => {
    set((s) => {
      const task = s.tasks.find(t => t.id === id);
      if (!task || task.workRule === rule) return;
      runtime.beginUndoable(s);
      const { durationUnitChanged } = settleRuleChange(task, s.assignments, s, rule);
      s.taskTypesVisible = true;
      runtime.finishMutation(s, { stale: durationUnitChanged });
    });
    get().recomputeResourceLoad();
    get().recomputeViewRows();
  },

  setTaskSplits: (taskId, pieces, opts) => {
    let lostTimephasedGuidance = false;
    let recomputedWork: RecomputedRemainingWork[] = [];
    let refusal: SplitRefusal | null = null;
    set((s) => {
      const task = s.tasks.find(t => t.id === taskId);
      if (!task) { refusal = 'not-editable'; return; }
      const hoursPerDay = taskCalendarHoursPerDay(task, s.calendars, s.calendar);
      refusal = taskSplitRefusal(task, pieces, hoursPerDay);
      if (refusal) return;

      runtime.beginUndoable(s, opts);

      const outcome = applyTaskSplits(s, task, pieces, hoursPerDay);
      lostTimephasedGuidance = outcome.timephasedLost;
      recomputedWork = outcome.recomputedWork;

      runtime.finishMutation(s, { stale: true });
    });
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    notifyRecomputedWork(runtime, get, recomputedWork, opts?.coalesceKey);
    get().recomputeViewRows();
    return refusal;
  },

  setTaskCalendar: (taskId, calendarId) => {
    let lostTimephasedGuidance = false;
    set((s) => {
      const task = s.tasks[taskIndexById(s, taskId)] as Task | undefined;
      if (!task) return;
      if (task.calendarId === calendarId) return;
      runtime.beginUndoable(s);
      const finishBasis = hourInputFinishBasis(task);
      const own = taskAssignmentDrafts(s, taskId);
      const before = captureCalendarChange(task, own, s);
      task.calendarId = calendarId;
      const settled = settleCalendarChange(task, own, before, s);
      lostTimephasedGuidance = settled.timephasedLost || clearTimephasedWindow(task);
      clearLevelingGaps(task);
      reconcileHourInputFinish(task, finishBasis, resolveCalendar(calendarId, s.calendars, s.calendar));
      Object.assign(task, normalizeTaskDates(task, s));
      runtime.finishMutation(s, { stale: true });
    });
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    get().recomputeViewRows();
  },

  addExternalLink: (taskId, link) => {
    const id = generateId('extlink');
    set((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) return;
      runtime.beginUndoable(s);
      const full: ExternalLink = { ...link, id };
      task.externalLinks = [...(task.externalLinks ?? []), full];
      Object.assign(task, normalizeTaskDates(task, s));
      runtime.finishMutation(s, { stale: true });
    });
    get().recomputeViewRows();
    return id;
  },

  updateExternalLink: (taskId, linkId, link) => {
    let found = false;
    let changed = false;
    set((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      const index = task?.externalLinks?.findIndex(candidate => candidate.id === linkId) ?? -1;
      if (!task?.externalLinks || index < 0) return;
      found = true;
      const current = task.externalLinks[index];
      const next = normalizeTaskDates({
        ...task,
        externalLinks: task.externalLinks.map((candidate, candidateIndex) => (
          candidateIndex === index ? { ...link, id: linkId } : candidate
        )),
      }, s);
      if (sameExternalLink(current, next.externalLinks![index])) return;
      runtime.beginUndoable(s);
      Object.assign(task, next);
      runtime.finishMutation(s, { stale: true });
      changed = true;
    });
    if (changed) get().recomputeViewRows();
    return found;
  },

  removeExternalLink: (taskId, linkId) => {
    set((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task || !task.externalLinks) return;
      const next = task.externalLinks.filter((l) => l.id !== linkId);
      if (next.length === task.externalLinks.length) return;
      runtime.beginUndoable(s);
      task.externalLinks = next.length > 0 ? next : undefined;
      runtime.finishMutation(s, { stale: true });
    });
    get().recomputeViewRows();
  },

  deleteTask: (id) => {
    const { viewRows: rowsBefore, selectedTaskIds: selectedBefore, ui: { gridActiveRowKey } } = get();
    set((s) => {
      const task = s.tasks.find(t => t.id === id);
      if (!task) return;
      runtime.beginUndoable(s);
      removeTaskSubtrees(s, [id]);
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      runtime.finishMutation(s, { stale: true });
    });
    get().recomputeViewRows();
    set((s) => { selectNeighbourAfterRemoval(s, rowsBefore, selectedBefore, gridActiveRowKey); });
  },

  deleteTasksBulk: (ids) => {
    const frozen = [...ids];
    if (frozen.length === 0) return;
    if (frozen.length === 1) {
      get().deleteTask(frozen[0]);
      return;
    }

    const { viewRows: rowsBefore, selectedTaskIds: selectedBefore, ui: { gridActiveRowKey } } = get();
    set((s) => {
      const existing = new Set(s.tasks.map((task) => task.id));
      const roots = frozen.filter((id) => existing.has(id));
      if (roots.length === 0) return;
      runtime.beginUndoable(s);
      removeTaskSubtrees(s, roots);
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      runtime.finishMutation(s, { stale: true });
    });
    get().recomputeViewRows();
    set((s) => { selectNeighbourAfterRemoval(s, rowsBefore, selectedBefore, gridActiveRowKey); });
  },

  dissolveTasksBulk: (ids) => {
    const existing = new Set(get().tasks.map(task => task.id));
    const known = ids.filter(id => existing.has(id));
    if (known.length === 0) return;
    const headerOnly = get().ui.dissolveSummaryMode === 'header';
    const refused: string[] = [];
    set((s) => {
      runtime.beginUndoable(s);
      let roots = known;
      if (headerOnly) {
        const position = new Map(flattenOrder(s.tasks).map((task, index) => [task.id, index] as const));
        const isSummary = (id: string) => (s.tasks.find(task => task.id === id)?.childIds.length ?? 0) > 0;
        const headers = known.filter(isSummary).sort((x, y) => (position.get(x) ?? 0) - (position.get(y) ?? 0));
        for (const id of headers) refused.push(...dissolveSummaryHeader(s, id));
        roots = known.filter(id => !headers.includes(id));
      }
      if (roots.length > 0) {
        const plain = currentAppState(s);
        const plan = planDissolve(plain.tasks, plain.sequences, roots);
        removeTaskSubtrees(s, roots);
        for (const bridge of plan.bridges) s.sequences.push({ ...bridge, id: generateId('seq') });
        for (const { taskId, link } of plan.externalBridges) {
          const target = s.tasks.find(task => task.id === taskId);
          if (!target) continue;
          target.externalLinks = [...(target.externalLinks ?? []), { ...link, id: generateId('extlink') }];
          Object.assign(target, normalizeTaskDates(target, s));
        }
        refused.push(...plan.refused);
      }
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      runtime.finishMutation(s, { stale: true });
    });
    get().recomputeViewRows();
    if (refused.length > 0) {
      get().notify(refusalNotice({
        messageKey: 'notifications.relationsSkippedOnDissolve',
        params: { count: refused.length },
        detailLines: refusedNamesLine(refused, 'relations'),
        dedupeKey: refusedSetKey('dissolve', refused),
      }));
    }
  },

  moveTask: (id, newParentId, position, opts) => {
    applyHierarchyEdit(runtime, set, get, moveTaskEdit(id, newParentId, position), 'always', opts, askPhaseAssignments);
  },

  moveTaskTo: (id, target, opts) => {
    applyHierarchyEdit(runtime, set, get, moveTaskToEdit(id, target), 'on-reparent', opts, askPhaseAssignments);
  },

  moveTasksTo: (ids, target, opts) => {
    applyHierarchyEdit(runtime, set, get, moveTasksToEdit(ids, target), 'on-reparent', opts, askPhaseAssignments);
  },

  indentTasks: (ids, opts) => {
    applyHierarchyEdit(runtime, set, get, indentEdit(ids), 'always', opts, askPhaseAssignments);
  },

  outdentTasks: (ids, opts) => {
    applyHierarchyEdit(runtime, set, get, outdentEdit(ids), 'always', opts, askPhaseAssignments);
  },

  reorderSibling: (taskId, direction) => {
    set((s) => {
      const task = s.tasks.find(t => t.id === taskId);
      if (!task) return;

      if (task.parentId) {
        const parent = s.tasks.find(t => t.id === task.parentId);
        if (!parent) return;
        const idx = parent.childIds.indexOf(taskId);
        if (idx < 0) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= parent.childIds.length) return;
        const otherId = parent.childIds[swapIdx];

        runtime.beginUndoable(s);
        const tmp = parent.childIds[idx];
        parent.childIds[idx] = parent.childIds[swapIdx];
        parent.childIds[swapIdx] = tmp;

        const rawIdx = s.tasks.findIndex(t => t.id === taskId);
        const [node] = s.tasks.splice(rawIdx, 1);
        const otherRawIdx = s.tasks.findIndex(t => t.id === otherId);
        if (direction === 'up') {
          s.tasks.splice(otherRawIdx, 0, node);
        } else {
          s.tasks.splice(otherRawIdx + 1, 0, node);
        }
      } else {
        const rootIds = s.tasks.filter(t => !t.parentId).map(t => t.id);
        const idx = rootIds.indexOf(taskId);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= rootIds.length) return;

        const otherId = rootIds[swapIdx];
        const absA = s.tasks.findIndex(t => t.id === taskId);
        const absB = s.tasks.findIndex(t => t.id === otherId);

        runtime.beginUndoable(s);
        const tmp = s.tasks[absA];
        s.tasks[absA] = s.tasks[absB];
        s.tasks[absB] = tmp;
      }

      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
  },

  renumberWbs: () => {
    set((s) => {
      runtime.beginUndoable(s);
      applyWbsNumbering(s.tasks);
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
  },

  insertWbsTemplate: (template, parentId, opts) => {
    if (template.tasks.length === 0) return null;
    let newRootId: string | null = null;
    let skippedRelations: string[] = [];
    const outcome = emptyOutcome();
    const mode = opts?.phaseAssignments ?? 'ask';
    const asked: { question: PhaseAssignmentQuestion | null } = { question: null };
    let recheck: () => PhaseAssignmentQuestion | null = () => null;
    set((s) => {
      const idMap = new Map<string, string>();
      for (const tt of template.tasks) idMap.set(tt.id, generateId('task'));

      const root = [...template.tasks].reverse().find(tt => tt.parentId === null);
      const pending = new Map<string, PendingChild>();
      if (root) {
        pending.set(idMap.get(root.id)!, {
          name: root.name,
          isMilestone: root.isMilestone,
          hasChildren: template.tasks.some(c => c.parentId === root.id),
        });
      }
      const gains = firstChildGains(s.tasks, [...pending.keys()].map(childId => ({ childId, parentId })));
      if (mode === 'ask') {
        asked.question = phaseAssignmentQuestion(s, gains, pending);
        recheck = () => phaseAssignmentQuestion(
          get(), firstChildGains(get().tasks, [...pending.keys()].map(childId => ({ childId, parentId }))), pending,
        );
        if (asked.question) return;
      }
      const phasePlan = planPhaseTransitions(s, gains, pending, mode === 'ask' ? 'move' : mode);
      if (!phasePlan.ok) {
        outcome.notices.push(phaseRefusalNotice(s, phasePlan.refusal, pending));
        return;
      }

      runtime.beginUndoable(s);

      const startDate = s.project.startDate || localTodayIso();

      for (const tt of template.tasks) {
        const id = idMap.get(tt.id)!;
        const parent = tt.parentId ? idMap.get(tt.parentId)! : parentId;
        if (tt.parentId === null) newRootId = id;
        s.tasks.push(normalizeTaskDates({
          id,
          name: tt.name,
          description: tt.description,
          wbsCode: '',
          taskType: tt.taskType,
          status: 'NOT_STARTED',
          isMilestone: tt.isMilestone,
          priority: 500,
          parentId: parent ?? null,
          childIds: template.tasks.filter(c => c.parentId === tt.id).map(c => idMap.get(c.id)!),
          time: createDefaultTaskTime(startDate, tt.isMilestone ? 0 : tt.durationDays, 'days'),
          resourceIds: [],
        }, s));
      }
      if (parentId && newRootId) {
        const parent = s.tasks.find(t => t.id === parentId);
        if (parent) parent.childIds.push(newRootId);
      }
      skippedRelations = insertRemappedRelations(s, template.sequences, idMap);
      assignInsertedWbsCodes(s, idMap.values());

      if (newRootId) {
        s.selectedTaskIds = [newRootId];
        s.activeTaskId = newRootId;
      }
      settlePhaseTransitions(s, phasePlan.transitions, outcome, opts);
      runtime.finishMutation(s, { stale: true });
    });
    if (asked.question) {
      askPhaseAssignments(asked.question, (choice) => {
        get().insertWbsTemplate(template, parentId, { phaseAssignments: choice, answered: true });
      }, recheck);
      return null;
    }
    finishStructural(get, outcome);
    get().recomputeViewRows();
    notifyRelationsSkipped(get().notify, skippedRelations, 'relations-skipped-on-insert-template');
    return newRootId;
  },

  setTaskProgress: (taskId, raw, opts) =>
    writeProgress(taskId, { field: 'completion', value: raw }, {}, opts).ok,

  setActualStart: (taskId, date, opts) =>
    writeProgress(taskId, { field: 'actualStart', value: date }, {}, opts).ok,

  setActualFinish: (taskId, date, opts) =>
    writeProgress(taskId, { field: 'actualFinish', value: date }, {}, opts).ok,

  enterTaskProgress: (taskId, edit, opts) =>
    writeProgress(taskId, edit, { today: opts.today, actualStart: opts.actualStart, plannedDates: opts.plannedDates }, opts),

  previewProgressImport: (rows, overrides, opts) => {
    const s = get();
    return buildProgressImportPlan(rows, s.tasks, progressImportDeps(s, opts?.today), overrides, opts?.conflictChoices);
  },

  applyProgressImport: (rows, overrides, opts) => {
    let plan!: ProgressImportPlan;
    let statusDateToday: string | undefined;
    set((s) => {
      const live = originalAppState(s) ?? s;
      plan = buildProgressImportPlan(rows, live.tasks, progressImportDeps(live, opts?.today), overrides, opts?.conflictChoices);
      if (plan.appliedCount === 0 || plan.unresolvedConflictCount > 0) return;
      runtime.beginUndoable(s);
      if (!s.project.statusDate && opts?.today
        && plan.rows.some(row => row.outcome === 'apply' && row.plannedTask && hasRecordedProgress(row.plannedTask.time))) {
        s.project.statusDate = opts.today;
        s.project.modifiedAt = new Date().toISOString();
        statusDateToday = opts.today;
      }
      for (const row of plan.rows) {
        if (row.outcome !== 'apply') continue;
        const index = s.tasks.findIndex((t) => t.id === row.taskId);
        if (index >= 0) {
          const progressWork = captureProgressWork(s.tasks[index], s);
          s.tasks[index] = normalizeTaskDates(row.plannedTask!, s);
          settleProgressWork(s.tasks[index], s.assignments, progressWork);
        }
      }
      runtime.finishMutation(s, { stale: true });
    });
    get().recomputeViewRows();
    if (statusDateToday) get().notify(statusDateSetTodayNotice(statusDateToday, get().ui.dateNotation));
    return plan;
  },
  };
};
