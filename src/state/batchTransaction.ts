import { appStoreContext } from './appStore';
import { createBatchTransactions } from './runtime/createBatchTransactions';

/** Compatibiliteitsadapter voor de gemounte app-singleton; domeinlogica staat in de factory. */
export const batchTransactions = createBatchTransactions(appStoreContext);
export const withTransaction = batchTransactions.withTransaction;

export type { BatchTransactions } from './runtime/createBatchTransactions';
