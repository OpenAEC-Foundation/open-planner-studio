import type { McpContext, McpToolDef, McpToolOk, McpToolResult } from '../contracts';
import type { BatchStepTool } from './batchTool';
import {
  guardNonTransactional,
  McpStepError,
  runMutateTool,
  toolError,
  type MutationOutcome,
} from './runtime';
import {
  enrichOk, freshDates, okDirectGuarded, okEnvelope, parsedBatchStep, projectEndInfo, WRITE_ANNOTATIONS,
} from './helpers';
import type { AppState } from '@/state/appStore';
import type { BulkTaskItem } from '@/state/runtime/createMcpTransactions';
import { validate, progress } from '@/state/mcpValidation';
import { progressCanShiftOtherTasks, progressPlannedDates, taskPlacementChanged } from '@/state/progressPlannedDates';
import {
  parseProgress,
  parseTaskFields,
  TASK_FIELDS_DOC,
  SUMMARY_DURATION_READ_ONLY,
  TASK_FIELD_SCHEMA_PROPERTIES,
  TASK_FIELD_SCHEMA_PROPERTIES_BARE,
  type TaskFieldContext,
  type TaskFieldPatch,
} from './taskFields';
import type { SequenceType } from '@/types/sequence';
import type { Task, TaskTime } from '@/types/task';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { isAncestorRelation, relationKey } from '@/state/relationRules';
import { moveTaskVerdict } from '@/state/slices/taskSlice';
import {
  ANCESTOR_RELATION_REJECTION,
  LAG_SCHEMA,
  lagPatchOf,
  parseLag,
  normalizeSeqType,
  selfRelationReason,
  SEQ_TYPE_SCHEMA,
  unknownTypeReason,
  type ParsedLag,
} from './sequenceFields';
import type { PhaseTransitionReport } from '@/state/structuralTransition';
import { watchAncestorRelations } from '@/state/hierarchyRelationNotice';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { finishDurationProgress } from '@/engine/work/workRuleApply';
import { localTodayIso } from '@/utils/dateUtils';
import { ancestorIds } from '@/utils/wbs';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';
import { hasConcreteWorkBlocks } from '@/services/subdayIo';
import { effHoursPerDay } from '@/utils/taskDuration';
import { markDocumentEdited } from '@/state/documentEdited';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import type { SplitPiece } from '@/engine/scheduler/splitEdit';
import { interruptionsOf, planTaskSplits } from './splitFields';
import { hasMilestoneBlockingAssignments } from '@/engine/taskMilestoneTransition';

const PHASE_TRANSITION_DOC = 'A task that gets its first subtask passes its assignments to the first eligible new leaf (`phaseTransitions`).';

function fieldContext(
  s: AppState,
  task?: Task,
): TaskFieldContext {
  return {
    currentIsMilestone: task?.isMilestone ?? false,
    hasChildren: isSummaryTask(task),
    hasAssignments: task ? hasMilestoneBlockingAssignments(task.id, s.assignments, s.resources) : false,
    currentConstraint2: task?.constraint2,
    calendarExists: (id: string) => s.calendars.some((c) => c.id === id) || id === s.calendar.id,
    customTaskTypes: s.customTaskTypes,
    durationCalendar: (requestedId) => {
      const id = requestedId === undefined ? task?.calendarId : requestedId ?? undefined;
      const calendar = resolveCalendar(id, s.calendars, s.calendar);
      return {
        hoursPerDay: effHoursPerDay(calendar),
        hasWorkBlocks: hasConcreteWorkBlocks(calendar),
      };
    },
  };
}

interface ParsedAddItem {
  tempId: string;
  parentId?: string;
  position?: number;
  patch: TaskFieldPatch;
}

function parseAddTasks(args: unknown, state: AppState): ParsedAddItem[] | string {
  const a = (args ?? {}) as { tasks?: unknown };
  if (!Array.isArray(a.tasks) || a.tasks.length === 0) {
    return 'add_tasks requires a non-empty `tasks` array';
  }
  const seenTemp = new Set<string>();
  const parsed: ParsedAddItem[] = [];
  for (const it of a.tasks) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return 'every task item must be an object';
    const raw = it as Record<string, unknown>;
    if (typeof raw.tempId !== 'string' || typeof raw.name !== 'string') {
      return 'every task item requires a string `tempId` and `name`';
    }
    const tid = raw.tempId;
    if (seenTemp.has(tid)) return `duplicate tempId '${tid}' within the call`;
    seenTemp.add(tid);
    if (raw.parentId !== undefined && typeof raw.parentId !== 'string') {
      return `task '${tid}': \`parentId\` must be a string (existing task id or tempId from this call)`;
    }
    if (raw.position !== undefined && (typeof raw.position !== 'number' || !Number.isInteger(raw.position))) {
      return `task '${tid}': \`position\` must be an integer`;
    }
    const { tempId: _t, parentId: _p, position: _pos, ...fields } = raw;
    void _t; void _p; void _pos;
    const res = parseTaskFields(fields, fieldContext(state));
    if (!res.ok) return `task '${tid}': ${res.reason}`;
    parsed.push({
      tempId: tid,
      ...(typeof raw.parentId === 'string' ? { parentId: raw.parentId } : {}),
      ...(typeof raw.position === 'number' ? { position: raw.position } : {}),
      patch: res.patch,
    });
  }
  const parentIds = new Set(parsed.map(item => item.parentId));
  for (const item of parsed) {
    if (parentIds.has(item.tempId) && item.patch.time?.scheduleDuration !== undefined) {
      return `task '${item.tempId}': ${SUMMARY_DURATION_READ_ONLY}`;
    }
  }
  return parsed;
}

