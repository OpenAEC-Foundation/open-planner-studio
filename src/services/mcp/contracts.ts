// Contracten voor de MCP-bridge — BEVROREN: alleen additieve uitbreidingen.

import type { AppStoreContext } from '@/state/appStore';
import type { McpTransactions } from '@/state/runtime/createMcpTransactions';

/** Envelop op elke tool-respons. */
export interface McpEnvelope {
  activeDocumentId: string;
  documentTitle: string;
  scheduleStale: boolean;
  paused: boolean;
  readOnly: boolean;
  /** Pad van de zojuist geschreven AI-backup; alleen gezet op de call die hem maakte. */
  backupCreated?: string;
  /** Additieve contractuitbreiding: aantal taken waarvan DEZE mutatie de MSP-timephased-
   *  sturing losliet (`clearTimephasedWindow`/`clearTimephasedDurationWalks` gaven `true` terug —
   *  zie `taskDefaults.ts`). Alleen gezet, en > 0, op de call die het verlies veroorzaakte. De
   *  in-app melding is het primaire kanaal (eenmalig per document per sessie, ziet de gebruiker
   *  ook zonder AI-client); dit veld laat de AI-client het verlies ZONDER UI ook zien, zonder aan de
   *  eenmalige-melding-gate te hangen — een tweede mutatie die opnieuw sturing loslaat (geen nieuwe
   *  toast meer, zie `timephasedLossNotice.ts`) draagt dit veld dus gewoon opnieuw. */
  timephasedGuidanceLost?: number;
}

export interface McpToolOk {
  ok: true;
  envelope: McpEnvelope;
  data: unknown;
  /** Per-item-zachte weigeringen binnen een bulk-call. */
  itemRejections?: { id: string; reason: string }[];
}

export type McpErrorCode =
  | 'DOC_DRIFT' | 'DIALOG_OPEN' | 'PAUSED' | 'READ_ONLY' | 'VALIDATION'
  | 'NOT_FOUND' | 'CYCLE' | 'STALE_PRECONDITION' | 'SCOPE' | 'BACKUP_FAILED' | 'INTERNAL';

export interface McpToolErr {
  ok: false;
  envelope?: McpEnvelope;
  error: string;
  code: McpErrorCode;
  /**
   * Additieve aanvulling op het bevroren contract: een fout mag OPTIONEEL gestructureerde context
   * dragen. `error` blijft de
   * leesbare samenvatting; dit veld is de machine-leesbare bijlage. Nodig omdat een teruggerolde
   * `planner_batch` anders zijn stap-rapport en sub-stappen kwijt is — juist bij een mislukking wil
   * het AI-activiteitenpaneel tonen wélke stap viel. De dispatcher stuurt het hele resultaat al als
   * `structuredContent` mee, dus er verandert niets aan het transport.
   */
  data?: unknown;
}

export type McpToolResult = McpToolOk | McpToolErr;

/**
 * Backup-hook (implementatie in `backup.ts`). Draait op de dispatch-grens, vóór de
 * contextgebonden MCP-transactie. Resolve = backup-pad, of null (geen backup nodig).
 */
export type EnsureBackupFn = (docId: string, kind: McpToolDef['kind']) => Promise<string | null>;
export type MarkDuplicateBornFn = (docId: string) => void;

/** Eén ondeelbare backupbinding: beide functies moeten dezelfde contextservice bezitten. */
export interface McpBackupBinding {
  ensureBackup: EnsureBackupFn;
  markDuplicateBorn: MarkDuplicateBornFn;
}

export interface McpContext {
  /** Store, runtime en app-host waarop dit request is gebonden. */
  app: AppStoreContext;
  /** Transacties en drafts die uitsluitend bij `app` horen. */
  transactions: McpTransactions;
  /** Drift-anker: verwacht actief document-id (null vóór de eerste document-binding). */
  expectedDocId: string | null;
  /** tempId→realId-map; de batch-executor bezit en vult deze. */
  tempIdMap: Map<string, string>;
  /** Vlaggen uit de ui-state, door de runtime ingevuld. */
  paused: boolean;
  readOnly: boolean;
  ensureBackup: EnsureBackupFn;
  /** Registreert een duplicaat bij exact dezelfde service als `ensureBackup`. */
  markDuplicateBorn: MarkDuplicateBornFn;
}

export interface McpToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

export interface McpToolDef {
  /** Altijd met service-prefix: 'planner_add_tasks'. */
  name: string;
  /**
   * Additieve aanvulling op het bevroren contract: tools/list vereist beschrijvingen. De AI kiest
   * tools op beschrijving.
   */
  description: string;
  /** Stuurt guards + backup-trigger. */
  kind: 'read' | 'mutate' | 'document' | 'other' | 'batch';
  /** Mag deze tool als batch-stap draaien? */
  batchable: boolean;
  /** JSON-schema; eenheden expliciet (completion 0-100). */
  inputSchema: object;
  annotations: McpToolAnnotations;
  /**
   * Async toegestaan (bestandstools doen echte I/O; de dispatcher awaits).
   * Batch-STAPPEN blijven synchroon (invariant binnen runInMcpTransaction).
   */
  handler: (args: unknown, ctx: McpContext) => McpToolResult | Promise<McpToolResult>;
}

/** Eén regel in het AI-activiteitenpaneel. */
export interface ActivityEntry {
  ts: number;
  tool: string;
  summary: string;
  durationMs: number;
  ok: boolean;
  error?: string;
  substeps?: ActivityEntry[];
  argsJson: string;
  resultJson: string;
}

export interface McpServerStatus {
  state: 'off' | 'live' | 'port-busy' | 'error';
  port: number;
  message?: string;
}
