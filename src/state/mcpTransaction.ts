import { appStoreContext } from './appStore';
import { createMcpTransactions } from './runtime/createMcpTransactions';

export const mcpTransactions = createMcpTransactions(appStoreContext);
export const draft = mcpTransactions.draft;
export const runInMcpTransaction = mcpTransactions.run;

export type {
  BulkTaskItem,
  McpDraft,
  McpTransactionResult,
  McpTransactions,
} from './runtime/createMcpTransactions';