function addTasksCore(ctx: McpContext, items: ParsedAddItem[]): MutationOutcome {
  const st = ctx.app.store.getState();
  for (const item of items) {
    if (item.patch.customTaskType) ctx.transactions.draft.ensureCustomTaskType(item.patch.customTaskType);
  }
  const anchor = st.project.startDate || localTodayIso();
  const bulk: BulkTaskItem[] = items.map((it) => {
    const top = it.patch.top;
    const tp = it.patch.time;
    let time: Task['time'] | undefined;
    if (tp) {
      const unit = tp.durationUnit ?? 'days';
      const nativeAmount = unit === 'hours'
        ? (tp.durationMinutes ?? 0) / 60
        : (tp.scheduleDuration ?? (top.isMilestone ? 0 : 5));
      time = createDefaultTaskTime(anchor, nativeAmount, unit,
        resolveCalendar(typeof top.calendarId === 'string' ? top.calendarId : undefined, st.calendars, st.calendar));
      if (tp.scheduleDuration !== undefined) time.scheduleDuration = tp.scheduleDuration;
      if (tp.durationMinutes !== undefined) time.durationMinutes = tp.durationMinutes;
      if (tp.durationType !== undefined) time.durationType = tp.durationType;
    }
    return {
      ...top,
      ...(it.patch.workRule ? { workRule: it.patch.workRule } : {}),
      name: top.name as string,
      tempId: it.tempId,
      ...(it.parentId !== undefined ? { parentId: it.parentId } : {}),
      ...(it.position !== undefined ? { position: it.position } : {}),
      ...(time ? { time } : {}),
    };
  });
  const phaseTransitions: PhaseTransitionReport[] = [];
  const map = ctx.transactions.draft.addTasks(bulk, phaseTransitions);
  return {
    data: {
      created: Object.fromEntries(map),
      ...(phaseTransitions.length > 0 ? { phaseTransitions } : {}),
    },
  };
}

const addTasks: BatchStepTool = {
  name: 'planner_add_tasks',
  description:
    'Create tasks, a nested WBS in one call (items in any order); `parentId` = a task id or a `tempId` from ' +
    'this call. Without `duration`: the project default (normally 5 working days). One invalid item fails ' +
    `the whole call. ${PHASE_TRANSITION_DOC} Returns \`created\` (tempId → id).`,
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['tempId', 'name'],
          properties: {
            tempId: {
              type: 'string',
              pattern: '^tmp[-_]',
              description: 'Unique in the call, e.g. `tmp-foundation`.',
            },
            parentId: { type: 'string', description: 'Omitted = root.' },
            position: { type: 'integer', description: 'Index among siblings; clamped.' },
            ...TASK_FIELD_SCHEMA_PROPERTIES,
          },
          additionalProperties: false,
        },
      },
    },
    required: ['tasks'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseAddTasks, addTasksCore),
  async handler(args, ctx) {
    const parsed = parseAddTasks(args, ctx.app.store.getState());
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => addTasksCore(ctx, parsed));
    return enrichOk(res, () => {
      const core = (res as McpToolOk).data as { created: Record<string, string>; phaseTransitions?: PhaseTransitionReport[] };
      const state = ctx.app.store.getState();
      return {
        created: core.created,
        ...(core.phaseTransitions ? { phaseTransitions: core.phaseTransitions } : {}),
        tasks: freshDates(state, Object.values(core.created)),
        ...projectEndInfo(state),
      };
    });
  },
};

const FORBIDDEN_PROGRESS_IN_FIELDS = (fields: any): string | null => {
  if (fields && typeof fields === 'object') {
    if ('status' in fields) return 'use `progress`, not `fields.status`, for progress';
    const time = fields.time;
    if (time && typeof time === 'object' && ('completion' in time || 'actualStart' in time || 'actualFinish' in time)) {
      return 'use `progress`, not `fields.time.*`, for progress/actuals';
    }
  }
  return null;
};

