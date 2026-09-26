// Gedeelde post-transactie-helpers voor de MCP-toolmodules.
//
// Deze helpers zitten BEWUST niet in `runtime.ts`: dat bestand draagt het runtime-contract —
// envelop/guards/transactie-wrapper. De helpers hieronder zijn puur tool-laag-conventie: hoe een geslaagd
// resultaat ná de transactie wordt verrijkt met verse, herrekende store-waarden, en hoe een
// statisch-lege bulk zónder transactie wordt beantwoord.
import type { AppState } from '@/state/appStore';
import type { McpContext, McpToolAnnotations, McpToolOk, McpToolResult } from '../contracts';
import { contextEnvelope, guardNonTransactional, McpStepError, type MutationOutcome } from './runtime';

/** Leestool-annotaties: readOnly, niet-destructief, geen open wereld. `idempotentHint`
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
 * doelwit: een `add_tasks` met `tempId:'Fundering'` zou van een latere `name:'Fundering'` stil het
 * interne taak-id maken. Een `created`-map met een tempId die niet
 * aan het patroon voldoet, laat de batch LUID falen — nooit stil half toepassen. Tools die zelf
 * tempId's aannemen (`planner_manage_resources`) valideren tegen hetzelfde patroon.
 */
export const TEMP_ID_PATTERN = /^tmp[-_]/;

/** Envelop voor niet-transactionele antwoorden: store-envelop + de context-vlaggen. */
export const okEnvelope = contextEnvelope;

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
 * Directe Ok-respons ZONDER transactie (lege-batch-snelpad). Wordt gebruikt wanneer een muterende
 * bulk-call statisch nul uitvoerbare items heeft: dan hoeft er géén `runInMcpTransaction` (en dus ook
 * geen AI-backup) te draaien. De transactie zelf laat een wijziging-loze call ook ongemoeid
 * (`documentDataChanged` op haar commit-plek); dit snelpad is de goedkope voorkant van die regel. Ook
 * het pad voor bewust mutatie-vrije tools (`level_resources` met `dryRun`).
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

/** `okDirect` achter dezelfde guards als een muterende call (pauze → alleen-lezen → dialoog →
 *  drift): het lege-batch-/no-op-snelpad van een muterende tool mag een gepauzeerde of gedrifte
 *  bridge niet stil `ok` laten melden. */
export function okDirectGuarded(
  ctx: McpContext,
  data: unknown,
  rejections: { id: string; reason: string }[],
): McpToolResult {
  return guardNonTransactional(ctx) ?? okDirect(ctx, data, rejections);
}

/**
 * De `batchStep` van een bulk-mutatietool (zie de noot bovenin taskTools.ts): dezelfde
 * `parse` als de handler, maar een vormfout is binnen een batch een STRUCTURELE stapfout (harde
 * `VALIDATION`, de hele batch rolt terug) in plaats van een `toolError`; daarna de synchrone kern.
 */
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

/**
 * Reden wanneer `args` geen object is of een sleutel buiten `allowed` draagt (`additionalProperties:
 * false`, maar als RUNTIME-poort in de tool zelf — `planner_batch` roept leestools en sommige
 * mutatietools buiten de schemavalidatie van de dispatcher om aan). `null` ⇒ in orde. Zonder
 * afsluitende punt; een aanroeper die volzinnen meldt, zet die er zelf achter.
 */
export function unknownArgsReason(args: unknown, allowed: readonly string[], toolName: string): string | null {
  if (args === undefined || args === null) return null;
  if (typeof args !== 'object' || Array.isArray(args)) return `${toolName} verwacht een object met argumenten`;
  for (const key of Object.keys(args as Record<string, unknown>)) {
    if (allowed.includes(key)) continue;
    return allowed.length === 0
      ? `${toolName} neemt geen argumenten, maar kreeg \`${key}\``
      : `onbekend argument \`${key}\` voor ${toolName}; toegestaan: ${allowed.join(', ')}`;
  }
  return null;
}

/** De weigertekst voor een argument dat gezet is maar geen boolean (zonder afsluitende punt). */
export function booleanArgReason(value: unknown, name: string): string {
  return `\`${name}\` moet een boolean zijn (true/false), kreeg ${typeof value} '${String(value)}'`;
}
