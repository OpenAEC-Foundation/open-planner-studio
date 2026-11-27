import type { AppState } from '@/state/appStore';
import type { McpContext, McpToolAnnotations, McpToolOk, McpToolResult } from '../contracts';
import { contextEnvelope, guardNonTransactional, McpStepError, type MutationOutcome } from './runtime';

export const READ_ANNOTATIONS: McpToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export const WRITE_ANNOTATIONS: McpToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export const TEMP_ID_PATTERN = /^tmp[-_]/;

export const okEnvelope = contextEnvelope;

export function freshDates(state: AppState, ids: string[]): { id: string; earlyStart: string; earlyFinish: string }[] {
  const tasks = state.tasks;
  return ids.map((id) => {
    const t = tasks.find((x) => x.id === id);
    return { id, earlyStart: t?.time.earlyStart ?? '', earlyFinish: t?.time.earlyFinish ?? '' };
  });
}

export function projectEndInfo(state: AppState): { projectEnd: string; cappedTaskIds?: string[] } {
  const cpm = state.cpmResult;
  const cappedTaskIds = cpm?.cappedTaskIds && cpm.cappedTaskIds.length > 0 ? cpm.cappedTaskIds : undefined;
  return { projectEnd: cpm?.projectEnd ?? '', ...(cappedTaskIds ? { cappedTaskIds } : {}) };
}

export function enrichOk(res: McpToolResult, build: () => unknown): McpToolResult {
  if (res.ok) (res as McpToolOk).data = build();
  return res;
}

export function okDirect(
  ctx: McpContext,
  data: unknown,
  rejections: { id: string; reason: string }[],
): McpToolResult {
  const ok: McpToolOk = {
    ok: true,
    envelope: okEnvelope(ctx),
    data,
    ...(rejections.length > 0 ? { itemRejections: rejections } : {}),
  };
  return ok;
}

export function okDirectGuarded(
  ctx: McpContext,
  data: unknown,
  rejections: { id: string; reason: string }[],
): McpToolResult {
  return guardNonTransactional(ctx) ?? okDirect(ctx, data, rejections);
}

export function parsedBatchStep<P>(
  parse: (args: unknown, state: AppState) => P | string,
  core: (ctx: McpContext, parsed: P) => MutationOutcome,
): (args: unknown, ctx: McpContext) => MutationOutcome {
  return (args, ctx) => {
    const parsed = parse(args, ctx.app.store.getState());
    if (typeof parsed === 'string') throw new McpStepError('VALIDATION', parsed);
    return core(ctx, parsed);
  };
}

export function unknownArgsReason(args: unknown, allowed: readonly string[], toolName: string): string | null {
  if (args === undefined || args === null) return null;
  if (typeof args !== 'object' || Array.isArray(args)) return `${toolName} expects an object with arguments`;
  for (const key of Object.keys(args as Record<string, unknown>)) {
    if (allowed.includes(key)) continue;
    return allowed.length === 0
      ? `${toolName} takes no arguments, but got \`${key}\``
      : `unknown argument \`${key}\` for ${toolName}; allowed: ${allowed.join(', ')}`;
  }
  return null;
}

export function booleanArgReason(value: unknown, name: string): string {
  return `\`${name}\` must be a boolean (true/false), got ${typeof value} '${String(value)}'`;
}