function resolveFieldsPatch(
  state: AppState,
  id: string,
  fields: unknown,
): { ok: true; patch: TaskFieldPatch } | { ok: false; reason: string } {
  const forbidden = FORBIDDEN_PROGRESS_IN_FIELDS(fields);
  if (forbidden) return { ok: false, reason: forbidden };
  const task = state.tasks.find((t) => t.id === id);
  const res = parseTaskFields(fields, fieldContext(state, task));
  return res.ok ? { ok: true, patch: res.patch } : { ok: false, reason: res.reason };
}

function classifyUpdate(
  state: AppState,
  u: { id: string; fields?: any; progress?: any },
): { executable: true } | { executable: false; rejection: { id: string; reason: string } } {
  const missing = validate.taskExists(state, u.id);
  if (missing) return { executable: false, rejection: missing };
  const hasFields = u.fields !== undefined;
  const fieldsRes = hasFields ? resolveFieldsPatch(state, u.id, u.fields) : null;
  const progRes = u.progress !== undefined ? parseProgress(u.progress) : null;
  if ((fieldsRes && fieldsRes.ok) || (progRes && progRes.ok)) return { executable: true };
  const reason =
    fieldsRes && !fieldsRes.ok
      ? fieldsRes.reason
      : progRes && !progRes.ok
        ? progRes.reason
        : 'no `fields` or `progress` given';
  return { executable: false, rejection: { id: u.id, reason } };
}

function parseUpdateTasks(args: unknown): { id: string; fields?: any; progress?: any }[] | string {
  const a = (args ?? {}) as { updates?: unknown };
  if (!Array.isArray(a.updates) || a.updates.length === 0) {
    return 'update_tasks requires a non-empty `updates` array';
  }
  return a.updates as { id: string; fields?: any; progress?: any }[];
}

