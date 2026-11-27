import type { AppState } from '@/state/appStore';
import type { Baseline } from '@/types/baseline';
import type { McpContext, McpToolDef } from '../contracts';
import type { BatchStepTool } from './batchTool';
import { okDirect, parsedBatchStep, READ_ANNOTATIONS, unknownArgsReason, WRITE_ANNOTATIONS } from './helpers';
import {
  guardNonTransactional,
  McpStepError,
  runMutateTool,
  runReadTool,
  toolError,
  type MutationOutcome,
} from './runtime';

const LIST_HINT = 'get valid ids with planner_list_baselines';

function knownBaselinesHint(s: AppState): string {
  if (s.baselines.length === 0) return 'there are no baselines yet — create one with planner_save_baseline';
  const shown = s.baselines.slice(0, 5).map((b) => `${b.id} ('${b.name}')`);
  const rest = s.baselines.length - shown.length;
  return `known baselines: ${shown.join(', ')}${rest > 0 ? ` (+${rest} more)` : ''}`;
}

function unknownBaselineReason(s: AppState, baselineId: string): string {
  return `unknown baseline id '${baselineId}' — ${LIST_HINT} (${knownBaselinesHint(s)})`;
}

function baselineIdShapeReason(value: unknown): string {
  return `\`baselineId\` must be a non-empty string (${LIST_HINT}), got ${value === undefined ? 'nothing' : `${typeof value} '${String(value)}'`}`;
}

function findBaseline(s: AppState, id: string): Baseline | null {
  return s.baselines.find((b) => b.id === id) ?? null;
}

function nameOf(s: AppState, id: string | null): string | null {
  if (!id) return null;
  return findBaseline(s, id)?.name ?? null;
}

function listBaselinesCore(s: AppState) {
  const active = s.activeBaselineId;
  const baselines = s.baselines.map((b) => ({
    id: b.id,
    name: b.name,
    createdAt: b.createdAt,
    taskCount: b.tasks.length,
    projectEnd: b.projectEnd || null,
    projectDuration: b.projectDuration,
    isActive: b.id === active,
  }));
  let hint: string | undefined;
  if (baselines.length === 0) {
    hint = 'There are no baselines yet. Record one with planner_save_baseline; only then can planner_compare_baseline and planner_analyze_delay measure.';
  } else if (!active) {
    hint = 'There is no ACTIVE baseline; planner_compare_baseline and planner_analyze_delay refuse until you activate one with planner_activate_baseline.';
  }
  return {
    count: baselines.length,
    activeBaselineId: active,
    activeBaselineName: nameOf(s, active),
    baselines,
    ...(hint ? { hint } : {}),
  };
}

const listBaselines: McpToolDef = {
  name: 'planner_list_baselines',
  description:
    'List baselines with their ids and which one is active.',
  kind: 'read',
  batchable: true,
  annotations: READ_ANNOTATIONS,
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler(args, ctx) {
    const bad = unknownArgsReason(args, [], 'planner_list_baselines');
    if (bad) return toolError(ctx, 'VALIDATION', bad);
    return runReadTool(ctx, (s) => listBaselinesCore(s));
  },
};

interface ActivateArgs { baselineId: string | null }

function parseActivate(args: unknown): ActivateArgs | string {
  const bad = unknownArgsReason(args, ['baselineId'], 'planner_activate_baseline');
  if (bad) return bad;
  const a = (args ?? {}) as { baselineId?: unknown };
  if (!('baselineId' in a) || a.baselineId === undefined) {
    return '`baselineId` is required (the id of the baseline that should become active, or null to have no active baseline)';
  }
  if (a.baselineId === null) return { baselineId: null };
  if (typeof a.baselineId !== 'string' || a.baselineId === '') {
    return `\`baselineId\` must be a non-empty string (or null), got ${typeof a.baselineId} '${String(a.baselineId)}'`;
  }
  return { baselineId: a.baselineId };
}

