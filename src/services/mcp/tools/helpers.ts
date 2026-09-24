// Gedeelde post-transactie-helpers voor de MCP-toolmodules (T19 taskTools, T20 calendarResourceTools).
//
// Deze helpers zitten BEWUST niet in `runtime.ts`: dat bestand draagt het (bevroren) F1-runtime-
// contract — envelop/guards/transactie-wrapper — en wordt bij de F-merge 1-op-1 door de echte
// F1-implementatie vervangen. De helpers hieronder zijn puur tool-laag-conventie: hoe een geslaagd
// resultaat ná de transactie wordt verrijkt met verse, herrekende store-waarden, en hoe een
// statisch-lege bulk zónder transactie wordt beantwoord.
import type { AppState } from '@/state/appStore';
import type { McpContext, McpToolAnnotations, McpToolOk, McpToolResult } from '../contracts';
import { buildEnvelope } from './runtime';

/** Leestool-annotaties (spec §Naamgeving): readOnly, niet-destructief, geen open wereld. `idempotentHint`
 *  is per MCP-conventie alleen zinvol op niet-readOnly tools ⇒ false. */
export const READ_ANNOTATIONS: McpToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

/** Basis voor een muterende tool binnen de app; per tool te verfijnen met `destructiveHint`/`idempotentHint`. */
export const WRITE_ANNOTATIONS: McpToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

/**
 * GERESERVEERDE TEMP-ID-SYNTAX. Binnen een batch moet elke tempId met `tmp-` of `tmp_` beginnen.
 * Alleen strings die aan dit patroon voldoen ÉN als tempId geregistreerd zijn, worden in de args van
 * latere stappen vervangen. Zonder zo'n gereserveerd naamruimtetje is elke vrije tekst een potentieel
 * doelwit: een `add_tasks` met `tempId:'Fundering'` maakte van een latere `name:'Fundering'` stil het
 * interne taak-id (reviewbevinding I1, met probe bewezen). Een `created`-map met een tempId die niet
 * aan het patroon voldoet, laat de batch LUID falen — nooit stil half toepassen. Tools die zelf
 * tempId's aannemen (`planner_manage_resources`) valideren tegen hetzelfde patroon.
 */
export const TEMP_ID_PATTERN = /^tmp[-_]/;

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