interface ProgressAdjusted {
  id: string;
  completion: number;
  remaining: number;
  durationUnit: 'days' | 'hours';
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function durationBelowDoneWorkReason(refused: { done: number; unit: 'days' | 'hours' }, completion: number): string {
  const unit = refused.unit === 'hours' ? 'hours' : 'working days';
  return `the task is already ${Math.round(completion * 100)}% done (${round2(refused.done)} ${unit} of work ` +
    'done): a new duration shorter than the work done is not possible — the work done stays the same on a ' +
    `duration change. Choose a duration of at least ${round2(refused.done)} ${unit}, or adjust the progress ` +
    'first (`progress`)';
}

function updateTasksCore(ctx: McpContext, updates: { id: string; fields?: any; progress?: any }[]): MutationOutcome {
  const initial = ctx.app.store.getState();
  const statusDate = initial.project.statusDate;
  let plannedDates = progressPlannedDates(initial);
  let canShiftOtherTasks: ((id: string) => boolean) | undefined;
  const refreshPlannedDates = (before: Task | undefined, progressOnly = false): void => {
    if (!before) return;
    const updated = ctx.app.store.getState();
    const after = updated.tasks.find(task => task.id === before.id);
    if (!after || !taskPlacementChanged(before, after)) return;
    if (progressOnly && (after.time.actualStart || !before.time.actualStart)) {
      canShiftOtherTasks ??= progressCanShiftOtherTasks(updated);
      if (!canShiftOtherTasks(before.id)) return;
    } else if (!progressOnly) canShiftOtherTasks = undefined;
    plannedDates = progressPlannedDates(updated, true);
  };
  const rejections: { id: string; reason: string }[] = [];
  const applied: string[] = [];
  const progressAdjusted: ProgressAdjusted[] = [];
  for (const u of updates) {
    const id = u.id;
    const beforeState = ctx.app.store.getState();
    const exists = validate.taskExists(beforeState, id);
    if (exists) { rejections.push(exists); continue; }
    let touched = false;
    let rejectedHere = false;
    let beforeDuration: TaskTime | undefined;
    if (u.fields !== undefined) {
      const res = resolveFieldsPatch(ctx.app.store.getState(), id, u.fields);
      if (!res.ok) { rejections.push({ id, reason: res.reason }); rejectedHere = true; }
      else {
        const before = beforeState.tasks.find(task => task.id === id);
        const completionBefore = before?.time.completion ?? 0;
        const outcome = ctx.transactions.draft.patchTaskFields(id, res.patch.top, res.patch.time, u.progress !== undefined);
        if (outcome && 'refused' in outcome) {
          rejections.push({ id, reason: durationBelowDoneWorkReason(outcome.refused, completionBefore) });
          rejectedHere = true;
        } else {
          if (res.patch.customTaskType) ctx.transactions.draft.ensureCustomTaskType(res.patch.customTaskType);
          if (res.patch.workRule !== undefined) ctx.transactions.draft.setTaskWorkRule(id, res.patch.workRule ?? undefined);
          refreshPlannedDates(before);
          if (outcome && 'progress' in outcome) {
            beforeDuration = before?.time;
            const hours = outcome.progress.remainingMinutes !== undefined;
            progressAdjusted.push({
              id,
              completion: round2(outcome.progress.completion * 100),
              remaining: hours ? round2(outcome.progress.remainingMinutes! / 60) : round2(outcome.progress.remainingTime),
              durationUnit: hours ? 'hours' : 'days',
            });
          }
          touched = true;
        }
      }
    }
    if (u.progress !== undefined) {
      const shape = parseProgress(u.progress);
      const before = ctx.app.store.getState().tasks.find(task => task.id === id);
      let refusal = shape.ok ? undefined : shape.reason;
      ctx.app.store.setState((s) => {
        if (shape.ok) {
          const update = progress.applyProgressUpdate(s, id, shape.value, statusDate, plannedDates, beforeDuration);
          if (!update.applied) refusal = update.reason;
        }
        if (refusal && beforeDuration && before && before.time.completion >= 1 && !before.time.actualFinish) {
          const task = s.tasks.find(task => task.id === id)!;
          finishDurationProgress(task, beforeDuration, statusDate, resolveCalendar(task.calendarId, s.calendars, s.calendar),
            effectiveSchedulingOptions(s.project).workdayDurationMeasure === true);
        }
      });
      if (refusal) { rejections.push({ id, reason: refusal }); rejectedHere = true; }
      else touched = true;
      refreshPlannedDates(before, true);
    }
    if (touched) applied.push(id);
    else if (!rejectedHere) rejections.push({ id, reason: 'no `fields` or `progress` given' });
  }
  return {
    data: { updated: applied, ...(progressAdjusted.length > 0 ? { progressAdjusted } : {}) },
    itemRejections: rejections,
  };
}

const updateTasks: BatchStepTool = {
  name: 'planner_update_tasks',
  description:
    'Always pair `duration` with `durationUnit` (omitted = days). Refused `fields` apply nothing; `progress` ' +
    'is independent, so an id may be both `updated` and in `itemRejections`. ' +
    `${TASK_FIELDS_DOC} \`progress\` needs the user's \`statusDate\` (planner_update_project; ask, never ` +
    'invent it); pass the user\'s actual dates. Otherwise completion > 0 derives actualStart from the planned ' +
    'start; planned start after the status date: refused, pass `actualStart`. No `duration` or `progress` on ' +
    'summary tasks. On a ' +
    'started, unfinished task a new duration keeps the work done (10 d at 40% → 12 d: 8 d left, 33%; ' +
    '`progressAdjusted`); less than the work done is refused. Report `remainingWorkRecomputed`. Hypothetical ' +
    'delay: change duration or constraint, not `progress`.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      updates: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
            fields: {
              type: 'object',
              description: 'Fields of planner_add_tasks items (meaning per field there); `constraint` fixes a ' +
                'date, `deadline` does not.',
              properties: { ...TASK_FIELD_SCHEMA_PROPERTIES_BARE },
              additionalProperties: false,
            },
            progress: {
              type: 'object',
              properties: {
                completion: { type: 'number', minimum: 0, maximum: 100, description: 'Percent.' },
                actualStart: { type: ['string', 'null'], description: 'ISO date ≤ status date; null clears.' },
                actualFinish: { type: ['string', 'null'], description: 'ISO date, ≥ actualStart and ≤ status date; null clears.' },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
    },
    required: ['updates'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseUpdateTasks, updateTasksCore),
  async handler(args, ctx) {
    const parsed = parseUpdateTasks(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const updates = parsed;
    {
      const st = ctx.app.store.getState();
      const staticRej: { id: string; reason: string }[] = [];
      let anyExecutable = false;
      for (const u of updates) {
        const c = classifyUpdate(st, u);
        if (c.executable) anyExecutable = true;
        else staticRej.push(c.rejection);
      }
      if (!anyExecutable) {
        return okDirectGuarded(ctx, { updated: [], tasks: [], projectEnd: projectEndInfo(st).projectEnd }, staticRej);
      }
    }
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => updateTasksCore(ctx, updates));
    return enrichOk(res, () => {
      const { updated, progressAdjusted } = (res as McpToolOk).data as { updated: string[]; progressAdjusted?: ProgressAdjusted[] };
      const state = ctx.app.store.getState();
      return {
        updated, tasks: freshDates(state, updated), projectEnd: projectEndInfo(state).projectEnd,
        ...(progressAdjusted ? { progressAdjusted } : {}),
      };
    });
  },
};

function parseIdList(args: unknown, toolLabel: string): string[] | string {
  const a = (args ?? {}) as { ids?: unknown };
  if (!Array.isArray(a.ids) || a.ids.length === 0) {
    return `${toolLabel} requires a non-empty \`ids\` array`;
  }
  return a.ids as string[];
}

function deleteTasksCore(ctx: McpContext, ids: string[]): MutationOutcome {
  const before = ctx.app.store.getState();
  const existedBefore = new Set(before.tasks.map((t) => t.id));
  const seqBefore = before.sequences.length;
  const asgBefore = before.assignments.length;

  const rejections: { id: string; reason: string }[] = [];
  const deletedSet = new Set<string>();
  for (const id of ids) {
    const exists = validate.taskExists(ctx.app.store.getState(), id);
    if (exists) {
      if (existedBefore.has(id)) { deletedSet.add(id); continue; }
      rejections.push(exists);
      continue;
    }
    ctx.transactions.draft.deleteTask(id);
    deletedSet.add(id);
  }
  const deleted = [...deletedSet];

  const after = ctx.app.store.getState();
  const stillThere = new Set(after.tasks.map((t) => t.id));
  const deletedTaskIds = [...existedBefore].filter((id) => !stillThere.has(id));
  const requested = new Set(ids);
  return {
    data: {
      deleted,
      deletedTaskIds,
      deletedTaskCount: deletedTaskIds.length,
      cascadedTaskIds: deletedTaskIds.filter((id) => !requested.has(id)),
      removedDependencyCount: seqBefore - after.sequences.length,
      removedAssignmentCount: asgBefore - after.assignments.length,
    },
    itemRejections: rejections,
  };
}

const deleteTasks: BatchStepTool = {
  name: 'planner_delete_tasks',
  description:
    'Delete tasks WITH their whole subtree, relationships and assignments; check `cascadedTaskIds`.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: { ids: { type: 'array', minItems: 1, items: { type: 'string' } } },
    required: ['ids'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep((args: unknown) => parseIdList(args, 'delete_tasks'), deleteTasksCore),
  async handler(args, ctx) {
    const parsed = parseIdList(args, 'delete_tasks');
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const ids = parsed;
    {
      const st = ctx.app.store.getState();
      const staticRej = validate.tasksExist(st, ids);
      if (staticRej.length === ids.length) {
        return okDirectGuarded(
          ctx,
          {
            deleted: [],
            deletedTaskIds: [],
            deletedTaskCount: 0,
            cascadedTaskIds: [],
            removedDependencyCount: 0,
            removedAssignmentCount: 0,
            projectEnd: projectEndInfo(st).projectEnd,
          },
          staticRej,
        );
      }
    }
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => deleteTasksCore(ctx, ids));
    return enrichOk(res, () => ({
      ...((res as McpToolOk).data as object),
      projectEnd: projectEndInfo(ctx.app.store.getState()).projectEnd,
    }));
  },
};

function parseMoveTask(args: unknown): { id: string; newParentId: string | null; position?: number } | string {
  const a = (args ?? {}) as { id?: unknown; newParentId?: unknown; position?: unknown };
  if (typeof a.id !== 'string') return 'move_task requires a string `id`';
  if (!(a.newParentId === null || typeof a.newParentId === 'string')) {
    return '`newParentId` must be a string or null';
  }
  if (a.position !== undefined && (typeof a.position !== 'number' || !Number.isInteger(a.position))) {
    return '`position` must be an integer (insertion index within the parent)';
  }
  return {
    id: a.id,
    newParentId: a.newParentId as string | null,
    ...(typeof a.position === 'number' ? { position: a.position } : {}),
  };
}

function moveTaskCore(ctx: McpContext, p: { id: string; newParentId: string | null; position?: number }): MutationOutcome {
  const { id, newParentId, position } = p;
  const st = ctx.app.store.getState();
  if (!st.tasks.some((t) => t.id === id)) throw new McpStepError('NOT_FOUND', `task '${id}' does not exist`);
  if (newParentId !== null) {
    if (!st.tasks.some((t) => t.id === newParentId)) {
      throw new McpStepError('NOT_FOUND', `new parent '${newParentId}' does not exist`);
    }
    const parentById = new Map(st.tasks.map((t) => [t.id, t.parentId]));
    const ownDescendant = newParentId === id
      || [...ancestorIds(newParentId, (tid) => parentById.get(tid))].includes(id);
    if (ownDescendant) throw new McpStepError('VALIDATION', 'cannot place a task under itself or one of its own descendants');
  }
  const verdict = moveTaskVerdict(st, id, newParentId, position);
  if (!verdict.ok) {
    throw new McpStepError(
      'CYCLE',
      `circular dependency detected: ${verdict.cycle.join(' → ')} — the relationships of a summary task ` +
      'apply to all its subtasks, so this move would deadlock the schedule; the task has not been moved',
    );
  }
  const reportAncestorRelations = watchAncestorRelations(ctx.app.store.getState());
  const phaseTransitions = ctx.transactions.draft.moveTask(id, newParentId, position);
  reportAncestorRelations(ctx.app.store.getState());
  return { data: { moved: id, ...(phaseTransitions.length > 0 ? { phaseTransitions } : {}) } };
}

const moveTask: BatchStepTool = {
  name: 'planner_move_task',
  description:
    `Move a task under \`newParentId\` (null = root) at \`position\` (index among the siblings). Refused under ` +
    `itself or a descendant, or when it creates a cycle. ${PHASE_TRANSITION_DOC}`,
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      newParentId: { type: ['string', 'null'] },
      position: { type: 'integer' },
    },
    required: ['id', 'newParentId'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseMoveTask, moveTaskCore),
  async handler(args, ctx) {
    const parsed = parseMoveTask(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const id = parsed.id;
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => moveTaskCore(ctx, parsed));
    return enrichOk(res, () => ({
      ...((res as McpToolOk).data as { moved: string; phaseTransitions?: PhaseTransitionReport[] }),
      moved: id,
      tasks: freshDates(ctx.app.store.getState(), [id]),
      projectEnd: projectEndInfo(ctx.app.store.getState()).projectEnd,
    }));
  },
};

function classifyDeps(
  st: AppState,
  deps: { predecessorId: string; successorId: string; type: string; lag?: unknown }[],
): {
  candidates: { predecessorId: string; successorId: string; type: SequenceType; lag: ParsedLag }[];
  rejections: { id: string; reason: string }[];
} {
  const rejections: { id: string; reason: string }[] = [];
  const candidates: { predecessorId: string; successorId: string; type: SequenceType; lag: ParsedLag }[] = [];
  const seen = new Set(st.sequences.map(relationKey));
  const byId = new Map(st.tasks.map((t) => [t.id, t]));
  const lookup = (id: string) => byId.get(id);
  for (const d of deps) {
    const label = `${d.predecessorId}->${d.successorId}`;
    const type = normalizeSeqType(d.type);
    if (!type) {
      rejections.push({ id: label, reason: unknownTypeReason(d.type) });
      continue;
    }
    const lag = parseLag(d.lag);
    if (!lag.ok) { rejections.push({ id: label, reason: lag.reason }); continue; }
    if (!byId.has(d.predecessorId)) { rejections.push({ id: label, reason: `predecessor '${d.predecessorId}' does not exist` }); continue; }
    if (!byId.has(d.successorId)) { rejections.push({ id: label, reason: `successor '${d.successorId}' does not exist` }); continue; }
    if (d.predecessorId === d.successorId) {
      rejections.push({ id: label, reason: selfRelationReason(d.predecessorId) });
      continue;
    }
    if (isAncestorRelation(lookup, d)) {
      rejections.push({ id: label, reason: ANCESTOR_RELATION_REJECTION });
      continue;
    }
    const key = relationKey({ predecessorId: d.predecessorId, successorId: d.successorId, type });
    if (seen.has(key)) { rejections.push({ id: label, reason: 'relationship already existed' }); continue; }
    seen.add(key);
    candidates.push({ predecessorId: d.predecessorId, successorId: d.successorId, type, lag: lag.value });
  }
  return { candidates, rejections };
}

function parseAddDeps(args: unknown): { predecessorId: string; successorId: string; type: string; lag?: unknown }[] | string {
  const a = (args ?? {}) as { dependencies?: unknown };
  if (!Array.isArray(a.dependencies) || a.dependencies.length === 0) {
    return 'add_dependencies requires a non-empty `dependencies` array';
  }
  return a.dependencies as { predecessorId: string; successorId: string; type: string; lag?: unknown }[];
}

function addDependenciesCore(
  ctx: McpContext,
  deps: { predecessorId: string; successorId: string; type: string; lag?: unknown }[],
): MutationOutcome {
  const st = ctx.app.store.getState();
  const { candidates, rejections } = classifyDeps(st, deps);
  const cyc = validate.noCycle(st, candidates.map((c) => ({ predecessorId: c.predecessorId, successorId: c.successorId })));
  if (cyc) throw new McpStepError('CYCLE', `circular dependency detected: ${cyc.join(' → ')}`);
  const added: string[] = [];
  for (const c of candidates) {
    const lp = lagPatchOf(c.lag);
    const newId = ctx.transactions.draft.addSequence({
      predecessorId: c.predecessorId,
      successorId: c.successorId,
      type: c.type,
      lagDays: lp.lagDays,
      ...(lp.lagPercent !== undefined ? { lagPercent: lp.lagPercent } : {}),
    });
    if (newId) added.push(newId);
    else {
      rejections.push({
        id: `${c.predecessorId}->${c.successorId}`,
        reason: 'relationship refused by the relationship rules (duplicate, or an end point that has no effect)',
      });
    }
  }
  return { data: { added }, itemRejections: rejections };
}

const addDependencies: BatchStepTool = {
  name: 'planner_add_dependencies',
  description:
    'Add relationships. A summary task as endpoint is ALLOWED (it applies to its leaf tasks). A link to an ' +
    'own ancestor is refused; a cycle fails the whole call.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      dependencies: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['predecessorId', 'successorId', 'type'],
          properties: {
            predecessorId: { type: 'string' },
            successorId: { type: 'string' },
            type: SEQ_TYPE_SCHEMA,
            lag: LAG_SCHEMA,
          },
          additionalProperties: false,
        },
      },
    },
    required: ['dependencies'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseAddDeps, addDependenciesCore),
  async handler(args, ctx) {
    const parsed = parseAddDeps(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const deps = parsed;
    {
      const state = ctx.app.store.getState();
      const pre = classifyDeps(state, deps);
      if (pre.candidates.length === 0) {
        return okDirectGuarded(ctx, { added: [], projectEnd: projectEndInfo(state).projectEnd }, pre.rejections);
      }
    }
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => addDependenciesCore(ctx, deps));
    return enrichOk(res, () => ({
      added: ((res as McpToolOk).data as { added: string[] }).added,
      projectEnd: projectEndInfo(ctx.app.store.getState()).projectEnd,
    }));
  },
};