function activatePlan(s: AppState, p: ActivateArgs): { error: string } | { changed: boolean; data: unknown } {
  if (p.baselineId !== null && !findBaseline(s, p.baselineId)) {
    return { error: unknownBaselineReason(s, p.baselineId) };
  }
  const previousActiveBaselineId = s.activeBaselineId;
  const changed = previousActiveBaselineId !== p.baselineId;
  return {
    changed,
    data: {
      activeBaselineId: p.baselineId,
      activeBaselineName: nameOf(s, p.baselineId),
      previousActiveBaselineId,
      previousActiveBaselineName: nameOf(s, previousActiveBaselineId),
      changed,
      ...(changed
        ? {}
        : {
            reason: p.baselineId === null
              ? 'there was already no active baseline — nothing was changed'
              : 'this baseline was already active — nothing was changed',
          }),
      ...(p.baselineId === null && changed
        ? { note: 'There is now NO active baseline; planner_compare_baseline and planner_analyze_delay refuse until you activate one again.' }
        : {}),
    },
  };
}

function activateCore(ctx: McpContext, p: ActivateArgs): MutationOutcome {
  const s = ctx.app.store.getState();
  const plan = activatePlan(s, p);
  if ('error' in plan) throw new McpStepError('VALIDATION', plan.error);
  if (plan.changed) ctx.app.store.getState().setActiveBaseline(p.baselineId);
  return { data: plan.data };
}

const activateBaseline: BatchStepTool = {
  name: 'planner_activate_baseline',
  description:
    'Make a baseline the active yardstick of planner_compare_baseline and planner_analyze_delay; `null` = none.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      baselineId: { type: ['string', 'null'] },
    },
    required: ['baselineId'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseActivate, activateCore),
  async handler(args, ctx) {
    const parsed = parseActivate(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);

    const g = guardNonTransactional(ctx);
    if (g) return g;

    const plan = activatePlan(ctx.app.store.getState(), parsed);
    if ('error' in plan) return toolError(ctx, 'VALIDATION', plan.error);
    if (!plan.changed) return okDirect(ctx, plan.data, []);

    return await runMutateTool(ctx, 'mutate', (): MutationOutcome => activateCore(ctx, parsed));
  },
};

interface RenameArgs { baselineId: string; name: string }

function parseRename(args: unknown): RenameArgs | string {
  const bad = unknownArgsReason(args, ['baselineId', 'name'], 'planner_rename_baseline');
  if (bad) return bad;
  const a = (args ?? {}) as { baselineId?: unknown; name?: unknown };
  if (typeof a.baselineId !== 'string' || a.baselineId === '') {
    return baselineIdShapeReason(a.baselineId);
  }
  if (typeof a.name !== 'string') {
    return `\`name\` must be a string, got ${a.name === undefined ? 'nothing' : `${typeof a.name} '${String(a.name)}'`}`;
  }
  if (a.name.trim() === '') return '`name` must not be empty — give a recognizable name';
  return { baselineId: a.baselineId, name: a.name };
}

function renamePlan(s: AppState, p: RenameArgs): { error: string } | { changed: boolean; data: unknown } {
  const b = findBaseline(s, p.baselineId);
  if (!b) {
    return { error: unknownBaselineReason(s, p.baselineId) };
  }
  const changed = b.name !== p.name;
  const duplicate = s.baselines.some((x) => x.id !== p.baselineId && x.name === p.name);
  return {
    changed,
    data: {
      baselineId: p.baselineId,
      name: p.name,
      previousName: b.name,
      changed,
      ...(changed ? {} : { reason: 'the baseline already had that name — nothing was changed' }),
      ...(duplicate ? { warning: `Another baseline is also called '${p.name}'; they can now only be told apart by id.` } : {}),
    },
  };
}

