import { appStoreContext } from './appStore';
import { createBatchTransactions } from './runtime/createBatchTransactions';

export const batchTransactions = createBatchTransactions(appStoreContext);
export const withTransaction = batchTransactions.withTransaction;

export type { BatchTransactions } from './runtime/createBatchTransactions';