function removeDependenciesCore(ctx: McpContext, ids: string[]): MutationOutcome {
  const st = ctx.app.store.getState();
  const rejections: { id: string; reason: string }[] = [];
  const toRemove = new Set<string>();
  const removed: string[] = [];
  for (const id of ids) {
    if (st.sequences.some((s) => s.id === id)) { toRemove.add(id); removed.push(id); }
    else rejections.push({ id, reason: `relationship '${id}' does not exist` });
  }
  if (toRemove.size > 0) {
    ctx.app.store.setState((s) => {
      s.sequences = s.sequences.filter((x) => !toRemove.has(x.id));
      markDocumentEdited(s);
    });
  }
  return { data: { removed }, itemRejections: rejections };
}

const removeDependencies: BatchStepTool = {
  name: 'planner_remove_dependencies',
  description:
    'Delete relationships by seqId. To change one, use planner_update_dependencies instead.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: { ids: { type: 'array', minItems: 1, items: { type: 'string' } } },
    required: ['ids'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep((args: unknown) => parseIdList(args, 'remove_dependencies'), removeDependenciesCore),
  async handler(args, ctx) {
    const parsed = parseIdList(args, 'remove_dependencies');
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const ids = parsed;
    {
      const st = ctx.app.store.getState();
      const existing = new Set(st.sequences.map((s) => s.id));
      if (!ids.some((id) => existing.has(id))) {
        const rej = ids.map((id) => ({ id, reason: `relationship '${id}' does not exist` }));
        return okDirectGuarded(ctx, { removed: [], projectEnd: projectEndInfo(st).projectEnd }, rej);
      }
    }
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => removeDependenciesCore(ctx, ids));
    return enrichOk(res, () => ({
      removed: ((res as McpToolOk).data as { removed: string[] }).removed,
      projectEnd: projectEndInfo(ctx.app.store.getState()).projectEnd,
    }));
  },
};