function renameCore(ctx: McpContext, p: RenameArgs): MutationOutcome {
  const plan = renamePlan(ctx.app.store.getState(), p);
  if ('error' in plan) throw new McpStepError('VALIDATION', plan.error);
  if (plan.changed) ctx.app.store.getState().renameBaseline(p.baselineId, p.name);
  return { data: plan.data };
}

const renameBaseline: BatchStepTool = {
  name: 'planner_rename_baseline',
  description:
    'Rename a baseline; the new name must not be empty.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      baselineId: { type: 'string' },
      name: { type: 'string' },
    },
    required: ['baselineId', 'name'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseRename, renameCore),
  async handler(args, ctx) {
    const parsed = parseRename(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);

    const g = guardNonTransactional(ctx);
    if (g) return g;

    const plan = renamePlan(ctx.app.store.getState(), parsed);
    if ('error' in plan) return toolError(ctx, 'VALIDATION', plan.error);
    if (!plan.changed) return okDirect(ctx, plan.data, []);

    return await runMutateTool(ctx, 'mutate', (): MutationOutcome => renameCore(ctx, parsed));
  },
};

interface DeleteArgs { baselineId: string }

function parseDelete(args: unknown): DeleteArgs | string {
  const bad = unknownArgsReason(args, ['baselineId'], 'planner_delete_baseline');
  if (bad) return bad;
  const a = (args ?? {}) as { baselineId?: unknown };
  if (typeof a.baselineId !== 'string' || a.baselineId === '') {
    return baselineIdShapeReason(a.baselineId);
  }
  return { baselineId: a.baselineId };
}

function deleteCore(ctx: McpContext, p: DeleteArgs): MutationOutcome {
  const before = ctx.app.store.getState();
  const target = findBaseline(before, p.baselineId);
  if (!target) {
    throw new McpStepError('VALIDATION', unknownBaselineReason(before, p.baselineId));
  }
  const wasActive = before.activeBaselineId === p.baselineId;
  const previousActiveBaselineId = before.activeBaselineId;

  ctx.app.store.getState().deleteBaseline(p.baselineId);

  const after = ctx.app.store.getState();
  if (findBaseline(after, p.baselineId)) {
    throw new McpStepError('INTERNAL', `baseline '${p.baselineId}' is still there after deleting it`);
  }
  const activeBaselineId = after.activeBaselineId;
  const activeBaselineName = nameOf(after, activeBaselineId);

  let note: string | undefined;
  if (wasActive && activeBaselineId) {
    note =
      `The deleted baseline was the ACTIVE one; '${activeBaselineName}' (${activeBaselineId}) is now active. ` +
      'planner_compare_baseline and planner_analyze_delay now measure against THAT yardstick — choose ' +
      'another one with planner_activate_baseline if needed.';
  } else if (wasActive) {
    note =
      'The deleted baseline was the ACTIVE one and none is left: planner_compare_baseline and ' +
      'planner_analyze_delay now refuse until you record a new one with planner_save_baseline.';
  }

  return {
    data: {
      deletedBaselineId: target.id,
      deletedName: target.name,
      deletedCreatedAt: target.createdAt,
      deletedTaskCount: target.tasks.length,
      wasActive,
      previousActiveBaselineId,
      activeBaselineId,
      activeBaselineName,
      remainingCount: after.baselines.length,
      ...(note ? { note } : {}),
    },
  };
}

const deleteBaseline: BatchStepTool = {
  name: 'planner_delete_baseline',
  description:
    'Delete a baseline; it cannot be rebuilt. Deleting the ACTIVE one activates the last remaining one.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      baselineId: { type: 'string' },
    },
    required: ['baselineId'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseDelete, deleteCore),
  async handler(args, ctx) {
    const parsed = parseDelete(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    return await runMutateTool(ctx, 'mutate', (): MutationOutcome => deleteCore(ctx, parsed));
  },
};

export const baselineTools: McpToolDef[] = [
  listBaselines,
  activateBaseline,
  renameBaseline,
  deleteBaseline,
];

export { listBaselines, activateBaseline, renameBaseline, deleteBaseline };
