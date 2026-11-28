import { keepsRecordedDates } from '@/state/recordedDateEditGate';
import { getTool } from '../toolIndex';
import { ATOMIC_ITEM_TOOLS, validateToolArgs } from '../schemaValidate';
import { mapTransactionError, runMutateTool, toolError, McpStepError, type MutationOutcome } from './runtime';
import type {
  ActivityEntry, McpContext, McpToolDef, McpToolResult,
} from '../contracts';
import { isRecord, isThenable } from '@/utils/guards';
import { createSnapshot, documentDataChanged } from '@/state/snapshot';
import { TEMP_ID_PATTERN } from './helpers';
import { ensureFreshSchedule, ensureFreshScheduleForRead } from '../freshness';

export const MAX_BATCH_STEPS = 100;

const MAX_JSON_CHARS = 4000;

export interface BatchStepTool extends McpToolDef {
  batchStep?: (args: unknown, ctx: McpContext) => MutationOutcome;
}

interface ParsedStep {
  tool: string;
  args: unknown;
}

type StepStatus = 'uitgevoerd' | 'gefaald' | 'niet bereikt';

export interface StepReport {
  step: number;
  tool: string;
  status: StepStatus;
  data?: unknown;
  error?: string;
}

interface Rejection {
  id: string;
  reason: string;
}

const BLOCKED_STEP_NAMES = new Set<string>([
  'planner_batch',
  'planner_undo',
  'planner_redo',
  'planner_new_document',
  'planner_switch_document',
  'planner_duplicate_document',
  'planner_list_documents',
  'planner_export_ifc',
  'planner_import_schedule',
  'planner_save_baseline',
]);

const LEVEL_TOOL = 'planner_level_resources';

function compactJson(value: unknown): string {
  let s: string;
  try {
    s = JSON.stringify(value) ?? 'null';
  } catch {
    s = '"<not serializable>"';
  }
  return s.length > MAX_JSON_CHARS ? `${s.slice(0, MAX_JSON_CHARS)}…(truncated)` : s;
}

const NO_REWRITE_KEYS = new Set<string>([
  'name', 'names', 'description', 'descriptions', 'notes', 'note', 'title', 'label',
  'code', 'wbsCode', 'summary', 'text', 'author', 'company', 'reason', 'comment',
]);

function resolveTempIds(value: unknown, map: Map<string, string>, deniedBranch = false): unknown {
  if (map.size === 0) return value;
  if (typeof value === 'string') {
    if (deniedBranch || !TEMP_ID_PATTERN.test(value)) return value;
    return map.get(value) ?? value;
  }
  if (Array.isArray(value)) return value.map((v) => resolveTempIds(v, map, deniedBranch));
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveTempIds(v, map, deniedBranch || NO_REWRITE_KEYS.has(k));
    }
    return out;
  }
  return value;
}

function collectCreated(data: unknown, map: Map<string, string>, stepNr: number): void {
  const created = isRecord(data) ? data.created : undefined;
  if (!isRecord(created)) return;
  for (const [tempId, realId] of Object.entries(created)) {
    if (typeof realId !== 'string') continue;
    if (!TEMP_ID_PATTERN.test(tempId)) {
      throw new McpStepError(
        'VALIDATION',
        `step ${stepNr}: tempId '${tempId}' does not follow the reserved batch syntax — inside planner_batch ` +
        'every tempId must start with `tmp-` or `tmp_` (e.g. `tmp-foundation`), so the automatic replacement ' +
        'can never hit ordinary text',
      );
    }
    map.set(tempId, realId);
  }
}

function formatReport(report: StepReport[]): string {
  const rows = report.map((r) => {
    if (r.status === 'uitgevoerd') return `${r.step}. ${r.tool} — executed (rolled back)`;
    if (r.status === 'gefaald') return `${r.step}. ${r.tool} — failed: ${r.error ?? 'unknown reason'}`;
    return `${r.step}. ${r.tool} — not reached`;
  });
  return `Report per step (everything rolled back): ${rows.join('; ')}.`;
}