function historyStep(ctx: Parameters<McpToolDef['handler']>[1], dir: 'undo' | 'redo'): McpToolResult {
  const g = guardNonTransactional(ctx);
  if (g) return g;
  const before = ctx.app.store.getState();
  const depthsBefore = historyDepthsForActiveScope(before);
  const depthBefore = dir === 'undo' ? depthsBefore.undoDepth : depthsBefore.redoDepth;
  if (dir === 'undo') ctx.app.store.getState().undo();
  else ctx.app.store.getState().redo();
  const after = ctx.app.store.getState();
  const depthsAfter = historyDepthsForActiveScope(after);
  const done = depthBefore > 0;
  return {
    ok: true,
    envelope: okEnvelope(ctx),
    data: {
      [dir === 'undo' ? 'undone' : 'redone']: done,
      undoDepth: depthsAfter.undoDepth,
      redoDepth: depthsAfter.redoDepth,
      projectEnd: after.cpmResult?.projectEnd ?? '',
      ...(done ? {} : { reason: `the applicable ${dir} history is empty; nothing was ${dir === 'undo' ? 'undone' : 'redone'}` }),
    },
  };
}

const undo: McpToolDef = {
  name: 'planner_undo',
  description:
    'Undo the last change in the ACTIVE document; check `undone`. The history is SHARED with the user (grid ' +
    'settings too): for what-if work use planner_duplicate_document.',
  kind: 'other',
  batchable: false,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: (_args, ctx): McpToolResult => historyStep(ctx, 'undo'),
};

