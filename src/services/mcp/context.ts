import type { AppStoreContext } from '@/state/appStoreFactory';
import type { McpTransactions } from '@/state/runtime/createMcpTransactions';
import type { McpBackupBinding, McpContext } from './contracts';

export function createMcpContext(
  app: AppStoreContext,
  transactions: McpTransactions,
  backup: McpBackupBinding,
): McpContext {
  const ui = app.store.getState().ui;
  return {
    app,
    transactions,
    expectedDocId: null,
    tempIdMap: new Map<string, string>(),
    paused: ui.aiPaused,
    readOnly: ui.aiReadOnly,
    ensureBackup: backup.ensureBackup,
    markDuplicateBorn: backup.markDuplicateBorn,
    ...(backup.withheld ? { backupWithheld: backup.withheld } : {}),
  };
}
