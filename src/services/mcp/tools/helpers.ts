// Gedeelde post-transactie-helpers voor de MCP-toolmodules (T19 taskTools, T20 calendarResourceTools).
//
// Deze helpers zitten BEWUST niet in `runtime.ts`: dat bestand draagt het (bevroren) F1-runtime-
// contract — envelop/guards/transactie-wrapper — en wordt bij de F-merge 1-op-1 door de echte
// F1-implementatie vervangen. De helpers hieronder zijn puur tool-laag-conventie: hoe een geslaagd
// resultaat ná de transactie wordt verrijkt met verse, herrekende store-waarden, en hoe een
// statisch-lege bulk zónder transactie wordt beantwoord.
import type { AppState } from '@/state/appStore';
import type { McpContext, McpToolOk, McpToolResult } from '../contracts';
import { buildEnvelope } from './runtime';

/** Envelop voor niet-transactionele antwoorden: store-envelop + de context-vlaggen. */
export function okEnvelope(ctx: McpContext) {
  const env = buildEnvelope(ctx);
  env.paused = ctx.paused;
  env.readOnly = ctx.readOnly;
  return env;
}

/** Herrekende datums per taak (ná de eind-runCPM uit de store gelezen). */
export function freshDates(state: AppState, ids: string[]): { id: string; earlyStart: string; earlyFinish: string }[] {
  const tasks = state.tasks;
  return ids.map((id) => {
    const t = tasks.find((x) => x.id === id);
    return { id, earlyStart: t?.time.earlyStart ?? '', earlyFinish: t?.time.earlyFinish ?? '' };
  });
}

/** Projecteinde + optioneel de capped-taken (onwerkbaar-venster-signaal) uit het verse cpmResult. */
export function projectEndInfo(state: AppState): { projectEnd: string; cappedTaskIds?: string[] } {
  const cpm = state.cpmResult;
  const cappedTaskIds = cpm?.cappedTaskIds && cpm.cappedTaskIds.length > 0 ? cpm.cappedTaskIds : undefined;
  return { projectEnd: cpm?.projectEnd ?? '', ...(cappedTaskIds ? { cappedTaskIds } : {}) };
}

/** Vervang de `data` van een geslaagd resultaat door een verrijkte payload (post-transactie gelezen). */
export function enrichOk(res: McpToolResult, build: () => unknown): McpToolResult {
  if (res.ok) (res as McpToolOk).data = build();
  return res;
}

/**
 * Directe Ok-respons ZONDER transactie (lege-batch-snelpad, T19-reviewfix Issue 2). Wordt gebruikt
 * wanneer een muterende bulk-call statisch nul uitvoerbare items heeft: dan mag er géén
 * `runInMcpTransaction` draaien — dat zou een spurious undo-snapshot pushen én de redo-stack van de
 * user wissen door een AI-no-op. Ook het pad voor bewust mutatie-vrije tools (`level_resources`
 * met `dryRun`).
 */
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
