import type { AppState } from '@/state/appStore';
import { isBlockingDialogOpen } from '@/state/blockingDialogs';
import type { DocumentInfo } from '@/state/slices/documentSlice';
import type { UIState } from '@/state/slices/types';
import { displayDocumentTitle } from '@/utils/documents';
import { ensureFreshScheduleForRead, type ReadFreshResult } from '../freshness';
import type {
  McpContext,
  McpEnvelope,
  McpErrorCode,
  McpToolResult,
  McpToolErr,
  McpToolDef,
} from '../contracts';

export interface MutationOutcome {
  data: unknown;
  itemRejections?: { id: string; reason: string }[];
}

export const MCP_UNTITLED_TITLE = 'New schedule';

export function mcpDocumentTitle(info: DocumentInfo | undefined): string {
  if (!info) return MCP_UNTITLED_TITLE;
  return displayDocumentTitle(info.title, info.untitledOrdinal, MCP_UNTITLED_TITLE);
}

export const DATES_AS_RECORDED_NOTE =
  'Dates as recorded: the dates are the ones recorded in the imported file, not recalculated by Open Planner ' +
  'Studio. Read tools do not recalculate in this mode, because recalculating would replace the recorded dates. ' +
  'The user can recalculate in the app (Recalculate, F5), and any change you make with a mutating tool ' +
  'recalculates the schedule and leaves this mode.';

export const EDIT_IN_PROGRESS_NOTE =
  'Not recalculated: the user is in the middle of an edit in the app (dragging or typing), and ' +
  'recalculating now would move bars under their hands. The dates may be out of date (`scheduleStale`); ' +
  'read again in a moment.';

export function buildEnvelope(ctx: McpContext): McpEnvelope {
  const s = ctx.app.store.getState();
  const active = s.getOpenDocuments().find((d) => d.isActive);
  const envelope: McpEnvelope = {
    activeDocumentId: s.activeDocumentId,
    documentTitle: mcpDocumentTitle(active),
    scheduleStale: s.scheduleStale,
    paused: s.ui.aiPaused,
    readOnly: s.ui.aiReadOnly,
  };
  if (s.datesAsRecorded) {
    envelope.datesAsRecorded = true;
    envelope.scheduleNote = DATES_AS_RECORDED_NOTE;
  }
  if (s.cpmResult?.error) envelope.scheduleError = s.cpmResult.error;
  return envelope;
}

const BLOCKING_UI_FLAGS = [
  'pendingCloseDocId',
  'showTaskDialog', 'showProjectSettings', 'showProjectInfoDialog', 'showSettingsDialog',
  'showCalendarDialog', 'showUpdateDialog', 'showNewProjectDialog', 'showFeedbackDialog',
  'showStructureDialog', 'showLevelingDialog', 'showBaselineDialog', 'showColumnsDialog',
  'showFilterDialog', 'showLayoutsDialog', 'showProjectOverview', 'presentationMode',
  'showTourOverlay', 'showWelcomeDialog', 'showTutorialOffer', 'showProgressImportDialog', 'pendingActualStartQuestion',
  'pendingPhaseAssignmentQuestion', 'pendingSiteOpen', 'pendingSiteSave', 'pendingIfcSchemaQuestion',
  'pendingPlanOnlyQuestion', 'pendingForeignChangesQuestion', 'pendingDependentAnchorWarning', 'savingBeforeClose', 'appClosing',
] as const;

function blockingDialogName(ui: UIState): string | null {
  const flags = ui as unknown as Record<string, unknown>;
  for (const flag of BLOCKING_UI_FLAGS) {
    if (flags[flag]) return flag;
  }
  return null;
}

function dialogGuard(ctx: McpContext, action: string): McpToolErr | null {
  const ui = ctx.app.store.getState().ui;
  if (!isBlockingDialogOpen(ui)) return null;
  const name = blockingDialogName(ui) ?? 'a dialog';
  return toolError(ctx, 'DIALOG_OPEN', `A dialog is open (${name}); close it first before the AI ${action}.`);
}

export class McpStepError extends Error {
  readonly code: McpErrorCode;
  constructor(code: McpErrorCode, message: string) {
    super(message);
    this.name = 'McpStepError';
    this.code = code;
  }
}

export function contextEnvelope(ctx: McpContext): McpEnvelope {
  const envelope = buildEnvelope(ctx);
  envelope.paused = ctx.paused;
  envelope.readOnly = ctx.readOnly;
  return envelope;
}

export function toolError(ctx: McpContext, code: McpErrorCode, message: string): McpToolErr {
  return { ok: false, code, error: message, envelope: contextEnvelope(ctx) };
}

export function mapTransactionError(message: string): McpErrorCode {
  return /circular dependency|kringverwijzing|\bkring\b|cyclus|\bcycle\b/i.test(message) ? 'CYCLE' : 'VALIDATION';
}

