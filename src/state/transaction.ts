// Compatibele importplek voor beleid en runtime-types. Alle mutable uitvoeringsmetadata leeft in
// de per-AppStoreContext-closure uit `createStoreRuntime`.
export {
  MAX_UNDO,
  createStoreRuntime,
  snapshotsEqual,
  type McpTransactionLease,
  type StoreRuntime,
} from './runtime/storeRuntime';
export { markScheduleStale } from './scheduleStale';
