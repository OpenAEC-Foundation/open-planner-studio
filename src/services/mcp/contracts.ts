import type { AppStoreContext } from '@/state/appStore';
import type { McpTransactions } from '@/state/runtime/createMcpTransactions';

export interface McpRecomputedRemainingWork {
  taskId: string;
  taskName: string;
  assignmentId: string;
  resourceId: string;
  beforeHours: number;
  afterHours: number;
}

export interface McpEnvelope {
  activeDocumentId: string;
  documentTitle: string;
  scheduleStale: boolean;
  paused: boolean;
  readOnly: boolean;
  backupCreated?: string;
  backupWithheld?: string;
  timephasedGuidanceLost?: number;
  remainingWorkRecomputed?: McpRecomputedRemainingWork[];
  scheduleRecalculated?: true;
  datesAsRecorded?: true;
  scheduleNote?: string;
  scheduleError?: string;
}

export interface McpToolOk {
  ok: true;
  envelope: McpEnvelope;
  data: unknown;
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
  data?: unknown;
}

export type McpToolResult = McpToolOk | McpToolErr;

export type EnsureBackupFn = (docId: string, kind: McpToolDef['kind']) => Promise<string | null>;
export type MarkDuplicateBornFn = (docId: string) => void;

export interface McpBackupBinding {
  ensureBackup: EnsureBackupFn;
  markDuplicateBorn: MarkDuplicateBornFn;
  withheld?: () => string | null;
}

export interface McpContext {
  app: AppStoreContext;
  transactions: McpTransactions;
  expectedDocId: string | null;
  tempIdMap: Map<string, string>;
  paused: boolean;
  readOnly: boolean;
  ensureBackup: EnsureBackupFn;
  backupWithheld?: () => string | null;
  markDuplicateBorn: MarkDuplicateBornFn;
}

export interface McpToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

export interface McpToolDef {
  name: string;
  description: string;
  describe?: (ctx: McpContext) => string;
  kind: 'read' | 'mutate' | 'document' | 'other' | 'batch';
  batchable: boolean;
  inputSchema: object;
  annotations: McpToolAnnotations;
  handler: (args: unknown, ctx: McpContext) => McpToolResult | Promise<McpToolResult>;
}

export interface ActivityEntry {
  ts: number;
  tool: string;
  summary: string;
  summaryKind?: 'unparseableRequest';
  errorKind?: 'unparseableResponse' | 'error';
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