export function recomputeMidBatch(ctx: McpContext): void {
  if (keepsRecordedDates(ctx.app)) return;
  ctx.app.store.getState().runCPM({ withinEvent: true });
  ctx.app.store.getState().recomputeViewRows();
  ctx.app.store.getState().recomputeResourceLoad();
  const err = ctx.app.store.getState().cpmResult?.error;
  if (err) throw new McpStepError(mapTransactionError(err), `intermediate recalculation failed: ${err}`);
}

export function invokeStep(def: BatchStepTool, args: unknown, ctx: McpContext): MutationOutcome {
  if (def.batchStep) return def.batchStep(args, ctx);

  const res = def.handler(args, ctx) as McpToolResult | Promise<McpToolResult>;
  if (isThenable(res)) {
    res.then(() => undefined, () => undefined);
    throw new McpStepError('INTERNAL', `tool '${def.name}' returned an asynchronous result; batch steps must be synchronous`);
  }
  if (!res.ok) throw new McpStepError(res.code, res.error);
  return { data: res.data, ...(res.itemRejections ? { itemRejections: res.itemRejections } : {}) };
}

export function executeSteps(
  steps: ParsedStep[],
  ctx: McpContext,
  report: StepReport[],
  substeps: ActivityEntry[],
  rejections: Rejection[],
): MutationOutcome {
  let mutatedSinceRecompute = false;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const startedAt = Date.now();
    const def = getTool(step.tool) as BatchStepTool | undefined;

    if (!def) {
      const message = `step ${i + 1}: unknown tool '${step.tool}'`;
      report[i].status = 'gefaald';
      report[i].error = message;
      substeps.push({
        ts: startedAt, tool: step.tool, summary: `step ${i + 1}/${steps.length} — ${step.tool}`,
        durationMs: Date.now() - startedAt, ok: false, error: message,
        argsJson: compactJson(step.args), resultJson: 'null',
      });
      throw new McpStepError('VALIDATION', message);
    }

    const args = resolveTempIds(step.args, ctx.tempIdMap);

    try {
      const schemaError = validateToolArgs(def.inputSchema, args, {
        deepArrayItems: ATOMIC_ITEM_TOOLS.has(def.name),
      });
      if (schemaError) {
        throw new McpStepError(
          'VALIDATION',
          `step ${i + 1}: invalid arguments for ${def.name} — ${schemaError}`,
        );
      }

      const derivesProgressDates = def.name === 'planner_update_tasks' && isRecord(args)
        && Array.isArray(args.updates)
        && args.updates.some(update => isRecord(update) && update.progress !== undefined);
      if (mutatedSinceRecompute && (def.kind === 'read' || def.name === LEVEL_TOOL || derivesProgressDates)) {
        recomputeMidBatch(ctx);
        mutatedSinceRecompute = false;
      }

      const beforeStep = def.kind === 'read' ? null : createSnapshot(ctx.app.store.getState());
      const outcome = invokeStep(def, args, ctx);
      if (beforeStep && documentDataChanged(beforeStep, createSnapshot(ctx.app.store.getState()))) {
        mutatedSinceRecompute = true;
      }

      collectCreated(outcome.data, ctx.tempIdMap, i + 1);
      for (const r of outcome.itemRejections ?? []) {
        rejections.push({ id: r.id, reason: `step ${i + 1} (${def.name}): ${r.reason}` });
      }

      report[i].status = 'uitgevoerd';
      report[i].data = outcome.data;
      substeps.push({
        ts: startedAt, tool: def.name, summary: `step ${i + 1}/${steps.length} — ${def.name}`,
        durationMs: Date.now() - startedAt, ok: true,
        argsJson: compactJson(args), resultJson: compactJson(outcome.data),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      report[i].status = 'gefaald';
      report[i].error = message;
      substeps.push({
        ts: startedAt, tool: def.name, summary: `step ${i + 1}/${steps.length} — ${def.name}`,
        durationMs: Date.now() - startedAt, ok: false, error: message,
        argsJson: compactJson(args), resultJson: 'null',
      });
      throw e;
    }
  }

  return {
    data: { rejections, stepCount: steps.length, steps: report, substeps },
    ...(rejections.length > 0 ? { itemRejections: rejections } : {}),
  };
}

function parseSteps(args: unknown): ParsedStep[] | string {
  const raw = isRecord(args) ? args.steps : undefined;
  if (!Array.isArray(raw)) return 'planner_batch requires a `steps` array with at least one step';
  if (raw.length === 0) return 'planner_batch requires a non-empty `steps` array';
  if (raw.length > MAX_BATCH_STEPS) {
    return `planner_batch accepts at most ${MAX_BATCH_STEPS} steps, got ${raw.length}`;
  }
  const steps: ParsedStep[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s: unknown = raw[i];
    if (!isRecord(s) || typeof s.tool !== 'string' || s.tool === '') {
      return `step ${i + 1}: every step requires a string field \`tool\``;
    }
    if (s.args !== undefined && !isRecord(s.args)) {
      return `step ${i + 1}: \`args\` must be an object (or be omitted)`;
    }
    steps.push({ tool: s.tool, args: s.args });
  }
  return steps;
}

function checkExclusions(steps: ParsedStep[]): string | null {
  for (let i = 0; i < steps.length; i++) {
    const def = getTool(steps[i].tool) as BatchStepTool | undefined;
    if (!def) continue;
    const at = `step ${i + 1}: '${def.name}'`;
    if (BLOCKED_STEP_NAMES.has(def.name)) {
      return `${at} is excluded from planner_batch (batch/undo/redo, document and file tools, save_baseline) — call that tool on its own`;
    }
    if (def.kind === 'document' || def.kind === 'batch') {
      return `${at} is a ${def.kind} tool and is excluded from planner_batch — call that tool on its own`;
    }
    if (def.batchable === false) {
      return `${at} is not batchable and is excluded from planner_batch — call that tool on its own`;
    }
    if (!def.batchStep && def.kind !== 'read') {
      return `${at} offers no synchronous batch core (batchStep) and therefore cannot run as a batch step — call that tool on its own`;
    }
  }
  return null;
}

const batch: McpToolDef = {
  name: 'planner_batch',
  description:
    'For coherent changes: up to 100 ordered steps, one undo, recalculation and backup. Failed step: roll ' +
    'back all; item refusals are soft (`rejections`). Later steps of this batch resolve exact tempIds ' +
    '(`tmp-…`) except in free text. Fixed args: read ids beforehand; only a final read is useful. Excludes planner_batch, undo/redo, document/file tools, ' +
    'planner_save_baseline, planner_get_planning_guide, planner_inspect_xer_provenance and ' +
    'planner_refresh_external_links.',
  kind: 'batch',
  batchable: false,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  inputSchema: {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_BATCH_STEPS,
        items: {
          type: 'object',
          required: ['tool'],
          properties: {
            tool: { type: 'string' },
            args: { type: 'object' },
          },
        },
      },
    },
    required: ['steps'],
  },
  async handler(args, ctx) {
    const parsed = parseSteps(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);

    const excluded = checkExclusions(parsed);
    if (excluded) return toolError(ctx, 'VALIDATION', excluded);

    const report: StepReport[] = parsed.map((s, i) => ({ step: i + 1, tool: s.tool, status: 'niet bereikt' as StepStatus }));
    const substeps: ActivityEntry[] = [];
    const rejections: Rejection[] = [];

    ctx.tempIdMap.clear();

    const hasReadStep = parsed.some((step) => getTool(step.tool)?.kind === 'read');
    const hasLevelStep = parsed.some((step) => step.tool === LEVEL_TOOL);
    let recalculatedBefore = false;
    const beforeTransaction = hasReadStep || hasLevelStep
      ? () => {
        const fresh = hasLevelStep ? ensureFreshSchedule(ctx.app) : ensureFreshScheduleForRead(ctx.app);
        recalculatedBefore = fresh.recomputed;
      }
      : undefined;

    const res = await runMutateTool(
      ctx, 'batch', () => executeSteps(parsed, ctx, report, substeps, rejections), { beforeTransaction },
    );
    if (recalculatedBefore && res.envelope) res.envelope.scheduleRecalculated = true;
    ctx.tempIdMap.clear();

    if (!res.ok && report.some((r) => r.status !== 'niet bereikt')) {
      return { ...res, error: `${res.error}\n${formatReport(report)}`, data: { steps: report, substeps } };
    }
    return res;
  },
};

export const batchTools: McpToolDef[] = [batch];