export function preBackupGuards(ctx: McpContext): McpToolErr | null {
  if (ctx.paused) {
    return toolError(ctx, 'PAUSED', 'The AI bridge has been paused by the user; mutating tools are refused for now.');
  }
  if (ctx.readOnly) {
    return toolError(ctx, 'READ_ONLY', 'The AI bridge is in read-only mode; mutating tools are refused while it is active.');
  }
  return dialogGuard(ctx, 'makes changes');
}

export function postAwaitGuards(ctx: McpContext): McpToolErr | null {
  const ui = ctx.app.store.getState().ui;
  ctx.paused = ui.aiPaused;
  ctx.readOnly = ui.aiReadOnly;
  return preBackupGuards(ctx);
}

function driftGuard(ctx: McpContext): McpToolErr | null {
  const activeId = ctx.app.store.getState().activeDocumentId;
  if (ctx.expectedDocId !== null && ctx.expectedDocId !== activeId) {
    return toolError(
      ctx,
      'DOC_DRIFT',
      `The active document has changed: was ${ctx.expectedDocId}, now ${activeId} — confirm with switch_document`,
    );
  }
  if (ctx.expectedDocId === null) {
    ctx.expectedDocId = activeId;
  }
  return null;
}

export function runReadTool(
  ctx: McpContext,
  fn: (s: AppState, freshen: () => ReadFreshResult) => unknown,
  opts?: { freshSchedule?: boolean },
): McpToolResult {
  const blocked = dialogGuard(ctx, 'reads the schedule');
  if (blocked) return blocked;
  const freshness: { result?: ReadFreshResult } = {};
  const freshen = (): ReadFreshResult => (freshness.result ??= freshenScheduleForRead(ctx));
  try {
    if (opts?.freshSchedule) freshen();
    const data = fn(ctx.app.store.getState(), freshen);
    const envelope = buildEnvelope(ctx);
    if (freshness.result?.recomputed) envelope.scheduleRecalculated = true;
    if (freshness.result?.heldByEdit) envelope.scheduleNote = EDIT_IN_PROGRESS_NOTE;
    return { ok: true, envelope, data };
  } catch (e) {
    if (e instanceof McpStepError) return toolError(ctx, e.code, e.message);
    return toolError(ctx, 'INTERNAL', e instanceof Error ? e.message : String(e));
  }
}

export function freshenScheduleForRead(ctx: McpContext): ReadFreshResult {
  if (ctx.transactions.isActive()) return { recomputed: false };
  return ensureFreshScheduleForRead(ctx.app);
}

export async function runMutateTool(
  ctx: McpContext,
  kind: McpToolDef['kind'],
  fn: () => MutationOutcome,
  opts?: {
    beforeTransaction?: () => void;
  },
): Promise<McpToolResult> {
  const preErr = preBackupGuards(ctx);
  if (preErr) return preErr;

  const backupDocId = ctx.app.store.getState().activeDocumentId;
  const backupWithheld = ctx.backupWithheld?.() ?? null;
  let backupPath: string | null = null;
  try {
    backupPath = backupWithheld ? null : await ctx.ensureBackup(backupDocId, kind);
  } catch (e) {
    return toolError(ctx, 'BACKUP_FAILED', `AI backup before the change failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const postErr = postAwaitGuards(ctx);
  if (postErr) return postErr;
  const driftErr = driftGuard(ctx);
  if (driftErr) return driftErr;
  opts?.beforeTransaction?.();

  let stepError: McpStepError | undefined;
  const res = ctx.transactions.run(() => {
    try {
      return fn();
    } catch (e) {
      if (e instanceof McpStepError) stepError = e;
      throw e;
    }
  });
  if (!res.ok) {
    if (stepError) return toolError(ctx, stepError.code, stepError.message);
    return toolError(ctx, mapTransactionError(res.error), res.error);
  }

  const envelope = buildEnvelope(ctx);
  if (backupPath) envelope.backupCreated = backupPath;
  if (backupWithheld) envelope.backupWithheld = backupWithheld;
  if (res.timephasedGuidanceLost > 0) envelope.timephasedGuidanceLost = res.timephasedGuidanceLost;
  if (res.remainingWorkRecomputed.length > 0) {
    const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;
    envelope.remainingWorkRecomputed = res.remainingWorkRecomputed.map((item) => ({
      taskId: item.taskId, taskName: item.taskName, assignmentId: item.assignmentId, resourceId: item.resourceId,
      beforeHours: hours(item.beforeMinutes), afterHours: hours(item.afterMinutes),
    }));
  }
  const outcome = res.value;
  const ok: McpToolResult = { ok: true, envelope, data: outcome.data };
  if (outcome.itemRejections && outcome.itemRejections.length > 0) {
    ok.itemRejections = outcome.itemRejections;
  }
  return ok;
}

export function bindExpectedDoc(ctx: McpContext): void {
  ctx.expectedDocId = ctx.app.store.getState().activeDocumentId;
}

export function guardNonTransactional(ctx: McpContext): McpToolErr | null {
  const preErr = preBackupGuards(ctx);
  if (preErr) return preErr;
  return driftGuard(ctx);
}