const redo: McpToolDef = {
  name: 'planner_redo',
  description:
    'Redo the last undone change in the ACTIVE document; check `redone`.',
  kind: 'other',
  batchable: false,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: (_args, ctx): McpToolResult => historyStep(ctx, 'redo'),
};

function parseSetTaskSplits(args: unknown): { taskId: string; interruptions: unknown[] } | string {
  const a = (args ?? {}) as { taskId?: unknown; interruptions?: unknown };
  if (typeof a.taskId !== 'string' || a.taskId === '') return 'set_task_splits requires a `taskId`';
  if (!Array.isArray(a.interruptions)) return 'set_task_splits requires an `interruptions` array (empty = clear all interruptions)';
  return { taskId: a.taskId, interruptions: a.interruptions };
}

function planSplitsFor(
  st: AppState,
  p: { taskId: string; interruptions: unknown[] },
): { ok: true; pieces: SplitPiece[] | null } | { ok: false; code: 'NOT_FOUND' | 'VALIDATION'; reason: string } {
  const task = st.tasks.find((t) => t.id === p.taskId);
  if (!task) return { ok: false, code: 'NOT_FOUND', reason: `task '${p.taskId}' does not exist` };
  const plan = planTaskSplits(task, p.interruptions, st);
  return plan.ok ? plan : { ok: false, code: 'VALIDATION', reason: plan.reason };
}

function setTaskSplitsCore(ctx: McpContext, p: { taskId: string; interruptions: unknown[] }): MutationOutcome {
  const plan = planSplitsFor(ctx.app.store.getState(), p);
  if (!plan.ok) throw new McpStepError(plan.code, plan.reason);
  const refusal = ctx.transactions.draft.setTaskSplits(p.taskId, plan.pieces);
  if (refusal) throw new McpStepError('VALIDATION', `task '${p.taskId}': interruption refused (${refusal})`);
  return { data: splitsReport(ctx.app.store.getState(), p.taskId) };
}

function splitsReport(st: AppState, taskId: string) {
  const task = st.tasks.find((t) => t.id === taskId);
  if (!task) return { taskId };
  const { interruptions } = interruptionsOf(task, st);
  return {
    taskId,
    interruptions: interruptions ?? [],
    durationUnit: taskDurationUnit(task),
    scheduleDuration: task.time.scheduleDuration,
  };
}

const setTaskSplits: BatchStepTool = {
  name: 'planner_set_task_splits',
  description:
    'Replace one task\'s work interruptions ([] clears) instead of splitting the task. Positions exclude ' +
    'pauses and count WORK from task start: `{afterWorkDays: 5, pauseDays: 3}`; hour tasks use ' +
    '`afterWorkHours`/`pauseHours`. Whole units only; pauses extend duration. No milestones, summary tasks, ' +
    'hammocks, ELAPSEDTIME or manually scheduled tasks.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      interruptions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            afterWorkDays: { type: 'number', minimum: 0 },
            afterWorkHours: { type: 'number', minimum: 0 },
            pauseDays: { type: 'number', minimum: 0 },
            pauseHours: { type: 'number', minimum: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    required: ['taskId', 'interruptions'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseSetTaskSplits, setTaskSplitsCore),
  async handler(args, ctx) {
    const parsed = parseSetTaskSplits(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const pre = guardNonTransactional(ctx);
    if (pre) return pre;
    const plan = planSplitsFor(ctx.app.store.getState(), parsed);
    if (!plan.ok) return toolError(ctx, plan.code, plan.reason);
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => setTaskSplitsCore(ctx, parsed));
    return enrichOk(res, () => {
      const state = ctx.app.store.getState();
      return {
        ...splitsReport(state, parsed.taskId),
        tasks: freshDates(state, [parsed.taskId]),
        projectEnd: projectEndInfo(state).projectEnd,
      };
    });
  },
};

export const taskTools: McpToolDef[] = [
  addTasks,
  updateTasks,
  deleteTasks,
  moveTask,
  addDependencies,
  removeDependencies,
  undo,
  redo,
  setTaskSplits,
];
